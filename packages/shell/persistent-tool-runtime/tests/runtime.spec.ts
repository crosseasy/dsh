import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import AgentRegistry, { Inbox } from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import TerminalSessionService from '@deepseek-ai/dsh-terminal'
import type {
  TerminalBackend,
  TerminalBackendSession,
  TerminalReadRequest,
  TerminalSendOperation,
  TerminalSendRequest,
  TerminalSessionStatus,
  TerminalSignal,
  TerminalWaitReason,
} from '@deepseek-ai/dsh-terminal'
import { registerPersistentShellTool } from '@deepseek-ai/dsh-persistent-tool-runtime'
import type {
  PersistentCommandMarkers,
  PersistentShellDialect,
  PersistentToolRuntimeConfig,
  RetainedPersistentOutput,
} from '@deepseek-ai/dsh-persistent-tool-runtime'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'

const contexts: Context[] = []
let callNumber = 0

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

function agent(ctx: Context, suffix: string): { owner: Agent; dispose: () => Promise<void> } {
  const id = SessionId(`persistent-runtime-owner-${suffix}-${++callNumber}`)
  const scope = ctx.plugin(() => {})
  const session = Session.create(id, [], {
    version: 0,
    id,
    createdAt: 0,
    cwd: `/workspace/${suffix}`,
  })
  const owner: Agent = {
    id,
    options: {},
    session,
    inbox: new Inbox(session, { inserted: () => {}, discarded: () => {}, claimed: () => {} }),
    status: 'idle',
    ctx: scope.ctx,
    send: () => {},
    followup: () => {},
    steer: () => ({ outcome: Promise.resolve({ status: 'rejected' as const }) }),
    inject: () => {},
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
  ctx.agents.register(owner)
  return { owner, dispose: () => scope.dispose() }
}

function text(result: { content: { type: string; text?: string }[] }): string {
  return result.content.filter(block => block.type === 'text').map(block => block.text).join('')
}

function call(
  ctx: Context,
  owner: Agent,
  command: string,
  signal = new AbortController().signal,
) {
  return ctx.tools.execute({
    signal,
    callId: ToolCallId(`persistent-runtime-${++callNumber}`),
    name: 'fake',
    arguments: { command },
    agent: owner,
  })
}

async function waitFor<T>(read: () => T | undefined): Promise<T> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const value = read()
    if (value !== undefined) return value
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  throw new Error('timed out waiting for test state')
}

type SessionMode = 'normal' | 'block' | 'init-fail' | 'send-fail' | 'timeout'

const START_PATTERN = /__FAKE_START_[^_]+__/
const END_PATTERN = /__FAKE_END_[^:]+:/

class FakeSession implements TerminalBackendSession {
  readonly motd = 'fake> '
  readonly pid = 123
  readonly commandStarts = Promise.withResolvers<string>()
  statusValue: TerminalSessionStatus = { kind: 'running' }
  scrollback = this.motd
  closed: string[] = []
  sends: string[] = []
  pendingRelease: (() => void) | undefined
  closeGate: Promise<void> | undefined
  closeError: Error | undefined

  constructor(readonly mode: SessionMode) {}

  startSend(request: TerminalSendRequest): TerminalSendOperation {
    this.sends.push(request.text)
    if (request.text === 'init') {
      const result = this.result(this.motd, this.mode === 'init-fail' ? 'timeout' : 'stdin_read')
      return this.operation(Promise.resolve(result))
    }
    if (this.mode === 'send-fail') throw new Error('fake send failed')
    if (this.mode === 'timeout') {
      const done = new Promise<ReturnType<FakeSession['result']>>((resolve) => {
        request.signal?.addEventListener('abort', () => {
          this.scrollback += 'partial output'
          resolve(this.result('partial output', 'stdin_read'))
        }, { once: true })
      })
      return this.operation(done)
    }
    const command = /COMMAND:(.*)\nEND:/s.exec(request.text)?.[1] ?? request.text
    this.commandStarts.resolve(command)
    if (this.mode === 'block') {
      const done = new Promise<ReturnType<FakeSession['result']>>((resolve) => {
        this.pendingRelease = () => {
          const output = this.output(request.text, `done:${command}`)
          this.scrollback += output
          resolve(this.result(output, 'stdin_read'))
        }
      })
      return this.operation(done)
    }
    const output = this.output(request.text, `done:${command}`)
    this.scrollback += output
    return this.operation(Promise.resolve(this.result(output, 'stdin_read')))
  }

  read(_request: TerminalReadRequest) {
    const lines = this.scrollback.split('\n')
    return {
      text: this.scrollback,
      totalLines: lines.length,
      lineBegin: 0,
      lineEnd: lines.length,
      truncated: false,
    }
  }

  signal(_signal: TerminalSignal) {
    return Promise.resolve({ delivered: true as const, targetPgid: 123 })
  }

  status() {
    return this.statusValue
  }

  async close(reason: string) {
    this.closed.push(reason)
    await this.closeGate
    if (this.closeError !== undefined) throw this.closeError
    this.statusValue = { kind: 'exited', exitCode: 0, signal: null }
  }

  private output(wrapped: string, body: string): string {
    const start = START_PATTERN.exec(wrapped)?.[0]
    const end = END_PATTERN.exec(wrapped)?.[0]
    return `${start ?? ''}\n${body}\n${end ?? ''}0\n${this.motd}`
  }

  private result(viewport: string, waitReason: TerminalWaitReason) {
    return { viewport, waitReason, sessionStatus: this.statusValue, truncated: false }
  }

  private operation(done: Promise<ReturnType<FakeSession['result']>>): TerminalSendOperation {
    return {
      done,
      readOutput: () => ({ delta: '', truncated: false }),
      cancel: () => false,
    }
  }
}

function fakeDialect(): PersistentShellDialect {
  return {
    toolName: 'fake',
    toolDescription: 'Run fake persistent commands.',
    commandParameterDescription: 'The fake command to run.',
    backendType: 'fake',
    timeoutMs: 5_000,
    maxOutputChars: 1_000,
    timeoutCode: 'FAKE_TIMEOUT',
    lifecycleName: 'fake-persistent',
    resetMessage: 'The fake shell was reset.',
    truncatedMessage: '<truncated>',
    lostPrefixMessage: '<lost prefix>\n',
    initialize: async (ctx, owner, id, signal) => {
      const setup = ctx.terminals.startSend(owner, id, { text: 'init', submit: true, signal })
      const result = await setup.done
      if (result.sessionStatus.kind === 'exited' || result.waitReason === 'timeout') {
        throw new Error('fake shell did not accept initialization')
      }
    },
    createMarkers: () => {
      const nonce = `${++callNumber}`
      return { start: `__FAKE_START_${nonce}__`, end: `__FAKE_END_${nonce}:` }
    },
    wrapCommand: (command: string, marker: PersistentCommandMarkers) =>
      `${marker.start}\nCOMMAND:${command}\nEND:${marker.end}`,
    captureComplete: (snapshot: RetainedPersistentOutput, marker: PersistentCommandMarkers) => {
      const end = snapshot.text.lastIndexOf(marker.end)
      const status = /^(\d+)\r?\n/.exec(snapshot.text.slice(end + marker.end.length))?.[1]
      if (status === undefined) return undefined
      const start = snapshot.text.lastIndexOf(marker.start, end)
      return {
        text: snapshot.text.slice(start + marker.start.length, end).replace(/^\r?\n/, '').replace(/\r?\n$/, ''),
        incomplete: start < 0,
        exitCode: Number(status),
      }
    },
    capturePartial: (_snapshot, _marker, fallback) => ({ text: fallback, incomplete: false }),
    hasPartialCompletion: result => result.waitReason === 'stdin_read',
  }
}

function stubBackend(modes: SessionMode[] = ['normal']) {
  const sessions: FakeSession[] = []
  let spawnCount = 0
  const backend: TerminalBackend = {
    type: 'fake',
    async spawn() {
      const mode = modes[Math.min(spawnCount, modes.length - 1)] ?? 'normal'
      spawnCount += 1
      if (mode === 'init-fail' && sessions.length === 0) {
        const session = new FakeSession(mode)
        sessions.push(session)
        return session
      }
      const session = new FakeSession(mode)
      sessions.push(session)
      return session
    },
  }
  return { backend, sessions }
}

async function setup(
  runtimeConfig: Partial<PersistentToolRuntimeConfig> = {},
  modes: SessionMode[] = ['normal'],
) {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(TerminalSessionService)
  const stub = stubBackend(modes)
  ctx.terminals.registerBackend(stub.backend)
  const fiber = await ctx.plugin({
    inject: ['tools', 'terminals'],
    apply(pluginCtx) {
      registerPersistentShellTool(pluginCtx, { ...fakeDialect(), ...runtimeConfig })
    },
  })
  return { ctx, stub, fiber }
}

describe('persistent shell tool runtime', () => {
  it('dedupes concurrent first calls for one owner', async () => {
    const { ctx, stub } = await setup({}, ['block'])
    const { owner } = agent(ctx, 'same')
    const first = call(ctx, owner, 'one')
    const session = await waitFor(() => stub.sessions[0])
    await session.commandStarts.promise
    const second = call(ctx, owner, 'two')
    expect(stub.sessions).toHaveLength(1)

    session.pendingRelease?.()
    expect(text(await first)).toBe('done:one')
    const releaseSecond = await waitFor(() =>
      session.sends.filter(send => send.includes('COMMAND:')).length === 2 ? session.pendingRelease : undefined)
    releaseSecond()
    expect(text(await second)).toBe('done:two')
    expect(stub.sessions).toHaveLength(1)
  })

  it('serializes calls for the same owner', async () => {
    const { ctx, stub } = await setup({}, ['block'])
    const { owner } = agent(ctx, 'serialized')
    const first = call(ctx, owner, 'first')
    const session = await waitFor(() => stub.sessions[0])
    await session.commandStarts.promise
    const second = call(ctx, owner, 'second')
    await Promise.resolve()
    expect(session.sends.filter(send => send.includes('COMMAND:'))).toHaveLength(1)

    session.pendingRelease?.()
    expect(text(await first)).toBe('done:first')
    const releaseSecond = await waitFor(() =>
      session.sends.filter(send => send.includes('COMMAND:')).length === 2 ? session.pendingRelease : undefined)
    releaseSecond()
    expect(text(await second)).toBe('done:second')
  })

  it('does not serialize calls across owners', async () => {
    const { ctx, stub } = await setup({}, ['block', 'normal'])
    const firstOwner = agent(ctx, 'first').owner
    const secondOwner = agent(ctx, 'second').owner
    const first = call(ctx, firstOwner, 'first')
    const firstSession = await waitFor(() => stub.sessions[0])
    await firstSession.commandStarts.promise
    const second = call(ctx, secondOwner, 'second')

    expect(text(await second)).toBe('done:second')
    expect(stub.sessions).toHaveLength(2)
    firstSession.pendingRelease?.()
    expect(text(await first)).toBe('done:first')
  })

  it('closes live sessions on plugin dispose', async () => {
    const { ctx, stub, fiber } = await setup()
    const { owner } = agent(ctx, 'dispose')
    expect(text(await call(ctx, owner, 'before dispose'))).toBe('done:before dispose')

    await fiber.dispose()
    expect(stub.sessions[0]?.closed).toEqual(['fake-persistent disposed'])
  })

  it('waits for every live session to close before propagating one close failure', async () => {
    const { ctx, stub, fiber } = await setup()
    const firstOwner = agent(ctx, 'dispose-failure').owner
    const secondOwner = agent(ctx, 'dispose-slow').owner
    expect(text(await call(ctx, firstOwner, 'first'))).toBe('done:first')
    expect(text(await call(ctx, secondOwner, 'second'))).toBe('done:second')

    const closeError = new Error('fake close failed')
    stub.sessions[0]!.closeError = closeError
    const slowClose = Promise.withResolvers<undefined>()
    stub.sessions[1]!.closeGate = slowClose.promise
    const disposalErrors: unknown[] = []
    ctx.logger.error = ((error: unknown) => { disposalErrors.push(error) }) as typeof ctx.logger.error
    let settled = false
    const disposal = fiber.dispose().finally(() => {
      settled = true
    })

    await waitFor(() => stub.sessions[1]!.closed.length === 1 ? true : undefined)
    await Promise.resolve()
    const settledBeforeSlowClose = settled
    slowClose.resolve(undefined)
    await disposal
    expect(settledBeforeSlowClose).toBe(false)
    expect(disposalErrors).toEqual([closeError])
    expect(stub.sessions.map(session => session.closed)).toEqual([
      ['fake-persistent disposed'],
      ['fake-persistent disposed'],
    ])
    expect(stub.sessions[1]!.statusValue).toEqual({ kind: 'exited', exitCode: 0, signal: null })
  })

  it('invalidates cached sessions when the owner scope disposes', async () => {
    const { ctx, stub } = await setup()
    const { owner, dispose } = agent(ctx, 'owner')
    expect(text(await call(ctx, owner, 'first'))).toBe('done:first')

    await dispose()
    const replacement = agent(ctx, 'owner-replacement').owner
    expect(text(await call(ctx, replacement, 'second'))).toBe('done:second')
    expect(stub.sessions).toHaveLength(2)
  })

  it('creates a fresh session after spawn, init, send, and timeout failure', async () => {
    const { ctx, stub } = await setup({ timeoutMs: 10 }, ['init-fail', 'send-fail', 'timeout', 'normal'])
    const { owner } = agent(ctx, 'failure')
    expect((await call(ctx, owner, 'init fails')).isError).toBe(true)
    expect(stub.sessions[0]?.closed).toContain('fake-persistent initialization failed')
    expect((await call(ctx, owner, 'send fails')).isError).toBe(true)
    expect(stub.sessions[1]?.closed).toContain('fake-persistent send failed')

    const timedOut = text(await call(ctx, owner, 'times out'))
    expect(timedOut).toContain('timed out after 0 seconds or experienced an OOM error')
    expect(timedOut).toContain('The fake shell was reset.')
    expect(stub.sessions[2]?.closed).toContain('fake-persistent command timed out')
    expect(text(await call(ctx, owner, 'recovers'))).toBe('done:recovers')
    expect(stub.sessions).toHaveLength(4)
  })
})

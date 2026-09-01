/** Shared owner-scoped runtime for persistent shell tools backed by PTY sessions. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { TerminalSendResult, TerminalSessionId } from '@deepseek-ai/dsh-terminal'
import { deadline, timeoutOf } from '@deepseek-ai/dsh-timeout'
import { defineTool } from '@deepseek-ai/dsh-tools'

const SCROLLBACK_PAGE_LINES = 1_000
const POLL_INTERVAL_MS = 25

/** Start/end marker pair used to extract one submitted command from retained terminal output. */
export interface PersistentCommandMarkers { readonly start: string; readonly end: string }

/** Retained terminal output assembled from scrollback pages. */
export interface RetainedPersistentOutput { readonly text: string; readonly truncated: boolean }

/** Command output extracted from retained or incremental terminal output. */
export interface CapturedPersistentOutput { readonly text: string; readonly incomplete: boolean; readonly exitCode?: number }

/** Shell-specific hooks used by the generic persistent-tool runtime. */
export interface PersistentShellDialect {
  readonly toolName: string
  readonly toolDescription: string
  readonly commandParameterDescription: string
  readonly backendType: string
  readonly timeoutMs: number
  readonly maxOutputChars: number
  readonly timeoutCode: string
  readonly lifecycleName: string
  readonly pluginName?: string
  readonly resetSubject?: string
  readonly resetMessage: string
  readonly truncatedMessage: string
  readonly lostPrefixMessage: string
  initialize(ctx: Context, owner: Agent, id: TerminalSessionId, signal: AbortSignal): Promise<void>
  createMarkers(): PersistentCommandMarkers
  wrapCommand(command: string, marker: PersistentCommandMarkers): string
  captureComplete(
    snapshot: RetainedPersistentOutput,
    marker: PersistentCommandMarkers,
    wrappedCommand: string,
  ): CapturedPersistentOutput | undefined
  capturePartial(
    snapshot: RetainedPersistentOutput,
    marker: PersistentCommandMarkers,
    fallback: string,
    fallbackTruncated?: boolean,
    wrappedCommand?: string,
  ): CapturedPersistentOutput
  hasPartialCompletion(result: TerminalSendResult): boolean
}

/** Configuration accepted by {@link registerPersistentShellTool}. */
export type PersistentToolRuntimeConfig = PersistentShellDialect

function maybeTruncate(content: string, config: PersistentShellDialect, incomplete = false): string {
  if (content.length <= config.maxOutputChars && !incomplete) return content
  return content.length <= config.maxOutputChars
    ? content + config.truncatedMessage
    : content.slice(0, config.maxOutputChars) + config.truncatedMessage
}

function renderCaptured(output: CapturedPersistentOutput, config: PersistentShellDialect): string {
  const rendered = maybeTruncate(output.text, config, output.incomplete)
  const withPrefix = output.incomplete && output.text.length > 0
    ? config.lostPrefixMessage + rendered
    : rendered
  const marker = output.exitCode !== undefined && output.exitCode !== 0
    ? `[exit code: ${output.exitCode}]`
    : undefined
  return appendStatusMarker(withPrefix, marker)
}

function appendStatusMarker(content: string, marker: string | undefined): string {
  if (marker === undefined) return content
  return content.length === 0 ? marker : `${content}\n${marker}`
}

function renderShellExitStatus(
  content: string,
  exitCode: number | null,
  signal: NodeJS.Signals | null,
): string {
  const marker = signal !== null
    ? `[shell killed by signal: ${signal}]`
    : exitCode !== null
      ? `[shell exited: code ${exitCode}]`
      : '[shell exited]'
  return appendStatusMarker(content, marker)
}

async function pause(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))
}

function retainedScrollback(
  ctx: Context,
  owner: Agent,
  id: TerminalSessionId,
  latest = ctx.terminals.read(owner, id, { offset: 0, count: SCROLLBACK_PAGE_LINES }),
): RetainedPersistentOutput {
  const pages: string[] = latest.text.length === 0 ? [] : [latest.text]
  let offset = latest.lineEnd
  let truncated = latest.truncated
  while (true) {
    if (offset >= latest.totalLines) break
    const page = ctx.terminals.read(owner, id, { offset, count: SCROLLBACK_PAGE_LINES })
    truncated ||= page.truncated
    if (page.text.length > 0) pages.unshift(page.text)
    const next = page.text.length === 0 || page.lineEnd <= offset ? undefined : page.lineEnd
    if (next === undefined || next >= page.totalLines) break
    offset = next
  }
  return { text: pages.join('\n'), truncated }
}

async function respondToSessionExit(
  ctx: Context,
  reset: (owner: Agent, reason: string) => Promise<void>,
  owner: Agent,
  id: TerminalSessionId,
  status: { exitCode: number | null; signal: NodeJS.Signals | null },
  marker: PersistentCommandMarkers,
  wrapped: string,
  fallback: string,
  fallbackTruncated: boolean,
  config: PersistentShellDialect,
): Promise<string> {
  const snapshot = retainedScrollback(ctx, owner, id)
  await reset(owner, `${config.resetSubject ?? config.lifecycleName} shell exited`)
  return [
    renderShellExitStatus(
      renderCaptured(config.capturePartial(snapshot, marker, fallback, fallbackTruncated, wrapped), config),
      status.exitCode,
      status.signal,
    ),
    config.resetMessage,
  ].filter(part => part.length > 0).join('\n')
}

function persistentShells(ctx: Context, config: PersistentShellDialect) {
  const pending = new WeakMap<Agent, Promise<TerminalSessionId>>()
  const live = new Map<Agent, TerminalSessionId>()
  const creating = new Set<Promise<TerminalSessionId>>()
  const ownerCleanupInstalled = new WeakSet<Agent>()
  const lifecycle = new AbortController()
  const pluginName = config.pluginName ?? config.lifecycleName
  const resetSubject = config.resetSubject ?? config.lifecycleName

  const close = async (owner: Agent, id: TerminalSessionId, reason: string): Promise<void> => {
    if (!ctx.terminals.list(owner).some(snapshot => snapshot.sessionId === id)) return
    await ctx.terminals.kill(owner, id, reason)
  }

  ctx.effect(() => async () => {
    lifecycle.abort(new Error(`${pluginName} disposed during shell creation`))
    await Promise.allSettled([...creating])
    const closing = [...live].map(async ([owner, id]) => { await close(owner, id, `${pluginName} disposed`) })
    let closeFailed = false
    let closeFailure: unknown
    try {
      await Promise.all(closing)
    } catch (error: unknown) {
      closeFailed = true
      closeFailure = error
    }
    await Promise.allSettled(closing)
    live.clear()
    if (closeFailed) throw closeFailure
  }, `${pluginName} shell cleanup`)

  const reset = async (owner: Agent, reason: string): Promise<void> => {
    pending.delete(owner)
    const id = live.get(owner)
    live.delete(owner)
    if (id !== undefined) await close(owner, id, reason)
  }

  const get = (owner: Agent, signal: AbortSignal): Promise<TerminalSessionId> => {
    const existing = pending.get(owner)
    if (existing !== undefined) return existing
    const combinedSignal = AbortSignal.any([signal, lifecycle.signal])
    const creation = (async () => {
      try {
        const cwd = owner.session.header.cwd
        const spawned = await ctx.terminals.spawn(owner, {
          type: config.backendType,
          ...cwd === undefined ? {} : { cwd },
        }, combinedSignal)
        live.set(owner, spawned.sessionId)
        if (!ownerCleanupInstalled.has(owner)) {
          ownerCleanupInstalled.add(owner)
          owner.ctx.effect(() => () => {
            pending.delete(owner)
            live.delete(owner)
          }, `${pluginName} owner cache cleanup`)
        }
        await config.initialize(ctx, owner, spawned.sessionId, combinedSignal)
        return spawned.sessionId
      } catch (error: unknown) {
        await reset(owner, `${resetSubject} initialization failed`)
        throw error
      }
    })()
    const tracked = creation.finally(() => {
      creating.delete(tracked)
    })
    creating.add(tracked)
    pending.set(owner, tracked)
    return tracked
  }

  return { get, reset }
}

async function executeCommand(
  ctx: Context,
  shells: ReturnType<typeof persistentShells>,
  owner: Agent,
  command: string,
  config: PersistentShellDialect,
  upstream: AbortSignal,
): Promise<string> {
  using commandDeadline = deadline(upstream, config.timeoutMs, config.timeoutCode)
  const id = await shells.get(owner, commandDeadline.signal)
  const marker = config.createMarkers()
  const wrapped = config.wrapCommand(command, marker)
  let first = true
  let fallback = ''
  let fallbackTruncated = false

  while (true) {
    const status = ctx.terminals.list(owner).find(session => session.sessionId === id)?.status
    if (status?.kind === 'exited') {
      return await respondToSessionExit(
        ctx, shells.reset, owner, id, status, marker, wrapped, fallback, fallbackTruncated, config,
      )
    }
    let operation
    let result
    try {
      operation = ctx.terminals.startSend(owner, id, {
        text: first ? wrapped : '',
        submit: first,
        signal: commandDeadline.signal,
      })
      first = false
      result = await operation.done
    } catch (error: unknown) {
      await shells.reset(owner, `${config.resetSubject ?? config.lifecycleName} send failed`)
      throw error
    }
    const incremental = operation.readOutput()
    fallback = incremental.delta.length > 0 ? fallback + incremental.delta : result.viewport
    fallbackTruncated ||= incremental.truncated || result.truncated
    const latest = ctx.terminals.read(owner, id, { offset: 0, count: SCROLLBACK_PAGE_LINES })
    const timedOut = timeoutOf(commandDeadline.signal, config.timeoutCode)
    if (timedOut !== undefined) {
      const snapshot = retainedScrollback(ctx, owner, id, latest)
      const partial = renderCaptured(
        config.capturePartial(snapshot, marker, fallback, fallbackTruncated, wrapped),
        config,
      )
      await shells.reset(owner, `${config.resetSubject ?? config.lifecycleName} command timed out`)
      return [
        `Your command timed out after ${Math.round(timedOut.timeoutMs / 1000)} seconds or experienced an OOM error. Below is partial output:`,
        partial,
        config.resetMessage,
      ].join('\n')
    }
    if (commandDeadline.signal.aborted) {
      await shells.reset(owner, `${config.resetSubject ?? config.lifecycleName} command aborted`)
      commandDeadline.signal.throwIfAborted()
    }
    if (latest.text.includes(marker.end)) {
      const complete = config.captureComplete(retainedScrollback(ctx, owner, id, latest), marker, wrapped)
      if (complete !== undefined) return renderCaptured(complete, config)
    }
    if (result.sessionStatus.kind === 'exited') {
      return await respondToSessionExit(
        ctx, shells.reset, owner, id, result.sessionStatus, marker, wrapped, fallback, fallbackTruncated, config,
      )
    }
    if (config.hasPartialCompletion(result)) {
      const snapshot = retainedScrollback(ctx, owner, id, latest)
      return renderCaptured(
        config.capturePartial(snapshot, marker, fallback, fallbackTruncated, wrapped),
        config,
      )
    }
    await pause()
  }
}

/**
 * Register one model-facing persistent shell tool.
 * @param ctx - plugin context carrying tools and terminal services.
 * @param config - shell-specific runtime hooks and model-facing strings.
 */
export function registerPersistentShellTool(ctx: Context, config: PersistentToolRuntimeConfig): void {
  const shells = persistentShells(ctx, config)
  const queues = new WeakMap<Agent, Promise<void>>()

  const serialized = async <T>(owner: Agent, operation: () => Promise<T>): Promise<T> => {
    const prior = queues.get(owner)
    const run = prior === undefined ? operation() : prior.then(operation, operation)
    const tail = run.then(() => undefined, () => undefined)
    queues.set(owner, tail)
    try {
      return await run
    } finally {
      if (queues.get(owner) === tail) queues.delete(owner)
    }
  }

  ctx.tools.register(defineTool({
    name: config.toolName,
    description: config.toolDescription,
    parameters: {
      command: {
        type: 'string',
        required: true,
        description: config.commandParameterDescription,
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args, exec) {
      if (args.command.trim().length === 0) throw new Error('command must be a non-empty string')
      const owner = exec.agent
      if (owner === undefined) throw new Error(`${config.toolName} requires an owning agent session`)
      return serialized(owner, async () => {
        exec.signal.throwIfAborted()
        return executeCommand(ctx, shells, owner, args.command, config, exec.signal)
      })
    },
    presentCall: args => ({ card: 'terminal', title: args.command }),
  }))
}

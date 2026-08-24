/**
 * Consumer-side `SandboxPwshExecutor` tests. A fake Cordis sandbox service
 * makes wrapping, policy hand-off, fail-closed propagation, and fact stamping
 * deterministic; real-provider integration lives in `tests/acl.e2e.ts`.
 * Requires pwsh for the integration block (skips without it — same gate as
 * pwsh-local's suites); runner-failure priority coverage runs independently.
 */

import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { Context, Service } from '@deepseek-ai/cordis'
import { SandboxProvider, SandboxUnavailableError } from '@deepseek-ai/dsh-sandbox'
import type { ConfinedArgv, SandboxExecutionPolicy, SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import { resolvePwshPath } from '@deepseek-ai/dsh-pwsh-local'
import { SandboxPolicyService } from '@deepseek-ai/dsh-sandbox-policy'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type { SubprocessHandle, SubprocessOutputReader } from '@deepseek-ai/dsh-subprocess'
import { SandboxPwshExecutor } from '../src/index.ts'

// The same probe pwsh-local's suites and the vitest coverage exemption use:
// spawnSync never throws on a missing binary (it reports status null), and
// `where.exe pwsh` exits 1 when pwsh is absent — only the status is truth.
function pwshAvailable(): boolean {
  return spawnSync(resolvePwshPath(), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$true'], { encoding: 'utf8' }).status === 0
}

const spillDir = mkdtempSync(join(tmpdir(), 'dsh-pwsh-sandbox-spec-'))

/** One recorded provider call: the argv handed over and the policy it rode with. */
interface ConfineCall {
  argv: string[]
  policy: SandboxPolicy
}

/** A passthrough wrap: the caller's argv unchanged, asserted full — commands run unconfined, deterministically. */
const passthrough = (argv: readonly string[]): ConfinedArgv =>
  ({ argv: [...argv], enforcement: 'full', denialSignatures: ['access is denied', 'access to the path'], runnerFailureRules: [] })

/** A subprocess service whose spawn() throws SYNCHRONOUSLY — the paths the async service never produces. */
function throwingSubprocessRuntime(error: unknown): new (ctx: Context) => Service {
  return class extends Service {
    constructor(ctx: Context) {
      super(ctx, 'subprocess')
    }

    spawn(): never {
      throw error
    }
  }
}

async function setup(
  behavior: (argv: readonly string[], policy: SandboxPolicy) => ConfinedArgv = passthrough,
  subprocess: new (ctx: Context) => Service = LocalSubprocessRuntime,
): Promise<{ ctx: Context; executor: SandboxPwshExecutor; calls: ConfineCall[] }> {
  const calls: ConfineCall[] = []
  class FakeSandboxProvider extends SandboxProvider {
    confine(argv: readonly string[], policy: SandboxPolicy): ConfinedArgv {
      calls.push({ argv: [...argv], policy })
      return behavior(argv, policy)
    }
  }
  const ctx = new Context()
  await ctx.plugin(FakeSandboxProvider)
  await ctx.plugin(SandboxPolicyService, { mode: 'workspace-write', workspaceRoot: spillDir })
  await ctx.plugin(subprocess)
  if (ctx.subprocess instanceof LocalSubprocessRuntime) {
    ctx.subprocess.internals = { spillDir }
  }
  await ctx.plugin(SandboxPwshExecutor, { graceMs: 200 })
  return { ctx, executor: ctx.shell as SandboxPwshExecutor, calls }
}

const RO: SandboxExecutionPolicy = { mode: 'read-only', workspaceRoot: '/ws' }

afterAll(() => {
  rmSync(spillDir, { recursive: true, force: true })
})

it('makes a runtime runner failure outrank denial text through SandboxPwshExecutor', async () => {
  const { executor } = await setup(() => ({
    argv: [process.execPath, '-e', 'console.error(\'fake-runner: profile refused: Access is denied\'); process.exit(127)', '--'],
    enforcement: 'full',
    denialSignatures: ['access is denied'],
    runnerFailureRules: [{ allowedExitCodes: [127], fatalSignatures: ['fake-runner: '] }],
  }))
  await expect(executor.run(executor.resolve({ command: 'echo never-runs', sandboxPolicy: RO })))
    .rejects.toThrow(SandboxUnavailableError)
}, 30_000)

it.each([
  {
    description: 'a caller-killed task when pwsh exits 143',
    outcome: { exitCode: 143, signal: null },
    kill: true,
    abort: false,
    status: 'killed',
    denied: false,
  },
  {
    description: 'an AbortSignal-killed task when pwsh exits 143',
    outcome: { exitCode: 143, signal: null },
    kill: false,
    abort: true,
    status: 'killed',
    denied: false,
  },
  {
    description: 'a signal-killed task',
    outcome: { exitCode: null, signal: 'SIGTERM' },
    kill: false,
    abort: false,
    status: 'killed',
    denied: false,
  },
  {
    description: 'a naturally exited task when pwsh exits 143',
    outcome: { exitCode: 143, signal: null },
    kill: false,
    abort: false,
    status: 'completed',
    denied: true,
  },
] as const)('classifies $description against its lifecycle status', async ({ outcome: settled, kill, abort, status, denied }) => {
  const { ctx, executor } = await setup()
  try {
    const controller = new AbortController()
    const outcome = Promise.withResolvers<{
      exitCode: number | null
      signal: NodeJS.Signals | null
    }>()
    const emptyReader: SubprocessOutputReader = {
      readFrom: () => ({ text: '', nextOffset: 0, lossy: false }),
    }
    const denialReader: SubprocessOutputReader = {
      readFrom: () => ({ text: 'Access is denied.\n', nextOffset: 18, lossy: false }),
    }
    vi.spyOn(ctx.subprocess, 'spawn').mockReturnValue({
      pid: 42,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stdout: emptyReader, stderr: denialReader },
      done: outcome.promise,
      terminate: vi.fn(),
      waitForExit: async () => true,
    } satisfies SubprocessHandle)

    const task = executor.start(executor.resolve({
      command: 'ignored',
      sandboxPolicy: RO,
      ...(abort ? { signal: controller.signal } : {}),
    }))
    if (kill) expect(task.kill()).toBe(true)
    if (abort) controller.abort()
    outcome.resolve(settled)
    await task.done

    expect(task.status).toBe(status)
    expect(task.exitCode).toBe(settled.exitCode)
    expect(task.signal).toBe(settled.signal)
    expect(task.sandbox).toEqual({ mode: 'read-only', denied, enforcement: 'full' })
  } finally {
    await ctx.fiber.dispose()
  }
})

it('keeps an EMFILE spawn rejection with denial text killed and unattributed', async () => {
  const { ctx, executor } = await setup()
  try {
    const outcome = Promise.withResolvers<{
      exitCode: number | null
      signal: NodeJS.Signals | null
    }>()
    const emptyReader: SubprocessOutputReader = {
      readFrom: () => ({ text: '', nextOffset: 0, lossy: false }),
    }
    vi.spyOn(ctx.subprocess, 'spawn').mockReturnValue({
      pid: -1,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stdout: emptyReader, stderr: emptyReader },
      done: outcome.promise,
      terminate: vi.fn(),
      waitForExit: async () => true,
    } satisfies SubprocessHandle)

    const task = executor.start(executor.resolve({ command: 'ignored', sandboxPolicy: RO }))
    outcome.reject(Object.assign(new Error('Access is denied.'), {
      code: 'EMFILE',
      syscall: 'spawn pwsh',
      path: 'pwsh',
    }))
    await task.done

    expect(task.status).toBe('killed')
    expect(task.readOutput().delta).toContain('spawn failed: Error: Access is denied.')
    expect(task.sandbox).toEqual({ mode: 'read-only', denied: false, enforcement: 'full' })
  } finally {
    await ctx.fiber.dispose()
  }
})

describe.skipIf(!pwshAvailable())('SandboxPwshExecutor', () => {
  // Denial device for the POSIX classification cases: a mode-0555 directory
  // INSIDE a temp scratch tree (the same device as bash-sandbox's suites) —
  // unit tests never attempt writes outside the system temp directory. On
  // win32 there is no POSIX mode denial; the real-sandbox denial coverage
  // lives in tests/acl.e2e.ts, where the ACL runner denies scratch paths.
  const readOnlyDir = mkdtempSync(join(tmpdir(), 'dsh-pwsh-sandbox-ro-'))
  if (process.platform !== 'win32') chmodSync(readOnlyDir, 0o555)
  const deniedWriteCommand = `[IO.File]::WriteAllText('${join(readOnlyDir, 'probe.txt')}', 'x')`

  afterAll(() => {
    if (process.platform !== 'win32') chmodSync(readOnlyDir, 0o755)
    rmSync(readOnlyDir, { recursive: true, force: true })
  })

  it('wraps the exact pwsh argv through ctx.sandbox with the per-call policy', async () => {
    const { executor, calls } = await setup()
    const result = await executor.run(executor.resolve({ command: 'echo wrapped', sandboxPolicy: RO }))
    expect(result.exitCode).toBe(0)
    expect(calls).toHaveLength(1)
    const call = calls[0]
    expect(call?.policy).toEqual(RO)
    // The confined argv is the pwsh invocation, ready for a runner prefix.
    expect(call?.argv[0]).toMatch(/pwsh(\.exe)?$/u)
    expect(call?.argv).toContain('-NonInteractive')
    expect(call?.argv.at(-1)).toContain('echo wrapped')
    expect(result.sandbox).toEqual({ mode: 'read-only', denied: false, enforcement: 'full' })
  }, 30_000)

  it('advertises the deployment default mode and stamps the deployment policy when none rides the request', async () => {
    const { executor, calls } = await setup()
    expect(executor.sandboxMode).toBe('workspace-write')
    const result = await executor.run(executor.resolve({ command: 'echo fallback' }))
    expect(result.exitCode).toBe(0)
    expect(calls[0]?.policy.mode).toBe('workspace-write')
  }, 30_000)

  it('danger-full-access bypasses confine entirely and stamps full-access facts', async () => {
    const { executor, calls } = await setup()
    const result = await executor.run(executor.resolve({ command: 'echo full', sandboxPolicy: { mode: 'danger-full-access', workspaceRoot: '/ws' } }))
    expect(result.exitCode).toBe(0)
    expect(calls).toHaveLength(0)
    expect(result.sandbox).toEqual({ mode: 'danger-full-access', denied: false })
  }, 30_000)

  it('an aborted caller signal outranks runner-spawn attribution', async () => {
    const controller = new AbortController()
    controller.abort('caller-cancel')
    const { executor } = await setup(() => ({
      argv: ['definitely-not-a-real-runner', '--', 'pwsh'],
      enforcement: 'full',
      denialSignatures: [],
      runnerFailureRules: [],
    }))
    await expect(executor.run(executor.resolve({ command: 'echo never', sandboxPolicy: RO, signal: controller.signal })))
      .rejects.toThrow('caller-cancel')
  }, 30_000)

  // POSIX-only: the denial device is a mode-0555 scratch dir. On win32 the
  // real-sandbox denial classification is covered by tests/acl.e2e.ts
  // (the ACL runner denies scratch paths — unit tests never leave temp).
  it.skipIf(process.platform === 'win32')('classifies a failed write against the backend denial dialect', async () => {
    const { executor } = await setup()
    const result = await executor.run(executor.resolve({
      command: deniedWriteCommand,
      sandboxPolicy: RO,
    }))
    expect(result.exitCode).not.toBe(0)
    expect(result.sandbox).toEqual({ mode: 'read-only', denied: true, enforcement: 'full' })
  }, 30_000)

  it('a runner launch refusal fails closed with SANDBOX_UNAVAILABLE, never unconfined', async () => {
    const { executor } = await setup(() => ({
      argv: ['definitely-not-a-real-runner', '--', 'pwsh'],
      enforcement: 'full',
      denialSignatures: [],
      runnerFailureRules: [{ fatalSignatures: ['fake-runner: '] }],
    }))
    await expect(executor.run(executor.resolve({ command: 'echo never-runs', sandboxPolicy: RO })))
      .rejects.toThrow(SandboxUnavailableError)
  }, 30_000)

  it('a SYNCHRONOUS attributable spawn rejection in run() fails closed, an unattributable one rethrows', async () => {
    const attributable = Object.assign(new Error('sync-enoent'), { code: 'ENOENT', syscall: 'spawn node', path: 'node' })
    const { executor: closed } = await setup(() => ({
      argv: ['node', '--', 'pwsh'],
      enforcement: 'full',
      denialSignatures: [],
      runnerFailureRules: [{ fatalSignatures: ['fake-runner: '] }],
    }), throwingSubprocessRuntime(attributable))
    await expect(closed.run(closed.resolve({ command: 'echo never', sandboxPolicy: RO })))
      .rejects.toThrow(SandboxUnavailableError)

    const foreign = Object.assign(new Error('sync-emfile'), { code: 'EMFILE', syscall: 'spawn', path: 'node' })
    const { executor: passthroughError } = await setup(undefined, throwingSubprocessRuntime(foreign))
    await expect(passthroughError.run(passthroughError.resolve({ command: 'echo never', sandboxPolicy: RO })))
      .rejects.toThrow('sync-emfile')
  }, 30_000)

  it('a SYNCHRONOUS spawn rejection in start() follows the same attribution split', async () => {
    const attributable = Object.assign(new Error('sync-enoent-start'), { code: 'ENOENT', syscall: 'spawn node', path: 'node' })
    const { executor: closed } = await setup(() => ({
      argv: ['node', '--', 'pwsh'],
      enforcement: 'full',
      denialSignatures: [],
      runnerFailureRules: [{ fatalSignatures: ['fake-runner: '] }],
    }), throwingSubprocessRuntime(attributable))
    expect(() => closed.start(closed.resolve({ command: 'echo never', sandboxPolicy: RO })))
      .toThrow(SandboxUnavailableError)

    const foreign = Object.assign(new Error('sync-emfile-start'), { code: 'EMFILE', syscall: 'spawn', path: 'node' })
    const { executor: passthroughError } = await setup(undefined, throwingSubprocessRuntime(foreign))
    expect(() => passthroughError.start(passthroughError.resolve({ command: 'echo never', sandboxPolicy: RO })))
      .toThrow('sync-emfile-start')
  }, 30_000)

  it('background confined runs stamp clean facts at settlement', async () => {
    const { executor } = await setup()
    const clean = executor.start(executor.resolve({ command: 'echo background-ok', sandboxPolicy: RO }))
    await clean.done
    expect(clean.sandbox).toEqual({ mode: 'read-only', denied: false, enforcement: 'full' })
  }, 30_000)

  // POSIX-only denial device (mode-0555 scratch); win32 real-sandbox denial
  // coverage lives in tests/acl.e2e.ts.
  it.skipIf(process.platform === 'win32')('background denied writes stamp denied facts at settlement', async () => {
    const { executor } = await setup()
    const denied = executor.start(executor.resolve({
      command: deniedWriteCommand,
      sandboxPolicy: RO,
    }))
    await denied.done
    expect(denied.sandbox).toEqual({ mode: 'read-only', denied: true, enforcement: 'full' })
  }, 30_000)

  it('background spawn rejections settle as runnerFailed facts', async () => {
    const { executor } = await setup(() => ({
      argv: ['definitely-not-a-real-runner', '--', 'pwsh'],
      enforcement: 'full',
      denialSignatures: [],
      runnerFailureRules: [{ fatalSignatures: ['fake-runner: '] }],
    }))
    const proc = executor.start(executor.resolve({ command: 'echo never', sandboxPolicy: RO }))
    await proc.done
    expect(proc.sandbox).toEqual({ mode: 'read-only', denied: false, enforcement: 'full', runnerFailed: true })
    // The failure note surfaces through the read path.
    const read = proc.readOutput()
    expect(read.delta).toContain('spawn failed')
  }, 30_000)

  it('danger-full-access background runs bypass confine and carry no facts', async () => {
    const { executor, calls } = await setup()
    const proc = executor.start(executor.resolve({
      command: 'echo full-bg',
      sandboxPolicy: { mode: 'danger-full-access', workspaceRoot: '/ws' },
    }))
    await proc.done
    expect(calls).toHaveLength(0)
    expect(proc.sandbox).toBeUndefined()
  }, 30_000)
})

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SubprocessRuntime from '@deepseek-ai/dsh-subprocess'
import type {
  SubprocessHandle,
  SubprocessOutputRead,
  SubprocessOutputReader,
  SubprocessSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import type { ShellExecRequest, ShellExecSpec, ShellProcess, ShellRunResult } from '@deepseek-ai/dsh-shell'
import { OneShotSandboxSettlement, OneShotShellExecutor, oneShotShellSettings } from '@deepseek-ai/dsh-shell-runtime'
import type { OneShotShellSettings } from '@deepseek-ai/dsh-shell-runtime'

class MemoryReader implements SubprocessOutputReader {
  text = ''
  lossy = false
  spillPath: string | undefined

  readFrom(fromByte: number): SubprocessOutputRead {
    return {
      text: this.text.slice(fromByte),
      nextOffset: this.text.length,
      lossy: this.lossy,
      ...(this.spillPath !== undefined ? { spillPath: this.spillPath } : {}),
    }
  }
}

interface CapturedHandle extends SubprocessHandle {
  readonly stdoutReader: MemoryReader
  readonly stderrReader: MemoryReader
  resolve(outcome: { exitCode: number | null; signal: NodeJS.Signals | null }): void
  reject(error: unknown): void
  terminated: boolean
}

class CapturingSubprocessRuntime extends SubprocessRuntime {
  specs: SubprocessSpawnSpec[] = []
  handles: CapturedHandle[] = []

  override async resolveExecutable(command: string): Promise<string> {
    return command
  }

  override spawnTerminal(): Promise<never> {
    throw new Error('shell-runtime uses pipe spawns, not terminals')
  }

  override spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.specs.push(spec)
    const stdoutReader = new MemoryReader()
    const stderrReader = new MemoryReader()
    let resolve!: (outcome: { exitCode: number | null; signal: NodeJS.Signals | null }) => void
    let reject!: (error: unknown) => void
    const done = new Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>((res, rej) => {
      resolve = res
      reject = rej
    })
    const handle: CapturedHandle = {
      pid: this.handles.length + 1,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: { stdout: stdoutReader, stderr: stderrReader },
      done,
      stdoutReader,
      stderrReader,
      terminated: false,
      terminate: () => { handle.terminated = true },
      waitForExit: async () => true,
      resolve,
      reject,
    }
    this.handles.push(handle)
    return handle
  }
}

function bench(): { ctx: Context; subprocess: CapturingSubprocessRuntime } {
  const ctx = new Context()
  return { ctx, subprocess: new CapturingSubprocessRuntime(ctx) }
}

class TestExecutor extends OneShotShellExecutor {
  constructor(ctx: Context, private readonly settings: OneShotShellSettings) {
    super(ctx, {
      timeoutCode: 'TEST_TIMEOUT',
      droppedCollectMessage: 'missing collect stream',
    })
  }

  resolve(_request: ShellExecRequest): ShellExecSpec {
    throw new Error('not used')
  }

  run(spec: ShellExecSpec): Promise<ShellRunResult> {
    return this.runArgv(spec, ['custom-shell', '--run', spec.command])
  }

  start(spec: ShellExecSpec): ShellProcess {
    return this.startArgv(spec, ['custom-shell', '--background'])
  }

  protected oneShotShellSettings(_spec: ShellExecSpec): OneShotShellSettings {
    return this.settings
  }
}

function spec(fields: Partial<ShellExecSpec> = {}): ShellExecSpec {
  return {
    command: 'body',
    workdir: '/tmp/workspace',
    timeoutMs: 999,
    stdoutMaxBytes: 10,
    sandboxPolicy: undefined,
    ...fields,
  }
}

function executor(ctx: Context): TestExecutor {
  return new TestExecutor(ctx, {
    env: { FROM_CALLER: '1' },
    graceMs: 123,
    maxOutputBytes: 11,
    maxSpillBytes: 12,
  })
}

function shellProcess(): ShellProcess {
  return {
    status: 'running',
    exitCode: null,
    signal: null,
    done: Promise.resolve(),
    readOutput: () => ({ delta: '', lossy: false }),
    kill: () => false,
  }
}

describe('one-shot shell runtime', () => {
  it('projects adapter env, request env, and dsh env in caller precedence order', () => {
    const settings = oneShotShellSettings(
      { BASE: 'adapter', OVERRIDE: 'adapter' },
      { maxOutputBytes: 10, maxSpillBytes: 20, graceMs: 30 },
      spec({
        env: { OVERRIDE: 'request', REQUEST: '1', DSH_OVERRIDE: 'request' },
        dshEnv: { DSH_OVERRIDE: 'dsh', DSH_EXTRA: '1' },
      }),
    )

    expect(settings).toEqual({
      env: {
        BASE: 'adapter',
        OVERRIDE: 'request',
        REQUEST: '1',
        DSH_OVERRIDE: 'dsh',
        DSH_EXTRA: '1',
      },
      maxOutputBytes: 10,
      maxSpillBytes: 20,
      graceMs: 30,
    })
  })

  it('runs exact argv with caller-owned spawn fields and classifies normal completion', async () => {
    const { ctx, subprocess } = bench()
    const shell = executor(ctx)
    const pending = shell.run(spec({
      stdin: 'input',
    }))
    const handle = subprocess.handles[0]!
    handle.stdoutReader.text = 'out'
    handle.stderrReader.text = 'err'
    handle.resolve({ exitCode: 7, signal: null })

    await expect(pending).resolves.toMatchObject({
      exitCode: 7,
      signal: null,
      timedOut: false,
      aborted: false,
      timeoutMs: 999,
      stdout: { text: 'out', truncated: false },
      stderr: { text: 'err', truncated: false },
    })
    expect(subprocess.specs[0]).toMatchObject({
      argv: ['custom-shell', '--run', 'body'],
      cwd: '/tmp/workspace',
      stdio: {
        stdin: { data: 'input' },
        stdout: { maxBytes: 10, spill: { maxBytes: 12 } },
        stderr: { maxBytes: 11, spill: { maxBytes: 12 } },
      },
      graceMs: 123,
      env: { FROM_CALLER: '1' },
    })
  })

  it('classifies the runtime deadline separately from upstream abort', async () => {
    const { ctx, subprocess } = bench()
    const shell = new TestExecutor(ctx, {
      env: {},
      graceMs: 50,
      maxOutputBytes: 10,
      maxSpillBytes: 20,
    })
    const pending = shell.run(spec({
      timeoutMs: 10,
    }))
    const handle = subprocess.handles[0]!
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(subprocess.specs[0]!.signal?.aborted).toBe(true)
    handle.resolve({ exitCode: null, signal: 'SIGTERM' })

    const result = await pending
    expect(result.timedOut).toBe(true)
    expect(result.aborted).toBe(false)
  })

  it('starts a consuming background handle and settles kill once', async () => {
    const { ctx, subprocess } = bench()
    const settled: Array<{ status: string; stderr: string; spawnFailed: boolean }> = []
    class HookedExecutor extends TestExecutor {
      protected override onProcessDone(handle: ShellProcess, stderr: string, spawnFailed: boolean): void {
        settled.push({ status: handle.status, stderr, spawnFailed })
      }
    }
    const shell = new HookedExecutor(ctx, {
      env: {},
      graceMs: 50,
      maxOutputBytes: 10,
      maxSpillBytes: 20,
    })
    const proc = shell.start(spec())
    const handle = subprocess.handles[0]!
    handle.stdoutReader.text = 'out'
    expect(proc.readOutput()).toMatchObject({ delta: 'out', lossy: false })
    expect(proc.readOutput().delta).toBe('')
    expect(proc.kill()).toBe(true)
    expect(handle.terminated).toBe(true)
    handle.stderrReader.text = 'err'
    handle.resolve({ exitCode: null, signal: 'SIGTERM' })
    await proc.done

    expect(proc.status).toBe('killed')
    expect(proc.signal).toBe('SIGTERM')
    expect(proc.kill()).toBe(false)
    expect(settled).toEqual([{ status: 'killed', stderr: 'err', spawnFailed: false }])
  })

  it('settles background spawn failures as killed with a single readable note', async () => {
    const { ctx, subprocess } = bench()
    const proc = executor(ctx).start(spec())
    subprocess.handles[0]!.reject(new Error('ENOENT'))

    await expect(proc.done).resolves.toBeUndefined()
    expect(proc.status).toBe('killed')
    expect(proc.readOutput().delta).toContain('[stderr]\nspawn failed: Error: ENOENT')
    expect(proc.readOutput().delta).toBe('')
  })
})

describe('one-shot sandbox settlement', () => {
  it('keeps overlapping background facts scoped to the process handle and consumes them once', () => {
    const settlement = new OneShotSandboxSettlement((mode, detail) => new Error(`${mode}: ${detail ?? ''}`))
    const first = shellProcess()
    const second = shellProcess()

    const firstStarted = settlement.start({
      spec: spec(),
      mode: 'read-only',
      confine: mode => ({
        argv: ['first-runner', '--', mode],
        enforcement: 'partial',
        denialSignatures: ['first denied'],
        runnerFailureRules: [],
      }),
      startConfined: (_current, argv) => {
        expect(argv).toEqual(['first-runner', '--', 'read-only'])
        return first
      },
      startUnconfined: () => {
        throw new Error('unexpected full-access start')
      },
    })
    const secondStarted = settlement.start({
      spec: spec(),
      mode: 'workspace-write',
      confine: mode => ({
        argv: ['second-runner', '--', mode],
        enforcement: 'full',
        denialSignatures: ['second denied'],
        runnerFailureRules: [],
      }),
      startConfined: (_current, argv) => {
        expect(argv).toEqual(['second-runner', '--', 'workspace-write'])
        return second
      },
      startUnconfined: () => {
        throw new Error('unexpected full-access start')
      },
    })
    expect(firstStarted).toBe(first)
    expect(secondStarted).toBe(second)

    second.status = 'completed'
    second.exitCode = 1
    settlement.settleProcess(second, 'write: second denied', false)
    expect(second.sandbox).toEqual({ mode: 'workspace-write', denied: true, enforcement: 'full' })

    first.status = 'completed'
    first.exitCode = 1
    settlement.settleProcess(first, 'write: first denied', false)
    expect(first.sandbox).toEqual({ mode: 'read-only', denied: true, enforcement: 'partial' })

    second.sandbox = { mode: 'danger-full-access', denied: false }
    settlement.settleProcess(second, 'write: second denied', false)
    expect(second.sandbox).toEqual({ mode: 'danger-full-access', denied: false })

    const untracked = shellProcess()
    settlement.settleProcess(untracked, 'write: first denied', false)
    expect(untracked.sandbox).toBeUndefined()
  })

  it('consumes background facts after the process settles once', () => {
    const settlement = new OneShotSandboxSettlement((mode, detail) => new Error(`${mode}: ${detail ?? ''}`))
    const proc = shellProcess()
    const started = settlement.start({
      spec: spec(),
      mode: 'read-only',
      confine: mode => ({
        argv: ['sandbox-runner', '--', mode],
        enforcement: 'partial',
        denialSignatures: ['permission denied'],
        runnerFailureRules: [],
      }),
      startConfined: (_current, argv) => {
        expect(argv).toEqual(['sandbox-runner', '--', 'read-only'])
        return proc
      },
      startUnconfined: () => {
        throw new Error('unexpected full-access start')
      },
    })
    expect(started).toBe(proc)

    proc.status = 'completed'
    proc.exitCode = 1
    settlement.settleProcess(proc, 'write: Permission denied', false)
    expect(proc.sandbox).toEqual({ mode: 'read-only', denied: true, enforcement: 'partial' })

    proc.sandbox = { mode: 'danger-full-access', denied: false }
    settlement.settleProcess(proc, 'write: Permission denied', false)
    expect(proc.sandbox).toEqual({ mode: 'danger-full-access', denied: false })
  })
})

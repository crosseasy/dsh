import type { SubprocessHandle, SubprocessOutcome, SubprocessRuntime, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'

const DIAGNOSTIC_OUTPUT_MAX_BYTES = 64 * 1024

/** Result with decoded stdout/stderr suffixes whose UTF-8 encoding is at most 64 KiB each. */
export interface ManagedCommandResult extends SubprocessOutcome {
  stderr: string
  stdout: string
}

/** Live process retained after its readiness marker appears. */
export interface ReadyProcess {
  done: Promise<ManagedCommandResult>
  getStderr(): string
  getStdout(): string
  handle: SubprocessHandle
  ready: string
}

/** Fields required from the system Chrome `/json/version` response. */
export interface SystemChromeVersion {
  Browser: string
  'Protocol-Version': string
  webSocketDebuggerUrl: string
}

/** Explicit environment additions for the isolated Fusion profile. */
export function acceptanceEnvironment(home: string, agentsHome: string): NodeJS.ProcessEnv {
  return {
    DEEPSEEK_API_KEY: 'fusion-acceptance-no-model-call',
    DEEPSEEK_BASE_URL: undefined,
    DSH_AGENTS_HOME: agentsHome,
    DSH_HOME: home,
    DSH_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: undefined,
  }
}

/**
 * Check whether a CDP target is an HTTP(S) page from the server origin.
 * @param target - Untrusted target fields returned by CDP discovery.
 * @param serverUrl - Valid HTTP(S) URL reported by the managed server.
 * @returns `true` only for page targets whose normalized origin matches the server.
 */
export function isServerPageTarget(
  target: { type?: unknown; url?: unknown },
  serverUrl: string,
): boolean {
  if (target.type !== 'page' || typeof target.url !== 'string') return false
  const targetUrl = URL.parse(target.url)
  if (targetUrl === null || !['http:', 'https:'].includes(targetUrl.protocol)) return false
  return targetUrl.origin === new URL(serverUrl).origin
}

/** Build one fully explicit managed-process request. */
export function spawnSpec(
  argv: readonly string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  graceMs = 5_000,
): SubprocessSpawnSpec {
  return {
    argv,
    cwd,
    stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
    graceMs,
    ...env === undefined ? {} : { env },
  }
}

class BoundedBufferTail {
  private readonly buffer = Buffer.allocUnsafe(DIAGNOSTIC_OUTPUT_MAX_BYTES)
  private end = 0
  private length = 0
  private truncated = false

  push(chunk: Buffer): void {
    if (this.length + chunk.length > this.buffer.length) this.truncated = true
    const retained = chunk.length > this.buffer.length
      ? chunk.subarray(chunk.length - this.buffer.length)
      : chunk
    if (retained.length === this.buffer.length) {
      retained.copy(this.buffer)
      this.end = 0
      this.length = this.buffer.length
      return
    }
    const firstLength = Math.min(retained.length, this.buffer.length - this.end)
    retained.copy(this.buffer, this.end, 0, firstLength)
    retained.copy(this.buffer, 0, firstLength)
    this.end = (this.end + retained.length) % this.buffer.length
    this.length = Math.min(this.buffer.length, this.length + retained.length)
  }

  /** Decode a valid UTF-8 suffix whose re-encoded size stays within the byte limit. */
  toString(): string {
    if (this.length === 0) return ''
    const start = (this.end - this.length + this.buffer.length) % this.buffer.length
    let bytes = start + this.length <= this.buffer.length
      ? this.buffer.subarray(start, start + this.length)
      : Buffer.concat([
        this.buffer.subarray(start),
        this.buffer.subarray(0, this.end),
      ], this.length)
    if (this.truncated) {
      let firstComplete = 0
      while (firstComplete < bytes.length && (bytes[firstComplete]! & 0xc0) === 0x80) {
        firstComplete += 1
      }
      bytes = bytes.subarray(firstComplete)
    }
    const value = bytes.toString('utf8')
    let encodedBytes = Buffer.byteLength(value, 'utf8')
    if (encodedBytes <= this.buffer.length) return value
    let firstRetained = 0
    for (const character of value) {
      encodedBytes -= Buffer.byteLength(character, 'utf8')
      firstRetained += character.length
      if (encodedBytes <= this.buffer.length) return value.slice(firstRetained)
    }
    return ''
  }
}

function captureOutput(handle: SubprocessHandle): Omit<ReadyProcess, 'ready'> {
  const stderr = new BoundedBufferTail()
  const stdout = new BoundedBufferTail()
  handle.stderr?.on('data', (chunk: Buffer) => { stderr.push(chunk) })
  handle.stdout?.on('data', (chunk: Buffer) => { stdout.push(chunk) })
  return {
    handle,
    done: handle.done.then(outcome => ({
      ...outcome,
      stderr: stderr.toString(),
      stdout: stdout.toString(),
    })),
    getStderr: () => stderr.toString(),
    getStdout: () => stdout.toString(),
  }
}

async function waitForOutput(
  process: Omit<ReadyProcess, 'ready'>,
  pattern: RegExp,
  label: string,
  timeoutMs: number,
): Promise<string> {
  return await new Promise((resolveReady, rejectReady) => {
    let settled = false
    const cleanup = (): void => {
      clearTimeout(timer)
      process.handle.stdout?.off('data', inspect)
      process.handle.stderr?.off('data', inspect)
    }
    const resolveOnce = (value: string): void => {
      if (settled) return
      settled = true
      cleanup()
      resolveReady(value)
    }
    const rejectOnce = (error: Error): void => {
      if (settled) return
      settled = true
      cleanup()
      rejectReady(error)
    }
    const inspect = (): void => {
      const output = `${process.getStdout()}\n${process.getStderr()}`
      const match = pattern.exec(output)
      if (match !== null) resolveOnce(match[1] ?? match[0])
    }
    const timer = setTimeout(() => {
      rejectOnce(new Error(
        `${label} did not become ready within ${String(timeoutMs)}ms`
        + `\nstdout:\n${process.getStdout()}\nstderr:\n${process.getStderr()}`,
      ))
    }, timeoutMs)
    process.handle.stdout?.on('data', inspect)
    process.handle.stderr?.on('data', inspect)
    inspect()
    void process.done.then((outcome) => {
      rejectOnce(new Error(
        `${label} exited before readiness (code ${String(outcome.exitCode)}, signal ${String(outcome.signal)})`
        + `\nstdout:\n${outcome.stdout}\nstderr:\n${outcome.stderr}`,
      ))
    }, (error: unknown) => {
      rejectOnce(new Error(
        `${label} failed before readiness`
        + `\nstdout:\n${process.getStdout()}\nstderr:\n${process.getStderr()}`,
        { cause: error },
      ))
    })
  })
}

type CleanupPhase = 'outcome' | 'tree'

function createCleanupDeadline(
  pid: number,
  timeoutMs: number,
  label?: string,
): {
  dispose(): void
  error(): Error
  setPhase(phase: CleanupPhase): void
  signal: AbortSignal
  timeout: Promise<never>
} {
  const controller = new AbortController()
  let phase: CleanupPhase = 'tree'
  const error = (): Error => {
    const subject = phase === 'tree'
      ? `process tree ${String(pid)}`
      : `process outcome for tree ${String(pid)}`
    return new Error(
      `${label === undefined ? '' : `${label} `}${subject} exceeded ${String(timeoutMs)}ms cleanup budget`,
    )
  }
  const timeout = new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(() => {
      const failure = error()
      controller.abort(failure)
      reject(failure)
    }, timeoutMs)
    controller.signal.addEventListener('abort', () => { clearTimeout(timer) }, { once: true })
  })
  void timeout.catch(() => {})
  return {
    dispose: () => { controller.abort() },
    error,
    setPhase: (nextPhase) => { phase = nextPhase },
    signal: controller.signal,
    timeout,
  }
}

async function cleanupAfterFailure(
  process: Omit<ReadyProcess, 'ready'>,
  primaryFailure: unknown,
  label: string,
  timeoutMs: number,
): Promise<never> {
  const cleanupFailures: unknown[] = []
  void process.done.catch(() => {})
  process.handle.terminate()
  const deadline = createCleanupDeadline(process.handle.pid, timeoutMs)
  let stopped = false
  try {
    stopped = await Promise.race([
      process.handle.waitForExit(deadline.signal),
      deadline.timeout,
    ])
    if (!stopped) {
      cleanupFailures.push(deadline.error())
    }
  } catch (error) {
    cleanupFailures.push(error)
  }
  if (stopped) {
    deadline.setPhase('outcome')
    try {
      await Promise.race([process.done, deadline.timeout])
    } catch (error) {
      if (error !== primaryFailure && (primaryFailure as Error | undefined)?.cause !== error) {
        cleanupFailures.push(error)
      }
    }
  }
  deadline.dispose()
  if (cleanupFailures.length === 0) throw primaryFailure
  throw new AggregateError([primaryFailure, ...cleanupFailures], `${label} failed and cleanup also failed`)
}

/**
 * Spawn a managed process and return only after its readiness marker appears.
 * A readiness or spawn failure terminates the complete process tree and waits
 * for quiescence within the configured cleanup budget.
 */
export async function startManagedProcess(
  runtime: Pick<SubprocessRuntime, 'spawn'>,
  spec: SubprocessSpawnSpec,
  readiness: { label: string; pattern: RegExp; timeoutMs: number; cleanupTimeoutMs?: number },
): Promise<ReadyProcess> {
  const process = captureOutput(runtime.spawn(spec))
  try {
    const ready = await waitForOutput(
      process,
      readiness.pattern,
      readiness.label,
      readiness.timeoutMs,
    )
    return { ...process, ready }
  } catch (error) {
    return await cleanupAfterFailure(
      process,
      error,
      readiness.label,
      readiness.cleanupTimeoutMs ?? spec.graceMs + 5_000,
    )
  }
}

/**
 * Run one managed command through completion. Its deadline covers the whole
 * tree; cleanup reports when quiescence exceeds the process cleanup budget.
 */
export async function runManagedCommand(
  runtime: Pick<SubprocessRuntime, 'spawn'>,
  spec: SubprocessSpawnSpec,
  label: string,
  timeoutMs: number,
): Promise<ManagedCommandResult> {
  const process = captureOutput(runtime.spawn(spec))
  const deadline = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      const error = new Error(
        `${label} timed out after ${String(timeoutMs)}ms`
        + `\nstdout:\n${process.getStdout()}\nstderr:\n${process.getStderr()}`,
      )
      deadline.abort(error)
      process.handle.terminate()
      reject(error)
    }, timeoutMs)
  })
  try {
    const outcome = await Promise.race([process.done, timeout])
    const stopped = await Promise.race([
      process.handle.waitForExit(deadline.signal),
      timeout,
    ])
    if (!stopped) {
      throw new Error(
        `${label} timed out after ${String(timeoutMs)}ms`
        + `\nstdout:\n${outcome.stdout}\nstderr:\n${outcome.stderr}`,
      )
    }
    return outcome
  } catch (error) {
    return await cleanupAfterFailure(process, error, label, spec.graceMs + 5_000)
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Terminate one managed process tree; reject if quiescence exceeds `timeoutMs`. */
export async function stopTree(
  handle: SubprocessHandle,
  label: string,
  timeoutMs: number,
): Promise<SubprocessOutcome> {
  void handle.done.catch(() => {})
  handle.terminate()
  const deadline = createCleanupDeadline(handle.pid, timeoutMs, label)
  try {
    const stopped = await Promise.race([
      handle.waitForExit(deadline.signal),
      deadline.timeout,
    ])
    if (!stopped) throw deadline.error()
    deadline.setPhase('outcome')
    return await Promise.race([handle.done, deadline.timeout])
  } finally {
    deadline.dispose()
  }
}

/** Validate that a CDP version payload belongs to headed system Chrome. */
export function parseSystemChromeVersion(value: unknown): SystemChromeVersion {
  if (typeof value !== 'object' || value === null) {
    throw new Error('system Chrome CDP 9333 prerequisite unavailable: invalid /json/version response')
  }
  const record = value as Record<string, unknown>
  if (
    typeof record.Browser !== 'string'
    || !record.Browser.startsWith('Chrome/')
    || typeof record['Protocol-Version'] !== 'string'
    || typeof record.webSocketDebuggerUrl !== 'string'
  ) {
    throw new Error('system Chrome CDP 9333 prerequisite unavailable: invalid /json/version response')
  }
  return value as unknown as SystemChromeVersion
}

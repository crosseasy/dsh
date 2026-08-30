/**
 * Run repository maintenance commands with bounded binary I/O and owned
 * POSIX process-tree teardown.
 */

import type { Readable } from 'node:stream'
import { spawnSubprocess } from '@deepseek-ai/dsh-subprocess-local/src/spawn.ts'

const TERMINATION_GRACE_MS = 250

/** Inputs for one repository-owned maintenance process. */
export interface OwnedProcessOptions {
  /** Working directory for the child. */
  readonly cwd: string
  /** Absolute epoch-millisecond deadline shared with the calling operation. */
  readonly deadline: number
  /** Exact child environment allowlist. */
  readonly env: NodeJS.ProcessEnv
  /** Optional bytes written to stdin before it is closed. */
  readonly input?: Buffer
  /** Maximum bytes retained from each output stream. */
  readonly maxOutputBytes: number
}

/** Settled process facts and byte-exact output. */
export interface OwnedProcessResult {
  /** Direct-child exit code, or null when signalled. */
  readonly exitCode: number | null
  /** Direct-child terminating signal, or null after a normal exit. */
  readonly signal: NodeJS.Signals | null
  /** Complete stdout bytes. */
  readonly stdout: Buffer
  /** Complete stderr bytes. */
  readonly stderr: Buffer
  /** Whether the absolute deadline fired before the owned process tree became quiescent. */
  readonly timedOut: boolean
}

function exactEnvironment(allowed: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const environment = Object.fromEntries(
    Object.keys(process.env).map(name => [name, undefined]),
  )
  return { ...environment, ...allowed }
}

function capture(
  stream: Readable,
  maxBytes: number,
  overflow: () => void,
): Buffer[] {
  const chunks: Buffer[] = []
  let bytes = 0
  stream.on('data', (chunk: Buffer) => {
    bytes += chunk.length
    if (bytes > maxBytes) {
      overflow()
      return
    }
    chunks.push(chunk)
  })
  return chunks
}

/**
 * Spawn one command and wait for its owned POSIX process tree to become
 * quiescent before returning.
 * @param command - Executable path or name.
 * @param args - Arguments passed without shell interpretation.
 * @param options - Working directory, deadline, exact environment, input, and output cap.
 * @returns exit facts and byte-exact output.
 * @throws before spawn on Windows, or after quiescence when output exceeds the cap.
 */
export async function runOwnedProcess(
  command: string,
  args: readonly string[],
  options: OwnedProcessOptions,
): Promise<OwnedProcessResult> {
  if (process.platform === 'win32') {
    throw new Error('owned process execution is unsupported on Windows')
  }
  if (Date.now() >= options.deadline) {
    return {
      exitCode: null,
      signal: null,
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      timedOut: true,
    }
  }

  const controller = new AbortController()
  const state = { timedOut: false, overflowed: false }
  const running = spawnSubprocess({
    argv: [command, ...args],
    cwd: options.cwd,
    env: exactEnvironment(options.env),
    graceMs: TERMINATION_GRACE_MS,
    signal: controller.signal,
    stdio: {
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    },
  })
  const treeExit = running.waitForExit()
  const overflow = (): void => {
    if (state.overflowed) return
    state.overflowed = true
    controller.abort('output limit')
    running.terminate()
  }
  const stdout = capture(running.stdout as Readable, options.maxOutputBytes, overflow)
  const stderr = capture(running.stderr as Readable, options.maxOutputBytes, overflow)
  running.stdin?.on('error', () => {
    // The child outcome remains authoritative when it exits before consuming input.
  })
  running.stdin?.end(options.input)

  const timer = setTimeout(() => {
    state.timedOut = true
    controller.abort('deadline')
    running.terminate()
  }, Math.max(1, options.deadline - Date.now()))
  try {
    const outcome = await running.done
    await treeExit
    if (state.overflowed) {
      throw new Error(`owned process output exceeded ${String(options.maxOutputBytes)} bytes`)
    }
    return {
      ...outcome,
      stdout: Buffer.concat(stdout),
      stderr: Buffer.concat(stderr),
      timedOut: state.timedOut,
    }
  } finally {
    clearTimeout(timer)
  }
}

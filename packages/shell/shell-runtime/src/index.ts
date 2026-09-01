/**
 * Shared one-shot process lifecycle for shell executors.
 * @module @deepseek-ai/dsh-shell-runtime
 */

import type { Context } from '@deepseek-ai/cordis'
import { accessSync, constants, statSync } from 'node:fs'
import { ShellExecutor } from '@deepseek-ai/dsh-shell'
import type {
  CollectedOutput,
  ShellExecRequest,
  ShellExecSpec,
  ShellProcess,
  ShellProcessRead,
  ShellRunResult,
  ShellSandboxInfo,
} from '@deepseek-ai/dsh-shell'
import type { SubprocessCollect, SubprocessHandle, SubprocessOutputReader, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import { clampTimeout, deadline, MAX_TIMER_DELAY_MS, timeoutOf } from '@deepseek-ai/dsh-timeout'

/** Static timeout and diagnostic values for one executor adapter. */
export interface OneShotShellExecutorConfig {
  readonly timeoutCode: string
  readonly droppedCollectMessage: string
}

/** Dynamic process settings read from an adapter for each command. */
export interface OneShotShellSettings {
  readonly env: NodeJS.ProcessEnv
  readonly maxOutputBytes: number
  readonly maxSpillBytes: number
  readonly graceMs: number
}

/** Resolved config fields shared by one-shot shell executors. */
export interface OneShotShellConfig {
  readonly cwd?: string | undefined
  readonly timeoutMs: number
  readonly maxTimeoutMs: number
  readonly maxOutputBytes: number
  readonly maxSpillBytes: number
  readonly graceMs: number
}

type OneShotShellRuntimeConfig = Pick<OneShotShellConfig, 'maxOutputBytes' | 'maxSpillBytes' | 'graceMs'>

/** One sandbox runner failure rule carried by a confined argv wrapper. */
export interface OneShotSandboxRunnerFailureRule {
  /** Nonzero exit codes this rule may match; omitted permits any nonzero exit. */
  readonly allowedExitCodes?: readonly number[]
  /** Non-empty substrings identifying a fatal runner diagnostic on one stderr line. */
  readonly fatalSignatures: readonly string[]
  /** Benign stderr lines excluded by exact full-line equality before fatal matching. */
  readonly informationalLines?: readonly string[]
}

/** A command argv already wrapped by the sandbox provider. */
export interface OneShotSandboxConfinedCommand {
  /** The exact argv to hand to the local executor. */
  readonly argv: readonly string[]
  /** How completely the selected runner enforces the requested file effects. */
  readonly enforcement: NonNullable<ShellSandboxInfo['enforcement']>
  /** Case-insensitive stderr substrings identifying file-effect denials. */
  readonly denialSignatures: readonly string[]
  /** Structured runner-failure evidence rules for this wrapped command. */
  readonly runnerFailureRules: readonly OneShotSandboxRunnerFailureRule[]
}

/** Sandbox modes that invoke a provider instead of bypassing confinement. */
export type OneShotConfinedSandboxMode = Exclude<ShellSandboxInfo['mode'], 'danger-full-access'>

/** Build the executor-specific fail-closed error for sandbox infrastructure failures. */
export type OneShotSandboxUnavailableFactory = (mode: OneShotConfinedSandboxMode, detail?: string) => Error

type ProcessDone = (proc: ShellProcess, stderr: string, spawnFailed: boolean, spawnError?: unknown) => void

interface SpawnOptions extends OneShotShellSettings {
  readonly argv: readonly string[]
  readonly cwd: string
  readonly stdin?: string | undefined
  readonly stdoutMaxBytes: number
  readonly stderrMaxBytes: number
  readonly signal?: AbortSignal | undefined
}

interface OneShotSandboxFacts {
  readonly mode: OneShotConfinedSandboxMode
  readonly enforcement: NonNullable<ShellSandboxInfo['enforcement']>
  readonly denialSignatures: readonly string[]
  readonly runnerFailureRules: readonly OneShotSandboxRunnerFailureRule[]
  readonly runnerProgram: string | undefined
  readonly workdir: string
}

/** Foreground sandbox settlement callbacks for one command. */
export interface OneShotSandboxRunOptions {
  /** Resolved shell execution spec, including the caller-owned signal. */
  readonly spec: ShellExecSpec
  /** Resolved per-call sandbox mode. */
  readonly mode: ShellSandboxInfo['mode']
  /** Wrap the adapter-owned argv for a confined mode. */
  readonly confine: (mode: OneShotConfinedSandboxMode) => OneShotSandboxConfinedCommand
  /** Run the provider-wrapped argv through the underlying executor. */
  readonly runConfined: (spec: ShellExecSpec, argv: readonly string[]) => Promise<ShellRunResult>
  /** Run the command through the underlying local executor without confinement. */
  readonly runUnconfined: (spec: ShellExecSpec) => Promise<ShellRunResult>
}

/** Background sandbox settlement callbacks for one command. */
export interface OneShotSandboxStartOptions {
  /** Resolved shell execution spec, including the caller-owned signal. */
  readonly spec: ShellExecSpec
  /** Resolved per-call sandbox mode. */
  readonly mode: ShellSandboxInfo['mode']
  /** Wrap the adapter-owned argv for a confined mode. */
  readonly confine: (mode: OneShotConfinedSandboxMode) => OneShotSandboxConfinedCommand
  /** Start the provider-wrapped argv through the underlying executor. */
  readonly startConfined: (spec: ShellExecSpec, argv: readonly string[]) => ShellProcess
  /** Start the command through the underlying local executor without confinement. */
  readonly startUnconfined: (spec: ShellExecSpec) => ShellProcess
}

function finalOutput(reader: SubprocessOutputReader): CollectedOutput {
  const read = reader.readFrom(0)
  return { text: read.text, truncated: read.lossy, ...(read.spillPath !== undefined ? { spillPath: read.spillPath } : {}) }
}

const collect = (maxBytes: number, maxSpillBytes: number): SubprocessCollect =>
  ({ maxBytes, spill: { maxBytes: maxSpillBytes } })

function spawnSpec(options: SpawnOptions): SubprocessSpawnSpec {
  return {
    argv: options.argv,
    cwd: options.cwd,
    stdio: {
      stdin: options.stdin !== undefined ? { data: options.stdin } : 'ignore',
      stdout: collect(options.stdoutMaxBytes, options.maxSpillBytes),
      stderr: collect(options.stderrMaxBytes, options.maxSpillBytes),
    },
    graceMs: options.graceMs,
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
    env: options.env,
  }
}

function collected(handle: SubprocessHandle, message: string): { stdout: SubprocessOutputReader; stderr: SubprocessOutputReader } {
  const { stdout, stderr } = handle.collected
  /* v8 ignore start -- collect dispositions request both readers; defensive. */
  if (stdout === undefined || stderr === undefined) throw new Error(message)
  /* v8 ignore stop */
  return { stdout, stderr }
}

function assertPositiveFinite(prefix: string, name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${prefix}: ${name} must be a positive finite number`)
}

/** Node-local spawn codes proven to identify executable resolution or permission failure. */
const EXECUTABLE_SPAWN_CODES = new Set(['EACCES', 'ENOENT'])

/** Whether the caller-owned spawn cwd can be entered. */
function isUsableWorkdir(path: string): boolean {
  try {
    if (!statSync(path).isDirectory()) return false
    accessSync(path, constants.X_OK)
    return true
  } catch (_error) {
    // A stat/access failure means the cwd cannot disambiguate runner failures.
    return false
  }
}

/**
 * Attribute Node ENOENT/EACCES failures to the sandbox runner only when argv[0]
 * provenance is specific and the caller-owned cwd is independently usable.
 * @param error - original spawn rejection.
 * @param runnerProgram - provider argv[0], the executable that establishes confinement.
 * @param workdir - caller-owned spawn cwd, checked independently for usability.
 * @returns whether the rejection identifies the runner executable.
 */
export function isRunnerSpawnFailure(
  error: unknown,
  runnerProgram: string | undefined,
  workdir: string,
): boolean {
  if (runnerProgram === undefined || !isUsableWorkdir(workdir)) return false
  if (typeof error !== 'object' || error === null) return false
  const { code, path, syscall } = error as { code?: unknown; path?: unknown; syscall?: unknown }
  if (typeof code !== 'string' || !EXECUTABLE_SPAWN_CODES.has(code)) return false
  if (typeof syscall !== 'string') return false
  const exactSyscall = `spawn ${runnerProgram}`
  if (path === undefined) return syscall === exactSyscall
  if (typeof path !== 'string' || path.length === 0 || path !== runnerProgram) return false
  return syscall === 'spawn' || syscall === exactSyscall
}

/** Fatal runner evidence retained for infrastructure-error detail. */
export interface OneShotSandboxRunnerFailureMatch {
  /** The original stderr line that matched a fatal signature. */
  readonly detail: string
}

/**
 * Classify a failed run against the selected backend's denial dialect.
 * @param result - settled foreground run.
 * @param signatures - case-insensitive denial substrings from the active wrap.
 * @returns whether the failed run matches that denial dialect.
 */
export function classifyDenial(result: ShellRunResult, signatures: readonly string[]): boolean {
  return matchesSignature(result.exitCode, result.stderr.text, signatures)
}

/**
 * Classify one settled process against structured runner-failure rules.
 * @param exitCode - process exit code; null means signal termination.
 * @param stderr - collected stderr text, left unchanged.
 * @param rules - structured runner-failure rules from the active wrap.
 * @returns the first matching fatal line, or undefined when evidence is insufficient.
 */
export function classifyRunnerFailure(
  exitCode: number | null,
  stderr: string,
  rules: readonly OneShotSandboxRunnerFailureRule[],
): OneShotSandboxRunnerFailureMatch | undefined {
  if (exitCode === null || exitCode === 0) return undefined
  const lines = stderr.split(/\r?\n/)
  for (const rule of rules) {
    if (rule.allowedExitCodes !== undefined && !rule.allowedExitCodes.includes(exitCode)) continue
    const informationalLines = new Set((rule.informationalLines ?? []).map(line => line.toLowerCase()))
    const fatalSignatures = rule.fatalSignatures
      .filter(signature => signature.trim().length > 0)
      .map(signature => signature.toLowerCase())
    for (const line of lines) {
      const lowered = line.toLowerCase()
      if (informationalLines.has(lowered)) continue
      if (fatalSignatures.some(signature => lowered.includes(signature))) return { detail: line }
    }
  }
  return undefined
}

/**
 * Match a non-zero exit against case-insensitive stderr signatures.
 * @param exitCode - process exit code; null means signal termination.
 * @param stderr - collected stderr text.
 * @param signatures - substrings identifying the selected backend's dialect.
 * @returns whether this is a non-zero exit whose stderr matches a signature.
 */
export function matchesSignature(exitCode: number | null, stderr: string, signatures: readonly string[]): boolean {
  if (exitCode === null || exitCode === 0) return false
  const lowered = stderr.toLowerCase()
  return signatures.some(signature => lowered.includes(signature.toLowerCase()))
}

/**
 * Tracks confined one-shot process facts and applies foreground/background
 * sandbox settlement without knowing the shell dialect or sandbox provider.
 */
export class OneShotSandboxSettlement {
  private readonly processFacts = new Map<ShellProcess, OneShotSandboxFacts>()

  /**
   * @param sandboxUnavailable - executor-owned error factory for fail-closed runner failures.
   */
  constructor(private readonly sandboxUnavailable: OneShotSandboxUnavailableFactory) {}

  /**
   * Run a foreground command and attach sandbox facts to the settled result.
   * @param options - resolved command plus adapter callbacks for confined and unconfined execution.
   * @returns the foreground run result with sandbox facts when the command used a sandbox.
   */
  async run(options: OneShotSandboxRunOptions): Promise<ShellRunResult> {
    const { mode, spec } = options
    if (mode === 'danger-full-access') {
      const result = await options.runUnconfined(spec)
      return { ...result, sandbox: { mode, denied: false } }
    }
    const confined = options.confine(mode)
    let result: ShellRunResult
    try {
      result = await options.runConfined(spec, confined.argv)
    } catch (error) {
      if (spec.signal?.aborted === true) spec.signal.throwIfAborted()
      if (isRunnerSpawnFailure(error, confined.argv[0], spec.workdir)) {
        throw this.sandboxUnavailable(mode, String(error))
      }
      throw error
    }
    const runnerFailure = classifyRunnerFailure(result.exitCode, result.stderr.text, confined.runnerFailureRules)
    if (runnerFailure !== undefined) {
      throw this.sandboxUnavailable(mode, runnerFailure.detail)
    }
    return {
      ...result,
      sandbox: {
        mode,
        denied: classifyDenial(result, confined.denialSignatures),
        enforcement: confined.enforcement,
      },
    }
  }

  /**
   * Start a background command and retain per-process sandbox facts for settlement.
   * @param options - resolved command plus adapter callbacks for confined and unconfined execution.
   * @returns the background process handle.
   */
  start(options: OneShotSandboxStartOptions): ShellProcess {
    const { mode, spec } = options
    if (mode === 'danger-full-access') return options.startUnconfined(spec)
    const confined = options.confine(mode)
    let proc: ShellProcess
    try {
      proc = options.startConfined(spec, confined.argv)
    } catch (error) {
      if (isRunnerSpawnFailure(error, confined.argv[0], spec.workdir)) {
        throw this.sandboxUnavailable(mode, String(error))
      }
      throw error
    }
    this.processFacts.set(proc, {
      mode,
      enforcement: confined.enforcement,
      denialSignatures: confined.denialSignatures,
      runnerFailureRules: confined.runnerFailureRules,
      runnerProgram: confined.argv[0],
      workdir: spec.workdir,
    })
    return proc
  }

  /**
   * Stamp sandbox facts on a settled background process, when this tracker owns it.
   * @param proc - settled background process handle.
   * @param stderr - retained stderr tail.
   * @param spawnFailed - whether the subprocess promise rejected before start.
   * @param spawnError - original spawn rejection reason, when present.
   */
  settleProcess(proc: ShellProcess, stderr: string, spawnFailed: boolean, spawnError?: unknown): void {
    const facts = this.processFacts.get(proc)
    if (facts === undefined) return
    this.processFacts.delete(proc)
    const runnerFailed = spawnFailed
      ? isRunnerSpawnFailure(spawnError, facts.runnerProgram, facts.workdir)
      : classifyRunnerFailure(proc.exitCode, stderr, facts.runnerFailureRules) !== undefined
    proc.sandbox = {
      mode: facts.mode,
      denied: !runnerFailed && matchesSignature(proc.exitCode, stderr, facts.denialSignatures),
      enforcement: facts.enforcement,
      ...(runnerFailed ? { runnerFailed } : {}),
    }
  }
}

/**
 * Reject resolved one-shot shell settings values that cannot drive timers or byte caps.
 * @param prefix - executor-specific diagnostic prefix.
 * @param config - resolved plugin configuration from Cordis config or settings.
 */
export function assertServiceableOneShotShellConfig(prefix: string, config: OneShotShellConfig): void {
  assertPositiveFinite(prefix, 'timeoutMs', config.timeoutMs)
  assertPositiveFinite(prefix, 'maxTimeoutMs', config.maxTimeoutMs)
  assertPositiveFinite(prefix, 'maxOutputBytes', config.maxOutputBytes)
  assertPositiveFinite(prefix, 'maxSpillBytes', config.maxSpillBytes)
  assertPositiveFinite(prefix, 'graceMs', config.graceMs)
  if (config.graceMs > MAX_TIMER_DELAY_MS) throw new Error(`${prefix}: graceMs must be no greater than ${MAX_TIMER_DELAY_MS}`)
}

/**
 * Apply config defaults and caps to one shell execution request.
 * @param prefix - executor-specific timeout diagnostic prefix.
 * @param config - currently active resolved executor settings.
 * @param request - caller-supplied request.
 * @returns the fully resolved command spec.
 */
export function resolveOneShotShellRequest(
  prefix: string,
  config: OneShotShellConfig,
  request: ShellExecRequest,
): ShellExecSpec {
  const stdoutMaxBytes = request.stdoutMaxBytes ?? config.maxOutputBytes
  assertPositiveFinite(prefix, 'request.stdoutMaxBytes', stdoutMaxBytes)
  return {
    command: request.command,
    workdir: request.workdir ?? config.cwd ?? process.cwd(),
    timeoutMs: clampTimeout(request.timeoutMs, config.timeoutMs, config.maxTimeoutMs, `${prefix}: request.timeoutMs`),
    stdoutMaxBytes,
    ...request.signal ? { signal: request.signal } : {},
    ...request.stdin !== undefined ? { stdin: request.stdin } : {},
    ...request.env !== undefined ? { env: request.env } : {},
    ...request.dshEnv !== undefined ? { dshEnv: request.dshEnv } : {},
    sandboxPolicy: request.sandboxPolicy,
  }
}

/**
 * Project adapter-supplied environment defaults and runtime budgets into spawn settings.
 * @param envOverrides - shell-specific environment defaults.
 * @param config - currently active resolved executor settings.
 * @param spec - resolved command spec with caller and Harness env.
 * @returns settings used by foreground and background one-shot spawns.
 */
export function oneShotShellSettings(
  envOverrides: NodeJS.ProcessEnv,
  config: OneShotShellRuntimeConfig,
  spec: ShellExecSpec,
): OneShotShellSettings {
  return {
    env: { ...envOverrides, ...spec.env, ...spec.dshEnv },
    maxOutputBytes: config.maxOutputBytes,
    maxSpillBytes: config.maxSpillBytes,
    graceMs: config.graceMs,
  }
}

function reader(streams: { stdout: SubprocessOutputReader; stderr: SubprocessOutputReader }) {
  let stdoutOffset = 0
  let stderrOffset = 0
  let spawnFailureNote: string | undefined
  return {
    failed(error: unknown) {
      spawnFailureNote = `spawn failed: ${String(error)}`
      return spawnFailureNote
    },
    read(): ShellProcessRead {
      const out = streams.stdout.readFrom(stdoutOffset)
      const err = streams.stderr.readFrom(stderrOffset)
      stdoutOffset = out.nextOffset
      stderrOffset = err.nextOffset
      const errText = err.text.length > 0 ? err.text : spawnFailureNote ?? ''
      spawnFailureNote = undefined
      const separator = out.text.length > 0 && !out.text.endsWith('\n') ? '\n' : ''
      return {
        delta: out.text + (errText.length > 0 ? `${separator}[stderr]\n${errText}` : ''),
        lossy: out.lossy || err.lossy,
        ...(out.spillPath !== undefined ? { stdoutSpillPath: out.spillPath } : {}),
        ...(err.spillPath !== undefined ? { stderrSpillPath: err.spillPath } : {}),
      }
    },
  }
}

/**
 * Base class for local shell executors that share process lifecycle while
 * keeping argv construction and environment defaults local.
 */
export abstract class OneShotShellExecutor extends ShellExecutor {
  protected constructor(ctx: Context, private readonly oneShot: OneShotShellExecutorConfig) {
    super(ctx)
  }

  /** @param spec resolved command spec. @returns current spawn settings. */
  protected abstract oneShotShellSettings(spec: ShellExecSpec): OneShotShellSettings

  /** @param spec resolved command spec. @param argv exact command argv. @returns foreground result. */
  protected async runArgv(spec: ShellExecSpec, argv: readonly string[]): Promise<ShellRunResult> {
    const settings = this.oneShotShellSettings(spec)
    using d = deadline(spec.signal, spec.timeoutMs, this.oneShot.timeoutCode)
    const handle = this.ctx.subprocess.spawn(spawnSpec({
      ...settings, argv, cwd: spec.workdir, stdin: spec.stdin, stdoutMaxBytes: spec.stdoutMaxBytes,
      stderrMaxBytes: settings.maxOutputBytes, signal: d.signal,
    }))
    const outcome = await handle.done
    const streams = collected(handle, this.oneShot.droppedCollectMessage)
    const timedOut = timeoutOf(d.signal, this.oneShot.timeoutCode) !== undefined
    return {
      ...outcome, timedOut, aborted: d.signal.aborted && !timedOut, timeoutMs: spec.timeoutMs,
      stdout: finalOutput(streams.stdout), stderr: finalOutput(streams.stderr),
    }
  }

  /** @param spec resolved command spec. @param argv exact command argv. @returns background process handle. */
  protected startArgv(spec: ShellExecSpec, argv: readonly string[]): ShellProcess {
    const settings = this.oneShotShellSettings(spec)
    const running = this.ctx.subprocess.spawn(spawnSpec({
      ...settings, argv, cwd: spec.workdir, stdin: spec.stdin, stdoutMaxBytes: settings.maxOutputBytes,
      stderrMaxBytes: settings.maxOutputBytes, signal: spec.signal,
    }))
    const streams = collected(running, this.oneShot.droppedCollectMessage)
    const output = reader(streams)
    const done: ProcessDone = (proc, stderr, spawnFailed, spawnError) => {
      this.onProcessDone(proc, stderr, spawnFailed, spawnError)
    }
    const proc: ShellProcess = {
      status: 'running',
      exitCode: null,
      signal: null,
      done: running.done.then((outcome) => {
        if (proc.status === 'running') proc.status = spec.signal?.aborted === true || outcome.signal !== null ? 'killed' : 'completed'
        proc.exitCode = outcome.exitCode
        proc.signal = outcome.signal
        done(proc, streams.stderr.readFrom(0).text, false)
      }, (error: unknown) => {
        proc.status = 'killed'
        done(proc, output.failed(error), true, error)
      }),
      readOutput: () => output.read(),
      kill: () => {
        if (proc.status !== 'running') return false
        proc.status = 'killed'
        running.terminate()
        return true
      },
    }
    return proc
  }

  /**
   * Settlement hook for subclasses that attach execution facts to a process.
   * @param _proc settled process handle.
   * @param _stderr retained stderr tail.
   * @param _spawnFailed whether the subprocess promise rejected before start.
   * @param _spawnError original spawn rejection reason, when present.
   */
  protected onProcessDone(_proc: ShellProcess, _stderr: string, _spawnFailed: boolean, _spawnError?: unknown): void {}
}

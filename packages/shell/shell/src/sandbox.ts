/**
 * Shared classification for sandbox-consuming shell providers.
 * @module @deepseek-ai/dsh-shell/sandbox
 */

import { accessSync, constants, statSync } from 'node:fs'
import type { RunnerFailureRule } from '@deepseek-ai/dsh-sandbox'
import type { ShellRunResult } from './types.ts'

/** Node-local spawn codes proven to identify executable resolution or permission failure. */
const EXECUTABLE_SPAWN_CODES = new Set(['EACCES', 'ENOENT'])

/** Whether the caller-owned spawn cwd can be entered. */
function isUsableWorkdir(path: string): boolean {
  try {
    if (!statSync(path).isDirectory()) return false
    accessSync(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/**
 * Fatal runner evidence retained for infrastructure-error detail.
 */
interface SandboxRunnerFailureMatch {
  /** The original stderr line that matched a fatal signature. */
  detail: string
}

/**
 * Attributes a Node spawn rejection to the sandbox runner only when the
 * caller-owned workdir is usable and the error reports `ENOENT` or `EACCES`.
 * A present `path` must equal the runner program and pair with `spawn` or the
 * exact `spawn <runner>` syscall; without `path`, the syscall must be that
 * exact runner-specific value.
 *
 * The workdir is checked at classification time, not atomically with spawn;
 * concurrent path replacement may change attribution but cannot permit an
 * unconfined execution.
 * @param error - the original spawn rejection.
 * @param runnerProgram - provider argv[0], the executable that establishes confinement.
 * @param workdir - the caller-owned spawn cwd, checked independently for usability.
 * @returns whether the rejection has executable-specific runner evidence.
 */
export function isSandboxRunnerSpawnFailure(
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

/**
 * Classifies a nonzero foreground run by matching stderr against only the
 * selected sandbox backend's denial dialect. Matching is case-insensitive,
 * ignores signatures that are empty after trimming, and otherwise preserves
 * each signature's original whitespace.
 * @param result - settled foreground run.
 * @param signatures - denial substrings from the active wrap.
 * @returns whether the failed run matches that denial dialect.
 */
export function classifySandboxDenial(result: ShellRunResult, signatures: readonly string[]): boolean {
  return matchesSandboxSignature(result.exitCode, result.stderr.text, signatures)
}

/**
 * Classifies a settled process against the selected sandbox backend's
 * structured runner-failure rules. A match requires a nonzero numeric exit,
 * the rule's optional exit-code gate, and a case-insensitive fatal signature
 * on one stderr line after case-insensitive exact informational lines are
 * excluded. Empty or whitespace-only fatal signatures are ignored.
 * @param exitCode - process exit code; null means signal termination.
 * @param stderr - collected stderr text, left unchanged.
 * @param rules - structured runner-failure rules from the active wrap.
 * @returns the first matching fatal line, or undefined when evidence is insufficient.
 */
export function classifySandboxRunnerFailure(
  exitCode: number | null,
  stderr: string,
  rules: readonly RunnerFailureRule[],
): SandboxRunnerFailureMatch | undefined {
  if (exitCode === null || exitCode === 0) return undefined
  const lines = stderr.split(/\r?\n/)
  for (const rule of rules) {
    if (rule.allowedExitCodes !== undefined && !rule.allowedExitCodes.includes(exitCode)) continue
    const informationalLines = new Set((rule.informationalLines ?? []).map(line => line.toLowerCase()))
    // An empty or whitespace-only substring is not meaningful runner evidence.
    // Ignore it while keeping any valid signatures beside it active.
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
 * Matches a nonzero numeric exit against case-insensitive stderr signatures.
 * Signatures that are empty after trimming are ignored; every other signature
 * is matched as its original, untrimmed substring.
 * @param exitCode - process exit code; null means signal termination.
 * @param stderr - collected stderr text.
 * @param signatures - substrings identifying the selected sandbox backend's dialect.
 * @returns whether this is a nonzero exit whose stderr matches a signature.
 */
export function matchesSandboxSignature(
  exitCode: number | null,
  stderr: string,
  signatures: readonly string[],
): boolean {
  if (exitCode === null || exitCode === 0) return false
  const lowered = stderr.toLowerCase()
  return signatures.some(signature => signature.trim().length > 0 && lowered.includes(signature.toLowerCase()))
}

/**
 * Shared rendering helpers for the shell tools (`dsh-tool-bash`,
 * `dsh-tool-pwsh`): the exit-status marker contract the tools' renderers emit,
 * Host `presentResult` implementations parse here, and the Web terminal card
 * model mirrors without importing Host code.
 * @module @deepseek-ai/dsh-shell/render
 */

import type { SandboxMode } from '@deepseek-ai/dsh-sandbox'
import { escalationHintMarker, sandboxDenialMarker } from '@deepseek-ai/dsh-sandbox'
import type { CollectedOutput, ShellProcess, ShellProcessRead, ShellRunResult, ShellSandboxInfo } from './types.ts'

/** Foreground shell output value exposed by the one-shot shell tools. */
export interface ShellForegroundResult {
  kind: 'foreground'
  exitCode: number | null
  signal: NodeJS.Signals | null
  timedOut: boolean
  aborted: boolean
  timeoutMs: number
  stdout: CollectedOutput
  stderr: CollectedOutput
  sandbox?: ShellSandboxInfo
}

/**
 * Foreground shell result fields consumed by the shared renderer.
 * Tool-specific projected values may include extra fields.
 */
export interface RenderableShellResult {
  exitCode: number | null
  signal: string | null
  timedOut: boolean
  timeoutMs: number
  stdout: CollectedOutput
  stderr: CollectedOutput
  sandbox?: ShellSandboxInfo
}

/** Background-handle properties shared by the one-shot shell output unions. */
export const SHELL_BACKGROUND_OUTPUT_PROPERTIES = {
  kind: { type: 'string', required: true, const: 'background' },
  jobId: { type: 'string', required: true },
} as const

/** Append a truncation notice, including the full-output spill path, to output text. */
function streamText(output: CollectedOutput): string {
  if (!output.truncated) return output.text
  return `${output.text}\n[output truncated; full output: ${output.spillPath ?? '(unavailable)'}]`
}

/**
 * Project an executor result into the canonical foreground value exposed by
 * the one-shot shell tools.
 * @param result - completed foreground run from a shell executor.
 * @returns the plain JSON value used by the tool output schema.
 */
export function projectShellForegroundResult(result: ShellRunResult): ShellForegroundResult {
  const output = (stream: ShellRunResult['stdout']) => ({
    text: stream.text,
    truncated: stream.truncated,
    ...stream.spillPath !== undefined ? { spillPath: stream.spillPath } : {},
  })
  return {
    kind: 'foreground',
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    aborted: result.aborted,
    timeoutMs: result.timeoutMs,
    stdout: output(result.stdout),
    stderr: output(result.stderr),
    ...result.sandbox !== undefined ? {
      sandbox: {
        mode: result.sandbox.mode,
        denied: result.sandbox.denied,
        ...result.sandbox.enforcement !== undefined ? { enforcement: result.sandbox.enforcement } : {},
        ...result.sandbox.runnerFailed !== undefined ? { runnerFailed: result.sandbox.runnerFailed } : {},
      },
    } : {},
  }
}

/**
 * Render one finished shell run into the text the model sees.
 * @param result - the completed foreground run or projected foreground value.
 * @param escalationModes - sandbox escalation modes advertised by the tool composition.
 * @returns stdout, optional marked stderr, and any sandbox, timeout, signal, or exit markers.
 */
export function renderShellResult(
  result: RenderableShellResult,
  escalationModes: readonly SandboxMode[] = [],
): string {
  const out = streamText(result.stdout)
  const err = streamText(result.stderr)

  let body = out
  if (err.length > 0) {
    if (body.length > 0 && !body.endsWith('\n')) body += '\n'
    body += `[stderr]\n${err}`
  }
  if (body.length === 0) body = '(no output)'

  const markers: string[] = []
  if (result.sandbox?.denied) {
    markers.push(sandboxDenialMarker(result.sandbox.mode))
    if (escalationModes.length > 0) {
      markers.push(escalationHintMarker('command'))
    }
  }
  if (result.timedOut) markers.push(`[timed out after ${result.timeoutMs}ms]`)
  if (result.signal !== null) {
    markers.push(`[killed by signal: ${result.signal}]`)
  } else if (result.exitCode !== 0) {
    markers.push(`[exit code: ${result.exitCode}]`)
  }
  if (markers.length === 0) return body

  if (!body.endsWith('\n')) body += '\n'
  return body + markers.join('\n')
}

/**
 * Render one background-process output read into the `job_output` delta text.
 * @param read - one incremental read from the process handle.
 * @param sandbox - settled sandbox facts, when this was a confined process.
 * @param escalationModes - sandbox escalation modes advertised by the tool composition.
 * @returns the output delta with any loss or sandbox notice appended.
 */
export function renderShellProcessRead(
  read: ShellProcessRead,
  sandbox?: ShellSandboxInfo,
  escalationModes: readonly SandboxMode[] = [],
): string {
  const notices: string[] = []
  if (read.lossy) {
    const paths = [read.stdoutSpillPath, read.stderrSpillPath].filter((path): path is string => path !== undefined)
    notices.push(`[some output was dropped from memory; full output: ${paths.length > 0 ? paths.join(', ') : '(unavailable)'}]`)
  }
  if (sandbox?.runnerFailed) {
    notices.push(`[sandbox: the sandbox runner itself failed under ${sandbox.mode} mode — the command did not run; this is a sandbox problem, not a command failure]`)
  } else if (sandbox?.denied) {
    notices.push(sandboxDenialMarker(sandbox.mode))
    if (escalationModes.length > 0) {
      notices.push(escalationHintMarker('command'))
    }
  }
  if (notices.length === 0) return read.delta
  return `${read.delta}${read.delta.length > 0 && !read.delta.endsWith('\n') ? '\n' : ''}${notices.join('\n')}`
}

/**
 * Map a settled background process onto the generic job outcome fields.
 * @param proc - the settled process handle.
 * @returns the status/detail pair reported to the job registry.
 */
export function shellProcessOutcome(proc: ShellProcess): { status: 'completed' | 'killed'; detail: string } {
  // TODO(background-infrastructure-outcome): widen ShellProcess with an explicit
  // infrastructure-failure outcome, then map it to task `failed`. Today those
  // failures alias ordinary shell process outcomes.
  if (proc.status === 'killed') {
    return { status: 'killed', detail: proc.signal !== null ? `signal: ${proc.signal}` : 'killed before exit' }
  }
  return { status: 'completed', detail: `exit code: ${proc.exitCode ?? 0}` }
}

/**
 * The exit status recovered from a rendered result, with the output body that
 * status was split off from.
 */
export type ParsedExitStatus =
  & { body: string }
  & ({ exitCode: number } | { signal: string })

/**
 * Split a rendered shell-tool result string into its output body and the
 * structured exit status — the inverse of the `[exit code: N]` /
 * `[killed by signal: X]` markers the shell tools' renderers append. A killed
 * marker yields `signal`; otherwise a non-zero marker yields `exitCode`;
 * absent both means a clean exit 0.
 *
 * The consumed marker is removed from `body` because a terminal presentation
 * shows the exit status as its own pill: leaving the marker in the output
 * would render the exit twice. Other markers (timeout, sandbox denial) carry
 * facts no pill shows, so they stay in the body.
 *
 * Replay only retains the rendered content text, not the original
 * `ShellRunResult`, so terminal presentation must recover the exit pill here.
 * Requiring a leading newline and the end of the string keeps ordinary output
 * that merely ends with marker-like text from matching unless the final line
 * is indistinguishable from a real marker.
 * @param text - rendered model-facing shell-tool result.
 * @returns the marker-free body plus the recovered terminal exit code or signal.
 */
export function parseExitStatus(text: string): ParsedExitStatus {
  const signal = /\n\[killed by signal: ([^\]\n]+)\]$/.exec(text)
  if (signal?.[1] !== undefined) return { body: text.slice(0, signal.index), signal: signal[1] }
  const exit = /\n\[exit code: (\d+)\]$/.exec(text)
  if (exit?.[1] !== undefined) return { body: text.slice(0, exit.index), exitCode: Number(exit[1]) }
  return { body: text, exitCode: 0 }
}

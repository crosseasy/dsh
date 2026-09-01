/**
 * Model-facing persistent `bash` tool over the owner-scoped PTY seam.
 * @module @deepseek-ai/dsh-tool-bash-persistent
 */

import { randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { TerminalSendResult, TerminalSessionId } from '@deepseek-ai/dsh-terminal'
import { registerPersistentShellTool } from '@deepseek-ai/dsh-persistent-tool-runtime'
import type {
  CapturedPersistentOutput,
  PersistentCommandMarkers,
  RetainedPersistentOutput,
} from '@deepseek-ai/dsh-persistent-tool-runtime'

const TRUNCATED_MESSAGE = '<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>'
const LOST_PREFIX_MESSAGE = '<response clipped><NOTE>The beginning of this command output was dropped by the terminal scrollback limit. The following text is the earliest retained output.</NOTE>\n'
const SHELL_RESET_MESSAGE = 'The persistent bash shell was reset; the next bash call starts from the workspace with a fresh current directory and environment.'
const TIMEOUT_CODE = 'PERSISTENT_BASH_TIMEOUT'
const DEFAULT_DESCRIPTION = 'Run commands in a persistent bash shell. State, including the current directory and exported environment variables, persists across calls for this agent.'

function markers(): PersistentCommandMarkers {
  const nonce = randomUUID()
  return {
    start: `__DSH_PERSISTENT_BASH_START_${nonce}__`,
    end: `__DSH_PERSISTENT_BASH_END_${nonce}:`,
  }
}

function quoteForBash(value: string): string {
  return `$'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\r', '\\r')
    .replaceAll('\n', '\\n')}'`
}

function wrapCommand(command: string, marker: PersistentCommandMarkers): string {
  // One physical line avoids PS2 prompt leaks before bash executes the buffer.
  return `printf '%s\\n' ${quoteForBash(marker.start)}; eval -- ${quoteForBash(command)}; __dsh_persistent_bash_status=$?; printf '%s%s\\n' ${quoteForBash(marker.end)} "$__dsh_persistent_bash_status"`
}

function trimTrailingNewline(text: string): string {
  return text.replace(/\r?\n$/, '')
}

function commandOutput(
  snapshot: RetainedPersistentOutput,
  marker: PersistentCommandMarkers,
): CapturedPersistentOutput | undefined {
  const text = snapshot.text
  const end = text.lastIndexOf(marker.end)
  const status = /^(\d+)\r?\n/.exec(text.slice(end + marker.end.length))?.[1]
  if (status === undefined) return undefined
  const startMarker = text.lastIndexOf(marker.start, end)
  const start = startMarker < 0 ? 0 : startMarker + marker.start.length
  return {
    text: trimTrailingNewline(text.slice(start, end).replace(/^\r?\n/, '')),
    incomplete: startMarker < 0,
    exitCode: Number(status),
  }
}

function partialOutput(
  snapshot: RetainedPersistentOutput,
  marker: PersistentCommandMarkers,
  fallback: string,
  fallbackTruncated = false,
): CapturedPersistentOutput {
  const startMarker = snapshot.text.lastIndexOf(marker.start)
  if (startMarker >= 0) {
    return {
      text: trimTrailingNewline(snapshot.text.slice(startMarker + marker.start.length).replace(/^\r?\n/, '')),
      incomplete: false,
    }
  }
  const fallbackStart = fallback.lastIndexOf(marker.start)
  const afterStart = fallbackStart < 0
    ? fallback
    : fallback.slice(fallbackStart + marker.start.length).replace(/^\r?\n/, '')
  const fallbackEnd = afterStart.lastIndexOf(marker.end)
  const beforeEnd = fallbackEnd < 0 ? afterStart : afterStart.slice(0, fallbackEnd)
  return {
    text: trimTrailingNewline(beforeEnd),
    incomplete: fallbackTruncated || fallbackStart < 0,
  }
}

async function initializeBash(
  ctx: Context,
  owner: Agent,
  id: TerminalSessionId,
  signal: AbortSignal,
): Promise<void> {
  // Echo suppression only: the prompt stays the backend's own, so the
  // backend's prompt-based readiness detection keeps working.
  const setup = ctx.terminals.startSend(owner, id, {
    text: 'stty -echo',
    submit: true,
    signal,
  })
  const result = await setup.done
  if (result.sessionStatus.kind === 'exited' || result.waitReason === 'timeout') {
    throw new Error('persistent bash shell did not accept initialization')
  }
}

function hasPartialCompletion(result: TerminalSendResult): boolean {
  return result.waitReason === 'stdin_read'
}

export const name = 'tool-bash-persistent'
export const inject = ['tools', 'terminals']

/** Configuration for the persistent Bash tool. */
export interface Config {
  /** PTY backend used for each owner-isolated persistent shell (default `shell`). */
  backendType?: string
  /** Wall-clock limit for one command (default 300000). */
  timeoutMs?: number
  /** Maximum returned command-output characters before clipping (default 16000). */
  maxOutputChars?: number
  /** Model-facing tool description; deployments may describe their environment. */
  description?: string
}

/** Runtime configuration schema for the persistent Bash tool. */
export const Config: z<Config> = z.object({
  backendType: z.string().default('shell'),
  timeoutMs: z.number().default(300_000),
  maxOutputChars: z.number().default(16_000),
  description: z.string().default(DEFAULT_DESCRIPTION),
})

/** Register one owner-scoped persistent `bash` tool. */
export function apply(ctx: Context, config: Config): void {
  const resolved = {
    backendType: config.backendType ?? 'shell',
    timeoutMs: config.timeoutMs ?? 300_000,
    maxOutputChars: config.maxOutputChars ?? 16_000,
    description: config.description ?? DEFAULT_DESCRIPTION,
  }
  if (resolved.backendType.trim().length === 0) {
    throw new Error('tool-bash-persistent: backendType must be non-empty')
  }
  if (!Number.isSafeInteger(resolved.timeoutMs) || resolved.timeoutMs <= 0) {
    throw new Error('tool-bash-persistent: timeoutMs must be a positive safe integer')
  }
  if (!Number.isSafeInteger(resolved.maxOutputChars) || resolved.maxOutputChars <= 0) {
    throw new Error('tool-bash-persistent: maxOutputChars must be a positive safe integer')
  }
  if (resolved.description.trim().length === 0) {
    throw new Error('tool-bash-persistent: description must be non-empty')
  }
  registerPersistentShellTool(ctx, {
    toolName: 'bash',
    toolDescription: resolved.description,
    commandParameterDescription: 'The bash command to run. Relative path is preferred in the command.',
    backendType: resolved.backendType,
    timeoutMs: resolved.timeoutMs,
    maxOutputChars: resolved.maxOutputChars,
    timeoutCode: TIMEOUT_CODE,
    lifecycleName: 'persistent bash',
    pluginName: 'tool-bash-persistent',
    resetSubject: 'persistent bash',
    resetMessage: SHELL_RESET_MESSAGE,
    truncatedMessage: TRUNCATED_MESSAGE,
    lostPrefixMessage: LOST_PREFIX_MESSAGE,
    initialize: initializeBash,
    createMarkers: markers,
    wrapCommand,
    captureComplete: commandOutput,
    capturePartial: partialOutput,
    hasPartialCompletion,
  })
}

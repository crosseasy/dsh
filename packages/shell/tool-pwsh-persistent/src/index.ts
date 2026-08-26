/**
 * Model-facing persistent `pwsh` tool over the owner-scoped PTY seam.
 * @module @deepseek-ai/dsh-tool-pwsh-persistent
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

const TRUNCATED_MESSAGE = '<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with Select-String in order to find the line numbers of what you are looking for.</NOTE>'
const LOST_PREFIX_MESSAGE = '<response clipped><NOTE>The beginning of this command output was dropped by the terminal scrollback limit. The following text is the earliest retained output.</NOTE>\n'
const SHELL_RESET_MESSAGE = 'The persistent pwsh shell was reset; the next pwsh call starts from the workspace with a fresh current directory and environment.'
const SHELL_PROMPT = '__DSH_PERSISTENT_PWSH_PROMPT__ '
const TIMEOUT_CODE = 'PERSISTENT_PWSH_TIMEOUT'
const DEFAULT_DESCRIPTION = 'Run commands in a persistent PowerShell shell. State, including the current directory and exported environment variables, persists across calls for this agent.'

function markers(): PersistentCommandMarkers {
  const nonce = randomUUID()
  return {
    start: `__DSH_PERSISTENT_PWSH_START_${nonce}__`,
    end: `__DSH_PERSISTENT_PWSH_END_${nonce}:`,
  }
}

/** Escape command text for a single PowerShell double-quoted wrapper. */
function quoteForPwsh(value: string): string {
  return value
    .replaceAll('`', '``')
    .replaceAll('"', '`"')
    .replaceAll('$', '`$')
    .replaceAll('\r', '')
    .replaceAll('\n', '`n')
    .replaceAll('\x1b', '`e')
}

function wrapCommand(command: string, marker: PersistentCommandMarkers): string {
  // One physical line keeps PSReadLine echo stripping deterministic.
  const body = quoteForPwsh(command)
  return `Write-Output '${marker.start}'; $LASTEXITCODE = $null; $__s = 1; try { Invoke-Expression "${body}"; $__ok = $? } catch { $__ok = $false }; if ($null -ne $LASTEXITCODE) { $__s = [int]$LASTEXITCODE } else { $__s = if ($__ok) { 0 } else { 1 } }; Write-Output ('${marker.end}' + $__s)`
}

function stripPrompt(text: string): string {
  let result = text.replace(/\r?\n$/, '')
  while (result.endsWith(SHELL_PROMPT)) {
    result = result.slice(0, -SHELL_PROMPT.length)
  }
  return result.endsWith('\n') ? result.slice(0, -1) : result
}

function commandOutput(
  snapshot: RetainedPersistentOutput,
  marker: PersistentCommandMarkers,
  wrapper: string,
): CapturedPersistentOutput | undefined {
  const text = snapshot.text
  const end = text.lastIndexOf(marker.end)
  const statusMatch = /^(\d+)\r?\n/.exec(text.slice(end + marker.end.length))
  if (statusMatch === null) return undefined
  const startMarker = text.lastIndexOf(marker.start, end)
  let captured = text.slice(startMarker < 0 ? 0 : startMarker + marker.start.length, end)
  // The PSReadLine echo carries the wrapper source (including both marker
  // nonces) before the real markers; anchor on the real markers excludes it,
  // and stripping the wrapper covers the rare case where the real START
  // scrolled out and extraction fell back to the echoed copy.
  captured = captured.replaceAll(wrapper, '')
  return {
    text: captured.replace(/^\r?\n/, '').replace(/\r?\n$/, ''),
    incomplete: startMarker < 0,
    exitCode: Number(statusMatch[1]),
  }
}

function promptCompleted(result: TerminalSendResult): boolean {
  return result.viewport.endsWith(SHELL_PROMPT)
    || result.viewport.endsWith(`${SHELL_PROMPT}\r\n`)
    || result.viewport.endsWith(`${SHELL_PROMPT}\n`)
}

function partialOutput(
  snapshot: RetainedPersistentOutput,
  marker: PersistentCommandMarkers,
  fallback: string,
  fallbackTruncated = false,
  wrapper = '',
): CapturedPersistentOutput {
  const startMarker = snapshot.text.lastIndexOf(marker.start)
  if (startMarker >= 0) {
    const retained = snapshot.text.slice(startMarker + marker.start.length)
    return {
      text: stripPrompt(retained.replace(/^\r?\n/, '')),
      incomplete: false,
    }
  }
  let visible = fallback
  const fallbackStart = visible.lastIndexOf(marker.start)
  if (fallbackStart >= 0) visible = visible.slice(fallbackStart + marker.start.length).replace(/^\r?\n/, '')
  const fallbackEnd = visible.lastIndexOf(marker.end)
  if (fallbackEnd >= 0) visible = visible.slice(0, fallbackEnd)
  return {
    text: stripPrompt(visible.replaceAll(SHELL_PROMPT, '').replaceAll(wrapper, '')),
    incomplete: fallbackTruncated || fallbackStart < 0,
  }
}

/** Prompt override submitted during shell initialization. */
const PWSH_PROMPT_SETUP =
  "function prompt { [Console]::Write([char]27 + ']133;D;' + [int]$LASTEXITCODE + [char]7); '" + SHELL_PROMPT + "' }"

async function initializePwsh(
  ctx: Context,
  owner: Agent,
  id: TerminalSessionId,
  signal: AbortSignal,
): Promise<void> {
  const setup = ctx.terminals.startSend(owner, id, {
    text: PWSH_PROMPT_SETUP,
    submit: true,
    signal,
  })
  const result = await setup.done
  if (result.sessionStatus.kind === 'exited' || result.waitReason === 'timeout') {
    throw new Error('persistent pwsh shell did not accept initialization')
  }
}

export const name = 'tool-pwsh-persistent'
export const inject = ['tools', 'terminals']

/* jscpd:ignore-start -- plugin Config and validation deliberately mirror the bash persistent adapter. */
/** Configuration for the persistent pwsh tool. */
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

/** Runtime configuration schema for the persistent pwsh tool. */
export const Config: z<Config> = z.object({
  backendType: z.string().default('shell'),
  timeoutMs: z.number().default(300_000),
  maxOutputChars: z.number().default(16_000),
  description: z.string().default(DEFAULT_DESCRIPTION),
})

/** Register one owner-scoped persistent `pwsh` tool. */
export function apply(ctx: Context, config: Config): void {
  const resolved = {
    backendType: config.backendType ?? 'shell',
    timeoutMs: config.timeoutMs ?? 300_000,
    maxOutputChars: config.maxOutputChars ?? 16_000,
    description: config.description ?? DEFAULT_DESCRIPTION,
  }
  if (resolved.backendType.trim().length === 0) {
    throw new Error('tool-pwsh-persistent: backendType must be non-empty')
  }
  if (!Number.isSafeInteger(resolved.timeoutMs) || resolved.timeoutMs <= 0) {
    throw new Error('tool-pwsh-persistent: timeoutMs must be a positive safe integer')
  }
  if (!Number.isSafeInteger(resolved.maxOutputChars) || resolved.maxOutputChars <= 0) {
    throw new Error('tool-pwsh-persistent: maxOutputChars must be a positive safe integer')
  }
  if (resolved.description.trim().length === 0) {
    throw new Error('tool-pwsh-persistent: description must be non-empty')
  }
  registerPersistentShellTool(ctx, {
    toolName: 'pwsh',
    toolDescription: resolved.description,
    commandParameterDescription: 'The PowerShell command to run. Relative path is preferred in the command.',
    backendType: resolved.backendType,
    timeoutMs: resolved.timeoutMs,
    maxOutputChars: resolved.maxOutputChars,
    timeoutCode: TIMEOUT_CODE,
    lifecycleName: 'persistent pwsh',
    pluginName: 'tool-pwsh-persistent',
    resetSubject: 'persistent pwsh',
    resetMessage: SHELL_RESET_MESSAGE,
    truncatedMessage: TRUNCATED_MESSAGE,
    lostPrefixMessage: LOST_PREFIX_MESSAGE,
    initialize: initializePwsh,
    createMarkers: markers,
    wrapCommand,
    captureComplete: commandOutput,
    capturePartial: partialOutput,
    hasPartialCompletion: promptCompleted,
  })
}
/* jscpd:ignore-end */

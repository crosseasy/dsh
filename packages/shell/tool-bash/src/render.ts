/**
 * Model-facing result rendering aliases for the bash tool.
 *
 * @module @deepseek-ai/dsh-tool-bash/render
 */

export {
  parseExitStatus,
  renderShellProcessRead as renderProcessRead,
  renderShellResult as renderResult,
} from '@deepseek-ai/dsh-shell'
export type { ParsedExitStatus } from '@deepseek-ai/dsh-shell'

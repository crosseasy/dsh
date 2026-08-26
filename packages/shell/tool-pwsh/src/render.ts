/**
 * Model-facing result rendering aliases for the pwsh tool.
 *
 * @module @deepseek-ai/dsh-tool-pwsh/render
 */

export {
  renderShellProcessRead as renderPwshProcessRead,
  renderShellResult as renderPwshResult,
} from '@deepseek-ai/dsh-shell'
export type { RenderableShellResult as RenderablePwshResult } from '@deepseek-ai/dsh-shell'

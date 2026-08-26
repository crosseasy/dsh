/**
 * Client-namespace projection of token-meter's browser-safe types.
 *
 * @module @deepseek-ai/dsh-token-meter/client
 */

export type * from './projection.ts'
export { foldContextBreakdownProjection } from './breakdown-fold.ts'
export type { ContextBreakdownState } from './breakdown-fold.ts'
export { foldContextPressureProjection, foldTokenUsageProjection } from './usage-fold.ts'
export type { ContextPressureState, TokenUsageState } from './usage-fold.ts'

/**
 * Client-namespace projection of token-meter's browser-safe contracts and folds.
 *
 * @module @deepseek-ai/dsh-token-meter/client
 */

export type * from './projection.ts'
export {
  applyContextBreakdownProjectionEvent,
  foldContextBreakdownProjection,
  initialContextBreakdownState,
  viewContextBreakdownProjectionState,
} from './breakdown-fold.ts'
export type { ContextBreakdownState } from './breakdown-fold.ts'
export { contextBreakdownProjectionDefinition } from './breakdown-projection.ts'
export {
  applyContextPressureProjectionEvent,
  applyTokenUsageProjectionEvent,
  foldContextPressureProjection,
  foldTokenUsageProjection,
  initialContextPressureState,
  initialTokenUsageState,
  viewContextPressureProjectionState,
  viewTokenUsageProjectionState,
} from './usage-fold.ts'
export type { ContextPressureState, TokenUsageState } from './usage-fold.ts'
export {
  contextPressureProjectionDefinition,
  tokenUsageProjectionDefinition,
} from './usage-projection.ts'
export { deriveTurnTokenUsage } from './turn-usage.ts'
export type { TurnTokenUsage, TurnTokenUsageRoute } from './turn-usage.ts'

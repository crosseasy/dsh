/**
 * Browser-safe token-meter projection types and Cordis-free fold functions.
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

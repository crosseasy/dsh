/**
 * Browser-safe session-stats types and Cordis-free fold functions.
 *
 * @module @deepseek-ai/dsh-session-stats/client
 */

export type * from './types.ts'
export {
  applySessionStatsProjectionEvent,
  foldSessionStatsProjection,
  foldSessionStatsProjectionState,
  initialSessionStatsState,
  viewSessionStatsProjectionState,
} from './projection-fold.ts'
export type { SessionStatsState, SessionStatsTotals } from './projection-fold.ts'
export { sessionStatsProjectionDefinition } from './projection.ts'

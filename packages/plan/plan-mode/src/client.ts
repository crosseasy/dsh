/**
 * Browser-safe plan projection types and Cordis-free fold functions.
 *
 * @module @deepseek-ai/dsh-plan-mode/client
 */

export type * from './types.ts'
export {
  applyPlanProjectionEvent,
  foldPlanProjection,
  foldPlanProjectionState,
  initialPlanProjectionState,
  viewPlanProjectionState,
} from './projection-fold.ts'
export type { PlanProjectionState } from './projection-fold.ts'
export { planProjectionDefinition } from './projection.ts'

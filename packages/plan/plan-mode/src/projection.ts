/**
 * Plan-mode projection registration built on the pure plan fold.
 *
 * @module @deepseek-ai/dsh-plan-mode/projection
 */

import { z as zod } from 'zod'
import type { ZodType } from 'zod'
import type { CommandId } from '@deepseek-ai/dsh-commands'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { PlanProjection } from './types.ts'
import {
  applyPlanProjectionEvent,
  initialPlanProjectionState,
  viewPlanProjectionState,
  type PlanProjectionState,
} from './projection-fold.ts'

export type { PlanProjectionState } from './projection-fold.ts'
export { foldPlanProjection, foldPlanProjectionState } from './projection-fold.ts'

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    plan: PlanProjectionState
  }
}

/** State validator for persisted plan projection rows. */
export const planProjectionStateSchema: ZodType<PlanProjectionState> = zod.object({
  active: zod.boolean(),
  wanted: zod.boolean().nullable(),
  running: zod.object({
    commandId: zod.string() as unknown as ZodType<CommandId>,
    wanted: zod.boolean(),
  }).strict().nullable(),
  activeAtLastHeader: zod.boolean().nullable(),
}).strict()

/** Wire payload schema of the `plan` projection. */
export const planProjectionSchema: ZodType<PlanProjection> = zod.object({
  active: zod.boolean(),
  pending: zod.boolean(),
})

/** The plan projection unit registered on `ctx.sessionProjections`. */
export const planProjectionDefinition = {
  key: 'plan',
  stateSchema: planProjectionStateSchema,
  init: initialPlanProjectionState,
  apply: applyPlanProjectionEvent,
  wire: {
    viewSchema: planProjectionSchema,
    view: viewPlanProjectionState,
  },
  stateVersion: 3,
} satisfies ProjectionDefinition<'plan', PlanProjectionState>

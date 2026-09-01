/**
 * Pure folds for durable provider-reported token usage and context occupancy.
 */

import { z } from 'zod'
import type {} from '@deepseek-ai/dsh-llm-retry/types'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { ContextPressureProjection } from './projection.ts'
import {
  applyContextPressureProjectionEvent,
  applyTokenUsageProjectionEvent,
  initialContextPressureState,
  initialTokenUsageState,
  viewContextPressureProjectionState,
  viewTokenUsageProjectionState,
  type ContextPressureState,
  type TokenUsageState,
} from './usage-fold.ts'

export type { ContextPressureState, TokenUsageState } from './usage-fold.ts'
export { foldContextPressureProjection, foldTokenUsageProjection } from './usage-fold.ts'

const projectionSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
}).strict()

/**
 * The token-usage unit's state schema — the one definition of the state
 * shape; the state type is inferred from it.
 */
const tokenUsageStateSchema = z.object({
  totals: projectionSchema,
  last: z.object({
    turn: z.number().int().nonnegative(),
    step: z.number().int().nonnegative(),
    buckets: projectionSchema,
  }).nullable(),
}).strict()

const pressureSchema: z.ZodType<ContextPressureProjection> = z.object({
  pressureTokens: z.number().int().nonnegative().optional(),
  projectedTokens: z.number().int().nonnegative().optional(),
  contextWindow: z.number().int().positive().optional(),
}).strict().transform(({ pressureTokens, projectedTokens, contextWindow }) => ({
  ...pressureTokens === undefined ? {} : { pressureTokens },
  ...projectedTokens === undefined ? {} : { projectedTokens },
  ...contextWindow === undefined ? {} : { contextWindow },
}))

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    tokenUsage: TokenUsageState
    contextPressure: ContextPressureState
  }
}

/** The context-pressure state schema and source of its inferred type. */
const contextPressureStateSchema = z.object({
  contextWindow: z.number().int().positive().optional(),
  pressureTokens: z.number().int().nonnegative().optional(),
  surfaceTokens: z.number().int().nonnegative(),
  sampledSurfaceTokens: z.number().int().nonnegative().optional(),
  claim: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().nonnegative(),
    tokens: z.number().int().nonnegative(),
  }).optional(),
}).strict()

/**
 * Token-meter's session projection unit.
 *
 * Usage chunks provide an early sample that survives a later request failure;
 * an assistant message provides the final sample for the same attempt. A
 * repeated sample replaces that attempt's earlier value instead of double
 * counting it, while `llm/retry-started` closes the replacement slot so the
 * retried attempt adds to the total. The single `last` slot relies on the
 * session-log invariant that usage reports for one attempt are adjacent.
 */
export const tokenUsageProjectionDefinition = {
  key: 'tokenUsage',
  stateVersion: 2,
  stateSchema: tokenUsageStateSchema,
  init: initialTokenUsageState,
  apply: applyTokenUsageProjectionEvent,
  wire: { viewSchema: projectionSchema, view: viewTokenUsageProjectionState },
} satisfies ProjectionDefinition<'tokenUsage', TokenUsageState>

/**
 * Token-meter's context-occupancy projection unit.
 *
 * Independent last-wins slots: the newest usage sample supplies the provider
 * numerator, the newest `request/context` record the denominator. Both are
 * whole values, so replay order alone decides the result and no cross-field
 * consistency is claimed — the pair is explicitly not one atomic request
 * observation (see {@link ContextPressureProjection}).
 *
 * `pressureTokens` is prompt-side only, so it holds still while a turn streams
 * and steps forward once the next request reports its usage. Because nothing
 * but a request reports usage, it also cannot see a compaction: the fold
 * therefore carries a running surface total alongside it and publishes
 * `projectedTokens` — the sample plus the surface's signed movement since it
 * was taken — so occupancy answers for the next request rather than the last
 * one. The total rides `foldSurfaceProjection`, so the state stays O(1) and a
 * replacement shrinks it by its logged shadow price. A replacement without a
 * claim preserves the previous total. A usage sample is stamped BEFORE the same
 * event joins the surface, so an `assistant/message` anchors against the
 * surface its own request saw.
 */
export const contextPressureProjectionDefinition = {
  key: 'contextPressure',
  stateVersion: 4,
  stateSchema: contextPressureStateSchema,
  init: initialContextPressureState,
  apply: applyContextPressureProjectionEvent,
  wire: {
    viewSchema: pressureSchema,
    view: viewContextPressureProjectionState,
  },
} satisfies ProjectionDefinition<'contextPressure', ContextPressureState>

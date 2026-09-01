/**
 * Pure fold for the heuristic context-composition projection: system prompt
 * and tool schemas from the newest request envelope, conversation from the
 * live surface. Prices with the same shared estimator as the meter service,
 * so the three figures match `measure()`'s heuristic vocabulary exactly.
 */

import { z } from 'zod'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import {
  applyContextBreakdownProjectionEvent,
  initialContextBreakdownState,
  viewContextBreakdownProjectionState,
  type ContextBreakdownState,
} from './breakdown-fold.ts'
// Import for the `contextBreakdown` SessionProjectionStateMap key merge.
import type {} from './projection.ts'

export type { ContextBreakdownState } from './breakdown-fold.ts'
export { foldContextBreakdownProjection } from './breakdown-fold.ts'

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    contextBreakdown: ContextBreakdownState
  }
}

/** Non-negative integer token count (the shared figure shape). */
const tokenCount = z.number().int().nonnegative()

/** The context-breakdown state schema and source of its inferred type. */
const contextBreakdownStateSchema = z.object({
  systemTokens: tokenCount,
  toolsTokens: tokenCount,
  messageTokens: tokenCount,
  claim: z.object({
    start: tokenCount,
    end: tokenCount,
    tokens: tokenCount,
  }).optional(),
}).strict()

const breakdownSchema = z.object({
  systemTokens: tokenCount,
  toolsTokens: tokenCount,
  messageTokens: tokenCount,
}).strict()

/**
 * Token-meter's context-composition projection unit.
 *
 * Envelope figures are last-wins per `request/header`; the message figure
 * rides `foldSurfaceProjection` — the same O(1) fold the occupancy projection
 * uses — so fully metered logs equal `measure().surfaceTokens` at every event
 * boundary and compaction shrinks the figure by its logged shadow price. A
 * replacement without a claim preserves the previous total. The state is a
 * fixed handful of numbers, so the persisted checkpoint stays O(1) over the
 * session's life.
 */
export const contextBreakdownProjectionDefinition = {
  key: 'contextBreakdown',
  stateVersion: 2,
  stateSchema: contextBreakdownStateSchema,
  init: initialContextBreakdownState,
  apply: applyContextBreakdownProjectionEvent,
  wire: {
    viewSchema: breakdownSchema,
    view: viewContextBreakdownProjectionState,
  },
} satisfies ProjectionDefinition<'contextBreakdown', ContextBreakdownState>

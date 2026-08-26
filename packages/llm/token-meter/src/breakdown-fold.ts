/**
 * Pure context-breakdown projection fold shared by production and client fixtures.
 *
 * @module @deepseek-ai/dsh-token-meter/breakdown-fold
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { canonicalHeader } from '@deepseek-ai/dsh-session/request-header'
import type { ContextBreakdownProjection } from './projection.ts'
import { estimateSystemTokens, estimateToolsTokens } from './estimate.ts'
import { foldSurfaceProjection, type ShadowPriceClaim } from './surface-projection.ts'

/** Context-breakdown projection state. */
export interface ContextBreakdownState extends ContextBreakdownProjection {
  /** Shadow-price claim for the immediately following surface replacement. */
  claim?: ShadowPriceClaim | undefined
}

/**
 * Initial state for the context-breakdown projection fold.
 * @returns zeroed context-breakdown fold state.
 */
export function initialContextBreakdownState(): ContextBreakdownState {
  return { systemTokens: 0, toolsTokens: 0, messageTokens: 0 }
}

/**
 * Fold one committed event into context-breakdown state.
 * @param state - current context-breakdown state.
 * @param event - committed session event.
 * @returns the next state, or `state` when the event is irrelevant.
 */
export function applyContextBreakdownProjectionEvent(
  state: ContextBreakdownState,
  event: SessionEvent,
): ContextBreakdownState {
  const fold = foldSurfaceProjection(state.claim, event)
  let systemTokens = state.systemTokens
  let toolsTokens = state.toolsTokens
  if (event.type === 'request/header') {
    const header = canonicalHeader(event.data.header)
    systemTokens = estimateSystemTokens(header)
    toolsTokens = estimateToolsTokens(header)
  }
  if (systemTokens === state.systemTokens
    && toolsTokens === state.toolsTokens
    && fold.deltaTokens === 0
    && fold.claim === undefined
    && state.claim === undefined) return state
  return {
    systemTokens,
    toolsTokens,
    messageTokens: state.messageTokens + fold.deltaTokens,
    ...fold.claim === undefined ? {} : { claim: fold.claim },
  }
}

/**
 * Project context-breakdown state onto the wire value.
 * @param state - current context-breakdown state.
 * @returns the browser-visible context-breakdown value.
 */
export function viewContextBreakdownProjectionState(state: ContextBreakdownState): ContextBreakdownProjection {
  return {
    systemTokens: state.systemTokens,
    toolsTokens: state.toolsTokens,
    messageTokens: state.messageTokens,
  }
}

/**
 * Fold a complete event vector into context-breakdown wire value.
 * @param events - committed session events.
 * @returns the browser-visible context-breakdown value.
 */
export function foldContextBreakdownProjection(events: readonly SessionEvent[]): ContextBreakdownProjection {
  let state = initialContextBreakdownState()
  for (const event of events) state = applyContextBreakdownProjectionEvent(state, event)
  return viewContextBreakdownProjectionState(state)
}

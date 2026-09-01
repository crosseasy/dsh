/**
 * Pure plan-mode projection fold shared by production and client fixtures.
 *
 * @module @deepseek-ai/dsh-plan-mode/projection-fold
 */

import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { PlanProjection, PlanUnitState } from './types.ts'

/** Projection state for the logged plan-mode lifecycle. */
export type PlanProjectionState = PlanUnitState

/**
 * Initial state for the plan projection fold.
 * @returns inactive plan projection state with no pending command.
 */
export function initialPlanProjectionState(): PlanProjectionState {
  return { active: false, wanted: null, running: null, activeAtLastHeader: null }
}

/**
 * Fold one committed event into the plan projection state.
 * @param state - current fold state.
 * @param event - committed session event.
 * @returns the next state, or `state` when the event is irrelevant.
 */
export function applyPlanProjectionEvent(state: PlanProjectionState, event: SessionEvent): PlanProjectionState {
  if (event.type === 'command/run' && event.data.name === 'plan') {
    if (event.data.args === undefined) return state
    const wanted = event.data.args.trim() !== 'off'
    return { ...state, running: { commandId: event.data.commandId, wanted } }
  }
  if (event.type === 'command/done' && event.data.commandId === state.running?.commandId) {
    const wanted = event.data.kind === 'success' && state.running.wanted !== state.active
      ? state.running.wanted
      : null
    return { ...state, wanted, running: null }
  }
  if (event.type === 'plan/mode') {
    return { ...state, active: event.data.active, wanted: null }
  }
  if (event.type === 'request/header') {
    return { ...state, activeAtLastHeader: state.active }
  }
  return state
}

/**
 * Project plan fold state onto the wire value.
 * @param state - current fold state.
 * @returns the browser-visible plan value.
 */
export function viewPlanProjectionState(state: PlanProjectionState): PlanProjection {
  const wanted = state.running?.wanted ?? state.wanted
  return { active: state.active, pending: wanted !== null && wanted !== state.active }
}

/**
 * Fold a complete event vector into plan state.
 * @param events - committed session events.
 * @returns the final plan projection state.
 */
export function foldPlanProjectionState(events: readonly SessionEvent[]): PlanProjectionState {
  let state = initialPlanProjectionState()
  for (const event of events) state = applyPlanProjectionEvent(state, event)
  return state
}

/**
 * Fold a complete event vector into the plan wire value.
 * @param events - committed session events.
 * @returns the browser-visible plan value.
 */
export function foldPlanProjection(events: readonly SessionEvent[]): PlanProjection {
  return viewPlanProjectionState(foldPlanProjectionState(events))
}

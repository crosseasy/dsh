/**
 * Pure session-stats projection fold shared by production and client fixtures.
 *
 * @module @deepseek-ai/dsh-session-stats/projection-fold
 */

import { isTokenDelta } from '@deepseek-ai/dsh-llm/message'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { SessionStatsProjection } from './types.ts'

/** Accumulated whole-log figures (the view is exactly these totals). */
export type SessionStatsTotals = SessionStatsProjection

/**
 * Fold state: the totals plus the in-flight boundaries they accrue from.
 * Turn numbers are host-assigned and monotonic per session, so a single
 * `lastTurn` slot decides "first closed step of a new turn"; the state is
 * plain JSON per the unit contract.
 */
export interface SessionStatsState extends SessionStatsTotals {
  /** Turn of the last counted `step/end`; null before the first. */
  lastTurn: number | null
  /** The open step's boundary facts; null outside a step or after its message assembled. */
  openStep: { turn: number; step: number; startTime: number; firstTokenTime: number | null } | null
  /** Dispatch times of tool calls whose result has not landed, by callId. */
  pendingCalls: Record<string, number>
}

/**
 * Initial state for the session-stats projection fold.
 * @returns zeroed session-stats fold state.
 */
export function initialSessionStatsState(): SessionStatsState {
  return {
    turns: 0,
    steps: 0,
    llmMs: 0,
    toolMs: 0,
    ttftMs: 0,
    ttftSteps: 0,
    decodeMs: 0,
    decodeTokens: 0,
    lastTurn: null,
    openStep: null,
    pendingCalls: {},
  }
}

/**
 * Provider-reported completion tokens, guarded the way the window fold guards
 * node usage.
 * @param usage - the assistant/message event's optional usage record.
 * @returns the output-token count, or null when unreported or invalid.
 */
function usageOutputTokens(usage: unknown): number | null {
  if (typeof usage !== 'object' || usage === null) return null
  const value = (usage as { outputTokens?: unknown }).outputTokens
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

/**
 * Fold one committed event into the session-stats state.
 * @param state - current fold state.
 * @param event - committed session event.
 * @returns the next state, or `state` when the event is irrelevant.
 */
export function applySessionStatsProjectionEvent(state: SessionStatsState, event: SessionEvent): SessionStatsState {
  switch (event.type) {
    case 'step/start':
      return {
        ...state,
        openStep: { turn: event.data.turn, step: event.data.step, startTime: event.time, firstTokenTime: null },
      }
    case 'assistant/chunk': {
      const open = state.openStep
      if (open === null || open.turn !== event.data.turn || open.step !== event.data.step) return state
      if (open.firstTokenTime !== null || !isTokenDelta(event.data.chunk)) return state
      return { ...state, openStep: { ...open, firstTokenTime: event.time } }
    }
    case 'assistant/message': {
      const open = state.openStep
      if (open === null || open.turn !== event.data.turn || open.step !== event.data.step) return state
      const next: SessionStatsState = {
        ...state,
        llmMs: state.llmMs + Math.max(0, event.time - open.startTime),
        openStep: null,
      }
      if (open.firstTokenTime !== null) {
        next.ttftMs += Math.max(0, open.firstTokenTime - open.startTime)
        next.ttftSteps += 1
        const outputTokens = usageOutputTokens(event.data.usage)
        if (outputTokens !== null) {
          next.decodeMs += Math.max(0, event.time - open.firstTokenTime)
          next.decodeTokens += outputTokens
        }
      }
      return next
    }
    case 'tool/call':
      return { ...state, pendingCalls: { ...state.pendingCalls, [event.data.callId]: event.time } }
    case 'tool/result': {
      const callId = event.data.message.source.callId
      const dispatched = Object.hasOwn(state.pendingCalls, callId) ? state.pendingCalls[callId] : undefined
      if (dispatched === undefined) return state
      const pendingCalls = Object.fromEntries(
        Object.entries(state.pendingCalls).filter(([id]) => id !== callId),
      )
      return { ...state, toolMs: state.toolMs + Math.max(0, event.time - dispatched), pendingCalls }
    }
    case 'step/end':
      return {
        ...state,
        turns: state.lastTurn === event.data.turn ? state.turns : state.turns + 1,
        steps: state.steps + 1,
        lastTurn: event.data.turn,
        openStep: null,
      }
    case 'turn/end':
      return Object.keys(state.pendingCalls).length === 0 ? state : { ...state, pendingCalls: {} }
    default:
      return state
  }
}

/**
 * Project session-stats state onto the wire value.
 * @param state - current fold state.
 * @returns the browser-visible session-stats value.
 */
export function viewSessionStatsProjectionState(state: SessionStatsState): SessionStatsProjection {
  return {
    turns: state.turns,
    steps: state.steps,
    llmMs: state.llmMs,
    toolMs: state.toolMs,
    ttftMs: state.ttftMs,
    ttftSteps: state.ttftSteps,
    decodeMs: state.decodeMs,
    decodeTokens: state.decodeTokens,
  }
}

/**
 * Fold a complete event vector into session-stats state.
 * @param events - committed session events.
 * @returns the final session-stats state.
 */
export function foldSessionStatsProjectionState(events: readonly SessionEvent[]): SessionStatsState {
  let state = initialSessionStatsState()
  for (const event of events) state = applySessionStatsProjectionEvent(state, event)
  return state
}

/**
 * Fold a complete event vector into the session-stats wire value.
 * @param events - committed session events.
 * @returns the browser-visible session-stats value.
 */
export function foldSessionStatsProjection(events: readonly SessionEvent[]): SessionStatsProjection {
  return viewSessionStatsProjectionState(foldSessionStatsProjectionState(events))
}

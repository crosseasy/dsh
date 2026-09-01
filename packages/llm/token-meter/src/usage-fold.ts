/**
 * Pure token-usage and context-pressure folds shared by production and client fixtures.
 *
 * @module @deepseek-ai/dsh-token-meter/usage-fold
 */

import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import type { ContextPressureProjection, TokenUsageProjection } from './projection.ts'
import { foldSurfaceProjection, type ShadowPriceClaim } from './surface-projection.ts'

const zeroBuckets = (): TokenUsageProjection => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

const bucketsFrom = (usage: TokenUsage): TokenUsageProjection => ({
  uncachedInputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  cacheReadTokens: usage.cacheReadTokens ?? 0,
  cacheWriteTokens: usage.cacheWriteTokens ?? 0,
})

const bucketsEqual = (left: TokenUsageProjection, right: TokenUsageProjection): boolean =>
  left.uncachedInputTokens === right.uncachedInputTokens
  && left.outputTokens === right.outputTokens
  && left.cacheReadTokens === right.cacheReadTokens
  && left.cacheWriteTokens === right.cacheWriteTokens

const addReplacing = (
  totals: TokenUsageProjection,
  previous: TokenUsageProjection | undefined,
  next: TokenUsageProjection,
): TokenUsageProjection => ({
  uncachedInputTokens: totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + next.uncachedInputTokens,
  outputTokens: totals.outputTokens - (previous?.outputTokens ?? 0) + next.outputTokens,
  cacheReadTokens: totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + next.cacheReadTokens,
  cacheWriteTokens: totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + next.cacheWriteTokens,
})

/** Token-usage projection state. */
export interface TokenUsageState {
  /** Cumulative buckets after same-step replacement. */
  totals: TokenUsageProjection
  /** Last usage sample, allowing same turn/step final usage to replace a chunk sample. */
  last: { turn: number; step: number; buckets: TokenUsageProjection } | null
}

/** Context-pressure projection state. */
export interface ContextPressureState {
  /** Newest recorded route capacity. */
  contextWindow?: number | undefined
  /** Provider-reported prompt pressure of the newest usage sample. */
  pressureTokens?: number | undefined
  /** Running heuristic price of the current surface. */
  surfaceTokens: number
  /** Surface total at the newest provider usage sample. */
  sampledSurfaceTokens?: number | undefined
  /** Shadow-price claim for the immediately following surface replacement. */
  claim?: ShadowPriceClaim | undefined
}

/**
 * Initial state for the token-usage fold.
 * @returns zeroed token-usage fold state.
 */
export function initialTokenUsageState(): TokenUsageState {
  return { totals: zeroBuckets(), last: null }
}

/**
 * Initial state for the context-pressure fold.
 * @returns zero-surface context-pressure fold state.
 */
export function initialContextPressureState(): ContextPressureState {
  return { surfaceTokens: 0 }
}

/** Prompt-side pressure of one request: input plus cache traffic, no output. */
const pressureFrom = (usage: TokenUsage): number =>
  usage.inputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)

/** The usage a chunk or finalized message reports for its step, if any. */
function usageOf(event: SessionEvent): TokenUsage | undefined {
  return event.type === 'assistant/chunk' && event.data.chunk.type === 'usage'
    ? event.data.chunk.usage
    : event.type === 'assistant/message'
      ? event.data.usage
      : undefined
}

/**
 * Fold one committed event into token-usage state.
 * @param state - current token-usage state.
 * @param event - committed session event.
 * @returns the next state, or `state` when the event is irrelevant.
 */
export function applyTokenUsageProjectionEvent(state: TokenUsageState, event: SessionEvent): TokenUsageState {
  let turn: number
  let step: number
  let usage: TokenUsage
  if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
    ;({ turn, step } = event.data)
    usage = event.data.chunk.usage
  } else if (event.type === 'assistant/message' && event.data.usage !== undefined) {
    ;({ turn, step, usage } = event.data)
  } else {
    return state
  }

  const buckets = bucketsFrom(usage)
  const previous = state.last !== null
    && state.last.turn === turn
    && state.last.step === step
    ? state.last.buckets
    : undefined
  if (previous !== undefined && bucketsEqual(previous, buckets)) return state

  return {
    totals: addReplacing(state.totals, previous, buckets),
    last: { turn, step, buckets },
  }
}

/**
 * Project token-usage state onto the wire value.
 * @param state - current token-usage state.
 * @returns the browser-visible usage buckets.
 */
export function viewTokenUsageProjectionState(state: TokenUsageState): TokenUsageProjection {
  return state.totals
}

/**
 * Fold one committed event into context-pressure state.
 * @param state - current context-pressure state.
 * @param event - committed session event.
 * @returns the next state, or `state` when the event is irrelevant.
 */
export function applyContextPressureProjectionEvent(state: ContextPressureState, event: SessionEvent): ContextPressureState {
  const fold = foldSurfaceProjection(state.claim, event)
  let next = state
  if (event.type === 'request/context') {
    const contextWindow = event.data.contextWindow
    if (contextWindow !== state.contextWindow) {
      if (contextWindow !== undefined) {
        next = { ...next, contextWindow }
      } else {
        const { contextWindow: _removed, ...withoutContextWindow } = next
        next = withoutContextWindow
      }
    }
  }
  const usage = usageOf(event)
  if (usage !== undefined) {
    const pressureTokens = pressureFrom(usage)
    if (pressureTokens !== next.pressureTokens || next.sampledSurfaceTokens !== next.surfaceTokens) {
      next = { ...next, pressureTokens, sampledSurfaceTokens: next.surfaceTokens }
    }
  }
  if (fold.deltaTokens !== 0) {
    next = { ...next, surfaceTokens: next.surfaceTokens + fold.deltaTokens }
  }
  if (state.claim === undefined && fold.claim === undefined) return next
  const { claim: _expired, ...withoutClaim } = next
  return fold.claim === undefined ? withoutClaim : { ...withoutClaim, claim: fold.claim }
}

/**
 * Project context-pressure state onto the wire value.
 * @param state - current context-pressure state.
 * @returns the browser-visible pressure value.
 */
export function viewContextPressureProjectionState(state: ContextPressureState): ContextPressureProjection {
  return {
    ...state.contextWindow === undefined ? {} : { contextWindow: state.contextWindow },
    ...state.pressureTokens === undefined ? {} : { pressureTokens: state.pressureTokens },
    ...state.pressureTokens === undefined || state.sampledSurfaceTokens === undefined
      ? {}
      : { projectedTokens: Math.max(0, state.pressureTokens + state.surfaceTokens - state.sampledSurfaceTokens) },
  }
}

/**
 * Fold a complete event vector into the token-usage wire value.
 * @param events - committed session events.
 * @returns the browser-visible usage buckets.
 */
export function foldTokenUsageProjection(events: readonly SessionEvent[]): TokenUsageProjection {
  let state = initialTokenUsageState()
  for (const event of events) state = applyTokenUsageProjectionEvent(state, event)
  return viewTokenUsageProjectionState(state)
}

/**
 * Fold a complete event vector into the context-pressure wire value.
 * @param events - committed session events.
 * @returns the browser-visible pressure value.
 */
export function foldContextPressureProjection(events: readonly SessionEvent[]): ContextPressureProjection {
  let state = initialContextPressureState()
  for (const event of events) state = applyContextPressureProjectionEvent(state, event)
  return viewContextPressureProjectionState(state)
}

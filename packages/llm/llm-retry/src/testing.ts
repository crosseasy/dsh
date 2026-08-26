/**
 * Deterministic retry-policy installation hooks for repository tests.
 *
 * @module @deepseek-ai/dsh-llm-retry/testing
 */

import type { Context } from '@deepseek-ai/cordis'
import type { Config } from './index.ts'
import { installRetryPolicy } from './runtime.ts'
import type { RetryInternals } from './runtime.ts'

export type { RetryInternals } from './runtime.ts'

/**
 * Install provider-routed request recovery with optional deterministic hooks.
 * @param ctx - plugin context that owns the listener and active waits.
 * @param config - empty executor config; provider registrations own policy.
 * @param internals - non-serializable deterministic hooks for tests.
 */
export function apply(ctx: Context, config: Config = {}, internals: RetryInternals = {}): void {
  installRetryPolicy(ctx, config, internals)
}

/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-curated-scripts`.
 * @module @deepseek-ai/dsh-curated-scripts/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-curated-scripts'

/** Cordis companion plugin name. */
export const name = 'curated-scripts-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

// No runtime invariant: this package exposes offline verification commands and
// owns no harness service, event stream, or mutable runtime relation.
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))

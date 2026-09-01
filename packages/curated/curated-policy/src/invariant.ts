/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-curated-policy`.
 * @module @deepseek-ai/dsh-curated-policy/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-curated-policy'

/** Cordis companion plugin name. */
export const name = 'curated-policy-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

// No runtime invariant: this package owns fixed policy catalogs and no
// observable event-stream or mutable-data relationship.
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))

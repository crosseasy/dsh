/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-curated-profiles`.
 * @module @deepseek-ai/dsh-curated-profiles/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import {
  CURATED_BASELINE_BUNDLES,
  CURATED_PROFILE_TEMPLATES,
  curatedProfileDependenciesForBundles,
} from './index.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-curated-profiles'

/** Cordis companion plugin name. */
export const name = 'curated-profiles-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Verify curated templates keep the shared web baseline and accepted dependencies. */
const install: InvariantInstaller = (_ctx, fail) => {
  const curated = CURATED_PROFILE_TEMPLATES['web-curated'].bundles
  const baselineBundles = new Set<string>(CURATED_BASELINE_BUNDLES)
  const personalShell = curated.filter(bundle => !baselineBundles.has(bundle))
  const dependencyMessages = new Set<string>()
  for (const profileName of Object.keys(CURATED_PROFILE_TEMPLATES)) {
    const bundles = CURATED_PROFILE_TEMPLATES[profileName as keyof typeof CURATED_PROFILE_TEMPLATES].bundles
    if (profileName === 'web-personal') {
      if (bundles.length !== personalShell.length || !bundles.every((bundle, index) => bundle === personalShell[index])) {
        fail('profile web-personal must stay physically isolated from curated baseline and scenario bundles')
      }
    } else if (bundles.length < curated.length || !curated.every((bundle, index) => bundles[index] === bundle)) {
      fail(`profile ${profileName} must keep the curated baseline as its leading bundle list`)
    }
    try {
      curatedProfileDependenciesForBundles(
        bundles,
        profileName as keyof typeof CURATED_PROFILE_TEMPLATES,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!dependencyMessages.has(message)) {
        dependencyMessages.add(message)
        fail(message)
      }
    }
  }
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))

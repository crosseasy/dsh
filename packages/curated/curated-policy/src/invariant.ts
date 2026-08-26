/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-curated-policy`.
 * @module @deepseek-ai/dsh-curated-policy/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import {
  loadCapabilityConflicts,
  loadCuratedCatalog,
  loadPermissionRules,
  validateCandidateLock,
  validatePolicySemantics,
  type CapabilityConflictCatalog,
  type CuratedCatalog,
  type PermissionRuleCatalog,
} from './index.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-curated-policy'

/** Cordis companion plugin name. */
export const name = 'curated-policy-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Validate one curated catalog for invariant companion failures.
 * @param catalog - Catalog to validate.
 * @param conflicts - Capability conflict catalog to validate with the candidates.
 * @param permissions - Permission rule catalog to validate with the candidates.
 * @returns stable policy issue codes, empty when the catalog is valid.
 */
export function validateCuratedPolicyCatalog(
  catalog: CuratedCatalog,
  conflicts: CapabilityConflictCatalog = loadCapabilityConflicts(),
  permissions: PermissionRuleCatalog = loadPermissionRules(),
): readonly string[] {
  return [
    ...validateCandidateLock(catalog),
    ...validatePolicySemantics(catalog, conflicts, permissions),
  ].map(issue => issue.code)
}

/** Verify the checked-in candidate, conflict, and permission catalogs remain coherent. */
const install: InvariantInstaller = (_ctx, fail) => {
  const issues = validateCuratedPolicyCatalog(
    loadCuratedCatalog(),
    loadCapabilityConflicts(),
    loadPermissionRules(),
  )
  if (issues.length > 0) {
    fail(`curated catalog has policy issues: ${issues.join(', ')}`)
  }
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))

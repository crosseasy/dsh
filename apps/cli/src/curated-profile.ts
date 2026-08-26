/**
 * Launcher bridge for curated profile templates.
 * @module @deepseek-ai/dsh/curated-profile
 */

import {
  CURATED_PROFILE_TEMPLATES,
  materializeCuratedProfile,
  type CuratedProfileName,
} from '@deepseek-ai/dsh-curated-profiles'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/**
 * Test whether a profile name is owned by the curated profile package.
 * @param name - Profile name from the CLI.
 * @returns true when the profile has a built-in curated template.
 */
export function isCuratedProfileName(name: string): name is CuratedProfileName {
  return Object.hasOwn(CURATED_PROFILE_TEMPLATES, name)
}

/**
 * Materialize a built-in curated profile before generic profile loading.
 * @param name - Profile name from the CLI.
 */
export function ensureCuratedProfile(name: string): void {
  if (isCuratedProfileName(name)) materializeCuratedProfile(name, resolveDshHome())
}

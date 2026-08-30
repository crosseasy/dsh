/**
 * Launcher bridge for curated profile templates.
 * @module @deepseek-ai/dsh/curated-profile
 */

import {
  assertCuratedProfileAdmission,
  CURATED_PROFILE_TEMPLATES,
  materializeCuratedProfile,
  materializeCuratedProfileForLoad,
  type CuratedProfileFileSnapshot,
  type CuratedProfileMaterializeOptions,
  type CuratedProfileName,
} from '@deepseek-ai/dsh-curated-profiles'
import type { Profile } from '@deepseek-ai/dsh-app-boot'
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
 * @param options - Existing user-layer validation options.
 */
export function ensureCuratedProfile(name: string, options: CuratedProfileMaterializeOptions = {}): void {
  if (isCuratedProfileName(name)) materializeCuratedProfile(name, resolveDshHome(), options)
}

/**
 * Materialize a built-in curated profile and retain its descriptor-bound files for loading.
 * @param name - Profile name from the CLI.
 * @param options - Existing user-layer validation options.
 * @returns retained managed files for a curated profile, otherwise `undefined`.
 */
export function prepareCuratedProfileFiles(
  name: string,
  options: CuratedProfileMaterializeOptions = {},
): CuratedProfileFileSnapshot | undefined {
  return isCuratedProfileName(name)
    ? materializeCuratedProfileForLoad(name, resolveDshHome(), options)
    : undefined
}

/**
 * Apply mandatory curated admission to a loaded profile and its user layers.
 * @param name - Profile name from the CLI.
 * @param profile - Installation-first resolved profile.
 * @param additionalUserLayers - Home and command-line layers above the profile patch.
 * @param options - User-layer admission options.
 * @param profileFiles - Descriptor-bound bytes used to load the curated profile.
 */
export function admitCuratedProfile(
  name: string,
  profile: Profile,
  additionalUserLayers: ReadonlyArray<ReadonlyArray<Profile['patches'][number]>> = [],
  options: CuratedProfileMaterializeOptions = {},
  profileFiles?: CuratedProfileFileSnapshot,
): void {
  if (isCuratedProfileName(name)) {
    assertCuratedProfileAdmission(name, resolveDshHome(), profile, additionalUserLayers, {
      ...options,
      ...profileFiles === undefined ? {} : { profileFiles },
    })
  }
}

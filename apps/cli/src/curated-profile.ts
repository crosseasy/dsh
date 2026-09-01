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
import { acquireCuratedProfilePreparationLock } from './curated-profile-lock.ts'

function normalizeError(error: unknown, message: string): Error {
  /* v8 ignore next -- profile and filesystem operations throw Error instances. */
  return error instanceof Error ? error : new Error(message, { cause: error })
}

/**
 * Test whether a profile name is owned by the curated profile package.
 * @param name - Profile name from the CLI.
 * @returns true when the profile has a built-in curated template.
 */
export function isCuratedProfileName(name: string): name is CuratedProfileName {
  return Object.hasOwn(CURATED_PROFILE_TEMPLATES, name)
}

/**
 * Materialize a built-in curated profile while holding its installation lock.
 * @param name - Profile name from the CLI.
 * @param options - Existing user-layer validation options.
 * @throws when lock acquisition, interrupted-install recovery, materialization,
 * filesystem validation, or lock release fails.
 */
export function ensureCuratedProfile(name: string, options: CuratedProfileMaterializeOptions = {}): void {
  if (!isCuratedProfileName(name)) return
  const home = resolveDshHome()
  const lock = acquireCuratedProfilePreparationLock(name, home)
  try {
    materializeCuratedProfile(name, home, options)
  } catch (error) {
    const failure = normalizeError(error, `${name} profile materialization failed`)
    /* v8 ignore start -- requires same-permission interference with the lock
       while materialization is already failing. */
    try {
      lock.release()
    } catch (releaseError) {
      throw new AggregateError(
        [failure, releaseError],
        `${failure.message}; `
        + `${name} profile ownership release also failed`,
        { cause: failure },
      )
    }
    /* v8 ignore stop */
    throw failure
  }
  lock.release()
}

/**
 * Materialize a built-in curated profile and retain both its installation lock
 * and descriptor-bound files for loading.
 * @param name - Profile name from the CLI.
 * @param options - Existing user-layer validation options.
 * @returns retained managed files for a curated profile, otherwise `undefined`;
 * callers must invoke `close()` to release the descriptors and exclusive
 * profile lock.
 * @throws when lock acquisition, interrupted-install recovery, materialization,
 * filesystem validation, snapshot close, or lock release fails.
 */
export function prepareCuratedProfileFiles(
  name: string,
  options: CuratedProfileMaterializeOptions = {},
): CuratedProfileFileSnapshot | undefined {
  if (!isCuratedProfileName(name)) return undefined
  const home = resolveDshHome()
  const lock = acquireCuratedProfilePreparationLock(name, home)
  let snapshot: CuratedProfileFileSnapshot
  try {
    snapshot = materializeCuratedProfileForLoad(name, home, options)
  } catch (error) {
    const failure = normalizeError(error, `${name} profile preparation failed`)
    try {
      lock.release()
    } catch (releaseError) {
      throw new AggregateError(
        [failure, releaseError],
        `${failure.message}; `
        + `${name} profile ownership release also failed`,
        { cause: failure },
      )
    }
    throw failure
  }
  let closed = false
  return {
    ...snapshot,
    close: () => {
      if (closed) return
      closed = true
      let failure: Error | undefined
      /* v8 ignore start -- closeSync failures require injected descriptor faults. */
      try {
        snapshot.close()
      } catch (error) {
        failure = normalizeError(error, `${name} managed profile snapshot close failed`)
      }
      /* v8 ignore stop */
      try {
        lock.release()
      } catch (releaseError) {
        /* v8 ignore else -- the alternative requires simultaneous descriptor-close
           and same-permission lock-release failures. */
        if (failure === undefined) throw releaseError
        /* v8 ignore next 6 -- requires simultaneous descriptor-close and
           same-permission lock-release failures. */
        throw new AggregateError(
          [failure, releaseError],
          `${failure.message}; `
          + `${name} profile ownership release also failed`,
          { cause: failure },
        )
      }
      /* v8 ignore next -- descriptor-close failures require injected faults. */
      if (failure !== undefined) throw failure
    },
  }
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

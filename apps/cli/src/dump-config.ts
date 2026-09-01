/**
 * Config-dump entry for `dsh --profile <name> --dump-config`: compose the
 * profile's patch layers through the include plugin's patch algorithm without
 * booting or evaluating `!!js`, with one source layer per bundle, the
 * profile's own patch file, and each `--patch` overlay.
 * @module @deepseek-ai/dsh/dump-config
 */

import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  loadOptionalPatches,
  loadOverlayPatches,
  renderConfigDump,
  type ConfigDumpLayer,
} from '@deepseek-ai/dsh-app-boot'
import { isCuratedProfileName } from './curated-profile.ts'
import { homePatchPath, prepareProfileForUse, PROFILE_ROOT_FILENAME } from './profile-boot.ts'

const NAME = 'dsh'

/**
 * Print a profile composition with comments naming each source file and patch layer.
 * @param profile - the profile name.
 * @param defaultOnly - omit user layers from output. Curated profile patches
 * are still parsed and admitted; ordinary profile patches remain unread.
 * @param patches - `--patch` overlay paths, in argv order.
 */
export function runDumpConfig(profile: string, defaultOnly: boolean, patches: readonly string[]): void {
  const admitProfilePatch = !defaultOnly || isCuratedProfileName(profile)
  const homePatchFile = homePatchPath()
  const homePatches = defaultOnly ? undefined : loadOptionalPatches(NAME, homePatchFile)
  const overlayLayers = defaultOnly
    ? []
    : patches.map((file) => {
      const absolute = resolve(file)
      return { absolute, patches: loadOverlayPatches(NAME, absolute) }
    })
  const prepared = prepareProfileForUse(profile, {
    userLayer: admitProfilePatch,
    additionalUserLayers: [
      ...homePatches === undefined ? [] : [homePatches],
      ...overlayLayers.map(layer => layer.patches),
    ],
  })
  try {
    const loaded = prepared.profile
    const layers: ConfigDumpLayer[] = loaded.layers.map(layer => ({
      label: layer.packageName,
      patches: layer.patches,
    }))
    if (!defaultOnly) {
      if (existsSync(loaded.patchPath)) {
        layers.push({ label: loaded.patchPath, patches: loaded.patches })
      }
      if (homePatches !== undefined) {
        layers.push({ label: homePatchFile, patches: homePatches })
      }
      for (const layer of overlayLayers) {
        layers.push({ label: layer.absolute, patches: layer.patches })
      }
    }
    // The dump anchors on the same empty root file the boot includes.
    process.stdout.write(renderConfigDump(
      NAME,
      join(loaded.dir, PROFILE_ROOT_FILENAME),
      layers,
      undefined,
      prepared.root,
    ))
  } finally {
    prepared.close()
  }
}

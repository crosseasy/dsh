/**
 * The fusion package must resolve its empty patch through the same profile and
 * Loader path used by a real dsh launch.
 */

import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  boot,
  initProfile,
  loadProfile,
  resolveProfileDir,
} from '@deepseek-ai/dsh-app-boot'
import { afterEach, describe, expect, it } from 'vitest'

const PACKAGE_NAME = '@deepseek-ai/dsh-fusion'
const PROFILE_DEPENDENCIES = {}
const BLOCKED_PACKAGES = [
  '@liustack/modlens',
  '@linxin666/dsh-ssh',
  '@linxin666/dsh-remote-web-ui',
  '@linxin666/dsh-client-ui-task-board',
  '@linxin666/dsh-pet',
  '@linxin666/dsh-client-ui-git-graph',
  '@linxin666/dsh-client-ui-skin-center',
  'dsh-better-sidebar',
] as const
const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('dsh-fusion bundle', () => {
  it('loads its zero-row patch through profile composition and the Loader', async () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(
      readFileSync(resolve(packageRoot, 'package.json'), 'utf8'),
    ) as {
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      dsh?: {
        bundle?: {
          patch?: string
          profileDependencies?: Record<string, string>
        }
      }
    }

    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh?.bundle?.profileDependencies).toEqual(PROFILE_DEPENDENCIES)
    expect(manifest.dependencies).toBeUndefined()
    expect(manifest.optionalDependencies).toBeUndefined()
    expect(manifest.peerDependencies).toEqual({
      '@deepseek-ai/dsh-invariants': 'workspace:^',
      '@deepseek-ai/cordis': 'workspace:^',
    })
    expect(manifest.devDependencies).toEqual({
      '@deepseek-ai/dsh-app-boot': 'workspace:^',
      '@deepseek-ai/dsh-invariants': 'workspace:^',
      '@deepseek-ai/cordis': 'workspace:^',
    })
    for (const packageName of Object.keys(PROFILE_DEPENDENCIES)) {
      expect(manifest.dependencies ?? {}).not.toHaveProperty(packageName)
      expect(manifest.optionalDependencies ?? {}).not.toHaveProperty(packageName)
      expect(manifest.peerDependencies ?? {}).not.toHaveProperty(packageName)
      expect(manifest.devDependencies ?? {}).not.toHaveProperty(packageName)
    }

    const temporaryRoot = mkdtempSync(join(tmpdir(), 'dsh-fusion-'))
    temporaryDirectories.push(temporaryRoot)
    const appDirectory = join(temporaryRoot, 'app')
    const appManifest = join(appDirectory, 'package.json')
    const home = join(temporaryRoot, 'home')
    const profileDirectory = resolveProfileDir('fusion-test', home)
    mkdirSync(appDirectory, { recursive: true })
    writeFileSync(appManifest, '{"name":"fusion-test-app","private":true}\n')
    initProfile(profileDirectory, [PACKAGE_NAME])
    writeFileSync(join(profileDirectory, 'cordis.patch.yml'), '[]\n')

    const packageLink = join(profileDirectory, 'node_modules', PACKAGE_NAME)
    mkdirSync(dirname(packageLink), { recursive: true })
    symlinkSync(packageRoot, packageLink, 'junction')

    const profile = loadProfile('fusion-test', 'fusion-test', appManifest, home)
    expect(profile.layers).toHaveLength(1)
    const [layer] = profile.layers
    if (layer === undefined) throw new Error('fusion profile must resolve one bundle layer')
    expect(layer.packageName).toBe(PACKAGE_NAME)
    expect(realpathSync(layer.patchPath)).toBe(resolve(packageRoot, 'cordis.patch.yml'))
    const rows = layer.patches.flatMap((patch): Array<{ id?: string; name?: string }> =>
      typeof patch === 'object' && patch !== null
        ? (patch as { insert?: Array<{ id?: string; name?: string }> }).insert ?? []
        : [],
    )
    expect(rows).toEqual([])
    const serializedRows = JSON.stringify(rows)
    for (const forbidden of [
      ...BLOCKED_PACKAGES,
      'ui-task-board',
      'pet',
      'ui-git-graph',
      'skin-center',
      'better-sidebar',
      'web-ui-all',
      'describe-image',
      'aionui',
      'liangshen',
    ]) {
      expect(serializedRows).not.toContain(forbidden)
    }

    const rootConfig = join(temporaryRoot, 'cordis.yml')
    writeFileSync(rootConfig, '[]\n')
    const patches = [
      ...profile.layers.flatMap(layer => layer.patches),
      ...profile.patches,
    ]
    const context = await boot('fusion-test', rootConfig, patches)
    try {
      expect(context.get('loader')).toBeDefined()
    } finally {
      await context.fiber.dispose()
    }
  })
})

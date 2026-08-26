import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readProfileManifest, resolveProfileDir } from '@deepseek-ai/dsh-app-boot'
import { CURATED_PROFILE_TEMPLATES } from '@deepseek-ai/dsh-curated-profiles'
import { load as loadYaml } from 'js-yaml'
import { ensureCuratedProfile, isCuratedProfileName } from '../src/curated-profile.ts'
import { prepareProfile } from '../src/profile-boot.ts'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'dsh-cli-curated-profile-'))
const previousHome = process.env.DSH_HOME

function stageProfileDependencies(profileDir: string, dependencies: Readonly<Record<string, string>>): void {
  for (const packageName of Object.keys(dependencies)) {
    const packageDir = join(profileDir, 'node_modules', packageName)
    mkdirSync(packageDir, { recursive: true })
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({
      name: packageName,
      version: '0.0.0',
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    }))
    writeFileSync(join(packageDir, 'cordis.patch.yml'), '[]\n')
  }
}

afterEach(() => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
})

describe('curated profile launcher bridge', () => {
  it('recognizes only curated profile template names', () => {
    expect(isCuratedProfileName('web-curated')).toBe(true)
    expect(isCuratedProfileName('web-coding')).toBe(true)
    expect(isCuratedProfileName('web')).toBe(false)
    expect(isCuratedProfileName('custom')).toBe(false)
  })

  it('materializes a curated profile in DSH_HOME without touching shipped profiles', () => {
    const home = tmp()
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-enterprise')

      const dir = resolveProfileDir('web-enterprise', home)
      const manifest = readProfileManifest('dsh', dir)
      expect(manifest.dsh?.profile?.bundles).toEqual(CURATED_PROFILE_TEMPLATES['web-enterprise'].bundles)
      expect(loadYaml(readFileSync(join(dir, 'cordis.patch.yml'), 'utf8'))).toEqual([
        {
          id: 'memento',
          config: {
            writePolicy: 'ask',
            writePolicies: {},
            proposals: { enabled: false, maxChars: 2000, maxPending: 8 },
          },
        },
        {
          id: 'permission-rules',
          config: {
            rulesFile: '.dsh/rules.yaml',
            badFilePolicy: 'fail',
            maxRules: 256,
            patternMode: 'glob',
            watch: true,
            enforce: true,
          },
        },
        {
          id: 'loongsuite-observability',
          config: { captureContent: false },
        },
      ])
      expect(readFileSync(join(dir, '.npmrc'), 'utf8')).toBe('ignore-scripts=true\n')
      expect(existsSync(resolveProfileDir('web', home))).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('loads a materialized profile through the CLI profile preparation path', () => {
    const home = tmp()
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-research')
      const profileDir = resolveProfileDir('web-research', home)
      const manifest = readProfileManifest('dsh', profileDir)
      stageProfileDependencies(profileDir, manifest.dependencies ?? {})

      const profile = prepareProfile('web-research', false)

      expect(profile.layers.map(layer => layer.packageName)).toEqual(manifest.dsh?.profile?.bundles)
      expect(profile.patches).toEqual([])
      expect(existsSync(resolveProfileDir('web', home))).toBe(false)
      expect(existsSync(resolveProfileDir('headless', home))).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('does not create a custom profile', () => {
    const home = tmp()
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('custom')
      expect(existsSync(resolveProfileDir('custom', home))).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})

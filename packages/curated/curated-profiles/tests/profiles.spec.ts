import { existsSync, fstatSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  initProfile,
  PROFILE_PATCH_FILENAME,
  PROFILE_TEMPLATES,
  readProfileManifest,
  resolveProfileDir,
  type Profile,
} from '@deepseek-ai/dsh-app-boot'
import {
  assertCuratedProfileAdmission,
  CURATED_BASELINE_BUNDLES,
  CURATED_PROFILE_TEMPLATES,
  curatedProfileDependenciesForBundles,
  materializeCuratedProfile,
  materializeCuratedProfileForLoad,
  type CuratedProfileManifest,
  type CuratedProfileName,
} from '../src/index.ts'
import { CuratedPolicy, loadCuratedCatalog } from '@deepseek-ai/dsh-curated-policy'
import { load as loadYaml } from 'js-yaml'
import * as curatedProfilesInvariant from '../src/invariant.ts'
import { bootCuratedBehaviorProfile } from './fixtures/behavior-profile.ts'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'dsh-curated-profiles-'))

afterEach(() => {
  vi.doUnmock('../src/index.ts')
  vi.doUnmock('@deepseek-ai/dsh-curated-policy')
  vi.doUnmock('node:fs')
  vi.resetModules()
})

const base = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-curated-base'] as const
const profileNames = [
  'web-curated',
  'web-coding',
  'web-research',
  'web-enterprise',
  'web-personal',
] as const satisfies readonly CuratedProfileName[]
const plannedBaselineIds = [
  'dsh-toolkit',
  'dsh-web-search-pro',
  'dsh-context',
  'dsh-memento',
  'dsh-mcp-panel',
  'dsh-smooth-stream',
  'dsh-checkpoint-rewind',
  'dsh-lsp-actions',
  'dsh-permission-rules',
  'upstream-radar',
  'loongsuite-dsh-plugin',
  'dsh-config-manager',
] as const
const fullSha = '0123456789abcdef0123456789abcdef01234567'
const curatedPackageNames = ['base', 'bench', 'policy', 'profiles', 'scripts'] as const
const activationEvidenceFileFields = [
  'keylessAssembledSnapshot',
  'install',
  'enable',
  'restart',
  'disableOrUninstall',
] as const
const managedProfileFiles = ['package.json', PROFILE_PATCH_FILENAME, 'pnpm-workspace.yaml', '.npmrc'] as const

function completeActivationEvidence(requiredRuntimeBundles: readonly string[] = []): Record<string, unknown> {
  return {
    keylessAssembledSnapshot: {
      path: 'evidence/assembled.json',
      sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
    requiredRuntimeBundles,
    install: {
      path: 'evidence/install.json',
      sha256: '123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0',
    },
    enable: {
      path: 'evidence/enable.json',
      sha256: '23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01',
    },
    restart: {
      path: 'evidence/restart.json',
      sha256: '3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012',
    },
    disableOrUninstall: {
      path: 'evidence/disable.json',
      sha256: '456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123',
    },
  }
}

function activationEvidenceWithReference(
  field: typeof activationEvidenceFileFields[number],
  replacement: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...completeActivationEvidence(),
    [field]: replacement,
  }
}

function dependencyCatalog(candidates: string): string {
  return `schemaVersion: 1
source:
  awesome:
    repository: https://github.com/example/awesome
    commit: "${fullSha}"
    file: README.md
  matrix: docs/plugin/superpowers/02-插件矩阵与择优.md
candidates:
${candidates}`
}

async function withMockedDependencyCatalog(catalog: string): Promise<typeof import('../src/index.ts')> {
  const checkedInCatalog = loadCuratedCatalog()
  vi.resetModules()
  vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
    const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
      '@deepseek-ai/dsh-curated-policy',
    )
    return {
      ...actual,
      loadCuratedCatalog: (filePath?: string) =>
        filePath === undefined ? checkedInCatalog : actual.loadCuratedCatalog(filePath),
    }
  })
  vi.doMock('node:fs', async () => {
    const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
    const mockedReadFileSync = ((path: Parameters<typeof readFileSync>[0], options?: Parameters<typeof readFileSync>[1]) => {
      if (String(path).endsWith('plugin-allowlist.yaml')) return catalog
      return options === undefined ? actual.readFileSync(path) : actual.readFileSync(path, options)
    }) as typeof readFileSync
    return { ...actual, readFileSync: mockedReadFileSync }
  })
  return import('../src/index.ts')
}

async function withSyntheticEnterpriseCandidate(
  id: string,
  overrides: Record<string, unknown> = {},
): Promise<typeof import('../src/index.ts')> {
  const catalog = loadCuratedCatalog()
  return withMockedDependencyCatalog(JSON.stringify({
    ...catalog,
    candidates: catalog.candidates.map(candidate => candidate.id === id
      ? {
        ...candidate,
        expectedPackage: '@deepseek-ai/dsh-base',
        targetProfiles: ['web-enterprise'],
        active: true,
        rejections: [],
        ...overrides,
      }
      : candidate),
  }))
}

describe('curated profile templates', () => {
  it('keeps every curated package publicly publishable with its runtime payload', () => {
    for (const packageName of curatedPackageNames) {
      const manifestPath = fileURLToPath(new URL(`../../curated-${packageName}/package.json`, import.meta.url))
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        bin?: Record<string, string>
        exports?: Record<string, string | { default?: string; types?: string }>
        private?: boolean
        publishConfig?: { access?: string }
        files?: string[]
      }
      expect(manifest.private, packageName).not.toBe(true)
      expect(manifest.publishConfig?.access, packageName).toBe('public')
      expect(manifest.exports?.['.'], packageName).toEqual({
        types: './lib/types/index.d.ts',
        default: './lib/index.js',
      })
      expect(manifest.exports?.['./invariant'], packageName).toEqual({
        types: './lib/types/invariant.d.ts',
        default: './lib/invariant.js',
      })
      expect(manifest.exports, packageName).not.toHaveProperty('./src/*')
      expect(manifest.files, packageName).toContain('lib/index.js')
      expect(manifest.files, packageName).toContain('lib/types/**/*.d.ts')
      if (packageName === 'base') {
        expect(manifest.exports?.['./cordis.patch.yml']).toBe('./cordis.patch.yml')
        expect(manifest.files).toContain('cordis.patch.yml')
      } else if (packageName === 'bench') {
        expect(manifest.exports?.['./snapshot']).toEqual({
          types: './lib/types/snapshot.d.ts',
          default: './lib/types/snapshot.js',
        })
        expect(manifest.files).toEqual(expect.arrayContaining([
          'manifests/**/*.json',
          'tasks/**/*.json',
          'baselines/**/*.json',
          'lib/types/**/*.js',
        ]))
      } else if (packageName === 'policy') {
        expect(manifest.files).toEqual(expect.arrayContaining([
          'policy/plugin-allowlist.yaml',
          'policy/capability-conflicts.yaml',
          'policy/permission-rules.yaml',
        ]))
      } else if (packageName === 'scripts') {
        expect(manifest.bin).toEqual({
          'dsh-curated-verify-lock': 'lib/verify-lock.js',
          'dsh-curated-preflight': 'lib/preflight.js',
          'dsh-curated-smoke-profile': 'lib/smoke-profile.js',
          'dsh-curated-compare-benchmark': 'lib/compare-benchmark.js',
        })
        expect(manifest.files).toEqual(expect.arrayContaining([
          'lib/verify-lock.js',
          'lib/preflight.js',
          'lib/smoke-profile.js',
          'lib/compare-benchmark.js',
          'lib/bin.js',
        ]))
        expect(manifest.files).not.toEqual(expect.arrayContaining([
          'preflight.mjs',
          'verify-lock.mjs',
          'smoke-profile.mjs',
          'compare-benchmark.mjs',
        ]))
      }
    }
  })

  it('materializes each profile from its active verified catalog candidates', () => {
    const policy = new CuratedPolicy(loadCuratedCatalog())
    const catalog = policy.listCandidates()

    for (const profileName of profileNames) {
      const candidates = policy.getProfileCandidates(profileName)
      const candidateBundles = candidates.map(candidate => candidate.expectedPackage ?? candidate.id)
      const dir = materializeCuratedProfile(profileName, tmp())
      const manifest = readProfileManifest('t', dir)

      expect(candidateBundles, profileName).toEqual([])
      expect(manifest.dsh?.profile?.bundles).toEqual([...base])
      expect(manifest.dependencies).toEqual({})
      for (const candidate of candidates) {
        expect(candidate).toMatchObject({
          active: true,
          sourceStatus: 'verified',
          rejections: [],
        })
      }
    }

    const plannedBaseline = catalog.filter(candidate =>
      plannedBaselineIds.includes(candidate.id as typeof plannedBaselineIds[number]))
    expect(plannedBaseline.map(candidate => candidate.id)).toHaveLength(12)
    expect(plannedBaseline.filter(candidate => candidate.active).map(candidate => candidate.id)).toEqual([])
    expect(plannedBaseline.filter(candidate => !candidate.active).every(candidate =>
      candidate.rejections.length > 0)).toBe(true)
  })

  it('keeps all five runnable templates free of unverified third-party bundles', () => {
    expect(CURATED_BASELINE_BUNDLES).toEqual([])
    for (const profileName of profileNames) {
      expect(CURATED_PROFILE_TEMPLATES[profileName].bundles, profileName).toEqual(base)
    }
  })

  it('writes only supported candidate config and keeps an explicit empty patch when none is required', () => {
    const curatedDir = materializeCuratedProfile('web-curated', tmp())
    const patch = loadYaml(readFileSync(join(curatedDir, PROFILE_PATCH_FILENAME), 'utf8'))

    expect(patch).toEqual([])

    const personalDir = materializeCuratedProfile('web-personal', tmp())
    expect(readFileSync(join(personalDir, PROFILE_PATCH_FILENAME), 'utf8')).toBe('[]\n')
  })

  it('keeps personal isolated and excludes conflicting scenario providers', () => {
    const policy = new CuratedPolicy(loadCuratedCatalog())
    const personal = materializeCuratedProfile('web-personal', tmp())
    const research = materializeCuratedProfile('web-research', tmp())
    const coding = materializeCuratedProfile('web-coding', tmp())

    expect(readProfileManifest('t', personal).dsh?.profile?.bundles).toEqual([...base])

    const researchCandidates = policy.getProfileCandidates('web-research')
    expect(researchCandidates.filter(candidate => candidate.capability === 'memory').map(candidate => candidate.id))
      .toEqual([])
    expect(readProfileManifest('t', research).dsh?.profile?.bundles).toEqual(
      [...base, ...CURATED_BASELINE_BUNDLES],
    )
    expect(readProfileManifest('t', research).dsh?.profile?.bundles).not.toEqual(
      expect.arrayContaining(['dsh-mneme']),
    )
    expect(readProfileManifest('t', research).dsh?.profile?.bundles)
      .not.toContain('@dsh-suite/plugin-session-export')

    const codingCandidates = policy.getProfileCandidates('web-coding')
    expect(codingCandidates.filter(candidate => candidate.capability === 'multi-agent-orchestration'))
      .toHaveLength(0)
    expect(readProfileManifest('t', coding).dsh?.profile?.bundles).not.toEqual(
      expect.arrayContaining(['dsh-agent-team-gui', 'dsh-background-agents']),
    )
  })

  it('registers the curated profile invariant without installing runtime checks', async () => {
    type InstalledInvariant = (ctx: unknown, fail: (message: string) => void) => void
    const disposer = () => {}
    const registered: { install?: InstalledInvariant; packageName?: string } = {}
    const ctx = {
      invariants: {
        register(packageName: string, install: InstalledInvariant) {
          registered.packageName = packageName
          registered.install = install
          return disposer
        },
      },
    }

    await expect(curatedProfilesInvariant.apply(ctx as Parameters<typeof curatedProfilesInvariant.apply>[0]))
      .resolves.toBe(disposer)
    expect(curatedProfilesInvariant.name).toBe('curated-profiles-invariant')
    expect(curatedProfilesInvariant.inject).toEqual(['invariants'])
    expect(registered.packageName).toBe('@deepseek-ai/dsh-curated-profiles')

    const messages: string[] = []
    registered.install?.(ctx, message => messages.push(message))
    expect(messages).toEqual([])
  })

  it('does not import profile templates when the invariant installer runs', async () => {
    vi.resetModules()
    vi.doMock('../src/index.ts', () => {
      throw new Error('runtime invariant imported static profile data')
    })
    const mockedInvariant = await import('../src/invariant.ts')
    type InstalledInvariant = (ctx: unknown, fail: (message: string) => void) => void
    const registered: { install?: InstalledInvariant } = {}
    const ctx = {
      invariants: {
        register(_packageName: string, install: InstalledInvariant) {
          registered.install = install
          return () => {}
        },
      },
    }

    await mockedInvariant.apply(ctx as Parameters<typeof mockedInvariant.apply>[0])

    const messages: string[] = []
    expect(() => registered.install?.(ctx, message => messages.push(message))).not.toThrow()
    expect(messages).toEqual([])
  })
})

describe('materializeCuratedProfile', () => {
  it('writes a profile manifest, consumed config patch, pnpm workspace, and npmrc', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-enterprise', home)

    expect(dir).toBe(resolveProfileDir('web-enterprise', home))
    const manifest = readProfileManifest('t', dir) as CuratedProfileManifest
    expect(manifest.dsh?.profile?.bundles).toEqual(CURATED_PROFILE_TEMPLATES['web-enterprise'].bundles)
    expect(manifest.dsh?.profile).not.toHaveProperty('policy')
    const patch = readFileSync(join(dir, PROFILE_PATCH_FILENAME), 'utf8')
    expect(loadYaml(patch)).toEqual([])
    expect(patch).not.toContain('enterprise:')
    expect(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')).toContain('nodeLinker: hoisted')
    expect(readFileSync(join(dir, '.npmrc'), 'utf8')).toBe('ignore-scripts=true\n')
  })

  it('uses no third-party dependencies or build allowances in any profile', () => {
    const home = tmp()
    for (const profileName of profileNames) {
      const dir = materializeCuratedProfile(profileName, home)
      const workspace = loadYaml(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')) as {
        allowBuilds?: Record<string, boolean>
        dangerouslyAllowAllBuilds?: boolean
        packageExtensions?: unknown
        patchedDependencies?: unknown
      }

      expect(readFileSync(join(dir, '.npmrc'), 'utf8'), profileName).toBe('ignore-scripts=true\n')
      expect(workspace, profileName).not.toHaveProperty('allowBuilds')
      expect(workspace, profileName).not.toHaveProperty('dangerouslyAllowAllBuilds')
      expect(workspace, profileName).not.toHaveProperty('packageExtensions')
      expect(workspace, profileName).not.toHaveProperty('patchedDependencies')
    }

    expect(readProfileManifest('t', resolveProfileDir('web-curated', home)).dependencies).toEqual({})
    expect(readProfileManifest('t', resolveProfileDir('web-enterprise', home)).dsh?.profile?.bundles).toEqual([
      ...base,
      ...CURATED_BASELINE_BUNDLES,
    ])
  })

  it('rejects a synthetic admitted Git candidate that requires a lifecycle build', async () => {
    const profiles = await withSyntheticEnterpriseCandidate('dsh-memento', {
      installScripts: { prepare: 'pnpm run build' },
    })

    expect(() => profiles.materializeCuratedProfile('web-enterprise', tmp())).toThrow(
      'web-enterprise cannot include active dependencies that require lifecycle builds',
    )
  })

  it.each([
    ['dsh-memento', (patch: Array<{ id?: string; config?: Record<string, unknown> }>) =>
      patch.map(entry => entry.id === 'memento'
        ? { ...entry, config: { ...entry.config, writePolicy: 'auto' } }
        : entry)],
    ['dsh-memento', (patch: Array<{ id?: string; config?: Record<string, unknown> }>) =>
      patch.filter(entry => entry.id !== 'memento')],
    ['loongsuite-dsh-plugin', (patch: Array<{ id?: string; config?: Record<string, unknown> }>) =>
      patch.map(entry => entry.id === 'loongsuite-observability'
        ? { ...entry, config: { captureContent: true } }
        : entry)],
    ['dsh-permission-rules', (patch: Array<{ id?: string; disabled?: boolean; config?: Record<string, unknown> }>) =>
      patch.map(entry => entry.id === 'permission-rules'
        ? { ...entry, disabled: true }
        : entry)],
  ])('keeps %s safety checks available for future admission', async (candidateId, makeUnsafe) => {
    const profiles = await withSyntheticEnterpriseCandidate(candidateId)
    const home = tmp()
    const dir = profiles.materializeCuratedProfile('web-enterprise', home)
    const patchPath = join(dir, PROFILE_PATCH_FILENAME)
    const patch = loadYaml(readFileSync(patchPath, 'utf8')) as Array<{
      id?: string
      disabled?: boolean
      config?: Record<string, unknown>
    }>
    writeFileSync(patchPath, `${JSON.stringify(makeUnsafe(patch), null, 2)}\n`)

    expect(() => profiles.materializeCuratedProfile('web-enterprise', home)).toThrow(
      'web-enterprise existing patch violates curated policy',
    )
  })

  it('rejects duplicate rows for a synthetic future enterprise candidate', async () => {
    const profiles = await withSyntheticEnterpriseCandidate('dsh-memento')
    const home = tmp()
    const dir = profiles.materializeCuratedProfile('web-enterprise', home)
    const patchPath = join(dir, PROFILE_PATCH_FILENAME)
    const patch = loadYaml(readFileSync(patchPath, 'utf8')) as Array<{
      id?: string
      config?: Record<string, unknown>
    }>
    writeFileSync(patchPath, `${JSON.stringify([
      ...patch,
      {
        insert: [{
          id: 'memento-copy',
          name: '@deepseek-ai/dsh-base',
          config: {},
        }],
      },
    ], null, 2)}\n`)

    expect(() => profiles.materializeCuratedProfile('web-enterprise', home)).toThrow(
      'web-enterprise existing patch violates curated policy',
    )
  })

  it('accepts a synthetic candidate without resources or required config', async () => {
    const profiles = await withSyntheticEnterpriseCandidate('dsh-memento', {
      resources: undefined,
      config: undefined,
    })
    const home = tmp()

    profiles.materializeCuratedProfile('web-enterprise', home)
    expect(() => profiles.materializeCuratedProfile('web-enterprise', home)).not.toThrow()
  })

  it.each([
    { overrides: { resources: undefined }, accepted: true },
    { overrides: { config: undefined }, accepted: false },
  ])('handles each synthetic candidate metadata fallback independently', async ({ overrides, accepted }) => {
    const profiles = await withSyntheticEnterpriseCandidate('dsh-memento', overrides)
    const home = tmp()

    profiles.materializeCuratedProfile('web-enterprise', home)
    if (accepted) {
      expect(() => profiles.materializeCuratedProfile('web-enterprise', home)).not.toThrow()
    } else {
      expect(() => profiles.materializeCuratedProfile('web-enterprise', home)).toThrow(
        'web-enterprise existing patch violates curated policy',
      )
    }
  })

  it('accepts safe nested installation-owned rows for a synthetic candidate', async () => {
    const profiles = await withSyntheticEnterpriseCandidate('dsh-memento')
    const home = tmp()
    const dir = profiles.materializeCuratedProfile('web-enterprise', home)
    const patchPath = join(dir, PROFILE_PATCH_FILENAME)
    const patch = loadYaml(readFileSync(patchPath, 'utf8')) as unknown[]
    writeFileSync(patchPath, `${JSON.stringify([
      ...patch,
      {
        insert: [{
          id: 'safe-group',
          name: '@deepseek-ai/cordis-plugin-group',
          group: true,
          config: [{ id: 'safe-child', name: '@deepseek-ai/dsh-web-app', config: {} }],
        }],
      },
    ], null, 2)}\n`)

    expect(() => profiles.materializeCuratedProfile('web-enterprise', home)).not.toThrow()
  })

  it('finds a configured row after another row from the same synthetic candidate', async () => {
    const profiles = await withSyntheticEnterpriseCandidate('dsh-memento', {
      resources: { entryIds: ['memento-other', 'memento'] },
    })

    const home = tmp()
    profiles.materializeCuratedProfile('web-enterprise', home)
    expect(() => profiles.materializeCuratedProfile('web-enterprise', home)).not.toThrow()
  })

  it('accepts an explicitly enabled synthetic permission candidate', async () => {
    const profiles = await withSyntheticEnterpriseCandidate('dsh-permission-rules')
    const home = tmp()
    const dir = profiles.materializeCuratedProfile('web-enterprise', home)
    const patchPath = join(dir, PROFILE_PATCH_FILENAME)
    const patch = readFileSync(patchPath, 'utf8')
      .replace('- id: permission-rules\n', '- id: permission-rules\n  disabled: false\n')
    writeFileSync(patchPath, patch)

    expect(() => profiles.materializeCuratedProfile('web-enterprise', home)).not.toThrow()
  })

  it('writes no install dependencies without runtime-admitted bundle layers', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-research', home)
    const manifest = readProfileManifest('t', dir) as CuratedProfileManifest
    const dependencies = manifest.dependencies ?? {}

    expect(Object.keys(dependencies)).toEqual(
      CURATED_PROFILE_TEMPLATES['web-research'].bundles.filter(bundle =>
        bundle !== '@deepseek-ai/dsh-base'
        && bundle !== '@deepseek-ai/dsh-web-app'
        && bundle !== '@deepseek-ai/dsh-curated-base',
      ),
    )
    expect(dependencies).toEqual({})
    expect(dependencies).not.toHaveProperty('@deepseek-ai/dsh-toolkit')
    expect(dependencies).not.toHaveProperty('dsh-smooth-stream')
    expect(dependencies).not.toHaveProperty('dsh-permission-rules')
    expect(dependencies).not.toHaveProperty('upstream-radar')
    expect(dependencies).not.toHaveProperty('@dsh-suite/plugin-session-export')
    expect(dependencies).not.toHaveProperty('@deepseek-ai/dsh-base')
    expect(dependencies).not.toHaveProperty('@deepseek-ai/dsh-web-app')
    expect(dependencies).not.toHaveProperty('@deepseek-ai/dsh-curated-base')
    expect(Object.values(dependencies)).not.toContain('latest')
  })

  it('treats all shipped profile bundles as installation-owned dependencies', () => {
    expect(curatedProfileDependenciesForBundles([
      '@deepseek-ai/dsh-base',
      '@deepseek-ai/dsh-web-app',
      '@deepseek-ai/dsh-headless',
      '@deepseek-ai/dsh-curated-base',
    ], 'web-curated')).toEqual({})
  })

  it('rejects bundles without a checked-in dependency source', () => {
    expect(() => curatedProfileDependenciesForBundles(['missing-bundle'], 'web-curated')).toThrow(
      'curated profile bundle "missing-bundle" has no checked-in dependency source',
    )
  })

  it('builds dependency specs from checked-in allowlist records', async () => {
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - id: ignored
    expectedPackage: null
    active: false
    rejections: [{code: not-installable}]
    targetProfiles: []
  - expectedPackage: plugin-a
    repository: https://github.com/example/plugin-a.git
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    runtimeActivationEvidence: ${JSON.stringify({ 'web-curated': completeActivationEvidence() })}
  - expectedPackage: plugin-b
    repository: https://github.com/example/plugin-b
    repositoryPath: packages/plugin-b
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    runtimeActivationEvidence: ${JSON.stringify({ 'web-curated': completeActivationEvidence() })}
  - expectedPackage: plugin-c
    repository: https://github.com/example/plugin-c
    repositoryPath: null
    commit: "${fullSha}"
    npmVersion: 1.2.3
    npmIntegrity: sha512-Zml4dHVyZQ==
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    runtimeActivationEvidence: ${JSON.stringify({ 'web-curated': completeActivationEvidence() })}
`))

    expect(profiles.curatedProfileDependenciesForBundles(['plugin-a', 'plugin-b', 'plugin-c'], 'web-curated')).toEqual({
      'plugin-a': `git+https://github.com/example/plugin-a.git#${fullSha}`,
      'plugin-b': `git+https://github.com/example/plugin-b.git#${fullSha}&path:packages/plugin-b`,
      'plugin-c': '1.2.3',
    })
  })

  it.each([
    {
      name: 'missing evidence',
      targetProfiles: ['web-curated'],
      runtimeActivationEvidence: undefined,
    },
    {
      name: 'a missing target-profile key',
      targetProfiles: ['web-curated', 'web-research'],
      runtimeActivationEvidence: {
        'web-curated': completeActivationEvidence(),
      },
    },
    {
      name: 'an extra target-profile key',
      targetProfiles: ['web-curated'],
      runtimeActivationEvidence: {
        'web-curated': completeActivationEvidence(),
        'web-research': completeActivationEvidence(),
      },
    },
    {
      name: 'an incomplete current-profile evidence set',
      targetProfiles: ['web-curated'],
      runtimeActivationEvidence: {
        'web-curated': {
          ...completeActivationEvidence(),
          restart: undefined,
        },
      },
    },
  ])('rejects a selected active candidate with $name', async ({
    targetProfiles,
    runtimeActivationEvidence,
  }) => {
    const profiles = await withMockedDependencyCatalog(JSON.stringify({
      schemaVersion: 1,
      source: {
        awesome: {
          repository: 'https://github.com/example/awesome',
          commit: fullSha,
          file: 'README.md',
        },
        matrix: 'matrix.md',
      },
      candidates: [{
        expectedPackage: 'consumer',
        repository: 'https://github.com/example/consumer',
        repositoryPath: null,
        commit: fullSha,
        sourceStatus: 'verified',
        active: true,
        rejections: [],
        targetProfiles,
        runtimeActivationEvidence,
      }],
    }))

    expect(() => profiles.curatedProfileDependenciesForBundles(
      ['consumer'],
      'web-curated',
    )).toThrow(
      'curated profile bundle "consumer" does not have complete activation evidence for profile web-curated',
    )
  })

  it('rejects a selected active candidate whose evidence required bundles differ from its declaration', async () => {
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: consumer
    repository: https://github.com/example/consumer
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    requiredRuntimeBundles: [runtime-bundle]
    runtimeActivationEvidence: ${JSON.stringify({
      'web-curated': completeActivationEvidence([]),
    })}
  - expectedPackage: runtime-bundle
    repository: https://github.com/example/runtime-bundle
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    runtimeActivationEvidence: ${JSON.stringify({
      'web-curated': completeActivationEvidence(),
    })}
`))

    expect(() => profiles.curatedProfileDependenciesForBundles(
      ['consumer', 'runtime-bundle'],
      'web-curated',
    )).toThrow(
      'curated profile bundle "consumer" does not have complete activation evidence for profile web-curated',
    )
  })

  it.each(activationEvidenceFileFields.flatMap(field => [
    { field, name: 'an absolute path', path: '/tmp/evidence.json' },
    { field, name: 'a traversal path', path: '../evidence.json' },
    { field, name: 'a backslash path', path: 'evidence\\record.json' },
    { field, name: 'a normalized traversal path', path: 'evidence/../record.json' },
    { field, name: 'a dot path', path: '.' },
  ]))('rejects a selected active candidate with $name for $field', async ({ field, path }) => {
    const evidence = completeActivationEvidence()
    const reference = evidence[field] as Record<string, unknown>
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: consumer
    repository: https://github.com/example/consumer
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    runtimeActivationEvidence: ${JSON.stringify({
      'web-curated': activationEvidenceWithReference(field, { ...reference, path }),
    })}
`))

    expect(() => profiles.curatedProfileDependenciesForBundles(
      ['consumer'],
      'web-curated',
    )).toThrow(
      'curated profile bundle "consumer" does not have complete activation evidence for profile web-curated',
    )
  })

  it.each(activationEvidenceFileFields.flatMap(field => [
    { field, name: 'a placeholder SHA-256', sha256: 'ab'.repeat(32) },
    { field, name: 'a malformed SHA-256', sha256: 'not-a-digest' },
  ]))('rejects a selected active candidate with $name for $field', async ({ field, sha256 }) => {
    const evidence = completeActivationEvidence()
    const reference = evidence[field] as Record<string, unknown>
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: consumer
    repository: https://github.com/example/consumer
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    runtimeActivationEvidence: ${JSON.stringify({
      'web-curated': activationEvidenceWithReference(field, { ...reference, sha256 }),
    })}
`))

    expect(() => profiles.curatedProfileDependenciesForBundles(
      ['consumer'],
      'web-curated',
    )).toThrow(
      'curated profile bundle "consumer" does not have complete activation evidence for profile web-curated',
    )
  })

  it('requires runtime bundle providers in the same profile dependency composition', async () => {
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: consumer
    repository: https://github.com/example/consumer
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    requiredRuntimeBundles: [runtime-bundle]
    runtimeActivationEvidence: ${JSON.stringify({
      'web-curated': completeActivationEvidence(['runtime-bundle']),
    })}
  - expectedPackage: runtime-bundle
    repository: https://github.com/example/runtime-bundle
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
`))

    expect(() => profiles.curatedProfileDependenciesForBundles(['consumer'], 'web-curated')).toThrow(
      'curated profile bundle "consumer" requires runtime bundle "runtime-bundle" in profile web-curated',
    )
    expect(() => profiles.curatedProfileDependenciesForBundles(
      ['consumer', 'runtime-bundle'],
      'web-curated',
    )).toThrow(
      'curated profile runtime bundle "runtime-bundle" does not have complete activation evidence for profile web-curated',
    )

    const profilesWithEvidence = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: consumer
    repository: https://github.com/example/consumer
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    requiredRuntimeBundles: [runtime-bundle]
    runtimeActivationEvidence: ${JSON.stringify({
      'web-curated': completeActivationEvidence(['runtime-bundle']),
    })}
  - expectedPackage: runtime-bundle
    repository: https://github.com/example/runtime-bundle
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    runtimeActivationEvidence:
      web-curated:
        keylessAssembledSnapshot: {path: evidence/assembled.json, sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}
        requiredRuntimeBundles: []
        install: {path: evidence/install.json, sha256: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0"}
        enable: {path: evidence/enable.json, sha256: "23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01"}
        restart: {path: evidence/restart.json, sha256: "3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012"}
        disableOrUninstall: {path: evidence/disable.json, sha256: "456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123"}
`))
    expect(profilesWithEvidence.curatedProfileDependenciesForBundles(
      ['consumer', 'runtime-bundle'],
      'web-curated',
    )).toEqual({
      consumer: `git+https://github.com/example/consumer.git#${fullSha}`,
      'runtime-bundle': `git+https://github.com/example/runtime-bundle.git#${fullSha}`,
    })
  })

  it('checks a shared runtime bundle provider evidence set for the requested profile', async () => {
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: consumer
    repository: https://github.com/example/consumer
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated, web-research]
    requiredRuntimeBundles: [runtime-bundle]
    runtimeActivationEvidence: ${JSON.stringify({
      'web-curated': completeActivationEvidence(['runtime-bundle']),
      'web-research': completeActivationEvidence(['runtime-bundle']),
    })}
  - expectedPackage: runtime-bundle
    repository: https://github.com/example/runtime-bundle
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated, web-research]
    runtimeActivationEvidence:
      web-curated:
        keylessAssembledSnapshot: {path: evidence/assembled.json, sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}
        requiredRuntimeBundles: []
        install: {path: evidence/install.json, sha256: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0"}
        enable: {path: evidence/enable.json, sha256: "23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01"}
        disableOrUninstall: {path: evidence/disable.json, sha256: "456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123"}
      web-research:
        keylessAssembledSnapshot: {path: evidence/assembled.json, sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}
        requiredRuntimeBundles: []
        install: {path: evidence/install.json, sha256: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0"}
        enable: {path: evidence/enable.json, sha256: "23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01"}
        restart: {path: evidence/restart.json, sha256: "3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012"}
        disableOrUninstall: {path: evidence/disable.json, sha256: "456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123"}
`))

    expect(profiles.curatedProfileDependenciesForBundles(
      ['consumer', 'runtime-bundle'],
      'web-research',
    )).toEqual({
      consumer: `git+https://github.com/example/consumer.git#${fullSha}`,
      'runtime-bundle': `git+https://github.com/example/runtime-bundle.git#${fullSha}`,
    })
    expect(() => profiles.curatedProfileDependenciesForBundles(
      ['consumer', 'runtime-bundle'],
      'web-curated',
    )).toThrow(
      'curated profile runtime bundle "runtime-bundle" does not have complete activation evidence for profile web-curated',
    )
  })

  it.each([
    ['an extra field', 'requiredRuntimeBundles: []\n        extra: true'],
    ['a non-array bundle declaration', 'requiredRuntimeBundles: {}'],
    ['a non-string bundle', 'requiredRuntimeBundles: [1]'],
    ['an empty bundle', 'requiredRuntimeBundles: [""]'],
  ])('rejects activation evidence with %s', async (_name, evidenceFields) => {
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: consumer
    repository: https://github.com/example/consumer
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    requiredRuntimeBundles: [runtime-bundle]
  - expectedPackage: runtime-bundle
    repository: https://github.com/example/runtime-bundle
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    runtimeActivationEvidence:
      web-curated:
        keylessAssembledSnapshot: {path: evidence/assembled.json, sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"}
        ${evidenceFields}
        install: {path: evidence/install.json, sha256: "123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0"}
        enable: {path: evidence/enable.json, sha256: "23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01"}
        restart: {path: evidence/restart.json, sha256: "3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012"}
        disableOrUninstall: {path: evidence/disable.json, sha256: "456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123"}
`))

    expect(() => profiles.curatedProfileDependenciesForBundles(
      ['consumer', 'runtime-bundle'],
      'web-curated',
    )).toThrow(
      'curated profile runtime bundle "runtime-bundle" does not have complete activation evidence for profile web-curated',
    )
  })

  it('rejects a non-object evidence set for the requested profile', async () => {
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: consumer
    repository: https://github.com/example/consumer
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    requiredRuntimeBundles: [runtime-bundle]
  - expectedPackage: runtime-bundle
    repository: https://github.com/example/runtime-bundle
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
    runtimeActivationEvidence:
      web-curated: invalid
`))

    expect(() => profiles.curatedProfileDependenciesForBundles(
      ['consumer', 'runtime-bundle'],
      'web-curated',
    )).toThrow(
      'curated profile runtime bundle "runtime-bundle" does not have complete activation evidence for profile web-curated',
    )
  })

  it('rejects inactive, rejected, or wrong-profile dependency rows', async () => {
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: inactive-plugin
    repository: https://github.com/example/inactive-plugin
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: false
    rejections: []
    targetProfiles: [web-curated]
  - expectedPackage: rejected-plugin
    repository: https://github.com/example/rejected-plugin
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: false
    rejections: [{code: rejected}]
    targetProfiles: [web-curated]
  - expectedPackage: wrong-profile-plugin
    repository: https://github.com/example/wrong-profile-plugin
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-research]
`))

    expect(() => profiles.curatedProfileDependenciesForBundles(['inactive-plugin'], 'web-curated')).toThrow(
      'curated profile bundle "inactive-plugin" is not active and accepted for profile web-curated',
    )
    expect(() => profiles.curatedProfileDependenciesForBundles(['rejected-plugin'], 'web-curated')).toThrow(
      'curated profile bundle "rejected-plugin" is not active and accepted for profile web-curated',
    )
    expect(() => profiles.curatedProfileDependenciesForBundles(['wrong-profile-plugin'], 'web-curated')).toThrow(
      'curated profile bundle "wrong-profile-plugin" is not active and accepted for profile web-curated',
    )
  })

  it('rejects an active dependency whose pinned source was not verified', async () => {
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: plugin-a
    repository: https://github.com/example/plugin-a
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: unreachable
    active: true
    rejections: []
    targetProfiles: [web-curated]
`))

    expect(() => profiles.curatedProfileDependenciesForBundles(['plugin-a'], 'web-curated')).toThrow(
      'curated profile bundle "plugin-a" is not active and verified for profile web-curated',
    )
  })

  it('rejects duplicate dependency package rows', async () => {
    const profiles = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: duplicate-plugin
    repository: https://github.com/example/first
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
  - expectedPackage: duplicate-plugin
    repository: https://github.com/example/second
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
`))

    expect(() => profiles.curatedProfileDependenciesForBundles(['duplicate-plugin'], 'web-curated')).toThrow(
      'curated profile dependency allowlist package duplicate-plugin is duplicated',
    )
  })

  it('rejects malformed dependency allowlist records before materializing a profile', async () => {
    const invalidRoot = await withMockedDependencyCatalog('[]\n')
    expect(() => invalidRoot.curatedProfileDependenciesForBundles(['plugin-a'], 'web-curated')).toThrow(
      'curated profile dependency allowlist must contain a candidates array',
    )

    const invalidRepository = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: plugin-a
    repository: ""
    repositoryPath: null
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
`))
    expect(() => invalidRepository.curatedProfileDependenciesForBundles(['plugin-a'], 'web-curated')).toThrow(
      'curated profile dependency allowlist candidates[0].repository must be a non-empty string',
    )

    const invalidCommit = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: plugin-a
    repository: https://github.com/example/plugin-a
    repositoryPath: null
    commit: main
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
`))
    expect(() => invalidCommit.curatedProfileDependenciesForBundles(['plugin-a'], 'web-curated')).toThrow(
      'curated profile dependency allowlist plugin-a commit must be pinned',
    )

    const invalidPath = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: plugin-a
    repository: https://github.com/example/plugin-a
    repositoryPath: 1
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
`))
    expect(() => invalidPath.curatedProfileDependenciesForBundles(['plugin-a'], 'web-curated')).toThrow(
      'curated profile dependency allowlist candidates[0].repositoryPath must be null or a non-empty string',
    )

    const invalidActive = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: plugin-a
    sourceStatus: verified
    active: enabled
    rejections: []
    targetProfiles: [web-curated]
`))
    expect(() => invalidActive.curatedProfileDependenciesForBundles(['plugin-a'], 'web-curated')).toThrow(
      'curated profile dependency allowlist candidates[0].active must be a boolean',
    )

    const invalidSource = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: plugin-a
    sourceStatus: pending
    active: true
    rejections: []
    targetProfiles: [web-curated]
`))
    expect(() => invalidSource.curatedProfileDependenciesForBundles(['plugin-a'], 'web-curated')).toThrow(
      'curated profile dependency allowlist candidates[0].sourceStatus must be verified or unreachable',
    )

    const invalidRejections = await withMockedDependencyCatalog(dependencyCatalog(`  - expectedPackage: plugin-a
    sourceStatus: verified
    active: true
    rejections: rejected
    targetProfiles: [web-curated]
`))
    expect(() => invalidRejections.curatedProfileDependenciesForBundles(['plugin-a'], 'web-curated')).toThrow(
      'curated profile dependency allowlist candidates[0].rejections must be a list',
    )
  })

  it('materializes below a DSH home that does not exist yet', () => {
    const parent = tmp()
    const home = join(parent, 'new-home')

    const dir = materializeCuratedProfile('web-personal', home)

    expect(dir).toBe(join(home, 'profiles', 'web-personal'))
    expect(existsSync(join(dir, 'package.json'))).toBe(true)
  })

  it('rejects profile and profiles-root links outside the DSH home', () => {
    for (const linkTarget of ['profile', 'profiles-root'] as const) {
      const home = tmp()
      const external = tmp()
      mkdirSync(home, { recursive: true })
      if (linkTarget === 'profile') {
        mkdirSync(join(home, 'profiles'), { recursive: true })
        symlinkSync(external, resolveProfileDir('web-curated', home), process.platform === 'win32' ? 'junction' : 'dir')
      } else {
        symlinkSync(external, join(home, 'profiles'), process.platform === 'win32' ? 'junction' : 'dir')
      }

      expect(() => materializeCuratedProfile('web-curated', home), linkTarget).toThrow(
        /profile root (?:must be a regular directory inside|resolves outside) the DSH home/u,
      )
      expect(existsSync(join(external, 'package.json'))).toBe(false)
    }
  })

  it.each(managedProfileFiles)('rejects a dangling %s symlink without partial profile writes', (file) => {
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const externalTarget = join(tmp(), `${file.replaceAll('/', '-')}.target`)
    mkdirSync(dir, { recursive: true })
    symlinkSync(externalTarget, join(dir, file), 'file')

    expect(() => materializeCuratedProfile('web-curated', home)).toThrow(
      `web-curated managed profile file ${file} must be a regular file`,
    )
    expect(existsSync(externalTarget)).toBe(false)
    expect(lstatSync(join(dir, file)).isSymbolicLink()).toBe(true)
    for (const other of managedProfileFiles) {
      if (other !== file) expect(existsSync(join(dir, other)), `${file}: ${other}`).toBe(false)
    }
  })

  it.each(managedProfileFiles)('rejects an external %s file symlink without reading or changing its target', (file) => {
    const home = tmp()
    const seedDir = materializeCuratedProfile('web-curated', tmp())
    const dir = resolveProfileDir('web-curated', home)
    const externalTarget = join(tmp(), `${file.replaceAll('/', '-')}.target`)
    const targetBytes = readFileSync(join(seedDir, file))
    mkdirSync(dir, { recursive: true })
    writeFileSync(externalTarget, targetBytes)
    symlinkSync(externalTarget, join(dir, file), 'file')

    expect(() => materializeCuratedProfile('web-curated', home)).toThrow(
      `web-curated managed profile file ${file} must be a regular file`,
    )
    expect(readFileSync(externalTarget)).toEqual(targetBytes)
    expect(lstatSync(join(dir, file)).isSymbolicLink()).toBe(true)
    for (const other of managedProfileFiles) {
      if (other !== file) expect(existsSync(join(dir, other)), `${file}: ${other}`).toBe(false)
    }
  })

  it('does not read a manifest replaced by an external symlink after lstat', async () => {
    const seedDir = materializeCuratedProfile('web-curated', tmp())
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    const externalManifest = join(tmp(), 'outside-package.json')
    mkdirSync(dir, { recursive: true })
    for (const file of managedProfileFiles) {
      writeFileSync(join(dir, file), readFileSync(join(seedDir, file)))
    }
    writeFileSync(externalManifest, readFileSync(manifestPath))
    let raced = false
    let externalTargetRead = false
    let externalDescriptor: number | undefined
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        constants: { ...actual.constants, O_NOFOLLOW: undefined },
        lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
          const [path] = args
          const result = actual.lstatSync(...args)
          if (!raced && String(path) === manifestPath) {
            raced = true
            actual.renameSync(manifestPath, `${manifestPath}.original`)
            actual.symlinkSync(externalManifest, manifestPath, 'file')
          }
          return result
        }) as typeof lstatSync,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (raced && String(args[0]) === manifestPath) externalDescriptor = descriptor
          return descriptor
        },
        readSync: (...args: Parameters<typeof actual.readSync>) => {
          if (args[0] === externalDescriptor) externalTargetRead = true
          return actual.readSync(...args)
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated managed profile file package.json changed while it was being read',
    )
    expect(externalTargetRead).toBe(false)
  })

  it('does not read an external profiles ancestor while reopening the retained snapshot', async () => {
    const seedDir = materializeCuratedProfile('web-curated', tmp())
    const home = tmp()
    const profilesDir = join(home, 'profiles')
    const dir = resolveProfileDir('web-curated', home)
    const externalProfilesDir = join(tmp(), 'profiles')
    const externalDir = join(externalProfilesDir, 'web-curated')
    mkdirSync(dir, { recursive: true })
    mkdirSync(externalDir, { recursive: true })
    for (const file of managedProfileFiles) {
      const content = readFileSync(join(seedDir, file))
      writeFileSync(join(dir, file), content)
      writeFileSync(join(externalDir, file), content)
    }
    let closedFiles = 0
    let raced = false
    let externalTargetRead = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        constants: { ...actual.constants, O_NOFOLLOW: undefined },
        closeSync: (descriptor: number) => {
          actual.closeSync(descriptor)
          if (!raced && ++closedFiles === managedProfileFiles.length) {
            raced = true
            actual.renameSync(profilesDir, `${profilesDir}.original`)
            actual.symlinkSync(
              externalProfilesDir,
              profilesDir,
              process.platform === 'win32' ? 'junction' : 'dir',
            )
          }
        },
        readSync: (...args: Parameters<typeof actual.readSync>) => {
          if (raced) externalTargetRead = true
          return actual.readSync(...args)
        },
      }
    })
    const profiles = await import('../src/index.ts')
    let rejection: unknown
    try {
      profiles.materializeCuratedProfileForLoad('web-curated', home).close()
    } catch (error) {
      rejection = error
    }

    expect(rejection).toEqual(expect.objectContaining({
      message: 'web-curated profile root resolves outside the DSH home',
    }))
    expect(externalTargetRead).toBe(false)
  })

  it('rejects a regular-file replacement between lstat and descriptor open', async () => {
    const seedDir = materializeCuratedProfile('web-curated', tmp())
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    const replacement = readFileSync(join(seedDir, 'package.json'))
    mkdirSync(dir, { recursive: true })
    for (const file of managedProfileFiles) {
      writeFileSync(join(dir, file), readFileSync(join(seedDir, file)))
    }
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let raced = false
      return {
        ...actual,
        lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
          const [path] = args
          const result = actual.lstatSync(...args)
          if (!raced && String(path) === manifestPath) {
            raced = true
            actual.renameSync(manifestPath, `${manifestPath}.original`)
            actual.writeFileSync(manifestPath, replacement)
          }
          return result
        }) as typeof lstatSync,
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated managed profile file package.json changed while it was being read',
    )
  })

  it('translates a symlink race after managed-file lstat into a changed-file error', async () => {
    const seedDir = materializeCuratedProfile('web-curated', tmp())
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    const originalManifestPath = `${manifestPath}.original`
    mkdirSync(dir, { recursive: true })
    for (const file of managedProfileFiles) {
      writeFileSync(join(dir, file), readFileSync(join(seedDir, file)))
    }
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let raced = false
      return {
        ...actual,
        lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
          const [path] = args
          const result = actual.lstatSync(...args)
          if (!raced && String(path) === manifestPath) {
            raced = true
            actual.renameSync(manifestPath, originalManifestPath)
            actual.symlinkSync(originalManifestPath, manifestPath, 'file')
          }
          return result
        }) as typeof lstatSync,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          if (raced && String(args[0]) === manifestPath && typeof actual.constants.O_NOFOLLOW !== 'number') {
            throw Object.assign(new Error('symlink open rejected'), { code: 'ELOOP' })
          }
          return actual.openSync(...args)
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated managed profile file package.json changed while it was being read',
    )
  })

  it('rejects an ancestor replacement after opening a managed file without O_NOFOLLOW', async () => {
    const seedDir = materializeCuratedProfile('web-curated', tmp())
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const externalDir = join(tmp(), 'outside-profile')
    const manifestPath = join(dir, 'package.json')
    mkdirSync(dir, { recursive: true })
    mkdirSync(externalDir, { recursive: true })
    for (const file of managedProfileFiles) {
      const content = readFileSync(join(seedDir, file))
      writeFileSync(join(dir, file), content)
      writeFileSync(join(externalDir, file), content)
    }
    let raced = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        constants: { ...actual.constants, O_NOFOLLOW: undefined },
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const [path] = args
          const descriptor = actual.openSync(...args)
          if (!raced && String(path) === manifestPath) {
            raced = true
            actual.renameSync(dir, `${dir}.original`)
            actual.symlinkSync(externalDir, dir, process.platform === 'win32' ? 'junction' : 'dir')
          }
          return descriptor
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated managed profile file package.json changed while it was being read',
    )
  })

  it('rejects a profile root replaced after containment validation', async () => {
    const dir = materializeCuratedProfile('web-curated', tmp())
    const home = join(dir, '..', '..')
    let rootChecks = 0
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
          const [path] = args
          if (String(path) === dir && ++rootChecks === 3) {
            return actual.lstatSync(join(dir, 'package.json'), { bigint: true })
          }
          return actual.lstatSync(...args)
        }) as typeof lstatSync,
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated profile root must be a regular directory inside the DSH home',
    )
  })

  it.each([
    ['lstat', 'lstatSync', 'lstat denied'],
    ['open', 'openSync', 'open denied'],
  ] as const)('propagates an unexpected managed-file %s failure', async (_name, operation, message) => {
    const seedDir = materializeCuratedProfile('web-curated', tmp())
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    const failedPath = operation === 'lstatSync'
      ? join(dir, PROFILE_PATCH_FILENAME)
      : manifestPath
    mkdirSync(dir, { recursive: true })
    for (const file of managedProfileFiles) {
      writeFileSync(join(dir, file), readFileSync(join(seedDir, file)))
    }
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const fail = () => {
        throw Object.assign(new Error(message), { code: 'EACCES' })
      }
      if (operation === 'lstatSync') {
        return {
          ...actual,
          lstatSync: (...args: Parameters<typeof actual.lstatSync>) =>
            String(args[0]) === failedPath ? fail() : actual.lstatSync(...args),
        }
      }
      return {
        ...actual,
        openSync: (...args: Parameters<typeof actual.openSync>) =>
          String(args[0]) === failedPath ? fail() : actual.openSync(...args),
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(message)
  })

  it('rejects a descriptor that does not identify a regular file', async () => {
    const seedDir = materializeCuratedProfile('web-curated', tmp())
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    mkdirSync(dir, { recursive: true })
    for (const file of managedProfileFiles) {
      writeFileSync(join(dir, file), readFileSync(join(seedDir, file)))
    }
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let manifestDescriptor: number | undefined
      return {
        ...actual,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const [path] = args
          const descriptor = actual.openSync(...args)
          if (String(path) === manifestPath) manifestDescriptor = descriptor
          return descriptor
        },
        fstatSync: ((...args: Parameters<typeof actual.fstatSync>) => {
          const [descriptor] = args
          if (descriptor === manifestDescriptor) {
            return actual.lstatSync(dir, { bigint: true })
          }
          return actual.fstatSync(...args)
        }) as typeof actual.fstatSync,
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated managed profile file package.json must be a regular file',
    )
  })

  it('rejects descriptor metadata drift during a managed-file read', async () => {
    const seedDir = materializeCuratedProfile('web-curated', tmp())
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    mkdirSync(dir, { recursive: true })
    for (const file of managedProfileFiles) {
      writeFileSync(join(dir, file), readFileSync(join(seedDir, file)))
    }
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let manifestDescriptor: number | undefined
      let manifestFstats = 0
      return {
        ...actual,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const [path] = args
          const descriptor = actual.openSync(...args)
          if (String(path) === manifestPath) manifestDescriptor = descriptor
          return descriptor
        },
        fstatSync: ((...args: Parameters<typeof actual.fstatSync>) => {
          const [descriptor] = args
          const stat = actual.fstatSync(...args)
          if (descriptor !== manifestDescriptor || ++manifestFstats !== 3) return stat
          if (typeof stat.size !== 'bigint') throw new Error('expected bigint stat fixture')
          stat.size += 1n
          return stat
        }) as typeof actual.fstatSync,
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated managed profile file package.json changed while it was being read',
    )
  })

  it('closes a retained profile snapshot idempotently and rejects later identity checks', () => {
    const home = tmp()
    const snapshot = materializeCuratedProfileForLoad('web-personal', home)

    expect(snapshot.readFile(join(snapshot.dir, 'outside'))).toBeUndefined()
    snapshot.close()
    expect(() => { snapshot.close() }).not.toThrow()
    expect(() => { snapshot.assertCurrent() }).toThrow('managed profile file snapshot is closed')
  })

  it.each(managedProfileFiles)('rejects a non-regular %s without partial profile writes', (file) => {
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    mkdirSync(join(dir, file), { recursive: true })

    expect(() => materializeCuratedProfile('web-curated', home)).toThrow(
      `web-curated managed profile file ${file} must be a regular file`,
    )
    for (const other of managedProfileFiles) {
      if (other !== file) expect(existsSync(join(dir, other)), `${file}: ${other}`).toBe(false)
    }
  })

  it('uses exclusive creation when a managed profile file appears after validation', async () => {
    const home = tmp()
    const manifestPath = join(resolveProfileDir('web-curated', home), 'package.json')
    const racedBytes = 'concurrent writer bytes\n'
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let raced = false
      return {
        ...actual,
        linkSync: (...args: Parameters<typeof actual.linkSync>) => {
          if (!raced && String(args[1]) === manifestPath) {
            raced = true
            actual.writeFileSync(manifestPath, racedBytes)
          }
          actual.linkSync(...args)
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow()
    expect(readFileSync(manifestPath, 'utf8')).toBe(racedBytes)
    for (const other of managedProfileFiles) {
      if (other !== 'package.json') expect(existsSync(join(resolveProfileDir('web-curated', home), other))).toBe(false)
    }
  })

  it('does not write managed files through a profile ancestor replaced during the first write', async () => {
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const movedDir = join(tmp(), 'moved-profile')
    const externalDir = tmp()
    mkdirSync(dir, { recursive: true })
    let raced = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        writeFileSync: (
          path: Parameters<typeof writeFileSync>[0],
          data: Parameters<typeof writeFileSync>[1],
          options?: Parameters<typeof writeFileSync>[2],
        ) => {
          if (!raced) {
            raced = true
            actual.renameSync(dir, movedDir)
            actual.symlinkSync(externalDir, dir, process.platform === 'win32' ? 'junction' : 'dir')
          }
          actual.writeFileSync(path, data, options)
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow()
    expect(raced).toBe(true)
    for (const file of managedProfileFiles) {
      expect(existsSync(join(externalDir, file)), file).toBe(false)
      expect(existsSync(join(movedDir, file)), file).toBe(false)
    }
  })

  it('does not write a later managed file through a replaced profiles ancestor', async () => {
    const home = tmp()
    const profilesDir = join(home, 'profiles')
    const dir = resolveProfileDir('web-curated', home)
    const externalProfilesDir = tmp()
    const externalDir = join(externalProfilesDir, 'web-curated')
    mkdirSync(dir, { recursive: true })
    mkdirSync(externalDir, { recursive: true })
    let writes = 0
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        writeFileSync: (
          path: Parameters<typeof writeFileSync>[0],
          data: Parameters<typeof writeFileSync>[1],
          options?: Parameters<typeof writeFileSync>[2],
        ) => {
          if (++writes === 2) {
            actual.renameSync(profilesDir, `${profilesDir}.original`)
            actual.symlinkSync(
              externalProfilesDir,
              profilesDir,
              process.platform === 'win32' ? 'junction' : 'dir',
            )
          }
          actual.writeFileSync(path, data, options)
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow()
    expect(writes).toBe(2)
    for (const file of managedProfileFiles) {
      expect(existsSync(join(externalDir, file)), file).toBe(false)
    }
  })

  it.each([
    ['initial', 1],
    ['post-write', 2],
  ] as const)('removes its owned temporary file after %s identity validation fails', async (_stage, failedCheck) => {
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    mkdirSync(dir, { recursive: true })
    let temporaryPath: string | undefined
    let temporaryChecks = 0
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (String(args[0]).includes('.package.json.')) temporaryPath = String(args[0])
          return descriptor
        },
        lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
          if (String(args[0]) === temporaryPath && ++temporaryChecks === failedCheck) {
            throw Object.assign(new Error('temporary identity check failed'), { code: 'EACCES' })
          }
          return actual.lstatSync(...args)
        }) as typeof lstatSync,
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated managed profile file package.json changed while it was being read',
    )
    expect(temporaryPath).toBeDefined()
    expect(existsSync(temporaryPath as string)).toBe(false)
    expect(existsSync(join(dir, 'package.json'))).toBe(false)
  })

  it('closes and removes its owned temporary file when initial identity acquisition fails', async () => {
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    mkdirSync(dir, { recursive: true })
    let temporaryDescriptor: number | undefined
    let temporaryPath: string | undefined
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (String(args[0]).includes('.package.json.')) {
            temporaryDescriptor = descriptor
            temporaryPath = String(args[0])
          }
          return descriptor
        },
        fstatSync: ((...args: Parameters<typeof actual.fstatSync>) => {
          if (args[0] === temporaryDescriptor) {
            throw Object.assign(new Error('temporary identity acquisition failed'), { code: 'EIO' })
          }
          return actual.fstatSync(...args)
        }) as typeof actual.fstatSync,
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'temporary identity acquisition failed',
    )
    expect(temporaryPath).toBeDefined()
    expect(existsSync(temporaryPath as string)).toBe(false)
    expect(temporaryDescriptor).toBeDefined()
    expect(() => fstatSync(temporaryDescriptor as number)).toThrow(expect.objectContaining({ code: 'EBADF' }))
    expect(existsSync(join(dir, 'package.json'))).toBe(false)
  })

  it('does not write through a temporary file path replaced after descriptor open', async () => {
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const externalTarget = join(tmp(), 'outside-target')
    mkdirSync(dir, { recursive: true })
    writeFileSync(externalTarget, 'outside bytes\n')
    let temporaryDescriptor: number | undefined
    let descriptorWritten = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (String(args[0]).includes('.package.json.')) {
            temporaryDescriptor = descriptor
            actual.unlinkSync(args[0])
            actual.symlinkSync(externalTarget, args[0], 'file')
          }
          return descriptor
        },
        writeFileSync: (
          path: Parameters<typeof actual.writeFileSync>[0],
          data: Parameters<typeof actual.writeFileSync>[1],
          options?: Parameters<typeof actual.writeFileSync>[2],
        ) => {
          if (path === temporaryDescriptor) descriptorWritten = true
          actual.writeFileSync(path, data, options)
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow()
    expect(descriptorWritten).toBe(false)
    expect(readFileSync(externalTarget, 'utf8')).toBe('outside bytes\n')
    expect(existsSync(join(dir, 'package.json'))).toBe(false)
  })

  it('does not remove a directory that replaces a temporary file path', async () => {
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    mkdirSync(dir, { recursive: true })
    let replacementPath: string | undefined
    let descriptorWritten = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let temporaryDescriptor: number | undefined
      return {
        ...actual,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (String(args[0]).includes('.package.json.')) {
            temporaryDescriptor = descriptor
            replacementPath = String(args[0])
            actual.unlinkSync(args[0])
            actual.mkdirSync(args[0])
          }
          return descriptor
        },
        writeFileSync: (
          path: Parameters<typeof actual.writeFileSync>[0],
          data: Parameters<typeof actual.writeFileSync>[1],
          options?: Parameters<typeof actual.writeFileSync>[2],
        ) => {
          if (path === temporaryDescriptor) descriptorWritten = true
          actual.writeFileSync(path, data, options)
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow()
    expect(descriptorWritten).toBe(false)
    expect(replacementPath).toBeDefined()
    expect(lstatSync(replacementPath as string).isDirectory()).toBe(true)
    expect(existsSync(join(dir, 'package.json'))).toBe(false)
  })

  it('rejects a managed file replaced immediately after exclusive publication', async () => {
    const home = tmp()
    const manifestPath = join(resolveProfileDir('web-curated', home), 'package.json')
    const replacement = 'replacement bytes\n'
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        linkSync: (...args: Parameters<typeof actual.linkSync>) => {
          actual.linkSync(...args)
          if (String(args[1]) === manifestPath) {
            actual.unlinkSync(manifestPath)
            actual.writeFileSync(manifestPath, replacement)
          }
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated managed profile file package.json changed while it was being read',
    )
    expect(readFileSync(manifestPath, 'utf8')).toBe(replacement)
  })

  it('fails closed after publishing through a moved profile directory aliased back during link', async () => {
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    const movedDir = join(tmp(), 'moved-profile')
    mkdirSync(dir, { recursive: true })
    let raced = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        linkSync: (...args: Parameters<typeof actual.linkSync>) => {
          if (!raced && String(args[1]) === manifestPath) {
            raced = true
            actual.renameSync(dir, movedDir)
            actual.symlinkSync(movedDir, dir, process.platform === 'win32' ? 'junction' : 'dir')
          }
          actual.linkSync(...args)
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated profile root changed while managed files were being read',
    )
    expect(raced).toBe(true)
    expect(lstatSync(dir).isSymbolicLink()).toBe(true)
    expect(JSON.parse(readFileSync(join(movedDir, 'package.json'), 'utf8'))).toMatchObject({
      name: 'dsh-profile-web-curated',
    })
    for (const file of managedProfileFiles) {
      if (file !== 'package.json') expect(existsSync(join(movedDir, file)), file).toBe(false)
    }
  })

  it('preserves a concurrent regular file that replaces a published temporary path', async () => {
    const home = tmp()
    const manifestPath = join(resolveProfileDir('web-curated', home), 'package.json')
    const replacement = 'concurrent temporary bytes\n'
    let replacementPath: string | undefined
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        linkSync: (...args: Parameters<typeof actual.linkSync>) => {
          actual.linkSync(...args)
          if (String(args[1]) === manifestPath) {
            replacementPath = String(args[0])
            actual.unlinkSync(args[0])
            actual.writeFileSync(args[0], replacement)
          }
        },
      }
    })
    const profiles = await import('../src/index.ts')

    expect(() => profiles.materializeCuratedProfile('web-curated', home)).not.toThrow()
    expect(replacementPath).toBeDefined()
    expect(readFileSync(replacementPath as string, 'utf8')).toBe(replacement)
    expect(JSON.parse(readFileSync(manifestPath, 'utf8'))).toMatchObject({
      name: 'dsh-profile-web-curated',
    })
  })

  it('does not overwrite existing profile files and is idempotent', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    const patchPath = join(dir, PROFILE_PATCH_FILENAME)
    const workspacePath = join(dir, 'pnpm-workspace.yaml')
    const npmrcPath = join(dir, '.npmrc')
    const manifestBefore = readFileSync(manifestPath, 'utf8')
    const patchBefore = readFileSync(patchPath, 'utf8')
    const workspaceBefore = readFileSync(workspacePath, 'utf8')
    const npmrcBefore = readFileSync(npmrcPath, 'utf8')

    materializeCuratedProfile('web-curated', home)
    expect(readFileSync(manifestPath, 'utf8')).toBe(manifestBefore)
    expect(readFileSync(patchPath, 'utf8')).toBe(patchBefore)
    expect(readFileSync(workspacePath, 'utf8')).toBe(workspaceBefore)
    expect(readFileSync(npmrcPath, 'utf8')).toBe(npmrcBefore)

    const userFiles = {
      manifest: '{"name":"user-owned-profile"}\n',
      patch: '- id: user\n  config: {}\n',
      workspace: 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\n',
      npmrc: 'ignore-scripts=true\n',
    }
    writeFileSync(manifestPath, userFiles.manifest)
    writeFileSync(patchPath, userFiles.patch)
    writeFileSync(workspacePath, userFiles.workspace)
    writeFileSync(npmrcPath, userFiles.npmrc)
    expect(() => materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated existing manifest violates curated policy',
    )
    expect(readFileSync(manifestPath, 'utf8')).toBe(userFiles.manifest)
    expect(readFileSync(patchPath, 'utf8')).toBe(userFiles.patch)
    expect(readFileSync(workspacePath, 'utf8')).toBe(userFiles.workspace)
    expect(readFileSync(npmrcPath, 'utf8')).toBe(userFiles.npmrc)
  })

  it('rejects resolved bundle order and catalog assignment drift at boot admission', async () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-personal', home)
    const template = CURATED_PROFILE_TEMPLATES['web-personal']
    const profile = {
      name: 'web-personal',
      dir,
      layers: template.bundles.map(packageName => ({
        packageName,
        packageDir: dir,
        patchPath: join(dir, `${packageName}.yml`),
        patches: [],
      })),
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [],
    } satisfies Profile

    expect(() => {
      assertCuratedProfileAdmission('web-personal', home, {
        ...profile,
        layers: profile.layers.slice(1),
      })
    }).toThrow('web-personal resolved bundle list violates curated policy')

    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      const catalog = actual.loadCuratedCatalog()
      const candidate = catalog.candidates.find(candidate => candidate.id === 'dsh-web-search-pro')
      if (candidate === undefined) throw new Error('missing fixture candidate')
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          ...catalog,
          candidates: [
            ...catalog.candidates,
            {
              ...candidate,
              id: 'unexpected-personal-candidate',
              expectedPackage: 'unexpected-personal-candidate',
              targetProfiles: ['web-personal'],
              active: true,
              rejections: [],
            },
          ],
        }),
      }
    })
    const mockedProfiles = await import('../src/index.ts')
    expect(() => {
      mockedProfiles.assertCuratedProfileAdmission('web-personal', home, profile)
    }).toThrow('web-personal catalog assignments violate curated policy')
  })

  it('rejects dynamic expressions in admitted user layers', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-personal', home)
    const profile = {
      name: 'web-personal',
      dir,
      layers: CURATED_PROFILE_TEMPLATES['web-personal'].bundles.map(packageName => ({
        packageName,
        packageDir: dir,
        patchPath: join(dir, `${packageName}.yml`),
        patches: [],
      })),
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [{ id: 'existing', config: { value: { __jsExpr: 'process.env.SECRET' } } }],
    } satisfies Profile

    expect(() => { assertCuratedProfileAdmission('web-personal', home, profile) }).toThrow(
      'web-personal user patches must not contain dynamic expressions',
    )
  })

  it('skips the user patch for bundles-only admission diagnostics', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-personal', home)
    const profile = {
      name: 'web-personal',
      dir,
      layers: CURATED_PROFILE_TEMPLATES['web-personal'].bundles.map(packageName => ({
        packageName,
        packageDir: dir,
        patchPath: join(dir, `${packageName}.yml`),
        patches: [],
      })),
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [{ id: 'existing', config: { value: { __jsExpr: 'process.env.SECRET' } } }],
    } satisfies Profile

    expect(() => {
      assertCuratedProfileAdmission('web-personal', home, profile, [], { userLayer: false })
    }).not.toThrow()
  })

  it('accepts admitted layers that only reconfigure approved entries', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-personal', home)
    const profile = {
      name: 'web-personal',
      dir,
      layers: CURATED_PROFILE_TEMPLATES['web-personal'].bundles.map(packageName => ({
        packageName,
        packageDir: dir,
        patchPath: join(dir, `${packageName}.yml`),
        patches: [],
      })),
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [{ id: 'unregistered-config-only', config: { enabled: true } }],
    } satisfies Profile

    expect(() => { assertCuratedProfileAdmission('web-personal', home, profile) }).not.toThrow()
  })

  it('accepts insert arrays inside ordinary leaf plugin config', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-personal', home)
    const profile = {
      name: 'web-personal',
      dir,
      layers: CURATED_PROFILE_TEMPLATES['web-personal'].bundles.map((packageName, index) => ({
        packageName,
        packageDir: dir,
        patchPath: join(dir, `${String(index)}.yml`),
        patches: index === 0
          ? [{ insert: [{ id: 'approved-leaf', name: 'approved-plugin', config: {} }] }]
          : [],
      })),
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [{
        id: 'approved-leaf',
        config: { insert: ['ordinary-config-value'] },
      }],
    } satisfies Profile

    expect(() => { assertCuratedProfileAdmission('web-personal', home, profile) }).not.toThrow()
  })

  it.each([
    { externalBodyEgress: true },
    { importMode: 'apply' },
    { sessionsWrite: true },
  ])('enforces enterprise restrictions on installation-owned rows after composition', (config) => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-enterprise', home)
    const profile = {
      name: 'web-enterprise',
      dir,
      layers: CURATED_PROFILE_TEMPLATES['web-enterprise'].bundles.map((packageName, index) => ({
        packageName,
        packageDir: dir,
        patchPath: join(dir, `${String(index)}.yml`),
        patches: index === 0
          ? [{ insert: [{ id: 'foundation', name: packageName, config: {} }] }]
          : [],
      })),
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [],
    } satisfies Profile

    expect(() => {
      assertCuratedProfileAdmission('web-enterprise', home, profile, [[{ id: 'foundation', config }]])
    }).toThrow('web-enterprise effective composition violates curated policy')
  })

  it('rejects an unapproved executable nested in an approved group', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-personal', home)
    const layers = CURATED_PROFILE_TEMPLATES['web-personal'].bundles.map((packageName, index) => ({
      packageName,
      packageDir: dir,
      patchPath: join(dir, `${String(index)}.yml`),
      patches: index === 0
        ? [{
          insert: [{
            id: 'approved-group',
            name: '@deepseek-ai/cordis-plugin-group',
            group: true,
            config: [{ id: 'approved-child', name: 'approved-plugin', config: {} }],
          }],
        }]
        : [],
    }))
    const profile = {
      name: 'web-personal',
      dir,
      layers,
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [],
    } satisfies Profile

    expect(() => {
      assertCuratedProfileAdmission('web-personal', home, profile, [[
        {
          id: 'approved-group',
          config: [
            { id: 'approved-child', name: 'approved-plugin', config: {} },
            { id: 'injected-child', name: 'injected-plugin', config: {} },
          ],
        },
      ]])
    }).toThrow('web-personal user patches introduce an unapproved executable or group')

    const truthyGroupPatch = [{
      id: 'approved-child',
      group: 'enabled',
      config: [42, { id: 'injected-child', name: 'injected-plugin', config: {} }],
    }] as unknown as Profile['patches']
    expect(() => {
      assertCuratedProfileAdmission('web-personal', home, profile, [truthyGroupPatch])
    }).toThrow('web-personal user patches introduce an unapproved executable or group')
  })

  it('rejects swapping approved children between groups through config replacements', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-personal', home)
    const profile = {
      name: 'web-personal',
      dir,
      layers: CURATED_PROFILE_TEMPLATES['web-personal'].bundles.map((packageName, index) => ({
        packageName,
        packageDir: dir,
        patchPath: join(dir, `${String(index)}.yml`),
        patches: index === 0
          ? [{
            insert: [
              {
                id: 'group-a',
                name: '@deepseek-ai/cordis-plugin-group',
                group: true,
                config: [{ id: 'child-a', name: 'plugin-a', config: {} }],
              },
              {
                id: 'group-b',
                name: '@deepseek-ai/cordis-plugin-group',
                group: true,
                config: [{ id: 'child-b', name: 'plugin-b', config: {} }],
              },
            ],
          }]
          : [],
      })),
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [
        { id: 'group-a', config: [{ id: 'child-b', name: 'plugin-b', config: {} }] },
        { id: 'group-b', config: [{ id: 'child-a', name: 'plugin-a', config: {} }] },
      ],
    } satisfies Profile

    expect(() => {
      assertCuratedProfileAdmission('web-personal', home, profile)
    }).toThrow('web-personal user patches introduce an unapproved executable or group')
  })

  it.each([
    {
      label: 'executable',
      entry: { id: 'approved-entry', name: 'approved-plugin', config: {} },
    },
    {
      label: 'group',
      entry: {
        id: 'approved-group',
        name: '@deepseek-ai/cordis-plugin-group',
        group: true,
        config: [],
      },
    },
  ])('rejects a user-layer duplicate of an approved $label identity', ({ entry }) => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-personal', home)
    const profile = {
      name: 'web-personal',
      dir,
      layers: CURATED_PROFILE_TEMPLATES['web-personal'].bundles.map((packageName, index) => ({
        packageName,
        packageDir: dir,
        patchPath: join(dir, `${String(index)}.yml`),
        patches: index === 0 ? [{ insert: [entry] }] : [],
      })),
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [],
    } satisfies Profile

    expect(() => {
      assertCuratedProfileAdmission('web-personal', home, profile, [[{ insert: [entry] }]])
    }).toThrow('web-personal user patches introduce an unapproved executable or group')
  })

  it('rejects moving an approved child out of its group while retaining config overrides', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-personal', home)
    const profile = {
      name: 'web-personal',
      dir,
      layers: CURATED_PROFILE_TEMPLATES['web-personal'].bundles.map((packageName, index) => ({
        packageName,
        packageDir: dir,
        patchPath: join(dir, `${String(index)}.yml`),
        patches: index === 0
          ? [{
            insert: [{
              id: 'approved-group',
              name: '@deepseek-ai/cordis-plugin-group',
              group: true,
              config: [{ id: 'approved-child', name: 'approved-plugin', config: { enabled: false } }],
            }],
          }]
          : [],
      })),
      patchPath: join(dir, PROFILE_PATCH_FILENAME),
      patches: [],
    } satisfies Profile

    expect(() => {
      assertCuratedProfileAdmission('web-personal', home, {
        ...profile,
        patches: [{ id: 'approved-child', config: { enabled: true } }],
      })
    }).not.toThrow()
    expect(() => {
      assertCuratedProfileAdmission('web-personal', home, {
        ...profile,
        patches: [
          { id: 'approved-group', config: [] },
          { insert: [{ id: 'approved-child', name: 'approved-plugin', config: { enabled: true } }] },
        ],
      })
    }).toThrow('web-personal user patches introduce an unapproved executable or group')
    expect(() => {
      assertCuratedProfileAdmission('web-personal', home, {
        ...profile,
        patches: [{
          id: 'approved-group',
          config: [{
            insert: [{ id: 'approved-child', name: 'approved-plugin', config: { enabled: true } }],
          }],
        }],
      })
    }).toThrow('web-personal user patches introduce an unapproved executable or group')
  })

  it.each([
    {
      name: 'expanded package roots',
      workspace: 'packages:\n  - .\n  - extra\nnodeLinker: hoisted\nautoInstallPeers: false\n',
    },
    {
      name: 'different linker',
      workspace: 'packages:\n  - .\nnodeLinker: isolated\nautoInstallPeers: false\n',
    },
    {
      name: 'automatic peer installation',
      workspace: 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: true\n',
    },
    {
      name: 'additional workspace resolution field',
      workspace: 'packages:\n  - .\nnodeLinker: hoisted\nautoInstallPeers: false\nlinkWorkspacePackages: true\n',
    },
  ])('rejects $name before changing existing profile bytes', ({ workspace }) => {
    const home = tmp()
    const dir = resolveProfileDir('web-curated', home)
    const workspacePath = join(dir, 'pnpm-workspace.yaml')
    mkdirSync(dir, { recursive: true })
    writeFileSync(workspacePath, workspace)
    const before = readFileSync(workspacePath)

    expect(() => materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated existing package-manager state violates curated policy',
    )
    expect(readFileSync(workspacePath)).toEqual(before)
    expect(existsSync(join(dir, 'package.json'))).toBe(false)
    expect(existsSync(join(dir, PROFILE_PATCH_FILENAME))).toBe(false)
    expect(existsSync(join(dir, '.npmrc'))).toBe(false)
  })

  it('rejects unsafe package-manager state for every curated profile before writing files', () => {
    const cases = [
      {
        name: 'scripts enabled',
        path: '.npmrc',
        content: 'ignore-scripts=false\n',
      },
      {
        name: 'modules directory redirect',
        path: '.npmrc',
        content: 'ignore-scripts=true\nmodules-dir=../../outside-modules\n',
      },
      {
        name: 'lockfile directory redirect',
        path: '.npmrc',
        content: 'ignore-scripts=true\nlockfile-dir=../../outside-lock\n',
      },
      {
        name: 'store redirect',
        path: '.npmrc',
        content: 'ignore-scripts=true\nstore-dir=../../outside-store\n',
      },
      {
        name: 'registry override',
        path: '.npmrc',
        content: 'ignore-scripts=true\nregistry=https://registry.example.test/\n',
      },
      {
        name: 'registry authentication',
        path: '.npmrc',
        content: 'ignore-scripts=true\n//registry.example.test/:_authToken=sk-curated-secret\n',
      },
      {
        name: 'additional setting',
        path: '.npmrc',
        content: 'ignore-scripts=true\nstrict-peer-dependencies=true\n',
      },
      {
        name: 'semantically equivalent formatting',
        path: '.npmrc',
        content: 'ignore-scripts = true\n',
      },
      {
        name: 'package build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nallowBuilds:\n  plugin-a: true\n',
      },
      {
        name: 'unrestricted build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\ndangerouslyAllowAllBuilds: true\n',
      },
      {
        name: 'legacy build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nonlyBuiltDependencies:\n  - plugin-a\n',
      },
      {
        name: 'malformed legacy build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nonlyBuiltDependencies: plugin-a\n',
      },
      {
        name: 'external legacy build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nonlyBuiltDependenciesFile: builds.json\n',
      },
      {
        name: 'patched dependency',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\npatchedDependencies:\n  plugin-a@1.0.0: patches/plugin-a.patch\n',
      },
      {
        name: 'package extension',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\npackageExtensions:\n  plugin-a@1.0.0:\n    dependencies:\n      injected: 1.0.0\n',
      },
      {
        name: 'workspace dependency override',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\noverrides:\n  transitive-package: 9.9.9\n',
      },
      {
        name: 'manifest patch declaration',
        path: 'package.json',
        content: '{"pnpm":{"patchedDependencies":{}}}\n',
      },
      {
        name: 'manifest dependency override',
        path: 'package.json',
        content: '{"pnpm":{"overrides":{"transitive-package":"9.9.9"}}}\n',
      },
      {
        name: 'manifest build grant',
        path: 'package.json',
        content: '{"pnpm":{"allowBuilds":{"plugin-a":true}}}\n',
      },
      {
        name: 'manifest malformed build grants',
        path: 'package.json',
        content: '{"pnpm":{"allowBuilds":[]}}\n',
      },
      {
        name: 'manifest inert build grant with transformation',
        path: 'package.json',
        content: '{"pnpm":{"allowBuilds":{"plugin-a":false},"overrides":{}}}\n',
      },
      {
        name: 'manifest unrestricted build grant',
        path: 'package.json',
        content: '{"pnpm":{"dangerouslyAllowAllBuilds":true}}\n',
      },
      {
        name: 'manifest scripts enabled',
        path: 'package.json',
        content: '{"pnpm":{"ignoreScripts":false}}\n',
      },
      {
        name: 'manifest legacy build grant',
        path: 'package.json',
        content: '{"pnpm":{"onlyBuiltDependencies":["plugin-a"]}}\n',
      },
      {
        name: 'manifest malformed legacy build grant',
        path: 'package.json',
        content: '{"pnpm":{"onlyBuiltDependencies":"plugin-a"}}\n',
      },
      {
        name: 'manifest empty legacy build grant with transformation',
        path: 'package.json',
        content: '{"pnpm":{"onlyBuiltDependencies":[],"overrides":{}}}\n',
      },
      {
        name: 'manifest package extension',
        path: 'package.json',
        content: '{"pnpm":{"packageExtensions":{}}}\n',
      },
      {
        name: 'manifest config dependency hook',
        path: 'package.json',
        content: '{"pnpm":{"configDependencies":{"@pnpm/config-plugin":"1.0.0"}}}\n',
      },
      {
        name: 'package transform hook',
        path: '.pnpmfile.cjs',
        content: 'module.exports = { hooks: {} }\n',
      },
      {
        name: 'legacy package transform hook',
        path: '.pnpmfile.js',
        content: 'module.exports = { hooks: {} }\n',
      },
      {
        name: 'module package transform hook',
        path: '.pnpmfile.mjs',
        content: 'export default { hooks: {} }\n',
      },
      {
        name: 'configured package transform hook',
        path: '.npmrc',
        content: 'ignore-scripts=true\npnpmfile=custom-pnpmfile.cjs\n',
      },
      {
        name: 'configured global package transform hook',
        path: '.npmrc',
        content: 'ignore-scripts=true\nglobal-pnpmfile=custom-pnpmfile.cjs\n',
      },
      {
        name: 'configured patch directory',
        path: '.npmrc',
        content: 'ignore-scripts=true\npatches-dir=patches\n',
      },
    ] as const

    for (const profileName of profileNames) {
      for (const testCase of cases) {
        const home = tmp()
        const dir = resolveProfileDir(profileName, home)
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, testCase.path), testCase.content)

        expect(() => materializeCuratedProfile(profileName, home), `${profileName}: ${testCase.name}`)
          .toThrow(/existing package-manager state violates curated policy/u)
        expect(readFileSync(join(dir, testCase.path), 'utf8')).toBe(testCase.content)
        expect(existsSync(join(dir, 'package.json'))).toBe(testCase.path === 'package.json')
        expect(existsSync(join(dir, PROFILE_PATCH_FILENAME))).toBe(false)
      }
    }
  })

  it('refuses enterprise materialization when an existing npmrc enables lifecycle scripts', () => {
    const home = tmp()
    const dir = resolveProfileDir('web-enterprise', home)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.npmrc'), 'ignore-scripts=false\n')

    expect(() => materializeCuratedProfile('web-enterprise', home)).toThrow(
      'web-enterprise existing package-manager state violates curated policy',
    )
    expect(readFileSync(join(dir, '.npmrc'), 'utf8')).toBe('ignore-scripts=false\n')
    expect(existsSync(join(dir, 'package.json'))).toBe(false)
    expect(existsSync(join(dir, PROFILE_PATCH_FILENAME))).toBe(false)
    expect(existsSync(join(dir, 'pnpm-workspace.yaml'))).toBe(false)
  })

  it('rejects prohibited existing enterprise content before writing any profile file', () => {
    const safePatch = `- id: memento
  config:
    writePolicy: ask
    writePolicies: {}
    proposals:
      enabled: false
`
    const safeManifest = {
      name: 'dsh-profile-web-enterprise',
      private: true,
      dependencies: curatedProfileDependenciesForBundles(
        CURATED_PROFILE_TEMPLATES['web-enterprise'].bundles,
        'web-enterprise',
      ),
      dsh: { profile: { bundles: CURATED_PROFILE_TEMPLATES['web-enterprise'].bundles } },
    }
    const cases = [
      {
        name: 'manifest bundle',
        manifest: JSON.stringify({
          ...safeManifest,
          dsh: { profile: { bundles: [...CURATED_PROFILE_TEMPLATES['web-enterprise'].bundles, 'dsh-computer-use'] } },
        }),
        patch: safePatch,
        workspace: 'packages:\n  - .\n',
      },
      {
        name: 'manifest dependency',
        manifest: JSON.stringify({
          ...safeManifest,
          dependencies: { 'dsh-web-search-pro': 'git+https://example.invalid/search.git#0123456789abcdef' },
        }),
        patch: safePatch,
        workspace: 'packages:\n  - .\n',
      },
      {
        name: 'manifest without profile metadata',
        manifest: JSON.stringify({
          name: safeManifest.name,
          private: safeManifest.private,
          dependencies: safeManifest.dependencies,
        }),
        patch: safePatch,
        workspace: 'packages:\n  - .\n',
      },
      {
        name: 'manifest dependency collection',
        manifest: JSON.stringify({
          ...safeManifest,
          dependencies: [],
        }),
        patch: safePatch,
        workspace: 'packages:\n  - .\n',
      },
      {
        name: 'manifest optional dependency',
        manifest: JSON.stringify({
          ...safeManifest,
          optionalDependencies: { 'unapproved-optional': '1.0.0' },
        }),
        patch: safePatch,
        workspace: 'packages:\n  - .\n',
      },
      {
        name: 'manifest development dependency',
        manifest: JSON.stringify({
          ...safeManifest,
          devDependencies: { 'unapproved-development': '1.0.0' },
        }),
        patch: safePatch,
        workspace: 'packages:\n  - .\n',
      },
      {
        name: 'manifest bundled dependency array',
        manifest: JSON.stringify({
          ...safeManifest,
          bundledDependencies: ['unapproved-bundled'],
        }),
        patch: safePatch,
        workspace: 'packages:\n  - .\n',
      },
      {
        name: 'manifest malformed peer dependency collection',
        manifest: JSON.stringify({
          ...safeManifest,
          peerDependencies: 'plugin-a',
        }),
        patch: safePatch,
        workspace: 'packages:\n  - .\n',
      },
      {
        name: 'patch candidate',
        manifest: JSON.stringify(safeManifest),
        patch: `${safePatch}- insert:\n    - id: search\n      name: dsh-web-search-pro\n      config: {}\n`,
        workspace: 'packages:\n  - .\n',
      },
      {
        name: 'workspace build grant',
        manifest: JSON.stringify(safeManifest),
        patch: safePatch,
        workspace: 'packages:\n  - .\nallowBuilds:\n  dsh-web-search-pro: true\n',
      },
      {
        name: 'workspace collection',
        manifest: JSON.stringify(safeManifest),
        patch: safePatch,
        workspace: '- .\n',
      },
      {
        name: 'workspace unrestricted builds',
        manifest: JSON.stringify(safeManifest),
        patch: safePatch,
        workspace: 'packages:\n  - .\ndangerouslyAllowAllBuilds: true\n',
      },
      {
        name: 'workspace scripts enabled',
        manifest: JSON.stringify(safeManifest),
        patch: safePatch,
        workspace: 'packages:\n  - .\nignoreScripts: false\n',
      },
      {
        name: 'workspace malformed build grants',
        manifest: JSON.stringify(safeManifest),
        patch: safePatch,
        workspace: 'packages:\n  - .\nallowBuilds: []\n',
      },
    ] as const

    for (const testCase of cases) {
      const home = tmp()
      const dir = resolveProfileDir('web-enterprise', home)
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, 'package.json'), `${testCase.manifest}\n`)
      writeFileSync(join(dir, PROFILE_PATCH_FILENAME), testCase.patch)
      writeFileSync(join(dir, 'pnpm-workspace.yaml'), testCase.workspace)
      writeFileSync(join(dir, '.npmrc'), 'ignore-scripts=true\n')
      const before = {
        manifest: readFileSync(join(dir, 'package.json'), 'utf8'),
        patch: readFileSync(join(dir, PROFILE_PATCH_FILENAME), 'utf8'),
        workspace: readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8'),
        npmrc: readFileSync(join(dir, '.npmrc'), 'utf8'),
      }

      expect(() => materializeCuratedProfile('web-enterprise', home), testCase.name)
        .toThrow(/web-enterprise existing (?:manifest|patch|workspace|package-manager state) violates curated policy/u)
      expect(readFileSync(join(dir, 'package.json'), 'utf8')).toBe(before.manifest)
      expect(readFileSync(join(dir, PROFILE_PATCH_FILENAME), 'utf8')).toBe(before.patch)
      expect(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')).toBe(before.workspace)
      expect(readFileSync(join(dir, '.npmrc'), 'utf8')).toBe(before.npmrc)
    }
  })

  it('rejects additional effective rows for governed enterprise plugins before changing bytes', () => {
    type PatchEntry = {
      id?: string
      insert?: Array<{ id: string; name: string; config: Record<string, unknown> }>
    }
    const cases = [
      {
        name: 'mis-ID memento row',
        entry: {
          id: 'memento-copy',
          name: 'dsh-memento',
          config: {
            writePolicy: 'auto',
            writePolicies: {},
            proposals: { enabled: false },
          },
        },
      },
      {
        name: 'mis-ID LoongSuite row',
        entry: {
          id: 'loongsuite-copy',
          name: '@loongsuite/dsh-plugin',
          config: { captureContent: false },
        },
      },
      {
        name: 'duplicate checkpoint row',
        entry: {
          id: 'checkpoint-copy',
          name: 'dsh-checkpoint-rewind',
          config: {},
        },
      },
      {
        name: 'additional permission row',
        entry: {
          id: 'permission-rules-copy',
          name: 'dsh-permission-rules',
          config: { badFilePolicy: 'fail', enforce: true },
        },
      },
      {
        name: 'nested memento row',
        entry: {
          id: 'governed-group',
          name: '@deepseek-ai/cordis-plugin-group',
          group: true,
          config: [{
            id: 'nested-memento',
            name: 'dsh-memento',
            config: {
              writePolicy: 'ask',
              writePolicies: {},
              proposals: { enabled: false },
            },
          }],
        },
      },
    ] as const

    for (const testCase of cases) {
      const home = tmp()
      const dir = materializeCuratedProfile('web-enterprise', home)
      const patchPath = join(dir, PROFILE_PATCH_FILENAME)
      const patch = loadYaml(readFileSync(patchPath, 'utf8')) as PatchEntry[]
      writeFileSync(patchPath, `${JSON.stringify([
        ...patch,
        { insert: [testCase.entry] },
      ], null, 2)}\n`)
      const paths = ['package.json', PROFILE_PATCH_FILENAME, 'pnpm-workspace.yaml', '.npmrc'] as const
      const before = new Map(paths.map(path => [path, readFileSync(join(dir, path), 'utf8')]))

      expect(() => materializeCuratedProfile('web-enterprise', home), testCase.name).toThrow(
        'web-enterprise existing patch violates curated policy',
      )
      for (const [path, content] of before) {
        expect(readFileSync(join(dir, path), 'utf8'), `${testCase.name}: ${path}`).toBe(content)
      }
    }

  })

  it('accepts an existing enterprise workspace without build grants', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-enterprise', home)
    const workspacePath = join(dir, 'pnpm-workspace.yaml')
    const before = readFileSync(workspacePath, 'utf8')

    materializeCuratedProfile('web-enterprise', home)

    expect(readFileSync(workspacePath, 'utf8')).toBe(before)
  })

  it('accepts empty additional dependency collections', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
    manifest.optionalDependencies = {}
    manifest.bundledDependencies = []
    writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`)

    expect(() => materializeCuratedProfile('web-curated', home)).not.toThrow()
  })

  it('rejects config dependencies in an otherwise exact manifest without changing profile bytes', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-curated', home)
    const manifestPath = join(dir, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
    manifest.pnpm = { configDependencies: { '@pnpm/config-plugin': '1.0.0' } }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    const before = new Map(managedProfileFiles.map(file => [file, readFileSync(join(dir, file))]))

    expect(() => materializeCuratedProfile('web-curated', home)).toThrow(
      'web-curated existing package-manager state violates curated policy',
    )
    for (const [file, bytes] of before) expect(readFileSync(join(dir, file)), file).toEqual(bytes)
  })

  it('preserves every byte of an exact existing enterprise profile', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-enterprise', home)
    const paths = ['package.json', PROFILE_PATCH_FILENAME, 'pnpm-workspace.yaml', '.npmrc'] as const
    const before = new Map(paths.map(path => [path, readFileSync(join(dir, path), 'utf8')]))

    materializeCuratedProfile('web-enterprise', home)

    for (const [path, content] of before) expect(readFileSync(join(dir, path), 'utf8')).toBe(content)
  })

  it('leaves existing official web and headless profile bytes unchanged', () => {
    const home = tmp()
    const web = resolveProfileDir('web', home)
    const headless = resolveProfileDir('headless', home)
    initProfile(web, PROFILE_TEMPLATES.web ?? [])
    initProfile(headless, PROFILE_TEMPLATES.headless ?? [])
    const files = ['package.json', PROFILE_PATCH_FILENAME, 'pnpm-workspace.yaml'] as const
    const before = new Map(
      [web, headless].flatMap(dir => files.map(file => [`${dir}/${file}`, readFileSync(join(dir, file), 'utf8')])),
    )

    for (const profileName of profileNames) materializeCuratedProfile(profileName, home)

    for (const [path, content] of before) expect(readFileSync(path, 'utf8')).toBe(content)
  })
})

describe('curated profile composition', () => {
  it('loads actual curated services and a behavior fixture through the profile resolver', async () => {
    const harness = await bootCuratedBehaviorProfile()
    const { ctx } = harness
    try {
      expect(ctx.get('curatedPolicy')).toHaveProperty('listCandidates')
      expect(ctx.get('curatedBench')).toHaveProperty('listAssets')

      const success = await harness.fixture().run('success')
      expect(success.order).toEqual(['pre-execute', 'execute', 'side-effect'])
      expect(success.events).toEqual(expect.arrayContaining(['tool/call', 'tool/result']))

      const beforeDenied = harness.fixture().sideEffects()
      const denied = await harness.fixture().run('approval-denied')
      expect(denied.result).toMatchObject({ isError: true })
      expect(denied.order).toEqual(['pre-execute'])
      expect(denied.events).toEqual(expect.arrayContaining([
        'approval/asked',
        'approval/decided',
        'tool/call',
        'tool/result',
      ]))
      expect(harness.fixture().sideEffects()).toBe(beforeDenied)

      await harness.entry.update({ disabled: true })
      await ctx.loader.await()
      expect(ctx.get('curatedBehaviorFixture')).toBeUndefined()
      expect(ctx.tools.schemas().some(tool => tool.name === 'curated_fixture')).toBe(false)

      await harness.entry.update({ disabled: false })
      await ctx.loader.await()
      expect(ctx.get('curatedBehaviorFixture')).toBeDefined()
      expect(ctx.tools.schemas().some(tool => tool.name === 'curated_fixture')).toBe(true)

      await expect(harness.entry.update({
        config: { failInitialization: true, secret: 'sk-init-secret' },
      })).rejects.toThrow('candidate fixture-init stage initialization failed')
      expect(ctx.get('curatedBehaviorFixture')).toBeDefined()
      await expect(harness.fixture().run('success')).resolves.toMatchObject({
        result: { isError: false },
      })
    } finally {
      await ctx.fiber.dispose()
    }
    expect(ctx.get('curatedPolicy')).toBeUndefined()
    expect(ctx.get('curatedBench')).toBeUndefined()
    expect(ctx.get('curatedBehaviorFixture')).toBeUndefined()
  })
})

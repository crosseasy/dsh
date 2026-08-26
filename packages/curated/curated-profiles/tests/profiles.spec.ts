import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  initProfile,
  PROFILE_PATCH_FILENAME,
  PROFILE_TEMPLATES,
  readProfileManifest,
  resolveProfileDir,
} from '@deepseek-ai/dsh-app-boot'
import {
  CURATED_PROFILE_TEMPLATES,
  curatedProfileDependenciesForBundles,
  materializeCuratedProfile,
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

describe('curated profile templates', () => {
  it('materializes each profile from its active verified catalog candidates', () => {
    const policy = new CuratedPolicy(loadCuratedCatalog())
    const catalog = policy.listCandidates()

    for (const profileName of profileNames) {
      const candidates = policy.getProfileCandidates(profileName)
      const candidateBundles = candidates.map(candidate => candidate.expectedPackage ?? candidate.id)
      const dir = materializeCuratedProfile(profileName, tmp())
      const manifest = readProfileManifest('t', dir)
      const expected = profileName === 'web-personal' ? [...base] : [...base, ...candidateBundles]

      expect(manifest.dsh?.profile?.bundles).toEqual(expected)
      expect(Object.keys(manifest.dependencies ?? {})).toEqual(candidateBundles)
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
    expect(plannedBaseline.filter(candidate => candidate.active).map(candidate => candidate.id)).toEqual([
      'dsh-toolkit',
      'dsh-web-search-pro',
      'dsh-memento',
      'dsh-mcp-panel',
      'dsh-checkpoint-rewind',
      'dsh-lsp-actions',
      'dsh-permission-rules',
      'dsh-smooth-stream',
      'upstream-radar',
      'loongsuite-dsh-plugin',
    ])
    expect(plannedBaseline.filter(candidate => !candidate.active).every(candidate =>
      candidate.rejections.length > 0)).toBe(true)
  })

  it('writes only consumed candidate config and keeps an explicit empty patch when none is required', () => {
    const enterpriseDir = materializeCuratedProfile('web-enterprise', tmp())
    const patch = loadYaml(readFileSync(join(enterpriseDir, PROFILE_PATCH_FILENAME), 'utf8'))

    expect(patch).toEqual([
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
      .toEqual(['dsh-memento'])
    expect(readProfileManifest('t', research).dsh?.profile?.bundles).toEqual(
      expect.arrayContaining(['dsh-memento']),
    )
    expect(readProfileManifest('t', research).dsh?.profile?.bundles).not.toEqual(
      expect.arrayContaining(['dsh-mneme']),
    )

    const codingCandidates = policy.getProfileCandidates('web-coding')
    expect(codingCandidates.filter(candidate => candidate.capability === 'multi-agent-orchestration'))
      .toHaveLength(0)
    expect(readProfileManifest('t', coding).dsh?.profile?.bundles).not.toEqual(
      expect.arrayContaining(['dsh-agent-team-gui', 'dsh-background-agents']),
    )
  })

  it('registers the curated profile invariant and accepts checked-in templates', async () => {
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

  it('reports invariant failures when a profile drops the curated baseline or personal inherits baseline bundles', async () => {
    vi.resetModules()
    vi.doMock('../src/index.ts', () => ({
      CURATED_BASELINE_BUNDLES: Object.freeze(['dsh-toolkit']),
      CURATED_PROFILE_TEMPLATES: Object.freeze({
        'web-curated': Object.freeze({ bundles: Object.freeze(['base', 'policy']) }),
        'web-coding': Object.freeze({ bundles: Object.freeze(['base']) }),
        'web-research': Object.freeze({ bundles: Object.freeze(['base', 'policy']) }),
        'web-enterprise': Object.freeze({ bundles: Object.freeze(['base']) }),
        'web-personal': Object.freeze({ bundles: Object.freeze(['base', 'policy', 'dsh-toolkit']) }),
      }),
      curatedProfileDependenciesForBundles: () => ({}),
    }))
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
    registered.install?.(ctx, message => messages.push(message))
    expect(messages).toEqual([
      'profile web-coding must keep the curated baseline as its leading bundle list',
      'profile web-enterprise must keep the curated baseline as its leading bundle list',
      'profile web-personal must stay physically isolated from curated baseline and scenario bundles',
    ])
  })

  it('reports invariant failures when a template names a bundle outside the allowlist', async () => {
    vi.resetModules()
    vi.doMock('../src/index.ts', () => ({
      CURATED_BASELINE_BUNDLES: Object.freeze([]),
      CURATED_PROFILE_TEMPLATES: Object.freeze({
        'web-curated': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
        'web-coding': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
        'web-research': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
        'web-enterprise': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
        'web-personal': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
      }),
      curatedProfileDependenciesForBundles: () => {
        throw new Error('curated profile bundle "missing-bundle" has no checked-in dependency source')
      },
    }))
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
    registered.install?.(ctx, message => messages.push(message))
    expect(messages).toEqual([
      'curated profile bundle "missing-bundle" has no checked-in dependency source',
    ])
  })

  it('reports repeated dependency invariant failures once', async () => {
    vi.resetModules()
    const dependencyMessage = 'curated profile bundle "missing-bundle" has no checked-in dependency source'
    const dependencyChecks: string[][] = []
    vi.doMock('../src/index.ts', () => ({
      CURATED_BASELINE_BUNDLES: Object.freeze([]),
      CURATED_PROFILE_TEMPLATES: Object.freeze({
        'web-curated': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
        'web-coding': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
        'web-research': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
        'web-enterprise': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
        'web-personal': Object.freeze({ bundles: Object.freeze(['@deepseek-ai/dsh-base', 'missing-bundle']) }),
      }),
      curatedProfileDependenciesForBundles: (bundles: readonly string[]) => {
        dependencyChecks.push([...bundles])
        throw dependencyChecks.length === 1 ? new Error(dependencyMessage) : dependencyMessage
      },
    }))
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
    registered.install?.(ctx, message => messages.push(message))
    expect(dependencyChecks).toHaveLength(5)
    expect(messages).toEqual([dependencyMessage])
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
    expect(loadYaml(patch)).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'memento' }),
      expect.objectContaining({ id: 'permission-rules' }),
      expect.objectContaining({ id: 'loongsuite-observability' }),
    ]))
    expect(patch).not.toContain('enterprise:')
    expect(readFileSync(join(dir, 'pnpm-workspace.yaml'), 'utf8')).toContain('nodeLinker: hoisted')
    expect(readFileSync(join(dir, '.npmrc'), 'utf8')).toBe('ignore-scripts=true\n')
  })

  it('writes pinned install dependencies for non-installation bundle layers', () => {
    const home = tmp()
    const dir = materializeCuratedProfile('web-research', home)
    const manifest = readProfileManifest('t', dir) as CuratedProfileManifest
    const dependencies = manifest.dependencies ?? {}
    const sessionExportSpec = 'git+https://github.com/whyihaveyou/dsh-suite.git#acf9d2d960d2b9ac6ae8569a68836a087c2154ee'
      + '&path:packages/plugins/plugin-session-export'

    expect(Object.keys(dependencies)).toEqual(
      CURATED_PROFILE_TEMPLATES['web-research'].bundles.filter(bundle =>
        bundle !== '@deepseek-ai/dsh-base'
        && bundle !== '@deepseek-ai/dsh-web-app'
        && bundle !== '@deepseek-ai/dsh-curated-base',
      ),
    )
    expect(dependencies).toMatchObject({
      '@deepseek-ai/dsh-toolkit': 'git+https://github.com/omdsh-dev/dsh-toolkit.git#2113d11a4e4510720251aa49a800bab917b14330',
      '@dsh-suite/plugin-session-export': sessionExportSpec,
    })
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
  - expectedPackage: plugin-b
    repository: https://github.com/example/plugin-b
    repositoryPath: packages/plugin-b
    commit: "${fullSha}"
    sourceStatus: verified
    active: true
    rejections: []
    targetProfiles: [web-curated]
`))

    expect(profiles.curatedProfileDependenciesForBundles(['plugin-a', 'plugin-b'], 'web-curated')).toEqual({
      'plugin-a': `git+https://github.com/example/plugin-a.git#${fullSha}`,
      'plugin-b': `git+https://github.com/example/plugin-b.git#${fullSha}&path:packages/plugin-b`,
    })
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
      workspace: 'packages:\n  - user-package\n',
      npmrc: 'ignore-scripts=false\n',
    }
    writeFileSync(manifestPath, userFiles.manifest)
    writeFileSync(patchPath, userFiles.patch)
    writeFileSync(workspacePath, userFiles.workspace)
    writeFileSync(npmrcPath, userFiles.npmrc)
    materializeCuratedProfile('web-curated', home)
    expect(readFileSync(manifestPath, 'utf8')).toBe(userFiles.manifest)
    expect(readFileSync(patchPath, 'utf8')).toBe(userFiles.patch)
    expect(readFileSync(workspacePath, 'utf8')).toBe(userFiles.workspace)
    expect(readFileSync(npmrcPath, 'utf8')).toBe(userFiles.npmrc)
  })

  it('refuses enterprise materialization when an existing npmrc enables lifecycle scripts', () => {
    const home = tmp()
    const dir = resolveProfileDir('web-enterprise', home)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '.npmrc'), 'ignore-scripts=false\n')

    expect(() => materializeCuratedProfile('web-enterprise', home)).toThrow(
      'web-enterprise requires ignore-scripts=true in its existing .npmrc',
    )
    expect(readFileSync(join(dir, '.npmrc'), 'utf8')).toBe('ignore-scripts=false\n')
    expect(existsSync(join(dir, 'package.json'))).toBe(false)
    expect(existsSync(join(dir, PROFILE_PATCH_FILENAME))).toBe(false)
    expect(existsSync(join(dir, 'pnpm-workspace.yaml'))).toBe(false)
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

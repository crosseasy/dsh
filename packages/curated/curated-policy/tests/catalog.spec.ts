import { globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { load as loadYaml } from 'js-yaml'
import * as curatedPolicyPlugin from '@deepseek-ai/dsh-curated-policy'
import * as invariantPlugin from '@deepseek-ai/dsh-curated-policy/invariant'
import {
  CuratedPolicy,
  classifyAdmission,
  deriveCandidateStatus,
  formatYamlParseError,
  hasCompleteCurrentProfileActivationEvidence,
  isExactNpmVersion,
  loadCapabilityConflicts,
  loadCuratedCatalog,
  loadPermissionRules,
  redactSecretLikeValues,
  validateCandidateLock,
  validatePolicySemantics,
  validateProfileConflicts,
  type CuratedCandidate,
  type CuratedCatalog,
} from '@deepseek-ai/dsh-curated-policy'

interface Rejection {
  code: string
  evidence: string
}

interface Candidate {
  id: string
  priority: 'P0' | 'P1' | 'P2'
  capability: string
  repository: string
  repositoryPath: string | null
  commit: string
  sourceStatus: 'verified' | 'unreachable'
  auditedAt: string
  manifestPath: string | null
  expectedPackage: string | null
  nodeEngine: string | null
  nodeEngineEvidence: string | null
  requiresCorePatch: boolean | null
  license: string | null
  bundlePatch: string | null
  sourceContentSha256?: string
  treeSha256?: string
  runtimeDependencyClosureSha256?: string
  npmVersion?: string
  npmIntegrity?: string
  testFiles: number
  ciWorkflows: number
  installScripts: Record<string, string>
  externalDependencies: string[]
  requiredRuntimeBundles?: string[]
  networkAccess: string[]
  credentials: string[]
  targetProfiles: string[]
  scoreDimensions: {
    nativeCompatibility: number
    functionalCompleteness: number
    testAndCi: number
    securityAndPrivacy: number
    maintenanceHealth: number
    performanceCost: number
    operability: number
    communitySignal: number
  }
  score: number
  active: boolean
  auditWarnings: string[]
  rejections: Rejection[]
  resources?: {
    entryIds?: readonly string[]
    toolNames?: readonly string[]
    commandNames?: readonly string[]
    serviceKeys?: readonly string[]
    uiSlots?: readonly string[]
    settingsTabs?: readonly string[]
    routes?: readonly string[]
    ports?: readonly string[]
    sqlitePaths?: readonly string[]
    cacheDirs?: readonly string[]
    envVars?: readonly string[]
    waterfallListeners?: readonly string[]
    automationBehaviors?: readonly string[]
  }
  runtimeActivationEvidence?: Record<string, {
    keylessAssembledSnapshot: { path: string; sha256: string }
    requiredRuntimeBundles: string[]
    install: { path: string; sha256: string }
    enable: { path: string; sha256: string }
    restart: { path: string; sha256: string }
    disableOrUninstall: { path: string; sha256: string }
  }>
}

interface Catalog {
  schemaVersion: number
  source: {
    awesome: {
      repository: string
      commit: string
      file: string
    }
    matrix: string
  }
  candidates: Candidate[]
}

const expectedCandidates = {
  P0: [
    'dsh-toolkit',
    'dsh-context',
    'dsh-web-search-pro',
    'dsh-memento',
    'dsh-mcp-panel',
    'dsh-checkpoint-rewind',
    'dsh-lsp-actions',
    'dsh-permission-rules',
    'loongsuite-dsh-plugin',
    'dsh-config-manager',
  ],
  P1: [
    'dsh-smooth-stream',
    'upstream-radar',
    'dsh-plugin-hub',
    'dsh-plugin-guide',
    'dsh-plugin-check',
    'plugin-session-export',
    'dsh-better-sidebar',
    'dsh-free-web-search',
    'dsh-mcp-manager',
    'dsh-context-doctor',
    'dsh-cost-meter',
    'tokenledger',
    'dsh-chat-import',
    'dsh-message-edit',
    'dsh-auto-review',
    'plugin-notify',
  ],
  P2: [
    'dsh-agent-team-gui',
    'dsh-background-agents',
    'dsh-computer-use',
    'dsh-vision-router',
    'dsh-llm-fallbacks',
    'dsh-univer-office',
    'dsh-feishu',
    'dsh-mneme',
    'dsh-tabbit',
    'deepseek-harness-desktop',
    'martty',
  ],
} satisfies Record<Candidate['priority'], string[]>

type CandidateId = typeof expectedCandidates[keyof typeof expectedCandidates][number]
interface ProfileExpectation {
  readonly active: boolean
  readonly targetProfiles: readonly string[]
  readonly minimumScore: number
}

const expectedProfiles = {
  'dsh-toolkit': { active: false, targetProfiles: [], minimumScore: 85 },
  'dsh-context': { active: false, targetProfiles: [], minimumScore: 85 },
  'dsh-memento': { active: false, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-web-search-pro': { active: false, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-mcp-panel': { active: false, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-checkpoint-rewind': { active: false, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-lsp-actions': { active: false, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-permission-rules': { active: false, targetProfiles: [], minimumScore: 85 },
  'loongsuite-dsh-plugin': {
    active: false,
    targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'],
    minimumScore: 85,
  },
  'dsh-config-manager': { active: false, targetProfiles: [], minimumScore: 85 },
  'dsh-smooth-stream': { active: false, targetProfiles: [], minimumScore: 85 },
  'upstream-radar': { active: false, targetProfiles: [], minimumScore: 85 },
  'dsh-plugin-hub': { active: false, targetProfiles: [], minimumScore: 85 },
  'dsh-plugin-guide': { active: false, targetProfiles: [], minimumScore: 0 },
  'dsh-plugin-check': { active: false, targetProfiles: [], minimumScore: 85 },
  'plugin-session-export': { active: false, targetProfiles: [], minimumScore: 85 },
  'dsh-better-sidebar': { active: false, targetProfiles: ['web-coding'], minimumScore: 75 },
  'dsh-free-web-search': { active: false, targetProfiles: [], minimumScore: 64 },
  'dsh-mcp-manager': { active: false, targetProfiles: [], minimumScore: 64 },
  'dsh-context-doctor': { active: false, targetProfiles: [], minimumScore: 75 },
  'dsh-cost-meter': { active: false, targetProfiles: [], minimumScore: 64 },
  'tokenledger': { active: false, targetProfiles: [], minimumScore: 64 },
  'dsh-chat-import': { active: false, targetProfiles: [], minimumScore: 75 },
  'dsh-message-edit': { active: false, targetProfiles: [], minimumScore: 64 },
  'dsh-auto-review': { active: false, targetProfiles: [], minimumScore: 75 },
  'plugin-notify': { active: false, targetProfiles: [], minimumScore: 75 },
  'dsh-agent-team-gui': { active: false, targetProfiles: ['web-coding'], minimumScore: 75 },
  'dsh-background-agents': { active: false, targetProfiles: ['web-coding'], minimumScore: 75 },
  'dsh-computer-use': { active: false, targetProfiles: ['web-coding'], minimumScore: 75 },
  'dsh-vision-router': { active: false, targetProfiles: ['web-research'], minimumScore: 85 },
  'dsh-llm-fallbacks': { active: false, targetProfiles: [], minimumScore: 64 },
  'dsh-univer-office': { active: false, targetProfiles: ['web-research'], minimumScore: 75 },
  'dsh-feishu': { active: false, targetProfiles: [], minimumScore: 64 },
  'dsh-mneme': { active: false, targetProfiles: [], minimumScore: 64 },
  'dsh-tabbit': { active: false, targetProfiles: [], minimumScore: 64 },
  'deepseek-harness-desktop': { active: false, targetProfiles: [], minimumScore: 75 },
  'martty': { active: false, targetProfiles: [], minimumScore: 75 },
} satisfies Record<CandidateId, ProfileExpectation>

const curatedProfiles = [
  'web-curated',
  'web-coding',
  'web-research',
  'web-enterprise',
  'web-personal',
] as const

const authoritativePermissionOrder = [
  'core-sandbox',
  'permission-rules',
  'high-risk-approval-or-auto-review',
  'tool-execution',
  'result-audit',
] as const
const permissionOrderError = `permissions.order must exactly equal ${authoritativePermissionOrder.join(', ')}`

const expectedSourceContentSha256 = {
  'dsh-toolkit': '4674b31fa798d66629f4fcac7edad917c10e1b68b37a86103178a645747da14b',
  'dsh-context': '06fa51a9c04a462d7455debd18ba2bcd8e9cbc6dd32753cba1e687ed58722360',
  'dsh-web-search-pro': '10f5c774c9eae23337db8e4ecf5a5805243693a057b1074ef8ba639d74d1cd2f',
  'dsh-memento': '5e44a5e6e68c6364b2ebe91bd5ff13df27e71bf45e7f31a718850374ab5b6884',
  'dsh-mcp-panel': '8ff0d62a3eddb3857fc324d2c3bb5250048d04d4dca064864b3565fbea6a16eb',
  'dsh-checkpoint-rewind': '03c437ce36f67762d0f00b5df9243aa2e4a363e523c0c743953d5cf45a3abd27',
  'dsh-lsp-actions': '3fa924a6b928633f472f9321fe3b01af4c5f68e5ef452b7098e5471efe61ee58',
  'dsh-permission-rules': 'ac562528675cdbaf364856c1adb2785f3b0738a101ccfc578b93007fa4d14652',
  'dsh-smooth-stream': '1a0322713fafeaccbb77e92fa2673da363676516cde88512b4949b43299573c8',
  'upstream-radar': '211f62a59d2d28bef03e76728412a341b5c35890a6e58ce8f143d59fd18fc0b6',
  'dsh-plugin-hub': 'dc5ce2b08737a2e1941bcbe581fda063ab63cf3d89d5355cfc98a2b6f40efc87',
  'dsh-plugin-check': 'd0bb42f6664076960df363569f217da833082a9c3412edcbceebaf8deb145295',
  'plugin-session-export': 'da7f8e55285057328909c0db840d617aa8cf7e90a647d0bc7f5e79e15d985480',
  'loongsuite-dsh-plugin': '6bf862e166fc1a3547d8764db2759381b4ee99f4ca9856c4b1ad7c74ed37e893',
  'dsh-config-manager': 'b01aecfe0782bbcecd2d5cd60e897d162b79dde0cfe50d8ff6003e6568cdd06b',
  'dsh-better-sidebar': '16530eca80d7a25fce018da18d3ab2e1f3a2a44120fb89f39da2ee9383f0fcd2',
  'dsh-agent-team-gui': '1fa83ba2e1b638089f82ffb52527bba630127c1bd4f0076dd9c7cabbb20d999d',
  'dsh-background-agents': 'c5910d771b2a1eea8faf14ed5e88719da91f54f3ff4fc54dad1b477c95be9f07',
  'dsh-computer-use': '95a18b85e4c5b5097d2095096373bd99705bc26d63eb664c14b0e91ce3dc3f3e',
  'dsh-vision-router': '7e6a3492d703fc2ca2adc81f376485b23e8c018e5a227c2522e7bf70db909356',
  'dsh-llm-fallbacks': '61fd65893d6917c73c366ae5fc2c2480159b2ce56e2ebb9d5ce7a1995a65eacf',
  'dsh-univer-office': '6e1af85f2ba357fbeb6fa4f5adcfba7cc71efa056ef3b1ab2f33ce552f8fc8e6',
  'dsh-feishu': 'ff0f3da84d88036fbef2f80a936c93e28d4326b9f068b31cce19735e8661fae8',
} as const

function activationEvidence(
  profiles: readonly string[],
  requiredRuntimeBundles: readonly string[] = [],
): NonNullable<CuratedCandidate['runtimeActivationEvidence']> {
  const entries = profiles.map(profile => [profile, {
    keylessAssembledSnapshot: {
      path: 'evidence/assembled.json',
      sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
    requiredRuntimeBundles: [...requiredRuntimeBundles],
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
  }] as const)
  return Object.fromEntries(entries)
}

function candidate(overrides: Partial<CuratedCandidate>): CuratedCandidate {
  const targetProfiles = overrides.targetProfiles ?? ['web-curated']
  return {
    id: 'candidate-a',
    priority: 'P0',
    capability: 'web-search',
    repository: 'https://github.com/example/candidate-a',
    repositoryPath: null,
    commit: '0123456789abcdef0123456789abcdef01234567',
    sourceStatus: 'verified',
    auditedAt: '2026-08-25',
    manifestPath: 'package.json',
    expectedPackage: 'candidate-a',
    nodeEngine: '^22.19.0 || >=24.0.0',
    nodeEngineEvidence: 'package.json#engines.node',
    requiresCorePatch: false,
    license: 'MIT',
    bundlePatch: './cordis.patch.yml',
    sourceContentSha256: '23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01',
    treeSha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    runtimeDependencyClosureSha256: '89abcdef012345670123456789abcdef0123456789abcdef0123456701234567',
    testFiles: 1,
    ciWorkflows: 1,
    installScripts: {},
    externalDependencies: [],
    requiredRuntimeBundles: [],
    networkAccess: [],
    credentials: [],
    targetProfiles,
    active: true,
    auditWarnings: [],
    rejections: [],
    runtimeActivationEvidence: activationEvidence(targetProfiles),
    scoreDimensions: {
      nativeCompatibility: 18,
      functionalCompleteness: 14,
      testAndCi: 14,
      securityAndPrivacy: 14,
      maintenanceHealth: 8,
      performanceCost: 8,
      operability: 8,
      communitySignal: 4,
    },
    score: 88,
    ...overrides,
  }
}

function catalog(candidates: readonly CuratedCandidate[]): CuratedCatalog {
  return {
    schemaVersion: 2,
    source: {
      awesome: {
        repository: 'https://github.com/0xsline/awesome-deepseek-harness',
        commit: 'd904b7071f35f193a0b734421914109bc6103420',
        file: 'README.zh-CN.md',
      },
      matrix: 'docs/plugin/superpowers/02-插件矩阵与择优.md',
    },
    candidates,
  }
}

function withSourceCommit(commit: string): CuratedCatalog {
  const base = catalog([])
  return {
    ...base,
    source: {
      ...base.source,
      awesome: {
        ...base.source.awesome,
        commit,
      },
    },
  }
}

function withTempFile<T>(content: string, callback: (filePath: string) => T): T {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-curated-catalog-'))
  const filePath = join(directory, 'catalog.yaml')
  try {
    writeFileSync(filePath, content)
    return callback(filePath)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

function rawCatalog(candidateOverrides: Record<string, unknown>): string {
  return JSON.stringify({
    ...catalog([]),
    candidates: [
      {
        ...candidate({}),
        ...candidateOverrides,
      },
    ],
  })
}

function writePolicyFixture(
  fixtureCatalog: CuratedCatalog,
  conflicts: Record<string, unknown>,
  permissions: Record<string, unknown>,
): {
  readonly directory: string
  readonly catalogPath: string
  readonly conflictPath: string
  readonly permissionRulesPath: string
} {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-curated-policy-fixture-'))
  const catalogPath = join(directory, 'catalog.yaml')
  const conflictPath = join(directory, 'conflicts.yaml')
  const permissionRulesPath = join(directory, 'permission-rules.yaml')
  writeFileSync(catalogPath, JSON.stringify(fixtureCatalog))
  writeFileSync(conflictPath, JSON.stringify(conflicts))
  writeFileSync(permissionRulesPath, JSON.stringify(permissions))
  return { directory, catalogPath, conflictPath, permissionRulesPath }
}

describe('curated plugin catalog', () => {
  afterEach(() => {
    vi.doUnmock('node:fs')
    vi.resetModules()
  })

  test('records the complete P0, P1, and P2 candidate set', () => {
    const catalog = loadCuratedCatalog() as Catalog

    expect(catalog.schemaVersion).toBe(2)
    expect(catalog.source.awesome.repository).toBe('https://github.com/0xsline/awesome-deepseek-harness')
    expect(catalog.source.awesome.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(catalog.source.awesome.file).toBe('README.zh-CN.md')
    expect(catalog.source.matrix).toBe('docs/plugin/superpowers/02-插件矩阵与择优.md')

    for (const [priority, ids] of Object.entries(expectedCandidates)) {
      expect(catalog.candidates.filter(candidate => candidate.priority === priority).map(candidate => candidate.id))
        .toEqual(ids)
    }
  })

  test('assigns P0, P1, and P2 candidates to active profiles according to the superpowers roadmap', () => {
    const catalog = loadCuratedCatalog() as Catalog
    const byId = new Map(catalog.candidates.map(candidate => [candidate.id, candidate]))

    for (const [id, expected] of Object.entries(expectedProfiles) as [CandidateId, ProfileExpectation][]) {
      const candidate = byId.get(id)
      expect(candidate).toBeDefined()
      expect(candidate?.active).toBe(expected.active)
      expect(candidate?.targetProfiles).toEqual(expected.targetProfiles)
      expect(candidate?.score).toBeGreaterThanOrEqual(expected.minimumScore)
      if (candidate !== undefined) {
        expect(classifyAdmission(candidate.score ?? Number.NaN, candidate.rejections.map(rejection => rejection.code)))
          .toBe(candidate.rejections.length > 0 ? 'rejected' : expected.minimumScore >= 85 ? 'default' : expected.minimumScore >= 75 ? 'scenario' : 'experimental')
      }
      if (!expected.active) expect(candidate?.rejections.length).toBeGreaterThan(0)
    }
  })

  test('keeps each profile to one active provider per capability domain', () => {
    const catalog = loadCuratedCatalog()

    for (const profile of curatedProfiles) {
      expect(validateProfileConflicts(catalog, profile)).toEqual([])
    }
  })

  test('records machine-verifiable audit facts for every candidate', () => {
    const catalog = loadCuratedCatalog() as Catalog
    const ids = catalog.candidates.map(candidate => candidate.id)

    expect(new Set(ids).size).toBe(ids.length)
    for (const candidate of catalog.candidates) {
      expect(candidate.id).toMatch(/^[a-z0-9-]+$/)
      expect(candidate.capability).not.toBe('')
      expect(candidate.repository).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/)
      expect(candidate.repositoryPath === null || candidate.repositoryPath.length > 0).toBe(true)
      expect(candidate.commit).toMatch(/^[0-9a-f]{40}$/)
      expect(['verified', 'unreachable']).toContain(candidate.sourceStatus)
      expect(candidate.auditedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(candidate.manifestPath === null || candidate.manifestPath.endsWith('package.json')).toBe(true)
      expect(candidate.expectedPackage === null || candidate.expectedPackage.length > 0).toBe(true)
      expect(candidate.nodeEngine === null || candidate.nodeEngine.length > 0).toBe(true)
      expect(candidate.nodeEngineEvidence === null || candidate.nodeEngineEvidence.length > 0).toBe(true)
      expect(candidate.requiresCorePatch === null || typeof candidate.requiresCorePatch === 'boolean').toBe(true)
      expect(Object.keys(candidate.scoreDimensions)).toHaveLength(8)
      expect(Object.values(candidate.scoreDimensions).reduce((total, value) => total + value, 0))
        .toBe(candidate.score)
      expect(candidate.license === null || candidate.license.length > 0).toBe(true)
      expect(candidate.bundlePatch === null || candidate.bundlePatch.length > 0).toBe(true)
      if (candidate.sourceStatus === 'verified') {
        expect(candidate.sourceContentSha256).toMatch(/^[0-9a-f]{64}$/)
      } else {
        expect(candidate.sourceContentSha256).toBeUndefined()
      }
      expect(candidate.testFiles).toBeGreaterThanOrEqual(0)
      expect(candidate.ciWorkflows).toBeGreaterThanOrEqual(0)
      expect(candidate.installScripts).toBeTypeOf('object')
      expect(Array.isArray(candidate.externalDependencies)).toBe(true)
      expect(Array.isArray(candidate.networkAccess)).toBe(true)
      expect(Array.isArray(candidate.credentials)).toBe(true)
      expect(Array.isArray(candidate.targetProfiles)).toBe(true)
      expect(Array.isArray(candidate.auditWarnings)).toBe(true)
      expect(Array.isArray(candidate.rejections)).toBe(true)

      for (const rejection of candidate.rejections) {
        expect(rejection.code).toMatch(/^[a-z0-9-]+$/)
        expect(rejection.evidence).not.toBe('')
      }
      if (candidate.rejections.length > 0) expect(candidate.active).toBe(false)
      if (!candidate.active && (
        candidate.manifestPath === null
        || candidate.expectedPackage === null
        || candidate.license === null
        || candidate.bundlePatch === null
      )) {
        expect(candidate.rejections.length).toBeGreaterThan(0)
      }
    }
  })

  test('records the Task 20 audit date for every candidate', () => {
    expect(new Set(loadCuratedCatalog().candidates.map(candidate => candidate.auditedAt)))
      .toEqual(new Set(['2026-08-27']))
  })

  test('pins the normalized source content for every reachable commit', () => {
    const actual = Object.fromEntries(loadCuratedCatalog().candidates
      .filter(candidate => candidate.sourceStatus === 'verified')
      .map(candidate => [candidate.id, candidate.sourceContentSha256]))

    expect(actual).toEqual(expectedSourceContentSha256)
  })

  test('accepts the checked-in allowlist as a valid candidate lock', () => {
    expect(validateCandidateLock(loadCuratedCatalog())).toEqual([])
  })

  test('matches fresh source, license, and install metadata evidence', () => {
    const byId = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.id, candidate]))

    expect(byId.get('dsh-toolkit')?.repository).toBe('https://github.com/omdsh-dev/dsh-toolkit')
    expect(byId.get('dsh-plugin-guide')?.repository).toBe('https://github.com/PerryLink/dsh-plugin-guide')
    expect(byId.get('dsh-plugin-check')).toMatchObject({
      repository: 'https://github.com/omdsh-dev/dsh-plugin-check',
      installScripts: { prepack: 'npm run build' },
    })
    expect(byId.get('dsh-better-sidebar')?.repository).toBe('https://github.com/omdsh-dev/DSH-better-sidebar')
    expect(byId.get('dsh-free-web-search')?.repository).toBe('https://github.com/delef/dsh-free-web-search')
    expect(byId.get('dsh-mneme')?.repository).toBe('https://github.com/modusensus/dsh-mneme')
    expect(byId.get('dsh-mcp-manager')?.repository).toBe('https://github.com/hyqhyq3/dsh-mcp-manager')
    expect(byId.get('dsh-tabbit')?.repository).toBe('https://github.com/Tabbit-Browser/dsh-tabbit')
    expect(byId.get('dsh-context-doctor')?.repository).toBe('https://github.com/Zhenyu98/dsh-context-doctor')
    expect(byId.get('dsh-cost-meter')?.repository).toBe('https://github.com/Han-1413141/dsh-cost-meter')
    expect(byId.get('tokenledger')?.repository).toBe('https://github.com/zh667/TokenLedger')
    expect(byId.get('dsh-chat-import')?.repository).toBe('https://github.com/Nwflower/dsh-chat-import')
    expect(byId.get('dsh-auto-review')?.repository).toBe('https://github.com/PerryLink/dsh-auto-review')
    expect(byId.get('plugin-notify')).toMatchObject({
      repository: 'https://github.com/whyihaveyou/dsh-suite',
      repositoryPath: 'packages/plugins/plugin-notify',
    })
    expect(byId.get('martty')?.repository).toBe('https://github.com/openma-ai/Martty')
    expect(byId.get('dsh-llm-fallbacks')?.license).toBe('MIT')
    expect(byId.get('dsh-permission-rules')?.installScripts).toEqual({
      prepare: 'node scripts/prepare.mjs',
    })
    expect(byId.get('dsh-context')?.externalDependencies).toEqual([
      '@deepseek-ai/cordis',
      '@deepseek-ai/dsh-client-ui-primitives',
      '@deepseek-ai/dsh-session',
      '@deepseek-ai/dsh-settings',
      '@deepseek-ai/schemastery',
      'react',
      'zod',
    ])
    expect(byId.get('dsh-plugin-check')).toMatchObject({
      installScripts: { prepack: 'npm run build' },
      externalDependencies: [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-invariants',
        '@deepseek-ai/dsh-tools',
      ],
    })
    expect(byId.get('dsh-agent-team-gui')?.installScripts).toEqual({
      prepack: 'pnpm run build',
      prepare: 'pnpm run build',
    })
    expect(byId.get('dsh-llm-fallbacks')?.auditWarnings).toContain(
      'package.json omits license metadata; the pinned repository LICENSE file contains the MIT license',
    )
  })

  test('records the complete dependency union for corrected pinned manifests', () => {
    const byId = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.id, candidate]))
    const expected = {
      'dsh-config-manager': [
        '@deepseek-ai/dsh-agent-presets',
        '@deepseek-ai/dsh-client-connection',
        '@deepseek-ai/dsh-client-locale',
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-ui-settings',
        '@deepseek-ai/dsh-client-ui-slots',
        '@deepseek-ai/dsh-credentials',
        '@deepseek-ai/dsh-home-paths',
        '@deepseek-ai/dsh-host-plugin-inventory',
        '@deepseek-ai/dsh-host-webserver',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-settings',
        '@deepseek-ai/dsh-system-prompt',
        '@deepseek-ai/dsh-tools',
        'js-yaml',
        'react',
        'react-dom',
      ],
      'dsh-better-sidebar': [
        '@codemirror/commands',
        '@codemirror/lang-cpp',
        '@codemirror/lang-css',
        '@codemirror/lang-go',
        '@codemirror/lang-html',
        '@codemirror/lang-java',
        '@codemirror/lang-javascript',
        '@codemirror/lang-json',
        '@codemirror/lang-markdown',
        '@codemirror/lang-php',
        '@codemirror/lang-python',
        '@codemirror/lang-rust',
        '@codemirror/lang-sql',
        '@codemirror/lang-vue',
        '@codemirror/lang-xml',
        '@codemirror/lang-yaml',
        '@codemirror/language',
        '@codemirror/legacy-modes',
        '@codemirror/search',
        '@codemirror/state',
        '@codemirror/view',
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-agent',
        '@deepseek-ai/dsh-client-locale',
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-ui-conversation',
        '@deepseek-ai/dsh-client-ui-primitives',
        '@deepseek-ai/dsh-client-ui-settings',
        '@deepseek-ai/dsh-client-ui-slots',
        '@deepseek-ai/dsh-host-webserver',
        '@deepseek-ai/dsh-invariants',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-session',
        '@deepseek-ai/dsh-settings',
        '@deepseek-ai/dsh-subagent',
        '@deepseek-ai/dsh-tools',
        '@huanlin/dsh-plugin-better-locale',
        '@lezer/highlight',
        'clsx',
        'dompurify',
        'mermaid',
        'node-pty',
        'react',
        'react-dom',
        'react-icons',
        'rxjs',
        '@deepseek-ai/schemastery',
        'ws',
      ],
      'dsh-agent-team-gui': [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-agent',
        '@deepseek-ai/dsh-brand',
        '@deepseek-ai/dsh-client-connection',
        '@deepseek-ai/dsh-client-locale',
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-ui-conversation',
        '@deepseek-ai/dsh-client-ui-settings',
        '@deepseek-ai/dsh-client-ui-slots',
        '@deepseek-ai/dsh-host-apiproxy',
        '@deepseek-ai/dsh-jobs',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-session',
        '@deepseek-ai/dsh-storage',
        '@deepseek-ai/dsh-storage-domain',
        '@deepseek-ai/dsh-subagent',
        '@deepseek-ai/dsh-system-prompt',
        '@deepseek-ai/dsh-tools',
        '@deepseek-ai/schemastery',
        'react',
        'zod',
      ],
      'dsh-background-agents': [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-commands',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-session',
        '@deepseek-ai/dsh-storage',
        '@deepseek-ai/dsh-storage-domain',
        '@deepseek-ai/dsh-storage-json',
        '@deepseek-ai/dsh-subagent',
        '@deepseek-ai/dsh-tools',
        '@deepseek-ai/schemastery',
        'zod',
      ],
      'dsh-computer-use': [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-agent',
        '@deepseek-ai/dsh-subprocess',
        '@deepseek-ai/dsh-system-prompt',
        '@deepseek-ai/dsh-tools',
        '@deepseek-ai/schemastery',
        'playwright-core',
      ],
      'dsh-vision-router': [
        '@deepseek-ai/dsh-anonymous-user-id',
        '@deepseek-ai/dsh-llm-deepseek',
        '@deepseek-ai/schemastery',
        'potrace',
        'puppeteer-core',
        'sharp',
        'undici',
      ],
      'dsh-llm-fallbacks': [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-agent',
        '@deepseek-ai/dsh-api-gateway',
        '@deepseek-ai/dsh-api-remotes',
        '@deepseek-ai/dsh-client-connection',
        '@deepseek-ai/dsh-client-locale',
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-ui-conversation',
        '@deepseek-ai/dsh-client-ui-primitives',
        '@deepseek-ai/dsh-client-ui-settings',
        '@deepseek-ai/dsh-client-ui-settings-plugins',
        '@deepseek-ai/dsh-client-ui-slots',
        '@deepseek-ai/dsh-commands',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-session',
        '@deepseek-ai/dsh-settings',
        '@deepseek-ai/dsh-typert-protocol',
        '@deepseek-ai/dsh-typert-registry',
        '@deepseek-ai/schemastery',
        'react',
        'use-sync-external-store',
      ],
      'dsh-univer-office': [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-attachment',
        '@deepseek-ai/dsh-host-webserver',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-session',
        '@deepseek-ai/dsh-skill',
        '@deepseek-ai/dsh-tools',
        '@deepseek-ai/schemastery',
        '@puppeteer/browsers',
        '@univerjs-pro/cli-assets',
        '@univerjs-pro/engine-formula-rust-binding',
        '@univerjs-pro/exchange-node-binding',
        'libsql',
        'puppeteer-core',
      ],
      'dsh-feishu': [
        '@deepseek-ai/cordis',
        '@deepseek-ai/dsh-agent',
        '@deepseek-ai/dsh-commands',
        '@deepseek-ai/dsh-credentials',
        '@deepseek-ai/dsh-invariants',
        '@deepseek-ai/dsh-llm',
        '@deepseek-ai/dsh-schedule',
        '@deepseek-ai/dsh-scope',
        '@deepseek-ai/dsh-session',
        '@deepseek-ai/dsh-storage',
        '@deepseek-ai/dsh-storage-domain',
        '@deepseek-ai/dsh-storage-json',
        '@deepseek-ai/dsh-timeout',
        '@deepseek-ai/dsh-tools',
        '@deepseek-ai/dsh-user-approval',
        '@deepseek-ai/dsh-user-questions',
        '@deepseek-ai/dsh-workspace',
        '@deepseek-ai/schemastery',
        '@larksuiteoapi/node-sdk',
        'axios',
        'js-yaml',
        'markdown-it',
        'qrcode-terminal',
      ],
    } as const

    for (const [id, dependencies] of Object.entries(expected)) {
      expect(byId.get(id)?.externalDependencies, id).toEqual(dependencies)
    }
  })

  test('uses verified prebuilt npm artifacts and rejects candidates without matching safe artifacts', () => {
    const byId = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.id, candidate]))

    expect(byId.get('dsh-web-search-pro')).toMatchObject({
      npmVersion: '0.1.10',
      npmIntegrity: 'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ==',
      installScripts: {},
    })
    expect(byId.get('dsh-mcp-panel')).toMatchObject({
      npmVersion: '0.5.1',
      npmIntegrity: 'sha512-CnCzRD043IP8JV2KvyaVUBVMz26uwRAUHt9+srovyycorZ6RW58EcuURcG4pr4zXJddNSt0+O7iJbNDQ1fgdsg==',
      installScripts: {},
    })
    expect(byId.get('dsh-checkpoint-rewind')).toMatchObject({
      npmVersion: '0.5.5',
      npmIntegrity: 'sha512-dKUMlFfDk+K4rezHcgKMlLCBtS/ShW2A6w9ZBmPqJGeVegXxsUXrfgwNRmptqiSkRWzrP3SrbPwpiKYjDs+J5g==',
      installScripts: { prepack: 'npm test' },
    })
    expect(byId.get('dsh-lsp-actions')).toMatchObject({
      npmVersion: '0.3.4',
      npmIntegrity: 'sha512-JUMLUxtSoFsnzn88XBeyUbFrDSNBrT7V+GnaFWozjfe4rPncFaKGKun6T8E9cyAM1W914qgIj3n5X4CMa/0+rg==',
    })
    expect(byId.get('dsh-permission-rules')).toMatchObject({
      npmVersion: '0.5.5',
      npmIntegrity: 'sha512-gWGzVycnbVSxbqGCp4AicaMTpo9fejmIxICVPwLk72wAepnrrncSuHUsm5Zzdjg/kBCAnRz7KEx3StQqTbesyg==',
      active: false,
      targetProfiles: [],
      rejections: [{
        code: 'artifact-permission-enforcement-disabled',
      }],
    })
    expect(byId.get('dsh-permission-rules')?.rejections[0]?.evidence).toContain('enforce')
    expect(byId.get('loongsuite-dsh-plugin')).toMatchObject({
      npmVersion: '0.1.1',
      npmIntegrity: 'sha512-wQmSzOzyjp0rd3XKFmcK+vXRETqVr0V7xL5qh8El2RujteV4Gkc1vz1OxTG12lQZrjKVWV5ixRRJU1HDlBafog==',
      targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'],
    })
    expect(byId.get('dsh-smooth-stream')).toMatchObject({
      active: false,
      targetProfiles: [],
      rejections: [{
        code: 'npm-artifact-source-mismatch',
      }],
    })
    expect(byId.get('dsh-smooth-stream')?.rejections[0]?.evidence).toContain('v0.3.4')
    expect(byId.get('dsh-toolkit')).toMatchObject({
      active: false,
      targetProfiles: [],
      rejections: [{
        code: 'prebuilt-package-unavailable',
      }],
    })
    expect(byId.get('dsh-toolkit')?.rejections[0]?.evidence).toContain('@deepseek-ai/dsh-toolkit')
    expect(byId.get('upstream-radar')).toMatchObject({
      active: false,
      targetProfiles: [],
      rejections: [{
        code: 'npm-artifact-source-mismatch',
      }],
    })
    expect(byId.get('upstream-radar')?.rejections[0]?.evidence).toContain('v0.43.5')
  })

  test('keeps candidates without assembled keyless snapshots out of runtime profiles', () => {
    const byId = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.id, candidate]))
    const staticCandidates = [
      'dsh-web-search-pro',
      'dsh-memento',
      'dsh-mcp-panel',
      'dsh-checkpoint-rewind',
      'dsh-lsp-actions',
      'loongsuite-dsh-plugin',
    ] as const

    for (const id of staticCandidates) {
      const candidate = byId.get(id)
      expect(candidate?.active, id).toBe(false)
      expect(candidate?.rejections.map(rejection => rejection.code), id)
        .toContain('assembled-keyless-snapshot-missing')
    }
    const dependencyRejection = byId.get('dsh-web-search-pro')?.rejections
      .find(rejection => rejection.code === 'required-runtime-dependency-missing')
    expect(dependencyRejection?.evidence).toContain('@anweat/dsh-browser')
  })

  test('matches exact observed metadata for the Wave 3B pinned candidates', () => {
    const byId = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.id, candidate]))
    const expected = {
      'dsh-toolkit': {
        sourceContentSha256: expectedSourceContentSha256['dsh-toolkit'],
        externalDependencies: [
          '@deepseek-ai/cordis',
          '@deepseek-ai/dsh-invariants',
          '@deepseek-ai/dsh-tools',
        ],
        entryIds: ['tool-kit'],
      },
      'dsh-web-search-pro': {
        sourceContentSha256: expectedSourceContentSha256['dsh-web-search-pro'],
        externalDependencies: [
          '@anweat/dsh-browser',
          '@deepseek-ai/cordis',
          '@deepseek-ai/dsh-client-connection',
          '@deepseek-ai/dsh-client-locale',
          '@deepseek-ai/dsh-client-runtime',
          '@deepseek-ai/dsh-client-ui-settings',
          '@deepseek-ai/dsh-client-ui-settings-plugins',
          '@deepseek-ai/dsh-client-ui-slots',
          '@deepseek-ai/dsh-credentials',
          '@deepseek-ai/dsh-settings',
          '@deepseek-ai/dsh-tools',
          '@deepseek-ai/schemastery',
          'cross-spawn',
          'js-yaml',
          'jsdom',
        ],
        entryIds: ['web-search-pro'],
      },
      'dsh-memento': {
        sourceContentSha256: expectedSourceContentSha256['dsh-memento'],
        externalDependencies: [
          '@deepseek-ai/cordis',
          '@deepseek-ai/dsh-session',
          '@deepseek-ai/dsh-tools',
          '@deepseek-ai/schemastery',
        ],
        entryIds: ['memento'],
      },
      'dsh-mcp-panel': {
        sourceContentSha256: expectedSourceContentSha256['dsh-mcp-panel'],
        externalDependencies: [
          '@deepseek-ai/cordis',
          '@deepseek-ai/cordis-plugin-loader',
          '@deepseek-ai/dsh-commands',
          '@deepseek-ai/dsh-jobs',
          '@deepseek-ai/dsh-subprocess',
          '@deepseek-ai/dsh-tools',
          '@deepseek-ai/dsh-typert-protocol',
          '@deepseek-ai/schemastery',
          'tsdown',
          'typescript',
          'zod',
        ],
        entryIds: ['mcp-panel'],
      },
      'dsh-checkpoint-rewind': {
        sourceContentSha256: expectedSourceContentSha256['dsh-checkpoint-rewind'],
        externalDependencies: [
          '@deepseek-ai/cordis',
          '@deepseek-ai/dsh-llm',
          '@deepseek-ai/dsh-session',
          '@deepseek-ai/dsh-storage-domain',
          '@deepseek-ai/dsh-tools',
          '@deepseek-ai/dsh-typert-protocol',
          '@deepseek-ai/schemastery',
          'zod',
        ],
        entryIds: ['checkpoint-rewind'],
      },
      'dsh-lsp-actions': {
        sourceContentSha256: expectedSourceContentSha256['dsh-lsp-actions'],
        externalDependencies: [
          '@deepseek-ai/cordis',
          '@deepseek-ai/dsh-fs',
          '@deepseek-ai/dsh-llm',
          '@deepseek-ai/dsh-sandbox',
          '@deepseek-ai/dsh-subprocess',
          '@deepseek-ai/dsh-tools',
          '@deepseek-ai/schemastery',
        ],
        entryIds: ['lsp-actions'],
      },
      'dsh-permission-rules': {
        sourceContentSha256: expectedSourceContentSha256['dsh-permission-rules'],
        externalDependencies: [
          '@deepseek-ai/cordis',
          '@deepseek-ai/dsh-agent',
          '@deepseek-ai/dsh-commands',
          '@deepseek-ai/dsh-llm',
          '@deepseek-ai/dsh-session',
          '@deepseek-ai/dsh-tools',
          '@deepseek-ai/dsh-typert-protocol',
          '@deepseek-ai/schemastery',
          '@types/react',
          'chokidar',
          'react',
          'tsdown',
          'typescript',
          'yaml',
          'zod',
        ],
        entryIds: ['permission-rules'],
      },
      'dsh-smooth-stream': {
        sourceContentSha256: expectedSourceContentSha256['dsh-smooth-stream'],
        externalDependencies: [
          '@deepseek-ai/cordis',
          '@deepseek-ai/dsh-client-connection',
          '@deepseek-ai/dsh-client-locale',
          '@deepseek-ai/dsh-client-runtime',
          '@deepseek-ai/dsh-client-ui-attachment',
          '@deepseek-ai/dsh-client-ui-conversation',
          '@deepseek-ai/dsh-client-ui-primitives',
          '@deepseek-ai/dsh-client-ui-settings',
          '@deepseek-ai/dsh-client-ui-settings-plugins',
          '@deepseek-ai/dsh-client-ui-slots',
          '@deepseek-ai/dsh-host-webserver',
          '@deepseek-ai/dsh-settings',
          '@deepseek-ai/schemastery',
          'react',
        ],
        entryIds: ['smooth-stream'],
      },
      'upstream-radar': {
        sourceContentSha256: expectedSourceContentSha256['upstream-radar'],
        externalDependencies: [],
        entryIds: ['upstream-radar'],
      },
      'plugin-session-export': {
        sourceContentSha256: expectedSourceContentSha256['plugin-session-export'],
        externalDependencies: [
          '@deepseek-ai/cordis',
          '@deepseek-ai/dsh-session',
          '@deepseek-ai/dsh-tools',
        ],
        entryIds: ['plugin-session-export'],
      },
      'loongsuite-dsh-plugin': {
        sourceContentSha256: expectedSourceContentSha256['loongsuite-dsh-plugin'],
        externalDependencies: [
          '@deepseek-ai/schemastery',
          '@loongsuite/otel-util-genai',
          '@opentelemetry/api',
          '@opentelemetry/exporter-metrics-otlp-proto',
          '@opentelemetry/exporter-trace-otlp-proto',
          '@opentelemetry/resources',
          '@opentelemetry/sdk-metrics',
          '@opentelemetry/sdk-trace-base',
          '@opentelemetry/semantic-conventions',
        ],
        entryIds: ['loongsuite-observability'],
      },
    } as const

    for (const [id, metadata] of Object.entries(expected)) {
      expect(byId.get(id), id).toMatchObject({
        sourceContentSha256: metadata.sourceContentSha256,
        externalDependencies: metadata.externalDependencies,
        resources: { entryIds: metadata.entryIds },
      })
    }
  })

  test('rejects session export because its installed package manifest has no Node engine', () => {
    const candidate = loadCuratedCatalog().candidates.find(candidate => candidate.id === 'plugin-session-export')

    expect(candidate).toMatchObject({
      manifestPath: 'package.json',
      nodeEngine: null,
      nodeEngineEvidence: null,
      targetProfiles: [],
      active: false,
      rejections: [{
        code: 'node-compatibility-unverified',
        evidence: 'the installed package manifest does not declare engines.node; repository-root metadata is not package evidence',
      }],
    })
  })

  test('records exact entry ids and available safety config for audited candidates', () => {
    const byId = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.id, candidate]))

    expect(byId.get('dsh-memento')).toMatchObject({
      active: false,
      resources: { entryIds: ['memento'] },
      config: {
        entryId: 'memento',
        values: {
          writePolicy: 'ask',
          writePolicies: {},
          proposals: { enabled: false, maxChars: 2000, maxPending: 8 },
        },
      },
      rejections: [expect.objectContaining({ code: 'assembled-keyless-snapshot-missing' })],
    })
    expect(byId.get('dsh-permission-rules')).toMatchObject({
      active: false,
      resources: { entryIds: ['permission-rules'] },
      config: {
        entryId: 'permission-rules',
        values: {
          rulesFile: '.dsh/rules.yaml',
          badFilePolicy: 'fail',
          maxRules: 256,
          patternMode: 'glob',
          watch: true,
          enforce: true,
        },
      },
      rejections: [expect.objectContaining({ code: 'artifact-permission-enforcement-disabled' })],
    })
    expect(byId.get('loongsuite-dsh-plugin')).toMatchObject({
      active: false,
      installScripts: { prepack: 'pnpm run build' },
      resources: { entryIds: ['loongsuite-observability'] },
      config: {
        entryId: 'loongsuite-observability',
        values: { captureContent: false },
      },
      rejections: [expect.objectContaining({ code: 'assembled-keyless-snapshot-missing' })],
    })
  })

  test('keeps candidates without enforceable profile controls inactive with precise evidence', () => {
    const byId = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.id, candidate]))

    for (const id of [
      'dsh-context',
      'dsh-config-manager',
    ]) {
      expect(byId.get(id)).toMatchObject({
        active: false,
        targetProfiles: [],
      })
      expect(byId.get(id)?.rejections).not.toEqual([])
    }
    expect(byId.get('dsh-config-manager')?.rejections).toEqual([{
      code: 'profile-safety-control-unavailable',
      evidence: 'the pinned plugin config has no dry-run or execution-confirmation field; import execution is guarded only by the operation-level confirm input',
    }])
  })

  test('loads a catalog from an explicit YAML file', () => {
    const loaded = withTempFile(JSON.stringify(catalog([
      candidate({ id: 'from-file' }),
      candidate({
        id: 'from-file-resources',
        capability: 'memory',
        resources: {
          entryIds: ['entry-a'],
          toolNames: ['tool_a'],
          commandNames: ['command:a'],
          serviceKeys: ['service.a'],
          uiSlots: ['slot:a'],
          settingsTabs: ['settings:a'],
          routes: ['/curated/a'],
          ports: ['127.0.0.1:8080'],
          sqlitePaths: ['state/resourceful.sqlite'],
          cacheDirs: ['cache/resourceful'],
          envVars: ['RESOURCEFUL_TOKEN'],
          waterfallListeners: ['tools/pre-execute:next'],
          automationBehaviors: ['auto-memory'],
        },
      }),
      candidate({
        id: 'from-file-sparse-resources',
        capability: 'terminal',
        resources: {
          entryIds: ['entry-sparse'],
        },
      }),
    ])), filePath => loadCuratedCatalog(filePath))

    expect(loaded.candidates.map(candidate => candidate.id)).toEqual([
      'from-file',
      'from-file-resources',
      'from-file-sparse-resources',
    ])
    expect(loaded.candidates[1]?.score).toBe(88)
    expect(loaded.candidates[1]?.resources?.settingsTabs).toEqual(['settings:a'])
    expect(loaded.candidates[1]?.resources?.routes).toEqual(['/curated/a'])
    expect(loaded.candidates[1]?.resources?.envVars).toEqual(['RESOURCEFUL_TOKEN'])
    expect(loaded.candidates[1]?.resources?.waterfallListeners).toEqual(['tools/pre-execute:next'])
    expect(loaded.candidates[1]?.resources?.automationBehaviors).toEqual(['auto-memory'])
    expect(loaded.candidates[2]?.resources).toEqual({ entryIds: ['entry-sparse'] })
    expect(Object.isFrozen(loaded.source.awesome)).toBe(true)
  })

  test('wraps file and YAML parse failures without retaining unredacted causes', () => {
    expect(() => loadCuratedCatalog('/definitely/missing/sk-live-secret/catalog.yaml'))
      .toThrow('[REDACTED]')

    withTempFile('apiKey: SUPER_PRIVATE_VALUE_12345\ncandidates:\n  - id: [unterminated\n', (filePath) => {
      let failure: unknown
      try {
        loadCuratedCatalog(filePath)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(Error)
      expect(String(failure)).toContain('curated catalog cannot be loaded:')
      expect(String(failure)).not.toContain('SUPER_PRIVATE_VALUE_12345')
      expect((failure as Error).cause).toBeUndefined()
      expect(failure).not.toHaveProperty('mark.buffer')
    })
  })

  test.each([
    [
      'a same-indent comment',
      'apiKey:\n# comment\n  sk-live-secret\nbroken: [\n',
      ['sk-live-secret'],
    ],
    [
      'multiple blank and differently indented comments',
      'apiKey:\n# sk-root-comment\n\n  # sk-nested-comment\n    # sk-deeper-comment\n  sk-live-multi-secret\nbroken: [\n',
      ['sk-root-comment', 'sk-nested-comment', 'sk-deeper-comment', 'sk-live-multi-secret'],
    ],
  ])('redacts an indented secret after %s in malformed YAML', (_name, source, secretFragments) => {
    withTempFile(source, (filePath) => {
      let failure: unknown
      try {
        loadCuratedCatalog(filePath)
      } catch (error) {
        failure = error
      }

      expect(failure).toBeInstanceOf(Error)
      expect((failure as Error).cause).toBeUndefined()
      expect(failure).not.toHaveProperty('mark.buffer')
      expect(String(failure)).toContain('[REDACTED]')
      expect(String(failure)).toContain('broken: [')
      expect(String(failure)).toContain('^')
      for (const fragment of secretFragments) expect(String(failure)).not.toContain(fragment)
    })
  })

  test('redacts a standalone secret token while preserving a non-secret YAML comment', () => {
    const source = 'ordinary: sk-live-secondary-secret\n# keep-public-comment\nbroken: [\n'
    withTempFile(source, (filePath) => {
      let message = ''
      try {
        loadCuratedCatalog(filePath)
      } catch (error) {
        message = String(error)
      }

      expect(message).toContain('ordinary: [REDACTED]')
      expect(message).toContain('# keep-public-comment')
      expect(message).not.toContain('sk-live-secondary-secret')
    })
  })

  test('formats only structured YAML error fields', () => {
    let yamlError: unknown
    try {
      loadYaml('broken: [')
    } catch (error) {
      yamlError = error
    }
    expect(formatYamlParseError(yamlError, 'catalog.yaml'))
      .toMatch(/^unexpected end.* in catalog\.yaml at line \d+, column \d+$/u)
    expect(formatYamlParseError(new Error('not YAML'), 'catalog.yaml')).toBeUndefined()
  })

  test('uses a value-free reason when malformed YAML is marked on a secret line', () => {
    const source = 'apiKey: !arbitrary-private-material payload\nbroken: [\n'
    let yamlError: unknown
    try {
      loadYaml(source)
    } catch (error) {
      yamlError = error
    }
    const message = formatYamlParseError(yamlError, 'catalog.yaml', source) ?? ''
    const [reason = '', codeFrame = ''] = message.split('\n\n', 2)

    expect(reason).toMatch(/^invalid YAML near redacted value in catalog\.yaml at line 1, column \d+$/u)
    expect(codeFrame).toContain('[REDACTED]')
    expect(codeFrame).toContain('broken: [')
    expect(codeFrame).toContain('^')
    for (const fragment of ['arbitrary-private-material', 'payload']) {
      expect(reason).not.toContain(fragment)
      expect(codeFrame).not.toContain(fragment)
    }
  })

  test('redacts comments while an explicit secret key awaits a value and preserves later context', () => {
    const source = '? apiKey\n\n# arbitrary-comment-secret\nordinary: [\n'
    let yamlError: unknown
    try {
      loadYaml(source)
    } catch (error) {
      yamlError = error
    }
    const message = formatYamlParseError(yamlError, 'catalog.yaml', source)

    expect(message).toContain('[REDACTED]')
    expect(message).not.toContain('arbitrary-comment-secret')
    expect(message).toContain('ordinary: [')
  })

  test('redacts an inline comment on an explicit secret key without hiding later context', () => {
    const source = '? apiKey # inline-arbitrary-secret\n: scalar-secret\nbroken: [\n'
    let yamlError: unknown
    try {
      loadYaml(source)
    } catch (error) {
      yamlError = error
    }
    const message = formatYamlParseError(yamlError, 'catalog.yaml', source)

    expect(message).toContain('[REDACTED]')
    expect(message).not.toContain('inline-arbitrary-secret')
    expect(message).not.toContain('scalar-secret')
    expect(message).toContain('broken: [')
  })

  test.each([
    ['unicode escaped key', '"api\\u004bey": unicode scalar multiword suffix', ['unicode scalar multiword suffix', 'multiword suffix']],
    ['escaped quote key', '"service\\"ApiKey": escaped quote scalar trailing words', ['escaped quote scalar trailing words', 'trailing words']],
    ['single-quoted escaped key', "'service''ApiKey': single quote scalar trailing words", ['single quote scalar trailing words', 'trailing words']],
    ['tagged key fallback', '!serviceApiKey: tagged scalar trailing words', ['tagged scalar trailing words', 'trailing words']],
    ['sequence key fallback', '- - serviceApiKey: sequence scalar trailing words', ['sequence scalar trailing words', 'trailing words']],
    ['registry token key', 'registryToken: registry scalar trailing words', ['registry scalar trailing words', 'trailing words']],
    ['service API key', 'serviceApiKey: service scalar trailing words', ['service scalar trailing words', 'trailing words']],
    ['block scalar', 'apiKey: |-\n  first block secret\n  second block secret', ['first block secret', 'second block secret']],
    [
      'PEM block',
      'privateKey: |\n  -----BEGIN PRIVATE KEY-----\n  PEMSECRETBODY\n  -----END PRIVATE KEY-----',
      ['BEGIN PRIVATE KEY', 'PEMSECRETBODY', 'END PRIVATE KEY'],
    ],
  ])('redacts escape-aware secret values from malformed YAML diagnostics with a %s', (_name, secretYaml, secretFragments) => {
    withTempFile(`${secretYaml}\nunrelated: keep-diagnostic-context\nbroken: [\n`, (filePath) => {
      let message = ''
      try {
        loadCuratedCatalog(filePath)
      } catch (error) {
        message = String(error)
      }
      expect(message).toMatch(/(?:unexpected end|unknown tag|end of the stream)/u)
      expect(message).toContain('catalog.yaml')
      expect(message).toMatch(/line \d+, column \d+/u)
      expect(message).toContain('[REDACTED]')
      expect(message).toContain('unrelated: keep-diagnostic-c')
      expect(message).toContain('broken: [')
      expect(message).toContain('^')
      for (const fragment of secretFragments) expect(message).not.toContain(fragment)
    })
  })

  test.each([
    ['double quoted', '"apiKey"', '"LEAK_DQ"'],
    ['Unicode escaped', '"api\\u004bey"', '"LEAK_U"'],
    ['quote escaped', '"service\\"ApiKey"', '"LEAK_EQ"'],
    ['unquoted', 'apiKey', 'LEAK_UQ'],
    ['single quoted', "'serviceApiKey'", "'LEAK_SQ'"],
  ])('redacts a later zero-space %s secret key on a malformed flow-mapping line', (_name, key, secret) => {
    const source = `value: {visible:ok,${key}:${secret},broken:[}\n`
    let yamlError: unknown
    try {
      loadYaml(source)
    } catch (error) {
      yamlError = error
    }
    const message = formatYamlParseError(yamlError, 'catalog.yaml', source) ?? ''

    expect(message).toContain('[REDACTED]')
    expect(message).not.toContain(secret)
    expect(message).not.toContain('visible:ok')
    expect(message).toMatch(/line \d+, column \d+/u)
    expect(message).toContain('^')
  })

  test.each([
    ['plain value', '? apiKey\n: correct horse battery staple', ['correct', 'horse', 'battery', 'staple']],
    ['quoted value', '? apiKey\n: "quoted explicit secret suffix"', ['quoted explicit secret suffix', 'secret suffix']],
    ['escaped key', '? "api\\u004bey"\n: escaped explicit value suffix', ['escaped explicit value suffix', 'value suffix']],
    ['folded value', '? apiKey\n: >-\n  folded explicit first\n  folded explicit second', ['folded explicit first', 'folded explicit second']],
    ['multiline quoted value', '? apiKey\n: "multiline explicit first\n  multiline explicit second"', ['multiline explicit first', 'multiline explicit second']],
  ])('redacts a complete explicit-key %s from malformed policy YAML diagnostics', (_name, explicitYaml, secretFragments) => {
    withTempFile(`${explicitYaml}\nunrelated: keep-explicit-context\nbroken: [\n`, (filePath) => {
      let message = ''
      try {
        loadCuratedCatalog(filePath)
      } catch (error) {
        message = String(error)
      }
      expect(message).toContain('[REDACTED]')
      expect(message).toContain('unrelated: keep-explicit-cont')
      expect(message).toContain('broken: [')
      expect(message).toMatch(/line \d+, column \d+/u)
      expect(message).toContain('^')
      for (const fragment of secretFragments) expect(message).not.toContain(fragment)
    })
  })

  test.each([
    ['sequence plain value', '- ? apiKey\n  : correct horse battery staple', '  ', ['correct horse battery staple', 'battery staple']],
    ['sequence Unicode key and multiline double-quoted value', '- ? "api\\u004bey"\n  : "double secret first\n    double secret suffix"', '  ', ['double secret first', 'double secret suffix']],
    ['sequence escaped double-quoted key', '- ? "service\\"ApiKey"\n  : escaped quote secret suffix', '  ', ['escaped quote secret suffix', 'secret suffix']],
    ['sequence escaped single-quoted key and multiline value', "- ? 'service''ApiKey'\n  : 'single secret first\n    single secret suffix'", '  ', ['single secret first', 'single secret suffix']],
    ['sequence multiline plain value', '- ? apiKey\n  : plain secret first\n    plain secret suffix', '  ', ['plain secret first', 'plain secret suffix']],
    ['sequence block value', '- ? apiKey\n  : |-\n    block secret first\n    block secret suffix', '  ', ['block secret first', 'block secret suffix']],
    ['compact explicit pair', '? apiKey : compact secret suffix', '', ['compact secret suffix', 'secret suffix']],
  ])('redacts a %s from malformed policy YAML diagnostics', (_name, explicitYaml, contextIndent, secretFragments) => {
    withTempFile(`${explicitYaml}\n${contextIndent}unrelated: keep-sequence-context\n${contextIndent}broken: [\n`, (filePath) => {
      let message = ''
      try {
        loadCuratedCatalog(filePath)
      } catch (error) {
        message = String(error)
      }
      expect(message).toContain('[REDACTED]')
      expect(message).toContain('unrelated: keep-sequence-con')
      expect(message).toContain('broken: [')
      expect(message).toMatch(/line \d+, column \d+/u)
      expect(message).toContain('^')
      for (const fragment of secretFragments) expect(message).not.toContain(fragment)
    })
  })

  test('wraps non-Error loader failures', async () => {
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        readFileSync: () => {
          throw 'sk-non-error-secret'
        },
      }
    })
    const mockedPolicyPlugin = await import('@deepseek-ai/dsh-curated-policy')

    expect(() => mockedPolicyPlugin.loadCuratedCatalog('ignored.yaml'))
      .toThrow('curated catalog cannot be loaded: [REDACTED]')
  })

  test('rejects invalid runtime config path overrides before reading policy files', async () => {
    const readFileSync = vi.fn(() => {
      throw new Error('readFileSync should not be called')
    })
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        readFileSync,
      }
    })
    const mockedPolicyPlugin = await import('@deepseek-ai/dsh-curated-policy')

    for (const [field, value] of [
      ['catalogPath', 3],
      ['conflictPath', ''],
      ['permissionRulesPath', { token: 'sk-live-secret' }],
    ] as const) {
      const config = { [field]: value } as unknown as Parameters<typeof mockedPolicyPlugin.apply>[1]
      expect(() => {
        mockedPolicyPlugin.apply(new Context(), config)
      })
        .toThrow(`curated policy config ${field} must be a non-empty string`)
    }
    expect(readFileSync).not.toHaveBeenCalled()
  })

  test('loads all policy data from explicit runtime config path overrides', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'dsh-curated-policy-config-'))
    const catalogPath = join(directory, 'catalog.yaml')
    const conflictPath = join(directory, 'conflicts.yaml')
    const permissionRulesPath = join(directory, 'permission-rules.yaml')
    writeFileSync(catalogPath, JSON.stringify(catalog([candidate({ id: 'configured-candidate' })])))
    writeFileSync(conflictPath, `schemaVersion: 1
source: docs/plugin/superpowers/02-插件矩阵与择优.md
rules:
  - capability: web-search
    defaultProvider: configured-candidate
    fallbacks: []
    rule: one-active-provider
    reason: configured candidate owns search
`)
    writeFileSync(permissionRulesPath, `schemaVersion: 1
source: docs/plugin/superpowers/05-安全供应链与风险.md
order: [core-sandbox, permission-rules, high-risk-approval-or-auto-review, tool-execution, result-audit]
defaults:
  configImportMode: dry-run
  otelCaptureBody: false
  credentialStorage: credentials-service-or-env
rules:
  - id: configured-rule
    decision: ask
    appliesTo: [web-search]
    reason: configured rule
`)
    const ctx = new Context()
    const fiber = await ctx.plugin(curatedPolicyPlugin, { catalogPath, conflictPath, permissionRulesPath })
    try {
      const service = ctx.get('curatedPolicy')

      expect(service).toBeInstanceOf(CuratedPolicy)
      const policy = service as CuratedPolicy
      expect(policy.listCandidates().map(item => item.id)).toEqual(['configured-candidate'])
      expect(policy.listCapabilityConflicts().map(rule => rule.defaultProvider)).toEqual(['configured-candidate'])
      expect(policy.listPermissionRules().map(rule => rule.id)).toEqual(['configured-rule'])
    } finally {
      await fiber.dispose()
      await ctx.fiber.dispose()
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('rejects unknown conflict providers before publishing the policy service', async () => {
    const fixture = writePolicyFixture(
      catalog([candidate({ id: 'configured-candidate' })]),
      {
        schemaVersion: 1,
        source: 'fixture',
        rules: [{
          capability: 'web-search',
          defaultProvider: 'missing-provider',
          fallbacks: [],
          rule: 'one-active-provider',
          reason: 'fixture rule',
        }],
      },
      {
        schemaVersion: 1,
        source: 'fixture',
        order: [...authoritativePermissionOrder],
        defaults: {},
        rules: [{
          id: 'deny-approval-failure',
          decision: 'deny',
          appliesTo: ['approval'],
          reason: 'fixture rule',
        }],
      },
    )
    const ctx = new Context()
    try {
      let failure: unknown
      try {
        await ctx.plugin(curatedPolicyPlugin, fixture)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(Error)
      expect(String(failure)).toContain(
        'capability conflict default provider missing-provider is not present in the candidate catalog',
      )
      expect(ctx.get('curatedPolicy')).toBeUndefined()
    } finally {
      await ctx.fiber.dispose()
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test('rejects candidate-lock issues before publishing the policy service', async () => {
    const invalidCatalog = catalog([candidate({
      id: 'configured-candidate',
      repository: 'https://gitlab.com/example/configured-candidate',
    })])
    const fixture = writePolicyFixture(
      invalidCatalog,
      {
        schemaVersion: 1,
        source: 'fixture',
        rules: [{
          capability: 'web-search',
          defaultProvider: 'configured-candidate',
          fallbacks: [],
          rule: 'one-active-provider',
          reason: 'fixture rule',
        }],
      },
      {
        schemaVersion: 1,
        source: 'fixture',
        order: [...authoritativePermissionOrder],
        defaults: {},
        rules: [],
      },
    )
    const ctx = new Context()
    try {
      let failure: unknown
      try {
        await ctx.plugin(curatedPolicyPlugin, fixture)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(Error)
      expect(String(failure)).toContain('candidate repository must be a canonical HTTPS GitHub repository URL')
      expect(ctx.get('curatedPolicy')).toBeUndefined()
    } finally {
      await ctx.fiber.dispose()
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test.each([
    {
      name: 'duplicate capability rule',
      candidates: [candidate({ id: 'search-default' })],
      rules: [
        {
          capability: 'web-search',
          defaultProvider: 'search-default',
          fallbacks: [],
          rule: 'one-active-provider',
          reason: 'first fixture rule',
        },
        {
          capability: 'web-search',
          defaultProvider: 'search-default',
          fallbacks: [],
          rule: 'not-simultaneous',
          reason: 'duplicate fixture rule',
        },
      ],
      message: 'capability conflict rule web-search is duplicated',
    },
    {
      name: 'unknown fallback',
      candidates: [candidate({ id: 'search-default' })],
      rules: [{
        capability: 'web-search',
        defaultProvider: 'search-default',
        fallbacks: ['missing-fallback'],
        rule: 'one-active-provider',
        reason: 'fixture rule',
      }],
      message: 'capability conflict fallback missing-fallback is not present in the candidate catalog',
    },
    {
      name: 'cross-named context provider',
      candidates: [candidate({ id: 'context-default', capability: 'context-observability' })],
      rules: [{
        capability: 'context-compression',
        defaultProvider: 'context-default',
        fallbacks: [],
        rule: 'not-long-running-together',
        reason: 'fixture rule',
      }],
      message: 'capability conflict provider context-default declares context-observability instead of context-compression',
    },
    {
      name: 'simultaneous default and fallback',
      candidates: [
        candidate({ id: 'search-default' }),
        candidate({ id: 'search-fallback' }),
      ],
      rules: [{
        capability: 'web-search',
        defaultProvider: 'search-default',
        fallbacks: ['search-fallback'],
        rule: 'not-simultaneous',
        reason: 'fixture rule',
      }],
      message: 'profile web-curated conflict rule web-search has multiple active providers: search-default, search-fallback',
    },
    {
      name: 'unmanaged governed provider',
      candidates: [
        candidate({
          id: 'search-default',
          active: false,
          targetProfiles: [],
        }),
        candidate({ id: 'search-unmanaged' }),
      ],
      rules: [{
        capability: 'web-search',
        defaultProvider: 'search-default',
        fallbacks: [],
        rule: 'one-active-provider',
        reason: 'fixture rule',
      }],
      message: 'profile web-curated capability web-search uses unmanaged provider search-unmanaged',
    },
  ])('rejects $name before publishing the policy service', async ({ candidates, rules, message }) => {
    const fixture = writePolicyFixture(
      catalog(candidates),
      { schemaVersion: 1, source: 'fixture', rules },
      {
        schemaVersion: 1,
        source: 'fixture',
        order: [...authoritativePermissionOrder],
        defaults: {},
        rules: [{
          id: 'deny-approval-failure',
          decision: 'deny',
          appliesTo: ['approval'],
          reason: 'fixture rule',
        }],
      },
    )
    const ctx = new Context()
    try {
      let failure: unknown
      try {
        await ctx.plugin(curatedPolicyPlugin, fixture)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(Error)
      expect(String(failure)).toContain(message)
      expect(ctx.get('curatedPolicy')).toBeUndefined()
    } finally {
      await ctx.fiber.dispose()
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test.each([
    {
      name: 'duplicate permission rule',
      order: [...authoritativePermissionOrder],
      defaults: {},
      rules: [
        {
          id: 'approval-failure',
          decision: 'deny' as const,
          appliesTo: ['approval'],
          reason: 'first fixture rule',
        },
        {
          id: 'approval-failure',
          decision: 'ask' as const,
          appliesTo: ['approval'],
          reason: 'duplicate fixture rule',
        },
      ],
      message: 'permission rule approval-failure is duplicated',
    },
    {
      name: 'missing permission stage',
      order: ['core-sandbox', 'permission-rules', 'high-risk-approval-or-auto-review', 'tool-execution'],
      message: permissionOrderError,
    },
    {
      name: 'extra permission stage',
      order: [...authoritativePermissionOrder, 'post-audit'],
      message: permissionOrderError,
    },
    {
      name: 'duplicate permission stage',
      order: [
        'core-sandbox',
        'permission-rules',
        'permission-rules',
        'high-risk-approval-or-auto-review',
        'tool-execution',
        'result-audit',
      ],
      message: permissionOrderError,
    },
    {
      name: 'reordered permission stages',
      order: [
        'permission-rules',
        'core-sandbox',
        'high-risk-approval-or-auto-review',
        'tool-execution',
        'result-audit',
      ],
      message: permissionOrderError,
    },
  ].map(testCase => ({
    defaults: {},
    rules: [{
      id: 'approval-failure',
      decision: 'deny' as const,
      appliesTo: ['approval'],
      reason: 'fixture rule',
    }],
    ...testCase,
  })))('rejects $name before publishing the policy service', async ({ order, defaults, rules, message }) => {
    const fixture = writePolicyFixture(
      catalog([candidate({ id: 'search-default' })]),
      {
        schemaVersion: 1,
        source: 'fixture',
        rules: [{
          capability: 'web-search',
          defaultProvider: 'search-default',
          fallbacks: [],
          rule: 'one-active-provider',
          reason: 'fixture rule',
        }],
      },
      { schemaVersion: 1, source: 'fixture', order, defaults, rules },
    )
    const ctx = new Context()
    try {
      let failure: unknown
      try {
        await ctx.plugin(curatedPolicyPlugin, fixture)
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(Error)
      expect(String(failure)).toContain(message)
      expect(ctx.get('curatedPolicy')).toBeUndefined()
    } finally {
      await ctx.fiber.dispose()
      rmSync(fixture.directory, { recursive: true, force: true })
    }
  })

  test('reports malformed parsed YAML with the catalog field label', () => {
    withTempFile('[]\n', (filePath) => {
      expect(() => loadCuratedCatalog(filePath)).toThrow('curated catalog catalog must be a map')
    })
  })

  test.each([
    [{ id: '' }, 'curated catalog candidates[0].id must be a non-empty string'],
    [{ repositoryPath: 1 }, 'curated catalog candidates[0].repositoryPath must be null or a non-empty string'],
    [{ testFiles: 'one' }, 'curated catalog candidates[0].testFiles must be a finite number'],
    [{ score: 'high' }, 'curated catalog candidates[0].score must be a finite number'],
    [{ scoreDimensions: undefined }, 'curated catalog candidates[0].scoreDimensions must be a map'],
    [{ scoreDimensions: { ...candidate({}).scoreDimensions, nativeCompatibility: 21 } }, 'curated catalog candidates[0].scoreDimensions.nativeCompatibility must be an integer between 0 and 20'],
    [{ active: 'yes' }, 'curated catalog candidates[0].active must be a boolean'],
    [{ externalDependencies: 'dep' }, 'curated catalog candidates[0].externalDependencies must be a list'],
    [{ requiredRuntimeBundles: 'bundle' }, 'curated catalog candidates[0].requiredRuntimeBundles must be a list'],
    [{ runtimeActivationEvidence: { 'web-curated': {} } }, 'curated catalog candidates[0].runtimeActivationEvidence.web-curated.keylessAssembledSnapshot must be a map'],
    [{ targetProfiles: ['web-curated', ''] }, 'curated catalog candidates[0].targetProfiles[1] must be a non-empty string'],
    [{ installScripts: { postinstall: 1 } }, 'curated catalog candidates[0].installScripts.postinstall must be a non-empty string'],
    [{ sourceContentSha256: 1 }, 'curated catalog candidates[0].sourceContentSha256 must be a non-empty string'],
    [{ treeSha256: 1 }, 'curated catalog candidates[0].treeSha256 must be a non-empty string'],
    [{ runtimeDependencyClosureSha256: 1 }, 'curated catalog candidates[0].runtimeDependencyClosureSha256 must be a non-empty string'],
    [{ npmVersion: 1 }, 'curated catalog candidates[0].npmVersion must be a non-empty string'],
    [{ npmIntegrity: 1 }, 'curated catalog candidates[0].npmIntegrity must be a non-empty string'],
    [{ requiresCorePatch: 'no' }, 'curated catalog candidates[0].requiresCorePatch must be null or a boolean'],
    [{ sourceStatus: 'missing' }, 'curated catalog candidates[0].sourceStatus must be verified or unreachable'],
    [{ nodeEngineEvidence: undefined }, 'curated catalog candidates[0].nodeEngineEvidence must be null or a non-empty string'],
    [{ priority: 'P3' }, 'curated catalog candidates[0].priority must be P0, P1, or P2'],
  ])('rejects malformed candidate field %j', (candidateOverrides, message) => {
    withTempFile(rawCatalog(candidateOverrides), (filePath) => {
      expect(() => loadCuratedCatalog(filePath)).toThrow(message)
    })
  })

  test.each([
    ['requiresCorePatch', 'curated catalog candidates[0].requiresCorePatch must be null or a boolean'],
  ])('requires explicit machine-readable candidate field %s', (field, message) => {
    const parsed = JSON.parse(rawCatalog({})) as { candidates: Record<string, unknown>[] }
    delete parsed.candidates[0]?.[field]

    withTempFile(JSON.stringify(parsed), (filePath) => {
      expect(() => loadCuratedCatalog(filePath)).toThrow(message)
    })
  })

  test('derives an omitted score from its dimensions', () => {
    const parsed = JSON.parse(rawCatalog({})) as { candidates: Record<string, unknown>[] }
    delete parsed.candidates[0]?.score

    withTempFile(JSON.stringify(parsed), (filePath) => {
      expect(loadCuratedCatalog(filePath).candidates[0]?.score).toBe(88)
    })
  })

  test('rejects a declared score that differs from its dimension total', () => {
    withTempFile(rawCatalog({ score: 87 }), (filePath) => {
      expect(() => loadCuratedCatalog(filePath))
        .toThrow('curated catalog candidates[0].score must equal the computed score dimension total')
    })
  })

  test('reports floating and short candidate commits', () => {
    const issues = validateCandidateLock(catalog([
      candidate({ id: 'floating', commit: 'main' }),
      candidate({ id: 'short', commit: '0123456' }),
    ]))

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['candidate-commit-unpinned', 'floating'],
      ['candidate-commit-unpinned', 'short'],
    ])
  })

  test('reports floating and short catalog source commits', () => {
    expect(validateCandidateLock(withSourceCommit('main')).map(issue => issue.code)).toEqual([
      'source-commit-unpinned',
    ])
    expect(validateCandidateLock(withSourceCommit('0123456')).map(issue => issue.code)).toEqual([
      'source-commit-unpinned',
    ])
  })

  test('reports placeholder source commits, candidate commits, and source content digests', () => {
    const issues = validateCandidateLock({
      ...withSourceCommit('a1'.repeat(20)),
      candidates: [
        candidate({
          id: 'pair-placeholder',
          commit: 'd1'.repeat(20),
          sourceContentSha256: 'e1'.repeat(32),
        }),
        candidate({
          id: 'char-placeholder',
          capability: 'memory',
          commit: 'f'.repeat(40),
          sourceContentSha256: 'a'.repeat(64),
        }),
      ],
    })

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['source-commit-placeholder', undefined],
      ['candidate-commit-placeholder', 'pair-placeholder'],
      ['candidate-source-content-sha-placeholder', 'pair-placeholder'],
      ['candidate-commit-placeholder', 'char-placeholder'],
      ['candidate-source-content-sha-placeholder', 'char-placeholder'],
    ])
    expect(issues.map(issue => issue.message)).toEqual([
      'curated catalog source commit must not be a placeholder digest',
      'candidate commit must not be a placeholder digest',
      'candidate source content SHA-256 digest must not be a placeholder digest',
      'candidate commit must not be a placeholder digest',
      'candidate source content SHA-256 digest must not be a placeholder digest',
    ])
  })

  test('reports schema, source, id, repository, and active rejection lock issues', () => {
    const issues = validateCandidateLock({
      ...withSourceCommit('MAIN'),
      schemaVersion: 1,
      candidates: [
        candidate({
          id: 'Invalid_ID',
          repository: 'https://gitlab.com/example/candidate-a',
          rejections: [{ code: 'unsafe-install', evidence: 'runs install hooks' }],
        }),
        candidate({ id: 'duplicate' }),
        candidate({ id: 'duplicate', capability: 'memory' }),
      ],
    })

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['catalog-schema-version', undefined],
      ['source-commit-unpinned', undefined],
      ['candidate-id-invalid', 'Invalid_ID'],
      ['candidate-repository-invalid', 'Invalid_ID'],
      ['candidate-hard-rejection-active', 'Invalid_ID'],
      ['candidate-id-duplicate', 'duplicate'],
    ])
  })

  test.each([
    ['query credential', 'https://github.com/example/candidate-a?access_token=plain-query-secret', 'plain-query-secret'],
    ['fragment credential', 'https://github.com/example/candidate-a#plain-fragment-secret', 'plain-fragment-secret'],
    ['username', 'https://plain-user@github.com/example/candidate-a', 'plain-user'],
    ['password', 'https://plain-user:plain-password@github.com/example/candidate-a', 'plain-password'],
    ['HTTP', 'http://github.com/example/candidate-a', undefined],
    ['explicit port', 'https://github.com:443/example/candidate-a', undefined],
    ['malformed URL', 'not-a-repository', undefined],
    ['nested path', 'https://github.com/example/candidate-a/extra', undefined],
    ['encoded path', 'https://github.com/example/candidate%2fa', undefined],
    ['unsafe owner', 'https://github.com/-example/candidate-a', undefined],
    ['unsafe repository name', 'https://github.com/example/candidate~a', undefined],
    ['dot-git suffix', 'https://github.com/example/candidate-a.git', undefined],
    ['uppercase dot-git suffix', 'https://github.com/example/candidate-a.GIT', undefined],
    ['mixed-case dot-git suffix', 'https://github.com/example/candidate-a.Git', undefined],
    ['trailing slash', 'https://github.com/example/candidate-a/', undefined],
    ['mixed-case host', 'https://GitHub.com/example/candidate-a', undefined],
  ])('rejects a non-canonical candidate repository with $name', (_name, repository, secret) => {
    const issues = validateCandidateLock(catalog([
      candidate({ repository }),
    ]))

    expect(issues).toContainEqual(expect.objectContaining({
      code: 'candidate-repository-invalid',
      candidateId: 'candidate-a',
    }))
    const diagnostic = JSON.stringify(issues)
    expect(diagnostic).not.toContain(repository)
    if (secret !== undefined) expect(diagnostic).not.toContain(secret)
  })

  test('rejects a credential-bearing source repository without echoing it', () => {
    const secret = 'plain-source-query-secret'
    const base = catalog([])
    const issues = validateCandidateLock({
      ...base,
      source: {
        ...base.source,
        awesome: {
          ...base.source.awesome,
          repository: `https://github.com/example/awesome?token=${secret}`,
        },
      },
    })

    expect(issues).toContainEqual({
      code: 'source-repository-invalid',
      message: 'curated catalog source repository must be a canonical HTTPS GitHub repository URL',
    })
    expect(JSON.stringify(issues)).not.toContain(secret)
  })

  test('requires active candidates to target a profile and meet the scenario score threshold', () => {
    const noTarget = candidate({
      id: 'active-without-target',
      targetProfiles: [],
      runtimeActivationEvidence: {},
    })
    const lowScore = candidate({
      id: 'active-low-score',
      score: 60,
      scoreDimensions: {
        nativeCompatibility: 10,
        functionalCompleteness: 10,
        testAndCi: 10,
        securityAndPrivacy: 10,
        maintenanceHealth: 5,
        performanceCost: 5,
        operability: 5,
        communitySignal: 5,
      },
    })

    expect(validateCandidateLock(catalog([noTarget, lowScore])).map(issue => [issue.code, issue.candidateId]))
      .toEqual([
        ['candidate-active-target-profile-missing', 'active-without-target'],
        ['candidate-active-score-too-low', 'active-low-score'],
      ])
  })

  test('requires runtime activation evidence even after rejection evidence is removed', () => {
    const catalogCandidate = loadCuratedCatalog().candidates
      .find(candidate => candidate.id === 'dsh-web-search-pro')
    expect(catalogCandidate).toBeDefined()
    const issues = validateCandidateLock(catalog([{
      ...catalogCandidate as CuratedCandidate,
      active: true,
      rejections: [],
    }]))

    expect(issues).toContainEqual({
      code: 'candidate-runtime-activation-evidence-missing',
      candidateId: 'dsh-web-search-pro',
      message: 'active candidate must declare complete runtime activation evidence',
    })
  })

  test('requires active evidence keys to equal the target profile set', () => {
    const profiles = ['web-curated', 'web-research']
    expect(validateCandidateLock(catalog([
      candidate({ targetProfiles: profiles }),
    ]))).toEqual([])

    for (const runtimeActivationEvidence of [
      activationEvidence(['web-curated']),
      activationEvidence([...profiles, 'web-enterprise']),
    ]) {
      expect(validateCandidateLock(catalog([
        candidate({ targetProfiles: profiles, runtimeActivationEvidence }),
      ]))).toContainEqual({
        code: 'candidate-runtime-activation-evidence-profiles-mismatch',
        candidateId: 'candidate-a',
        message: 'runtime activation evidence profiles must exactly match the active candidate target profiles',
      })
    }
  })

  test('accepts complete current-profile activation evidence with declared or omitted runtime bundles', () => {
    expect(hasCompleteCurrentProfileActivationEvidence(candidate({}), 'web-curated')).toBe(true)
    const {
      requiredRuntimeBundles: _requiredRuntimeBundles,
      ...withoutRequiredRuntimeBundles
    } = candidate({})
    expect(hasCompleteCurrentProfileActivationEvidence(
      withoutRequiredRuntimeBundles,
      'web-curated',
    )).toBe(true)
  })

  test.each([
    ['non-list target profiles', {
      targetProfiles: 'web-curated',
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: activationEvidence(['web-curated']),
    }],
    ['non-list required runtime bundles', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: 'runtime-bundle',
      runtimeActivationEvidence: activationEvidence(['web-curated']),
    }],
    ['missing evidence', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
    }],
    ['non-map evidence', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: [],
    }],
    ['mismatched profile keys', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: activationEvidence(['web-research']),
    }],
    ['missing current profile', {
      targetProfiles: ['web-research'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: activationEvidence(['web-research']),
    }],
    ['non-map current profile evidence', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: { 'web-curated': 'invalid' },
    }],
    ['extra current-profile evidence field', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: {
        'web-curated': {
          ...activationEvidence(['web-curated'])['web-curated'],
          extra: true,
        },
      },
    }],
    ['non-list evidenced runtime bundles', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: {
        'web-curated': {
          ...activationEvidence(['web-curated'])['web-curated'],
          requiredRuntimeBundles: 'runtime-bundle',
        },
      },
    }],
    ['mismatched runtime bundles', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: ['runtime-bundle'],
      runtimeActivationEvidence: activationEvidence(['web-curated']),
    }],
    ['non-map evidence file', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: {
        'web-curated': {
          ...activationEvidence(['web-curated'])['web-curated'],
          install: 'invalid',
        },
      },
    }],
    ['extra evidence file field', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: {
        'web-curated': {
          ...activationEvidence(['web-curated'])['web-curated'],
          install: {
            ...activationEvidence(['web-curated'])['web-curated']?.install,
            extra: true,
          },
        },
      },
    }],
    ['unsafe evidence path', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: {
        'web-curated': {
          ...activationEvidence(['web-curated'])['web-curated'],
          install: {
            ...activationEvidence(['web-curated'])['web-curated']?.install,
            path: '../outside.json',
          },
        },
      },
    }],
    ['malformed evidence digest', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: {
        'web-curated': {
          ...activationEvidence(['web-curated'])['web-curated'],
          install: {
            ...activationEvidence(['web-curated'])['web-curated']?.install,
            sha256: 'not-a-digest',
          },
        },
      },
    }],
    ['placeholder evidence digest', {
      targetProfiles: ['web-curated'],
      requiredRuntimeBundles: [],
      runtimeActivationEvidence: {
        'web-curated': {
          ...activationEvidence(['web-curated'])['web-curated'],
          install: {
            ...activationEvidence(['web-curated'])['web-curated']?.install,
            sha256: 'ab'.repeat(32),
          },
        },
      },
    }],
  ])('rejects incomplete current-profile activation evidence with %s', (_name, value) => {
    expect(hasCompleteCurrentProfileActivationEvidence(value, 'web-curated')).toBe(false)
  })

  test('rejects an empty runtime activation evidence profile key', () => {
    withTempFile(rawCatalog({
      runtimeActivationEvidence: activationEvidence(['']),
    }), (filePath) => {
      expect(() => loadCuratedCatalog(filePath))
        .toThrow('curated catalog candidates[0].runtimeActivationEvidence profile keys must be non-empty strings')
    })
  })

  test('reports secret material in catalog, profile, and manifest fields without echoing it', () => {
    const issues = validateCandidateLock({
      ...catalog([
        candidate({
          id: 'profile-secret',
          targetProfiles: ['Bearer hidden-profile-token'],
        }),
        candidate({
          id: 'manifest-secret',
          capability: 'memory',
          manifestPath: 'package.json?token=sk-live-secret',
        }),
      ]),
      source: {
        ...catalog([]).source,
        matrix: 'Bearer hidden-catalog-token',
      },
    })

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['catalog-secret-material', undefined],
      ['candidate-secret-material', 'profile-secret'],
      ['candidate-secret-material', 'manifest-secret'],
    ])
    const serialized = JSON.stringify(issues)
    expect(serialized).not.toContain('hidden-profile-token')
    expect(serialized).not.toContain('sk-live-secret')
    expect(serialized).not.toContain('hidden-catalog-token')
  })

  test('redacts secret-like policy issue ids from exported validators', () => {
    const lockIssues = validateCandidateLock(catalog([
      candidate({ id: 'sk-live-secret' }),
    ]))
    const conflictIssues = validateProfileConflicts(catalog([
      candidate({ id: 'search-a', targetProfiles: ['sk-profile-secret'] }),
      candidate({ id: 'search-b', capability: 'web-search', targetProfiles: ['sk-profile-secret'] }),
    ]), 'sk-profile-secret')

    expect(lockIssues).toContainEqual({
      code: 'candidate-secret-material',
      candidateId: '[REDACTED]',
      message: 'candidate fields must not contain secret material',
    })
    expect(conflictIssues).toEqual([
      expect.objectContaining({
        code: 'profile-capability-duplicate',
        candidateId: 'search-b',
        profileId: '[REDACTED]',
        details: { capability: 'web-search', candidates: ['search-a', 'search-b'] },
      }),
    ])
    const serialized = JSON.stringify([...lockIssues, ...conflictIssues])
    expect(serialized).not.toContain('sk-live-secret')
    expect(serialized).not.toContain('sk-profile-secret')
  })

  test('hard rejections override admission score', () => {
    expect(classifyAdmission(100, ['license-unclear'])).toBe('rejected')
    expect(classifyAdmission(85)).toBe('default')
    expect(classifyAdmission(75)).toBe('scenario')
    expect(classifyAdmission(65)).toBe('experimental')
    expect(classifyAdmission(64)).toBe('rejected')
  })

  test('derives active, qualified, pending, and rejected delivery states', () => {
    const checkedIn = new Map(loadCuratedCatalog().candidates.map(item => [item.id, item]))

    expect(deriveCandidateStatus(candidate({}))).toBe('active')
    expect(deriveCandidateStatus(checkedIn.get('dsh-memento')!)).toBe('qualified')
    expect(deriveCandidateStatus(checkedIn.get('dsh-agent-team-gui')!)).toBe('pending')
    expect(deriveCandidateStatus(checkedIn.get('dsh-background-agents')!)).toBe('pending')
    expect(deriveCandidateStatus(checkedIn.get('dsh-toolkit')!)).toBe('rejected')
  })

  test('requires explicit blocker evidence for every inactive candidate', () => {
    const inactiveWithoutBlocker = candidate({
      id: 'inactive-without-blocker',
      active: false,
      rejections: [],
    })

    expect(validateCandidateLock(catalog([inactiveWithoutBlocker]))).toContainEqual({
      code: 'candidate-inactive-blocker-missing',
      candidateId: 'inactive-without-blocker',
      message: 'inactive candidate must carry explicit blocker evidence',
    })
  })

  test('computes admission totals from all eight bounded score dimensions', () => {
    const parsed = JSON.parse(rawCatalog({
      scoreDimensions: {
        nativeCompatibility: 18,
        functionalCompleteness: 14,
        testAndCi: 14,
        securityAndPrivacy: 14,
        maintenanceHealth: 8,
        performanceCost: 8,
        operability: 8,
        communitySignal: 4,
      },
    })) as { candidates: Record<string, unknown>[] }

    const loaded = withTempFile(JSON.stringify(parsed), filePath => loadCuratedCatalog(filePath))

    expect(loaded.candidates[0]?.score).toBe(88)
    expect(loaded.candidates[0]?.scoreDimensions).toEqual({
      nativeCompatibility: 18,
      functionalCompleteness: 14,
      testAndCi: 14,
      securityAndPrivacy: 14,
      maintenanceHealth: 8,
      performanceCost: 8,
      operability: 8,
      communitySignal: 4,
    })
  })

  test('reports malformed source content digests', () => {
    expect(validateCandidateLock(catalog([
      candidate({ id: 'bad-source-content', sourceContentSha256: 'not-a-sha256' }),
    ])).map(issue => issue.code)).toEqual(['candidate-source-content-sha-invalid'])
  })

  test('requires source content digests exactly for reachable candidates', () => {
    const missing = candidate({ id: 'missing-source-content' })
    delete (missing as { sourceContentSha256?: string }).sourceContentSha256
    const issues = validateCandidateLock(catalog([
      missing,
      candidate({
        id: 'unreachable-source-content',
        active: false,
        sourceStatus: 'unreachable',
        targetProfiles: [],
        rejections: [{ code: 'repository-unreachable', evidence: 'fixture source remains unavailable' }],
      }),
    ]))

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['candidate-source-content-sha-missing', 'missing-source-content'],
      ['candidate-source-content-sha-unverified', 'unreachable-source-content'],
    ])
  })

  test('requires exact and complete npm provenance metadata', () => {
    const canonicalDigest = Buffer.from(Array.from({ length: 64 }, (_, index) => index + 1)).toString('base64')
    const issues = validateCandidateLock(catalog([
      candidate({
        id: 'floating-npm',
        npmVersion: '^1.0.0',
        npmIntegrity: 'sha256-invalid',
      }),
      candidate({
        id: 'missing-npm-integrity',
        npmVersion: '1.0.0',
      }),
      candidate({
        id: 'missing-npm-version',
        npmIntegrity: 'sha512-Zml4dHVyZQ==',
      }),
      candidate({
        id: 'short-npm-integrity',
        npmVersion: '1.0.0',
        npmIntegrity: 'sha512-a',
      }),
      candidate({
        id: 'wrong-length-npm-integrity',
        npmVersion: '1.0.0',
        npmIntegrity: `sha512-${Buffer.alloc(63, 1).toString('base64')}`,
      }),
      candidate({
        id: 'noncanonical-npm-integrity',
        npmVersion: '1.0.0',
        npmIntegrity: `sha512-${canonicalDigest.slice(0, -2)}`,
      }),
      candidate({
        id: 'placeholder-npm-integrity',
        npmVersion: '1.0.0',
        npmIntegrity: `sha512-${Buffer.alloc(64, 1).toString('base64')}`,
      }),
    ]))

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['candidate-npm-version-inexact', 'floating-npm'],
      ['candidate-npm-integrity-invalid', 'floating-npm'],
      ['candidate-npm-provenance-incomplete', 'missing-npm-integrity'],
      ['candidate-npm-integrity-invalid', 'missing-npm-version'],
      ['candidate-npm-provenance-incomplete', 'missing-npm-version'],
      ['candidate-npm-integrity-invalid', 'short-npm-integrity'],
      ['candidate-npm-integrity-invalid', 'wrong-length-npm-integrity'],
      ['candidate-npm-integrity-invalid', 'noncanonical-npm-integrity'],
      ['candidate-npm-integrity-invalid', 'placeholder-npm-integrity'],
    ])
  })

  test.each([
    ['0.0.0', true],
    ['1.2.3-alpha', true],
    ['1.2.3-alpha.1', true],
    ['1.2.3-0A-0', true],
    ['1.2.3+build.01', true],
    ['1.2.3-alpha.1+build.01', true],
    ['', false],
    ['v1.2.3', false],
    ['^1.2.3', false],
    ['latest', false],
    ['01.2.3', false],
    ['1.02.3', false],
    ['1.2.03', false],
    ['1.2.3-', false],
    ['1.2.3-alpha..1', false],
    ['1.2.3-01', false],
    ['1.2.3-alpha.01', false],
    ['1.2.3+', false],
    ['1.2.3+build..1', false],
  ])('recognizes exact SemVer 2.0 npm version %s', (version, expected) => {
    expect(isExactNpmVersion(version)).toBe(expected)
  })

  test('requires non-placeholder tree and runtime dependency closure digests for every active candidate', () => {
    const { treeSha256: _activeTreeSha, ...missingTreeDigest } = candidate({
      id: 'missing-tree-digest',
    })
    const {
      runtimeDependencyClosureSha256: _activeClosureSha,
      ...missingRuntimeDependencyClosureDigest
    } = candidate({
      id: 'missing-runtime-dependency-closure-digest',
    })
    const { treeSha256: _inactiveTreeSha, ...inactiveWithoutTreeDigest } = candidate({
      id: 'inactive-without-tree-digest',
      active: false,
      targetProfiles: [],
      rejections: [{ code: 'fixture-inactive', evidence: 'fixture remains inactive' }],
    })
    const issues = validateCandidateLock(catalog([
      missingTreeDigest,
      candidate({
        id: 'malformed-tree-digest',
        treeSha256: 'sha256-not-hex',
      }),
      candidate({
        id: 'placeholder-tree-digest',
        treeSha256: 'ab'.repeat(32),
      }),
      missingRuntimeDependencyClosureDigest,
      candidate({
        id: 'malformed-runtime-dependency-closure-digest',
        runtimeDependencyClosureSha256: 'sha256-not-hex',
      }),
      candidate({
        id: 'placeholder-runtime-dependency-closure-digest',
        runtimeDependencyClosureSha256: 'ab'.repeat(32),
      }),
      inactiveWithoutTreeDigest,
    ]))

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['candidate-tree-sha-missing', 'missing-tree-digest'],
      ['candidate-tree-sha-invalid', 'malformed-tree-digest'],
      ['candidate-tree-sha-placeholder', 'placeholder-tree-digest'],
      ['candidate-runtime-dependency-closure-sha-missing', 'missing-runtime-dependency-closure-digest'],
      ['candidate-runtime-dependency-closure-sha-invalid', 'malformed-runtime-dependency-closure-digest'],
      ['candidate-runtime-dependency-closure-sha-placeholder', 'placeholder-runtime-dependency-closure-digest'],
    ])
  })

  test.each([
    ['expectedPackage', { expectedPackage: null }],
    ['manifestPath', { manifestPath: null }],
    ['license', { license: null }],
    ['bundlePatch', { bundlePatch: null }],
  ] satisfies ReadonlyArray<readonly [string, Partial<CuratedCandidate>]>)(
    'rejects active candidates with null %s despite complete runtime evidence',
    (field, overrides) => {
      const issues = validateCandidateLock(catalog([
        candidate({ id: `missing-${field.toLowerCase()}`, ...overrides }),
      ]))

      expect(issues).toContainEqual(expect.objectContaining({
        code: 'candidate-active-install-metadata-missing',
        candidateId: `missing-${field.toLowerCase()}`,
      }))
    },
  )

  test('validates complete runtime activation evidence and its required bundle declaration', () => {
    const validEvidence = candidate({}).runtimeActivationEvidence?.['web-curated']
    expect(validEvidence).toBeDefined()
    const issues = validateCandidateLock(catalog([
      candidate({
        id: 'unsafe-evidence-path',
        runtimeActivationEvidence: {
          'web-curated': {
            ...validEvidence!,
            install: { path: '../outside.json', sha256: validEvidence!.install.sha256 },
          },
        },
      }),
      candidate({
        id: 'placeholder-evidence-digest',
        runtimeActivationEvidence: {
          'web-curated': {
            ...validEvidence!,
            restart: { path: 'evidence/restart.json', sha256: 'ab'.repeat(32) },
          },
        },
      }),
      candidate({
        id: 'invalid-evidence-digest',
        runtimeActivationEvidence: {
          'web-curated': {
            ...validEvidence!,
            enable: { path: 'evidence/enable.json', sha256: 'not-a-digest' },
          },
        },
      }),
      candidate({
        id: 'required-bundle-mismatch',
        externalDependencies: ['required-bundle'],
        requiredRuntimeBundles: ['required-bundle'],
        runtimeActivationEvidence: {
          'web-curated': {
            ...validEvidence!,
            requiredRuntimeBundles: [],
          },
        },
      }),
      candidate({
        id: 'required-bundle-undeclared',
        requiredRuntimeBundles: ['required-bundle'],
        runtimeActivationEvidence: {
          'web-curated': {
            ...validEvidence!,
            requiredRuntimeBundles: ['required-bundle'],
          },
        },
      }),
      candidate({
        id: 'required-bundle-provider',
        capability: 'browser',
        expectedPackage: 'required-bundle',
      }),
    ]))

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['candidate-runtime-activation-evidence-path-invalid', 'unsafe-evidence-path'],
      ['candidate-runtime-activation-evidence-sha-placeholder', 'placeholder-evidence-digest'],
      ['candidate-runtime-activation-evidence-sha-invalid', 'invalid-evidence-digest'],
      ['candidate-runtime-activation-required-bundles-mismatch', 'required-bundle-mismatch'],
      ['candidate-required-runtime-bundle-undeclared', 'required-bundle-undeclared'],
    ])
  })

  test('treats omitted required runtime bundles as empty when evidence also declares none', () => {
    const {
      requiredRuntimeBundles: _requiredRuntimeBundles,
      ...candidateWithoutRequiredRuntimeBundles
    } = candidate({ id: 'no-required-runtime-bundles' })

    expect(validateCandidateLock(catalog([candidateWithoutRequiredRuntimeBundles]))).toEqual([])
  })

  test('requires every runtime bundle to come from another active candidate in the same profile', () => {
    const consumer = candidate({
      id: 'consumer',
      expectedPackage: 'consumer',
      externalDependencies: ['runtime-bundle'],
      requiredRuntimeBundles: ['runtime-bundle'],
      runtimeActivationEvidence: activationEvidence(['web-curated'], ['runtime-bundle']),
    })
    const provider = candidate({
      id: 'provider',
      capability: 'browser',
      expectedPackage: 'runtime-bundle',
    })

    expect(validateCandidateLock(catalog([consumer])).map(issue => issue.code)).toContain(
      'candidate-required-runtime-bundle-provider-missing',
    )
    expect(validateCandidateLock(catalog([
      consumer,
      { ...provider, targetProfiles: ['web-research'] },
    ])).map(issue => issue.code)).toContain('candidate-required-runtime-bundle-provider-missing')
    expect(validateCandidateLock(catalog([
      consumer,
      {
        ...provider,
        active: false,
        rejections: [{ code: 'fixture-inactive', evidence: 'fixture remains inactive' }],
      },
    ])).map(issue => issue.code)).toContain('candidate-required-runtime-bundle-provider-missing')
    const providerWithoutEvidence = { ...provider }
    delete (providerWithoutEvidence as { runtimeActivationEvidence?: unknown }).runtimeActivationEvidence
    expect(validateCandidateLock(catalog([
      consumer,
      providerWithoutEvidence,
    ]))).toContainEqual(expect.objectContaining({
      code: 'candidate-runtime-activation-evidence-missing',
      candidateId: 'provider',
    }))
    expect(validateCandidateLock(catalog([consumer, provider])).map(issue => issue.code)).not.toContain(
      'candidate-required-runtime-bundle-provider-missing',
    )
  })

  test('binds required runtime bundle providers to evidence for each shared profile', () => {
    const profiles = ['web-curated', 'web-research']
    const consumer = candidate({
      id: 'consumer',
      expectedPackage: 'consumer',
      targetProfiles: profiles,
      externalDependencies: ['runtime-bundle'],
      requiredRuntimeBundles: ['runtime-bundle'],
      runtimeActivationEvidence: activationEvidence(profiles, ['runtime-bundle']),
    })
    const provider = candidate({
      id: 'provider',
      capability: 'browser',
      expectedPackage: 'runtime-bundle',
      targetProfiles: profiles,
      runtimeActivationEvidence: activationEvidence(['web-curated']),
    })

    expect(validateCandidateLock(catalog([consumer, provider]))).toContainEqual(expect.objectContaining({
      code: 'candidate-required-runtime-bundle-provider-missing',
      candidateId: 'consumer',
      profileId: 'web-research',
    }))
  })

  test('rejects active Git dependencies with install lifecycle builds', () => {
    const issues = validateCandidateLock(catalog([
      candidate({
        id: 'git-prepare',
        installScripts: { prepare: 'pnpm run build' },
      }),
    ]))

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['candidate-git-lifecycle-build-active', 'git-prepare'],
    ])
  })

  test('preserves exact npm and runtime dependency closure provenance in policy query results', () => {
    const policy = new CuratedPolicy(catalog([
      candidate({
        npmVersion: '1.0.0',
        npmIntegrity: 'sha512-Zml4dHVyZQ==',
      }),
    ]))

    expect(policy.listCandidates()[0]).toMatchObject({
      npmVersion: '1.0.0',
      npmIntegrity: 'sha512-Zml4dHVyZQ==',
      runtimeDependencyClosureSha256: '89abcdef012345670123456789abcdef0123456789abcdef0123456701234567',
    })
  })

  test('rejects unknown catalog keys without echoing secret-like values', () => {
    const parsed = JSON.parse(rawCatalog({})) as {
      candidates: Record<string, unknown>[]
    }
    parsed.candidates[0] = {
      ...parsed.candidates[0],
      unexpectedToken: 'sk-unknown-field-secret',
    }
    delete parsed.candidates[0]?.score

    withTempFile(JSON.stringify(parsed), (filePath) => {
      expect(() => loadCuratedCatalog(filePath))
        .toThrow('curated catalog candidates[0] contains unknown key unexpectedToken')
      try {
        loadCuratedCatalog(filePath)
      } catch (error) {
        expect(String(error)).not.toContain('sk-unknown-field-secret')
      }
    })
  })

  test('rejects the legacy tarball byte digest field from a schema version 1 fixture', () => {
    const legacyCatalog = JSON.parse(rawCatalog({ tarballSha256: '1'.repeat(64) })) as {
      schemaVersion: number
    }
    legacyCatalog.schemaVersion = 1

    withTempFile(JSON.stringify(legacyCatalog), (filePath) => {
      expect(() => loadCuratedCatalog(filePath))
        .toThrow('curated catalog candidates[0] contains unknown key tarballSha256')
    })
  })

  test('keeps legacy digest fields out of schema version 2 assets', () => {
    const repositoryRoot = process.cwd()
    const offendingAssets = globSync('**/*.{json,yaml,yml}', {
      cwd: repositoryRoot,
      exclude: ['.git/**', 'node_modules/**'],
    }).filter((path) => {
      const source = readFileSync(join(repositoryRoot, path), 'utf8')
      return /(?:^|\n)\s*(?:"schemaVersion"|schemaVersion):\s*2(?:,|\s*$)/mu.test(source)
        && source.includes('tarballSha256')
    })

    expect(offendingAssets).toEqual([])
  })

  test('keeps the latest dependency fixture as a schema version 2 unpinned-commit rejection', () => {
    const fixturePath = join(process.cwd(), 'tests/fixtures/latest-dep.json')
    const fixture = loadCuratedCatalog(fixturePath)
    const fixtureCandidate = fixture.candidates[0]

    expect(fixture.schemaVersion).toBe(2)
    expect(fixtureCandidate?.commit).toBe('latest')
    expect(fixtureCandidate?.sourceContentSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(fixtureCandidate?.treeSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(fixtureCandidate?.runtimeDependencyClosureSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(validateCandidateLock(fixture)).toContainEqual(expect.objectContaining({
      code: 'candidate-commit-unpinned',
      candidateId: 'latest-dep',
    }))
  })

  test('requires verified compatible Node evidence and no core patch for active candidates', () => {
    const issues = validateCandidateLock(catalog([
      candidate({
        id: 'unverified-source',
        sourceStatus: 'unreachable',
        requiresCorePatch: null,
        nodeEngineEvidence: null,
      } as unknown as Partial<CuratedCandidate>),
      candidate({
        id: 'missing-node-evidence',
        capability: 'memory',
        sourceStatus: 'verified',
        requiresCorePatch: false,
        nodeEngineEvidence: null,
      } as unknown as Partial<CuratedCandidate>),
      candidate({
        id: 'core-patch',
        capability: 'mcp-management',
        sourceStatus: 'verified',
        requiresCorePatch: true,
        nodeEngineEvidence: 'package.json#engines.node',
      } as unknown as Partial<CuratedCandidate>),
    ]))

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['candidate-source-content-sha-unverified', 'unverified-source'],
      ['candidate-source-unverified', 'unverified-source'],
      ['candidate-requires-core-patch-unverified', 'unverified-source'],
      ['candidate-node-evidence-missing', 'unverified-source'],
      ['candidate-node-evidence-missing', 'missing-node-evidence'],
      ['candidate-requires-core-patch', 'core-patch'],
    ])
  })

  test('reports two active providers in the same capability domain for one profile', () => {
    const issues = validateProfileConflicts(catalog([
      candidate({ id: 'search-a', capability: 'web-search' }),
      candidate({ id: 'search-b', capability: 'web-search' }),
    ]), 'web-curated')

    expect(issues).toEqual([
      {
        code: 'profile-capability-duplicate',
        candidateId: 'search-b',
        profileId: 'web-curated',
        message: 'profile web-curated capability web-search has multiple active candidates: search-a, search-b',
        details: { capability: 'web-search', candidates: ['search-a', 'search-b'] },
      },
    ])
  })

  test('reports active web-enterprise candidates that require lifecycle builds or violate enterprise false flags', () => {
    const issues = validateCandidateLock(catalog([
      candidate({
        id: 'enterprise-violator',
        targetProfiles: ['web-enterprise'],
        installScripts: { prepack: 'pnpm run build' },
        networkAccess: [
          'optional-anonymous-vision-fallback',
          'full-im-body-egress',
          'optional-browser-download',
        ],
      }),
    ]))

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['candidate-git-lifecycle-build-active', 'enterprise-violator'],
      ['enterprise-anonymous-vision-fallback-active', 'enterprise-violator'],
      ['enterprise-im-body-egress-active', 'enterprise-violator'],
      ['enterprise-automatic-install-scripts-active', 'enterprise-violator'],
      ['enterprise-unapproved-browser-download-active', 'enterprise-violator'],
    ])
  })

  test('accepts an active web-enterprise candidate without restricted network or lifecycle behavior', () => {
    expect(validateCandidateLock(catalog([
      candidate({
        id: 'enterprise-safe',
        targetProfiles: ['web-enterprise'],
      }),
    ]))).toEqual([])
  })

  test('reports inactive candidates with incomplete install metadata and no rejection evidence', () => {
    const issues = validateCandidateLock(catalog([
      candidate({
        id: 'inactive-incomplete',
        active: false,
        expectedPackage: null,
        bundlePatch: null,
      }),
      candidate({
        id: 'inactive-rejected',
        active: false,
        expectedPackage: null,
        bundlePatch: null,
        rejections: [{
          code: 'not-installable',
          evidence: 'candidate is not packaged as a dsh bundle',
        }],
      }),
    ]))

    expect(issues).toEqual([
      {
        code: 'candidate-inactive-blocker-missing',
        candidateId: 'inactive-incomplete',
        message: 'inactive candidate must carry explicit blocker evidence',
      },
    ])
  })

  test('accepts an inactive fallback in the same capability domain', () => {
    const issues = validateProfileConflicts(catalog([
      candidate({ id: 'search-a', capability: 'web-search' }),
      candidate({ id: 'search-fallback', capability: 'web-search', active: false }),
    ]), 'web-curated')

    expect(issues).toEqual([])
  })

  test('redacts secret-like values recursively', () => {
    expect(redactSecretLikeValues({
      apiToken: 'sk-live-secret',
      nested: {
        cookie: 'session=abc',
        safe: 'visible',
      },
      list: ['Bearer hidden', 'normal'],
    })).toEqual({
      apiToken: '[REDACTED]',
      nested: {
        cookie: '[REDACTED]',
        safe: 'visible',
      },
      list: ['[REDACTED]', 'normal'],
    })
    expect(redactSecretLikeValues(42)).toBe(42)
  })

  test('preserves ordinary words ending in sk while redacting standalone sk tokens', () => {
    expect(redactSecretLikeValues({
      stage: 'high-risk-approval-or-auto-review',
      secret: 'sk-live-secret',
    })).toEqual({
      stage: 'high-risk-approval-or-auto-review',
      secret: '[REDACTED]',
    })
  })

  test('redacts key-value, Basic authorization, and complete URL authority userinfo text', () => {
    const safeUrl = 'https://example.com/users/name@example.com?notify=foo@bar#owner@org'
    const redacted = JSON.stringify(redactSecretLikeValues({
      nested: [{
        messages: [
          'artifact packages/curated/evidence/token=plain-secret.json is missing',
          'request failed with Authorization: Basic cGxhaW4tc2VjcmV0',
          'repository https://plain-user:plain-password@example.com/plugin',
          'raw-at https://raw-user:first@second-secret@example.com/plugin',
          'encoded-at https://encoded-user:first%40second-secret@example.com/plugin',
          safeUrl,
        ],
      }],
    }))

    expect(redacted).toContain('[REDACTED]')
    expect(redacted).not.toContain('plain-secret')
    expect(redacted).not.toContain('cGxhaW4tc2VjcmV0')
    expect(redacted).not.toContain('plain-user')
    expect(redacted).not.toContain('plain-password')
    expect(redacted).not.toContain('raw-user')
    expect(redacted).not.toContain('first@second-secret')
    expect(redacted).not.toContain('second-secret')
    expect(redacted).not.toContain('encoded-user')
    expect(redacted).not.toContain('first%40second-secret')
    expect(redacted).toContain(safeUrl)
  })

  test('detects secret-like keys with any non-empty scalar or structured value', () => {
    expect(validateCandidateLock(catalog([
      candidate({
        id: 'secret-key',
        installScripts: { apiToken: 'plain-value' },
        config: { entryId: 'candidate-plugin', values: { apiKey: { value: 'plain-nested-value' } } },
      }),
    ])).map(issue => issue.code)).toEqual(['candidate-secret-material'])

    expect(validateCandidateLock(catalog([
      candidate({ id: 'secret-array', config: { entryId: 'candidate-plugin', values: { apiKey: ['plain-value'] } } }),
      candidate({ id: 'empty-secret-key', installScripts: { apiToken: '' } }),
      candidate({ id: 'empty-secret-map', config: { entryId: 'candidate-plugin', values: { apiKey: {} } } }),
    ])).map(issue => [issue.code, issue.candidateId])).toEqual([
      ['candidate-secret-material', 'secret-array'],
    ])
  })

  test.each([
    'entryIds',
    'toolNames',
    'commandNames',
    'serviceKeys',
    'uiSlots',
    'settingsTabs',
    'routes',
    'ports',
    'sqlitePaths',
    'cacheDirs',
    'envVars',
    'waterfallListeners',
    'automationBehaviors',
  ] as const)('reports duplicate active %s resources in overlapping profiles', (resourceField) => {
    const issues = validateCandidateLock(catalog([
      candidate({
        id: 'first',
        targetProfiles: ['web-curated', 'web-research'],
        resources: { [resourceField]: ['shared-resource'] },
      }),
      candidate({
        id: 'second',
        capability: 'memory',
        targetProfiles: ['web-research', 'web-enterprise'],
        resources: { [resourceField]: ['shared-resource'] },
      }),
    ]))

    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('candidate-resource-duplicate')
    expect(issues[0]?.candidateId).toBe('second')
    expect(issues[0]?.details).toMatchObject({ field: resourceField })
  })

  test('allows the same resource in disjoint profiles', () => {
    expect(validateCandidateLock(catalog([
      candidate({
        id: 'first',
        targetProfiles: ['web-curated'],
        resources: { toolNames: ['shared-resource'] },
      }),
      candidate({
        id: 'second',
        capability: 'memory',
        targetProfiles: ['web-research'],
        resources: { toolNames: ['shared-resource'] },
      }),
    ]))).toEqual([])
  })

  test('checks each prior resource claimant for an overlapping profile', () => {
    const issues = validateCandidateLock(catalog([
      candidate({
        id: 'first',
        targetProfiles: ['web-curated'],
        resources: { toolNames: ['shared-resource'] },
      }),
      candidate({
        id: 'second',
        capability: 'memory',
        targetProfiles: ['web-research'],
        resources: { toolNames: ['shared-resource'] },
      }),
      candidate({
        id: 'third',
        capability: 'subagent',
        targetProfiles: ['web-research', 'web-enterprise'],
        resources: { toolNames: ['shared-resource'] },
      }),
    ]))

    expect(issues).toEqual([
      expect.objectContaining({
        code: 'candidate-resource-duplicate',
        candidateId: 'third',
        details: {
          field: 'toolNames',
          candidates: ['second', 'third'],
          value: 'shared-resource',
        },
      }),
    ])
  })

  test('returns frozen stable candidate query results', () => {
    const policy = new CuratedPolicy(catalog([
      candidate({ id: 'specific', targetProfiles: ['web-curated'] }),
      candidate({ id: 'shared', capability: 'memory', targetProfiles: ['web-curated', 'web-coding'] }),
      candidate({
        id: 'disabled',
        active: false,
        rejections: [{ code: 'long-cycle-evidence-pending', evidence: 'fixture remains pending' }],
      }),
    ]))
    const all = policy.listCandidates()
    const conflicts = policy.listCapabilityConflicts()
    const permissions = policy.listPermissionRules()
    const profileCandidates = policy.getProfileCandidates('web-curated')

    expect(Object.isFrozen(all)).toBe(true)
    expect(Object.isFrozen(all[0])).toBe(true)
    expect(Object.isFrozen(conflicts)).toBe(true)
    expect(Object.isFrozen(permissions)).toBe(true)
    expect(conflicts.map(rule => rule.capability)).toContain('web-search')
    expect(permissions.map(rule => rule.id)).toContain('credentials-never-in-profile')
    expect(Object.isFrozen(profileCandidates)).toBe(true)
    expect(policy.getProfileCandidates('web-curated')).toBe(profileCandidates)
    expect(profileCandidates.map(item => item.id)).toEqual(['specific', 'shared'])
    expect(() => { (all as CuratedCandidate[]).push(candidate({ id: 'late' })) }).toThrow(TypeError)
    expect(() => { (all[0] as { id: string }).id = 'mutated' }).toThrow(TypeError)
    expect(policy.listCandidates().map(item => item.id)).toEqual(['specific', 'shared', 'disabled'])
  })

  test('copies and freezes optional resource fields from constructor input', () => {
    const original = candidate({
      id: 'resourceful',
      score: 99,
      resources: {
        entryIds: ['entry-a'],
        toolNames: ['tool_a'],
        commandNames: ['command:a'],
        serviceKeys: ['service.a'],
        uiSlots: ['slot:a'],
        settingsTabs: ['settings:a'],
        routes: ['/curated/a'],
        ports: ['127.0.0.1:8080'],
        sqlitePaths: ['state/resourceful.sqlite'],
        cacheDirs: ['cache/resourceful'],
        envVars: ['RESOURCEFUL_TOKEN'],
        waterfallListeners: ['tools/pre-execute:next'],
        automationBehaviors: ['auto-memory'],
      },
    })
    const policy = new CuratedPolicy(catalog([original]))

    ;(original.resources?.entryIds as string[] | undefined)?.push('entry-b')
    ;(original.targetProfiles as string[]).push('headless-curated')

    const stored = policy.listCandidates()[0]
    expect(stored?.score).toBe(99)
    expect(stored?.targetProfiles).toEqual(['web-curated'])
    expect(stored?.resources).toEqual({
      entryIds: ['entry-a'],
      toolNames: ['tool_a'],
      commandNames: ['command:a'],
      serviceKeys: ['service.a'],
      uiSlots: ['slot:a'],
      settingsTabs: ['settings:a'],
      routes: ['/curated/a'],
      ports: ['127.0.0.1:8080'],
      sqlitePaths: ['state/resourceful.sqlite'],
      cacheDirs: ['cache/resourceful'],
      envVars: ['RESOURCEFUL_TOKEN'],
      waterfallListeners: ['tools/pre-execute:next'],
      automationBehaviors: ['auto-memory'],
    })
    expect(Object.isFrozen(stored?.resources)).toBe(true)
    expect(Object.isFrozen(stored?.resources?.envVars)).toBe(true)

    const sparse = new CuratedPolicy(catalog([
      candidate({ id: 'sparse-resources', resources: {} }),
    ])).listCandidates()[0]
    expect(sparse?.resources).toEqual({})
  })

  test('removes ctx.curatedPolicy when the plugin fiber is disposed', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(curatedPolicyPlugin)

    expect(ctx.get('curatedPolicy')).toBeInstanceOf(CuratedPolicy)
    await fiber.dispose()
    expect(ctx.get('curatedPolicy')).toBeUndefined()
    await ctx.fiber.dispose()
  })

  test('loads capability conflicts and permission rules from explicit files', () => {
    const conflicts = withTempFile(`schemaVersion: 1
source: docs/plugin/superpowers/02-插件矩阵与择优.md
rules:
  - capability: search
    defaultProvider: plugin-a
    fallbacks: [plugin-b]
    rule: one-active-provider
    reason: one active provider
`, filePath => loadCapabilityConflicts(filePath))
    const permissions = withTempFile(`schemaVersion: 1
source: docs/plugin/superpowers/05-安全供应链与风险.md
order: [core-sandbox]
defaults:
  otelCaptureBody: false
rules:
  - id: ask-search
    decision: ask
    appliesTo: [search]
    reason: external search
`, filePath => loadPermissionRules(filePath))

    expect(conflicts.rules).toEqual([
      {
        capability: 'search',
        defaultProvider: 'plugin-a',
        fallbacks: ['plugin-b'],
        rule: 'one-active-provider',
        reason: 'one active provider',
      },
    ])
    expect(Object.isFrozen(conflicts.rules[0])).toBe(true)
    expect(permissions.defaults).toEqual({
      otelCaptureBody: false,
    })
    expect(permissions.rules).toEqual([
      {
        id: 'ask-search',
        decision: 'ask',
        appliesTo: ['search'],
        reason: 'external search',
      },
    ])
    expect(Object.isFrozen(permissions.rules[0])).toBe(true)
  })

  test('rejects unsupported policy schemas and unsafe known permission defaults', () => {
    const baseCatalog = catalog([])
    const conflictRule = {
      capability: 'web-search',
      defaultProvider: null,
      fallbacks: [],
      rule: 'one-active-provider' as const,
      reason: 'one provider',
    }
    const permissionRule = {
      id: 'deny-secrets',
      decision: 'deny' as const,
      appliesTo: ['profiles'],
      reason: 'keep secrets out of profiles',
    }
    const safePermissions = {
      schemaVersion: 1,
      source: 'fixture',
      order: [...authoritativePermissionOrder],
      defaults: {
        configImportMode: 'dry-run',
        otelCaptureBody: false,
        credentialStorage: 'credentials-service-or-env',
      },
      rules: [permissionRule],
    }

    expect(validatePolicySemantics(
      baseCatalog,
      { schemaVersion: 2, source: 'fixture', rules: [conflictRule] },
      safePermissions,
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'capability-conflict-schema-version' }),
    ]))
    expect(validatePolicySemantics(
      baseCatalog,
      { schemaVersion: 1, source: 'fixture', rules: [conflictRule] },
      { ...safePermissions, schemaVersion: 2 },
    )).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'permission-schema-version' }),
    ]))

    for (const [key, value, code] of [
      ['configImportMode', 'execute', 'permission-config-import-mode-unsafe'],
      ['otelCaptureBody', true, 'permission-otel-capture-body-unsafe'],
      ['credentialStorage', 'plaintext', 'permission-credential-storage-unsafe'],
    ] as const) {
      const issues = validatePolicySemantics(
        baseCatalog,
        { schemaVersion: 1, source: 'fixture', rules: [conflictRule] },
        {
          ...safePermissions,
          defaults: { ...safePermissions.defaults, [key]: value },
        },
      )
      expect(issues, key).toEqual(expect.arrayContaining([
        expect.objectContaining({ code }),
      ]))
    }
  })

  test('rejects inert approval defaults that curated-policy does not enforce', () => {
    withTempFile(`schemaVersion: 1
source: fixture
order: [permission-rules, tool-execution]
defaults:
  llmDecisionFailure: deny
rules: []
`, (filePath) => {
      expect(() => loadPermissionRules(filePath))
        .toThrow('curated catalog permission rules.defaults contains unknown key llmDecisionFailure')
    })
  })

  test('rejects malformed capability and permission policy fields', () => {
    withTempFile(`schemaVersion: 1
source: docs/plugin/superpowers/02-插件矩阵与择优.md
rules:
  - capability: search
    defaultProvider: null
    fallbacks: []
    rule: sometimes
    reason: invalid
`, (filePath) => {
      expect(() => loadCapabilityConflicts(filePath))
        .toThrow('curated catalog rules[0].rule must be a known conflict rule kind')
    })

    withTempFile(`schemaVersion: 1
source: docs/plugin/superpowers/05-安全供应链与风险.md
order: [core-sandbox]
defaults:
  retryLimit: 3
rules:
  - id: ask-search
    decision: ask
    appliesTo: [search]
    reason: external search
`, (filePath) => {
      expect(() => loadPermissionRules(filePath))
        .toThrow('curated catalog permission rules.defaults.retryLimit must be a non-empty string or boolean')
    })

    withTempFile(`schemaVersion: 1
source: docs/plugin/superpowers/05-安全供应链与风险.md
order: [core-sandbox]
defaults: {}
rules:
  - id: ask-search
    decision: prompt
    appliesTo: [search]
    reason: external search
`, (filePath) => {
      expect(() => loadPermissionRules(filePath))
        .toThrow('curated catalog rules[0].decision must be allow, ask, or deny')
    })
  })


  test('registers the curated policy invariant without installing runtime checks', async () => {
    type InstalledInvariant = (ctx: Context, fail: (message: string) => void) => void
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
    } as unknown as Context

    await expect(invariantPlugin.apply(ctx)).resolves.toBe(disposer)
    expect(registered.packageName).toBe('@deepseek-ai/dsh-curated-policy')

    const messages: string[] = []
    registered.install?.(ctx, message => messages.push(message))
    expect(messages).toEqual([])
  })

  test('does not read policy files when the invariant installer runs', async () => {
    type InstalledInvariant = (ctx: Context, fail: (message: string) => void) => void
    const registered: { install?: InstalledInvariant } = {}
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        readFileSync: () => {
          throw new Error('runtime invariant read a policy file')
        },
      }
    })
    const mockedInvariantPlugin = await import('@deepseek-ai/dsh-curated-policy/invariant')
    const ctx = {
      invariants: {
        register(_packageName: string, install: InstalledInvariant) {
          registered.install = install
          return () => {}
        },
      },
    } as unknown as Context

    await mockedInvariantPlugin.apply(ctx)

    const messages: string[] = []
    expect(() => registered.install?.(ctx, message => messages.push(message))).not.toThrow()
    expect(messages).toEqual([])
  })
})

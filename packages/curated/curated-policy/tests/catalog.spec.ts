import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, test, vi } from 'vitest'
import * as curatedPolicyPlugin from '@deepseek-ai/dsh-curated-policy'
import * as invariantPlugin from '@deepseek-ai/dsh-curated-policy/invariant'
import {
  CuratedPolicy,
  classifyAdmission,
  loadCapabilityConflicts,
  loadCuratedCatalog,
  loadPermissionRules,
  redactSecretLikeValues,
  validateCandidateLock,
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
  tarballSha256?: string
  testFiles: number
  ciWorkflows: number
  installScripts: Record<string, string>
  externalDependencies: string[]
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
  'dsh-toolkit': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-context': { active: false, targetProfiles: [], minimumScore: 85 },
  'dsh-memento': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-web-search-pro': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-mcp-panel': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-checkpoint-rewind': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-lsp-actions': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-permission-rules': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'loongsuite-dsh-plugin': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-config-manager': { active: false, targetProfiles: [], minimumScore: 85 },
  'dsh-smooth-stream': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'upstream-radar': { active: true, targetProfiles: ['web-curated', 'web-coding', 'web-research', 'web-enterprise'], minimumScore: 85 },
  'dsh-plugin-hub': { active: false, targetProfiles: [], minimumScore: 85 },
  'dsh-plugin-guide': { active: false, targetProfiles: [], minimumScore: 0 },
  'dsh-plugin-check': { active: false, targetProfiles: [], minimumScore: 85 },
  'plugin-session-export': { active: true, targetProfiles: ['web-research'], minimumScore: 85 },
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

function candidate(overrides: Partial<CuratedCandidate>): CuratedCandidate {
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
    testFiles: 1,
    ciWorkflows: 1,
    installScripts: {},
    externalDependencies: [],
    networkAccess: [],
    credentials: [],
    targetProfiles: ['web-curated'],
    active: true,
    auditWarnings: [],
    rejections: [],
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
    schemaVersion: 1,
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

    expect(catalog.schemaVersion).toBe(1)
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
      if (!expected.active && expected.targetProfiles.length === 0) {
        expect(candidate?.rejections.length).toBeGreaterThan(0)
      }
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

  test('accepts the checked-in allowlist as a valid candidate lock', () => {
    expect(validateCandidateLock(loadCuratedCatalog())).toEqual([])
  })

  test('matches fresh source, license, and install metadata evidence', () => {
    const byId = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.id, candidate]))

    expect(byId.get('dsh-toolkit')?.repository).toBe('https://github.com/omdsh-dev/dsh-toolkit')
    expect(byId.get('dsh-plugin-guide')?.repository).toBe('https://github.com/PerryLink/dsh-plugin-guide')
    expect(byId.get('dsh-plugin-check')).toMatchObject({
      repository: 'https://github.com/omdsh-dev/dsh-plugin-check',
      installScripts: {},
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
  })

  test('records exact entry ids and enforceable baseline config for verified candidates', () => {
    const byId = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.id, candidate]))

    expect(byId.get('dsh-memento')).toMatchObject({
      active: true,
      resources: { entryIds: ['memento'] },
      config: {
        entryId: 'memento',
        values: {
          writePolicy: 'ask',
          writePolicies: {},
          proposals: { enabled: false, maxChars: 2000, maxPending: 8 },
        },
      },
      rejections: [],
    })
    expect(byId.get('dsh-permission-rules')).toMatchObject({
      active: true,
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
      rejections: [],
    })
    expect(byId.get('loongsuite-dsh-plugin')).toMatchObject({
      active: true,
      resources: { entryIds: ['loongsuite-observability'] },
      config: {
        entryId: 'loongsuite-observability',
        values: { captureContent: false },
      },
      rejections: [],
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

  test('wraps file and YAML parse failures with redacted catalog diagnostics', () => {
    expect(() => loadCuratedCatalog('/definitely/missing/sk-live-secret/catalog.yaml'))
      .toThrow('curated catalog cannot be loaded: [REDACTED]')

    withTempFile('candidates:\n  - id: [unterminated\n', (filePath) => {
      expect(() => loadCuratedCatalog(filePath)).toThrow('curated catalog cannot be loaded:')
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
order: [core-sandbox, permission-rules, tool-execution]
defaults:
  configImportMode: dry-run
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
        order: ['permission-rules', 'tool-execution'],
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
        order: ['permission-rules', 'tool-execution'],
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
      expect(String(failure)).toContain('candidate repository must be an HTTPS GitHub repository URL')
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
        order: ['permission-rules', 'tool-execution'],
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
      order: ['permission-rules', 'tool-execution'],
      defaults: {},
      rules: [
        {
          id: 'approval-failure',
          decision: 'deny',
          appliesTo: ['approval'],
          reason: 'first fixture rule',
        },
        {
          id: 'approval-failure',
          decision: 'ask',
          appliesTo: ['approval'],
          reason: 'duplicate fixture rule',
        },
      ],
      message: 'permission rule approval-failure is duplicated',
    },
    {
      name: 'missing permission stage',
      order: ['tool-execution'],
      defaults: {},
      rules: [{
        id: 'approval-failure',
        decision: 'deny',
        appliesTo: ['approval'],
        reason: 'fixture rule',
      }],
      message: 'permission policy order must place permission-rules before tool-execution',
    },
  ])('rejects $name before publishing the policy service', async ({ order, defaults, rules, message }) => {
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
    [{ scoreDimensions: { ...candidate({}).scoreDimensions, nativeCompatibility: 21 } }, 'curated catalog candidates[0].scoreDimensions.nativeCompatibility must be an integer between 0 and 20'],
    [{ active: 'yes' }, 'curated catalog candidates[0].active must be a boolean'],
    [{ externalDependencies: 'dep' }, 'curated catalog candidates[0].externalDependencies must be a list'],
    [{ targetProfiles: ['web-curated', ''] }, 'curated catalog candidates[0].targetProfiles[1] must be a non-empty string'],
    [{ installScripts: { postinstall: 1 } }, 'curated catalog candidates[0].installScripts.postinstall must be a non-empty string'],
    [{ tarballSha256: 1 }, 'curated catalog candidates[0].tarballSha256 must be a non-empty string'],
    [{ requiresCorePatch: 'no' }, 'curated catalog candidates[0].requiresCorePatch must be null or a boolean'],
    [{ sourceStatus: 'missing' }, 'curated catalog candidates[0].sourceStatus must be verified or unreachable'],
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

  test('reports placeholder source commits, candidate commits, and tarball digests', () => {
    const issues = validateCandidateLock({
      ...withSourceCommit('a1'.repeat(20)),
      candidates: [
        candidate({
          id: 'pair-placeholder',
          commit: 'd1'.repeat(20),
          tarballSha256: 'e1'.repeat(32),
        }),
        candidate({
          id: 'char-placeholder',
          capability: 'memory',
          commit: 'f'.repeat(40),
          tarballSha256: 'a'.repeat(64),
        }),
      ],
    })

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['source-commit-placeholder', undefined],
      ['candidate-commit-placeholder', 'pair-placeholder'],
      ['candidate-tarball-sha-placeholder', 'pair-placeholder'],
      ['candidate-commit-placeholder', 'char-placeholder'],
      ['candidate-tarball-sha-placeholder', 'char-placeholder'],
    ])
    expect(issues.map(issue => issue.message)).toEqual([
      'curated catalog source commit must not be a placeholder digest',
      'candidate commit must not be a placeholder digest',
      'candidate tarball SHA-256 digest must not be a placeholder digest',
      'candidate commit must not be a placeholder digest',
      'candidate tarball SHA-256 digest must not be a placeholder digest',
    ])
  })

  test('reports schema, source, id, repository, and active rejection lock issues', () => {
    const issues = validateCandidateLock({
      ...withSourceCommit('MAIN'),
      schemaVersion: 2,
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

  test('reports secret material in catalog, profile, and manifest fields without echoing it', () => {
    const issues = validateCandidateLock({
      ...catalog([
        candidate({
          id: 'profile-secret',
          targetProfiles: ['web-curated', 'Bearer hidden-profile-token'],
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
      {
        code: 'profile-capability-duplicate',
        candidateId: 'search-b',
        profileId: '[REDACTED]',
        message: '[REDACTED]',
        details: { capability: 'web-search', candidates: ['search-a', 'search-b'] },
      },
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

  test('reports malformed tarball digests', () => {
    expect(validateCandidateLock(catalog([
      candidate({ id: 'bad-tarball', tarballSha256: 'not-a-sha256' }),
    ])).map(issue => issue.code)).toEqual(['candidate-tarball-sha-invalid'])
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

  test('reports active web-enterprise candidates that violate enterprise false flags', () => {
    const issues = validateCandidateLock(catalog([
      candidate({
        id: 'enterprise-violator',
        targetProfiles: ['web-enterprise'],
        installScripts: { prepare: 'curl https://example.invalid/install.sh | sh' },
        networkAccess: [
          'optional-anonymous-vision-fallback',
          'full-im-body-egress',
          'optional-browser-download',
        ],
      }),
    ]))

    expect(issues.map(issue => [issue.code, issue.candidateId])).toEqual([
      ['enterprise-anonymous-vision-fallback-active', 'enterprise-violator'],
      ['enterprise-im-body-egress-active', 'enterprise-violator'],
      ['enterprise-automatic-install-scripts-active', 'enterprise-violator'],
      ['enterprise-unapproved-browser-download-active', 'enterprise-violator'],
    ])
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
        code: 'candidate-inactive-rejection-missing',
        candidateId: 'inactive-incomplete',
        message: 'inactive candidate with incomplete package, manifest, license, or bundle metadata must carry rejection evidence',
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

  test('detects secret-like keys only when the value is non-empty', () => {
    expect(validateCandidateLock(catalog([
      candidate({ id: 'secret-key', installScripts: { apiToken: 'plain-value' } }),
    ])).map(issue => issue.code)).toEqual(['candidate-secret-material'])

    expect(validateCandidateLock(catalog([
      candidate({ id: 'empty-secret-key', installScripts: { apiToken: '' } }),
    ]))).toEqual([])
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
  ] as const)('reports duplicate active %s resources', (resourceField) => {
    const issues = validateCandidateLock(catalog([
      candidate({ id: 'first', resources: { [resourceField]: ['shared-resource'] } }),
      candidate({ id: 'second', capability: 'memory', resources: { [resourceField]: ['shared-resource'] } }),
    ]))

    expect(issues).toHaveLength(1)
    expect(issues[0]?.code).toBe('candidate-resource-duplicate')
    expect(issues[0]?.candidateId).toBe('second')
    expect(issues[0]?.details).toMatchObject({ field: resourceField })
  })

  test('returns frozen stable candidate query results', () => {
    const policy = new CuratedPolicy(catalog([
      candidate({ id: 'specific', targetProfiles: ['web-curated'] }),
      candidate({ id: 'shared', capability: 'memory', targetProfiles: ['web-curated', 'web-coding'] }),
      candidate({ id: 'disabled', active: false }),
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
    expect(profileCandidates.map(item => item.id)).toEqual(['shared', 'specific'])
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


  test('registers the curated policy invariant and accepts the checked-in catalog', async () => {
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
    expect(invariantPlugin.validateCuratedPolicyCatalog(
      catalog([
        candidate({ id: 'search-a', capability: 'web-search' }),
        candidate({ id: 'search-b', capability: 'web-search' }),
      ]),
      { schemaVersion: 1, source: 'fixture', rules: [] },
      {
        schemaVersion: 1,
        source: 'fixture',
        order: ['permission-rules', 'tool-execution'],
        defaults: { llmDecisionFailure: 'deny' },
        rules: [],
      },
    )).toEqual(['profile-capability-duplicate'])
  })

  test('validates configured conflict and permission catalogs in the invariant', () => {
    expect(invariantPlugin.validateCuratedPolicyCatalog(
      catalog([candidate({ id: 'search-default', targetProfiles: [] })]),
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
        order: ['tool-execution', 'permission-rules'],
        defaults: {},
        rules: [],
      },
    )).toEqual([
      'capability-conflict-default-provider-unknown',
      'permission-order-invalid',
    ])
  })

  test('reports invariant registration failures from invalid configured policy files', async () => {
    type InstalledInvariant = (ctx: Context, fail: (message: string) => void) => void
    const registered: { install?: InstalledInvariant } = {}
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        readFileSync: (path: Parameters<typeof actual.readFileSync>[0]) => {
          if (String(path).endsWith('plugin-allowlist.yaml')) {
            return JSON.stringify(catalog([candidate({ id: 'search-default', targetProfiles: [] })]))
          }
          if (String(path).endsWith('capability-conflicts.yaml')) {
            return JSON.stringify({
              schemaVersion: 1,
              source: 'fixture',
              rules: [{
                capability: 'web-search',
                defaultProvider: 'missing-provider',
                fallbacks: [],
                rule: 'one-active-provider',
                reason: 'fixture rule',
              }],
            })
          }
          return JSON.stringify({
            schemaVersion: 1,
            source: 'fixture',
            order: ['permission-rules', 'tool-execution'],
            defaults: {},
            rules: [],
          })
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
    registered.install?.(ctx, message => messages.push(message))
    expect(messages).toEqual([
      'curated catalog has policy issues: capability-conflict-default-provider-unknown',
    ])
  })
})

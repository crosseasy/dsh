import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { CURATED_PROFILE_TEMPLATES } from '@deepseek-ai/dsh-curated-profiles'
import { describe, expect, it, vi } from 'vitest'
import {
  CuratedBench,
  curatedBenchBaselinesDir,
  curatedBenchManifestsDir,
  curatedBenchTasksDir,
} from '../src/index.ts'
import * as curatedBenchPlugin from '../src/index.ts'
import * as invariantPlugin from '../src/invariant.ts'
import {
  assertBenchmarkLockSnapshotCandidates,
  assertBenchmarkRollbackCandidate,
  assertBenchmarkSnapshotSchemaVersion,
  canonicalBenchmarkJson,
  readBoundBenchmarkSnapshotReference,
  readBenchmarkSnapshotReference,
} from '../src/snapshot.ts'

const expectedDirectories = [curatedBenchManifestsDir, curatedBenchTasksDir, curatedBenchBaselinesDir]

type CuratedCandidatesManifest = {
  summary: {
    candidateCount: number
    activeCount: number
    rejectedCount: number
    admissionTiers: Record<'default' | 'scenario' | 'experimental' | 'rejected', number>
    deliveryStatuses: Record<'active' | 'qualified' | 'pending' | 'rejected', number>
    sourceContentSha256ByCandidate: Record<string, string>
    treeSha256ByCandidate: Record<string, string>
    runtimeDependencyClosureSha256ByCandidate: Record<string, string>
  }
}

type BenchmarkFixture = {
  evidenceKind: string
  baseline: { profile: string }
  candidate: { profile: string; runs: Array<{ taskId: string }> }
}

type AbComparisonsFixture = {
  comparisons: Array<{
    id: string
    scale: { queries?: number; webTasks?: number; repetitionsPerTask?: number }
    nonCompensableThresholds: string[]
  }>
}

type WebCdpRegressionFixture = {
  browser: { kind: string; cdpPort: number; ideEmbeddedBrowserAllowed: boolean }
  status: string
}

type P2RiskGateFixture = {
  evidenceKind: string
  profiles: Record<string, Record<string, unknown>>
  failureInjection: Array<{
    id: string
    capability: string
    acceptableRuntimeOutcomes: string[]
    status: string
    runtimeOutcome: string | null
  }>
  abComparisons: Array<Record<string, unknown>>
  canary: {
    status: string
    durationDays: number[]
    minimumTasks: number
    rolloutPercentages: number[]
    rollbackLines: string[]
  }
}

const comparatorRollbackLines = [
  'security-correctness-below-95',
  'data-loss-detected',
  'rollback-impossible',
  'startup-failure-rate-above-1',
  'critical-success-rate-drop',
  'first-token-p95-regression',
  'prompt-schema-token-regression',
  'cost-regression-without-success-gain',
] as const
const riskGateExactFieldsMessage = 'p2 risk gate asset must contain exactly schemaVersion, '
  + 'evidenceKind, source, profiles, failureInjection, abComparisons, and canary'

function bindBenchmarkSnapshot(
  benchmarkPath: string,
  side: 'baseline' | 'candidate',
  field: 'lockSnapshot' | 'profileSnapshot',
  snapshot: unknown,
): void {
  const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
    baseline: Record<'lockSnapshot' | 'profileSnapshot', { path: string; sha256: string }>
    candidate: Record<'lockSnapshot' | 'profileSnapshot', { path: string; sha256: string }>
  }
  benchmark[side][field].sha256 = createHash('sha256')
    .update(canonicalBenchmarkJson(snapshot))
    .digest('hex')
  writeFileSync(benchmarkPath, JSON.stringify(benchmark))
}

describe('curated benchmark assets', () => {
  it('exports directories containing JSON benchmark assets', () => {
    for (const dir of expectedDirectories) {
      expect(existsSync(join(dir, '.keep.json'))).toBe(true)
      expect(JSON.parse(readFileSync(join(dir, '.keep.json'), 'utf8'))).toHaveProperty('purpose')
    }
    const candidatesManifest = JSON.parse(
      readFileSync(join(curatedBenchManifestsDir, 'curated-candidates.json'), 'utf8'),
    ) as CuratedCandidatesManifest
    expect(candidatesManifest).toMatchObject({ schemaVersion: 2 })
    expect(candidatesManifest.summary).toMatchObject({
      candidateCount: 37,
      activeCount: 0,
      rejectedCount: 37,
      admissionTiers: { default: 0, scenario: 0, experimental: 0, rejected: 37 },
      deliveryStatuses: { active: 0, qualified: 6, pending: 6, rejected: 25 },
    })
    const closureDigests = Object.values(
      candidatesManifest.summary.runtimeDependencyClosureSha256ByCandidate,
    )
    const sourceContentDigests = Object.values(candidatesManifest.summary.sourceContentSha256ByCandidate)
    const treeDigests = Object.values(candidatesManifest.summary.treeSha256ByCandidate)
    expect(sourceContentDigests).toHaveLength(23)
    expect(sourceContentDigests.every(digest => /^[0-9a-f]{64}$/u.test(digest))).toBe(true)
    expect(treeDigests).toHaveLength(0)
    expect(treeDigests.every(digest => /^[0-9a-f]{64}$/u.test(digest))).toBe(true)
    expect(closureDigests).toHaveLength(0)
    expect(closureDigests.every(digest => /^[0-9a-f]{64}$/u.test(digest))).toBe(true)
    expect(JSON.parse(readFileSync(join(curatedBenchTasksDir, 'curated-tasksets.json'), 'utf8')))
      .toMatchObject({ schemaVersion: 1 })
    const riskGates = JSON.parse(
      readFileSync(join(curatedBenchTasksDir, 'p2-risk-gates.json'), 'utf8'),
    ) as P2RiskGateFixture
    expect(riskGates).toMatchObject({
      schemaVersion: 1,
      profiles: { 'web-coding': { budgets: { maxConcurrentAgents: 4 } } },
    })
    expect(riskGates.canary).toEqual({
      status: 'pending',
      durationDays: [3, 7],
      minimumTasks: 100,
      rolloutPercentages: [10, 30, 100],
      rollbackLines: comparatorRollbackLines,
    })
    expect(riskGates.failureInjection.map(failure => failure.id)).toEqual([
      'search-timeout',
      'model-429',
      'browser-crash',
      'sqlite-lock',
      'permission-denied-file',
      'illegal-patch',
      'network-offline',
      'plugin-init-exception',
    ])
    expect(riskGates.failureInjection.every(failure =>
      failure.status === 'pending'
      && failure.runtimeOutcome === null
      && failure.acceptableRuntimeOutcomes.length > 0
      && failure.acceptableRuntimeOutcomes.every(outcome =>
        outcome === 'fail-closed' || outcome === 'recovered'))).toBe(true)
    expect(Object.fromEntries(riskGates.failureInjection.map(failure => [
      failure.id,
      failure.acceptableRuntimeOutcomes,
    ]))).toEqual({
      'search-timeout': ['fail-closed', 'recovered'],
      'model-429': ['fail-closed', 'recovered'],
      'browser-crash': ['fail-closed', 'recovered'],
      'sqlite-lock': ['fail-closed', 'recovered'],
      'permission-denied-file': ['fail-closed', 'recovered'],
      'illegal-patch': ['fail-closed'],
      'network-offline': ['fail-closed', 'recovered'],
      'plugin-init-exception': ['fail-closed', 'recovered'],
    })
    const comparisons = JSON.parse(readFileSync(join(curatedBenchBaselinesDir, 'ab-comparisons.json'), 'utf8')) as AbComparisonsFixture
    expect(JSON.parse(readFileSync(join(curatedBenchTasksDir, 'p2-risk-gates.json'), 'utf8')))
      .toMatchObject({ evidenceKind: 'planned' })
    expect(comparisons).toMatchObject({ evidenceKind: 'planned' })
    expect(comparisons.comparisons.map(comparison => comparison.id)).toEqual([
      'web-search-pro-vs-free-web-search',
      'memento-vs-mneme',
      'computer-use-vs-tabbit',
      'mcp-panel-vs-mcp-manager',
      'cost-meter-vs-tokenledger',
    ])
    expect(comparisons.comparisons[0]?.scale.queries).toBe(100)
    expect(comparisons.comparisons[2]?.scale.webTasks).toBe(50)
    expect(comparisons.comparisons.every(comparison =>
      comparison.nonCompensableThresholds.length === 5
      && comparison.nonCompensableThresholds.every((threshold, index) =>
        threshold === comparatorRollbackLines[index]))).toBe(true)
    const cdp = JSON.parse(readFileSync(join(curatedBenchBaselinesDir, 'web-cdp-regression.json'), 'utf8')) as WebCdpRegressionFixture
    expect(cdp.browser).toEqual({ kind: 'Chrome', cdpPort: 9333, ideEmbeddedBrowserAllowed: false })
    expect(cdp.status).toBe('requires-browser-environment')
    const benchmark = JSON.parse(readFileSync(join(curatedBenchBaselinesDir, 'benchmark.json'), 'utf8')) as BenchmarkFixture
    expect(benchmark).toMatchObject({ baseline: { profile: 'web' }, candidate: { profile: 'web-curated' } })
    expect(benchmark).toMatchObject({ evidenceKind: 'planned' })
    expect(benchmark.candidate.runs).toEqual([])
    for (const snapshot of [
      'locks/web.json',
      'profiles/web.json',
      'locks/web-curated.json',
      'profiles/web-curated.json',
    ]) {
      const path = join(curatedBenchBaselinesDir, snapshot)
      expect(existsSync(path)).toBe(true)
      expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({ schemaVersion: 2 })
    }
    const activeLock = JSON.parse(
      readFileSync(join(curatedBenchBaselinesDir, 'locks/web-curated.json'), 'utf8'),
    ) as { catalogRef?: unknown; candidates?: Array<Record<string, unknown>> }
    expect(activeLock).not.toHaveProperty('catalogRef')
    expect(activeLock.candidates).toEqual([])
    expect(JSON.parse(
      readFileSync(join(curatedBenchBaselinesDir, 'history/2026-08-24.json'), 'utf8'),
    )).toMatchObject({
      schemaVersion: 1,
      kind: 'curated-planning-history',
      evidenceKind: 'planned',
      restorable: false,
      candidateCount: 37,
      activeCount: 21,
      catalogRef: 'packages/curated/curated-policy/policy/plugin-allowlist.yaml',
      profileBundles: [
        '@deepseek-ai/dsh-base',
        '@deepseek-ai/dsh-web-app',
        '@deepseek-ai/dsh-curated-base',
      ],
      migration: {
        from: [
          {
            path: 'locks/2026-08-24.json',
            kind: 'curated-lock-snapshot',
          },
          {
            path: 'profiles/web-curated-2026-08-24.json',
            kind: 'curated-profile-snapshot',
          },
        ],
        to: 'history/2026-08-24.json',
      },
    })
  })

  it('rejects smoke success and fabricated outcomes in planned P2 fault assets', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-risk-gates-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as {
      failureInjection: Array<Record<string, unknown>>
    }
    risk.failureInjection[0] = {
      ...risk.failureInjection[0],
      acceptableRuntimeOutcomes: ['smoke-success'],
      status: 'observed',
      runtimeOutcome: 'smoke-success',
    }
    writeFileSync(riskPath, JSON.stringify(risk))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'p2 risk gate failure search-timeout acceptableRuntimeOutcomes must contain only fail-closed or recovered',
          'planned p2 risk gate failure search-timeout must remain pending without a runtime outcome',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects duplicate and unknown P2 faults and non-canonical allowed outcomes', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-risk-gate-set-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as {
      failureInjection: Array<Record<string, unknown>>
    }
    const duplicate = { ...risk.failureInjection[0] }
    risk.failureInjection.push(duplicate, {
      id: 'smoke-only-fault',
      capability: 'smoke',
      acceptableRuntimeOutcomes: ['fail-closed'],
      status: 'pending',
      runtimeOutcome: null,
    })
    const invalidPatch = risk.failureInjection.find(failure => failure.id === 'illegal-patch')
    if (invalidPatch === undefined) throw new Error('missing illegal-patch fixture')
    invalidPatch.acceptableRuntimeOutcomes = ['recovered']
    writeFileSync(riskPath, JSON.stringify(risk))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'p2 risk gate failure ids must be unique: search-timeout',
          'p2 risk gate asset must not include unknown failure smoke-only-fault',
          'p2 risk gate failure illegal-patch acceptableRuntimeOutcomes must equal fail-closed',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each(['__proto__', 'constructor', 'toString'])(
    'reports prototype-chain P2 fault id %s as an unknown failure',
    (id) => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-risk-gate-prototype-'))
      const manifests = join(root, 'manifests')
      const tasks = join(root, 'tasks')
      const baselines = join(root, 'baselines')
      cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
      cpSync(curatedBenchTasksDir, tasks, { recursive: true })
      cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
      const riskPath = join(tasks, 'p2-risk-gates.json')
      const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as P2RiskGateFixture
      const failure = risk.failureInjection[0]
      if (failure === undefined) throw new Error('missing P2 failure fixture')
      risk.failureInjection[0] = { ...failure, id }
      writeFileSync(riskPath, JSON.stringify(risk))
      try {
        let messages: readonly string[] = []
        expect(() => {
          messages = invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })
        }).not.toThrow()
        expect(messages).toContain(`p2 risk gate asset must not include unknown failure ${id}`)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it('rejects malformed P2 faults and requires every standard fault', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-risk-gate-shape-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as {
      failureInjection: unknown[]
    }
    risk.failureInjection = [null, {}, ...risk.failureInjection.slice(0, -1)]
    writeFileSync(riskPath, JSON.stringify(risk))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'p2 risk gate failure 0 must be a JSON object',
          'p2 risk gate failure 1.id must be a non-empty string',
          'p2 risk gate asset must include failure plugin-init-exception',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('requires exact P2 asset, fault, and canary fields and fixed fault capabilities', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-risk-gate-fields-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as P2RiskGateFixture & {
      observed?: boolean
    }
    risk.observed = true
    risk.failureInjection[0] = {
      ...risk.failureInjection[0],
      capability: 'drifted-capability',
      result: 'fabricated',
    } as P2RiskGateFixture['failureInjection'][number]
    risk.canary = {
      ...risk.canary,
      observed: true,
    } as P2RiskGateFixture['canary']
    writeFileSync(riskPath, JSON.stringify(risk))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'p2 risk gate asset must contain exactly schemaVersion, evidenceKind, source, profiles, failureInjection, abComparisons, and canary',
          'p2 risk gate failure search-timeout must contain exactly id, capability, acceptableRuntimeOutcomes, status, and runtimeOutcome',
          'p2 risk gate failure search-timeout capability must be web-search',
          'p2 risk gate canary must contain exactly status, durationDays, minimumTasks, rolloutPercentages, and rollbackLines',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects P2 profile field-set and fixed-value drift', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-p2-profiles-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as P2RiskGateFixture
    const coding = risk.profiles['web-coding'] as {
      budgets: Record<string, unknown>
      unexpected?: boolean
    }
    coding.unexpected = true
    coding.budgets.maxConcurrentAgents = 5
    writeFileSync(riskPath, JSON.stringify(risk))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'p2 risk gate profile web-coding must contain exactly orchestrator, inactiveFallbacks, budgets, and browserAutomation',
          'p2 risk gate profile web-coding.budgets.maxConcurrentAgents must be 4',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects P2 A/B comparison field-set, identity, and threshold drift', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-p2-ab-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as P2RiskGateFixture
    risk.abComparisons[0] = {
      ...risk.abComparisons[0],
      alternative: 'drifted-memory-provider',
      nonCompensableThresholds: comparatorRollbackLines.slice(0, -1),
      result: 'fabricated',
    }
    writeFileSync(riskPath, JSON.stringify(risk))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'p2 risk gate A/B comparison memento-vs-mneme must contain exactly id, status, capability, primary, alternative, scale, statistics, and nonCompensableThresholds',
          'p2 risk gate A/B comparison memento-vs-mneme.alternative must be dsh-mneme',
          `p2 risk gate A/B comparison memento-vs-mneme.nonCompensableThresholds must equal ${comparatorRollbackLines.slice(0, 5).join(', ')}`,
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects standalone A/B comparison exact-schema and fixed-field drift', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-ab-fields-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const comparisonPath = join(baselines, 'ab-comparisons.json')
    const asset = JSON.parse(readFileSync(comparisonPath, 'utf8')) as {
      comparisons: Array<Record<string, unknown>>
    }
    asset.comparisons[0] = {
      ...asset.comparisons[0],
      capability: 'drifted-search',
      extra: true,
    }
    writeFileSync(comparisonPath, JSON.stringify(asset))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'A/B comparison web-search-pro-vs-free-web-search must contain exactly id, status, capability, primary, alternative, scale, statistics, and nonCompensableThresholds',
          'A/B comparison web-search-pro-vs-free-web-search.capability must be web-search',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fully validates standalone A/B comparisons when envelope fields are missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-ab-envelope-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const comparisonPath = join(baselines, 'ab-comparisons.json')
    const asset = JSON.parse(readFileSync(comparisonPath, 'utf8')) as {
      comparisons: Array<{ id: string }>
      schemaVersion?: number
      source?: string
      unexpected?: boolean
    }
    delete asset.schemaVersion
    delete asset.source
    asset.unexpected = true
    asset.comparisons = asset.comparisons.map(({ id }) => ({ id }))
    writeFileSync(comparisonPath, JSON.stringify(asset))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'A/B comparison asset must contain exactly schemaVersion, evidenceKind, source, and comparisons',
          'A/B comparison asset.schemaVersion must be 1',
          'A/B comparison asset.source must be a non-empty string',
          'A/B comparison web-search-pro-vs-free-web-search must contain exactly id, status, capability, primary, alternative, scale, statistics, and nonCompensableThresholds',
          'A/B comparison web-search-pro-vs-free-web-search.status must be pending',
          'A/B comparison web-search-pro-vs-free-web-search.scale must be a JSON object',
          'A/B comparison web-search-pro-vs-free-web-search.statistics must be a JSON object',
          'A/B comparison web-search-pro-vs-free-web-search.nonCompensableThresholds must be a JSON array',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects standalone A/B comparisons without every non-compensable threshold', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-ab-thresholds-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const comparisonPath = join(baselines, 'ab-comparisons.json')
    const asset = JSON.parse(readFileSync(comparisonPath, 'utf8')) as {
      comparisons: Array<Record<string, unknown>>
    }
    asset.comparisons[1] = {
      ...asset.comparisons[1],
      nonCompensableThresholds: comparatorRollbackLines.slice(0, -1),
    }
    writeFileSync(comparisonPath, JSON.stringify(asset))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        `A/B comparison memento-vs-mneme.nonCompensableThresholds must equal ${comparatorRollbackLines.slice(0, 5).join(', ')}`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects malformed, incomplete, and drifted P2 profiles', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-p2-profile-schema-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const original = JSON.parse(readFileSync(riskPath, 'utf8')) as Record<string, unknown>
    const validateProfiles = (profiles: unknown, mutate?: (risk: Record<string, unknown>) => void) => {
      const risk = structuredClone(original)
      risk.profiles = profiles
      mutate?.(risk)
      writeFileSync(riskPath, JSON.stringify(risk))
      return invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })
    }
    try {
      expect(validateProfiles([], (risk) => {
        risk.schemaVersion = 2
      })).toEqual(expect.arrayContaining([
        'p2 risk gate asset.schemaVersion must be 1',
        'p2 risk gate asset.profiles must be a JSON object',
      ]))

      expect(validateProfiles({})).toEqual(expect.arrayContaining([
        'p2 risk gate profiles must contain exactly web-coding, web-research, and web-enterprise',
        'p2 risk gate profiles.web-coding must be a JSON object',
        'p2 risk gate profiles.web-research must be a JSON object',
        'p2 risk gate profiles.web-enterprise must be a JSON object',
      ]))

      const profilesWithoutFallbacks = structuredClone(original.profiles) as Record<string, Record<string, unknown>>
      delete profilesWithoutFallbacks['web-coding']?.inactiveFallbacks
      const researchWithoutFidelityTasks = profilesWithoutFallbacks['web-research']?.office as
        | Record<string, unknown>
        | undefined
      delete researchWithoutFidelityTasks?.fidelityTasks
      const enterpriseWithoutRequirements = (
        profilesWithoutFallbacks['web-enterprise']?.externalChannels as
          | Record<string, Record<string, unknown>>
          | undefined
      )?.['dsh-feishu']
      delete enterpriseWithoutRequirements?.requiredBeforeActivation
      let missingFallbackMessages: readonly string[] = []
      expect(() => {
        missingFallbackMessages = validateProfiles(profilesWithoutFallbacks)
      }).not.toThrow()
      expect(missingFallbackMessages).toEqual(expect.arrayContaining([
        'p2 risk gate profile web-coding must contain exactly orchestrator, inactiveFallbacks, budgets, and browserAutomation',
        'p2 risk gate profile web-coding.inactiveFallbacks must be a JSON array',
        'p2 risk gate profile web-research.office.fidelityTasks must be a JSON array',
        'p2 risk gate profile web-enterprise.externalChannels.dsh-feishu.requiredBeforeActivation must be a JSON array',
      ]))

      expect(validateProfiles({
        'web-coding': { inactiveFallbacks: [] },
        'web-research': {},
        'web-enterprise': {},
      })).toEqual(expect.arrayContaining([
        'p2 risk gate profile web-coding.orchestrator must be dsh-agent-team-gui',
        'p2 risk gate profile web-coding.inactiveFallbacks must equal dsh-background-agents',
        'p2 risk gate profile web-coding.browserAutomation must be dsh-computer-use',
        'p2 risk gate profile web-coding.budgets must be a JSON object',
        'p2 risk gate profile web-research.visionRouter must be a JSON object',
        'p2 risk gate profile web-research.office must be a JSON object',
        'p2 risk gate profile web-enterprise.externalChannels must be a JSON object',
      ]))

      expect(validateProfiles({
        'web-coding': {
          orchestrator: 'dsh-agent-team-gui',
          inactiveFallbacks: ['dsh-background-agents'],
          budgets: {
            maxConcurrentAgents: 4,
            maxDelegationDepth: 2,
            maxTaskTokens: 120_000,
            taskTimeoutMs: 1_800_000,
          },
          browserAutomation: 'dsh-computer-use',
        },
        'web-research': {
          visionRouter: {
            anonymousFallback: true,
            requiredCredentialMode: 'anonymous',
            extra: true,
          },
          office: {
            provider: 'other-office',
            buildTimeBudgetMs: 1,
            rssBudgetMiB: 1,
            fidelityTasks: [],
            extra: true,
          },
        },
        'web-enterprise': {
          externalChannels: {
            extra: true,
          },
        },
      })).toEqual(expect.arrayContaining([
        'p2 risk gate profile web-research.visionRouter must contain exactly anonymousFallback, and requiredCredentialMode',
        'p2 risk gate profile web-research.visionRouter.anonymousFallback must be false',
        'p2 risk gate profile web-research.visionRouter.requiredCredentialMode must be provider-key-or-disabled',
        'p2 risk gate profile web-research.office must contain exactly provider, buildTimeBudgetMs, rssBudgetMiB, and fidelityTasks',
        'p2 risk gate profile web-research.office.provider must be dsh-univer-office',
        'p2 risk gate profile web-research.office.buildTimeBudgetMs must be 600000',
        'p2 risk gate profile web-research.office.rssBudgetMiB must be 2048',
        'p2 risk gate profile web-research.office.fidelityTasks must equal docx-roundtrip, xlsx-formula-preservation, pptx-layout-preservation',
        'p2 risk gate profile web-enterprise.externalChannels must contain exactly dsh-feishu',
        'p2 risk gate profile web-enterprise.externalChannels.dsh-feishu must be a JSON object',
      ]))

      expect(validateProfiles({
        'web-coding': {
          orchestrator: 'dsh-agent-team-gui',
          inactiveFallbacks: ['dsh-background-agents'],
          budgets: {
            maxConcurrentAgents: 5,
            maxDelegationDepth: 3,
            maxTaskTokens: 1,
            taskTimeoutMs: 1,
            extra: true,
          },
          browserAutomation: 'dsh-computer-use',
        },
        'web-research': {
          visionRouter: {
            anonymousFallback: false,
            requiredCredentialMode: 'provider-key-or-disabled',
          },
          office: {
            provider: 'dsh-univer-office',
            buildTimeBudgetMs: 600_000,
            rssBudgetMiB: 2048,
            fidelityTasks: ['docx-roundtrip', 'xlsx-formula-preservation', 'pptx-layout-preservation'],
          },
        },
        'web-enterprise': {
          externalChannels: {
            'dsh-feishu': {
              active: true,
              requiredBeforeActivation: [],
              extra: true,
            },
          },
        },
      })).toEqual(expect.arrayContaining([
        'p2 risk gate profile web-coding.budgets must contain exactly maxConcurrentAgents, maxDelegationDepth, maxTaskTokens, and taskTimeoutMs',
        'p2 risk gate profile web-coding.budgets.maxConcurrentAgents must be 4',
        'p2 risk gate profile web-coding.budgets.maxDelegationDepth must be 2',
        'p2 risk gate profile web-coding.budgets.maxTaskTokens must be 120000',
        'p2 risk gate profile web-coding.budgets.taskTimeoutMs must be 1800000',
        'p2 risk gate profile web-enterprise.externalChannels.dsh-feishu must contain exactly active, and requiredBeforeActivation',
        'p2 risk gate profile web-enterprise.externalChannels.dsh-feishu.active must be false',
        'p2 risk gate profile web-enterprise.externalChannels.dsh-feishu.requiredBeforeActivation must equal threat-model, credential-review, egress-approval',
      ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects malformed, incomplete, and drifted P2 A/B comparisons', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-p2-ab-schema-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as P2RiskGateFixture
    const comparison = risk.abComparisons[0] as Record<string, unknown>
    risk.abComparisons = [
      null,
      {},
      {
        ...comparison,
        status: 'observed',
        capability: 'other-memory',
        primary: 'other-primary',
        alternative: 'other-alternative',
        scale: { extra: true },
        statistics: { mean: false, extra: true },
        nonCompensableThresholds: [],
        extra: true,
      },
      { id: comparison.id },
      { ...comparison, id: 'unknown-comparison' },
    ] as Array<Record<string, unknown>>
    writeFileSync(riskPath, JSON.stringify(risk))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'p2 risk gate A/B comparison 0 must be a JSON object',
          'p2 risk gate A/B comparison 1.id must be a non-empty string',
          'p2 risk gate A/B comparison memento-vs-mneme must contain exactly id, status, capability, primary, alternative, scale, statistics, and nonCompensableThresholds',
          'p2 risk gate A/B comparison memento-vs-mneme.status must be pending',
          'p2 risk gate A/B comparison memento-vs-mneme.capability must be memory',
          'p2 risk gate A/B comparison memento-vs-mneme.primary must be dsh-memento',
          'p2 risk gate A/B comparison memento-vs-mneme.alternative must be dsh-mneme',
          'p2 risk gate A/B comparison memento-vs-mneme.scale must match the planned comparison scale',
          'p2 risk gate A/B comparison memento-vs-mneme.statistics must require mean, p50, p95, and failureDistribution',
          `p2 risk gate A/B comparison memento-vs-mneme.nonCompensableThresholds must equal ${comparatorRollbackLines.slice(0, 5).join(', ')}`,
          'p2 risk gate A/B comparison ids must be unique: memento-vs-mneme',
          'p2 risk gate A/B comparison memento-vs-mneme.scale must be a JSON object',
          'p2 risk gate A/B comparison memento-vs-mneme.statistics must be a JSON object',
          'p2 risk gate A/B comparison memento-vs-mneme.nonCompensableThresholds must be a JSON array',
          'p2 risk gate A/B comparison must not include unknown comparison unknown-comparison',
          'p2 risk gate must include computer-use-vs-tabbit',
        ]))

      risk.abComparisons = {} as Array<Record<string, unknown>>
      writeFileSync(riskPath, JSON.stringify(risk))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'p2 risk gate asset.abComparisons must be a JSON array',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects malformed, incomplete, and drifted standalone A/B comparisons', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-ab-schema-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const comparisonPath = join(baselines, 'ab-comparisons.json')
    const asset = JSON.parse(readFileSync(comparisonPath, 'utf8')) as {
      comparisons: Array<Record<string, unknown>>
    }
    const comparison = asset.comparisons[0] as Record<string, unknown>
    asset.comparisons = [
      null,
      {},
      {
        ...comparison,
        status: 'observed',
        capability: 'other-search',
        primary: 'other-primary',
        alternative: 'other-alternative',
        scale: { extra: true },
        statistics: { p95: false, extra: true },
        nonCompensableThresholds: [],
        extra: true,
      },
      { id: comparison.id },
      { ...comparison, id: 'unknown-comparison' },
    ] as Array<Record<string, unknown>>
    writeFileSync(comparisonPath, JSON.stringify(asset))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'A/B comparison 0 must be a JSON object',
          'A/B comparison 1.id must be a non-empty string',
          'A/B comparison web-search-pro-vs-free-web-search must contain exactly id, status, capability, primary, alternative, scale, statistics, and nonCompensableThresholds',
          'A/B comparison web-search-pro-vs-free-web-search.status must be pending',
          'A/B comparison web-search-pro-vs-free-web-search.capability must be web-search',
          'A/B comparison web-search-pro-vs-free-web-search.primary must be dsh-web-search-pro',
          'A/B comparison web-search-pro-vs-free-web-search.alternative must be dsh-free-web-search',
          'A/B comparison web-search-pro-vs-free-web-search.scale must match the planned comparison scale',
          'A/B comparison web-search-pro-vs-free-web-search.statistics must require mean, p50, p95, and failureDistribution',
          `A/B comparison web-search-pro-vs-free-web-search.nonCompensableThresholds must equal ${comparatorRollbackLines.slice(0, 5).join(', ')}`,
          'A/B comparison ids must be unique: web-search-pro-vs-free-web-search',
          'A/B comparison web-search-pro-vs-free-web-search.scale must be a JSON object',
          'A/B comparison web-search-pro-vs-free-web-search.statistics must be a JSON object',
          'A/B comparison web-search-pro-vs-free-web-search.nonCompensableThresholds must be a JSON array',
          'A/B comparison must not include unknown comparison unknown-comparison',
          'A/B comparison must include memento-vs-mneme',
        ]))

      asset.comparisons = {} as Array<Record<string, unknown>>
      writeFileSync(comparisonPath, JSON.stringify(asset))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'A/B comparison asset.comparisons must be a JSON array',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    { name: 'extra values', durationDays: [3, 7, 9] },
    { name: 'string values', durationDays: ['3', 7] },
    { name: 'reversed values', durationDays: [7, 3] },
  ])('rejects canary durationDays with $name', ({ durationDays }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-canary-duration-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as P2RiskGateFixture
    risk.canary.durationDays = durationDays as number[]
    writeFileSync(riskPath, JSON.stringify(risk))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'p2 risk gate canary durationDays must equal the numeric array [3, 7]',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'a completed canary',
      mutate: (canary: P2RiskGateFixture['canary']) => {
        canary.status = 'completed'
      },
      message: 'planned p2 risk gate canary must remain pending',
    },
    {
      name: 'a missing comparator rollback reason',
      mutate: (canary: P2RiskGateFixture['canary']) => {
        canary.rollbackLines = canary.rollbackLines.slice(1)
      },
      message: `p2 risk gate canary rollbackLines must equal ${comparatorRollbackLines.join(', ')}`,
    },
    {
      name: 'an extra comparator rollback reason',
      mutate: (canary: P2RiskGateFixture['canary']) => {
        canary.rollbackLines.push('unknown-regression')
      },
      message: `p2 risk gate canary rollbackLines must equal ${comparatorRollbackLines.join(', ')}`,
    },
    {
      name: 'a duplicate comparator rollback reason',
      mutate: (canary: P2RiskGateFixture['canary']) => {
        canary.rollbackLines.push(canary.rollbackLines[0] as string)
      },
      message: `p2 risk gate canary rollbackLines must equal ${comparatorRollbackLines.join(', ')}`,
    },
    {
      name: 'comparator rollback reasons out of order',
      mutate: (canary: P2RiskGateFixture['canary']) => {
        canary.rollbackLines.reverse()
      },
      message: `p2 risk gate canary rollbackLines must equal ${comparatorRollbackLines.join(', ')}`,
    },
  ])('rejects $name', ({ mutate, message }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-canary-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const riskPath = join(tasks, 'p2-risk-gates.json')
    const risk = JSON.parse(readFileSync(riskPath, 'utf8')) as P2RiskGateFixture
    risk.canary.status = 'pending'
    risk.canary.rollbackLines = [...comparatorRollbackLines]
    mutate(risk.canary)
    writeFileSync(riskPath, JSON.stringify(risk))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toContain(message)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('binds embedded rollback snapshots to safe referenced benchmark artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-binding-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const benchmarkPath = join(baselines, 'benchmark.json')
    try {
      writeFileSync(join(baselines, 'locks/web.json'), JSON.stringify({
        schemaVersion: 2,
        kind: 'curated-lock-snapshot',
        profile: 'web',
        candidates: [{ id: 'different' }],
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'benchmark previous lock snapshot must equal the canonical baseline lock snapshot content',
      )

      const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
        previousSnapshots: {
          lock: { snapshot: Record<string, unknown> }
          profile: { snapshot: Record<string, unknown> }
        }
        baseline: { lockSnapshot: { path: string; sha256: string } }
      }
      writeFileSync(
        join(baselines, 'locks/web.json'),
        JSON.stringify(benchmark.previousSnapshots.lock.snapshot),
      )
      writeFileSync(join(baselines, 'profiles/web.json'), JSON.stringify({
        ...benchmark.previousSnapshots.profile.snapshot,
        bundles: [],
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'benchmark previous profile snapshot must equal the canonical baseline profile snapshot content',
      )

      benchmark.baseline.lockSnapshot = { ...benchmark.baseline.lockSnapshot, path: '../outside.json' }
      writeFileSync(benchmarkPath, JSON.stringify(benchmark))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'benchmark baseline lock snapshot.path must be a safe relative JSON path',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('requires schema 3 and all four content-addressed benchmark references', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-schema-three-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    const reset = (): string => {
      cpSync(curatedBenchManifestsDir, manifests, { recursive: true, force: true })
      cpSync(curatedBenchTasksDir, tasks, { recursive: true, force: true })
      cpSync(curatedBenchBaselinesDir, baselines, { recursive: true, force: true })
      return join(baselines, 'benchmark.json')
    }
    try {
      let benchmarkPath = reset()
      let benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
        schemaVersion: number
        baseline: Record<'lockSnapshot' | 'profileSnapshot', { path: string; sha256: string }>
        candidate: Record<'lockSnapshot' | 'profileSnapshot', { path: string; sha256: string }>
      }
      benchmark.schemaVersion = 2
      writeFileSync(benchmarkPath, JSON.stringify(benchmark))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'benchmark asset.schemaVersion must be 3',
      )

      for (const [side, field] of [
        ['baseline', 'lockSnapshot'],
        ['baseline', 'profileSnapshot'],
        ['candidate', 'lockSnapshot'],
        ['candidate', 'profileSnapshot'],
      ] as const) {
        benchmarkPath = reset()
        benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as typeof benchmark
        benchmark[side][field].sha256 = '0'.repeat(64)
        writeFileSync(benchmarkPath, JSON.stringify(benchmark))
        expect(
          invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }),
          `${side}.${field}`,
        ).toContain(`benchmark ${side} ${field === 'lockSnapshot' ? 'lock' : 'profile'} snapshot.sha256 does not match the referenced snapshot`)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    ['baseline lock', null, 'benchmark baseline lock snapshot must be a JSON object'],
    ['baseline lock', { path: 'locks/web.json', sha256: 'INVALID' }, 'benchmark baseline lock snapshot.sha256 must be a lowercase SHA-256 digest'],
    ['baseline profile', null, 'benchmark baseline profile snapshot must be a JSON object'],
    ['baseline profile', { path: 'profiles/web.json', sha256: 'INVALID' }, 'benchmark baseline profile snapshot.sha256 must be a lowercase SHA-256 digest'],
    ['candidate lock', null, 'benchmark candidate lock snapshot must be a JSON object'],
    ['candidate lock', { path: 'locks/web-curated.json', sha256: 'INVALID' }, 'benchmark candidate lock snapshot.sha256 must be a lowercase SHA-256 digest'],
    ['candidate profile', null, 'benchmark candidate profile snapshot must be a JSON object'],
    ['candidate profile', { path: 'profiles/web-curated.json', sha256: 'INVALID' }, 'benchmark candidate profile snapshot.sha256 must be a lowercase SHA-256 digest'],
  ] as const)('rejects an invalid $0 snapshot reference', (label, reference, message) => {
    expect(() => readBoundBenchmarkSnapshotReference('benchmark.json', reference, `benchmark ${label} snapshot`))
      .toThrow(message)
  })

  it.each([
    {
      name: 'profile snapshot kind',
      field: 'profileSnapshot',
      mutate: (snapshot: Record<string, unknown>) => { snapshot.kind = 'curated-lock-snapshot' },
      message: 'benchmark candidate profile snapshot.kind must be curated-profile-snapshot',
    },
    {
      name: 'profile snapshot profile',
      field: 'profileSnapshot',
      mutate: (snapshot: Record<string, unknown>) => { snapshot.profile = 'web' },
      message: 'benchmark candidate profile snapshot.profile must match the benchmark profile',
    },
    {
      name: 'lock snapshot catalog reference',
      field: 'lockSnapshot',
      mutate: (snapshot: Record<string, unknown>) => { snapshot.catalogRef = 'mutable' },
      message: 'benchmark candidate lock snapshot must not depend on a mutable catalogRef',
    },
  ] as const)('rejects referenced $name with a synchronized digest', ({ field, mutate, message }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-referenced-snapshot-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const benchmarkPath = join(baselines, 'benchmark.json')
    const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
      candidate: Record<'lockSnapshot' | 'profileSnapshot', { path: string; sha256: string }>
    }
    const snapshotPath = join(baselines, benchmark.candidate[field].path)
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Record<string, unknown>
    mutate(snapshot)
    writeFileSync(snapshotPath, JSON.stringify(snapshot))
    bindBenchmarkSnapshot(benchmarkPath, 'candidate', field, snapshot)
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(message)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects incompatible embedded and referenced snapshot schema versions', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-schema-version-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const benchmarkPath = join(baselines, 'benchmark.json')
    try {
      const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
        previousSnapshots: { lock: { sha256: string; snapshot: Record<string, unknown> } }
      }
      benchmark.previousSnapshots.lock.snapshot.schemaVersion = 3
      benchmark.previousSnapshots.lock.sha256 = createHash('sha256')
        .update(canonicalBenchmarkJson(benchmark.previousSnapshots.lock.snapshot))
        .digest('hex')
      writeFileSync(benchmarkPath, JSON.stringify(benchmark))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'benchmark previous lock snapshot.snapshot.schemaVersion must be 2',
      )
      const candidateLockPath = join(baselines, 'locks/web-curated.json')
      const candidateLock = JSON.parse(readFileSync(candidateLockPath, 'utf8')) as Record<string, unknown>
      candidateLock.schemaVersion = 1
      writeFileSync(candidateLockPath, JSON.stringify(candidateLock))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'web-curated lock snapshot.schemaVersion must be 2',
      )

      cpSync(curatedBenchBaselinesDir, baselines, { recursive: true, force: true })
      const candidateProfilePath = join(baselines, 'profiles/web-curated.json')
      const candidateProfile = JSON.parse(readFileSync(candidateProfilePath, 'utf8')) as Record<string, unknown>
      delete candidateProfile.schemaVersion
      writeFileSync(candidateProfilePath, JSON.stringify(candidateProfile))
      bindBenchmarkSnapshot(join(baselines, 'benchmark.json'), 'candidate', 'profileSnapshot', candidateProfile)
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'benchmark candidate profile snapshot.schemaVersion must be 2',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    { name: 'missing bundles', bundles: undefined, message: 'bundles must be an array' },
    { name: 'non-array bundles', bundles: {}, message: 'bundles must be an array' },
    { name: 'an empty bundle array', bundles: [], message: 'bundles must contain at least one bundle' },
    { name: 'an empty bundle name', bundles: [''], message: 'bundles[0] must be a non-empty string' },
  ])('rejects $name in embedded and referenced profile snapshots', ({ bundles, message }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-profile-bundles-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    const reset = (): void => {
      cpSync(curatedBenchManifestsDir, manifests, { recursive: true, force: true })
      cpSync(curatedBenchTasksDir, tasks, { recursive: true, force: true })
      cpSync(curatedBenchBaselinesDir, baselines, { recursive: true, force: true })
    }
    try {
      reset()
      const benchmarkPath = join(baselines, 'benchmark.json')
      const benchmark = JSON.parse(readFileSync(benchmarkPath, 'utf8')) as {
        previousSnapshots: { profile: { sha256: string; snapshot: Record<string, unknown> } }
      }
      if (bundles === undefined) delete benchmark.previousSnapshots.profile.snapshot.bundles
      else benchmark.previousSnapshots.profile.snapshot.bundles = bundles
      benchmark.previousSnapshots.profile.sha256 = createHash('sha256')
        .update(canonicalBenchmarkJson(benchmark.previousSnapshots.profile.snapshot))
        .digest('hex')
      writeFileSync(benchmarkPath, JSON.stringify(benchmark))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        `benchmark previous profile snapshot.snapshot.${message}`,
      )

      reset()
      const candidateProfilePath = join(baselines, 'profiles/web-curated.json')
      const candidateProfile = JSON.parse(readFileSync(candidateProfilePath, 'utf8')) as Record<string, unknown>
      if (bundles === undefined) delete candidateProfile.bundles
      else candidateProfile.bundles = bundles
      writeFileSync(candidateProfilePath, JSON.stringify(candidateProfile))
      bindBenchmarkSnapshot(join(baselines, 'benchmark.json'), 'candidate', 'profileSnapshot', candidateProfile)
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        `benchmark candidate profile snapshot.${message}`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'missing candidates',
      candidates: undefined,
      message: 'benchmark candidate lock snapshot.candidates must be an array',
    },
    {
      name: 'non-array candidates',
      candidates: {},
      message: 'benchmark candidate lock snapshot.candidates must be an array',
    },
    {
      name: 'an invalid candidate',
      candidates: [null],
      message: 'benchmark candidate lock snapshot.candidates[0] must be a JSON object',
    },
  ])('rejects $name in a referenced lock snapshot', ({ candidates, message }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-lock-candidates-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const candidateLockPath = join(baselines, 'locks/web-curated.json')
    const candidateLock = JSON.parse(readFileSync(candidateLockPath, 'utf8')) as Record<string, unknown>
    if (candidates === undefined) delete candidateLock.candidates
    else candidateLock.candidates = candidates
    writeFileSync(candidateLockPath, JSON.stringify(candidateLock))
    bindBenchmarkSnapshot(join(baselines, 'benchmark.json'), 'candidate', 'lockSnapshot', candidateLock)
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(message)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('validates every published lock and profile snapshot', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-published-snapshots-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    writeFileSync(join(baselines, 'locks/orphan.json'), JSON.stringify({
      schemaVersion: 1,
      kind: 'curated-profile-snapshot',
      profile: '',
      catalogRef: 'mutable',
      candidates: [{
        id: 'orphan',
        expectedPackage: 'orphan',
        bundlePatch: './cordis.patch.yml',
        sourceContentSha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        treeSha256: '89abcdef012345670123456789abcdef0123456789abcdef0123456701234567',
        runtimeDependencyClosureSha256: 'abcdef012345670123456789abcdef0123456789abcdef012345670123456789',
      }],
    }))
    writeFileSync(join(baselines, 'locks/missing.json'), JSON.stringify({
      schemaVersion: 2,
      kind: 'curated-lock-snapshot',
      profile: 'missing-candidates',
      catalogRef: 'mutable',
    }))
    writeFileSync(join(baselines, 'locks/invalid.json'), '[]\n')
    writeFileSync(join(baselines, 'locks/notes.txt'), 'not a published snapshot\n')
    writeFileSync(join(baselines, 'profiles/orphan.json'), JSON.stringify({
      schemaVersion: 2,
      kind: 'curated-lock-snapshot',
      profile: '',
      bundles: ['valid', ''],
    }))
    writeFileSync(join(baselines, 'profiles/missing.json'), JSON.stringify({
      schemaVersion: 2,
      kind: 'curated-profile-snapshot',
      profile: 'missing-bundles',
    }))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'published lock snapshot locks/invalid.json must be a JSON object',
          'published lock snapshot locks/missing.json must not depend on a mutable catalogRef',
          'published lock snapshot locks/missing.json.candidates must be a JSON array',
          'published lock snapshot locks/orphan.json.schemaVersion must be 2',
          'published lock snapshot locks/orphan.json.kind must be curated-lock-snapshot',
          'published lock snapshot locks/orphan.json.profile must be a non-empty string',
          'published lock snapshot locks/orphan.json must not depend on a mutable catalogRef',
          'published lock snapshot locks/orphan.json.candidates[0].installSource must be an object',
          'published profile snapshot profiles/missing.json.bundles must be an array',
          'published profile snapshot profiles/orphan.json.kind must be curated-profile-snapshot',
          'published profile snapshot profiles/orphan.json.profile must be a non-empty string',
          'published profile snapshot profiles/orphan.json.bundles[1] must be a non-empty string',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('recursively validates nested published snapshots and accepts valid nested snapshots', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-nested-snapshots-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    mkdirSync(join(baselines, 'locks/archive'), { recursive: true })
    mkdirSync(join(baselines, 'profiles/archive'), { recursive: true })
    const lockPath = join(baselines, 'locks/archive/valid.json')
    const profilePath = join(baselines, 'profiles/archive/valid.json')
    writeFileSync(lockPath, JSON.stringify({
      schemaVersion: 2,
      kind: 'curated-lock-snapshot',
      profile: 'nested',
      candidates: [],
    }))
    writeFileSync(profilePath, JSON.stringify({
      schemaVersion: 2,
      kind: 'curated-profile-snapshot',
      profile: 'nested',
      bundles: ['@deepseek-ai/dsh-base'],
    }))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([])

      writeFileSync(lockPath, JSON.stringify({
        schemaVersion: 1,
        kind: 'curated-lock-snapshot',
        profile: 'nested',
        candidates: [],
      }))
      writeFileSync(profilePath, JSON.stringify({
        schemaVersion: 2,
        kind: 'unknown-snapshot',
        profile: 'nested',
        bundles: [],
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'published lock snapshot locks/archive/valid.json.schemaVersion must be 2',
          'published profile snapshot profiles/archive/valid.json.kind must be curated-profile-snapshot',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('recursively validates planning history without accepting rollback snapshot claims', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-planning-history-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    rmSync(join(baselines, 'history'), { recursive: true })
    expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([])
    mkdirSync(join(baselines, 'history/archive'), { recursive: true })
    writeFileSync(join(baselines, 'history/archive/invalid.json'), JSON.stringify({
      schemaVersion: 2,
      kind: 'curated-lock-snapshot',
      evidenceKind: 'observed',
      restorable: true,
      source: '',
      createdAt: '2026-13-01',
      profile: '',
      candidateCount: -1,
      activeCount: 2,
      catalogRef: '',
      profileBundles: [],
      migration: {
        from: [],
        to: 'locks/invalid.json',
      },
    }))
    writeFileSync(join(baselines, 'history/archive/invalid-types.json'), JSON.stringify({
      schemaVersion: 1,
      kind: 'curated-planning-history',
      evidenceKind: 'planned',
      restorable: false,
      source: 'source',
      createdAt: null,
      profile: 'web-curated',
      candidateCount: '21',
      activeCount: '21',
      catalogRef: 'catalog',
      profileBundles: {},
      migration: null,
    }))
    writeFileSync(join(baselines, 'history/archive/invalid-migration.json'), JSON.stringify({
      schemaVersion: 1,
      kind: 'curated-planning-history',
      evidenceKind: 'planned',
      restorable: false,
      source: 'source',
      createdAt: '2026-02-29',
      profile: 'web-curated',
      candidateCount: 21,
      activeCount: 21,
      catalogRef: 'catalog',
      profileBundles: ['', 1],
      migration: {
        from: [
          null,
          {
            path: '../profiles/legacy.json',
            kind: 'unknown',
            restoreCommand: '',
          },
        ],
        to: 'history/archive/invalid-migration.json',
      },
    }))
    writeFileSync(join(baselines, 'history/archive/invalid-migration-list.json'), JSON.stringify({
      schemaVersion: 1,
      kind: 'curated-planning-history',
      evidenceKind: 'planned',
      restorable: false,
      source: 'source',
      createdAt: '2026-08-24',
      profile: 'web-curated',
      candidateCount: 21,
      activeCount: 21,
      catalogRef: 'catalog',
      profileBundles: ['@deepseek-ai/dsh-base'],
      migration: {
        from: {},
        to: 'history/archive/invalid-migration-list.json',
      },
    }))
    writeFileSync(join(baselines, 'history/archive/invalid-object.json'), '[]\n')
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'curated planning history history/archive/invalid.json.schemaVersion must be 1',
          'curated planning history history/archive/invalid.json.kind must be curated-planning-history',
          'curated planning history history/archive/invalid.json.evidenceKind must be planned',
          'curated planning history history/archive/invalid.json.restorable must be false',
          'curated planning history history/archive/invalid.json.source must be a non-empty string',
          'curated planning history history/archive/invalid.json.createdAt must be a YYYY-MM-DD date',
          'curated planning history history/archive/invalid.json.profile must be a non-empty string',
          'curated planning history history/archive/invalid.json.candidateCount must be a non-negative safe integer',
          'curated planning history history/archive/invalid.json.activeCount must not exceed candidateCount',
          'curated planning history history/archive/invalid.json.catalogRef must be a non-empty string',
          'curated planning history history/archive/invalid.json.profileBundles must contain at least one bundle',
          'curated planning history history/archive/invalid.json.migration.from must contain the former lock and profile records',
          'curated planning history history/archive/invalid.json.migration.to must equal history/archive/invalid.json',
          'curated planning history history/archive/invalid-types.json.createdAt must be a YYYY-MM-DD date',
          'curated planning history history/archive/invalid-types.json.candidateCount must be a non-negative safe integer',
          'curated planning history history/archive/invalid-types.json.activeCount must be a non-negative safe integer',
          'curated planning history history/archive/invalid-types.json.profileBundles must be an array',
          'curated planning history history/archive/invalid-types.json.migration must be a JSON object',
          'curated planning history history/archive/invalid-migration.json.profileBundles[0] must be a non-empty string',
          'curated planning history history/archive/invalid-migration.json.profileBundles[1] must be a non-empty string',
          'curated planning history history/archive/invalid-migration.json.createdAt must be a YYYY-MM-DD date',
          'curated planning history history/archive/invalid-migration.json.migration.from[0] must be a JSON object',
          'curated planning history history/archive/invalid-migration.json.migration.from[1].path must be a safe relative JSON path',
          'curated planning history history/archive/invalid-migration.json.migration.from[1].kind must be curated-lock-snapshot or curated-profile-snapshot',
          'curated planning history history/archive/invalid-migration.json.migration.from[1].restoreCommand must be a non-empty string',
          'curated planning history history/archive/invalid-migration-list.json.migration.from must be an array',
          'curated planning history history/archive/invalid-object.json must be a JSON object',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('binds safe planning-history source paths to their snapshot kinds', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-planning-source-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const historyPath = join(baselines, 'history/2026-08-24.json')
    const history = JSON.parse(readFileSync(historyPath, 'utf8')) as {
      migration: {
        from: Array<{
          path: string
          kind: 'curated-lock-snapshot' | 'curated-profile-snapshot'
        }>
      }
    }
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([])

      for (const path of [
        'locks/../outside.json',
        'locks/archive/../outside.json',
        '/absolute.json',
        'C:/absolute.json',
        'locks\\outside.json',
      ]) {
        history.migration.from[0]!.path = path
        writeFileSync(historyPath, JSON.stringify(history))
        expect(
          invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }),
          path,
        ).toContain(
          'curated planning history history/2026-08-24.json.migration.from[0].path '
          + 'must be a safe relative JSON path',
        )
      }

      history.migration.from[0]!.path = 'profiles/web-curated-2026-08-24.json'
      history.migration.from[1]!.path = 'locks/2026-08-24.json'
      writeFileSync(historyPath, JSON.stringify(history))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'curated planning history history/2026-08-24.json.migration.from[0].path '
          + 'must be under locks/ for curated-lock-snapshot',
          'curated planning history history/2026-08-24.json.migration.from[1].path '
          + 'must be under profiles/ for curated-profile-snapshot',
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects symbolic links and non-regular entries in published snapshot trees', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-snapshot-entry-types-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    symlinkSync('web.json', join(baselines, 'locks/linked.json'))
    const fifo = join(baselines, 'profiles/snapshot.fifo')
    if (process.platform !== 'win32') expect(spawnSync('mkfifo', [fifo]).status).toBe(0)
    try {
      const messages = invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })
      expect(messages).toContain(
        'published lock snapshot entry locks/linked.json must not be a symbolic link',
      )
      if (process.platform !== 'win32') {
        expect(messages).toContain(
          'published profile snapshot entry profiles/snapshot.fifo must be a regular file or directory',
        )
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('stops published snapshot traversal at the first entry over the exact limit', async () => {
    let availableEntries = 1024
    let nextEntry = 0
    const readSync = vi.fn(() => {
      if (nextEntry >= availableEntries) return null
      const name = `note-${String(nextEntry).padStart(4, '0')}.txt`
      nextEntry += 1
      return {
        name,
        isDirectory: () => false,
        isFile: () => true,
        isSymbolicLink: () => false,
      }
    })
    const closeSync = vi.fn()
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        opendirSync: (path: Parameters<typeof actual.opendirSync>[0]) => {
          if (String(path) === join(curatedBenchBaselinesDir, 'locks')) {
            return { readSync, closeSync } as unknown as ReturnType<typeof actual.opendirSync>
          }
          return actual.opendirSync(path)
        },
      }
    })
    try {
      const mockedInvariant = await import('../src/invariant.ts')

      expect(mockedInvariant.validateCuratedBenchAssets({
        manifests: curatedBenchManifestsDir,
        tasks: curatedBenchTasksDir,
        baselines: curatedBenchBaselinesDir,
      })).not.toContain('published lock snapshots must contain at most 1024 entries')
      expect(readSync).toHaveBeenCalledTimes(1025)
      expect(closeSync).toHaveBeenCalledTimes(1)

      availableEntries = 2048
      nextEntry = 0
      readSync.mockClear()
      closeSync.mockClear()
      expect(mockedInvariant.validateCuratedBenchAssets({
        manifests: curatedBenchManifestsDir,
        tasks: curatedBenchTasksDir,
        baselines: curatedBenchBaselinesDir,
      })).toContain('published lock snapshots must contain at most 1024 entries')
      expect(readSync).toHaveBeenCalledTimes(1025)
      expect(closeSync).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
    }
  })

  it('accepts the exact published snapshot directory depth limit', () => {
    const makeFixture = (suffix: string) => {
      const root = mkdtempSync(join(tmpdir(), `dsh-curated-bench-snapshot-${suffix}-`))
      const manifests = join(root, 'manifests')
      const tasks = join(root, 'tasks')
      const baselines = join(root, 'baselines')
      cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
      cpSync(curatedBenchTasksDir, tasks, { recursive: true })
      cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
      return { root, manifests, tasks, baselines }
    }
    const fixture = makeFixture('depth')
    try {
      let parent = join(fixture.baselines, 'locks')
      for (let depth = 1; depth <= 64; depth += 1) {
        parent = join(parent, `nested-${String(depth).padStart(2, '0')}`)
        mkdirSync(parent)
      }
      expect(invariantPlugin.validateCuratedBenchAssets(fixture)).toEqual([])

      mkdirSync(join(parent, 'nested-65'))
      expect(invariantPlugin.validateCuratedBenchAssets(fixture)).toContain(
        'published lock snapshots must contain at most 64 nested directory levels',
      )
    } finally {
      rmSync(fixture.root, { recursive: true, force: true })
    }
  })

  it('packs every recursive baseline JSON asset and no unlisted baseline file', () => {
    const packageRoot = join(curatedBenchBaselinesDir, '..')
    const result = spawnSync('pnpm', ['pack', '--dry-run', '--json'], {
      cwd: packageRoot,
      encoding: 'utf8',
      timeout: 20_000,
    })
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0)
    const pack = JSON.parse(result.stdout) as { files: Array<{ path: string }> }
    const packedBaselines = pack.files
      .map(file => file.path)
      .filter(path => path.startsWith('baselines/'))
      .sort()
    const expectedBaselines = new CuratedBench()
      .listAssets('baselines')
      .map(path => `baselines/${path}`)

    expect(packedBaselines).toEqual(expectedBaselines)
  })

  it('rejects incomplete current active candidate snapshots', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-current-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    writeFileSync(join(baselines, 'locks/web-curated.json'), JSON.stringify({
      schemaVersion: 2,
      kind: 'curated-profile-snapshot',
      profile: 'other-profile',
      catalogRef: 'mutable',
      candidates: [
        null,
        {
          id: 'unknown',
          repository: '',
          expectedPackage: '',
          bundlePatch: '',
          commit: 'short',
          sourceContentSha256: 'invalid',
          treeSha256: 'invalid',
          runtimeDependencyClosureSha256: 'invalid',
        },
      ],
    }))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines }))
        .toEqual(expect.arrayContaining([
          'benchmark candidate lock snapshot.sha256 does not match the referenced snapshot',
          'web-curated lock snapshot must not depend on a mutable catalogRef',
          'web-curated lock snapshot candidates must match the active candidate count',
          'web-curated lock snapshot candidate ids must match the candidate manifest',
          'web-curated lock snapshot.candidates[0] must be a JSON object',
          'web-curated lock snapshot.candidates[1].treeSha256 must be a lowercase SHA-256 digest',
          'web-curated lock snapshot candidate unknown closure digest must match the candidate manifest',
          'web-curated lock snapshot candidate unknown tree digest must match the candidate manifest',
        ]))
      writeFileSync(join(baselines, 'locks/web-curated.json'), JSON.stringify({
        schemaVersion: 2,
        kind: 'curated-lock-snapshot',
        profile: 'web-curated',
        candidates: {},
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'web-curated lock snapshot.candidates must be a JSON array',
      )
      writeFileSync(join(manifests, 'curated-candidates.json'), '[]\n')
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'curated candidate manifest must be a JSON object',
      )
      writeFileSync(join(manifests, 'curated-candidates.json'), '{}\n')
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'curated candidate manifest.summary must be a JSON object',
      )
      writeFileSync(join(baselines, 'locks/web-curated.json'), JSON.stringify({
        schemaVersion: 2,
        kind: 'curated-lock-snapshot',
        profile: 'web-curated',
        candidates: [],
      }))
      writeFileSync(join(manifests, 'curated-candidates.json'), JSON.stringify({
        summary: {
          activeCount: 0,
          sourceContentSha256ByCandidate: {},
          treeSha256ByCandidate: 'invalid',
          runtimeDependencyClosureSha256ByCandidate: {},
        },
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'curated candidate manifest.summary.treeSha256ByCandidate must be a JSON object',
      )
      writeFileSync(join(manifests, 'curated-candidates.json'), JSON.stringify({
        summary: {
          activeCount: 0,
          sourceContentSha256ByCandidate: 'invalid',
          treeSha256ByCandidate: {},
          runtimeDependencyClosureSha256ByCandidate: {},
        },
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'curated candidate manifest.summary.sourceContentSha256ByCandidate must be a JSON object',
      )
      writeFileSync(join(manifests, 'curated-candidates.json'), JSON.stringify({
        summary: {
          activeCount: 0,
          sourceContentSha256ByCandidate: {},
          treeSha256ByCandidate: {},
          runtimeDependencyClosureSha256ByCandidate: {},
        },
      }))
      writeFileSync(join(baselines, 'profiles/web-curated.json'), JSON.stringify({
        profile: 'web-curated',
        bundles: {},
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'web-curated profile snapshot.bundles must be an array',
      )
      cpSync(
        join(curatedBenchBaselinesDir, 'profiles/web-curated.json'),
        join(baselines, 'profiles/web-curated.json'),
      )
      writeFileSync(join(manifests, 'curated-candidates.json'), JSON.stringify({
        summary: {
          activeCount: 0,
          sourceContentSha256ByCandidate: {},
          treeSha256ByCandidate: {},
          runtimeDependencyClosureSha256ByCandidate: 'invalid',
        },
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'curated candidate manifest.summary.runtimeDependencyClosureSha256ByCandidate must be a JSON object',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a current rollback candidate without an exact install source', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-source-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const snapshotPath = join(baselines, 'locks/web-curated.json')
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as {
      candidates: Array<Record<string, unknown>>
    }
    snapshot.candidates = [{
      id: 'candidate-without-source',
      expectedPackage: 'candidate-without-source',
      bundlePatch: './cordis.patch.yml',
      sourceContentSha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      treeSha256: '89abcdef012345670123456789abcdef0123456789abcdef0123456701234567',
      runtimeDependencyClosureSha256: 'abcdef012345670123456789abcdef0123456789abcdef012345670123456789',
    }]
    writeFileSync(snapshotPath, JSON.stringify(snapshot))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'web-curated lock snapshot.candidates[0].installSource must be an object',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a rollback candidate absent from the authoritative profile template', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-current-source-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    cpSync(curatedBenchManifestsDir, manifests, { recursive: true })
    cpSync(curatedBenchTasksDir, tasks, { recursive: true })
    cpSync(curatedBenchBaselinesDir, baselines, { recursive: true })
    const id = 'fixture-candidate'
    const sourceContentSha256 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const treeSha256 = '89abcdef012345670123456789abcdef0123456789abcdef0123456701234567'
    const runtimeDependencyClosureSha256 = 'abcdef012345670123456789abcdef0123456789abcdef012345670123456789'
    const manifestPath = join(manifests, 'curated-candidates.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as CuratedCandidatesManifest
    manifest.summary.activeCount = 1
    manifest.summary.deliveryStatuses = { active: 1, qualified: 0, pending: 0, rejected: 36 }
    manifest.summary.sourceContentSha256ByCandidate[id] = sourceContentSha256
    manifest.summary.treeSha256ByCandidate = { [id]: treeSha256 }
    manifest.summary.runtimeDependencyClosureSha256ByCandidate = {
      [id]: runtimeDependencyClosureSha256,
    }
    writeFileSync(manifestPath, JSON.stringify(manifest))
    writeFileSync(join(baselines, 'locks/web-curated.json'), JSON.stringify({
      schemaVersion: 2,
      kind: 'curated-lock-snapshot',
      profile: 'web-curated',
      candidates: [{
        id,
        expectedPackage: id,
        bundlePatch: './cordis.patch.yml',
        sourceContentSha256,
        treeSha256,
        runtimeDependencyClosureSha256,
        installSource: {
          kind: 'npm',
          npmVersion: '1.2.3',
          npmIntegrity: 'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ==',
        },
      }],
    }))
    const profilePath = join(baselines, 'profiles/web-curated.json')
    const profile = JSON.parse(readFileSync(profilePath, 'utf8')) as { bundles: string[] }
    profile.bundles = [
      ...CURATED_PROFILE_TEMPLATES['web-curated'].bundles,
      id,
    ]
    writeFileSync(profilePath, JSON.stringify(profile))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toContain(
        'web-curated profile snapshot bundles must exactly match the authoritative web-curated template in order',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('exposes read-only benchmark assets through CuratedBench', () => {
    const service = new CuratedBench()

    expect(service.assetDirs()).toEqual({
      manifests: curatedBenchManifestsDir,
      tasks: curatedBenchTasksDir,
      baselines: curatedBenchBaselinesDir,
    })
    expect(service.listAssets('baselines')).toContain('benchmark.json')
    expect(service.listAssets('baselines')).toContain('locks/web-curated.json')
    const benchmark = service.readAsset('baselines', 'benchmark.json') as { candidate?: { profile?: string } }
    expect(benchmark.candidate?.profile).toBe('web-curated')
    expect(Object.isFrozen(benchmark)).toBe(true)
    expect(Object.isFrozen(benchmark.candidate)).toBe(true)
  })

  it('lists nested JSON benchmark assets without returning non-JSON files', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-list-'))
    const baselines = join(root, 'baselines')
    mkdirSync(join(baselines, 'nested'), { recursive: true })
    writeFileSync(join(baselines, 'root.json'), '{}\n')
    writeFileSync(join(baselines, 'notes.txt'), 'ignored\n')
    writeFileSync(join(baselines, 'nested', 'case.json'), '{}\n')
    try {
      const service = new CuratedBench({ baselines })

      expect(service.listAssets('baselines')).toEqual(['nested/case.json', 'root.json'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects unsafe benchmark service asset paths and non-plain JSON', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-service-'))
    const baselines = join(root, 'baselines')
    mkdirSync(baselines, { recursive: true })
    writeFileSync(join(baselines, 'undefined.json'), '{}\n')
    writeFileSync(join(baselines, 'date.json'), '{}\n')
    writeFileSync(join(baselines, 'null-prototype.json'), '{}\n')
    const service = new CuratedBench({ baselines })
    const nullPrototype = Object.create(null) as Record<string, unknown>
    nullPrototype.ok = true
    const parse = vi.spyOn(JSON, 'parse')
    try {
      expect(() => service.readAsset('baselines', '../benchmark.json')).toThrow('inside its asset directory')
      expect(() => service.readAsset('baselines', '/benchmark.json')).toThrow('relative POSIX JSON path')
      parse.mockReturnValueOnce(undefined)
      expect(() => service.readAsset('baselines', 'undefined.json')).toThrow('plain JSON')
      parse.mockReturnValueOnce(new Date(0))
      expect(() => service.readAsset('baselines', 'date.json')).toThrow('plain JSON')
      parse.mockReturnValueOnce(nullPrototype)
      expect(service.readAsset('baselines', 'null-prototype.json')).toBe(nullPrototype)
      expect(Object.isFrozen(nullPrototype)).toBe(true)
    } finally {
      parse.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reads null JSON assets and rejects unsupported snapshot values', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-json-'))
    const baselines = join(root, 'baselines')
    mkdirSync(baselines, { recursive: true })
    writeFileSync(join(baselines, 'null.json'), 'null\n')
    try {
      expect(new CuratedBench({ baselines }).readAsset('baselines', 'null.json')).toBeNull()
      expect(() => canonicalBenchmarkJson(undefined)).toThrow(
        'benchmark snapshots must contain plain JSON values',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('requires one complete exact install source per rollback candidate', () => {
    const shared = {
      id: 'plugin-a',
      expectedPackage: 'plugin-a',
      bundlePatch: './cordis.patch.yml',
      sourceContentSha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      treeSha256: '89abcdef012345670123456789abcdef0123456789abcdef0123456701234567',
      runtimeDependencyClosureSha256: 'abcdef012345670123456789abcdef0123456789abcdef012345670123456789',
    }
    const gitSource = {
      kind: 'git',
      repository: 'https://github.com/example/plugin-a',
      commit: '1234567890abcdef1234567890abcdef12345678',
      repositoryPath: null,
      installScripts: {},
    }
    const npmSource = {
      kind: 'npm',
      npmVersion: '1.2.3',
      npmIntegrity: 'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ==',
    }
    expect(() => {
      assertBenchmarkLockSnapshotCandidates({ candidates: [] }, 'lock')
    }).not.toThrow()
    expect(() => {
      assertBenchmarkLockSnapshotCandidates({
        candidates: [
          { ...shared, installSource: gitSource },
          {
            ...shared,
            installSource: { ...npmSource, npmVersion: '1.2.3-alpha.1+build.01' },
          },
        ],
      }, 'lock')
    }).not.toThrow()
    expect(() => {
      assertBenchmarkLockSnapshotCandidates({ candidates: {} }, 'lock')
    })
      .toThrow('lock.candidates must be an array')

    const cases: Array<{ value: unknown; message: string }> = [
      { value: null, message: 'candidate must be a JSON object' },
      {
        value: { ...shared, treeSha256: '0'.repeat(64), installSource: gitSource },
        message: 'candidate.treeSha256 must be a non-placeholder lowercase SHA-256 digest',
      },
      {
        value: { ...shared, installSource: { ...npmSource, npmVersion: 'latest' } },
        message: 'candidate.installSource.npmVersion must be an exact npm version',
      },
      {
        value: { ...shared, installSource: { ...npmSource, npmVersion: '1.2.3-01' } },
        message: 'candidate.installSource.npmVersion must be an exact npm version',
      },
      {
        value: { ...shared, installSource: { ...npmSource, npmVersion: '1.2.3-alpha..1' } },
        message: 'candidate.installSource.npmVersion must be an exact npm version',
      },
      {
        value: { ...shared, installSource: { ...npmSource, npmIntegrity: 'sha512-invalid' } },
        message: 'candidate.installSource.npmIntegrity must be a non-placeholder SHA-512 SRI',
      },
      {
        value: { ...shared, installSource: { ...npmSource, npmIntegrity: 'invalid' } },
        message: 'candidate.installSource.npmIntegrity must be a non-placeholder SHA-512 SRI',
      },
      {
        value: { ...shared, installSource: { ...gitSource, repository: 'not a URL' } },
        message: 'candidate.installSource.repository must be a canonical HTTPS GitHub repository URL',
      },
      {
        value: { ...shared, installSource: { ...gitSource, repository: 'http://github.com/example/plugin-a' } },
        message: 'candidate.installSource.repository must be a canonical HTTPS GitHub repository URL',
      },
      ...[
        'https://evil.example/example/plugin-a',
        'https://github.com/example/plugin-a%2Fother',
        'https://github.com/example/plugin-a/extra',
      ].map(repository => ({
        value: { ...shared, installSource: { ...gitSource, repository } },
        message: 'candidate.installSource.repository must be a canonical HTTPS GitHub repository URL',
      })),
      ...[
        '/absolute.yml',
        '../outside.yml',
        './patches\\cordis.patch.yml',
        'cordis.patch.yml',
      ].map(bundlePatch => ({
        value: { ...shared, bundlePatch, installSource: gitSource },
        message: 'candidate.bundlePatch must be a safe package-relative POSIX path starting with ./',
      })),
      {
        value: { ...shared, installSource: { ...gitSource, commit: 'f'.repeat(40) } },
        message: 'candidate.installSource.commit must be a full non-placeholder lowercase Git SHA',
      },
      {
        value: { ...shared, installSource: { ...gitSource, repositoryPath: 'C:/plugin-a' } },
        message: 'candidate.installSource.repositoryPath must be null or a safe relative POSIX path',
      },
      ...['packages\\plugin-a', 'packages/plugin-a\0suffix', 'packages/../plugin-a', '.', '..', '../plugin-a']
        .map(repositoryPath => ({
          value: { ...shared, installSource: { ...gitSource, repositoryPath } },
          message: 'candidate.installSource.repositoryPath must be null or a safe relative POSIX path',
        })),
      {
        value: { ...shared, installSource: { ...gitSource, installScripts: { prepare: 'npm run build' } } },
        message: 'candidate.installSource.installScripts must record no lifecycle scripts',
      },
      {
        value: { ...shared, installSource: { kind: 'archive' } },
        message: 'candidate.installSource.kind must be npm or git',
      },
      {
        value: { ...shared, installSource: gitSource, repository: gitSource.repository },
        message: 'candidate must contain exactly bundlePatch, expectedPackage, id, installSource, runtimeDependencyClosureSha256, sourceContentSha256, and treeSha256',
      },
    ]
    for (const testCase of cases) {
      expect(() => {
        assertBenchmarkRollbackCandidate(testCase.value, 'candidate')
      })
        .toThrow(testCase.message)
    }
  })

  it.each([
    ['missing', { kind: 'curated-lock-snapshot' }],
    ['legacy', { schemaVersion: 1, kind: 'curated-lock-snapshot' }],
    ['future', { schemaVersion: 3, kind: 'curated-profile-snapshot' }],
  ])('rejects a %s snapshot schema version', (_name, snapshot) => {
    expect(() => {
      assertBenchmarkSnapshotSchemaVersion(snapshot, 'snapshot')
    })
      .toThrow('snapshot.schemaVersion must be 2')
  })

  it('reads only contained bounded regular snapshot references', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-reference-'))
    const fixtures = join(root, 'fixtures')
    const outside = join(root, 'outside')
    mkdirSync(join(fixtures, 'locks'), { recursive: true })
    mkdirSync(outside)
    const fixture = join(fixtures, 'benchmark.json')
    writeFileSync(fixture, '{}\n')
    writeFileSync(join(fixtures, 'locks/web.json'), '{"profile":"web"}\n')
    writeFileSync(join(outside, 'escaped.json'), '{"profile":"escaped"}\n')
    symlinkSync(outside, join(fixtures, 'linked'), 'junction')
    mkdirSync(join(fixtures, 'directory.json'))
    writeFileSync(join(fixtures, 'array.json'), '[]\n')
    writeFileSync(join(fixtures, 'large.json'), ' '.repeat(1024 * 1024 + 1))
    symlinkSync('locks/web.json', join(fixtures, 'final-link.json'))
    const fifo = join(fixtures, 'fifo.json')
    if (process.platform !== 'win32') expect(spawnSync('mkfifo', [fifo]).status).toBe(0)
    try {
      expect(readBenchmarkSnapshotReference(fixture, 'locks/web.json', 'snapshot')).toEqual({
        profile: 'web',
      })
      for (const reference of [
        '',
        '/absolute.json',
        'C:/absolute.json',
        '\\\\server\\share.json',
        'locks\\web.json',
        'locks/web.json\0suffix',
        'locks/web.txt',
        'locks/../web.json',
        '../outside.json',
      ]) {
        expect(() => readBenchmarkSnapshotReference(fixture, reference, 'snapshot'))
          .toThrow('snapshot must be a safe relative JSON path')
      }
      expect(() => readBenchmarkSnapshotReference(fixture, 'linked/escaped.json', 'snapshot'))
        .toThrow('snapshot must stay inside the benchmark fixture directory')
      expect(() => readBenchmarkSnapshotReference(fixture, 'directory.json', 'snapshot'))
        .toThrow('snapshot must reference a regular file')
      expect(() => readBenchmarkSnapshotReference(fixture, 'final-link.json', 'snapshot'))
        .toThrow('snapshot must reference a regular file')
      if (process.platform !== 'win32') {
        expect(() => readBenchmarkSnapshotReference(fixture, 'fifo.json', 'snapshot'))
          .toThrow('snapshot must reference a regular file')
      }
      expect(() => readBenchmarkSnapshotReference(fixture, 'array.json', 'snapshot'))
        .toThrow('snapshot must reference a JSON object')
      expect(() => readBenchmarkSnapshotReference(fixture, 'large.json', 'snapshot'))
        .toThrow('snapshot exceeds 1048576 bytes')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a file replaced after the initial unresolved identity check', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-initial-identity-race-'))
    const fixtures = join(root, 'fixtures')
    const target = join(fixtures, 'locks/web.json')
    const original = join(fixtures, 'locks/original.json')
    const replacement = join(fixtures, 'locks/replacement.json')
    mkdirSync(join(fixtures, 'locks'), { recursive: true })
    const fixture = join(fixtures, 'benchmark.json')
    writeFileSync(fixture, '{}\n')
    writeFileSync(target, '{"profile":"inside"}\n')
    writeFileSync(replacement, '{"profile":"replacement"}\n')
    let replaced = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const mockedRealpath = actual.realpathSync.bind(undefined)
      mockedRealpath.native = ((path: Parameters<typeof actual.realpathSync.native>[0]) => {
        if (!replaced && String(path).endsWith('/locks/web.json')) {
          replaced = true
          renameSync(target, original)
          renameSync(replacement, target)
        }
        return actual.realpathSync.native(path)
      }) as typeof actual.realpathSync.native
      return {
        ...actual,
        realpathSync: mockedRealpath,
      }
    })
    try {
      const snapshot = await import('../src/snapshot.ts')

      expect(() => snapshot.readBenchmarkSnapshotReference(fixture, 'locks/web.json', 'snapshot'))
        .toThrow('snapshot changed while it was being read')
      expect(replaced).toBe(true)
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an ancestor replaced between canonicalization and open', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-ancestor-race-'))
    const fixtures = join(root, 'fixtures')
    const locks = join(fixtures, 'locks')
    const originalLocks = join(fixtures, 'original-locks')
    const outside = join(root, 'outside')
    mkdirSync(locks, { recursive: true })
    mkdirSync(outside)
    const fixture = join(fixtures, 'benchmark.json')
    writeFileSync(fixture, '{}\n')
    writeFileSync(join(locks, 'web.json'), '{"profile":"inside"}\n')
    writeFileSync(join(outside, 'web.json'), '{"profile":"outside"}\n')
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let replaced = false
      return {
        ...actual,
        openSync: ((path: Parameters<typeof actual.openSync>[0], flags: number) => {
          if (!replaced && String(path).endsWith('/locks/web.json')) {
            replaced = true
            renameSync(locks, originalLocks)
            symlinkSync(outside, locks, 'junction')
          }
          return actual.openSync(path, flags)
        }) as typeof actual.openSync,
      }
    })
    try {
      const snapshot = await import('../src/snapshot.ts')

      expect(() => snapshot.readBenchmarkSnapshotReference(fixture, 'locks/web.json', 'snapshot'))
        .toThrow('snapshot changed while it was being read')
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a final symlink replacement without relying on O_NOFOLLOW', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-final-race-'))
    const fixtures = join(root, 'fixtures')
    const outside = join(root, 'outside.json')
    mkdirSync(join(fixtures, 'locks'), { recursive: true })
    const fixture = join(fixtures, 'benchmark.json')
    const target = join(fixtures, 'locks/web.json')
    const original = join(fixtures, 'locks/original.json')
    writeFileSync(fixture, '{}\n')
    writeFileSync(target, '{"profile":"inside"}\n')
    writeFileSync(outside, '{"profile":"outside"}\n')
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let replaced = false
      return {
        ...actual,
        constants: { ...actual.constants, O_NOFOLLOW: undefined },
        openSync: ((path: Parameters<typeof actual.openSync>[0], flags: number) => {
          if (!replaced && String(path).endsWith('/locks/web.json')) {
            replaced = true
            renameSync(target, original)
            symlinkSync(outside, target)
          }
          return actual.openSync(path, flags)
        }) as typeof actual.openSync,
      }
    })
    try {
      const snapshot = await import('../src/snapshot.ts')

      expect(() => snapshot.readBenchmarkSnapshotReference(fixture, 'locks/web.json', 'snapshot'))
        .toThrow('snapshot changed while it was being read')
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails closed when open or post-open identity checks cannot prove the target', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-identity-failure-'))
    const fixtures = join(root, 'fixtures')
    mkdirSync(join(fixtures, 'locks'), { recursive: true })
    const fixture = join(fixtures, 'benchmark.json')
    writeFileSync(fixture, '{}\n')
    writeFileSync(join(fixtures, 'locks/web.json'), '{"profile":"inside"}\n')
    let mode: 'canonical' | 'eloop' | 'expected-nonregular' | 'nonregular' | 'raw' = 'eloop'
    let nativeCalls = 0
    let lstatCalls = 0
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const mockedRealpath = actual.realpathSync.bind(undefined)
      mockedRealpath.native = ((path: Parameters<typeof actual.realpathSync.native>[0]) => {
        nativeCalls += 1
        if (mode === 'canonical' && nativeCalls === 3) throw new Error('target disappeared')
        return actual.realpathSync.native(path)
      }) as typeof actual.realpathSync.native
      return {
        ...actual,
        realpathSync: mockedRealpath,
        lstatSync: ((path: Parameters<typeof actual.lstatSync>[0], options?: { bigint?: boolean }) => {
          const stat = actual.lstatSync(path, options as { bigint: true })
          lstatCalls += 1
          if (mode === 'expected-nonregular' && lstatCalls === 2) {
            Object.defineProperty(stat, 'isFile', { value: () => false })
          }
          return stat
        }) as typeof actual.lstatSync,
        openSync: ((path: Parameters<typeof actual.openSync>[0], flags: number) => {
          if (mode === 'eloop') throw Object.assign(new Error('symlink'), { code: 'ELOOP' })
          if (mode === 'raw') throw 'raw open failure'
          return actual.openSync(path, flags)
        }) as typeof actual.openSync,
        fstatSync: ((descriptor: number, options?: { bigint?: boolean }) => {
          const stat = actual.fstatSync(descriptor, options as { bigint: true })
          if (mode === 'nonregular') Object.defineProperty(stat, 'isFile', { value: () => false })
          return stat
        }) as typeof actual.fstatSync,
      }
    })
    try {
      const snapshot = await import('../src/snapshot.ts')
      expect(() => snapshot.readBenchmarkSnapshotReference(fixture, 'locks/web.json', 'snapshot'))
        .toThrow('snapshot changed while it was being read')

      mode = 'raw'
      let rawFailure: unknown
      try {
        snapshot.readBenchmarkSnapshotReference(fixture, 'locks/web.json', 'snapshot')
      } catch (error) {
        rawFailure = error
      }
      expect(rawFailure).toBe('raw open failure')

      mode = 'nonregular'
      expect(() => snapshot.readBenchmarkSnapshotReference(fixture, 'locks/web.json', 'snapshot'))
        .toThrow('snapshot must reference a regular file')

      mode = 'expected-nonregular'
      lstatCalls = 0
      expect(() => snapshot.readBenchmarkSnapshotReference(fixture, 'locks/web.json', 'snapshot'))
        .toThrow('snapshot must reference a regular file')

      mode = 'canonical'
      nativeCalls = 0
      expect(() => snapshot.readBenchmarkSnapshotReference(fixture, 'locks/web.json', 'snapshot'))
        .toThrow('snapshot changed while it was being read')
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('provides ctx.curatedBench for the plugin lifetime', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(curatedBenchPlugin)

    expect(ctx.get('curatedBench')).toBeInstanceOf(CuratedBench)
    await fiber.dispose()
    expect(ctx.get('curatedBench')).toBeUndefined()
    await ctx.fiber.dispose()
  })

  it('rejects benchmark assets with missing rollback snapshot references', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-snapshots-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), JSON.stringify({
      evidenceKind: 'planned',
      canary: {
        status: 'pending',
        durationDays: [3, 7],
        minimumTasks: 100,
        rolloutPercentages: [10, 30, 100],
        rollbackLines: comparatorRollbackLines,
      },
    }))
    writeFileSync(join(baselines, 'web-cdp-regression.json'), JSON.stringify({
      evidenceKind: 'planned',
      browser: { kind: 'Chrome', cdpPort: 9333, ideEmbeddedBrowserAllowed: false },
    }))
    cpSync(
      join(curatedBenchBaselinesDir, 'ab-comparisons.json'),
      join(baselines, 'ab-comparisons.json'),
    )
    writeFileSync(join(baselines, 'benchmark.json'), JSON.stringify({
      schemaVersion: 3,
      evidenceKind: 'fixture',
      previousSnapshots: {
        lock: {
          sha256: '0'.repeat(64),
          snapshot: { schemaVersion: 2, kind: 'curated-lock-snapshot', profile: 'web-curated', candidates: [] },
        },
        profile: 'invalid',
      },
      baseline: { lockSnapshot: '', profileSnapshot: 'baselines/profiles/web.json' },
      candidate: { lockSnapshot: 'baselines/locks/web-curated.json', profileSnapshot: 'baselines/profiles/web-curated.json' },
    }))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        riskGateExactFieldsMessage,
        'p2 risk gate asset.failureInjection must be a JSON array',
        'benchmark previous lock snapshot.sha256 does not match its embedded snapshot',
        'benchmark previous profile snapshot must be a JSON object',
        'benchmark baseline lock snapshot must be a JSON object',
        'benchmark baseline profile snapshot must be a JSON object',
        'benchmark candidate lock snapshot must be a JSON object',
        'benchmark candidate profile snapshot must be a JSON object',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports missing benchmark object sections after related assets pass', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-sections-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), JSON.stringify({
      evidenceKind: 'planned',
      canary: {
        status: 'pending',
        durationDays: [3, 7],
        minimumTasks: 100,
        rolloutPercentages: [10, 30, 100],
        rollbackLines: comparatorRollbackLines,
      },
    }))
    writeFileSync(join(baselines, 'web-cdp-regression.json'), JSON.stringify({
      evidenceKind: 'planned',
      browser: { kind: 'Chrome', cdpPort: 9333, ideEmbeddedBrowserAllowed: false },
    }))
    cpSync(
      join(curatedBenchBaselinesDir, 'ab-comparisons.json'),
      join(baselines, 'ab-comparisons.json'),
    )
    writeFileSync(join(baselines, 'benchmark.json'), '{"schemaVersion":3,"evidenceKind":"fixture"}\n')
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        riskGateExactFieldsMessage,
        'p2 risk gate asset.failureInjection must be a JSON array',
        'benchmark asset.previousSnapshots must be a JSON object',
        'benchmark asset.baseline must be a JSON object',
        'benchmark asset.candidate must be a JSON object',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects benchmark assets that break canary, CDP, or A/B invariants', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-invalid-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), JSON.stringify({
      evidenceKind: 'planned',
      canary: {
        status: 'pending',
        durationDays: [1, 2],
        minimumTasks: 99,
        rolloutPercentages: [50, 100],
        rollbackLines: comparatorRollbackLines,
      },
    }))
    writeFileSync(join(baselines, 'web-cdp-regression.json'), JSON.stringify({
      evidenceKind: 'planned',
      browser: { kind: 'Safari', cdpPort: 9222, ideEmbeddedBrowserAllowed: true },
    }))
    writeFileSync(join(baselines, 'ab-comparisons.json'), JSON.stringify({
      schemaVersion: 1,
      evidenceKind: 'planned',
      source: 'test fixture',
      comparisons: [],
    }))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        riskGateExactFieldsMessage,
        'p2 risk gate asset.failureInjection must be a JSON array',
        'p2 risk gate canary durationDays must equal the numeric array [3, 7]',
        'p2 risk gate canary must require at least 100 tasks',
        'p2 risk gate canary rollout must be 10%, 30%, then 100%',
        'web CDP regression must require Chrome',
        'web CDP regression must require CDP port 9333',
        'web CDP regression must reject IDE embedded browsers',
        'A/B comparison must include web-search-pro-vs-free-web-search',
        'A/B comparison must include memento-vs-mneme',
        'A/B comparison must include computer-use-vs-tabbit',
        'A/B comparison must include mcp-panel-vs-mcp-manager',
        'A/B comparison must include cost-meter-vs-tokenledger',
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports missing benchmark asset files after directory sentinels pass', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-missing-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        expect.stringContaining('p2 risk gate asset cannot be loaded:'),
        expect.stringContaining('web CDP regression asset cannot be loaded:'),
        expect.stringContaining('A/B comparison asset cannot be loaded:'),
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns only sentinel failures when benchmark asset directories are incomplete', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-sentinels-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    writeFileSync(join(manifests, '.keep.json'), '{"purpose":"test"}\n')

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'curated benchmark tasks directory is missing its sentinel',
        'curated benchmark baselines directory is missing its sentinel',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects malformed snapshot envelopes, profile references, and evidence kinds', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-envelope-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), JSON.stringify({
      evidenceKind: 'invalid',
      canary: {
        status: 'pending',
        durationDays: [3, 7],
        minimumTasks: 100,
        rolloutPercentages: [10, 30, 100],
        rollbackLines: comparatorRollbackLines,
      },
    }))
    writeFileSync(join(baselines, 'web-cdp-regression.json'), JSON.stringify({
      evidenceKind: 'planned',
      browser: { kind: 'Chrome', cdpPort: 9333, ideEmbeddedBrowserAllowed: false },
    }))
    writeFileSync(join(baselines, 'ab-comparisons.json'), JSON.stringify({
      evidenceKind: 'planned',
      comparisons: [
        { id: 'web-search-pro-vs-free-web-search' },
        { id: 'memento-vs-mneme' },
        { id: 'computer-use-vs-tabbit' },
        { id: 'mcp-panel-vs-mcp-manager' },
        { id: 'cost-meter-vs-tokenledger' },
      ],
    }))
    writeFileSync(join(baselines, 'benchmark.json'), JSON.stringify({
      schemaVersion: 3,
      evidenceKind: 'invalid',
      previousSnapshots: {
        lock: {
          sha256: 'invalid',
          snapshot: { kind: 'wrong', catalogRef: 'mutable' },
        },
        profile: {
          sha256: 'invalid',
          snapshot: { kind: 'wrong' },
        },
      },
      baseline: { lockSnapshot: 'lock.json' },
      candidate: { lockSnapshot: 'lock.json', profileSnapshot: 'profile.json' },
    }))

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual(expect.arrayContaining([
        'p2 risk gate asset.evidenceKind must be planned',
        'benchmark asset.evidenceKind must be observed or fixture or planned',
        'benchmark previous lock snapshot.sha256 must be a lowercase SHA-256 digest',
        'benchmark previous lock snapshot.snapshot.kind must be curated-lock-snapshot',
        'benchmark previous lock snapshot.snapshot must not depend on a mutable catalogRef',
        'benchmark previous lock snapshot.snapshot.candidates must be a JSON array',
        'benchmark previous profile snapshot.sha256 must be a lowercase SHA-256 digest',
        'benchmark previous profile snapshot.snapshot.kind must be curated-profile-snapshot',
        'benchmark previous profile snapshot.snapshot.bundles must be an array',
        'benchmark baseline profile snapshot must be a JSON object',
      ]))

      writeFileSync(join(baselines, 'benchmark.json'), JSON.stringify({
        evidenceKind: 'fixture',
        previousSnapshots: {
          lock: { sha256: '0'.repeat(64), snapshot: 'invalid' },
          profile: { sha256: '0'.repeat(64), snapshot: 'invalid' },
        },
        baseline: { lockSnapshot: 'lock.json', profileSnapshot: 'profile.json' },
        candidate: { lockSnapshot: 'lock.json', profileSnapshot: 'profile.json' },
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual(expect.arrayContaining([
        'benchmark previous lock snapshot.snapshot must be a JSON object',
        'benchmark previous profile snapshot.snapshot must be a JSON object',
      ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects benchmark asset files with invalid JSON object fields', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-fields-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), '{"evidenceKind":"planned","canary":"invalid"}\n')
    writeFileSync(join(baselines, 'web-cdp-regression.json'), '{"evidenceKind":"planned","browser":"invalid"}\n')
    writeFileSync(join(baselines, 'ab-comparisons.json'), '{"evidenceKind":"planned","comparisons":"invalid"}\n')

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        riskGateExactFieldsMessage,
        'p2 risk gate asset.failureInjection must be a JSON array',
        'p2 risk gate asset.canary must be a JSON object',
        'web CDP regression asset.browser must be a JSON object',
        'A/B comparison asset must contain exactly schemaVersion, evidenceKind, source, and comparisons',
        'A/B comparison asset.schemaVersion must be 1',
        'A/B comparison asset.source must be a non-empty string',
        'A/B comparison asset.comparisons must be a JSON array',
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects benchmark asset files whose root JSON is not an object', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-root-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), '[]\n')
    writeFileSync(join(baselines, 'web-cdp-regression.json'), '[]\n')
    writeFileSync(join(baselines, 'ab-comparisons.json'), '[]\n')

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'p2 risk gate asset must be a JSON object',
        'web CDP regression asset must be a JSON object',
        'A/B comparison asset must be a JSON object',
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports non-Error JSON parser failures', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-raw-parse-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), '{}\n')
    writeFileSync(join(baselines, 'web-cdp-regression.json'), '{}\n')
    writeFileSync(join(baselines, 'ab-comparisons.json'), '{}\n')
    const parse = vi.spyOn(JSON, 'parse').mockImplementation(() => { throw 'raw parse failure' })

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'p2 risk gate asset cannot be loaded: raw parse failure',
        'web CDP regression asset cannot be loaded: raw parse failure',
        'A/B comparison asset cannot be loaded: raw parse failure',
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      parse.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('registers a no-op runtime invariant for static benchmark assets', async () => {
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

    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return { ...actual, existsSync: () => false }
    })
    try {
      const mockedInvariant = await import('../src/invariant.ts')
      await expect(mockedInvariant.apply(ctx as never)).resolves.toBe(disposer)
      expect(registered.packageName).toBe('@deepseek-ai/dsh-curated-bench')
      const messages: string[] = []
      registered.install?.(ctx, message => messages.push(message))
      expect(messages).toEqual([])
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
    }
  })
})

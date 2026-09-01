/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-curated-bench`.
 * @module @deepseek-ai/dsh-curated-bench/invariant
 */

import { createHash } from 'node:crypto'
import { existsSync, opendirSync, type Dir } from 'node:fs'
import { isAbsolute, join, posix, win32 } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import { CURATED_PROFILE_TEMPLATES } from '@deepseek-ai/dsh-curated-profiles'
import {
  assertBenchmarkLockSnapshotCandidates,
  assertBenchmarkProfileSnapshotBundles,
  assertBenchmarkRollbackCandidate,
  assertBenchmarkSnapshotSchemaVersion,
  canonicalBenchmarkJson,
  readBoundBenchmarkSnapshotReference,
  readContainedBenchmarkJson,
} from './snapshot.ts'
import {
  type CuratedBenchAssetDirs,
} from './index.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-curated-bench'
const MAX_PUBLISHED_SNAPSHOT_DEPTH = 64
const MAX_PUBLISHED_SNAPSHOT_ENTRIES = 1024
const P2_FAILURES = {
  'search-timeout': {
    capability: 'web-search',
    acceptableRuntimeOutcomes: ['fail-closed', 'recovered'],
  },
  'model-429': {
    capability: 'llm-fallbacks',
    acceptableRuntimeOutcomes: ['fail-closed', 'recovered'],
  },
  'browser-crash': {
    capability: 'browser-computer-use',
    acceptableRuntimeOutcomes: ['fail-closed', 'recovered'],
  },
  'sqlite-lock': {
    capability: 'memory',
    acceptableRuntimeOutcomes: ['fail-closed', 'recovered'],
  },
  'permission-denied-file': {
    capability: 'permission-policy',
    acceptableRuntimeOutcomes: ['fail-closed', 'recovered'],
  },
  'illegal-patch': {
    capability: 'profile-composition',
    acceptableRuntimeOutcomes: ['fail-closed'],
  },
  'network-offline': {
    capability: 'supply-chain-monitoring',
    acceptableRuntimeOutcomes: ['fail-closed', 'recovered'],
  },
  'plugin-init-exception': {
    capability: 'multi-agent-orchestration',
    acceptableRuntimeOutcomes: ['fail-closed', 'recovered'],
  },
} as const
const P2_RISK_GATE_FIELDS = [
  'schemaVersion',
  'evidenceKind',
  'source',
  'profiles',
  'failureInjection',
  'abComparisons',
  'canary',
] as const
const AB_COMPARISON_ASSET_FIELDS = ['schemaVersion', 'evidenceKind', 'source', 'comparisons'] as const
const P2_FAILURE_FIELDS = [
  'id',
  'capability',
  'acceptableRuntimeOutcomes',
  'status',
  'runtimeOutcome',
] as const
const P2_CANARY_FIELDS = [
  'status',
  'durationDays',
  'minimumTasks',
  'rolloutPercentages',
  'rollbackLines',
] as const
const P2_CANARY_ROLLBACK_LINES = [
  'security-correctness-below-95',
  'data-loss-detected',
  'rollback-impossible',
  'startup-failure-rate-above-1',
  'critical-success-rate-drop',
  'first-token-p95-regression',
  'prompt-schema-token-regression',
  'cost-regression-without-success-gain',
] as const
const NON_COMPENSABLE_THRESHOLDS = P2_CANARY_ROLLBACK_LINES.slice(0, 5)
const AB_COMPARISON_FIELDS = [
  'id',
  'status',
  'capability',
  'primary',
  'alternative',
  'scale',
  'statistics',
  'nonCompensableThresholds',
] as const
const AB_STATISTICS = {
  mean: true,
  p50: true,
  p95: true,
  failureDistribution: true,
} as const
const AB_COMPARISONS = {
  'web-search-pro-vs-free-web-search': {
    capability: 'web-search',
    primary: 'dsh-web-search-pro',
    alternative: 'dsh-free-web-search',
    scale: {
      queries: 100,
      repetitionsPerTask: 5,
      subsets: ['timely-facts', 'technical-docs', 'chinese-community', 'deep-pages'],
    },
  },
  'memento-vs-mneme': {
    capability: 'memory',
    primary: 'dsh-memento',
    alternative: 'dsh-mneme',
    scale: {
      days: 7,
      facts: 200,
      conflictUpdates: 20,
      deleteRequests: 20,
      repetitionsPerTask: 5,
    },
  },
  'computer-use-vs-tabbit': {
    capability: 'browser-computer-use',
    primary: 'dsh-computer-use',
    alternative: 'dsh-tabbit',
    scale: {
      webTasks: 50,
      repetitionsPerTask: 5,
    },
  },
  'mcp-panel-vs-mcp-manager': {
    capability: 'mcp-management',
    primary: 'dsh-mcp-panel',
    alternative: 'dsh-mcp-manager',
    scale: {
      scenarios: ['oauth', 'static-token', 'service-error', 'profile-write', 'rollback'],
      repetitionsPerTask: 5,
    },
  },
  'cost-meter-vs-tokenledger': {
    capability: 'cost-metering',
    primary: 'dsh-cost-meter',
    alternative: 'TokenLedger',
    scale: {
      input: 'fixed-request-log',
      repetitionsPerTask: 5,
      subsets: ['pricing', 'cache-tokens', 'timezone', 'quota'],
    },
  },
} as const
const P2_AB_COMPARISON_IDS = [
  'memento-vs-mneme',
  'computer-use-vs-tabbit',
  'mcp-panel-vs-mcp-manager',
  'cost-meter-vs-tokenledger',
] as const
const AB_COMPARISON_IDS = [
  'web-search-pro-vs-free-web-search',
  ...P2_AB_COMPARISON_IDS,
] as const
const P2_PROFILE_FIELDS = {
  'web-coding': ['orchestrator', 'inactiveFallbacks', 'budgets', 'browserAutomation'],
  'web-research': ['visionRouter', 'office'],
  'web-enterprise': ['externalChannels'],
} as const

/** Cordis companion plugin name. */
export const name = 'curated-bench-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']


/**
 * Validate bounded plain-JSON benchmark assets and their directory sentinels.
 * @param dirs - Directory paths for each fixture class.
 * @returns invariant failure messages, empty when all required assets are valid.
 */
export function validateCuratedBenchAssets(dirs: CuratedBenchAssetDirs): readonly string[] {
  const messages: string[] = []
  for (const [label, dir] of [
    ['manifests', dirs.manifests],
    ['tasks', dirs.tasks],
    ['baselines', dirs.baselines],
  ] as const) {
    const sentinelLabel = `curated benchmark ${label} directory sentinel`
    if (!existsSync(join(dir, '.keep.json'))) {
      messages.push(`curated benchmark ${label} directory is missing its sentinel`)
      continue
    }
    const sentinel = readJsonObject(dir, '.keep.json', sentinelLabel, messages)
    if (sentinel !== undefined) {
      validateExactKeys(sentinel, ['purpose'], sentinelLabel, messages)
      requireNonEmptyString(sentinel.purpose, `${sentinelLabel}.purpose`, messages)
    }
  }
  if (messages.length > 0) return messages
  const candidateManifestPath = join(dirs.manifests, 'curated-candidates.json')
  const taskSetPath = join(dirs.tasks, 'curated-tasksets.json')
  if (!existsSync(candidateManifestPath)) {
    messages.push('curated benchmark manifests/curated-candidates.json is missing')
  }
  if (!existsSync(taskSetPath)) {
    messages.push('curated benchmark tasks/curated-tasksets.json is missing')
  } else {
    messages.push(...validateTaskSetAsset(dirs.tasks))
  }
  messages.push(...validateRiskGateAsset(dirs.tasks))
  messages.push(...validateWebCdpAsset(dirs.baselines))
  messages.push(...validateAbComparisonAsset(dirs.baselines))
  messages.push(...validateBenchmarkAsset(dirs.baselines))
  messages.push(...validatePublishedSnapshots(dirs.baselines))
  messages.push(...validatePlanningHistory(dirs.baselines))
  const candidateSnapshotPath = join(dirs.baselines, 'locks/web-curated.json')
  const candidateProfilePath = join(dirs.baselines, 'profiles/web-curated.json')
  const candidateSnapshotExists = existsSync(candidateSnapshotPath)
  const candidateProfileExists = existsSync(candidateProfilePath)
  if (!candidateSnapshotExists) {
    messages.push('curated benchmark baselines/locks/web-curated.json lock snapshot is missing')
  }
  if (!candidateProfileExists) {
    messages.push('curated benchmark baselines/profiles/web-curated.json profile snapshot is missing')
  }
  if (existsSync(candidateManifestPath) && candidateSnapshotExists && candidateProfileExists) {
    messages.push(...validateCurrentCandidateSnapshot(
      dirs.manifests,
      dirs.baselines,
    ))
  }
  return messages
}

function validateTaskSetAsset(tasks: string): string[] {
  const messages: string[] = []
  const asset = readJsonObject(tasks, 'curated-tasksets.json', 'curated task-set asset', messages)
  if (asset === undefined) return messages
  if (asset.schemaVersion !== 1) messages.push('curated task-set asset.schemaVersion must be 1')
  if (asset.evidenceKind !== 'planned') messages.push('curated task-set asset.evidenceKind must be planned')
  if (typeof asset.source !== 'string' || asset.source.length === 0) {
    messages.push('curated task-set asset.source must be a non-empty string')
  }
  if (!Array.isArray(asset.taskSets) || asset.taskSets.length === 0) {
    messages.push('curated task-set asset.taskSets must be a non-empty JSON array')
  }
  return messages
}

function validatePublishedSnapshots(baselines: string): string[] {
  const messages: string[] = []
  for (const [directory, expectedKind, payload] of [
    ['locks', 'curated-lock-snapshot', 'candidates'],
    ['profiles', 'curated-profile-snapshot', 'bundles'],
  ] as const) {
    const root = join(baselines, directory)
    if (!existsSync(root)) continue
    const snapshotKind = directory === 'locks' ? 'lock' : 'profile'
    for (const relativePath of listPublishedJsonFiles(
      root,
      directory,
      `published ${snapshotKind} snapshot`,
      `published ${snapshotKind} snapshots`,
      messages,
    )) {
      const label = `published ${snapshotKind} snapshot ${relativePath}`
      const snapshot = readJsonObject(baselines, relativePath, label, messages)
      if (snapshot === undefined) continue
      try {
        assertBenchmarkSnapshotSchemaVersion(snapshot, label)
      } catch (error) {
        messages.push((error as Error).message)
      }
      if (snapshot.kind !== expectedKind) messages.push(`${label}.kind must be ${expectedKind}`)
      if (typeof snapshot.profile !== 'string' || snapshot.profile.length === 0) {
        messages.push(`${label}.profile must be a non-empty string`)
      }
      if (expectedKind === 'curated-lock-snapshot' && 'catalogRef' in snapshot) {
        messages.push(`${label} must not depend on a mutable catalogRef`)
      }
      if (expectedKind === 'curated-lock-snapshot') {
        if (!Array.isArray(snapshot[payload])) {
          messages.push(`${label}.${payload} must be a JSON array`)
          continue
        }
        validateRollbackCandidates(snapshot.candidates as readonly unknown[], label, messages)
      } else {
        try {
          assertBenchmarkProfileSnapshotBundles(snapshot, label)
        } catch (error) {
          messages.push((error as Error).message)
        }
      }
    }
  }
  return messages
}

function validatePlanningHistory(baselines: string): string[] {
  const root = join(baselines, 'history')
  if (!existsSync(root)) return []
  const messages: string[] = []
  for (const relativePath of listPublishedJsonFiles(
    root,
    'history',
    'curated planning history',
    'curated planning history entries',
    messages,
  )) {
    const label = `curated planning history ${relativePath}`
    const record = readJsonObject(baselines, relativePath, label, messages)
    if (record === undefined) continue
    if (record.schemaVersion !== 1) messages.push(`${label}.schemaVersion must be 1`)
    if (record.kind !== 'curated-planning-history') {
      messages.push(`${label}.kind must be curated-planning-history`)
    }
    if (record.evidenceKind !== 'planned') messages.push(`${label}.evidenceKind must be planned`)
    if (record.restorable !== false) messages.push(`${label}.restorable must be false`)
    requireNonEmptyString(record.source, `${label}.source`, messages)
    if (!isCalendarDate(record.createdAt)) messages.push(`${label}.createdAt must be a YYYY-MM-DD date`)
    requireNonEmptyString(record.profile, `${label}.profile`, messages)
    const candidateCount = validateNonNegativeInteger(record.candidateCount, `${label}.candidateCount`, messages)
    const activeCount = validateNonNegativeInteger(record.activeCount, `${label}.activeCount`, messages)
    if (candidateCount !== undefined && activeCount !== undefined && activeCount > candidateCount) {
      messages.push(`${label}.activeCount must not exceed candidateCount`)
    }
    requireNonEmptyString(record.catalogRef, `${label}.catalogRef`, messages)
    validateHistoryBundles(record.profileBundles, label, messages)
    validateHistoryMigration(record.migration, relativePath, label, messages)
  }
  return messages
}

function listPublishedJsonFiles(
  root: string,
  rootRelativePath: string,
  entryLabel: string,
  collectionLabel: string,
  messages: string[],
): string[] {
  const files: string[] = []
  const directories: Array<{
    directory: Dir
    path: string
    relativePath: string
    depth: number
  }> = []
  let entryCount = 0
  try {
    directories.push({
      directory: opendirSync(root, { bufferSize: 1 }),
      path: root,
      relativePath: rootRelativePath,
      depth: 0,
    })
    while (directories.length > 0) {
      const directory = directories.at(-1) as (typeof directories)[number]
      const entry = directory.directory.readSync()
      if (entry === null) {
        directories.pop()
        closePublishedDirectory(directory.directory)
        continue
      }
      entryCount += 1
      if (entryCount > MAX_PUBLISHED_SNAPSHOT_ENTRIES) {
        messages.push(
          `${collectionLabel} must contain at most ${String(MAX_PUBLISHED_SNAPSHOT_ENTRIES)} entries`,
        )
        return files.sort()
      }
      const relativePath = `${directory.relativePath}/${entry.name}`
      if (entry.isSymbolicLink()) {
        messages.push(`${entryLabel} entry ${relativePath} must not be a symbolic link`)
      } else if (entry.isDirectory()) {
        if (directory.depth >= MAX_PUBLISHED_SNAPSHOT_DEPTH) {
          messages.push(
            `${collectionLabel} must contain at most ${String(MAX_PUBLISHED_SNAPSHOT_DEPTH)} nested directory levels`,
          )
          return files.sort()
        }
        const path = join(directory.path, entry.name)
        directories.push({
          directory: opendirSync(path, { bufferSize: 1 }),
          path,
          relativePath,
          depth: directory.depth + 1,
        })
      } else if (!entry.isFile()) {
        messages.push(
          `${entryLabel} entry ${relativePath} must be a regular file or directory`,
        )
      } else if (entry.name.endsWith('.json')) {
        files.push(relativePath)
      }
    }
    return files.sort()
  } catch (error) {
    messages.push(`${collectionLabel} cannot be traversed: ${String(error).replace(/^Error: /u, '')}`)
    return files.sort()
  } finally {
    while (directories.length > 0) {
      closePublishedDirectory((directories.pop() as (typeof directories)[number]).directory)
    }
  }
}

function closePublishedDirectory(directory: Dir): void {
  try {
    directory.closeSync()
  } catch {
    // A close failure cannot invalidate or replace the collected diagnostics.
  }
}

function requireNonEmptyString(value: unknown, label: string, messages: string[]): void {
  if (typeof value !== 'string' || value.length === 0) messages.push(`${label} must be a non-empty string`)
}

function validateNonNegativeInteger(value: unknown, label: string, messages: string[]): number | undefined {
  if (!Number.isSafeInteger(value)) {
    messages.push(`${label} must be a non-negative safe integer`)
    return undefined
  }
  if ((value as number) < 0) messages.push(`${label} must be a non-negative safe integer`)
  return value as number
}

function validateHistoryBundles(value: unknown, label: string, messages: string[]): void {
  if (!Array.isArray(value)) {
    messages.push(`${label}.profileBundles must be an array`)
    return
  }
  if (value.length === 0) messages.push(`${label}.profileBundles must contain at least one bundle`)
  value.forEach((bundle, index) => {
    if (typeof bundle !== 'string' || bundle.length === 0) {
      messages.push(`${label}.profileBundles[${String(index)}] must be a non-empty string`)
    }
  })
}

function validateHistoryMigration(
  value: unknown,
  relativePath: string,
  label: string,
  messages: string[],
): void {
  if (!isRecord(value)) {
    messages.push(`${label}.migration must be a JSON object`)
    return
  }
  const from = value.from
  if (!Array.isArray(from)) {
    messages.push(`${label}.migration.from must be an array`)
  } else {
    const kinds = new Set<string>()
    for (const [index, source] of from.entries()) {
      const sourceLabel = `${label}.migration.from[${String(index)}]`
      if (!isRecord(source)) {
        messages.push(`${sourceLabel} must be a JSON object`)
        continue
      }
      const sourcePath = source.path
      const safePath = isSafeRelativeJsonPath(sourcePath)
      if (!safePath) {
        messages.push(`${sourceLabel}.path must be a safe relative JSON path`)
      }
      if (source.kind !== 'curated-lock-snapshot' && source.kind !== 'curated-profile-snapshot') {
        messages.push(`${sourceLabel}.kind must be curated-lock-snapshot or curated-profile-snapshot`)
      } else {
        kinds.add(source.kind)
        const directory = source.kind === 'curated-lock-snapshot' ? 'locks' : 'profiles'
        if (safePath && !sourcePath.startsWith(`${directory}/`)) {
          messages.push(`${sourceLabel}.path must be under ${directory}/ for ${source.kind}`)
        }
      }
      requireNonEmptyString(source.restoreCommand, `${sourceLabel}.restoreCommand`, messages)
    }
    if (
      from.length !== 2
      || !kinds.has('curated-lock-snapshot')
      || !kinds.has('curated-profile-snapshot')
    ) {
      messages.push(`${label}.migration.from must contain the former lock and profile records`)
    }
  }
  if (value.to !== relativePath) messages.push(`${label}.migration.to must equal ${relativePath}`)
}

function isSafeRelativeJsonPath(value: unknown): value is string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || isAbsolute(value)
    || win32.isAbsolute(value)
    || value.includes('\\')
    || value.includes('\0')
    || !value.endsWith('.json')
  ) {
    return false
  }
  const segments = value.split('/')
  return !segments.includes('..')
    && !segments.includes('')
    && posix.normalize(value) === value
}

function isCalendarDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp)
    && new Date(timestamp).toISOString() === `${value}T00:00:00.000Z`
}

function validateBenchmarkAsset(baselines: string): string[] {
  const messages: string[] = []
  const path = join(baselines, 'benchmark.json')
  const asset = readJsonObject(baselines, 'benchmark.json', 'benchmark asset', messages)
  if (asset === undefined) return messages
  if (asset.schemaVersion !== 3) messages.push('benchmark asset.schemaVersion must be 3')
  validateEvidenceKind(asset.evidenceKind, 'benchmark asset', ['observed', 'fixture', 'planned'], messages)
  const previousSnapshots = objectField(asset, 'previousSnapshots', 'benchmark asset', messages)
  let previousLock: Record<string, unknown> | undefined
  let previousProfile: Record<string, unknown> | undefined
  if (previousSnapshots !== undefined) {
    previousLock = validateSnapshotEnvelope(
      previousSnapshots.lock,
      'benchmark previous lock snapshot',
      'curated-lock-snapshot',
      messages,
    )
    previousProfile = validateSnapshotEnvelope(
      previousSnapshots.profile,
      'benchmark previous profile snapshot',
      'curated-profile-snapshot',
      messages,
    )
  }
  const profiles: Partial<Record<'baseline' | 'candidate', Record<string, unknown>>> = {}
  for (const [field, label] of [
    ['baseline', 'benchmark baseline'],
    ['candidate', 'benchmark candidate'],
  ] as const) {
    const profile = objectField(asset, field, 'benchmark asset', messages)
    if (profile === undefined) continue
    profiles[field] = profile
    if (!isRecord(profile.lockSnapshot)) messages.push(`${label} lock snapshot must be a JSON object`)
    if (!isRecord(profile.profileSnapshot)) messages.push(`${label} profile snapshot must be a JSON object`)
  }
  if (messages.length === 0) {
    const baselineLock = validateReferencedSnapshot(path, profiles.baseline, 'lockSnapshot', 'benchmark baseline lock snapshot', 'curated-lock-snapshot', messages)
    const baselineProfile = validateReferencedSnapshot(path, profiles.baseline, 'profileSnapshot', 'benchmark baseline profile snapshot', 'curated-profile-snapshot', messages)
    validateReferencedSnapshot(path, profiles.candidate, 'lockSnapshot', 'benchmark candidate lock snapshot', 'curated-lock-snapshot', messages)
    validateReferencedSnapshot(path, profiles.candidate, 'profileSnapshot', 'benchmark candidate profile snapshot', 'curated-profile-snapshot', messages)
    if (canonicalBenchmarkJson(previousLock) !== canonicalBenchmarkJson(baselineLock)) {
      messages.push('benchmark previous lock snapshot must equal the canonical baseline lock snapshot content')
    }
    if (canonicalBenchmarkJson(previousProfile) !== canonicalBenchmarkJson(baselineProfile)) {
      messages.push('benchmark previous profile snapshot must equal the canonical baseline profile snapshot content')
    }
  }
  return messages
}

function validateSnapshotEnvelope(
  value: unknown,
  label: string,
  expectedKind: 'curated-lock-snapshot' | 'curated-profile-snapshot',
  messages: string[],
): Record<string, unknown> | undefined {
  if (!isRecord(value)) {
    messages.push(`${label} must be a JSON object`)
    return undefined
  }
  const snapshot = value.snapshot
  if (!isRecord(snapshot)) {
    messages.push(`${label}.snapshot must be a JSON object`)
    return undefined
  }
  if (typeof value.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(value.sha256)) {
    messages.push(`${label}.sha256 must be a lowercase SHA-256 digest`)
  } else if (createHash('sha256').update(canonicalBenchmarkJson(snapshot)).digest('hex') !== value.sha256) {
    messages.push(`${label}.sha256 does not match its embedded snapshot`)
  }
  try {
    assertBenchmarkSnapshotSchemaVersion(snapshot, `${label}.snapshot`)
  } catch (error) {
    messages.push((error as Error).message)
  }
  if (snapshot.kind !== expectedKind) messages.push(`${label}.snapshot.kind must be ${expectedKind}`)
  if (expectedKind === 'curated-lock-snapshot') {
    if ('catalogRef' in snapshot) messages.push(`${label}.snapshot must not depend on a mutable catalogRef`)
    if (!Array.isArray(snapshot.candidates)) {
      messages.push(`${label}.snapshot.candidates must be a JSON array`)
    } else {
      validateRollbackCandidates(snapshot.candidates, `${label}.snapshot`, messages)
    }
  } else {
    try {
      assertBenchmarkProfileSnapshotBundles(snapshot, `${label}.snapshot`)
    } catch (error) {
      messages.push((error as Error).message)
    }
  }
  return snapshot
}

function validateReferencedSnapshot(
  fixturePath: string,
  profile: Record<string, unknown> | undefined,
  field: 'lockSnapshot' | 'profileSnapshot',
  label: string,
  kind: 'curated-lock-snapshot' | 'curated-profile-snapshot',
  messages: string[],
): Record<string, unknown> {
  const validProfile = profile as Record<string, unknown>
  try {
    const snapshot = readBoundBenchmarkSnapshotReference(
      fixturePath,
      validProfile[field],
      label,
    ).snapshot
    assertBenchmarkSnapshotSchemaVersion(snapshot, label)
    if (snapshot.kind !== kind) messages.push(`${label}.kind must be ${kind}`)
    if (snapshot.profile !== validProfile.profile) messages.push(`${label}.profile must match the benchmark profile`)
    if (kind === 'curated-lock-snapshot' && 'catalogRef' in snapshot) {
      messages.push(`${label} must not depend on a mutable catalogRef`)
    }
    if (kind === 'curated-lock-snapshot') {
      assertBenchmarkLockSnapshotCandidates(snapshot, label)
    } else {
      assertBenchmarkProfileSnapshotBundles(snapshot, label)
    }
    return snapshot
  } catch (error) {
    messages.push((error as Error).message)
    return {}
  }
}

function validateCurrentCandidateSnapshot(
  manifests: string,
  baselines: string,
): string[] {
  const messages: string[] = []
  const manifest = readJsonObject(
    manifests,
    'curated-candidates.json',
    'curated candidate manifest',
    messages,
  )
  const snapshot = readJsonObject(
    baselines,
    'locks/web-curated.json',
    'web-curated lock snapshot',
    messages,
  )
  const profile = readJsonObject(
    baselines,
    'profiles/web-curated.json',
    'web-curated profile snapshot',
    messages,
  )
  if (manifest === undefined || snapshot === undefined || profile === undefined) return messages
  try {
    assertBenchmarkSnapshotSchemaVersion(snapshot, 'web-curated lock snapshot')
  } catch (error) {
    messages.push((error as Error).message)
  }
  try {
    assertBenchmarkSnapshotSchemaVersion(profile, 'web-curated profile snapshot')
  } catch (error) {
    messages.push((error as Error).message)
  }
  const summary = objectField(manifest, 'summary', 'curated candidate manifest', messages)
  if (summary === undefined) return messages
  const candidates = snapshot.candidates
  if ('catalogRef' in snapshot) messages.push('web-curated lock snapshot must not depend on a mutable catalogRef')
  if (!Array.isArray(candidates)) {
    messages.push('web-curated lock snapshot.candidates must be a JSON array')
    return messages
  }
  if (candidates.length !== summary.activeCount) {
    messages.push('web-curated lock snapshot candidates must match the active candidate count')
  }
  const treeDigests = objectField(
    summary,
    'treeSha256ByCandidate',
    'curated candidate manifest.summary',
    messages,
  )
  if (treeDigests === undefined) return messages
  const closureDigests = objectField(
    summary,
    'runtimeDependencyClosureSha256ByCandidate',
    'curated candidate manifest.summary',
    messages,
  )
  if (closureDigests === undefined) return messages
  const sourceContentDigests = objectField(
    summary,
    'sourceContentSha256ByCandidate',
    'curated candidate manifest.summary',
    messages,
  )
  if (sourceContentDigests === undefined) return messages
  const expectedIds = Object.keys(closureDigests).sort()
  const candidateIds = candidates
    .filter(isRecord)
    .map(candidate => candidate.id)
    .filter((id): id is string => typeof id === 'string')
    .sort()
  if (canonicalBenchmarkJson(candidateIds) !== canonicalBenchmarkJson(expectedIds)) {
    messages.push('web-curated lock snapshot candidate ids must match the candidate manifest')
  }
  const expectedPackages = candidates
    .filter(isRecord)
    .map(candidate => candidate.expectedPackage)
    .filter((name): name is string => typeof name === 'string')
  let profileBundles: readonly string[]
  try {
    profileBundles = assertBenchmarkProfileSnapshotBundles(profile, 'web-curated profile snapshot')
  } catch (error) {
    messages.push((error as Error).message)
    return messages
  }
  if (
    canonicalBenchmarkJson(profileBundles)
    !== canonicalBenchmarkJson(CURATED_PROFILE_TEMPLATES['web-curated'].bundles)
  ) {
    messages.push(
      'web-curated profile snapshot bundles must exactly match the authoritative web-curated template in order',
    )
  }
  const selectedBundles = profileBundles.filter(bundle => expectedPackages.includes(bundle))
  if (canonicalBenchmarkJson(selectedBundles) !== canonicalBenchmarkJson(expectedPackages)) {
    messages.push('web-curated profile snapshot bundles must contain the lock candidates in order')
  }
  for (const [index, value] of candidates.entries()) {
    if (!isRecord(value)) {
      messages.push(`web-curated lock snapshot.candidates[${String(index)}] must be a JSON object`)
      continue
    }
    for (const field of ['id', 'expectedPackage', 'bundlePatch']) {
      if (typeof value[field] !== 'string' || value[field].length === 0) {
        messages.push(`web-curated lock snapshot.candidates[${String(index)}].${field} must be a non-empty string`)
      }
    }
    for (const field of ['treeSha256', 'runtimeDependencyClosureSha256', 'sourceContentSha256']) {
      if (typeof value[field] !== 'string' || !/^[0-9a-f]{64}$/u.test(value[field])) {
        messages.push(`web-curated lock snapshot.candidates[${String(index)}].${field} must be a lowercase SHA-256 digest`)
      }
    }
    try {
      assertBenchmarkRollbackCandidate(
        value,
        `web-curated lock snapshot.candidates[${String(index)}]`,
      )
    } catch (error) {
      messages.push((error as Error).message)
    }
    if (
      typeof value.id === 'string'
      && closureDigests[value.id] !== value.runtimeDependencyClosureSha256
    ) {
      messages.push(`web-curated lock snapshot candidate ${value.id} closure digest must match the candidate manifest`)
    }
    if (typeof value.id === 'string' && treeDigests[value.id] !== value.treeSha256) {
      messages.push(`web-curated lock snapshot candidate ${value.id} tree digest must match the candidate manifest`)
    }
    if (
      typeof value.id === 'string'
      && sourceContentDigests[value.id] !== value.sourceContentSha256
    ) {
      messages.push(`web-curated lock snapshot candidate ${value.id} source content digest must match the candidate manifest`)
    }
  }
  return messages
}

function validateRollbackCandidates(
  candidates: readonly unknown[],
  label: string,
  messages: string[],
): void {
  for (const [index, candidate] of candidates.entries()) {
    try {
      assertBenchmarkRollbackCandidate(candidate, `${label}.candidates[${String(index)}]`)
    } catch (error) {
      messages.push((error as Error).message)
    }
  }
}

function validateRiskGateAsset(tasks: string): string[] {
  const messages: string[] = []
  const asset = readJsonObject(tasks, 'p2-risk-gates.json', 'p2 risk gate asset', messages)
  if (asset === undefined) return messages
  validateExactKeys(asset, P2_RISK_GATE_FIELDS, 'p2 risk gate asset', messages)
  if (Object.hasOwn(asset, 'schemaVersion') && asset.schemaVersion !== 1) {
    messages.push('p2 risk gate asset.schemaVersion must be 1')
  }
  validateEvidenceKind(asset.evidenceKind, 'p2 risk gate asset', ['planned'], messages)
  if (Object.hasOwn(asset, 'source')) {
    requireNonEmptyString(asset.source, 'p2 risk gate asset.source', messages)
  }
  if (Object.hasOwn(asset, 'profiles')) validateP2Profiles(asset, messages)
  const failures = arrayField(asset, 'failureInjection', 'p2 risk gate asset', messages)
  const observedIds = new Set<string>()
  for (const [index, value] of failures?.entries() ?? []) {
    const label = `p2 risk gate failure ${String(index)}`
    if (!isRecord(value)) {
      messages.push(`${label} must be a JSON object`)
      continue
    }
    const id = value.id
    const failureLabel = typeof id === 'string' && id.length > 0
      ? `p2 risk gate failure ${id}`
      : label
    validateExactKeys(value, P2_FAILURE_FIELDS, failureLabel, messages)
    if (typeof id !== 'string' || id.length === 0) {
      messages.push(`${label}.id must be a non-empty string`)
      continue
    }
    if (observedIds.has(id)) messages.push(`p2 risk gate failure ids must be unique: ${id}`)
    observedIds.add(id)
    const expected = Object.hasOwn(P2_FAILURES, id)
      ? (
        P2_FAILURES as Readonly<Record<string, {
          readonly capability: string
          readonly acceptableRuntimeOutcomes: readonly string[]
        } | undefined>>
      )[id]
      : undefined
    if (expected === undefined) {
      messages.push(`p2 risk gate asset must not include unknown failure ${id}`)
    } else if (value.capability !== expected.capability) {
      messages.push(`p2 risk gate failure ${id} capability must be ${expected.capability}`)
    }
    const outcomes = value.acceptableRuntimeOutcomes
    if (
      !Array.isArray(outcomes)
      || outcomes.length === 0
      || outcomes.some(outcome => outcome !== 'fail-closed' && outcome !== 'recovered')
    ) {
      messages.push(
        `p2 risk gate failure ${id} acceptableRuntimeOutcomes must contain only fail-closed or recovered`,
      )
    } else if (
      expected !== undefined
      && JSON.stringify(outcomes) !== JSON.stringify(expected.acceptableRuntimeOutcomes)
    ) {
      messages.push(
        `p2 risk gate failure ${id} acceptableRuntimeOutcomes must equal `
        + expected.acceptableRuntimeOutcomes.join(', '),
      )
    }
    if (value.status !== 'pending' || value.runtimeOutcome !== null) {
      messages.push(`planned p2 risk gate failure ${id} must remain pending without a runtime outcome`)
    }
  }
  if (failures !== undefined) {
    for (const id of Object.keys(P2_FAILURES)) {
      if (!observedIds.has(id)) messages.push(`p2 risk gate asset must include failure ${id}`)
    }
  }
  const canary = objectField(asset, 'canary', 'p2 risk gate asset', messages)
  if (Object.hasOwn(asset, 'abComparisons')) {
    validateAbComparisons(
      asset,
      'abComparisons',
      'p2 risk gate A/B comparison',
      P2_AB_COMPARISON_IDS,
      messages,
    )
  }
  if (canary !== undefined) {
    validateExactKeys(canary, P2_CANARY_FIELDS, 'p2 risk gate canary', messages)
    if (canary.status !== 'pending') {
      messages.push('planned p2 risk gate canary must remain pending')
    }
    const durationDays = arrayField(canary, 'durationDays', 'p2 risk gate canary', messages)
    if (durationDays !== undefined && JSON.stringify(durationDays) !== '[3,7]') {
      messages.push('p2 risk gate canary durationDays must equal the numeric array [3, 7]')
    }
    if (canary.minimumTasks !== 100) messages.push('p2 risk gate canary must require at least 100 tasks')
    const rollout = arrayField(canary, 'rolloutPercentages', 'p2 risk gate canary', messages)
    if (rollout !== undefined && JSON.stringify(rollout) !== '[10,30,100]') {
      messages.push('p2 risk gate canary rollout must be 10%, 30%, then 100%')
    }
    const rollbackLines = arrayField(canary, 'rollbackLines', 'p2 risk gate canary', messages)
    if (
      rollbackLines !== undefined
      && JSON.stringify(rollbackLines) !== JSON.stringify(P2_CANARY_ROLLBACK_LINES)
    ) {
      messages.push(
        `p2 risk gate canary rollbackLines must equal ${P2_CANARY_ROLLBACK_LINES.join(', ')}`,
      )
    }
  }
  return messages
}

function validateWebCdpAsset(baselines: string): string[] {
  const messages: string[] = []
  const asset = readJsonObject(
    baselines,
    'web-cdp-regression.json',
    'web CDP regression asset',
    messages,
  )
  if (asset === undefined) return messages
  validateEvidenceKind(asset.evidenceKind, 'web CDP regression asset', ['planned'], messages)
  const browser = objectField(asset, 'browser', 'web CDP regression asset', messages)
  if (browser !== undefined) {
    if (browser.kind !== 'Chrome') messages.push('web CDP regression must require Chrome')
    if (browser.cdpPort !== 9333) messages.push('web CDP regression must require CDP port 9333')
    if (browser.ideEmbeddedBrowserAllowed !== false) messages.push('web CDP regression must reject IDE embedded browsers')
  }
  return messages
}

function validateAbComparisonAsset(baselines: string): string[] {
  const messages: string[] = []
  const asset = readJsonObject(
    baselines,
    'ab-comparisons.json',
    'A/B comparison asset',
    messages,
  )
  if (asset === undefined) return messages
  validateExactKeys(asset, AB_COMPARISON_ASSET_FIELDS, 'A/B comparison asset', messages)
  if (asset.schemaVersion !== 1) messages.push('A/B comparison asset.schemaVersion must be 1')
  validateEvidenceKind(asset.evidenceKind, 'A/B comparison asset', ['planned'], messages)
  requireNonEmptyString(asset.source, 'A/B comparison asset.source', messages)
  validateAbComparisons(asset, 'comparisons', 'A/B comparison', AB_COMPARISON_IDS, messages)
  return messages
}

function validateP2Profiles(asset: Record<string, unknown>, messages: string[]): void {
  const profiles = objectField(asset, 'profiles', 'p2 risk gate asset', messages)
  if (profiles === undefined) return
  validateExactKeys(profiles, Object.keys(P2_PROFILE_FIELDS), 'p2 risk gate profiles', messages)

  const coding = objectField(profiles, 'web-coding', 'p2 risk gate profiles', messages)
  if (coding !== undefined) {
    validateExactKeys(coding, P2_PROFILE_FIELDS['web-coding'], 'p2 risk gate profile web-coding', messages)
    if (coding.orchestrator !== 'dsh-agent-team-gui') {
      messages.push('p2 risk gate profile web-coding.orchestrator must be dsh-agent-team-gui')
    }
    const inactiveFallbacks = arrayField(
      coding,
      'inactiveFallbacks',
      'p2 risk gate profile web-coding',
      messages,
    )
    if (
      inactiveFallbacks !== undefined
      && canonicalBenchmarkJson(inactiveFallbacks) !== '["dsh-background-agents"]'
    ) {
      messages.push('p2 risk gate profile web-coding.inactiveFallbacks must equal dsh-background-agents')
    }
    if (coding.browserAutomation !== 'dsh-computer-use') {
      messages.push('p2 risk gate profile web-coding.browserAutomation must be dsh-computer-use')
    }
    const budgets = objectField(coding, 'budgets', 'p2 risk gate profile web-coding', messages)
    if (budgets !== undefined) {
      validateExactKeys(
        budgets,
        ['maxConcurrentAgents', 'maxDelegationDepth', 'maxTaskTokens', 'taskTimeoutMs'],
        'p2 risk gate profile web-coding.budgets',
        messages,
      )
      for (const [field, expected] of [
        ['maxConcurrentAgents', 4],
        ['maxDelegationDepth', 2],
        ['maxTaskTokens', 120_000],
        ['taskTimeoutMs', 1_800_000],
      ] as const) {
        if (budgets[field] !== expected) {
          messages.push(`p2 risk gate profile web-coding.budgets.${field} must be ${String(expected)}`)
        }
      }
    }
  }

  const research = objectField(profiles, 'web-research', 'p2 risk gate profiles', messages)
  if (research !== undefined) {
    validateExactKeys(research, P2_PROFILE_FIELDS['web-research'], 'p2 risk gate profile web-research', messages)
    const visionRouter = objectField(research, 'visionRouter', 'p2 risk gate profile web-research', messages)
    if (visionRouter !== undefined) {
      validateExactKeys(
        visionRouter,
        ['anonymousFallback', 'requiredCredentialMode'],
        'p2 risk gate profile web-research.visionRouter',
        messages,
      )
      if (visionRouter.anonymousFallback !== false) {
        messages.push('p2 risk gate profile web-research.visionRouter.anonymousFallback must be false')
      }
      if (visionRouter.requiredCredentialMode !== 'provider-key-or-disabled') {
        messages.push(
          'p2 risk gate profile web-research.visionRouter.requiredCredentialMode must be provider-key-or-disabled',
        )
      }
    }
    const office = objectField(research, 'office', 'p2 risk gate profile web-research', messages)
    if (office !== undefined) {
      validateExactKeys(
        office,
        ['provider', 'buildTimeBudgetMs', 'rssBudgetMiB', 'fidelityTasks'],
        'p2 risk gate profile web-research.office',
        messages,
      )
      if (office.provider !== 'dsh-univer-office') {
        messages.push('p2 risk gate profile web-research.office.provider must be dsh-univer-office')
      }
      if (office.buildTimeBudgetMs !== 600_000) {
        messages.push('p2 risk gate profile web-research.office.buildTimeBudgetMs must be 600000')
      }
      if (office.rssBudgetMiB !== 2048) {
        messages.push('p2 risk gate profile web-research.office.rssBudgetMiB must be 2048')
      }
      const fidelityTasks = arrayField(
        office,
        'fidelityTasks',
        'p2 risk gate profile web-research.office',
        messages,
      )
      if (
        fidelityTasks !== undefined
        && canonicalBenchmarkJson(fidelityTasks)
        !== '["docx-roundtrip","xlsx-formula-preservation","pptx-layout-preservation"]'
      ) {
        messages.push(
          'p2 risk gate profile web-research.office.fidelityTasks must equal docx-roundtrip, '
          + 'xlsx-formula-preservation, pptx-layout-preservation',
        )
      }
    }
  }

  const enterprise = objectField(profiles, 'web-enterprise', 'p2 risk gate profiles', messages)
  if (enterprise !== undefined) {
    validateExactKeys(
      enterprise,
      P2_PROFILE_FIELDS['web-enterprise'],
      'p2 risk gate profile web-enterprise',
      messages,
    )
    const channels = objectField(
      enterprise,
      'externalChannels',
      'p2 risk gate profile web-enterprise',
      messages,
    )
    if (channels !== undefined) {
      validateExactKeys(channels, ['dsh-feishu'], 'p2 risk gate profile web-enterprise.externalChannels', messages)
      const feishu = objectField(
        channels,
        'dsh-feishu',
        'p2 risk gate profile web-enterprise.externalChannels',
        messages,
      )
      if (feishu !== undefined) {
        validateExactKeys(
          feishu,
          ['active', 'requiredBeforeActivation'],
          'p2 risk gate profile web-enterprise.externalChannels.dsh-feishu',
          messages,
        )
        if (feishu.active !== false) {
          messages.push('p2 risk gate profile web-enterprise.externalChannels.dsh-feishu.active must be false')
        }
        const requiredBeforeActivation = arrayField(
          feishu,
          'requiredBeforeActivation',
          'p2 risk gate profile web-enterprise.externalChannels.dsh-feishu',
          messages,
        )
        if (
          requiredBeforeActivation !== undefined
          && canonicalBenchmarkJson(requiredBeforeActivation)
          !== '["threat-model","credential-review","egress-approval"]'
        ) {
          messages.push(
            'p2 risk gate profile web-enterprise.externalChannels.dsh-feishu.requiredBeforeActivation '
            + 'must equal threat-model, credential-review, egress-approval',
          )
        }
      }
    }
  }
}

function validateAbComparisons(
  asset: Record<string, unknown>,
  field: string,
  label: string,
  expectedIds: readonly (keyof typeof AB_COMPARISONS)[],
  messages: string[],
): void {
  const comparisons = arrayField(
    asset,
    field,
    field === 'comparisons' ? 'A/B comparison asset' : 'p2 risk gate asset',
    messages,
  )
  const observedIds = new Set<string>()
  for (const [index, comparison] of comparisons?.entries() ?? []) {
    const indexedLabel = `${label} ${String(index)}`
    if (!isRecord(comparison)) {
      messages.push(`${indexedLabel} must be a JSON object`)
      continue
    }
    const id = comparison.id
    const comparisonLabel = typeof id === 'string' && id.length > 0 ? `${label} ${id}` : indexedLabel
    validateExactKeys(comparison, AB_COMPARISON_FIELDS, comparisonLabel, messages)
    if (typeof id !== 'string' || id.length === 0) {
      messages.push(`${indexedLabel}.id must be a non-empty string`)
      continue
    }
    if (observedIds.has(id)) messages.push(`${label} ids must be unique: ${id}`)
    observedIds.add(id)
    const expected = (
      AB_COMPARISONS as Readonly<Record<string, typeof AB_COMPARISONS[keyof typeof AB_COMPARISONS] | undefined>>
    )[id]
    if (expected === undefined || !expectedIds.includes(id as keyof typeof AB_COMPARISONS)) {
      messages.push(`${label} must not include unknown comparison ${id}`)
      continue
    }
    if (comparison.status !== 'pending') messages.push(`${comparisonLabel}.status must be pending`)
    for (const fieldName of ['capability', 'primary', 'alternative'] as const) {
      if (comparison[fieldName] !== expected[fieldName]) {
        messages.push(`${comparisonLabel}.${fieldName} must be ${expected[fieldName]}`)
      }
    }
    const scale = objectField(comparison, 'scale', comparisonLabel, messages)
    if (scale !== undefined) {
      validateExactKeys(scale, Object.keys(expected.scale), `${comparisonLabel}.scale`, messages)
      if (canonicalBenchmarkJson(scale) !== canonicalBenchmarkJson(expected.scale)) {
        messages.push(`${comparisonLabel}.scale must match the planned comparison scale`)
      }
    }
    const statistics = objectField(comparison, 'statistics', comparisonLabel, messages)
    if (statistics !== undefined) {
      validateExactKeys(statistics, Object.keys(AB_STATISTICS), `${comparisonLabel}.statistics`, messages)
      if (canonicalBenchmarkJson(statistics) !== canonicalBenchmarkJson(AB_STATISTICS)) {
        messages.push(`${comparisonLabel}.statistics must require mean, p50, p95, and failureDistribution`)
      }
    }
    const thresholds = arrayField(
      comparison,
      'nonCompensableThresholds',
      comparisonLabel,
      messages,
    )
    if (
      thresholds !== undefined
      && canonicalBenchmarkJson(thresholds) !== canonicalBenchmarkJson(NON_COMPENSABLE_THRESHOLDS)
    ) {
      messages.push(
        `${comparisonLabel}.nonCompensableThresholds must equal ${NON_COMPENSABLE_THRESHOLDS.join(', ')}`,
      )
    }
  }
  if (comparisons !== undefined) {
    for (const id of expectedIds) {
      if (!observedIds.has(id)) messages.push(`${label.replace(/ A\/B comparison$/u, '')} must include ${id}`)
    }
  }
}

function readJsonObject(
  root: string,
  reference: string,
  label: string,
  messages: string[],
): Record<string, unknown> | undefined {
  try {
    const parsed = readContainedBenchmarkJson(root, reference, label, 'benchmark asset directory')
    canonicalBenchmarkJson(parsed)
    if (isRecord(parsed)) return parsed
    messages.push(`${label} must be a JSON object`)
  } catch (error) {
    /* v8 ignore next -- contained JSON reads and filesystem operations normalize failures to Error. */
    messages.push(`${label} cannot be loaded: ${error instanceof Error ? error.message : String(error)}`)
  }
  return undefined
}

function objectField(
  record: Record<string, unknown>,
  field: string,
  label: string,
  messages: string[],
): Record<string, unknown> | undefined {
  const value = record[field]
  if (isRecord(value)) return value
  messages.push(`${label}.${field} must be a JSON object`)
  return undefined
}

function arrayField(record: Record<string, unknown>, field: string, label: string, messages: string[]): unknown[] | undefined {
  const value = record[field]
  if (isUnknownArray(value)) return [...value]
  messages.push(`${label}.${field} must be a JSON array`)
  return undefined
}

function validateEvidenceKind(value: unknown, label: string, allowed: readonly string[], messages: string[]): void {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    messages.push(`${label}.evidenceKind must be ${allowed.join(' or ')}`)
  }
}

function validateExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  label: string,
  messages: string[],
): boolean {
  const exact = canonicalBenchmarkJson(Object.keys(value).sort()) === canonicalBenchmarkJson([...expected].sort())
  if (!exact) {
    messages.push(`${label} must contain exactly ${expected.join(', ').replace(/, ([^,]+)$/u, ', and $1')}`)
  }
  return exact
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// No runtime invariant: this package owns fixed JSON assets and no observable
// event-stream or mutable-data relationship; static validation runs in tests.
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))

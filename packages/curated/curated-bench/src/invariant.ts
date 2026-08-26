/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-curated-bench`.
 * @module @deepseek-ai/dsh-curated-bench/invariant
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import { canonicalBenchmarkJson } from './snapshot.ts'
import {
  curatedBenchBaselinesDir,
  curatedBenchManifestsDir,
  curatedBenchTasksDir,
  type CuratedBenchAssetDirs,
} from './index.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-curated-bench'

/** Cordis companion plugin name. */
export const name = 'curated-bench-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']


/**
 * Validate the benchmark asset directories required by the curated scripts.
 * @param dirs - Directory paths for each fixture class.
 * @returns invariant failure messages, empty when every sentinel exists.
 */
export function validateCuratedBenchAssets(dirs: CuratedBenchAssetDirs): readonly string[] {
  const messages: string[] = []
  for (const [label, dir] of [
    ['manifests', dirs.manifests],
    ['tasks', dirs.tasks],
    ['baselines', dirs.baselines],
  ] as const) {
    if (!existsSync(join(dir, '.keep.json'))) messages.push(`curated benchmark ${label} directory is missing its sentinel`)
  }
  if (messages.length > 0) return messages
  messages.push(...validateRiskGateAsset(join(dirs.tasks, 'p2-risk-gates.json')))
  messages.push(...validateWebCdpAsset(join(dirs.baselines, 'web-cdp-regression.json')))
  messages.push(...validateAbComparisonAsset(join(dirs.baselines, 'ab-comparisons.json')))
  messages.push(...validateBenchmarkAsset(join(dirs.baselines, 'benchmark.json')))
  return messages
}

function validateBenchmarkAsset(path: string): string[] {
  const messages: string[] = []
  const asset = readJsonObject(path, 'benchmark asset', messages)
  if (asset === undefined) return messages
  validateEvidenceKind(asset.evidenceKind, 'benchmark asset', ['observed', 'fixture', 'planned'], messages)
  const previousSnapshots = objectField(asset, 'previousSnapshots', 'benchmark asset', messages)
  if (previousSnapshots !== undefined) {
    validateSnapshotEnvelope(previousSnapshots.lock, 'benchmark previous lock snapshot', 'curated-lock-snapshot', messages)
    validateSnapshotEnvelope(previousSnapshots.profile, 'benchmark previous profile snapshot', 'curated-profile-snapshot', messages)
  }
  for (const [field, label] of [
    ['baseline', 'benchmark baseline'],
    ['candidate', 'benchmark candidate'],
  ] as const) {
    const profile = objectField(asset, field, 'benchmark asset', messages)
    if (profile === undefined) continue
    if (typeof profile.lockSnapshot !== 'string' || profile.lockSnapshot.length === 0) {
      messages.push(`${label} lock snapshot must be a non-empty string`)
    }
    if (typeof profile.profileSnapshot !== 'string' || profile.profileSnapshot.length === 0) {
      messages.push(`${label} profile snapshot must be a non-empty string`)
    }
  }
  return messages
}

function validateSnapshotEnvelope(
  value: unknown,
  label: string,
  expectedKind: 'curated-lock-snapshot' | 'curated-profile-snapshot',
  messages: string[],
): void {
  if (!isRecord(value)) {
    messages.push(`${label} must be a JSON object`)
    return
  }
  const snapshot = value.snapshot
  if (!isRecord(snapshot)) {
    messages.push(`${label}.snapshot must be a JSON object`)
    return
  }
  if (typeof value.sha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(value.sha256)) {
    messages.push(`${label}.sha256 must be a lowercase SHA-256 digest`)
  } else if (createHash('sha256').update(canonicalBenchmarkJson(snapshot)).digest('hex') !== value.sha256) {
    messages.push(`${label}.sha256 does not match its embedded snapshot`)
  }
  if (snapshot.kind !== expectedKind) messages.push(`${label}.snapshot.kind must be ${expectedKind}`)
  if (expectedKind === 'curated-lock-snapshot') {
    if ('catalogRef' in snapshot) messages.push(`${label}.snapshot must not depend on a mutable catalogRef`)
    if (!Array.isArray(snapshot.candidates)) messages.push(`${label}.snapshot.candidates must be a JSON array`)
  } else if (!Array.isArray(snapshot.bundles)) {
    messages.push(`${label}.snapshot.bundles must be a JSON array`)
  }
}

function validateRiskGateAsset(path: string): string[] {
  const messages: string[] = []
  const asset = readJsonObject(path, 'p2 risk gate asset', messages)
  if (asset === undefined) return messages
  validateEvidenceKind(asset.evidenceKind, 'p2 risk gate asset', ['planned'], messages)
  const canary = objectField(asset, 'canary', 'p2 risk gate asset', messages)
  if (canary !== undefined) {
    const durationDays = arrayField(canary, 'durationDays', 'p2 risk gate canary', messages)
    if (durationDays !== undefined && (durationDays[0] !== 3 || durationDays[1] !== 7)) {
      messages.push('p2 risk gate canary must record the 3-7 day duration window')
    }
    if (canary.minimumTasks !== 100) messages.push('p2 risk gate canary must require at least 100 tasks')
    const rollout = arrayField(canary, 'rolloutPercentages', 'p2 risk gate canary', messages)
    if (rollout !== undefined && JSON.stringify(rollout) !== '[10,30,100]') {
      messages.push('p2 risk gate canary rollout must be 10%, 30%, then 100%')
    }
  }
  return messages
}

function validateWebCdpAsset(path: string): string[] {
  const messages: string[] = []
  const asset = readJsonObject(path, 'web CDP regression asset', messages)
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

function validateAbComparisonAsset(path: string): string[] {
  const messages: string[] = []
  const asset = readJsonObject(path, 'A/B comparison asset', messages)
  if (asset === undefined) return messages
  validateEvidenceKind(asset.evidenceKind, 'A/B comparison asset', ['planned'], messages)
  const comparisons = arrayField(asset, 'comparisons', 'A/B comparison asset', messages)
  const ids = new Set(comparisons?.filter(isRecord).map(comparison => comparison.id))
  for (const id of [
    'web-search-pro-vs-free-web-search',
    'memento-vs-mneme',
    'computer-use-vs-tabbit',
    'mcp-panel-vs-mcp-manager',
    'cost-meter-vs-tokenledger',
  ]) {
    if (!ids.has(id)) messages.push(`A/B comparison asset must include ${id}`)
  }
  return messages
}

function readJsonObject(path: string, label: string, messages: string[]): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (isRecord(parsed)) return parsed
    messages.push(`${label} must be a JSON object`)
  } catch (error) {
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

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Report benchmark asset failures through an invariant callback.
 * @param dirs - Directory paths for each fixture class.
 * @param fail - Invariant failure sink.
 */
export function reportCuratedBenchAssetFailures(dirs: CuratedBenchAssetDirs, fail: (message: string) => void): void {
  validateCuratedBenchAssets(dirs).forEach(fail)
}

/** Verify the benchmark package ships its three required asset directories. */
const install: InvariantInstaller = (_ctx, fail) => {
  reportCuratedBenchAssetFailures({
    baselines: curatedBenchBaselinesDir,
    manifests: curatedBenchManifestsDir,
    tasks: curatedBenchTasksDir,
  }, fail)
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))

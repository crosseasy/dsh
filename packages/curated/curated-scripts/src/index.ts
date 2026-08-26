/**
 * Offline verification commands for curated plugin catalog and profile patches.
 * @module @deepseek-ai/dsh-curated-scripts
 */

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { loadProfile, PROFILE_TEMPLATES } from '@deepseek-ai/dsh-app-boot'
import { canonicalBenchmarkJson } from '@deepseek-ai/dsh-curated-bench/snapshot'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import {
  classifyAdmission,
  loadCapabilityConflicts,
  loadCuratedCatalog,
  validateCandidateLock,
  validateProfileConflicts,
  type CapabilityConflictCatalog,
  type CuratedCandidate,
  type CuratedCandidateResources,
  type CuratedCatalog,
  type PolicyIssue,
} from '@deepseek-ai/dsh-curated-policy'
import { CURATED_PROFILE_TEMPLATES } from '@deepseek-ai/dsh-curated-profiles'
import { load as loadYaml } from 'js-yaml'

/** Captured command result returned by source-tree commands and tests. */
export interface CommandResult {
  /** Process exit status; zero means success. */
  readonly status: number
  /** Complete stdout text. */
  readonly stdout: string
  /** Complete stderr text. */
  readonly stderr: string
}

/** Stable machine-readable issue emitted by curated verification commands. */
export interface CommandIssue {
  /** Stable issue code. */
  readonly code: string
  /** Candidate, entry, or profile id associated with the issue. */
  readonly target?: string
  /** Redacted human-readable diagnostic. */
  readonly message: string
  /** Optional redacted structured details for JSON consumers. */
  readonly details?: unknown
}

/** Smoke-profile child stage names that may run a subprocess. */
export type SmokeProfileChildStage = 'dump-config' | 'help'

/** One subprocess request made by profile smoke. */
export interface SmokeProfileRunnerRequest {
  /** Stage being executed. */
  readonly stage: SmokeProfileChildStage
  /** Profile passed to `dsh --profile`. */
  readonly profile: string
  /** Ordered bundle names declared by the profile being smoked. */
  readonly bundles: readonly string[]
  /** Maximum allowed subprocess duration in milliseconds. */
  readonly timeoutMs: number
}

/** Result returned by a profile smoke child runner. */
export interface SmokeProfileRunnerResult {
  /** Child exit status. */
  readonly status: number
  /** Captured stdout text. */
  readonly stdout: string
  /** Captured stderr text. */
  readonly stderr: string
  /** Measured or supplied stage duration. */
  readonly durationMs: number
  /** Whether the runner stopped the stage for exceeding its timeout. */
  readonly timedOut?: boolean
}

/** Runs one dump/help stage for smoke-profile. */
export type SmokeProfileRunner = (request: SmokeProfileRunnerRequest) => Promise<SmokeProfileRunnerResult>

/** Minimal profile manifest facts used by smoke-profile. */
export interface SmokeProfileTemplate {
  /** Ordered bundle names declared by the profile. */
  readonly bundles?: readonly string[]
}

/** One staged smoke-profile result. */
export interface SmokeProfileStageResult {
  /** Stage name in execution order. */
  readonly name: 'manifest' | 'bundle-parse' | SmokeProfileChildStage
  /** Whether this stage passed. */
  readonly ok: boolean
  /** Stage duration in milliseconds. */
  readonly durationMs: number
  /** Child process exit status, for subprocess stages. */
  readonly status?: number
  /** Redacted stage error, when failed. */
  readonly error?: string
}

/** Machine-readable smoke-profile output. */
export interface SmokeProfileReport {
  /** Command name. */
  readonly command: 'smoke-profile'
  /** True when every stage passes. */
  readonly ok: boolean
  /** Whether checks used an explicit installed profile root. */
  readonly observed: boolean
  /** Profile checked by the command. */
  readonly profile: string
  /** Per-command timeout budget in milliseconds. */
  readonly timeLimitMs: number
  /** Stage results in execution order. */
  readonly stages: readonly SmokeProfileStageResult[]
  /** Stable smoke issues. */
  readonly issues: readonly CommandIssue[]
}

/** Numeric benchmark distribution. */
export interface BenchmarkStatistic {
  /** Arithmetic mean. */
  readonly mean: number
  /** Nearest-rank P50. */
  readonly p50: number
  /** Nearest-rank P95. */
  readonly p95: number
}

/** Stable benchmark gate failure. */
export interface BenchmarkGateFailure {
  /** Machine-readable gate code. */
  readonly code: string
  /** Redacted human-readable reason. */
  readonly message: string
}

/** Provenance class carried by one benchmark comparison. */
export type BenchmarkEvidenceKind = 'observed' | 'fixture' | 'planned'

/** Environment facts that must match across a benchmark comparison. */
export interface BenchmarkEnvironment {
  /** Exact model identifier. */
  readonly model: string
  /** Prompt or prompt-suite identifier. */
  readonly prompt: string
  /** Workspace or source-state identifier. */
  readonly workspace: string
  /** Network-condition identifier. */
  readonly network: string
  /** Deterministic execution seed. */
  readonly seed: number | string
}

/** Execution provenance for one side of a benchmark comparison. */
export interface BenchmarkExecution {
  /** Unique execution identifier. */
  readonly id: string
  /** Canonical ISO timestamp at which execution started. */
  readonly startedAt: string
  /** Environment that produced the run records. */
  readonly environment: BenchmarkEnvironment
}

/** Embedded rollback snapshot protected by a canonical SHA-256 digest. */
export interface BenchmarkRollbackSnapshot {
  /** SHA-256 of the canonical embedded snapshot JSON. */
  readonly sha256: string
  /** Complete lock or profile snapshot needed for rollback. */
  readonly snapshot: Readonly<Record<string, unknown>>
}

/** Lock and profile snapshots needed to restore the previous selection. */
export interface BenchmarkRollbackSnapshots {
  /** Previous self-contained candidate lock. */
  readonly lock: BenchmarkRollbackSnapshot
  /** Previous self-contained profile composition. */
  readonly profile: BenchmarkRollbackSnapshot
}

/** Summary for one benchmark profile. */
export interface BenchmarkProfileSummary {
  /** Profile name in the benchmark fixture. */
  readonly profile: string
  /** Execution provenance retained with the summary. */
  readonly execution: BenchmarkExecution
  /** Lock snapshot used for this profile. */
  readonly lockSnapshot: string
  /** Profile snapshot used for this profile. */
  readonly profileSnapshot: string
  /** Overall task success rate as a percentage. */
  readonly successRate: number
  /** Critical task success rate as a percentage. */
  readonly criticalSuccessRate: number
  /** Startup failure rate as a percentage. */
  readonly startupFailureRate: number
  /** Mean security-correctness score. */
  readonly securityCorrectness: number
  /** Total data-loss event count. */
  readonly dataLossEvents: number
  /** Whether every run reports rollback support. */
  readonly rollbackPossible: boolean
  /** Numeric distributions needed by Task 6. */
  readonly statistics: {
    /** First token latency distribution, in milliseconds. */
    readonly firstTokenMs: BenchmarkStatistic
    /** Prompt plus tool schema token distribution. */
    readonly promptSchemaTokens: BenchmarkStatistic
    /** Per-task cost distribution. */
    readonly costUsd: BenchmarkStatistic
  }
  /** Failed run counts keyed by failure reason. */
  readonly failureDistribution: Readonly<Record<string, number>>
  /** Weighted dynamic benchmark score. */
  readonly weightedScore: number
}

/** Machine-readable compare-benchmark output. */
export interface BenchmarkComparison {
  /** Command name. */
  readonly command: 'compare-benchmark'
  /** Provenance class supplied by the comparison input. */
  readonly evidenceKind: BenchmarkEvidenceKind
  /** True when the candidate is accepted. */
  readonly ok: boolean
  /** Final benchmark decision. */
  readonly status: 'accepted' | 'rejected' | 'rollback' | 'unverified'
  /** Immutable snapshots to restore when rollback is required. */
  readonly previousSnapshots: BenchmarkRollbackSnapshots
  /** Baseline profile summary. */
  readonly baseline: BenchmarkProfileSummary
  /** Candidate profile summary. */
  readonly candidate: BenchmarkProfileSummary
  /** Non-compensable failures; any entry rejects the candidate. */
  readonly nonCompensableFailures: readonly BenchmarkGateFailure[]
  /** Rollback decision and reason list. */
  readonly rollback: {
    /** Whether rollback is required. */
    readonly required: boolean
    /** Immutable snapshots to restore when rollback is required. */
    readonly previousSnapshots: BenchmarkRollbackSnapshots
    /** Rollback threshold reasons. */
    readonly reasons: readonly BenchmarkGateFailure[]
  }
}

interface ParsedArgs {
  readonly artifactRoots: readonly string[]
  readonly fixture?: string
  readonly json: boolean
  readonly profile: string
  readonly profileRoot?: string
}

interface EntryRecord {
  readonly id?: unknown
  readonly name?: unknown
  readonly config?: unknown
  readonly insert?: unknown
}

interface CuratedEntry {
  readonly entryId?: string
  readonly pluginName?: string
  readonly candidateId: string
  readonly profile: string
  readonly active: boolean
  readonly capability: string
  readonly resources: CuratedCandidateResources
}

interface CuratedEntryReadResult {
  readonly entry?: CuratedEntry
  readonly issues: readonly CommandIssue[]
}

/** Read-only facts for one resolved candidate artifact. */
export interface ResolvedCandidateArtifact {
  /** Absolute package directory containing the observed manifest and bundle patch. */
  readonly packageDir: string
  /** Repository URL recorded by the artifact fetch. */
  readonly repository: string
  /** Exact commit returned by the artifact fetch. */
  readonly commit: string
  /** SHA-256 digest of the fetched package archive. */
  readonly tarballSha256: string
  /** Repository paths changed by the candidate commit. */
  readonly changedPaths: readonly string[]
}

/** Resolves audited package artifacts without installing or executing them. */
export interface CuratedArtifactResolver {
  /**
   * Resolve one candidate's exact artifact.
   * @param candidate - Catalog candidate whose pinned artifact is required.
   * @returns observed artifact facts, or undefined when unavailable.
   */
  resolve(candidate: CuratedCandidate): ResolvedCandidateArtifact | undefined
}

/** Optional dependencies for exact lock verification. */
export interface VerifyLockOptions {
  /** Exact package-resolution roots used for observed artifact verification. */
  readonly artifactRoots?: readonly string[]
  /** Artifact source used to verify catalog claims against observed files. */
  readonly artifactResolver?: CuratedArtifactResolver
  /** Node version used for engines compatibility checks. */
  readonly nodeVersion?: string
}

/** Optional installed-profile inputs for preflight. */
export interface PreflightOptions {
  /** Exact package-resolution roots used for installed bundle resolution. */
  readonly artifactRoots?: readonly string[]
  /** Materialized profile directory containing package.json and node_modules. */
  readonly profileRoot?: string
  /** Resolver used for third-party bundles declared by the profile manifest. */
  readonly artifactResolver?: CuratedArtifactResolver
}

type ResourceField = keyof CuratedCandidateResources
type ConflictResourceField = Exclude<ResourceField, 'entryIds'>
type BenchmarkMetric = 'quality' | 'securityCorrectness' | 'reliability' | 'performanceCost' | 'operationExperience' | 'upgradeCompatibility'

const DEFAULT_PROFILE = 'web-curated'
const SMOKE_PROFILE_TIME_LIMIT_MS = 55_000
const COMPARE_BENCHMARK_DEFAULT_FIXTURE = fileURLToPath(
  new URL('../../curated-bench/baselines/benchmark.json', import.meta.url),
)
const DSH_SOURCE_BIN = fileURLToPath(new URL('../../../../apps/cli/src/bin.ts', import.meta.url))
const DSH_INSTALL_ANCHOR = fileURLToPath(new URL('../../../../apps/cli/package.json', import.meta.url))
const VERIFY_LOCK_DEFAULT_CATALOG = fileURLToPath(
  new URL('../../curated-policy/policy/plugin-allowlist.yaml', import.meta.url),
)
const PREFLIGHT_DEFAULT_CONFLICTS = fileURLToPath(
  new URL('../../curated-policy/policy/capability-conflicts.yaml', import.meta.url),
)
const PREFLIGHT_DEFAULT_PATCH = fileURLToPath(new URL('../../curated-base/cordis.patch.yml', import.meta.url))
const ARTIFACT_PROVENANCE_FILE = '.dsh-curated-artifact.json'
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const INSTALL_SCRIPT_HOOK_PATTERN = /^(?:preinstall|install|postinstall|prepare)$/u
const UNSAFE_INSTALL_SCRIPT_PATTERN = /(?:curl|wget|invoke-webrequest|https?:\/\/|sudo|\/usr\/|\/etc\/|\/Library\/)/iu
const REDACTED = '[REDACTED]'
const SECRET_KEY_PATTERN = /(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|secret|token)/iu
const SECRET_VALUE_PATTERN = /(?:bearer\s+\S+|gh[pousr]_[a-z0-9_]+|sk-[a-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/iu
const SECRET_VALUE_REPLACEMENT_PATTERN = /(?:bearer\s+\S+|gh[pousr]_[a-z0-9_]+|sk-[a-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/giu
const PERMISSION_POLICY_CAPABILITY = 'permission-policy'
const PERMISSION_RULES_ENTRY_ID = 'permission-rules'
const RESOURCE_FIELDS = [
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
] as const satisfies readonly ConflictResourceField[]
const CURATED_RESOURCE_FIELDS = ['entryIds', ...RESOURCE_FIELDS] as const satisfies readonly ResourceField[]
const CURATED_METADATA_FIELDS = ['candidateId', 'profile', 'active', 'capability', 'resources'] as const
const RESOURCE_DUPLICATE_CODES = {
  toolNames: 'preflight-tool-name-duplicate',
  commandNames: 'preflight-command-name-duplicate',
  serviceKeys: 'preflight-service-key-duplicate',
  uiSlots: 'preflight-ui-slot-duplicate',
  settingsTabs: 'preflight-settings-tab-duplicate',
  routes: 'preflight-route-duplicate',
  ports: 'preflight-port-duplicate',
  sqlitePaths: 'preflight-sqlite-path-duplicate',
  cacheDirs: 'preflight-cache-dir-duplicate',
  envVars: 'preflight-env-var-duplicate',
  waterfallListeners: 'preflight-waterfall-listener-duplicate',
  automationBehaviors: 'preflight-automation-behavior-duplicate',
} as const satisfies Record<ConflictResourceField, string>
const RESOURCE_LABELS = {
  toolNames: 'tool name',
  commandNames: 'command name',
  serviceKeys: 'service key',
  uiSlots: 'UI slot',
  settingsTabs: 'settings tab',
  routes: 'route',
  ports: 'port',
  sqlitePaths: 'SQLite path',
  cacheDirs: 'cache directory',
  envVars: 'environment variable',
  waterfallListeners: 'waterfall listener',
  automationBehaviors: 'automation behavior',
} as const satisfies Record<ConflictResourceField, string>
const WATERFALL_LISTENER_PATTERN = /^(?:agent\/pre-step|agent\/request|tools\/pre-execute):next$/u
const PROFILE_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/u
const SHIPPED_SMOKE_PROFILE_TEMPLATES: Readonly<Record<string, SmokeProfileTemplate>> = Object.freeze(
  Object.fromEntries(Object.entries(PROFILE_TEMPLATES).map(([profile, bundles]) => [
    profile,
    Object.freeze({ bundles: Object.freeze([...bundles]) }),
  ])),
)
const SMOKE_PROFILE_TEMPLATES = {
  ...SHIPPED_SMOKE_PROFILE_TEMPLATES,
  ...CURATED_PROFILE_TEMPLATES,
} satisfies Readonly<Record<string, SmokeProfileTemplate>>
const BENCHMARK_WEIGHTS = {
  taskSuccess: 0.30,
  quality: 0.20,
  securityCorrectness: 0.15,
  reliability: 0.15,
  performanceCost: 0.10,
  operationExperience: 0.05,
  upgradeCompatibility: 0.05,
} as const

/** Optional installed-profile and runner inputs for smoke verification. */
export interface SmokeProfileOptions {
  readonly profiles?: Readonly<Record<string, SmokeProfileTemplate>>
  readonly runner?: SmokeProfileRunner
  readonly timeLimitMs?: number
  readonly artifactRoots?: readonly string[]
  readonly profileRoot?: string
  readonly artifactResolver?: CuratedArtifactResolver
  readonly prepare?: () => Promise<void>
}

interface SmokeProfileChildRunnerOptions {
  readonly env?: NodeJS.ProcessEnv
}

interface BenchmarkRun {
  readonly taskId: string
  readonly attempt: number
  readonly critical: boolean
  readonly startupSucceeded: boolean
  readonly dataLossEvents: number
  readonly rollbackSupported: boolean
  readonly success: boolean
  readonly failure: string | null
  readonly quality: number
  readonly securityCorrectness: number
  readonly reliability: number
  readonly performanceCost: number
  readonly operationExperience: number
  readonly upgradeCompatibility: number
  readonly firstTokenMs: number
  readonly promptTokens: number
  readonly schemaTokens: number
  readonly costUsd: number
}

interface BenchmarkProfile {
  readonly profile: string
  readonly execution?: BenchmarkExecution
  readonly lockSnapshot: string
  readonly profileSnapshot: string
  readonly runs: readonly BenchmarkRun[]
}

interface BenchmarkDataset {
  readonly evidenceKind: BenchmarkEvidenceKind
  readonly pendingCampaigns: readonly string[]
  readonly requiredCriticalTaskIds: readonly string[]
  readonly previousSnapshots: BenchmarkRollbackSnapshots
  readonly baseline: BenchmarkProfile
  readonly candidate: BenchmarkProfile
}

/**
 * Verify curated catalog lock metadata.
 * @param args - CLI-style arguments; supports `--fixture <path>` and `--json`.
 * @param options - Optional exact artifact resolver and Node version.
 * @returns captured status and output.
 */
export function runVerifyLock(args: readonly string[], options: VerifyLockOptions = {}): CommandResult {
  try {
    const parsed = parseArgs(args)
    const path = parsed.fixture ?? VERIFY_LOCK_DEFAULT_CATALOG
    const artifactRoots = [
      ...parsed.artifactRoots,
      ...(options.artifactRoots ?? []).map(root => exactRoot(root, 'artifactRoots')),
    ]
    if (options.artifactResolver !== undefined && artifactRoots.length === 0) {
      throw new Error('artifactRoots must identify the exact roots used by artifactResolver')
    }
    const artifactResolver = options.artifactResolver
      ?? (artifactRoots.length === 0 ? undefined : createInstalledArtifactResolver(artifactRoots))
    const rawCatalog = loadYamlFile(path, 'curated catalog')
    const catalog = loadCuratedCatalog(path)
    const issues = uniqueIssues([
      ...validateCandidateLock(catalogForLockValidation(catalog)).map(issueFromPolicy),
      ...profileConflictIssues(catalog),
      ...validateAuditCompleteness(catalog, rawCatalog),
      ...artifactResolver === undefined
        ? []
        : validateResolvedArtifacts(catalog, artifactResolver, options.nodeVersion ?? process.versions.node),
    ])

    return formatResult({
      command: 'verify-lock',
      json: parsed.json,
      okText: `verify-lock: ok (${String(catalog.candidates.length)} candidates)\n`,
      failText: `verify-lock: failed (${String(catalog.candidates.length)} candidates, ${String(issues.length)} issues)\n`,
      payload: {
        command: 'verify-lock',
        ok: issues.length === 0,
        observed: artifactResolver !== undefined,
        candidateCount: catalog.candidates.length,
        issues,
      },
      issues,
    })
  } catch (error) {
    return formatThrown('verify-lock', error, args.includes('--json'))
  }
}

/**
 * Resolve installed candidate packages and their immutable provenance records.
 * @param roots - Package-resolution roots, in priority order.
 * @returns a resolver shared by lock verification, preflight, and smoke.
 */
export function createInstalledArtifactResolver(roots: readonly string[]): CuratedArtifactResolver {
  return {
    resolve(candidate) {
      if (candidate.expectedPackage === null) return undefined
      const packageDir = findCandidatePackageDir(candidate.expectedPackage, roots)
      if (packageDir === undefined) return undefined
      const provenancePath = join(packageDir, ARTIFACT_PROVENANCE_FILE)
      if (!existsSync(provenancePath)) return undefined
      const provenance = JSON.parse(readFileSync(provenancePath, 'utf8')) as unknown
      const record = requiredRecord(provenance, `${candidate.id} artifact provenance`)
      const changedPaths = record.changedPaths
      if (!Array.isArray(changedPaths) || changedPaths.some(path => typeof path !== 'string')) {
        throw new Error(`${candidate.id} artifact provenance changedPaths must be a string array`)
      }
      return {
        packageDir,
        repository: requiredString(record.repository, `${candidate.id} artifact provenance.repository`),
        commit: requiredString(record.commit, `${candidate.id} artifact provenance.commit`),
        tarballSha256: requiredString(record.tarballSha256, `${candidate.id} artifact provenance.tarballSha256`),
        changedPaths: changedPaths as string[],
      }
    },
  }
}

function validateResolvedArtifacts(
  catalog: CuratedCatalog,
  resolver: CuratedArtifactResolver,
  nodeVersion: string,
): CommandIssue[] {
  return catalog.candidates.flatMap(candidate => validateResolvedArtifact(candidate, resolver, nodeVersion))
}

function validateResolvedArtifact(
  candidate: CuratedCandidate,
  resolver: CuratedArtifactResolver,
  nodeVersion: string,
): CommandIssue[] {
  if (!candidate.active) return []
  const artifact = resolver.resolve(candidate)
  if (artifact === undefined) {
    return [issue({
      code: 'artifact-unreachable',
      target: candidate.id,
      message: 'pinned candidate artifact is unavailable',
    })]
  }
  const issues: CommandIssue[] = []
  if (artifact.repository !== candidate.repository) {
    issues.push(issue({
      code: 'artifact-repository-mismatch',
      target: candidate.id,
      message: 'resolved artifact repository does not match the catalog',
    }))
  }
  if (artifact.commit !== candidate.commit) {
    issues.push(issue({
      code: 'artifact-commit-mismatch',
      target: candidate.id,
      message: 'resolved artifact commit does not match the exact catalog SHA',
    }))
  }
  if (artifact.tarballSha256 !== candidate.tarballSha256) {
    issues.push(issue({
      code: 'artifact-tarball-sha-mismatch',
      target: candidate.id,
      message: 'resolved artifact tarball SHA-256 does not match the catalog',
    }))
  }
  const manifestPath = candidate.manifestPath === null
    ? undefined
    : resolveArtifactFile(artifact.packageDir, candidate.manifestPath)
  const manifest = manifestPath === undefined
    ? undefined
    : JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown
  const manifestRecord = recordOrUndefined(manifest)
  if (manifestRecord === undefined) {
    issues.push(issue({
      code: 'artifact-manifest-invalid',
      target: candidate.id,
      message: 'resolved artifact package manifest is missing or invalid',
    }))
    return issues
  }
  if (manifestRecord.name !== candidate.expectedPackage) {
    issues.push(issue({
      code: 'artifact-package-name-mismatch',
      target: candidate.id,
      message: 'resolved artifact package name does not match the catalog',
    }))
  }
  if (manifestRecord.license !== candidate.license) {
    issues.push(issue({
      code: 'artifact-license-mismatch',
      target: candidate.id,
      message: 'resolved artifact license does not match the catalog',
    }))
  }
  const dependencies = observedDependencies(manifestRecord)
  if (!sameStrings(dependencies, candidate.externalDependencies)) {
    issues.push(issue({
      code: 'artifact-dependencies-mismatch',
      target: candidate.id,
      message: 'resolved artifact runtime dependencies do not match the catalog',
    }))
  }
  const scripts = observedInstallScripts(manifestRecord)
  if (!sameStringRecord(scripts, candidate.installScripts)) {
    issues.push(issue({
      code: 'artifact-install-scripts-mismatch',
      target: candidate.id,
      message: 'resolved artifact install lifecycle scripts do not match the catalog',
    }))
  }
  const engines = recordOrUndefined(manifestRecord.engines)
  const observedNodeEngine = optionalString(engines?.node)
  if (observedNodeEngine !== candidate.nodeEngine) {
    issues.push(issue({
      code: 'artifact-node-engine-mismatch',
      target: candidate.id,
      message: 'resolved artifact Node engine range does not match the catalog',
    }))
  }
  if (observedNodeEngine !== undefined && !nodeVersionSatisfies(nodeVersion, observedNodeEngine)) {
    issues.push(issue({
      code: 'artifact-node-incompatible',
      target: candidate.id,
      message: `resolved artifact Node engine range does not support Node ${nodeVersion}`,
    }))
  }
  const dsh = recordOrUndefined(manifestRecord.dsh)
  const bundle = recordOrUndefined(dsh?.bundle)
  const observedPatch = optionalString(bundle?.patch)
  const patchPath = observedPatch === undefined
    ? undefined
    : resolveArtifactFile(artifact.packageDir, observedPatch)
  if (observedPatch !== candidate.bundlePatch || patchPath === undefined || !existsSync(patchPath)) {
    issues.push(issue({
      code: 'artifact-bundle-patch-missing',
      target: candidate.id,
      message: 'resolved artifact bundle patch is missing or differs from the catalog',
    }))
  } else {
    issues.push(...validatePermissionArtifactConfig(candidate, loadPatchEntries(patchPath)))
  }
  if (artifact.changedPaths.some(path => path === 'packages/core' || path.startsWith('packages/core/'))) {
    issues.push(issue({
      code: 'artifact-core-modification',
      target: candidate.id,
      message: 'resolved artifact modifies DeepSeek Harness core paths',
    }))
  }
  return issues
}

function validatePermissionArtifactConfig(
  candidate: CuratedCandidate,
  entries: readonly Record<string, unknown>[],
): CommandIssue[] {
  if (candidate.capability !== PERMISSION_POLICY_CAPABILITY) return []
  const matching = entries.filter(entry =>
    entry.id === PERMISSION_RULES_ENTRY_ID && entry.name === candidate.expectedPackage)
  if (matching.length === 0 || matching[0]?.config === undefined) {
    return [issue({
      code: 'artifact-permission-config-missing',
      target: candidate.id,
      message: 'resolved permission artifact must declare its permission-rules config',
    })]
  }
  if (matching.length !== 1 || recordOrUndefined(matching[0].config) === undefined) {
    return [issue({
      code: 'artifact-permission-config-malformed',
      target: candidate.id,
      message: 'resolved permission artifact permission-rules config must be one map',
    })]
  }

  const config = matching[0].config as Record<string, unknown>
  const issues: CommandIssue[] = []
  if (config.badFilePolicy !== 'fail') {
    issues.push(issue({
      code: 'artifact-permission-bad-file-policy',
      target: candidate.id,
      message: 'resolved permission artifact must fail when its rule file is invalid',
    }))
  }
  if (config.enforce !== true) {
    issues.push(issue({
      code: 'artifact-permission-enforcement-disabled',
      target: candidate.id,
      message: 'resolved permission artifact must explicitly enable enforcement',
    }))
  }
  return issues
}

function resolveArtifactFile(packageDir: string, relativePath: string): string | undefined {
  if (!isSafeRelativeArtifactPath(relativePath)) return undefined
  return resolve(packageDir, relativePath)
}

function isSafeRelativeArtifactPath(path: string): boolean {
  return path.length > 0 && !path.startsWith('/') && !path.split(/[\\/]+/u).includes('..') && !path.includes('\0')
}

function observedDependencies(manifest: Record<string, unknown>): string[] {
  const names = new Set<string>()
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies'] as const) {
    const dependencies = recordOrUndefined(manifest[field])
    if (dependencies === undefined) continue
    for (const name of Object.keys(dependencies)) names.add(name)
  }
  return [...names].sort()
}

function observedInstallScripts(manifest: Record<string, unknown>): Readonly<Record<string, string>> {
  const scripts = recordOrUndefined(manifest.scripts)
  if (scripts === undefined) return {}
  return Object.fromEntries(Object.entries(scripts)
    .filter((entry): entry is [string, string] => INSTALL_SCRIPT_HOOK_PATTERN.test(entry[0]) && typeof entry[1] === 'string')
    .sort(([left], [right]) => left.localeCompare(right)))
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  const sortedRight = [...right].sort()
  return left.length === sortedRight.length && left.every((value, index) => value === sortedRight[index])
}

function sameStringRecord(left: Readonly<Record<string, string>>, right: Readonly<Record<string, string>>): boolean {
  return JSON.stringify(left) === JSON.stringify(Object.fromEntries(Object.entries(right).sort(([a], [b]) => a.localeCompare(b))))
}

function nodeVersionSatisfies(version: string, range: string): boolean {
  const current = parseNodeVersion(version)
  return range.split(/\s*\|\|\s*/u).some((part) => {
    const trimmed = part.trim()
    const match = /^(\^|>=)?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/u.exec(trimmed)
    if (match === null) return false
    const minimum = [Number(match[2]), Number(match[3] ?? 0), Number(match[4] ?? 0)] as const
    const comparison = compareVersion(current, minimum)
    return match[1] === '^' ? current[0] === minimum[0] && comparison >= 0 : comparison >= 0
  })
}

function parseNodeVersion(version: string): readonly [number, number, number] {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/u.exec(version)
  if (match === null) throw new Error(`Node version ${JSON.stringify(version)} is invalid`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function compareVersion(
  left: readonly [number, number, number],
  right: readonly [number, number, number],
): number {
  for (let index = 0; index < left.length; index += 1) {
    const difference = (left[index] as number) - (right[index] as number)
    if (difference !== 0) return difference
  }
  return 0
}

/**
 * Verify curated patch metadata before mounting a profile.
 * @param args - CLI-style arguments; supports `--fixture <path>`, `--profile <id>`, and `--json`.
 * @param options - Optional installed profile root and artifact resolver.
 * @returns captured status and output.
 */
export function runPreflight(args: readonly string[], options: PreflightOptions = {}): CommandResult {
  try {
    const parsed = parseArgs(args)
    const profileRoot = parsed.profileRoot
      ?? (options.profileRoot === undefined ? undefined : exactRoot(options.profileRoot, 'profileRoot'))
    if (parsed.fixture === undefined && profileRoot === undefined) {
      const issues = [issue({
        code: 'preflight-profile-root-required',
        message: 'observed preflight requires an absolute --profile-root',
      })]
      return formatResult({
        command: 'preflight',
        json: parsed.json,
        okText: '',
        failText: `preflight: failed (profile ${parsed.profile}, ${String(issues.length)} issue)\n`,
        payload: {
          command: 'preflight',
          ok: false,
          observed: false,
          accepted: false,
          profile: parsed.profile,
          entryCount: 0,
          issues,
        },
        issues,
      })
    }
    const artifactRoots = [
      ...parsed.artifactRoots,
      ...(options.artifactRoots ?? []).map(root => exactRoot(root, 'artifactRoots')),
    ]
    const resolver = profileRoot === undefined
      ? undefined
      : options.artifactResolver ?? createInstalledArtifactResolver(
        artifactRoots.length === 0 ? [profileRoot] : artifactRoots,
      )
    const installed = profileRoot === undefined
      ? undefined
      : loadInstalledProfileEntries(profileRoot, parsed.profile, resolver)
    const entries = parsed.fixture !== undefined
      ? loadPatchEntries(parsed.fixture)
      : installed?.entries ?? []
    const conflicts = loadCapabilityConflicts(PREFLIGHT_DEFAULT_CONFLICTS)
    const issues = uniqueIssues([
      ...(installed?.issues ?? []),
      ...validatePatchEntries(entries, parsed.profile, conflicts, {
        enforceGovernedCapabilities: parsed.fixture !== undefined,
      }),
    ])

    return formatResult({
      command: 'preflight',
      json: parsed.json,
      okText: `preflight: ok (profile ${parsed.profile}, ${String(entries.length)} entries)\n`,
      failText: `preflight: failed (profile ${parsed.profile}, ${String(entries.length)} entries, ${String(issues.length)} issues)\n`,
      payload: {
        command: 'preflight',
        ok: issues.length === 0,
        observed: installed !== undefined,
        accepted: installed !== undefined && issues.length === 0,
        profile: parsed.profile,
        entryCount: entries.length,
        issues,
      },
      issues,
    })
  } catch (error) {
    return formatThrown('preflight', error, args.includes('--json'))
  }
}

function loadInstalledProfileEntries(
  profileRoot: string,
  profile: string,
  resolver: CuratedArtifactResolver | undefined,
): { readonly entries: readonly Record<string, unknown>[]; readonly issues: readonly CommandIssue[] } {
  const manifest = JSON.parse(readFileSync(join(profileRoot, 'package.json'), 'utf8')) as unknown
  const manifestRecord = requiredRecord(manifest, `profile ${profile} manifest`)
  const dsh = recordOrUndefined(manifestRecord.dsh)
  const profileManifest = recordOrUndefined(dsh?.profile)
  const bundles = profileManifest?.bundles
  if (!Array.isArray(bundles) || bundles.some(bundle => typeof bundle !== 'string' || bundle.length === 0)) {
    throw new Error(`profile ${profile} manifest dsh.profile.bundles must be a string array`)
  }
  const candidates = new Map(loadCuratedCatalog().candidates
    .filter(candidate => candidate.expectedPackage !== null)
    .map(candidate => [candidate.expectedPackage as string, candidate]))
  const entries: Record<string, unknown>[] = []
  const issues: CommandIssue[] = []
  for (const packageName of bundles as string[]) {
    const candidate = candidates.get(packageName)
    const packageDir = candidate === undefined
      ? findCandidatePackageDir(packageName, [profileRoot, dirname(DSH_INSTALL_ANCHOR)])
      : resolver?.resolve(candidate)?.packageDir
    if (packageDir === undefined) {
      issues.push(issue({
        code: 'preflight-bundle-unresolved',
        target: packageName,
        message: 'profile bundle is not installed or resolvable',
      }))
      continue
    }
    const bundleManifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as unknown
    const bundleRecord = requiredRecord(bundleManifest, `${packageName} manifest`)
    const bundleDsh = recordOrUndefined(bundleRecord.dsh)
    const bundle = recordOrUndefined(bundleDsh?.bundle)
    const declaredPatch = optionalString(bundle?.patch)
    const patchPath = declaredPatch === undefined ? undefined : resolveArtifactFile(packageDir, declaredPatch)
    if (patchPath === undefined || !existsSync(patchPath)) {
      issues.push(issue({
        code: 'preflight-bundle-patch-missing',
        target: packageName,
        message: 'installed profile bundle must declare an existing safe patch file',
      }))
      continue
    }
    const patchEntries = loadPatchEntries(patchPath)
    entries.push(...patchEntries)
    if (candidate !== undefined) issues.push(...validatePermissionArtifactConfig(candidate, patchEntries))
  }
  const profilePatch = join(profileRoot, 'cordis.patch.yml')
  if (existsSync(profilePatch)) entries.push(...loadPatchEntries(profilePatch))
  return { entries, issues }
}

/**
 * Smoke a curated profile with staged manifest, bundle, dump-config, and help checks.
 * @param args - CLI-style arguments; supports `--profile <id>` and `--json`.
 * @param options - Optional injected templates and runner for local tests.
 * @returns captured status and output.
 */
export async function runSmokeProfile(args: readonly string[], options: SmokeProfileOptions = {}): Promise<CommandResult> {
  const json = args.includes('--json')
  try {
    const startedAt = performance.now()
    const parsed = parseArgs(args)
    const timeLimitMs = options.timeLimitMs ?? SMOKE_PROFILE_TIME_LIMIT_MS
    const profileRoot = parsed.profileRoot
      ?? (options.profileRoot === undefined ? undefined : exactRoot(options.profileRoot, 'profileRoot'))
    if (profileRoot === undefined && options.runner === undefined) {
      return formatSmokeProfileReport(smokeProfileReport(parsed.profile, timeLimitMs, [], [issue({
        code: 'smoke-profile-profile-root-required',
        message: 'observed smoke requires an absolute --profile-root',
      })], false), parsed.json)
    }
    if (options.prepare !== undefined) {
      const prepared = await settleBeforeDeadline(options.prepare(), startedAt + timeLimitMs)
      if (!prepared) return stagingTimeoutResult(parsed.profile, timeLimitMs, startedAt, profileRoot !== undefined, parsed.json)
    }
    const profiles: Readonly<Record<string, SmokeProfileTemplate>> = options.profiles ?? SMOKE_PROFILE_TEMPLATES
    const template = profiles[parsed.profile]
    if (profileRoot !== undefined && template !== undefined && Array.isArray(template.bundles)) {
      const artifactRoots = [
        ...parsed.artifactRoots,
        ...(options.artifactRoots ?? []).map(root => exactRoot(root, 'artifactRoots')),
      ]
      const inspected = await settleBeforeDeadline(inspectInstalledSmokeProfile(
        profileRoot,
        parsed.profile,
        template.bundles,
        options.artifactResolver ?? createInstalledArtifactResolver(
          artifactRoots.length === 0 ? [profileRoot] : artifactRoots,
        ),
      ), startedAt + timeLimitMs)
      if (!inspected) return stagingTimeoutResult(parsed.profile, timeLimitMs, startedAt, true, parsed.json)
    }
    const runner = options.runner
      ?? createInstalledSmokeProfileRunner(profileRoot as string)
    const report = await createSmokeProfileReport(parsed.profile, {
      profiles,
      runner,
      timeLimitMs,
      artifactRoots: options.artifactRoots ?? [dirname(DSH_INSTALL_ANCHOR)],
    }, startedAt)
    return formatSmokeProfileReport({ ...report, observed: profileRoot !== undefined }, parsed.json)
  } catch (error) {
    return formatThrown('smoke-profile', error, json)
  }
}

/**
 * Compare one provenance-bearing candidate benchmark dataset against its baseline.
 * @param args - CLI-style arguments; supports `--fixture <path>` and `--json`.
 * @returns captured status and output.
 */
export function runCompareBenchmark(args: readonly string[]): CommandResult {
  try {
    const parsed = parseArgs(args)
    const dataset = loadBenchmarkDataset(parsed.fixture ?? COMPARE_BENCHMARK_DEFAULT_FIXTURE)
    if (dataset.pendingCampaigns.length > 0) return formatPendingBenchmark(dataset, parsed.json)
    const comparison = compareBenchmark(dataset)
    return formatBenchmarkComparison(comparison, parsed.json)
  } catch (error) {
    return formatThrown('compare-benchmark', error, args.includes('--json'))
  }
}

/**
 * Create a runner that executes the real `dsh` launcher with a timeout.
 * @param command - Executable to run.
 * @param baseArgs - Arguments placed before the generated CLI flags.
 * @param options - Optional child-process settings.
 * @returns smoke-profile runner for dump-config/help subprocess stages.
 */
export function createSmokeProfileChildRunner(
  command: string,
  baseArgs: readonly string[] = [],
  options: SmokeProfileChildRunnerOptions = {},
): SmokeProfileRunner {
  return (request) => {
    const started = Date.now()
    const args = request.stage === 'dump-config'
      ? [...baseArgs, '--profile', request.profile, '--dump-config']
      : [...baseArgs, '--profile', request.profile, '--help']
    const result = spawnSync(command, args, {
      encoding: 'utf8',
      env: smokeChildEnv(options.env),
      timeout: Math.max(1, Math.floor(request.timeoutMs)),
    })
    const durationMs = Date.now() - started
    const timedOut = result.error instanceof Error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT'
    return Promise.resolve({
      status: timedOut ? 124 : result.status ?? 1,
      stdout: redactSecretText(result.stdout),
      stderr: redactSecretText(result.stderr),
      durationMs,
      ...timedOut ? { timedOut: true } : {},
    })
  }
}

function createInstalledSmokeProfileRunner(profileRoot: string): SmokeProfileRunner {
  const home = dirname(dirname(profileRoot))
  return async (request) => {
    const started = performance.now()
    try {
      loadProfile('smoke-profile', request.profile, DSH_INSTALL_ANCHOR, home, { userLayer: false })
    } catch (error) {
      return {
        status: 1,
        stdout: '',
        stderr: errorMessage(error),
        durationMs: performance.now() - started,
      }
    }
    return createSmokeProfileChildRunner(
      process.execPath,
      ['--import', 'tsx/esm', DSH_SOURCE_BIN],
      { env: { DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' } },
    )(request)
  }
}

function validateSmokeCandidateMetadata(profile: string, packageName: string, candidate: CuratedCandidate): void {
  if (!candidate.active || !candidate.targetProfiles.includes(profile)) {
    throw new Error(`curated smoke bundle ${JSON.stringify(packageName)} must be active for profile ${profile}`)
  }
  if (candidate.manifestPath === null || candidate.bundlePatch === null) {
    throw new Error(`curated smoke bundle ${JSON.stringify(packageName)} must declare package manifest and bundle patch metadata`)
  }
  if (!isSafeRelativeBundlePatch(candidate.bundlePatch)) {
    throw new Error(`curated smoke bundle ${JSON.stringify(packageName)} must declare a safe relative bundle patch path`)
  }
}

function isSafeRelativeBundlePatch(path: string): boolean {
  return path.startsWith('./') && !path.split(/[\\/]+/u).includes('..') && !path.endsWith('/') && !path.includes('\0')
}

function findCandidatePackageDir(packageName: string, artifactRoots: readonly string[]): string | undefined {
  for (const root of artifactRoots) {
    const direct = join(root, 'node_modules', packageName, 'package.json')
    if (existsSync(direct)) return dirname(direct)
    try {
      return dirname(createRequire(join(root, 'package.json')).resolve(`${packageName}/package.json`))
    } catch {
      // Continue through the explicit roots before failing closed.
    }
  }
  return undefined
}

async function validateAndLoadCandidateArtifact(
  packageDir: string,
  packageName: string,
  candidate: CuratedCandidate,
): Promise<void> {
  const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8')) as unknown
  if (!isRecord(manifest) || manifest.name !== packageName) {
    throw new Error(`artifact stage failed for ${JSON.stringify(packageName)}: package name does not match the catalog`)
  }
  const dsh = recordOrUndefined(manifest.dsh)
  const bundle = recordOrUndefined(dsh?.bundle)
  if (bundle?.patch !== candidate.bundlePatch) {
    throw new Error(`artifact stage failed for ${JSON.stringify(packageName)}: bundle patch does not match the catalog`)
  }
  const patchPath = resolve(packageDir, candidate.bundlePatch as string)
  if (!existsSync(patchPath)) {
    throw new Error(`artifact stage failed for ${JSON.stringify(packageName)}: bundle patch is missing`)
  }
  loadPatchEntries(patchPath)
  const main = optionalString(manifest.main)
  if (main === undefined) {
    throw new Error(`artifact stage failed for ${JSON.stringify(packageName)}: package main entry is missing`)
  }
  const mainPath = resolve(packageDir, main)
  if (!existsSync(mainPath)) {
    throw new Error(`artifact stage failed for ${JSON.stringify(packageName)}: package main entry is not built`)
  }
  try {
    await import(`${pathToFileURL(mainPath).href}?curated-smoke=${String(Date.now())}`)
  } catch (error) {
    throw new Error(`artifact stage failed for ${JSON.stringify(packageName)}: module load failed: ${errorMessage(error)}`, {
      cause: error,
    })
  }
}

async function inspectInstalledSmokeProfile(
  profileRoot: string,
  profile: string,
  bundles: readonly string[],
  resolver: CuratedArtifactResolver,
): Promise<void> {
  const manifest = JSON.parse(readFileSync(join(profileRoot, 'package.json'), 'utf8')) as unknown
  const record = requiredRecord(manifest, `profile ${profile} manifest`)
  const dsh = recordOrUndefined(record.dsh)
  const profileManifest = recordOrUndefined(dsh?.profile)
  const installedBundles = profileManifest?.bundles
  if (!Array.isArray(installedBundles) || !sameStrings(installedBundles.filter(item => typeof item === 'string'), bundles)) {
    throw new Error(`installed profile ${profile} bundle list does not match the selected template`)
  }
  const candidates = new Map(loadCuratedCatalog().candidates.map(candidate => [candidate.expectedPackage, candidate]))
  for (const bundle of bundles) {
    const candidate = candidates.get(bundle)
    if (candidate === undefined) continue
    validateSmokeCandidateMetadata(profile, bundle, candidate)
    const artifact = resolver.resolve(candidate)
    if (artifact === undefined) {
      throw new Error(`artifact stage failed for ${JSON.stringify(bundle)}: package is not installed or resolvable`)
    }
    await validateAndLoadCandidateArtifact(artifact.packageDir, bundle, candidate)
  }
}

async function createSmokeProfileReport(
  profile: string,
  options: Required<Pick<SmokeProfileOptions, 'profiles' | 'runner' | 'timeLimitMs' | 'artifactRoots'>>,
  startedAt: number = performance.now(),
): Promise<SmokeProfileReport> {
  const stages: SmokeProfileStageResult[] = []
  const issues: CommandIssue[] = []
  const template = options.profiles[profile]
  const deadline = startedAt + options.timeLimitMs

  if (!isValidProfileName(profile) || template === undefined) {
    issues.push(issue({
      code: 'smoke-profile-profile-invalid',
      target: profile,
      message: 'profile must name a known shipped or curated profile without path separators',
    }))
    return smokeProfileReport(profile, options.timeLimitMs, stages, issues)
  }

  stages.push({ name: 'manifest', ok: true, durationMs: 0 })
  const bundles = Array.isArray(template.bundles) ? template.bundles : []
  const bundleIssues = validateProfileBundles(profile, bundles)
  if (bundleIssues.length > 0) {
    issues.push(...bundleIssues)
    stages.push({
      name: 'bundle-parse',
      ok: false,
      durationMs: 0,
      error: bundleIssues.map(current => current.message).join('; '),
    })
    return smokeProfileReport(profile, options.timeLimitMs, stages, uniqueIssues(issues))
  }

  stages.push({ name: 'bundle-parse', ok: true, durationMs: 0 })
  for (const stage of ['dump-config', 'help'] as const) {
    const timeoutMs = Math.max(0, Math.floor(deadline - performance.now()))
    if (timeoutMs <= 0) {
      const stageIssue = smokeBudgetExhaustedIssue(stage)
      issues.push(stageIssue)
      stages.push({
        name: stage,
        ok: false,
        durationMs: 0,
        error: stageIssue.message,
      })
      break
    }
    const result = await settleRunnerBeforeDeadline(
      options.runner({ stage, profile, bundles, timeoutMs }),
      deadline,
    )
    if (result === undefined) {
      const stageIssue = issue({
        code: 'smoke-profile-command-timeout',
        target: stage,
        message: `smoke-profile budget exhausted during ${stage}`,
      })
      issues.push(stageIssue)
      stages.push({
        name: stage,
        ok: false,
        durationMs: Math.max(0, options.timeLimitMs - sum(stages.map(item => item.durationMs))),
        error: stageIssue.message,
      })
      break
    }
    const stageIssue = smokeStageIssue(stage, result)
    const stageResult = smokeStageResult(stage, result, stageIssue)
    stages.push(stageResult)
    const aggregateIssue = stageIssue === undefined && performance.now() >= deadline
      ? smokeBudgetExhaustedAfterIssue(stage)
      : undefined
    if (aggregateIssue !== undefined) {
      stages[stages.length - 1] = { ...stageResult, ok: false, error: aggregateIssue.message }
      issues.push(aggregateIssue)
      break
    }
    if (stageIssue !== undefined) issues.push(stageIssue)
  }
  return smokeProfileReport(profile, options.timeLimitMs, stages, uniqueIssues(issues))
}

async function settleRunnerBeforeDeadline(
  operation: Promise<SmokeProfileRunnerResult>,
  deadline: number,
): Promise<SmokeProfileRunnerResult | undefined> {
  const remaining = Math.max(0, deadline - performance.now())
  if (remaining <= 0) return undefined
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<undefined>((resolveTimeout) => {
        timer = setTimeout(() => {
          resolveTimeout(undefined)
        }, remaining)
      }),
    ])
  } finally {
    clearTimeout(timer as NodeJS.Timeout)
  }
}

async function settleBeforeDeadline(operation: Promise<void>, deadline: number): Promise<boolean> {
  const remaining = Math.max(0, deadline - performance.now())
  if (remaining <= 0) {
    void operation.catch(() => undefined)
    return false
  }
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      operation.then(() => true),
      new Promise<false>((resolveTimeout) => {
        timer = setTimeout(() => {
          resolveTimeout(false)
        }, remaining)
      }),
    ])
  } finally {
    clearTimeout(timer as NodeJS.Timeout)
  }
}

function stagingTimeoutResult(
  profile: string,
  timeLimitMs: number,
  startedAt: number,
  observed: boolean,
  json: boolean,
): CommandResult {
  const timeoutIssue = issue({
    code: 'smoke-profile-command-timeout',
    target: 'manifest',
    message: 'smoke-profile budget exhausted during staging',
  })
  return formatSmokeProfileReport(smokeProfileReport(profile, timeLimitMs, [{
    name: 'manifest',
    ok: false,
    durationMs: Math.max(0, performance.now() - startedAt),
    error: timeoutIssue.message,
  }], [timeoutIssue], observed), json)
}

function smokeBudgetExhaustedIssue(stage: SmokeProfileChildStage): CommandIssue {
  return issue({
    code: 'smoke-profile-command-timeout',
    target: stage,
    message: `smoke-profile budget exhausted before ${stage}`,
  })
}

function smokeBudgetExhaustedAfterIssue(stage: SmokeProfileChildStage): CommandIssue {
  return issue({
    code: 'smoke-profile-command-timeout',
    target: stage,
    message: `smoke-profile budget exhausted after ${stage}`,
  })
}

function validateProfileBundles(profile: string, bundles: readonly string[]): CommandIssue[] {
  const issues: CommandIssue[] = []
  if (bundles.length === 0) {
    issues.push(issue({
      code: 'smoke-profile-bundle-missing',
      target: profile,
      message: 'profile must declare at least one bundle',
    }))
    return issues
  }
  for (const bundle of bundles) {
    if (bundle === 'dsh-suite' || bundle === '@dsh-suite/all') {
      issues.push(issue({
        code: 'smoke-profile-session-export-all-bundle',
        target: profile,
        message: 'profile must install @dsh-suite/plugin-session-export instead of a session-export all bundle',
      }))
    }
    if (bundle === 'dsh-mcp-manager') {
      issues.push(issue({
        code: 'smoke-profile-plugin-manager-duplicate',
        target: profile,
        message: 'profile must not enable a second plugin manager with dsh-plugin-hub',
      }))
    }
    if (bundle.length === 0) {
      issues.push(issue({
        code: 'smoke-profile-bundle-invalid',
        target: profile,
        message: 'profile bundle names must be non-empty strings',
      }))
    }
  }
  if (bundles.includes('@deepseek-ai/dsh-curated-base')) loadPatchEntries(PREFLIGHT_DEFAULT_PATCH)
  return issues
}

function smokeStageIssue(stage: SmokeProfileChildStage, result: SmokeProfileRunnerResult): CommandIssue | undefined {
  if (result.timedOut === true) {
    return issue({
      code: 'smoke-profile-stage-timeout',
      target: stage,
      message: `stage timed out after ${String(result.durationMs)} ms`,
    })
  }
  if (result.status !== 0) {
    return issue({
      code: 'smoke-profile-stage-failed',
      target: stage,
      message: `stage ${stage} exited with status ${String(result.status)}`,
    })
  }
  return undefined
}

function smokeStageResult(
  stage: SmokeProfileChildStage,
  result: SmokeProfileRunnerResult,
  stageIssue: CommandIssue | undefined,
): SmokeProfileStageResult {
  const error = result.timedOut === true
    ? `stage timed out after ${String(result.durationMs)} ms`
    : stageError(result)
  return {
    name: stage,
    ok: stageIssue === undefined,
    durationMs: result.durationMs,
    status: result.status,
    ...stageIssue === undefined ? {} : { error },
  }
}

function stageError(result: SmokeProfileRunnerResult): string {
  const message = result.stderr.trim() || result.stdout.trim() || `stage exited with status ${String(result.status)}`
  return redactSecretText(message)
}

function smokeProfileReport(
  profile: string,
  timeLimitMs: number,
  stages: readonly SmokeProfileStageResult[],
  issues: readonly CommandIssue[],
  observed = false,
): SmokeProfileReport {
  return {
    command: 'smoke-profile',
    ok: issues.length === 0,
    observed,
    profile,
    timeLimitMs,
    stages,
    issues,
  }
}

function formatSmokeProfileReport(report: SmokeProfileReport, json: boolean): CommandResult {
  const status = report.ok ? 0 : 1
  if (json) return { status, stdout: `${JSON.stringify(report)}\n`, stderr: '' }
  if (report.ok) return { status, stdout: `smoke-profile: ok (profile ${report.profile})\n`, stderr: '' }
  return {
    status,
    stdout: `smoke-profile: failed (profile ${report.profile}, ${String(report.issues.length)} issues)\n`
      + report.issues.map(renderIssue).join(''),
    stderr: '',
  }
}

function isValidProfileName(profile: string): boolean {
  return PROFILE_NAME_PATTERN.test(profile) && profile !== 'node_modules'
}

function loadBenchmarkDataset(path: string): BenchmarkDataset {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (!isRecord(parsed)) throw new Error('benchmark fixture must be a JSON object')
  const evidenceKind = evidenceKindValue(parsed.evidenceKind)
  const pendingCampaigns = optionalUniqueStringArray(parsed.pendingCampaigns, 'pendingCampaigns')
  if (evidenceKind === 'planned' && pendingCampaigns.length === 0) {
    throw new Error('planned benchmark evidence must declare pendingCampaigns')
  }
  const previousSnapshots = requiredRecord(parsed.previousSnapshots, 'previousSnapshots')
  const dataset = {
    evidenceKind,
    pendingCampaigns,
    requiredCriticalTaskIds: evidenceKind === 'planned'
      ? optionalUniqueStringArray(parsed.requiredCriticalTaskIds, 'requiredCriticalTaskIds')
      : requiredUniqueStringArray(parsed.requiredCriticalTaskIds, 'requiredCriticalTaskIds'),
    previousSnapshots: {
      lock: readRollbackSnapshot(previousSnapshots.lock, 'previousSnapshots.lock', 'curated-lock-snapshot'),
      profile: readRollbackSnapshot(previousSnapshots.profile, 'previousSnapshots.profile', 'curated-profile-snapshot'),
    },
    baseline: readBenchmarkProfile(parsed.baseline, 'baseline', pendingCampaigns.length > 0),
    candidate: readBenchmarkProfile(parsed.candidate, 'candidate', pendingCampaigns.length > 0),
  }
  validateComparableProfiles(dataset)
  return dataset
}

function evidenceKindValue(value: unknown): BenchmarkEvidenceKind {
  if (value === 'observed' || value === 'fixture' || value === 'planned') return value
  throw new Error('evidenceKind must be observed, fixture, or planned')
}

function readRollbackSnapshot(
  value: unknown,
  label: string,
  expectedKind: 'curated-lock-snapshot' | 'curated-profile-snapshot',
): BenchmarkRollbackSnapshot {
  const envelope = requiredRecord(value, label)
  const sha256 = requiredString(envelope.sha256, `${label}.sha256`)
  if (!SHA256_PATTERN.test(sha256)) throw new Error(`${label}.sha256 must be a lowercase SHA-256 digest`)
  const snapshot = requiredRecord(envelope.snapshot, `${label}.snapshot`)
  const actualSha256 = createHash('sha256').update(canonicalBenchmarkJson(snapshot)).digest('hex')
  if (actualSha256 !== sha256) throw new Error(`${label}.sha256 does not match its embedded snapshot`)
  if (snapshot.kind !== expectedKind) throw new Error(`${label}.snapshot.kind must be ${expectedKind}`)
  requiredString(snapshot.profile, `${label}.snapshot.profile`)
  if (expectedKind === 'curated-lock-snapshot') {
    if ('catalogRef' in snapshot) throw new Error(`${label}.snapshot must not depend on a mutable catalogRef`)
    const candidates = snapshot.candidates
    if (!Array.isArray(candidates)) throw new Error(`${label}.snapshot.candidates must be an array`)
    for (const [index, candidateValue] of candidates.entries()) {
      const candidate = requiredRecord(candidateValue, `${label}.snapshot.candidates[${String(index)}]`)
      requiredString(candidate.id, `${label}.snapshot.candidates[${String(index)}].id`)
      requiredString(candidate.repository, `${label}.snapshot.candidates[${String(index)}].repository`)
      const commit = requiredString(candidate.commit, `${label}.snapshot.candidates[${String(index)}].commit`)
      if (!/^[0-9a-f]{40}$/u.test(commit)) {
        throw new Error(`${label}.snapshot.candidates[${String(index)}].commit must be a full lowercase Git SHA`)
      }
      requiredString(candidate.expectedPackage, `${label}.snapshot.candidates[${String(index)}].expectedPackage`)
      requiredString(candidate.bundlePatch, `${label}.snapshot.candidates[${String(index)}].bundlePatch`)
      const tarballSha256 = requiredString(
        candidate.tarballSha256,
        `${label}.snapshot.candidates[${String(index)}].tarballSha256`,
      )
      if (!SHA256_PATTERN.test(tarballSha256)) {
        throw new Error(`${label}.snapshot.candidates[${String(index)}].tarballSha256 must be a lowercase SHA-256 digest`)
      }
    }
  } else {
    const bundles = snapshot.bundles
    if (!Array.isArray(bundles) || bundles.some(bundle => typeof bundle !== 'string' || bundle.length === 0)) {
      throw new Error(`${label}.snapshot.bundles must be a string array`)
    }
  }
  return { sha256, snapshot }
}

function readBenchmarkExecution(value: unknown, label: string): BenchmarkExecution {
  const execution = requiredRecord(value, label)
  const startedAt = requiredString(execution.startedAt, `${label}.startedAt`)
  if (!isCanonicalIsoTimestamp(startedAt)) throw new Error(`${label}.startedAt must be a canonical ISO timestamp`)
  return {
    id: requiredString(execution.id, `${label}.id`),
    startedAt,
    environment: readBenchmarkEnvironment(execution.environment, `${label}.environment`),
  }
}

function readBenchmarkEnvironment(value: unknown, label: string): BenchmarkEnvironment {
  const environment = requiredRecord(value, label)
  const expectedKeys = ['model', 'network', 'prompt', 'seed', 'workspace']
  if (JSON.stringify(Object.keys(environment).sort()) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${label} must contain exactly model, prompt, workspace, network, and seed`)
  }
  const seed = environment.seed
  if ((typeof seed !== 'string' || seed.length === 0)
    && (typeof seed !== 'number' || !Number.isSafeInteger(seed))) {
    throw new Error(`${label}.seed must be a non-empty string or safe integer`)
  }
  return {
    model: requiredString(environment.model, `${label}.model`),
    prompt: requiredString(environment.prompt, `${label}.prompt`),
    workspace: requiredString(environment.workspace, `${label}.workspace`),
    network: requiredString(environment.network, `${label}.network`),
    seed,
  }
}

function isCanonicalIsoTimestamp(value: string): boolean {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
}

function validateComparableProfiles(dataset: BenchmarkDataset): void {
  const { baseline, candidate } = dataset
  if (baseline.runs.length === 0 && candidate.runs.length === 0 && dataset.pendingCampaigns.length > 0) return
  if (baseline.execution === undefined || candidate.execution === undefined) {
    throw new Error('benchmark runs require baseline and candidate execution provenance')
  }
  if (canonicalBenchmarkJson(baseline.execution.environment) !== canonicalBenchmarkJson(candidate.execution.environment)) {
    throw new Error('baseline and candidate environments must match exactly')
  }
  const baselineKeys = comparisonKeys(baseline.runs, 'baseline')
  const candidateKeys = comparisonKeys(candidate.runs, 'candidate')
  if (!sameStrings(baselineKeys, candidateKeys)) {
    throw new Error('baseline and candidate comparison keys must match exactly')
  }
  const taskCounts = new Map<string, number>()
  for (const run of baseline.runs) taskCounts.set(run.taskId, (taskCounts.get(run.taskId) ?? 0) + 1)
  for (const [taskId, count] of taskCounts) {
    if (count < 5) throw new Error(`benchmark task ${taskId} must have at least 5 repetitions per profile`)
  }
  for (const taskId of dataset.requiredCriticalTaskIds) {
    const baselineRuns = baseline.runs.filter(run => run.taskId === taskId)
    const candidateRuns = candidate.runs.filter(run => run.taskId === taskId)
    if (baselineRuns.length === 0 || candidateRuns.length === 0) {
      throw new Error(`required critical task ${taskId} is missing from the comparison`)
    }
    if ([...baselineRuns, ...candidateRuns].some(run => !run.critical)) {
      throw new Error(`required critical task ${taskId} must be marked critical in every repetition`)
    }
  }
}

function comparisonKeys(runs: readonly BenchmarkRun[], label: string): string[] {
  const keys = runs.map(run => `${run.taskId}\u0000${String(run.attempt)}`)
  if (new Set(keys).size !== keys.length) throw new Error(`${label}.runs must not repeat a taskId and attempt`)
  return keys.sort()
}

function readBenchmarkProfile(value: unknown, label: string, allowEmptyRuns: boolean): BenchmarkProfile {
  const profile = requiredRecord(value, label)
  const runs = profile.runs
  if (!Array.isArray(runs) || (!allowEmptyRuns && runs.length === 0)) {
    throw new Error(`${label}.runs must be a non-empty array`)
  }
  return {
    profile: requiredString(profile.profile, `${label}.profile`),
    ...allowEmptyRuns && runs.length === 0
      ? {}
      : { execution: readBenchmarkExecution(profile.execution, `${label}.execution`) },
    lockSnapshot: requiredString(profile.lockSnapshot, `${label}.lockSnapshot`),
    profileSnapshot: requiredString(profile.profileSnapshot, `${label}.profileSnapshot`),
    runs: runs.map((run, index) => readBenchmarkRun(run, `${label}.runs[${String(index)}]`)),
  }
}

function readBenchmarkRun(value: unknown, label: string): BenchmarkRun {
  const run = requiredRecord(value, label)
  const failure = nullableString(run.failure, `${label}.failure`)
  if (failure !== null && containsSecretMaterial(failure)) throw new Error(`${label}.failure must not contain secret material`)
  return {
    taskId: requiredString(run.taskId, `${label}.taskId`),
    attempt: positiveSafeIntegerValue(run.attempt, `${label}.attempt`),
    critical: booleanValue(run.critical, `${label}.critical`),
    startupSucceeded: booleanValue(run.startupSucceeded, `${label}.startupSucceeded`),
    dataLossEvents: nonNegativeSafeIntegerValue(run.dataLossEvents, `${label}.dataLossEvents`),
    rollbackSupported: booleanValue(run.rollbackSupported, `${label}.rollbackSupported`),
    success: booleanValue(run.success, `${label}.success`),
    failure,
    quality: scoreValue(run.quality, `${label}.quality`),
    securityCorrectness: scoreValue(run.securityCorrectness, `${label}.securityCorrectness`),
    reliability: scoreValue(run.reliability, `${label}.reliability`),
    performanceCost: scoreValue(run.performanceCost, `${label}.performanceCost`),
    operationExperience: scoreValue(run.operationExperience, `${label}.operationExperience`),
    upgradeCompatibility: scoreValue(run.upgradeCompatibility, `${label}.upgradeCompatibility`),
    firstTokenMs: nonNegativeFiniteValue(run.firstTokenMs, `${label}.firstTokenMs`),
    promptTokens: nonNegativeSafeIntegerValue(run.promptTokens, `${label}.promptTokens`),
    schemaTokens: nonNegativeSafeIntegerValue(run.schemaTokens, `${label}.schemaTokens`),
    costUsd: nonNegativeFiniteValue(run.costUsd, `${label}.costUsd`),
  }
}

function compareBenchmark(dataset: BenchmarkDataset): BenchmarkComparison {
  const baseline = summarizeBenchmarkProfile(dataset.baseline)
  const candidate = summarizeBenchmarkProfile(dataset.candidate)
  const nonCompensableFailures = nonCompensableFailuresFor(dataset.baseline, dataset.candidate)
    .sort((left, right) => left.code.localeCompare(right.code))
  const rollbackReasons = rollbackReasonsFor(dataset.baseline, dataset.candidate)
  const observedStatus = nonCompensableFailures.length > 0
    ? 'rejected'
    : rollbackReasons.length > 0
      ? 'rollback'
      : 'accepted'
  const status = dataset.evidenceKind === 'observed' ? observedStatus : 'unverified'
  return {
    command: 'compare-benchmark',
    evidenceKind: dataset.evidenceKind,
    ok: status === 'accepted',
    status,
    previousSnapshots: dataset.previousSnapshots,
    baseline,
    candidate,
    nonCompensableFailures,
    rollback: {
      required: rollbackReasons.length > 0,
      previousSnapshots: dataset.previousSnapshots,
      reasons: rollbackReasons,
    },
  }
}

function emptyBenchmarkExecution(profile: string): BenchmarkExecution {
  return {
    id: `${profile}-no-runs`,
    startedAt: '1970-01-01T00:00:00.000Z',
    environment: {
      model: 'none',
      prompt: 'none',
      workspace: 'none',
      network: 'none',
      seed: 0,
    },
  }
}

function summarizeBenchmarkProfile(profile: BenchmarkProfile): BenchmarkProfileSummary {
  const successRate = percent(profile.runs.filter(run => run.success).length, profile.runs.length)
  const criticalRuns = profile.runs.filter(run => run.critical)
  const criticalSuccessRate = percent(criticalRuns.filter(run => run.success).length, criticalRuns.length)
  const startupFailureRate = percent(profile.runs.filter(run => !run.startupSucceeded).length, profile.runs.length)
  const securityCorrectness = mean(profile.runs.map(run => run.securityCorrectness))
  const weightedScore = round1(
    successRate * BENCHMARK_WEIGHTS.taskSuccess
    + metricMean(profile.runs, 'quality') * BENCHMARK_WEIGHTS.quality
    + securityCorrectness * BENCHMARK_WEIGHTS.securityCorrectness
    + metricMean(profile.runs, 'reliability') * BENCHMARK_WEIGHTS.reliability
    + metricMean(profile.runs, 'performanceCost') * BENCHMARK_WEIGHTS.performanceCost
    + metricMean(profile.runs, 'operationExperience') * BENCHMARK_WEIGHTS.operationExperience
    + metricMean(profile.runs, 'upgradeCompatibility') * BENCHMARK_WEIGHTS.upgradeCompatibility,
  )
  return {
    profile: profile.profile,
    execution: profile.execution ?? emptyBenchmarkExecution(profile.profile),
    lockSnapshot: profile.lockSnapshot,
    profileSnapshot: profile.profileSnapshot,
    successRate,
    criticalSuccessRate,
    startupFailureRate,
    securityCorrectness: round3(securityCorrectness),
    dataLossEvents: sum(profile.runs.map(run => run.dataLossEvents)),
    rollbackPossible: profile.runs.every(run => run.rollbackSupported),
    statistics: {
      firstTokenMs: statistic(profile.runs.map(run => run.firstTokenMs)),
      promptSchemaTokens: statistic(profile.runs.map(run => run.promptTokens + run.schemaTokens)),
      costUsd: statistic(profile.runs.map(run => run.costUsd)),
    },
    failureDistribution: failureDistribution(profile.runs),
    weightedScore,
  }
}

function nonCompensableFailuresFor(
  baseline: BenchmarkProfile,
  candidate: BenchmarkProfile,
): BenchmarkGateFailure[] {
  const failures: BenchmarkGateFailure[] = []
  const candidateSecurityCorrectness = mean(candidate.runs.map(run => run.securityCorrectness))
  const candidateStartupFailureRate = rawPercent(candidate.runs.filter(run => !run.startupSucceeded).length, candidate.runs.length)
  const baselineCriticalRuns = baseline.runs.filter(run => run.critical)
  const candidateCriticalRuns = candidate.runs.filter(run => run.critical)
  const baselineCriticalSuccessRate = rawPercent(
    baselineCriticalRuns.filter(run => run.success).length,
    baselineCriticalRuns.length,
  )
  const candidateCriticalSuccessRate = rawPercent(
    candidateCriticalRuns.filter(run => run.success).length,
    candidateCriticalRuns.length,
  )
  if (candidateSecurityCorrectness < 95) {
    failures.push(benchmarkFailure('security-correctness-below-95', 'security correctness fell below 95%'))
  }
  if (sum(candidate.runs.map(run => run.dataLossEvents)) > 0) {
    failures.push(benchmarkFailure('data-loss-detected', 'data loss events must be zero'))
  }
  if (!candidate.runs.every(run => run.rollbackSupported)) {
    failures.push(benchmarkFailure('rollback-impossible', 'candidate must support rollback'))
  }
  if (candidateStartupFailureRate > 1) {
    failures.push(benchmarkFailure('startup-failure-rate-above-1', 'startup failure rate exceeded 1%'))
  }
  if (baselineCriticalSuccessRate - candidateCriticalSuccessRate > 3) {
    failures.push(benchmarkFailure('critical-success-rate-drop', 'critical task success dropped by more than 3 percentage points'))
  }
  return failures
}

function rollbackReasonsFor(baseline: BenchmarkProfile, candidate: BenchmarkProfile): BenchmarkGateFailure[] {
  const reasons: BenchmarkGateFailure[] = []
  if (relativeIncrease(
    percentile(baseline.runs.map(run => run.firstTokenMs), 0.95),
    percentile(candidate.runs.map(run => run.firstTokenMs), 0.95),
  ) > 0.15) {
    reasons.push(benchmarkFailure('first-token-p95-regression', 'first-token P95 increased by more than 15%'))
  }
  if (relativeIncrease(
    mean(baseline.runs.map(run => run.promptTokens + run.schemaTokens)),
    mean(candidate.runs.map(run => run.promptTokens + run.schemaTokens)),
  ) > 0.20) {
    reasons.push(benchmarkFailure('prompt-schema-token-regression', 'prompt and schema tokens increased by more than 20%'))
  }
  const baselineSuccessRate = rawPercent(baseline.runs.filter(run => run.success).length, baseline.runs.length)
  const candidateSuccessRate = rawPercent(candidate.runs.filter(run => run.success).length, candidate.runs.length)
  if (relativeIncrease(
    mean(baseline.runs.map(run => run.costUsd)),
    mean(candidate.runs.map(run => run.costUsd)),
  ) > 0.20 && candidateSuccessRate - baselineSuccessRate < 3) {
    reasons.push(benchmarkFailure(
      'cost-regression-without-success-gain',
      'cost increased by more than 20% while success gain stayed below 3 percentage points',
    ))
  }
  return reasons
}

function formatBenchmarkComparison(comparison: BenchmarkComparison, json: boolean): CommandResult {
  const status = comparison.status === 'accepted' ? 0 : 1
  if (json) return { status, stdout: `${JSON.stringify(comparison)}\n`, stderr: '' }
  if (comparison.status === 'unverified') {
    return {
      status,
      stdout: `compare-benchmark: unverified (${comparison.evidenceKind} evidence cannot be accepted)\n`,
      stderr: '',
    }
  }
  if (comparison.status === 'accepted') {
    return {
      status,
      stdout: `compare-benchmark: accepted (${comparison.candidate.profile}, score ${String(comparison.candidate.weightedScore)})\n`,
      stderr: '',
    }
  }
  const failures = comparison.nonCompensableFailures.length > 0
    ? comparison.nonCompensableFailures
    : comparison.rollback.reasons
  return {
    status,
    stdout: `compare-benchmark: ${comparison.status} (${comparison.candidate.profile}, ${String(failures.length)} issues)\n`
      + failures.map(failure => `${failure.code}: ${failure.message}\n`).join(''),
    stderr: '',
  }
}

function formatPendingBenchmark(dataset: BenchmarkDataset, json: boolean): CommandResult {
  const payload = {
    command: 'compare-benchmark',
    evidenceKind: dataset.evidenceKind,
    ok: false,
    status: 'pending',
    pendingCampaigns: dataset.pendingCampaigns,
    previousSnapshots: dataset.previousSnapshots,
    baseline: { profile: dataset.baseline.profile },
    candidate: { profile: dataset.candidate.profile },
  }
  if (json) return { status: 1, stdout: `${JSON.stringify(payload)}\n`, stderr: '' }
  return {
    status: 1,
    stdout: `compare-benchmark: pending (${String(dataset.pendingCampaigns.length)} campaigns)\n`,
    stderr: '',
  }
}

function metricMean(runs: readonly BenchmarkRun[], metric: BenchmarkMetric): number {
  return mean(runs.map(run => run[metric]))
}

function statistic(values: readonly number[]): BenchmarkStatistic {
  return {
    mean: round3(mean(values)),
    p50: round3(percentile(values, 0.50)),
    p95: round3(percentile(values, 0.95)),
  }
}

function percentile(values: readonly number[], quantile: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.max(0, Math.ceil(quantile * sorted.length) - 1)
  return sorted[index] as number
}

function failureDistribution(runs: readonly BenchmarkRun[]): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const run of runs) {
    if (run.success || run.failure === null) continue
    counts[run.failure] = (counts[run.failure] ?? 0) + 1
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)))
}

function benchmarkFailure(code: string, message: string): BenchmarkGateFailure {
  return { code, message: redactSecretText(message) }
}

function relativeIncrease(baseline: number, candidate: number): number {
  if (baseline <= 0) return candidate > 0 ? Number.POSITIVE_INFINITY : 0
  return (candidate - baseline) / baseline
}

function percent(count: number, total: number): number {
  return round3(rawPercent(count, total))
}

function rawPercent(count: number, total: number): number {
  return (count / total) * 100
}

function mean(values: readonly number[]): number {
  return sum(values) / values.length
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

function round1(value: number): number {
  return Number(value.toFixed(1))
}

function round3(value: number): number {
  return Number(value.toFixed(3))
}

function parseArgs(args: readonly string[]): ParsedArgs {
  const artifactRoots: string[] = []
  let fixture: string | undefined
  let json = false
  let profile = DEFAULT_PROFILE
  let profileRoot: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index] as string
    if (arg === '--json') {
      json = true
      continue
    }
    if (arg === '--fixture') {
      fixture = requiredArg(args, index, arg)
      index += 1
      continue
    }
    if (arg === '--artifact-root') {
      artifactRoots.push(exactRoot(requiredArg(args, index, arg), arg))
      index += 1
      continue
    }
    if (arg.startsWith('--artifact-root=')) {
      artifactRoots.push(exactRoot(arg.slice('--artifact-root='.length), '--artifact-root'))
      continue
    }
    if (arg === '--profile-root') {
      profileRoot = exactRoot(requiredArg(args, index, arg), arg)
      index += 1
      continue
    }
    if (arg.startsWith('--profile-root=')) {
      profileRoot = exactRoot(arg.slice('--profile-root='.length), '--profile-root')
      continue
    }
    if (arg.startsWith('--fixture=')) {
      fixture = arg.slice('--fixture='.length)
      continue
    }
    if (arg === '--profile') {
      profile = requiredArg(args, index, arg)
      index += 1
      continue
    }
    if (arg.startsWith('--profile=')) {
      profile = arg.slice('--profile='.length)
      continue
    }
    throw new Error(`unsupported argument ${redactSecretText(arg)}`)
  }

  if (profile.length === 0) throw new Error('profile must be a non-empty string')
  return {
    artifactRoots,
    ...fixture === undefined ? {} : { fixture },
    json,
    profile,
    ...profileRoot === undefined ? {} : { profileRoot },
  }
}

function exactRoot(value: string, flag: string): string {
  if (value.length === 0) throw new Error(`${flag} requires a value`)
  if (!isAbsolute(value)) throw new Error(`${flag} must be an absolute path`)
  return value
}

function requiredArg(args: readonly string[], index: number, flag: string): string {
  const value = args[index + 1]
  if (value === undefined || value.length === 0) throw new Error(`${flag} requires a value`)
  return value
}

function loadYamlFile(path: string, label: string): unknown {
  try {
    return loadYaml(readFileSync(path, 'utf8'), { schema: entryListSchema })
  } catch (error) {
    throw new Error(`${label} cannot be loaded: ${errorMessage(error)}`, { cause: error })
  }
}

function profileConflictIssues(catalog: CuratedCatalog): CommandIssue[] {
  const profiles = new Set(catalog.candidates.flatMap(candidate => candidate.targetProfiles))
  return [...profiles].flatMap(profile => validateProfileConflicts(catalog, profile).map(issueFromPolicy))
}

function validateAuditCompleteness(catalog: CuratedCatalog, rawCatalog: unknown): CommandIssue[] {
  const issues: CommandIssue[] = []
  const rawCandidates = rawCandidateRecords(rawCatalog)

  if (containsSecretMaterial(rawCatalog)) {
    issues.push(issue({
      code: 'catalog-secret-material',
      message: 'curated catalog must not contain secret material',
    }))
  }

  for (const [index, candidate] of catalog.candidates.entries()) {
    const rawCandidate = rawCandidates[index]
    if (rawCandidate !== undefined && containsSecretMaterial(rawCandidate)) {
      issues.push(issue({
        code: 'candidate-secret-material',
        target: candidate.id,
        message: 'candidate fields must not contain secret material',
      }))
    }
    if (!candidate.active) continue
    if (rawCandidate?.score === undefined) {
      issues.push(issue({
        code: 'candidate-score-missing',
        target: candidate.id,
        message: 'active candidate must declare a static admission score',
      }))
    } else if (classifyAdmission(candidate.score) === 'experimental' || classifyAdmission(candidate.score) === 'rejected') {
      issues.push(issue({
        code: 'candidate-score-too-low',
        target: candidate.id,
        message: 'active candidate score must reach the scenario admission tier',
      }))
    }
    if (unsafeInstallScripts(candidate.installScripts).length > 0) {
      issues.push(issue({
        code: 'candidate-install-script-unsafe',
        target: candidate.id,
        message: 'active candidate install lifecycle scripts must not fetch network resources or write system paths',
      }))
    }
    if (candidate.license === null) {
      issues.push(issue({
        code: 'candidate-license-missing',
        target: candidate.id,
        message: 'active candidate must declare a license',
      }))
    }
    if (candidate.expectedPackage === null || candidate.manifestPath === null) {
      issues.push(issue({
        code: 'candidate-package-missing',
        target: candidate.id,
        message: 'active candidate must declare package manifest metadata',
      }))
    }
    if (candidate.bundlePatch === null) {
      issues.push(issue({
        code: 'candidate-bundle-patch-missing',
        target: candidate.id,
        message: 'active candidate must declare a bundle patch',
      }))
    }
    if (candidate.tarballSha256 !== undefined && !SHA256_PATTERN.test(candidate.tarballSha256)) {
      issues.push(issue({
        code: 'candidate-tarball-sha-invalid',
        target: candidate.id,
        message: 'candidate tarball SHA-256 digest must be lowercase hex',
      }))
    }
    if (rawCandidate !== undefined && candidateDeclaresTarballWithoutSha(rawCandidate)) {
      issues.push(issue({
        code: 'candidate-tarball-sha-missing',
        target: candidate.id,
        message: 'candidate tarball metadata must include a SHA-256 digest',
      }))
    }
  }

  return issues
}

function unsafeInstallScripts(scripts: Readonly<Record<string, string>>): string[] {
  return Object.entries(scripts)
    .filter(([name, script]) => INSTALL_SCRIPT_HOOK_PATTERN.test(name) && UNSAFE_INSTALL_SCRIPT_PATTERN.test(script))
    .map(([name]) => name)
}

function rawCandidateRecords(rawCatalog: unknown): readonly Record<string, unknown>[] {
  return (rawCatalog as { candidates: readonly unknown[] }).candidates.filter(isRecord)
}

function candidateDeclaresTarballWithoutSha(candidate: Record<string, unknown>): boolean {
  if (candidate.tarballSha256 !== undefined) return false
  if (candidate.tarball === undefined) return true
  const tarball = candidate.tarball
  if (isRecord(tarball) && typeof tarball.sha256 === 'string' && SHA256_PATTERN.test(tarball.sha256)) return false
  return true
}

function loadPatchEntries(path: string): Record<string, unknown>[] {
  const parsed = loadYamlFile(path, 'curated patch')
  if (!Array.isArray(parsed)) throw new Error('curated patch must be a top-level YAML array')
  return flattenPatchEntries(parsed)
}

function flattenPatchEntries(items: readonly unknown[]): Record<string, unknown>[] {
  const entries: Record<string, unknown>[] = []
  for (const item of items) {
    if (!isRecord(item)) continue
    const entry = item as EntryRecord
    if (Array.isArray(entry.insert)) entries.push(...flattenPatchEntries(entry.insert))
    if (entry.name !== undefined || entry.config !== undefined || (entry.id !== undefined && entry.insert === undefined)) {
      entries.push(item)
    }
  }
  return entries
}

function validatePatchEntries(
  entries: readonly Record<string, unknown>[],
  profile: string,
  conflicts: CapabilityConflictCatalog,
  options: { readonly enforceGovernedCapabilities: boolean } = { enforceGovernedCapabilities: true },
): CommandIssue[] {
  const issues: CommandIssue[] = []
  const activeEntries: CuratedEntry[] = []
  const seenEntryIds = new Set<string>()

  for (const entry of effectivePatchEntries(entries)) {
    const entryId = optionalString(entry.id)
    if (entryId !== undefined) {
      if (seenEntryIds.has(entryId)) {
        issues.push(issue({
          code: 'preflight-entry-id-duplicate',
          target: entryId,
          message: 'curated patch contains duplicate entry ids',
        }))
      }
      seenEntryIds.add(entryId)
    }
    if (entry.config !== undefined && containsSecretMaterial(entry.config)) {
      issues.push(issueWithTarget({
        code: 'preflight-config-secret',
        target: entryId ?? optionalString(entry.name),
        message: 'entry config must not contain secret material',
        details: { config: entry.config },
      }))
    }
    issues.push(...dataBoundaryIssues(entry.config, entryId ?? optionalString(entry.name)))
    issues.push(...baselineCandidateConfigIssues(entryId, entry.config))

    const curated = readCuratedEntry(entry)
    issues.push(...curated.issues)
    if (curated.entry?.profile === profile && curated.entry.active) activeEntries.push(curated.entry)
  }

  issues.push(...validateActiveEntries(activeEntries, conflicts, options))
  return issues
}

function effectivePatchEntries(entries: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const effective: Record<string, unknown>[] = []
  const entryIndexes = new Map<string, number>()
  for (const entry of entries) {
    const entryId = optionalString(entry.id)
    const previousIndex = entryId === undefined ? undefined : entryIndexes.get(entryId)
    const previous = previousIndex === undefined ? undefined : effective[previousIndex]
    if (
      previousIndex !== undefined
      && previous !== undefined
      && optionalString(previous.name) !== undefined
      && optionalString(entry.name) === undefined
      && entry.config !== undefined
    ) {
      effective[previousIndex] = { ...previous, ...entry }
      continue
    }
    if (entryId !== undefined && !entryIndexes.has(entryId)) entryIndexes.set(entryId, effective.length)
    effective.push(entry)
  }
  return effective
}

function baselineCandidateConfigIssues(entryId: string | undefined, value: unknown): CommandIssue[] {
  const config = recordOrUndefined(value)
  if (entryId === 'memento') {
    const proposals = recordOrUndefined(config?.proposals)
    const writePolicies = recordOrUndefined(config?.writePolicies)
    return [
      ...proposals?.enabled === false ? [] : [issue({
        code: 'preflight-memory-auto-proposals',
        target: entryId,
        message: 'memory config must disable automatic proposal capture',
      })],
      ...writePolicies !== undefined && Object.keys(writePolicies).length === 0 ? [] : [issue({
        code: 'preflight-memory-write-overrides',
        target: entryId,
        message: 'memory config must not override approval-gated writes',
      })],
      ...config?.writePolicy === 'ask' ? [] : [issue({
        code: 'preflight-memory-write-policy',
        target: entryId,
        message: 'memory writes must require approval',
      })],
    ]
  }
  if (entryId === 'permission-rules') {
    return [
      ...config?.badFilePolicy === 'fail' ? [] : [issue({
        code: 'preflight-permission-bad-file-policy',
        target: entryId,
        message: 'permission rules must fail when their rule file is invalid',
      })],
      ...config?.enforce === true ? [] : [issue({
        code: 'preflight-permission-enforcement-disabled',
        target: entryId,
        message: 'permission rules must explicitly enable enforcement',
      })],
    ]
  }
  if (entryId === 'loongsuite-observability' && config?.captureContent !== false) {
    return [issue({
      code: 'preflight-otel-capture-content',
      target: entryId,
      message: 'OTel config must explicitly disable content capture',
    })]
  }
  return []
}

function readCuratedEntry(entry: Record<string, unknown>): CuratedEntryReadResult {
  const config = recordOrUndefined(entry.config)
  const curated = recordOrUndefined(config?.curated)
  if (curated === undefined) return { issues: [] }

  const entryId = optionalString(entry.id)
  const pluginName = optionalString(entry.name)
  const fallbackTarget = pluginName ?? entryId
  const candidateId = optionalString(curated.candidateId) ?? fallbackTarget
  const issues = [
    ...unknownKeys(curated, CURATED_METADATA_FIELDS, 'preflight-curated-key-unknown', 'curated metadata contains'),
    ...unknownKeys(
      recordOrUndefined(curated.resources),
      CURATED_RESOURCE_FIELDS,
      'preflight-curated-resource-key-unknown',
      'curated resources contain',
    ),
  ]
  if (curated.active === undefined || curated.active === false) return { issues }
  if (curated.active !== true) {
    return {
      issues: [...issues, issueWithTarget({
        code: 'preflight-curated-active-invalid',
        target: candidateId,
        message: 'curated.active must be true or false when present',
      })],
    }
  }

  const profile = curated.profile === undefined ? DEFAULT_PROFILE : optionalString(curated.profile)
  const capability = optionalString(curated.capability)

  if (curated.candidateId !== undefined && optionalString(curated.candidateId) === undefined) {
    issues.push(issueWithTarget({
      code: 'preflight-curated-candidate-id-invalid',
      target: fallbackTarget,
      message: 'active curated candidateId must be a non-empty string',
    }))
  }
  if (candidateId === undefined) {
    issues.push(issue({
      code: 'preflight-curated-candidate-id-missing',
      message: 'active curated entry must declare candidateId or have a string entry id/name fallback',
    }))
  }
  if (profile === undefined) {
    issues.push(issueWithTarget({
      code: 'preflight-curated-profile-invalid',
      target: candidateId ?? fallbackTarget,
      message: 'active curated profile must be a non-empty string',
    }))
  }
  if (capability === undefined) {
    issues.push(issueWithTarget({
      code: 'preflight-curated-capability-missing',
      target: candidateId ?? fallbackTarget,
      message: 'active curated entry must declare a capability',
    }))
  }

  const resources = readResources(curated.resources, candidateId ?? fallbackTarget)
  issues.push(...resources.issues)
  if (candidateId === undefined || profile === undefined || capability === undefined || issues.length > 0) return { issues }

  return {
    entry: {
      ...entryId === undefined ? {} : { entryId },
      ...pluginName === undefined ? {} : { pluginName },
      candidateId,
      profile,
      active: true,
      capability,
      resources: resources.value,
    },
    issues: [],
  }
}

function readResources(
  value: unknown,
  target: string | undefined,
): { readonly value: CuratedCandidateResources; readonly issues: readonly CommandIssue[] } {
  const issues: CommandIssue[] = []
  const record = recordOrUndefined(value)
  if (value !== undefined && record === undefined) {
    issues.push(issueWithTarget({
      code: 'preflight-curated-resources-invalid',
      target,
      message: 'active curated resources must be a map',
    }))
    return { value: {}, issues }
  }
  if (record === undefined) return { value: {}, issues }
  const resources: Partial<Record<ResourceField, string[]>> = {}
  for (const field of CURATED_RESOURCE_FIELDS) {
    const list = record[field]
    if (list === undefined) continue
    if (!Array.isArray(list)) {
      issues.push(issueWithTarget({
        code: 'preflight-curated-resource-list-invalid',
        target,
        message: `active curated resources.${field} must be a list of non-empty strings`,
      }))
      continue
    }
    const strings: string[] = []
    for (const [index, item] of list.entries()) {
      if (typeof item !== 'string' || item.length === 0) {
        issues.push(issueWithTarget({
          code: 'preflight-curated-resource-value-invalid',
          target,
          message: `active curated resources.${field}[${String(index)}] must be a non-empty string`,
        }))
        continue
      }
      strings.push(item)
    }
    if (strings.length > 0) resources[field] = strings
  }
  return { value: resources, issues }
}

function validateActiveEntries(
  entries: readonly CuratedEntry[],
  conflicts: CapabilityConflictCatalog,
  options: { readonly enforceGovernedCapabilities: boolean },
): CommandIssue[] {
  const issues: CommandIssue[] = []
  const providers = new Map<string, string>()
  const resources = new Map<string, string>()
  const governedCapabilities = new Set(conflicts.rules.map(rule => rule.capability))

  for (const entry of entries) {
    const conflictRule = conflicts.rules.find(rule =>
      rule.defaultProvider === entry.candidateId || rule.fallbacks.includes(entry.candidateId))
    const capability = conflictRule?.capability ?? entry.capability
    if (options.enforceGovernedCapabilities && conflictRule === undefined && !governedCapabilities.has(entry.capability)) {
      issues.push(issue({
        code: 'preflight-capability-unmanaged',
        target: entry.candidateId,
        message: 'active curated entry names a capability outside capability-conflicts policy',
      }))
    }
    const providerKey = `${entry.profile}\u0000${capability}`
    if (providers.has(providerKey)) {
      const previous = providers.get(providerKey) as string
      issues.push(issue({
        code: 'preflight-provider-duplicate',
        target: entry.candidateId,
        message: `profile ${entry.profile} capability ${capability} has multiple active candidates: ${previous}, ${entry.candidateId}`,
        details: { profile: entry.profile, capability, candidates: [previous, entry.candidateId] },
      }))
    } else {
      providers.set(providerKey, entry.candidateId)
    }

    for (const field of RESOURCE_FIELDS) {
      const values = entry.resources[field]
      if (values === undefined) continue
      for (const value of values) {
        if (field === 'waterfallListeners' && !WATERFALL_LISTENER_PATTERN.test(value)) {
          issues.push(issue({
            code: 'preflight-waterfall-next-missing',
            target: entry.candidateId,
            message: 'waterfall listeners must declare next() delegation',
          }))
        }
        const resourceKey = `${field}\u0000${value}`
        if (resources.has(resourceKey)) {
          issues.push(issue({
            code: RESOURCE_DUPLICATE_CODES[field],
            target: entry.candidateId,
            message: `active curated entries claim the same ${resourceLabel(field)} (${duplicateSummary(field)})`,
          }))
        } else {
          resources.set(resourceKey, entry.candidateId)
        }
      }
    }
  }

  return issues
}

function unknownKeys(
  record: Record<string, unknown> | undefined,
  allowed: readonly string[],
  code: string,
  messagePrefix: string,
): CommandIssue[] {
  if (record === undefined) return []
  const allowedKeys = new Set(allowed)
  return Object.keys(record)
    .filter(key => !allowedKeys.has(key))
    .map(key => issue({
      code,
      message: `${messagePrefix} unknown key ${redactSecretText(key)}`,
    }))
}

function resourceLabel(field: ConflictResourceField): string {
  return RESOURCE_LABELS[field]
}

function duplicateSummary(field: ConflictResourceField): string {
  return field === 'toolNames' ? 'duplicate tool' : `duplicate ${resourceLabel(field)}`
}

function catalogForLockValidation(catalog: CuratedCatalog): CuratedCatalog {
  return {
    ...catalog,
    candidates: catalog.candidates.map(candidate => ({
      ...candidate,
      credentials: [],
    })),
  }
}

function issueFromPolicy(input: PolicyIssue): CommandIssue {
  return issueWithTarget({
    code: input.code,
    target: input.candidateId ?? input.profileId,
    message: input.message,
    details: input.details,
  })
}

function issueWithTarget(input: {
  readonly code: string
  readonly target: string | undefined
  readonly message: string
  readonly details?: unknown
}): CommandIssue {
  if (input.target === undefined) return issue({ code: input.code, message: input.message, details: input.details })
  return issue({
    code: input.code,
    target: input.target,
    message: input.message,
    details: input.details,
  })
}

function issue(input: {
  readonly code: string
  readonly target?: string
  readonly message: string
  readonly details?: unknown
}): CommandIssue {
  return {
    code: input.code,
    ...input.target === undefined ? {} : { target: redactSecretText(input.target) },
    message: redactSecretText(input.message),
    ...input.details === undefined ? {} : { details: redactCommandDetails(input.details) },
  }
}

function redactCommandDetails(value: unknown): unknown {
  if (typeof value === 'string') return redactSecretText(value)
  if (Array.isArray(value)) return value.map(item => redactCommandDetails(item))
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SECRET_KEY_PATTERN.test(key) ? REDACTED : redactCommandDetails(item),
  ]))
}

function uniqueIssues(issues: readonly CommandIssue[]): CommandIssue[] {
  const seen = new Set<string>()
  const unique: CommandIssue[] = []
  for (const current of issues) {
    const key = `${current.code}\u0000${current.target ?? ''}\u0000${current.message}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(current)
  }
  return unique.sort((left, right) =>
    (left.code + '\u0000' + (left.target ?? '') + '\u0000' + left.message)
      .localeCompare(right.code + '\u0000' + (right.target ?? '') + '\u0000' + right.message),
  )
}

function formatResult(input: {
  readonly command: string
  readonly json: boolean
  readonly okText: string
  readonly failText: string
  readonly payload: object
  readonly issues: readonly CommandIssue[]
}): CommandResult {
  const status = input.issues.length === 0 ? 0 : 1
  if (input.json) return { status, stdout: `${JSON.stringify(input.payload)}\n`, stderr: '' }
  if (status === 0) return { status, stdout: input.okText, stderr: '' }
  return {
    status,
    stdout: input.failText + input.issues.map(renderIssue).join(''),
    stderr: '',
  }
}

function formatThrown(command: string, error: unknown, json: boolean): CommandResult {
  const issues = [issue({
    code: `${command}-input-invalid`,
    message: errorMessage(error),
  })]
  const payload = { command, ok: false, issues }
  if (json) return { status: 1, stdout: `${JSON.stringify(payload)}\n`, stderr: '' }
  return {
    status: 1,
    stdout: `${command}: failed (${String(issues.length)} issue)\n${issues.map(renderIssue).join('')}`,
    stderr: '',
  }
}

function renderIssue(issue: CommandIssue): string {
  const target = issue.target === undefined ? '' : ` ${issue.target}`
  return `${issue.code}${target}: ${issue.message}\n`
}

function dataBoundaryIssues(value: unknown, target: string | undefined): CommandIssue[] {
  const issues: CommandIssue[] = []
  visitDataBoundary(value, (key, item) => {
    if (key === 'captureBody' && item === true) {
      issues.push(issueWithTarget({
        code: 'preflight-otel-capture-body',
        target,
        message: 'OTel config must keep captureBody false by default',
      }))
    }
    if (key === 'importMode' && typeof item === 'string' && item !== 'dry-run') {
      issues.push(issueWithTarget({
        code: 'preflight-config-import-not-dry-run',
        target,
        message: 'config import must default to dry-run',
      }))
    }
    if ((key === 'sessionsWrite' || key === 'writeSessions') && item === true) {
      issues.push(issueWithTarget({
        code: 'preflight-session-write',
        target,
        message: 'config import must not write sessions by default',
      }))
    }
    if ((key === 'egressBody' || key === 'bodyEgress' || key === 'externalBodyEgress') && item === true) {
      issues.push(issueWithTarget({
        code: 'preflight-external-body-egress',
        target,
        message: 'external systems must not egress full body content by default',
      }))
    }
  })
  return uniqueIssues(issues)
}

function visitDataBoundary(value: unknown, onEntry: (key: string, value: unknown) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) visitDataBoundary(item, onEntry)
    return
  }
  if (!isRecord(value)) return
  for (const [key, item] of Object.entries(value)) {
    onEntry(key, item)
    visitDataBoundary(item, onEntry)
  }
}

function containsSecretMaterial(value: unknown): boolean {
  if (typeof value === 'string') return SECRET_VALUE_PATTERN.test(value)
  if (Array.isArray(value)) return value.some(item => containsSecretMaterial(item))
  if (!isRecord(value)) return false
  return Object.entries(value).some(([key, item]) => containsSecretMaterialForKey(key, item))
}

function containsSecretMaterialForKey(key: string, value: unknown): boolean {
  if (key === 'credentials') return containsSecretMaterial(value)
  if (SECRET_KEY_PATTERN.test(key)) {
    if (typeof value === 'string') return value.length > 0
    if (Array.isArray(value)) return value.length > 0
    if (isRecord(value)) return Object.keys(value).length > 0
  }
  return containsSecretMaterial(value)
}

function redactSecretText(value: string | undefined): string {
  return (value ?? '')
    .replace(/((?:--)?(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|secret|token)=)([^\s]+)/giu, `$1${REDACTED}`)
    .replace(SECRET_VALUE_REPLACEMENT_PATTERN, REDACTED)
}

function smokeChildEnv(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const env = scrubbedParentEnv()
  for (const [key, value] of Object.entries(overrides ?? {})) {
    if (value === undefined) continue
    if (SECRET_KEY_PATTERN.test(key)) continue
    if (key.startsWith('DSH_') && key !== 'DSH_HOME' && key !== 'DSH_TELEMETRY_DISABLED') continue
    env[key] = value
  }
  return env
}

function errorMessage(error: unknown): string {
  return redactSecretText(error instanceof Error ? error.message : String(error))
}

function recordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  return value
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`)
  return value
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null
  if (typeof value === 'string' && value.length > 0) return value
  throw new Error(`${label} must be null or a non-empty string`)
}

function requiredUniqueStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${label} must be a non-empty string array`)
  }
  const strings: string[] = []
  for (const [index, item] of value.entries()) {
    if (typeof item !== 'string' || item.length === 0) {
      throw new Error(`${label}[${String(index)}] must be a non-empty string`)
    }
    strings.push(item)
  }
  if (new Set(strings).size !== strings.length) throw new Error(`${label} must not contain duplicates`)
  return strings
}

function optionalUniqueStringArray(value: unknown, label: string): string[] {
  if (value === undefined) return []
  return requiredUniqueStringArray(value, label)
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`)
  return value
}

function scoreValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${label} must be between 0 and 100`)
  }
  return value
}

function nonNegativeFiniteValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`)
  }
  return value
}

function nonNegativeSafeIntegerValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`)
  }
  return value
}

function positiveSafeIntegerValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

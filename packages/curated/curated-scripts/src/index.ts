/**
 * Offline verification commands for curated plugin catalog and profile patches.
 * @module @deepseek-ai/dsh-curated-scripts
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { performance } from 'node:perf_hooks'
import { Worker } from 'node:worker_threads'
import type { WorkerOptions } from 'node:worker_threads'
import {
  chmodSync,
  closeSync,
  constants,
  cpSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import type { BigIntStats, Stats } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { entryListSchema, type PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import { composeEntries, PROFILE_TEMPLATES } from '@deepseek-ai/dsh-app-boot'
import {
  assertBenchmarkLockSnapshotCandidates,
  assertBenchmarkProfileSnapshotBundles,
  assertBenchmarkSnapshotSchemaVersion,
  canonicalBenchmarkJson,
  readBoundBenchmarkSnapshotReference,
  type BenchmarkSnapshotReference,
} from '@deepseek-ai/dsh-curated-bench/snapshot'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'
import {
  assertCuratedInstalledCandidateLocks,
  assertCuratedInstalledLocks,
  classifyAdmission,
  formatYamlParseError,
  isExactNpmVersion,
  loadCapabilityConflicts,
  loadCuratedCatalog,
  pnpmLockTransformation,
  validateCandidateLock,
  validateProfileConflicts,
  type CapabilityConflictCatalog,
  type CuratedCandidate,
  type CuratedCandidateResources,
  type CuratedCatalog,
  type CuratedInstalledCandidateIdentity,
  type PolicyIssue,
} from '@deepseek-ai/dsh-curated-policy'
import {
  curatedProfileDependenciesForBundles,
  CURATED_PROFILE_TEMPLATES,
  type CuratedProfileName,
} from '@deepseek-ai/dsh-curated-profiles'
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
  /** Isolated DSH home created from the validated profile bytes for this stage. */
  readonly home?: string
  /** Profile passed to `dsh --profile`. */
  readonly profile: string
  /** Ordered bundle names declared by the profile being smoked. */
  readonly bundles: readonly string[]
  /** Maximum allowed subprocess duration in milliseconds. */
  readonly timeoutMs: number
}

/** Result returned by a profile smoke child runner. */
export interface SmokeProfileRunnerResult {
  /** Compatibility status: exit code, or 1/124 for signal, runner failure, or timeout. */
  readonly status: number
  /** Child exit code, or null when no normal exit code exists. */
  readonly exitCode?: number | null
  /** Child termination signal, or null when no signal ended the child. */
  readonly signal?: NodeJS.Signals | null
  /** Captured stdout text. */
  readonly stdout: string
  /** Captured stderr text. */
  readonly stderr: string
  /** Measured or supplied stage duration. */
  readonly durationMs: number
  /** Whether timeout handling stopped the stage. */
  readonly timedOut?: boolean
}

/**
 * Runs one dump/help stage for smoke-profile.
 * An injected runner is a trusted test control that must honor `timeoutMs` and
 * resolve only after its process and temporary-resource cleanup completes.
 */
export type SmokeProfileRunner = (request: SmokeProfileRunnerRequest) => Promise<SmokeProfileRunnerResult>

/** Minimal profile manifest facts used by smoke-profile. */
export interface SmokeProfileTemplate {
  /** Ordered bundle names declared by the profile. */
  readonly bundles?: readonly string[]
}

/** One staged smoke-profile result. */
export interface SmokeProfileStageResult {
  /** Stage name in execution order. */
  readonly name: 'staging' | 'manifest' | 'bundle-parse' | SmokeProfileChildStage
  /** Whether this stage passed. */
  readonly ok: boolean
  /** Monotonic stage duration in milliseconds; staging includes worker settlement and termination. */
  readonly durationMs: number
  /** Compatibility child status, for subprocess stages. */
  readonly status?: number
  /** Child exit code, or null when no normal exit code exists. */
  readonly exitCode?: number | null
  /** Child termination signal, or null when no signal ended the child. */
  readonly signal?: NodeJS.Signals | null
  /** Whether timeout handling stopped the subprocess stage. */
  readonly timedOut?: boolean
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

/** Caller-declared evidence kind carried by one benchmark comparison. */
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

/** DSH executable and source identity that produced benchmark records. */
export interface BenchmarkBuildIdentity {
  /** Exact `@deepseek-ai/dsh` package version. */
  readonly dshVersion: string
  /** Full lowercase Git revision for the source tree. */
  readonly sourceRevision: string
  /** Canonical SHA-256 of the complete source tree used by the build. */
  readonly sourceTreeSha256: string
  /** Whether uncommitted source changes contributed to the build. */
  readonly sourceDirty: boolean
  /** SHA-256 of the executed DSH artifact. */
  readonly artifactSha256: string
  /** Exact Node.js version used for execution. */
  readonly nodeVersion: string
}

/** Measurement implementations whose identities must match across a comparison. */
export interface BenchmarkMeasurementIdentity {
  /** Benchmark producer implementation and version. */
  readonly producer: string
  /** Tokenizer implementation, model vocabulary, and version. */
  readonly tokenizer: string
  /** Prompt and tool-schema serialization implementation and version. */
  readonly serialization: string
  /** Monotonic timing implementation and version. */
  readonly timing: string
  /** Provider usage and pricing table identity. */
  readonly pricing: string
  /** Scoring rubric implementation and version. */
  readonly scoring: string
}

/** Caller-supplied execution metadata for one side of a benchmark comparison. */
export interface BenchmarkExecution {
  /** Unique execution identifier. */
  readonly id: string
  /** Canonical ISO timestamp at which execution started. */
  readonly startedAt: string
  /** Environment that produced the run records. */
  readonly environment: BenchmarkEnvironment
  /** DSH build that produced the run records. */
  readonly build: BenchmarkBuildIdentity
  /** Measurement implementations used for every run field. */
  readonly measurement: BenchmarkMeasurementIdentity
}

/** Embedded rollback snapshot protected by a canonical SHA-256 digest. */
export interface BenchmarkRollbackSnapshot {
  /** SHA-256 of the canonical embedded snapshot JSON. */
  readonly sha256: string
  /** Complete lock or profile snapshot; each lock candidate carries one exact install source. */
  readonly snapshot: Readonly<Record<string, unknown>>
}

/** Lock and profile snapshots needed to restore the previous selection. */
export interface BenchmarkRollbackSnapshots {
  /** Previous self-contained candidate lock. */
  readonly lock: BenchmarkRollbackSnapshot
  /** Previous self-contained profile composition. */
  readonly profile: BenchmarkRollbackSnapshot
}

/** Aggregate output for one benchmark profile; raw run records are not retained. */
export interface BenchmarkProfileSummary {
  /** Profile name in the benchmark fixture. */
  readonly profile: string
  /** Validated execution provenance retained with the aggregate summary. */
  readonly execution: BenchmarkExecution
  /** Lock snapshot used for this profile. */
  readonly lockSnapshot: BenchmarkSnapshotReference
  /** Content-addressed profile snapshot used for this profile. */
  readonly profileSnapshot: BenchmarkSnapshotReference
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
  /** Caller-declared evidence kind supplied by the comparison input. */
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
  readonly patches: readonly string[]
  readonly profile: string
  readonly profileRoot?: string
}

interface EntryRecord {
  readonly id?: unknown
  readonly name?: unknown
  readonly config?: unknown
  readonly insert?: unknown
}

interface EffectiveArtifactEntry extends Record<string, unknown> {
  readonly id: string
  readonly name: string
}

interface EffectiveEntryState {
  readonly entry: Record<string, unknown>
  /** Admission treats every value except literal true as potentially enabled. */
  readonly enabled: boolean
  /** Permission enforcement accepts only absent or literal-false values. */
  readonly permissionEnabled: boolean
}

interface CuratedEntry {
  readonly entryId?: string
  readonly pluginName?: string
  readonly candidateId: string
  readonly ownerId: string
  readonly ownerLabel: string
  readonly evidenceSource: 'catalog' | 'patch'
  readonly profile: string
  readonly active: boolean
  readonly capability: string
  readonly resources: CuratedCandidateResources
}

interface ObservedClaimOwner {
  readonly id: string
  readonly label: string
  readonly approvedExecutable: boolean
  readonly installationOwned: boolean
  readonly catalogCandidateId?: string
}

interface ObservedPatchLayer {
  readonly patches: readonly PatchOptions[]
  readonly owner: ObservedClaimOwner
}

interface CuratedEntryReadResult {
  readonly entry?: CuratedEntry
  readonly issues: readonly CommandIssue[]
}

/** Read-only facts for one resolved candidate artifact. */
export interface ResolvedCandidateArtifact {
  /** Canonical package directory containing the observed manifest and bundle patch. */
  readonly packageDir: string
  /** Repository URL recorded by a Git resolution or explicit acquisition record. */
  readonly repository?: string
  /** Exact commit recorded by a Git resolution or explicit acquisition record. */
  readonly commit?: string
  /** Installed package version recorded by pnpm. */
  readonly packageVersion?: string
  /** npm registry integrity recorded by pnpm. */
  readonly npmIntegrity?: string
  /** Normalized source-content SHA-256 supplied by an explicit acquisition record. */
  readonly sourceContentSha256?: string
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
  /** Non-observed artifact source used by callers that separately acquired package bytes. */
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
}

type ResourceField = keyof CuratedCandidateResources
type ConflictResourceField = Exclude<ResourceField, 'entryIds'>
type BenchmarkMetric = 'quality' | 'securityCorrectness' | 'reliability' | 'performanceCost' | 'operationExperience' | 'upgradeCompatibility'

const DEFAULT_PROFILE = 'web-curated'
const SMOKE_PROFILE_TIME_LIMIT_MS = 55_000
const DSH_PACKAGE_NAME = '@deepseek-ai/dsh'
const DSH_INSTALL_ANCHOR = createRequire(import.meta.url).resolve(`${DSH_PACKAGE_NAME}/package.json`)
const CURATED_BENCH_ROOT = dirname(
  createRequire(import.meta.url).resolve('@deepseek-ai/dsh-curated-bench/package.json'),
)
const CURATED_POLICY_ROOT = dirname(
  createRequire(import.meta.url).resolve('@deepseek-ai/dsh-curated-policy/package.json'),
)
const CURATED_BASE_ROOT = dirname(
  createRequire(DSH_INSTALL_ANCHOR).resolve('@deepseek-ai/dsh-curated-base/package.json'),
)
const COMPARE_BENCHMARK_DEFAULT_FIXTURE = join(CURATED_BENCH_ROOT, 'baselines/benchmark.json')
const VERIFY_LOCK_DEFAULT_CATALOG = join(CURATED_POLICY_ROOT, 'policy/plugin-allowlist.yaml')
const PREFLIGHT_DEFAULT_CONFLICTS = join(CURATED_POLICY_ROOT, 'policy/capability-conflicts.yaml')
const PREFLIGHT_DEFAULT_PATCH = join(CURATED_BASE_ROOT, 'cordis.patch.yml')
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const MAX_ARTIFACT_FILE_BYTES = 16 * 1024 * 1024
const MAX_ARTIFACT_TREE_BYTES = 64 * 1024 * 1024
const MAX_ARTIFACT_ENTRY_COUNT = 1_000
const MAX_ARTIFACT_DEPTH = 64
const SMOKE_CHILD_MAX_OUTPUT_BYTES = 1024 * 1024
const SMOKE_REPORT_MAX_OUTPUT_BYTES = SMOKE_CHILD_MAX_OUTPUT_BYTES
const SMOKE_REPORT_OUTPUT_LIMIT_DIAGNOSTIC =
  `smoke-profile report exceeded ${String(SMOKE_REPORT_MAX_OUTPUT_BYTES)}-byte output limit`
const SMOKE_CHILD_RESIDUAL_TREE_DIAGNOSTIC =
  'smoke-profile child exited while its process group still had running descendants'
const CURATED_PROFILE_NPMRC = 'ignore-scripts=true\n'
const WINDOWS_DRIVE_PATH_PATTERN = /^[A-Za-z]:/u
const INSTALL_SCRIPT_HOOK_PATTERN = /^(?:preinstall|install|postinstall|prepare|prepack)$/u
const UNSAFE_INSTALL_SCRIPT_PATTERN = /(?:curl|wget|invoke-webrequest|https?:\/\/|sudo|\/usr\/|\/etc\/|\/Library\/)/iu
const REDACTED = '[REDACTED]'
// This temporary composition token is stripped from input and output; source ownership remains in a WeakMap.
const OBSERVED_CLAIM_OWNER_FIELD = '__dshCuratedClaimOwner'
const SECRET_KEY_PATTERN =
  /(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|secret|token|(?:^|[-_])auth(?:$|[-_]))/iu
const SMOKE_CREDENTIAL_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN|AUTH|CREDENTIAL|COOKIE/iu
const SMOKE_PROXY_ENV_PATTERN =
  /^(?:(?:HTTP|HTTPS|ALL|NO)_PROXY|NPM_CONFIG_(?:PROXY|HTTP_PROXY|HTTPS_PROXY|NO_PROXY|NOPROXY))$/iu
const SMOKE_NO_PROXY_ENV_PATTERN = /^(?:NO_PROXY|NPM_CONFIG_(?:NO_PROXY|NOPROXY))$/iu
const NO_PROXY_ENTRY_PATTERN = new RegExp(
  String.raw`^(?:\*|\*?\.[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?`
    + String.raw`|(?:\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9_](?:[A-Za-z0-9_.-]*[A-Za-z0-9_])?)(?::\d{1,5})?)$`,
  'u',
)
const SMOKE_LAUNCH_ENV_PATTERN =
  /^(?:PATH|HOME|USERPROFILE|TMP|TEMP|TMPDIR|SYSTEMROOT|WINDIR|COMSPEC|PATHEXT|LANG|LANGUAGE|LC_.+)$/iu
const URL_USERINFO_PATTERN = /\b([a-z][a-z0-9+.-]*:\/\/)([^\s/?#]+@)/giu
const SCHEMELESS_USERINFO_PATTERN = /\b[^\s/?#:@]+:[^\s/?#@]*@/gu
const URL_USERINFO_SECRET_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/?#]+@/iu
const SCHEMELESS_USERINFO_SECRET_PATTERN = /\b[^\s/?#:@]+:[^\s/?#@]*@/u
const SECRET_VALUE_PATTERN = new RegExp(
  String.raw`(?:bearer\s+\S+|github_pat_[a-z0-9_]+|gh[pousr]_[a-z0-9_]+|sk-[a-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)`,
  'iu',
)
const PRIVATE_KEY_BLOCK_REPLACEMENT_PATTERN =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END[^\r\n]*(?=\r?\n|$)|$)/giu
const SECRET_VALUE_REPLACEMENT_PATTERN = /(?:bearer\s+\S+|github_pat_[a-z0-9_]+|gh[pousr]_[a-z0-9_]+|sk-[a-z0-9_-]+)/giu
const ENV_REFERENCE_KEY_PATTERN = /Env$/u
const ENV_VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u
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
const INSTALLATION_OWNED_PROFILE_BUNDLES = new Set([
  ...Object.values(PROFILE_TEMPLATES).flatMap(template => template.bundles),
  '@deepseek-ai/dsh-curated-base',
])
const PNPMFILE_NAMES = ['.pnpmfile.cjs', '.pnpmfile.js', '.pnpmfile.mjs'] as const
const SHIPPED_SMOKE_PROFILE_TEMPLATES: Readonly<Record<string, SmokeProfileTemplate>> = Object.freeze(
  Object.fromEntries(Object.entries(PROFILE_TEMPLATES).map(([profile, template]) => [
    profile,
    Object.freeze({ bundles: Object.freeze([...template.bundles]) }),
  ])),
)
const SMOKE_PROFILE_TEMPLATES = {
  ...SHIPPED_SMOKE_PROFILE_TEMPLATES,
  ...CURATED_PROFILE_TEMPLATES,
} satisfies Readonly<Record<string, SmokeProfileTemplate>>
const SMOKE_DISABLE_DOTENV_ENV = 'DSH_INTERNAL_DISABLE_DOTENV'
const BENCHMARK_WEIGHTS = {
  taskSuccess: 0.30,
  quality: 0.20,
  securityCorrectness: 0.15,
  reliability: 0.15,
  performanceCost: 0.10,
  operationExperience: 0.05,
  upgradeCompatibility: 0.05,
} as const

/** Optional installed-profile inputs and test substitutions for bounded smoke verification. */
export interface SmokeProfileOptions {
  /** Profile templates to inspect; production uses the shipped template set. */
  readonly profiles?: Readonly<Record<string, SmokeProfileTemplate>>
  /** Trusted test runner that owns its timeout and cleanup; production executes the installed DSH CLI. */
  readonly runner?: SmokeProfileRunner
  /** Execution-work budget; synchronous Worker construction and awaited termination are non-preemptable overhead. */
  readonly timeLimitMs?: number
  /** Additional trusted package-resolution roots used by tests. */
  readonly artifactRoots?: readonly string[]
  /** Absolute materialized profile root required by production observed smoke. */
  readonly profileRoot?: string
  /** Trusted asynchronous test preparation included in the execution-work deadline. */
  readonly prepare?: () => Promise<void>
  /** Trusted test worker entry; production uses the package staging worker. */
  readonly stagingWorkerEntry?: string | URL
  /** Explicit environment values filtered through the smoke child launch allowlist. */
  readonly childEnv?: NodeJS.ProcessEnv
  /** Monotonic clock used to measure stages and enforce the execution-work deadline. */
  readonly now?: () => number
}

interface SmokeProfileChildRunnerOptions {
  /** Explicit environment values filtered through the launch allowlist. */
  readonly env?: NodeJS.ProcessEnv
  /** Injectable platform used to prove the Windows fail-closed path. */
  readonly platform?: NodeJS.Platform
  /** Injectable spawn implementation used to prove fail-closed ordering. */
  readonly spawn?: typeof spawn
}

/** Serializable observed staging request executed outside the parent thread. */
export interface SmokeProfileStagingInput {
  readonly profileRoot: string
  readonly profile: string
  readonly bundles: readonly string[]
  readonly artifactRoots: readonly string[]
  /** Parent-created empty home populated and validated by production staging. */
  readonly executionHome?: string
}

/** Serializable result returned by observed staging. */
export type SmokeProfileStagingResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly CommandIssue[] }
  | { readonly ok: false; readonly error: string }

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

interface BenchmarkSnapshotBinding {
  readonly reference: BenchmarkSnapshotReference
  readonly snapshot: Readonly<Record<string, unknown>>
}

interface BenchmarkProfile {
  readonly profile: string
  readonly execution?: BenchmarkExecution
  readonly lockSnapshot: BenchmarkSnapshotBinding
  readonly profileSnapshot: BenchmarkSnapshotBinding
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

type ComparableBenchmarkDataset = BenchmarkDataset & {
  readonly baseline: BenchmarkProfile & { readonly execution: BenchmarkExecution }
  readonly candidate: BenchmarkProfile & { readonly execution: BenchmarkExecution }
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
    const rawCatalog = loadYamlFile(path, 'curated catalog')
    const catalog = loadCuratedCatalog(path)
    const managedArtifactResolver = artifactRoots.length === 0
      ? undefined
      : createInstalledArtifactResolver(artifactRoots, catalog)
    const managedCandidates = managedProfileCandidates(catalog, artifactRoots)
    const artifactResolver = managedCandidates === undefined
      ? options.artifactResolver
      : managedArtifactResolver
    const selectedCandidates = artifactResolver === undefined
      ? []
      : managedCandidates ?? catalog.candidates.filter(candidate => candidate.active)
    const provenanceScope = artifactResolver === undefined
      ? 'catalog-metadata'
      : managedCandidates === undefined ? 'explicit-artifact-roots' : 'managed-profile'
    const issues = uniqueIssues([
      ...validateCandidateLock(catalogForLockValidation(catalog)).map(issueFromPolicy),
      ...profileConflictIssues(catalog),
      ...validateAuditCompleteness(catalog, rawCatalog),
      ...artifactResolver === undefined
        ? []
        : validateResolvedArtifacts(
          selectedCandidates,
          artifactResolver,
          options.nodeVersion ?? process.versions.node,
        ),
    ])
    const countText = artifactResolver === undefined
      ? `${String(catalog.candidates.length)} catalog candidates`
      : `${String(catalog.candidates.length)} catalog candidates, ${String(selectedCandidates.length)} selected artifacts`

    return formatResult({
      command: 'verify-lock',
      json: parsed.json,
      okText: `verify-lock: ok (${countText})\n`,
      failText: `verify-lock: failed (${countText}, ${String(issues.length)} issues)\n`,
      payload: {
        command: 'verify-lock',
        ok: issues.length === 0,
        observed: managedCandidates !== undefined,
        provenanceScope,
        catalogCandidateCount: catalog.candidates.length,
        selectedCandidateCount: selectedCandidates.length,
        issues,
      },
      issues,
    })
  } catch (error) {
    return formatThrown('verify-lock', error, args.includes('--json'))
  }
}

/**
 * Resolve installed candidates from managed pnpm profile state.
 * @param roots - Package-resolution roots containing a managed profile.
 * @param catalog - Catalog that defines the selected dependency set.
 * @returns a resolver shared by lock verification, preflight, and smoke.
 */
export function createInstalledArtifactResolver(
  roots: readonly string[],
  catalog: CuratedCatalog = loadCuratedCatalog(),
): CuratedArtifactResolver {
  for (const root of roots) {
    const managedProfile = readManagedProfileManifest(root, 'artifact')
    if (managedProfile !== undefined && hasBindableInstalledLocks(root, managedProfile, catalog)) {
      admittedInstalledIdentities(root, managedProfile, catalog)
    }
  }
  return {
    resolve(candidate) {
      const expectedPackage = candidate.expectedPackage
      if (expectedPackage === null) return undefined
      for (const root of roots) {
        const managedProfile = readManagedProfileManifest(root, candidate.id)
        if (managedProfile !== undefined) {
          const artifact = resolveCandidateLocalInstalledArtifact(candidate, root, managedProfile)
          if (artifact === undefined || !managedProfileSelectsCandidate(managedProfile, candidate)) {
            return artifact
          }
          const locksPresent = existsSync(join(root, 'pnpm-lock.yaml'))
            && existsSync(join(root, 'node_modules/.pnpm/lock.yaml'))
          if (!locksPresent) {
            if (inspectResolvedArtifact(
              candidate,
              { resolve: () => artifact },
              process.versions.node,
            ).issues.length === 0) {
              throw new Error(`${candidate.id} requires root and installed pnpm lockfiles`)
            }
            return artifact
          }
          const identity = hasBindableInstalledLocks(root, managedProfile, catalog)
            ? admittedInstalledIdentities(root, managedProfile, catalog)
              .get(candidate.id) as CuratedInstalledCandidateIdentity
            : admittedInstalledCandidateIdentity(
              { ...candidate, expectedPackage },
              root,
              managedProfile,
            )
          return artifactWithInstalledIdentity(artifact, identity)
        }
      }
      return undefined
    },
  }
}

function hasBindableInstalledLocks(
  root: string,
  manifest: Record<string, unknown>,
  catalog: CuratedCatalog,
): boolean {
  const name = manifest.name
  const dependencies = recordOrUndefined(manifest.dependencies)
  if (typeof name !== 'string' || !name.startsWith('dsh-profile-') || dependencies === undefined) {
    return false
  }
  const manifestDependencies = stringRecordOrUndefined(dependencies)
  if (manifestDependencies === undefined) return false
  const profileId = name.slice('dsh-profile-'.length)
  const selectedPackages = catalog.candidates
    .filter(current =>
      current.active
    && current.expectedPackage !== null
    && current.targetProfiles.includes(profileId))
    .map(current => current.expectedPackage as string)
  return sameStrings(selectedPackages, Object.keys(manifestDependencies))
    && existsSync(join(root, 'pnpm-lock.yaml'))
    && existsSync(join(root, 'node_modules/.pnpm/lock.yaml'))
}

function resolveCandidateLocalInstalledArtifact(
  candidate: CuratedCandidate,
  root: string,
  manifest: Record<string, unknown>,
): ResolvedCandidateArtifact | undefined {
  const packageName = candidate.expectedPackage as string
  const profile = requiredRecord(
    requiredRecord(manifest.dsh, `${candidate.id} profile metadata`).profile,
    `${candidate.id} profile metadata`,
  )
  const bundles = profile.bundles
  if (!Array.isArray(bundles) || bundles.some(bundle => typeof bundle !== 'string')) {
    throw new Error(`${candidate.id} managed profile bundles must be a string array`)
  }
  if (!bundles.includes(packageName)) return undefined
  const dependencies = recordOrUndefined(manifest.dependencies)
  if (managedProfileSelectsCandidate(manifest, candidate)) {
    if (dependencies === undefined || !Object.hasOwn(dependencies, packageName)) {
      throw new Error(`${candidate.id} is selected by the managed profile but absent from dependencies`)
    }
    requiredString(dependencies[packageName], `${candidate.id} profile dependency`)
  }
  const packageDir = requiredInstalledPackageRoot(root, candidate)
  return {
    packageDir,
    ...candidate.npmVersion === undefined
      ? { repository: candidate.repository, commit: candidate.commit }
      : {
        packageVersion: candidate.npmVersion,
        npmIntegrity: requiredString(candidate.npmIntegrity, `${candidate.id} catalog npm integrity`),
      },
    ...candidate.sourceContentSha256 === undefined
      ? {}
      : { sourceContentSha256: candidate.sourceContentSha256 },
    changedPaths: [],
  }
}

function managedProfileSelectsCandidate(
  manifest: Record<string, unknown>,
  candidate: CuratedCandidate,
): boolean {
  const name = manifest.name
  return typeof name === 'string'
    && name.startsWith('dsh-profile-')
    && candidate.targetProfiles.includes(name.slice('dsh-profile-'.length))
}

function admittedInstalledIdentities(
  root: string,
  manifest: Record<string, unknown>,
  catalog: CuratedCatalog,
): ReadonlyMap<string, CuratedInstalledCandidateIdentity> {
  const canonicalRoot = realpathSync.native(root)
  const name = manifest.name as string
  const profilePrefix = 'dsh-profile-'
  const manifestDependencies = manifest.dependencies as Record<string, string>
  const profileId = name.slice(profilePrefix.length)
  const rootLockPath = join(canonicalRoot, 'pnpm-lock.yaml')
  const installedLockPath = join(canonicalRoot, 'node_modules/.pnpm/lock.yaml')
  return new Map(assertCuratedInstalledLocks({
    catalog,
    profileId,
    manifestDependencies,
    rootLock: readBoundedRegularFile(rootLockPath),
    installedLock: readBoundedRegularFile(installedLockPath),
  }).map(identity => [identity.candidateId, identity]))
}

function readManagedProfileManifest(
  root: string,
  candidateId: string,
): Record<string, unknown> | undefined {
  const manifestPath = join(root, 'package.json')
  if (!existsSync(manifestPath)) return undefined
  const manifest = requiredRecord(
    JSON.parse(readBoundedRegularFile(manifestPath).toString('utf8')) as unknown,
    `${candidateId} artifact root manifest`,
  )
  const dsh = recordOrUndefined(manifest.dsh)
  if (dsh === undefined || !Object.hasOwn(dsh, 'profile')) return undefined
  requiredRecord(dsh.profile, `${candidateId} profile metadata`)
  return manifest
}

function managedProfileCandidates(
  catalog: CuratedCatalog,
  roots: readonly string[],
): readonly CuratedCandidate[] | undefined {
  for (const root of roots) {
    const manifest = readManagedProfileManifest(root, 'artifact')
    if (manifest === undefined) continue
    const name = requiredString(manifest.name, 'managed profile name')
    const prefix = 'dsh-profile-'
    if (!name.startsWith(prefix) || name.length === prefix.length) {
      throw new Error('managed profile name must use dsh-profile-<profile>')
    }
    const manifestProfileName = name.slice(prefix.length)
    const canonicalDirectoryName = basename(realpathSync.native(root))
    const canonicalProfileName = isCuratedProfileName(canonicalDirectoryName)
      && observedProfileHome(root, canonicalDirectoryName) !== undefined
      ? canonicalDirectoryName
      : undefined
    if (canonicalProfileName !== undefined && manifestProfileName !== canonicalProfileName) {
      throw new Error(
        `managed profile name must match canonical profiles/${canonicalProfileName} directory`,
      )
    }
    const profileName = canonicalProfileName ?? manifestProfileName
    assertCuratedPackageManagerPolicy(root, profileName, manifest)
    const profile = requiredRecord(
      requiredRecord(manifest.dsh, 'managed profile metadata').profile,
      'managed profile metadata',
    )
    const bundles = profile.bundles
    if (!Array.isArray(bundles) || bundles.some(bundle => typeof bundle !== 'string')) {
      throw new Error('managed profile bundles must be a string array')
    }
    if (
      canonicalProfileName !== undefined
      && !sameOrderedStrings(bundles as string[], CURATED_PROFILE_TEMPLATES[canonicalProfileName].bundles)
    ) {
      throw new Error(`managed profile bundles must match the ${canonicalProfileName} template in order`)
    }
    const requested = new Set(bundles as string[])
    const candidatesByPackage = new Map(catalog.candidates.flatMap(candidate =>
      candidate.expectedPackage === null ? [] : [[candidate.expectedPackage, candidate] as const]))
    for (const bundle of requested) {
      const candidate = candidatesByPackage.get(bundle)
      if (
        candidate !== undefined
        && (!candidate.active || !candidate.targetProfiles.includes(profileName))
      ) {
        throw new Error(`${candidate.id} is not active and assigned to managed profile ${profileName}`)
      }
    }
    const assigned = catalog.candidates.filter(candidate =>
      candidate.active
      && candidate.expectedPackage !== null
      && candidate.targetProfiles.includes(profileName))
    for (const candidate of assigned) {
      if (!requested.has(candidate.expectedPackage as string)) {
        throw new Error(`${candidate.id} is assigned to managed profile ${profileName} but not requested`)
      }
    }
    return assigned
  }
  return undefined
}

function isCuratedProfileName(name: string): name is CuratedProfileName {
  return Object.hasOwn(CURATED_PROFILE_TEMPLATES, name)
}

function admittedInstalledCandidateIdentity(
  candidate: CuratedCandidate & { readonly expectedPackage: string },
  root: string,
  manifest: Record<string, unknown>,
): CuratedInstalledCandidateIdentity {
  const dependencies = manifest.dependencies as Record<string, string>
  const manifestSpecifier = requiredString(
    dependencies[candidate.expectedPackage],
    `${candidate.id} profile dependency`,
  )
  const canonicalRoot = realpathSync.native(root)
  return assertCuratedInstalledCandidateLocks({
    candidate,
    manifestSpecifier,
    rootLock: readBoundedRegularFile(join(canonicalRoot, 'pnpm-lock.yaml')),
    installedLock: readBoundedRegularFile(join(canonicalRoot, 'node_modules/.pnpm/lock.yaml')),
  })
}

function artifactWithInstalledIdentity(
  artifact: ResolvedCandidateArtifact,
  identity: CuratedInstalledCandidateIdentity,
): ResolvedCandidateArtifact {
  return identity.source.kind === 'npm'
    ? {
      ...artifact,
      packageVersion: identity.packageVersion,
      npmIntegrity: identity.source.integrity,
    }
    : {
      ...artifact,
      repository: identity.source.repository,
      commit: identity.source.commit,
      packageVersion: identity.packageVersion,
    }
}

function requiredInstalledPackageRoot(root: string, candidate: CuratedCandidate): string {
  const packageDir = join(root, 'node_modules', candidate.expectedPackage as string)
  if (!existsSync(join(packageDir, 'package.json'))) {
    throw new Error(`${candidate.id} selected dependency is not installed in the managed profile`)
  }
  const ownershipRoot = canonicalPackageRoot(join(root, 'node_modules'))
  const canonicalPackageDir = canonicalPackageRoot(packageDir)
  if (!pathIsContained(ownershipRoot, canonicalPackageDir)) {
    throw new Error(
      `${candidate.id} selected dependency package root resolves outside the managed node_modules root`,
    )
  }
  return canonicalPackageDir
}

function validateResolvedArtifacts(
  candidates: readonly CuratedCandidate[],
  resolver: CuratedArtifactResolver,
  nodeVersion: string,
): CommandIssue[] {
  return candidates.flatMap(candidate => inspectResolvedArtifact(candidate, resolver, nodeVersion).issues)
}

function inspectResolvedArtifact(
  candidate: CuratedCandidate,
  resolver: CuratedArtifactResolver,
  nodeVersion: string,
): { readonly artifact?: ResolvedCandidateArtifact; readonly issues: readonly CommandIssue[] } {
  const artifact = resolver.resolve(candidate)
  if (artifact === undefined) {
    return {
      issues: [issue({
        code: 'artifact-unreachable',
        target: candidate.id,
        message: 'pinned candidate artifact is unavailable',
      })],
    }
  }
  const issues: CommandIssue[] = []
  if (candidate.npmVersion === undefined && artifact.repository !== candidate.repository) {
    issues.push(issue({
      code: 'artifact-repository-mismatch',
      target: candidate.id,
      message: 'resolved artifact repository does not match the catalog',
    }))
  }
  if (candidate.npmVersion === undefined && artifact.commit !== candidate.commit) {
    issues.push(issue({
      code: 'artifact-commit-mismatch',
      target: candidate.id,
      message: 'resolved artifact commit does not match the exact catalog SHA',
    }))
  }
  if (
    artifact.sourceContentSha256 !== undefined
    && artifact.sourceContentSha256 !== candidate.sourceContentSha256
  ) {
    issues.push(issue({
      code: 'artifact-source-content-sha-mismatch',
      target: candidate.id,
      message: 'resolved artifact source content SHA-256 does not match the catalog',
    }))
  }
  try {
    if (installedArtifactTreeSha256(artifact.packageDir) !== candidate.treeSha256) {
      issues.push(issue({
        code: 'artifact-tree-sha-mismatch',
        target: candidate.id,
        message: 'installed artifact tree SHA-256 does not match the catalog',
      }))
    }
  } catch (error) {
    if (!(error instanceof ArtifactFileValidationError)) throw error
    issues.push(artifactFileIssue(candidate, error))
    return { artifact, issues }
  }
  const manifestFile = candidate.manifestPath === null
    ? undefined
    : resolveArtifactFileForCandidate(candidate, artifact.packageDir, candidate.manifestPath, issues)
  const manifest = manifestFile === undefined
    ? undefined
    : JSON.parse(readArtifactFile(manifestFile).toString('utf8')) as unknown
  const manifestRecord = recordOrUndefined(manifest)
  if (manifestRecord === undefined) {
    issues.push(issue({
      code: 'artifact-manifest-invalid',
      target: candidate.id,
      message: 'resolved artifact package manifest is missing or invalid',
    }))
    return { artifact, issues }
  }
  if (manifestRecord.name !== candidate.expectedPackage) {
    issues.push(issue({
      code: 'artifact-package-name-mismatch',
      target: candidate.id,
      message: 'resolved artifact package name does not match the catalog',
    }))
  }
  if (artifact.packageVersion !== undefined && manifestRecord.version !== artifact.packageVersion) {
    issues.push(issue({
      code: 'artifact-package-version-mismatch',
      target: candidate.id,
      message: 'resolved artifact package version does not match the pnpm lockfile',
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
    : resolveArtifactFileForCandidate(candidate, artifact.packageDir, observedPatch, issues)
  if (observedPatch !== candidate.bundlePatch || patchPath === undefined || !existsSync(patchPath)) {
    issues.push(issue({
      code: 'artifact-bundle-patch-missing',
      target: candidate.id,
      message: 'resolved artifact bundle patch is missing or differs from the catalog',
    }))
  } else {
    const patchLayer = loadPatchLayer(patchPath, true)
    const inspectedEntries = inspectArtifactEntries(candidate, patchLayer)
    issues.push(...inspectedEntries.issues)
    if (inspectedEntries.entries !== undefined) {
      issues.push(...validatePermissionArtifactConfig(candidate, inspectedEntries.entries))
    }
  }
  const main = optionalString(manifestRecord.main)
  const mainPath = main === undefined
    ? undefined
    : resolveArtifactFileForCandidate(candidate, artifact.packageDir, main, issues)
  if (mainPath === undefined || !existsSync(mainPath)) {
    issues.push(issue({
      code: 'artifact-main-missing',
      target: candidate.id,
      message: 'resolved artifact main file is missing or unsafe',
    }))
  } else {
    try {
      readArtifactFile(mainPath)
    } catch (error) {
      if (!(error instanceof ArtifactFileValidationError)) throw error
      issues.push(artifactFileIssue(candidate, error))
    }
  }
  if (artifact.changedPaths.some(path => path === 'packages/core' || path.startsWith('packages/core/'))) {
    issues.push(issue({
      code: 'artifact-core-modification',
      target: candidate.id,
      message: 'resolved artifact modifies DeepSeek Harness core paths',
    }))
  }
  return { artifact, issues }
}

function inspectArtifactEntries(
  candidate: CuratedCandidate,
  patchLayer: readonly PatchOptions[],
): {
  readonly entries?: readonly EffectiveArtifactEntry[]
  readonly issues: readonly CommandIssue[]
} {
  const composed = composeEntries([[...patchLayer]])
  const entryProblem = artifactEntryListProblem(composed)
  if (entryProblem !== undefined) {
    return {
      issues: [issue({
        code: 'artifact-entry-invalid',
        target: candidate.id,
        message: 'resolved artifact bundle contains an invalid Loader entry',
        details: { problem: entryProblem },
      })],
    }
  }
  const entries = composed as EffectiveArtifactEntry[]
  const entryIds = flattenEffectiveEntryTree(entries).map(entry => entry.id)
  const expectedEntryIds = candidate.resources?.entryIds ?? []
  return {
    entries,
    issues: sameStrings(entryIds, expectedEntryIds)
      ? []
      : [issue({
        code: 'artifact-entry-ids-mismatch',
        target: candidate.id,
        message: 'resolved artifact bundle entry IDs do not match the catalog',
        details: {
          expectedEntryIds,
          observedEntryIds: entryIds,
        },
      })],
  }
}

function artifactEntryListProblem(entries: readonly unknown[], at = ''): string | undefined {
  for (const [index, entry] of entries.entries()) {
    const label = `${at}entry ${String(index + 1)}`
    if (!isRecord(entry)) return `${label} must be a mapping`
    if (typeof entry.id !== 'string' || entry.id.length === 0) {
      return `${label}.id must be a non-empty string`
    }
    if (typeof entry.name !== 'string' || entry.name.length === 0) {
      return `${label}.name must be a non-empty string`
    }
    if (!entry.group) continue
    if (!Array.isArray(entry.config)) return `${label}.config must be an entry list for a group`
    const nestedProblem = artifactEntryListProblem(entry.config, `${label}.config `)
    if (nestedProblem !== undefined) return nestedProblem
  }
  return undefined
}

function flattenEffectiveEntryTree(
  entries: readonly EffectiveArtifactEntry[],
): readonly EffectiveArtifactEntry[] {
  return entries.flatMap((entry) => {
    if (!entry.group) return [entry]
    return [entry, ...flattenEffectiveEntryTree(entry.config as EffectiveArtifactEntry[])]
  })
}

function validatePermissionArtifactConfig(
  candidate: CuratedCandidate,
  entries: readonly EffectiveArtifactEntry[],
): CommandIssue[] {
  if (candidate.capability !== PERMISSION_POLICY_CAPABILITY) return []
  const matching = findEffectivePermissionEntries(entries)
  if (matching.length === 0 || matching[0]?.entry.config === undefined) {
    return [issue({
      code: 'artifact-permission-config-missing',
      target: candidate.id,
      message: 'resolved permission artifact must declare its permission-rules config',
    })]
  }
  if (matching.length !== 1 || recordOrUndefined(matching[0].entry.config) === undefined) {
    return [issue({
      code: 'artifact-permission-config-malformed',
      target: candidate.id,
      message: 'resolved permission artifact permission-rules config must be one map',
    })]
  }

  const config = matching[0].entry.config as Record<string, unknown>
  const issues: CommandIssue[] = []
  if (!matching[0].enabled) {
    issues.push(issue({
      code: 'artifact-permission-entry-disabled',
      target: candidate.id,
      message: 'resolved permission artifact must unconditionally enable its permission-rules entry and ancestor groups',
    }))
  }
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

function findEffectivePermissionEntries(
  entries: readonly EffectiveArtifactEntry[],
  ancestorsEnabled = true,
): Array<{ readonly entry: EffectiveArtifactEntry; readonly enabled: boolean }> {
  return entries.flatMap((entry) => {
    const enabled = ancestorsEnabled && (entry.disabled === undefined || entry.disabled === false)
    return [
      ...entry.id === PERMISSION_RULES_ENTRY_ID ? [{ entry, enabled }] : [],
      ...entry.group
        ? findEffectivePermissionEntries(entry.config as EffectiveArtifactEntry[], enabled)
        : [],
    ]
  })
}

type ArtifactFileIssueCode =
  | 'artifact-depth-exceeded'
  | 'artifact-entry-count-exceeded'
  | 'artifact-file-changed'
  | 'artifact-file-not-regular'
  | 'artifact-file-oversized'
  | 'artifact-path-escape'
  | 'artifact-path-invalid'

class ArtifactFileValidationError extends Error {
  constructor(readonly code: ArtifactFileIssueCode, message: string) {
    super(message)
  }
}

function artifactFileIssue(
  candidate: CuratedCandidate,
  error: ArtifactFileValidationError,
): CommandIssue {
  return issue({
    code: error.code,
    target: candidate.id,
    message: error.message,
  })
}

function resolveArtifactFileForCandidate(
  candidate: CuratedCandidate,
  packageDir: string,
  relativePath: string,
  issues: CommandIssue[],
): string | undefined {
  try {
    return resolveArtifactFile(packageDir, relativePath)
  } catch (error) {
    if (!(error instanceof ArtifactFileValidationError)) throw error
    issues.push(artifactFileIssue(candidate, error))
    return undefined
  }
}

function canonicalPackageRoot(packageDir: string): string {
  if (!existsSync(packageDir)) {
    throw new ArtifactFileValidationError('artifact-path-invalid', 'artifact package root is missing')
  }
  const canonical = realpathSync.native(packageDir)
  if (!statSync(canonical).isDirectory()) {
    throw new ArtifactFileValidationError(
      'artifact-file-not-regular',
      'resolved artifact package root must be a directory',
    )
  }
  return canonical
}

function resolveArtifactFile(packageDir: string, relativePath: string): string | undefined {
  if (!isSafeRelativeArtifactPath(relativePath)) {
    throw new ArtifactFileValidationError(
      'artifact-path-invalid',
      'artifact file path must be a portable package-relative path',
    )
  }
  const canonicalRoot = canonicalPackageRoot(packageDir)
  const unresolved = resolve(canonicalRoot, relativePath)
  if (!existsSync(unresolved)) return undefined
  const entryStat = lstatSync(unresolved)
  if (entryStat.isSymbolicLink()) {
    const canonical = realpathSync.native(unresolved)
    if (!pathIsContained(canonicalRoot, canonical)) {
      throw new ArtifactFileValidationError(
        'artifact-path-escape',
        'artifact file resolves outside the canonical package root',
      )
    }
    throw new ArtifactFileValidationError(
      'artifact-file-not-regular',
      'artifact files must not be symbolic links',
    )
  }
  assertRegularArtifactEntry(entryStat)
  return unresolved
}

function isSafeRelativeArtifactPath(path: string): boolean {
  if (
    path.length === 0
    || path.includes('\0')
    || path.includes('\\')
    || isAbsolute(path)
    || WINDOWS_DRIVE_PATH_PATTERN.test(path)
  ) {
    return false
  }
  const segments = path.split('/')
  return !segments.includes('..') && !segments.includes('')
}

function pathIsContained(root: string, path: string): boolean {
  const fromRoot = relative(root, path)
  return fromRoot === '' || (!fromRoot.startsWith(`..${sep}`) && fromRoot !== '..' && !isAbsolute(fromRoot))
}

function sameFileIdentity(
  left: { readonly dev: bigint; readonly ino: bigint },
  right: { readonly dev: bigint; readonly ino: bigint },
): boolean {
  return left.ino !== 0n && right.ino !== 0n && left.dev === right.dev && left.ino === right.ino
}

interface ArtifactPathBinding {
  readonly canonicalRoot: string
  readonly relativePath: string
  readonly rootIdentity: BigIntStats
}

function artifactPathBinding(path: string): ArtifactPathBinding | undefined {
  let current = dirname(path)
  let previous = ''
  while (current !== previous) {
    try {
      const packagePath = join(current, 'package.json')
      if (existsSync(packagePath) && pathIsContained(current, path)) {
        const canonicalRoot = realpathSync.native(current)
        return {
          canonicalRoot,
          relativePath: relative(current, path),
          rootIdentity: lstatSync(canonicalRoot, { bigint: true }),
        }
      }
    } catch {
      // Continue upward; a caller may be reading a non-package YAML or benchmark file.
    }
    previous = current
    current = dirname(current)
  }
  return undefined
}

function assertArtifactPathCurrent(
  path: string,
  descriptorIdentity: BigIntStats,
  binding: ArtifactPathBinding | undefined,
): void {
  if (binding === undefined) return
  const rootIdentity = lstatSync(binding.canonicalRoot, { bigint: true })
  let ancestor = binding.canonicalRoot
  for (const segment of binding.relativePath.split(sep).slice(0, -1)) {
    ancestor = join(ancestor, segment)
    const identity = lstatSync(ancestor, { bigint: true })
    if (identity.isSymbolicLink() || !identity.isDirectory()) {
      throw new ArtifactFileValidationError(
        'artifact-file-changed',
        'artifact file path or ancestor changed while it was being read',
      )
    }
  }
  const current = lstatSync(path, { bigint: true })
  if (
    binding.rootIdentity.ino === 0n
    || descriptorIdentity.ino === 0n
    || rootIdentity.isSymbolicLink()
    || !rootIdentity.isDirectory()
    || !sameFileIdentity(binding.rootIdentity, rootIdentity)
    || current.isSymbolicLink()
    || !current.isFile()
    || !sameFileIdentity(current, descriptorIdentity)
    || realpathSync.native(path) !== join(binding.canonicalRoot, binding.relativePath)
  ) {
    throw new ArtifactFileValidationError(
      'artifact-file-changed',
      'artifact file path or ancestor changed while it was being read',
    )
  }
}

/* jscpd:ignore-start -- This process-boundary reader owns artifact diagnostics and dynamic package-root discovery. */
function readBoundedRegularFile(path: string, maxBytes = MAX_ARTIFACT_FILE_BYTES): Buffer {
  const binding = artifactPathBinding(path)
  let descriptor: number
  try {
    let flags = constants.O_RDONLY | constants.O_NONBLOCK
    /* v8 ignore else -- Windows does not expose O_NOFOLLOW. */
    if (typeof constants.O_NOFOLLOW === 'number') flags |= constants.O_NOFOLLOW
    descriptor = openSync(path, flags)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ELOOP') {
      throw new ArtifactFileValidationError(
        'artifact-file-not-regular',
        'artifact files must not be symbolic links',
      )
    }
    throw error
  }
  try {
    const before = fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) {
      throw new ArtifactFileValidationError(
        'artifact-file-not-regular',
        'artifact contents must contain only regular files and directories',
      )
    }
    assertArtifactPathCurrent(path, before, binding)
    if (before.size > BigInt(maxBytes)) {
      throw new ArtifactFileValidationError(
        'artifact-file-oversized',
        `artifact file exceeds ${String(maxBytes)} bytes`,
      )
    }
    const chunks: Buffer[] = []
    let totalBytes = 0
    while (true) {
      const remaining = maxBytes + 1 - totalBytes
      if (remaining <= 0) {
        throw new ArtifactFileValidationError(
          'artifact-file-oversized',
          `artifact file exceeds ${String(maxBytes)} bytes`,
        )
      }
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, remaining))
      const bytesRead = readSync(descriptor, chunk, 0, chunk.byteLength, null)
      if (bytesRead === 0) break
      chunks.push(chunk.subarray(0, bytesRead))
      totalBytes += bytesRead
    }
    const after = fstatSync(descriptor, { bigint: true })
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
      || BigInt(totalBytes) !== after.size
    ) {
      throw new ArtifactFileValidationError(
        'artifact-file-changed',
        'artifact file changed while it was being read',
      )
    }
    assertArtifactPathCurrent(path, after, binding)
    return Buffer.concat(chunks, totalBytes)
  } finally {
    closeSync(descriptor)
  }
}
/* jscpd:ignore-end */

function readArtifactFile(path: string): Buffer {
  return readBoundedRegularFile(path)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

function assertRegularArtifactEntry(stat: Pick<Stats, 'isFile'>): void {
  if (!stat.isFile()) {
    throw new ArtifactFileValidationError(
      'artifact-file-not-regular',
      'artifact contents must contain only regular files and directories',
    )
  }
}

interface ArtifactTreeDirectory {
  readonly entries: readonly string[]
  readonly identity: BigIntStats
  readonly relativeDirectory: string
}

function artifactTreeEntryTypeKey(name: string, identity: BigIntStats): string {
  return JSON.stringify([name, String(identity.mode & BigInt(constants.S_IFMT))])
}

function readArtifactDirectoryEntries(directory: string): string[] {
  const entryTypes: string[] = []
  const entries = opendirSync(directory)
  try {
    while (true) {
      const entry = entries.readSync()
      if (entry === null) break
      const identity = lstatSync(join(directory, entry.name), { bigint: true })
      entryTypes.push(artifactTreeEntryTypeKey(entry.name, identity))
    }
  } finally {
    entries.closeSync()
  }
  return entryTypes.sort()
}

function installedArtifactTreeSha256(packageDir: string): string {
  const canonicalRoot = canonicalPackageRoot(packageDir)
  const rootIdentity = lstatSync(canonicalRoot, { bigint: true })
  const files: Array<{ readonly relativePath: string; readonly canonicalPath: string }> = []
  const directories: ArtifactTreeDirectory[] = []
  let totalBytes = 0
  let entryCount = 0
  const pending = [{
    directory: canonicalRoot,
    identity: rootIdentity,
    relativeDirectory: '',
    depth: 0,
  }]
  while (pending.length > 0) {
    const current = pending.pop() as {
      readonly directory: string
      readonly identity: BigIntStats
      readonly relativeDirectory: string
      readonly depth: number
    }
    const { directory, identity, relativeDirectory, depth } = current
    const entryTypes: string[] = []
    const entries = opendirSync(directory)
    try {
      while (true) {
        const entry = entries.readSync()
        if (entry === null) break
        entryCount += 1
        if (entryCount > MAX_ARTIFACT_ENTRY_COUNT) {
          throw new ArtifactFileValidationError(
            'artifact-entry-count-exceeded',
            `artifact tree exceeds ${String(MAX_ARTIFACT_ENTRY_COUNT)} entries`,
          )
        }
        const relativePath = relativeDirectory.length === 0
          ? entry.name
          : `${relativeDirectory}/${entry.name}`
        const unresolved = join(directory, entry.name)
        const entryStat = lstatSync(unresolved, { bigint: true })
        entryTypes.push(artifactTreeEntryTypeKey(entry.name, entryStat))
        if (entryStat.isDirectory()) {
          const childDepth = depth + 1
          if (childDepth > MAX_ARTIFACT_DEPTH) {
            throw new ArtifactFileValidationError(
              'artifact-depth-exceeded',
              `artifact tree exceeds ${String(MAX_ARTIFACT_DEPTH)} directory levels`,
            )
          }
          pending.push({
            directory: unresolved,
            identity: entryStat,
            relativeDirectory: relativePath,
            depth: childDepth,
          })
          continue
        }
        let canonicalPath = unresolved
        if (entryStat.isSymbolicLink()) {
          canonicalPath = realpathSync.native(unresolved)
          if (!pathIsContained(canonicalRoot, canonicalPath)) {
            throw new ArtifactFileValidationError(
              'artifact-path-escape',
              'artifact symlink or junction resolves outside the canonical package root',
            )
          }
          throw new ArtifactFileValidationError(
            'artifact-file-not-regular',
            'artifact contents must contain only regular files and directories',
          )
        } else {
          assertRegularArtifactEntry(entryStat)
        }
        files.push({ relativePath, canonicalPath })
      }
    } finally {
      entries.closeSync()
    }
    directories.push({
      entries: entryTypes.sort(),
      identity,
      relativeDirectory,
    })
  }
  files.sort((left, right) => Buffer.compare(Buffer.from(left.relativePath), Buffer.from(right.relativePath)))
  const digest = createHash('sha256')
  for (const file of files) {
    const pathBytes = Buffer.from(file.relativePath)
    const content = readArtifactFile(file.canonicalPath)
    totalBytes += content.byteLength
    if (totalBytes > MAX_ARTIFACT_TREE_BYTES) {
      throw new ArtifactFileValidationError(
        'artifact-file-oversized',
        `artifact tree exceeds ${String(MAX_ARTIFACT_TREE_BYTES)} bytes`,
      )
    }
    digest.update(`${String(pathBytes.byteLength)}:`)
    digest.update(pathBytes)
    digest.update(`${String(content.byteLength)}:`)
    digest.update(content)
  }
  for (const directory of directories) {
    const path = join(canonicalRoot, directory.relativeDirectory)
    const current = lstatSync(path, { bigint: true })
    if (
      current.isSymbolicLink()
      || !current.isDirectory()
      || !sameFileIdentity(directory.identity, current)
      || realpathSync.native(path) !== path
      || !sameOrderedStrings(readArtifactDirectoryEntries(path), directory.entries)
    ) {
      throw new ArtifactFileValidationError(
        'artifact-file-changed',
        'artifact tree changed while it was being read',
      )
    }
  }
  return digest.digest('hex')
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
  const sortedLeft = [...left].sort()
  const sortedRight = [...right].sort()
  return sortedLeft.length === sortedRight.length && sortedLeft.every((value, index) => value === sortedRight[index])
}

function sameOrderedStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
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
    const reportProfile = redactSecretText(parsed.profile)
    const profileRoot = parsed.profileRoot
      ?? (options.profileRoot === undefined ? undefined : exactRoot(options.profileRoot, 'profileRoot'))
    if (profileRoot !== undefined) {
      assertManagedProfileRootPath(profileRoot, parsed.profileRoot === undefined ? 'profileRoot' : '--profile-root')
    }
    if (parsed.fixture === undefined && profileRoot === undefined) {
      const issues = [issue({
        code: 'preflight-profile-root-required',
        message: 'observed preflight requires an absolute --profile-root',
      })]
      return formatResult({
        command: 'preflight',
        json: parsed.json,
        okText: '',
        failText: `preflight: failed (profile ${reportProfile}, ${String(issues.length)} issue)\n`,
        payload: {
          command: 'preflight',
          ok: false,
          observed: false,
          accepted: false,
          profile: reportProfile,
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
    const observed = parsed.fixture === undefined && profileRoot !== undefined
    const resolver = profileRoot === undefined
      ? undefined
      : createInstalledArtifactResolver([profileRoot, ...artifactRoots])
    const loaded = parsed.fixture !== undefined
      ? { entries: loadPatchEntries(parsed.fixture), issues: [], candidates: [], owners: undefined }
      : loadInstalledProfileEntries(
        requiredString(profileRoot, 'profileRoot'),
        parsed.profile,
        resolver,
        parsed.patches,
      )
    const entries = loaded.entries
    const conflicts = loadCapabilityConflicts(PREFLIGHT_DEFAULT_CONFLICTS)
    const issues = uniqueIssues([
      ...loaded.issues,
      ...validatePatchEntries(entries, parsed.profile, conflicts, {
        enforceGovernedCapabilities:
          parsed.fixture !== undefined || Object.hasOwn(CURATED_PROFILE_TEMPLATES, parsed.profile),
        authoritativeEntries: loaded.candidates.map(candidate => catalogCandidateEntry(candidate, parsed.profile)),
        ...loaded.owners === undefined ? {} : { observedOwners: loaded.owners },
      }),
    ])

    return formatResult({
      command: 'preflight',
      json: parsed.json,
      okText: `preflight: ok (profile ${reportProfile}, ${String(entries.length)} entries)\n`,
      failText: `preflight: failed (profile ${reportProfile}, ${String(entries.length)} entries, ${String(issues.length)} issues)\n`,
      payload: {
        command: 'preflight',
        ok: issues.length === 0,
        observed,
        accepted: observed && issues.length === 0,
        profile: reportProfile,
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
  overlayPaths: readonly string[],
): {
  readonly entries: readonly Record<string, unknown>[]
  readonly issues: readonly CommandIssue[]
  readonly candidates: readonly CuratedCandidate[]
  readonly owners: WeakMap<Record<string, unknown>, ObservedClaimOwner>
} {
  const manifest = JSON.parse(readBoundedRegularFile(join(profileRoot, 'package.json')).toString('utf8')) as unknown
  const manifestRecord = requiredRecord(manifest, `profile ${profile} manifest`)
  const dsh = recordOrUndefined(manifestRecord.dsh)
  const profileManifest = recordOrUndefined(dsh?.profile)
  const bundles = profileManifest?.bundles
  if (!Array.isArray(bundles) || bundles.some(bundle => typeof bundle !== 'string' || bundle.length === 0)) {
    throw new Error(`profile ${profile} manifest dsh.profile.bundles must be a string array`)
  }
  const issues: CommandIssue[] = [
    ...profileManifestNameIssue(manifestRecord, profile),
    ...containsSecretMaterial(manifestRecord) ? [issue({
      code: 'preflight-profile-manifest-secret',
      target: 'package.json',
      message: 'profile manifest must not contain secret material',
    })] : [],
    ...profileMetadataIssues(profileRoot, profile, manifestRecord),
  ]
  if (bundles.length === 0) {
    issues.push(issue({
      code: 'preflight-profile-bundles-empty',
      target: profile,
      message: 'observed profile must declare at least one bundle',
    }))
  }
  const template = Object.entries(CURATED_PROFILE_TEMPLATES).find(([name]) => name === profile)?.[1]
  if (
    template !== undefined
    && !sameOrderedStrings(bundles as string[], template.bundles)
  ) {
    issues.push(issue({
      code: 'preflight-profile-template-mismatch',
      target: profile,
      message: 'repository-owned curated profile bundle list must match its selected template',
    }))
  }
  const catalog = loadCuratedCatalog()
  const candidates = new Map(catalog.candidates
    .filter(candidate => candidate.expectedPackage !== null)
    .map(candidate => [candidate.expectedPackage as string, candidate]))
  const selectedBundles = new Set(bundles as string[])
  const patchLayers: ObservedPatchLayer[] = []
  const selectedCandidates: CuratedCandidate[] = []
  for (const packageName of bundles as string[]) {
    const candidate = candidates.get(packageName)
    const installationOwned = candidate === undefined
      && INSTALLATION_OWNED_PROFILE_BUNDLES.has(packageName)
    let packageDir: string | undefined
    if (candidate !== undefined && (!candidate.active || !candidate.targetProfiles.includes(profile))) {
      issues.push(issue({
        code: 'preflight-bundle-not-approved',
        target: packageName,
        message: 'installed catalog bundle is not active and assigned to the requested profile',
      }))
    } else if (candidate !== undefined) {
      selectedCandidates.push(candidate)
      issues.push(...requiredRuntimeBundleIssues(
        catalog,
        candidates,
        candidate,
        profile,
        selectedBundles,
        packageName,
      ))
      const inspected = inspectResolvedArtifact(
        candidate,
        resolver as CuratedArtifactResolver,
        process.versions.node,
      )
      issues.push(...inspected.issues)
      if (inspected.issues.length === 0) packageDir = inspected.artifact?.packageDir
    } else {
      const resolutionRoot = installationOwned
        ? dirname(DSH_INSTALL_ANCHOR)
        : profileRoot
      packageDir = findCandidatePackageDir(packageName, [resolutionRoot])
    }
    if (packageDir === undefined) {
      if (candidate === undefined) {
        issues.push(issue({
          code: 'preflight-bundle-unresolved',
          target: packageName,
          message: 'profile bundle is not installed or resolvable',
        }))
      }
      continue
    }
    const bundleManifestPath = resolveArtifactFile(packageDir, 'package.json') as string
    const bundleManifest = JSON.parse(readArtifactFile(bundleManifestPath).toString('utf8')) as unknown
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
    const owner = candidate === undefined
      ? {
        id: `bundle:${packageName}`,
        label: packageName,
        approvedExecutable: installationOwned,
        installationOwned,
      }
      : {
        id: `catalog:${candidate.id}`,
        label: candidate.id,
        approvedExecutable: candidate.active && candidate.targetProfiles.includes(profile),
        installationOwned: false,
        catalogCandidateId: candidate.id,
      }
    const patchLayer = loadPatchLayer(patchPath, owner.approvedExecutable)
    issues.push(...sameLayerDuplicateInsertedEntryIdIssues(patchLayer))
    patchLayers.push({ patches: patchLayer, owner })
  }
  const profilePatch = join(profileRoot, 'cordis.patch.yml')
  if (existsSync(profilePatch)) {
    const patchLayer = loadPatchLayer(profilePatch)
    if (containsSecretMaterial(patchLayer)) {
      issues.push(issue({
        code: 'preflight-profile-patch-secret',
        target: 'cordis.patch.yml',
        message: 'profile patch must not contain secret material',
      }))
    }
    issues.push(...sameLayerDuplicateInsertedEntryIdIssues(patchLayer))
    patchLayers.push({
      patches: patchLayer,
      owner: {
        id: `profile:${profile}`,
        label: 'profile patch',
        approvedExecutable: false,
        installationOwned: false,
      },
    })
  }
  const homeRoot = observedProfileHome(profileRoot, profile)
  if (homeRoot !== undefined) {
    const homePatch = join(homeRoot, 'cordis.patch.yml')
    if (existsSync(homePatch)) {
      const patchLayer = loadPatchLayer(homePatch)
      if (containsSecretMaterial(patchLayer)) {
        issues.push(issue({
          code: 'preflight-home-patch-secret',
          target: 'cordis.patch.yml',
          message: 'Harness home patch must not contain secret material',
        }))
      }
      issues.push(...sameLayerDuplicateInsertedEntryIdIssues(patchLayer))
      patchLayers.push({
        patches: patchLayer,
        owner: {
          id: `home:${homeRoot}`,
          label: 'home patch',
          approvedExecutable: false,
          installationOwned: false,
        },
      })
    }
  }
  for (const overlayPath of overlayPaths) {
    const patchLayer = loadPatchLayer(overlayPath)
    if (containsSecretMaterial(patchLayer)) {
      issues.push(issue({
        code: 'preflight-overlay-patch-secret',
        target: 'overlay patch',
        message: 'command-line overlay patch must not contain secret material',
      }))
    }
    issues.push(...sameLayerDuplicateInsertedEntryIdIssues(patchLayer))
    patchLayers.push({
      patches: patchLayer,
      owner: {
        id: `overlay:${overlayPath}`,
        label: 'overlay patch',
        approvedExecutable: false,
        installationOwned: false,
      },
    })
  }
  const composed = composeObservedEntries(patchLayers)
  return { ...composed, issues, candidates: selectedCandidates }
}

function runtimeActivationEvidencePolicyIssues(
  catalog: CuratedCatalog,
  candidate: CuratedCandidate,
  profile: string,
): readonly string[] {
  const {
    runtimeActivationEvidence: _runtimeActivationEvidence,
    ...candidateWithoutEvidence
  } = candidate
  const evidenceSet = candidate.runtimeActivationEvidence?.[profile]
  return validateCandidateLock({
    ...catalog,
    schemaVersion: 2,
    candidates: [{
      ...candidateWithoutEvidence,
      targetProfiles: [profile],
      ...evidenceSet === undefined
        ? {}
        : { runtimeActivationEvidence: { [profile]: evidenceSet } },
    }],
  })
    .filter(policyIssue =>
      policyIssue.code.startsWith('candidate-runtime-activation-')
      || policyIssue.code === 'candidate-required-runtime-bundle-undeclared')
    .map(policyIssue => policyIssue.code)
}

function requiredRuntimeBundleIssues(
  catalog: CuratedCatalog,
  candidates: ReadonlyMap<string, CuratedCandidate>,
  candidate: CuratedCandidate,
  profile: string,
  selectedBundles: ReadonlySet<string>,
  target: string,
): CommandIssue[] {
  const issues: CommandIssue[] = []
  for (const requiredBundle of candidate.requiredRuntimeBundles ?? []) {
    const provider = candidates.get(requiredBundle)
    if (
      provider === undefined
      || provider === candidate
      || !provider.active
      || !provider.targetProfiles.includes(profile)
      || !selectedBundles.has(requiredBundle)
    ) {
      issues.push(issue({
        code: 'preflight-required-runtime-bundle-missing',
        target,
        message: 'required runtime bundle must be provided by another active candidate in the same profile',
        details: { bundle: requiredBundle },
      }))
      continue
    }
    const evidenceIssues = runtimeActivationEvidencePolicyIssues(catalog, provider, profile)
    if (evidenceIssues.length > 0) {
      issues.push(issue({
        code: 'preflight-required-runtime-bundle-evidence-missing',
        target,
        message: 'required runtime bundle provider must have complete activation evidence',
        details: { bundle: requiredBundle, issues: evidenceIssues },
      }))
    }
  }
  return issues
}

function catalogCandidateEntry(candidate: CuratedCandidate, profile: string): CuratedEntry {
  return {
    candidateId: candidate.id,
    pluginName: candidate.expectedPackage as string,
    ownerId: `catalog:${candidate.id}`,
    ownerLabel: candidate.id,
    evidenceSource: 'catalog',
    profile,
    active: true,
    capability: candidate.capability,
    resources: candidate.resources ?? {},
  }
}

function stringRecordOrUndefined(value: unknown): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value) || Object.values(value).some(item => typeof item !== 'string')) return undefined
  return value as Readonly<Record<string, string>>
}

/* jscpd:ignore-start -- Observed validation mirrors the profile package's private dependency-field rule at a process boundary. */
function managedProfileHasAdditionalDependencies(manifest: Readonly<Record<string, unknown>>): boolean {
  return [
    manifest.optionalDependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.bundledDependencies,
    manifest.bundleDependencies,
  ].some(value => value !== undefined && (
    Array.isArray(value)
      ? value.length > 0
      : !isRecord(value) || Object.keys(value).length > 0
  ))
}
/* jscpd:ignore-end */

function profileMetadataIssues(
  profileRoot: string,
  profile: string,
  manifest: Record<string, unknown>,
): CommandIssue[] {
  const issues: CommandIssue[] = []
  const builtInCuratedProfile = isCuratedProfileName(profile)
  let generatedCuratedProfile = false
  if (builtInCuratedProfile) {
    const template = CURATED_PROFILE_TEMPLATES[profile]
    const bundles = recordOrUndefined(recordOrUndefined(manifest.dsh)?.profile)?.bundles
    const exactTemplate = Array.isArray(bundles)
      && bundles.every((bundle): bundle is string => typeof bundle === 'string')
      && sameOrderedStrings(bundles, template.bundles)
    generatedCuratedProfile = exactTemplate && manifest.private === true
    if (exactTemplate) {
      const expectedDependencies = curatedProfileDependenciesForBundles(template.bundles, profile)
      const actualDependencies = stringRecordOrUndefined(manifest.dependencies)
      if (
        manifest.private !== true
        || actualDependencies === undefined
        || !sameStrings(Object.keys(actualDependencies), Object.keys(expectedDependencies))
        || managedProfileHasAdditionalDependencies(manifest)
      ) {
        issues.push(issue({
          code: 'preflight-profile-generated-manifest-mismatch',
          target: 'package.json',
          message: 'curated profile manifest must match generated profile metadata',
        }))
      }
    }
  }
  const npmrcPath = join(profileRoot, '.npmrc')
  if (!existsSync(npmrcPath)) {
    issues.push(issue({
      code: 'preflight-profile-scripts-enabled',
      target: '.npmrc',
      message: 'managed profile must set ignore-scripts=true',
    }))
  }
  if (existsSync(npmrcPath)) {
    const npmrc = readBoundedRegularFile(npmrcPath).toString('utf8')
    const parsedNpmrc = parseNpmrc(npmrc)
    const containsSecret = npmrcContainsSecret(parsedNpmrc)
    const disablesScripts = npmrcDisablesScripts(parsedNpmrc)
    const containsTransformation = npmrcContainsPackageTransformation(parsedNpmrc)
    if (containsSecret) {
      issues.push(issue({
        code: 'preflight-profile-metadata-secret',
        target: '.npmrc',
        message: 'profile package-manager metadata must not contain secret material',
      }))
    }
    if (!disablesScripts) {
      issues.push(issue({
        code: 'preflight-profile-scripts-enabled',
        target: '.npmrc',
        message: 'managed profile must set ignore-scripts=true',
      }))
    }
    if (containsTransformation) {
      issues.push(issue({
        code: 'preflight-profile-package-transformation',
        target: '.npmrc',
        message: 'curated profile must not transform dependency packages',
      }))
    }
    if (
      builtInCuratedProfile
      && npmrc !== CURATED_PROFILE_NPMRC
      && !containsSecret
      && disablesScripts
      && !containsTransformation
    ) {
      issues.push(issue({
        code: 'preflight-profile-package-manager-policy',
        target: '.npmrc',
        message: 'curated profile package-manager metadata must match generated files',
      }))
    }
  }
  const workspacePath = join(profileRoot, 'pnpm-workspace.yaml')
  if (existsSync(workspacePath)) {
    const workspace = loadYamlFile(workspacePath, 'profile workspace metadata')
    if (containsSecretMaterial(workspace)) {
      issues.push(issue({
        code: 'preflight-profile-metadata-secret',
        target: 'pnpm-workspace.yaml',
        message: 'profile package-manager metadata must not contain secret material',
      }))
    }
    if (!isRecord(workspace)) {
      issues.push(issue({
        code: 'preflight-profile-package-transformation',
        target: 'pnpm-workspace.yaml',
        message: 'managed profile workspace metadata must be a mapping',
      }))
    } else {
      if (workspaceContainsBuildGrant(workspace)) {
        issues.push(issue({
          code: 'preflight-profile-build-grant',
          target: 'pnpm-workspace.yaml',
          message: 'curated profile must not grant dependency lifecycle builds',
        }))
      }
      if (workspaceContainsPackageTransformation(workspace)) {
        issues.push(issue({
          code: 'preflight-profile-package-transformation',
          target: 'pnpm-workspace.yaml',
          message: 'curated profile must not transform dependency packages',
        }))
      }
    }
  }
  if (manifest.pnpm !== undefined) {
    const issueCount = issues.length
    if (!isRecord(manifest.pnpm)) {
      issues.push(issue({
        code: 'preflight-profile-package-transformation',
        target: 'package.json',
        message: 'managed profile pnpm metadata must be a mapping',
      }))
    } else if (workspaceContainsBuildGrant(manifest.pnpm)) {
      issues.push(issue({
        code: 'preflight-profile-build-grant',
        target: 'package.json',
        message: 'curated profile must not grant dependency lifecycle builds',
      }))
    }
    if (isRecord(manifest.pnpm) && workspaceContainsPackageTransformation(manifest.pnpm)) {
      issues.push(issue({
        code: 'preflight-profile-package-transformation',
        target: 'package.json',
        message: 'curated profile must not transform dependency packages',
      }))
    }
    if (builtInCuratedProfile && issues.length === issueCount) {
      issues.push(issue({
        code: 'preflight-profile-package-manager-policy',
        target: 'package.json',
        message: 'curated profile package-manager metadata must match generated files',
      }))
    }
  }
  const pnpmfile = PNPMFILE_NAMES.find(name => existsSync(join(profileRoot, name)))
  if (pnpmfile !== undefined) {
    issues.push(issue({
      code: 'preflight-profile-package-transformation',
      target: pnpmfile,
      message: 'curated profile must not transform dependency packages',
    }))
  }
  const lockPaths = [
    join(profileRoot, 'pnpm-lock.yaml'),
    join(profileRoot, 'node_modules/.pnpm/lock.yaml'),
  ]
  if (generatedCuratedProfile && lockPaths.some(path => !existsSync(path))) {
    issues.push(issue({
      code: 'preflight-profile-locks-missing',
      target: profile,
      message: 'observed curated profile requires root and installed pnpm lockfiles',
    }))
  }
  for (const lockPath of lockPaths) {
    if (!existsSync(lockPath)) continue
    const lock = requiredRecord(loadYamlFile(lockPath, `${profile} pnpm lockfile`), `${profile} pnpm lockfile`)
    if (pnpmLockTransformation(lock) !== undefined) {
      issues.push(issue({
        code: 'preflight-profile-package-transformation',
        target: lockPath,
        message: 'curated profile must not transform dependency packages',
      }))
    }
  }
  return issues
}

function assertCuratedPackageManagerPolicy(
  profileRoot: string,
  profile: string,
  manifest: Record<string, unknown>,
): void {
  for (const lockPath of [
    join(profileRoot, 'pnpm-lock.yaml'),
    join(profileRoot, 'node_modules/.pnpm/lock.yaml'),
  ]) {
    if (!existsSync(lockPath)) continue
    const lock = requiredRecord(loadYamlFile(lockPath, `${profile} pnpm lockfile`), `${profile} pnpm lockfile`)
    const transformation = pnpmLockTransformation(lock)
    if (transformation !== undefined) throw new Error(transformation)
  }
  const metadataIssues = profileMetadataIssues(profileRoot, profile, manifest)
  const issue = metadataIssues.find(current =>
    current.code === 'preflight-profile-scripts-enabled'
    || current.code === 'preflight-profile-metadata-secret'
    || current.code === 'preflight-profile-build-grant'
    || current.code === 'preflight-profile-package-transformation'
    || current.code === 'preflight-profile-package-manager-policy')
  const lockIssue = metadataIssues.find(current => current.code === 'preflight-profile-locks-missing')
  const generatedManifestIssue = metadataIssues.find(current =>
    current.code === 'preflight-profile-generated-manifest-mismatch')
  if (issue !== undefined) throw new Error(issue.message)
  if (lockIssue !== undefined) throw new Error(lockIssue.message)
  if (generatedManifestIssue !== undefined) throw new Error(generatedManifestIssue.message)
}

interface NpmrcEntry {
  readonly key: string
  readonly value: string
}

function parseNpmrc(content: string): readonly NpmrcEntry[] {
  const entries: NpmrcEntry[] = []
  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (trimmed.length === 0 || trimmed.startsWith('#') || trimmed.startsWith(';')) continue
    const separator = line.indexOf('=')
    if (separator < 0) continue
    const key = line.slice(0, separator).trim().toLowerCase()
    if (key.length === 0) continue
    entries.push({ key, value: line.slice(separator + 1).trim() })
  }
  return entries
}

function npmrcDisablesScripts(entries: readonly NpmrcEntry[]): boolean {
  const settings = entries.filter(entry => entry.key === 'ignore-scripts')
  if (settings.length !== 1) return false
  const setting = settings[0] as NpmrcEntry
  return /^(?:true)(?:\s*[#;].*)?$/iu.test(setting.value)
}

function npmrcContainsPackageTransformation(entries: readonly NpmrcEntry[]): boolean {
  return entries.some(({ key }) =>
    key === 'pnpmfile' || key === 'global-pnpmfile' || key === 'patches-dir')
}

function workspaceContainsBuildGrant(workspace: Record<string, unknown>): boolean {
  if (
    (workspace.dangerouslyAllowAllBuilds !== undefined && workspace.dangerouslyAllowAllBuilds !== false)
    || (workspace.ignoreScripts !== undefined && workspace.ignoreScripts !== true)
  ) return true
  if (workspace.allowBuilds !== undefined) {
    if (!isRecord(workspace.allowBuilds)) return true
    if (Object.values(workspace.allowBuilds).some(value => value !== false)) return true
  }
  if (workspace.onlyBuiltDependencies !== undefined) {
    if (!Array.isArray(workspace.onlyBuiltDependencies)) return true
    if (workspace.onlyBuiltDependencies.length > 0) return true
  }
  return workspace.onlyBuiltDependenciesFile !== undefined
}

function workspaceContainsPackageTransformation(workspace: Record<string, unknown>): boolean {
  return Object.hasOwn(workspace, 'overrides')
    || Object.hasOwn(workspace, 'patchedDependencies')
    || Object.hasOwn(workspace, 'packageExtensions')
}

function npmrcContainsSecret(entries: readonly NpmrcEntry[]): boolean {
  return entries.some(({ key, value }) =>
    SECRET_KEY_PATTERN.test(key) && value.length > 0
    || containsSecretMaterial(value))
}

/**
 * Check a curated profile's installed artifacts and `dsh --dump-config`/`--help` paths.
 * One execution-work deadline is computed at function entry. Worker construction
 * is synchronous and cannot be preempted; after it returns, the remaining budget
 * is recomputed and exhaustion fails immediately. Worker inspection and child
 * stages are terminable. The production runner receives the remaining budget,
 * owns process-tree termination, and is awaited through temporary-directory
 * cleanup. Injected runners are trusted test controls with the same ownership
 * requirement. The report records staging from before worker construction
 * through settlement and awaited termination; manifest and bundle durations
 * cover only their synchronous checks. Redacted JSON and text reports are
 * limited to 1 MiB after serialization; overflow returns a fixed structured
 * failure without the original errors or profile text. Cleanup clears listeners,
 * references, and timers before awaiting termination, so constructor and
 * termination time can extend total wall-clock duration. A caller requiring a
 * hard operating-system deadline must supervise the CLI process. The command
 * does not import candidate modules, initialize plugins, or start the profile
 * runtime. Source-tree execution launches the source dsh CLI through tsx and
 * the repository paths map; built execution launches the manifest-declared bin
 * under plain Node. Production observed smoke copies the validated profile and
 * optional home patch into a private execution home before launching either
 * child stage, so later writes to the supplied profile path cannot change
 * child inputs.
 * @param args - CLI-style arguments; supports `--profile <id>` and `--json`.
 * @param options - Optional injected templates and runner for local tests.
 * @returns captured status and output.
 */
export async function runSmokeProfile(args: readonly string[], options: SmokeProfileOptions = {}): Promise<CommandResult> {
  const json = args.includes('--json')
  try {
    const now = options.now ?? (() => performance.now())
    const startedAt = now()
    const parsed = parseArgs(args)
    const timeLimitMs = options.timeLimitMs ?? SMOKE_PROFILE_TIME_LIMIT_MS
    const profileRoot = parsed.profileRoot
      ?? (options.profileRoot === undefined ? undefined : exactRoot(options.profileRoot, 'profileRoot'))
    if (profileRoot !== undefined) {
      assertManagedProfileRootPath(profileRoot, parsed.profileRoot === undefined ? 'profileRoot' : '--profile-root')
    }
    if (profileRoot === undefined && options.runner === undefined) {
      return formatSmokeProfileReport(smokeProfileReport(parsed.profile, timeLimitMs, [], [issue({
        code: 'smoke-profile-profile-root-required',
        message: 'observed smoke requires an absolute --profile-root',
      })], false), parsed.json)
    }
    const profiles: Readonly<Record<string, SmokeProfileTemplate>> = options.profiles ?? SMOKE_PROFILE_TEMPLATES
    const template = profiles[parsed.profile]
    const deadline = startedAt + timeLimitMs
    const stagingStartedAt = now()
    let inspectedProfileRoot = profileRoot
    let productionHome: string | undefined
    let executionHome: string | undefined
    try {
      if (options.prepare !== undefined) {
        const prepared = await settleBeforeDeadline(options.prepare(), deadline, now)
        if (!prepared) {
          return stagingTimeoutResult(
            parsed.profile,
            timeLimitMs,
            stagingStartedAt,
            profileRoot !== undefined,
            parsed.json,
            now,
          )
        }
      }
      if (
        profileRoot !== undefined
        && options.runner === undefined
      ) {
        productionHome = observedProfileHome(profileRoot, parsed.profile)
        if (productionHome === undefined) {
          throw new Error(
            `production observed smoke profile root must be $DSH_HOME/profiles/${parsed.profile}`,
          )
        }
        inspectedProfileRoot = realpathSync.native(profileRoot)
      }
      if (profileRoot !== undefined && template !== undefined && Array.isArray(template.bundles)) {
        if (deadline <= now()) {
          return stagingTimeoutResult(parsed.profile, timeLimitMs, stagingStartedAt, true, parsed.json, now)
        }
        const artifactRoots = [
          ...parsed.artifactRoots,
          ...(options.artifactRoots ?? []).map(root => exactRoot(root, 'artifactRoots')),
        ]
        if (usesInjectedSmokeStaging(options)) {
          inspectInstalledSmokeProfile(
            inspectedProfileRoot as string,
            parsed.profile,
            template.bundles,
            createInstalledArtifactResolver([inspectedProfileRoot as string, ...artifactRoots]),
          )
          if (deadline <= now()) {
            return stagingTimeoutResult(parsed.profile, timeLimitMs, stagingStartedAt, true, parsed.json, now)
          }
        } else {
          executionHome = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-home-'))
          const staged = await runSmokeStagingWorker({
            profileRoot: inspectedProfileRoot as string,
            profile: parsed.profile,
            bundles: template.bundles,
            artifactRoots,
            executionHome,
          }, deadline, now, options.stagingWorkerEntry)
          if (staged === undefined) {
            rmSync(executionHome, { recursive: true, force: true })
            executionHome = undefined
            return stagingTimeoutResult(parsed.profile, timeLimitMs, stagingStartedAt, true, parsed.json, now)
          }
          if (!staged.ok) {
            if ('issues' in staged) throw new InstalledArtifactValidationError(staged.issues)
            throw new Error(staged.error)
          }
        }
      }
    } catch (error) {
      if (executionHome !== undefined) rmSync(executionHome, { recursive: true, force: true })
      return stagingFailureResult(
        parsed.profile,
        timeLimitMs,
        stagingStartedAt,
        profileRoot !== undefined,
        parsed.json,
        error,
        now,
      )
    }
    const staging: SmokeProfileStageResult = {
      name: 'staging',
      ok: true,
      durationMs: Math.max(0, now() - stagingStartedAt),
    }
    const runner = options.runner
      ?? createInstalledSmokeProfileRunner(productionHome as string, options.childEnv)
    try {
      const report = await createSmokeProfileReport(parsed.profile, {
        profiles,
        runner,
        timeLimitMs,
        artifactRoots: options.artifactRoots ?? [dirname(DSH_INSTALL_ANCHOR)],
      }, staging, startedAt, now, executionHome)
      return formatSmokeProfileReport({ ...report, observed: profileRoot !== undefined }, parsed.json)
    } finally {
      if (executionHome !== undefined) rmSync(executionHome, { recursive: true, force: true })
    }
  } catch (error) {
    return formatThrown('smoke-profile', error, json)
  }
}

/**
 * Compare a candidate benchmark dataset after structural and comparability checks.
 * Completed observed and fixture JSON output retains execution provenance,
 * aggregate summaries, decisions, reasons, and snapshots, but not raw runs.
 * Planned pending JSON output contains only `command`, `ok`, `evidenceKind`,
 * `status`, `pendingCampaigns`, `baseline.profile`, and `candidate.profile`.
 * The evidence kind is caller-declared, and producer identity is not authenticated.
 * @param args - CLI-style arguments; supports `--fixture <path>` and `--json`.
 * @returns captured status and output.
 */
export function runCompareBenchmark(args: readonly string[]): CommandResult {
  try {
    const parsed = parseArgs(args)
    const dataset = loadBenchmarkDataset(parsed.fixture ?? COMPARE_BENCHMARK_DEFAULT_FIXTURE)
    validateComparableProfiles(dataset)
    if (isPendingBenchmarkDataset(dataset)) return formatPendingBenchmark(dataset, parsed.json)
    const comparison = compareBenchmark(dataset)
    return formatBenchmarkComparison(comparison, parsed.json)
  } catch (error) {
    return formatThrown('compare-benchmark', error, args.includes('--json'))
  }
}

/**
 * Create a runner that executes the real `dsh` launcher with a timeout.
 * The child receives only cross-platform launch, locale, validated credential-
 * free proxy, and explicit DSH variables. Proxy values fail closed unless they
 * are HTTP(S) origins with no userinfo, query, or fragment; NO_PROXY-style
 * variables accept only validated non-URL bypass lists. Userinfo is redacted
 * from output.
 * On POSIX, each child runs in an isolated process group and a fresh 0700
 * directory with dotenv loading disabled. Timeout cleanup escalates TERM to
 * KILL and awaits group quiescence before removing the directory. A top-level
 * success with residual descendants is cleaned up and returned as a failure.
 * Windows returns a structured failure before spawn until a Job Object runner
 * can prove descendant quiescence. Captured and returned redacted stdout and
 * stderr share a 1 MiB limit; overflow follows timeout cleanup and returns only
 * a bounded diagnostic.
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
  return async (request) => {
    const started = performance.now()
    if ((options.platform ?? process.platform) === 'win32') {
      return {
        status: 1,
        exitCode: null,
        signal: null,
        stdout: '',
        stderr: 'observed smoke is unsupported on Windows until a Job Object child runner is available',
        durationMs: Math.max(0, performance.now() - started),
        timedOut: false,
      }
    }
    const args = request.stage === 'dump-config'
      ? [...baseArgs, '--profile', request.profile, '--dump-config']
      : [...baseArgs, '--profile', request.profile, '--help']
    const spawnChild = options.spawn ?? spawn
    const cwd = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-child-'))
    try {
      chmodSync(cwd, 0o700)
      const child = spawnChild(command, args, {
        cwd,
        env: smokeChildEnv(options.env),
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      })
      const stdout: Buffer[] = []
      const stderr: Buffer[] = []
      let capturedOutputBytes = 0
      let resolveOutputLimit!: (stream: 'stdout' | 'stderr') => void
      const outputLimit = new Promise<'stdout' | 'stderr'>((resolveLimit) => {
        resolveOutputLimit = resolveLimit
      })
      let outputExceeded: 'stdout' | 'stderr' | undefined
      const capture = (chunks: Buffer[], stream: 'stdout' | 'stderr', chunk: Buffer): void => {
        if (outputExceeded !== undefined) return
        const remaining = SMOKE_CHILD_MAX_OUTPUT_BYTES - capturedOutputBytes
        if (chunk.byteLength <= remaining) {
          chunks.push(chunk)
          capturedOutputBytes += chunk.byteLength
          return
        }
        chunks.push(chunk.subarray(0, remaining))
        capturedOutputBytes = SMOKE_CHILD_MAX_OUTPUT_BYTES
        outputExceeded = stream
        resolveOutputLimit(stream)
      }
      child.stdout.on('data', (chunk: Buffer) => { capture(stdout, 'stdout', chunk) })
      child.stderr.on('data', (chunk: Buffer) => { capture(stderr, 'stderr', chunk) })
      const outcome = childOutcome(child)
      const settled = await settleChildBeforeTimeout(
        Promise.race([
          outcome.then(result => ({ kind: 'outcome' as const, result })),
          outputLimit.then(stream => ({ kind: 'output-limit' as const, stream })),
        ]),
        Math.max(1, Math.floor(request.timeoutMs)),
      )
      const timedOut = settled === undefined
      outputExceeded = settled?.kind === 'output-limit' ? settled.stream : outputExceeded
      const residualProcessTree = settled?.kind === 'outcome' && smokeProcessTreeAlive(child)
      if (timedOut || outputExceeded !== undefined || residualProcessTree) {
        await terminateSmokeProcessTree(child)
      }
      const result = settled?.kind === 'outcome' ? settled.result : await outcome
      const outputLimitDiagnostic = outputExceeded === undefined
        ? undefined
        : `smoke-profile child ${outputExceeded} output exceeded ${String(SMOKE_CHILD_MAX_OUTPUT_BYTES)}-byte capture limit`
      const stderrDiagnostic = outputLimitDiagnostic
        ?? (residualProcessTree ? SMOKE_CHILD_RESIDUAL_TREE_DIAGNOSTIC : undefined)
      const redactedStdout = outputLimitDiagnostic === undefined
        ? redactSecretText(Buffer.concat(stdout).toString('utf8'))
        : ''
      const redactedStderr = stderrDiagnostic ?? redactSecretText(Buffer.concat(stderr).toString('utf8'))
      const redactedStdoutBytes = Buffer.byteLength(redactedStdout)
      const redactedOutputExceeded =
        redactedStdoutBytes + Buffer.byteLength(redactedStderr) > SMOKE_CHILD_MAX_OUTPUT_BYTES
      const redactedOutputLimitStream = redactedStdoutBytes > SMOKE_CHILD_MAX_OUTPUT_BYTES
        ? 'stdout'
        : 'stderr'
      const redactedOutputLimitDiagnostic =
        `smoke-profile child ${redactedOutputLimitStream} output exceeded `
        + `${String(SMOKE_CHILD_MAX_OUTPUT_BYTES)}-byte capture limit`
      return {
        status: timedOut
          ? 124
          : outputExceeded === undefined
            && !redactedOutputExceeded
            && !residualProcessTree
            && !result.spawnFailed
            ? result.status ?? 1
            : 1,
        exitCode: result.status,
        signal: result.signal,
        stdout: redactedOutputExceeded ? '' : redactedStdout,
        stderr: redactedOutputExceeded
          ? stderrDiagnostic ?? redactedOutputLimitDiagnostic
          : redactedStderr,
        durationMs: Math.max(0, performance.now() - started),
        timedOut,
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  }
}

interface SmokeChildOutcome {
  readonly spawnFailed: boolean
  readonly status: number | null
  readonly signal: NodeJS.Signals | null
}

function childOutcome(child: ChildProcess): Promise<SmokeChildOutcome> {
  return new Promise((resolveOutcome) => {
    let spawnFailed = false
    child.once('error', () => {
      spawnFailed = true
    })
    child.once('close', (status, signal) => { resolveOutcome({ spawnFailed, status, signal }) })
  })
}

async function settleChildBeforeTimeout<T>(
  outcome: Promise<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      outcome,
      new Promise<undefined>((resolveTimeout) => {
        timer = setTimeout(() => { resolveTimeout(undefined) }, timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timer as NodeJS.Timeout)
  }
}

async function terminateSmokeProcessTree(child: ChildProcess): Promise<void> {
  signalSmokeProcessTree(child, 'SIGTERM')
  if (await waitForSmokeProcessTreeExit(child, 250)) return
  signalSmokeProcessTree(child, 'SIGKILL')
  await waitForSmokeProcessTreeExit(child)
}

function signalSmokeProcessTree(child: ChildProcess, signal: 'SIGTERM' | 'SIGKILL'): void {
  const pid = child.pid
  /* v8 ignore next -- spawn failures settle before the runner enters tree cleanup. */
  if (pid === undefined || pid <= 0) return
  try {
    process.kill(-pid, signal)
  /* v8 ignore start -- the group-exit race cannot be scheduled deterministically. */
  } catch (_processGroupAlreadyExited) {
    try {
      child.kill(signal)
    } catch (_childAlreadyExited) {
      // Both targets are absent, so the requested signal is already satisfied.
    }
  }
  /* v8 ignore stop */
}

async function waitForSmokeProcessTreeExit(child: ChildProcess, timeoutMs?: number): Promise<boolean> {
  const deadline = timeoutMs === undefined ? Number.POSITIVE_INFINITY : Date.now() + timeoutMs
  while (smokeProcessTreeAlive(child)) {
    if (Date.now() >= deadline) return false
    await new Promise(resolveTick => setTimeout(resolveTick, 15))
  }
  return true
}

function smokeProcessTreeAlive(child: ChildProcess): boolean {
  const pid = child.pid
  if (pid === undefined || pid <= 0) return false
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
    return child.exitCode === null && child.signalCode === null
  }
}

function createInstalledSmokeProfileRunner(home: string, childEnv: NodeJS.ProcessEnv = {}): SmokeProfileRunner {
  const launch = resolveDshCliLaunch()
  const child = createSmokeProfileChildRunner(
    launch.command,
    launch.args,
    { env: { ...childEnv, DSH_HOME: home, DSH_TELEMETRY_DISABLED: '1' } },
  )
  return request => request.home === undefined
    ? child(request)
    : createSmokeProfileChildRunner(
      launch.command,
      launch.args,
      { env: { ...childEnv, DSH_HOME: request.home, DSH_TELEMETRY_DISABLED: '1' } },
    )(request)
}

function profileManifestNameIssue(
  manifest: Record<string, unknown>,
  profile: string,
): readonly CommandIssue[] {
  return manifest.name === `dsh-profile-${profile}`
    ? []
    : [issue({
      code: 'preflight-profile-name-mismatch',
      target: profile,
      message: `observed profile manifest name must be dsh-profile-${profile}`,
    })]
}

function assertManagedProfileRootPath(profileRoot: string, label: string): void {
  const profilesRoot = dirname(profileRoot)
  const homeRoot = dirname(profilesRoot)
  for (const path of [homeRoot, profilesRoot, profileRoot]) {
    if (!existsSync(path)) continue
    const entry = lstatSync(path)
    if (entry.isSymbolicLink()) {
      throw new Error(`${label} must not contain symbolic-link or junction components`)
    }
    if (!entry.isDirectory()) throw new Error(`${label} components must be directories`)
  }
}

function observedProfileHome(profileRoot: string, profile: string): string | undefined {
  const canonicalProfileRoot = realpathSync.native(profileRoot)
  const profilesRoot = dirname(canonicalProfileRoot)
  if (basename(canonicalProfileRoot) !== profile || basename(profilesRoot) !== 'profiles') {
    return undefined
  }
  return dirname(profilesRoot)
}

function resolveDshCliLaunch(): { readonly command: string; readonly args: readonly string[] } {
  const packageRoot = dirname(DSH_INSTALL_ANCHOR)
  /* v8 ignore else -- built-package smoke covers the emitted plain-Node branch in a child process. */
  if (fileURLToPath(import.meta.url).endsWith(`${sep}src${sep}index.ts`)) {
    const repositoryRoot = resolve(packageRoot, '../..')
    return {
      command: process.execPath,
      args: [
        createRequire(import.meta.url).resolve('tsx/cli'),
        '--tsconfig',
        join(repositoryRoot, 'tsconfig.json'),
        join(packageRoot, 'src/bin.ts'),
      ],
    }
  }
  /* v8 ignore start -- child-process coverage cannot attribute the built-package smoke here. */
  const manifest = JSON.parse(readBoundedRegularFile(DSH_INSTALL_ANCHOR).toString('utf8')) as { bin: { dsh: string } }
  return { command: process.execPath, args: [resolve(packageRoot, manifest.bin.dsh)] }
  /* v8 ignore stop */
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
  return path.startsWith('./') && isSafeRelativeArtifactPath(path) && !path.endsWith('/')
}

function findCandidatePackageDir(packageName: string, artifactRoots: readonly string[]): string | undefined {
  for (const root of artifactRoots) {
    const direct = join(root, 'node_modules', packageName, 'package.json')
    if (existsSync(direct)) return canonicalPackageRoot(dirname(direct))
    try {
      return canonicalPackageRoot(dirname(
        createRequire(join(root, 'package.json')).resolve(`${packageName}/package.json`),
      ))
    } catch {
      // Continue through the explicit roots before failing closed.
    }
  }
  return undefined
}

function materializeSmokeExecutionHome(
  profileRoot: string,
  home: string,
  executionHome: string,
  profile: string,
  bundles: readonly string[],
  artifactRoots: readonly string[],
): void {
  chmodSync(executionHome, 0o700)
  const executionProfileRoot = join(executionHome, 'profiles', profile)
  mkdirSync(dirname(executionProfileRoot), { recursive: true, mode: 0o700 })
  cpSync(profileRoot, executionProfileRoot, {
    recursive: true,
    dereference: false,
    verbatimSymlinks: true,
  })
  const homePatch = join(home, 'cordis.patch.yml')
  if (existsSync(homePatch)) {
    const content = readBoundedRegularFile(homePatch)
    writeFileSync(join(executionHome, 'cordis.patch.yml'), content, { flag: 'wx', mode: 0o600 })
  }
  inspectInstalledSmokeProfile(
    executionProfileRoot,
    profile,
    bundles,
    createInstalledArtifactResolver([executionProfileRoot, ...artifactRoots]),
  )
}

function inspectInstalledSmokeProfile(
  profileRoot: string,
  profile: string,
  bundles: readonly string[],
  resolver: CuratedArtifactResolver,
): void {
  const manifest = JSON.parse(readBoundedRegularFile(join(profileRoot, 'package.json')).toString('utf8')) as unknown
  const record = requiredRecord(manifest, `profile ${profile} manifest`)
  const nameIssue = profileManifestNameIssue(record, profile)
  if (nameIssue.length > 0) throw new InstalledArtifactValidationError(nameIssue)
  const dsh = recordOrUndefined(record.dsh)
  const profileManifest = recordOrUndefined(dsh?.profile)
  const installedBundles = profileManifest?.bundles
  const installedBundleNames = Array.isArray(installedBundles) && installedBundles.every((item): item is string => typeof item === 'string')
    ? installedBundles
    : undefined
  if (installedBundleNames === undefined || !sameOrderedStrings(installedBundleNames, bundles)) {
    throw new Error(`installed profile ${profile} bundle list does not match the selected template`)
  }
  assertCuratedPackageManagerPolicy(profileRoot, profile, record)
  const catalog = loadCuratedCatalog()
  const candidates = new Map(catalog.candidates.flatMap(candidate =>
    candidate.expectedPackage === null ? [] : [[candidate.expectedPackage, candidate] as const]))
  const selectedBundles = new Set(bundles)
  for (const bundle of bundles) {
    const candidate = candidates.get(bundle)
    if (candidate === undefined) continue
    validateSmokeCandidateMetadata(profile, bundle, candidate)
    const providerIssues = requiredRuntimeBundleIssues(
      catalog,
      candidates,
      candidate,
      profile,
      selectedBundles,
      bundle,
    )
    if (providerIssues.length > 0) throw new InstalledArtifactValidationError(providerIssues)
    const inspected = inspectResolvedArtifact(candidate, resolver, process.versions.node)
    if (inspected.issues.length > 0) throw new InstalledArtifactValidationError(inspected.issues)
  }
}

/**
 * Inspect the complete observed staging input and return serializable diagnostics.
 * @param input - Profile paths and selected bundles supplied by the parent.
 * @returns success or redacted staging diagnostics.
 */
export function inspectSmokeProfileStaging(input: SmokeProfileStagingInput): SmokeProfileStagingResult {
  try {
    if (input.executionHome === undefined) {
      inspectInstalledSmokeProfile(
        input.profileRoot,
        input.profile,
        input.bundles,
        createInstalledArtifactResolver([input.profileRoot, ...input.artifactRoots]),
      )
    } else {
      const home = observedProfileHome(input.profileRoot, input.profile)
      if (home === undefined) throw new Error('smoke execution staging requires a canonical managed profile')
      materializeSmokeExecutionHome(
        input.profileRoot,
        home,
        input.executionHome,
        input.profile,
        input.bundles,
        input.artifactRoots,
      )
    }
    return { ok: true }
  } catch (error) {
    if (error instanceof InstalledArtifactValidationError) {
      return { ok: false, issues: error.issues }
    }
    return { ok: false, error: errorMessage(error) }
  }
}

class InstalledArtifactValidationError extends Error {
  constructor(readonly issues: readonly CommandIssue[]) {
    super(issues.map(current => current.message).join('; '))
  }
}

function usesInjectedSmokeStaging(options: SmokeProfileOptions): boolean {
  return options.stagingWorkerEntry === undefined
    && (options.profiles !== undefined || options.artifactRoots !== undefined)
}

async function runSmokeStagingWorker(
  input: SmokeProfileStagingInput,
  deadline: number,
  now: () => number,
  entryOverride?: string | URL,
): Promise<SmokeProfileStagingResult | undefined> {
  const remainingBeforeConstruction = Math.max(0, deadline - now())
  /* v8 ignore next -- the caller checks the same monotonic deadline immediately before this race guard */
  if (remainingBeforeConstruction <= 0) return undefined
  const { entry, options } = resolveSmokeStagingWorker(input, entryOverride)
  const worker = new Worker(entry, options)
  let timer: NodeJS.Timeout | undefined
  try {
    const remaining = Math.max(0, deadline - now())
    if (remaining <= 0) return undefined
    return await new Promise<SmokeProfileStagingResult | undefined>((resolveResult, reject) => {
      let settled = false
      const settle = (result: SmokeProfileStagingResult | undefined): void => {
        /* v8 ignore next -- only a timer/message callback already queued during settlement can reenter */
        if (settled) return
        settled = true
        resolveResult(result)
      }
      const fail = (error: Error): void => {
        /* v8 ignore next -- only a worker callback already queued during settlement can reenter */
        if (settled) return
        settled = true
        reject(error)
      }
      worker.once('message', (message: unknown) => {
        if (!isSmokeProfileStagingResult(message)) {
          fail(new Error('smoke-profile staging worker returned an invalid result'))
          return
        }
        settle(message)
      })
      /* v8 ignore next 3 -- the package worker posts only the validated JSON-compatible result union */
      worker.once('messageerror', () => {
        fail(new Error('smoke-profile staging worker result could not be deserialized'))
      })
      worker.once('error', fail)
      worker.once('exit', (code) => {
        fail(new Error(`smoke-profile staging worker exited with status ${String(code)}`))
      })
      timer = setTimeout(() => {
        settle(undefined)
      }, remaining)
    })
  } finally {
    clearTimeout(timer as NodeJS.Timeout)
    worker.removeAllListeners()
    worker.unref()
    await worker.terminate()
  }
}

function resolveSmokeStagingWorker(
  input: SmokeProfileStagingInput,
  entryOverride?: string | URL,
): { readonly entry: string | URL; readonly options: WorkerOptions } {
  const options: WorkerOptions = {
    workerData: input,
    env: {},
    execArgv: [],
  }
  if (entryOverride !== undefined) return { entry: entryOverride, options }
  /* v8 ignore next 3 -- built-package smoke exercises the emitted sibling worker, outside source coverage */
  if (!fileURLToPath(import.meta.url).endsWith('.ts')) {
    return { entry: fileURLToPath(new URL('./staging-worker.js', import.meta.url)), options }
  }
  const workerEntry = new URL('./staging-worker.ts', import.meta.url)
  const tsxEsmApiEntry = import.meta.resolve(['tsx', 'esm', 'api'].join('/'))
  const tsxCjsApiEntry = import.meta.resolve(['tsx', 'cjs', 'api'].join('/'))
  /* jscpd:ignore-start -- The smoke worker owns a zero environment; workflow bootstrap retains separate tsconfig and lifecycle policy. */
  const bootstrap = [
    `import { register as registerEsm } from ${JSON.stringify(tsxEsmApiEntry)}`,
    `import { register as registerCjs } from ${JSON.stringify(tsxCjsApiEntry)}`,
    'registerCjs()',
    'registerEsm()',
    `await import(${JSON.stringify(workerEntry.href)})`,
  ].join('\n')
  return {
    entry: new URL(`data:text/javascript,${encodeURIComponent(bootstrap)}`),
    options,
  }
  /* jscpd:ignore-end */
}

function isSmokeProfileStagingResult(value: unknown): value is SmokeProfileStagingResult {
  if (!isRecord(value) || typeof value.ok !== 'boolean') return false
  if (value.ok) return Object.keys(value).length === 1
  const hasError = Object.hasOwn(value, 'error')
  const hasIssues = Object.hasOwn(value, 'issues')
  if (hasError === hasIssues || Object.keys(value).length !== 2) return false
  if (hasError) return typeof value.error === 'string' && value.error.length > 0
  if (!Array.isArray(value.issues)) return false
  return value.issues.length > 0 && value.issues.every(current =>
    isRecord(current)
    && typeof current.code === 'string' && current.code.length > 0
    && typeof current.message === 'string' && current.message.length > 0
    && (current.target === undefined || typeof current.target === 'string'))
}

async function createSmokeProfileReport(
  profile: string,
  options: Required<Pick<SmokeProfileOptions, 'profiles' | 'runner' | 'timeLimitMs' | 'artifactRoots'>>,
  staging: SmokeProfileStageResult,
  startedAt: number,
  now: () => number,
  executionHome?: string,
): Promise<SmokeProfileReport> {
  const stages: SmokeProfileStageResult[] = [staging]
  const issues: CommandIssue[] = []
  const template = options.profiles[profile]
  const deadline = startedAt + options.timeLimitMs

  const manifestStartedAt = now()
  if (!isValidProfileName(profile) || template === undefined) {
    const manifestIssue = issue({
      code: 'smoke-profile-profile-invalid',
      target: profile,
      message: 'profile must name a known shipped or curated profile without path separators',
    })
    issues.push(manifestIssue)
    stages.push({
      name: 'manifest',
      ok: false,
      durationMs: Math.max(0, now() - manifestStartedAt),
      error: manifestIssue.message,
    })
    return smokeProfileReport(profile, options.timeLimitMs, stages, issues)
  }

  stages.push({
    name: 'manifest',
    ok: true,
    durationMs: Math.max(0, now() - manifestStartedAt),
  })
  const bundleStartedAt = now()
  const bundles = Array.isArray(template.bundles) ? template.bundles : []
  const bundleIssues = validateProfileBundles(profile, bundles)
  if (bundleIssues.length > 0) {
    issues.push(...bundleIssues)
    stages.push({
      name: 'bundle-parse',
      ok: false,
      durationMs: Math.max(0, now() - bundleStartedAt),
      error: bundleIssues.map(current => current.message).join('; '),
    })
    return smokeProfileReport(profile, options.timeLimitMs, stages, uniqueIssues(issues))
  }

  stages.push({
    name: 'bundle-parse',
    ok: true,
    durationMs: Math.max(0, now() - bundleStartedAt),
  })
  for (const stage of ['dump-config', 'help'] as const) {
    const timeoutMs = Math.max(0, Math.floor(deadline - now()))
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
    const result = await options.runner({
      stage,
      profile,
      bundles,
      timeoutMs,
      ...executionHome === undefined ? {} : { home: executionHome },
    })
    const stageIssue = smokeStageIssue(stage, result)
    const stageResult = smokeStageResult(stage, result, stageIssue)
    stages.push(stageResult)
    const aggregateIssue = stageIssue === undefined && now() >= deadline
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

async function settleBeforeDeadline(
  operation: Promise<void>,
  deadline: number,
  now: () => number,
): Promise<boolean> {
  const remaining = Math.max(0, deadline - now())
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
  stagingStartedAt: number,
  observed: boolean,
  json: boolean,
  now: () => number,
): CommandResult {
  const timeoutIssue = issue({
    code: 'smoke-profile-command-timeout',
    target: 'staging',
    message: 'smoke-profile budget exhausted during staging',
  })
  return formatSmokeProfileReport(smokeProfileReport(profile, timeLimitMs, [{
    name: 'staging',
    ok: false,
    durationMs: Math.max(0, now() - stagingStartedAt),
    error: timeoutIssue.message,
  }], [timeoutIssue], observed), json)
}

function stagingFailureResult(
  profile: string,
  timeLimitMs: number,
  stagingStartedAt: number,
  observed: boolean,
  json: boolean,
  error: unknown,
  now: () => number,
): CommandResult {
  const artifactIssues = error instanceof InstalledArtifactValidationError ? error.issues : undefined
  const stagingIssue = issue({
    code: 'smoke-profile-input-invalid',
    message: errorMessage(error),
  })
  const issues = artifactIssues ?? [stagingIssue]
  return formatSmokeProfileReport(smokeProfileReport(profile, timeLimitMs, [{
    name: 'staging',
    ok: false,
    durationMs: Math.max(0, now() - stagingStartedAt),
    error: stagingIssue.message,
  }], issues, observed), json)
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
    if (bundle.length === 0) {
      issues.push(issue({
        code: 'smoke-profile-bundle-invalid',
        target: profile,
        message: 'profile bundle names must be non-empty strings',
      }))
    }
  }
  if (bundles.includes('@deepseek-ai/dsh-curated-base')) loadPatchEntries(PREFLIGHT_DEFAULT_PATCH, true)
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
    ...result.exitCode === undefined ? {} : { exitCode: result.exitCode },
    ...result.signal === undefined ? {} : { signal: result.signal },
    ...result.timedOut === undefined ? {} : { timedOut: result.timedOut },
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
  const redactedReport = { ...report, profile: redactSecretText(report.profile) }
  const status = redactedReport.ok ? 0 : 1
  const stdout = renderSmokeProfileReport(redactedReport, json)
  if (Buffer.byteLength(stdout) <= SMOKE_REPORT_MAX_OUTPUT_BYTES) {
    return { status, stdout, stderr: '' }
  }
  const boundedReport: SmokeProfileReport = {
    ...redactedReport,
    ok: false,
    profile: '[REDACTED]',
    stages: report.stages.map(({ error: _error, ...stage }) => stage),
    issues: [issue({
      code: 'smoke-profile-output-limit',
      message: SMOKE_REPORT_OUTPUT_LIMIT_DIAGNOSTIC,
    })],
  }
  return { status: 1, stdout: renderSmokeProfileReport(boundedReport, json), stderr: '' }
}

function renderSmokeProfileReport(report: SmokeProfileReport, json: boolean): string {
  if (json) return `${JSON.stringify(report)}\n`
  const stages = report.stages.map(renderSmokeProfileStage).join('')
  if (report.ok) {
    return `smoke-profile: ok (profile ${report.profile})\n${stages}`
  }
  return `smoke-profile: failed (profile ${report.profile}, ${String(report.issues.length)} issues)\n`
    + stages
    + report.issues.map(renderIssue).join('')
}

function renderSmokeProfileStage(stage: SmokeProfileStageResult): string {
  const status = stage.status === undefined ? '' : `, status ${String(stage.status)}`
  return `${stage.name}: ${stage.ok ? 'ok' : 'failed'} (${String(stage.durationMs)} ms${status})\n`
}

function isValidProfileName(profile: string): boolean {
  return PROFILE_NAME_PATTERN.test(profile) && profile !== 'node_modules'
}

function loadBenchmarkDataset(path: string): BenchmarkDataset {
  const parsed = JSON.parse(readBoundedRegularFile(path).toString('utf8')) as unknown
  if (!isRecord(parsed)) throw new Error('benchmark fixture must be a JSON object')
  if (containsSecretMaterial(parsed)) throw new Error('benchmark fixture must not contain secret material')
  if (parsed.schemaVersion !== 3) throw new Error('benchmark fixture.schemaVersion must be 3')
  const evidenceKind = evidenceKindValue(parsed.evidenceKind)
  const pendingCampaigns = optionalUniqueStringArray(parsed.pendingCampaigns, 'pendingCampaigns')
  if (evidenceKind === 'planned' && pendingCampaigns.length === 0) {
    throw new Error('planned benchmark evidence must declare pendingCampaigns')
  }
  const baselineInput = requiredRecord(parsed.baseline, 'baseline')
  const candidateInput = requiredRecord(parsed.candidate, 'candidate')
  const allowEmptyRuns = evidenceKind === 'planned'
    && pendingCampaigns.length > 0
    && Array.isArray(baselineInput.runs)
    && baselineInput.runs.length === 0
    && Array.isArray(candidateInput.runs)
    && candidateInput.runs.length === 0
  const previousSnapshots = requiredRecord(parsed.previousSnapshots, 'previousSnapshots')
  const dataset = {
    evidenceKind,
    pendingCampaigns,
    requiredCriticalTaskIds: allowEmptyRuns
      ? optionalUniqueStringArray(parsed.requiredCriticalTaskIds, 'requiredCriticalTaskIds')
      : requiredUniqueStringArray(parsed.requiredCriticalTaskIds, 'requiredCriticalTaskIds'),
    previousSnapshots: {
      lock: readRollbackSnapshot(previousSnapshots.lock, 'previousSnapshots.lock', 'curated-lock-snapshot'),
      profile: readRollbackSnapshot(previousSnapshots.profile, 'previousSnapshots.profile', 'curated-profile-snapshot'),
    },
    baseline: readBenchmarkProfile(path, baselineInput, 'baseline', allowEmptyRuns),
    candidate: readBenchmarkProfile(path, candidateInput, 'candidate', allowEmptyRuns),
  }
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
  assertBenchmarkSnapshotSchemaVersion(snapshot, `${label}.snapshot`)
  if (snapshot.kind !== expectedKind) throw new Error(`${label}.snapshot.kind must be ${expectedKind}`)
  requiredString(snapshot.profile, `${label}.snapshot.profile`)
  if (expectedKind === 'curated-lock-snapshot') {
    if ('catalogRef' in snapshot) throw new Error(`${label}.snapshot must not depend on a mutable catalogRef`)
    assertBenchmarkLockSnapshotCandidates(snapshot, `${label}.snapshot`)
  } else {
    assertBenchmarkProfileSnapshotBundles(snapshot, `${label}.snapshot`)
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
    build: readBenchmarkBuildIdentity(execution.build, `${label}.build`),
    measurement: readBenchmarkMeasurementIdentity(execution.measurement, `${label}.measurement`),
  }
}

function readBenchmarkBuildIdentity(value: unknown, label: string): BenchmarkBuildIdentity {
  const build = requiredRecord(value, label)
  assertExactBenchmarkFields(build, [
    'artifactSha256',
    'dshVersion',
    'nodeVersion',
    'sourceDirty',
    'sourceRevision',
    'sourceTreeSha256',
  ], label)
  const dshVersion = requiredString(build.dshVersion, `${label}.dshVersion`)
  if (!isExactNpmVersion(dshVersion)) throw new Error(`${label}.dshVersion must be an exact SemVer version`)
  const sourceRevision = benchmarkFullGitSha(build.sourceRevision, `${label}.sourceRevision`)
  const sourceTreeSha256 = benchmarkSha256(build.sourceTreeSha256, `${label}.sourceTreeSha256`)
  const artifactSha256 = benchmarkSha256(build.artifactSha256, `${label}.artifactSha256`)
  if (typeof build.sourceDirty !== 'boolean') throw new Error(`${label}.sourceDirty must be a boolean`)
  const nodeVersion = requiredString(build.nodeVersion, `${label}.nodeVersion`)
  if (!isExactNpmVersion(nodeVersion)) throw new Error(`${label}.nodeVersion must be an exact SemVer version`)
  return {
    dshVersion,
    sourceRevision,
    sourceTreeSha256,
    sourceDirty: build.sourceDirty,
    artifactSha256,
    nodeVersion,
  }
}

function readBenchmarkMeasurementIdentity(value: unknown, label: string): BenchmarkMeasurementIdentity {
  const measurement = requiredRecord(value, label)
  const fields = ['pricing', 'producer', 'scoring', 'serialization', 'timing', 'tokenizer'] as const
  assertExactBenchmarkFields(measurement, fields, label)
  return {
    producer: requiredString(measurement.producer, `${label}.producer`),
    tokenizer: requiredString(measurement.tokenizer, `${label}.tokenizer`),
    serialization: requiredString(measurement.serialization, `${label}.serialization`),
    timing: requiredString(measurement.timing, `${label}.timing`),
    pricing: requiredString(measurement.pricing, `${label}.pricing`),
    scoring: requiredString(measurement.scoring, `${label}.scoring`),
  }
}

function assertExactBenchmarkFields(
  value: Readonly<Record<string, unknown>>,
  fields: readonly string[],
  label: string,
): void {
  if (canonicalBenchmarkJson(Object.keys(value).sort()) !== canonicalBenchmarkJson([...fields].sort())) {
    throw new Error(`${label} must contain exactly ${fields.join(', ').replace(/, ([^,]+)$/u, ', and $1')}`)
  }
}

function isRepeatedDigestUnit(value: string): boolean {
  return /^(.)\1+$/u.test(value) || /^(.{2})\1+$/u.test(value)
}

function benchmarkSha256(value: unknown, label: string): string {
  const digest = requiredString(value, label)
  if (!SHA256_PATTERN.test(digest) || isRepeatedDigestUnit(digest)) {
    throw new Error(`${label} must be a non-placeholder lowercase SHA-256 digest`)
  }
  return digest
}

function benchmarkFullGitSha(value: unknown, label: string): string {
  const revision = requiredString(value, label)
  if (!/^[0-9a-f]{40}$/u.test(revision) || isRepeatedDigestUnit(revision)) {
    throw new Error(`${label} must be a full non-placeholder lowercase Git SHA`)
  }
  return revision
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

function isPendingBenchmarkDataset(dataset: BenchmarkDataset): boolean {
  return dataset.evidenceKind === 'planned'
    && dataset.pendingCampaigns.length > 0
    && dataset.baseline.runs.length === 0
    && dataset.candidate.runs.length === 0
}

function validateComparableProfiles(dataset: BenchmarkDataset): asserts dataset is ComparableBenchmarkDataset {
  const { baseline, candidate } = dataset
  if (dataset.previousSnapshots.lock.snapshot.profile !== baseline.profile) {
    throw new Error('previousSnapshots.lock.snapshot.profile must match baseline.profile')
  }
  if (dataset.previousSnapshots.profile.snapshot.profile !== baseline.profile) {
    throw new Error('previousSnapshots.profile.snapshot.profile must match baseline.profile')
  }
  const baselineLock = baseline.lockSnapshot.snapshot
  const baselineProfile = baseline.profileSnapshot.snapshot
  if (canonicalBenchmarkJson(baselineLock) !== canonicalBenchmarkJson(dataset.previousSnapshots.lock.snapshot)) {
    throw new Error('previousSnapshots.lock.snapshot must equal the canonical baseline.lockSnapshot content')
  }
  if (canonicalBenchmarkJson(baselineProfile) !== canonicalBenchmarkJson(dataset.previousSnapshots.profile.snapshot)) {
    throw new Error('previousSnapshots.profile.snapshot must equal the canonical baseline.profileSnapshot content')
  }
  assertBenchmarkProfileTemplate(baseline.profile, baselineProfile, 'baseline.profileSnapshot')
  assertBenchmarkProfileTemplate(candidate.profile, candidate.profileSnapshot.snapshot, 'candidate.profileSnapshot')
  assertBenchmarkSnapshotPair(
    dataset.previousSnapshots.lock.snapshot,
    dataset.previousSnapshots.profile.snapshot,
    'previousSnapshots',
  )
  assertBenchmarkSnapshotPair(
    candidate.lockSnapshot.snapshot,
    candidate.profileSnapshot.snapshot,
    'candidate',
  )
  if (isPendingBenchmarkDataset(dataset) && baseline.execution === undefined && candidate.execution === undefined) return
  if (baseline.execution === undefined || candidate.execution === undefined) {
    throw new Error('benchmark runs require baseline and candidate execution provenance')
  }
  if (canonicalBenchmarkJson(baseline.execution.environment) !== canonicalBenchmarkJson(candidate.execution.environment)) {
    throw new Error('baseline and candidate environments must match exactly')
  }
  if (canonicalBenchmarkJson(baseline.execution.build) !== canonicalBenchmarkJson(candidate.execution.build)) {
    throw new Error('baseline and candidate DSH build identities must match exactly')
  }
  if (canonicalBenchmarkJson(baseline.execution.measurement) !== canonicalBenchmarkJson(candidate.execution.measurement)) {
    throw new Error('baseline and candidate measurement identities must match exactly')
  }
  if (isPendingBenchmarkDataset(dataset)) return
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
  const baselineCritical = new Map(
    baseline.runs.map(run => [`${run.taskId}\u0000${String(run.attempt)}`, run.critical]),
  )
  if (candidate.runs.some(run =>
    baselineCritical.get(`${run.taskId}\u0000${String(run.attempt)}`) !== run.critical)) {
    throw new Error('baseline and candidate critical flags must match exactly')
  }
}

function assertBenchmarkSnapshotPair(
  lock: Readonly<Record<string, unknown>>,
  profile: Readonly<Record<string, unknown>>,
  label: string,
): void {
  const candidates = lock.candidates as readonly Readonly<Record<string, unknown>>[]
  const expectedPackages = candidates.map(candidate => candidate.expectedPackage as string)
  if (new Set(expectedPackages).size !== expectedPackages.length) {
    throw new Error(`${label} lock candidate expectedPackage values must be unique`)
  }
  const thirdPartyBundles = assertBenchmarkProfileSnapshotBundles(
    profile,
    `${label} profile snapshot`,
  ).filter(bundle => !INSTALLATION_OWNED_PROFILE_BUNDLES.has(bundle))
  if (
    new Set(thirdPartyBundles).size !== thirdPartyBundles.length
    || !sameOrderedStrings(expectedPackages, thirdPartyBundles)
  ) {
    throw new Error(
      `${label} lock candidates must exactly match its profile third-party bundles in order`,
    )
  }
}

function readBenchmarkProfileSnapshot(
  fixturePath: string,
  reference: unknown,
  label: string,
  kind: 'curated-lock-snapshot' | 'curated-profile-snapshot',
  profile: string,
): BenchmarkSnapshotBinding {
  const read = readBoundBenchmarkSnapshotReference(fixturePath, reference, label)
  const snapshot = read.snapshot
  assertBenchmarkSnapshotSchemaVersion(snapshot, `${label} snapshot`)
  if (snapshot.kind !== kind) throw new Error(`${label} snapshot.kind must be ${kind}`)
  if (snapshot.profile !== profile) throw new Error(`${label} snapshot.profile must match ${label.split('.')[0]}.profile`)
  if (kind === 'curated-lock-snapshot' && 'catalogRef' in snapshot) {
    throw new Error(`${label} snapshot must not depend on a mutable catalogRef`)
  }
  if (kind === 'curated-lock-snapshot') {
    assertBenchmarkLockSnapshotCandidates(snapshot, `${label} snapshot`)
  } else {
    assertBenchmarkProfileSnapshotBundles(snapshot, `${label} snapshot`)
  }
  return { reference: read.reference, snapshot }
}

function assertBenchmarkProfileTemplate(
  profile: string,
  snapshot: Readonly<Record<string, unknown>>,
  label: string,
): void {
  const expected = isCuratedProfileName(profile)
    ? CURATED_PROFILE_TEMPLATES[profile].bundles
    : PROFILE_TEMPLATES[profile]?.bundles
  if (expected === undefined) throw new Error(`${label} profile must name a shipped or curated profile template`)
  const bundles = assertBenchmarkProfileSnapshotBundles(snapshot, `${label} snapshot`)
  if (!sameOrderedStrings(bundles, expected)) {
    throw new Error(`${label} snapshot bundles must match the authoritative ${profile} template in order`)
  }
}

function comparisonKeys(runs: readonly BenchmarkRun[], label: string): string[] {
  const keys = runs.map(run => `${run.taskId}\u0000${String(run.attempt)}`)
  if (new Set(keys).size !== keys.length) throw new Error(`${label}.runs must not repeat a taskId and attempt`)
  return keys.sort()
}

function readBenchmarkProfile(
  fixturePath: string,
  value: unknown,
  label: string,
  allowEmptyRuns: boolean,
): BenchmarkProfile {
  const profile = requiredRecord(value, label)
  const profileName = requiredString(profile.profile, `${label}.profile`)
  const runs = profile.runs
  if (!Array.isArray(runs) || (!allowEmptyRuns && runs.length === 0)) {
    throw new Error(`${label}.runs must be a non-empty array`)
  }
  return {
    profile: profileName,
    ...allowEmptyRuns && runs.length === 0 && profile.execution === undefined
      ? {}
      : { execution: readBenchmarkExecution(profile.execution, `${label}.execution`) },
    lockSnapshot: readBenchmarkProfileSnapshot(
      fixturePath,
      profile.lockSnapshot,
      `${label}.lockSnapshot`,
      'curated-lock-snapshot',
      profileName,
    ),
    profileSnapshot: readBenchmarkProfileSnapshot(
      fixturePath,
      profile.profileSnapshot,
      `${label}.profileSnapshot`,
      'curated-profile-snapshot',
      profileName,
    ),
    runs: runs.map((run, index) => readBenchmarkRun(run, `${label}.runs[${String(index)}]`)),
  }
}

function readBenchmarkRun(value: unknown, label: string): BenchmarkRun {
  const run = requiredRecord(value, label)
  const success = booleanValue(run.success, `${label}.success`)
  const failure = nullableString(run.failure, `${label}.failure`)
  if (success && failure !== null) throw new Error(`${label}.failure must be null when success is true`)
  if (!success && failure === null) throw new Error(`${label}.failure must be non-empty when success is false`)
  return {
    taskId: requiredString(run.taskId, `${label}.taskId`),
    attempt: positiveSafeIntegerValue(run.attempt, `${label}.attempt`),
    critical: booleanValue(run.critical, `${label}.critical`),
    startupSucceeded: booleanValue(run.startupSucceeded, `${label}.startupSucceeded`),
    dataLossEvents: nonNegativeSafeIntegerValue(run.dataLossEvents, `${label}.dataLossEvents`),
    rollbackSupported: booleanValue(run.rollbackSupported, `${label}.rollbackSupported`),
    success,
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

function compareBenchmark(dataset: ComparableBenchmarkDataset): BenchmarkComparison {
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

function summarizeBenchmarkProfile(
  profile: BenchmarkProfile & { readonly execution: BenchmarkExecution },
): BenchmarkProfileSummary {
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
    execution: profile.execution,
    lockSnapshot: profile.lockSnapshot.reference,
    profileSnapshot: profile.profileSnapshot.reference,
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
  const counts = new Map<string, number>()
  for (const run of runs) {
    if (run.success || run.failure === null) continue
    const failure = redactSecretText(run.failure)
    counts.set(failure, (counts.get(failure) ?? 0) + 1)
  }
  return Object.fromEntries([...counts].sort(([left], [right]) => left.localeCompare(right)))
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
  let scale = 0
  for (const value of values) scale = Math.max(scale, Math.abs(value))
  if (scale === 0) return 0
  return (sum(values.map(value => value / scale)) / values.length) * scale
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
  const patches: string[] = []
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
    if (arg === '--patch') {
      patches.push(exactRoot(requiredArg(args, index, arg), arg))
      index += 1
      continue
    }
    if (arg.startsWith('--patch=')) {
      patches.push(exactRoot(arg.slice('--patch='.length), '--patch'))
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
    patches,
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

function loadYamlFile(path: string, label: string, allowDynamicTags = false): unknown {
  let source: string | undefined
  try {
    source = readBoundedRegularFile(path).toString('utf8')
    return loadYaml(source, {
      filename: path,
      schema: entryListSchema,
      ...allowDynamicTags
        ? {}
        : {
          listener(event, state) {
            const tag = (state as unknown as { readonly tag?: unknown }).tag
            if (event === 'close' && tag === 'tag:yaml.org,2002:js') {
              throw new Error(`${label} must not contain dynamic YAML tags`)
            }
          },
        },
    })
  } catch (error) {
    throw new Error(
      `${label} cannot be loaded: ${formatYamlParseError(error, path, source) ?? errorMessage(error)}`,
      { cause: error },
    )
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
    if (
      candidate.sourceContentSha256 !== undefined
      && !SHA256_PATTERN.test(candidate.sourceContentSha256)
    ) {
      issues.push(issue({
        code: 'candidate-source-content-sha-invalid',
        target: candidate.id,
        message: 'candidate source content SHA-256 digest must be lowercase hex',
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

function loadPatchEntries(path: string, allowDynamicTags = false): Record<string, unknown>[] {
  return flattenPatchEntries(loadPatchLayer(path, allowDynamicTags))
}

function loadPatchLayer(path: string, allowDynamicTags = false): PatchOptions[] {
  const parsed = loadYamlFile(path, 'curated patch', allowDynamicTags)
  if (!Array.isArray(parsed)) throw new Error('curated patch must be a top-level YAML array')
  const problem = patchEntryListProblem(parsed)
  if (problem !== undefined) throw new Error(problem)
  return parsed as PatchOptions[]
}

function patchEntryListProblem(entries: readonly unknown[], at = 'curated patch'): string | undefined {
  for (const [index, entry] of entries.entries()) {
    const label = `${at} entry ${String(index + 1)}`
    if (!isRecord(entry)) return `${label} must be a mapping`
    if (entry.insert !== undefined) {
      if (!Array.isArray(entry.insert)) return `${label}.insert must be an entry list`
      const insertedProblem = patchEntryListProblem(entry.insert, `${label}.insert`)
      if (insertedProblem !== undefined) return insertedProblem
    }
    if (!entry.group || entry.name === undefined) continue
    if (!Array.isArray(entry.config)) return `${label}.config must be an entry list for a group`
    const nestedProblem = patchEntryListProblem(entry.config, `${label}.config`)
    if (nestedProblem !== undefined) return nestedProblem
  }
  return undefined
}

function composeObservedEntries(layers: readonly ObservedPatchLayer[]): {
  readonly entries: readonly Record<string, unknown>[]
  readonly owners: WeakMap<Record<string, unknown>, ObservedClaimOwner>
} {
  const ownersByToken = new Map<string, ObservedClaimOwner>()
  const approvedEntriesByKey = new Map<string, ObservedClaimOwner>()
  const patches = layers.map(({ patches: layer, owner }, layerIndex) => {
    stripObservedClaimOwnerMarkers(layer)
    const token = String(layerIndex)
    ownersByToken.set(token, owner)
    for (const patch of layer) {
      if (Array.isArray(patch.insert)) {
        for (const entry of patch.insert) {
          markObservedInsertedEntry(entry, token)
          if (owner.approvedExecutable) {
            collectApprovedEntries(entry as unknown as Record<string, unknown>, owner, approvedEntriesByKey)
          }
        }
      }
      if (Array.isArray(patch.config)) {
        for (const entry of patch.config) markObservedInsertedEntry(entry, token)
      }
    }
    return layer as PatchOptions[]
  })
  const entries = composeEntries(patches) as unknown as EffectiveArtifactEntry[]
  const entryProblem = artifactEntryListProblem(entries)
  if (entryProblem !== undefined) throw new Error(entryProblem)
  const owners = new WeakMap<Record<string, unknown>, ObservedClaimOwner>()
  for (const entry of entries) collectObservedClaimOwners(entry, ownersByToken, approvedEntriesByKey, owners)
  stripObservedClaimOwnerMarkers(entries)
  return { entries, owners }
}

function collectApprovedEntries(
  value: Record<string, unknown>,
  owner: ObservedClaimOwner,
  approvedEntriesByKey: Map<string, ObservedClaimOwner>,
): void {
  approvedEntriesByKey.set(`${value.id as string}\0${value.name as string}`, owner)
  if (value.group && Array.isArray(value.config)) {
    for (const entry of value.config) {
      collectApprovedEntries(entry as Record<string, unknown>, owner, approvedEntriesByKey)
    }
  }
}

function stripObservedClaimOwnerMarkers(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) stripObservedClaimOwnerMarkers(item)
    return
  }
  if (!isRecord(value)) return
  Reflect.deleteProperty(value, OBSERVED_CLAIM_OWNER_FIELD)
  for (const item of Object.values(value)) stripObservedClaimOwnerMarkers(item)
}

function markObservedInsertedEntry(value: unknown, token: string): void {
  if (!isRecord(value)) return
  value[OBSERVED_CLAIM_OWNER_FIELD] = token
  if (Array.isArray(value.config)) {
    for (const entry of value.config) markObservedInsertedEntry(entry, token)
  }
}

function collectObservedClaimOwners(
  entry: Record<string, unknown>,
  ownersByToken: ReadonlyMap<string, ObservedClaimOwner>,
  approvedEntriesByKey: ReadonlyMap<string, ObservedClaimOwner>,
  owners: WeakMap<Record<string, unknown>, ObservedClaimOwner>,
): void {
  const token = entry[OBSERVED_CLAIM_OWNER_FIELD]
  Reflect.deleteProperty(entry, OBSERVED_CLAIM_OWNER_FIELD)
  const attributed = ownersByToken.get(token as string) as ObservedClaimOwner
  const approved = approvedEntriesByKey.get(`${entry.id as string}\0${entry.name as string}`)
  const owner = attributed.approvedExecutable
    ? attributed
    : approved ?? attributed
  owners.set(entry, owner)
  if (entry.group && Array.isArray(entry.config)) {
    for (const child of entry.config) {
      collectObservedClaimOwners(
        child as Record<string, unknown>,
        ownersByToken,
        approvedEntriesByKey,
        owners,
      )
    }
  }
}

function flattenPatchEntries(items: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const entries: Record<string, unknown>[] = []
  for (const item of items) {
    const entry = item as EntryRecord
    if (Array.isArray(entry.insert)) entries.push(...flattenPatchEntries(entry.insert.filter(isRecord)))
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
  options: {
    readonly enforceGovernedCapabilities: boolean
    readonly authoritativeEntries: readonly CuratedEntry[]
    readonly observedOwners?: WeakMap<Record<string, unknown>, ObservedClaimOwner>
  },
): CommandIssue[] {
  const issues = duplicateEntryIdIssues(entries)
  const activeEntries: CuratedEntry[] = []
  const effectiveEntries = effectiveEntryStates(entries, options.observedOwners)
  issues.push(...observedEntryOwnershipIssues(effectiveEntries, options.observedOwners))

  for (const { entry, enabled, permissionEnabled } of effectiveEntries) {
    const entryId = optionalString(entry.id)
    if (containsSecretMaterial(entry)) {
      if (entry.config !== undefined && containsSecretMaterial(entry.config)) {
        issues.push(issueWithTarget({
          code: 'preflight-config-secret',
          target: entryId ?? optionalString(entry.name),
          message: 'entry config must not contain secret material',
          details: { config: entry.config },
        }))
      } else {
        const { config: _config, ...entryMetadata } = entry
        issues.push(issueWithTarget({
          code: 'preflight-entry-secret',
          target: entryId ?? optionalString(entry.name),
          message: 'entry must not contain secret material',
          details: { entry: entryMetadata },
        }))
      }
    }
    issues.push(...dataBoundaryIssues(entry.config, entryId ?? optionalString(entry.name)))
    issues.push(...baselineCandidateConfigIssues(
      entryId,
      entry.config,
      entryId === PERMISSION_RULES_ENTRY_ID ? permissionEnabled : enabled,
    ))

    const curated = readCuratedEntry(entry, options.observedOwners)
    issues.push(...curated.issues)
    if (enabled && curated.entry?.profile === profile && curated.entry.active) {
      activeEntries.push(curated.entry)
    }
  }

  issues.push(...effectivePermissionProviderIssues(
    options.authoritativeEntries,
    effectiveEntries,
    options.observedOwners,
  ))
  issues.push(...validateActiveEntries([
    ...options.authoritativeEntries.filter(entry =>
      authoritativeProviderEnabled(entry, effectiveEntries, options.observedOwners)),
    ...activeEntries,
  ], conflicts, options))
  return issues
}

function observedEntryOwnershipIssues(
  entries: readonly EffectiveEntryState[],
  observedOwners: WeakMap<Record<string, unknown>, ObservedClaimOwner> | undefined,
): CommandIssue[] {
  if (observedOwners === undefined) return []
  return entries.flatMap(({ entry }) => {
    const owner = observedOwners.get(entry)
    if (owner?.approvedExecutable === true) return []
    return [issueWithTarget({
      code: 'preflight-entry-owner-unapproved',
      target: entry.id as string,
      message: 'effective executable entry must come from an approved catalog candidate or installation-owned bundle',
    })]
  })
}

function duplicateEntryIdIssues(entries: readonly Record<string, unknown>[]): CommandIssue[] {
  return duplicateEntryIdIssuesFor(effectiveEntryStates(entries).map(state => state.entry))
}

function sameLayerDuplicateInsertedEntryIdIssues(patchLayer: readonly Record<string, unknown>[]): CommandIssue[] {
  return duplicateEntryIdIssuesFor(insertedPatchEntries(patchLayer))
}

function insertedPatchEntries(patchLayer: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  const entries: Record<string, unknown>[] = []
  for (const item of patchLayer) {
    const entry = item as EntryRecord
    if (Array.isArray(entry.insert)) entries.push(...flattenPatchEntries(entry.insert.filter(isRecord)))
  }
  return entries
}

function duplicateEntryIdIssuesFor(entries: readonly Record<string, unknown>[]): CommandIssue[] {
  const issues: CommandIssue[] = []
  const seenEntryIds = new Set<string>()
  for (const entry of entries) {
    const entryId = optionalString(entry.id)
    if (entryId === undefined) continue
    if (seenEntryIds.has(entryId)) {
      issues.push(issue({
        code: 'preflight-entry-id-duplicate',
        target: entryId,
        message: 'curated patch contains duplicate entry ids',
      }))
    }
    seenEntryIds.add(entryId)
  }
  return issues
}

function effectivePatchEntries(
  entries: readonly Record<string, unknown>[],
  observedOwners?: WeakMap<Record<string, unknown>, ObservedClaimOwner>,
): Record<string, unknown>[] {
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
      const merged = { ...previous, ...entry }
      effective[previousIndex] = merged
      observedOwners?.set(merged, observedOwners.get(previous) as ObservedClaimOwner)
      continue
    }
    if (entryId !== undefined && !entryIndexes.has(entryId)) entryIndexes.set(entryId, effective.length)
    effective.push(entry)
  }
  return effective
}

function effectiveEntryStates(
  entries: readonly Record<string, unknown>[],
  observedOwners?: WeakMap<Record<string, unknown>, ObservedClaimOwner>,
  ancestorsEnabled = true,
  ancestorsPermissionEnabled = true,
): EffectiveEntryState[] {
  return effectivePatchEntries(entries, observedOwners).flatMap((entry) => {
    const enabled = ancestorsEnabled && entry.disabled !== true
    const permissionEnabled = ancestorsPermissionEnabled
      && (entry.disabled === undefined || entry.disabled === false)
    return [
      { entry, enabled, permissionEnabled },
      ...entry.group && Array.isArray(entry.config)
        ? effectiveEntryStates(
          entry.config.filter(isRecord),
          observedOwners,
          enabled,
          permissionEnabled,
        )
        : [],
    ]
  })
}

function authoritativeProviderEnabled(
  entry: CuratedEntry,
  effectiveEntries: readonly EffectiveEntryState[],
  observedOwners: WeakMap<Record<string, unknown>, ObservedClaimOwner> | undefined,
): boolean {
  if (entry.capability !== PERMISSION_POLICY_CAPABILITY) return true
  return permissionProviderStates(entry, effectiveEntries, observedOwners)
    .some(state => state.permissionEnabled)
}

function effectivePermissionProviderIssues(
  authoritativeEntries: readonly CuratedEntry[],
  effectiveEntries: readonly EffectiveEntryState[],
  observedOwners: WeakMap<Record<string, unknown>, ObservedClaimOwner> | undefined,
): CommandIssue[] {
  return authoritativeEntries.flatMap(entry =>
    entry.capability === PERMISSION_POLICY_CAPABILITY
    && permissionProviderStates(entry, effectiveEntries, observedOwners).length === 0
      ? [issue({
        code: 'preflight-permission-entry-missing',
        target: entry.candidateId,
        message: 'effective profile must contain the selected permission-rules provider',
      })]
      : [])
}

function permissionProviderStates(
  entry: CuratedEntry,
  effectiveEntries: readonly EffectiveEntryState[],
  observedOwners: WeakMap<Record<string, unknown>, ObservedClaimOwner> | undefined,
): readonly EffectiveEntryState[] {
  return effectiveEntries.filter((state) => {
    if (state.entry.id !== PERMISSION_RULES_ENTRY_ID) return false
    const owner = observedOwners?.get(state.entry)
    return owner?.catalogCandidateId === entry.candidateId
  })
}

function baselineCandidateConfigIssues(
  entryId: string | undefined,
  value: unknown,
  enabled = true,
): CommandIssue[] {
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
      ...enabled ? [] : [issue({
        code: 'preflight-permission-entry-disabled',
        target: entryId,
        message: 'permission rules and their ancestor groups must be unconditionally enabled',
      })],
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

function readCuratedEntry(
  entry: Record<string, unknown>,
  observedOwners: WeakMap<Record<string, unknown>, ObservedClaimOwner> | undefined,
): CuratedEntryReadResult {
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
  const owner = trustedClaimOwner(entry, candidateId, observedOwners)

  return {
    entry: {
      ...entryId === undefined ? {} : { entryId },
      ...pluginName === undefined ? {} : { pluginName },
      candidateId,
      ownerId: owner.id,
      ownerLabel: owner.label,
      evidenceSource: 'patch',
      profile,
      active: true,
      capability,
      resources: resources.value,
    },
    issues: [],
  }
}

function trustedClaimOwner(
  entry: Record<string, unknown>,
  candidateId: string,
  observedOwners: WeakMap<Record<string, unknown>, ObservedClaimOwner> | undefined,
): { readonly id: string; readonly label: string } {
  if (observedOwners === undefined) return { id: `metadata:${candidateId}`, label: candidateId }
  const attributed = observedOwners.get(entry) as ObservedClaimOwner
  return {
    id: attributed.catalogCandidateId === candidateId
      ? attributed.id
      : `${attributed.id}\u0000${candidateId}`,
    label: attributed.catalogCandidateId === undefined ? attributed.label : candidateId,
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
  const providers = new Map<string, CuratedEntry[]>()
  const resources = new Map<string, CuratedEntry[]>()
  const governedCapabilities = new Set(conflicts.rules.map(rule => rule.capability))
  const approvedOwnerIds = new Set(entries
    .filter(entry => entry.evidenceSource === 'catalog')
    .map(entry => entry.ownerId))

  for (const entry of entries) {
    const conflictRule = conflicts.rules.find(rule =>
      rule.defaultProvider === entry.candidateId || rule.fallbacks.includes(entry.candidateId))
    const capability = conflictRule?.capability ?? entry.capability
    if (
      options.enforceGovernedCapabilities
      && !approvedOwnerIds.has(entry.ownerId)
      && conflictRule === undefined
      && !governedCapabilities.has(entry.capability)
    ) {
      issues.push(issue({
        code: 'preflight-capability-unmanaged',
        target: entry.candidateId,
        message: 'active curated entry names a capability outside capability-conflicts policy',
      }))
    }
    const providerKey = `${entry.profile}\u0000${capability}`
    const previousProviders = providers.get(providerKey) ?? []
    if (previousProviders.length > 0 && !isDuplicateRegistrationEvidence(previousProviders, entry)) {
      const previousProvider = previousProviders.at(-1) as CuratedEntry
      issues.push(issue({
        code: 'preflight-provider-duplicate',
        target: entry.ownerLabel,
        message: `profile ${entry.profile} capability ${capability} has multiple active candidates: ${previousProvider.ownerLabel}, ${entry.ownerLabel}`,
        details: { profile: entry.profile, capability, candidates: [previousProvider.ownerLabel, entry.ownerLabel] },
      }))
    }
    providers.set(providerKey, [...previousProviders, entry])

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
        const previousCandidates = resources.get(resourceKey) ?? []
        if (previousCandidates.length > 0 && !isDuplicateRegistrationEvidence(previousCandidates, entry)) {
          issues.push(issue({
            code: RESOURCE_DUPLICATE_CODES[field],
            target: entry.ownerLabel,
            message: `active curated entries claim the same ${resourceLabel(field)} (${duplicateSummary(field)})`,
          }))
        }
        resources.set(resourceKey, [...previousCandidates, entry])
      }
    }
  }

  return issues
}

function isDuplicateRegistrationEvidence(previous: readonly CuratedEntry[], entry: CuratedEntry): boolean {
  return previous.every(candidate =>
    candidate.ownerId === entry.ownerId && candidate.evidenceSource !== entry.evidenceSource)
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
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      index === 1 && isAuthorizationHeaderTuple(value) ? REDACTED : redactCommandDetails(item))
  }
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SECRET_KEY_PATTERN.test(key) || key === 'value' && isAuthorizationHeaderRecord(value)
      ? REDACTED
      : redactCommandDetails(item),
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
  if (typeof value === 'string') {
    return redactPlainSecretAssignments(value) !== value
      || SECRET_VALUE_PATTERN.test(value)
      || URL_USERINFO_SECRET_PATTERN.test(value)
      || SCHEMELESS_USERINFO_SECRET_PATTERN.test(value)
  }
  if (Array.isArray(value)) {
    return isAuthorizationHeaderTuple(value)
      || value.some(item => containsSecretMaterial(item))
  }
  if (!isRecord(value)) return false
  if (isAuthorizationHeaderRecord(value)) return true
  return Object.entries(value).some(([key, item]) => containsSecretMaterialForKey(key, item))
}

function isAuthorizationHeaderTuple(value: readonly unknown[]): boolean {
  return value.length === 2
    && isAuthorizationHeaderName(value[0])
    && typeof value[1] === 'string'
    && value[1].length > 0
}

function isAuthorizationHeaderRecord(value: Readonly<Record<string, unknown>>): boolean {
  return isAuthorizationHeaderName(value.name)
    && typeof value.value === 'string'
    && value.value.length > 0
}

function isAuthorizationHeaderName(value: unknown): value is string {
  return typeof value === 'string' && /^(?:proxy-)?authorization$/iu.test(value)
}

function containsSecretMaterialForKey(key: string, value: unknown): boolean {
  if (key === 'credentials') return containsSecretMaterial(value)
  if (typeof value === 'string' && SECRET_VALUE_PATTERN.test(value)) return true
  if (key === 'tokenizer') return containsSecretMaterial(value)
  if (
    ENV_REFERENCE_KEY_PATTERN.test(key)
    && typeof value === 'string'
    && ENV_VARIABLE_NAME_PATTERN.test(value)
  ) {
    return false
  }
  if (SECRET_KEY_PATTERN.test(key)) {
    if (typeof value === 'string') return value.length > 0
    if (Array.isArray(value)) return value.length > 0
    if (isRecord(value)) return Object.keys(value).length > 0
  }
  return containsSecretMaterial(value)
}

function redactSecretText(value: string): string {
  const text = value
    .replace(URL_USERINFO_PATTERN, `$1${REDACTED}@`)
    .replace(SCHEMELESS_USERINFO_PATTERN, `${REDACTED}@`)
  try {
    return JSON.stringify(redactCommandDetails(JSON.parse(text)))
  } catch {
    // Non-JSON diagnostics use the existing text redaction below.
  }
  return redactPlainSecretAssignments(redactQuotedSecretFields(redactEmbeddedJson(text)))
    .replace(/((?:--)?(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|secret|token|_?auth)(?:=|:\s*))([^\s]+)/giu, `$1${REDACTED}`)
    .replace(PRIVATE_KEY_BLOCK_REPLACEMENT_PATTERN, REDACTED)
    .replace(SECRET_VALUE_REPLACEMENT_PATTERN, REDACTED)
}

function redactPlainSecretAssignments(text: string): string {
  let yamlSecretIndent: number | undefined
  return text.replace(/^[^\r\n]*/gmu, (line) => {
    const codeFrame = /^([ \t]*\d+[ \t]+\|[ \t]?)(.*)$/u.exec(line)
    const prefix = codeFrame?.[1] ?? ''
    const content = codeFrame?.[2] ?? line
    const indentation = (/^[ \t]*/u.exec(content) as RegExpExecArray)[0].length
    if (yamlSecretIndent !== undefined) {
      if (content.trim().length === 0) return line
      if (indentation > yamlSecretIndent) {
        return `${prefix}${content.slice(0, indentation)}${REDACTED}`
      }
      yamlSecretIndent = undefined
    }
    for (const separator of content.matchAll(/[:=]/gu)) {
      const assignmentPattern = new RegExp(
        String.raw`(?:^|[ \t([{,])([A-Za-z0-9_-]+`
        + String.raw`(?:\.[A-Za-z0-9_-]+|\[[ \t]*(?:"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[A-Za-z0-9_-]+)[ \t]*\])*)[ \t]*$`,
        'u',
      )
      const assignment = assignmentPattern.exec(content.slice(0, separator.index))
      const path = assignment?.[1]
      if (path === undefined || !SECRET_KEY_PATTERN.test(assignmentKey(path))) continue
      let valueStart = separator.index + 1
      while (/[ \t]/u.test(content.charAt(valueStart))) valueStart += 1
      const value = content.slice(valueStart)
      if (
        separator[0] === ':'
        && (
          /^[|>](?:[1-9][+-]?|[+-][1-9]?)?(?:[ \t]+#.*)?$/u.test(value)
          || /^"(?:\\.|[^"])*$/u.test(value)
          || /^'(?:''|[^'])*$/u.test(value)
        )
      ) {
        yamlSecretIndent = indentation
      }
      return `${prefix}${content.slice(0, valueStart)}${REDACTED}`
    }
    return line
  })
}

function assignmentKey(path: string): string {
  const bracket = /\[[ \t]*(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)'|([A-Za-z0-9_-]+))[ \t]*\]$/u.exec(path)
  if (bracket !== null) {
    if (bracket[1] !== undefined) return decodeJsonString(`"${bracket[1]}"`)
    if (bracket[2] !== undefined) return bracket[2].replace(/\\(.)/gu, '$1')
    return bracket[3] as string
  }
  return path.slice(path.lastIndexOf('.') + 1)
}

function redactQuotedSecretFields(text: string): string {
  let output = ''
  let cursor = 0
  let index = 0
  while (index < text.length) {
    if (text.charAt(index) !== '"') {
      index += 1
      continue
    }
    const keyEnd = jsonStringEnd(text, index)
    if (keyEnd === undefined) break
    let separator = keyEnd
    while (/\s/u.test(text.charAt(separator))) separator += 1
    if (text.charAt(separator) !== ':') {
      index = keyEnd
      continue
    }
    const key = decodeJsonString(text.slice(index, keyEnd))
    if (!SECRET_KEY_PATTERN.test(key)) {
      index = keyEnd
      continue
    }
    let valueStart = separator + 1
    while (/\s/u.test(text.charAt(valueStart))) valueStart += 1
    if (text.charAt(valueStart) === '"') {
      const valueEnd = jsonStringEnd(text, valueStart)
      const contentEnd = valueEnd === undefined ? text.length : valueEnd - 1
      output += text.slice(cursor, valueStart + 1) + REDACTED
      cursor = contentEnd
      index = valueEnd ?? text.length
      continue
    }
    let valueEnd = valueStart
    while (valueEnd < text.length && !/[,\]}\r\n]/u.test(text.charAt(valueEnd))) valueEnd += 1
    output += text.slice(cursor, valueStart) + REDACTED
    cursor = valueEnd
    index = Math.max(valueEnd, keyEnd)
  }
  return output + text.slice(cursor)
}

function jsonStringEnd(text: string, start: number): number | undefined {
  let escaped = false
  for (let index = start + 1; index < text.length; index += 1) {
    const character = text.charAt(index)
    if (escaped) {
      escaped = false
    } else if (character === '\\') {
      escaped = true
    } else if (character === '"') {
      return index + 1
    }
  }
  return undefined
}

function decodeJsonString(value: string): string {
  try {
    return JSON.parse(value) as string
  } catch {
    return value.slice(1, -1).replace(/\\./gu, '')
  }
}

function redactEmbeddedJson(text: string): string {
  let output = ''
  let index = 0
  while (index < text.length) {
    const start = nextJsonStart(text, index)
    if (start === undefined) return output + text.slice(index)
    output += text.slice(index, start)
    const end = jsonFragmentEnd(text, start)
    if (end === undefined) return output + text.slice(start)
    const fragment = text.slice(start, end)
    output += redactedJsonFragment(fragment) ?? fragment
    index = end
  }
  return output
}

function nextJsonStart(text: string, from: number): number | undefined {
  const objectStart = text.indexOf('{', from)
  const arrayStart = text.indexOf('[', from)
  if (objectStart === -1) return arrayStart === -1 ? undefined : arrayStart
  if (arrayStart === -1) return objectStart
  return Math.min(objectStart, arrayStart)
}

function jsonFragmentEnd(text: string, start: number): number | undefined {
  const stack: string[] = []
  let inString = false
  let escaped = false
  for (let index = start; index < text.length; index += 1) {
    const char = text.charAt(index)
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (char === '\\') {
        escaped = true
      } else if (char === '"') {
        inString = false
      }
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{') {
      stack.push('}')
      continue
    }
    if (char === '[') {
      stack.push(']')
      continue
    }
    if (char === '}' || char === ']') {
      if (stack.pop() !== char) return undefined
      if (stack.length === 0) return index + 1
    }
  }
  return undefined
}

function redactedJsonFragment(text: string): string | undefined {
  try {
    return JSON.stringify(redactCommandDetails(JSON.parse(text)))
  } catch {
    return undefined
  }
}

function smokeChildEnv(overrides: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries({ ...scrubbedParentEnv(), ...overrides })) {
    if (value === undefined) continue
    if (SMOKE_CREDENTIAL_ENV_PATTERN.test(key)) continue
    const proxy = SMOKE_PROXY_ENV_PATTERN.test(key)
    const explicitDsh = key === 'DSH_HOME' || key === 'DSH_TELEMETRY_DISABLED'
    if (!SMOKE_LAUNCH_ENV_PATTERN.test(key) && !proxy && !explicitDsh) continue
    if (proxy && !isSafeSmokeProxyValue(key, value)) continue
    env[key] = value
  }
  env[SMOKE_DISABLE_DOTENV_ENV] = '1'
  return env
}

function isSafeSmokeProxyValue(key: string, value: string): boolean {
  if (SMOKE_NO_PROXY_ENV_PATTERN.test(key)) return isNoProxyList(value)
  try {
    const url = new URL(value)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:')
      && url.hostname !== ''
      && url.username === ''
      && url.password === ''
      && url.search === ''
      && url.hash === ''
      && url.pathname === '/'
      && !value.includes('?')
      && !value.includes('#')
    )
  } catch {
    return false
  }
}

function isNoProxyList(value: string): boolean {
  return value.split(',').every(entry => NO_PROXY_ENTRY_PATTERN.test(entry.trim()))
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

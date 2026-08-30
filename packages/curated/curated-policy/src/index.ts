/**
 * Curated plugin policy catalog loading, admission classification, and read-only queries.
 * @module @deepseek-ai/dsh-curated-policy
 */

import { readFileSync } from 'node:fs'
import { isAbsolute, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { FAILSAFE_SCHEMA, load as loadYaml, YAMLException } from 'js-yaml'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'curated-policy'

/** No service dependency is required by the policy query service. */
export const inject: string[] = []

/** Admission tier derived from the static score and hard rejection list. */
export type AdmissionTier = 'default' | 'scenario' | 'experimental' | 'rejected'

/** Current delivery state derived from activation, artifact evidence, and blockers. */
export type CuratedCandidateStatus = 'active' | 'qualified' | 'pending' | 'rejected'

/** Candidate priority copied from the curated planning matrix. */
export type CuratedPriority = 'P0' | 'P1' | 'P2'

/** Availability of the repository and commit used for candidate audit. */
export type CuratedSourceStatus = 'verified' | 'unreachable'

/** Static admission dimensions and their documented maximum scores. */
export interface CuratedScoreDimensions {
  /** Native DSH and Node compatibility, out of 20. */
  readonly nativeCompatibility: number
  /** Main-flow completeness and failure semantics, out of 15. */
  readonly functionalCompleteness: number
  /** Automated test and CI evidence, out of 15. */
  readonly testAndCi: number
  /** Security and privacy behavior, out of 15. */
  readonly securityAndPrivacy: number
  /** Maintenance health, out of 10. */
  readonly maintenanceHealth: number
  /** Startup and runtime cost, out of 10. */
  readonly performanceCost: number
  /** Upgrade, rollback, and diagnostic support, out of 10. */
  readonly operability: number
  /** Plugin-specific community evidence, out of 5. */
  readonly communitySignal: number
}

/** Conflict rule semantics copied from the curated capability table. */
export type CapabilityConflictRuleKind = 'not-simultaneous' | 'one-active-provider' | 'not-long-running-together'

/** Permission policy decision used by curated seed rules. */
export type PermissionDecision = 'allow' | 'ask' | 'deny'

/** Source document pinned by the checked-in curated catalog. */
export interface CuratedCatalogSource {
  /** Awesome list repository URL used for discovery. */
  readonly awesome: {
    /** HTTPS GitHub repository URL. */
    readonly repository: string
    /** Full commit SHA used for the read-only audit. */
    readonly commit: string
    /** Source file path inside the repository. */
    readonly file: string
  }
  /** Repository-local planning matrix path. */
  readonly matrix: string
}

/** Hard rejection evidence attached to one candidate. */
export interface CuratedRejection {
  /** Stable machine-readable rejection code. */
  readonly code: string
  /** Human-readable audit evidence without secret material. */
  readonly evidence: string
}

/** One capability-domain conflict rule loaded from `capability-conflicts.yaml`. */
export interface CapabilityConflictRule {
  /** Capability domain this rule governs. */
  readonly capability: string
  /** Preferred provider id, or null when there is no universal default. */
  readonly defaultProvider: string | null
  /** Provider ids allowed only as explicit fallback or scenario alternatives. */
  readonly fallbacks: readonly string[]
  /** Conflict rule kind used by preflight and review diagnostics. */
  readonly rule: CapabilityConflictRuleKind
  /** Human-readable reason without secret material. */
  readonly reason: string
}

/** Parsed capability conflict table. */
export interface CapabilityConflictCatalog {
  /** Conflict table schema version. */
  readonly schemaVersion: number
  /** Repository-local planning source path or fragment. */
  readonly source: string
  /** Capability conflict rules in deterministic order. */
  readonly rules: readonly CapabilityConflictRule[]
}

/** Permission rule seed loaded from `permission-rules.yaml`. */
export interface PermissionRule {
  /** Stable rule id. */
  readonly id: string
  /** Default decision for this rule. */
  readonly decision: PermissionDecision
  /** Capability names or surfaces the rule applies to. */
  readonly appliesTo: readonly string[]
  /** Human-readable reason without secret material. */
  readonly reason: string
}

/** Parsed permission policy seed. */
export interface PermissionRuleCatalog {
  /** Permission rule schema version. */
  readonly schemaVersion: number
  /** Repository-local planning source path or fragment. */
  readonly source: string
  /** Authoritative five-stage execution sequence for security controls. */
  readonly order: readonly string[]
  /** Default safety settings used by curated profiles. */
  readonly defaults: Readonly<Record<string, string | boolean>>
  /** Permission seed rules in deterministic order. */
  readonly rules: readonly PermissionRule[]
}

/** Runtime or composition resources a candidate claims inside one profile. */
export interface CuratedCandidateResources {
  /** Cordis entry ids contributed by the candidate. */
  readonly entryIds?: readonly string[]
  /** Model-facing tool names contributed by the candidate. */
  readonly toolNames?: readonly string[]
  /** Human command names contributed by the candidate. */
  readonly commandNames?: readonly string[]
  /** Cordis service keys contributed by the candidate. */
  readonly serviceKeys?: readonly string[]
  /** UI slot names contributed by the candidate. */
  readonly uiSlots?: readonly string[]
  /** Settings tab ids contributed by the candidate. */
  readonly settingsTabs?: readonly string[]
  /** Router paths contributed by the candidate. */
  readonly routes?: readonly string[]
  /** Fixed local ports claimed by the candidate. */
  readonly ports?: readonly string[]
  /** SQLite database paths claimed by the candidate. */
  readonly sqlitePaths?: readonly string[]
  /** Cache directories claimed by the candidate. */
  readonly cacheDirs?: readonly string[]
  /** Environment variable names consumed or exported by the candidate. */
  readonly envVars?: readonly string[]
  /** Waterfall listener declarations in `<event>:next` form. */
  readonly waterfallListeners?: readonly string[]
  /** Automatic behavior classes contributed by the candidate. */
  readonly automationBehaviors?: readonly string[]
}

/** Complete profile override required to activate one curated candidate safely. */
export interface CuratedCandidateConfig {
  /** Cordis entry id targeted by the profile override. */
  readonly entryId: string
  /** Complete replacement config for the targeted entry. */
  readonly values: Readonly<Record<string, unknown>>
}

/** One repository-owned tracked regular blob that establishes runtime activation evidence. */
export interface CuratedRuntimeEvidenceFile {
  /** Safe repository-relative POSIX path below the curated benchmark evidence directory. */
  readonly path: string
  /** SHA-256 of the checked-in file bytes. */
  readonly sha256: string
}

/** Complete secret-free operation evidence for one candidate target profile. */
export interface CuratedRuntimeActivationEvidenceSet {
  /** Keyless assembled snapshot produced from the pinned candidate artifact. */
  readonly keylessAssembledSnapshot: CuratedRuntimeEvidenceFile
  /** Runtime bundles exercised by the assembled snapshot. */
  readonly requiredRuntimeBundles: readonly string[]
  /** Installation evidence. */
  readonly install: CuratedRuntimeEvidenceFile
  /** Enablement evidence. */
  readonly enable: CuratedRuntimeEvidenceFile
  /** Restart evidence. */
  readonly restart: CuratedRuntimeEvidenceFile
  /** Disable or uninstall evidence. */
  readonly disableOrUninstall: CuratedRuntimeEvidenceFile
}

/** Complete runtime activation evidence keyed by candidate target profile. */
export type CuratedRuntimeActivationEvidence = Readonly<Record<string, CuratedRuntimeActivationEvidenceSet>>

/** One audited third-party plugin candidate in the curated catalog. */
export interface CuratedCandidate {
  /** Stable lowercase identifier used by curated profile templates. */
  readonly id: string
  /** Planning priority bucket. */
  readonly priority: CuratedPriority
  /** Capability domain used for profile conflict checks. */
  readonly capability: string
  /** HTTPS GitHub repository URL. */
  readonly repository: string
  /** Monorepo subpath, or null for repository root. */
  readonly repositoryPath: string | null
  /** Full commit SHA audited for this candidate. */
  readonly commit: string
  /** Whether the repository and pinned commit were reachable during audit. */
  readonly sourceStatus: CuratedSourceStatus
  /** Audit date in YYYY-MM-DD form. */
  readonly auditedAt: string
  /** Candidate package manifest path, or null when missing. */
  readonly manifestPath: string | null
  /** Expected package name, or null when missing. */
  readonly expectedPackage: string | null
  /** Declared Node engine range, or null when absent. */
  readonly nodeEngine: string | null
  /** Repository path that supplies verified Node compatibility evidence. */
  readonly nodeEngineEvidence: string | null
  /** Whether the audited artifact requires a DeepSeek Harness core patch. */
  readonly requiresCorePatch: boolean | null
  /** License expression, or null when unavailable. */
  readonly license: string | null
  /** Bundle patch path, or null when missing. */
  readonly bundlePatch: string | null
  /** SHA-256 of the audited commit's domain-separated, path-sorted Git mode, type, path, and blob records. */
  readonly sourceContentSha256?: string
  /** SHA-256 digest of sorted installed relative paths and file bytes. */
  readonly treeSha256?: string
  /** SHA-256 digest of the complete sorted runtime dependency lock identities. */
  readonly runtimeDependencyClosureSha256?: string
  /** Exact npm version used for installation instead of the audited Git source. */
  readonly npmVersion?: string
  /** Exact npm registry integrity for `npmVersion`. */
  readonly npmIntegrity?: string
  /** Count of discovered test files. */
  readonly testFiles: number
  /** Count of discovered CI workflows. */
  readonly ciWorkflows: number
  /** Install lifecycle scripts recorded but not executed during audit. */
  readonly installScripts: Readonly<Record<string, string>>
  /** External runtime or build dependencies named by the candidate. */
  readonly externalDependencies: readonly string[]
  /** Additional bundle packages required when this candidate runs. */
  readonly requiredRuntimeBundles?: readonly string[]
  /** Network destinations or classes used by the candidate. */
  readonly networkAccess: readonly string[]
  /** Credential references required or optionally accepted by the candidate. */
  readonly credentials: readonly string[]
  /** Profiles this candidate may enter when each has complete activation evidence. */
  readonly targetProfiles: readonly string[]
  /** Whether this candidate is eligible for profile activation. */
  readonly active: boolean
  /** Non-blocking audit warnings. */
  readonly auditWarnings: readonly string[]
  /** Hard rejection evidence. */
  readonly rejections: readonly CuratedRejection[]
  /** Eight stored dimensions used to compute the static admission score. */
  readonly scoreDimensions: CuratedScoreDimensions
  /** Computed static 100-point admission score. */
  readonly score: number
  /** Optional profile resource claims for duplicate checks. */
  readonly resources?: CuratedCandidateResources
  /** Optional complete profile override required for safe activation. */
  readonly config?: CuratedCandidateConfig
  /** Checked-in activation evidence keyed by target profile. */
  readonly runtimeActivationEvidence?: CuratedRuntimeActivationEvidence
}

/** Parsed curated plugin catalog. */
export interface CuratedCatalog {
  /** Catalog schema version. */
  readonly schemaVersion: number
  /** Source material used to create the catalog. */
  readonly source: CuratedCatalogSource
  /** Audited candidate list in deterministic profile order. */
  readonly candidates: readonly CuratedCandidate[]
}

/** Machine-readable policy issue returned by validators. */
export interface PolicyIssue {
  /** Stable issue code. */
  readonly code: string
  /** Candidate that owns the issue, when applicable. */
  readonly candidateId?: string
  /** Profile being validated, when applicable. */
  readonly profileId?: string
  /** Human-readable message with secret-like values removed. */
  readonly message: string
  /** Redacted structured details for diagnostics. */
  readonly details?: unknown
}

interface Config {
  /** Override path for `policy/plugin-allowlist.yaml`; tests use this to load fixture catalogs. */
  readonly catalogPath?: string
  /** Override path for `policy/capability-conflicts.yaml`; tests use this to load fixture conflict tables. */
  readonly conflictPath?: string
  /** Override path for `policy/permission-rules.yaml`; tests use this to load fixture permission rules. */
  readonly permissionRulesPath?: string
}

type ResourceField = keyof CuratedCandidateResources

const defaultCatalogPath = fileURLToPath(new URL('../policy/plugin-allowlist.yaml', import.meta.url))
const defaultConflictPath = fileURLToPath(new URL('../policy/capability-conflicts.yaml', import.meta.url))
const defaultPermissionRulesPath = fileURLToPath(new URL('../policy/permission-rules.yaml', import.meta.url))
const fullShaPattern = /^[0-9a-f]{40}$/
const sha256Pattern = /^[0-9a-f]{64}$/
const semverNumericIdentifier = String.raw`(?:0|[1-9]\d*)`
const semverPrereleaseIdentifier = String.raw`(?:${semverNumericIdentifier}|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)`
const exactNpmVersionPattern = new RegExp(
  String.raw`^${semverNumericIdentifier}\.${semverNumericIdentifier}\.${semverNumericIdentifier}`
  + String.raw`(?:-${semverPrereleaseIdentifier}(?:\.${semverPrereleaseIdentifier})*)?`
  + String.raw`(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$`,
  'u',
)
const npmIntegrityPattern = /^sha512-([A-Za-z0-9+/]+={0,2})$/u
const candidateIdPattern = /^[a-z0-9-]+$/
const githubOwnerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u
const githubRepositoryNamePattern = /^[A-Za-z0-9._-]{1,100}$/u
const windowsAbsolutePathPattern = /^(?:[A-Za-z]:|\\\\)/u
const redacted = '[REDACTED]'
const secretKeyPattern =
  /(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|secret|token|(?:^|[-_])auth(?:$|[-_]))/iu
const secretValuePattern = /(?:bearer\s+\S+|gh[pousr]_[a-z0-9_]+|(?<![\p{L}\p{N}_-])sk-[a-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/iu
const privateKeyBlockReplacementPattern =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END[^\r\n]*(?=\r?\n|$)|$)/giu
const secretValueReplacementPattern = /(?:bearer\s+\S+|gh[pousr]_[a-z0-9_]+|(?<![\p{L}\p{N}_-])sk-[a-z0-9_-]+)/giu
const secretAssignmentReplacementPattern =
  /((?:^|[^\p{L}\p{N}_-])(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|secret|token|auth)\s*[:=]\s*)[^\r\n]*/gimu
const urlUserinfoReplacementPattern = /([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^\s/?#]+@/gu
const schemelessUrlUserinfoReplacementPattern =
  /\b[^\s/?#:@]+:[^\s/?#]*@(?=(?:\[[^\]\s]+\]|[^\s/?#@:]+):\d+(?:[/?#\s]|$))/gu
const catalogKeys = ['schemaVersion', 'source', 'candidates'] as const
const catalogSourceKeys = ['awesome', 'matrix'] as const
const awesomeSourceKeys = ['repository', 'commit', 'file'] as const
const candidateKeys = [
  'id',
  'priority',
  'capability',
  'score',
  'scoreDimensions',
  'config',
  'repository',
  'repositoryPath',
  'commit',
  'sourceStatus',
  'auditedAt',
  'manifestPath',
  'expectedPackage',
  'nodeEngine',
  'nodeEngineEvidence',
  'requiresCorePatch',
  'license',
  'bundlePatch',
  'sourceContentSha256',
  'treeSha256',
  'runtimeDependencyClosureSha256',
  'npmVersion',
  'npmIntegrity',
  'testFiles',
  'ciWorkflows',
  'installScripts',
  'externalDependencies',
  'requiredRuntimeBundles',
  'networkAccess',
  'credentials',
  'targetProfiles',
  'active',
  'auditWarnings',
  'rejections',
  'resources',
  'runtimeActivationEvidence',
] as const
const scoreDimensionMaximums = {
  nativeCompatibility: 20,
  functionalCompleteness: 15,
  testAndCi: 15,
  securityAndPrivacy: 15,
  maintenanceHealth: 10,
  performanceCost: 10,
  operability: 10,
  communitySignal: 5,
} as const satisfies Record<keyof CuratedScoreDimensions, number>
const scoreDimensionFields = Object.keys(scoreDimensionMaximums) as Array<keyof CuratedScoreDimensions>
const rejectionKeys = ['code', 'evidence'] as const
const candidateConfigKeys = ['entryId', 'values'] as const
const runtimeActivationEvidenceKeys = [
  'keylessAssembledSnapshot',
  'requiredRuntimeBundles',
  'install',
  'enable',
  'restart',
  'disableOrUninstall',
] as const
const runtimeEvidenceFileKeys = ['path', 'sha256'] as const
const runtimeEvidenceFileFields = [
  'keylessAssembledSnapshot',
  'install',
  'enable',
  'restart',
  'disableOrUninstall',
] as const
const rejectionsThatPreserveQualification = new Set([
  'assembled-keyless-snapshot-missing',
  'required-runtime-dependency-missing',
])
const pendingRejections = new Set([
  'baseline-promotion-evidence-pending',
  'long-cycle-evidence-pending',
])
const capabilityConflictCatalogKeys = ['schemaVersion', 'source', 'rules'] as const
const capabilityConflictRuleKeys = ['capability', 'defaultProvider', 'fallbacks', 'rule', 'reason'] as const
const permissionCatalogKeys = ['schemaVersion', 'source', 'order', 'defaults', 'rules'] as const
const authoritativePermissionOrder = [
  'core-sandbox',
  'permission-rules',
  'high-risk-approval-or-auto-review',
  'tool-execution',
  'result-audit',
] as const
const permissionDefaultKeys = ['configImportMode', 'otelCaptureBody', 'credentialStorage'] as const
const permissionRuleKeys = ['id', 'decision', 'appliesTo', 'reason'] as const
const resourceFields: readonly ResourceField[] = [
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
]

declare module '@deepseek-ai/cordis' {
  interface Context {
    curatedPolicy: CuratedPolicy
  }
}

/**
 * Load and freeze a curated catalog YAML file.
 * @param filePath - Absolute or relative YAML file path; omitted uses the checked-in allowlist.
 * @returns the parsed immutable catalog.
 */
export function loadCuratedCatalog(filePath = defaultCatalogPath): CuratedCatalog {
  return freezeCatalog(readCatalog(loadPolicyYaml(filePath, 'curated catalog')))
}

/**
 * Load and freeze the curated capability conflict table.
 * @param filePath - Absolute or relative YAML file path; omitted uses the checked-in conflict table.
 * @returns the parsed immutable conflict catalog.
 */
export function loadCapabilityConflicts(filePath = defaultConflictPath): CapabilityConflictCatalog {
  return deepFreeze(readCapabilityConflicts(loadPolicyYaml(filePath, 'curated capability conflicts')))
}

/**
 * Load and freeze the curated permission rule seeds.
 * @param filePath - Absolute or relative YAML file path; omitted uses the checked-in permission rules.
 * @returns the parsed immutable permission rule catalog.
 */
export function loadPermissionRules(filePath = defaultPermissionRulesPath): PermissionRuleCatalog {
  return deepFreeze(readPermissionRules(loadPolicyYaml(filePath, 'curated permission rules')))
}

/**
 * Classify one static admission score.
 * @param score - Candidate score on a 100-point scale.
 * @param hardRejections - Hard rejection codes found during audit.
 * @returns the admission tier; any hard rejection returns `rejected`.
 */
export function classifyAdmission(score: number, hardRejections: readonly string[] = []): AdmissionTier {
  if (hardRejections.length > 0 || !Number.isFinite(score)) return 'rejected'
  if (score >= 85) return 'default'
  if (score >= 75) return 'scenario'
  if (score >= 65) return 'experimental'
  return 'rejected'
}

/**
 * Derive the current candidate delivery state from machine-readable catalog evidence.
 * @param candidate - Candidate activation, artifact, and blocker fields.
 * @returns `active`, `qualified`, `pending`, or `rejected`.
 */
export function deriveCandidateStatus(candidate: CuratedCandidate): CuratedCandidateStatus {
  if (candidate.active) return 'active'
  if (candidate.rejections.length === 0) return 'pending'
  if (
    hasCompleteInstallMetadata(candidate)
    && candidate.treeSha256 !== undefined
    && candidate.runtimeDependencyClosureSha256 !== undefined
    && candidate.rejections.every(rejection =>
      rejectionsThatPreserveQualification.has(rejection.code))
  ) {
    return 'qualified'
  }
  if (candidate.rejections.every(rejection => pendingRejections.has(rejection.code))) {
    return 'pending'
  }
  return 'rejected'
}

/**
 * Check whether one candidate has complete activation evidence for a profile.
 * @param candidate - Candidate fields that declare target profiles, required bundles, and activation evidence.
 * @param profileId - Profile whose evidence must be complete.
 * @returns whether profile and evidence keys are exact, bundle declarations
 * match, and every file reference is safe and content-addressed.
 */
export function hasCompleteCurrentProfileActivationEvidence(
  candidate: {
    readonly requiredRuntimeBundles?: unknown
    readonly runtimeActivationEvidence?: unknown
    readonly targetProfiles?: unknown
  },
  profileId: string,
): boolean {
  if (!isNonEmptyStringArray(candidate.targetProfiles)) return false
  const declaredBundles = candidate.requiredRuntimeBundles ?? []
  if (!isNonEmptyStringArray(declaredBundles)) return false
  const evidence = candidate.runtimeActivationEvidence
  if (
    !isRecord(evidence)
    || !sameStringSets(Object.keys(evidence), candidate.targetProfiles)
  ) {
    return false
  }
  const evidenceSet = evidence[profileId]
  if (
    !isRecord(evidenceSet)
    || !hasExactKeys(evidenceSet, runtimeActivationEvidenceKeys)
    || !isNonEmptyStringArray(evidenceSet.requiredRuntimeBundles)
    || !sameStringSets(evidenceSet.requiredRuntimeBundles, declaredBundles)
  ) {
    return false
  }
  return runtimeEvidenceFileFields.every(field =>
    isCompleteRuntimeEvidenceFile(evidenceSet[field]))
}

/**
 * Validate lock-style candidate facts that must stay deterministic.
 * @param catalog - Catalog to inspect.
 * @returns policy issues; messages and details do not expose secret-like values.
 */
export function validateCandidateLock(catalog: CuratedCatalog): PolicyIssue[] {
  const issues: PolicyIssue[] = []
  const seenIds = new Set<string>()
  const seenResources = new Map<string, CuratedCandidate[]>()

  if (catalog.schemaVersion !== 2) {
    issues.push(policyIssue({
      code: 'catalog-schema-version',
      message: 'curated catalog schemaVersion must be 2',
    }))
  }
  if (!fullShaPattern.test(catalog.source.awesome.commit)) {
    issues.push(policyIssue({
      code: 'source-commit-unpinned',
      message: 'curated catalog source commit must be a full lowercase Git SHA',
    }))
  } else if (isPlaceholderDigest(catalog.source.awesome.commit)) {
    issues.push(policyIssue({
      code: 'source-commit-placeholder',
      message: 'curated catalog source commit must not be a placeholder digest',
    }))
  }
  if (!isCanonicalGitHubRepository(catalog.source.awesome.repository)) {
    issues.push(policyIssue({
      code: 'source-repository-invalid',
      message: 'curated catalog source repository must be a canonical HTTPS GitHub repository URL',
    }))
  }
  if (containsSecretMaterial(catalog.source)) {
    issues.push(policyIssue({
      code: 'catalog-secret-material',
      message: 'curated catalog source fields must not contain secret material',
      details: { source: catalog.source },
    }))
  }

  for (const candidate of catalog.candidates) {
    if (containsSecretMaterial(candidate)) {
      issues.push(policyIssue({
        code: 'candidate-secret-material',
        candidateId: candidate.id,
        message: 'candidate fields must not contain secret material',
      }))
    }
    if (!candidateIdPattern.test(candidate.id)) {
      issues.push(policyIssue({
        code: 'candidate-id-invalid',
        candidateId: candidate.id,
        message: 'candidate id must use lowercase letters, digits, and hyphens',
      }))
    } else if (seenIds.has(candidate.id)) {
      issues.push(policyIssue({
        code: 'candidate-id-duplicate',
        candidateId: candidate.id,
        message: 'candidate id is duplicated',
      }))
    }
    seenIds.add(candidate.id)

    if (!isCanonicalGitHubRepository(candidate.repository)) {
      issues.push(policyIssue({
        code: 'candidate-repository-invalid',
        candidateId: candidate.id,
        message: 'candidate repository must be a canonical HTTPS GitHub repository URL',
      }))
    }
    if (!fullShaPattern.test(candidate.commit)) {
      issues.push(policyIssue({
        code: 'candidate-commit-unpinned',
        candidateId: candidate.id,
        message: 'candidate commit must be a full lowercase Git SHA',
      }))
    } else if (isPlaceholderDigest(candidate.commit)) {
      issues.push(policyIssue({
        code: 'candidate-commit-placeholder',
        candidateId: candidate.id,
        message: 'candidate commit must not be a placeholder digest',
      }))
    }
    if (candidate.sourceStatus === 'verified' && candidate.sourceContentSha256 === undefined) {
      issues.push(policyIssue({
        code: 'candidate-source-content-sha-missing',
        candidateId: candidate.id,
        message: 'verified candidate must declare its normalized source content SHA-256',
      }))
    } else if (candidate.sourceContentSha256 !== undefined) {
      if (!sha256Pattern.test(candidate.sourceContentSha256)) {
        issues.push(policyIssue({
          code: 'candidate-source-content-sha-invalid',
          candidateId: candidate.id,
          message: 'candidate source content SHA-256 digest must be lowercase hex',
        }))
      } else if (isPlaceholderDigest(candidate.sourceContentSha256)) {
        issues.push(policyIssue({
          code: 'candidate-source-content-sha-placeholder',
          candidateId: candidate.id,
          message: 'candidate source content SHA-256 digest must not be a placeholder digest',
        }))
      }
    }
    if (candidate.sourceStatus === 'unreachable' && candidate.sourceContentSha256 !== undefined) {
      issues.push(policyIssue({
        code: 'candidate-source-content-sha-unverified',
        candidateId: candidate.id,
        message: 'unreachable candidate must not declare a source content digest',
      }))
    }
    if (candidate.active && candidate.treeSha256 === undefined) {
      issues.push(policyIssue({
        code: 'candidate-tree-sha-missing',
        candidateId: candidate.id,
        message: 'active candidate must declare its installed tree SHA-256',
      }))
    } else if (candidate.treeSha256 !== undefined) {
      if (!sha256Pattern.test(candidate.treeSha256)) {
        issues.push(policyIssue({
          code: 'candidate-tree-sha-invalid',
          candidateId: candidate.id,
          message: 'candidate installed tree SHA-256 must be 64 lowercase hexadecimal characters',
        }))
      } else if (isPlaceholderDigest(candidate.treeSha256)) {
        issues.push(policyIssue({
          code: 'candidate-tree-sha-placeholder',
          candidateId: candidate.id,
          message: 'candidate installed tree SHA-256 must not be a placeholder digest',
        }))
      }
    }
    if (candidate.active && candidate.runtimeDependencyClosureSha256 === undefined) {
      issues.push(policyIssue({
        code: 'candidate-runtime-dependency-closure-sha-missing',
        candidateId: candidate.id,
        message: 'active candidate must declare its runtime dependency closure SHA-256',
      }))
    } else if (candidate.runtimeDependencyClosureSha256 !== undefined) {
      if (!sha256Pattern.test(candidate.runtimeDependencyClosureSha256)) {
        issues.push(policyIssue({
          code: 'candidate-runtime-dependency-closure-sha-invalid',
          candidateId: candidate.id,
          message: 'candidate runtime dependency closure SHA-256 must be 64 lowercase hexadecimal characters',
        }))
      } else if (isPlaceholderDigest(candidate.runtimeDependencyClosureSha256)) {
        issues.push(policyIssue({
          code: 'candidate-runtime-dependency-closure-sha-placeholder',
          candidateId: candidate.id,
          message: 'candidate runtime dependency closure SHA-256 must not be a placeholder digest',
        }))
      }
    }
    if (
      candidate.npmVersion !== undefined
      && !isExactNpmVersion(candidate.npmVersion)
    ) {
      issues.push(policyIssue({
        code: 'candidate-npm-version-inexact',
        candidateId: candidate.id,
        message: 'candidate npm version must be exact',
      }))
    }
    if (
      candidate.npmIntegrity !== undefined
      && !isExactNpmIntegrity(candidate.npmIntegrity)
    ) {
      issues.push(policyIssue({
        code: 'candidate-npm-integrity-invalid',
        candidateId: candidate.id,
        message: 'candidate npm integrity must be a SHA-512 SRI value',
      }))
    }
    if ((candidate.npmVersion === undefined) !== (candidate.npmIntegrity === undefined)) {
      issues.push(policyIssue({
        code: 'candidate-npm-provenance-incomplete',
        candidateId: candidate.id,
        message: 'candidate npm version and integrity must be declared together',
      }))
    }
    if (
      candidate.active
      && candidate.npmVersion === undefined
      && Object.keys(candidate.installScripts).some(isInstallLifecycleScript)
    ) {
      issues.push(policyIssue({
        code: 'candidate-git-lifecycle-build-active',
        candidateId: candidate.id,
        message: 'active Git candidates with lifecycle builds require a verified prebuilt npm artifact',
      }))
    }
    if (candidate.active && candidate.rejections.length > 0) {
      issues.push(policyIssue({
        code: 'candidate-hard-rejection-active',
        candidateId: candidate.id,
        message: 'candidate with hard rejections must be inactive',
        details: { rejectionCodes: candidate.rejections.map(rejection => rejection.code) },
      }))
    }
    if (candidate.active && hasIncompleteInstallMetadata(candidate)) {
      issues.push(policyIssue({
        code: 'candidate-active-install-metadata-missing',
        candidateId: candidate.id,
        message: 'active candidate must declare package, manifest, license, and bundle metadata',
      }))
    }
    issues.push(...runtimeActivationEvidenceIssues(candidate))
    if (!candidate.active && candidate.rejections.length === 0) {
      issues.push(policyIssue({
        code: 'candidate-inactive-blocker-missing',
        candidateId: candidate.id,
        message: 'inactive candidate must carry explicit blocker evidence',
      }))
    }
    if (!candidate.active) continue

    if (candidate.targetProfiles.length === 0) {
      issues.push(policyIssue({
        code: 'candidate-active-target-profile-missing',
        candidateId: candidate.id,
        message: 'active candidate must target at least one curated profile',
      }))
    }
    const admission = classifyAdmission(candidate.score)
    if (admission === 'experimental' || admission === 'rejected') {
      issues.push(policyIssue({
        code: 'candidate-active-score-too-low',
        candidateId: candidate.id,
        message: 'active candidate admission score must qualify for a default or scenario profile',
        details: { admission, score: candidate.score },
      }))
    }
    if (candidate.sourceStatus !== 'verified') {
      issues.push(policyIssue({
        code: 'candidate-source-unverified',
        candidateId: candidate.id,
        message: 'active candidate source must be verified at the pinned commit',
      }))
    }
    if (candidate.requiresCorePatch === null) {
      issues.push(policyIssue({
        code: 'candidate-requires-core-patch-unverified',
        candidateId: candidate.id,
        message: 'active candidate must record whether it requires a core patch',
      }))
    } else if (candidate.requiresCorePatch) {
      issues.push(policyIssue({
        code: 'candidate-requires-core-patch',
        candidateId: candidate.id,
        message: 'active candidate must not require a core patch',
      }))
    }
    if (candidate.nodeEngine === null || candidate.nodeEngineEvidence === null) {
      issues.push(policyIssue({
        code: 'candidate-node-evidence-missing',
        candidateId: candidate.id,
        message: 'active candidate must carry verified Node compatibility evidence',
      }))
    }
    issues.push(...enterprisePolicyIssues(candidate))

    for (const [field, value] of candidateResourceEntries(candidate)) {
      const resourceKey = `${field}\u0000${value}`
      const previousCandidates = seenResources.get(resourceKey) ?? []
      const previous = previousCandidates.find(other =>
        profilesOverlap(other.targetProfiles, candidate.targetProfiles))
      if (previous !== undefined) {
        issues.push(policyIssue({
          code: 'candidate-resource-duplicate',
          candidateId: candidate.id,
          message: 'active candidates claim the same resource',
          details: { field, candidates: [previous.id, candidate.id], value },
        }))
      }
      seenResources.set(resourceKey, [...previousCandidates, candidate])
    }
  }
  issues.push(...requiredRuntimeBundleProviderIssues(catalog))

  return issues
}

/**
 * Validate relationships between parsed policy catalogs.
 * @param catalog - Candidate catalog referenced by policy rows.
 * @param conflicts - Capability conflict rules to inspect.
 * @param permissions - Permission defaults and ordered rules to inspect.
 * @returns semantic policy issues.
 */
export function validatePolicySemantics(
  catalog: CuratedCatalog,
  conflicts: CapabilityConflictCatalog,
  permissions: PermissionRuleCatalog,
): PolicyIssue[] {
  const candidatesById = new Map(catalog.candidates.map(candidate => [candidate.id, candidate]))
  const seenCapabilities = new Set<string>()
  const issues: PolicyIssue[] = []
  if (conflicts.schemaVersion !== 1) {
    issues.push(policyIssue({
      code: 'capability-conflict-schema-version',
      message: 'curated capability conflict schemaVersion must be 1',
    }))
  }
  if (permissions.schemaVersion !== 1) {
    issues.push(policyIssue({
      code: 'permission-schema-version',
      message: 'curated permission schemaVersion must be 1',
    }))
  }
  if (permissions.defaults.configImportMode !== 'dry-run') {
    issues.push(policyIssue({
      code: 'permission-config-import-mode-unsafe',
      message: 'curated permission defaults must keep configImportMode at dry-run',
    }))
  }
  if (permissions.defaults.otelCaptureBody !== false) {
    issues.push(policyIssue({
      code: 'permission-otel-capture-body-unsafe',
      message: 'curated permission defaults must keep otelCaptureBody false',
    }))
  }
  if (permissions.defaults.credentialStorage !== 'credentials-service-or-env') {
    issues.push(policyIssue({
      code: 'permission-credential-storage-unsafe',
      message: 'curated permission defaults must keep credentials in the credentials service or environment',
    }))
  }
  for (const rule of conflicts.rules) {
    if (seenCapabilities.has(rule.capability)) {
      issues.push(policyIssue({
        code: 'capability-conflict-rule-duplicate',
        message: `capability conflict rule ${rule.capability} is duplicated`,
      }))
    }
    seenCapabilities.add(rule.capability)

    const providers = [
      ...rule.defaultProvider === null ? [] : [{ id: rule.defaultProvider, role: 'default provider' }],
      ...rule.fallbacks.map(id => ({ id, role: 'fallback' })),
    ]
    for (const provider of providers) {
      const candidate = candidatesById.get(provider.id)
      if (candidate === undefined) {
        issues.push(policyIssue({
          code: provider.role === 'fallback'
            ? 'capability-conflict-fallback-unknown'
            : 'capability-conflict-default-provider-unknown',
          candidateId: provider.id,
          message: `capability conflict ${provider.role} ${provider.id} is not present in the candidate catalog`,
        }))
      } else if (candidate.capability !== rule.capability) {
        issues.push(policyIssue({
          code: 'capability-conflict-provider-capability-mismatch',
          candidateId: provider.id,
          message: `capability conflict provider ${provider.id} declares ${candidate.capability} instead of ${rule.capability}`,
        }))
      }
    }
  }
  const seenPermissionRuleIds = new Set<string>()
  for (const rule of permissions.rules) {
    if (seenPermissionRuleIds.has(rule.id)) {
      issues.push(policyIssue({
        code: 'permission-rule-duplicate',
        message: `permission rule ${rule.id} is duplicated`,
      }))
    }
    seenPermissionRuleIds.add(rule.id)
  }
  if (!sameStrings(permissions.order, authoritativePermissionOrder)) {
    issues.push(policyIssue({
      code: 'permission-order-invalid',
      message: `permissions.order must exactly equal ${authoritativePermissionOrder.join(', ')}`,
    }))
  }
  const profiles = new Set(catalog.candidates.flatMap(candidate => candidate.targetProfiles))
  for (const profile of profiles) {
    issues.push(...validateProfileConflicts(catalog, profile, conflicts))
  }
  return issues
}

function enterprisePolicyIssues(candidate: CuratedCandidate): PolicyIssue[] {
  if (!candidate.targetProfiles.includes('web-enterprise')) return []
  const issues: PolicyIssue[] = []
  if (candidate.networkAccess.includes('optional-anonymous-vision-fallback')) {
    issues.push(policyIssue({
      code: 'enterprise-anonymous-vision-fallback-active',
      candidateId: candidate.id,
      message: 'web-enterprise must disable anonymous vision fallback',
    }))
  }
  if (candidate.networkAccess.includes('full-im-body-egress')) {
    issues.push(policyIssue({
      code: 'enterprise-im-body-egress-active',
      candidateId: candidate.id,
      message: 'web-enterprise must not egress full IM bodies by default',
    }))
  }
  if (requiresInstallBuild(candidate)) {
    issues.push(policyIssue({
      code: 'enterprise-automatic-install-scripts-active',
      candidateId: candidate.id,
      message: 'web-enterprise must not activate candidates with unsafe install lifecycle scripts',
    }))
  }
  if (candidate.networkAccess.includes('optional-browser-download') || candidate.networkAccess.includes('browser-download')) {
    issues.push(policyIssue({
      code: 'enterprise-unapproved-browser-download-active',
      candidateId: candidate.id,
      message: 'web-enterprise must not allow browser downloads by default',
    }))
  }
  return issues
}

function requiredRuntimeBundleProviderIssues(catalog: CuratedCatalog): PolicyIssue[] {
  const issues: PolicyIssue[] = []
  for (const candidate of catalog.candidates) {
    if (!candidate.active) continue
    for (const profileId of candidate.targetProfiles) {
      for (const bundle of candidate.requiredRuntimeBundles ?? []) {
        const provider = catalog.candidates.find(current =>
          current !== candidate
          && current.active
          && current.expectedPackage === bundle
          && current.targetProfiles.includes(profileId)
          && current.runtimeActivationEvidence?.[profileId] !== undefined)
        if (provider !== undefined) continue
        issues.push(policyIssue({
          code: 'candidate-required-runtime-bundle-provider-missing',
          candidateId: candidate.id,
          profileId,
          message: 'required runtime bundle must be provided by another active candidate in the same profile',
          details: { bundle },
        }))
      }
    }
  }
  return issues
}

function isInstallLifecycleScript(script: string): boolean {
  return script === 'preinstall'
    || script === 'install'
    || script === 'postinstall'
    || script === 'prepare'
    || script === 'prepack'
}

function requiresInstallBuild(candidate: CuratedCandidate): boolean {
  return Object.keys(candidate.installScripts).some(script =>
    script === 'preinstall'
    || script === 'install'
    || script === 'postinstall'
    || (candidate.npmVersion === undefined && isInstallLifecycleScript(script)))
}

function hasIncompleteInstallMetadata(candidate: CuratedCandidate): boolean {
  return !hasCompleteInstallMetadata(candidate)
}

function hasCompleteInstallMetadata(candidate: CuratedCandidate): boolean {
  return candidate.expectedPackage !== null
    && candidate.manifestPath !== null
    && candidate.license !== null
    && candidate.bundlePatch !== null
}

function runtimeActivationEvidenceIssues(candidate: CuratedCandidate): PolicyIssue[] {
  const evidence = candidate.runtimeActivationEvidence
  if (evidence === undefined) {
    return candidate.active
      ? [policyIssue({
        code: 'candidate-runtime-activation-evidence-missing',
        candidateId: candidate.id,
        message: 'active candidate must declare complete runtime activation evidence',
      })]
      : []
  }
  const issues: PolicyIssue[] = []
  const declaredBundles = [...(candidate.requiredRuntimeBundles ?? [])].sort()
  const evidenceProfiles = Object.keys(evidence)
  if (
    candidate.active
    && !sameStringSets(candidate.targetProfiles, evidenceProfiles)
  ) {
    issues.push(policyIssue({
      code: 'candidate-runtime-activation-evidence-profiles-mismatch',
      candidateId: candidate.id,
      message: 'runtime activation evidence profiles must exactly match the active candidate target profiles',
    }))
  }
  for (const bundle of declaredBundles) {
    if (candidate.externalDependencies.includes(bundle)) continue
    issues.push(policyIssue({
      code: 'candidate-required-runtime-bundle-undeclared',
      candidateId: candidate.id,
      message: 'required runtime bundle must be present in the audited dependency declaration',
      details: { bundle },
    }))
  }
  for (const [profileId, evidenceSet] of Object.entries(evidence)) {
    if (!sameStringSets(declaredBundles, evidenceSet.requiredRuntimeBundles)) {
      issues.push(policyIssue({
        code: 'candidate-runtime-activation-required-bundles-mismatch',
        candidateId: candidate.id,
        profileId,
        message: 'runtime activation evidence required bundles must match the candidate declaration',
      }))
    }
    for (const field of runtimeEvidenceFileFields) {
      const reference = evidenceSet[field]
      if (!isSafeRelativeEvidencePath(reference.path)) {
        issues.push(policyIssue({
          code: 'candidate-runtime-activation-evidence-path-invalid',
          candidateId: candidate.id,
          profileId,
          message: `runtime activation evidence ${field} path must be a safe repository-relative POSIX path`,
        }))
      }
      if (!isSha256(reference.sha256)) {
        issues.push(policyIssue({
          code: 'candidate-runtime-activation-evidence-sha-invalid',
          candidateId: candidate.id,
          profileId,
          message: `runtime activation evidence ${field} SHA-256 must be 64 lowercase hexadecimal characters`,
        }))
      } else if (!isNonPlaceholderSha256(reference.sha256)) {
        issues.push(policyIssue({
          code: 'candidate-runtime-activation-evidence-sha-placeholder',
          candidateId: candidate.id,
          profileId,
          message: `runtime activation evidence ${field} SHA-256 must not be a placeholder digest`,
        }))
      }
    }
  }
  return issues
}

function profilesOverlap(left: readonly string[], right: readonly string[]): boolean {
  const leftProfiles = new Set(left)
  return right.some(profile => leftProfiles.has(profile))
}

function isCanonicalGitHubRepository(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'github.com'
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
    || url.pathname.includes('%')
  ) {
    return false
  }
  const segments = url.pathname.split('/').slice(1)
  return segments.length === 2
    && githubOwnerPattern.test(segments[0] as string)
    && githubRepositoryNamePattern.test(segments[1] as string)
    && segments[1] !== '.'
    && segments[1] !== '..'
    && !/\.git$/iu.test(segments[1] as string)
    && value === `https://github.com/${segments.join('/')}`
}

function isSafeRelativeEvidencePath(value: string): boolean {
  return value.length > 0
    && !isAbsolute(value)
    && !windowsAbsolutePathPattern.test(value)
    && !value.includes('\\')
    && !value.includes('\0')
    && posix.normalize(value) === value
    && value !== '.'
    && value !== '..'
    && !value.startsWith('../')
}

function isCompleteRuntimeEvidenceFile(value: unknown): boolean {
  if (!isRecord(value) || !hasExactKeys(value, runtimeEvidenceFileKeys)) return false
  return typeof value.path === 'string'
    && isSafeRelativeEvidencePath(value.path)
    && typeof value.sha256 === 'string'
    && isNonPlaceholderSha256(value.sha256)
}

function isSha256(value: string): boolean {
  return sha256Pattern.test(value)
}

function isNonPlaceholderSha256(value: string): boolean {
  return isSha256(value) && !isPlaceholderDigest(value)
}

function isNonEmptyStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value)
    && value.every(item => typeof item === 'string' && item.length > 0)
}

function hasExactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  return sameStringSets(Object.keys(record), expected)
}

function sameStringSets(left: readonly string[], right: readonly string[]): boolean {
  return sameStrings([...left].sort(), [...right].sort())
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * Validate active-provider conflicts for one curated profile.
 * @param catalog - Catalog to inspect.
 * @param profileId - Profile id whose active candidates should be checked.
 * @param conflicts - Conflict table whose provider relationships should be enforced.
 * @returns policy issues for duplicate active capability providers.
 */
export function validateProfileConflicts(
  catalog: CuratedCatalog,
  profileId: string,
  conflicts?: CapabilityConflictCatalog,
): PolicyIssue[] {
  const issues: PolicyIssue[] = []
  const seenCapability = new Map<string, string>()
  const activeCandidates = catalog.candidates
    .filter(candidate => candidate.active && candidate.targetProfiles.includes(profileId))

  for (const candidate of activeCandidates) {
    const previous = seenCapability.get(candidate.capability)
    if (previous !== undefined) {
      issues.push(policyIssue({
        code: 'profile-capability-duplicate',
        candidateId: candidate.id,
        profileId,
        message: `profile ${profileId} capability ${candidate.capability} has multiple active candidates: ${previous}, ${candidate.id}`,
        details: { capability: candidate.capability, candidates: [previous, candidate.id] },
      }))
      continue
    }
    seenCapability.set(candidate.capability, candidate.id)
  }

  for (const rule of conflicts?.rules ?? []) {
    const providerIds = new Set([
      ...rule.defaultProvider === null ? [] : [rule.defaultProvider],
      ...rule.fallbacks,
    ])
    const activeProviders = activeCandidates.filter(candidate => providerIds.has(candidate.id))
    const conflicting = activeProviders[1]
    if (conflicting !== undefined) {
      issues.push(policyIssue({
        code: 'profile-conflict-rule-violation',
        candidateId: conflicting.id,
        profileId,
        message: `profile ${profileId} conflict rule ${rule.capability} has multiple active providers: ${activeProviders.map(candidate => candidate.id).join(', ')}`,
        details: {
          capability: rule.capability,
          candidates: activeProviders.map(candidate => candidate.id),
          rule: rule.rule,
        },
      }))
    }
    for (const candidate of activeCandidates) {
      if (candidate.capability !== rule.capability || providerIds.has(candidate.id)) continue
      issues.push(policyIssue({
        code: 'profile-conflict-provider-unmanaged',
        candidateId: candidate.id,
        profileId,
        message: `profile ${profileId} capability ${rule.capability} uses unmanaged provider ${candidate.id}`,
        details: { capability: rule.capability, candidate: candidate.id },
      }))
    }
  }

  return issues
}

/**
 * Recursively replace secret-like object fields and scalar strings.
 * @param value - Value to redact before including it in errors or diagnostics.
 * @returns a copy with suspected secrets replaced by `[REDACTED]`.
 */
export function redactSecretLikeValues(value: unknown): unknown {
  if (typeof value === 'string') return redactSecretText(value)
  if (Array.isArray(value)) return value.map(item => redactSecretLikeValues(item))
  if (!isRecord(value)) return value

  const output: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value)) {
    output[key] = secretKeyPattern.test(key) ? redacted : redactSecretLikeValues(item)
  }
  return output
}

/**
 * Format a YAML parse failure with secret-bearing code-frame lines redacted.
 * @param error - Error thrown by `js-yaml`.
 * @param fileIdentity - File path or stable file label safe to identify after redaction.
 * @param yamlSource - Original YAML used to retain a redacted parser code frame.
 * @returns a parse diagnostic with a value-free reason for secret-marked lines,
 * or `undefined` for a non-YAML error.
 */
export function formatYamlParseError(
  error: unknown,
  fileIdentity: string,
  yamlSource?: string,
): string | undefined {
  if (!(error instanceof YAMLException)) return undefined
  const mark = error.mark
  const location = ` at line ${String(mark.line + 1)}, column ${String(mark.column + 1)}`
  const codeFrame = yamlSource === undefined
    ? ''
    : `\n\n${redactYamlCodeFrame(mark.snippet, yamlSource)}`
  const reason = yamlSource !== undefined && yamlSecretLineNumbers(yamlSource).has(mark.line + 1)
    ? 'invalid YAML near redacted value'
    : redactSecretText(error.reason)
  return `${reason} in ${redactSecretText(fileIdentity)}${location}${codeFrame}`
}

/** Read-only curated policy service exposed as `ctx.curatedPolicy`. */
export class CuratedPolicy {
  private readonly catalog: CuratedCatalog
  private readonly conflicts: CapabilityConflictCatalog
  private readonly permissions: PermissionRuleCatalog
  private readonly profileCandidates = new Map<string, readonly CuratedCandidate[]>()

  /**
   * Create a query service over immutable curated policy snapshots.
   * @param catalog - Parsed catalog; omitted loads the checked-in allowlist.
   * @param conflicts - Parsed conflict table; omitted loads the checked-in table.
   * @param permissions - Parsed permission rules; omitted loads the checked-in rules.
   */
  constructor(
    catalog: CuratedCatalog = loadCuratedCatalog(),
    conflicts: CapabilityConflictCatalog = loadCapabilityConflicts(),
    permissions: PermissionRuleCatalog = loadPermissionRules(),
  ) {
    this.catalog = freezeCatalog(copyCatalog(catalog))
    this.conflicts = deepFreeze(copyCapabilityConflicts(conflicts))
    this.permissions = deepFreeze(copyPermissionRules(permissions))
  }

  /**
   * List every audited candidate in catalog order.
   * @returns a frozen array of frozen candidate records.
   */
  listCandidates(): readonly CuratedCandidate[] {
    return this.catalog.candidates
  }

  /**
   * List every curated capability conflict rule in catalog order.
   * @returns a frozen array of frozen conflict rules.
   */
  listCapabilityConflicts(): readonly CapabilityConflictRule[] {
    return this.conflicts.rules
  }

  /**
   * List every curated permission rule in catalog order.
   * @returns a frozen array of frozen permission rules.
   */
  listPermissionRules(): readonly PermissionRule[] {
    return this.permissions.rules
  }

  /**
   * List active candidates assigned to one profile.
   * @param profileId - Curated profile id.
   * @returns a stable frozen array in catalog order.
   */
  getProfileCandidates(profileId: string): readonly CuratedCandidate[] {
    const cached = this.profileCandidates.get(profileId)
    if (cached !== undefined) return cached

    const candidates = Object.freeze(
      this.catalog.candidates
        .filter(candidate => candidate.active && candidate.targetProfiles.includes(profileId)),
    )
    this.profileCandidates.set(profileId, candidates)
    return candidates
  }
}

/**
 * Register `ctx.curatedPolicy` for the lifetime of this plugin fiber.
 * @param ctx - plugin context that owns the effect.
 * @param config - optional policy file overrides for tests or custom deployments.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const catalogPath = configPathOverride(config, 'catalogPath')
  const conflictPath = configPathOverride(config, 'conflictPath')
  const permissionRulesPath = configPathOverride(config, 'permissionRulesPath')
  const catalog = loadCuratedCatalog(catalogPath)
  const conflicts = loadCapabilityConflicts(conflictPath)
  const permissions = loadPermissionRules(permissionRulesPath)
  const issues = [
    ...validateCandidateLock(catalog),
    ...validatePolicySemantics(catalog, conflicts, permissions),
  ]
  if (issues.length > 0) throw new Error(`curated policy is invalid: ${issues.map(issue => issue.message).join('; ')}`)
  const policy = new CuratedPolicy(catalog, conflicts, permissions)
  ctx.effect(() => ctx.provide('curatedPolicy', policy), 'curatedPolicy.provide')
}

function configPathOverride(config: Config, field: keyof Config): string | undefined {
  const value = config[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`curated policy config ${field} must be a non-empty string`)
  }
  return value
}

interface PolicyIssueInput {
  readonly code: string
  readonly candidateId?: string
  readonly profileId?: string
  readonly message: string
  readonly details?: unknown
}

function loadPolicyYaml(filePath: string, label: string): unknown {
  let source: string | undefined
  try {
    source = readFileSync(filePath, 'utf8')
    return loadYaml(source, { filename: filePath })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(
      `${label} cannot be loaded: ${formatYamlParseError(error, filePath, source) ?? redactSecretText(message)}`,
    )
  }
}

function policyIssue(input: PolicyIssueInput): PolicyIssue {
  return {
    code: input.code,
    ...input.candidateId === undefined ? {} : { candidateId: redactSecretText(input.candidateId) },
    ...input.profileId === undefined ? {} : { profileId: redactSecretText(input.profileId) },
    message: redactSecretText(input.message),
    ...input.details === undefined ? {} : { details: redactSecretLikeValues(input.details) },
  }
}

function readCatalog(value: unknown): CuratedCatalog {
  const root = recordField(value, 'catalog')
  assertOnlyKeys(root, catalogKeys, 'catalog')
  const source = recordField(root.source, 'source')
  assertOnlyKeys(source, catalogSourceKeys, 'source')
  const awesome = recordField(source.awesome, 'source.awesome')
  assertOnlyKeys(awesome, awesomeSourceKeys, 'source.awesome')
  return {
    schemaVersion: numberField(root, 'schemaVersion', 'catalog'),
    source: {
      awesome: {
        repository: stringField(awesome, 'repository', 'source.awesome'),
        commit: stringField(awesome, 'commit', 'source.awesome'),
        file: stringField(awesome, 'file', 'source.awesome'),
      },
      matrix: stringField(source, 'matrix', 'source'),
    },
    candidates: arrayField(root, 'candidates', 'catalog')
      .map((candidate, index) => readCandidate(candidate, `candidates[${String(index)}]`)),
  }
}

function readCapabilityConflicts(value: unknown): CapabilityConflictCatalog {
  const root = recordField(value, 'capability conflicts')
  assertOnlyKeys(root, capabilityConflictCatalogKeys, 'capability conflicts')
  return {
    schemaVersion: numberField(root, 'schemaVersion', 'capability conflicts'),
    source: stringField(root, 'source', 'capability conflicts'),
    rules: arrayField(root, 'rules', 'capability conflicts')
      .map((rule, index) => readCapabilityConflictRule(rule, `rules[${String(index)}]`)),
  }
}

function readCapabilityConflictRule(value: unknown, label: string): CapabilityConflictRule {
  const record = recordField(value, label)
  assertOnlyKeys(record, capabilityConflictRuleKeys, label)
  return {
    capability: stringField(record, 'capability', label),
    defaultProvider: nullableStringField(record, 'defaultProvider', label),
    fallbacks: stringArrayField(record, 'fallbacks', label),
    rule: conflictRuleKindField(record, 'rule', label),
    reason: stringField(record, 'reason', label),
  }
}

function readPermissionRules(value: unknown): PermissionRuleCatalog {
  const root = recordField(value, 'permission rules')
  assertOnlyKeys(root, permissionCatalogKeys, 'permission rules')
  const defaults = scalarRecordField(root, 'defaults', 'permission rules')
  assertOnlyKeys(defaults, permissionDefaultKeys, 'permission rules.defaults')
  return {
    schemaVersion: numberField(root, 'schemaVersion', 'permission rules'),
    source: stringField(root, 'source', 'permission rules'),
    order: stringArrayField(root, 'order', 'permission rules'),
    defaults,
    rules: arrayField(root, 'rules', 'permission rules')
      .map((rule, index) => readPermissionRule(rule, `rules[${String(index)}]`)),
  }
}

function readPermissionRule(value: unknown, label: string): PermissionRule {
  const record = recordField(value, label)
  assertOnlyKeys(record, permissionRuleKeys, label)
  return {
    id: stringField(record, 'id', label),
    decision: permissionDecisionField(record, 'decision', label),
    appliesTo: stringArrayField(record, 'appliesTo', label),
    reason: stringField(record, 'reason', label),
  }
}

function readCandidate(value: unknown, label: string): CuratedCandidate {
  const record = recordField(value, label)
  assertOnlyKeys(record, candidateKeys, label)
  const declaredScore = optionalNumberField(record, 'score', label)
  const scoreDimensions = readScoreDimensions(record.scoreDimensions, `${label}.scoreDimensions`)
  const score = scoreDimensionFields.reduce((total, field) => total + scoreDimensions[field], 0)
  if (declaredScore !== undefined && declaredScore !== score) {
    throw new Error(`curated catalog ${label}.score must equal the computed score dimension total`)
  }
  const resources = optionalResources(record.resources, `${label}.resources`)
  const config = optionalCandidateConfig(record.config, `${label}.config`)
  const runtimeActivationEvidence = optionalRuntimeActivationEvidence(
    record.runtimeActivationEvidence,
    `${label}.runtimeActivationEvidence`,
  )
  const sourceContentSha256 = optionalStringField(record, 'sourceContentSha256', label)
  const treeSha256 = optionalStringField(record, 'treeSha256', label)
  const runtimeDependencyClosureSha256 = optionalStringField(
    record,
    'runtimeDependencyClosureSha256',
    label,
  )
  const npmVersion = optionalStringField(record, 'npmVersion', label)
  const npmIntegrity = optionalStringField(record, 'npmIntegrity', label)
  const nodeEngine = nullableStringField(record, 'nodeEngine', label)
  const nodeEngineEvidence = nullableStringField(record, 'nodeEngineEvidence', label)
  return {
    id: stringField(record, 'id', label),
    priority: priorityField(record, 'priority', label),
    capability: stringField(record, 'capability', label),
    repository: stringField(record, 'repository', label),
    repositoryPath: nullableStringField(record, 'repositoryPath', label),
    commit: stringField(record, 'commit', label),
    sourceStatus: sourceStatusField(record, 'sourceStatus', label),
    auditedAt: stringField(record, 'auditedAt', label),
    manifestPath: nullableStringField(record, 'manifestPath', label),
    expectedPackage: nullableStringField(record, 'expectedPackage', label),
    nodeEngine,
    nodeEngineEvidence,
    requiresCorePatch: nullableBooleanField(record, 'requiresCorePatch', label),
    license: nullableStringField(record, 'license', label),
    bundlePatch: nullableStringField(record, 'bundlePatch', label),
    ...sourceContentSha256 === undefined ? {} : { sourceContentSha256 },
    ...treeSha256 === undefined ? {} : { treeSha256 },
    ...runtimeDependencyClosureSha256 === undefined ? {} : { runtimeDependencyClosureSha256 },
    ...npmVersion === undefined ? {} : { npmVersion },
    ...npmIntegrity === undefined ? {} : { npmIntegrity },
    testFiles: numberField(record, 'testFiles', label),
    ciWorkflows: numberField(record, 'ciWorkflows', label),
    installScripts: stringRecordField(record, 'installScripts', label),
    externalDependencies: stringArrayField(record, 'externalDependencies', label),
    ...record.requiredRuntimeBundles === undefined
      ? {}
      : { requiredRuntimeBundles: stringArrayField(record, 'requiredRuntimeBundles', label) },
    networkAccess: stringArrayField(record, 'networkAccess', label),
    credentials: stringArrayField(record, 'credentials', label),
    targetProfiles: stringArrayField(record, 'targetProfiles', label),
    active: booleanField(record, 'active', label),
    auditWarnings: stringArrayField(record, 'auditWarnings', label),
    rejections: arrayField(record, 'rejections', label).map((rejection, index) => readRejection(rejection, `${label}.rejections[${String(index)}]`)),
    scoreDimensions,
    score,
    ...resources === undefined ? {} : { resources },
    ...config === undefined ? {} : { config },
    ...runtimeActivationEvidence === undefined ? {} : { runtimeActivationEvidence },
  }
}

function readRejection(value: unknown, label: string): CuratedRejection {
  const record = recordField(value, label)
  assertOnlyKeys(record, rejectionKeys, label)
  return {
    code: stringField(record, 'code', label),
    evidence: stringField(record, 'evidence', label),
  }
}

function optionalResources(value: unknown, label: string): CuratedCandidateResources | undefined {
  if (value === undefined) return undefined
  const record = recordField(value, label)
  assertOnlyKeys(record, resourceFields, label)
  const resources: Partial<Record<ResourceField, readonly string[]>> = {}
  for (const field of resourceFields) {
    if (record[field] === undefined) continue
    resources[field] = stringArrayField(record, field, label)
  }
  return resources
}

function optionalCandidateConfig(value: unknown, label: string): CuratedCandidateConfig | undefined {
  if (value === undefined) return undefined
  const record = recordField(value, label)
  assertOnlyKeys(record, candidateConfigKeys, label)
  return {
    entryId: stringField(record, 'entryId', label),
    values: recordField(record.values, `${label}.values`),
  }
}

function optionalRuntimeActivationEvidence(
  value: unknown,
  label: string,
): CuratedRuntimeActivationEvidence | undefined {
  if (value === undefined) return undefined
  const record = recordField(value, label)
  return Object.fromEntries(Object.entries(record).map(([profile, evidence]) => {
    if (profile.length === 0) {
      throw new Error(`curated catalog ${label} profile keys must be non-empty strings`)
    }
    return [
      profile,
      readRuntimeActivationEvidenceSet(evidence, `${label}.${redactSecretText(profile)}`),
    ]
  }))
}

function readRuntimeActivationEvidenceSet(
  value: unknown,
  label: string,
): CuratedRuntimeActivationEvidenceSet {
  const record = recordField(value, label)
  assertOnlyKeys(record, runtimeActivationEvidenceKeys, label)
  return {
    keylessAssembledSnapshot: readRuntimeEvidenceFile(
      record.keylessAssembledSnapshot,
      `${label}.keylessAssembledSnapshot`,
    ),
    requiredRuntimeBundles: stringArrayField(record, 'requiredRuntimeBundles', label),
    install: readRuntimeEvidenceFile(record.install, `${label}.install`),
    enable: readRuntimeEvidenceFile(record.enable, `${label}.enable`),
    restart: readRuntimeEvidenceFile(record.restart, `${label}.restart`),
    disableOrUninstall: readRuntimeEvidenceFile(
      record.disableOrUninstall,
      `${label}.disableOrUninstall`,
    ),
  }
}

function readRuntimeEvidenceFile(value: unknown, label: string): CuratedRuntimeEvidenceFile {
  const record = recordField(value, label)
  assertOnlyKeys(record, runtimeEvidenceFileKeys, label)
  return {
    path: stringField(record, 'path', label),
    sha256: stringField(record, 'sha256', label),
  }
}

function readScoreDimensions(value: unknown, label: string): CuratedScoreDimensions {
  const record = recordField(value, label)
  assertOnlyKeys(record, Object.keys(scoreDimensionMaximums), label)
  const dimensions: Record<keyof CuratedScoreDimensions, number> = {
    nativeCompatibility: 0,
    functionalCompleteness: 0,
    testAndCi: 0,
    securityAndPrivacy: 0,
    maintenanceHealth: 0,
    performanceCost: 0,
    operability: 0,
    communitySignal: 0,
  }
  for (const field of scoreDimensionFields) {
    const maximum = scoreDimensionMaximums[field]
    const score = numberField(record, field, label)
    if (!Number.isInteger(score) || score < 0 || score > maximum) {
      throw new Error(`curated catalog ${label}.${field} must be an integer between 0 and ${String(maximum)}`)
    }
    dimensions[field] = score
  }
  return dimensions
}

function candidateResourceEntries(candidate: CuratedCandidate): [ResourceField, string][] {
  if (candidate.resources === undefined) return []
  const entries: [ResourceField, string][] = []
  for (const field of resourceFields) {
    const values = candidate.resources[field]
    if (values === undefined) continue
    for (const value of values) entries.push([field, value])
  }
  return entries
}

function recordField(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`curated catalog ${label} must be a map`)
  return value
}

function stringField(record: Record<string, unknown>, field: string, label: string): string {
  const value = record[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`curated catalog ${label}.${field} must be a non-empty string`)
  }
  return value
}

function nullableStringField(record: Record<string, unknown>, field: string, label: string): string | null {
  const value = record[field]
  if (value === null) return null
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`curated catalog ${label}.${field} must be null or a non-empty string`)
  }
  return value
}

function optionalStringField(record: Record<string, unknown>, field: string, label: string): string | undefined {
  const value = record[field]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`curated catalog ${label}.${field} must be a non-empty string`)
  }
  return value
}

function numberField(record: Record<string, unknown>, field: string, label: string): number {
  const value = record[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`curated catalog ${label}.${field} must be a finite number`)
  }
  return value
}

function optionalNumberField(record: Record<string, unknown>, field: string, label: string): number | undefined {
  const value = record[field]
  if (value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`curated catalog ${label}.${field} must be a finite number`)
  }
  return value
}

function booleanField(record: Record<string, unknown>, field: string, label: string): boolean {
  const value = record[field]
  if (typeof value !== 'boolean') throw new Error(`curated catalog ${label}.${field} must be a boolean`)
  return value
}

function nullableBooleanField(record: Record<string, unknown>, field: string, label: string): boolean | null {
  const value = record[field]
  if (value === null || typeof value === 'boolean') return value
  throw new Error(`curated catalog ${label}.${field} must be null or a boolean`)
}

function sourceStatusField(record: Record<string, unknown>, field: string, label: string): CuratedSourceStatus {
  const value = stringField(record, field, label)
  if (value === 'verified' || value === 'unreachable') return value
  throw new Error(`curated catalog ${label}.${field} must be verified or unreachable`)
}

function assertOnlyKeys(
  record: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const allowedKeys = new Set(allowed)
  const unknown = Object.keys(record).find(key => !allowedKeys.has(key))
  if (unknown !== undefined) throw new Error(`curated catalog ${label} contains unknown key ${redactSecretText(unknown)}`)
}

function arrayField(record: Record<string, unknown>, field: string, label: string): unknown[] {
  const value = record[field]
  if (!Array.isArray(value)) throw new Error(`curated catalog ${label}.${field} must be a list`)
  return value
}

function stringArrayField(record: Record<string, unknown>, field: string, label: string): string[] {
  return arrayField(record, field, label).map((item, index) => {
    if (typeof item !== 'string' || item.length === 0) {
      throw new Error(`curated catalog ${label}.${field}[${String(index)}] must be a non-empty string`)
    }
    return item
  })
}

function stringRecordField(record: Record<string, unknown>, field: string, label: string): Record<string, string> {
  const value = recordField(record[field], `${label}.${field}`)
  const output: Record<string, string> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string' || item.length === 0) {
      throw new Error(`curated catalog ${label}.${field}.${key} must be a non-empty string`)
    }
    output[key] = item
  }
  return output
}

function scalarRecordField(record: Record<string, unknown>, field: string, label: string): Record<string, string | boolean> {
  const value = recordField(record[field], `${label}.${field}`)
  const output: Record<string, string | boolean> = {}
  for (const [key, item] of Object.entries(value)) {
    if ((typeof item !== 'string' || item.length === 0) && typeof item !== 'boolean') {
      throw new Error(`curated catalog ${label}.${field}.${key} must be a non-empty string or boolean`)
    }
    output[key] = item
  }
  return output
}

function priorityField(record: Record<string, unknown>, field: string, label: string): CuratedPriority {
  const value = stringField(record, field, label)
  if (value === 'P0' || value === 'P1' || value === 'P2') return value
  throw new Error(`curated catalog ${label}.${field} must be P0, P1, or P2`)
}

function conflictRuleKindField(record: Record<string, unknown>, field: string, label: string): CapabilityConflictRuleKind {
  const value = stringField(record, field, label)
  if (value === 'not-simultaneous' || value === 'one-active-provider' || value === 'not-long-running-together') return value
  throw new Error(`curated catalog ${label}.${field} must be a known conflict rule kind`)
}

function permissionDecisionField(record: Record<string, unknown>, field: string, label: string): PermissionDecision {
  const value = stringField(record, field, label)
  if (value === 'allow' || value === 'ask' || value === 'deny') return value
  throw new Error(`curated catalog ${label}.${field} must be allow, ask, or deny`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPlaceholderDigest(value: string): boolean {
  return /^(.)\1+$/u.test(value) || /^([0-9a-f]{2})\1+$/u.test(value)
}

/**
 * Check that an npm version is one complete SemVer 2.0 version.
 * @param value - Version text to validate without range, tag, or `v` prefix coercion.
 * @returns whether the complete value is a valid SemVer 2.0 version.
 */
export function isExactNpmVersion(value: string): boolean {
  return exactNpmVersionPattern.test(value)
}

/**
 * Check that an npm integrity value is one canonical, non-placeholder SHA-512 digest.
 * @param value - SRI text to validate.
 * @returns whether the value decodes canonically to 64 non-placeholder bytes.
 */
export function isExactNpmIntegrity(value: string): boolean {
  const match = npmIntegrityPattern.exec(value)
  if (match === null) return false
  const encoded = match[1] as string
  const digest = Buffer.from(encoded, 'base64')
  return digest.byteLength === 64
    && digest.toString('base64') === encoded
    && !digest.every(byte => byte === digest[0])
}

function redactSecretText(value: string): string {
  return value
    .replace(urlUserinfoReplacementPattern, `$1${redacted}@`)
    .replace(schemelessUrlUserinfoReplacementPattern, `${redacted}@`)
    .replace(privateKeyBlockReplacementPattern, redacted)
    .replace(secretAssignmentReplacementPattern, `$1${redacted}`)
    .replace(secretValueReplacementPattern, redacted)
}

function redactYamlCodeFrame(snippet: string, source: string): string {
  const secretLines = yamlSecretLineNumbers(source)
  const sourceLines = source.split(/\r?\n/u)
  return redactSecretText(
    snippet.replace(
      /^([ \t]*(\d+)[ \t]+\|)[^\r\n]*/gmu,
      (line, prefix: string, lineNumber: string) => {
        const sourceLineNumber = Number(lineNumber)
        if (secretLines.has(sourceLineNumber)) return `${prefix} ${redacted}`
        return /^[ \t]*\.\.\.[ \t]*$/u.test(line.slice(prefix.length))
          ? `${prefix} ${sourceLines[sourceLineNumber - 1] as string}`
          : line
      },
    ),
  )
}

function yamlSecretLineNumbers(source: string): ReadonlySet<number> {
  const secretLines = new Set<number>()
  let secretIndent: number | undefined
  let explicitSecretValueIndent: number | undefined
  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    const indent = line.length - line.trimStart().length
    if (secretIndent !== undefined) {
      if (line.trim().length === 0 || line.trimStart().startsWith('#') || indent > secretIndent) {
        secretLines.add(index + 1)
        continue
      }
      secretIndent = undefined
    }
    if (explicitSecretValueIndent !== undefined) {
      if (line.trim().length === 0) continue
      if (line.trimStart().startsWith('#')) {
        secretLines.add(index + 1)
        continue
      }
      if (indent === explicitSecretValueIndent && /^:[ \t]/u.test(line.trimStart())) {
        secretLines.add(index + 1)
        secretIndent = indent
        explicitSecretValueIndent = undefined
        continue
      }
      explicitSecretValueIndent = undefined
    }
    const explicitMapping = yamlExplicitMapping(line)
    if (explicitMapping !== undefined && secretKeyPattern.test(explicitMapping.key)) {
      secretLines.add(index + 1)
      if (explicitMapping.hasValue) {
        secretIndent = explicitMapping.valueIndent
      } else {
        explicitSecretValueIndent = explicitMapping.valueIndent
      }
      continue
    }
    if (!yamlMappingKeys(line).some(key => secretKeyPattern.test(key))) continue
    secretLines.add(index + 1)
    secretIndent = indent
  }
  return secretLines
}

function yamlExplicitMapping(
  line: string,
): { readonly key: string; readonly valueIndent: number; readonly hasValue: boolean } | undefined {
  let valueIndent = line.length - line.trimStart().length
  let trimmed = line.trimStart()
  const sequenceIndicator = /^-[ \t]+/u.exec(trimmed)?.[0]
  if (sequenceIndicator !== undefined) {
    valueIndent += sequenceIndicator.length
    trimmed = trimmed.slice(sequenceIndicator.length)
  }
  if (!/^\?[ \t]+/u.test(trimmed)) return undefined
  const content = trimmed.slice(1).trimStart()
  const separator = yamlMappingSeparator(content)
  return {
    key: decodeYamlMappingKey(
      (separator === undefined ? content : content.slice(0, separator)).trim(),
    ),
    valueIndent,
    hasValue: separator !== undefined,
  }
}

function yamlMappingKeys(line: string): string[] {
  const keys: string[] = []
  let candidateStart = 0
  let flowDepth = 0
  let quote: '"' | "'" | undefined
  let escaped = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line.charAt(index)
    if (quote === '"') {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quote = undefined
      continue
    }
    if (quote === "'") {
      if (character !== "'") continue
      if (line.charAt(index + 1) === "'") index += 1
      else quote = undefined
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === '{' || character === '[') {
      flowDepth += 1
      candidateStart = index + 1
      continue
    }
    if (character === '}' || character === ']') {
      flowDepth = Math.max(0, flowDepth - 1)
      continue
    }
    if (character === ',') {
      candidateStart = index + 1
      continue
    }
    if (
      character !== ':'
      || (flowDepth === 0 && !/^[ \t]*$/u.test(line.slice(index + 1, index + 2)))
    ) {
      continue
    }
    const encodedKey = line.slice(candidateStart, index)
      .trim()
      .replace(/^(?:-[ \t]+)+/u, '')
    keys.push(decodeYamlMappingKey(encodedKey))
  }
  return keys
}

function yamlMappingSeparator(value: string): number | undefined {
  let quote: '"' | "'" | undefined
  let escaped = false
  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index)
    if (quote === '"') {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quote = undefined
      continue
    }
    if (quote === "'") {
      if (character !== "'") continue
      if (value.charAt(index + 1) === "'") index += 1
      else quote = undefined
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === ':' && /^[ \t]*$/u.test(value.slice(index + 1, index + 2))) return index
  }
  return undefined
}

function decodeYamlMappingKey(encodedKey: string): string {
  try {
    const parsed = loadYaml(`${encodedKey}: null`, { schema: FAILSAFE_SCHEMA })
    /* v8 ignore next -- a successful synthetic key mapping parse always returns a map. */
    if (!isRecord(parsed)) return encodedKey
    return Object.keys(parsed)[0] as string
  } catch {
    return encodedKey
  }
}

function containsSecretMaterial(value: unknown): boolean {
  if (typeof value === 'string') return secretValuePattern.test(value)
  if (Array.isArray(value)) return value.some(item => containsSecretMaterial(item))
  if (!isRecord(value)) return false

  return Object.entries(value).some(([key, item]) => {
    if (key !== 'credentials' && secretKeyPattern.test(key) && hasMaterialValue(item)) return true
    return containsSecretMaterial(item)
  })
}

function hasMaterialValue(value: unknown): boolean {
  if (typeof value === 'string') return value.length > 0
  if (Array.isArray(value)) return value.length > 0
  return isRecord(value) && Object.keys(value).length > 0
}

function copyCatalog(catalog: CuratedCatalog): CuratedCatalog {
  return {
    schemaVersion: catalog.schemaVersion,
    source: {
      awesome: {
        repository: catalog.source.awesome.repository,
        commit: catalog.source.awesome.commit,
        file: catalog.source.awesome.file,
      },
      matrix: catalog.source.matrix,
    },
    candidates: catalog.candidates.map(copyCandidate),
  }
}

function copyCapabilityConflicts(catalog: CapabilityConflictCatalog): CapabilityConflictCatalog {
  return {
    schemaVersion: catalog.schemaVersion,
    source: catalog.source,
    rules: catalog.rules.map(rule => ({
      capability: rule.capability,
      defaultProvider: rule.defaultProvider,
      fallbacks: [...rule.fallbacks],
      rule: rule.rule,
      reason: rule.reason,
    })),
  }
}

function copyPermissionRules(catalog: PermissionRuleCatalog): PermissionRuleCatalog {
  return {
    schemaVersion: catalog.schemaVersion,
    source: catalog.source,
    order: [...catalog.order],
    defaults: { ...catalog.defaults },
    rules: catalog.rules.map(rule => ({
      id: rule.id,
      decision: rule.decision,
      appliesTo: [...rule.appliesTo],
      reason: rule.reason,
    })),
  }
}

function copyCandidate(candidate: CuratedCandidate): CuratedCandidate {
  return {
    id: candidate.id,
    priority: candidate.priority,
    capability: candidate.capability,
    repository: candidate.repository,
    repositoryPath: candidate.repositoryPath,
    commit: candidate.commit,
    sourceStatus: candidate.sourceStatus,
    auditedAt: candidate.auditedAt,
    manifestPath: candidate.manifestPath,
    expectedPackage: candidate.expectedPackage,
    nodeEngine: candidate.nodeEngine,
    nodeEngineEvidence: candidate.nodeEngineEvidence,
    requiresCorePatch: candidate.requiresCorePatch,
    license: candidate.license,
    bundlePatch: candidate.bundlePatch,
    ...candidate.sourceContentSha256 === undefined
      ? {}
      : { sourceContentSha256: candidate.sourceContentSha256 },
    ...candidate.treeSha256 === undefined ? {} : { treeSha256: candidate.treeSha256 },
    ...candidate.runtimeDependencyClosureSha256 === undefined
      ? {}
      : { runtimeDependencyClosureSha256: candidate.runtimeDependencyClosureSha256 },
    ...candidate.npmVersion === undefined ? {} : { npmVersion: candidate.npmVersion },
    ...candidate.npmIntegrity === undefined ? {} : { npmIntegrity: candidate.npmIntegrity },
    testFiles: candidate.testFiles,
    ciWorkflows: candidate.ciWorkflows,
    installScripts: { ...candidate.installScripts },
    externalDependencies: [...candidate.externalDependencies],
    ...candidate.requiredRuntimeBundles === undefined
      ? {}
      : { requiredRuntimeBundles: [...candidate.requiredRuntimeBundles] },
    networkAccess: [...candidate.networkAccess],
    credentials: [...candidate.credentials],
    targetProfiles: [...candidate.targetProfiles],
    active: candidate.active,
    auditWarnings: [...candidate.auditWarnings],
    rejections: candidate.rejections.map(rejection => ({ ...rejection })),
    scoreDimensions: { ...candidate.scoreDimensions },
    score: candidate.score,
    ...candidate.resources === undefined ? {} : { resources: copyResources(candidate.resources) },
    ...candidate.config === undefined
      ? {}
      : {
        config: {
          entryId: candidate.config.entryId,
          values: structuredClone(candidate.config.values),
        },
      },
    ...candidate.runtimeActivationEvidence === undefined
      ? {}
      : {
        runtimeActivationEvidence: Object.fromEntries(
          Object.entries(candidate.runtimeActivationEvidence).map(([profile, evidence]) => [
            profile,
            {
              keylessAssembledSnapshot: { ...evidence.keylessAssembledSnapshot },
              requiredRuntimeBundles: [...evidence.requiredRuntimeBundles],
              install: { ...evidence.install },
              enable: { ...evidence.enable },
              restart: { ...evidence.restart },
              disableOrUninstall: { ...evidence.disableOrUninstall },
            },
          ]),
        ),
      },
  }
}

function copyResources(resources: CuratedCandidateResources): CuratedCandidateResources {
  return {
    ...resources.entryIds === undefined ? {} : { entryIds: [...resources.entryIds] },
    ...resources.toolNames === undefined ? {} : { toolNames: [...resources.toolNames] },
    ...resources.commandNames === undefined ? {} : { commandNames: [...resources.commandNames] },
    ...resources.serviceKeys === undefined ? {} : { serviceKeys: [...resources.serviceKeys] },
    ...resources.uiSlots === undefined ? {} : { uiSlots: [...resources.uiSlots] },
    ...resources.settingsTabs === undefined ? {} : { settingsTabs: [...resources.settingsTabs] },
    ...resources.routes === undefined ? {} : { routes: [...resources.routes] },
    ...resources.ports === undefined ? {} : { ports: [...resources.ports] },
    ...resources.sqlitePaths === undefined ? {} : { sqlitePaths: [...resources.sqlitePaths] },
    ...resources.cacheDirs === undefined ? {} : { cacheDirs: [...resources.cacheDirs] },
    ...resources.envVars === undefined ? {} : { envVars: [...resources.envVars] },
    ...resources.waterfallListeners === undefined ? {} : { waterfallListeners: [...resources.waterfallListeners] },
    ...resources.automationBehaviors === undefined ? {} : { automationBehaviors: [...resources.automationBehaviors] },
  }
}

function freezeCatalog(catalog: CuratedCatalog): CuratedCatalog {
  return deepFreeze(catalog)
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  Object.freeze(value)
  for (const item of Object.values(value)) deepFreeze(item)
  return value
}

# Curated Plugins

English | [中文](curated.zh.md)

The curated plugin layer is a governance layer for audited third-party bundle candidates and the profiles that may compose them. Its package group lives under [`packages/curated`](../../packages/curated), while the planning matrix and rollout gates live under [`docs/plugin/superpowers`](../plugin/superpowers).

`ctx.curatedPolicy` exposes read-only catalog queries for plugins and commands that need candidate facts, conflict rules, or permission seeds. The service does not install packages, run third-party lifecycle scripts, register model-facing tools, write prompt text, or append session events; profile materialization and CLI reporting are owned by the sibling curated packages.

Policy loading computes admission from eight bounded dimensions, requires canonical GitHub repository URLs and normalized source-content digests for reachable commits, requires active candidates to have verified Node evidence, no core patch, and complete runtime activation evidence keyed by exactly their target profiles, treats the checked-in provider/fallback table as authoritative, and rejects secret-like metadata. The [curated benchmark evidence directory](../../packages/curated/curated-bench/evidence/README.md) owns activation records and result artifacts. The documentation gate accepts only repository-owned tracked stage-zero regular blobs there, traverses each profile value, requires all five records to name that map key, parses each record against the operation schema, verifies its candidate and operation identities plus successful observed result, rejects secret-bearing record or artifact argv including URL userinfo without echoing arguments, and checks the separately referenced artifact path and SHA-256 against the repository. Package-authored, ignored, and untracked files cannot authorize activation. Permission rules are policy data: the curated commands validate the resolved permission plugin's fail-closed configuration, while that plugin remains responsible for tool authorization.

The intended `web-curated` baseline contains 12 candidates. Six have static/install qualification evidence, but none has a keyless assembled runnable snapshot of its pinned artifact, so the runtime-active count is zero; web search also lacks its required `@anweat/dsh-browser` bundle/runtime dependency. All five curated templates contain only installation-owned foundation bundles. Activation requires the real pinned artifact, a keyless assembled snapshot, every required dependency bundle, and retained install, enable, restart, disable or uninstall evidence. E3/E4, A/B, fault, and canary evidence remains pending.

Every curated profile disables dependency lifecycle scripts. Normal `dsh` startup and config dump require exact template and catalog composition, safe package-manager state, and static user overrides that introduce no plugin or group rows. Curated plugin help and listing are generated read-only from the checked-in template. Installation is cross-process serialized, runs offline in a private staging home, validates generated files, both pnpm lockfiles, bundle resolution, and admission, and activates by directory rename only after validation; failure preserves or restores the previous live profile. Managed observed admission additionally rejects dependency transformations and requires each root and installed lock closure to match the candidate's catalog digest.

Source: [`packages/curated/curated-policy/src/index.ts`](../../packages/curated/curated-policy/src/index.ts)

## Public types

`CapabilityConflictRule` records the mutually exclusive capability domains that profile preflight checks enforce.

```ts type-equiv
/** One capability-domain conflict rule loaded from `capability-conflicts.yaml`. */
interface CapabilityConflictRule {
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
```

`PermissionRule` seeds the fixed security-control order and default allow/ask/deny policy data.

```ts type-equiv
/** Permission rule seed loaded from `permission-rules.yaml`. */
interface PermissionRule {
  /** Stable rule id. */
  readonly id: string
  /** Default decision for this rule. */
  readonly decision: PermissionDecision
  /** Capability names or surfaces the rule applies to. */
  readonly appliesTo: readonly string[]
  /** Human-readable reason without secret material. */
  readonly reason: string
}
```

`CuratedRuntimeEvidenceFile`, `CuratedRuntimeActivationEvidenceSet`, and `CuratedRuntimeActivationEvidence` bind each target profile's activation to checked-in files.

```ts type-equiv
/** One repository-owned tracked regular blob that establishes runtime activation evidence. */
interface CuratedRuntimeEvidenceFile {
  /** Safe repository-relative POSIX path below the curated benchmark evidence directory. */
  readonly path: string
  /** SHA-256 of the checked-in file bytes. */
  readonly sha256: string
}
```

```ts type-equiv
/** Complete secret-free operation evidence for one candidate target profile. */
interface CuratedRuntimeActivationEvidenceSet {
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
```

```ts type-equiv
/** Complete runtime activation evidence keyed by candidate target profile. */
type CuratedRuntimeActivationEvidence = Readonly<Record<string, CuratedRuntimeActivationEvidenceSet>>
```

`CuratedCandidateStatus` is the current delivery state derived from activation, artifact evidence, and blockers.

```ts type-equiv
/** Current delivery state derived from activation, artifact evidence, and blockers. */
type CuratedCandidateStatus = 'active' | 'qualified' | 'pending' | 'rejected'
```

`CuratedCandidate` is the audited plugin record returned by profile queries.

```ts type-equiv
/** One audited third-party plugin candidate in the curated catalog. */
interface CuratedCandidate {
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
```

`BenchmarkSnapshotReference`, `BenchmarkBuildIdentity`, and `BenchmarkMeasurementIdentity` bind completed comparisons to immutable inputs and matching execution implementations.

```ts type-equiv
/** Content-addressed reference to one benchmark lock or profile snapshot. */
interface BenchmarkSnapshotReference {
  /** Safe relative POSIX path resolved from the benchmark fixture directory. */
  readonly path: string
  /** SHA-256 of the referenced snapshot's canonical JSON. */
  readonly sha256: string
}
```

```ts type-equiv
/** DSH executable and source identity that produced benchmark records. */
interface BenchmarkBuildIdentity {
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
```

```ts type-equiv
/** Measurement implementations whose identities must match across a comparison. */
interface BenchmarkMeasurementIdentity {
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
```

`CuratedBenchAssetDirs` names the three benchmark asset roots served by `ctx.curatedBench`.

```ts type-equiv
/** Benchmark asset directories served by `ctx.curatedBench`. */
interface CuratedBenchAssetDirs {
  /** Candidate manifest summaries directory. */
  readonly manifests: string
  /** Benchmark task-set definitions directory. */
  readonly tasks: string
  /** Baseline and comparison fixture directory. */
  readonly baselines: string
}
```

`CuratedBenchAssetKind` is the directory selector accepted by benchmark asset reads.

```ts type-equiv
/** Asset directory class accepted by the curated benchmark service. */
type CuratedBenchAssetKind = keyof CuratedBenchAssetDirs
```

`CuratedBenchJson` is the plain JSON value returned by `ctx.curatedBench.readAsset()`.

```ts type-equiv
/** Plain JSON value returned by curated benchmark asset reads. */
type CuratedBenchJson = null | boolean | number | string | readonly CuratedBenchJson[] | { readonly [key: string]: CuratedBenchJson }
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxcuratedbench--curatedbench"></a>

### `ctx.curatedBench` — `CuratedBench`

Read-only curated benchmark asset service exposed as `ctx.curatedBench`.

```ts cordis-catalog
/**
 * Return the asset directories used by this service.
 * @returns frozen directory paths keyed by asset class.
 */
assetDirs(): CuratedBenchAssetDirs

/**
 * List JSON asset paths for one asset class.
 * @param kind - Asset class to list.
 * @returns sorted POSIX-style relative JSON paths.
 * @throws when the asset tree exceeds 64 nested levels or 1,024 total entries.
 */
listAssets(kind: CuratedBenchAssetKind): readonly string[]

/**
 * Read and freeze one JSON asset.
 * @param kind - Asset class containing the file.
 * @param path - Safe POSIX-style relative path ending in `.json`.
 * @returns the parsed plain JSON value.
 * @throws when the path is unsafe, the target is not a contained stable regular
 * file, the read exceeds its limit, the content is malformed JSON, or the
 * parsed value is not plain JSON.
 */
readAsset(kind: CuratedBenchAssetKind, path: string): CuratedBenchJson
```

Source: [`packages/curated/curated-bench/src/index.ts`](../../packages/curated/curated-bench/src/index.ts)

<a id="ctxcuratedpolicy--curatedpolicy"></a>

### `ctx.curatedPolicy` — `CuratedPolicy`

Read-only curated policy service exposed as `ctx.curatedPolicy`.

```ts cordis-catalog
/**
 * List every audited candidate in catalog order.
 * @returns a frozen array of frozen candidate records.
 */
listCandidates(): readonly CuratedCandidate[]

/**
 * List every curated capability conflict rule in catalog order.
 * @returns a frozen array of frozen conflict rules.
 */
listCapabilityConflicts(): readonly CapabilityConflictRule[]

/**
 * List every curated permission rule in catalog order.
 * @returns a frozen array of frozen permission rules.
 */
listPermissionRules(): readonly PermissionRule[]

/**
 * List active candidates assigned to one profile.
 * @param profileId - Curated profile id.
 * @returns a stable frozen array in catalog order.
 */
getProfileCandidates(profileId: string): readonly CuratedCandidate[]
```

Source: [`packages/curated/curated-policy/src/index.ts`](../../packages/curated/curated-policy/src/index.ts)
<!-- END GENERATED cordis-surface -->

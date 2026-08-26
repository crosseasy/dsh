# Curated Plugins

English | [中文](curated.zh.md)

The curated plugin layer is a governance layer for audited third-party bundle candidates and the profiles that may compose them. Its package group lives under [`packages/curated`](../../packages/curated), while the planning matrix and rollout gates live under [`docs/plugin/superpowers`](../plugin/superpowers).

`ctx.curatedPolicy` exposes read-only catalog queries for plugins and commands that need candidate facts, conflict rules, or permission seeds. The service does not install packages, run third-party lifecycle scripts, register model-facing tools, write prompt text, or append session events; profile materialization and CLI reporting are owned by the sibling curated packages.

Policy loading computes admission from eight bounded dimensions, requires active candidates to have verified Node evidence and no core patch, treats the checked-in provider/fallback table as authoritative, and rejects secret-like metadata. Permission rules are policy data: the curated commands validate the resolved permission plugin's fail-closed configuration, while that plugin remains responsible for tool authorization.

The intended `web-curated` baseline contains 12 candidates; its current admissible active baseline contains ten. `dsh-context` lacks Node compatibility evidence, and `dsh-config-manager` lacks profile-level dry-run or execution-confirmation control. `web-research` materializes the ten-candidate baseline plus `plugin-session-export`. Benchmark inputs preserve comparable task/attempt and environment requirements plus digest-verified embedded rollback snapshots; the checked-in search, memory, browser, MCP, fault, and canary campaigns remain pending.

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
  /** Optional SHA-256 digest for the resolved package tarball. */
  readonly tarballSha256?: string
  /** Count of discovered test files. */
  readonly testFiles: number
  /** Count of discovered CI workflows. */
  readonly ciWorkflows: number
  /** Install lifecycle scripts recorded but not executed during audit. */
  readonly installScripts: Readonly<Record<string, string>>
  /** External runtime or build dependencies named by the candidate. */
  readonly externalDependencies: readonly string[]
  /** Network destinations or classes used by the candidate. */
  readonly networkAccess: readonly string[]
  /** Credential references required or optionally accepted by the candidate. */
  readonly credentials: readonly string[]
  /** Curated profiles this candidate may appear in. */
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
 */
listAssets(kind: CuratedBenchAssetKind): readonly string[]

/**
 * Read and freeze one JSON asset.
 * @param kind - Asset class containing the file.
 * @param path - Safe POSIX-style relative path ending in `.json`.
 * @returns the parsed plain JSON value.
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
 * @returns a stable frozen array with shared candidates before scenario-specific candidates.
 */
getProfileCandidates(profileId: string): readonly CuratedCandidate[]
```

Source: [`packages/curated/curated-policy/src/index.ts`](../../packages/curated/curated-policy/src/index.ts)
<!-- END GENERATED cordis-surface -->

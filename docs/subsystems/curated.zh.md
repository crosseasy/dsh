# 精选插件

[English](curated.md) | 中文

精选插件层是已审计第三方 bundle 候选及其 profile 组合的治理层。包组位于 [`packages/curated`](../../packages/curated)，规划矩阵与 rollout 门禁位于 [`docs/plugin/superpowers`](../plugin/superpowers)。

`ctx.curatedPolicy` 为需要候选事实、冲突规则或权限种子的插件和命令暴露只读 catalog 查询。该服务不安装 package、不运行第三方生命周期脚本、不注册面向模型的 tool、不写入提示词文本，也不追加 session event；profile 物化和 CLI 报告由相邻 curated 包负责。

策略加载会根据八个受限维度计算准入结果，要求 active 候选具有已验证 Node 证据且不修改 core，把签入的 provider/fallback 表作为权威策略，并拒绝疑似 secret metadata。权限规则属于策略数据：精选命令校验解析到的权限插件具有 fail-closed 配置，工具授权仍由该插件负责。

`web-curated` 的目标基线包含 12 个候选，当前可准入的 active 基线为 10 个。`dsh-context` 缺少 Node 兼容证据，`dsh-config-manager` 缺少 profile 级 dry-run 或执行确认控制。`web-research` 会物化这 10 个基线候选以及 `plugin-session-export`。Benchmark 输入固定可比的任务/attempt 集与环境要求，并携带经过摘要校验的内嵌回滚快照；签入的搜索、记忆、浏览器、MCP、故障和 canary 评测仍为 pending。

源码：[`packages/curated/curated-policy/src/index.ts`](../../packages/curated/curated-policy/src/index.ts)

## 公开类型

`CapabilityConflictRule` 记录 profile preflight 检查执行的互斥能力域。

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

`PermissionRule` 为固定安全控制顺序和默认 allow/ask/deny 策略提供种子数据。

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

`CuratedCandidate` 是 profile 查询返回的已 audit 插件记录。

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

`CuratedBenchAssetDirs` 命名 `ctx.curatedBench` 提供的三个 benchmark 资产根目录。

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

`CuratedBenchAssetKind` 是 benchmark 资产读取接受的目录选择器。

```ts type-equiv
/** Asset directory class accepted by the curated benchmark service. */
type CuratedBenchAssetKind = keyof CuratedBenchAssetDirs
```

`CuratedBenchJson` 是 `ctx.curatedBench.readAsset()` 返回的普通 JSON 值。

```ts type-equiv
/** Plain JSON value returned by curated benchmark asset reads. */
type CuratedBenchJson = null | boolean | number | string | readonly CuratedBenchJson[] | { readonly [key: string]: CuratedBenchJson }
```

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — the language sides differ only in locale-specific paired document paths. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.zh.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

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

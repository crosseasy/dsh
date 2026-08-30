# 精选插件

[English](curated.md) | 中文

精选插件层是已审计第三方 bundle 候选及其 profile 组合的治理层。包组位于 [`packages/curated`](../../packages/curated)，规划矩阵与 rollout 门禁位于 [`docs/plugin/superpowers`](../plugin/superpowers)。

`ctx.curatedPolicy` 为需要候选事实、冲突规则或权限种子的插件和命令暴露只读 catalog 查询。该服务不安装 package、不运行第三方生命周期脚本、不注册面向模型的 tool、不写入提示词文本，也不追加 session event；profile 物化和 CLI 报告由相邻 curated 包负责。

策略加载会根据八个受限维度计算准入结果，要求仓库 URL 是 canonical GitHub URL、可达 commit 具有规范化源码内容摘要，并要求 active 候选具有已验证 Node 证据、不修改 core，且完整 runtime 激活证据的 key 与其目标 profile 精确一致；它还把签入的 provider/fallback 表作为权威策略，并拒绝疑似 secret metadata。[精选 benchmark 证据目录](../../packages/curated/curated-bench/evidence/README.zh.md)持有激活记录与结果产物。文档门禁只接受该目录中由仓库持有、已跟踪且处于 stage zero 的普通 blob，遍历每个 profile 值，要求五份记录都命名对应 map key，按照 operation schema 解析每条记录，校验其候选与操作 identity 及成功 observed 结果，拒绝 record 或 artifact argv 中包括 URL userinfo 在内的 secret 且不回显参数，并对照仓库检查独立引用产物的路径与 SHA-256。包自身提供、ignored 和 untracked 的文件不能授权激活。权限规则属于策略数据：精选命令校验解析到的权限插件具有 fail-closed 配置，工具授权仍由该插件负责。

`web-curated` 的目标基线包含 12 个候选。六个候选已取得静态/安装资格证据，但都没有基于其固定产物的 keyless assembled runnable snapshot，因此 runtime active 数为 0；Web 搜索还缺少必需的 `@anweat/dsh-browser` bundle/runtime dependency。五个精选模板都只包含安装自有基础 bundle。激活要求真实固定产物、keyless assembled snapshot、全部必需依赖 bundle，以及安装、启用、重启、禁用或卸载证据。E3/E4、A/B、故障与 canary 证据均为 pending。

每个 curated profile 都禁用依赖生命周期脚本。普通 `dsh` 启动与配置 dump 要求模板和 catalog 组合精确一致、包管理器状态安全，并且用户静态覆盖不能引入 plugin 或 group 行。精选插件 help 与列表由签入模板只读生成。安装会跨进程序列化，在私有 staging home 中离线运行，校验生成文件、两份 pnpm lockfile、bundle 解析与准入，并且只在校验后通过目录 rename 激活；失败会保留或恢复旧 live profile。受管 observed 准入还会拒绝依赖变换，并要求 root 与 installed lock 闭包都匹配候选的 catalog 摘要。

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

`CuratedRuntimeEvidenceFile`、`CuratedRuntimeActivationEvidenceSet` 与 `CuratedRuntimeActivationEvidence` 把每个目标 profile 的激活条件绑定到签入文件。

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

`CuratedCandidateStatus` 是根据激活状态、产物证据和 blocker 推导出的当前交付状态。

```ts type-equiv
/** Current delivery state derived from activation, artifact evidence, and blockers. */
type CuratedCandidateStatus = 'active' | 'qualified' | 'pending' | 'rejected'
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

`BenchmarkSnapshotReference`、`BenchmarkBuildIdentity` 与 `BenchmarkMeasurementIdentity` 将已完成的比较绑定到不可变输入和一致的执行实现。

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
 * @returns a stable frozen array in catalog order.
 */
getProfileCandidates(profileId: string): readonly CuratedCandidate[]
```

Source: [`packages/curated/curated-policy/src/index.ts`](../../packages/curated/curated-policy/src/index.ts)
<!-- END GENERATED cordis-surface -->

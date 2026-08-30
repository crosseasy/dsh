# `@deepseek-ai/dsh-curated-bench`

[English](README.md) | 中文

`@deepseek-ai/dsh-curated-bench` 持有精选插件层的结构化 benchmark 输入。每项执行相关资产都显式标为 `observed`、`fixture` 或 `planned`；仓库中的默认记录是没有伪造运行数据的计划。

## 资产

- `manifests/`：只读候选 audit 摘要。
- `tasks/`：搜索、记忆、浏览器、MCP、成本和 profile smoke 检查的能力任务集定义。
- `baselines/`：官方 profile 快照、精选 profile 快照、动态 A/B 比较输入和不可恢复的规划历史。

## API

该包导出三个资产根目录的定位值、只读 `ctx.curatedBench` 资产服务，以及供测试和构建门禁执行静态资产检查的 `validateCuratedBenchAssets()`。由于固定 JSON 资产不存在可观测的事件流或可变数据关系，其 invariant companion 为空。消费者从这些目录读取显式 JSON 文件；该包本身不运行 benchmark。

计划中的 P2 故障资产只包含搜索超时、模型 429、浏览器崩溃、SQLite 锁、文件权限拒绝、非法 patch、网络断开和插件初始化异常这八个场景。每个场景都保持 `pending` 且没有 runtime outcome；allowed outcome 只包含该场景真实 runtime 的 `fail-closed` 和恢复结果，不能包含 smoke success。

计划中的 P2 profile 与 A/B 记录使用评测计划规定的封闭字段集和固定值。每个 A/B 条目都保持 `pending`，启用均值、P50、P95 和失败分布统计，并携带全部五项非补偿门槛。

已完成的比较只有在 baseline 与 candidate 记录使用完全相同的模型、提示词、workspace、网络、种子、DSH build 与 measurement 实现，携带相同的任务和 attempt 集，包含每个必需关键任务，并且每个 profile 对每项任务至少重复 5 次时才可准入。DSH build identity 记录包版本、完整源码 revision、源码树 SHA-256、dirty 状态、可执行产物 SHA-256 和 Node 版本。Measurement identity 记录 producer、tokenizer、prompt/schema 序列化、计时、定价与评分实现。阈值决策使用报告舍入前的原始值。Benchmark fixture 使用 schema 3；没有 run 的 planned fixture 可以省略 execution identity。每个内嵌、引用或发布的 lock 或 profile snapshot 使用 snapshot schema 2。发布快照的静态校验递归枚举 `baselines/locks` 与 `baselines/profiles` 树中的全部条目，拒绝符号链接以及既非普通文件也非目录的条目，并把树中的每个 JSON 文件作为 snapshot 校验。每棵树最多包含 1024 个条目，并且从根目录向下最多 64 层，第 65 层会被拒绝。每个被校验的 JSON 文件都必须使用所在树要求的 kind，并包含合法的 profile 与 payload 字段。每个 snapshot 引用只包含相对于 benchmark fixture 目录的安全 JSON 路径与 canonical JSON SHA-256。读取器把首次 unresolved path identity 与目录内的 canonical target 和已打开 descriptor 绑定，在可用平台使用 `O_NOFOLLOW`，并在有界普通文件读取前后校验 descriptor 与路径 identity；在初始检查后替换文件、ancestor 或 final path symlink 会 fail closed。任何过期引用摘要都会被拒绝。Baseline 引用文件必须与通过 SHA-256 校验的内嵌 lock 和 profile snapshot 在 canonical JSON 上完全相等；每个引用 profile 还必须按顺序精确等于对应 shipped 或 curated 权威模板。

`baselines/history` 下的文件是递归校验的规划记录，明确使用 `kind: curated-planning-history`、`evidenceKind: planned`、`restorable: false`，并以 `YYYY-MM-DD` 格式记录 canonical UTC `createdAt` 日期。非法月份与日期会产生 validator issue，而不会抛出日期异常。这些记录保留过去的数量、catalog 引用、profile bundle、原记录 kind、原 operator 指令，以及从原 lock/profile 路径迁移到 history 的关系。每个 migration source 都必须是不含绝对路径语法、反斜杠或 `..` segment 的安全相对 JSON 路径；lock source 必须位于 `locks/` 下，profile source 必须位于 `profiles/` 下。它们使用 history schema 1，不是回滚 snapshot；`compare-benchmark` 只接受显式引用的 schema 2 lock 与 profile snapshot。

每个 lock candidate 都记录共享的 package、patch、规范化源码内容、安装目录与 runtime closure identity，并且只带一个 `installSource`。其 `bundlePatch` 必须是以 `./` 开头且位于 package 内的 POSIX 相对路径。npm source 要求确切 SemVer 2.0 `npmVersion` 与 SHA-512 `npmIntegrity`；合法 prerelease 与 build metadata 可以使用，但不会对 prefix、range 或 tag 进行 coercion。Git source 要求 canonical `https://github.com/<owner>/<repo>` repository、完整 commit、显式 `repositoryPath` 和空 `installScripts` 记录。源码内容摘要标识排序后的解压文件，而不是 GitHub 可变的归档编码。缺失、混合、浮动或占位 source 数据均不合法。不含第三方 candidate 的 profile 使用空 `candidates` 数组。比较只返回决策、原因和不可变 snapshot 内容；恢复由外部 rollout operator 执行，不声称自动或原子恢复。

## 模型体验

### Benchmark 资产

#### 模型看到的内容

该包不注册提示词文本、工具 schema、用户消息、助手可见结果或会话事件。只有其他工具或命令把 benchmark 记录放进提示词时，这些记录才会变成模型可见内容。

#### Token 影响

`@deepseek-ai/dsh-curated-bench` 本身没有直接 token 成本。

#### KV Cache 影响

没有直接 cache 影响；引用 benchmark 数据的调用方拥有该请求内容。

## 已知限制与暂缓事项

- **记录具有明确分类**：fixture 和 planned 记录不是准入证据，也不计作 canary 或故障执行。`evidenceKind: observed`、执行 metadata 与运行字段均是输入提供者的断言。该标签与 `accepted` 决策都不会以密码学方式认证 producer 或 evidence；其来源是否可信仍由 operator 判断。
- **运行证据仍在外部**：签入的精选 lock 不含 active 第三方候选。激活要求真实固定产物、keyless assembled snapshot、全部必需依赖 bundle，以及安装、启用、重启、禁用或卸载证据。E3/E4、搜索、记忆、浏览器、MCP、A/B、故障与 canary 均为 pending。

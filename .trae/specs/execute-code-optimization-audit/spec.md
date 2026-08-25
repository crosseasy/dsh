# 执行代码优化审计 Spec

## Why

`docs/arch/review_report/` 记录了 12 项经过源码、测试、生产引用或 Agent Note 交叉验证的优化机会，其中两项阻塞公开发布，其余涉及资源回收、生命周期一致性和无消费公共接口。当前实现必须把仍然成立的建议落实为可验证改动，同时以当前 `HEAD` 为准拒绝已过时或会扩大范围的旧方案。

## What Changes

- Settings RPC 使用唯一的 fail-closed wire 描述路径，不能证明安全的 schema 在持久化或返回 RPC 前失败，且 wire 中不包含 secret、secret default、变换函数或可能回显输入的错误文本。
- 本地 `hygiene` 入口与 CI 复用同一 gate graph，并显式构建其 artifact consumers；workspace hierarchy 检查继续对意外目录 fail loud。
- 过期 preset generation 在最后一个 agent 或 cold-reader lease 释放后一次性、可等待地 dispose。
- Settings registration disposer 停止新 watcher、跳过未开始 watcher、等待已开始 watcher，并在旧写入与替换注册竞争后重新同步当前注册。
- Agent Instructions 使用三态 root marker、固定已确认项目根，并对所有来源读取实施可配置的 UTF-8 聚合预算；动态失败保留 last-good state。
- ACP subagent 复用既有 out-of-process cwd、capability、settlement 和 run-handle helpers，同时保留 ACP 专属 EOF/kill teardown。
- 移除没有固定生产消费方的 `FileSystem.lstat`、`FsPathInfo` 和 provider 辅助实现。
- 分包收窄 session-reference、compaction、tools testing 和 llm-retry 的冗余或测试专用公共接口。
- 提取私有 Bash/Pwsh 生命周期核心，并合并 terminal-bash 单次 send 生命周期；只有能净删除代码且不隐藏 dialect 差异时才提取 one-shot tool 公共逻辑。
- Workflow 只由返回的 `WorkflowRun.cancel()` 拥有运行期取消。
- JSON-RPC transport 按 server/client 实际方向拆分或收窄；TypeScript client 保留 Codex 初始化所需的 outbound notification，不恢复旧提案中过时的 `session.finished` 或同步 prompt-settlement 设计。
- Client fixture 复用 plan、session stats、token usage、context pressure 和 request composition 的领域纯 fold，不引入跨领域万能 projection 包或完整 Host registry。
- 每项非机械改动同步其英文/中文/sidecar Agent Note、README、JSDoc、生成目录和必要的 keyless snapshots。

## Impact

- Affected specs: Settings wire security, local quality gates, preset lifecycle, settings lifecycle, Agent Instructions discovery and budgets, subagent process lifecycle, filesystem service, public API exposure, shell lifecycle, workflow cancellation, JSON-RPC directionality, client fixture projections.
- Affected code: `packages/settings/`, `packages/host/apiproxy/`, `packages/llm/llm-pi-ai/`, `scripts/run-gates.ts`, `packages/preset/agent-presets/`, `packages/context/agent-instructions/`, `packages/subagent/`, `packages/fs/`, `packages/e2b/fs-e2b/`, `packages/context/session-reference/`, `packages/compaction/`, `packages/core/tools/`, `packages/llm/llm-retry/`, `packages/shell/`, `packages/terminal/terminal-bash/`, `packages/workflow/`, `packages/sdk/`, `python/sdk/`, `packages/client/connection/`, projection domain packages, related examples, docs, Agent Notes and generated catalogs.

## Existing Invariants

- 不修改报告明确保护的双 LLM adapter、双 persistence backend、workflow progress/events/meta、compaction Service Definition/provider 分包，以及 Claude Code/Codex bridge 的 dialect 差异。
- 不仅因文件较长而拆分文件，不用新 forwarding abstraction 替代现有重复，也不新增 speculative compatibility shim。
- 现有 session 在 preset save 后继续使用原 generation；只有最后一个 holder 退出后才能回收。
- ACP 的错误文本、输出 fold、readiness 前取消、prompt settlement 后可见行为、EOF-first teardown 与 timer bounds 保持不变。
- Bash/Pwsh 的 markers、wrappers、prompt echo、argv、paths、environment 与 presentation dialect 继续由各自 adapter 拥有。
- JSON-RPC 的请求关联、错误语义、通知顺序、malformed frame 处理、并发和进程退出行为保持不变；`session/prompt` 当前“立即返回 message id”的协议不变。
- Fixture 只复用无 Cordis/Node 运行时依赖的领域 fold；场景、wire event 和 fixture-only product defaults 仍由 fixture 拥有。
- 不执行 `commit`、`push`、`merge`、`rebase` 或 `reset`，不回滚或覆盖现有用户改动。

## ADDED Requirements

### Requirement: Settings wire 描述必须 fail closed

系统 SHALL 通过单一 `describeForWire()` 路径生成 Settings RPC 的 value、base、user、schema 和 secrets；schema 无法证明可安全遍历或包含不可安全序列化的 secret/transform metadata 时，整个 namespace SHALL 在持久化和 RPC 返回前失败。

#### Scenario: 不支持的组合包含 secret

- **WHEN** 动态插件注册 union、intersection 或 transform 包裹的 secret schema
- **THEN** Settings RPC 在返回 namespace 前拒绝，响应、日志和错误文本均不包含 secret、secret default、transform callback source 或原始被拒输入

#### Scenario: 现有直接对象 secret

- **WHEN** schema 使用受支持的 object/dict/array 组合和 `role('secret')`
- **THEN** wire value 继续只公开 `{ path, set }`，非 secret 字段和安全 schema metadata 保持可用

### Requirement: Agent Instructions 聚合读取预算

系统 SHALL 提供经过配置校验的 `maxTotalSourceBytes`，按更具体目录优先、同目录去重的顺序，对 baseline 与 reconciliation 使用同一预算实现并按实际收到的 UTF-8 bytes 计数。

#### Scenario: 预算耗尽

- **WHEN** 候选 instruction sources 的聚合读取超过预算
- **THEN** 后续低优先级来源不再读取，状态标记为 unavailable 而非 removed，动态 reconciliation 保留 last-good instruction set

### Requirement: 生命周期 holder 必须可等待释放

Preset generation 和 Settings registration SHALL 明确记录 holder、retired/active 和 one-shot disposal 状态，并在 disposer 返回前等待其拥有的已开始异步工作结束。

#### Scenario: retire 与活动 holder 竞争

- **WHEN** generation 被替换但仍有 parent/child agent 或 cold reader 持有 lease
- **THEN** generation 保持可用，最后一个 holder 释放后 scope 恰好 dispose 一次

#### Scenario: registration unload 与 watcher 竞争

- **WHEN** registration unload 时一个 watcher 正在运行且另一个已排队
- **THEN** disposer 等待运行中的 watcher，排队 watcher 不启动，返回后没有该 registration 拥有的工作

### Requirement: 领域 projection fold 可由 fixture 复用

Plan、session stats、token usage、context pressure 和 request composition 的领域包 SHALL 暴露 client-safe 的纯 event-to-state fold，production `ProjectionDefinition` 和 fixture SHALL 调用同一实现。

#### Scenario: 同一 event vector

- **WHEN** production definition 和 fixture driver 接收相同 session events
- **THEN** 每个 projection key 的 wire view 完全相等，fixture 不再持有对应平行常量或 fold

## MODIFIED Requirements

### Requirement: 本地 hygiene 可复现

`pnpm run hygiene` SHALL 通过 gate graph 显式依赖 build 后再执行 publint、built package invariants 和 NodeNext consumer check；它 SHALL 不依赖工作区残留 artifact，也 SHALL 不静默忽略真实的意外 package directory。

#### Scenario: clean 与 built 状态

- **WHEN** 分别在 clean artifact state 和已完成 build 的 state 运行 `pnpm run hygiene`
- **THEN** 两次得出相同结论，artifact prerequisite 由同一个 gate graph 表达

### Requirement: Project root probe 区分不可用

Agent Instructions root marker probe SHALL 返回 present、absent 或 unavailable；仅 confirmed absent 允许继续向父目录搜索，initial load 遇到 unavailable SHALL 明确失败，dynamic reconciliation SHALL 固定已确认根并保留 last-good state。

#### Scenario: 当前目录 marker 无法读取且祖先另有 `.git`

- **WHEN** provider 对真实 root marker 返回 permission、cancellation 或其他 unavailable 错误
- **THEN** loader 不跨越真实 root 选择祖先项目，initial load 失败或 reconciliation 保留既有 authority

### Requirement: ACP 复用 out-of-process lifecycle

ACP provider SHALL 使用 `NO_START_CAPABILITIES`、cwd validation/resolution、`settleRunResult` 和 `subprocessRunHandle`，同时保持 ACP 专属 teardown ladder。

#### Scenario: cancellation 与 teardown race

- **WHEN** readiness 前取消、spawn failure、failure/cancel race、重复 dispose 或 EOF grace 发生
- **THEN** 结果和错误保持现有语义，cleanup memoized 且生产代码净删除

### Requirement: Shell 生命周期只保留真实 dialect 差异

Terminal send、persistent registries、one-shot executor 和 sandbox settlement SHALL 各有单一私有生命周期 owner；共享仅限相同行为，Bash/Pwsh dialect 语义继续分离。

#### Scenario: lifecycle regression matrix

- **WHEN** 执行 foreground/background、timeout、abort、reset、scrollback、sandbox ACL、process kill 和 teardown 场景
- **THEN** Bash/Pwsh 现有输出与 snapshot byte-identical，生产代码净减少且 `jscpd` ignore 数量下降

### Requirement: Workflow 单一取消 owner

`WorkflowStartRequest` SHALL 不再携带 `signal`；consumer 处理 pre-aborted signal，并在 `start()` 后由 `WorkflowRun.cancel()` 独占运行期取消及 reason arbitration。

#### Scenario: abort 时序

- **WHEN** signal 在 start 前、同步 start 期间、运行中、settlement 后或 reentrant cancel 时 abort
- **THEN** cancel 最多生效一次，worker/children 正确收敛，dispose 返回时 quiescent

### Requirement: JSON-RPC transport 按方向建模

TypeScript server transport SHALL 只接收入站 request 并发送 response/notification；TypeScript client SHALL 发送 request、接收 response/notification，并保留 `subagent-codex` 初始化所需的 outbound notification，但不处理入站 request 或发送 response；Python client SHALL 删除发送 notification、接收 server request 和发送 response 的公开 API。

#### Scenario: 方向外 frame

- **WHEN** client 收到意外 server request 或 server 收到方向外 response
- **THEN** frame 不进入错误的 waiter/handler，且不会恢复通用双向 peer API

### Requirement: 公共接口只包含生产能力

Session reference ranking/preparation SHALL 变为私有；`CompactionResult` SHALL 只保留真实消费者字段；tools 与 llm-retry 的测试入口 SHALL 位于显式 `/testing` subpath。

#### Scenario: 产品入口与测试入口

- **WHEN** 生产 consumer 导入 package root
- **THEN** 测试 helper 和 test-only internals 不可见，repository tests 通过 `/testing` subpath 获得确定性入口

## REMOVED Requirements

### Requirement: 移除未消费的 no-follow filesystem seam

系统 SHALL 删除 `FileSystem.lstat`、`FsPathInfo`、local/E2B provider implementations 及只为该方法存在的 no-follow helpers/tests。

**Reason**: 没有固定生产消费方，却扩大每个 provider 的实现、文档和动态 API catalog。

**Migration**: 预发布阶段不提供兼容层；保留 Node/platform 自身被其他真实安全路径使用的 `lstat`。

### Requirement: 移除冗余结果字段

系统 SHALL 从 `CompactionResult` 删除 `compactionId`、`sourceCommandId`、`startSeq`、`endSeq` 和 `summary`，保留 `summarySeq`、`shadowedRange`、`shadowedSeqs` 和 `shadowedTokenCount`。

**Reason**: 删除字段没有固定生产读取，且重复 durable events；保留字段都有当前生产 consumer。

**Migration**: 同步 producer、类型文档、Agent Note 和生成 reference；不保留预发布兼容字段。

# 当前代码仓库优化审查

[English](code-optimization-audit.md) | 中文

本报告记录当前仓库中已经通过生产调用、实现代码、测试表面或现有 Agent Notes 交叉验证的优化点。审查基线为分支 `feat_825`、提交 `b150a551b8d4`；范围覆盖 `packages/`、`apps/`、`examples/`、`python/` 与 `scripts/`，不审查 vendored Cordis 实现和已归档 Agent Notes。本文是实施清单，不替代 `docs/architecture.md` 与 Agent Notes 的架构权威；非机械项实施前仍应补写或修订对应 Agent Note。

## 结论

当前最需要优先处理的不是大规模目录重组，而是两个发布前阻断项：Settings 协议面的机密脱敏会在无法识别的 schema 组合上 fail-open，独立运行的本地质量门禁也无法从干净产物状态得到可复现结果。随后应处理会持续积累资源或放大生命周期竞态的 generation、watcher、指令加载和子进程管理问题；最后再收窄无消费者 API、镜像实现与测试专用公开面。

| 优先级 | 含义 | 数量 |
| --- | --- | ---: |
| P0 | 公开发布或可信验证前应完成 | 2 |
| P1 | 有明确资源、安全、生命周期或维护收益，宜作为近期独立变更 | 5 |
| P2 | 已有可靠简化证据，但可在 P0/P1 后按领域拆分实施 | 5 |

| 编号 | 优先级 | 优化点 | 主要收益 |
| --- | --- | --- | --- |
| 1 | P0 | Settings wire 脱敏改为 fail-closed | 阻止第三方 schema 泄露 secret 与默认值 |
| 2 | P0 | 恢复可复现的质量门禁基线 | 让后续变更拥有可信验收入口 |
| 3 | P1 | 回收被替代的 preset generation | 消除每次保存累积的插件与文件 watcher |
| 4 | P1 | 让 Settings registration disposal 真正静默 | 消除卸载后的回调与 replacement stale cache |
| 5 | P1 | 为 Agent Instructions 增加根探测三态和总读取预算 | 防止错误祖先指令与无界 I/O |
| 6 | P1 | ACP subagent 复用 out-of-process 生命周期核心 | 删除重复取消、结算与 cwd 逻辑 |
| 7 | P1 | 删除无生产消费者的 `FileSystem.lstat` seam | 收窄 FS provider 义务与平台代码 |
| 8 | P2 | 收窄重复或测试专用的公开面 | 减少类型、文档和动态调用矩阵 |
| 9 | P2 | 抽取 Bash/Pwsh 私有生命周期核心 | 让成套镜像修复只落一处 |
| 10 | P2 | Workflow 只保留一个取消所有者 | 删除双通道 abort 竞争 |
| 11 | P2 | JSON-RPC transport 按方向收窄 | 删除 Python/TS 两端未使用的对等端角色 |
| 12 | P2 | Fixture 复用产品投影 fold | 防止演示数据与真实投影语义漂移 |

## P0：发布前阻断项

### 1. Settings wire 脱敏必须 fail-closed

**证据。** [`redact.ts`](../../../packages/settings/settings/src/redact.ts) 的 `walk()` 只遍历 `object`、`dict` 与 `array`；默认分支会原样返回值，因此 union、intersection 或 transform 后的 `role('secret')` 会携带空的 `secrets` 列表穿过协议面。[Settings provider](../../../packages/settings/settings/src/index.ts) 的 `describe({ redactSecrets: true })` 只脱敏 `value/base/user`，仍发送 `schema.toJSON()`，其中可以包含 secret 的 `.default(...)`。[`api-proxy.ts`](../../../packages/host/apiproxy/src/api-proxy.ts) 的 settings RPC 是实际生产消费者。该缺口也已写入 [Settings README](../../../packages/settings/settings/README.zh.md) 和 [plugin-owned settings surface Note](../../../.agents/notes/implemented/architecture/2026-08-12-plugin-owned-settings-surface.zh.md)。

**影响。** 当前第一方 secret schema 主要是直接对象字段，因此没有证明现有配置已经泄露；但 settings surface 会服务动态插件注册的任意 namespace，无法证明可遍历的 schema 仍被允许上 wire，风险面已经超出本仓库可静态审计的 schema。

**建议。**

- 新增唯一的 `describeForWire()`，先证明 schema 可安全遍历，再生成脱敏后的 value、layers 与 schema envelope；无法证明时拒绝暴露整个 namespace。
- 清除 secret 默认值、可能回显输入的 schema 错误文本及其他不必要元数据；Host RPC 不再直接调用带布尔开关的通用 `describe()`。
- 增加 union、intersection、transform、default、嵌套 dict/array 和恶意错误文本测试，并补一个 overlay 插件到浏览器 settings card 的组装态测试。

**验收。** 无法证明安全的 schema 在 RPC 前失败；wire fixture 中不出现 secret、secret 默认值或原始拒绝输入；现有直接对象 secret 仍以 `{ path, set }` 形式工作。

### 2. 恢复可复现的质量门禁基线

**证据。** [`run-gates.ts`](../../../scripts/run-gates.ts) 在 `check-all` 模式为产物消费方声明 `build` 依赖，但直接 `hygiene` 模式调用 `hygieneLeafGates()` 时不声明该依赖，干净 checkout 上的 `publint`、built package invariants 与 NodeNext consumer check 会先消费不存在的 `lib/`。[`check-workspace-constraints.ts`](../../../scripts/check-workspace-constraints.ts) 还会把 `packages/<group>/<pkg>` 深度上的每个目录解释为 package，而 [`clean.ts`](../../../scripts/clean.ts) 另有一套逻辑用于删除只包含安全构建残留的无 manifest 目录。

**当前复现。** `pnpm run constraints` 在 `packages/bundle/fusion`、`packages/client/schema-form` 和 `packages/client/web-react` 三个无 manifest 的残留目录上失败。构建后 `publint` 与 built package invariants 可以通过，证明直接运行 `hygiene` 时的问题在于产物前置条件，而不是生成内容。CI 的 `check-all` 路径已经声明构建依赖，因此这是文档化本地入口与集成门禁图之间的不一致，不是 CI 发布门禁图本身失效。

**建议。**

- 让 `pnpm run hygiene` 自包含地先构建产物消费方，或拆成命名明确的 source-only 与 artifact-ready 两种命令；不要让同名命令随本地是否存在 `lib/` 而改变结果。
- 明确 hierarchy check 的 residue 前置条件：由 orchestrator 先运行安全 clean，或让 checker 只忽略 `clean.ts` 已定义的无 manifest 构建残留。
- 为每个文档化的独立门禁命令增加干净 checkout 冒烟测试，防止后续门禁图变更静默依赖先前命令留下的产物或 residue。

**验收。** 在干净 checkout 与一次 build 后分别运行 `pnpm run hygiene` 都得到同一结论；已识别的安全 residue 有明确的清理或忽略所有者，真实的意外 package 目录仍会响亮失败；CI 和本地入口复用同一 gate graph。

## P1：近期应处理

### 3. 回收被替代的 preset generation

**证据。** [agent-presets `ensureStanding()`](../../../packages/preset/agent-presets/src/index.ts) 在 composition stamp 改变时删除当前指针并挂载新 generation，但没有释放旧 scope；[`README.md`](../../../packages/preset/agent-presets/README.zh.md) 明确记录“superseded generation is never reclaimed”。旧 generation 必须服务仍在运行的 agent，但 roster 没有 joined-agent 计数，无法判断何时安全释放。settings-page authoring 流把 composition 变更变成逐次保存事件，而 `dsh-skill-filesystem` 默认为每个 generation 安装 watcher。

**影响。** 每次编辑后新建 session 都可能永久增加一整套插件、effect 和文件 watcher，直到进程退出；长期运行的 Web Host 会随配置保存次数增长资源占用。

**建议。** 将 standing mount 建模为带 `joinedAgents`、`retired` 和单次 `dispose` 的 generation owner。新 generation 发布后将旧 generation 标记 retired；agent bind/unbind 与冷读 holder 都计数，最后一个 holder 离开时 `await scope.dispose()`。必须覆盖并发 `ensureStanding`、挂载失败回滚、父子 agent 绑定同 generation 和 roster teardown。

**验收。** 活跃旧 session 在保存后不变；最后一个旧 session 退出后旧 generation 的 skill watcher 与全部 effect 被释放；反复保存和创建/关闭 session 的资源数量保持有界。

### 4. Settings registration disposal 必须等待自身 watcher 并重同步 replacement

**证据。** [Settings provider `register()`](../../../packages/settings/settings/src/index.ts) 的 fiber disposer 只删除 registration；它没有将 registration 的 watcher 置为 inactive，也没有等待各 watcher tail。服务整体 teardown 会等待 `writeQueues` 与 `pendingTails`，但单个插件热卸载不会。与此同时，旧 registration 的 in-flight persist 可以在新 registration 接管同一 namespace 后更新 document，当前代码只避免向旧 owner 发通知，没有从新 document 重解析 replacement registration。

**影响。** 异步 `onChange` 可以越过插件卸载继续运行；热替换期间，storage/document 已经是新值而 replacement registration 仍持有旧 resolved cache，直到下一次外部 publish 或写入。

**建议。** 为每个 registration 建立独立 lifecycle owner：disposer 先禁止新 watcher invocation，再等待已启动 tail；queued-but-not-started invocation 跳过。旧写入落盘后，如果 namespace 已由 replacement 接管，应使用提交后的 raw section 重解析、推进 revision 并按新 owner 规则通知。

**验收。** 增加“slow watcher 运行中卸载”“排队 watcher 卸载”“persist 期间替换 registration”“旧写入失败/成功与新写入竞争”测试，并证明 disposer 返回时该 registration 已静默。

### 5. Agent Instructions 需要根标记三态与总读取预算

**根标记证据。** [`existsAsMarker()`](../../../packages/context/agent-instructions/src/files.ts) 将 `resolve/stat` 的任意异常压成“不存在”，随后 `findProjectRoot()` 会继续向上，可能跨过实际项目根并命中祖先项目的 `.git`。同文件对普通 instruction candidate 已使用 `present/absent/unavailable` 三态，根标记却丢失了这个区别。

**读取预算证据。** `readBounded()` 只有单文件 `maxSourceBytes`；`loadBaselineInstructionSet()` 会先读取全部候选，再用 `maxBytes` 限制最终渲染。默认输出预算是 64 KiB、单文件读取上限是 1 MiB，但目录深度与候选总量没有共同上限，远程 FS provider 会把该差异放大为网络与延迟成本。

**建议。**

- 根标记探测返回 `present/absent/unavailable`；只有确定缺失才继续向上。初始加载遇到 unavailable 应明确失败，动态 reconciliation 应保留 last-good，而不是跨目录选择新的权威来源。
- 增加部署可配置的 `maxTotalSourceBytes`，与模型输出 `maxBytes` 分开；读取规划先保证更具体目录，预算耗尽是独立状态，不能被解释为文件删除。
- baseline 与动态 reconciliation 复用同一个预算实现，并记录准确 UTF-8 读取字节数。

**验收。** 覆盖 provider 权限错误、取消、祖先另有 `.git`、深目录、同目录去重、预算耗尽和 last-good 保留；模型可见行为变化需更新 keyless snapshot。

### 6. ACP subagent 复用现有 out-of-process 生命周期核心

**证据。** [共享 out-of-process helper](../../../packages/subagent/subagent/src/out-of-process.ts) 已提供 `NO_START_CAPABILITIES`、cwd 解析/校验、`settleRunResult` 与 `subprocessRunHandle`，并被 DSH SDK、Claude Code 与 Codex providers 使用。[`subagent-acp/src/index.ts`](../../../packages/subagent/subagent-acp/src/index.ts) 仍保留独立 cwd 逻辑，[`subagent-acp/src/run.ts`](../../../packages/subagent/subagent-acp/src/run.ts) 仍独立维护取消竞争、结果结算、abort listener 与幂等 dispose。已有 [TypeScript SDK/subagent Note](../../../.agents/notes/implemented/feature/2026-07-27-typescript-sdk-and-sdk-subagent-backend.zh.md) 已声明这组 helper 应共享。

**建议。** ACP 改用现有 helper，保留 ACP 独有的 EOF/kill teardown ladder 与 timer 配置上限。重构的硬约束是错误文本、输出 fold、ready 前取消和 prompt 结算后的可见行为不变，不应为了“统一”而把 ACP 独有诊断塞进共享核心。

**验收。** 覆盖 ready 前取消、失败与 cancel 竞争、spawn 失败、重复 dispose、EOF grace 和 memoized teardown，并运行 ACP/subagent keyless snapshots。目标应是净删代码，而不是新增一层只转发参数的抽象。

### 7. 删除无生产消费者的 `FileSystem.lstat`

**证据。** [FS service](../../../packages/fs/fs/src/index.ts) 公开 `lstat` 与 [`FsPathInfo`](../../../packages/fs/fs/src/types.ts)，local 与 E2B providers 都实现它；在 `packages/`、`apps/`、`examples/`、`scripts/` 的生产源码中搜索 `.lstat(`，只命中声明与 provider 实现，其余调用都在测试。local provider 还为此保留 `PathLinkInfo`、`pathLinkType` 与 `probeNoFollow`。instruction discovery 已根据 [follow-instruction-symlinks Note](../../../.agents/notes/implemented/feature/2026-07-21-follow-instruction-symlinks.zh.md) 改用普通读取并将信任交给 sandbox/policy。

**建议。** 在 pre-release 阶段删除 `lstat`、`FsPathInfo` 和两个 provider 实现，再根据引用结果删除只服务该能力的 no-follow helper 与测试。未来出现真实 no-follow 消费者时，应按它的安全需求重新设计，而不是长期保留推测性 seam。

**验收。** FS、fs-local、fs-e2b 聚焦测试通过，`rg 'lstat|FsPathInfo|probeNoFollow'` 只保留外部平台 API 或明确说明，API catalog、README、typecheck、build 与 doc-sync 同步。

## P2：可拆分实施的简化

### 8. 收窄重复或测试专用的公开面

| 表面 | 当前证据 | 建议保留的最小表面 |
| --- | --- | --- |
| [`SessionReferenceResolver.listCandidates/prepare`](../../../packages/context/session-reference/src/index.ts) | 两个方法只由同类内部编排调用，却作为 Service 方法进入 API catalog；浏览器只需要 unary Remote `candidates` | 保留 Remote candidates、canonical URI 和 pre-step 行为；排序与 snapshot preparation 私有化 |
| [`CompactionResult`](../../../packages/compaction/compaction/src/types.ts) | `compactionId/sourceCommandId/startSeq/endSeq/summary` 无固定生产读取，且同一事实已在 durable events 中；`summarySeq` 与 shadowed fields 有真实消费者 | 保留 `summarySeq`、`shadowedRange`、`shadowedSeqs`、`shadowedTokenCount` |
| [tools testing export](../../../packages/core/tools/src/testing.ts)、[llm-retry internals](../../../packages/llm/llm-retry/src/index.ts) 与若干 implementation helpers | 注释已标记 test-only/internal，包外固定消费者位于 tests，却从产品根或正式 `apply` 参数暴露 | 移到明确的 `/testing` 子路径或 test-support；产品根只保留插件、服务和正式类型 |

这些改动应按 package 独立提交，先用 production-reference inventory 固定删除证据。不要把 [旧的 dead-core-spine 提案](../../../.agents/notes/proposed/simplification/2026-07-04-prune-dead-core-spine-api.zh.md) 整体照搬：其中部分字段已经删除，`CompactionResult.summarySeq` 也已获得真实消费者，提案需要先按当前代码重写。

### 9. 抽取 Bash/Pwsh 私有生命周期核心

**证据。** `bash-local/pwsh-local`、`tool-bash/tool-pwsh`、两个 persistent tools 与两个 sandbox providers 都存在成套镜像实现，部分文件用 `jscpd:ignore` 显式排除重复检查。one-shot 与 persistent twins 都由真实 bundle/preset 按平台装载，不是死代码。[pwsh parity Note](../../../.agents/notes/implemented/feature/2026-08-02-pwsh-tool-bash-parity.zh.md) 曾把共享核心推迟到 persistent twin 出现；[persistent PTY Note](../../../.agents/notes/implemented/architecture/2026-08-11-pwsh-persistent-pty.zh.md) 表明该条件现在已经成立。

**建议。** 先抽 persistent session registry、scrollback/status、timeout/abort/reset 与 teardown 的私有纯核心，Bash/Pwsh adapter 继续拥有 marker、wrapper、prompt echo、argv、路径和环境语义；只有确认能净删代码后，再抽 one-shot deadline、background mapping 与 presentation 的共同部分。不要公开一个掩盖 dialect 差异的通用 shell tool。

**相关局部。** [terminal-bash `LocalPtySession`](../../../packages/terminal/terminal-bash/src/session.ts) 同时维护 `active`、两组 timer、abort disposer、interrupting、activeWrite、pollingReady 与 polling，源码已有 consolidation TODO。可先把一次 send 的状态折叠为单一 lifecycle owner，再决定是否成为 dialect core 的组成部分。

**验收。** 以净删除行数与减少 `jscpd` 豁免为成功门槛；Bash/Pwsh loader、persistent terminal、sandbox/ACL、取消与 timeout 测试以及相关 snapshots 必须保持通过。

### 10. Workflow 只保留一个取消所有者

**证据。** [`WorkflowStartRequest`](../../../packages/workflow/workflow/src/runtime-types.ts) 同时携带 `signal`，返回的 `WorkflowRun` 又拥有 `cancel()`；两个生产调用方 tool-workflow 与 tool-ralph 都把同一个 `exec.signal` 传给 `start()`，随后再为它注册 `run.cancel()` listener。worker host 因此维护 `inputSignal/inputSignalAbort`，同一次 abort 经过两条路径。

**建议。** 如果 `start()` 保持同步发布 holder，则删除 request signal 和 host listener，只保留 holder-owned `run.cancel()`；两个 tool 统一在调用前处理 pre-aborted signal，再把运行中 abort 交给 holder。该建议只收窄取消通道，不删除 workflow progress/events/meta；后者已由 [rejected workflow simplification Note](../../../.agents/notes/rejected/simplification/2026-07-12-collapse-workflow-to-foreground-core.zh.md) 明确保留。

**验收。** 覆盖 pre-aborted、运行中 abort、settled 后 abort、reentrant cancel 与 dispose quiescence；worker built-artifact tests 和 workflow/Ralph snapshots 通过。

### 11. JSON-RPC transport 按实际方向收窄

**证据。** [TS `JsonRpcLineTransport`](../../../packages/sdk/protocol/src/transport.ts) 同时实现入站 request/出站 response 与出站 request/入站 response；实际 server 只需要入站 request 加 notification，client 只需要出站 request 加 notification consumption。[`python/sdk/client.py`](../../../python/sdk/src/deepseek_harness/client.py) 仍公开 `notify`、`next_request`、`respond`、`respond_error` 并维护 server-request queue，但当前 server 不向 client 发 request。

**建议。** 保留一个共享 frame parser/writer，将 server/client 角色拆成方向明确的窄接口；删除 Python client 的 dormant server-role API、`IncomingRequest` 和 queue。先修订 [directional JSON-RPC 提案](../../../.agents/notes/proposed/simplification/2026-07-19-make-jsonrpc-directional.zh.md)：其中旧的 prompt settlement 设计已经被当前“立即返回 message id”协议取代，不能把过时完成语义带回实现。

**验收。** TypeScript 与 Python SDK expected outputs 同步；覆盖 malformed frame、unknown method、notification、request id 关联、进程退出和并发 request，不新增双向 peer 的推测性能力。

### 12. Fixture 复用产品投影 fold

**证据。** [client connection fixture](../../../packages/client/connection/src/client/fixture.ts) 手工平行实现 `foldPlan/planViewOf`、`sessionStatsOf`、token usage、context pressure 与 request composition，并在注释中明确称其为产品 projection 的 fixture parallel。对应真实实现分别位于 [plan-mode](../../../packages/plan/plan-mode/src/index.ts)、[session-stats projection](../../../packages/session/session-stats/src/projection.ts) 与 [token-meter projections](../../../packages/llm/token-meter/src/usage-projection.ts)。真实 fold 修正时，fixture 不会被类型系统强制同步。

**建议。** 将每个投影的 event-to-state fold 提取为领域包拥有、无 Cordis/Node 依赖的纯模块，production `ProjectionDefinition` 与 fixture driver 共同调用；fixture 只负责构造场景和发 wire events。不要把整份 Host registry 打进浏览器 bundle，也不要建立一个跨领域的“万能 fixture projection”包。

**验收。** 用同一组 event vectors 分别驱动 production definition 与 fixture，逐 key 比较 wire view；删除 fixture 中平行常量和 fold 后，client demo/screenshot tests 与 projection package tests 通过。

## 推荐实施顺序

1. 先修复编号 1 和 2，建立安全且可复现的发布基线。
2. 将编号 3、4、5 分成三个生命周期/防御性 PR；每个 PR 单独补 Agent Note、聚焦测试和必要 snapshot。
3. 编号 6 和 7 是净删代码或复用现有核心的高确定性简化，可在基线恢复后并行实施。
4. 编号 8 按 package 拆分小 PR；不要用一个“dead API cleanup”大提交混合无关领域。
5. 编号 9 至 12 先写带不变量和回归矩阵的设计 Note，再以净删代码、单一所有者和产品/fixture 同源为验收标准。

## 本次审查明确不建议的改动

- 不合并 DeepSeek 与 pi-ai LLM adapters，也不合并 JSONL 与 SQLite persistence backends；它们是仓库刻意保留的独立实现与一致性证明面。
- 不因文件很长就拆分 `api-proxy.ts`、`TrajectoryTable.tsx` 或生成的 API catalogs；需要先找到独立所有权、稳定输入输出或真实变更耦合。
- 不把 Claude Code 与 Codex hook bridges 粗暴合并；现有 wire primitives 已共享，payload/dialect 映射的差异是有意保留的。
- 不用第三方 JSON-RPC、LSP framing、atomic-write 或 timer helper 直接替换现有实现；[dependency swap 审查](../../../.agents/notes/rejected/simplification/2026-07-26-dependency-swaps-rejected-by-nih-audit.zh.md) 已证明这些替换不能净删当前的限制、取消、Windows 权限或测试确定性代码。
- 不删除 workflow progress/events/meta，也不把 compaction Service Definition 与 basic provider 合包；已有 rejected Notes 保护这些能力 seam。
- 不把 `duplication` 的零 clone 结果解释为“没有重复”：Bash/Pwsh 镜像使用显式 ignore，fixture parallel 属于语义重复，二者都需要按所有权与行为审查。

## 审查与验证记录

| 命令/检查 | 结果 | 说明 |
| --- | --- | --- |
| `pnpm run duplication` | 通过 | 最终审查基线上分析 1,196 个 TS/TSX 文件，未发现未豁免 clone |
| `pnpm run build` | 通过 | 源码、类型与 Web bundle 均成功生成 |
| `pnpm run verify-built-package-invariants` | 通过 | 在 build 后验证所有当前 package artifact companion |
| `pnpm run publint` | 通过 | 在 build 后通过；干净 checkout 缺少 artifact 时不能独立通过 |
| `pnpm run constraints` | 失败 | 已删除 fusion、schema-form 与 web-react package 路径上的无 manifest 跨分支／构建 residue |
| `pnpm run hygiene` | 基线不绿 | 干净 artifact 状态下缺少 build 前置；构建后仍被 constraints 的已跟踪问题阻断 |

本次没有运行完整单元测试、coverage、e2e 或 snapshot suite，因为报告未改变产品行为；正式实施每项建议时，应按上述“验收”选择聚焦测试，并遵守 `docs/testing.md` 对模型可见行为、SDK 双端输出和 built-artifact 路径的要求。

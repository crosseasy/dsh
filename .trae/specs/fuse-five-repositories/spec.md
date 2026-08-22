# DSH 五仓库融合规格

## Why

DeepSeek Harness 需要在不修改既有核心能力实现的前提下，把 modlens、dsh-web-ui、DSH-better-sidebar 和 dsh-TUI 组合为可安装、可验证、可供桌面壳消费的统一发行层。融合必须消除重复能力，并以精确 npm 版本和真实启动证据控制外部插件版本漂移。

## What Changes

- 新增 `@deepseek-ai/dsh-fusion` 纯 patch bundle；bundle 自身不携带第三方运行时依赖，外部插件以精确版本安装到隔离 profile。
- 新增共享的 `liangshen` agent preset，供 Web 与 TUI 使用。
- 提供 `fusion` profile 的可复现零行组装文档和 `fusion-tui` 的准确交付状态参考；最终 Web 外部集合为空，ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 均保留为有完整证据的外部阻塞。Task 13 最终零行 REAL gate 通过 1/1，完整 Web oracle 通过 196/196，三项负控通过 3/3，compact 为 7 项/401 tokens、投影消息 token 为 448→155，服务重启后保持 155；独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`。历史三行 1/1 与 174/174 继续作为被取代的证据保留。TUI 源码运行时通过，但只有在受支持的公开来源可重建一致依赖闭包后才提供组装命令，因此公开交付如实标记阶段 2 阻塞。
- 记录外部包兼容矩阵与既有功能回归报告；这两个 tracked 执行记录的本轮工作树修改保持 unstaged。
- 提供 Electron 桌面壳消费 `@deepseek-ai/dsh` 与 fusion profile 的契约。
- 更新 bundle 索引、产品文档双语对、文档网站投影和拥有该架构决策的 Agent Note。
- 保持重复实现不挂载：`dsh-tool-describe-image`、`aionui-panel`、外部 Web 移动端远程能力和 dsh-TUI 内置 Liangshen 副本均不进入 Fusion；better-sidebar 在缺少不可绕过的安全部署策略时不挂载。
- 分阶段交付：阶段 1 交付仓库 Liangshen 与零外部配置行的 fusion Web；阶段 2 继续门控 better-sidebar 与 dsh-TUI，阶段 2 失败不回滚阶段 1。
- Task 12.11–12.17 已完成：Task Board 与后续三个生命周期不合格行均已移除，六个 Cordis runtime event id 已恢复为 `cordis/*`，rescope 分类模块和包元数据引用并保留 event/locale/data id，REAL process helper 的每流 64 KiB byte-bounded tail 已通过独立复审，零行产品事实已同步；Task 12 顶层整体审查与 Task 13 最终零行运行时验收均已完成。
- Task 14–17 已完成：Round 2 发现、整体复审后续 finding、最终 exact-staged 代码与安全复审，以及所有受影响 gate 均已收敛。
- Task 18 截止后候选审计与 Task 21 rescope／产品文档修复均已通过独立复审、最终验证补救、Chrome CDP 恢复验收与最终 64 文件对齐复审；Task 18、Task 21 及对应 Round 4／Round 5 checklist 已完成。Fusion Web 保持零外部行；TUI `0.7.1` 源码运行时 PASS，`0.8.7`／`0.8.8` 运行时 `NOT RUN`，公开交付保持阶段 2 BLOCKED。

## Impact

- Affected specs: profile bundle 组合、agent preset roster、Web/TUI 产品入口、桌面壳消费契约、外部插件兼容策略。
- Affected code: `packages/bundle/fusion/`、`apps/cli/config/agent-presets/liangshen/`、`tsconfig.host.json`、`knip.json`、必要的 owning tests；Cordis vendored package rescope 维护可触达 `packages/api/remotes`、`packages/extensions/cordis-*`、`packages/extensions/tool-cordis`、`packages/extensions/ui-cordis`、rescope 脚本及其 README、catalog 与测试；REAL composition process helper 及测试可修复有界输出。
- Affected docs: `packages/bundle/README*`、`docs/user/guide/`、`website/docs.ts`、`.agents/notes/`。
- Preserved surfaces: `packages/core/**`、`agent-loop`、session 格式、现有 `web`/`headless` profile 和既有用户流程。

## Assumptions And Constraints

- 当前 Harness 基线固定为 `0.1.0-rc.5`；不得为适配外部插件升级核心版本。
- 外部包必须使用通过运行时经验判据的最高精确版本；禁止 `latest`、`^`、`~`。
- 运行时经验判据要求隔离 profile 安装成功、组合解析通过、目标前端实际启动、目标能力真实可见、插件 effect/disposer 完整且断连后可重挂；发布 manifest 的 dsh peer 范围不含 rc.5 时记录为已知漂移，不单独构成阻塞，但普通 runtime dependencies 与实际 lock 不得把 DSH 包升级到 rc.5 以上。
- 若某外部包隔离安装、实际 boot、浏览器 console、终端能力、许可证身份或生命周期验证失败，则该包为真实阻塞，不能用兼容 shim 或未经计划授权的核心修改绕过。
- ModLens 有 76 个发布版本和 38 个 DSH 候选，38/38 均缺失目标路由或丢失 route disposer；精确 `3.23.1` 通过产物、许可证、安装、组合与初始路由检查，但 dispose 后路由仍存活且重挂失败。SSH 全部 26 个发布版本均不关闭活跃 terminal WebSocket 与 SSH session；Remote Web UI `0.1.11` 的 route 卸载和重挂通过，但开放 SSE、tunnel 退出等待、客户端 subscription disposer 与 failed-pair React root 均未完整清理，且 `0.1.12` 及更高版本存在 manifest/LICENSE 冲突。
- Pet 与 Git Graph `0.1.11` 的授权漏洞保留为历史事实；精确 `0.2.6` 与 `0.2.7` 均已静态增加服务端授权，但 manifest/LICENSE 身份冲突在完整安全负控和运行时判据前阻断准入，因此这些下游检查为 `NOT RUN`。
- Better Sidebar `0.15.0` 通过 `ctx.tools` 注册 8 个模型工具并进入通用 pre-execute 链，但没有包自有批准决策或不可变部署锁；用户启用后，模型命令会在 Harness 约束与环境清洗之外，以 ambient `process.env` 直达 `nodePty.spawn`。该精确候选的 Web 与生命周期检查为 `NOT RUN`。
- dsh-TUI 有 19 个发布版本，截止后版本为 `0.8.7` 与 `0.8.8`。两个精确产物各自有 24 个非 rc.5 DSH peer、0 个根与 15 个打包内 `workspace:*` 值，并携带 8 个 Liangshen 文件；历史公开安装直接查询了 23 包子集，新的完整源码闭包查询在 41 个包中找到 0 个精确 rc.5。两个候选在单一所有者与公开闭包检查失败后保持安装及 PTY `NOT RUN`；历史 `0.7.1` 源码运行时 PASS 与公开交付 BLOCKED 均不变。
- fusion bundle 的 manifest 不声明第三方运行时依赖；外部包由 profile 组合命令安装到 `$DSH_HOME/profiles/<name>`，所需 `allowBuilds` 只写入 profile 自己的 `pnpm-workspace.yaml`，不修改仓库根。
- checked-in REAL composition gate 必须实际启动 `base -> web-app -> fusion` 的零外部行组合；默认单测不得访问网络，fixture 与仓库根 `package.json`、lockfile 和 `pnpm-workspace.yaml` 均不得包含外部包、React peer 或外部构建许可。
- 现有核心 `packages/core/**`、agent-loop 与 session 格式零改动；除新增 `packages/bundle/fusion/` 外，非 fusion package 改动只允许用于恢复六个 `cordis/*` 运行时事件 id、限制 vendored package rescope 只改写模块和包元数据引用而不改写 event/locale/data id、同步 producer/allowlist/consumer/tests/generated docs，以及修复 REAL process helper 的有界输出。不得增加事件兼容 alias。
- 所有浏览器验证，包括 checked-in REAL composition gate，必须使用系统 Chrome 的 CDP `9333`，不得调用 `chromium.launch()` 或使用 IDE 内浏览器；console 报错必须修复后才能通过。
- 历史六行 Web profile 的 `156/156` 与 7 项/402 tokens compact 只证明当时组合的运行时检查；后续安全复核确认 Git Graph 与 Pet 存在授权绕过。历史四行 checked-in REAL composition gate 的 1/1 PASS，以及四行完整 oracle 的 `170/170`、7 项/401 tokens compact、448→160 tokens 与同一 durable session 重启恢复，已被 Task Board 生命周期审查取代。历史三行 checked-in gate 的 1/1、完整 oracle 的 `174/174`、7 项/402 tokens、449→155 tokens 与重启恢复，已被 ModLens、SSH 与 Remote Web UI 生命周期审查取代。上述历史证据均不得作为最终零行 Web 集合的当前验收。
- 单次命令前台等待小于一分钟；长任务在后台运行并轮询结果。
- 不执行 `git commit`、`push`、`merge`、`rebase` 或 `reset`。
- `.trae/specs/**` 与 `docs/superpowers/**` 下已有 tracked 计划和执行记录的文件本体已存在于 Git index，其本轮工作树修改不得 staged；当前未跟踪的翻译对、sidecar 与 `.superpowers/**` 报告不得加入 Git index。
- 新 bundle 使用 ESM、精确一个结尾换行、包自有 `./invariant` companion 和最小 `src/index.ts`。
- 产品文档与 Agent Note 按仓库规则提供英文、中文和 i18n sidecar，并通过网站投影与文档门禁。

## Existing Invariants

- `web` 与 `headless` profile 的 bundle 顺序、自动初始化和启动语义不变。
- `ui-sidebar` 左侧会话栏保留；八个外部候选均保持未挂载，直到其发布产物满足全部准入判据。
- 阶段 1 回归既有 `base + web-app` 用户路径：对话渲染、工具卡片、New Session、会话列表、fork、resume、compact、export、Search、Settings 和模型选择保持可用。全部八个外部集成均为阻塞项，未解除时 Fusion 保持零行。
- headless 与 ACP 不加载 fusion bundle，不受外部 UI 插件影响。
- 模型可见输入仍可从 session log 重建；本变更不修改 session 事件或 agent loop。

## Attachment Points

- 外部插件只允许通过 `packages/bundle/fusion/cordis.patch.yml` 进入 Host/Web 组合；当前 patch 为空，ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 均不得挂载。
- Liangshen 只通过 `apps/cli/config/agent-presets/liangshen/` 进入 agent preset roster。
- `fusion` 通过 `dsh plugin --profile fusion add ...` 组装，不修改 `PROFILE_TEMPLATES`。`fusion-tui` 只有在受支持的公开来源可重建已验证闭包后才发布对应组装命令。
- 产品文档通过 `website/docs.ts` 显式投影；不编辑 `website/.generated/`。
- 桌面壳只消费发布物与 profile 契约；本次不修改外部 desktop 仓库。

## ADDED Requirements

### Requirement: 外部插件兼容矩阵

系统 SHALL 在融合前对每个外部包执行 npm 元数据、隔离安装、bundle 解析和实际 boot 验证，并记录在 `@deepseek-ai/dsh@0.1.0-rc.5` 上通过运行时经验判据的精确版本、声明 peer 漂移和 profile 构建脚本许可。

#### Scenario: 找到兼容历史版本

- **WHEN** 最新外部包的 peer 范围不接受 `rc.5`
- **THEN** 验证流程记录该 peer 漂移，并选择能通过隔离安装、组合、实际 boot 和目标能力检查的最高精确版本

#### Scenario: 无兼容版本

- **WHEN** 所有已发布版本的隔离安装、实际 boot 或目标能力检查均失败
- **THEN** 兼容矩阵记录完整运行时失败证据，并把该依赖标记为本阶段阻塞而不是加入 fusion

#### Scenario: 安全判据失败

- **WHEN** 已发布版本可启动但其共享 WebServer 路由缺少与远端暴露方式匹配的服务端授权
- **THEN** 兼容矩阵记录 source-to-sink 与负控证据，并把该插件标记为外部阻塞；运行时可见或历史组合通过不能豁免该安全失败

#### Scenario: 生命周期判据失败

- **WHEN** 已发布版本不能把完整 UI disposer 和 subscription 纳入 Cordis effect，或 AppFrame 断连后不能重挂
- **THEN** 兼容矩阵记录同页卸载、HMR、断连重挂与资源释放缺口，并把该插件标记为外部阻塞；不得用 bundle shim 或核心修改绕过

### Requirement: Fusion bundle

系统 SHALL 发布 `@deepseek-ai/dsh-fusion`，其 manifest 导出 patch 与 invariant，但不声明第三方运行时依赖；没有外部包通过全部准入判据时，patch 与 `profileDependencies` 均为空。

#### Scenario: 解析 bundle

- **WHEN** profile composer 解析 fusion manifest 和 patch
- **THEN** bundle 作为 ESM patch layer 加载，且构建、类型检查、package invariant 与 hygiene 检查通过

#### Scenario: 组合规范实现

- **WHEN** fusion patch 应用在 base 与 web-app 之后
- **THEN** patch 不增加外部配置行，ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 均保持未挂载

#### Scenario: 仓库根保持干净

- **WHEN** 在仓库根执行 `pnpm install`、hygiene 和发布检查
- **THEN** fusion 不把外部插件依赖树安装进仓库工作区，仓库根 `package.json`、根 lockfile 与根 `pnpm-workspace.yaml` 的 `allowBuilds` 不增加第三方包

### Requirement: 重复能力去除

系统 SHALL 只启用通过全部准入判据的外部实现；当前没有外部 Web 实现满足该条件，因此八个候选均保持未挂载。Liangshen 继续使用仓库共享 preset。

#### Scenario: 聚合包携带重复 row

- **WHEN** 外部候选仍未通过全部准入判据
- **THEN** fusion patch 保持为空，且不通过聚合 bundle 引入 describe-image、aionui-panel 或其他外部配置行

#### Scenario: 可直接引用子包

- **WHEN** 未来 web-ui 子包可独立安装并通过许可证、安全、生命周期和完整运行时判据
- **THEN** fusion 才能直接引用通过准入的子包，并继续排除重复能力子包

### Requirement: Liangshen preset

系统 SHALL 提供可发现、可挂载的 `liangshen` preset，并保留标准 coding agent 能力及来源包中经过验证的两阶段工具锚定行为。

#### Scenario: 挂载 preset

- **WHEN** agent roster 发现并挂载 `liangshen`
- **THEN** preset metadata、realm 隔离、工具目录、prompt 段和 session header 均符合 preset 规则

### Requirement: Web fusion profile

系统 SHALL 文档化并验证 `base + web-app + fusion` 的零外部行 `fusion` profile。

#### Scenario: 阶段 1 Web 启动

- **WHEN** 用户按文档组装并启动 `fusion`
- **THEN** 页面通过系统 Chrome CDP `9333` 加载，stock Web 左侧会话栏、Settings 与 New Session 入口可见，console 无错误；八个外部集成均不存在，并以完整 blocker 证据替代挂载要求

#### Scenario: 阶段 2 工作台

- **WHEN** better-sidebar 同时通过运行时门、安全门并加入 fusion
- **THEN** 右侧工作台与核心左侧会话栏并存，文件、编辑器、终端和 Git tab 可见，console 无错误；若没有不可被用户设置覆盖的安全部署开关，则该扩展保持未挂载并标记阶段 2 阻塞

### Requirement: TUI fusion profile

系统 SHALL 在阶段 1 完成后，门控文档化并验证基于 base 与锁定 dsh-TUI 包的 `fusion-tui` profile。源码闭包运行时通过但公开包来源无法重建同一闭包时，系统 SHALL 把运行时结论与公开交付结论分开，并如实保持阶段 2 BLOCKED。

当前发布事实为 19 个 TUI 版本；`0.8.7` 与 `0.8.8` 是 `2026-08-21T02:11:00Z` 截止后的两个版本。两者均在单一 Liangshen 所有权与公开 rc.5 闭包前置检查失败，候选运行时为 `NOT RUN`，不得写成 PASS 或 FAIL。

#### Scenario: TUI 启动和往返

- **WHEN** 用户启动 `fusion-tui` 并发送一条简单消息
- **THEN** 顶栏、状态、输入区和 `session/event` 驱动的响应正常渲染，终端无崩溃；peer 漂移、`workspace:*`、React 与 Liangshen 目录所有权风险已记录并判定可接受，且 profile lock 不含高于 rc.5 的 DSH runtime 包；若公开来源不能重建该 lock，则产品指南不提供会解析混合版本图的命令，并记录解除阻塞条件

### Requirement: REAL composition 持续验收

系统 SHALL 提供 checked-in、独立于默认单测的 REAL composition gate，实际启动最终零行 `base -> web-app -> fusion` 组合并通过系统 Chrome CDP `9333` 验证。

#### Scenario: 零行真实组合

- **WHEN** 运行 REAL composition gate
- **THEN** Fusion 外部 Host 配置行、浏览器入口、客户端资源、UI root、路由和工具均为零，stock Web 基本界面可见，console、page、network 与清理诊断通过

#### Scenario: 浏览器与网络隔离

- **WHEN** CI 或本地执行 Fusion 持续验收
- **THEN** gate 连接系统 Chrome CDP `9333`，不得调用 `chromium.launch()` 或 IDE 浏览器；只有显式 REAL composition lane 可以安装 profile 局部外部包，默认 `pnpm run test` 与 `pnpm run test:coverage` 不得联网

#### Scenario: 根依赖隔离

- **WHEN** checked-in fixture 固定零行 profile
- **THEN** fixture/profile 与仓库根 `package.json`、lockfile 和 `pnpm-workspace.yaml` 均不包含外部包、React peer 或外部 `allowBuilds` 条目

#### Scenario: Process 输出有界

- **WHEN** REAL process helper 捕获持续增长或单个超大 stdout/stderr 分片
- **THEN** 每个流只保留最多 64 KiB 的 byte-bounded diagnostic tail，跨分片 readiness marker 仍可识别，并由独立复审确认实现和测试

### Requirement: Cordis runtime event id

系统 SHALL 保留 `cordis/request-run`、`cordis/request-run-resolved`、`cordis/dynamic-package`、`cordis/dynamic-retract`、`cordis/inspect-query` 与 `cordis/inspect-query-resolved` 作为唯一运行时事件 id，不提供 scoped alias。

#### Scenario: Vendored package rescope

- **WHEN** rescope 工具处理模块引用、包元数据引用、`cordis/*` event literal、locale id 和 data id
- **THEN** 模块与包元数据引用改写为 `@deepseek-ai/cordis/*`；event、locale 与 data id 保持不变，producer、Remote allowlist、consumer、测试和生成文档全部使用原 `cordis/*`

#### Scenario: Markdown package manifest fence

- **WHEN** Markdown 的有效 JSON/JSONC 围栏包含 package manifest dependency map
- **THEN** 其直接包名键支持正向、反向和幂等改写；普通 JSON 值与格式错误围栏保持不变

### Requirement: 分阶段交付

系统 SHALL 把核心 Web 能力与 sidebar/TUI 扩展分离交付，避免一个扩展阻塞已验证核心。

#### Scenario: 阶段 2 扩展失败

- **WHEN** better-sidebar 或 dsh-TUI 无法通过其运行时门
- **THEN** 仅该扩展保持阻塞，阶段 1 的 fusion Web、Liangshen、回归证据和桌面壳契约仍可完成

### Requirement: 回归与隔离

系统 SHALL 证明 fusion 不改变既有 Web 用户路径，也不污染其他 profile。

#### Scenario: 既有功能回归

- **WHEN** 在 fusion Web 会话执行既有工作流
- **THEN** 阶段 1 既有 `base + web-app` 路径中的对话、会话管理、Search、Settings 和模型选择均通过；右侧 Files/Web Editor/Terminal/Git 不属于本场景，由阶段 2 Task 7 验收

#### Scenario: 其他 profile

- **WHEN** 启动 headless 或现有 Web profile
- **THEN** 它们不加载 fusion bundle，并保持原有行为

### Requirement: 桌面壳消费契约

系统 SHALL 说明 deepseek-harness-desktop 通过精确 npm 依赖消费 dsh 和 fusion profile；Fusion 不提供移动端远程能力时，桌面壳可以保留并自行管理其远程实现。

#### Scenario: 发布物检查

- **WHEN** 检查 fusion package 的发布内容
- **THEN** `publishConfig.access`、exports、`cordis.patch.yml`、运行时 JS 和类型声明完整且可由外部消费者解析

### Requirement: 仓库文档与决策记录

系统 SHALL 同步 bundle 索引、产品指南、网站投影和拥有融合决策的 Agent Note。

#### Scenario: 文档门禁

- **WHEN** 运行 `doc-sync`、站点检查、lint 和 diff 检查
- **THEN** 英中配对、链接、预算、站点路由和 Agent Note 格式全部通过

## MODIFIED Requirements

### Requirement: Bundle roster

`packages/bundle/README.md` 及其中文对应文件 SHALL 把 fusion 列为可发布的 profile bundle，并链接到 package README；既有 base、web-app 和 headless 描述保持不变。

### Requirement: Agent preset roster

部署随附 preset 的目录 roster SHALL 增加 `liangshen`，现有 `standard`、`code`、`minimal` 和 `cordis` preset 不变。

## REMOVED Requirements

### Requirement: 重复图像工具和工作台

**Reason**: 当前没有外部图像 owner；`describe-image` 作为重复图像候选保持禁止，ModLens 只有在未来通过完整准入后才能成为图像 owner。better-sidebar 仅在通过安全与运行时门后成为唯一右侧工作台实现。重复插件会造成工具、slot 或 service 冲突。

**Migration**: fusion profile 不挂载对应子包，或在不可拆分聚合 bundle 中按真实 row id 禁用。

### Requirement: Fusion 对 desktop Remote 的所有权要求

**Reason**: Remote Web UI 未通过生命周期准入，Fusion 不拥有该能力。

**Migration**: 桌面壳无需因消费 Fusion 而禁用或关闭自身实现，并继续负责其生命周期；外部仓库修改不属于本交付。

### Requirement: dsh-TUI 内置 Liangshen 副本

**Reason**: Web 与 TUI 必须共享同一个随 dsh 发布的 preset。

**Migration**: `fusion-tui` 选择本仓库的 `liangshen` preset；若外部 TUI 无法禁用副本，则其版本不得通过兼容矩阵。

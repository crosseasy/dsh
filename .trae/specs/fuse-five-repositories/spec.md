# DSH 五仓库融合规格

## Why

DeepSeek Harness 需要在不修改既有核心能力实现的前提下，把 modlens、dsh-web-ui、DSH-better-sidebar 和 dsh-TUI 组合为可安装、可验证、可供桌面壳消费的统一发行层。融合必须消除重复能力，并以精确 npm 版本和真实启动证据控制外部插件版本漂移。

## What Changes

- 新增 `@deepseek-ai/dsh-fusion` 纯 patch bundle；bundle 自身不携带第三方运行时依赖，外部插件以精确版本安装到隔离 profile。
- 新增共享的 `liangshen` agent preset，供 Web 与 TUI 使用。
- 提供 `fusion` profile 的可复现两行组装文档和 `fusion-tui` 的准确交付状态参考；当前 Web 外部集合仅包含 Pet 与 Git Graph `0.2.9`，ModLens、SSH、Remote Web UI、Task Board、Skin Center 与 Better Sidebar 是六个有完整证据的 decision-bearing blocker。Pet 与 Git Graph 通过精确产物、许可证、安全、生命周期、所有权、去重、隔离安装和 Chrome CDP `9333` 运行时判据，最终两行 REAL gate 通过 1/1。历史零行 REAL gate 1/1、完整 Web oracle 196/196 与三项负控 3/3 只作为被取代证据保留；历史三行、四行和六行结果也不代表当前准入。TUI 源码运行时通过，但只有在受支持的公开来源可重建一致依赖闭包后才提供组装命令，因此公开交付如实标记阶段 2 阻塞。
- 记录外部包兼容矩阵与既有功能回归报告；这两个 tracked 执行记录的本轮工作树修改保持 unstaged。
- 提供 Electron 桌面壳消费 `@deepseek-ai/dsh` 与 fusion profile 的契约。
- 更新 bundle 索引、产品文档双语对、文档网站投影和拥有该架构决策的 Agent Note。
- 保持重复实现不挂载：`dsh-tool-describe-image`、`aionui-panel`、外部 Web 移动端远程能力和 dsh-TUI 内置 Liangshen 副本均不进入 Fusion；better-sidebar 在缺少不可绕过的安全部署策略时不挂载。
- 分阶段交付：阶段 1 交付仓库 Liangshen 与仅含 Pet、Git Graph `0.2.9` 的 fusion Web；阶段 2 继续门控 better-sidebar 与 dsh-TUI，阶段 2 失败不回滚阶段 1。
- Task 12.11–12.17 已完成：Task Board 与后续三个生命周期不合格行均已移除，六个 Cordis runtime event id 已恢复为 `cordis/*`，rescope 分类模块和包元数据引用并保留 event/locale/data id，REAL process helper 的每流 64 KiB byte-bounded tail 已通过独立复审，零行产品事实已同步；Task 12 顶层整体审查与 Task 13 最终零行运行时验收均已完成。
- Task 14–17 已完成：Round 2 发现、整体复审后续 finding、最终 exact-staged 代码与安全复审，以及所有受影响 gate 均已收敛。
- Task 18 截止后候选审计与 Task 21 rescope／产品文档修复均已通过独立复审、最终验证补救、Chrome CDP 恢复验收与最终 64 文件对齐复审；Task 18、Task 21 及对应 Round 4／Round 5 checklist 已完成。
- Task 22 及其独立复审均已完成：17 个 Web UI 身份的 `0.2.8` 与 `0.2.9` 精确产物均已审计，Pet 与 Git Graph `0.2.9` 已进入两行组合，生命周期补充与最终两行 REAL gate 均为 PASS。TUI `0.7.1` 源码运行时 PASS，`0.8.7`／`0.8.8` 运行时 `NOT RUN`，公开交付保持阶段 2 BLOCKED。
- Task 25 已完成：36 个产品文件保持 staged，精确两行 Pet 与 Git Graph `0.2.9` 组合通过 63/63 focused tests 与系统 Chrome CDP `9333` replay 1/1；必需的隔离 `ubuntu-latest` job 已配置并通过静态 CI contract 测试，实际 GitHub-hosted 执行由 CI 持有且未在本地运行。
- Task 26 已完成：精确 ModLens `3.24.0` 在服务端请求安全检查失败，精确 Better Sidebar `0.15.1` 在公共 rc.5 peer 闭包检查失败；两者的后续检查均为 `NOT RUN`，Fusion 两行组合保持不变。
- Task 28 已完成：Better Sidebar 的执行时无缓存审计确认 15 个可安装版本，fresh cutoff 后唯一新候选为精确 `0.15.2`；产物与许可证检查为 PASS，公共 rc.5 闭包为 0/14 FAIL，后续安全、生命周期、隔离安装、组合、启动与 Chrome 检查均为 `NOT RUN`。Better Sidebar 保持阻塞且未挂载，Fusion 两行组合不变。
- Task 29 已完成：精确 Pet 与 Git Graph `0.2.9` 两行组合在同一次 fresh assembled run 中通过系统 Chrome CDP `9333` 的 36/36 断言，覆盖对话、工具卡片、New Session、会话列表、fork、resume、compact、两条 export 路径、Search、Settings、模型选择、Pet、Git Graph 与 stock Web；fresh headless 和 ACP 验证保持隔离。exit、console、page、network、slot、process、port、CDP target、临时目录与进程组诊断及 cleanup 均干净。历史零行、三行、四行与六行结果继续仅作为被取代证据保留。
- Task 30 的最终 exact-staged V8 package 为 `.superpowers/sdd/round5-final-staged-v8/review-package.md`，SHA-256 为 `d4d9e99624bd8f7612e92c477efeaadea1b2b37ee0f268ea6df4704fda42c8dc`，对应 index tree `d77fb5a65673db4232f5ace22726dbf9e091dc29`，包含 41 个文件、3,276 行新增与 506 行删除。四文件 focused tests 通过 110/110；typecheck、build、lint 以 0 errors 通过，hygiene 通过；translation pairing 检查 945 对，Agent Note 格式检查 542 份，冻结归档检查 426 个产物，Markdown wrap 检查 1,874 个文件、links 检查 1,911 个文件、budgets 检查 9 个文档，均通过。系统 Chrome 151 经 CDP `9333` 的 built acceptance 通过 1/1，结束后 Fusion target 与 listener 均为 0；Task 28 summarize 生成 0/14，assert 按预期以退出码 1 确认阻塞；Task 29 oracles 通过 10/10。Task 28 与 Task 29 的 task review 已完成；V8 bits 复审为 P0/P1/P2 `0/0/0`，DSH 复审为 `PASS / APPROVE` 且 0 findings，安全复审未发现可利用问题。
- Task 30 已完成。全部有效 remediation finding 均已修复：外层 acquisition 在启动前事务式登记并清理取消后到达的资源；CI trap 在 `mktemp` 和 Chrome launch 前取得带 guard 的 cleanup 所有权；Pet apply-only 变异只修改 profile 内完整私有包副本；显式 settlement 状态保留 acquisition、operation 与 cleanup 的 `Promise.reject(undefined)`；相互独立的 cancellation、operation、resource disposal 与 final cleanup failure 会聚合，重复引用只按对象 identity 去重；pending acquisition、disposal、final cleanup 与 operation settlement 共用一个 cleanup deadline；deadline 到期后仍以已取消 signal 启动尚未开始的外层 disposer，并仅作已观察的 best-effort 清理，不延长截止时间。独立 plan/design/spec alignment 为 `APPROVED`，Critical/Important/Minor 为 `0/0/0`；最终 checklist、staging 与 Git 对账及唯一 progress 追加均已完成。全量 coverage 与实际 GitHub-hosted job 均未在本地运行。

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
- ModLens 有 77 个发布版本和 39 个 DSH 候选。前 38 个候选缺失目标路由或丢失 route disposer；精确 `3.24.0` 通过产物、许可证、无 DSH 依赖闭包、隔离安装与单行组合，但跨站 `POST /modlens/paste` 返回 `200` 并写入图像，因此生命周期、启动与 Chrome 检查为 `NOT RUN`。SSH 全部 28 个发布版本均把已接受的独立终端会话留在插件 dispose 之外。Remote Web UI 全部 28 个发布版本均未通过完整准入；精确 `0.2.9` 修复许可证身份，但 `requirePairingForLan:false` 会使 `/remote` 跳过实时设备授权，因此后续生命周期与运行时检查为 `NOT RUN`。
- Pet 与 Git Graph `0.1.11` 的授权漏洞保留为历史事实；精确 `0.2.8` 在许可证身份失败。精确 `0.2.9` 同时具备一致许可证身份与服务端授权，并通过实时未配对／撤销负控、Pet Host/Client 生命周期、Git Host 与真实 2 秒 fallback Client 生命周期、隔离安装和组合运行时判据。
- Better Sidebar 有 15 个可安装发布版本。Task 28 的执行时无缓存 packument 以 `2026-08-22T17:01:07Z` 为 fresh cutoff；相对 `2026-08-22T15:28:38Z` 的前次兼容矩阵 cutoff，完整 post-cutoff 候选只有发布于 `2026-08-22T15:35:41.933Z` 的精确 `0.15.2`。该候选的身份、完整性、路径安全与 MIT 许可证检查为 PASS，但全部 14 个 DSH peer 范围均要求 `^0.1.0-rc.8`，公共注册表提供精确 rc.5 的数量为 0/14，因此公共 rc.5 闭包为 FAIL。按顺序准入规则，后续安全、生命周期、隔离安装、组合、启动、Chrome CDP `9333` 与浏览器诊断均为 `NOT RUN`；Better Sidebar 保持阻塞且未挂载，Fusion 继续只包含 Pet 与 Git Graph `0.2.9` 两行。
- dsh-TUI 有 19 个发布版本，截止后版本为 `0.8.7` 与 `0.8.8`。两个精确产物各自有 24 个非 rc.5 DSH peer、0 个根与 15 个打包内 `workspace:*` 值，并携带 8 个 Liangshen 文件；历史公开安装直接查询了 23 包子集，新的完整源码闭包查询在 41 个包中找到 0 个精确 rc.5。两个候选在单一所有者与公开闭包检查失败后保持安装及 PTY `NOT RUN`；历史 `0.7.1` 源码运行时 PASS 与公开交付 BLOCKED 均不变。
- fusion bundle 的 manifest 不声明第三方运行时依赖；外部包由 profile 组合命令安装到 `$DSH_HOME/profiles/<name>`，所需 `allowBuilds` 只写入 profile 自己的 `pnpm-workspace.yaml`，不修改仓库根。
- checked-in REAL composition gate 必须实际启动 `base -> web-app -> fusion` 的两行组合；fixture/profile 只包含精确 `@linxin666/dsh-pet@0.2.9`、`@linxin666/dsh-client-ui-git-graph@0.2.9` 与 React `18.3.1` peer，且不含外部 `allowBuilds`。默认单测不得访问网络；Task 22 不向仓库根新增 Pet、Git Graph 或 React 条目，且仓库根 `package.json`、lockfile 与 `pnpm-workspace.yaml` 没有 Task 22 diff。
- 现有核心 `packages/core/**`、agent-loop 与 session 格式零改动；除新增 `packages/bundle/fusion/` 外，非 fusion package 改动只允许用于恢复六个 `cordis/*` 运行时事件 id、限制 vendored package rescope 只改写模块和包元数据引用而不改写 event/locale/data id、同步 producer/allowlist/consumer/tests/generated docs，以及修复 REAL process helper 的有界输出。不得增加事件兼容 alias。
- 所有浏览器验证，包括 checked-in REAL composition gate，必须使用系统 Chrome 的 CDP `9333`，不得调用 `chromium.launch()` 或使用 IDE 内浏览器；console 报错必须修复后才能通过。
- 历史六行 Web profile 的 `156/156` 与 7 项/402 tokens compact 只证明当时组合的运行时检查；后续安全复核确认当时的 Git Graph 与 Pet 存在授权绕过。历史四行 checked-in REAL composition gate 的 1/1 PASS，以及四行完整 oracle 的 `170/170`、7 项/401 tokens compact、448→160 tokens 与同一 durable session 重启恢复，已被 Task Board 生命周期审查取代。历史三行 checked-in gate 的 1/1、完整 oracle 的 `174/174`、7 项/402 tokens、449→155 tokens 与重启恢复，已被 ModLens、SSH 与 Remote Web UI 生命周期审查取代。Task 13 零行 REAL gate 的 1/1、完整 oracle 的 196/196、三项负控 3/3、7 项/401 tokens compact、448→155 tokens 与重启恢复也只对被取代的零行组合有效。上述历史证据均不得作为当前两行 Web 集合的验收。
- 单次命令前台等待小于一分钟；长任务在后台运行并轮询结果。
- 不执行 `git commit`、`push`、`merge`、`rebase` 或 `reset`。
- `.trae/specs/**` 与 `docs/superpowers/**` 下已有 tracked 计划和执行记录的文件本体已存在于 Git index，其本轮工作树修改不得 staged；当前未跟踪的翻译对、sidecar 与 `.superpowers/**` 报告不得加入 Git index。
- 新 bundle 使用 ESM、精确一个结尾换行、包自有 `./invariant` companion 和最小 `src/index.ts`。
- 产品文档与 Agent Note 按仓库规则提供英文、中文和 i18n sidecar，并通过网站投影与文档门禁。

## Existing Invariants

- `web` 与 `headless` profile 的 bundle 顺序、自动初始化和启动语义不变。
- `ui-sidebar` 左侧会话栏保留；Pet 与 Git Graph `0.2.9` 各挂载一行，其余六个 decision-bearing blocker 保持未挂载。
- 阶段 1 回归既有 `base + web-app` 用户路径：对话渲染、工具卡片、New Session、会话列表、fork、resume、compact、export、Search、Settings 和模型选择保持可用。Pet 与 Git Graph 不改变这些路径。
- headless 与 ACP 不加载 fusion bundle，不受外部 UI 插件影响。
- 模型可见输入仍可从 session log 重建；本变更不修改 session 事件或 agent loop。

## Attachment Points

- 外部插件只允许通过 `packages/bundle/fusion/cordis.patch.yml` 进入 Host/Web 组合；当前 patch 只挂载 `pet` 与 `ui-git-graph`，ModLens、SSH、Remote Web UI、Task Board、Skin Center 与 Better Sidebar 均不得挂载。
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

系统 SHALL 发布 `@deepseek-ai/dsh-fusion`，其 manifest 导出 patch 与 invariant，但不在标准依赖区声明第三方运行时依赖；当前 `profileDependencies` 只记录 Pet 与 Git Graph `0.2.9`，patch 只插入对应两行。

#### Scenario: 解析 bundle

- **WHEN** profile composer 解析 fusion manifest 和 patch
- **THEN** bundle 作为 ESM patch layer 加载，且构建、类型检查、package invariant 与 hygiene 检查通过

#### Scenario: 组合规范实现

- **WHEN** fusion patch 应用在 base 与 web-app 之后
- **THEN** patch 恰好增加 `pet` 与 `ui-git-graph`，ModLens、SSH、Remote Web UI、Task Board、Skin Center 与 Better Sidebar 保持未挂载

#### Scenario: 仓库根保持干净

- **WHEN** 在仓库根执行 `pnpm install`、hygiene 和发布检查
- **THEN** fusion 不把外部插件依赖树安装进仓库工作区，仓库根 `package.json`、根 lockfile 与根 `pnpm-workspace.yaml` 的 `allowBuilds` 不增加第三方包

### Requirement: 重复能力去除

系统 SHALL 只启用通过全部准入判据的外部实现；当前 Pet 与 Git Graph `0.2.9` 已满足该条件，其余六个 decision-bearing capability 保持未挂载。Liangshen 继续使用仓库共享 preset。

#### Scenario: 聚合包携带重复 row

- **WHEN** 外部候选仍未通过全部准入判据
- **THEN** fusion patch 不增加该候选，且不通过聚合 bundle 引入 describe-image、aionui-panel 或其他未准入配置行

#### Scenario: 可直接引用子包

- **WHEN** 未来 web-ui 子包可独立安装并通过许可证、安全、生命周期和完整运行时判据
- **THEN** fusion 才能直接引用通过准入的子包，并继续排除重复能力子包

### Requirement: Liangshen preset

系统 SHALL 提供可发现、可挂载的 `liangshen` preset，并保留标准 coding agent 能力及来源包中经过验证的两阶段工具锚定行为。

#### Scenario: 挂载 preset

- **WHEN** agent roster 发现并挂载 `liangshen`
- **THEN** preset metadata、realm 隔离、工具目录、prompt 段和 session header 均符合 preset 规则

### Requirement: Web fusion profile

系统 SHALL 文档化并验证 `base + web-app + fusion` 的两行 `fusion` profile，其中只包含 Pet 与 Git Graph `0.2.9`。

#### Scenario: 阶段 1 Web 启动

- **WHEN** 用户按文档组装并启动 `fusion`
- **THEN** 页面通过系统 Chrome CDP `9333` 加载，stock Web 左侧会话栏、Settings、New Session、唯一 Pet 控件与唯一 Git Graph 分支 chip 可见，Pet 状态与 Git 分支探针返回实时数据，console 无错误；六个 decision-bearing blocker 均不存在

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

系统 SHALL 提供 checked-in、独立于默认单测的 REAL composition gate，实际启动最终两行 `base -> web-app -> fusion` 组合并通过系统 Chrome CDP `9333` 验证。

#### Scenario: 两行真实组合

- **WHEN** 运行 REAL composition gate
- **THEN** Fusion 恰好包含 Pet 与 Git Graph 两个外部 Host 配置行和浏览器入口，唯一 Pet root、唯一 Git Graph chip，以及 Pet 状态与 Git 分支实时数据，不增加外部模型工具，stock Web 基本界面可见，console、page、network 与清理诊断通过；阻塞路由的 `GET` 响应与独立 `base + web-app` 完整稳定响应精确相等，挂载 JSON、redirect、含 stock title 的 route-owned HTML、404 与 405 handler 控制响应均不相等并失败

#### Scenario: 外部路由授权

- **WHEN** REAL composition gate 完成精确 profile 冻结安装
- **THEN** gate 从该 profile 解析 Pet 与 Git Graph 的真实 `lib/index.js`，让同一个 route 实例依次处理非 loopback 未配对、已配对、已撤销与 loopback 请求；被拒绝的请求在触达 Pet state 或 Git workspace 前返回 403；apply-only Pet 变异只写入完整私有包副本，且安装入口 hash 保持不变

#### Scenario: CI 与验收超时层级

- **WHEN** required Fusion CI job 运行 10 分钟验收
- **THEN** job 上限为 15 分钟且至少保留 5 分钟外层 reserve；验收组合 Vitest 信号与 540 秒内部 deadline，在 acquisition 前登记外层资源，并在 operation 正常结算时移除 abort listener；取消后，pending acquisition、反向串行 disposal、最终 cleanup 与 operation settlement 共用一个 30 秒总 deadline，正常路径等待停稳，到期路径以已取消 signal 启动剩余已取得资源的 disposer、报告未结算工作并返回失败，为框架返回与报告保留 30 秒

#### Scenario: 浏览器与网络隔离

- **WHEN** CI 或本地执行 Fusion 持续验收
- **THEN** gate 连接系统 Chrome CDP `9333`，不得调用 `chromium.launch()` 或 IDE 浏览器；只有显式 REAL composition lane 可以安装 profile 局部外部包，默认 `pnpm run test` 与 `pnpm run test:coverage` 不得联网

#### Scenario: 根依赖隔离

- **WHEN** checked-in fixture 固定两行 profile
- **THEN** fixture/profile 只包含精确 Pet、Git Graph `0.2.9` 与 React `18.3.1` peer，不包含外部 `allowBuilds`；该任务不向仓库根新增 Pet、Git Graph 或 React 条目，且仓库根 `package.json`、lockfile 与 `pnpm-workspace.yaml` 无 diff

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

**Reason**: 当前没有外部图像 owner；`describe-image` 作为未准入图像候选保持禁止，ModLens 只有在未来通过完整准入后才能成为图像 owner。better-sidebar 仅在通过安全与运行时门后成为唯一右侧工作台实现。重复插件会造成工具、slot 或 service 冲突。

**Migration**: fusion profile 不挂载对应子包，或在不可拆分聚合 bundle 中按真实 row id 禁用。

### Requirement: Fusion 对 desktop Remote 的所有权要求

**Reason**: Remote Web UI 未通过生命周期准入，Fusion 不拥有该能力。

**Migration**: 桌面壳无需因消费 Fusion 而禁用或关闭自身实现，并继续负责其生命周期；外部仓库修改不属于本交付。

### Requirement: dsh-TUI 内置 Liangshen 副本

**Reason**: Web 与 TUI 必须共享同一个随 dsh 发布的 preset。

**Migration**: `fusion-tui` 选择本仓库的 `liangshen` preset；若外部 TUI 无法禁用副本，则其版本不得通过兼容矩阵。

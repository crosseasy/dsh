# DSH 五仓库融合规格

## Why

DeepSeek Harness 需要在不修改既有核心能力实现的前提下，把 modlens、dsh-web-ui、DSH-better-sidebar 和 dsh-TUI 组合为可安装、可验证、可供桌面壳消费的统一发行层。融合必须消除重复能力，并以精确 npm 版本和真实启动证据控制外部插件版本漂移。

## What Changes

- 新增 `@deepseek-ai/dsh-fusion` 纯 patch bundle；bundle 自身不携带第三方运行时依赖，外部插件以精确版本安装到隔离 profile。
- 新增共享的 `liangshen` agent preset，供 Web 与 TUI 使用。
- 提供 `fusion` profile 的可复现单行组装文档；当前 Web 外部集合仅包含 Pet `0.2.9`，Git Graph、ModLens、SSH、Remote Web UI、Task Board、Skin Center 与 Better Sidebar 保持未挂载。
- 提供 `fusion-tui` 的准确交付状态参考；源码验证结果与公开交付结论相互独立，公开来源不能重建符合要求的闭包或候选携带第二个 Liangshen 所有者时不提供组装命令。
- 记录外部包兼容矩阵与既有功能回归报告；兼容矩阵持有带截止时间的候选事实，回归报告区分可复现命令与不可作为当前验收依据的本地历史记录。
- 提供 Electron 桌面壳消费 `@deepseek-ai/dsh` 与 fusion profile 的约定。
- 更新 bundle 索引、产品文档双语对、文档网站投影和拥有该架构决策的 Agent Note。
- 保持重复实现不挂载：`dsh-tool-describe-image`、`aionui-panel`、外部 Web 移动端远程能力和 dsh-TUI 内置 Liangshen 副本均不进入 Fusion。
- 分阶段交付：阶段 1 交付仓库 Liangshen 与仅含 Pet `0.2.9` 的 Fusion Web；阶段 2 继续门控 Better Sidebar 与 dsh-TUI，阶段 2 失败不回滚阶段 1。

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
- 截至 `2026-08-23T11:18:55Z` 的[带日期兼容矩阵](../../../docs/superpowers/plans/fusion-compat-matrix.md)持有 ModLens、SSH 与 Remote Web UI 的发布计数。精确 ModLens `3.24.0` 通过产物、许可证、无 DSH 依赖闭包、隔离安装与单行组合，但跨站 `POST /modlens/paste` 返回 `200` 并写入图像，因此生命周期、启动与 Chrome 检查为 `NOT RUN`。全部已审计 SSH 版本均把已接受的独立终端会话留在插件 dispose 之外。Remote Web UI 精确 `0.2.9` 修复许可证身份，但 `requirePairingForLan:false` 会使 `/remote` 跳过实时设备授权，因此后续生命周期与运行时检查为 `NOT RUN`。
- Pet 与 Git Graph `0.1.11` 的授权漏洞保留为历史事实；精确 `0.2.8` 在许可证身份失败。Pet `0.2.9` 同时具备一致许可证身份与服务端授权，并通过实时未配对／撤销负控、Host/Client 生命周期、隔离安装和组合运行时判据。Git Graph `0.2.9` 的授权、直接 route／SSE dispose、同 Context 重挂、隔离安装和历史组合运行时检查通过，但活跃 JSON 操作及其子进程可越过配置行 fiber dispose，因此当前被阻塞。
- 截至 `2026-08-23T11:18:55Z` 的带日期兼容矩阵持有 Better Sidebar 的 15 个可安装发布版本。Task 28 的执行时无缓存 packument 以 `2026-08-22T17:01:07Z` 为 fresh cutoff；相对 `2026-08-22T15:28:38Z` 的前次兼容矩阵 cutoff，完整 post-cutoff 候选只有发布于 `2026-08-22T15:35:41.933Z` 的精确 `0.15.2`。该候选的身份、完整性、路径安全与 MIT 许可证检查为 PASS，但全部 14 个 DSH peer 范围均要求 `^0.1.0-rc.8`，公共注册表提供精确 rc.5 的数量为 0/14，因此公共 rc.5 闭包为 FAIL。按顺序准入规则，后续安全、生命周期、隔离安装、组合、启动、Chrome CDP `9333` 与浏览器诊断均为 `NOT RUN`；Better Sidebar 保持阻塞且未挂载，Task 28 当时的两行结论现为历史证据。
- dsh-TUI 截至 `2026-08-23T11:18:55Z` 有 20 个可安装版本。精确 `0.9.0` 发布于 `2026-08-23T05:35:34.508Z`，通过产物身份、完整性、路径安全与 MIT 许可证检查，随后因携带 8 个 Liangshen 文件且没有受支持 opt-out 而在单一所有权检查失败；安全、公共 rc.5 闭包、隔离安装、profile 组合与 PTY 检查均为 `NOT RUN`。历史 `0.7.1` 源码运行时通过，公开交付仍为阶段 2 阻塞。
- fusion bundle 的 manifest 不声明第三方运行时依赖；外部包由 profile 组合命令安装到 `$DSH_HOME/profiles/<name>`，所需 `allowBuilds` 只写入 profile 自己的 `pnpm-workspace.yaml`，不修改仓库根。
- checked-in REAL composition gate 必须实际启动 `base -> web-app -> fusion` 的单行组合；fixture/profile 只包含精确 `@linxin666/dsh-pet@0.2.9` 与 React `18.3.1` peer，且不含外部 `allowBuilds`。默认单测不得访问网络；仓库根 `package.json`、lockfile 与 `pnpm-workspace.yaml` 不增加 Pet 或 React 条目。
- 现有核心 `packages/core/**`、agent-loop 与 session 格式零改动；除新增 `packages/bundle/fusion/` 外，非 fusion package 改动只允许用于恢复六个 `cordis/*` 运行时事件 id、限制 vendored package rescope 只改写模块和包元数据引用而不改写 event/locale/data id、同步 producer/allowlist/consumer/tests/generated docs，以及修复 REAL process helper 的有界输出。不得增加事件兼容 alias。
- 所有浏览器验证，包括 checked-in REAL composition gate，必须使用系统 Chrome 的 CDP `9333`，不得调用 `chromium.launch()` 或使用 IDE 内浏览器；console 报错必须修复后才能通过。
- 历史六行 Web profile 的 `156/156` 与 7 项/402 tokens compact 只证明当时组合的运行时检查；后续安全复核确认当时的 Git Graph 与 Pet 存在授权绕过。历史四行 checked-in REAL composition gate 的 1/1 PASS，以及四行完整 oracle 的 `170/170`、7 项/401 tokens compact、448→160 tokens 与同一 durable session 重启恢复，已被 Task Board 生命周期审查取代。历史三行 checked-in gate 的 1/1、完整 oracle 的 `174/174`、7 项/402 tokens、449→155 tokens 与重启恢复，已被 ModLens、SSH 与 Remote Web UI 生命周期审查取代。Task 13 零行 REAL gate 的 1/1、完整 oracle 的 196/196、三项负控 3/3、7 项/401 tokens compact、448→155 tokens 与重启恢复也只对被取代的零行组合有效。Task 22/29 两行结果已被 Task 33 的 Git Graph 生命周期发现取代。上述历史证据均不得作为当前单行 Web 集合的验收。
- 单次命令前台等待小于一分钟；长任务在后台运行并轮询结果。
- 不执行 `git commit`、`push`、`merge`、`rebase` 或 `reset`。
- `.trae/specs/**` 与 `docs/superpowers/**` 是计划、规格和执行记录，不属于新增 staged 产品集合；其本轮工作树修改保持 unstaged。被忽略的本地执行产物不得作为 clean-checkout 权威证据或加入 Git index。
- 新 bundle 使用 ESM、精确一个结尾换行、包自有 `./invariant` companion 和最小 `src/index.ts`。
- 产品文档与 Agent Note 按仓库规则提供英文、中文和 i18n sidecar，并通过网站投影与文档门禁。

## Existing Invariants

- `web` 与 `headless` profile 的 bundle 顺序、自动初始化和启动语义不变。
- `ui-sidebar` 左侧会话栏保留；仅挂载 Pet `0.2.9`，Git Graph 与其余六个 decision-bearing blocker 保持未挂载。
- 阶段 1 回归既有 `base + web-app` 用户路径：对话渲染、工具卡片、New Session、会话列表、fork、resume、compact、export、Search、Settings 和模型选择保持可用。Pet 不改变这些路径。
- headless 与 ACP 不加载 fusion bundle，不受外部 UI 插件影响。
- 模型可见输入仍可从 session log 重建；本变更不修改 session 事件或 agent loop。

## Attachment Points

- 外部插件只允许通过 `packages/bundle/fusion/cordis.patch.yml` 进入 Host/Web 组合；当前 patch 只挂载 `pet`，Git Graph、ModLens、SSH、Remote Web UI、Task Board、Skin Center 与 Better Sidebar 均不得挂载。
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

系统 SHALL 发布 `@deepseek-ai/dsh-fusion`，其 manifest 导出 patch 与 invariant，但不在标准依赖区声明第三方运行时依赖；当前 `profileDependencies` 只记录 Pet `0.2.9`，patch 只插入对应单行。

#### Scenario: 解析 bundle

- **WHEN** profile composer 解析 fusion manifest 和 patch
- **THEN** bundle 作为 ESM patch layer 加载，且构建、类型检查、package invariant 与 hygiene 检查通过

#### Scenario: 组合规范实现

- **WHEN** fusion patch 应用在 base 与 web-app 之后
- **THEN** patch 恰好增加 `pet`，Git Graph、ModLens、SSH、Remote Web UI、Task Board、Skin Center 与 Better Sidebar 保持未挂载

#### Scenario: 仓库根保持干净

- **WHEN** 在仓库根执行 `pnpm install`、hygiene 和发布检查
- **THEN** fusion 不把外部插件依赖树安装进仓库工作区，仓库根 `package.json`、根 lockfile 与根 `pnpm-workspace.yaml` 的 `allowBuilds` 不增加第三方包

### Requirement: 重复能力去除

系统 SHALL 只启用通过全部准入判据的外部实现；当前只有 Pet `0.2.9` 满足该条件，其余七个 decision-bearing capability 保持未挂载。Liangshen 继续使用仓库共享 preset。

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

系统 SHALL 文档化并验证 `base + web-app + fusion` 的单行 `fusion` profile，其中只包含 Pet `0.2.9`。

#### Scenario: 阶段 1 Web 启动

- **WHEN** 用户按文档组装并启动 `fusion`
- **THEN** 页面通过系统 Chrome CDP `9333` 加载，stock Web 左侧会话栏、Settings、New Session 与唯一 Pet 控件可见，Pet 状态探针返回实时数据，console 无错误；Git Graph 与其余六个 decision-bearing blocker 均不存在

#### Scenario: 阶段 2 工作台

- **WHEN** better-sidebar 同时通过运行时门、安全门并加入 fusion
- **THEN** 右侧工作台与核心左侧会话栏并存，文件、编辑器、终端和 Git tab 可见，console 无错误；若没有不可被用户设置覆盖的安全部署开关，则该扩展保持未挂载并标记阶段 2 阻塞

### Requirement: TUI fusion profile

系统 SHALL 在阶段 1 完成后，门控文档化并验证基于 base 与锁定 dsh-TUI 包的 `fusion-tui` profile。源码闭包运行时通过但公开包来源无法重建同一闭包时，系统 SHALL 把运行时结论与公开交付结论分开，并如实保持阶段 2 BLOCKED。

当前发布事实截至 `2026-08-23T11:18:55Z` 为 20 个可安装 TUI 版本。精确 `0.9.0` 是上次截止后的唯一候选；TUI 专属顺序为产物、许可证、单一 Liangshen 所有权、安全、公共闭包、隔离安装、profile 组合与 PTY。其产物与许可证检查通过，单一 Liangshen 所有权检查失败，安全及所有后续检查均为 `NOT RUN`，不得越过首个失败门。

#### Scenario: TUI 启动和往返

- **WHEN** 用户启动 `fusion-tui` 并发送一条简单消息
- **THEN** 顶栏、状态、输入区和 `session/event` 驱动的响应正常渲染，终端无崩溃；peer 漂移、`workspace:*`、React 与 Liangshen 目录所有权风险已记录并判定可接受，且 profile lock 不含高于 rc.5 的 DSH runtime 包；若公开来源不能重建该 lock，则产品指南不提供会解析混合版本图的命令，并记录解除阻塞条件

### Requirement: REAL composition 持续验收

系统 SHALL 提供 checked-in、独立于默认单测的 REAL composition gate，实际启动最终单行 `base -> web-app -> fusion` 组合并通过系统 Chrome CDP `9333` 验证。

#### Scenario: 单行真实组合

- **WHEN** 运行 REAL composition gate
- **THEN** Fusion 恰好包含 Pet 一个外部 Host 配置行和浏览器入口、唯一 Pet root 与 Pet 状态实时数据，不增加外部模型工具，stock Web 基本界面可见，console、page、network 与清理诊断通过；baseline 与 Fusion 各自的每个 blocked `GET` 完整响应快照必须与同一 profile 的 `GET /` 相同，快照包含 status、除 `connection`、`content-length`、`date`、`keep-alive`、`transfer-encoding` 外的规范化有序完整 header multimap 与 body 原始字节；非 fallback 响应在独立启动的 `base + web-app` 与 Fusion profile 间保持完整响应快照相同；两个根响应各自有且仅有一个可解析的 `window.__DSH_BOOT__` 赋值，baseline 不含 Pet，Fusion 相对 baseline 只精确增加一个合法 Pet entry，且两侧 graph revision 都由各自完整、有序 entries 计算；从 Fusion graph 删除 Pet entry 并按剩余完整、有序 entries 重算 revision 后，完整 Fusion HTML 与 baseline HTML 原始字节相等；额外 client entry、共享 entry 字段或顺序漂移、任一侧错误 graph revision、boot script 外的 body 差异，以及 mounted JSON、redirect、含 stock title 的 route-owned HTML、404 或 405 handler 控制响应均使 oracle 失败

#### Scenario: 外部路由授权

- **WHEN** REAL composition gate 完成精确 profile 冻结安装
- **THEN** gate 从该 profile 解析 Pet 的真实 `lib/index.js`，让同一个 route 实例依次处理非 loopback 未配对、已配对、已撤销与 loopback 请求；被拒绝的请求在触达 Pet state 前返回 403；apply-only Pet 变异只写入完整私有包副本，且安装入口 hash 保持不变

#### Scenario: CI 与验收超时层级

- **WHEN** required Fusion CI job 运行 10 分钟验收
- **THEN** job 上限为 15 分钟且至少保留 5 分钟外层 reserve；验收组合 Vitest 信号与 540 秒内部 deadline，在 acquisition 前登记外层资源，并在 operation 正常结算时移除 abort listener；取消后，pending acquisition、反向串行 disposal、最终 cleanup 与 operation settlement 共用一个 30 秒总 deadline，正常路径等待停稳，到期路径以已取消 signal 启动剩余已取得资源的 disposer、报告未结算工作并返回失败，为框架返回与报告保留 30 秒

#### Scenario: 浏览器与网络隔离

- **WHEN** CI 或本地执行 Fusion 持续验收
- **THEN** gate 连接系统 Chrome CDP `9333`，不得调用 `chromium.launch()` 或 IDE 浏览器；只有显式 REAL composition lane 可以安装 profile 局部外部包，默认 `pnpm run test` 与 `pnpm run test:coverage` 不得联网

#### Scenario: 根依赖隔离

- **WHEN** checked-in fixture 固定单行 profile
- **THEN** fixture/profile 只包含精确 Pet `0.2.9` 与 React `18.3.1` peer，不包含外部 `allowBuilds`；该任务不向仓库根新增 Pet 或 React 条目，且仓库根 `package.json`、lockfile 与 `pnpm-workspace.yaml` 无 diff

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

### Requirement: 当前工作树从零复审

系统 SHALL 以执行时的 `HEAD`、index、工作树和未跟踪路径为唯一当前基线，从零审查计划、设计、规格、实现、测试、文档和交付证据，不把历史审查包或已勾选状态当作当前通过证据。

Task 39 冻结了 `HEAD=a5e6deb6f9fbf17d31e8a593722cb0063969549a`、空 index 和 44 个产品/支持路径：历史 43 个产品路径加持有执行产物排除策略的 `.gitignore`。并发纳入 `docs/user/guide/fusion-tui-profile.{md,zh.md,i18n.yaml}` 后，当前范围为 47 个路径，旧 44 路径 package 与复审结论不再代表当前工作树。更早的 V2 package 因其 43 路径 allowlist 缺少 `.gitignore` 与三个 TUI 指南路径而陈旧；现有陈旧性记录没有提供 V2 HEAD，不得推断或伪造该值。Task 43.6 已在显式 47 路径 `exact-product-worktree` package 上完成最终复验、独立复审和交付 bookkeeping；该 package 的 SHA-256 为 `177ee237ae7a232ba7f9012167bf1c3c3dce5a403dcb0f951b1917d177cdc564`，产品 binary diff SHA-256 保持 `5702846d37d25a615aac8c22b9145b4dc568da0a0a10b22a52a24b7a87212405`。Task 44 和 Task 45 后，live Git index 是经过审计的 26 路径 Fusion allowlist staged delivery，不含被排除的执行记录，也不含无关或非 Fusion staged 路径；执行记录与无关/非 Fusion 工作只保留在 index 之外。当前顺序为 Task 39 -> Task 40 -> Task 41 -> Task 42 -> Task 43 -> Task 44 -> Task 45。

Round 6/Task 38 的只读复审、Task 42 与 Task 43.6.1 独立 reviewer 各调用了一次被禁止的 `git write-tree`。三次调用均返回既有 tree `d381ff301022d8c57d4da9ffc98a4bbcaed2cc95`，后续 HEAD、index 与 status 对比未发现这些命令造成的变化。后续仍禁止调用该命令，`progress.md` 只在最终收口时追加 correction。

#### Scenario: 冻结可复算基线

- **WHEN** 开始 Task 39
- **THEN** 记录分支、`HEAD`、父提交、index tree、工作树路径与内容 hash、未跟踪路径和明确排除项，并证明审查范围没有遗漏当前 Fusion 产品改动

#### Scenario: 并行独立审查

- **WHEN** 基线冻结完成
- **THEN** 相互独立的只读代理并行审查需求对齐、实现与生命周期、测试与负控、安全、文档语义、外部候选新鲜度及运行时交付；每项 finding 包含位置、影响、证据、严重度和可验证修复条件

#### Scenario: 修复确认问题

- **WHEN** 任一 Critical、Important、P0、P1、P2 或规格违背 finding 经技术事实核验成立
- **THEN** 单一写入代理先建立失败证据，再实施最小修复并运行对应成功验证；不得弱化测试、修改 `packages/core/**`、引入兼容 shim、跳过准入顺序或覆盖用户现有改动

#### Scenario: 最终独立验收

- **WHEN** 所有确认 finding 已修复
- **THEN** 独立代理运行受影响的叶级测试、类型检查、构建、零错误 lint、hygiene、文档门禁、diff 检查、系统 Chrome CDP `9333` Pet-only REAL acceptance、完整 Web driver 与 runtime-final oracle，并确认 console、page、network、进程、端口、target、listener 和临时目录无残留

#### Scenario: TUI 条件验收

- **WHEN** 本轮改动触达 TUI、共享 preset、core、session、subprocess 或 terminal 路径
- **THEN** 使用真实 PTY 运行 fresh/resume、消息往返、支持退出和零残留检查；否则明确记录 `NOT RUN (not affected)`

#### Scenario: Git 与记录边界

- **WHEN** Task 43.6 完成最终对账
- **THEN** `.trae/specs/**` 与计划执行记录保持不进入新增 staged 产品集合，`progress.md` 只追加 correction，且本轮未执行 commit、push、merge、rebase 或 reset

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

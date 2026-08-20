# DSH 五仓库融合规格

## Why

DeepSeek Harness 需要在不修改既有核心能力实现的前提下，把 modlens、dsh-web-ui、DSH-better-sidebar 和 dsh-TUI 组合为可安装、可验证、可供桌面壳消费的统一发行层。融合必须消除重复能力，并以精确 npm 版本和真实启动证据控制外部插件版本漂移。

## What Changes

- 新增 `@deepseek-ai/dsh-fusion` 纯 patch bundle；bundle 自身不携带第三方运行时依赖，外部插件以精确版本安装到隔离 profile。
- 新增共享的 `liangshen` agent preset，供 Web 与 TUI 使用。
- 提供 `fusion` 与 `fusion-tui` profile 的可复现组装文档。
- 记录外部包兼容矩阵与既有功能回归报告；两者属于执行记录，不加入 Git。
- 提供 Electron 桌面壳消费 `@deepseek-ai/dsh` 与 fusion profile 的契约。
- 更新 bundle 索引、产品文档双语对、文档网站投影和拥有该架构决策的 Agent Note。
- 下线重复实现：`dsh-tool-describe-image`、`aionui-panel`、desktop 移动端远程能力和 dsh-TUI 内置 Liangshen 副本。
- 分阶段交付：阶段 1 先交付 modlens、web-ui 保留子包、Liangshen 与 fusion Web；阶段 2 再门控加入 better-sidebar 与 dsh-TUI，阶段 2 失败不回滚阶段 1。

## Impact

- Affected specs: profile bundle 组合、agent preset roster、Web/TUI 产品入口、桌面壳消费契约、外部插件兼容策略。
- Affected code: `packages/bundle/fusion/`、`apps/cli/config/agent-presets/liangshen/`、`tsconfig.host.json`、`knip.json`、必要的 owning tests。
- Affected docs: `packages/bundle/README*`、`docs/user/guide/`、`website/docs.ts`、`.agents/notes/`。
- Preserved surfaces: 既有 `packages/*` 实现、`agent-loop`、session 格式、现有 `web`/`headless` profile 和既有用户流程。

## Assumptions And Constraints

- 当前 Harness 基线固定为 `0.1.0-rc.5`；不得为适配外部插件升级核心版本。
- 外部包必须使用通过运行时经验判据的最高精确版本；禁止 `latest`、`^`、`~`。
- 运行时经验判据要求隔离 profile 安装成功、组合解析通过、目标前端实际启动、目标能力真实可见；发布 manifest 的 dsh peer 范围不含 rc.5 时记录为已知漂移，不单独构成阻塞。
- 若某外部包隔离安装、实际 boot、浏览器 console 或终端能力验证失败，则该包为真实阻塞，不能用兼容 shim 或未经计划授权的核心修改绕过。
- fusion bundle 的 manifest 不声明第三方运行时依赖；外部包由 profile 组合命令安装到 `$DSH_HOME/profiles/<name>`，所需 `allowBuilds` 只写入 profile 自己的 `pnpm-workspace.yaml`，不修改仓库根。
- 现有核心 `packages/*` 实现零改动；只允许新增 `packages/bundle/fusion/`，并修改必要的聚合注册、owning tests、索引文档和 Agent Note。
- 所有浏览器验证必须使用独立 Chrome 的 CDP `9333`，不得使用 IDE 内浏览器；console 报错必须修复后才能通过。
- 单次命令前台等待小于一分钟；长任务在后台运行并轮询结果。
- 不执行 `git commit`、`push`、`merge`、`rebase` 或 `reset`。
- `.trae/specs/**`、`docs/superpowers/plans/**` 下的计划、矩阵和回归执行记录不得加入 Git。
- 新 bundle 使用 ESM、精确一个结尾换行、包自有 `./invariant` companion 和最小 `src/index.ts`。
- 产品文档与 Agent Note 按仓库规则提供英文、中文和 i18n sidecar，并通过网站投影与文档门禁。

## Existing Invariants

- `web` 与 `headless` profile 的 bundle 顺序、自动初始化和启动语义不变。
- `ui-sidebar` 左侧会话栏保留；右侧工作台只由 better-sidebar 提供。
- 阶段 1 只回归既有 `base + web-app` 用户路径：对话渲染、工具卡片、New Session、会话列表、fork、resume、compact、export、Search、Settings 和模型选择保持可用。右侧 Files/Web Editor/Terminal/Git 由阶段 2 Task 7 的 better-sidebar 提供。
- headless 与 ACP 不加载 fusion bundle，不受外部 UI 插件影响。
- 模型可见输入仍可从 session log 重建；本变更不修改 session 事件或 agent loop。

## Attachment Points

- 外部插件只通过 `packages/bundle/fusion/cordis.patch.yml` 进入 Host/Web 组合。
- Liangshen 只通过 `apps/cli/config/agent-presets/liangshen/` 进入 agent preset roster。
- `fusion` 与 `fusion-tui` 通过 `dsh plugin --profile ... add ...` 组装，不修改 `PROFILE_TEMPLATES`。
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

### Requirement: Fusion bundle

系统 SHALL 发布 `@deepseek-ai/dsh-fusion`，其 manifest 导出 patch 与 invariant，但不声明第三方运行时依赖；profile 组合使用兼容矩阵中的精确版本安装外部包。

#### Scenario: 解析 bundle

- **WHEN** profile composer 解析 fusion manifest 和 patch
- **THEN** bundle 作为 ESM patch layer 加载，且构建、类型检查、package invariant 与 hygiene 检查通过

#### Scenario: 组合规范实现

- **WHEN** fusion patch 应用在 base 与 web-app 之后
- **THEN** 阶段 1 的 modlens、保留 web-ui 模块和必要 client roster 正确激活；阶段 2 通过门控后再激活 better-sidebar

#### Scenario: 仓库根保持干净

- **WHEN** 在仓库根执行 `pnpm install`、hygiene 和发布检查
- **THEN** fusion 不把 modlens、web-ui、better-sidebar 或 dsh-TUI 的第三方依赖树安装进仓库工作区，且 profile 所需 build scripts 不修改根 `allowBuilds`

### Requirement: 重复能力去除

系统 SHALL 每类能力只启用一个规范实现：图像理解使用 modlens，右侧工作台使用 better-sidebar，移动端远程使用 web-ui，Liangshen 使用共享 preset。

#### Scenario: 聚合包携带重复 row

- **WHEN** 只能使用包含重复能力的聚合 bundle
- **THEN** fusion patch 使用从真实包中读取的 row id 明确禁用 describe-image 与 aionui-panel

#### Scenario: 可直接引用子包

- **WHEN** web-ui 子包可独立安装并 boot
- **THEN** fusion 只引用保留子包并包含 remote-web-ui，不安装重复能力子包

### Requirement: Liangshen preset

系统 SHALL 提供可发现、可挂载的 `liangshen` preset，并保留标准 coding agent 能力及来源包中经过验证的两阶段工具锚定行为。

#### Scenario: 挂载 preset

- **WHEN** agent roster 发现并挂载 `liangshen`
- **THEN** preset metadata、realm 隔离、工具目录、prompt 段和 session header 均符合 preset 规则

### Requirement: Web fusion profile

系统 SHALL 文档化并验证 `base + web-app + fusion` 的 `fusion` profile。

#### Scenario: 阶段 1 Web 启动

- **WHEN** 用户按文档组装并启动 `fusion`
- **THEN** 页面通过 Chrome CDP `9333` 加载，左侧会话栏、任务看板、皮肤中心、宠物、modlens 与移动端入口符合锁定组合，console 无错误

#### Scenario: 阶段 2 工作台

- **WHEN** better-sidebar 通过运行时门并加入 fusion
- **THEN** 右侧工作台与核心左侧会话栏并存，文件、编辑器、终端和 Git tab 可见，console 无错误

### Requirement: TUI fusion profile

系统 SHALL 在阶段 1 完成后，门控文档化并验证基于 base 与锁定 dsh-TUI 包的 `fusion-tui` profile。

#### Scenario: TUI 启动和往返

- **WHEN** 用户启动 `fusion-tui` 并发送一条简单消息
- **THEN** 顶栏、状态、输入区和 `session/event` 驱动的响应正常渲染，终端无崩溃；peer 漂移、`workspace:*`、React 与 Liangshen 目录所有权风险已记录并判定可接受

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

系统 SHALL 说明 deepseek-harness-desktop 通过精确 npm 依赖消费 dsh 和 fusion profile，并由 web-ui 独占移动端远程能力。

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

**Reason**: modlens 与 better-sidebar 分别成为唯一规范实现，重复插件会造成工具、slot 或 service 冲突。

**Migration**: fusion profile 不挂载对应子包，或在不可拆分聚合 bundle 中按真实 row id 禁用。

### Requirement: 独立的 desktop 移动端远程实现

**Reason**: fusion 中 web-ui 的远程模块拥有该能力。

**Migration**: 桌面壳按消费契约禁用自身重复实现；外部仓库修改不属于本交付。

### Requirement: dsh-TUI 内置 Liangshen 副本

**Reason**: Web 与 TUI 必须共享同一个随 dsh 发布的 preset。

**Migration**: `fusion-tui` 选择本仓库的 `liangshen` preset；若外部 TUI 无法禁用副本，则其版本不得通过兼容矩阵。

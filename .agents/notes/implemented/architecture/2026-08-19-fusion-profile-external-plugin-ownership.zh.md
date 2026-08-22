# Agent Note: Fusion profile 外部插件所有权

Status: implemented

[English](2026-08-19-fusion-profile-external-plugin-ownership.md) | 中文

## 问题

Fusion 组合了与 DeepSeek Harness 独立发布的包。即使这些包可以共同运行，其声明的 peer 范围也可能落后或领先于 Harness 版本；而仅仅启动成功，也不能证明目标 UI 或终端能力确实可用。把 peer 范围当作兼容性结论会拒绝可运行的组合；只检查安装或启动则会接受能力不完整的组合。

如果把这些包放进 Fusion 组合包的标准依赖区，它们的依赖树会随仓库或 Harness 发行版安装，而不是由选择它们的 profile 安装。聚合包还可能重新引入相互竞争的图像工具、工作台、移动端访问或 Liangshen preset。两种做法都会掩盖能力归属，以及负责复现安装的锁文件和原生构建许可归属。

## 决策

只有 manifest（元数据清单）许可证身份与包内授权文本一致的外部包才能进入候选集合。Fusion 从中选择在目标 Harness 版本上通过运行时判据的最高精确版本：在隔离 profile 中安装成功、有序 profile 组合可以解析、目标 Web 或终端界面可以启动、能够通过该界面观察到目标能力，并且其资源具有完整 effect/disposer 所有权与断连重挂能力。peer 范围不匹配会记录为漂移，但不会独立构成失败。

Fusion 组合包的 `dsh.bundle.profileDependencies` 为空，因为没有外部 Web 包满足全部准入判据。其 patch 不增加任何配置行。checked-in `test:fusion:acceptance` lane 通过系统 Chrome CDP `9333` 启动 `base -> web-app -> fusion`，验证外部 Host 配置行、浏览器入口、客户端资源、UI root、路由和工具均为零，并保持不进入默认 unit、coverage、Web 与 CI 收集。TUI 源码验证选择 `@deepseek-harness-tui/dsh-tui@0.7.1` 和 `@deepseek-ai/dsh-code-runtime-worker-thread@0.1.0-rc.5`，但该运行时结果不能建立可公开安装的 profile。

`@deepseek-ai/dsh-fusion` 不在 `dependencies`、`devDependencies`、`peerDependencies` 或 `optionalDependencies` 中携带任何第三方包。其 `dsh.bundle.profileDependencies` 对象是静态所有权元数据：[`verify-cordis-config`](../../../../scripts/verify-cordis-config.ts) 要求每个由 profile 持有的裸 patch 配置行都有精确 NPM 版本，拒绝未使用的映射，也拒绝映射包在任何标准依赖区重复出现。运行时不会读取该对象，也不会依据它安装包。

每个 profile 都持有自己的包 manifest、锁文件和 pnpm workspace 设置。当前 Web profile 没有外部安装、peer provider 或构建许可；这些内容也都不属于仓库根。其组合包顺序显式固定为 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`@deepseek-ai/dsh-fusion`。Fusion 不是 `PROFILE_TEMPLATES` 条目，因此缺失的 `fusion` profile 会一直失败，直到用户完成组装。所需 rc.5 包闭包公开可用之前，Fusion TUI 没有受支持的公开组装命令。

该决策细化了 [profile 插件组合包](2026-08-05-profile-plugin-bundles.md)的安装和排序模型，并使用了[移除 repository 插件路径](../simplification/2026-08-09-remove-repository-plugin.md)后保留的唯一外部插件分发路径。

## 能力所有权

ModLens 是外部生命周期阻塞项。其 76 个发布版本中有 38 个 DSH 候选，38 个候选要么同时缺少两条目标路由，要么调用 `WebServer.register()` 后不持有 route disposer。精确 `3.23.1` 是 3 个截止后候选中的最新版本，并通过产物、许可证、安装、组合与初始路由检查；dispose（资源释放）后，`/modlens/paste` 和 `/modlens/config` 仍然有效，在同一 Context 重挂时，替代 handler 会因重复而被拒绝，旧闭包继续提供服务。

SSH 是外部生命周期阻塞项。全部 26 个已发布版本都没有把已接受的 terminal WebSocket 及其独立 SSH client 和 channel 纳入插件 dispose。选定的 `0.2.5` 会移除后续 route dispatch 并清理 sweep interval，但等待 fiber dispose 完成后，活跃 terminal 仍可继续使用。

Task Board 是外部生命周期阻塞项。其 26 个已发布版本均不同时具备完整 effect/disposer 所有权与断连重挂、一致的 manifest 与包内 LICENSE 身份，以及 rc.5 运行时支持。许可证身份一致的 `0.1.11` 可以在 rc.5 上首次加载，但其完整 UI disposer 和顶层 subscription 不属于 Cordis effect，并且 container 断连后不会重挂。精确 `0.2.6` 与 `0.2.7` 保留这些生命周期缺陷，且 manifest 与包内 LICENSE 身份冲突。只有一个已发布产物同时满足这三项条件，并通过同页卸载、HMR、重挂和资源清理检查后，才能重新考虑 Task Board。

Remote Web UI 是外部生命周期阻塞项，26 个已发布版本的准入结果为 0/26。版本 `0.1.11` 会移除全部 12 条 Host route，并能重挂且不保留旧 handler；但已打开的配对与移动端 SSE stream 没有插件级关闭路径，tunnel dispose 不等待 Cloudflared 退出，两个客户端 settings subscription 丢失 disposer，failed-pair timeout 还可能留下不受管理的 React root。`0.1.12` 及更高版本还存在 manifest 与包内 LICENSE 身份冲突。由于 Fusion 不提供远程实现，Electron 消费方可以保留自己的远程实现，并持有其生命周期。

Git Graph 保持排除。版本 `0.1.11` 在历史上通过公开 tunnel 暴露未经过 Remote Web UI 配对和撤销检查的 `/git/*`，其中包括读取和改变共享 workspace 分支的操作。精确 `0.2.6` 与 `0.2.7` 已为所有受检 JSON 和 SSE 路由增加静态服务端授权，但两者都在撤销负控或运行时验证前因 manifest 与包内许可证身份失败。只有同一精确产物同时具备授权修复、一致许可证身份并通过目标 Harness 运行时判据后，才能准入。

Pet 保持排除。版本 `0.1.11` 在历史上注册了通过公开 tunnel 绕过 Host、Origin 与配对检查的精确 `/api/pet/*` 路由。精确 `0.2.6` 与 `0.2.7` 已为所有受检 API、asset、运行时与 decoration 路由增加静态服务端授权，但两者都在未配对／撤销负控或运行时验证前因 manifest 与包内 LICENSE 身份失败。只有同一精确产物同时具备授权修复、一致许可证身份并通过目标 Harness 运行时判据后，才能准入。

Fusion 不包含 Skin Center。已发布的 `0.1.12` 至 `0.2.7` 在 manifest 中声明 Apache-2.0，却在包内提供 BSD-3-Clause LICENSE；`0.1.11` 的 BSD-3-Clause 身份一致，但它注册的 `web-ui.plugin.item` 不会由 rc.5 Settings 页面渲染。只有发布产物的许可证身份一致，且 Settings 控件通过目标 Harness slot 真实可见后，才能重新考虑 Skin Center。

右侧 Files、编辑器、终端和 Source Control 工作台仍是阶段 2 外部阻塞项。`dsh-better-sidebar@0.15.0` 允许用户开启 8 个模型可见的 `terminal_*` 工具。这些工具通过 `ctx.tools` 注册并进入通用 ToolRuntime pre-execute 链，但包未提供批准决策或不可变部署锁；模型命令在 Harness 约束与环境清洗之外，以 ambient `process.env` 到达 `nodePty.spawn`。Fusion 不挂载 better-sidebar；隔离其 settings 服务也不是可接受替代方案，因为所有侧栏设置写入都会失败。

仓库随附的 `apps/cli/config/agent-presets/liangshen/` 目录是 Web 和 TUI 所用 Liangshen preset 的唯一所有者，并保留 `@linxin666/dsh-liangshen@0.2.4` 作为源锁。精确 `0.2.6` 与 `0.2.7` 保留不受约束的 Windows shell 路径，不能替代仓库适配。`@deepseek-harness-tui/dsh-tui@0.7.1` 在已验证源码组合中只负责终端展示，而 profile 持有宿主 `code-runtime` 配置行。TUI 系列共有 19 个发布版本，截止后版本为 `0.8.7` 与 `0.8.8`；两个精确 tarball 各自包含 8 个 Liangshen 文件，并在没有受支持 opt-out 的情况下主动同步第二个所有者。`0.7.1` 保持源码运行时选择，新候选的 PTY 运行时为 `NOT RUN`。该源码验证结果不会恢复由 [TUI 包决策](../simplification/2026-08-04-remove-tui-package.md)移除的第一方包，也不会使 Fusion TUI 成为可公开交付的 profile。

## 交付状态

选定的 Web profile 包含零个外部配置行。其 checked-in REAL composition lane 通过系统 Chrome CDP `9333` 启动 `base -> web-app -> fusion` 并通过 1/1。完整 Web oracle 通过 196/196，三项负控均以 195/196 和退出码 1 阻断。该验收确认 ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center 和 Better Sidebar 均未增加 Host 配置行、浏览器入口、客户端资源、UI root、路由或工具。stock Web 界面保持可见，console、页面、网络、进程、端口、target 和临时目录清理均无异常；compact 遮蔽 7 项和 401 tokens，投影消息 token 从 448 降至 155，重启后保持 155。独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`。历史三行 1/1 gate 与 174/174 完整 oracle 继续作为被 ModLens、SSH 和 Remote Web UI 生命周期审查取代的证据保留。历史四行与六行证据仍分别被 Task Board 生命周期和 Pet／Git Graph 授权发现取代。

Fusion TUI 运行时与交付采用独立结论。使用 41 个 rc.5 Harness 包的源码验证 profile 通过全新与恢复 PTY、持久回放、受支持退出和进程清理。历史公开安装尝试在其直接查询的子集中发现 23 个缺失包；新的完整查询在历史源码闭包的 41 个包中找到 0 个精确 rc.5。精确 TUI `0.8.7` 与 `0.8.8` 各自声明 24 个非 rc.5 DSH peer，包含 0 个根与 15 个打包内 `workspace:*` 值，并在安装前因单一 Liangshen 所有权和公开闭包失败。其安装与 PTY 检查为 `NOT RUN`，Fusion TUI 公开交付保持阶段 2 BLOCKED。

## 重新验证

Harness 版本、外部包版本或 tarball、声明的 peer 基线、解析出的 React 或原生依赖图、Fusion patch 配置行、profile 构建许可或 Liangshen preset 所有者发生变化时，受影响的 profile 必须重新运行许可证身份检查与完整运行时判据。重新验证选择 manifest 与包内授权文本一致，且包括完全停稳的 dispose 和断连重挂在内的运行时判据全部通过的最高精确版本；仅有 peer 范围变化既不能证明兼容，也不能证明不兼容。公开交付还要求已验证依赖闭包中的每个包都可从受支持的公开来源获取。

Web 重新验证包括 `pnpm run test:fusion:acceptance`、任何候选的隔离精确安装、配置 dump 与启动、同一 Context 卸载和重挂、开放资源 dispose、通过系统 Chrome CDP `9333` 执行的完整组合 Web oracle，以及干净的 console、页面、网络和 slot 诊断。只有一致的公开 rc.5 闭包可用，或明确批准新的 Harness 基线后，才能重新考虑 TUI 公开交付；任一路径都必须验证精确安装、lock、配置 dump、全新与恢复真实 PTY 消息往返、持久会话事件、受支持退出、进程清理和公开文档命令。

Git Graph 与 Pet 都需要由同一精确产物保留 `0.2.6`／`0.2.7` 的静态服务端授权，具备一致的 manifest 与包内许可证身份，并通过实时未配对／撤销负控及完整运行时判据。Skin Center 还需要目标 Harness 版本支持的 Settings slot。右侧工作台还需要包自有批准决策或不可变部署策略：隐藏或禁用 `agentTerminalTools` 控件、拒绝持久化配置或 API 将其开启、阻止 `terminal_*` 注册，同时保留设置持久化与 UI Terminal 执行。其判据需要在被拒绝的设置写入前后检查模型工具目录，并通过 Chrome 执行 UI Terminal。

Task Board 还要求一个已发布产物同时具备完整 effect/disposer 所有权、container 断连后重挂、一致的 manifest 与包内 LICENSE 身份，以及 rc.5 运行时支持。其判据需要在同一页面卸载并重挂配置行与 AppFrame，并验证只有一个已连接 root，observer、listener、timer 与 subscription 均不增长。

ModLens 还要求每个已注册 route 的 disposer 都属于其插件 fiber。SSH 还要求 dispose 关闭并等待每个已接受的 WebSocket、SSH client、channel 与 shell 会话。Remote Web UI 还要求插件级关闭已打开的配对与移动端 SSE stream，等待 tunnel 与 update process 退出，dispose 客户端 subscription，并移除每个由插件创建的 React root。

## 验证

`verify-cordis-config` 单元覆盖固定了精确版本、配置行对应关系、未使用条目和标准依赖排除规则。Fusion 包测试固定了空 profile dependency metadata、第三方依赖条目的缺失、空 patch、全部 8 个 blocker 排除项，以及通过真实 profile 组合执行的 Loader 解析。

包专属的生命周期审计覆盖了全部已发布 ModLens、SSH 与 Remote Web UI 候选。checked-in REAL composition lane 固定了系统 Chrome CDP `9333`、不含外部依赖或构建许可的 fixture（测试前置数据）、零个外部 Host 配置行与浏览器入口、不含外部客户端资源、UI root、路由或工具、stock Web 可见性、进程清理和默认测试集隔离。完整零行 Web oracle 通过 196/196，三项负控均按预期阻断，独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`；历史三行完整 oracle 不能满足该当前验证。

源码验证 Fusion TUI profile 固定了 `dsh-tui@0.7.1`、仓库 Liangshen preset、由 profile 持有的 worker-thread code 运行时和 41 个 rc.5 Harness 包。终端渲染、完整的消息与工具往返、第二个 PTY 中的持久事件回放、干净的受支持退出和进程清理均通过。其上游 DSH 与 React peer 警告继续记录为漂移，因为实际执行的运行时路径已经完成。该证据不能满足公开交付：23 是历史直接安装子集，新的完整查询在 41 个包中找到 0 个精确 rc.5。精确 `0.8.7` 与 `0.8.8` 在静态所有权与闭包检查停止，运行时保持 `NOT RUN`。

## 曾考虑的替代方案

**在 Fusion 组合包依赖区声明第三方包。** 不予采纳，因为安装所有权会从选择它们的 profile 移到组合包或仓库依赖图，原生构建许可会失去 profile 所有者，仓库根还会携带其他 profile 不使用的依赖。

**把 Fusion 和 Fusion TUI 加入 `PROFILE_TEMPLATES`。** 不予采纳，因为内置模板会自动初始化，并且由安装本体持有。Fusion 组合了独立发布的包，要求用户显式审查并一起保留精确安装、锁文件、peer provider 与构建许可。Fusion TUI 还缺少受支持的公开包闭包，因此模板会宣传无法重建已验证运行时的安装。

**挂载聚合 Web UI 组合包。** 不予采纳，因为聚合包还携带重复能力配置行。直接使用保留子包，可以显式提供远程访问及其他选定 UI 功能，而不会重新引入 `aionui-panel`。

**使用许可证身份冲突的较新 Web UI 产物。** 不予采纳，因为已发布的 `0.1.12` 至 `0.2.7` 的 manifest metadata 与包内 LICENSE 标识不同许可证。运行时成功无法消除该分发歧义。

**保留最后可见的 ModLens、SSH 或 Remote Web UI 配置行。** 不予采纳，因为首次加载能力证据不满足生命周期准入要求。它们遗留的 route、活跃会话、SSE stream、子进程、subscription 或 root 可能比所属插件 fiber 存活更久；bundle shim 或历史运行时计数不能豁免该失败。

**保留 Git Graph `0.1.11`。** 不予采纳，因为其 `/git/*` 路由在 Remote Web UI 公开 tunnel 上绕过实时配对与撤销检查，并且能够读取或修改共享 workspace 分支。组合包包装层属于兼容 shim，也无法可靠授权外部包已经注册的路由。

**保留 Pet `0.1.11` 或选择带请求来源限制的较新版本。** 不予采纳，因为 `0.1.11` 暴露的精确 `/api/pet/*` 路由不执行 Host、Origin 与配对检查，而带有请求来源限制的较新版本存在 manifest 与包内 LICENSE 身份冲突。

**保留 Task Board `0.1.11` 或增加 bundle 生命周期 shim。** 不予采纳，因为 `0.1.11` 的完整 UI disposer 和顶层 subscription 不属于 Cordis effect，并且 container 断连后不会重挂。bundle shim 或 AppFrame 专用宿主约定会把外部包的生命周期所有权移入仓库，同时仍不能产生兼具许可证身份一致与 rc.5 运行时支持的已发布产物。

**隔离 better-sidebar 的 settings 服务。** 不予采纳，因为隔离会阻止模型终端工具注册，但仍保留看似可用的控件，并使每次侧栏设置写入失败。移除该包可以维持安全规则，而不会把损坏的设置体验描述为已完成工作台。

**为外部版本增加兼容 shim 或修改核心包。** 不予采纳，因为 shim 会掩盖真实包不兼容，并让核心行为依赖可选 profile。无法通过安装、组合、启动或能力观察的版本保持未选择状态。

**以声明的 peer 范围作为兼容性结论。** 不予采纳，因为预发布 peer 声明不能证明运行时失败，已接受的 Web 和 TUI 包也都在其声明的 Harness 或 React 基线之外完成了实际路径。运行时判据会记录漂移并检查行为。

**发布解析混合 Harness 依赖图的 TUI 操作步骤。** 不予采纳，因为选择 rc.6 或 rc.8 包的注册表安装无法重建已验证 rc.5 运行时，并违反固定基线。

**保留重复实现作为回退。** 不予采纳，因为重复的工具、工作台、远程访问或 preset 会让选择顺序与生命周期顺序成为行为的一部分。每项能力只有一个所有者，使缺失和重新引入都可被机械审查。

## 后果

Fusion Web 得到可复现的零行外部集成层，不会把第三方依赖树或原生构建许可加入 profile 或仓库根。该包仍是可发布的 ESM 组合包，并保留 patch 导出与 invariant companion，因此未来通过准入的配置行可以经由同一个受评审组合点进入。

组装非内置 Web profile 的用户必须一起保留其 manifest、最小锁文件和 workspace 设置。外部阻塞项解除前，Fusion 不提供 ModLens、SSH、Remote Web UI、Task Board、Git Graph、Pet、Skin Center、右侧 Files、编辑器、终端和 Source Control 工作台，也不提供可公开安装的 TUI profile。每次相关 Harness、包、依赖图、patch、许可或 preset 变化，都会产生许可证审查、隔离安装、生命周期与安全审查，以及 Web 或 TUI 经验重验成本；这些证据只证明受测平台和路径，不代表通用的跨平台兼容性。

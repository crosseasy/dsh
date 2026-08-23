# Agent Note: Fusion profile 外部插件所有权

Status: implemented

[English](2026-08-19-fusion-profile-external-plugin-ownership.md) | 中文

## 问题

Fusion 组合了与 DeepSeek Harness 独立发布的包。即使这些包可以共同运行，其声明的 peer 范围也可能落后或领先于 Harness 版本；而仅仅启动成功，也不能证明目标 UI 或终端能力确实可用。把 peer 范围当作兼容性结论会拒绝可运行的组合；只检查安装或启动则会接受能力不完整的组合。

如果把这些包放进 Fusion 组合包的标准依赖区，它们的依赖树会随仓库或 Harness 发行版安装，而不是由选择它们的 profile 安装。聚合包还可能重新引入相互竞争的图像工具、工作台、移动端访问或 Liangshen preset。两种做法都会掩盖能力归属，以及负责复现安装的锁文件和原生构建许可归属。

## 决策

只有 manifest（元数据清单）许可证身份与包内授权文本一致的外部包才能进入候选集合。Fusion 从中选择在目标 Harness 版本上通过运行时判据的最高精确版本：在隔离 profile 中安装成功、有序 profile 组合可以解析、目标 Web 或终端界面可以启动、能够通过该界面观察到目标能力，并且其资源具有完整 effect/disposer 所有权与断连重挂能力。peer 范围不匹配会记录为漂移，但不会独立构成失败。

Fusion 组合包的 `dsh.bundle.profileDependencies` 包含精确 `@linxin666/dsh-pet@0.2.9` 与 `@linxin666/dsh-client-ui-git-graph@0.2.9`；其 patch 增加 `pet` 与 `ui-git-graph` 配置行。checked-in `test:fusion:acceptance` lane 通过系统 Google Chrome CDP `9333` 启动 `base -> web-app -> fusion`，把完整 scoped 模型输入和阻塞路由响应与独立启动的 `base + web-app` profile 比较，并比较已提交的 Pet 与 Git Graph ARIA golden。精确 profile 冻结安装完成后，该车道从该 profile 解析每个包真实的 `lib/index.js`，在提供必需服务的 Context 中调用其 `apply` 导出，捕获该次激活实际注册的 route，再让这个 route 实例依次处理非 loopback 未配对、已配对、已撤销和 loopback 状态；被拒绝的请求会在访问 Pet 状态或 Git workspace 前返回 403。apply-only Pet 变异会把完整安装包复制到 profile 下的私有目录，验证副本入口与安装入口不是同一个 inode，并且只修改和导入该副本。安装入口保持只读，正常完成或取消后其 SHA-256 hash 都必须不变。该变异保持 `makePetRoutes` 守卫不变但注册无守卫状态 handler，因此必须精确地因首个远端未配对请求返回 200 而非 403 失败。该车道不进入默认 unit、coverage 和普通 Web 收集，但作为必需的 Linux PR 检查运行。TUI 源码验证选择 `@deepseek-harness-tui/dsh-tui@0.7.1` 和 `@deepseek-ai/dsh-code-runtime-worker-thread@0.1.0-rc.5`，但该运行时结果不能建立可公开安装的 profile。

`@deepseek-ai/dsh-fusion` 不在 `dependencies`、`devDependencies`、`peerDependencies` 或 `optionalDependencies` 中携带任何第三方包。其 `dsh.bundle.profileDependencies` 对象是静态所有权元数据：[`verify-cordis-config`](../../../../scripts/verify-cordis-config.ts) 要求每个由 profile 持有的裸 patch 配置行都有精确 NPM 版本，拒绝未使用的映射，也拒绝映射包在任何标准依赖区重复出现。运行时不会读取该对象，也不会依据它安装包。

每个 profile 都持有自己的包 manifest、锁文件和 pnpm workspace 设置。当前 Web profile 安装两个精确候选及 `react`／`react-dom` `18.3.1`，且没有原生构建许可；该组装不会向仓库根增加对应条目，并保持根 `package.json`、锁文件与 workspace 文件不变。其组合包顺序显式固定为 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`@deepseek-ai/dsh-fusion`。Fusion 不是 `PROFILE_TEMPLATES` 条目，因此缺失的 `fusion` profile 会一直失败，直到用户完成组装。所需 rc.5 包闭包公开可用之前，Fusion TUI 没有受支持的公开组装命令。

该决策细化了 [profile 插件组合包](2026-08-05-profile-plugin-bundles.md)的安装和排序模型，并使用了[移除 repository 插件路径](../simplification/2026-08-09-remove-repository-plugin.md)后保留的唯一外部插件分发路径。

## 能力所有权

ModLens 继续保持排除。其 77 个发布版本中有 39 个 DSH 候选。前 38 个候选要么同时缺少两条目标 route，要么调用 `WebServer.register()` 后不持有 route disposer。精确 `3.24.0` 通过产物身份、完整性、MIT 许可证身份、依赖闭包、隔离安装与单行组合，但在服务端请求安全检查失败：`/modlens/config` 会拒绝的同一跨站请求可被 `POST /modlens/paste` 接受，返回 `200` 并写入所提交的图像字节。因此生命周期、启动、能力与 Chrome 检查均为 `NOT RUN`。

SSH 是外部生命周期阻塞项。全部 28 个已发布版本都没有把已接受的独立终端会话纳入插件 dispose。精确 `0.2.9` 注册 route 与 engine disposer，但 `openShell()` 返回未跟踪的独立 SSH client 与 channel，因此活跃终端会话可以比等待完成的 fiber dispose 存活更久。

Task Board 是外部生命周期阻塞项。其 28 个已发布版本均不同时具备完整 effect/disposer 所有权与断连重挂、一致的 manifest 与包内 LICENSE 身份，以及 rc.5 运行时支持。精确 `0.2.8` 许可证身份失败。精确 `0.2.9` 修复了该身份，但客户端仍丢弃顶层 `settingsScope.subscribe(syncEnabled)` disposer，因此后续所有权、去重与运行时检查为 `NOT RUN`。

Remote Web UI 在 28 个已发布版本中仍保持排除。版本 `0.1.11` 会移除全部 12 条 Host route 并能重挂且不保留旧 handler，但资源清理不完整；截至 `0.2.8` 的后续版本另有 manifest 与包内 LICENSE 身份冲突。精确 `0.2.9` 修复许可证文本，但在更早的安全检查失败，因为 `requirePairingForLan:false` 会让 `/remote` HTTP 与 WebSocket handler 跳过实时设备授权。因此其生命周期与运行时检查为 `NOT RUN`。由于 Fusion 不提供远程实现，Electron 消费方可以保留自己的远程实现，并持有其生命周期。

Git Graph `0.2.9` 已准入。版本 `0.1.11` 在历史上通过公开 tunnel 暴露未经过 Remote Web UI 配对和撤销检查的 `/git/*`，`0.2.8` 则在许可证身份停止。精确 `0.2.9` 同时具备 Apache-2.0 manifest 与 LICENSE 身份，以及 JSON 与 SSE 路由的服务端授权；实时未配对与已撤销请求在触达 Git 服务前返回 403，已配对与 loopback 请求通过，直接 route／SSE dispose 与同 Context 重挂通过。独立 RED 运行会抑制返回的 disposer，检测遗留 route、开放 SSE 响应、活动 timer 与重复重挂，并通过强制清理把全部受跟踪资源计数归零。组合 REAL gate 观察到唯一分支 chip、可用的 Git 状态路由和干净诊断。

Pet `0.2.9` 已准入。版本 `0.1.11` 在历史上注册了绕过 Host、Origin 与配对检查的精确 `/api/pet/*` 路由，`0.2.8` 则在许可证身份停止。精确 `0.2.9` 同时具备 Apache-2.0 manifest 与 LICENSE 身份，以及 API、asset、运行时与 decoration 路由的服务端授权；实时未配对与已撤销请求在触达 Pet 服务前返回 403，已配对与 loopback 请求通过，包内客户端生命周期测试通过 5/5，隔离 Chrome CDP 验证观察到唯一 Pet root 与 dock、可用的状态路由和干净诊断。

Fusion 不包含 Skin Center。已发布的 `0.1.12` 至 `0.2.9` 在 manifest 中声明 Apache-2.0，却在包内提供 BSD-3-Clause LICENSE；`0.1.11` 的 BSD-3-Clause 身份一致，但它注册的 `web-ui.plugin.item` 不会由 rc.5 Settings 页面渲染。只有发布产物的许可证身份一致，且 Settings 控件通过目标 Harness slot 真实可见后，才能重新考虑 Skin Center。

其他 `0.2.8`／`0.2.9` Web UI 身份不增加 Fusion 配置行。AionUI Panel `0.2.8` 许可证身份失败；`0.2.9` 把右侧面板设置与注册表委托给已阻塞的 Better Sidebar，因此所有权失败。Describe Image 接受 `/describe-image` 上的非 loopback 跨站上传并触达 attachment 存储，因此在去重或运行时之前安全失败。Plugin Manager 在 route fiber dispose 时不取消或等待活跃 CLI 子进程，因此生命周期失败。Chat Recovery 与 Skin Center `0.2.9`，以及 Skins 和 `web-ui-all` 的依赖闭包，许可证身份失败。Community Plugins、Skill Explorer、Desktop Launcher 与 Web UI Settings 保持 `NOT SELECTED`。

右侧 Files、编辑器、终端和 Source Control 工作台仍是阶段 2 外部阻塞项。新的无缓存 packument 包含 15 个可安装 Better Sidebar 版本，并表明精确 `dsh-better-sidebar@0.15.2` 是上次截止后的唯一发布版本。该产物通过身份、完整性、路径安全与 MIT 许可证身份检查，但全部 14 个 DSH peer 范围均要求 `^0.1.0-rc.8`，公共注册表对这些包均不提供精确 `0.1.0-rc.5`。公共闭包失败后，安全、生命周期、隔离安装、组合、启动与 Chrome 均为 `NOT RUN`。Fusion 不挂载 better-sidebar；隔离 settings 服务的既有否决结论也保持不变：该方案会使所有侧栏设置写入失败，而不能提供不可变部署策略。

仓库随附的 `apps/cli/config/agent-presets/liangshen/` 目录是 Web 和 TUI 所用 Liangshen preset 的唯一所有者，并保留 `@linxin666/dsh-liangshen@0.2.4` 作为源锁。精确 `0.2.8` 与 `0.2.9` 保留不受约束的 Windows shell 路径，不能替代仓库适配。`@deepseek-harness-tui/dsh-tui@0.7.1` 在已验证源码组合中只负责终端展示，而 profile 持有宿主 `code-runtime` 配置行。TUI 系列共有 19 个发布版本，截止后版本为 `0.8.7` 与 `0.8.8`；两个精确 tarball 各自包含 8 个 Liangshen 文件，并在没有受支持 opt-out 的情况下主动同步第二个所有者。`0.7.1` 保持源码运行时选择，新候选的 PTY 运行时为 `NOT RUN`。该源码验证结果不会恢复由 [TUI 包决策](../simplification/2026-08-04-remove-tui-package.md)移除的第一方包，也不会使 Fusion TUI 成为可公开交付的 profile。

## 交付状态

选定的 Web profile 包含两条外部配置行：Pet 与 Git Graph `0.2.9`。精确隔离 profile 的安装、组合、路由检查、诊断与清理通过。更新后的 checked-in REAL composition lane 通过 1/1，并提供最终可见性证据：系统 Chrome CDP `9333` 观察到唯一可见 Pet 控件与唯一 Git Graph 分支 chip，Pet 状态与 Git 分支探针返回实时数据，且进程、端口、target 与临时目录清理完成。历史零行 1/1 与 196/196 结果只对已被取代的空 profile 有效；更早的三行、四行与六行证据仍被其已记录的生命周期和安全发现取代。

Fusion TUI 运行时与交付采用独立结论。使用 41 个 rc.5 Harness 包的源码验证 profile 通过全新与恢复 PTY、持久回放、受支持退出和进程清理。历史公开安装尝试在其直接查询的子集中发现 23 个缺失包；新的完整查询在历史源码闭包的 41 个包中找到 0 个精确 rc.5。精确 TUI `0.8.7` 与 `0.8.8` 各自声明 24 个非 rc.5 DSH peer，包含 0 个根与 15 个打包内 `workspace:*` 值，并在安装前因单一 Liangshen 所有权和公开闭包失败。其安装与 PTY 检查为 `NOT RUN`，Fusion TUI 公开交付保持阶段 2 BLOCKED。

## 重新验证

Harness 版本、外部包版本或 tarball、声明的 peer 基线、解析出的 React 或原生依赖图、Fusion patch 配置行、profile 构建许可或 Liangshen preset 所有者发生变化时，受影响的 profile 必须重新运行许可证身份检查与完整运行时判据。重新验证选择 manifest 与包内授权文本一致，且包括完全停稳的 dispose 和断连重挂在内的运行时判据全部通过的最高精确版本；仅有 peer 范围变化既不能证明兼容，也不能证明不兼容。公开交付还要求已验证依赖闭包中的每个包都可从受支持的公开来源获取。

Web 重新验证包括 `pnpm run test:fusion:acceptance`、任何候选的隔离精确安装、配置 dump 与启动、同一 Context 卸载和重挂、开放资源 dispose、通过系统 Chrome CDP `9333` 执行的完整组合 Web oracle，以及干净的 console、页面、网络和 slot 诊断。只有一致的公开 rc.5 闭包可用，或明确批准新的 Harness 基线后，才能重新考虑 TUI 公开交付；任一路径都必须验证精确安装、lock、配置 dump、全新与恢复真实 PTY 消息往返、持久会话事件、受支持退出、进程清理和公开文档命令。

只有精确 `0.2.9` 产物继续保持许可证身份、服务端授权、disposer／重挂行为与组合运行时结果时，Git Graph 与 Pet 才保持准入。Skin Center 还需要一致的许可证身份和目标 Harness 版本支持的 Settings slot。右侧工作台还需要包自有批准决策或不可变部署策略：隐藏或禁用 `agentTerminalTools` 控件、拒绝持久化配置或 API 将其开启、阻止 `terminal_*` 注册，同时保留设置持久化与 UI Terminal 执行。其判据需要在被拒绝的设置写入前后检查模型工具目录，并通过 Chrome 执行 UI Terminal。

Task Board 还要求一个已发布产物同时具备完整 effect/disposer 所有权、container 断连后重挂、一致的 manifest 与包内 LICENSE 身份，以及 rc.5 运行时支持。其判据需要在同一页面卸载并重挂配置行与 AppFrame，并验证只有一个已连接 root，observer、listener、timer 与 subscription 均不增长。

ModLens 还要求每条修改状态的 route 执行适用的请求信任策略，并让每个已注册 route 的 disposer 都属于其插件 fiber。SSH 还要求 dispose 关闭并等待每个已接受的 WebSocket、SSH client、channel 与 shell 会话。Remote Web UI 还要求插件级关闭已打开的配对与移动端 SSE stream，等待 tunnel 与 update process 退出，dispose 客户端 subscription，并移除每个由插件创建的 React root。

## 验证

`verify-cordis-config` 单元覆盖固定了精确版本、配置行对应关系、未使用条目和标准依赖排除规则。Fusion 包测试固定了两个精确 profile 依赖、第三方标准依赖条目的缺失、两行 patch、阻塞包排除项，以及通过真实 profile 组合执行的 Loader 解析。

包专属的生命周期审计覆盖前 38 个 ModLens 候选，以及全部已发布 SSH 与 Remote Web UI 候选。精确 ModLens `3.24.0` 在更早的服务端请求安全检查停止。精确 Better Sidebar `0.15.2` 在公共 rc.5 peer 闭包检查停止，精确 rc.5 可用数为 0/14；安全、生命周期、隔离安装、组合、启动与 Chrome 均为 `NOT RUN`。checked-in REAL composition lane 固定系统 Google Chrome CDP `9333`、包含两个精确外部依赖和 React peer 且不含原生构建许可的 fixture（测试前置数据）、恰好两个外部 Host 配置行与浏览器入口、完整 scoped 模型输入相等、阻塞路由与基线相等、ARIA golden 中唯一 Pet 控件与唯一 Git Graph 分支控件、实时 `task22` 仓库数据、进程清理和默认测试集隔离。

源码验证 Fusion TUI profile 固定了 `dsh-tui@0.7.1`、仓库 Liangshen preset、由 profile 持有的 worker-thread code 运行时和 41 个 rc.5 Harness 包。终端渲染、完整的消息与工具往返、第二个 PTY 中的持久事件回放、干净的受支持退出和进程清理均通过。其上游 DSH 与 React peer 警告继续记录为漂移，因为实际执行的运行时路径已经完成。该证据不能满足公开交付：23 是历史直接安装子集，新的完整查询在 41 个包中找到 0 个精确 rc.5。精确 `0.8.7` 与 `0.8.8` 在静态所有权与闭包检查停止，运行时保持 `NOT RUN`。

## 曾考虑的替代方案

**在 Fusion 组合包依赖区声明第三方包。** 不予采纳，因为安装所有权会从选择它们的 profile 移到组合包或仓库依赖图，原生构建许可会失去 profile 所有者，仓库根还会携带其他 profile 不使用的依赖。

**把 Fusion 和 Fusion TUI 加入 `PROFILE_TEMPLATES`。** 不予采纳，因为内置模板会自动初始化，并且由安装本体持有。Fusion 组合了独立发布的包，要求用户显式审查并一起保留精确安装、锁文件、peer provider 与构建许可。Fusion TUI 还缺少受支持的公开包闭包，因此模板会宣传无法重建已验证运行时的安装。

**挂载聚合 Web UI 组合包。** 不予采纳，因为聚合包还携带重复能力配置行。直接使用保留子包，可以显式提供 Pet 与 Git Graph，而不会重新引入 `aionui-panel` 或无关 Web UI 能力。

**使用许可证身份冲突的 Web UI 产物。** 不予采纳，因为 10 个直接冲突的 `0.2.8` 身份，以及 `0.2.9` 中仍存在的直接或继承冲突，其 manifest metadata 与包内 LICENSE 标识不同许可证。运行时成功无法消除该分发歧义。

**保留最后可见的 ModLens、SSH 或 Remote Web UI 配置行。** 不予采纳，因为首次加载能力证据不满足生命周期准入要求。它们遗留的 route、活跃会话、SSE stream、子进程、subscription 或 root 可能比所属插件 fiber 存活更久；bundle shim 或历史运行时计数不能豁免该失败。

**保留 Git Graph `0.1.11`。** 不予采纳，因为其 `/git/*` 路由在 Remote Web UI 公开 tunnel 上绕过实时配对与撤销检查，并且能够读取或修改共享 workspace 分支。精确 `0.2.9` 无需组合包授权 shim 即可替代它。

**保留 Pet `0.1.11`。** 不予采纳，因为它暴露的精确 `/api/pet/*` 路由不执行 Host、Origin 与配对检查。精确 `0.2.9` 以服务端授权和一致许可证身份替代它。

**保留 Task Board `0.1.11` 或增加 bundle 生命周期 shim。** 不予采纳，因为 `0.1.11` 的完整 UI disposer 和顶层 subscription 不属于 Cordis effect，并且 container 断连后不会重挂。bundle shim 或 AppFrame 专用宿主约定会把外部包的生命周期所有权移入仓库，同时仍不能产生兼具许可证身份一致与 rc.5 运行时支持的已发布产物。

**隔离 better-sidebar 的 settings 服务。** 不予采纳，因为隔离会阻止模型终端工具注册，但仍保留看似可用的控件，并使每次侧栏设置写入失败。移除该包可以维持安全规则，而不会把损坏的设置体验描述为已完成工作台。

**为外部版本增加兼容 shim 或修改核心包。** 不予采纳，因为 shim 会掩盖真实包不兼容，并让核心行为依赖可选 profile。无法通过安装、组合、启动或能力观察的版本保持未选择状态。

**以声明的 peer 范围作为兼容性结论。** 不予采纳，因为预发布 peer 声明不能证明运行时失败，已接受的 Web 和 TUI 包也都在其声明的 Harness 或 React 基线之外完成了实际路径。运行时判据会记录漂移并检查行为。

**发布解析混合 Harness 依赖图的 TUI 操作步骤。** 不予采纳，因为选择 rc.6 或 rc.8 包的注册表安装无法重建已验证 rc.5 运行时，并违反固定基线。

**保留重复实现作为回退。** 不予采纳，因为重复的工具、工作台、远程访问或 preset 会让选择顺序与生命周期顺序成为行为的一部分。每项能力只有一个所有者，使缺失和重新引入都可被机械审查。

## 后果

Fusion Web 得到可复现的两行外部集成层，不会把第三方依赖树或原生构建许可加入仓库根。该包仍是可发布的 ESM 组合包，并保留 patch 导出与 invariant companion。

组装非内置 Web profile 的用户必须一起保留其 manifest、锁文件和 workspace 设置。Fusion 提供 Pet 与 Git Graph，但在外部阻塞项解除前不提供 ModLens、SSH、Remote Web UI、Task Board、Skin Center、右侧 Files、编辑器、终端和 Source Control 工作台，也不提供可公开安装的 TUI profile。每次相关 Harness、包、依赖图、patch、许可或 preset 变化，都会产生许可证审查、隔离安装、生命周期与安全审查，以及 Web 或 TUI 经验重验成本；这些证据只证明受测平台和路径，不代表通用的跨平台兼容性。

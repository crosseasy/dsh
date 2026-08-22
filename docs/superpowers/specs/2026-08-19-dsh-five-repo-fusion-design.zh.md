# DSH 五仓库融合技术方案（设计文档 v2）

[English](2026-08-19-dsh-five-repo-fusion-design.md) | 中文

- 日期：2026-08-19（v1）；2026-08-20（v2）；2026-08-21 整合 Task 12 证据；2026-08-22 整合 Task 18 证据
- 状态：历史设计；Task 12 至 Task 21 已完成；Task 18 候选审计、Task 21 交付、最终验证补救、Chrome CDP 恢复和最终 64 文件对齐复审均已批准
- 仓库策略：本 tracked 规划文档保留既有 Git index 条目；其本轮工作树修改保持 unstaged
- 当前结果：最终 Web 外部集合为空；ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 均为有证据支持的 blocker；Task 18 覆盖截止后的全部 ModLens、17 身份 Web UI、Better Sidebar 与 dsh-TUI 发布版本，且不声称任何候选 Chrome 或 PTY PASS；零行 REAL gate 通过 1/1，完整 oracle 通过 196/196，三项负控均按预期阻断，compact 记录 7 项/401 tokens 和投影消息 token 448→155，重启后保持 155，最终 exact-staged 代码与安全复审均已批准；历史三行 1/1 与 174/174、四行 1/1 与 170/170、六行 156/156 均只保留为被取代的证据；六个 runtime event id 使用规范的 `cordis/*` 名称且没有 alias；rescope 在保留 event 与 locale id 的同时识别模块和包元数据引用，包括有效 JSON/JSONC 围栏中的依赖键，并保持格式错误的围栏不变；REAL process helper 已通过独立复审，为每个流保留 64 KiB byte-bounded tail；TUI `0.7.1` 源码运行时通过，`0.8.7` 与 `0.8.8` 运行时为 `NOT RUN`，公开交付保持阶段 2 BLOCKED

---

## 0. 概述

Fusion 层把 DeepSeek Harness `0.1.0-rc.5` 与来自五个外部仓库的能力组合起来：

| 仓库 | 作用 | 交付所有权 |
| --- | --- | --- |
| `deepseek-harness-desktop` | Electron 桌面壳 | 仅定义约定；不修改外部仓库 |
| `liustack/modlens` | 图像桥接 | 精确 `3.23.1` dispose／重挂失败；Fusion 无配置行 |
| `zhu1090093659/dsh-web-ui` | Web 能力包与 Liangshen 来源 | `0.2.6`／`0.2.7` 两轮均已审计；保留 Liangshen `0.2.4` 来源；八项影响决策的能力均为 blocker，禁止的重复配置行被拒绝，Community Plugins、Plugin Manager、Skill Explorer、Desktop Launcher 等非目标身份保持 `NOT SELECTED` |
| `ccch1mneyyy/dsh-TUI` | 终端 UI | 源码运行时选择精确版本 `0.7.1`；`0.8.7`／`0.8.8` 静态阻塞，运行时为 `NOT RUN` |
| `omdsh-dev/DSH-better-sidebar` | 右侧工作台 | 精确 `0.15.0` 安全／所有权 blocker；不挂载 |

Fusion 的职责是组合与取舍，不是重写。仓库代码拥有 patch bundle、经过安全适配的 Liangshen preset、Web profile 操作步骤、TUI 交付状态文档、测试和 durable 产品文档。外部包依赖树继续由 profile 持有。

最终 Web 外部配置行集合为空。

---

## 1. v2 历史修正

### 1.1 使用运行时证据而不是 Peer Metadata 作为判据

原计划要求 peer 范围必须包含 rc.5。该规则无法接受面向后续候选版本发布、但在 rc.5 上实际运行正常的包。

v2 判据只在隔离安装、组合、真实启动、目标能力可见和诊断干净后接受精确版本。声明的 peer 漂移仍作为证据记录并可能暴露风险，但不能单独证明运行时失败。

### 1.2 Profile 所有权防止污染仓库

如果把外部运行时依赖写入 `packages/bundle/fusion/package.json`，其 React、原生模块、编辑器、SSH 和终端依赖树会安装到仓库 workspace，并与根构建策略冲突。

因此 Fusion 包只包含 patch 层和 workspace 依赖。精确外部包和构建许可位于 profile 安装根。

### 1.3 阶段 2 失败不回滚阶段 1

本设计把核心 Web 能力与可选右侧工作台、TUI 分离。扩展阻塞时保持未挂载并保留完整证据；已接受的能力仍可交付。

---

## 2. 兼容与验收判据

精确外部包只有在所有适用检查通过后，才能在 rc.5 上通过：

1. 使用 profile 局部构建许可完成精确隔离安装。
2. 组合后的 profile 只解析出预期配置行。
3. 真实 Web 或 TUI 入口成功启动。
4. 目标能力可见且可用。
5. 浏览器或终端诊断干净。
6. 许可证身份与安全要求通过。
7. 实际解析的 DSH runtime 依赖图不得超过固定 rc.5 基线；只有 peer 范围漂移适用已记录的例外。
8. 插件拥有的 subscription、root、observer、listener、timer 和其他资源具备完整 effect/disposer 所有权，并且挂载点断连后能够重挂且不会复制资源。

该判据只证明经过测试的本地组合，不承诺跨平台行为、未来 API 稳定性或未测试的凭据相关工作流。

许可证和安全失败是一等 blocker。运行时成功不能豁免产物许可证冲突；可用的 UI 也不能豁免绕过沙箱、批准或环境清洗的模型工具路径。

---

## 3. 能力所有权

| 能力 | 所有者 | 排除的重复项或 blocker |
| --- | --- | --- |
| 图像理解 | 无已接受外部所有者 | 38/38 个 DSH-capable ModLens 版本均缺少目标路由或丢失 route disposer；精确 `3.23.1` dispose／重挂失败 |
| 任务看板 | 无已接受所有者 | 26 个已发布版本均至少不满足生命周期所有权／重挂、manifest/LICENSE 身份或 rc.5 runtime 中的一项 |
| SSH 入口和 hosts API | 无已接受所有者 | 全部 26 个 SSH 版本在插件 dispose 后留下活跃 terminal 与 SSH session |
| 移动端远程 UI | 无已接受 Fusion 所有者 | Remote Web UI 准入结果为 0/26；桌面端可保留自身实现 |
| 宠物 UI | 无已接受所有者 | `0.1.11` 授权缺陷是历史事实；`0.2.6`／`0.2.7` 具备静态 guard，但精确许可证身份失败 |
| 分支选择和提交拓扑 | 无已接受所有者 | `0.1.11` 撤销缺陷是历史事实；`0.2.6`／`0.2.7` 具备静态 guard，但精确许可证身份失败 |
| 皮肤管理 | 无已接受所有者 | `0.1.12` 至 `0.2.7` 许可证冲突；`0.1.11` slot 不可见 |
| 右侧工作台 | 无已接受所有者 | Better Sidebar `0.15.0` 在继承 ambient 环境的无约束 PTY sink 前缺少包自有批准与不可变部署锁 |
| Liangshen preset | 仓库 preset，来源为 `0.2.4` | `0.2.6`／`0.2.7` 保留不受约束的 Windows 自定义 Bash；TUI `0.8.7`／`0.8.8` 各自打包第二个所有者 |
| 终端 UI | 源码运行时：dsh-TUI `0.7.1`；无公开交付 | `0.8.7`／`0.8.8` 各自打包 8 个 Liangshen 文件，新的完整公开 rc.5 闭包结果为 0/41 |

在已发布版本提供完整 effect/disposer 清理、完全停稳的 dispose、断连重挂、一致 manifest/LICENSE 身份，并通过 rc.5 同页生命周期验证前，ModLens、SSH、Remote Web UI 与 Task Board 保持排除。Pet 与 Git Graph `0.2.6` 和 `0.2.7` 已执行静态服务端授权，但这些精确产物在完整负控与运行时验证前因许可证身份失败，仍保持排除。Files、editor、UI Terminal 和 Source Control 仍属于被阻塞的右侧工作台能力。

---

## 4. 分层架构

```text
L3  Desktop shell contract
L2  Repository Fusion patch, shared Liangshen preset, profile recipes, tests, docs
L1  No admitted external Web package
L0  DeepSeek Harness core, agent loop, and session format
```

L0 保持不变。Cordis 维护把六个 runtime event id 恢复为 `cordis/*`，约束 vendored package rescope 只改写模块和包元数据引用而不改写 event、locale 或 data id，并同步拥有相应内容的 API、extension 包、测试和生成文档，但不得把 Fusion 行为移入 agent loop。

Web profile 顺序为 `base -> web-app -> fusion`。TUI profile 顺序为 `base -> dsh-tui`。两个入口共用仓库 Liangshen preset，但不会同时渲染。

---

## 5. 组件

### 5.1 `@deepseek-ai/dsh-fusion`

该包是纯 patch bundle。其 manifest 保留空 `profileDependencies` 对象，不把外部包声明为普通运行时依赖。其最终 patch 为空。

相应测试比较完整的空依赖映射与配置行集合，拒绝全部 8 个外部 blocker 和重复能力包，并通过真实 profile 组合加载该 bundle。

### 5.2 共享 `liangshen` Preset

仓库 preset 保留来源 `0.2.4` 中已验证的两阶段锚定。在 Windows 上使用仓库 Bash 沙箱和批准路径，不采用可能在无操作系统约束下运行的上游 `custom-bash.mjs`。

该 preset 是 Web 与 TUI 唯一的 Liangshen 所有者。会同步另一个 Liangshen 目录的 TUI 版本会被拒绝。

### 5.3 `fusion` 与 `fusion-tui` Profile

Web profile 是可复现的零行操作步骤，不是内置模板。它没有外部包、React peer provider 或原生构建许可。Registry 无法重建已验证 rc.5 闭包时，Fusion TUI 没有受支持的公开操作步骤。

Web profile 没有 `allowBuilds` 条目。

### 5.4 桌面壳约定

仓库文档化精确 npm 消费、Fusion profile 选择和能力所有权。Fusion 不提供远程实现，因此桌面壳可以保留并管理自身实现。仓库不修改、发布或声称已运行时验收外部桌面端仓库。

---

## 6. 集成与安全规则

- 每个 bare patch 配置行必须有一个匹配的精确 profile 依赖；映射缺失或多余时验证失败。
- 可通过 Remote Web UI 暴露方式访问的路由必须执行服务端请求信任和实时设备授权检查；内容校验与 workspace 成员关系不能授权调用者。
- 模型可见工具可以通过 `ctx.tools` 注册，但注册本身不提供沙箱、批准决策或环境清洗。访问自身 PTY sink 的包必须提供缺失的控制，或提供不可变部署锁。
- 用户设置不是不可变部署策略。
- 隔离整个 settings service 不是可接受的 Better Sidebar 窄修复，因为它会破坏全部侧栏偏好持久化，同时保留具有误导性的可用控件。
- 外部包缺失时必须在启动阶段快速失败。
- 模型可见输入仍可从 session log 重建。
- Runtime event id 保持为 `cordis/request-run`、`cordis/request-run-resolved`、`cordis/dynamic-package`、`cordis/dynamic-retract`、`cordis/inspect-query` 和 `cordis/inspect-query-resolved`；包 rescope 不得改写这些 id 或 locale id，也不得增加兼容 alias。
- checked-in REAL composition gate 必须通过系统 Chrome CDP `9333` 启动零行 `base -> web-app -> fusion` profile；不得调用 `chromium.launch()` 或使用 IDE 浏览器。
- 默认单测与覆盖率测试保持离线。fixture/profile 与仓库根均不得包含外部依赖、React peer 或外部构建许可。
- REAL process helper 为 stdout 和 stderr 各保留最多 64 KiB 的 byte-bounded diagnostic tail，同时识别跨 chunk 拆分的 readiness marker。

Better Sidebar 保持阻塞，直到上游部署策略能够隐藏或禁用不安全设置、拒绝已持久化的启用尝试、阻止工具注册，并保留可用的 UI Terminal 和完整 Settings 体验。

---

## 7. 失败模式

- **ModLens 生命周期：** 38/38 个已发布 DSH 候选要么同时缺少两条目标 route，要么调用 `WebServer.register()` 后不持有 route disposer。精确 `3.23.1` 通过产物、许可证、安装、组合与初始路由检查，但两条 route 在 dispose 后仍保持活跃，并阻止在同一 Context 干净重挂。
- **SSH 生命周期：** 全部 26 个已发布版本都会在插件 dispose 后留下活跃的已接受 terminal WebSocket，以及独立 SSH client 与 channel。
- **Remote Web UI 生命周期：** 26 个已发布版本的联合准入结果为 0/26。版本 `0.1.11` 会卸载并重挂 route，但开放的配对／移动端 SSE stream、tunnel 完全停稳、客户端 subscription disposer 与 failed-pair React root 仍不完整；`0.1.12+` 另有 manifest/LICENSE 身份冲突。
- **Task Board 生命周期：** 26 个已发布版本均至少不满足一项必要条件。许可证一致的 `0.1.11` 具备首次加载与历史四行运行时证据，但没有把完整 UI disposer 和顶层 subscription 纳入 Cordis effect，也不能在 container 断连后重挂。后续版本仍有生命周期缺口、引入 manifest/LICENSE 冲突，或要求更高 runtime。不得使用 shim 或核心改动。
- **许可证身份：** 已发布的任务看板、Remote Web UI、Pet、Skin Center 和 Git Graph `0.1.12` 至 `0.2.7` 声明 Apache-2.0，但携带 BSD-3-Clause 许可证正文。Remote Web UI 使用许可证一致的 `0.1.11`；Skin Center `0.1.11` 仍未通过可见性判据。
- **Pet 授权：** Pet `0.1.11` 注册的 exact `/api/pet/*` 路由不检查 Host、Origin、socket 或实时设备状态，使可访问共享 WebServer 的未配对调用者能够读取并持久修改 Pet 状态。精确 `0.2.6` 与 `0.2.7` 增加了静态请求 guard，但在完整安全／运行时验证前因许可证身份失败。
- **Git Graph 授权：** Git Graph `0.1.11` 在 Remote Web UI 配对路由之外注册 `/git/*`，使知道 workspace 路径的已撤销设备能够读取或修改分支。精确 `0.2.6` 与 `0.2.7` 增加了静态请求 guard，但在完整安全／运行时验证前因许可证身份失败。
- **侧栏模型工具：** Better Sidebar `0.15.0` 通过 `ctx.tools` 注册 8 个可选 `terminal_*` 工具，因此这些工具会进入通用 ToolRuntime pre-execute 链。该包未提供批准决策或不可变部署锁，模型命令在 Harness 约束与环境清洗之外，以 ambient `process.env` 到达 `nodePty.spawn`。
- **Peer 漂移：** 已接受包可能声明后续 DSH 或不同 React peer。记录漂移并依赖精确运行时证据；任何依赖变更后都要重跑判据。
- **Slot 漂移：** 客户端可能成功加载，却注册 rc.5 不存在的 slot；Skin Center `0.1.11` 已证明该问题。
- **Event id rescope：** 六个公开 `cordis/*` runtime event 被改写为 npm subpath，但进程内与协议 exact-string 分派不会规范化这些名称。仓库内部一致不能证明新 id 的语义正确。
- **验收输出增长：** 无界 stdout/stderr 累积可能耗尽内存，并重复扫描既有输出。已通过独立复审的 helper 为每个流保留 64 KiB byte-bounded tail，并保持跨 chunk readiness 匹配。
- **探针错误：** 固定等待和错误前置条件可能产生误判。验收探针使用能力条件，并把被拒绝的尝试保留为非最终证据。

---

## 8. 验证策略

### 8.1 既有 Web 行为

验证对话渲染、工具卡片、New Session 创建或复用行为、会话列表、fork、resume、compact、两条 export 路径、Search、Settings、模型选择、stock Web 隔离、headless 隔离和 ACP 隔离。

### 8.2 零行 Web 检查

验证外部 Host 配置行、浏览器入口、客户端资源、UI root、路由和工具均为零；全部 8 个 blocker 身份必须缺席，同时 stock Web 保持可见且诊断干净。

### 8.3 TUI 检查

验证精确版本 `0.7.1`、一个 Liangshen 所有者、lock 中不含高于 rc.5 的 DSH runtime 包、顶栏、模型与上下文状态、输入区、Bash 到 `run_code` 的提升、完整回复、连续持久事件、恢复渲染、受支持退出和无残留进程。

### 8.4 证据层级

包级证据不能证明组合行为。最终 Web oracle 必须通过系统 Chrome CDP `9333` 使用零行 `base -> web-app -> fusion` profile，最终 TUI 证据必须通过真实 PTY 使用可运行 profile。checked-in REAL composition lane 必须启动空 Fusion 层，默认单测与覆盖率测试则保持离线。

---

## 9. 2026-08-21 Task 12 结果

历史六行 Web profile 已有精确 manifest、lock、bundle 顺序、构建许可、包能力、focused 路径和干净诊断证据。其 verifier 曾通过 156/156 项运行时断言，实际 compact 替换 7 项、共 402 tokens 的历史，并在重启后恢复同一持久会话。后续 Pet 与 Git Graph 授权发现已使该运行不能作为最终验收证据。

历史四行集合为 ModLens `3.22.1`、任务看板 `0.1.11`、SSH `0.2.5` 和 Remote Web UI `0.1.11`。对应 checked-in REAL composition lane 通过系统 Chrome CDP `9333` 取得 1/1 PASS，精确外部依赖、lock 数据与构建许可保持 fixture 局部，且未进入默认 unit、coverage、Web 或 CI 收集。

历史完整四行 oracle 通过 170/170 项断言。真实 compact 遮蔽 7 项和 401 tokens，使投影消息 token 从 448 降至 160，并在服务重启后恢复同一 durable session。Task Board 生命周期审查已取代四行 gate 与 oracle 的最终验收效力：首次加载成功，但同页卸载／HMR 和断连重挂未通过，且 26 个已发布版本均不同时满足生命周期、许可证身份与 rc.5 runtime。

历史三行目标包含 ModLens `3.22.1`、SSH `0.2.5` 和 Remote Web UI `0.1.11`。对应 checked-in gate 通过 1/1，完整 oracle 通过 174/174，实际 compact 为 7 项/402 tokens，投影消息 token 从 449 降至 155，并在重启同一 session 后保持 155。ModLens、SSH 与 Remote Web UI 生命周期审查已取代该准入结论。八项影响决策的能力均为 blocker，禁止的重复配置行被拒绝，Community Plugins、Plugin Manager、Skill Explorer 与 Desktop Launcher 等非目标身份保持 `NOT SELECTED`；因此当前目标包含零个外部配置行。

六个 runtime event id 已在 producer、Remote allowlist、consumer、测试和生成文档中使用原 `cordis/*` 名称。Rescope 正控与负控保证模块和包元数据引用继续改写，但 event、locale 和 data id 不改写；有效 JSON/JSONC 依赖映射可正反向往返，格式错误的围栏保持逐字节不变，且不存在兼容 alias。REAL process helper 已通过独立复审，把每个 stdout/stderr diagnostic tail 限制为 64 KiB，同时保持跨 chunk readiness 匹配和进程树完全结算。

TUI `0.7.1` 在 41 包纯 rc.5 源码验证闭包下具备可复现的全新和恢复真实 PTY 证据，包含持久回放、受支持退出和无残留进程。npm registry 缺少该依赖图所需的 23 个 rc.5 包，因此没有受支持的公开命令能重建该闭包。TUI 运行时验证通过，但公开交付保持阶段 2 BLOCKED。Liangshen 继续使用来源 `0.2.4`，并保留仓库安全适配。

Task 12.1 至 Task 12.14 保留任务级和历史证据，Task 12.15 至 Task 12.17 完成生命周期审查、rescope 修复与零行产品收敛。Task 12 至 Task 17 均已完成：最终零行 REAL gate 通过 1/1，完整 oracle 通过 196/196，三项负控均按预期阻断，Round 3 exact-staged 代码与安全复审均已批准。

---

## 10. 2026-08-22 Task 18 结果

截止后审计从 `2026-08-21T02:11:00Z` 开始。ModLens 有 76 个发布版本、38 个 DSH 候选和 3 个截止后候选；精确 `3.23.1` 直接在 dispose／重挂检查失败。17 个 Web UI 身份各自有 `0.2.6` 与 `0.2.7` 两个截止后版本；34 个精确产物均具备身份、完整性、许可证，以及适用的安全、生命周期、所有权或去重结论。Better Sidebar 有 13 个发布版本，精确 `0.15.0` 在部署策略和 PTY sink 检查被阻塞。

dsh-TUI 有 19 个发布版本，以及 `0.8.7` 与 `0.8.8` 两个截止后候选。两个精确产物各自都有 24 个非 rc.5 DSH peer、0 个根与 15 个打包内 `workspace:*` 值，以及 8 个打包的 Liangshen 文件。历史 23 包计数是公开安装直接查询的子集；新的完整查询在历史源码验证闭包的 41 个包中找到 0 个精确 rc.5。两个候选都在安装前因单一所有者和公开闭包检查失败，因此对应 profile 与 PTY 检查为 `NOT RUN`。历史 `0.7.1` 源码运行时 PASS 保持不变。

Round 5 没有候选通过或未通过 Chrome／PTY 验证。精确产物的强制失败使这些下游检查成为 `NOT RUN`。详细系列计数、产物／许可证结果和证据路径见[兼容矩阵](../plans/fusion-compat-matrix.md)。

---

## 11. 重新验证条件

外部版本变化时，重跑许可证、安全、生命周期、包级和组合运行时检查。只有每个 route disposer 都属于其插件 fiber 后，才能重新考虑 ModLens。只有 dispose 关闭并等待每个已接受的 terminal 与 SSH 资源后，才能重新考虑 SSH。只有插件 dispose 关闭开放 SSE stream、等待 tunnel 与 update process、dispose 客户端 subscription 和 root，并保持 route 重挂后，才能重新考虑 Remote Web UI。只有已发布 Task Board 产物具备完整 effect/disposer 所有权、断连重挂、一致 manifest/LICENSE 身份与 rc.5 runtime，并通过同页卸载／HMR 验证后，才能重新考虑 Task Board。只有同一精确 Pet 或 Git Graph 产物同时具备一致许可证身份和所需服务端授权，并通过撤销／未配对负控及完整运行时判据后，才能重新考虑对应包。只有已发布产物具备一致许可证身份，并且注册 rc.5 可见的 Settings 入口后，才能重新考虑 Skin Center。只有包自有批准决策或不可变部署策略同时满足安全与完整工作台要求后，才能重新考虑 Better Sidebar。

历史六行 156/156、四行 1/1 与 170/170、三行 1/1 与 174/174 结果都只作为已被取代的证据保留。当前 Web 目标为零外部配置行；最终 REAL gate 通过 1/1，完整 oracle 通过 196/196，compact 为 7 项/401 tokens，投影消息 token 从 448 降至 155，重启后保持 155。Cordis 恢复包含模块和包元数据正控、event/locale/data 负控、格式错误围栏拒绝，以及 producer、allowlist、consumer、测试和生成文档同步。Process 修复已独立复审字节上限、readiness 匹配和生命周期完全结算。只有已批准 Harness 基线的一致公开闭包可用且保持一个 Liangshen 所有者后，才能重新考虑 TUI 公开交付；任一路径都需要完整重验安装、lock、所有权、PTY、恢复、退出、清理和公开命令。

---

## 12. 执行交接

Task 12 至 Task 21 已完成。最终 Fusion Web 外部集合保持为空，TUI `0.7.1` 源码运行时保持 PASS，TUI `0.8.7` 与 `0.8.8` 运行时保持 `NOT RUN`，公开 TUI 交付保持阶段 2 BLOCKED。精确的 64 文件产品交付已 staged；规划与执行记录保持在 staged 产品集合之外。最终 progress 记录为 `Round 5 Final 64-File Alignment (2026-08-22)`。

---

## 附录 A：仓库参考

- Bundle 机制：[`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)
- Patch 模板：[`packages/bundle/base/`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/base)
- Profile 启动：[`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)
- Preset：[`packages/preset/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/preset/README.md)
- 组合命令：[`apps/cli/src/plugin.ts`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)
- 根构建策略：[`pnpm-workspace.yaml`](file:///Users/bytedance/opencode/agent/dsh/pnpm-workspace.yaml)

# DSH 五仓库融合技术方案（设计文档 v2）

[English](2026-08-19-dsh-five-repo-fusion-design.md) | 中文

- 日期：2026-08-19（v1）；2026-08-20（v2）；2026-08-21 整合 Task 12 证据；2026-08-22 整合 Task 18、Task 22 与 Task 26 证据；2026-08-23 整合 Task 28 与 Task 29 证据及 Task 35 oracle 约定
- 状态：历史设计已同步至完成的 Task 34、Task 35、Task 36、Task 37 与 Task 38
- 交付策略：最终 V2 `exact-product-worktree` package 精确包含 43 个产品路径，package SHA-256 为 `74e694a7c5e5bc18452596b0ec70a7379de1d3459c2073d8f0e1eee9c7b34170`，patch SHA-256 为 `1f71831a467bd652af7eeedf1561b0e431c95088d7e3cc26c9dfc4e2d5921581`；其 bits 复审为 P0/P1/P2 `0/0/0`，安全复审 clean，产品文档与 plan/design/spec alignment 复审均为 Critical/Important/Minor `0/0/0`
- 当前结果：产品交付选择唯一外部配置行，即精确 Pet `0.2.9`。系统 Chrome 151 经 CDP `9333` 的当前 built acceptance 通过 1/1，完整 Web driver 通过 39/39，runtime-final oracle 通过 50/50。console、page、network 与 cleanup 诊断干净，pre/post target、listener、process、port 与临时目录检查均无残留。Git Graph `0.2.9` 保持阻塞；Task 22 与 Task 29 两行结果继续作为已被取代的历史证据。TUI 为 `NOT RUN (not affected)`，公开交付保持阶段 2 BLOCKED。全量仓库 coverage 与实际 GitHub-hosted job 未在本地运行。HEAD 保持 `6e0f654` 且 index 为空；恢复 staged-only 交付或清理 commit history 需要用户另行授权。

---

## 0. 概述

Fusion 层把 DeepSeek Harness `0.1.0-rc.5` 与来自五个外部仓库的能力组合起来：

| 仓库 | 作用 | 交付所有权 |
| --- | --- | --- |
| `deepseek-harness-desktop` | Electron 桌面壳 | 仅定义约定；不修改外部仓库 |
| `liustack/modlens` | 图像桥接 | 精确 `3.24.0` 服务端请求安全失败；Fusion 无配置行 |
| `zhu1090093659/dsh-web-ui` | Web 能力包与 Liangshen 来源 | `0.2.6` 至 `0.2.9` 均已审计；准入 Pet `0.2.9`；Git Graph `0.2.9` 与其他影响决策的身份被阻塞；保留 Liangshen `0.2.4` 来源；其他身份保持 `NOT SELECTED` |
| `ccch1mneyyy/dsh-TUI` | 终端 UI | 源码运行时选择精确版本 `0.7.1`；`0.8.7`／`0.8.8` 静态阻塞，运行时为 `NOT RUN` |
| `omdsh-dev/DSH-better-sidebar` | 右侧工作台 | 精确 `0.15.2` 公共 rc.5 peer 闭包失败；不挂载 |

Fusion 的职责是组合与取舍，不是重写。仓库代码拥有 patch bundle、经过安全适配的 Liangshen preset、Web profile 操作步骤、TUI 交付状态文档、测试和 durable 产品文档。外部包依赖树继续由 profile 持有。

最终 Web 外部配置行集合仅包含 `pet`。

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
| 图像理解 | 无已接受外部所有者 | 前 38 个 DSH-capable ModLens 版本均缺少目标 route 或丢失 route disposer；精确 `3.24.0` 在生命周期前因服务端请求安全失败 |
| 任务看板 | 无已接受所有者 | 28 个已发布版本均至少有一项强制检查失败；`0.2.9` 在生命周期停止 |
| SSH 入口和 hosts API | 无已接受所有者 | 全部 28 个 SSH 版本都把已接受的独立终端会话留在插件 dispose 之外 |
| 移动端远程 UI | 无已接受 Fusion 所有者 | Remote Web UI 准入结果为 0/28；桌面端可保留自身实现 |
| 宠物 UI | `@linxin666/dsh-pet@0.2.9` | 精确许可证、授权、生命周期、所有权、去重和 Chrome 检查均通过 |
| 分支选择和提交拓扑 | 无已接受所有者 | Git Graph `0.2.9` 会在配置行 fiber dispose 后留下活跃 JSON 操作与子进程 |
| 皮肤管理 | 无已接受所有者 | `0.1.12` 至 `0.2.9` 许可证冲突；`0.1.11` slot 不可见 |
| 右侧工作台 | 无已接受所有者 | Better Sidebar `0.15.2` 的公共 rc.5 peer 闭包为 0/14；之后检查均为 `NOT RUN` |
| Liangshen preset | 仓库 preset，来源为 `0.2.4` | `0.2.8`／`0.2.9` 保留不受约束的 Windows 自定义 Bash；TUI `0.8.7`／`0.8.8` 各自打包第二个所有者 |
| 终端 UI | 源码运行时：dsh-TUI `0.7.1`；无公开交付 | `0.8.7`／`0.8.8` 各自打包 8 个 Liangshen 文件，新的完整公开 rc.5 闭包结果为 0/41 |

ModLens、SSH、Remote Web UI、Task Board 与 Git Graph 在已发布版本通过首个失败的强制检查及全部后续检查前保持排除。Pet 固定为精确 `0.2.9`；更早存在授权缺陷或许可证冲突的版本继续保持拒绝。Files、editor、UI Terminal 和 Source Control 仍属于被阻塞的右侧工作台能力。

---

## 4. 分层架构

```text
L3  Desktop shell contract
L2  Repository Fusion patch, shared Liangshen preset, profile recipes, tests, docs
L1  Pet 0.2.9
L0  DeepSeek Harness core, agent loop, and session format
```

L0 保持不变。Cordis 维护把六个 runtime event id 恢复为 `cordis/*`，约束 vendored package rescope 只改写模块和包元数据引用而不改写 event、locale 或 data id，并同步拥有相应内容的 API、extension 包、测试和生成文档，但不得把 Fusion 行为移入 agent loop。

Web profile 顺序为 `base -> web-app -> fusion`。TUI profile 顺序为 `base -> dsh-tui`。两个入口共用仓库 Liangshen preset，但不会同时渲染。

---

## 5. 组件

### 5.1 `@deepseek-ai/dsh-fusion`

该包是纯 patch bundle。其 manifest 在 `profileDependencies` 中记录 Pet `0.2.9`，不把外部包声明为普通运行时依赖。其 patch 只插入 `pet`。

相应测试比较完整的单项依赖映射与配置行集合，拒绝包括 Git Graph 在内的阻塞包和重复能力包，并通过真实 profile 组合加载该 bundle。

### 5.2 共享 `liangshen` Preset

仓库 preset 保留来源 `0.2.4` 中已验证的两阶段锚定。在 Windows 上使用仓库 Bash 沙箱和批准路径，不采用可能在无操作系统约束下运行的上游 `custom-bash.mjs`。

该 preset 是 Web 与 TUI 唯一的 Liangshen 所有者。会同步另一个 Liangshen 目录的 TUI 版本会被拒绝。

### 5.3 `fusion` 与 `fusion-tui` Profile

Web profile 是可复现的单行操作步骤，不是内置模板。它安装精确 Pet 包与 React `18.3.1` peer，且没有原生构建许可。注册表无法重建已验证 rc.5 闭包时，Fusion TUI 没有受支持的公开操作步骤。

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
- 模型可见输入仍可从会话日志重建。
- Runtime event id 保持为 `cordis/request-run`、`cordis/request-run-resolved`、`cordis/dynamic-package`、`cordis/dynamic-retract`、`cordis/inspect-query` 和 `cordis/inspect-query-resolved`；包 rescope 不得改写这些 id 或 locale id，也不得增加兼容 alias。
- checked-in REAL composition gate 必须通过系统 Chrome CDP `9333` 启动精确单行 `base -> web-app -> fusion` profile；不得调用 `chromium.launch()` 或使用 IDE 浏览器。
- 默认单测与覆盖率测试保持离线。fixture（测试前置数据）/profile 只包含精确 Pet `0.2.9` 与 React `18.3.1` peer，且不含外部构建许可。仓库根不得增加 Pet 或 React 条目，根 `package.json`、lockfile 与 workspace 文件保持不变。
- REAL process helper 为 stdout 和 stderr 各保留最多 64 KiB 的 byte-bounded diagnostic tail，同时识别跨 chunk 拆分的 readiness marker。

Better Sidebar 保持阻塞，直到上游部署策略能够隐藏或禁用不安全设置、拒绝已持久化的启用尝试、阻止工具注册，并保留可用的 UI Terminal 和完整 Settings 体验。

---

## 7. 失败模式

- **ModLens 服务端安全：** 精确 `3.24.0` 通过产物、许可证、依赖闭包、隔离安装与组合检查，但 `POST /modlens/paste` 会接受 `/modlens/config` 所拒绝的跨站请求，并写入所提交的图像。生命周期、启动、能力与 Chrome 检查为 `NOT RUN`；前 38 个 DSH 候选保留既有 route 生命周期结论。
- **SSH 生命周期：** 全部 28 个已发布版本都把已接受的独立终端会话留在 `SshEngine.dispose()` 之外。
- **Remote Web UI：** 28 个发布版本保持排除。精确 `0.2.9` 修复许可证身份，但因 `/remote` 授权可关闭而在安全检查失败；下游生命周期与运行时检查为 `NOT RUN`。
- **Task Board 生命周期：** 全部 28 个已发布版本均至少不满足一项必要条件。精确 `0.2.9` 修复许可证身份，但丢弃顶层 settings subscription disposer。不得使用 shim 或核心改动。
- **许可证身份：** `0.2.8` 波次有 10 个直接冲突；在 `0.2.9` 中，Chat Recovery 与 Skin Center 仍有直接冲突，Skins 与 `web-ui-all` 则继承冲突的依赖闭包。
- **Describe Image 授权：** 精确 `0.2.8` 与 `0.2.9` 接受 `/describe-image` 上的非 loopback 跨站上传并触达 attachment 存储。
- **Remote Web UI 授权：** 精确 `0.2.9` 在 `requirePairingForLan:false` 时跳过 `/remote` HTTP 与 WebSocket 路由的实时设备授权。
- **Pet：** 精确 `0.2.9` 修复许可证身份、保留服务端授权，并通过实时负控、disposer／重挂、隔离 profile 检查和 Chrome 运行时 gate。
- **Git Graph 生命周期：** 精确 `0.2.9` 修复许可证身份与授权，但活跃 `/git` JSON 操作及其子进程可越过配置行 fiber dispose。仅移除 route 不会结算 handler 或进程树。
- **侧栏公共闭包：** 执行时无缓存 packument 包含 15 个可安装 manifest，且不存在高于 `0.15.2` 的发布版本。精确 Better Sidebar `0.15.2` 声明 14 个 `^0.1.0-rc.8` DSH peer；公共注册表对 14 个包提供精确 rc.5 的数量为 0。该首个失败后，安全、生命周期、隔离安装、组合、启动与 Chrome 均为 `NOT RUN`。
- **Peer 漂移：** 已接受包可能声明后续 DSH 或不同 React peer。记录漂移并依赖精确运行时证据；任何依赖变更后都要重跑判据。
- **Slot 漂移：** 客户端可能成功加载，却注册 rc.5 不存在的 slot；Skin Center `0.1.11` 已证明该问题。
- **Event id rescope：** 六个公开 `cordis/*` runtime event 被改写为 npm subpath，但进程内与协议 exact-string 分派不会规范化这些名称。仓库内部一致不能证明新 id 的语义正确。
- **验收输出增长：** 无界 stdout/stderr 累积可能耗尽内存，并重复扫描既有输出。已通过独立复审的 helper 为每个流保留 64 KiB byte-bounded tail，并保持跨 chunk readiness 匹配。
- **探针错误：** 固定等待和错误前置条件可能产生误判。验收探针使用能力条件，并把被拒绝的尝试保留为非最终证据。

---

## 8. 验证策略

### 8.1 既有 Web 行为

验证对话渲染、工具卡片、New Session 创建或复用行为、会话列表、fork、resume、compact、两条 export 路径、Search、Settings、模型选择、stock Web 隔离、headless 隔离和 ACP 隔离。

### 8.2 精确配置行 Web 检查

验证外部 Host 配置行与浏览器入口恰好为一项、Pet root 唯一、Pet 状态返回实时数据，且没有外部模型工具；Git Graph 与其他全部阻塞身份必须缺席，同时 stock Web 保持可见且诊断干净。

在每个 profile 内，每个 blocked `GET` 完整响应快照必须与该 profile 自身的 `GET /` 相同，包括 body 原始字节相等。每个非 fallback 完整响应快照必须在独立启动的 `base + web-app` 与 Fusion profile 间保持原始字节相等。

每个根响应必须各有且仅有一个可解析的 `window.__DSH_BOOT__` 赋值。baseline 不含 Pet entry；Fusion 精确增加一个合法 Pet entry；每侧 graph revision 都由该 graph 的完整、有序 entries 计算。从 Fusion graph 删除 Pet entry 并按剩余完整、有序 entries 重算 revision 后，完整 Fusion HTML 必须与 baseline HTML 原始字节相等。额外 client entry、共享 entry 字段或顺序漂移、baseline 或 Fusion 的错误 graph revision、boot script 外 body 差异，以及 mounted JSON、redirect、含 stock title 的 route-owned HTML、404 或 405 控制响应都必须使 oracle 失败。

### 8.3 TUI 检查

验证精确版本 `0.7.1`、一个 Liangshen 所有者、lock 中不含高于 rc.5 的 DSH runtime 包、顶栏、模型与上下文状态、输入区、Bash 到 `run_code` 的提升、完整回复、连续持久事件、恢复渲染、受支持退出和无残留进程。

### 8.4 证据层级

包级证据不能证明组合行为。最终 Web oracle 必须通过系统 Chrome CDP `9333` 使用精确单行 `base -> web-app -> fusion` profile，最终 TUI 证据必须通过真实 PTY 使用可运行 profile。默认单测与覆盖率测试保持离线。

---

## 9. 2026-08-21 Task 12 结果

历史六行 Web profile 已有精确 manifest、lock、bundle 顺序、构建许可、包能力、focused 路径和干净诊断证据。其 verifier 曾通过 156/156 项运行时断言，实际 compact 替换 7 项、共 402 tokens 的历史，并在重启后恢复同一持久会话。后续 Pet 与 Git Graph 授权发现已使该运行不能作为最终验收证据。

历史四行集合为 ModLens `3.22.1`、任务看板 `0.1.11`、SSH `0.2.5` 和 Remote Web UI `0.1.11`。对应 checked-in REAL composition lane 通过系统 Chrome CDP `9333` 取得 1/1 PASS，精确外部依赖、lock 数据与构建许可保持 fixture 局部，且未进入默认 unit、coverage、Web 或 CI 收集。

历史完整四行 oracle 通过 170/170 项断言。真实 compact 遮蔽 7 项和 401 tokens，使投影消息 token 从 448 降至 160，并在服务重启后恢复同一 durable session。Task Board 生命周期审查已取代四行 gate 与 oracle 的最终验收效力：首次加载成功，但同页卸载／HMR 和断连重挂未通过，且 26 个已发布版本均不同时满足生命周期、许可证身份与 rc.5 runtime。

历史三行目标包含 ModLens `3.22.1`、SSH `0.2.5` 和 Remote Web UI `0.1.11`。对应 checked-in gate 通过 1/1，完整 oracle 通过 174/174，实际 compact 为 7 项/402 tokens，投影消息 token 从 449 降至 155，并在重启同一会话后保持 155。ModLens、SSH 与 Remote Web UI 生命周期审查已取代该准入结论。在已被取代的 Task 13 阶段，八项影响决策的能力均为 blocker，禁止的重复配置行被拒绝，Community Plugins、Plugin Manager、Skill Explorer 与 Desktop Launcher 等非目标身份保持 `NOT SELECTED`；因此当时的目标包含零个外部配置行。

六个 runtime event id 已在 producer、Remote allowlist、consumer、测试和生成文档中使用原 `cordis/*` 名称。Rescope 正控与负控保证模块和包元数据引用继续改写，但 event、locale 和 data id 不改写；有效 JSON/JSONC 依赖映射可正反向往返，格式错误的围栏保持逐字节不变，且不存在兼容 alias。REAL process helper 已通过独立复审，把每个 stdout/stderr diagnostic tail 限制为 64 KiB，同时保持跨 chunk readiness 匹配和进程树完全结算。

TUI `0.7.1` 在 41 包纯 rc.5 源码验证闭包下具备可复现的全新和恢复真实 PTY 证据，包含持久回放、受支持退出和无残留进程。npm registry 缺少该依赖图所需的 23 个 rc.5 包，因此没有受支持的公开命令能重建该闭包。TUI 运行时验证通过，但公开交付保持阶段 2 BLOCKED。Liangshen 继续使用来源 `0.2.4`，并保留仓库安全适配。

Task 12.1 至 Task 12.14 保留任务级和历史证据，Task 12.15 至 Task 12.17 完成生命周期审查、rescope 修复与零行产品收敛。Task 12 至 Task 17 均已完成：最终零行 REAL gate 通过 1/1，完整 oracle 通过 196/196，三项负控均按预期阻断，Round 3 exact-staged 代码与安全复审均已批准。

---

## 10. 2026-08-22 Task 18 结果

截止后审计从 `2026-08-21T02:11:00Z` 开始。ModLens 有 76 个发布版本、38 个 DSH 候选和 3 个截止后候选；精确 `3.23.1` 直接在 dispose／重挂检查失败。17 个 Web UI 身份各自有 `0.2.6` 与 `0.2.7` 两个截止后版本；34 个精确产物均具备身份、完整性、许可证，以及适用的安全、生命周期、所有权或去重结论。Better Sidebar 有 13 个发布版本，精确 `0.15.0` 在部署策略和 PTY sink 检查被阻塞。

dsh-TUI 有 19 个发布版本，以及 `0.8.7` 与 `0.8.8` 两个截止后候选。两个精确产物各自都有 24 个非 rc.5 DSH peer、0 个根与 15 个打包内 `workspace:*` 值，以及 8 个打包的 Liangshen 文件。历史 23 包计数是公开安装直接查询的子集；新的完整查询在历史源码验证闭包的 41 个包中找到 0 个精确 rc.5。两个候选都在安装前因单一所有者和公开闭包检查失败，因此对应 profile 与 PTY 检查为 `NOT RUN`。历史 `0.7.1` 源码运行时 PASS 保持不变。

Round 5 没有候选通过或未通过 Chrome／PTY 验证。精确产物的强制失败使这些下游检查成为 `NOT RUN`。详细系列计数、产物／许可证结果和证据路径见[兼容矩阵](../plans/fusion-compat-matrix.md)。

---

## 11. 2026-08-22 Task 22 结果

Task 22 及其独立复审是已完成的历史证据。该任务曾准入精确 Pet 与 Git Graph `0.2.9`；Task 33 根据后续活跃操作生命周期发现取代了 Git Graph 准入结论。[兼容矩阵](../plans/fusion-compat-matrix.md)记录新鲜度截止时间、发布计数、有序检查、各身份停止点与组合运行时证据。

---

## 12. 2026-08-22 Task 26 结果

Task 26 在不增加 shim 或修改核心的情况下审计精确 ModLens `3.24.0` 与 Better Sidebar `0.15.1`。两个 tarball 均通过身份、完整性、路径安全与 MIT 许可证检查。ModLens 有 77 个发布版本和 39 个 DSH 候选；其无 DSH 依赖闭包、隔离安装与单行组合通过，随后跨站 paste 请求在服务端安全检查失败。Better Sidebar 有 14 个可安装发布版本；其公共 rc.5 peer 闭包在安装完成前失败。之后的检查均为 `NOT RUN`，两行 Fusion 结果在该历史检查点保持不变。

---

## 13. 2026-08-23 Task 28 结果

执行时无缓存 Better Sidebar packument 的 HTTP 截止时间为 `2026-08-22T17:01:07Z`，dist-tag 为 `latest: 0.15.2` 与 `beta: 0.12.0-beta.1`，time map 有 16 个版本键，并包含 15 个可安装 manifest。精确 `0.15.2` 发布于 `2026-08-22T15:35:41.933Z`，是上次截止后的唯一候选。其身份、SHA-1 与 SHA-512 SRI、tar 路径安全和 MIT 许可证检查均通过。公共 rc.5 闭包失败，因为全部 14 个 DSH peer 均要求 `^0.1.0-rc.8`，且精确 rc.5 只在 0/14 个包中可用。安全、生命周期、隔离安装、组合、启动与 Chrome 均为 `NOT RUN`；两行 Fusion 结果在该历史检查点保持不变。

---

## 14. 2026-08-23 Task 29 结果

精确 Pet 与 Git Graph `0.2.9` profile 在同一次 fresh assembled run 中通过系统 Chrome CDP `9333` 的 36/36 项断言。该运行覆盖对话渲染、工具卡片、New Session 创建或复用、会话列表、fork、resume、compact、两条 export 路径、Search、Settings、模型选择、Pet、Git Graph 与保持不变的 stock Web 行为。Fresh headless 与 ACP 检查继续与 Fusion 隔离。exit、console、page、network、slot、process、port、CDP target、临时目录、进程组与 cleanup 诊断均干净，独立复审没有 finding。Task 33 在不改变 `36/36` 测量结果的前提下，取代了该两行运行的当前准入效力。

---

## 15. 2026-08-23 Task 30 结果

权威 exact-staged V8 package 为 `.superpowers/sdd/round5-final-staged-v8/review-package.md`，SHA-256 为 `d4d9e99624bd8f7612e92c477efeaadea1b2b37ee0f268ea6df4704fda42c8dc`，对应 index tree `d77fb5a65673db4232f5ace22726dbf9e091dc29`；其中包含 41 个文件、3,276 行新增与 506 行删除。四个 focused 文件通过 110/110 项测试。Typecheck、build、0 errors lint 与 hygiene 均通过。Translation pairing 检查 945 对文档；Agent Note 格式、归档 note 验证、Markdown wrap、Markdown links 和文档 budget 分别检查 542 份 note、426 个冻结产物、1,874 个文件、1,911 个文件与 9 个文档。

系统 Chrome 151 经 CDP `9333` 的 built acceptance 通过 1/1，结束后 Fusion target 与 listener 均为 0。Task 28 summarize 重新生成 0/14，其 blocker assertion 按预期以退出码 1 结束；Task 29 oracles 通过 10/10。Task 28 与 Task 29 的 task review 均已完成。V8 bits 复审报告 P0/P1/P2 `0/0/0`，DSH 复审报告 `PASS / APPROVE` 且 0 findings，安全复审未发现可利用问题。

Remediation 集合覆盖事务式迟到 acquisition、CI trap、Pet 私有包副本、保留 `Promise.reject(undefined)` 的显式 `pending`／`fulfilled`／`rejected` settlement、带对象 identity 去重的正交 cancellation／operation／resource／final-cleanup failure 聚合、由 acquisition／disposal／final cleanup／operation settlement 共用的单一 cleanup deadline，以及 deadline 到期后不延长该 deadline 的已观察 best-effort 外层 disposal。独立 plan/design/spec alignment 为 `APPROVED`，Critical/Important/Minor 为 `0/0/0`；最终 checklist、staging 与 Git 对账及唯一最终 progress 追加均已完成。本地未运行全量仓库 coverage 或实际 GitHub-hosted job。

---

## 16. 重新验证条件

外部版本变化时，重跑许可证、安全、生命周期、包级和组合运行时检查，不得沿用 Pet `0.2.9` 的结论。只有新的精确 Git Graph 发布版本在 dispose 时拒绝新请求，于有界期限内取消并等待全部活跃 JSON／SSE 操作和完整进程树，并通过进行中 JSON 请求卸载与同 Context 重挂负控后，才能重新考虑 Git Graph。只有修改状态的 route 执行适用的请求信任策略，且每个 route disposer 都属于其插件 fiber 后，才能重新考虑 ModLens。只有 dispose 关闭并等待每个已接受的终端与 SSH 资源后，才能重新考虑 SSH。只有实时设备授权不可关闭且完整资源清理通过后，才能重新考虑 Remote Web UI。只有一个已发布 Task Board 产物持有每个客户端 subscription 并通过同页卸载／HMR 验证后，才能重新考虑 Task Board。只有已发布产物具备一致许可证身份，并且注册 rc.5 可见的 Settings 入口后，才能重新考虑 Skin Center。只有已批准 Harness 基线具备完整公共依赖闭包，且包自有批准决策或不可变部署策略同时满足安全与完整工作台要求后，才能重新考虑 Better Sidebar。

历史零行 1/1 与 196/196、六行 156/156、四行 1/1 与 170/170、三行 1/1 与 174/174，以及 Task 22/29 两行结果都只作为被取代的证据保留。当前 Web 目标包含一个精确外部配置行。只有已批准 Harness 基线的一致公开闭包可用且保持一个 Liangshen 所有者后，才能重新考虑 TUI 公开交付；任一路径都需要完整重验安装、lock、所有权、PTY、恢复、退出、清理和公开命令。

---

## 17. 执行交接

Task 34 至 Task 38 已完成。43 路径 V2 package 与全部最终复审均 clean；HEAD 保持 `6e0f654` 且 index 为空，恢复 staged-only 交付或清理 history 需要用户另行授权。

---

## 附录 A：仓库参考

- Bundle 机制：[`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)
- Patch 模板：[`packages/bundle/base/`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/base)
- Profile 启动：[`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)
- Preset：[`packages/preset/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/preset/README.md)
- 组合命令：[`apps/cli/src/plugin.ts`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)
- 根构建策略：[`pnpm-workspace.yaml`](file:///Users/bytedance/opencode/agent/dsh/pnpm-workspace.yaml)

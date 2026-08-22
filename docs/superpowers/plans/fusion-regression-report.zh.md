# Fusion 阶段 1 回归报告

[English](fusion-regression-report.md) | 中文

日期：2026-08-21

状态：`DONE_WITH_CONCERNS`

范围：历史 Task 5 证据及 2026-08-21 Task 12 收口补充。历史矩阵保持不变。

当前结果：最终 Web 外部集合为空。ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 均为有证据支持的 blocker。最终零行 REAL gate 通过 1/1，完整 oracle 通过 196/196，三项负控均按预期阻断，compact 记录 7 项/401 tokens 和投影消息 token 448→155，重启后保持 155，独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`。历史三行 1/1 与 174/174、四行 1/1 与 170/170、六行 156/156 结果都只保留为被取代的证据。TUI 源码运行时通过，公开交付保持阶段 2 BLOCKED，Liangshen 继续使用 `0.2.4` 作为来源。

## 结果

矩阵包含 24 个 PASS 和 4 个 BLOCKED 行。未修改产品代码。实时 Fusion 检查通过 CDP `http://127.0.0.1:9333` 使用系统 Google Chrome 151。

| 范围 | 状态 | 证据 |
| --- | --- | --- |
| 对话渲染 | PASS | 实时预置 Fusion 会话渲染两个轮次和 `FIRST_DONE`；`browser/fusion-regression-final-pass.json`。 |
| 工具卡片 | PASS | 实时 DOM 报告一个 Bash 卡片和两个 Read 卡片；`browser/fusion-regression-final-pass.json`、`browser/conversation-tool-cards.png`。 |
| New Session | PASS | 实时控件的可访问名称为 `新建会话`；空白编辑区恢复时没有新增已实例化配置行；`browser/fusion-regression-final.json`。 |
| 会话列表 | PASS | 实时树 `未分组` 包含选中行 `NavScenario: first run bash to`；`browser/fusion-regression-final-pass.json`。 |
| Fork | PASS | 无密钥组合 Web 回放通过 `message-actions.e2e.ts`；实时 focused 后续步骤由下方 composite-CDP BLOCKED 行覆盖。 |
| Resume | PASS | 实时冷启动预置会话在不请求模型的情况下渲染持久化历史；`browser/session-history-final.response.json`。 |
| Compact | PASS | 无密钥组合 Web 回放通过历史压缩和命令路径；实时 focused 后续步骤由下方 composite-CDP BLOCKED 行覆盖。 |
| Export | PASS | 无密钥组合 Web 回放通过页头和 `/export` ZIP 路径；实时 focused 后续步骤由下方 composite-CDP BLOCKED 行覆盖。 |
| Search | PASS | 无密钥组合 Web 回放通过 `navigation-panes.e2e.ts`；实时 focused 后续步骤由下方 composite-CDP BLOCKED 行覆盖。 |
| Settings | PASS | 实时 General、Models、Plugins、Escape 和关闭按钮流程通过；插件清单包含 165 行；`browser/fusion-regression-final-pass.json`。 |
| 模型选择 | PASS | 实时选择器从 DeepSeek-V4-Pro 切换到 DeepSeek-V4-Flash，并更新当前模型的可访问名称；`browser/fusion-regression-final-pass.json`。 |
| Editor | BLOCKED | 实时 Fusion DOM 和可访问性树不含 Web Editor。插件清单只包含已禁用的 `@deepseek-ai/dsh-tool-str-replace-editor`，它不是 Web Editor。Stock Web 源码／测试只暴露文件打开和原生 Settings 文档操作，不包含 Editor。Files/editor/terminal/Git 属于 Task 7 的 Better Sidebar。评审人必须解决阶段 1 规格矛盾。 |
| 不含 `describe_image` | PASS | 运行时 Loader 清单不含 `@linxin666/dsh-tool-describe-image`；Liangshen focused test 的精确标准／阶段工具列表不含 `describe_image`。第三方标识为配置行 `describe-image`、工具 `describe_image`；`third-party/describe-image/`。 |
| 不含 AionUI Panel | PASS | 运行时 Loader 清单不含 `@linxin666/dsh-client-ui-aionui-panel`。其真实配置行是 `ui-dsh-aionui-panel`；slot 为 `conversation.input.dock` 的 `aionui-drag-file`／`aionui-mermaid-chat` 和 `web-ui.plugin.item` 的 `aionui-panel`；`third-party/aionui-panel/`。 |
| 不含 `web-ui-all` | PASS | 结构化组合 dump 和实时 Loader 清单不含聚合配置行；`dump-config.analysis.json`、`browser/fusion-regression-final-pass.json`。 |
| 远程实现唯一 | PASS | 实时运行时恰有一个 `include:remote-web-ui` 配置行、一个可访问的 `移动端远程控制` 按钮、一个客户端资源，且 `/m/` 返回 HTTP 200；`browser/fusion-regression-final-pass.json`、`browser/mobile-route.headers.txt`。未在 loopback 上执行配对 token 问题，因为插件要求 `--host 0.0.0.0` 或 `publicBaseUrl`。 |
| Liangshen 唯一 | PASS | Loader 配置行不含 Liangshen 插件；`agentPreset.list` 恰好包含一个 id `liangshen`，实时选择器选中了 `梁神模式`；`browser/fusion-regression-final.json`。 |
| Slot/service 冲突 | PASS | 启动保持健康；实时 `[data-slot-error]` 为空；启动日志不含重复、冲突或服务注册匹配项。 |
| 组合实时 CDP 退出 0 | BLOCKED | 已保存 focused 实时步骤和诊断，但没有单次组合运行退出 0。最终失败运行的 console、network 和 page 诊断干净，并通过对话、工具、Settings、模型选择、New Session、清单、Liangshen、Editor 缺失和远程唯一性；随后 Search helper 时序阻止了依赖它的实时 fork/export/compact 序列。这些产品路径已在无密钥组合 Web 回放中通过。 |
| Stock Web 隔离 | PASS | 全新 home 默认 dump 有 129 行且不含 Fusion 标识；真实 stock server 达到 HTTP 200。最终清单 helper 仍被 RPC envelope 不匹配阻塞，因此以结构化 Loader dump 和真实启动作为隔离证据。 |
| Headless 隔离 | PASS | 全新 home dump 有 81 行且不含 Host、browser 或 Fusion 配置行；built-bin focused test 通过 1/1。 |
| Headless 行为 | BLOCKED | 请求的真实命令以 `MISSING_CREDENTIAL` 退出 1；不计为行为成功。 |
| ACP 隔离 | PASS | 真实 stdio 无密钥 focused test 在独立 home 中通过 framed JSON-RPC 和 `session/new`，共 2/2。 |
| Fusion 相应测试 | PASS | 1/1。 |
| Liangshen focused test | PASS | 使用 `vitest.e2e.config.ts` 时通过 1/1。未使用 e2e 配置的调查命令没有找到测试；两份输出均保留。 |
| `pnpm run test:gui` | PASS | 272 个文件，3757 个通过，1 个跳过。 |
| `DSH_SNAPSHOT=replay pnpm run test:web` | BLOCKED | 74 个文件、252 个测试通过；一个 `workspace-management` 悬停操作点击超时。Task 5 相关文件均通过，包括导航和消息操作。Focused 前置条件与重命名重跑通过 2/2；相关源码／测试路径当前无 diff。 |
| ACP focused test | PASS | 2 个通过，1 个无关测试跳过。 |

## 运行时清单

组合后的 Fusion dump 有 135 个条目。六个活动 Fusion 配置行为：

| 配置行 id | 模块 |
| --- | --- |
| `modlens` | `@liustack/modlens@3.22.0` |
| `ui-task-board` | `@linxin666/dsh-client-ui-task-board@0.2.4` |
| `ssh` | `@linxin666/dsh-ssh@0.2.4` |
| `remote-web-ui` | `@linxin666/dsh-remote-web-ui@0.2.4` |
| `pet` | `@linxin666/dsh-pet@0.2.4` |
| `ui-skin-center` | `@linxin666/dsh-client-ui-skin-center@0.2.4` |

实时 Plugins 清单的可访问名称为 `modlens, 已挂载, 已启用`、`ui-task-board, 已挂载, 已启用`、`ssh, 已挂载, 已启用`、`remote-web-ui, 已挂载, 已启用`、`pet, 已挂载, 已启用` 和 `ui-skin-center, 已挂载, 已启用`。

## 命令

```text
pnpm exec vitest run packages/bundle/fusion/tests/fusion.spec.ts
pnpm exec vitest run --config vitest.e2e.config.ts apps/cli/tests/web-agent-presets.e2e.ts -t 'anchors `liangshen`, promotes it to Code Mode, and re-anchors after compaction'
pnpm run test:gui
DSH_SNAPSHOT=replay pnpm run test:web
DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/workspace-management.e2e.ts -t 'adds two workspaces|renames a workspace'
pnpm exec vitest run --config vitest.e2e.config.ts examples/acp-agent/tests/acp.e2e.ts -t 'emits only framed JSON-RPC|session/new succeeds over real stdio'
pnpm exec vitest run --config vitest.e2e.config.ts apps/cli/tests/built-bin.e2e.ts -t 'prints the headless profile without Host or browser layers'
```

## 诊断与清理

已接受的实时 Fusion 步骤证据中，console warning、console error、page error、失败请求、非 2xx 响应和 slot error 均为空。较早被拒绝的运行有意尝试 loopback 配对问题并产生 HTTP 409；最终验收不把该交互计为通过，因为插件要求可访问的 bind 地址或 public base。

端口 `43350` 和 `43351` 上的服务器已停止且没有监听器。Task 创建的 localhost target 已关闭。CDP 9333 上的既有 Chrome 进程保持运行；未关闭用户拥有的页面。未读取 cookie、storage 或 token。未执行 Git staging、commit、push、merge、rebase 或 reset。

## 自审

- 正确性：运行时标识来自结构化 dump、实时 Loader 清单、可访问性树和精确第三方包，不只依赖 grep 缺失断言。
- 范围：未实现或修改 Task 6-9，也未修改产品代码。
- 简洁性：证据 helper 是未跟踪的 Task 5 产物；没有新增可复用产品抽象。
- 安全：浏览器操作只访问已知 localhost URL，未检查浏览器凭据。
- 评审决定：阶段 1 Editor 仍存在矛盾；四个 BLOCKED 行存在时不能宣称阶段 1 全绿。

## 最终 Task 5 补充

本仅追加补充记录最终证据与评审决定。上方原始 `DONE_WITH_CONCERNS` 状态和 24 PASS／4 BLOCKED 矩阵仍是 focused fix 之前的历史结果，不作改写。修正后的 [design §8.1](../specs/2026-08-19-dsh-five-repo-fusion-design.md#81-existing-web-behavior) 和 [Task 5 plan](2026-08-19-dsh-five-repo-fusion.md#task-5-regress-existing-web-behavior-and-deduplication) 把 Files/Web Editor/Terminal/Git 分配给 Task 7，而不是 Task 5。

- **Search：** [退出码 `0`](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/search.exit.txt) 和[无诊断结果](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/search.json)表明预置结果已打开、查询已清除、正常会话树已恢复；[target 证据](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/search-targets.json)记录了关闭结果。
- **Fork：** [退出码 `0`](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/fork.exit.txt) 和 [fork 结果](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/fork.json)记录 `/api/session.fork` 返回 HTTP 200、新增一行并选中新会话；[target 证据](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/fork-targets.json)记录了关闭结果。
- **Compact：** [可访问性捕获](../../../.superpowers/sdd/v2-task-5-fix-evidence/live-compact-original/compact-accessibility.json)包含 `已压缩 7 条历史记录（约 423 tokens）`；[成功事件链](../../../.superpowers/sdd/v2-task-5-fix-evidence/live-compact-original/compact-command-success.jsonl)和[持久化会话事件 262-267](../../../.superpowers/sdd/v2-task-5-fix-evidence/live-compact-original/session.after-compact.jsonl)包含 `compaction/summary`、`compaction/end` 和 `kind: success` 的 `command/done`。组合冷恢复覆盖保留在 [Web 测试输出](../../../.superpowers/sdd/v2-task-5-evidence/tests/test-web.stdout.log)中。最终复审明确把较早 helper 级 `accepted: false` 记录视为陈旧索引，而不是相反的运行时证据。
- **页头 export：** [export 运行退出码 `0`](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/export.exit.txt) 和[页头结果](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/export.json)记录 HTTP 200 和非空的 7,273 字节 ZIP。
- **`/export`：** 同一[focused 结果](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/export.json)单独记录 slash command 返回 HTTP 200 和非空的 7,372 字节 ZIP；[target 证据](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/export-targets.json)记录了关闭结果。
- **无密钥 headless：** focused 产品路径的[退出码](../../../.superpowers/sdd/v2-task-5-fix-evidence/headless/exit-code.txt)为 `0`；[测试输出](../../../.superpowers/sdd/v2-task-5-fix-evidence/headless/stdout.txt)记录 1 个测试通过，[预期 assistant 输出](../../../.superpowers/sdd/v2-task-5-fix-evidence/headless/expected-assistant-output.txt)为 `CLI tool round trip complete: CLI_TOOL_ROUND_TRIP`。
- **运行时工具目录：** focused 命令[退出码为 `0`](../../../.superpowers/sdd/v2-task-5-fix-evidence/tool-catalog/exit.txt)，组合 Fusion 的[运行时注册表捕获](../../../.superpowers/sdd/v2-task-5-fix-evidence/tool-catalog/catalog.json)报告 `context.tools.schemas()` 中 `describe_image: 0`，且 `@liustack/modlens@3.22.0` 提供的 `modlens_read_image: 1`。

最终独立[复审](../../../.superpowers/sdd/v2-task-5-rereview.md)对规格符合性和证据质量均给出 `APPROVED`。因此 Task 5 结论为 `APPROVED`：四个较早 blocker 已解决，无关的全量 Web hover 超时仍不阻塞，且没有剩余 Task 5 验收缺口。

## 2026-08-21 Task 12 收口

Task 12 安全发现取代 Task 11 PASS 与后续六行运行时 PASS 作为当前最终结果；这些结果对其覆盖的版本和检查仍是有效历史证据。

- **历史六行组合：** [组合运行时报告](../../../.superpowers/sdd/v3-task-12-final-web-runtime.md)和[独立复审](../../../.superpowers/sdd/v3-task-12-runtime-evidence-rereview.md)记录六个精确配置行、既有 Web 路径、去重、精确 lock 与构建许可、干净诊断、实际 compact 7 项/402 tokens、服务重启后恢复同一持久会话，以及 156/156 项运行时断言。这些检查没有覆盖后续 Pet 或 Git Graph 授权发现，不能关闭最终验收。
- **历史四行组合：** 选定集合曾为 ModLens `3.22.1`、Task Board `0.1.11`、SSH `0.2.5` 和 Remote Web UI `0.1.11`。[checked-in REAL composition 报告](../../../.superpowers/sdd/v3-task-12-four-row-real-gate-implementation.md)记录通过系统 Chrome CDP `9333` 取得 1/1 PASS。[完整四行 oracle](../../../.superpowers/sdd/v3-task-12-final-four-row-web-runtime.md)记录 170/170 项断言、7 项/401 tokens compact、投影 token 从 448 降至 160，以及重启后恢复同一 durable session。Task Board 生命周期发现已取代该证据；它不是当前或最终 Web 结果。
- **历史三行组合：** 选定集合曾为 ModLens `3.22.1`、SSH `0.2.5` 和 Remote Web UI `0.1.11`。[checked-in REAL composition gate](../../../.superpowers/sdd/v3-task-12-task-board-removal.md)通过系统 Chrome CDP `9333` 取得 1/1 PASS，依赖、lock 数据与构建许可保持 fixture 局部，且不进入默认 unit、coverage、Web 与 CI 收集。[完整三行 oracle](../../../.superpowers/sdd/v3-task-12-final-three-row-web-runtime.md)以干净诊断和 blocker 排除通过 174/174 项断言；compact 遮蔽 7 项和 402 tokens，投影消息 token 从 449 降至 155，并在重启同一 session 后保持 155。其[独立复审](../../../.superpowers/sdd/v3-task-12-final-three-row-web-runtime-review.md)为 `EVIDENCE PASS / RUNTIME PASS`。ModLens、SSH 与 Remote Web UI 生命周期审查已取代该准入证据。
- **Pet：** [最终安全审查](../../../.superpowers/sdd/v3-task-12-final-security-review.md)和[独立验证](../../../.superpowers/sdd/v3-task-12-pet-security-validation.md)表明 exact `/api/pet/*` 路由允许未配对远端读取和持久修改状态。Pet 保持排除。
- **Git Graph：** [最终安全审查](../../../.superpowers/sdd/v3-task-12-final-security-review.md)和[独立验证](../../../.superpowers/sdd/v3-task-12-gitgraph-security-validation.md)表明 Remote Web UI 设备撤销后仍可访问 `/git/*`。Git Graph 保持排除。
- **Skin Center：** [许可证调查](../../../.superpowers/sdd/v3-task-12-license-investigation.md)阻塞已发布的 `0.1.12` 至 `0.2.5`；[`0.1.11` 运行时报告](../../../.superpowers/sdd/v3-task-12-skin-0111-runtime.md)记录安装、组合、启动和客户端加载成功，但 Settings 卡在 rc.5 上不可见。
- **Better Sidebar：** [安全调查](../../../.superpowers/sdd/v3-task-12-sidebar-security-investigation.md)记录可选 `terminal_*` 模型工具绕过会话沙箱、批准和环境清洗。没有可接受的部署开关能保留完整工作台，因此该配置行保持未挂载。
- **TUI 与 Liangshen：** [TUI 报告](../../../.superpowers/sdd/v3-task-13-tui-runtime.md)和[独立复审](../../../.superpowers/sdd/v3-task-12-runtime-evidence-rereview.md)记录精确版本 `0.7.1` 在 41 包纯 rc.5 源码闭包下全新／恢复 PTY 运行时 PASS。npm registry 缺少 23 个所需 rc.5 包，因此没有受支持的公开命令能重建该闭包，TUI 公开交付保持阶段 2 BLOCKED。[Liangshen 审计](../../../.superpowers/sdd/v3-task-12-liangshen-license.md)保留精确来源 `0.2.4` 和仓库安全适配。

历史三行 checked-in REAL composition gate 使用系统 Chrome CDP `9333`，不含浏览器启动 fallback，并使默认 unit、coverage、Web 与 CI 收集保持离线。其 fixture/profile 依赖、lock 数据和 `allowBuilds` 不修改根依赖、根 lockfile 或根 `allowBuilds`。

Task 12.1 至 Task 12.17 已有任务级证据或权威审计。Task 12 顶层跨域审查与 Task 13 验收均已完成。最终零行 REAL gate 通过 1/1，完整 oracle 通过 196/196，独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`。

## 2026-08-21 零行收敛

- **ModLens：** [生命周期审查](../../../.superpowers/sdd/task13-final/modlens-lifecycle-review.md)阻塞每个已发布 DSH 候选，因为目标 route 缺失或其 disposer 被丢弃。
- **SSH：** [生命周期审查](../../../.superpowers/sdd/task13-final/ssh-lifecycle-review.md)阻塞 26/26 个版本，因为已接受的 terminal 与 SSH session 在插件 dispose 后仍保持活跃。
- **Remote Web UI：** [生命周期审查](../../../.superpowers/sdd/task13-final/remote-web-ui-lifecycle-review.md)阻塞 26/26 个版本。版本 `0.1.11` 通过 route 卸载／重挂，但开放 SSE、tunnel 完全停稳、客户端 subscription 与 failed-pair root 清理失败；`0.1.12+` 另有 manifest/LICENSE 身份冲突。
- **产品收敛：** Task 12.17 把 Fusion patch、profile dependency map、REAL fixture 和外部构建许可置空，并记录全部 8 个 blocker。最小 package RED/GREEN 循环与 focused 零行 acceptance 记录在 `.superpowers/sdd/task13-final/zero-row-convergence-report.md`。
- **当前 gate：** 最终零行 REAL gate 通过系统 Chrome CDP `9333` 取得 1/1 PASS；完整 oracle 通过 196/196，三项负控均以 195/196 和退出码 1 阻断，compact 记录 7 项/401 tokens 和投影消息 token 448→155，重启后保持 155。
- **独立复审：** 零行证据与运行时复审结论为 `EVIDENCE PASS / RUNTIME PASS`，没有阻塞发现。

# DSH 五仓库融合技术方案（设计文档）

- 日期：2026-08-19
- 状态：已批准（brainstorming 阶段产出），待进入 writing-plans
- 作者：Agent（依 Superpowers 流程）
- 备注：本文档为规划/规约文档，**不纳入 git 仓库**（遵循用户规则：plan/spec 文档不加入 git）。

---

## 0. 一页速览（TL;DR）

把当前仓库（DeepSeek Harness 核心，`dsh`，`0.1.0-rc.7`，commit `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca`）与以下 5 个外部仓库"完美融合"：

| # | 仓库 | 形态 | 核心能力 |
|---|---|---|---|
| 1 | `anywhere-labs/deepseek-harness-desktop` | Electron 桌面壳 | 窗口/托盘/自动起服务/插件市场/移动端远程 |
| 2 | `liustack/modlens` | 视觉桥插件 | 让纯文本模型"看见"图像，多引擎失败链 |
| 3 | `zhu1090093659/dsh-web-ui` | Web 插件+皮肤生态 | Liangshen 预设/任务看板/Git 图谱/移动端远程/SSH/图像理解/宠物/皮肤中心 |
| 4 | `ccch1mneyyy/dsh-TUI` | 终端 UI | React→Ink/Yoga 的 Claude-Code 风格 TUI |
| 5 | `omdsh-dev/DSH-better-sidebar` | 侧边栏工作台 | `ctx.betterSidebar` 服务：文件/编辑器/浏览器/终端/Git |

**关键判断**：这 5 个仓库全部已按"一切皆插件、不改 dsh 源码"的方式设计，通过 `dsh --profile` 机制挂载。因此"融合" = **组合与策展**，不是重写。

**四项已确认决策**：
1. **策略**：统一 Profile/Bundle 组合（侵入性最小）。
2. **前端**：桌面壳 + Web 全家桶为主，TUI 并行。
3. **去重**：每类能力选一个规范实现，其余下线。
4. **纳入方式**：npm 依赖 + 版本锁定。

**改动边界**：本仓库改动**只集中在 L2**（一个新 bundle 包 + 一个 preset + profile 模板 + 文档），**L0 核心 `packages/*` 零改动**。

---

## 1. 背景与现状（Context）

### 1.1 当前仓库是什么

当前仓库 `/Users/bytedance/opencode/agent/dsh` 就是 **DeepSeek Harness 核心**：基于 vendored Cordis 的插件式 agent harness，"一切皆插件"。关键机制（已核对源码）：

- **Profile**：`$DSH_HOME/profiles/<name>` 目录，含 `package.json`（`dsh.profile.bundles` 有序层列表 + 外部插件 `dependencies`）与用户 `cordis.patch.yml`。内置模板 `web` / `headless` 首次使用自动初始化。
- **Bundle**：npm 包，manifest 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`，是可安装的 patch 层。现有：[`base`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/base)（每个 profile 先应用的共享核心）、[`web-app`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/web-app)（浏览器面 patch + runtime glue）、[`headless`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/headless)。
- **Patch 语义**：`insert:` 追加行；id-targeted patch **替换**目标行的整个 `config`（需重述保留字段，不深合并）；`!!js` 表达式在 mount 时求值。层序：bundle 层 → per-profile `cordis.patch.yml` → home 级 `cordis.patch.yml` → `--patch` overlay。
- **bare 包解析**：`healProfilesModuleFallback` 维护扁平 `$DSH_HOME/profiles/node_modules`（每个依赖一个 symlink），使任意 profile 里的 bare 插件名走 Node 常规父级查找解析。**一个 manifest 未声明的行会 import 失败**。
- **Preset**：目录含一个 `agent.cordis.yml`，按 agent 作用域挂载，给该 session 独立工具与 prompt 段。部署自带的 preset 在 [`apps/cli/config/agent-presets/`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/config/agent-presets)。
- **Client slot 系统**：`dsh.client` 行是浏览器 roster；UI 插件通过 `ctx.slots.register({name, children?, store?, inject?}, Component)` 组合；跨插件通过 slot 或 ctx 服务通信。

### 1.2 五个外部仓库如何附着

| 仓库 | 今天的附着方式 |
|---|---|
| desktop | 把 dsh 作为 **git submodule**（钉在 commit `99f6f02`）；桌面壳自身是 dsh 插件；含插件市场 `dsh-community-market` |
| modlens | `dsh plugin --profile web add @liustack/modlens@3.21.1` |
| dsh-web-ui | 官方 profile 机制；聚合包 `@linxin666/dsh-web-ui-all`；子包含 liangshen/task-board/ssh/describe-image/pet/skin-center 等 |
| dsh-TUI | `dsh profile` + Cordis patch，消费 `session/event`；包 `@deepseek-harness-tui/dsh-tui` |
| better-sidebar | `dsh plugin --profile web add dsh-better-sidebar@0.13.1`；暴露 `ctx.betterSidebar` |

### 1.3 已识别的重复能力（去重对象）

- **图像理解/视觉**：modlens **且** dsh-web-ui 的 `dsh-tool-describe-image`
- **移动端远程**：desktop **且** dsh-web-ui
- **侧边栏**：better-sidebar、核心 [`ui-sidebar`](file:///Users/bytedance/opencode/agent/dsh/packages/client/ui-sidebar)、dsh-web-ui 已弃用的 `aionui-panel`（三处）
- **Agent preset（Liangshen/梁神）**：dsh-web-ui 与 dsh-TUI 各有一份

---

## 2. 目标与非目标（Goals / Non-Goals）

### 2.1 目标

1. 提供一个**融合 profile**（工作名 `fusion`）与配套 **bundle**，一次组合出：桌面壳承载的 Web 全家桶体验（web-ui-all + better-sidebar + modlens）。
2. 提供**并行的 TUI profile**（工作名 `fusion-tui`），与 Web 共用同一 base + 同一 Liangshen preset。
3. 去重：每类能力仅启用一个规范实现（见 §3）。
4. 全部外部能力以**锁定版本 npm 依赖**纳入，本仓库 L0 核心零改动。
5. 桌面壳（Electron）作为最外层，以 npm 依赖消费本仓库发布的 dsh + fusion profile。

### 2.2 非目标（YAGNI）

- 不把任何外部仓库源码并入 `packages/*`（用户已否决 monorepo 并入）。
- 不改动 dsh 核心 `packages/*` 的既有语义。
- 不新写图像理解/侧边栏/移动端能力（复用现成实现）。
- 不做被下线能力的迁移/兼容 shim（预发布阶段，"foundation over blast radius"）。
- TUI 与 Web/桌面壳**不追求同时运行**——它们是不同入口的并行前端。

---

## 3. 去重：规范实现选择（Canonical picks）

已用户批准。

| 能力 | canonical 选择 | 下线项 | 理由 |
|---|---|---|---|
| 图像理解/视觉 | **modlens** | dsh-web-ui 的 `dsh-tool-describe-image` | modlens 更成熟：6 内置引擎 + 4 本地 CLI 复用、失败链、多 harness、evals 脚手架 |
| 侧边栏工作台 | **better-sidebar**（右侧工作台）；**保留**核心 `ui-sidebar`（左侧会话栏，职责不冲突） | dsh-web-ui 的 `aionui-panel`（官方已弃用） | better-sidebar 是服务化框架，暴露 `ctx.betterSidebar` 供扩展 |
| 移动端远程 | **dsh-web-ui 的移动端远程**（SSE 配对，纯 Web 层） | desktop 的移动端远程 | 纯 Web 方案跨壳复用；桌面壳只负责起服务与窗口/托盘 |
| Agent preset（Liangshen） | **dsh-web-ui 的 Liangshen**（在本仓库 `apps/cli/config/agent-presets/` 新建一份规范目录） | dsh-TUI 内置副本 | 统一一份 preset，Web 与 TUI 共用 |

**保留（无重复）**：web-ui-all 聚合包自带的 task-board（任务看板）、git-graph（Git 图谱）、skin-center（皮肤中心）、pet（鲸鱼娘）、SSH 运维——全部保留。

**下线的执行方式**：
- 若下线项属于 web-ui-all 聚合包的子模块，则**不引用聚合包**，改为引用其**需要的子包**（例如引用 `dsh-liangshen`、`dsh-client-ui-task-board`、`dsh-ssh`、`dsh-pet`、`dsh-client-ui-skin-center`，但**不引用** `dsh-tool-describe-image`、`dsh-client-ui-aionui-panel`）；或引用聚合包后在 patch 层用 id-targeted `disabled: true` 关闭被下线的行。**具体二选一在 writing-plans 阶段依聚合包实际 export 结构确定**。

---

## 4. 分层架构（Architecture）

```
┌──────────────────────────────────────────────────────────────┐
│  L3 桌面壳 (Electron)  — deepseek-harness-desktop（外部仓库）      │
│     窗口 / 托盘 / 自动起本地服务 / 插件市场 / 更新                    │
│     以 npm 依赖引入本仓库发布的 dsh + fusion profile               │
│     （用 npm 依赖替代其原 git submodule 方式，见 §7 风险）           │
├──────────────────────────────────────────────────────────────┤
│  L2 融合层（本仓库内，新增 —— 唯一改动面）                           │
│   • packages/bundle/fusion/     新 bundle：cordis.patch.yml      │
│       insert 各外部插件行 + 下线项 disabled                        │
│   • apps/cli/config/agent-presets/liangshen/  新 preset          │
│   • profile 模板 fusion / fusion-tui（PROFILE_TEMPLATES 或文档化） │
│   • docs/ 融合使用与兼容性文档                                      │
├──────────────────────────────────────────────────────────────┤
│  L1 外部能力插件（npm 锁版本，NOT 并入源码）                         │
│   web-ui 子包 · better-sidebar · modlens · dsh-TUI               │
├──────────────────────────────────────────────────────────────┤
│  L0 dsh 核心（当前仓库 packages/* —— 零改动）                       │
│     base bundle · web-app bundle · client ui-* · session 等       │
└──────────────────────────────────────────────────────────────┘
```

**前端并行关系**：
- **Web / 桌面壳入口** → `fusion` profile（base + web-app + fusion bundle）→ 浏览器渲染 web-ui + better-sidebar + modlens。
- **终端入口** → `fusion-tui` profile（base + dsh-TUI Cordis patch）→ 终端渲染。
- 两者**共用** L0 base 与 §3 的 Liangshen preset；不同时渲染。

---

## 5. 组件设计（Components）

### 5.1 新 bundle：`@deepseek-ai/dsh-bundle-fusion`

- 位置：`packages/bundle/fusion/`
- `package.json`：
  - `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`
  - `dependencies`：**锁定版本**声明所有 L1 外部插件（精确版本号，非 `^`/`latest`）。
  - `private: true`（遵循仓库既有约定）。
- `cordis.patch.yml`：
  - `insert:` 追加 modlens、better-sidebar、web-ui 保留子包的行（bare 包名）；`dsh.client` 行进入浏览器 roster。
  - id-targeted `disabled: true` 关闭下线项（若来自聚合包）。
  - 依赖 web-app bundle 已 insert 的核心行在前（层序：base → web-app → fusion）。
- `tsconfig.json` / `src` / `tests`：遵循既有 bundle 包结构（`base`/`web-app` 为模板）；bundle 若需 runtime glue plugin 再加，否则纯 patch。

### 5.2 新 preset：`liangshen`

- 位置：`apps/cli/config/agent-presets/liangshen/agent.cordis.yml`
- 内容：从 dsh-web-ui 的 `dsh-liangshen` 提取 agent 组合（工具暴露的两阶段锚定、prompt 段），改写为本仓库 preset 目录格式。
- 约束：preset 只能携带"一个 agent 贡献给注册表的东西"；命名进程级全局服务的行会在 mount 时被拒绝——需核对 liangshen 不引入进程单例。

### 5.3 Profile 模板：`fusion` / `fusion-tui`

- 两种落地方式（writing-plans 决定）：
  - **A（文档化 profile）**：提供 `dsh plugin --profile fusion add ...` 的可复现脚本/文档，`dsh.profile.bundles = [base, web-app, fusion]`；`fusion-tui` = `[base]` + TUI patch。
  - **B（内置模板）**：扩展 `PROFILE_TEMPLATES` 让 `fusion`/`fusion-tui` 首次使用自动初始化。B 需改 `app-boot`（触碰 L2 边缘的启动机制），A 侵入性更小。**默认选 A**，除非需要"开箱即用"再评估 B。

### 5.4 桌面壳适配（L3，外部仓库改动，本方案只给契约）

- 桌面壳把对 dsh 的依赖从 **git submodule** 改为 **npm 依赖**（锁定本仓库发布版本），并在其内部 profile 指向 `fusion` 组合。
- 桌面壳的移动端远程**下线**，改由 web-ui 的移动端远程提供（桌面壳只负责起服务/窗口/托盘/更新/插件市场）。
- 注：桌面壳仓库的具体改动不在本仓库；本方案负责**发布可被消费的 dsh + fusion profile**并定义契约。

---

## 6. 数据流与集成契约（Data flow & contracts）

- **挂载解析链**：`fusion` bundle 的 patch `insert` bare 包名 → bundle `package.json` 锁版本 `dependencies` → `healProfilesModuleFallback` 扁平 node_modules symlink → Node 父级解析。任一未声明依赖 → boot fail-loud。
- **Web 插件进浏览器**：`dsh.client` 行被 modules 节点半扫描进 `window.__DSH_BOOT__`。better-sidebar 遵循"单 npm 包、host/client 双半"，host 提供 `/sidebar/api/*` 等路由 + trust fence，client 渲染 portal。
- **服务扩展点**：better-sidebar 暴露 `ctx.betterSidebar.registerTab/registerFileViewer`，其它插件（含 web-ui 子包）可注册 tab/viewer —— 这是"融合"协同的关键接缝。
- **视觉桥**：modlens 检测纯文本模型，拦截图像输入，经引擎失败链转写为结构化证据注入对话。
- **TUI**：`fusion-tui` profile 经 Cordis patch 消费 `session/event` 流做增量差分渲染；与 Web 共用 base 与 Liangshen preset。
- **模型可见 ⟺ 有日志**：任何到达模型请求的输入必须可从 session log 重建；本方案不新增模型可见输入（复用现成插件的既有事件）。

---

## 7. 失败模式与风险（Failure modes & risks）

### 7.1 头号风险：版本契约漂移（最高优先级）

5 个外部仓库各自面向**特定 dsh 版本**。兼容性调查确认 Desktop 固定的 upstream commit `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca`、better-sidebar `0.13.1`、dsh-TUI `0.8.3` 与 dsh-web-ui 当前插件线都以 dsh `0.1.0-rc.7` 为共同基线，因此实现分支必须从该官方提交开始。AGENTS.md 明确预发布阶段会有破坏性变更；升级任一侧时仍需重新验证 `ctx.betterSidebar`、slot 名与 `SlotMap`、`session/event` schema（`SESSION_FORMAT_VERSION`）及 `dsh.client` manifest。

**缓解（强制）**：方案必须包含**兼容性验证矩阵**（§8）：每个外部插件先**单独** `dsh plugin add` 起服务验证通过，再进入 `fusion` bundle 合并。为每个外部依赖记录"已验证兼容的 dsh 版本 + 外部包版本"锁定对。

### 7.2 其它风险

- **slot/service 抢占**：多个插件注册同名 slot 或 provide 同名 service → 去重（§3）已缓解主要冲突；合并后需扫描剩余同名注册。
- **桌面壳 submodule vs npm 二选一**：桌面壳原用 submodule 钉版本，改 npm 依赖后需确保版本锁定等价，且移动端远程去重不破坏其启动流程。
- **许可证合规**：外部包并入依赖需核对 LICENSE 与 `THIRD_PARTY_NOTICES.md`。
- **CJS/ESM**：本仓库 ESM everywhere；外部包若有 CJS-only export，在 tsx 源启动路径会失败——需核对。
- **preset 进程单例**：Liangshen preset 若引入进程全局服务行会被 mount 拒绝。

---

## 8. 验证策略（Testing）— 含既有功能回归

依 Superpowers「系统演进护栏」，把当前行为视为契约。

### 8.1 既有不变量清单（Invariant list，实现前必写）

以下既有用户路径**语义必须不变**（合并前后各验证一次）：
- 核心 Web 会话流：ui-conversation 的对话渲染、工具卡片。
- 左侧会话栏 `ui-sidebar`（New Session / 会话列表）—— 与 better-sidebar 右侧工作台并存不冲突。
- 会话 fork/resume/compact/export。
- Editor / Search / Settings / 模型选择等既有 `ui-*` 面板。
- headless / acp 入口不受 fusion 影响。

### 8.2 新增接入点（Attachment points）

仅在这些位置连接新能力，不侵入上述路径：
- `packages/bundle/fusion/cordis.patch.yml` 的 `insert`（新增行）。
- `ctx.betterSidebar` 服务的 tab/viewer 注册。
- `apps/cli/config/agent-presets/liangshen/`（新 preset 目录）。

### 8.3 回归矩阵（Regression matrix，宣称完成前逐项验证）

| 路径 | 验证方式 |
|---|---|
| 每个外部插件单独兼容 | 单独 `dsh plugin add` + 起 `dsh web` 冒烟，控制台无报错（用户规则：console 报错必须修） |
| fusion profile 组合 boot | 真实 boot（非纯单测），`assertEntriesActivated` 通过 |
| 去重生效 | describe-image / aionui-panel / desktop 移动端 确认未激活；无同名 slot/service 冲突 |
| 既有 Web 路径回归 | §8.1 逐项手动/自动验证语义不变 |
| TUI profile | `fusion-tui` 起终端，`session/event` 渲染正常 |
| Liangshen preset | Web 与 TUI 均能加载该 preset |
| 桌面壳 | Electron 起服务加载 fusion Web，托盘/窗口正常 |

### 8.4 测试层级（遵循仓库政策）

- **单测**：新 bundle 的 patch 解析、preset 结构（关键纯逻辑独立单测）。
- **REAL-composition**：产品可见插件需 boot test-only `cordis.yml` 过 Loader + app/process（`packages/AGENTS.md` 要求）。
- **snapshot**：若改动模型/用户可见输出，加 keyless snapshot。
- **e2e**：真实 API 行为（自跳过无 key）。
- **浏览器验证**：按用户规则用 Chrome + CDP（端口 9333），console 有错必修。

---

## 9. 交付里程碑（Milestones，供 writing-plans 细化）

1. **M0 兼容性验证**：逐个外部插件对本仓库 HEAD 单独验证，产出锁定版本对与不兼容清单。
2. **M1 融合 bundle**：新建 `packages/bundle/fusion/`，patch 挂载保留项 + 下线项 disabled，锁版本依赖。
3. **M2 Liangshen preset**：新建 preset 目录，Web 验证加载。
4. **M3 fusion profile**：文档化 profile（方案 A）+ 起 `dsh web` 全家桶冒烟（含 better-sidebar / modlens / task-board 等）。
5. **M4 fusion-tui profile**：TUI patch + 终端冒烟。
6. **M5 桌面壳契约**：定义并（在桌面壳仓库）落地 npm 依赖消费 + 移动端去重（本仓库侧只发布 + 文档）。
7. **M6 回归 + 文档**：§8.3 回归矩阵全绿；更新 README/docs/THIRD_PARTY_NOTICES。

---

## 10. 待定项（Open questions，进入 writing-plans 前收敛）

1. **profile 落地方式**：文档化（A，默认）vs 内置模板（B，需改 app-boot）。倾向 A。
2. **下线执行**：引用 web-ui 子包 vs 引用聚合包再 `disabled`——取决于聚合包 export 结构，M0 时确定。
3. **外部包精确版本**：M0 兼容性验证后锁定。
4. **桌面壳改动归属**：桌面壳为外部仓库，其内部改动是否在本次交付范围，还是仅提供契约 + 发布物。倾向"本仓库只发布 + 定契约"。

---

## 附录 A：涉及的本仓库关键路径

- Bundle 机制：[`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)、[`web-app/cordis.patch.yml`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/web-app/cordis.patch.yml)
- Profile/boot：[`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)
- Preset：[`packages/preset/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/preset/README.md)、[`apps/cli/config/agent-presets/`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/config/agent-presets)
- Client slot：[`packages/client/AGENTS.md`](file:///Users/bytedance/opencode/agent/dsh/packages/client/AGENTS.md)、[`ui-sidebar`](file:///Users/bytedance/opencode/agent/dsh/packages/client/ui-sidebar)

# DSH 五仓库融合技术方案（设计文档 v2）

- 日期：2026-08-19（v1）／2026-08-20（v2 优化）
- 状态：v2 已依"上一轮失败根因"重写，待进入 writing-plans 执行
- 备注：本文档为规划/规约文档，**不纳入 git 仓库**（用户规则：plan/spec 文档不加入 git）。
- v2 变更摘要：修正**不可满足的兼容判据**（根因）、修正 **in-repo bundle 携带第三方依赖污染仓库根**的结构缺陷、把 sidebar/TUI 从"必过阻塞"改为"分阶段门控扩展"、明确桌面壳只做契约。

---

## 0. 一页速览（TL;DR）

把 DeepSeek Harness 核心（`dsh`，`0.1.0-rc.5`）与 5 个外部仓库融合：

| # | 仓库 | 形态 | 核心能力 |
|---|---|---|---|
| 1 | `deepseek-harness-desktop` | Electron 桌面壳 | 窗口/托盘/自动起服务/插件市场/移动端远程 |
| 2 | `liustack/modlens` | 视觉桥插件 | 让纯文本模型"看见"图像，多引擎失败链 |
| 3 | `zhu1090093659/dsh-web-ui` | Web 插件+皮肤生态 | Liangshen 预设/任务看板/Git 图谱/移动端远程/SSH/宠物/皮肤中心 |
| 4 | `ccch1mneyyy/dsh-TUI` | 终端 UI | React→Ink/Yoga 的 Claude-Code 风格 TUI |
| 5 | `omdsh-dev/DSH-better-sidebar` | 侧边栏工作台 | `ctx.betterSidebar` 服务：文件/编辑器/浏览器/终端/Git |

**融合 = 组合与策展，不是重写**：这 5 个仓库都按"一切皆插件、不改 dsh 源码"设计，经 `dsh --profile` 挂载。

**四项决策（v1，保留）**：统一 Profile/Bundle 组合；桌面壳+Web 全家桶为主、TUI 并行；每类能力选一个规范实现去重；npm 锁版本纳入。

**改动边界**：本仓库改动**只集中在 L2**（一个新 bundle + 一个 preset + 组合脚本/文档 + 文档），**L0 核心 `packages/*` 零改动**。

---

## 1. 上一轮为什么无法完成（根因分析 —— v2 新增，最重要）

上一轮执行 20+ 轮后 Task 0/0A 永久 `BLOCKED`，Tasks 1-9 从未启动。用 systematic-debugging 定位到**两条构造性缺陷**，都在 v1 方案内部，不是外部环境问题。

### 1.1 根因 A：兼容判据在构造上不可满足

v1 把"与 rc.5 兼容"隐式定义为——**外部包发布的 `peerDependencies` 里 `@deepseek-ai/dsh-*` 的 semver 范围必须包含 `0.1.0-rc.5`**。这个判据永不可能通过：

- 外部生态已面向 rc.6/rc.7/rc.8 发版：`dsh-better-sidebar` 全部 12 个可安装版本 0/178 条 dsh peer 声明接受 rc.5；`@deepseek-harness-tui/dsh-tui` 全部 16 个版本 0/169 接受 rc.5。
- rc.5 被 spec 硬约束"不得升级核心"冻结。
- `^0.1.0-rc.N` 预发布 semver 天然排除更低的预发布号（rc.5 < rc.6），且不会有人为旧 rc 重新发版。
- 于是这个门**永远红**；而 Task 0A 的完成条件（"上游发布接受 rc.5 的版本"）把整条链挂在**一件不会发生的第三方行为**上 → 无限轮询。

**关键反证：这不是真实的运行时不兼容。** 上一轮的运行时负控证明这些包在 rc.5 上能干净运行：

| 包 | rc.5 上的实际运行时结果 |
|---|---|
| modlens `3.18.3`（无 dsh peer） | 隔离安装 + Web boot + Chrome CDP console 全干净 → PASS |
| web-ui 子包 `0.1.13`–`0.2.4`（声明无 dsh peer） | rc.5 可安装、可 profile 组合、dump-config 行齐 |
| better-sidebar `0.14.0`（声明 rc.8 peer） | 通过 web-ui-all 挂载，真实 boot，Chrome console **干净**；手动挂 `0.10.0` 也能 boot |
| dsh-TUI `0.8.5`（声明 rc.7 peer） | 真实终端**实际渲染**（顶栏/输入区/模型行），仅打印 "upstream drift" 警告，未崩溃 |

**判据量错了对象**：拿"发布元数据字符串"当兼容 oracle，而不是"在本运行时实际启动是否干净"。

### 1.2 根因 B：in-repo bundle 携带第三方依赖会污染仓库根（v1 未发现）

v1 的 Task 2 要求把 modlens/sidebar/web-ui 的**精确第三方依赖写进 `packages/bundle/fusion/package.json` 的 `dependencies`**，然后在仓库根 `pnpm install`。但：

- `packages/*/*` 是根 `pnpm-workspace.yaml` 的 workspace glob → fusion 的第三方依赖树（react18/univer/codemirror/xterm/ssh2/cloudflared/node-pty…）会被拉进**仓库根 `node_modules`**。
- 根 `allowBuilds` 只放行 `node-pty`，**显式拒绝 `protobufjs`**，且**不含 `cloudflared`/`cpu-features`/`ssh2`**（上一轮 profile 安装时必须现加这些 allowBuilds）。`strictDepBuilds` 默认为硬错 → 根 install 会失败或被门拒。
- 还会连带污染 `knip`/`publint`/`constraints`/`verify-dsh-package-licenses`/`THIRD_PARTY_NOTICES`，并可能把 React 18 混入发布 React 19 的仓库。

而 dsh 的**设计本意**是：外部插件装进 `$DSH_HOME/profiles/<name>/node_modules`（profile 自带独立 pnpm 安装根，有自己的 `pnpm-workspace.yaml`/`allowBuilds`），**不进仓库**。v1 把"仓库工作区"与"profile 安装根"两种模型混用了。

### 1.3 次生缺陷

1. **二元 oracle 无中间态**：没有"能干净运行但声明了更新 peer"这条路径。
2. **Task 0A 挂在外部行为**上 → 死循环，无自主可解杆。
3. **rc.5 基线从未对照生态现实校验**：唯一能解锁的杠杆（判据定义/基线）被先验排除。
4. **桌面壳其实没被融合**：v1 也是"仅契约"，第 5 个仓库仍是 submodule 钉版本，与"五仓库融合"标题不符（v2 明确它是契约层，不是本次可运行交付的一部分）。
5. **TUI 结构性问题未与 peer 问题分离**：自带 Liangshen 副本、根 manifest 7 项 + 全包 22 项 `workspace:*` 运行时泄漏、React 18 vs 19；这些是**独立于 peer 门**的真实风险，v1 混为一谈。
6. **计划自相矛盾**：Task 0 Step 4 用 `latest` 却在 Global Constraints 里"禁 latest"。

---

## 2. v2 核心修正：兼容判据改为"运行时经验判据"

**新判据（Runtime-Experience Oracle）**：一个外部包精确版本"与 rc.5 兼容"当且仅当，在隔离 `$DSH_HOME` profile 中：

1. `dsh plugin --profile <p> add <pkg>@<exact>` 安装成功（profile 自带 `allowBuilds` 放行该包必需的构建脚本）；
2. profile 组合解析通过（`dsh --profile <p> --dump-config` 出全部预期行）；
3. 目标前端**实际启动**：Web 走 Chrome CDP(9333) 打开、**console 无 error**；TUI 走真实 PTY 渲染、**终端无崩溃**；
4. 该前端**目标能力真实出现**（modlens 图像入口 / sidebar 工作台 tab / web-ui 看板皮肤宠物 / TUI 顶栏输入区往返）。

**对"声明 peer 漂移"的处理**：包声明的 `@deepseek-ai/dsh-*` peer 若不含 rc.5，**记录为已知警告**并用 profile 的 `pnpm.overrides` 或 `--config` 强校验（peer 仅是安装期提示，不是运行期契约）；只要上述 1–4 全绿即判 PASS，并在兼容矩阵注明"peer 声明 vs 实测"差异与所用覆盖。

**版本选择规则（保留 v1 精神，修正判据）**：优先选**能通过运行时判据的最高精确版本**；仍**禁 `^`/`~`/`latest`**。若同一包多个版本都能干净运行，选最新可运行版本，并记录其声明 peer。

**判据边界（诚实性）**：运行时判据证明"在本机 rc.5 + 该 profile 组合下能启动且目标能力可见"，**不证明**跨平台、长期 API 稳定或所有交互路径无缺陷——这些仍靠回归矩阵（§8）与 dsh 升级时重跑矩阵覆盖。

---

## 3. 去重：规范实现选择（Canonical picks，v1 保留）

| 能力 | canonical 选择 | 下线项 | 理由 |
|---|---|---|---|
| 图像理解/视觉 | **modlens** | web-ui 的 `dsh-tool-describe-image` | modlens 更成熟：多内置引擎 + 本地 CLI 复用 + 失败链 |
| 侧边栏工作台 | **better-sidebar**（右侧）；**保留**核心 `ui-sidebar`（左侧会话栏，职责不冲突） | web-ui 的 `aionui-panel`（官方已弃用） | better-sidebar 暴露 `ctx.betterSidebar` 供扩展 |
| 移动端远程 | **web-ui 的移动端远程**（`dsh-remote-web-ui`，纯 Web 层） | desktop 的移动端远程 | 纯 Web 方案跨壳复用 |
| Agent preset（Liangshen） | **web-ui 的 Liangshen**（本仓库新建规范 preset 目录） | dsh-TUI 内置副本 | 统一一份，Web/TUI 共用 |

**保留（无重复）**：task-board、git-graph、skin-center、pet、SSH。

**下线执行方式（v2 依上一轮实测收敛）**：web-ui 子包**可独立安装**（`0.1.13`–`0.2.4` 声明无 dsh peer），因此采用**策略 A：只引用需要的子包**（`@linxin666/dsh-liangshen`＝preset 源、`dsh-client-ui-task-board`、`dsh-ssh`、`dsh-remote-web-ui`、`dsh-pet`、`dsh-client-ui-skin-center`），**不引用** `dsh-tool-describe-image`、`dsh-client-ui-aionui-panel`，也不引用聚合包 `dsh-web-ui-all`（它额外挂 11 个未要求行 + DOM shim + 装 196 个包）。这条已被上一轮实测确认可行，v2 不再保留"聚合包+disable"的 B 分支为默认。

---

## 4. 分层架构（v2 修正 bundle 组织方式）

```
┌──────────────────────────────────────────────────────────────┐
│  L3 桌面壳 (Electron) — deepseek-harness-desktop（外部仓库）        │
│     本次仅定义"以 npm 依赖消费 dsh + fusion profile"的契约          │
│     不改外部仓库、不作为本次可运行交付                              │
├──────────────────────────────────────────────────────────────┤
│  L2 融合层（本仓库内，唯一改动面）                                  │
│   • packages/bundle/fusion/  纯 patch bundle（cordis.patch.yml   │
│       + invariant + README），**不在自身 package.json 携带第三方   │
│       runtime 依赖**（见 §5.1，避免污染仓库根）                     │
│   • apps/cli/config/agent-presets/liangshen/  新 preset          │
│   • fusion / fusion-tui profile 组合脚本 + 文档（方案 A）           │
│   • docs/ 融合使用文档（双语）                                     │
├──────────────────────────────────────────────────────────────┤
│  L1 外部能力插件（npm 锁版本，装进 $DSH_HOME profile，NOT 仓库）     │
│   modlens · web-ui 子包 · better-sidebar（阶段2） · dsh-TUI（阶段2）│
├──────────────────────────────────────────────────────────────┤
│  L0 dsh 核心（当前仓库 packages/* —— 零改动）                       │
└──────────────────────────────────────────────────────────────┘
```

**前端并行关系**：Web/桌面壳 → `fusion` profile（base + web-app + fusion patch + profile 内装的外部子包）；终端 → `fusion-tui` profile（base + dsh-TUI）。两者共用 L0 base 与 Liangshen preset，不同时渲染。

---

## 5. 组件设计（Components，v2 修正）

### 5.1 新 bundle：`@deepseek-ai/dsh-fusion`（纯 patch，**不携带第三方 runtime 依赖**）

- 位置：`packages/bundle/fusion/`。
- **关键修正（根因 B）**：fusion 的 `package.json` **只声明 workspace peer/dev 依赖**（`@deepseek-ai/dsh-invariants`、`@deepseek-ai/cordis`），**不把 modlens/sidebar/web-ui 写进 `dependencies`**——否则根 `pnpm install` 会把第三方树拉进仓库根并撞 `strictDepBuilds`。外部包的精确版本由**profile 组合步骤**（§5.3）用 `dsh plugin add pkg@exact` 装入 profile，兼容矩阵是版本锁定的记录。
- `cordis.patch.yml`：`insert:` 追加 modlens、web-ui 保留子包（阶段1）与 better-sidebar（阶段2）的行（bare 包名）；`dsh.client` 行进浏览器 roster；下线项**不引用即不激活**（不必 `disabled`，因为采用子包策略）。
- 结构照 base bundle 最小形态：`src/index.ts`（空导出）+ `src/invariant.ts`（空 installer + 包特定 `No runtime invariant:` 理由）+ `tsconfig.json` + `README.md/.zh.md/.i18n.yaml` + `tests/`。
- **ergonomic 取舍**：因 fusion 不携带第三方 deps，消费者需按组合脚本对 profile 逐个 `dsh plugin add`（或用本仓库提供的组合脚本）；这换来仓库根安装干净、hygiene 不破。与 modlens/web-ui/sidebar 现有安装方式一致。

### 5.2 新 preset：`liangshen`

- 位置：`apps/cli/config/agent-presets/liangshen/`（`preset.yml` + `agent.cordis.yml`）。
- 内容：从 web-ui 的 `@linxin666/dsh-liangshen`（兼容矩阵锁定版本）提取 agent 组合（两阶段工具锚定 + prompt 段），以 `standard` preset 为基底逐行改写。
- 约束：preset 只能携带 agent-plane 贡献；任何 provide 服务的 row 必须在带 `isolate` realm 的 `cordis:group` 内，否则 mount 被拒。需核对 liangshen 不引入进程单例；若引入则降级或改由 host 组合。

### 5.3 Profile 组合：`fusion` / `fusion-tui`（方案 A：脚本+文档，不改 app-boot）

- **方案 A（默认，侵入性最小）**：提供可复现的组合命令/脚本：
  - `fusion` = `dsh plugin --profile fusion add @deepseek-ai/dsh-web-app @deepseek-ai/dsh-fusion` + 各外部子包精确版本；`dsh.profile.bundles = [base, web-app, fusion]`，外部子包在 profile `dependencies`。
  - `fusion-tui` = `dsh plugin --profile fusion-tui add @deepseek-harness-tui/dsh-tui@<exact>`（阶段2）。
- **方案 B（内置模板）**：扩展 `PROFILE_TEMPLATES` 让 fusion 首次使用自动初始化——需改 `app-boot`（触碰 L2 边缘启动机制），**不做**，除非用户要"开箱即用"。

### 5.4 桌面壳（L3，契约层，非本次运行交付）

- 本仓库只**发布可被 npm 消费的 dsh + fusion profile**，并写一份消费契约文档：桌面壳以锁定 npm 依赖替代 submodule、内部 profile 指向 fusion、移动端远程由 web-ui 提供（桌面壳自身移动端下线）、桌面壳保留窗口/托盘/自动起服务/更新/插件市场。
- 桌面壳仓库自身改动**不在本次交付**（用户第 3 问默认取此边界）。

---

## 6. 数据流与集成契约（v1 保留 + v2 校正）

- **挂载解析链**：fusion patch 的 bare 包名 → **profile `package.json` 锁版本 dependencies**（由组合脚本 `dsh plugin add` 写入，非仓库）→ `healProfilesModuleFallback` 扁平 node_modules symlink → Node 父级解析。任一 profile 未安装的行 → boot fail-loud。
- **Web 插件进浏览器**：`dsh.client` 行被 modules 节点扫描进 `window.__DSH_BOOT__`；better-sidebar host 半提供 `/sidebar/api/*` 路由 + trust fence，client 半渲染 portal。
- **服务扩展点**：`ctx.betterSidebar.registerTab/registerFileViewer` 是协同接缝。
- **视觉桥**：modlens 检测纯文本模型、拦截图像、经引擎失败链转写结构化证据注入对话。
- **模型可见 ⟺ 有日志**：不新增模型可见输入（复用现成插件既有事件）。

---

## 7. 失败模式与风险（v2 更新）

### 7.1 头号风险仍是版本契约漂移——但缓解从"peer 门"改为"运行时门 + 锁定对"

外部包面向更新 rc 发布，其运行期真实契约（`ctx.betterSidebar`、slot 名/`SlotMap`、`session/event` schema、`dsh.client` 语义）**可能**与 rc.5 HEAD 不符 → boot fail-loud 或 UI 不渲染。**缓解（强制）**：§2 运行时判据逐包单独验证；每个外部依赖记录"实测可运行的 dsh 版本 + 外部包精确版本 + 声明 peer + 所用 override"锁定对；dsh 升级时重跑矩阵。

### 7.2 其它风险

- **仓库根污染（根因 B）**：由 §5.1"fusion 不携带第三方 runtime 依赖"消除。
- **profile 安装的构建脚本门**：外部包需 `cloudflared`/`cpu-features`/`ssh2`/`node-pty` 等 build script → 在 **profile 自己的** `pnpm-workspace.yaml.allowBuilds` 放行（不动仓库根）。组合脚本需带上这些精确 allowBuilds 项。
- **TUI 结构性缺陷（与 peer 分离）**：dsh-TUI `0.8.5` 根 manifest 7 项 + 全包 22 项 `workspace:*` 运行时泄漏（靠 bundledDependencies 才装上）、React 18 vs 仓库 React 19、自带 Liangshen 副本（会与本仓库 preset 抢 `.agent-presets/liangshen` 目录所有权）。阶段2 单独评估：TUI 能渲染但这些是真实交付风险，若无法用锁定版本干净消费则如实标注为阶段2阻塞，不拖垮阶段1。
- **slot/service 抢占**：去重后合并需扫描剩余同名注册。
- **CJS/ESM**：外部包若 CJS-only export 在 tsx 源启动会失败——运行时判据会暴露。
- **许可证合规**：外部包纳入 profile 需核对 LICENSE；因不进仓库发布物，`THIRD_PARTY_NOTICES` 影响限于 fusion 自身（纯 patch，无第三方 runtime dep）。

---

## 8. 验证策略（v1 保留 + v2 加"分阶段门控"）

### 8.1 既有不变量清单（实现前必写，语义必须不变）

阶段 1 只回归既有 `base + web-app` 用户路径：核心 Web 会话流（ui-conversation 对话渲染、工具卡片）；左侧 `ui-sidebar`（New Session/会话列表）；会话 fork/resume/compact/export；Search/Settings/模型选择；headless/acp 入口不受 fusion 影响。右侧 Files/Web Editor/Terminal/Git 工作台由阶段 2 Task 7 的 better-sidebar 提供，不是阶段 1 或 Task 5 的验收项。

### 8.2 新增接入点（只在此连接，不侵入上述路径）

阶段 1 接入点是 `packages/bundle/fusion/cordis.patch.yml` 的 `insert` 与 `apps/cli/config/agent-presets/liangshen/`；阶段 2 Task 7 才接入 `ctx.betterSidebar` tab/viewer 注册。

### 8.3 回归矩阵（宣称完成前逐项验证）

| 路径 | 验证方式 |
|---|---|
| 每个外部包单独运行时兼容 | §2 运行时判据（隔离 profile + boot + console/终端 + 目标能力可见） |
| fusion profile 组合 boot | 真实 boot，`assertEntriesActivated` 通过 |
| 去重生效 | describe-image/aionui-panel/desktop 移动端 未激活；无同名 slot/service 冲突 |
| 既有 Web 路径回归 | §8.1 逐项验证语义不变 |
| Liangshen preset | Web（阶段1）与 TUI（阶段2）均能加载 |
| headless/acp 隔离 | fusion 不污染其它 profile |

### 8.4 测试层级（遵循仓库政策）

单测（patch 解析、preset 结构等纯逻辑）；REAL-composition（产品可见插件 boot test-only `cordis.yml` 过 Loader + app/process，`packages/AGENTS.md` 要求）；snapshot（若改模型/用户可见输出，keyless）；e2e（真实 API，无 key 自跳过）；浏览器验证（Chrome+CDP 9333，console 有错必修）。

---

## 9. 分阶段交付（v2 核心结构变化：先核心后扩展）

用户决策：**分阶段——先核心后扩展**，避免一处阻塞拖垮整体。

**阶段 1（本次主交付，全部可用运行时判据验证）**：
- M0 运行时兼容矩阵：modlens、web-ui 保留子包、Liangshen preset 源，用 §2 判据锁定精确版本。
- M1 fusion bundle 骨架（纯 patch，不携带第三方 dep）。
- M2 fusion patch 挂载 modlens + web-ui 保留子包（策略 A）。
- M3 Liangshen preset。
- M4 fusion profile 组合脚本 + Web 全家桶冒烟（Chrome CDP，含 task-board/skin-center/pet/modlens）。
- M5 既有功能回归矩阵 + 去重验证。
- M6 桌面壳消费契约文档 + fusion 发布物检查。

**阶段 2（门控扩展，阶段1全绿后进入）**：
- better-sidebar 用运行时判据锁定精确版本 → 并入 fusion patch → Web 冒烟验证右侧工作台。
- dsh-TUI 用运行时判据 + 结构缺陷评估（§7.2）→ fusion-tui profile + 终端冒烟。
- 任一在阶段2无法用锁定版本干净消费 → 如实标注为该项阻塞，**不回滚阶段1 已交付部分**。

**里程碑与任务映射**：见执行计划 `2026-08-19-dsh-five-repo-fusion.md`。

---

## 10. 已收敛的原待定项

1. **profile 落地**：方案 A（脚本+文档），不改 app-boot。
2. **下线执行**：策略 A（引用子包），上一轮实测子包可独立安装。
3. **外部包精确版本**：由阶段1/2 的运行时判据锁定，写入兼容矩阵。
4. **桌面壳归属**：本仓库只发布 + 定契约（用户第 3 问默认）。
5. **兼容 oracle**：运行时经验判据（用户第 1 问选定）。
6. **sidebar/TUI 范围**：分阶段（用户第 2 问选定）。

---

## 附录 A：本仓库关键路径

- Bundle 机制：[`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)、[`base/`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/base)（纯 patch bundle 模板，无第三方 dep）
- Profile/boot：[`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)
- Preset：[`packages/preset/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/preset/README.md)、[`standard/`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/config/agent-presets/standard)
- 组合脚本参考：[`apps/cli/src/plugin.ts`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)（`runPlugin`/`reconcilePlugins`）
- workspace 约束：根 [`pnpm-workspace.yaml`](file:///Users/bytedance/opencode/agent/dsh/pnpm-workspace.yaml)（`allowBuilds`/`strictDepBuilds`——根因 B 的门）

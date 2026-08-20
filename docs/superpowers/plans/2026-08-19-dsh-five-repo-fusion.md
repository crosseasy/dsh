# DSH 五仓库融合 Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐 Task 执行。步骤用 checkbox（`- [ ]`）跟踪。
> **v2 依据**：本计划按设计文档 v2（`docs/superpowers/specs/2026-08-19-dsh-five-repo-fusion-design.md`）重写，修正了上一轮永久 BLOCKED 的两条根因。执行前先读设计文档 §1（根因）与 §2（运行时判据）。

**Goal:** 用一个纯 patch bundle（`@deepseek-ai/dsh-fusion`）+ 一个 `liangshen` preset + 一组 profile 组合脚本，把 modlens、dsh-web-ui 保留子包（阶段1）与 better-sidebar、dsh-TUI（阶段2）以**运行时判据锁定的精确 npm 版本**组合进 dsh，并为 deepseek-harness-desktop 提供消费契约；dsh 核心 `packages/*` 零改动。

**Architecture:** 改动只落在 `packages/bundle/fusion/`（纯 patch，**不携带第三方 runtime 依赖**）、`apps/cli/config/agent-presets/liangshen/`、组合脚本与 `docs/`。外部包精确版本装进 `$DSH_HOME/profiles/<name>/node_modules`（profile 自带安装根），**不进仓库工作区**。

**Tech Stack:** TypeScript (ESM only)、pnpm workspaces、Cordis 插件加载器、dsh profile/bundle/patch、vitest、Chrome+CDP(9333) 与真实 PTY 冒烟。

---

## Global Constraints（每个 Task 隐含包含）

- **L0 核心 `packages/*` 零改动**：改动只允许出现在 `packages/bundle/fusion/`、`apps/cli/config/agent-presets/liangshen/`、`docs/`，以及必要构建/hygiene 注册点（`tsconfig.host.json`、`knip.json`）。
- **兼容判据 = 运行时经验判据（设计 §2）**：一个精确版本"兼容 rc.5"当且仅当在隔离 profile 中安装成功 + 组合解析通过 + 目标前端实际启动（Web console 无 error / TUI 终端无崩溃）+ 目标能力真实可见。**声明 peer 不含 rc.5 不构成阻塞**，记录为已知警告 + 所用 override。
- **精确版本，禁 `^`/`~`/`latest`**：所有外部包写精确版本；矩阵是版本锁定记录。（修正 v1 Task 0 用 `latest` 的矛盾。）
- **fusion bundle 不携带第三方 runtime 依赖（根因 B）**：`packages/bundle/fusion/package.json` 只声明 workspace peer/dev（`@deepseek-ai/dsh-invariants`、`@deepseek-ai/cordis`）；外部包由组合脚本装进 profile。
- **构建脚本门在 profile 层放行**：外部包需要的 `allowBuilds`（如 `cloudflared`/`cpu-features`/`ssh2`/`node-pty`）写进 **profile 自己的** `pnpm-workspace.yaml`，**不动仓库根**。
- **每个包拥有 `./invariant`**：fusion 有 `src/invariant.ts`，空 installer + 包特定 `No runtime invariant:` 理由。
- **ESM everywhere**；文件结尾恰好一个换行（`git diff --cached --check` 把关）。
- **命令执行 < 1 分钟**（用户规则）；长任务后台运行并轮询。
- **plan/spec/矩阵/回归记录不入 git**（用户规则）：`docs/superpowers/**` 与 `.trae/specs/**` 不 `git add`。
- **git commit/push/merge/rebase/reset 需用户许可**（用户规则）：无许可时以"暂存变更 + 报告"替代，不自行提交。
- **console 报错必须修**（用户规则）：浏览器冒烟 console 出错先修再继续。
- **浏览器统一用独立 Chrome + CDP 9333**（用户规则），禁 IDE 内置浏览器。
- **分阶段（设计 §9）**：阶段1（核心）全绿后才进阶段2（sidebar/TUI）；阶段2 任一阻塞不回滚阶段1。

---

## 关键路径参考（实现者先读）

- 设计文档：`docs/superpowers/specs/2026-08-19-dsh-five-repo-fusion-design.md`（§1 根因、§2 判据、§5 组件）
- 纯 patch bundle 模板：[`packages/bundle/base/`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/base)（**无第三方 dep 的 bundle**，比 headless 更贴合 fusion）
- Bundle 机制：[`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)
- Profile/boot：[`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)
- `dsh plugin` 组合：[`apps/cli/src/plugin.ts`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)（`runPlugin`→pnpm→`reconcilePlugins`）
- Preset 模板：[`standard/`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/config/agent-presets/standard)
- 构建注册点：`tsconfig.host.json` bundle references、`knip.json` bundle ignoreDependencies
- workspace 门：根 [`pnpm-workspace.yaml`](file:///Users/bytedance/opencode/agent/dsh/pnpm-workspace.yaml)（`allowBuilds`——不要在此加外部包）
- 上一轮证据：`docs/superpowers/plans/fusion-compat-matrix.md`（Round 1-21，含各包实测结果）

---

## 阶段 1：核心可运行交付

### Task 0（M0）：运行时兼容矩阵 —— 阶段1 外部包

**目的**：用运行时判据（设计 §2）逐个验证阶段1外部包对 rc.5 HEAD 的可运行性，锁定精确版本对。不改仓库源码，产出验证记录（不入 git）。

**Files:** Modify: `docs/superpowers/plans/fusion-compat-matrix.md`（追加 Round 22 阶段1锁定结论；已存在，勿整文件覆盖）

**Interfaces:** Produces `COMPAT[pkg] = { exactVersion, declaredDshPeer, runtime: 'pass'|'blocked', profileAllowBuilds[], notes }` → Task 2/3 版本来源。

- [ ] **Step 1: 构建仓库产物**（后台）
```bash
pnpm install && pnpm run build
```
Expected: build 成功，`packages/*/lib` 就绪。

- [ ] **Step 2: modlens 运行时判据**
```bash
DSH_HOME=$(mktemp -d) pnpm dsh plugin --profile web add @liustack/modlens@3.18.3
```
起 `dsh --profile web`，Chrome CDP 9333 打开 `http://127.0.0.1:3080`，记录：安装/组合/console error/图像入口可见。停服务。（上一轮：PASS。）

- [ ] **Step 3: web-ui 保留子包运行时判据（精确版本，禁 latest）**

对每个子包在独立 `$DSH_HOME` 单独 `dsh plugin --profile web add <pkg>@<exact>`，按需在 profile 的 `pnpm-workspace.yaml` 加 `allowBuilds`（`cloudflared`/`cpu-features`/`ssh2`），起 web 冒烟：
```
@linxin666/dsh-liangshen@<exact>            # preset 源，仅读取不挂 bundle 行
@linxin666/dsh-client-ui-task-board@<exact>
@linxin666/dsh-ssh@<exact>
@linxin666/dsh-remote-web-ui@<exact>
@linxin666/dsh-pet@<exact>
@linxin666/dsh-client-ui-skin-center@<exact>
```
每个记录运行时判据四项。（上一轮：`0.2.4` 系列声明无 dsh peer、可独立安装、组合通过。）

- [ ] **Step 4: 确认下线子包不引用**

确认 `@linxin666/dsh-tool-describe-image`、`@linxin666/dsh-client-ui-aionui-panel` 不进 fusion；确认不引用聚合包 `dsh-web-ui-all`（它额外挂 11 行 + DOM shim）。

- [ ] **Step 5: 写入矩阵 Round 22（阶段1）**

追加阶段1锁定表：`包名 | 精确版本 | 声明 dsh peer | 运行时判据 | profile allowBuilds | 备注`。**勿整文件覆盖**（该文件是 append-only 执行记录，历史 Round 有价值）。

- [ ] **Step 6: 报告**（不 commit，矩阵不入 git）

向用户报告阶段1锁定版本对。若某保留子包运行时判据失败 → 标注该项，其余继续。

---

### Task 1（M1）：创建 `@deepseek-ai/dsh-fusion` bundle 骨架（纯 patch，无第三方 dep）

**目的**：最小可加载骨架，接入构建/hygiene 注册点。交付"能 build/typecheck、还没挂外部插件"的空 bundle。

**Files:** Create `packages/bundle/fusion/{package.json,cordis.patch.yml,src/index.ts,src/invariant.ts,tsconfig.json,README.md,README.zh.md,README.i18n.yaml,tests/fusion.spec.ts}`；Modify `tsconfig.host.json`、`knip.json`。

- [ ] **Step 1: package.json（以 base bundle 为模板，不含第三方 dependencies）**

`name: @deepseek-ai/dsh-fusion`、`version: 0.1.0-rc.5`、`type: module`、`dsh.bundle.patch: ./cordis.patch.yml`、`exports` 含 `./invariant`/`./cordis.patch.yml`/`./package.json`、`files` 含 `lib/invariant.js`/`cordis.patch.yml`/`lib/types`。**依赖只有 workspace peer/dev**：`@deepseek-ai/dsh-invariants`、`@deepseek-ai/cordis`。**不写 modlens/sidebar/web-ui**（根因 B）。参考 base bundle 是否需要 `main`/`src/index.ts`。

- [ ] **Step 2: cordis.patch.yml 空占位**

顶层注释说明"外部插件行在 Task 2 落地，采用子包策略、下线项不引用即不激活"；先 `- insert: []`（若解析器拒空则放一条注释 + Task 2 补首行）。

- [ ] **Step 3: src/invariant.ts**

照 base bundle：`name='fusion-invariant'`、`inject=['invariants']`、空 installer 带包特定 `No runtime invariant:` 理由（纯 patch 层、无 mutable relation）、`apply` 注册。

- [ ] **Step 4: tsconfig.json**

`extends ../../../tsconfig.base.json`、`rootDir: src`、`outDir: lib/types`、references 到 `vendor/cordis` + `runtime-diagnostics/invariants`。

- [ ] **Step 5: README 三件套（英/中/i18n sidecar）**

含 consumer 契约、`## Model Experience`（indirect + KV Cache effect）、`## Known Limitations and Deferred Work`（profile 组合非内置模板、外部版本锁定需重跑矩阵、桌面壳仅契约、fusion 不携带第三方 dep 需逐个 profile add）。遵循 `docs/cookbook/adding-a-package.md#4` 结构。

- [ ] **Step 6: REAL-composition 冒烟测试**

`tests/fusion.spec.ts`：断言 manifest `dsh.bundle.patch` 与 patch 可被解析。优先用仓库既有 `loadOptionalPatches`（`@deepseek-ai/dsh-app-boot`）而非直接 `js-yaml`，更贴近真实加载路径。

- [ ] **Step 7: 注册 tsconfig.host.json**（bundle references 区按字母序插 `{ "path": "./packages/bundle/fusion" }`）

- [ ] **Step 8: 注册 knip.json**（`packages/bundle/fusion` 的 `ignoreDependencies`，因 patch 里 bare 外部包名 knip 检测不到——但因 fusion 不在 package.json 声明它们，此处主要覆盖 workspace 名；核对是否真需要，避免无用忽略）

- [ ] **Step 9: 验证**（各 < 1 分钟）
```bash
pnpm --filter @deepseek-ai/dsh-fusion test
pnpm run typecheck
pnpm run hygiene
```
Expected: fusion.spec 通过；typecheck/hygiene 无 fusion 相关错误。

- [ ] **Step 10: 暂存 + 报告**（commit 需用户许可）

---

### Task 2（M1）：fusion patch 挂载 modlens + web-ui 保留子包（策略 A）

**目的**：把 Task 0 锁定的阶段1外部插件写入 fusion patch 的 `insert`（bare 包名 + `dsh.client` 行）；下线项不引用即不激活。

**Files:** Modify `packages/bundle/fusion/cordis.patch.yml`、`packages/bundle/fusion/tests/fusion.spec.ts`。（**不改 package.json 加第三方 dep**——根因 B。）

- [ ] **Step 1: 写失败测试**

断言 patch `insert` 含 `modlens`、`better-sidebar` 之外的阶段1保留 row id（task-board/ssh/remote-web-ui/pet/skin-center），且**不含** describe-image/aionui-panel/web-ui-all。用 Task 0 记录的真实 row id。

- [ ] **Step 2: 运行确认失败**
```bash
pnpm --filter @deepseek-ai/dsh-fusion test
```

- [ ] **Step 3: 写 patch insert 行（策略 A，真实 id/包名以矩阵为准）**

`insert:` 追加 modlens + 保留 web-ui 子包的 bare 包名行；Web 插件的 `dsh.client` 由各包 manifest 自带，不臆造额外行。注释注明 Liangshen 走 preset（Task 3）不走 bundle row。

- [ ] **Step 4: 运行确认通过 + hygiene**
```bash
pnpm --filter @deepseek-ai/dsh-fusion test
pnpm run hygiene
```

- [ ] **Step 5: 暂存 + 报告**（commit 需许可）

---

### Task 3（M2）：新建 `liangshen` preset

**目的**：把 web-ui 的 Liangshen 提取为本仓库规范 preset，供 Web（阶段1）与 TUI（阶段2）共用。

**Files:** Create `apps/cli/config/agent-presets/liangshen/{preset.yml,agent.cordis.yml}`；若 agent-presets 有既有测试则加断言。

- [ ] **Step 1: 从 Task 0 的 liangshen 精确版本读取源组合**（prompt 段 + 两阶段工具锚定；记录是否引入进程单例）
- [ ] **Step 2: preset.yml**（`name`/`description`/唯一 `order`，避开 standard/code/minimal/cordis 已用值）
- [ ] **Step 3: agent.cordis.yml**（以 standard 为基底逐行改写；provide 服务的 row 必须在带 `isolate` realm 的 `cordis:group` 内；不复制进程单例）
- [ ] **Step 4: 校验可被发现**（`ls` 目录含两文件；真正加载验证在 Task 4）
- [ ] **Step 5: 暂存 + 报告**（commit 需许可）

---

### Task 4（M3）：fusion profile 组合脚本 + Web 全家桶冒烟

**目的**：提供方案 A 的可复现组合（含 profile allowBuilds），起 `dsh --profile fusion` 验证全家桶加载、Liangshen 可选、console 无报错。

**Files:** Create `docs/user/guide/fusion-profile.md`（+ `.zh.md` + `.i18n.yaml`）；Modify `docs/user/guide/index.md`（+ 中文）与 `website/docs.ts` 投影（若需上站）。

- [ ] **Step 1: 写 fusion profile 组合文档（双语）**

含：`dsh plugin --profile fusion add @deepseek-ai/dsh-web-app @deepseek-ai/dsh-fusion` + 阶段1外部子包精确版本；profile `pnpm-workspace.yaml` 需加的 `allowBuilds`（`cloudflared`/`cpu-features`/`ssh2`）；`dsh.profile.bundles = [base, web-app, fusion]`；UI 里选 Liangshen preset。

- [ ] **Step 2: 构建 + 组合 profile**（build 后台；组合命令各 < 1 分钟）
```bash
pnpm run build
export DSH_HOME=$(mktemp -d)
pnpm dsh plugin --profile fusion add @deepseek-ai/dsh-web-app @deepseek-ai/dsh-fusion
# 再逐个 add 阶段1外部子包精确版本（以 Task 0 矩阵为准）
cat $DSH_HOME/profiles/fusion/package.json
```
Expected: `dsh.profile.bundles` 含 base/web-app/fusion；外部子包在 profile `dependencies`。

- [ ] **Step 3: 起 fusion web**（后台）
```bash
DSH_HOME=$DSH_HOME pnpm dsh --profile fusion
```
Expected: boot 通过（`assertEntriesActivated` 不抛），监听 3080。

- [ ] **Step 4: 浏览器冒烟（独立 Chrome CDP 9333）**

打开 `http://127.0.0.1:3080`，验证：左侧 `ui-sidebar` 会话栏在场；任务看板/皮肤中心/宠物入口可见；modlens 图像入口在场；**console 无 error**（有则先修）。截图留证。停服务。（注：右侧 better-sidebar 工作台属阶段2。）

- [ ] **Step 5: 导航 + 网站投影**（更新 index 双语；`website/docs.ts` 加 `pairedPages()`）

- [ ] **Step 6: doc-sync**
```bash
pnpm run doc-sync
```
Expected: 双语配对/预算/链接门通过（超预算按 dsh-doc-standards 精简）。

- [ ] **Step 7: 暂存 + 报告**（commit 需许可）

---

### Task 5（M5）：阶段1 既有功能回归 + 去重验证

**目的**：依系统演进护栏，逐项证明既有用户路径语义未变，去重项未激活。宣称阶段1完成前的强制关卡。

**Files:** Create `docs/superpowers/plans/fusion-regression-report.md`（不入 git）。

- [ ] **Step 1: 既有 Web 路径回归**（对照设计 §8.1）：只验证阶段 1 既有 `base + web-app` 路径，包括对话渲染+工具卡片、左侧 ui-sidebar New Session/会话列表、fork/resume/compact/export、Search/Settings/模型选择。右侧 Files/Web Editor/Terminal/Git 由 Task 7 的 better-sidebar 提供，不是 Task 5 必过项。逐项 pass/fail。
- [ ] **Step 2: 去重生效**：describe-image 未入工具目录；aionui-panel 未渲染；移动端远程只有 web-ui 一份；无同名 slot/service 冲突（boot 通过 + grep 启动日志）。
- [ ] **Step 3: headless/acp 隔离**
```bash
DSH_HOME=$(mktemp -d) pnpm dsh --profile headless "echo hello" 2>&1 | tail -5
```
Expected: 正常输出，证明 fusion 不污染其它 profile。
- [ ] **Step 4: 最小自动化检查**（用 dsh-pre-push-checks 选最小集；GUI 改动跑 `pnpm run test:gui`）
- [ ] **Step 5: 写回归报告 + 汇报**（全绿 → 阶段1完成，进 Task 6/桌面壳契约或阶段2；有 fail → 停在此列出）

---

### Task 6（M6）：桌面壳消费契约 + fusion 发布物检查

**目的**：本仓库只发布可消费的 dsh + fusion profile 并定义 Electron 壳消费契约；不改外部 desktop 仓库。

**Files:** Create `docs/user/guide/desktop-shell-contract.md`（+ `.zh.md` + `.i18n.yaml` + 网站投影）。

- [ ] **Step 1: 写契约文档（双语）**：npm 锁定依赖替代 submodule；内部 profile 指向 fusion；移动端远程由 web-ui 提供、桌面壳自身移动端下线；桌面壳保留窗口/托盘/自动起服务/更新/插件市场；dsh 升级时重跑兼容矩阵。
- [ ] **Step 2: doc-sync**
- [ ] **Step 3: 发布物检查**：确认 fusion `publishConfig.access=public`、`files` 含 `cordis.patch.yml`+`lib`、exports 可被外部 NodeNext 消费。**不 npm publish、不改外部仓库**（需用户显式授权）。
- [ ] **Step 4: 暂存 + 报告**（commit 需许可）

---

## 阶段 2：门控扩展（阶段1全绿后进入）

### Task 7（M-ext）：better-sidebar 运行时判据 + 并入 fusion

- [ ] **Step 1**: 用运行时判据锁定 better-sidebar 精确版本（上一轮 `0.10.0`/`0.14.0` 均能 boot、console 干净；选能干净运行的最高版本，记录声明 peer=rc.6/7/8 与所用 override）。
- [ ] **Step 2**: fusion patch `insert` 加 `better-sidebar` 行；测试断言其 row 在场。
- [ ] **Step 3**: 重组 fusion profile，起 web，Chrome CDP 验证右侧工作台（文件/编辑器/终端/Git tab）+ console 无 error。
- [ ] **Step 4**: 回归：确认与左侧 ui-sidebar 并存不冲突、无同名 slot 抢占。
- [ ] **Step 5**: 更新矩阵 + 暂存报告。若无法用锁定版本干净消费 → 标注 sidebar 为阶段2阻塞，不回滚阶段1。

### Task 8（M-ext）：dsh-TUI 运行时判据 + fusion-tui profile

- [ ] **Step 1**: 用运行时判据 + 结构缺陷评估（设计 §7.2）锁定 dsh-TUI 精确版本：真实 PTY 起 `dsh --profile fusion-tui`，验证顶栏/状态/输入区渲染 + 一条消息往返。
- [ ] **Step 2**: 评估结构风险：`workspace:*` 运行时泄漏能否隔离安装（bundledDependencies）、React 18 vs 19、自带 Liangshen 副本与本仓库 preset 的 `.agent-presets/liangshen` 目录所有权冲突（选一个所有者）。
- [ ] **Step 3**: 写 `docs/user/guide/fusion-tui-profile.md`（双语 + 投影），含 profile 组合命令与终端验证清单。
- [ ] **Step 4**: doc-sync + 暂存报告。若无法干净消费 → 标注 TUI 为阶段2阻塞，不回滚阶段1。

---

## Task 9：最终验证、代码审查与交付

- [ ] **Step 1**: 独立子代理逐条核对验收清单（`.trae/specs/fuse-five-repositories/checklist.md`），失败项追加修复任务重验。
- [ ] **Step 2**: 新鲜运行 focused tests、typecheck、build、hygiene、doc-sync、docs:check、lint、`git diff --check` + 所有真实 Web/TUI 冒烟。
- [ ] **Step 3**: 独立代码审查子代理查正确性/简洁/架构/安全/性能/系统语义 diff/未覆盖风险；修 Critical/Important 后复审。
- [ ] **Step 4**: 确认工作树无未授权 commit/push/merge/rebase/reset；plan/spec/矩阵/回归记录仍未入 git。
- [ ] **Step 5**: 写 Agent Note（架构决策：运行时判据、fusion 不携带第三方 dep、去重所有权、profile 不内置、重新验证条件）——非 trivial 改动仓库要求同 PR 一个 Agent Note。更新 `.trae/specs` 的 tasks/checklist/progress（append-only）。

---

## Self-Review

**1. 对根因的修正覆盖：**
- 根因 A（不可满足 oracle）→ Global Constraints「运行时经验判据」+ Task 0 改用运行时四项判据 + 阶段2 sidebar/TUI 用同判据 ✓
- 根因 B（仓库根污染）→ Global Constraints「fusion 不携带第三方 dep」+ Task 1 Step 1 只 workspace 依赖 + Task 4 allowBuilds 落 profile ✓
- 次生缺陷：`latest` 矛盾（Task 0/3 全用精确版本）✓；桌面壳仅契约（Task 6）✓；TUI 结构风险与 peer 分离（Task 8 Step 2）✓；分阶段避免阻塞拖垮（阶段1/2 划分）✓

**2. 用户决策落地：** 运行时判据（Q1）✓；分阶段先核心后扩展（Q2）✓；桌面壳仅契约+发布物（Q3 默认）✓

**3. 命名一致：** 包名 `@deepseek-ai/dsh-fusion`；插件名 `fusion-invariant`；profile `fusion`/`fusion-tui`；preset `liangshen`。

**4. 与仓库规则一致：** L0 零改动、ESM、`./invariant`、双语文档 + i18n sidecar + 网站投影、REAL-composition 测试、Agent Note、commit 需许可、矩阵不入 git。

无遗留矛盾。

---

## Execution Handoff

计划保存到 `docs/superpowers/plans/2026-08-19-dsh-five-repo-fusion.md`（不入 git）。设计文档同目录 `specs/2026-08-19-dsh-five-repo-fusion-design.md`。执行前先读设计 §1/§2。

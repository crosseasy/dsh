# DSH 五仓库融合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用一个新 profile/bundle + 一个 preset，把 modlens、dsh-web-ui、DSH-better-sidebar、dsh-TUI 四个外部插件仓库以锁定版本的 npm 依赖组合进 dsh，并为 deepseek-harness-desktop 提供可消费的发布物与契约；dsh 核心 `packages/*` 零改动。

**Architecture:** 融合层只落在本仓库的 `packages/bundle/fusion/`（新 bundle：patch 挂载外部插件、下线重复项）与 `apps/cli/config/agent-presets/liangshen/`（新 preset）。Web/桌面壳走 `fusion` profile，终端走 `fusion-tui` profile，二者共用 dsh-base 与 Liangshen preset。去重：图像理解用 modlens、侧边栏用 better-sidebar、移动端远程用 web-ui 版、Liangshen 用 web-ui 版。

**Tech Stack:** TypeScript (ESM only)、pnpm workspaces、Cordis 插件加载器、dsh profile/bundle/patch 机制、vitest、Chrome+CDP(9333) 冒烟验证。

## Global Constraints

以下为项目级硬约束，每个 Task 隐含包含（逐字摘自 spec 与仓库规则）：

- **L0 核心 `packages/*` 零改动**：融合改动只允许出现在 `packages/bundle/fusion/`、`apps/cli/config/agent-presets/liangshen/`、`docs/`，以及必要的构建/hygiene 注册点（`tsconfig.host.json`、`knip.json`、`apps/cli` profile 模板）。
- **npm 依赖 + 版本锁定**：外部插件在 `packages/bundle/fusion/package.json` 用**精确版本号**声明（禁止 `^`/`~`/`latest`）。
- **每类能力仅启用一个规范实现**：图像理解=modlens；侧边栏工作台=better-sidebar（保留核心 `ui-sidebar` 左侧会话栏）；移动端远程=web-ui 版；Liangshen preset=web-ui 版。下线项：`dsh-tool-describe-image`、`aionui-panel`、desktop 移动端、dsh-TUI 内置 liangshen 副本。
- **ESM everywhere** (`"type": "module"`)：跨包用包名，本地相对 import 用 `.ts`；外部包若为 CJS-only export 视为不兼容。
- **每个包拥有 `./invariant`**：新 bundle 必须有 `src/invariant.ts` companion，空 installer 给出包特定 `No runtime invariant:` 理由。
- **文件结尾恰好一个换行**；`git diff --cached --check`（pre-commit）把关。
- **命令执行时长 < 1 分钟**（用户规则）；长任务用后台运行。
- **plan/spec 文档不入 git**（用户规则）：`docs/superpowers/**` 不 `git add`。
- **git commit/push 需用户许可**（用户规则）：本计划的 commit 步骤在获得许可前不执行；无许可时以"暂存变更 + 报告"替代。
- **console 报错必须修**（用户规则）：浏览器冒烟若 console 出错，先修再继续。
- **预发布阶段"foundation over blast radius"**：不为下线项写兼容 shim。
- **版本契约漂移是头号风险**：任何外部插件先单独 `dsh plugin add` 起服务验证通过，再进 fusion bundle 合并；每个外部依赖记录"已验证兼容的 dsh 版本 + 外部包版本"锁定对。

---

## 关键路径参考（实现者需先读）

- Bundle 模板：[`packages/bundle/headless/`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/headless)（package.json / cordis.patch.yml / src/invariant.ts / tsconfig.json / tests）
- Bundle 机制说明：[`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)
- Profile/boot 机制：[`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)、profile 模板定义 `packages/boot/app-boot/src/profile.ts:114-125`
- `dsh plugin` 流程：[`apps/cli/src/plugin.ts`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)（`runPlugin` → pnpm 转发 → `reconcilePlugins` 按已安装状态把声明 `dsh.bundle` 的依赖并入 `dsh.profile.bundles`）
- Preset 模板：[`apps/cli/config/agent-presets/standard/`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/config/agent-presets/standard)（preset.yml + agent.cordis.yml）
- Preset 机制：[`packages/preset/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/preset/README.md)
- 构建注册点：`tsconfig.host.json:242-244`（bundle references）、`knip.json:771-785`（bundle ignoreDependencies）、`pnpm-workspace.yaml`（`packages/*/*` 已 glob）

---

## Task 0（M0）：外部插件兼容性验证矩阵

**目的**：在合并前，以五个上游共同支持的官方 dsh `0.1.0-rc.7` commit `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca` 为基线，逐个验证实际消费的 npm 包，产出锁定版本对与不兼容清单。这是头号风险（版本漂移）的强制缓解。**本 Task 不改本仓库源码**，产出是一份验证记录文件（不入 git）。

**Files:**
- Create: `docs/superpowers/plans/fusion-compat-matrix.md`（验证记录，不入 git）

**Interfaces:**
- Produces: `COMPAT[<pkg>] = { compatibleDshVersion, pkgVersion, status: 'ok'|'incompatible', notes }` —— 后续 Task 2 的精确版本号来源。

- [ ] **Step 1: 先构建本仓库产物（外部插件解析依赖已发布/本地 dsh 包）**

Run（后台运行，超 1 分钟用 run_in_background）：
```bash
pnpm install && pnpm run build
```
Expected: build 成功，`packages/*/lib` 产物就绪。

- [ ] **Step 2: 为验证创建一个隔离 profile 并单独安装 modlens**

Run：
```bash
DSH_HOME=$(mktemp -d) pnpm dsh plugin --profile web add @liustack/modlens@3.21.1
```
Expected: pnpm 安装成功；`$DSH_HOME/profiles/web/package.json` 的 `dsh.profile.bundles` 或 `dependencies` 记录 modlens。若失败，记录到矩阵为 `incompatible`。

- [ ] **Step 3: 单独起 web 冒烟验证 modlens（Chrome+CDP 9333）**

Run（后台）：
```bash
DSH_HOME=<上一步的目录> pnpm dsh --profile web
```
用 browser_use（Chrome CDP 9333）打开 `http://127.0.0.1:3080`，检查页面加载、console 无报错。记录结果。停止服务。

- [ ] **Step 4: 对其余三个外部包重复 Step 2-3**

分别验证：
```bash
# better-sidebar
DSH_HOME=$(mktemp -d) pnpm dsh plugin --profile web add dsh-better-sidebar@0.13.1
# web-ui 的八个精选子包逐个隔离验证；不安装聚合包。
DSH_HOME=$(mktemp -d) pnpm dsh plugin --profile web add @linxin666/dsh-client-ui-task-board@0.2.2
# 对 git-graph、remote-web-ui、ssh、pet、skin-center、web-ui-settings、
# liangshen 以同样方式逐包验证。
# dsh-TUI（终端形态，单独 profile）
DSH_HOME=$(mktemp -d) pnpm dsh plugin --profile tui add @deepseek-harness-tui/dsh-tui@0.8.3
```
每个记录：安装是否成功、起服务是否 boot 通过、console/终端是否报错、观察到的兼容 dsh 版本。TUI 用终端观察（非浏览器）。

- [ ] **Step 5: 记录 web-ui-all 的子包结构，决定"引用子包 vs 聚合包+disable"**

Run：
```bash
DSH_HOME=<web-ui 验证目录>; ls $DSH_HOME/profiles/web/node_modules/@linxin666/ 2>/dev/null; cat $DSH_HOME/profiles/web/node_modules/@linxin666/dsh-web-ui-all/package.json
```
观察 `dsh-web-ui-all` 是"聚合再导出子包"还是"自身即含全部 row"。据此在矩阵里写下 Task 2 的挂载策略：
- 若可单独安装子包（`dsh-liangshen`/`dsh-client-ui-task-board`/`dsh-ssh`/`dsh-pet`/`dsh-client-ui-skin-center`）→ **引用子包**，不引用 `dsh-tool-describe-image` 与 `aionui-panel`。
- 否则 → 引用聚合包，在 fusion patch 中用 id-targeted `disabled: true` 关闭 describe-image 与 aionui-panel 的 row（需从聚合包 patch 里查出这两行的 `id`）。

- [ ] **Step 6: 写入兼容性矩阵文件**

写 `docs/superpowers/plans/fusion-compat-matrix.md`，表格列：`包名 | 验证版本 | 兼容 dsh 版本 | 安装 | boot | console/终端 | 挂载策略 | 备注`。对每个 `incompatible` 项写明失败现象（供后续 issue 或降级）。

- [ ] **Step 7: 提交（需用户许可）**

矩阵文件不入 git。向用户报告矩阵结论与锁定版本对；**若发现任一外部包与 HEAD 不兼容，在此暂停并向用户汇报**（阻塞项：不兼容的包无法进入 fusion）。

---

## Task 1（M1）：创建 `@deepseek-ai/dsh-fusion` bundle 骨架

**目的**：新建 bundle 包的最小可加载骨架（package.json + 空 patch + invariant + tsconfig + README），并接入构建/hygiene 注册点。此 Task 交付一个"能被 build/typecheck 识别、但还没挂任何外部插件"的空 bundle。

**Files:**
- Create: `packages/bundle/fusion/package.json`
- Create: `packages/bundle/fusion/cordis.patch.yml`
- Create: `packages/bundle/fusion/src/invariant.ts`
- Create: `packages/bundle/fusion/tsconfig.json`
- Create: `packages/bundle/fusion/README.md`
- Create: `packages/bundle/fusion/tests/fusion.spec.ts`
- Modify: `tsconfig.host.json`（在 `packages/bundle/` references 区加 `fusion`）
- Modify: `knip.json`（加 `packages/bundle/fusion` 的 `ignoreDependencies`）

**Interfaces:**
- Produces: 包名 `@deepseek-ai/dsh-fusion`，manifest 声明 `dsh.bundle.patch = "./cordis.patch.yml"`，export `./cordis.patch.yml` 与 `./invariant`；Cordis 插件名 `fusion-invariant`。

- [ ] **Step 1: 写 package.json**

Create `packages/bundle/fusion/package.json`（以 headless 为模板，去掉 startup 相关；`dependencies` 先只留构建必需，外部插件在 Task 2 加）：
```json
{
  "name": "@deepseek-ai/dsh-fusion",
  "description": "The dsh fusion bundle: composes the curated external plugin ecosystem (modlens vision, better-sidebar workbench, web-ui suite) over dsh-web-app, with duplicate capabilities disabled",
  "version": "0.1.0-rc.7",
  "publishConfig": { "access": "public" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/deepseek-ai/deepseek-harness.git",
    "directory": "packages/bundle/fusion"
  },
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    "./invariant": {
      "types": "./lib/types/invariant.d.ts",
      "default": "./lib/invariant.js"
    },
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./src/*": "./src/*",
    "./package.json": "./package.json"
  },
  "files": [
    "lib/invariant.js",
    "cordis.patch.yml",
    "lib/types/**/*.d.ts"
  ],
  "license": "MIT",
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "peerDependencies": {
    "@deepseek-ai/dsh-invariants": "workspace:^",
    "@deepseek-ai/cordis": "workspace:^"
  },
  "devDependencies": {
    "@deepseek-ai/dsh-invariants": "workspace:^",
    "@deepseek-ai/cordis": "workspace:^"
  }
}
```
（说明：此 bundle 无 runtime glue plugin，因此不需要 `main` 指向的 `src/index.ts`；但 tsdown/tsc 需要一个 root。若 build 要求 `main` 存在，改为纯 patch bundle 参考 base bundle 的最小形态——见 Step 6 的 build 验证，若报错则补一个空 `src/index.ts` 并加对应 export。）

- [ ] **Step 2: 写空 patch 占位**

Create `packages/bundle/fusion/cordis.patch.yml`：
```yaml
# The dsh-fusion bundle patch: the curated external plugin ecosystem over
# dsh-web-app. Applied after base and web-app layers, so rows here may
# override web-app rows by id and insert external plugin rows.
#
# A patch replaces the targeted row's whole `config`, so each row below
# restates every key it owns.
#
# External plugin rows and duplicate-capability disables are added in Task 2.
- insert: []
```
（注：若空 `insert: []` 被 patch 解析器视为无效，改为一条无害的注释 + 真正的第一条 row 在 Task 2 落地。Step 6 typecheck/boot 会暴露。）

- [ ] **Step 3: 写 invariant companion**

Create `packages/bundle/fusion/src/invariant.ts`（照搬 headless invariant 结构，改名与理由）：
```typescript
/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-fusion`.
 * @module @deepseek-ai/dsh-fusion/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-fusion'

/** Cordis companion plugin name. */
export const name = 'fusion-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/**
 * No runtime invariant: this bundle is a pure profile patch layer that mounts
 * external plugin rows and disables duplicate-capability rows. It registers no
 * service and holds no mutable relation to audit inside the tree; each mounted
 * external plugin owns its own invariant companion.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
```

- [ ] **Step 4: 写 tsconfig.json**

Create `packages/bundle/fusion/tsconfig.json`（照 headless，references 精简到 invariant 实际用到的：cordis + invariants）：
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "lib/types"
  },
  "include": ["src"],
  "references": [
    { "path": "../../../vendor/cordis" },
    { "path": "../../runtime-diagnostics/invariants" }
  ]
}
```

- [ ] **Step 5: 写 README.md（含 Model Experience + Known Limitations，仓库硬性要求）**

Create `packages/bundle/fusion/README.md`：
```markdown
# fusion/ — curated external plugin bundle

English | 中文

The `@deepseek-ai/dsh-fusion` bundle composes a curated set of external dsh
plugins over the `dsh-web-app` layer: modlens (vision bridge), better-sidebar
(right-side workbench), and the retained dsh-web-ui suite modules. Duplicate
capabilities are disabled here so exactly one implementation of each is active
(vision → modlens; sidebar workbench → better-sidebar; mobile remote →
web-ui). External plugins are pinned by exact version in this package's
`dependencies`.

Install into a profile as the top layer over `base` + `web-app`:
`dsh plugin --profile fusion add @deepseek-ai/dsh-fusion` (in-box bundle:
listed in the `fusion` profile template).

## Model Experience

Indirectly: this bundle mounts external plugins whose tools and prompt
sections reach the model (modlens injects image transcription; web-ui/
better-sidebar add tools). The bundle patch itself contributes no
model-visible text.

#### KV Cache effect

None from the patch itself; each mounted plugin owns its own request-prefix
effect. Disabling duplicate rows removes their tools from the catalog, which
is a one-time catalog change, not a per-turn invalidation.

## Known Limitations and Deferred Work

- **Profile delivery is documented, not a built-in template by default** — the
  `fusion`/`fusion-tui` profiles are created via `dsh plugin --profile fusion
  add ...` per the fusion docs; promoting them to `PROFILE_TEMPLATES` is
  deferred (would touch `app-boot`).
- **External plugin versions are pinned and validated against one dsh
  version** — a dsh upgrade requires re-running the compatibility matrix
  before bumping the pinned versions.
- **Desktop shell integration is contract-only here** — this repo publishes the
  consumable dsh + fusion profile; the Electron shell's own changes live in
  its repository.
```
（同时创建 `README.zh.md` 与 `README.i18n.yaml`，遵循仓库双语约定；内容可先与英文对齐，正式翻译由 `dsh-translate-docs` 在用户显式调用时处理。）

- [ ] **Step 6: 写 REAL-composition 冒烟测试（关键：产品可见 bundle 需非纯单测）**

Create `packages/bundle/fusion/tests/fusion.spec.ts`。第一版只断言 bundle manifest 与 patch 可被解析（外部插件挂载在 Task 2 补断言）：
```typescript
/** The fusion bundle's manifest and patch are well-formed and loadable. */

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

const patchUrl = new URL('../cordis.patch.yml', import.meta.url)
const pkgUrl = new URL('../package.json', import.meta.url)

describe('dsh-fusion bundle', () => {
  it('declares a bundle patch in its manifest', () => {
    const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), 'utf8'))
    expect(pkg.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(pkg.name).toBe('@deepseek-ai/dsh-fusion')
  })

  it('parses to a YAML array of patch entries', () => {
    const patch = load(readFileSync(fileURLToPath(patchUrl), 'utf8'))
    expect(Array.isArray(patch)).toBe(true)
  })
})
```
（`js-yaml` 若非该包依赖，改用仓库既有的 patch 解析工具 `loadOptionalPatches` from `@deepseek-ai/dsh-app-boot`——见 app-boot README 的该导出；用它替代直接 YAML 解析，更贴合真实加载路径。实现者按包内可用依赖二选一。）

- [ ] **Step 7: 注册到构建 aggregate**

Modify `tsconfig.host.json`：在 `packages/bundle/base`/`headless`/`web-app` 的 references 序列中，按字母序插入：
```json
    { "path": "./packages/bundle/fusion" },
```
（位置：`base` 之后、`headless` 之前，保持字母序。）

- [ ] **Step 8: 注册到 knip**

Modify `knip.json`：在 `"packages/bundle/web-app"` 条目旁加入（外部插件 bare 依赖只在 YAML patch 里引用，knip 检测不到，需忽略）：
```json
    "packages/bundle/fusion": {
      "ignoreDependencies": [
        "@deepseek-ai/.+",
        "@liustack/modlens",
        "dsh-better-sidebar",
        "@linxin666/.+",
        "@deepseek-harness-tui/.+"
      ]
    },
```

- [ ] **Step 9: typecheck + 单测 + hygiene**

Run（各自 < 1 分钟；build 用后台）：
```bash
pnpm --filter @deepseek-ai/dsh-fusion test
pnpm run typecheck
```
Expected: fusion.spec 通过；typecheck 无 fusion 相关错误。若 build root 报缺 `main`，回到 Step 1 按 base bundle 最小形态调整。

- [ ] **Step 10: Commit（需用户许可）**

```bash
git add packages/bundle/fusion tsconfig.host.json knip.json
git commit -m "feat(bundle): scaffold dsh-fusion bundle skeleton"
```

---

## Task 2（M1）：在 fusion patch 挂载外部插件并下线重复项

**目的**：把 Task 0 验证通过的外部插件写入 fusion patch 的 `insert`，用精确版本号声明 npm 依赖，并下线重复能力（describe-image / aionui-panel）。交付一个"组合完整、去重生效"的 bundle。

**Files:**
- Modify: `packages/bundle/fusion/cordis.patch.yml`
- Modify: `packages/bundle/fusion/package.json`（加精确版本 dependencies）
- Modify: `packages/bundle/fusion/tests/fusion.spec.ts`（加去重与挂载断言）

**Interfaces:**
- Consumes: Task 0 矩阵的 `挂载策略` 与精确版本号。
- Produces: patch `insert` 行集合（含 `dsh.client` 行使 Web 插件进浏览器 roster）；去重项的 `disabled: true` 行。

- [ ] **Step 1: 写失败测试（断言去重项被禁用 + 保留项在场）**

Modify `packages/bundle/fusion/tests/fusion.spec.ts`，追加：
```typescript
it('enables modlens and disables the duplicate describe-image tool', () => {
  const patch = load(readFileSync(fileURLToPath(patchUrl), 'utf8')) as any[]
  const rows = patch.flatMap(p => p.insert ?? [p])
  const ids = rows.map(r => r.id)
  // canonical vision = modlens present
  expect(ids).toContain('modlens')
  // duplicate describe-image disabled (if referenced via aggregate) or absent
  const describe = rows.find(r => r.id === 'tool-describe-image')
  if (describe !== undefined) expect(describe.disabled).toBe(true)
})

it('enables better-sidebar and disables the deprecated aionui-panel', () => {
  const patch = load(readFileSync(fileURLToPath(patchUrl), 'utf8')) as any[]
  const rows = patch.flatMap(p => p.insert ?? [p])
  const ids = rows.map(r => r.id)
  expect(ids).toContain('better-sidebar')
  const aionui = rows.find(r => r.id === 'aionui-panel')
  if (aionui !== undefined) expect(aionui.disabled).toBe(true)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
pnpm --filter @deepseek-ai/dsh-fusion test
```
Expected: FAIL（patch 还没有这些 row）。

- [ ] **Step 3: 写 patch 的 insert 行**

Modify `packages/bundle/fusion/cordis.patch.yml`。按 Task 0 Step 5 的策略二选一落地。**策略 A（引用子包，推荐）** 示例：
```yaml
# The dsh-fusion bundle patch: curated external plugins over dsh-web-app.
# Duplicate capabilities are disabled so exactly one implementation is active.

- insert:
    # ── vision (canonical: modlens) ──────────────────────────────────────
    - id: modlens
      name: '@liustack/modlens'

    # ── right-side workbench (canonical: better-sidebar) ─────────────────
    # A dsh.client host+client plugin; exposes ctx.betterSidebar.
    - id: better-sidebar
      name: 'dsh-better-sidebar'

    # ── retained dsh-web-ui suite modules (no duplicates) ────────────────
    - id: ui-task-board
      name: '@linxin666/dsh-client-ui-task-board'

    - id: dsh-ssh
      name: '@linxin666/dsh-ssh'

    - id: dsh-pet
      name: '@linxin666/dsh-pet'

    - id: ui-skin-center
      name: '@linxin666/dsh-client-ui-skin-center'

    # NOTE: dsh-tool-describe-image and aionui-panel are NOT referenced here
    # (duplicate of modlens / deprecated). Liangshen preset is mounted via
    # apps/cli/config/agent-presets/liangshen, not as a bundle row.
```
**策略 B（引用聚合包 + disable）** 示例（若子包不可单独安装）：
```yaml
- insert:
    - id: modlens
      name: '@liustack/modlens'
    - id: web-ui-all
      name: '@linxin666/dsh-web-ui-all'
    - id: better-sidebar
      name: 'dsh-better-sidebar'

# Disable duplicate rows carried by the aggregate (ids from Task 0 Step 5).
- id: tool-describe-image
  disabled: true
- id: aionui-panel
  disabled: true
```
（实现者用 Task 0 记录的真实 `id`/包名替换占位；上面的 `id`/包名是示意，**必须以矩阵为准**。）

- [ ] **Step 4: 写精确版本依赖**

Modify `packages/bundle/fusion/package.json`，加 `dependencies`（版本号取自 Task 0 矩阵，示例）：
```json
  "dependencies": {
    "@liustack/modlens": "3.21.1",
    "dsh-better-sidebar": "<matrix-version>",
    "@linxin666/dsh-client-ui-task-board": "<matrix-version>",
    "@linxin666/dsh-ssh": "<matrix-version>",
    "@linxin666/dsh-pet": "<matrix-version>",
    "@linxin666/dsh-client-ui-skin-center": "<matrix-version>"
  },
```
（禁止 `^`/`latest`；`<matrix-version>` 换成 Task 0 锁定的确切版本。策略 B 则只列 modlens + web-ui-all + better-sidebar。）

- [ ] **Step 5: 运行测试确认通过**

Run:
```bash
pnpm install
pnpm --filter @deepseek-ai/dsh-fusion test
```
Expected: PASS（去重与挂载断言全绿）。

- [ ] **Step 6: hygiene（外部依赖已在 knip 忽略）**

Run:
```bash
pnpm run hygiene
```
Expected: 无 fusion 相关 unused/undeclared 报错。若报某外部包"unused"，确认已在 Task 1 Step 8 的 `ignoreDependencies` 覆盖。

- [ ] **Step 7: Commit（需用户许可）**

```bash
git add packages/bundle/fusion
git commit -m "feat(bundle): mount curated external plugins in fusion, disable duplicates"
```

---

## Task 3（M2）：新建 Liangshen agent preset

**目的**：把 dsh-web-ui 的 Liangshen 模式提取为本仓库的规范 system preset，供 Web 与 TUI 解析同一实现；TUI 仍写入的 user-root 磁盘副本因 first-root-wins 不参与解析。

**Files:**
- Create: `apps/cli/config/agent-presets/liangshen/preset.yml`
- Create: `apps/cli/config/agent-presets/liangshen/agent.cordis.yml`
- Create: `apps/cli/config/agent-presets/liangshen/tool-bootstrap.mjs`
- Create: `apps/cli/config/agent-presets/liangshen/custom-bash.mjs`
- Create: `apps/cli/config/agent-presets/liangshen/NOTICE`
- Modify: `apps/cli/tests/web-agent-presets.e2e.ts`
- Modify: `THIRD_PARTY_NOTICES.md`（若根 notice 尚未覆盖该复制内容）

**Interfaces:**
- Consumes: npm 精确发布物 `@linxin666/dsh-liangshen@0.2.2` 内的完整五文件 preset。
- Produces: system-root preset 目录 `liangshen`；system root 的 first-root-wins 使 TUI 写入的不同 user-root 副本不参与解析。

- [ ] **Step 1: 读取 dsh-web-ui liangshen 源以提取组合**

Run（从 Task 0 的隔离验证目录读取已安装的精确发布物）：
```bash
find /tmp/fusion-rc7-webui/profiles/web/node_modules/@linxin666/dsh-liangshen/presets/liangshen -maxdepth 1 -type f -print
```
Expected: 精确得到 `preset.yml`、`agent.cordis.yml`、`tool-bootstrap.mjs`、`custom-bash.mjs` 与 `NOTICE`；不复制包的 Host 同步插件。

- [ ] **Step 2: 先写 roster 与真实组合测试并确认 RED**

在 `apps/cli/tests/web-agent-presets.e2e.ts` 把 shipped roster 的期望增加 `liangshen`，并新增真实 mount 测试，断言初始两工具表面及 system-root 对同名 user-root 的优先级。运行该文件的聚焦测试，确认因目录不存在而失败。

- [ ] **Step 3: 复制精确发布物的完整 preset**

使用 `apply_patch` 逐字新增五个文本文件，不重写或“清理”上游 preset。`NOTICE` 保留来源归属；根 `THIRD_PARTY_NOTICES.md` 按仓库格式补充该复制内容的许可证说明。

- [ ] **Step 4: 校验 preset 可被发现（agent-presets 目录即 roster）**

Run:
```bash
pnpm exec vitest run apps/cli/tests/web-agent-presets.e2e.ts
pnpm run verify-cordis-config
```
Expected: shipped roster 包含 `liangshen`，真实 composition 可 mount；system-root 同名 preset 优先；Cordis 配置校验通过。浏览器和 TUI 运行验证在 Task 4/5。

- [ ] **Step 5: Commit（需用户许可）**

```bash
git add apps/cli/config/agent-presets/liangshen
git commit -m "feat(preset): add liangshen agent preset shared by web and tui"
```

---

## Task 4（M3）：fusion profile 文档化 + Web 全家桶冒烟

**目的**：提供可复现的 `fusion` profile 组合方式（方案 A：文档化，不改 app-boot），并起 `dsh web` 验证全家桶（better-sidebar / modlens / task-board / pet / skin-center）加载、Liangshen preset 可选、console 无报错。

**Files:**
- Create: `docs/user/guide/fusion-profile.md`（融合 profile 使用文档）
- Create: `docs/user/guide/fusion-profile.zh.md`
- Create: `docs/user/guide/fusion-profile.i18n.yaml`
- Modify: `docs/user/guide/index.md` / `index.zh.md` / pairing sidecar
- Modify: `website/docs.ts`（发布到现有 guide section）

**Interfaces:**
- Consumes: Task 2 的 fusion bundle、Task 3 的 liangshen preset。
- Produces: 一组 `dsh plugin --profile fusion add ...` 命令与验证清单。

- [ ] **Step 1: 写 fusion profile 使用文档**

Create `docs/user/guide/fusion-profile.md`，含组合步骤（方案 A）：
```markdown
# Fusion profile

The `fusion` profile stacks the curated external plugin ecosystem over the
browser surface. Compose it once:

    # base is the default; install the two explicit upper bundle layers.
    dsh plugin --profile fusion add @deepseek-ai/dsh-web-app@0.1.0-rc.7
    # Before this command, approve only node-pty, cloudflared, cpu-features,
    # and ssh2 in the generated profile pnpm-workspace.yaml.
    dsh plugin --profile fusion add @deepseek-ai/dsh-fusion@0.1.0-rc.7
    dsh --profile fusion

The resulting profile's `dsh.profile.bundles` reads
`[@deepseek-ai/dsh-base, @deepseek-ai/dsh-web-app, @deepseek-ai/dsh-fusion]`.
Select the Liangshen preset from the agent-preset picker in the UI.
```
（注：`dsh.profile.bundles` 由 `reconcilePlugins` 自动按已安装 bundle 维护——见 [plugin.ts](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)。首次 `dsh plugin --profile fusion` 会以 `DEFAULT_PROFILE_BUNDLES`=`[dsh-base]` 初始化，随后 add web-app、fusion 依次并入。）

- [ ] **Step 2: 构建 + 组合 fusion profile**

Run（build 后台；组合命令各 < 1 分钟）：
```bash
pnpm run build
export DSH_HOME=$(mktemp -d)
pnpm dsh plugin --profile fusion add link:$(pwd)/packages/bundle/web-app
pnpm dsh plugin --profile fusion add link:$(pwd)/packages/bundle/fusion
cat $DSH_HOME/profiles/fusion/package.json
```
Expected: `dsh.profile.bundles` 含 base/web-app/fusion；外部插件在 `dependencies`。

- [ ] **Step 3: 起 fusion web（后台）**

Run（后台运行）：
```bash
DSH_HOME=$DSH_HOME pnpm dsh --profile fusion
```
Expected: boot 通过（`assertEntriesActivated` 不抛），服务监听 `http://127.0.0.1:3080`。

- [ ] **Step 4: 浏览器冒烟（Chrome CDP 9333）**

用 browser_use 打开 `http://127.0.0.1:3080`，验证清单：
- 页面加载，左侧 `ui-sidebar` 会话栏在场；
- 右侧 better-sidebar 工作台出现（文件/编辑器/终端/Git tab）；
- 任务看板 / 皮肤中心 / 宠物 入口可见；
- console **无报错**（有则先修，用户规则）；
- 粘贴一张图片走 modlens（若可快速验证），否则记录为 Task 6 回归项。
截图留证。停止服务。

- [ ] **Step 5: 更新导航（若有）**

Modify `docs/user/guide/index.md`：在指南列表加 `- [Fusion profile](fusion-profile.md)`。若无此文件，跳过并记录。

- [ ] **Step 6: doc-sync**

Run:
```bash
pnpm run doc-sync
```
Expected: 文档门禁通过（新文档双语/预算等）。若 `verify-doc-budgets` 报超预算，按 [dsh-doc-standards] 精简。

- [ ] **Step 7: Commit（需用户许可）**

```bash
git add docs/user/guide/fusion-profile.md docs/user/guide/index.md
git commit -m "docs: add fusion profile guide"
```

---

## Task 5（M4）：fusion-tui profile + 终端冒烟

**目的**：提供并行的终端前端 profile，复用 dsh-base 与 Liangshen preset，验证 dsh-TUI 消费 `session/event` 正常渲染。

**Files:**
- Create: `docs/user/guide/fusion-tui-profile.md`

**Interfaces:**
- Consumes: dsh-TUI 包（Task 0 验证版本）、Task 3 liangshen preset。
- Produces: `fusion-tui` profile 组合命令与终端验证清单。

- [ ] **Step 1: 写 fusion-tui 文档**

Create `docs/user/guide/fusion-tui-profile.md`：
```markdown
# Fusion TUI profile

The terminal front-end runs as a parallel profile over dsh-base:

    dsh plugin --profile fusion-tui add @deepseek-harness-tui/dsh-tui@<pinned>
    dsh --profile fusion-tui

It shares dsh-base and the Liangshen preset with the `fusion` (web) profile;
the two front-ends do not render at the same time.
```

- [ ] **Step 2: 组合 fusion-tui profile**

Run:
```bash
export DSH_HOME=$(mktemp -d)
pnpm dsh plugin --profile fusion-tui add @deepseek-harness-tui/dsh-tui@<matrix-version>
cat $DSH_HOME/profiles/fusion-tui/package.json
```
Expected: dsh-TUI 作为 bundle 并入 `dsh.profile.bundles`（若 TUI 声明 `dsh.bundle`）或作为 patch 消费者。

- [ ] **Step 3: 终端冒烟**

Run（前台，短交互；<1 分钟）：
```bash
DSH_HOME=$DSH_HOME pnpm dsh --profile fusion-tui
```
Expected: TUI 渲染（顶栏/状态行/输入框），`session/event` 流驱动，无终端报错。发一条简单消息验证往返。记录结果（若 TUI 与 HEAD 不兼容，回到 Task 0 矩阵标记，作为阻塞项报告）。

- [ ] **Step 4: doc-sync + Commit（需用户许可）**

```bash
pnpm run doc-sync
git add docs/user/guide/fusion-tui-profile.md
git commit -m "docs: add fusion-tui profile guide"
```

---

## Task 6（M6）：既有功能回归矩阵 + 去重验证

**目的**：依 Superpowers 系统演进护栏，逐项证明既有用户路径语义未变，且去重项确实未激活、无同名 slot/service 冲突。**这是宣称完成前的强制关卡。**

**Files:**
- Create: `docs/superpowers/plans/fusion-regression-report.md`（回归记录，不入 git）

**Interfaces:**
- Consumes: Task 4 的 fusion web、Task 5 的 fusion-tui。

- [ ] **Step 1: 既有 Web 路径回归（对照 spec §8.1 不变量清单）**

在 fusion web 会话中逐项验证语义不变（截图/记录）：
- ui-conversation 对话渲染 + 工具卡片正常；
- 左侧 ui-sidebar：New Session / 会话列表可用；
- 会话 fork / resume / compact / export 可用；
- Editor / Search / Settings / 模型选择面板可用。
每项记录 pass/fail 到回归报告。

- [ ] **Step 2: 去重生效验证**

在 fusion 运行态确认：
- describe-image 工具**未**出现在工具目录（modlens 生效）；
- aionui-panel **未**渲染（better-sidebar 生效）；
- 移动端远程只有 web-ui 一份入口；
- 无"同名 slot 重复注册 / provide 同名 service 冲突"报错（boot 通过即基本保证；再 grep 启动日志）。

- [ ] **Step 3: headless / acp 未受影响**

Run:
```bash
DSH_HOME=$(mktemp -d) pnpm dsh --profile headless "echo hello" 2>&1 | tail -5
```
Expected: headless 正常输出，证明 fusion 未污染其它 profile（fusion bundle 只在 fusion profile 层）。

- [ ] **Step 4: 相关自动化检查**

Run（用 [dsh-pre-push-checks] 选择最小集；GUI 改动跑 test:gui）：
```bash
pnpm run test:gui
```
Expected: 绿。若红在未触碰代码上，记录到报告交下一个窗口。

- [ ] **Step 5: 写回归报告 + 汇报**

写 `docs/superpowers/plans/fusion-regression-report.md`（回归矩阵逐项结论 + 截图路径）。向用户汇报：全绿则进入 Task 7；有 fail 则列出并停在此处等决策。

---

## Task 7（M5）：桌面壳契约 + 发布物（本仓库侧）

**目的**：本仓库只负责"发布可被消费的 dsh + fusion profile"并定义 Electron 桌面壳的消费契约（npm 依赖替代 submodule、移动端去重）。桌面壳仓库自身改动**不在本次交付范围**（spec §10 待定项已定：倾向"只发布 + 定契约"）。

**Files:**
- Create: `docs/user/guide/desktop-shell-contract.md`

**Interfaces:**
- Produces: 桌面壳消费 dsh + fusion 的契约文档。

- [ ] **Step 1: 写桌面壳契约文档**

Create `docs/user/guide/desktop-shell-contract.md`，内容要点：
```markdown
# Desktop shell integration contract

The Electron desktop shell (deepseek-harness-desktop) consumes this repo as a
pinned npm dependency instead of a git submodule:

- Depend on `@deepseek-ai/dsh` at the fusion-validated version.
- Point the shell's internal profile at the `fusion` composition
  (base + web-app + @deepseek-ai/dsh-fusion).
- Mobile remote is provided by the web-ui module inside `fusion`; the shell's
  own mobile-remote implementation is disabled (duplicate).
- The shell keeps window/tray/auto-service-start/updates/plugin-market.

Versions are pinned and re-validated via the fusion compatibility matrix on
every dsh upgrade.
```

- [ ] **Step 2: doc-sync**

Run:
```bash
pnpm run doc-sync
```
Expected: 通过。

- [ ] **Step 3: 发布物确认**

确认 `@deepseek-ai/dsh-fusion` 的 `publishConfig.access = public`、`files` 列表含 `cordis.patch.yml` 与 `lib`。**实际 npm publish 与桌面壳仓库改动需用户显式授权**，本 Task 只准备可发布状态。

- [ ] **Step 4: Commit（需用户许可）**

```bash
git add docs/user/guide/desktop-shell-contract.md
git commit -m "docs: add desktop shell integration contract"
```

---

## Self-Review

**1. Spec coverage（逐节核对）:**
- spec §3 去重表 → Task 2（挂载+disable）+ Task 6 Step 2（验证去重生效）✓
- spec §4 分层（改动只在 L2）→ Global Constraints「L0 零改动」+ 所有 Task 的 Files 均限定在 fusion/liangshen/docs ✓
- spec §5.1 fusion bundle → Task 1 + Task 2 ✓
- spec §5.2 liangshen preset → Task 3 ✓
- spec §5.3 profile 落地（方案 A 文档化）→ Task 4/5 文档化，未改 app-boot ✓
- spec §5.4 桌面壳契约 → Task 7 ✓
- spec §6 数据流/挂载解析链 → Task 1 Step 8（knip bare 依赖）+ Task 2（insert + 精确版本）✓
- spec §7.1 版本漂移（头号风险）→ Task 0 全 ✓
- spec §8 既有不变量/接入点/回归矩阵 → Task 6 全 ✓
- spec §9 里程碑 M0-M6 → Task 0-7 一一对应 ✓
- spec §10 待定项：profile 落地（→Task4 定 A）、下线执行（→Task0 Step5 定策略）、精确版本（→Task0）、桌面壳归属（→Task7 定"只发布+契约"）✓

**2. Placeholder scan:** 计划中的 `<matrix-version>`、`<找到的...文件>` 是**有意的、由 Task 0 产出填充的具体值**，每处都注明来源，非 TBD 占位；patch 的 `id`/包名示例均标注"以矩阵为准"。策略 A/B 二选一在 Task 0 Step 5 明确决策依据。无 "add error handling / handle edge cases" 类空泛步骤。

**3. Type consistency:** 包名全程一致 `@deepseek-ai/dsh-fusion`；Cordis 插件名 `fusion-invariant`；profile 名 `fusion` / `fusion-tui`；preset 名 `liangshen`。invariant companion 的 `name`/`inject`/`apply` 签名与 headless 模板一致。

无遗留问题。

---

## Execution Handoff

计划已保存到 `docs/superpowers/plans/2026-08-19-dsh-five-repo-fusion.md`（不入 git）。

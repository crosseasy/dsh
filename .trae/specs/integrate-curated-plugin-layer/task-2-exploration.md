# Task 2 精确落点调研

## 结论

Task 2 的五个包都属于 Host aggregate，目录为 `packages/curated/<pkg>`。根 workspace、测试、lint、构建、发布和 invariant 扫描已经使用 `packages/*/*`，无需逐包登记；必须手工接线的是 `tsconfig.base.json` 两个路径候选列表和 `tsconfig.host.json` 五个 Project Reference。新组还必须补齐中英文组 README，原始 YAML/JSON/profile/benchmark 资产若按规格直接发布，则必须扩展发布文件门禁。

旧规划文档中“新包 `private: true`”已经过时。`scripts/check-workspace-constraints.ts:56,278-300` 将 `packages/experimental/*` 之外的 `packages/*/*` 视为 dsh release member，要求不设 `private: true`，并要求 `publishConfig.access: "public"` 和正确的 `repository.directory`。五个 manifest 应复制当前公开包格式，不应复制旧规划中的 `private: true`。

## Task 2 必改的根级接线

### `tsconfig.base.json`

在 `compilerOptions.paths["@deepseek-ai/dsh-*/invariant"]` 的候选列表中，紧跟现有 bundle 项 `./packages/bundle/*/src/invariant.ts` 增加：

```json
"./packages/curated/*/src/invariant.ts",
```

当前落点是 `tsconfig.base.json:107-151`，建议插在当前 `:133` 后。该列表按候选顺序解析；追加新组而不移动既有项可保持既有 package 解析优先级。

在 `compilerOptions.paths["@deepseek-ai/dsh-*"]` 的候选列表中，紧跟现有 bundle 项 `./packages/bundle/*/src` 增加：

```json
"./packages/curated/*/src",
```

当前落点是 `tsconfig.base.json:240-288`，建议插在当前 `:268` 后。不要增加五个逐包 alias；普通包只需要组通配，特殊 subpath 才需要精确 alias。

### `tsconfig.host.json`

在 Host references 的 bundle 区块 `tsconfig.host.json:254-256` 后增加五项。按预计依赖顺序排列可读性最好：

```json
{ "path": "./packages/curated/curated-policy" },
{ "path": "./packages/curated/curated-base" },
{ "path": "./packages/curated/curated-profiles" },
{ "path": "./packages/curated/curated-bench" },
{ "path": "./packages/curated/curated-scripts" },
```

五个包均不得同时进入 `tsconfig.client.json`。每个包自己的 `tsconfig.json` 应 extends `../../../tsconfig.base.json`，使用 `rootDir: "src"`、`outDir: "lib/types"`，并引用 `../../runtime-diagnostics/invariants`；再为实际 workspace import 添加对应 Project Reference。最小骨架可直接参照 `packages/bundle/base/tsconfig.json`，有 schema/service 依赖时参照 `packages/sandbox/sandbox-policy/tsconfig.json`。

### 发布资产门禁

`scripts/check-workspace-constraints.ts:143-165` 的 `packageFileExtras` 是非标准发布资产的硬编码白名单。`curated-base` 的 `cordis.patch.yml` 会由 `dsh.bundle.patch` 自动加入 `files`，无需白名单。按规格保留原始目录时，应增加：

```ts
'@deepseek-ai/dsh-curated-policy': ['policy'],
'@deepseek-ai/dsh-curated-profiles': ['profiles'],
'@deepseek-ai/dsh-curated-bench': ['benchmarks'],
```

对应 manifest 的 `files` 顺序必须符合 `expectedDshPackageFiles()`：`lib/index.js`、`lib/invariant.js`、可选 `lib/bin.js`、上述额外目录、`lib/types/**/*.d.ts`。若把 profile、policy 和 benchmark 数据编译为 TS 常量而不发布原始目录，则不需要这三条；但这与现有架构文档明确的 `profiles/`、`policy/`、`benchmarks/` 落点不一致。

### Knip

`knip.json:205-213` 已覆盖普通 `src/**/*.ts` 和 `tests/**/*.spec.ts`。仍需为只在 YAML/profile manifest 中出现、没有 TS import 的运行时依赖增加包级 `ignoreDependencies`：

- `packages/curated/curated-base`：至少忽略 patch 中唯一挂载的 `@deepseek-ai/dsh-curated-policy`；不要直接复制 `bundle/base` 的宽泛 `@deepseek-ai/.+`，精确列名更合适。
- `packages/curated/curated-profiles`：忽略其模板 manifest 只以字符串列出的官方 bundle、`curated-base` 和将来的第三方 bundle 依赖。

`curated-scripts` 的 manifest `bin` 会被 Knip 识别；只有采用 Knip 无法发现的额外入口时才需增加 `entry`。

### 包组与 README 门禁

新建 `packages/curated/README.md`、`README.zh.md`、`README.i18n.yaml`，并在 `packages/README.md:11-60` 与 `packages/README.zh.md` 的组表中加入 `curated/`。根 `AGENTS.md` 的 repository layout 也应加入 `curated/`，否则常驻仓库地图会遗漏新组。

五个包 README 都进入自动扫描。最小且准确的做法是在 `scripts/verify-package-readme-model-experience.ts` 的 `SENTENCE_MODEL_EXPERIENCE` 中登记：

- `curated-base`、`curated-profiles`：`indirect`，模型影响由所组合的 bundle/plugin 拥有。
- `curated-policy`：`none`，只读准入查询不进入模型请求。
- `curated-scripts`：`none`，离线校验 CLI 不进入模型请求。
- `curated-bench`：`none`，基准输入和统计结果仅供评测调用方使用；若后续 runtime 主动发起模型请求，应改成完整 Model Experience 段而不是保留该分类。

每个 README 仍须包含 `## Known Limitations and Deferred Work` 及至少一个顶层条目；无需修改 `scripts/verify-package-readme-limitations.ts`。每个 README 都要有中英文 counterpart 和 `.i18n.yaml`，中央 `scripts/translation-pairing.manifest.json` 仅保存 exclusions，不登记新 pair。

### 生成物

新增 manifest 后需要生成或刷新：

- `pnpm-lock.yaml`：新增五个 workspace importer；即使依赖均已存在也会新增 importer。
- `docs/module-graph.md`：`scripts/gen-module-graph.ts:34-56` 自动扫描 `packages/*/*/package.json`，会新增 `curated` 分组和 peer dependency 边；随后同步 `docs/module-graph.zh.md` 与 `docs/module-graph.i18n.yaml`。

Task 2 不应手改生成器来枚举五个包。`THIRD_PARTY_NOTICES.md` 只在引入新的外部依赖或改变其 runtime/dev tier 时刷新；仅复用当前已是 runtime dependency 的 `js-yaml` 不改变该文件。

## 无需修改的根配置和门禁

- 根 `package.json` 的 `workspaces: ["packages/*/*"]` 和 `pnpm-workspace.yaml` 的同名 glob 已发现五个包。
- 根 `tsconfig.json` 只引用 Host/Client aggregate，无需逐包引用。
- `tsdown.config.ts:19-20` 自动构建 `packages/*/*` 的 `index`、`invariant`、`startup`；只有 `curated-scripts` 的 `bin` 需要包内 `tsdown.config.ts`。
- `.oxlintrc.json`、`vitest.config.ts`、`scripts/package-invariants.ts`、`scripts/test-invariants.ts`、`scripts/verify-built-package-invariants.mjs`、`scripts/publint-all.ts`、`scripts/verify-node-next-types.ts`、`scripts/verify-dsh-package-licenses.ts`、`scripts/verify-cordis-config.ts` 和 release-family discovery 都使用 `packages/*/*` 或 manifest discovery，无需加包名。
- `scripts/verify-config-source-ownership.ts` 已扫描 `packages/*/*/cordis.patch.yml`，会自动覆盖 curated bundle。
- `scripts/verify-cordis-config.ts:282-290` 按 `dsh.bundle.patch` 发现任意组中的 bundle；无需把 `curated-base` 加到 `packages/bundle/*` 特例。
- `vitest.config.ts:90-95,177` 自动发现五个包的测试并把源码纳入 per-file coverage。
- `scripts/type-equiv.manifest.json` 只有在文档复制公开类型时才更新；新增包本身不触发。
- `apps/cli/package.json`、`packages/boot/app-boot/src/profile.ts::PROFILE_TEMPLATES` 不应在 Task 2 修改。精选 profile 由 `curated-profiles` 显式物化；把它们加入官方模板会违反“不改官方 web/headless”和“既有模板只有官方两个”的要求。

## 五个包的最近模板

### `curated-base`

- `package.json`、`src/index.ts`、`src/invariant.ts`、`tsconfig.json`：直接参照 `packages/bundle/base/`。
- `src/index.ts` 应保持静态 carrier 形式 `export {}`，不注册服务。
- `src/invariant.ts` 使用 `bundle/base` 的 explained-empty installer，包名改为 `@deepseek-ai/dsh-curated-base`。
- `package.json` 声明 `dsh.bundle.patch: "./cordis.patch.yml"`、导出 patch、发布 patch，并在 `dependencies` 声明 patch 挂载的 `@deepseek-ai/dsh-curated-policy`。
- `cordis.patch.yml` 只 insert 一个本仓库拥有的 curated-policy row；不要复制第三方 patch。

最近的 bundle test 是 `packages/bundle/base/tests/base.spec.ts:14-42`：读取 manifest 指向的 patch，用 `js-yaml` 和 `entryListSchema` 解析，再断言 row 和 manifest dependency。跨组 bundle 自动发现的回归模板是 `scripts/verify-cordis-config.spec.ts:48-87`。

### `curated-policy`

Service 形态最接近 `packages/sandbox/sandbox-policy/`：其 manifest 同时声明 Cordis 和 invariants peer/dev dependencies，tsconfig 引用 `vendor/cosmokit`、`vendor/cordis`、`vendor/schemastery`、业务依赖及 invariants，`src/invariant.ts` 展示真实数据约束的写法。`ctx.curatedPolicy` 是单数 Service，按 `packages/AGENTS.md` 应 default-export `class CuratedPolicy extends Service`；候选注册等内部贡献再使用 effect/disposer。

Task 2.3 的“无 default export”不能套在 `curated-policy` Service 上。该回归应验证 `curated-base` 的静态模块或各包 invariant companion 没有 default export；invariant 的结构门禁已由 `scripts/package-invariants.spec.ts:169-176` 给出模板。若以后某个 curated 包确实采用 named function plugin，最接近的真实 Loader 回归是 `packages/mcp/mcp-client/tests/load-path.spec.ts:17-28`。不要同时提供 default Service class 和 named function plugin。

Task 2 只需要保证 bundle row 的模块可被 Loader 接受；评分、冲突决策和 `ctx.curatedPolicy` 查询属于 Task 3。避免为通过 Task 2 创建随后删除的第二套 service 外壳。

### `curated-profiles`

Profile 文件语义和物化行为的唯一模板是：

- `packages/boot/app-boot/src/profile.ts:35-168`：目录名校验、manifest 字段、空用户 patch、pnpm workspace、不得覆盖已有文件。
- `packages/boot/app-boot/tests/profile.spec.ts:58-81,120-197`：幂等初始化、bundle 顺序、用户 patch、未知 profile 和非 bundle 拒绝。

该包应调用/复用 `@deepseek-ai/dsh-app-boot` 的 `resolveProfileDir`、`initProfile` 和 manifest API，而不是复制常量或文件写入逻辑。模板数据由该包拥有；不要向 `PROFILE_TEMPLATES` 添加五个名字。

### `curated-scripts`

可发布 package bin 的最近模板是 `packages/examples/acp-demo/package.json:13-39`、`src/bin.ts` 和 `tsdown.config.ts`。推荐一个 `lib/bin.js` dispatcher，通过四个子命令暴露 `verify-lock`、`preflight`、`smoke-profile`、`compare-benchmark`；manifest 可将多个 bin 名映射到同一个文件，仍满足 `expectedDshPackageFiles()`。

CLI 逻辑应从 `src/bin.ts` 下沉为可单测函数；自执行文件只做参数解析、输出和退出码。参数较小可参照 `packages/examples/acp-demo/src/bin.ts` 的 `node:util.parseArgs`，不必把命令接入主 `dsh` CLI。包内 `tsdown.config.ts` 必须同时构建 `lib/types/index.js`、`lib/types/invariant.js`、`lib/types/bin.js`，参照 `packages/examples/acp-demo/tsdown.config.ts:1-19`。

### `curated-bench`

没有完全同型包。manifest/tsconfig/invariant 骨架以 `packages/util/timeout/` 为最小模板；作为可复用评测库和数据目录，可参考 `packages/test-support/acp-snapshot/` 的“库 API + harness”职责分离，但不要复制其 Vitest runtime dependency。统计函数放 `src/` 并由 focused unit tests 覆盖，`benchmarks/` 只保存规格要求的 manifests/tasks/baselines。

## Invariant 模板

所有五个包都必须：

- manifest 导出 `./invariant` 到 `./lib/types/invariant.d.ts` 和 `./lib/invariant.js`；
- `files` 包含 `lib/invariant.js`；
- peer/dev dependency 都包含 `@deepseek-ai/dsh-invariants: "workspace:^"`；
- tsconfig 可达 `../../runtime-diagnostics/invariants`；
- companion 使用 named `name`/`inject`/`apply`，不得 default export，并以 `ctx.invariants.register(PACKAGE_NAME, install)` 返回 disposer。

纯 bundle、profile 数据、CLI 和尚无运行时关系的 benchmark 使用 `packages/bundle/base/src/invariant.ts` 或 `packages/util/timeout/src/invariant.ts` 的 `No runtime invariant:` 模板，并给出包专属理由。`curated-policy` 一旦拥有可变 catalog/profile 关系，应改用真实 invariant，写法参照 `packages/sandbox/sandbox-policy/src/invariant.ts`。仓库的 source/built companion 门禁和测试 host 都已自动发现新包，不改清单。

## Task 3/4 才触发的清单

当 Task 3 真正声明 `ctx.curatedPolicy` 时：

- 在 `scripts/gen-cordis-catalog.ts::SERVICE_PAGE` 增加 `curatedPolicy` 的 subsystems page 映射；不要放进 `SERVICE_WALK_EXEMPTIONS`，因为它是真实 Host service。
- 新增或选择承载该 API 的 `docs/subsystems/*.md` 中英文页面及 i18n 记录，并生成 Cordis catalog；生成结果会更新该 subsystem 的 `cordis-surface` 区域和 `packages/extensions/tool-cordis/src/api-catalog.ts`。
- 若导出 `Config` schema，运行 config catalog 生成器会更新 `docs/config-catalog.md`；同步中文 counterpart 和 pairing record。生成器本身按 manifest 自动发现，无需硬编码包名。

若 Task 6 按现有架构文档让 `curated-bench` 声明 `ctx.curatedBench`，同样要为 `SERVICE_PAGE` 和对应 subsystem 文档接线；若它只导出纯统计函数和数据，则不需要 Cordis catalog 项。

当 Task 4 物化 profile 时，测试应复用 `app-boot` API 并断言官方 `web`/`headless` 目录字节不变；仍不修改官方 `PROFILE_TEMPLATES`。当 profile manifest 开始声明第三方依赖时，更新 `pnpm-lock.yaml` 只涉及仓库 workspace 自身的依赖，第三方候选仍应安装在目标 DSH home，不能进入根 workspace lockfile。

## Task 2 最小验证

建议按以下顺序执行，均可使用 focused 路径或叶级脚本：

1. `pnpm exec vitest run packages/curated/*/tests/**/*.spec.ts scripts/verify-cordis-config.spec.ts scripts/package-invariants.spec.ts`
2. `pnpm run constraints`
3. `pnpm exec tsc -b packages/curated/curated-policy packages/curated/curated-base packages/curated/curated-profiles packages/curated/curated-bench packages/curated/curated-scripts --pretty false`
4. `pnpm run verify-package-invariants`
5. `pnpm run verify-cordis-config`
6. `pnpm run verify-module-graph`
7. 对新增 README pair 运行 scoped translation-pairing、Model Experience、limitations 和 Markdown 检查。

Task 2 的 bundle 测试应至少证明：manifest patch 路径存在、`entryListSchema` 可解析、恰好插入 curated-policy row、row 无第三方源码/patch、manifest 声明该本地依赖。无-default-export测试应针对 `curated-base` 静态模块或 invariant companion；后者的同一规则已由 `verify-package-invariants` 和 built companion gate覆盖。

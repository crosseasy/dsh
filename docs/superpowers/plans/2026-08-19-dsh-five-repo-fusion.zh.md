# DSH 五仓库融合实现计划（v2）

[English](2026-08-19-dsh-five-repo-fusion.md) | 中文

> **给 agent 工作者：** 使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 执行任务，并用复选框跟踪步骤。
>
> **历史计划：** 本文档记录 v2 执行计划。2026-08-21 Task 12 章节只记录已经验证的结果，不把较早的计划工作改写成当时已经获知的事实。

**当前状态：** Task 12 至 Task 21 已完成。Task 18 截止后候选审计、Task 21 rescope 与产品文档修正、独立复审、最终验证补救、Chrome CDP 恢复及最终 64 文件对齐复审均已批准。

**当前结果：** 最终 Web 外部集合为空。ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 都是有证据支持的 blocker；shim、核心改动、弱化生命周期判据或历史运行时计数均不能使其准入。截止后审计覆盖 ModLens `3.22.2`／`3.23.0`／`3.23.1`、17 个 Web UI 身份各自的 `0.2.6`／`0.2.7`、Better Sidebar `0.15.0` 和 dsh-TUI `0.8.7`／`0.8.8`。Pet 与 Git Graph 在两个新 Web UI 波次中都已静态修复授权，但精确许可证身份失败；完整安全与运行时检查为 `NOT RUN`。Better Sidebar 通过 `ctx.tools` 注册，但在模型命令到达继承 ambient 环境的无约束 PTY 前，没有包自有批准决策或不可变部署锁。当前 oracle 通过 196/196，compact 为 7 项/401 tokens，投影消息 token 从 448 降至 155，重启后保持 155。历史三行 1/1 gate 与 174/174 oracle、历史四行 1/1 与 170/170，以及历史六行 156/156 都只保留为被取代的证据。六个 runtime event id 使用规范的 `cordis/*` 名称且没有 alias。rescope 分类器在保留 event 与 locale id 的同时识别模块和包元数据引用，包括有效 JSON/JSONC 围栏内的包依赖键；格式错误的围栏保持不变。REAL process helper 已通过独立复审并为每个流保留 64 KiB byte-bounded tail。TUI `0.7.1` 源码运行时通过；`0.8.7` 与 `0.8.8` 运行时为 `NOT RUN`，公开交付保持阶段 2 BLOCKED。

**目标：** 保留纯 Fusion bundle（`@deepseek-ai/dsh-fusion`）、一个共享 `liangshen` preset 和可复现的零行 profile 组合，同时保持 `packages/core/**`、agent loop 和 session 格式不变。

**架构：** 仓库拥有的集成点位于 `packages/bundle/fusion/`、`apps/cli/config/agent-presets/liangshen/`、profile 组合文档和相应测试。在某个已发布外部包通过全部准入判据前，Fusion patch 与 profile dependency map 保持为空。

**技术栈：** TypeScript ESM、pnpm workspaces、Cordis 插件、dsh profile 与 patch、Vitest、通过 CDP `9333` 驱动的系统 Chrome，以及真实 PTY。

---

## 全局约束

- 保持 `packages/core/**`、agent loop 和 session 格式不变。非 Fusion 包只允许恢复六个 `cordis/*` runtime event id、约束 rescope 只改写模块和包元数据引用而不改写 event、locale 或 data id、同步 producer、allowlist、consumer、测试和生成文档，以及限制 REAL process 输出。
- 只有在隔离安装、组合、真实启动、目标能力可见、浏览器或终端诊断干净、完整 effect/disposer 所有权和断连重挂全部通过后，才能接受一个精确包版本。记录 peer 漂移，但不能仅凭 peer 漂移判定运行时失败。
- 所有外部包使用精确版本；不得使用 `^`、`~` 或 `latest`。
- 不得把第三方运行时依赖写入 `packages/bundle/fusion/package.json`。
- 零行 REAL composition fixture 和 profile 不得包含外部依赖、React peer 或外部 `allowBuilds`；也不得把这些内容写入仓库根 `package.json`、根 lockfile 或根 `pnpm-workspace.yaml`。
- 每类能力只保留一个实现，并拒绝重复配置行。
- 只通过 CDP `9333` 使用系统 Chrome；不得调用 `chromium.launch()` 或使用 IDE 浏览器。
- 默认单测与覆盖率测试必须离线；只有显式 REAL composition lane 可以安装 profile 局部外部包。
- REAL process 的每个 stdout/stderr diagnostic tail 必须按字节限制为 64 KiB，同时保留跨 chunk readiness 匹配。
- `cordis/request-run`、`cordis/request-run-resolved`、`cordis/dynamic-package`、`cordis/dynamic-retract`、`cordis/inspect-query` 和 `cordis/inspect-query-resolved` 是唯一 event id；不得增加兼容 alias。
- 保留失败和阻塞证据。不得把历史失败改写为成功。
- `.trae/specs/**` 与 `docs/superpowers/**` 下的 tracked 计划和执行记录已有 Git index 条目；其本轮工作树修改必须保持 unstaged。当前未跟踪的翻译对、sidecar 与 `.superpowers/**` 报告不得加入 Git index。
- 未经用户授权，不得 commit、push、merge、rebase 或 reset。
- 阶段 1 独立交付；阶段 2 blocker 不使已接受的阶段 1 能力失效。

---

## 关键参考

- 设计：`docs/superpowers/specs/2026-08-19-dsh-five-repo-fusion-design.md`
- Patch bundle 模板：[`packages/bundle/base/`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/base)
- Bundle 机制：[`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)
- Profile 启动：[`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)
- 插件组合：[`apps/cli/src/plugin.ts`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)
- Preset 模板：[`standard/`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/config/agent-presets/standard)
- 根构建策略：[`pnpm-workspace.yaml`](file:///Users/bytedance/opencode/agent/dsh/pnpm-workspace.yaml)
- 兼容性证据：`docs/superpowers/plans/fusion-compat-matrix.md`

---

## 阶段 1：核心 Web 交付

### Task 0：锁定外部包精确版本

**目的：** 对每个候选应用运行时经验判据，并记录精确版本、声明的 peer、构建许可、能力证据和 blocker。

- [ ] 构建仓库产物。
- [ ] 在隔离 profile 中测试 ModLens 和每个保留的 Web 包。
- [ ] 验证 describe-image、AionUI Panel 和聚合包 `web-ui-all` 配置行不存在。
- [ ] 向兼容矩阵追加证据，不替换历史 Round。

### Task 1：创建纯 Fusion Bundle

**目的：** 新增不含第三方运行时依赖的最小可构建 patch bundle。

- [ ] 新增包 manifest、patch、ESM 入口、invariant companion、README 双语对和相应测试。
- [ ] 仅在确有需要时把包注册到编译和 hygiene 输入。
- [ ] 验证 focused tests、typecheck、build、package invariant 和 hygiene。

### Task 2：挂载已接受的 Web 配置行

**目的：** 只插入由 profile 持有且已接受的精确包配置行。

- [ ] 先编写精确集合的失败测试。
- [ ] 向 `cordis.patch.yml` 添加选定配置行。
- [ ] 断言重复项和阻塞项仍然不存在。
- [ ] 验证 focused test 和配置检查。

### Task 3：新增共享 Liangshen Preset

**目的：** 为 Web 与 TUI 保留一个由仓库拥有的 preset。

- [ ] 从精确来源 `0.2.4` 提取两阶段工具锚定。
- [ ] 在 Windows 上保留仓库沙箱与批准路径；不得复制不受约束的自定义 Bash 实现。
- [ ] 验证发现、挂载、隔离、快照和 focused platform tests。

### Task 4：组合并验证 Web Profile

**目的：** 文档化并运行使用精确 profile 局部依赖的 `base -> web-app -> fusion`。

- [ ] 记录精确依赖和 profile 局部构建许可。
- [ ] 启动真实 profile，并通过系统 Chrome CDP `9333` 检查。
- [ ] 验证所有已接受入口、干净诊断和清理结果。
- [ ] 更新双语产品指南及其网站投影。

### Task 5：回归既有 Web 行为与去重

**目的：** 证明已接受的 Fusion 配置行不改变既有 `base + web-app` 路径。

- [ ] 验证对话、工具卡片、New Session、会话列表、fork、resume、compact、export、Search、Settings 和模型选择。
- [ ] 验证只有一个 ModLens 图像工具、不含 `describe_image`、不含 AionUI Panel，并且移动端实现和 Liangshen 所有者各一个。
- [ ] 验证 stock Web、headless 和 ACP 隔离。
- [ ] 在回归报告中保留命令、浏览器和清理证据。

### Task 6：定义桌面端消费约定

**目的：** 文档化精确 npm 消费和能力所有权，不修改或发布外部桌面端仓库。

- [ ] 文档化 Fusion profile、远程能力所有权和桌面壳职责。
- [ ] 验证包 exports、files 和外部 NodeNext 消费。
- [ ] 运行文档检查，不执行发布。

---

## 阶段 2：门控扩展

### Task 7：Better Sidebar

- [ ] 选择同时通过运行时与安全判据的最高精确候选。
- [ ] 要求不可变的部署策略：在保留完整 Settings 体验和可用 UI Terminal 的同时，阻止 `terminal_*` 模型工具注册。
- [ ] 两项判据都通过时，在原生左侧栏旁挂载一个右侧工作台配置行，并验证 Files、Editor、Terminal 和 Source Control。
- [ ] 否则保持 Better Sidebar 未挂载，记录阶段 2 blocker，并保留阶段 1。

### Task 8：TUI

**当前结果：** 源码运行时 PASS；公开交付 BLOCKED。

- [ ] 选择只有一个 Liangshen 所有者且包图可消费的最高精确版本。
- [ ] 在真实全新和恢复 PTY 中验证顶栏、状态、输入、工具提升、消息往返、持久回放、受支持退出和清理。
- [ ] 记录 DSH 和 React peer 漂移，不得隐藏。
- [ ] 仅为已接受的操作步骤发布双语指南。

---

## 最终复审任务

### Task 9：原最终验证

- [ ] 运行 focused tests、typecheck、build、hygiene、文档检查、lint、diff checks 和真实 Web/TUI 冒烟测试。
- [ ] 完成独立 checklist、代码、安全、架构、性能和系统语义审查。
- [ ] 记录 owning Agent Note，并保持计划／证据暂存边界。

### Task 10：新鲜交付复审

- [ ] 从零审查当前 staged delivery，并排除执行记录。
- [ ] 修复 Critical 与 Important 发现，并独立复审每项修复。

### Task 11：刷新外部候选

- [ ] 获取新鲜包 metadata；变更锁定版本前，先测试所有更高候选。
- [ ] 对齐 manifest、指南、决策、profile manifest 和 lockfile。

### Task 12：2026-08-21 任务级收口

- [x] 记录许可证一致的 Git Graph `0.1.11` 原始准入所依据的隔离与组合 Chrome 证据；后续独立安全验证已取代该准入结论。
- [x] 验证 ModLens `3.22.1` 的 Settings 和粘贴策略界面。
- [x] 解决任务看板、Remote Web UI、Pet、Skin Center 与 Git Graph 的包许可证身份；许可证一致不能豁免后续发现的 Pet 与 Git Graph 授权 blocker。
- [x] 当没有能在阻止不安全模型工具的同时保留完整工作台的可接受部署开关时，移除 Better Sidebar。
- [x] 将历史六行 156/156 运行时 aggregate、7 项/402 tokens 的 compact 和重启恢复证据保留为已被后续安全复核取代的证据，而不是当前最终验收。
- [x] 仅使用已验证事实修正 durable prose 和双语语义。
- [x] 独立确认 Git Graph 已撤销设备授权绕过和 Pet 未授权状态读写路径；将 Pet、Git Graph、Skin Center 与 Better Sidebar 归类为外部 blocker。
- [x] 将产品 patch、profile dependency metadata、测试和产品指南收敛为且仅为 ModLens `3.22.1`、任务看板 `0.1.11`、SSH `0.2.5` 和 Remote Web UI `0.1.11`。
- [x] 新增 checked-in REAL composition lane，通过系统 Chrome CDP `9333` 实际激活全部四行，禁止调用 `chromium.launch()`，并保持默认单测与覆盖率测试离线。
- [x] REAL composition 依赖、lock 数据和构建许可只存在于 fixture/profile；不得向根依赖、根 lockfile 或根 `allowBuilds` 添加第三方包。
- [x] 重跑完整四行 Web oracle，覆盖既有 Web 行为、去重、干净诊断、compact、重启恢复和 blocker 排除。独立新结果为 170/170、7 项/401 tokens、投影 token 从 448 降至 160，并在重启后恢复同一 durable session。
- [x] Task 12.11：从产品 patch、profile metadata、REAL fixture、测试和产品指南移除 Task Board，收敛为最终三行；撤销仅为 Task Board 增加的 `data-pane="conversation"` AppFrame contract；保留 26 个发布版本的生命周期／许可证／运行时 blocker，不得增加 shim 或核心改动。
- [x] Task 12.12：将六个 runtime event id 恢复为 `cordis/*`；让 rescope 改写模块引用但不改写 event 或 locale id；更新全部 producer、Remote allowlist、consumer、测试和生成文档；增加 module-import 正控和 event/locale 负控；不得增加 alias。
- [x] Task 12.13：独立复审按 TDD 实现的 REAL process helper 改动，确认每个 stdout/stderr diagnostic tail 限制为 64 KiB，同时保留跨 chunk readiness 匹配。
- [x] Task 12.14：为历史三行阶段重建 checked-in fixture，重跑对应 gate 与完整 Web oracle，并同步该阶段的产品文档、生成文档及其双语 sidecar。gate 通过 1/1；完整 oracle 通过 174/174，实际 compact 为 7 项/402 tokens，投影消息 token 从 449 降至 155，并在重启后恢复同一 session 且保持 155。后续生命周期审查已取代该准入证据。
- [x] Task 12.15：审计 ModLens、SSH 与 Remote Web UI 生命周期所有权，并撤销历史三行准入。ModLens 的全部 DSH 候选都丢失 route disposer；SSH 26/26 会留下活跃 terminal 与 SSH session；Remote Web UI 的准入结果为 0/26，因为 `0.1.11` 遗留 SSE、tunnel 完全停稳、客户端 subscription 与 failed-pair root 问题，而 `0.1.12+` 另有 manifest/LICENSE 身份冲突。
- [x] Task 12.16：使用 AST context 修复 vendored rescope 分类，使模块 import 继续改写而 event 与 locale id 保持不变；独立实现和复审报告保存在 `.superpowers/sdd/task13-final/`。
- [x] Task 12.17：将 Fusion bundle、manifest、REAL fixture/tests、产品指南、desktop 契约、网站标签、Agent Note 与执行记录收敛为零外部行和 8 个 blocker，同时保留纯 ESM exports 与 invariant companion。

Task 12.7 至 Task 12.14 只作为已完成的历史阶段保持勾选。对应的三行 1/1 与 174/174、四行 1/1 与 170/170、六行 156/156 结果已被后续生命周期与安全审查取代，不能满足 Task 13。Task 12 顶层跨域审查已完成。

### Task 13：最终整体交付验收

- [x] 运行全部相关静态与文档检查。
- [x] 通过系统 Chrome CDP `9333` 再次确认最终零行 Web profile：REAL gate 通过 1/1，完整 oracle 通过 196/196，三项负控均按预期阻断，compact 记录 7 项/401 tokens 和投影消息 token 448→155，重启后保持 155，独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`。历史三行、四行和六行结果均不能满足本项。
- [x] 保留纯 rc.5 源码验证 PTY PASS，同时在一致 rc.5 闭包公开可用，或明确批准新的 Harness 基线并全面重验之前，将公开交付保持为阶段 2 BLOCKED。
- [x] 完成独立 checklist 复审，然后只追加一次 progress。

### Task 14-17：Round 3 复审收敛

- [x] 修复 rescope 对多行与 TSX/JSX 模块引用、显式 Node 解析调用，以及有效 JSON/JSONC 围栏中 package manifest 依赖键的分类，同时保留 runtime、locale、data id 与格式错误围栏的原文。
- [x] 使用一个 deadline 限制 REAL command 和进程树清理，包括进程树退出后的 outcome 结算。
- [x] 按 HTTP(S) origin 规范化 Chrome target 匹配，并把 Web UI 聚合包加入文档化禁止集合。
- [x] 对齐验收记录，只暂存 58 个产品文件，重跑受影响与仓库级检查，并完成 exact-staged 代码和安全复审且无未解决 P0、P1 或 P2 finding。

### Task 18：截止后外部候选审计

本次审计使用 `2026-08-21T02:11:00Z` 截止时间，并覆盖其后的全部发布版本。ModLens 目前有 76 个发布版本、38 个 DSH 候选和 3 个截止后候选；精确 `3.23.1` 通过产物、许可证、安装与组合检查，但直接 dispose／重挂检查失败。17 个 Web UI 身份在截止后各自都有 `0.2.6` 与 `0.2.7`；34 个精确 tarball 均已绑定，适用的许可证、安全、生命周期、所有权与去重结论继续保持 Fusion Web 零配置行。

Better Sidebar 有 13 个发布版本；精确 `0.15.0` 仍被部署所有权和继承 ambient 环境的无约束 PTY sink 阻塞，而不是绕过整个 ToolRuntime。dsh-TUI 有 19 个发布版本；精确 `0.8.7` 与 `0.8.8` 各自包含 24 个非 rc.5 peer、0 个根与 15 个打包内 `workspace:*` 值，以及 8 个打包的 Liangshen 文件。历史公开安装查询覆盖 23 包直接子集；新的完整源码闭包查询在 41 个包中找到 0 个精确 rc.5。两个新 TUI 候选均在静态所有权与公开闭包门失败，因此安装与 PTY 运行时为 `NOT RUN`。[兼容矩阵](fusion-compat-matrix.md)记录详细版本计数、结果和证据路径。

---

## 自审

- 运行时判据测量已安装产品，而不只测量 peer metadata。
- Profile 所有权防止第三方依赖树污染仓库 workspace。
- ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 是有证据支持的外部 blocker，不是被省略的成功项。
- 运行时可见不能豁免路由授权或产物许可证身份；Pet 与 Git Graph `0.1.11` 保留其历史授权缺陷，`0.2.6` 与 `0.2.7` 已静态修复授权，但在完整安全／运行时验证前仍因精确许可证冲突被排除。
- 首次加载可见不能豁免插件生命周期所有权；在某个已发布版本同时满足完整 effect/disposer 清理、完全停稳的 dispose、断连重挂、许可证身份、rc.5 runtime 与同页生命周期验证前，ModLens、SSH、Remote Web UI 与 Task Board 保持排除。
- 包 rescope 只改写模块说明符，不改写 runtime event 或 locale id；六个 `cordis/*` id 保持规范且没有 alias。
- TUI `0.7.1` 与 Liangshen 来源 `0.2.4` 保持单一 preset 所有权。纯 rc.5 源码验证运行时通过。历史公开安装尝试在其直接子集中发现 23 个缺失包，新的完整查询在 41 个包中找到 0 个精确 rc.5；因此不存在受支持的公开组装方式。
- 历史失败保留为证据。文档顶部和 Task 18 结果说明当前候选与交付状态；Task 12 章节将其中的三行、四行和六行运行时阶段明确标记为被取代的证据。

---

## 执行交接

Task 12 至 Task 21 已完成。最终 Fusion Web 外部集合保持为空，TUI `0.7.1` 源码运行时保持 PASS，TUI `0.8.7` 与 `0.8.8` 运行时保持 `NOT RUN`，公开 TUI 交付保持阶段 2 BLOCKED。精确的 64 文件产品交付已 staged；规划与执行记录保持在 staged 产品集合之外。最终 progress 记录为 `Round 5 Final 64-File Alignment (2026-08-22)`。

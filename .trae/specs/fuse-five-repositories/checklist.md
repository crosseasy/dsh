# 验收清单（v2）

## 阶段 1

- [x] 兼容矩阵记录 modlens、Liangshen 源包及所有保留 web-ui 子包的精确版本、声明 peer、profile allowBuilds、隔离安装、组合、实际 boot、Chrome console 和目标能力结果。
- [x] 最终 Web 外部集合为空；ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 均因未通过完整准入判据而保持 blocker，历史部分 runtime PASS 不作为准入 PASS。
- [x] `@deepseek-ai/dsh-fusion` 可构建、可发布、可由 profile composer 解析，并导出运行时入口、patch 与 invariant companion。
- [x] fusion manifest 不声明 modlens、web-ui、better-sidebar 或 dsh-TUI 等第三方运行时依赖，根 `pnpm-workspace.yaml` 未因 fusion 增加 allowBuilds。
- [x] fusion README 英中配对、Model Experience、Known Limitations 与 bundle roster 符合仓库规则。
- [x] fusion patch 与 profile dependency metadata 均为空，且不引用 ModLens、SSH、Remote Web UI、Task Board、Pet、Git Graph、Skin Center、Better Sidebar、web-ui-all、describe-image 或 aionui-panel。
- [x] `liangshen` preset 可发现、可挂载、realm 合法，并保留 standard 完整能力与来源包中验证过的两阶段锚定差异。
- [x] `fusion` profile 的 bundle 顺序为 base、web-app、fusion；外部包只存在于 profile dependencies；现有 web/headless 模板未修改。
- [x] 历史三行系统 Chrome CDP `9333` 结果为 1/1 与 174/174；ModLens、SSH 与 Remote Web UI 生命周期审查已取代其准入结论。
- [x] Task 13 最终零行 REAL gate 通过系统 Chrome CDP `9333` 取得 1/1，完整零行 Web oracle 通过 196/196，三项负控通过 3/3，compact 为 7 项/401 tokens、投影消息 token 为 448→155，服务重启后保持 155，独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`；八个 blocker 的 Host rows、browser entries、client resources、UI roots、routes 与 tools 全部缺席，stock Web 基本可见，console/page/network/cleanup 干净。
- [x] 阶段 1 既有 `base + web-app` 路径回归全部通过：对话、工具卡片、会话管理、Search、Settings、模型选择；右侧 Files/Web Editor/Terminal/Git 不属于本项。
- [x] describe-image、aionui-panel、重复移动端远程和重复 Liangshen 未在阶段 1 运行态激活，启动日志无 slot/service 冲突。
- [x] headless、ACP 与现有 web profile 未加载 fusion，原有行为保持不变。
- [x] desktop shell 契约只定义精确 npm 消费和能力所有权；Fusion 不提供 Remote 时，桌面壳可保留并管理自身实现，不发布包、不修改外部 desktop 仓库。

## 阶段 2

- [x] better-sidebar 使用通过运行时与安全判据的最高精确版本，声明 peer 漂移与 override 已记录；通过则右侧 Files/Web Editor/Terminal/Git 工作台与左侧 ui-sidebar 并存且 console 无错误，否则有完整 blocker、保持未挂载且不影响其余交付。
- [x] dsh-TUI 使用锁定版本在真实 PTY 启动并完成消息往返；`workspace:*`、React 与 Liangshen 所有权已评估，或该扩展被如实标记为阶段 2 阻塞而不影响阶段 1。
- [x] fusion-tui 产品指南具备英文、中文、i18n sidecar 与网站投影；运行时通过但公开闭包不可重建时，指南如实标记阶段 2 阻塞且不提供混合版本组装命令。

## 仓库与交付

- [x] 产品指南均具备英文、中文和 i18n sidecar，并通过 `website/docs.ts` 显式投影。
- [x] Agent Note 记录运行时兼容判据、第三方依赖所有权、去重所有权、profile 组装和重新验证条件，且同主题 active note 已审计。
- [x] focused tests、typecheck、build、hygiene、doc-sync、docs:check、lint 和 `git diff --check` 均有新鲜成功证据。
- [x] 独立最终代码审查无未解决的 Critical 或 Important 发现；Task 12.11–12.14 的任务级复审不能替代整体最终代码审查。
- [x] 除新增 fusion package、明确的注册/测试/文档/Agent Note，以及 Cordis rescope 维护触达的 extension/API 合同文件外，既有核心 `packages/core/**`、agent-loop 与 session 格式未修改。
- [x] 未执行未经授权的 commit、push、merge、rebase 或 reset。
- [x] `.trae/specs/**`、`docs/superpowers/**`、兼容矩阵和回归记录中的 tracked 文件已有 Git index 条目，其本轮工作树修改均保持 unstaged；未跟踪的翻译对与 sidecar 未进入 Git index。

## 从零复审与优化

- [x] 当前 staged delivery 有新的审查包，且审查包明确排除 `.trae/specs/**`、`docs/superpowers/**` 与 `.superpowers/**` 执行记录。
- [x] 独立 plan/design/spec 对齐审查无未解决的 Critical 或 Important 发现。
- [x] 独立实现/测试/文档语义审查无未解决的 Critical 或 Important 发现。
- [x] 最终零行集合的独立整体安全审查无未解决阻塞发现；八个外部包的任务级 blocker 结论不能替代整体安全复审。
- [x] 所有 Task 12.11–12.14 修复均有对应复审结论和最小必要 gate 成功证据；REAL process helper 的 64 KiB bounded-tail 修复已通过独立复审。
- [x] Pet 与 Git Graph 移除后的历史四行 Web smoke 已通过系统 Chrome CDP `9333` 重跑；四行 gate 为 1/1 PASS，完整 oracle 为 170/170、实际 compact 为 7 项/401 tokens。Task Board 生命周期审查已取代该证据，不能用于最终零行验收。
- [x] `.trae/specs/**`、`docs/superpowers/**`、兼容矩阵和回归记录仍未 staged，且未执行未经授权的 commit、push、merge、rebase 或 reset。

## 2026-08-21 新鲜复审

- [x] 当前 staged delivery 审查包完整，且明确排除 `.trae/specs/**`、`docs/superpowers/**` 与 `.superpowers/**` 执行记录。
- [x] 外部 npm 元数据为本轮新鲜结果；候选版本均已实测接受或拒绝并记录，Task Board 的 26 个发布版本均不满足完整准入条件。
- [x] fusion manifest、patch、产品指南、兼容矩阵、Agent Note 与真实 profile manifest/lockfile 均声明零外部行和八个 blocker，且 fixture 不含外部依赖、React peer 或 build approvals。
- [x] 独立 plan/design/spec 对齐、实现/测试、文档语义、安全、依赖/许可证、性能与系统语义审查无未解决 Critical/Important 或规格阻塞项。
- [x] Task 12.11–12.17 的本轮修复均有失败证据、最小实现、覆盖测试或独立审计；未使用 shim、核心改动、测试弱化或历史运行时豁免。
- [x] focused tests、typecheck、build、lint、hygiene、doc-sync、docs:check、Agent Note、发布物/NodeNext consumer 与 diff checks 均有本轮成功证据。
- [x] Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 均有独立 blocker 证据：全部 26 个 Task Board 发布版本都不同时满足完整 effect/disposer 与断连重挂、manifest/LICENSE 一致和 rc.5 runtime；Pet 缺少共享 WebServer 路由授权；Git Graph 绕过 Remote Web UI 撤销；Skin Center 许可证一致候选不可见；Better Sidebar 模型工具绕过 sandbox/approval/environment scrubbing。
- [x] 历史 checked-in REAL composition gate 实际激活四行并通过系统 Chrome CDP `9333` 取得 1/1 PASS；该证据已被 Task Board 生命周期审查取代，不得用于最终零行验收。
- [x] 默认 `pnpm run test` 与 `pnpm run test:coverage` 不访问 npm registry；只有显式 REAL composition lane 可以安装 profile 局部外部包。
- [x] 历史四行 REAL composition fixture/profile 独立固定第三方包、lock 与 `allowBuilds`，仓库根 `package.json`、根 lockfile 和根 `pnpm-workspace.yaml` 未引入第三方包或构建许可。
- [x] 历史四行系统 Chrome CDP `9333` 验证覆盖四行组合、既有 Web 路径、去重、Pet/Git Graph/Skin Center/Better Sidebar 排除和 clean diagnostics；oracle 为 170/170 PASS，实际 compact 为 7 项/401 tokens、投影 token 为 448→160，并在服务重启后恢复同一 durable session。该结果已被 Task Board 生命周期审查取代；历史六行 `156/156`、7 项/402 tokens 同样不能用于最终零行验收。
- [x] Task Board 已从产品、fixture、测试和产品文档移除，仅为其增加的 `data-pane="conversation"` AppFrame contract 已撤销；该历史三行阶段的正集合恰好为 ModLens `3.22.1`、SSH `0.2.5` 与 Remote Web UI `0.1.11`，并已被后续生命周期审查取代。
- [x] 六个 runtime event id 已恢复为原 `cordis/*`；rescope 的 module-import 正控与 event/locale 不改写负控通过，producer、Remote allowlist、consumer、测试和生成文档一致，且不存在兼容 alias。
- [x] REAL process helper 的 stdout/stderr 各自只保留最多 64 KiB byte-bounded diagnostic tail，跨 chunk readiness marker 继续工作，TDD 证据与独立复审均通过。
- [x] 历史三行 checked-in REAL composition gate 为 1/1 PASS，完整 Web oracle 为 174/174 PASS；实际 compact 为 7 项/402 tokens，投影消息 token 为 449→155，重启同一 session 后保持 155。ModLens、SSH 与 Remote Web UI 生命周期审查已取代该准入证据。
- [x] 最终零行 checked-in REAL composition gate 通过 1/1，完整零行 Web oracle 通过 196/196，三项负控通过 3/3，compact 为 7 项/401 tokens、投影消息 token 为 448→155，服务重启后保持 155，独立证据／运行时复审结论为 `EVIDENCE PASS / RUNTIME PASS`。
- [x] 真实 PTY 的 fusion-tui `0.7.1` fresh/resume 验证共享 Liangshen、消息往返、durable log、正常退出和无残留进程；41 包纯 rc.5 源码验证闭包运行时 PASS，但 npm registry 缺少 23 个所需 rc.5 包且没有受支持的公开闭包，因此公开交付保持阶段 2 BLOCKED。
- [x] `packages/core/**`、agent-loop 与 session 格式保持零改动；执行记录未 staged，且未执行 commit、push、merge、rebase 或 reset。
- [x] Task 13 的零行 Web、静态／文档检查和最终独立验收全部完成，并已追加唯一最终 progress 记录。

## Round 2 复验缺口

- [x] `rescope-vendor` 在 locale/data id 与模块引用同一行时仍改写模块引用，并支持 Markdown 与模板中的多行静态或动态模块引用，同时保持 event/locale id 不变。
- [x] `runManagedCommand` 面对永不结算的 `done` 时在清理预算内失败，且永久测试分别覆盖 stdout/stderr 64 KiB 上限与跨 chunk UTF-8 边界。
- [x] 验收清单不再声称所有阶段 1 外部版本通过准入，并准确区分 tracked-but-unstaged 执行记录与不在 Git index 中的文件。

## Round 3 最终收敛

- [x] 全部有效 finding 已通过 TDD 修复并完成独立复审：rescope 裸 locale/data id、TSX fence、Node `import.meta.resolve`/`module.require`、有效 JSON/JSONC 围栏的 dependency 与 `peerDependenciesMeta` 键、格式错误围栏保护、REAL command/`stopTree` 有界结算、CDP target URL 规范化，以及 fusion 指南禁止集合中的 `web-ui-all`。
- [x] 仅 Round 3 产品代码、测试和产品文档的最终内容进入既有 staged delivery；`.trae/specs/**`、`docs/superpowers/**`、`.superpowers/**` 的修改或未跟踪执行记录保持不 staged。
- [x] focused tests、typecheck、lint、hygiene、doc-sync 28/28、docs:check、工作树与 staged diff check，以及 cached 禁止路径为空检查全部通过。
- [x] 最终 staged review package 已完成 bits 分组与跨组复审、整体代码审查、安全审查和 plan/design/spec 对齐复审，且无未解决阻塞 finding。
- [x] 唯一 `Round 3 Final Convergence (2026-08-22)` progress 已 append-only 追加且尾部为 PASS，plan/design 的最终 progress 指针已更新，并已重新逐项验证 checklist。
- [x] Round 3 未执行 commit、push、merge、rebase 或 reset；2026-08-20 的 baseline commit/push 早于 Round 3，不能据此声称本轮违规或推断其授权。

## Round 4 复验缺口

- [x] 兼容矩阵覆盖 `2026-08-21T02:11Z` 截止后发布的完整集合：ModLens `3.22.2`、`3.23.0` 与 `3.23.1`，全部 17 个 Web UI 身份（含 Liangshen）的 `0.2.6` 与 `0.2.7`，Better Sidebar `0.15.0`，以及 dsh-TUI `0.8.7` 与 `0.8.8`；每个精确候选均有适用的完整准入或阻塞证据，下游 Chrome 或 PTY 检查在前置门失败时准确记为 `NOT RUN`。
- [x] staged 中文产品文档与 Agent Note 的正文遵循 `docs/i18n/terminology.md` 对 `runtime`、`registry`、`session`、`manifest`、`dispose` 和 `fixture` 的强制译法及首次出现规则。
- [x] `scripts/rescope-vendor.spec.ts` 永久覆盖带注释的有效 JSONC dependency/`peerDependenciesMeta` 键正反向改写及格式错误 JSONC 围栏保持不变。

## Round 5 复验缺口

- [x] Task 21 的混合正反向与幂等测试证明独立 JSON、YAML 和文档正文只改写模块或包元数据引用并保留 event、locale、data id 与普通引用文本；四份 Fusion 产品文档只链接 owning Agent Note，并且产品源码、测试、双语文档与伴随记录通过指定门禁且精确 staged。

## Ralph Loop 2 复验缺口

- [ ] 兼容矩阵覆盖 17 个 Web UI 身份的 `0.2.8` 精确发布物，并按完整准入判据更新版本计数、证据和最终结论。
- [ ] checked-in REAL composition gate 使用真实 HTTP 方法验证外部路由不存在，且挂载 `/git/branches` GET handler 的负控必然失败。
- [ ] fusion-tui `0.7.1` 的 fresh/resume PTY 重复运行均通过支持退出检查，且每轮退出后无残留进程。

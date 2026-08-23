# 验收清单（v2）

## 阶段 1

- [x] 兼容矩阵记录 modlens、Liangshen 源包及所有保留 web-ui 子包的精确版本、声明 peer、profile allowBuilds、隔离安装、组合、实际 boot、Chrome console 和目标能力结果。
- [x] 当前 Web 外部集合仅包含 Pet `0.2.9` 一行；Git Graph、ModLens、SSH、Remote Web UI、Task Board、Skin Center 与 Better Sidebar 七项能力保持 blocker，历史部分 runtime PASS 不作为当前准入 PASS。
- [x] `@deepseek-ai/dsh-fusion` 可构建、可发布、可由 profile composer 解析，并导出运行时入口、patch 与 invariant companion。
- [x] fusion manifest 不声明 modlens、web-ui、better-sidebar 或 dsh-TUI 等第三方运行时依赖，根 `pnpm-workspace.yaml` 未因 fusion 增加 allowBuilds。
- [x] fusion README 英中配对、Model Experience、Known Limitations 与 bundle roster 符合仓库规则。
- [x] fusion patch 与 profile dependency metadata 只包含 Pet `0.2.9`，且不引用 Git Graph、ModLens、SSH、Remote Web UI、Task Board、Skin Center、Better Sidebar、web-ui-all、describe-image 或 aionui-panel。
- [x] `liangshen` preset 可发现、可挂载、realm 合法，并保留 standard 完整能力与来源包中验证过的两阶段锚定差异。
- [x] `fusion` profile 的 bundle 顺序为 base、web-app、fusion；外部包只存在于 profile dependencies；现有 web/headless 模板未修改。
- [x] 历史三行系统 Chrome CDP `9333` 结果为 1/1 与 174/174；ModLens、SSH 与 Remote Web UI 生命周期审查已取代其准入结论。
- [x] 历史 Task 13 零行 REAL gate 通过系统 Chrome CDP `9333` 取得 1/1，完整零行 Web oracle 通过 196/196，三项负控通过 3/3，compact 为 7 项/401 tokens、投影消息 token 为 448→155，服务重启后保持 155，独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`；当时八个 blocker 的 Host rows、browser entries、client resources、UI roots、routes 与 tools 全部缺席，stock Web 基本可见，console/page/network/cleanup 干净。
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
- [x] 历史 Task 13 零行集合的独立整体安全审查无未解决阻塞发现；当时八个外部包的任务级 blocker 结论不能替代整体安全复审。
- [x] 所有 Task 12.11–12.14 修复均有对应复审结论和最小必要 gate 成功证据；REAL process helper 的 64 KiB bounded-tail 修复已通过独立复审。
- [x] Pet 与 Git Graph 移除后的历史四行 Web smoke 已通过系统 Chrome CDP `9333` 重跑；四行 gate 为 1/1 PASS，完整 oracle 为 170/170、实际 compact 为 7 项/401 tokens。Task Board 生命周期审查已取代该证据，不能用于当前单行验收。
- [x] `.trae/specs/**`、`docs/superpowers/**`、兼容矩阵和回归记录仍未 staged，且未执行未经授权的 commit、push、merge、rebase 或 reset。

## 历史 2026-08-21 新鲜复审

- [x] 当前 staged delivery 审查包完整，且明确排除 `.trae/specs/**`、`docs/superpowers/**` 与 `.superpowers/**` 执行记录。
- [x] 外部 npm 元数据为本轮新鲜结果；候选版本均已实测接受或拒绝并记录，Task Board 的 26 个发布版本均不满足完整准入条件。
- [x] 当时的 fusion manifest、patch、产品指南、兼容矩阵、Agent Note 与真实 profile manifest/lockfile 均声明零外部行和八个 blocker，且 fixture 不含外部依赖、React peer 或 build approvals。
- [x] 独立 plan/design/spec 对齐、实现/测试、文档语义、安全、依赖/许可证、性能与系统语义审查无未解决 Critical/Important 或规格阻塞项。
- [x] Task 12.11–12.17 的本轮修复均有失败证据、最小实现、覆盖测试或独立审计；未使用 shim、核心改动、测试弱化或历史运行时豁免。
- [x] focused tests、typecheck、build、lint、hygiene、doc-sync、docs:check、Agent Note、发布物/NodeNext consumer 与 diff checks 均有本轮成功证据。
- [x] 历史 Task 13 对 Task Board、Pet、Git Graph、Skin Center 与 Better Sidebar 均有独立 blocker 证据：当时全部 26 个 Task Board 发布版本都不同时满足完整 effect/disposer 与断连重挂、manifest/LICENSE 一致和 rc.5 runtime；Pet 缺少共享 WebServer 路由授权；Git Graph 绕过 Remote Web UI 撤销；Skin Center 许可证一致候选不可见；Better Sidebar 模型工具绕过 sandbox/approval/environment scrubbing。
- [x] 历史 checked-in REAL composition gate 实际激活四行并通过系统 Chrome CDP `9333` 取得 1/1 PASS；该证据已被 Task Board 生命周期审查取代，不得用于最终零行验收。
- [x] 默认 `pnpm run test` 与 `pnpm run test:coverage` 不访问 npm registry；只有显式 REAL composition lane 可以安装 profile 局部外部包。
- [x] 历史四行 REAL composition fixture/profile 独立固定第三方包、lock 与 `allowBuilds`，仓库根 `package.json`、根 lockfile 和根 `pnpm-workspace.yaml` 未引入第三方包或构建许可。
- [x] 历史四行系统 Chrome CDP `9333` 验证覆盖四行组合、既有 Web 路径、去重、Pet/Git Graph/Skin Center/Better Sidebar 排除和 clean diagnostics；oracle 为 170/170 PASS，实际 compact 为 7 项/401 tokens、投影 token 为 448→160，并在服务重启后恢复同一 durable session。该结果已被 Task Board 生命周期审查取代；历史六行 `156/156`、7 项/402 tokens 同样不能用于当前单行验收。
- [x] Task Board 已从产品、fixture、测试和产品文档移除，仅为其增加的 `data-pane="conversation"` AppFrame contract 已撤销；该历史三行阶段的正集合恰好为 ModLens `3.22.1`、SSH `0.2.5` 与 Remote Web UI `0.1.11`，并已被后续生命周期审查取代。
- [x] 六个 runtime event id 已恢复为原 `cordis/*`；rescope 的 module-import 正控与 event/locale 不改写负控通过，producer、Remote allowlist、consumer、测试和生成文档一致，且不存在兼容 alias。
- [x] REAL process helper 的 stdout/stderr 各自只保留最多 64 KiB byte-bounded diagnostic tail，跨 chunk readiness marker 继续工作，TDD 证据与独立复审均通过。
- [x] 历史三行 checked-in REAL composition gate 为 1/1 PASS，完整 Web oracle 为 174/174 PASS；实际 compact 为 7 项/402 tokens，投影消息 token 为 449→155，重启同一 session 后保持 155。ModLens、SSH 与 Remote Web UI 生命周期审查已取代该准入证据。
- [x] 历史 Task 13 零行 checked-in REAL composition gate 通过 1/1，完整零行 Web oracle 通过 196/196，三项负控通过 3/3，compact 为 7 项/401 tokens、投影消息 token 为 448→155，服务重启后保持 155，独立证据／运行时复审结论为 `EVIDENCE PASS / RUNTIME PASS`。
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

## 历史 Round 5 复验缺口

- [x] Task 21 的混合正反向与幂等测试证明独立 JSON、YAML 和文档正文只改写模块或包元数据引用并保留 event、locale、data id 与普通引用文本；四份 Fusion 产品文档只链接 owning Agent Note，并且产品源码、测试、双语文档与伴随记录通过指定门禁且精确 staged。

## Ralph Loop 2 复验缺口

- [x] 兼容矩阵覆盖 17 个 Web UI 身份的 `0.2.8` 与 `0.2.9` 精确发布物，并按完整准入判据更新版本计数、证据和最终结论。
- [x] Task 23 历史缺席探针把 `/git/branches` 的 `GET` 响应与独立启动的 `base + web-app` 完整稳定响应作精确比较，且挂载 JSON、redirect、含 stock title 的 route-owned HTML、404 与 405 handler 负控均失败；Task 22 准入 Git Graph 后，最终 assembled gate 改用真实 `POST /git/branches` 正控验证当时路由。Task 35 的分层 oracle 取代跨 profile root 绝对相等判据，但保留每个 profile 内 blocked `GET` 与自身 `GET /` 的原始字节相等要求。
- [x] fusion-tui `0.7.1` 的 fresh/resume PTY 重复运行均通过支持退出检查，且每轮退出后无残留进程。

## Task 25 运行时修复

- [x] Task 25 历史检查点要求禁用路由与独立 `base + web-app` 基线的 status、headers 和 body 完全一致，mounted JSON、redirect、含 stock title 的 route-owned HTML、404 与 405 handler 负控均失败；Task 35 的分层 oracle 取代跨 profile root 绝对相等判据，不改写该历史结果。
- [x] 等价真实 agent/session scope 的完整 tool schemas 与 rendered prompt-visible inputs 在基线和 Fusion 间一致，同名 schema 变更、scoped 新工具和 prompt contribution 负控均失败。
- [x] 新增 RPC、HTTP fetch 和 body read 具有 `AbortSignal.timeout` 截止时间，hanging-header 与 hanging-body 测试在 cleanup 预算内失败。
- [x] Git Graph 返回 canonical 临时 workspace root、`task22` 当前分支和精确单一 current branch row。
- [x] Fusion package 测试使用 profile-local stubs 与 `profileDirectory/cordis.yml` Loader anchor，旧 parent-only 布局不能通过。
- [x] 专用 Fusion REAL lane 有 committed Pet + Git Graph ARIA golden，精确 fixture lockfile 安装保持 profile-local，默认 unit/coverage 离线。
- [x] 必需的隔离 `ubuntu-latest` Linux PR job 已配置并通过静态 CI contract 测试，本地等价的系统 Google Chrome CDP `9333` keyless Fusion snapshot/acceptance replay 已通过；实际 GitHub-hosted 执行由 CI 持有，未在本地运行，且既有 required `test:web` lane 保持不变。
- [x] Fusion fixture workspace 保留 `nodeLinker: hoisted`、`autoInstallPeers: false` 与两项精确 `minimumReleaseAgeExclude`，局部 lockfile 一致且仓库根依赖和 lock 无变化。
- [x] focused tests 与已运行系统 Chrome CDP `9333` 真实验收有新鲜成功证据，完整 RED/GREEN 记录位于 runtime remediation 报告。
- [x] testing policy 与 owning Agent Note 英中配对准确说明外部 profile required snapshot lane；Fusion 产品/plan/spec 文档的 Task 25 对齐由独立 writer 完成。
- [x] Task 25 最终 exact-staged bits 复审为 P0/P1/P2 `0/0/0`，DSH 复审为 `APPROVE`，安全复审无可利用问题；规格对齐复审唯一剩余的 progress ledger finding 已由最终 `Round 1` append-only 记录关闭。

## Ralph Loop 2/20 Round 2 复验缺口

- [x] `@liustack/modlens@3.24.0` 与 `dsh-better-sidebar@0.15.1` 已按完整准入判据审计，版本计数、兼容矩阵、Agent Note 和最终准入结论已同步。
- [x] `scripts/ci-workflow.spec.ts` 会在 Fusion CI job 丢失 15 分钟上限、相对 10 分钟验收的至少 5 分钟 reserve、`setsid`，或 `cleanup()` 未在 trap／验收前定义并按序执行 TERM、有限轮询、KILL、wait、profile 删除时失败；验收取消与独立 cleanup 由 process helper 测试固定。

## Ralph Loop 4/20 Round 4 复验缺口

- [x] Task 28 的执行时 no-cache packument 固定 fresh cutoff、dist-tags、完整 time map、15 个可安装版本和完整 post-cutoff 候选集合；唯一新候选 `dsh-better-sidebar@0.15.2` 的产物／许可证为 PASS，公共 rc.5 闭包由持久化原始证据机械重算为 0/14 FAIL，后续安全、生命周期、隔离安装、组合、启动与 Chrome 检查为 `NOT RUN`。兼容矩阵、owning Agent Note、plan/design 英中配对与 sidecar 以及权威 spec/tasks/checklist 已同步；该 Task 28 检查点的 selected-row decision 是 Pet 与 Git Graph `0.2.9` 两行，Task 33 已将当前集合收敛为仅 Pet。
- [x] Task 29 在 Task 28 final selected-row decision 对应的同一 fresh assembled run 中，通过系统 Chrome CDP `9333` 验证对话渲染、工具卡片、New Session create-or-reuse、会话列表、fork、resume、compact、header export、`/export`、Search、Settings 与模型选择；历史组合证据不补足本项。
- [x] Task 29 证明 stock Web 行为保持不变，headless 与 ACP 不加载 fusion bundle，并记录干净的 exit、console、page、network、slot、process、port、CDP target、临时目录诊断与完整 cleanup。
- [x] Task 29 将同一 fresh assembled run 的完整结果追加到 tracked regression report，并同步英文、中文与 i18n sidecar；Task 29 完成前不追加本轮最终 progress。
- [x] Task 30 在 Task 28/29 完成后按最终触达面新鲜运行最小必要叶级门禁与工作树／staged diff checks，并完成 Task 28 与 Task 29 的独立 task review；四文件 focused tests 为 110/110，typecheck、build、lint 以 0 errors 通过，hygiene 通过，Task 28 summarize 为 0/14、assert 按预期退出 1，Task 29 oracles 为 10/10。
- [x] Task 30 基于排除 `.trae/specs/**`、`docs/superpowers/**` 与 `.superpowers/**` 执行记录的 exact-staged review package 完成 broad code、security 与 plan/design/spec review；最终 V8 package、code 与 security review 均 clean，独立 plan/design/spec alignment 为 `APPROVED`，Critical/Important/Minor 为 `0/0/0`。
- [x] Task 30 最终 V8 package 为 `.superpowers/sdd/round5-final-staged-v8/review-package.md`，SHA-256 `d4d9e99624bd8f7612e92c477efeaadea1b2b37ee0f268ea6df4704fda42c8dc`，index tree `d77fb5a65673db4232f5ace22726dbf9e091dc29`，包含 41 个文件、3,276 行新增与 506 行删除；bits 复审为 P0/P1/P2 `0/0/0`，DSH 复审为 `PASS / APPROVE` 且 0 findings，安全复审未发现可利用问题。
- [x] Task 30 的受影响门禁与运行时路径已新鲜复验：translation pairing 检查 945 对，Agent Note 格式检查 542 份，冻结归档检查 426 个产物，Markdown wrap／links／budgets 分别检查 1,874／1,911／9 项；系统 Chrome 151 经 CDP `9333` 的 built acceptance 通过 1/1，结束后 Fusion target 与 listener 均为 0。全量 coverage 与实际 GitHub-hosted job 未在本地运行。
- [x] Task 30 已修复 P1 acceptance late-publication 缺口：外层 acquisition 在启动前登记，取消后到达的 Fiber、Browser、Context、Page、临时目录与 link 由同一 owner 清理，self-cleaning helper、acquisition 与 teardown 在正常 cleanup 的共享 deadline 内结算；operation 正常结算时立即移除 abort listener。
- [x] Task 30 已修复 P1 CI trap 缺口：变量初始化、guarded `cleanup()` 与 `EXIT` trap 均早于 `mktemp` 和 Chrome launch；TERM、有限轮询、KILL、wait 与 profile 删除由 executable contract、return／不可达 RED 和非 Windows 真实 Bash 行为测试共同固定。
- [x] Task 30 已修复 P1 Pet pnpm mutation 缺口：完整 Pet 包复制到 profile 私有目录且入口 inode 不同，只修改和导入副本；安装入口在正常与取消／失败路径 hash 不变，真实 `apply` 四态矩阵与未配对 403→200 RED 保持。
- [x] Task 30 已用显式 `pending`／`fulfilled`／`rejected` settlement 状态保留 acquisition、operation 与 cleanup 的 `Promise.reject(undefined)`。
- [x] Task 30 已聚合相互独立的 cancellation、operation、resource disposal 与 final cleanup failure；重复引用只按对象 identity 去重，独立 primitive failure 不按值折叠。
- [x] Task 30 已让 pending acquisition、disposal、final cleanup 与 operation settlement 共用一个总 cleanup deadline，同时保留正常路径的反向串行 cleanup。
- [x] Task 30 已在 cleanup deadline 到期后以已取消 signal 启动所有已取得但尚未开始的外层 disposer，永久观察 best-effort promise 并报告未结算工作，且不延长总 deadline。
- [x] Task 30 最终逐项核对 checklist、staging 边界与 Git 边界，确认执行记录保持 unstaged／untracked、无未授权 Git 写操作，并且只追加一次最终 progress 记录。

## Ralph Loop 1/20 从零复审

- [x] Task 31 历史基线记录 HEAD `108b96a`、index tree `d77fb5a`、41 个 staged 路径及 staged／unstaged／untracked 清单，并生成排除 `.trae/specs/**`、`docs/superpowers/**`、`.superpowers/**` 与 `.learnings/**` 的 exact-staged 审查包；该 package 只代表当时的 index。
- [x] 执行时 no-cache 外部元数据覆盖所有已记录包家族；新增候选均有完整顺序准入或明确 `NOT RUN`，无新增候选时有可复算证据。
- [x] design、plan、Ralph spec、tasks、checklist 与从原始 base `108b96a` 绑定至最终工作树的 `exact-product-worktree` package 逐项一致，无过期当前结论、矛盾要求、遗漏文件或不可验证验收项。
- [x] 实现与生命周期审查确认 profile 组合、acquisition、cancellation、反向 disposal、共享 deadline、failure aggregation 及既有 Web／headless／ACP／TUI 不变量满足规格。
- [x] Task 33 检查点的测试与负控审查证明当时关键断言会在目标回归下失败，新增分支、超时、授权、路由、模型输入、ARIA golden 与 CI cleanup contract 均有覆盖；Task 35 已补齐并验证新分层 oracle 覆盖。
- [x] 安全审查确认外部输入到最终副作用的授权与隔离完整，无 shim、核心绕过、依赖污染、路径逃逸、未审批进程或环境泄漏。
- [x] Task 33 检查点的英文、中文、i18n sidecar、Agent Note、用户指南、testing policy、兼容矩阵与回归记录同当时代码和证据一致，文档叶级门禁通过；Task 35 文档同步已由下方完成项闭合。
- [x] Task 33 确认的 Critical、Important、P0、P1、P2 和规格违背项均以 RED/GREEN 最小修复关闭，并通过独立复审；Task 35 的 oracle 修复与复验也已完成。
- [x] 最终 focused tests、typecheck、build、0-error lint、hygiene、文档门禁、系统 Chrome CDP `9333` exact-row built acceptance 与完整 Web 工作流均有新鲜成功证据；本轮未触达 TUI、shared preset、core、session、subprocess 或 terminal，fresh/resume PTY 条件未触发，记录为 `NOT RUN (not affected)`；仅在这些路径受影响时才必须运行。
- [x] 最终 `exact-product-worktree` package 精确包含 Task 31 的 41 个产品路径、`website/docs.ts` 与 `scripts/project-doc-site.spec.ts`，共 43 个产品路径；其 broad code、安全、plan/design/spec alignment 与 checklist 复审无未解决 finding；该 package 不得称为 `exact-staged`。
- [x] 独立 HEAD/index/worktree/exclusion 报告绑定原始 base `108b96a`、最终工作树内容、起止 HEAD、空 index、worktree hashes 和排除项负控，并记录执行中观察到 HEAD 变为本地 commit `6e0f654`，该 commit 混合原产品路径、`.trae/specs/**`、`docs/superpowers/**` 与 `.learnings/**`，且不推测执行者。
- [x] Task 34 未执行 reset、rebase、新建 commit、push 或 merge，`progress.md` 只追加一次本轮总结；恢复 staged-only 交付或清理 history 需要用户另行授权，且不阻塞代码与运行时验证。

## Task 35 Pet-only root HTML oracle

- [x] baseline 与 Fusion 各自的每个 blocked `GET` 完整响应快照与同一 profile 的 `GET /` 相同，body 保持原始字节相等。
- [x] 非 fallback 响应在独立启动的 `base + web-app` 与 Fusion profile 间保持完整响应快照相同，body 保持原始字节相等。
- [x] 两个根响应各自只有一个可解析的 `window.__DSH_BOOT__` 赋值；baseline 不含 Pet，Fusion 只精确增加一个合法 Pet entry，两侧 graph revision 均由各自完整、有序 entries 计算。
- [x] 删除 Fusion graph 的 Pet entry 并按剩余完整、有序 entries 重算 graph revision 后，完整 Fusion HTML 与 baseline HTML 原始字节相等。
- [x] 额外 client entry、共享 entry 字段或顺序漂移、任一侧错误 graph revision、boot script 外 body 差异，以及 mounted JSON、redirect、含 stock title 的 route-owned HTML、404 或 405 handler 控制响应均使 oracle 失败。
- [x] plan、design、兼容矩阵、回归报告和 owning Agent Note 的英文、中文与五份伴随记录已同步，spec、tasks 与 checklist 使用相同当前判据，命名文档门禁通过。
- [x] focused tests 证明结构化解析、精确 allowlist、revision 重算、同 profile fallback 和非 fallback 跨 profile 比较通过，所有负控按预期失败。
- [x] 系统 Chrome 151/CDP `9333` 的 Pet-only built acceptance 通过 1/1；console、page、network 与 cleanup 诊断干净，pre/post target、listener、process、port 与临时目录均无残留。
- [x] 完整 Web driver 通过 39/39，runtime-final oracle 通过 50/50；当前外部集合精确只有 `include:pet -> @linxin666/dsh-pet@0.2.9`，stock Web、headless 与 ACP 不变量保持不变。
- [x] 代码、文档与运行时独立复审均确认 Task 35 无未解决 finding；TUI 为 `NOT RUN (not affected)`，公开交付保持阶段 2 BLOCKED，Task 34 已在 V2 package、四类复审、对账、bookkeeping 与唯一 `progress.md` 追加后完成。

## Task 36 文档网站标签契约

- [x] 已核验 A 测试陈旧、B 产品标签错误、C `sourceAliases` 干扰三项假设，并以当前 Pet-only 产品指南和 `website/docs.ts` 为权威事实。
- [x] `scripts/project-doc-site.spec.ts` 断言中文“组装 Fusion Web profile”和英文“Assemble the Fusion Web profile”，`website/docs.ts` 未修改。
- [x] 两文件 focused Vitest 通过 46/46，限定授权路径的 `git diff --check` 通过。
- [x] Task 34 `exact-product-worktree` allowlist 从 42 增至 43：Task 31 的 41 个产品路径加 `website/docs.ts` 与 `scripts/project-doc-site.spec.ts`。
- [x] Task 36 报告记录 RED、GREEN、路径计数变化和未运行项，且独立复审无未解决 finding。

## Task 37 最终产品文档 finding

- [x] CI 故障切换手册英中两侧的标准托管必需依赖枚举均包含 `python-runtime`，并与 `all-checks-passed.needs` 一致。
- [x] Fusion owning Agent Note 英中两侧的 Delivery status 不含裸 Task 22／29／35 编号或执行批次叙事，同时保留当前 Pet-only 1/1、39/39、50/50、历史组合限定、Pet-only Web 证据未执行 TUI 与公开 TUI phase 2 BLOCKED。
- [x] 两组 i18n 伴随记录已重录，named pairing、Agent Note 格式、Markdown wrap／links、文档预算和限定 diff check 均通过。
- [x] 独立复审确认 1 Important 与 1 Minor 均关闭且修改范围最小；Task 34 与 Task 37 在复审前保持未完成。

## Task 38 checklist 状态语义

- [x] 最终 checklist 将本轮 TUI fresh/resume PTY 准确记录为条件未触发的 `NOT RUN (not affected)`，并记录 Task 34 已在 V2 package、四类复审、对账、bookkeeping 与唯一 `progress.md` 追加后完成；限定两文件 `git diff --check` 通过，独立复审确认 1 Important 与 1 Minor 均关闭后再勾选本项。

## Ralph Loop 当前工作树从零复审

- [ ] 当前分支、`HEAD`、父提交、index tree、staged／unstaged／untracked 路径与内容 hash 已冻结；原始基线经过独立核验，未直接信任历史审查包。
- [ ] 产品范围覆盖从原始基线到当前工作树的全部 Fusion 改动；`.trae/specs/**`、`docs/superpowers/**`、`.superpowers/**` 与 `.learnings/**` 被单独记录并排除于产品审查包。
- [ ] plan、design、spec、tasks 与 checklist 对 selected row、七个 decision-bearing blocker、外部版本、历史证据适用范围、TUI 状态和 Git 实态一致。
- [ ] 需求与架构、实现与生命周期、测试与 CI、安全、文档语义、运行时与交付六个只读审查域均由独立代理完成，全部 finding 已汇总、去重并核验技术事实。
- [ ] 执行时 no-cache 候选检查覆盖 ModLens、17 个 Web UI 身份、Better Sidebar 与 dsh-TUI；新候选完成顺序准入，或有可复算的无新增结论。
- [ ] 所有确认的 Critical、Important、P0、P1、P2 和规格违背 finding 均有 RED 证据、最小修复、GREEN 验证和未参与实现代理的独立复审；若为零 finding，则有明确的零 finding 报告。
- [ ] 实现审查确认 acquisition、取消、反向释放、共享 deadline、failure aggregation、进程树与 profile 组合满足所有者和停稳要求，且 Web、headless 与 ACP 既有语义不变。
- [ ] 测试审查确认 Pet 授权、分层 root HTML oracle、超时、取消、清理、CI shell 可达性及所有关键负控能拒绝目标回归，不依赖实现自述或历史成功数字。
- [ ] 安全审查确认外部输入到文件、网络、进程、依赖安装与浏览器副作用的授权和隔离完整，不存在 shim、核心绕过、路径逃逸、环境泄漏或未受控资源。
- [ ] 产品文档、Agent Note、plan、design 与 Ralph 规格符合 prose、文档层级和双语规则；当前状态没有推理过程泄漏、重复事实、过期结论或无权威来源的数字。
- [ ] focused tests、typecheck、build、零错误 lint、hygiene、必要文档叶级门禁和 working-tree／index diff checks 均有本轮新鲜成功证据。
- [ ] 系统 Chrome CDP `9333` 的 Pet-only built acceptance、完整 Web driver 与 runtime-final oracle 均通过；console、page、network、target、listener、process、port 和临时目录无残留，且未使用 `chromium.launch()` 或 IDE 浏览器。
- [ ] 若本轮触达 TUI、共享 preset、core、session、subprocess 或 terminal，真实 PTY fresh/resume、消息往返、支持退出和零残留均通过；否则准确记录 `NOT RUN (not affected)`。
- [ ] 最终产品审查包绑定原始基线、最终 `HEAD`、index 和工作树 hash；bits、DSH、安全、文档与 plan/design/spec/checklist 独立复审均无未解决 finding。
- [ ] 本轮未执行 commit、push、merge、rebase 或 reset；规划与执行记录未进入新增 staged 产品集合，`progress.md` 只追加一次本轮总结。

# 任务清单（v2）

## 阶段 1：核心 Web 交付

- [x] Task 0: 用运行时经验判据锁定阶段 1 外部包精确版本
  - [x] 构建当前 rc.5 仓库产物。
  - [x] 在独立临时 `DSH_HOME` 中验证 modlens 精确版本：安装、dump-config、实际 Web boot、Chrome CDP `9333` 页面与 console、目标能力可见。
  - [x] 分别验证 Liangshen 源包、task-board、SSH、remote-web-ui、pet、skin-center 精确版本；构建脚本许可只写入 profile 的 `pnpm-workspace.yaml`。
  - [x] 确认不引用 describe-image、aionui-panel 与 web-ui-all 聚合包。
  - [x] 向 `fusion-compat-matrix.md` 追加 Round 22 阶段 1 锁定表，不覆盖历史。

- [x] Task 1: 以 TDD 创建无第三方运行时依赖的 `@deepseek-ai/dsh-fusion`
  - [x] 先新增 `packages/bundle/fusion/tests/fusion.spec.ts`，运行确认因 bundle 不存在而失败。
  - [x] 新增最小 package、`src/index.ts`、`src/invariant.ts`、tsconfig 与空 patch；manifest 只含 workspace peer/dev 依赖。
  - [x] 新增 README 英文、中文与 i18n sidecar，记录 Model Experience、Known Limitations 和 profile 安装契约。
  - [x] 更新 bundle roster 英中配对与 sidecar。
  - [x] 注册 `tsconfig.host.json`、workspace package file extras 与 README Model Experience 短格式 gate；确认不需要 knip 特例。
  - [x] 运行 focused Vitest、typecheck、build、package invariant 与 hygiene，确认红转绿。

- [x] Task 2: 以 TDD 挂载 modlens 与 web-ui 保留子包
  - [x] 先为 `verify-cordis-config` 写失败测试，引入 `dsh.bundle.profileDependencies` 精确版本映射：恰好覆盖 patch 的 profile-owned bare rows，拒绝缺项、多余项、标准依赖区重复和非精确版本。
  - [x] 最小扩展 `scripts/verify-cordis-config.ts` 读取该静态 metadata；runtime composer 不自动安装、不修改 app-boot。
  - [x] 先写失败测试，断言阶段 1 真实 row id 在场且 describe-image、aionui-panel、web-ui-all 缺席。
  - [x] 历史阶段曾在 fusion patch 插入 modlens、task-board、SSH、remote-web-ui、pet、skin-center 的真实 bare 包行；Liangshen 仅走 preset。该集合不代表 Task 12 安全收敛后的最终集合。
  - [x] 在 fusion manifest 的 `dsh.bundle.profileDependencies` 写 Task 0 锁定精确版本；不向四个标准 dependency sections 添加这些包，不修改根 `pnpm-workspace.yaml`。
  - [x] 运行 focused Vitest、dump-config composition smoke 与 hygiene，确认红转绿。

- [x] Task 3: 以 TDD 新增共享 `liangshen` preset
  - [x] 从 Task 0 锁定源包读取 prompt、两阶段工具锚定与 host-plane 要求。
  - [x] 先扩展 preset 发现/挂载测试与必要 keyless snapshot，运行确认失败。
  - [x] 新增 `preset.yml`、`agent.cordis.yml`、`tool-bootstrap.mjs` 与来源 `NOTICE`；使用唯一 `order: 5`，保留 standard 完整能力，只加入 Web `0.2.4` 的已验证 Liangshen 差异。
  - [x] 不复制 host-plane 单例；所有 provide 服务 row 使用合法 isolate realm。
  - [x] Windows 不采用来源包直接 `subprocess.spawn` 的 `custom-bash.mjs`；在私有 `shell/settings` realm 复用 `dsh-bash-sandbox` + 官方 `dsh-tool-bash`，无法解析或约束 Bash 时 fail closed。
  - [x] 扩展 Windows/POSIX shell 选择测试，验证每个平台恰好一个 phase-1 `bash`、无 `pwsh`，并固定 sandbox/approval 执行链。
  - [x] 运行 focused preset e2e、picker/authoring snapshot、Cordis 配置校验与 typecheck，确认红转绿。

- [x] Task 4: 文档化并验证阶段 1 `fusion` Web profile
  - [x] 新增 fusion profile 产品指南英中配对与 sidecar，说明精确包版本、profile allowBuilds、bundle 顺序与 Liangshen 选择。
  - [x] 更新指南索引英中配对及 `website/docs.ts` 投影。
  - [x] 在全新 `DSH_HOME` 组装 `base + web-app + fusion`，外部包只安装到 profile。
  - [x] 历史阶段后台启动真实 fusion server，使用独立 Chrome CDP `9333` 验证左侧会话栏、task-board、skin-center、pet、remote-web-ui、modlens 与 Liangshen；该结果不替代后续最终 oracle。
  - [x] 保存截图与启动日志证据并停止服务。
  - [x] 运行 `doc-sync` 与 docs site 检查。

- [x] Task 5: 执行阶段 1 回归与去重矩阵
  - [x] 验证阶段 1 既有 `base + web-app` 路径：对话、工具卡片、New Session、会话列表、fork、resume、compact、export、Search、Settings 和模型选择；右侧 Files/Web Editor/Terminal/Git 留给 Task 7。
  - [x] 验证 describe-image、aionui-panel、重复移动端远程与重复 Liangshen 未激活，启动日志无 slot/service 冲突。
  - [x] 运行 headless 与现有 web profile smoke，证明 fusion 未污染其它 profile。
  - [x] 运行 dsh-pre-push-checks 选择的最小 GUI、snapshot 或 runnable-example检查。
  - [x] 将 pass/fail、命令、日志和截图路径写入不入 Git 的 `fusion-regression-report.md`。
  - [x] 修正规格、计划、Task 5 brief 与 checklist 的 Editor 阶段归属，把右侧 Web Editor 明确归入 Task 7。
  - [x] 对 fusion profile 补充 Search、fork、compact 与两个 export 入口的 focused Chrome CDP `9333` 证据。
  - [x] 运行 keyless headless 产品路径测试并保存成功输出。
  - [x] 直接验证 fusion runtime 工具目录不含 `describe_image`，且 modlens 视觉工具恰好一份。

- [x] Task 6: 编写桌面壳消费契约并检查 fusion 发布物
  - [x] 新增 desktop shell contract 英中配对与 sidecar，限定 npm 精确消费、fusion profile、移动端远程单一所有者和桌面壳保留职责。
  - [x] 更新指南索引与网站投影。
  - [x] 检查 fusion 的 publishConfig、exports、files、打包产物与外部 NodeNext 消费。
  - [x] 不执行 npm publish，不修改外部 desktop 仓库。

## 阶段 2：门控扩展

- [x] Task 7: 以运行时判据调查 better-sidebar
  - [x] 在独立 profile 验证最高精确版本，记录声明 peer 漂移、override、allowBuilds、实际 boot 与 Chrome console。
  - [x] 历史阶段先写失败测试并加入真实 better-sidebar row；Task 12 安全复核后已将其判为外部 blocker。
  - [x] 重组 fusion profile，验证右侧文件/编辑器/终端/Git tab 与左侧 ui-sidebar 并存，console 无 error。
  - [x] Task 12 安全复核确认其 `terminal_*` 模型工具绕过 sandbox、approval 与环境清洗；最终要求保持未挂载并标记外部 blocker。

- [x] Task 8: 以运行时判据锁定并验证 dsh-TUI
  - [x] 在独立 profile 安装精确 dsh-TUI，验证 bundled `workspace:*` 能被消费并检查 profile manifest。
  - [x] 评估 React 18/19 与 TUI 自带 Liangshen 目录所有权冲突，确定单一所有者。
  - [x] 为 fusion-tui 提供 Liangshen phase-2 所需的 host `codeRuntime`，或明确记录并验证一个经批准的替代呈现；不得静默改变 Web `0.2.4` 选定行为。
  - [x] 用真实 PTY 启动，验证顶栏、状态、输入区、共享 Liangshen 与一条消息往返，无崩溃。
  - [x] 新增 fusion-tui 指南英中配对、sidecar 与网站投影，并运行 doc-sync。
  - [x] TUI 源码 runtime PASS；npm registry 无法重建同一 rc.5 闭包，因此公开交付 BLOCKED，且不回滚阶段 1。

## 最终交付

- [x] Task 9: 记录架构决策、执行最终验证与独立审查
  - [x] 用 dsh-archive-agent-notes 审计同主题 active notes，新增或更新 owning Agent Note 英中配对与 sidecar。
  - [x] Agent Note 记录运行时判据、fusion 不携带第三方依赖、去重所有权、profile 非内置与重新验证条件。
  - [x] 新鲜运行 focused tests、typecheck、build、hygiene、doc-sync、docs:check、lint、`git diff --check` 和所有真实 Web/TUI smoke。
  - [x] 独立子代理逐条验证 `checklist.md`；失败项追加修复任务后重验。
  - [x] 独立代码审查覆盖正确性、简洁性、架构、安全、性能与系统语义 diff；修复 Critical/Important 后复审。
  - [x] 确认没有未授权 commit/push/merge/rebase/reset，规划与执行记录未加入 Git。

- [x] Task 10: 从零审查并优化最终交付
  - [x] 基于当前 staged delivery 重新生成审查包，明确排除 `.trae/specs/**` 与 `docs/superpowers/**` 执行记录。
  - [x] 并行独立子代理从零审查 plan/design/spec 对齐、实现/测试/文档语义、安全面与运行时证据。
  - [x] 修复所有 Critical/Important 发现，并对修复项执行独立复审。
  - [x] 根据实际触达面重跑最小必要 gate；若审查要求，重跑真实 Web/TUI smoke。
  - [x] 逐条验证新增 checklist 项，保持执行记录未 staged，追加最终 progress 记录。

- [x] Task 11: 建立 2026-08-21 新鲜基线并重新验证外部版本选择
  - [x] 记录当前 staged delivery、unstaged 执行记录、未跟踪规划配对、当前分支与禁用 Git 操作的基线；审查包明确排除 `.trae/specs/**`、`docs/superpowers/**` 与 `.superpowers/**`。
  - [x] 对 modlens、保留 web-ui 子包、better-sidebar 与 dsh-TUI 获取新鲜 npm 元数据，确认当前锁定版本仍满足“最高可运行精确版本”规则；若出现更高候选，按运行时经验判据验证后再决定是否变更。
  - [x] 核对兼容矩阵、产品指南、Agent Note、fusion manifest 与真实 profile manifest/lockfile 的版本和风险描述一致。

- [x] Task 12: 并行从零审查交付并修复所有阻塞发现
  - [x] 独立子代理并行审查 plan/design/spec/任务对齐、实现与测试强度、文档语义、依赖与许可证、安全面、性能和系统语义 diff。
  - [x] 对每个发现先验证技术事实；Critical/Important 或直接违反规格的发现追加最小修复任务，由独立子代理按 TDD 修复并运行覆盖命令。
  - [x] 对所有修复执行独立复审；不得通过弱化测试、隐藏文件、跳过运行时门或修改核心 `packages/core/**` 来消除失败。
  - [x] Task 12.1: 完成 Git Graph `0.1.11` 的许可证、安装、组合与 Chrome CDP 可见能力调查；后续独立安全验证确认其 `/git/*` 路由可绕过 Remote Web UI 撤销，最终判为外部安全 blocker，不得纳入当时的四行候选。
  - [x] Task 12.2: 补齐 modlens `3.22.1` 的系统 Chrome CDP `9333` 可见 Settings/图像入口断言；失败则恢复最后一个完整通过 oracle 的精确版本。
  - [x] Task 12.3: 解决 task-board、remote-web-ui、pet、skin-center 发布 manifest 与 LICENSE 正文冲突；许可证一致的 Pet `0.1.11` 后续因无授权 `/api/pet/*` 路由被独立安全验证判为外部 blocker，Skin Center 保持许可证/可见性 blocker。
  - [x] Task 12.4: 阻断 better-sidebar opt-in `terminal_*` 模型工具绕过 session sandbox、approval 与环境清洗的路径；无法同时保留完整工作台时，移除其 Fusion 挂载并标记阶段 2 阻塞，以真实工具目录和 UI runtime 证明。
  - [x] Task 12.5: 历史六行 `base -> web-app -> fusion` profile 的 verifier 为 156/156，实际 compact 为 7 项/402 tokens，服务重启后同一 durable session 恢复通过；该运行未覆盖后续发现的 Git Graph/Pet 授权绕过，不是后续四行、三行或最终零行集合的当前通过证据。
  - [x] Task 12.6: 修正 durable prose：Agent Note 与证据链只陈述已验证事实，TUI 指南移除 fixture 叙述，`rewriteSourceText` JSDoc 补齐；完成明确配对文档的双语语义。
  - [x] Task 12.7: 历史四行阶段将产品 patch、profile dependency metadata、相应测试与产品指南收敛为 modlens `3.22.1`、task-board `0.1.11`、SSH `0.2.5`、remote-web-ui `0.1.11`；移除 Pet 与 Git Graph，并保留 Pet、Git Graph、Skin Center、Better Sidebar 的外部 blocker 证据。该结果已被后续 Task Board 生命周期审查取代。
  - [x] Task 12.8: 历史四行阶段实现 checked-in REAL composition gate，实际激活四行并通过系统 Chrome CDP `9333`；1/1 PASS 只作为被后续生命周期审查取代的证据保留。
  - [x] Task 12.9: 历史四行 REAL composition fixture 的第三方包、lock 与 `allowBuilds` 只存在于 fixture/profile；未修改仓库根 `package.json`、根 lockfile 或根 `pnpm-workspace.yaml` 的 `allowBuilds`。
  - [x] Task 12.10: 历史四行阶段曾重建 `base -> web-app -> fusion` 并重跑既有 Web 路径、四行能力、去重、clean console/network、compact 与 restart-resume oracle；四行证据为 170/170，实际 compact 为 7 项/401 tokens、投影 token 从 448 降至 160，并在服务重启后恢复同一 durable session。该结果已被 Task Board 生命周期审查取代，不得代替后续三行或最终零行验收。
  - [x] Task 12.11: 从 patch、profile dependency metadata、REAL fixture、测试与产品文档移除 Task Board，收敛为 ModLens `3.22.1`、SSH `0.2.5`、Remote Web UI `0.1.11` 三行；记录全部 26 个已发布 Task Board 版本均不同时满足完整 effect/disposer 与断连重挂、manifest/LICENSE 一致和 rc.5 runtime，并撤销仅为 Task Board 增加的 `data-pane="conversation"` AppFrame contract。禁止 shim 或核心改动。
  - [x] Task 12.12: 将六个错误的 `@deepseek-ai/cordis/*` runtime event id 恢复为原 `cordis/*`，让 rescope 只改写 module import 而不改写 event/locale id，并同步全部 producer、Remote allowlist、consumer、tests 与 generated docs；增加 module-import 正控及 event/locale 不改写负控，不提供兼容 alias。
  - [x] Task 12.13: REAL process helper 已按 TDD 为 stdout/stderr 各实现 64 KiB byte-bounded diagnostic tail，并保留跨 chunk readiness marker；独立复审已确认字节上限、readiness 匹配与完整结算语义。
  - [x] Task 12.14: 历史三行 checked-in REAL composition gate 为 1/1 PASS，完整 Web oracle 为 174/174 PASS；实际 compact 为 7 项/402 tokens，投影消息 token 从 449 降至 155，并在服务重启后恢复同一 session 且保持 155。该阶段的产品文档、生成文档与对应双语 sidecar 已同步；后续 ModLens、SSH 与 Remote Web UI 生命周期审查已取代该准入证据。
  - [x] Task 12.15: 完成 ModLens、SSH 与 Remote Web UI 生命周期审计并撤销历史三行准入。ModLens 全部 38 个 DSH 候选均缺少目标路由或丢失 route disposer；SSH 26/26 不关闭活跃 terminal WebSocket 与 SSH session；Remote Web UI 0/26 联合准入，`0.1.11` 的 route 卸载／重挂通过，但 SSE、tunnel、客户端 subscription 与 failed-pair React root 清理失败，`0.1.12` 及更高版本另有 manifest/LICENSE 冲突。
  - [x] Task 12.16: 修复 vendored rescope 的 AST 分类，使模块引用继续改写而 event/locale id 保持 `cordis/*`；实现、TDD 与独立复审结论保存在 `.superpowers/sdd/task13-final/rescope-classifier-fix-report.md` 与 `rescope-classifier-fix-review.md`。
  - [x] Task 12.17: 将 Fusion bundle、manifest、checked-in REAL fixture/tests、产品指南、desktop 契约、网站标签、Agent Note 与执行记录收敛为零外部行和八个 blocker；保留纯 bundle exports/invariant/ESM，默认 unit/coverage 离线。

- [x] Task 13: 执行最终全量相关验证并独立验收
  - [x] 新鲜运行 focused tests、typecheck、build、lint、hygiene、doc-sync、docs:check、Agent Note gates、发布物/NodeNext consumer 与 staged/unstaged diff checks。
  - [x] 使用系统 Chrome CDP `9333` 重跑真实 fusion Web：最终零行 REAL gate 通过 1/1，完整零行 oracle 通过 196/196，三项负控通过 3/3，compact 为 7 项/401 tokens、投影消息 token 为 448→155，服务重启后保持 155，独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`；八个 blocker 的 Host rows、browser entries、client resources、UI roots、routes 与 tools 全部缺席，stock Web 基本可见，console/network/cleanup 干净。历史三行 1/1 与 174/174、四行 1/1 与 170/170、六行 156/156 均为被后续审查取代的证据。
  - [x] 使用真实 PTY 重跑 fusion-tui fresh/resume、共享 Liangshen、消息往返、durable log 与无残留进程检查；41 包纯 rc.5 源码验证闭包运行时 PASS，但 npm registry 缺少 23 个所需 rc.5 包且没有受支持的公开闭包，因此公开交付明确保持阶段 2 BLOCKED。
  - [x] 独立子代理逐条验证 checklist 和最终审查包；所有项通过后追加一次 progress 记录，保持执行记录未 staged。

- [x] Task 14: 修复 rescope 模块引用分类缺口: locale/data id 特例不得跳过同一行的模块引用，Markdown 与模板中的多行静态或动态模块引用必须按文档约定改写，并增加覆盖这些输入且保留 event/locale id 的回归测试。

- [x] Task 15: 使 REAL command timeout 有界结算: `runManagedCommand` 在 `done` 永不结算时必须在清理预算内失败，不得先无界等待；补充 never-settling handle、stdout/stderr 独立 64 KiB 与跨 chunk UTF-8 边界测试。

- [x] Task 16: 收敛验收记录事实: 删除“所有阶段 1 外部版本均通过准入”的错误结论，并明确已有 tracked 执行记录保持 unstaged 与“out of Git index”是不同状态。

- [x] Task 17: 收敛 Round 3 整体评审与最终交付
  - [x] 以 TDD 修复并独立复审全部有效 finding：rescope 裸 locale/data id、TSX fence、Node `import.meta.resolve`/`module.require`、有效 JSON/JSONC 围栏的 dependency 与 `peerDependenciesMeta` 键、格式错误围栏保护、REAL command/`stopTree` 有界结算、CDP target URL 规范化，以及 fusion 指南禁止集合加入 `web-ui-all`。
  - [x] 仅把 Round 3 产品代码、测试和产品文档的最终内容纳入既有 staged delivery；`.trae/specs/**`、`docs/superpowers/**`、`.superpowers/**` 的修改或未跟踪文件保持不 staged。
  - [x] 生成精确的最终 staged review package，完成 bits 分组与跨组复审、整体代码审查、安全审查、plan/design/spec 对齐复审，并修复所有阻塞 finding。
  - [x] 新鲜运行 focused tests、typecheck、lint、hygiene、doc-sync 28/28、docs:check、工作树与 staged diff check，以及 cached 禁止路径为空检查。
  - [x] append-only 追加唯一 Round 3 最终收敛 progress，更新 plan/design 的最终 progress 指针，并重新逐项验证 checklist。

- [x] Task 18: 重新审计截止后发布的外部候选: 对兼容矩阵 `2026-08-21T02:11Z` 截止后发布的完整集合执行适用的安装、许可证、安全、生命周期、Chrome 或 PTY 判据：ModLens `3.22.2`、`3.23.0`、`3.23.1`；全部 17 个 Web UI 身份（含 Liangshen）的 `0.2.6` 与 `0.2.7`；Better Sidebar `0.15.0`；dsh-TUI `0.8.7` 与 `0.8.8`。更新版本计数、兼容矩阵和最终准入结论。

- [x] Task 19: 修正 staged 中文交付文档术语: 按 `docs/i18n/terminology.md` 修正中文正文中的 `runtime`、`registry`、`session`、`manifest`、`dispose` 与 `fixture` 用法，保留合法代码标识，并重新记录受影响双语 sidecar。

- [x] Task 20: 补充 JSONC 永久回归覆盖: 在 `scripts/rescope-vendor.spec.ts` 中覆盖带注释的有效 JSONC dependency 与 `peerDependenciesMeta` 键正反向改写，以及格式错误 JSONC 围栏保持不变。

- [x] Task 21: 修复 Round 5 两项确认 finding: 以 TDD 限制 vendored rescope 只改写独立 JSON、YAML 与文档正文中的模块或包元数据引用，并从四份 Fusion 产品文档移除指向未 staged 兼容矩阵的条款，同时保留 owning Agent Note 对决策、包级 blocker 与重验要求的所有权说明。

- [x] Task 22: 审计 Web UI `0.2.8`／`0.2.9` 发布波次: 对 17 个 Web UI 身份在 `2026-08-22T01:55:55Z` 至 `01:56:30Z` 发布的 `0.2.8` 与本轮审计期间在 `2026-08-22T09:32:20Z` 至 `09:32:49Z` 发布的 `0.2.9` 精确产物执行适用的身份、完整性、许可证、安全、生命周期、所有权、去重和运行时准入检查，并同步版本计数、兼容矩阵、Agent Note 与最终准入结论。

- [x] Task 23: 修复缺席路由探针假阴性: 对 `/git/branches` 的 `GET` 响应与独立启动的 `base + web-app` 完整稳定响应作精确比较，并用挂载 JSON、redirect、含 stock title 的 route-owned HTML、404 与 405 handler 负控证明差异必然失败。Task 22 后续准入 Git Graph 后，最终 assembled gate 对 `/git/branches` 使用真实 `POST` 正控验证已挂载路由，不再把 GET 路由缺席作为当前组合结论。

- [x] Task 24: 稳定 fusion-tui 恢复态退出验收: 消除 resume 场景在 UI 已恢复后两次 Ctrl+C 偶发无法于 10 秒内退出的时序不稳定，并用重复 fresh/resume PTY 运行证明消息恢复、支持退出和零残留进程均稳定通过。

- [x] Task 25: 修复最终运行时审查发现并建立 Fusion 外部 profile 必需快照门
  - [x] 以独立启动的 `base + web-app` 响应为权威基线比较全部禁用路由，并用负控证明 mounted JSON、redirect、包含 stock title 的 route-owned HTML、404 与 405 handler 均被拒绝。
  - [x] 以等价真实 agent/session scope 比较 `base + web-app` 与 Fusion 的完整工具 schema 和已渲染 prompt-visible 输入，并用负控证明同名 schema 变更、scoped 新工具和 prompt contribution 均被拒绝。
  - [x] 所有新增 RPC、HTTP fetch 和 body read 均使用 `AbortSignal.timeout` 截止时间，并用 hanging-header 与 hanging-body 负控证明失败进入既有 cleanup。
  - [x] Git Graph 正控断言 canonical 临时 workspace root、当前分支 `task22` 及唯一 current `task22` branch row。
  - [x] Fusion bundle 测试把 stub 放入 `profileDirectory/node_modules` 并从 `profileDirectory/cordis.yml` 启动，且旧 parent-only 布局有失败证据。
  - [x] 专用 Fusion REAL lane 提交 Pet + Git Graph 的确定性 ARIA golden，profile 外部包保持局部安装，默认 unit/coverage 保持离线。
  - [x] 必需的隔离 `ubuntu-latest` Linux PR job 已配置并通过静态 CI contract 测试，本地等价的系统 Google Chrome CDP `9333` keyless Fusion snapshot/acceptance replay 已通过；实际 GitHub-hosted 执行由 CI 持有，未在本地运行，且既有 required `test:web` lane 未弱化。
  - [x] Fusion fixture 保留 `nodeLinker: hoisted`、`autoInstallPeers: false` 和精确 `minimumReleaseAgeExclude`，局部 lockfile 一致且不改仓库根依赖或 lock。
  - [x] 使用已运行的系统 Chrome CDP `9333` 完成 focused tests 与真实验收，并将新鲜 RED/GREEN 命令和结果记录到 runtime remediation 报告。
  - [x] 更新最窄 testing policy 与 Agent Note 英中配对，说明外部 profile 专用 required snapshot lane；Fusion 产品/plan/spec 文档由独立 writer 对齐。
  - [x] Task 25 最终 exact-staged bits 复审为 P0/P1/P2 `0/0/0`，DSH 复审为 `APPROVE`，安全复审无可利用问题；规格对齐复审唯一剩余的 progress ledger finding 已由最终 `Round 1` append-only 记录关闭。

- [x] Task 26: 审计新增外部候选: 对 `@liustack/modlens@3.24.0` 与 `dsh-better-sidebar@0.15.1` 执行适用的产物、许可证、安全、生命周期、隔离安装和真实运行时准入检查，更新版本计数、兼容矩阵、Agent Note 与最终准入结论。

- [x] Task 27: 固定 Fusion CI 生命周期约束: 扩展 `scripts/ci-workflow.spec.ts`，使 `fusion-acceptance` job 的 15 分钟上限、比 10 分钟验收至少多 5 分钟的 reserve、`setsid` 启动，以及位于 trap／验收前并按序执行 TERM、有限轮询、KILL、wait、profile 删除的 `cleanup()` 在接线回归时失败；验收操作响应取消信号，最终清理使用独立 30 秒截止时间。

- [x] Task 28: 审计执行时 fresh cutoff 后的完整 Better Sidebar 候选集合并确定最终 selected-row decision
  - [x] 通过唯一 nonce 与 no-cache 请求获取执行时 packument，记录 HTTP `2026-08-22T17:01:07Z` fresh cutoff、cache MISS／无 `Age`、`latest: 0.15.2`、`beta: 0.12.0-beta.1`、15 个可安装 manifest 和 16 个 time-map 版本键。
  - [x] 相对兼容矩阵的 `2026-08-22T15:28:38Z` cutoff 枚举完整 post-cutoff 集合，确认唯一新候选为发布于 `2026-08-22T15:35:41.933Z` 的精确 `0.15.2`，没有遗漏执行期间发布的更高候选。
  - [x] 验证 `0.15.2` 的身份、registry SHA-1、SHA-512 SRI、tar 路径／链接安全与 MIT 许可证，产物和许可证结论为 PASS。
  - [x] 保存 14 个 DSH peer 的唯一请求 URL、原始响应 headers、原始 packument、逐包 summary、采集元数据、机械汇总脚本与预期失败断言，使公共 rc.5 闭包可从原始证据重算为 0/14 FAIL。
  - [x] 在首个前置门失败后，将安全、生命周期、隔离安装、组合、启动、能力、Chrome CDP `9333` 和浏览器诊断准确记录为 `NOT RUN`；最终决定为 Better Sidebar 保持阻塞且未挂载，Fusion 继续选择 Pet 与 Git Graph `0.2.9` 两行。
  - [x] 同步兼容矩阵、owning Agent Note、plan、design 的英文、中文与 i18n sidecar，以及 spec、tasks、checklist、Task 28 报告和原始可重算证据；保持所有执行记录不进入 Git index。

- [x] Task 29: 补齐 Task 28 final selected-row decision 对应的 Fusion Web 回归证据
  - [x] 依赖 Task 28 的最终决定；当前决定为 Better Sidebar BLOCKED，因此使用只含精确 Pet 与 Git Graph `0.2.9` 的最终两行 profile，不得用历史零行、三行、四行或六行证据补足。
  - [x] 在同一个 fresh assembled run 中使用系统 Chrome CDP `9333` 验证对话渲染、工具卡片、New Session create-or-reuse、会话列表、fork、resume、compact、header export、`/export`、Search、Settings 与模型选择。
  - [x] 在同一精确组合上验证 stock Web 行为不变，并以 fresh smoke 证明 headless 与 ACP 不加载 fusion bundle、保持隔离。
  - [x] 记录完整 exit、console、page、network、slot、process、port、CDP target 与临时目录诊断和 cleanup，任何 console error 或残留资源均必须修复后重跑。
  - [x] 将同一 fresh assembled run 的完整成功结果追加到 tracked regression report，并同步英文、中文与 i18n sidecar；Task 29 完成前不得追加本轮最终 progress。

- [x] Task 30: 执行 Task 28/29 后的最终收敛
  - [x] 在 Task 28 与 Task 29 完成后，按最终触达面新鲜运行最小必要叶级门禁与工作树／staged diff checks，所有单次前台等待保持小于一分钟；四文件 focused tests 为 110/110，typecheck、build、lint 以 0 errors 通过，hygiene 通过，translation／Agent Note／归档／Markdown／budget 门禁分别检查 945／542／426／1,874／1,911／9 项。
  - [x] 对 Task 28 候选审计和 Task 29 同一 assembled run 证据分别执行独立 task review，关闭全部有效 finding；Task 28 summarize 为 0/14、assert 按预期退出 1，Task 29 oracles 为 10/10。
  - [x] 基于排除 `.trae/specs/**`、`docs/superpowers/**` 与 `.superpowers/**` 执行记录的 exact-staged review package 完成 broad code、security 与 plan/design/spec review；最终 V8 package、broad code 与 security review 均 clean，独立 plan/design/spec alignment 为 `APPROVED`，Critical/Important/Minor 为 `0/0/0`。
  - [x] 最终 V8 package 为 `.superpowers/sdd/round5-final-staged-v8/review-package.md`，SHA-256 `d4d9e99624bd8f7612e92c477efeaadea1b2b37ee0f268ea6df4704fda42c8dc`，index tree `d77fb5a65673db4232f5ace22726dbf9e091dc29`，包含 41 个文件、3,276 行新增与 506 行删除；bits 复审为 P0/P1/P2 `0/0/0`，DSH 复审为 `PASS / APPROVE` 且 0 findings，安全复审未发现可利用问题。
  - [x] 修复所有有效阻塞 finding，并对受影响门禁、运行时路径和审查结论执行新鲜复验；系统 Chrome 151 经 CDP `9333` 的 built acceptance 通过 1/1，结束后 Fusion target 与 listener 均为 0。全量 coverage 与实际 GitHub-hosted job 未在本地运行。
  - [x] 修复 P1 acceptance late-publication 缺口：每项外层资源 acquisition 在启动前登记到 operation-local owner，取消后到达的 Fiber、Browser、Context、Page、临时目录与 link 由同一 owner 清理；self-cleaning helper 登记结算，正常 cleanup 在共享 deadline 内等待 acquisition 与 teardown 终态；operation 正常结算时立即移除 abort listener。
  - [x] 修复 P1 CI trap 缺口：在 `mktemp` 和 Chrome launch 前初始化变量、定义 guarded cleanup 并安装 `EXIT` trap，保留 TERM、有限轮询、KILL、wait、profile 删除顺序；return／不可达 mutation 命中 RED，非 Windows 真实 Bash 探针证明子进程终止并被等待且目录删除。
  - [x] 修复 P1 Pet pnpm mutation 缺口：把完整 Pet 包复制到 profile 私有目录并确认入口 inode 不同，只修改和导入副本；安装入口在正常与取消／失败路径 hash 不变，真实 `apply` 四态矩阵与未配对 403→200 RED 保持。
  - [x] 修复隐式 rejection sentinel 缺口：使用显式 `pending`／`fulfilled`／`rejected` settlement 状态，保留 acquisition、operation 与 cleanup 的 `Promise.reject(undefined)`。
  - [x] 修复 failure aggregation 缺口：相互独立的 cancellation、operation、resource disposal 与 final cleanup failure 全部聚合；重复引用只按对象 identity 去重，不按值折叠独立 primitive failure。
  - [x] 修复 cleanup deadline 分裂缺口：pending acquisition、disposal、final cleanup 与 operation settlement 共用一个总 deadline，正常路径仍按反向顺序串行等待 disposer。
  - [x] 修复 deadline 后外层资源遗漏：deadline 到期后仍以已取消 signal 启动所有已取得但尚未开始的外层 disposer，永久观察其 promise 并报告未结算工作，但不等待这些 best-effort disposer 延长总 deadline。
  - [x] 最终逐项核对 checklist、staging 边界与 Git 边界；执行记录保持 unstaged／untracked，未执行未授权 Git 写操作，并只追加一次最终 progress 记录。

- [x] Task 31: 从零冻结本轮审查基线并拆分独立审查域
  - [x] 记录当前分支、HEAD、index tree、staged／unstaged／untracked 路径、目标 plan/design/spec/checklist 与现有 V8 审查包摘要；不得改变既有 staged 产品集合。
  - [x] 生成只包含当前 exact-staged 产品交付的全新审查包，明确排除 `.trae/specs/**`、`docs/superpowers/**`、`.superpowers/**` 与 `.learnings/**`。
  - [x] 以执行时 no-cache 元数据检查所有已记录外部包家族是否出现晚于现有 cutoff 的新候选；有新候选时追加独立审计任务，没有时保存可复算的无新增结论。
  - [x] 将审查分为需求与计划对齐、实现与生命周期、测试与负控、安全、文档语义、运行时与交付边界六个互不写入的审查域。

- [x] Task 32: 并行执行六域独立从零审查
  - [x] 需求与计划审查逐条映射 design、plan、Ralph spec、tasks、checklist 与 exact-staged 文件，识别遗漏、矛盾、过期结论和不可验证验收项。
  - [x] 实现与生命周期审查读取完整相关实现及调用方，验证资源取得、取消、反向释放、总 deadline、异常聚合、profile 组合与既有 Web／headless／ACP／TUI 不变量。
  - [x] 测试与负控审查验证断言会在目标回归下失败，覆盖所有分支与超时路径，且 REAL lane、ARIA golden、外部路由、模型输入和 CI shell contract 没有假阳性。
  - [x] 安全审查从外部输入到最终操作追踪授权、路径、进程、环境、依赖安装和浏览器连接，确认没有 shim、核心绕过或未受控副作用。
  - [x] 文档语义审查核对英文、中文、sidecar、Agent Note、用户指南、testing policy、计划与兼容矩阵同代码和证据一致，并检查唯一事实归属和当前态措辞。
  - [x] 运行时与交付审查核对 Chrome CDP `9333`、必要的真实 PTY、CI 拓扑、cleanup、staging 排除和 Git 禁令；汇总所有发现并逐项验证技术事实。

- [ ] Task 33: 以 TDD 修复全部有效阻塞发现
  - [x] 将每个确认的 Critical、Important、P0、P1、P2 或规格违背项追加为具体修复子任务，注明失败证据、目标文件、最小测试和验收命令。
  - [ ] Task 33.1: 撤销 Git Graph `0.2.9` 准入。现有真实 probe 已证明 active `/git` JSON operation 在 row fiber dispose 后继续 pending 且子进程存活；从 Fusion patch、profile dependency metadata、REAL fixture/lock、ARIA golden、验收断言、产品指南和 owning Agent Note 移除 Git Graph，记录其 lifecycle blocker 与重验条件，将当前 selected row 收敛为仅 Pet `0.2.9`。
  - [ ] Task 33.2: 修复 `invokeRoute()` 取消传播。先增加真实 hanging handler／Git child 取消测试，证明 acceptance signal 能在 handler 返回前使调用失败并进入 inner Context `finally`；最小实现从调用开始竞争 signal、永久观察被放弃 promise，并在 lifecycle 返回前等待 Context 与进程树停稳。
  - [ ] Task 33.3: 补齐 blocked-route 完整跨 profile 比较。先增加 body-only 差异负控并确认 RED，再让 Fusion `/` fallback 与独立 `base + web-app` fallback 通过 `assertSameHttpResponse()` 比较 status、headers 和 body。
  - [ ] Task 33.4: 固定 CI acceptance 命令可达性。先加入 `if [[ 1 -eq 0 ]]` 包裹 acceptance 的 RED mutation，再把现有真实 Bash probe 扩展为完整 launcher 行为探针，要求 acceptance stub 确实执行、cleanup 顺序成立、进程停稳且 profile 删除。
  - [ ] Task 33.5: 补齐 lifecycle/aggregation 永久负控并删除未用协议。增加内部 `operationTimeoutMs` 自触发、deadline 后 disposer 延迟拒绝无 unhandled rejection、两个相同 primitive failure 按 occurrence 保留的测试；将无调用方返回非空数组的 `cleanup(): Promise<unknown[]>` 收窄为 `Promise<void>` 并删除对应 fulfilled-array 分支。
  - [ ] Task 33.6: 收敛代码与文档语义。修正 testing policy 的独立 Fusion acceptance tier、managed-process cancellation JSDoc、CI Agent Note 的 `#**`、网站 Fusion 标签、兼容矩阵完整准入定义／Task 31 freshness／历史窄范围 PASS 措辞、regression report 当前 Task 29 指针，以及 plan/design/checklist 的本轮 baseline 指针；所有双语对同步并重录 sidecar。
  - [ ] 由单写入实现 Subagent 先运行 RED，再做最小修复并运行 GREEN；不得弱化测试、修改核心 `packages/core/**`、引入兼容 shim 或扩大产品范围。
  - [ ] 每批修复后由独立 Subagent 复审规格符合性、正确性、简洁性、架构、安全和性能；所有阻塞 finding 关闭后才进入最终验证。
  - [ ] 只 stage 本轮确认的产品代码、测试、产品文档和 Agent Note；计划、规格、证据与学习记录保持 unstaged／untracked。

- [ ] Task 34: 执行新鲜验证、最终复审与交付对账
  - [ ] 按最终触达面运行小于一分钟的 focused tests、typecheck、build、0-error lint、hygiene、文档叶级门禁和 staged／working-tree diff checks；长任务在后台运行并轮询。
  - [ ] 使用系统 Chrome CDP `9333` 运行最终 exact-row built acceptance 与完整现有 Web 工作流；若 TUI 或共享 preset／进程路径受影响，运行真实 fresh/resume PTY；修复所有 console、page、network、cleanup 或残留资源错误。
  - [ ] 生成最终 exact-staged 审查包并由独立 Subagent 完成 broad code、security、plan/design/spec alignment 与 checklist 审查；若有失败则回到 Task 33。
  - [ ] 逐项勾选本轮 checklist，确认 index 仅包含产品交付、未执行 commit／push／merge／rebase／reset，并向 `progress.md` append exactly one 本轮总结。

## 任务依赖

- Task 1 与 Task 3 依赖 Task 0；文件互不重叠，可并行。
- Task 2 依赖 Task 0 与 Task 1。
- Task 4 依赖 Task 2 与 Task 3。
- Task 5 依赖 Task 4。
- Task 6 依赖 Task 1，可与 Task 5 并行，但指南索引与网站投影由单一整合者串行修改。
- Task 7、Task 8 依赖阶段 1（Task 0-6）完成；二者彼此独立，可并行。
- Task 9 依赖 Task 0-8 的事实稳定。
- Task 10 依赖 Task 9 的交付集与证据稳定。
- Task 11 依赖 Task 10 的交付集稳定；版本元数据采集可按外部仓库并行。
- Task 12 依赖 Task 11 的新鲜基线；各独立审查域可并行，修复和复审按发现串行收敛。
- Task 13 依赖 Task 12 无未解决阻塞发现。
- Task 17 依赖 Task 14–16 完成。
- Task 29 依赖 Task 28 的 final selected-row decision；Task 30 依赖 Task 28 与 Task 29 完成，最终顺序为 Task 28 -> Task 29 -> Task 30。
- Task 31 依赖 Task 30 的交付状态；Task 32 的六个只读审查域依赖 Task 31，可并行执行。
- Task 33 依赖 Task 32 的发现完成技术事实核验；实现保持单写入，独立复审可并行读取。
- Task 34 依赖 Task 33 无未解决阻塞 finding；最终复审发现问题时回到 Task 33 修复并复验。

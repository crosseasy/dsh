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
  - [x] 在 fusion patch 插入 modlens、task-board、SSH、remote-web-ui、pet、skin-center 的真实 bare 包行；Liangshen 仅走 preset。
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
  - [x] 后台启动真实 fusion server，使用独立 Chrome CDP `9333` 验证左侧会话栏、task-board、skin-center、pet、remote-web-ui、modlens 与 Liangshen；修复全部 console error。
  - [x] 保存截图与启动日志证据并停止服务。
  - [x] 运行 `doc-sync` 与 docs site 检查。

- [ ] Task 5: 执行阶段 1 回归与去重矩阵
  - [ ] 验证阶段 1 既有 `base + web-app` 路径：对话、工具卡片、New Session、会话列表、fork、resume、compact、export、Search、Settings 和模型选择；右侧 Files/Web Editor/Terminal/Git 留给 Task 7。
  - [ ] 验证 describe-image、aionui-panel、重复移动端远程与重复 Liangshen 未激活，启动日志无 slot/service 冲突。
  - [ ] 运行 headless 与现有 web profile smoke，证明 fusion 未污染其它 profile。
  - [ ] 运行 dsh-pre-push-checks 选择的最小 GUI、snapshot 或 runnable-example 检查。
  - [ ] 将 pass/fail、命令、日志和截图路径写入不入 Git 的 `fusion-regression-report.md`。
  - [ ] 修正规格、计划、Task 5 brief 与 checklist 的 Editor 阶段归属，把右侧 Web Editor 明确归入 Task 7。
  - [ ] 对 fusion profile 补充 Search、fork、compact 与两个 export 入口的 focused Chrome CDP `9333` exit-0 证据。
  - [ ] 运行 keyless headless 产品路径测试并保存成功输出。
  - [ ] 直接验证 fusion runtime 工具目录不含 `describe_image`，且 modlens 视觉工具恰好一份。

- [x] Task 6: 编写桌面壳消费契约并检查 fusion 发布物
  - [x] 新增 desktop shell contract 英中配对与 sidecar，限定 npm 精确消费、fusion profile、移动端远程单一所有者和桌面壳保留职责。
  - [x] 更新指南索引与网站投影。
  - [x] 检查 fusion 的 publishConfig、exports、files、打包产物与外部 NodeNext 消费。
  - [x] 不执行 npm publish，不修改外部 desktop 仓库。

## 阶段 2：门控扩展

- [ ] Task 7: 以运行时判据锁定并接入 better-sidebar
  - [ ] 在独立 profile 验证最高精确版本，记录声明 peer 漂移、override、allowBuilds、实际 boot 与 Chrome console。
  - [ ] 先写失败测试，再把真实 better-sidebar row 加入 fusion patch。
  - [ ] 重组 fusion profile，验证右侧文件/编辑器/终端/Git tab 与左侧 ui-sidebar 并存，console 无 error。
  - [ ] 若无法通过运行时门，只标记该扩展阻塞，不回滚阶段 1。

- [ ] Task 8: 以运行时判据锁定并验证 dsh-TUI
  - [ ] 在独立 profile 安装精确 dsh-TUI，验证 bundled `workspace:*` 能被消费并检查 profile manifest。
  - [ ] 评估 React 18/19 与 TUI 自带 Liangshen 目录所有权冲突，确定单一所有者。
  - [ ] 为 fusion-tui 提供 Liangshen phase-2 所需的 host `codeRuntime`，或明确记录并验证一个经批准的替代呈现；不得静默改变 Web `0.2.4` 选定行为。
  - [ ] 用真实 PTY 启动，验证顶栏、状态、输入区、共享 Liangshen 与一条消息往返，无崩溃。
  - [ ] 新增 fusion-tui 指南英中配对、sidecar 与网站投影，并运行 doc-sync。
  - [ ] 若无法通过运行时门，只标记该扩展阻塞，不回滚阶段 1。

## 最终交付

- [ ] Task 9: 记录架构决策、执行最终验证与独立审查
  - [ ] 用 dsh-archive-agent-notes 审计同主题 active notes，新增或更新 owning Agent Note 英中配对与 sidecar。
  - [ ] Agent Note 记录运行时判据、fusion 不携带第三方依赖、去重所有权、profile 非内置与重新验证条件。
  - [ ] 新鲜运行 focused tests、typecheck、build、hygiene、doc-sync、docs:check、lint、`git diff --check` 和所有真实 Web/TUI smoke。
  - [ ] 独立子代理逐条验证 `checklist.md`；失败项追加修复任务后重验。
  - [ ] 独立代码审查覆盖正确性、简洁性、架构、安全、性能与系统语义 diff；修复 Critical/Important 后复审。
  - [ ] 确认没有未授权 commit/push/merge/rebase/reset，规划与执行记录未加入 Git。

## 任务依赖

- Task 1 与 Task 3 依赖 Task 0；文件互不重叠，可并行。
- Task 2 依赖 Task 0 与 Task 1。
- Task 4 依赖 Task 2 与 Task 3。
- Task 5 依赖 Task 4。
- Task 6 依赖 Task 1，可与 Task 5 并行，但指南索引与网站投影由单一整合者串行修改。
- Task 7、Task 8 依赖阶段 1（Task 0-6）完成；二者彼此独立，可并行。
- Task 9 依赖 Task 0-8 的事实稳定。

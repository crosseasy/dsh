# 验收清单（v2）

## 阶段 1

- [x] 兼容矩阵记录 modlens、Liangshen 源包及所有保留 web-ui 子包的精确版本、声明 peer、profile allowBuilds、隔离安装、组合、实际 boot、Chrome console 和目标能力结果。
- [x] 所有阶段 1 外部版本均通过 rc.5 运行时经验判据，不含 `latest`、`^`、`~` 或未解析占位符。
- [x] `@deepseek-ai/dsh-fusion` 可构建、可发布、可由 profile composer 解析，并导出运行时入口、patch 与 invariant companion。
- [x] fusion manifest 不声明 modlens、web-ui、better-sidebar 或 dsh-TUI 等第三方运行时依赖，根 `pnpm-workspace.yaml` 未因 fusion 增加 allowBuilds。
- [x] fusion README 英中配对、Model Experience、Known Limitations 与 bundle roster 符合仓库规则。
- [x] fusion patch 激活 modlens、task-board、SSH、remote-web-ui、pet、skin-center，且不引用 web-ui-all、describe-image 或 aionui-panel。
- [x] `liangshen` preset 可发现、可挂载、realm 合法，并保留 standard 完整能力与来源包中验证过的两阶段锚定差异。
- [x] `fusion` profile 的 bundle 顺序为 base、web-app、fusion；外部包只存在于 profile dependencies；现有 web/headless 模板未修改。
- [x] 独立 Chrome CDP `9333` 验证真实阶段 1 fusion 页面，目标 UI 入口可见，全部请求符合预期且 browser console 无错误。
- [ ] 阶段 1 既有 `base + web-app` 路径回归全部通过：对话、工具卡片、会话管理、Search、Settings、模型选择；右侧 Files/Web Editor/Terminal/Git 不属于本项。
- [ ] describe-image、aionui-panel、重复移动端远程和重复 Liangshen 未在阶段 1 运行态激活，启动日志无 slot/service 冲突。
- [ ] headless、ACP 与现有 web profile 未加载 fusion，原有行为保持不变。
- [x] desktop shell 契约只定义精确 npm 消费和能力所有权，不发布包、不修改外部 desktop 仓库。

## 阶段 2

- [ ] better-sidebar 使用通过运行时判据的最高精确版本，声明 peer 漂移与 override 已记录；右侧 Files/Web Editor/Terminal/Git 工作台与左侧 ui-sidebar 并存且 console 无错误，或该扩展被如实标记为阶段 2 阻塞而不影响阶段 1。
- [ ] dsh-TUI 使用锁定版本在真实 PTY 启动并完成消息往返；`workspace:*`、React 与 Liangshen 所有权已评估，或该扩展被如实标记为阶段 2 阻塞而不影响阶段 1。
- [ ] fusion-tui 产品指南具备英文、中文、i18n sidecar 与网站投影（仅当 TUI 运行时门通过）。

## 仓库与交付

- [ ] 产品指南均具备英文、中文和 i18n sidecar，并通过 `website/docs.ts` 显式投影。
- [ ] Agent Note 记录运行时兼容判据、第三方依赖所有权、去重所有权、profile 组装和重新验证条件，且同主题 active note 已审计。
- [ ] focused tests、typecheck、build、hygiene、doc-sync、docs:check、lint 和 `git diff --check` 均有新鲜成功证据。
- [ ] 独立最终代码审查无未解决的 Critical 或 Important 发现。
- [ ] 除新增 fusion package 和明确的注册、测试、文档、Agent Note 外，既有核心 `packages/*` 实现未修改。
- [ ] 未执行未经授权的 commit、push、merge、rebase 或 reset。
- [ ] `.trae/specs/**`、`docs/superpowers/**`、兼容矩阵和回归记录均未加入 Git。

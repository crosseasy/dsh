# Tasks

- [ ] Task 1: 核验候选来源并冻结审计目录，产出可机器验证的插件事实。
  - [ ] 1.1 从 Awesome 清单与 `docs/plugin/superpowers/02-插件矩阵与择优.md` 提取 P0/P1/P2 候选 URL。
  - [ ] 1.2 对每个候选执行只读浅克隆/manifest 核验，记录 HEAD SHA、包名、Node engine、license、`dsh.bundle.patch`、测试/CI、安装脚本和外部依赖。
  - [ ] 1.3 对无法访问、许可证不清、无 bundle、Node 不兼容或要求核心补丁的候选记录硬拒绝，不将其放入 active profile。
  - [ ] 1.4 以 focused schema test 验证目录字段完整、SHA 为 40 位、候选 ID 唯一。

- [ ] Task 2: 创建 `packages/curated/` workspace 拓扑和静态 curated bundle。
  - [ ] 2.1 新增符合仓库 package 约定的 curated 包骨架、README、invariant companion 和 Host aggregate 引用。
  - [ ] 2.2 新增 curated bundle patch，只挂载本仓库拥有的 curated policy，不复制第三方 bundle patch。
  - [ ] 2.3 添加 bundle manifest/patch 解析测试和无 default export 回归测试。
  - [ ] 2.4 运行新包 focused tests、constraints 和新包 typecheck。

- [ ] Task 3: 实现 `curated-policy` 的解析、评分和冲突决策。
  - [ ] 3.1 先写失败测试，覆盖合法目录、浮动版本、短 SHA、硬拒绝覆盖评分、同域双 provider、显式 fallback、秘密值和重复资源。
  - [ ] 3.2 实现最小 catalog/profile schema 与 `ctx.curatedPolicy` 只读查询。
  - [ ] 3.3 实现 registration effect/disposer，并添加 HMR safety 测试。
  - [ ] 3.4 运行 package coverage、typecheck 和 lint 叶级检查。

- [ ] Task 4: 实现五个 profile 模板及物化操作。
  - [ ] 4.1 先写失败测试，覆盖五个模板的 bundle 顺序、P0/P1/P2 分层和 personal 隔离。
  - [ ] 4.2 实现写入指定 DSH home 的 profile manifest、空用户 patch 和 pnpm workspace 文件；已有文件不覆盖。
  - [ ] 4.3 确保 `web-curated` 只含通过硬门槛的默认候选，coding/research/enterprise/personal 只增加各自能力。
  - [ ] 4.4 添加官方 web/headless 文件字节不变测试和重复执行幂等测试。

- [ ] Task 5: 实现 `verify-lock` 与 `preflight` 命令。
  - [ ] 5.1 先写失败测试，覆盖 `latest`/branch/tag/短 SHA、缺审计字段和 tarball SHA 缺失。
  - [ ] 5.2 实现确定性 JSON/文本输出及非零退出码，不泄露秘密值。
  - [ ] 5.3 先写失败测试，覆盖重复 provider、entry/tool/command/service/UI slot/端口/SQLite/cache/env 与配置 secret。
  - [ ] 5.4 实现 preflight，并使用 Cordis `entryListSchema` 解析 patch。
  - [ ] 5.5 运行命令 package coverage、typecheck 和 lint。

- [ ] Task 6: 实现 `smoke-profile` 与 `compare-benchmark`。
  - [ ] 6.1 先写失败测试，覆盖超时、子进程非零、缺 bundle、非法 profile 和 55 秒上限。
  - [ ] 6.2 实现 profile smoke 的 JSON 结果，验证 manifest、bundle 解析、dump-config/help 阶段。
  - [ ] 6.3 先写 benchmark 统计测试，覆盖均值/P50/P95、失败分布、加权分和五个非补偿门槛。
  - [ ] 6.4 实现 rollback 阈值判定与上一版 lock/profile 快照引用。
  - [ ] 6.5 运行命令 package coverage、typecheck 和 lint。

- [ ] Task 7: 组装 P0/P1/P2 profile 数据并执行准入。
  - [ ] 7.1 P0 依次处理 toolkit、context、search、memory、MCP、checkpoint、LSP、permission、OTel、config manager。
  - [ ] 7.2 P1 处理 smooth-stream、upstream-radar、plugin-hub、session-export、better-sidebar。
  - [ ] 7.3 P2 处理 agent-team/background-agents、computer-use、vision-router、llm-fallbacks、univer-office、feishu。
  - [ ] 7.4 每个候选分别运行 verify-lock、preflight 和 profile smoke；失败候选保留审计结果并从 active profile 移除。
  - [ ] 7.5 验证每个 profile 同域最多一个 active provider，enterprise 限制和 P0 基线 exclusions 成立。

- [ ] Task 8: 添加 real-composition、负向故障与回归覆盖。
  - [ ] 8.1 通过 Loader/app-boot 真实组合路径加载 curated bundle/profile，验证启用、禁用和卸载。
  - [ ] 8.2 注入搜索超时、429、浏览器失败、SQLite 锁、无权限文件、非法 patch、断网和初始化失败的可本地模拟子集。
  - [ ] 8.3 验证 fail-closed、单插件禁用恢复、错误包含候选/阶段且不包含秘密。
  - [ ] 8.4 验证官方 web/headless、工具管线、权限交互和会话日志未改变。

- [ ] Task 9: 完成仓库要求的 Agent Note 与包文档。
  - [ ] 9.1 新增 proposed/implemented 生命周期正确的英文 Agent Note，记录精选层边界、拒绝直接修改 core 与不执行第三方安装脚本的理由。
  - [ ] 9.2 新增中文 counterpart 和 i18n sidecar；实现完成后将内容改为当前事实。
  - [ ] 9.3 为每个新包补齐 README、Model Experience、Known Limitations 和导出 JSDoc。
  - [ ] 9.4 运行 Agent Note 与文档 focused gates。

- [ ] Task 10: 系统验证、审查与 Ralph 状态收敛。
  - [ ] 10.1 运行所有 curated focused tests、coverage、constraints、typecheck、lint、doc-sync、build/hygiene 相关叶级命令。
  - [ ] 10.2 自审 `git diff`，确认没有改动用户已有文档移动、没有调试残留、没有计划文档进入 staged 状态。
  - [ ] 10.3 委派独立代码审查与安全审查；修复发现后重新运行对应门禁。
  - [ ] 10.4 更新本文件、`checklist.md` 和 append-only `progress.md`，只有新鲜证据支持时才全部勾选。

## Task Dependencies

- Task 2 depends on Task 1 的稳定候选数据字段。
- Task 3 depends on Task 1 and Task 2；Task 4 depends on Task 1 and Task 2。
- Task 5 depends on Task 3；Task 6 depends on Task 3 and Task 4。
- Task 3 and Task 4 can run in parallel after Task 2。
- Task 5 and Task 6 can run in parallel after their dependencies。
- Task 7 depends on Tasks 4–6。
- Task 8 depends on Task 7。
- Task 9 can start after Task 2 and finish after Task 8。
- Task 10 depends on Tasks 1–9。

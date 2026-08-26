# Tasks

- [x] Task 1: 核验候选来源并冻结审计目录，产出可机器验证的插件事实。
  - [x] 1.1 从 Awesome 清单与 `docs/plugin/superpowers/02-插件矩阵与择优.md` 提取 P0/P1/P2 候选 URL。
  - [x] 1.2 对每个候选执行只读浅克隆/manifest 核验，记录 HEAD SHA、包名、Node engine、license、`dsh.bundle.patch`、测试/CI、安装脚本和外部依赖。
  - [x] 1.3 对无法访问、许可证不清、无 bundle、Node 不兼容或要求核心补丁的候选记录硬拒绝，不将其放入 active profile。
  - [x] 1.4 以 focused schema test 验证目录字段完整、SHA 为 40 位、候选 ID 唯一。

- [x] Task 2: 创建 `packages/curated/` workspace 拓扑和静态 curated bundle。
  - [x] 2.1 新增符合仓库 package 约定的 curated 包骨架、README、invariant companion 和 Host aggregate 引用。
  - [x] 2.2 新增 curated bundle patch，只挂载本仓库拥有的 curated policy，不复制第三方 bundle patch。
  - [x] 2.3 添加 bundle manifest/patch 解析测试和无 default export 回归测试。
  - [x] 2.4 运行新包 focused tests、constraints 和新包 typecheck。

- [x] Task 3: 实现 `curated-policy` 的解析、评分和冲突决策。
  - [x] 3.1 先写失败测试，覆盖合法目录、浮动版本、短 SHA、硬拒绝覆盖评分、同域双 provider、显式 fallback、秘密值和重复资源。
  - [x] 3.2 实现最小 catalog/profile schema 与 `ctx.curatedPolicy` 只读查询。
  - [x] 3.3 实现 registration effect/disposer，并添加 HMR safety 测试。
  - [x] 3.4 运行 package coverage、typecheck 和 lint 叶级检查。

- [x] Task 4: 实现五个 profile 模板及物化操作。
  - [x] 4.1 先写失败测试，覆盖五个模板的 bundle 顺序、P0/P1/P2 分层和 personal 隔离。
  - [x] 4.2 实现写入指定 DSH home 的 profile manifest、空用户 patch 和 pnpm workspace 文件；已有文件不覆盖。
  - [x] 4.3 确保 `web-curated` 只含通过硬门槛的默认候选，coding/research/enterprise/personal 只增加各自能力。
  - [x] 4.4 添加官方 web/headless 文件字节不变测试和重复执行幂等测试。

- [x] Task 5: 实现 `verify-lock` 与 `preflight` 命令。
  - [x] 5.1 先写失败测试，覆盖 `latest`/branch/tag/短 SHA、缺审计字段和 tarball SHA 缺失。
  - [x] 5.2 实现确定性 JSON/文本输出及非零退出码，不泄露秘密值。
  - [x] 5.3 先写失败测试，覆盖重复 provider、entry/tool/command/service/UI slot/端口/SQLite/cache/env 与配置 secret。
  - [x] 5.4 实现 preflight，并使用 Cordis `entryListSchema` 解析 patch。
  - [x] 5.5 运行命令 package coverage、typecheck 和 lint。

- [x] Task 6: 实现 `smoke-profile` 与 `compare-benchmark`。
  - [x] 6.1 先写失败测试，覆盖超时、子进程非零、缺 bundle、非法 profile 和 55 秒上限。
  - [x] 6.2 实现 profile smoke 的 JSON 结果，验证 manifest、bundle 解析、dump-config/help 阶段。
  - [x] 6.3 先写 benchmark 统计测试，覆盖均值/P50/P95、失败分布、加权分和五个非补偿门槛。
  - [x] 6.4 实现 rollback 阈值判定与上一版 lock/profile 快照引用。
  - [x] 6.5 运行命令 package coverage、typecheck 和 lint。

- [x] Task 7: 组装 P0/P1/P2 profile 数据并执行准入。
  - [x] 7.1 P0 依次处理 toolkit、context、search、memory、MCP、checkpoint、LSP、permission、OTel、config manager。
  - [x] 7.2 P1 处理 smooth-stream、upstream-radar、plugin-hub、session-export、better-sidebar。
  - [x] 7.3 P2 处理 agent-team/background-agents、computer-use、vision-router、llm-fallbacks、univer-office、feishu。
  - [x] 7.4 每个候选分别运行 verify-lock、preflight 和 profile smoke；失败候选保留审计结果并从 active profile 移除。
  - [x] 7.5 验证每个 profile 同域最多一个 active provider，enterprise 限制和 P0 基线 exclusions 成立。

- [x] Task 8: 添加 real-composition、负向故障与回归覆盖。
  - [x] 8.1 通过 Loader/app-boot 真实组合路径加载 curated bundle/profile，验证启用、禁用、卸载和错误路径。
  - [x] 8.2 注入搜索超时、429、浏览器失败、SQLite 锁、无权限文件、非法 patch、断网和初始化失败的可本地模拟子集。
  - [x] 8.3 验证 fail-closed、单插件禁用恢复、错误包含候选/阶段且不包含秘密。
  - [x] 8.4 验证官方 web/headless、工具管线、权限交互和会话日志未改变。

- [x] Task 9: 完成仓库要求的 Agent Note 与包文档。
  - [x] 9.1 新增 proposed/implemented 生命周期正确的英文 Agent Note，记录精选层边界、拒绝直接修改 core 与不执行第三方安装脚本的理由。
  - [x] 9.2 新增中文 counterpart 和 i18n sidecar；实现完成后将内容改为当前事实。
  - [x] 9.3 为每个新包补齐 README、Model Experience、Known Limitations 和导出 JSDoc。
  - [x] 9.4 运行 Agent Note 与文档 focused gates。

- [x] Task 10: 系统验证、审查与 Ralph 状态收敛。
  - [x] 10.1 运行所有 curated focused tests、coverage、constraints、typecheck、lint、doc-sync、build/hygiene 相关叶级命令。
  - [x] 10.2 自审 `git diff`，确认没有改动用户已有文档移动、没有调试残留、没有计划文档进入 staged 状态。
  - [x] 10.3 委派独立代码审查与安全审查；修复发现后重新运行对应门禁。
  - [x] 10.4 更新本文件、`checklist.md` 和 append-only `progress.md`，只有新鲜证据支持时才全部勾选。

- [x] Task 11: 从零建立目标文档到实现与证据的追踪矩阵。
  - [x] 11.1 逐条审计 `docs/plugin/superpowers/` 七份文档，将每个 P0/P1/P2 要求映射到源码、配置、测试或明确的长期评测资产。
  - [x] 11.2 独立核对候选目录的来源、完整 SHA、许可证、bundle 声明、Node 兼容性、安装脚本和 active/rejected 决策，不复用旧验收结论。
  - [x] 11.3 审计五个 profile 的继承、能力域互斥、enterprise 限制、官方 profile 不变量和物化幂等性。
  - [x] 11.4 审计 policy、preflight、verify-lock、smoke-profile 和 compare-benchmark 的成功、拒绝、脱敏、超时与 fail-closed 路径。
  - [x] 11.5 记录所有发现并区分真实实现缺口、陈旧文档、不可在单轮本地完成的长周期评测和无效要求。

- [x] Task 12: 修复 Task 11 发现的可执行缺口。
  - [x] 12.1 为每个行为缺口先添加或确认失败测试，再实施最小修复。
  - [x] 12.2 同步受影响的 README、JSDoc、双语文档、Agent Note 与生成工件；不修改 `docs/plugin/superpowers/` 的规划口径，除非其描述与仓库事实冲突。
  - [x] 12.3 对每项修复运行耗时少于一分钟的 focused test、typecheck、lint 或文档叶级门禁。

- [ ] Task 13: 取得不依赖旧记录的新鲜运行证据。
  - [ ] 13.1 运行 curated 包 focused tests 与覆盖率、workspace constraints、Host/client typecheck、lint、doc-sync、build 和 hygiene 的相关叶级命令。
  - [ ] 13.2 运行 verify-lock、五个 profile 的 preflight/smoke、benchmark 比较和全部负向 fixture，核对退出码与脱敏输出。
  - [ ] 13.3 通过真实 CLI/PTy 验证 `web-curated` 与 `headless` 基线路径；需要浏览器时只使用 Chrome CDP 9333，并修复控制台 error。
  - [ ] 13.4 检查 diff 与 staging，确认不回滚或覆盖用户改动，不执行 commit/push/merge/rebase/reset，规划工件不进入 staging。

- [ ] Task 14: 独立复审并完成 Ralph 收敛。
  - [ ] 14.1 委派独立代码审查、安全审查和规格一致性审查，覆盖全部 curated 直接改动与 Task 11 追踪矩阵。
  - [ ] 14.2 修复所有 P0-P2 或高置信度实质问题，并重新运行受影响门禁。
  - [ ] 14.3 逐项重验新增 checklist，更新任务状态，并向 append-only `progress.md` 追加本轮唯一总结。

## Task 11 审计结论

1. `smoke-profile` 为外部 bundle 生成 no-op shim，没有加载真实插件，因此不能证明真实插件可运行（`packages/curated/curated-scripts/src/index.ts:542-631`；`packages/curated/curated-scripts/tests/commands.spec.ts:1434-1505`）。
2. preflight 与静态准入信任手写的 allowlist、resource 和总分数据，不从候选工件提取或核对这些事实，也没有八维评分（`packages/curated/curated-scripts/src/index.ts:1100-1430`；`packages/curated/curated-policy/src/index.ts:281-423`）。
3. enterprise 开关和 P2 预算只是元数据；policy `apply` 忽略 enterprise 字段，预算也未进入运行时执行路径（`packages/curated/curated-profiles/src/index.ts:26-51,120-128`；`packages/curated/curated-policy/src/index.ts:587-596`；`packages/curated/curated-bench/tasks/p2-risk-gates.json:4-35`）。
4. 冲突校验只使用 `capability-conflicts.yaml` 的能力域集合，没有执行其中的 provider/fallback/rule；`context` 与 `context-doctor` 的能力名不一致时可绕过策略（`packages/curated/curated-policy/policy/capability-conflicts.yaml:3-38`；`packages/curated/curated-scripts/src/index.ts:1400-1429`）。
5. permission fail-closed 策略仅被解析和查询，没有接入工具执行或审批路径（`packages/curated/curated-policy/policy/permission-rules.yaml:3-30`；`packages/curated/curated-policy/src/index.ts:520-596`）。
6. secret 扫描跳过 curated 元数据，且 smoke 子进程继承未清理的 `process.env`（`packages/curated/curated-scripts/src/index.ts:500,1267-1279`）。
7. `verify-lock` 没有强制核对 Node 兼容性和 requires-core-patch（`packages/curated/curated-scripts/src/index.ts:378-404,1105-1183`）。
8. benchmark 允许 baseline/candidate 使用不可比的任务集和重复次数，在硬门槛前舍入指标，基线以 1ms/1-token 伪造成功记录，rollback 只返回路径字符串（`packages/curated/curated-scripts/src/index.ts:822-970`；`packages/curated/curated-bench/baselines/benchmark.json:6-168`）。
9. regression matrix 主要核对常量和文档化 fixture，没有运行真实 tool、approval 或 session 路径（`packages/curated/curated-bench/baselines/web-cdp-regression.json:1-31`；`packages/curated/curated-bench/tasks/p2-risk-gates.json:37-64`）。
10. 候选复核发现 14 个 repo/SHA 对返回 404，但 `verify-lock` 仍通过；20 个 active pin 均可访问，但 `dsh-permission-rules` 漏记实际 prepare script，`dsh-llm-fallbacks` 的 license 拒绝与仓库 MIT LICENSE 冲突，active `dsh-better-sidebar` 的 78 分不满足 P1 ≥85，active `dsh-plugin-hub` 与 `plugin-session-export` 的 Node 兼容性不可验证（`packages/curated/curated-policy/policy/plugin-allowlist.yaml:216-242,303-329,397-423,491-517,655-680`）。
11. 文档与 profile 分配互相矛盾：research 的 session-export、mneme、vision 归属不一致，基线数量也存在 12 与 15 的冲突（`docs/plugin/superpowers/01-目标架构.md:93-112`；`docs/plugin/superpowers/02-插件矩阵与择优.md:116-120`；`packages/curated/curated-profiles/src/index.ts:60-87`）。
12. 浏览器、搜索、记忆、MCP、canary 等长周期工作仍待执行，不得表述为已通过（`docs/plugin/superpowers/03-实施路线图.md:236-262`；`packages/curated/curated-bench/README.md:33-36`）。

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
- Task 11 是本轮独立重审起点；11.1–11.4 可由只读子代理并行执行，11.5 汇总其证据。
- Task 12 depends on Task 11；若 Task 11 无实现缺口，Task 12 以“无需修改且有证据”完成。
- Task 13 depends on Task 12；13.1–13.3 可在互不写同一输出时并行。
- Task 14 depends on Tasks 11–13。

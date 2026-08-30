# Superpowers 功能严格审查与实现计划

## 目标

严格审查并完整实现 `docs/plugin/superpowers/` 描述的功能；保留当前工作树中的既有改动，全程自动推进，不等待人工确认，不执行 Git commit 或 push。

## 强制约束

- 以仓库 `AGENTS.md`、`docs/AGENTS.md`、`docs/architecture.md` 和相关子目录规则为准。
- 当前分支已有大规模未提交改动；禁止重置、覆盖或清理既有工作。
- 规范、实现、测试、文档、双语投影、Agent Note 和门禁证据必须保持一致。
- 只运行与改动面匹配的检查；最终差异审查须区分既有改动与本轮补充。
- 不执行 `git commit`、`git push`、`gh stack sync` 或等价发布操作。

## 阶段

| 阶段 | 状态 | 内容 |
|---|---|---|
| 1. 恢复上下文与建立基线 | complete | 检查工作树、恢复上一会话摘要、确认现有改动规模与禁止覆盖约束。 |
| 2. 规范与实现审计 | complete | 已完成规范、代码、测试与接线盘点；现有治理机制较完整，第三方 runtime 激活和长期实验诚实保持 pending。 |
| 3. 缺口设计 | complete | 完成 curated 生命周期只读复审，确认安装事务、profile 物化、只读命令、冲突准入、权限顺序和 watcher rollback 缺陷。 |
| 4. 实现与文档同步 | in_progress | 已修复 DoD、离线安装、profile-root symlink、profile 物化 rollback/并发、候选派生状态与显式 blocker、watcher rollback、activation evidence/npmrc、benchmark schema 3/content binding/identity 及路线图门禁；继续修复 install transaction 与 smoke/lock。 |
| 5. 分层验证 | in_progress | Curated/security 聚焦 965 项、CLI/profile 371 项、packed command 1 项均通过；相关包与 CLI typecheck、doc-sync 29/29、type-equiv 407/407 和 diff check 通过。待 install/smoke 修复后重跑其受影响面及最终 lint/build/hygiene。 |
| 6. 独立严格复审与收口 | pending | 对最终差异做正确性、安全性、生命周期、发布与文档一致性复审，修复全部有效问题。 |
| 7. Curated 安全复审修复 | in_progress | 修复 activation evidence 的祖先 symlink TOCTOU 与 npmrc 精确键解析，补 adversarial 测试、README、既有治理 Agent Note，并运行聚焦验证。 |

## 当前决策

1. 先审计后改动；不因已有大量代码而假定功能已经完成。
2. 使用只读子代理分别审查规范与现有实现，主会话负责汇总、决策、编辑和验证。
3. 用户要求全自动，因此对可由规范、代码或仓库惯例决定的问题采用最安全且符合现有架构的默认方案，不发起人工选择。
4. 根目录规划文件仅用于本次执行记忆，不进入产品规范；最终是否保留由仓库门禁与任务用途决定，收口时处理。

## 错误记录

| 错误 | 次数 | 处理 |
|---|---:|---|
| `code-reviewer` 子代理类型不可用 | 1 | 改用可用的 `general-purpose` 子代理执行同一只读审查，不重复该类型调用。 |
| `pnpm run typecheck` host face 失败 | 1 | 为 `benchmarkRun` 局部对象补 `Record<string, unknown>`，全量 typecheck 已通过。 |
| `lint:contracts-ready` 失败 | 1 | 三处 void callback/冗余断言；已改用 block body 并删除无效断言，待复验。 |
| `doc-sync` translation pairing 失败 | 1 | 28/29 门禁通过；检查 3 组中英文 README 后重录 pairing metadata，复验 29/29 通过。 |
| `commands.spec.ts` 祖先检查误拒绝 macOS `/var` symlink | 1 | 将检查范围缩至 DSH home、`profiles`、profile root 三层，不检查系统级更高祖先。 |
| 生命周期并行修复出现中间态 TypeScript 诊断 | 1 | 已将缺失 helper/snapshot 方法/未用 import 等精确诊断反馈给负责代理；完成前不得进入验证阶段。 |

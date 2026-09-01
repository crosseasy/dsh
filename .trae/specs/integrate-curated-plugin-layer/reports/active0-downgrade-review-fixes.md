# Active0 降级复审修复报告

## 结论

三项复审问题已修复。`2026-08-24` 规划事实迁移到 `packages/curated/curated-bench/baselines/history/2026-08-24.json`；原 dated lock/profile 文件保持删除。History 明确使用 schema 1、`kind: curated-planning-history`、`evidenceKind: planned` 与 `restorable: false`，保留 37/21 计数、catalog 引用、profile bundle、原记录 kind、原 operator 指令和迁移路径。递归 validator 校验 `history/` 中的全部 JSON，`compare-benchmark` 仍只接受 schema 2 lock/profile snapshot。

Checklist 与任务清单只把搜索超时、429、SQLite 锁、权限拒绝、非法 patch、断网和初始化失败列为本地 fixture 覆盖。浏览器崩溃没有本地 fixture，继续作为 planned/pending 风险项；勾选仅表示覆盖范围和待办状态记录准确。

`docs/plugin/superpowers/02-插件矩阵与择优.md` 中的 LoongSuite 结论统一为：已通过静态/安装资格，但缺少 assembled snapshot，因此保持 inactive，且不进入 `web-enterprise` runnable 模板。

## TDD

- RED：首次运行 `bench.spec.ts` 时 44 项中新增 2 项失败，原因分别为 history 文件缺失和 validator 未遍历 `history/`。
- GREEN：实现 history 与递归校验后，`bench.spec.ts` 44/44 通过。
- Coverage：补齐持久化 JSON 负例后，curated-bench 的 `index.ts`、`invariant.ts` 与 `snapshot.ts` statements、branches、functions、lines 均为 100%。

## 验证

- `bench.spec.ts`：44/44 通过。
- `commands.spec.ts`：340/340 通过；planning history 作为 rollback snapshot 的拒绝用例通过。
- 一次与 typecheck/doc-sync 并行的完整测试使既有 500ms wall-deadline 用例在 501ms 超时；该用例隔离重跑通过，随后 `commands.spec.ts` 完整重跑通过。
- 根 `pnpm run typecheck`：通过。
- 变更 TypeScript 文件 scoped oxlint：0 warning、0 error。
- 根 `pnpm run lint`：执行完成但失败于任务前已有的未跟踪 `packages/**/src/*.d.ts` 生成文件，共 806 条格式诊断；未修改或删除这些文件。
- `pnpm run doc-sync`：28/28 通过。
- 指定两组双语 pairing：通过。
- `pnpm run verify-md-links`：2077 个文件通过。
- 定向 `git diff --check`：通过。

本轮未运行浏览器：没有 active UI 候选，浏览器崩溃仍是明确的 planned/pending 项。本轮未执行 commit、push、merge、rebase、reset 或其他 Git 写操作。

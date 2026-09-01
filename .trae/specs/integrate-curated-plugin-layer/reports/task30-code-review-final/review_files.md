# 待评审文件列表

scope: diff_only

diff_direction: base → source（`-` 行 = 旧代码/已删除，`+` 行 = 新代码/待评审）

总文件数: 22
排除范围: `.trae/specs/**` 状态与既有报告、`vendor/**`、`.agents/notes/archived/**`
补充范围: Bits 默认过滤后的测试、文档及未跟踪文件按用户要求重新纳入

| 文件路径 | 变更行数 |
| -------- | -------- |
| .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.i18n.yaml | +2, -2 |
| .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md | +2, -2 |
| .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.zh.md | +4, -0 |
| packages/curated/curated-bench/evidence/README.i18n.yaml | +2, -2 |
| packages/curated/curated-bench/evidence/README.md | +1, -1 |
| packages/curated/curated-bench/evidence/README.zh.md | +1, -1 |
| packages/curated/curated-bench/tests/bench.spec.ts | +58, -0 |
| packages/curated/curated-policy/README.i18n.yaml | +2, -2 |
| packages/curated/curated-policy/README.md | +1, -1 |
| packages/curated/curated-policy/README.zh.md | +1, -1 |
| packages/curated/curated-policy/tests/catalog.spec.ts | +1, -0 |
| packages/curated/curated-profiles/tests/profiles.spec.ts | +236, -1 |
| packages/curated/curated-scripts/src/index.ts | +3, -2 |
| packages/curated/curated-scripts/tests/commands.spec.ts | +420, -0 |
| scripts/audit-curated-candidates.spec.ts | +159, -114 |
| scripts/audit-curated-candidates.ts | +33, -38 |
| scripts/release/verify.ts | +8, -3 |
| scripts/run-owned-process.spec.ts | +291, -0 |
| scripts/run-owned-process.ts | +139, -0 |
| scripts/verify-curated-activation-evidence.spec.ts | +71, -38 |
| scripts/verify-curated-activation-evidence.ts | +22, -16 |
| tsconfig.base.json | +1, -0 |

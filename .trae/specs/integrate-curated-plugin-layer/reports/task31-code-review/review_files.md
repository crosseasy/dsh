# 待评审文件列表

scope: full_file

用户指定评审范围: 当前 curated 生产实现及直接 CLI/app-boot/workspace bridge

diff_direction: base → source（`-` 行 = 旧代码/已删除，`+` 行 = 新代码/待评审）

总文件数: 16

| 文件路径 | 变更行数 |
| -------- | -------- |
| apps/cli/src/curated-profile-lock.ts | untracked full file |
| apps/cli/src/curated-profile.ts | +87, -6 |
| apps/cli/src/dump-config.ts | +33, -23 |
| apps/cli/src/plugin.ts | +259, -264 |
| apps/cli/src/profile-boot.ts | +99, -41 |
| packages/boot/app-boot/src/index.ts | +111, -6 |
| packages/curated/curated-bench/package.json | full file |
| packages/curated/curated-bench/src/index.ts | +34, -13 |
| packages/curated/curated-bench/src/invariant.ts | +125, -38 |
| packages/curated/curated-bench/src/snapshot.ts | +82, -27 |
| packages/curated/curated-bench/tsdown.config.ts | untracked full file |
| packages/curated/curated-policy/src/index.ts | +7, -0 |
| packages/curated/curated-policy/src/installed-lock.ts | untracked full file |
| packages/curated/curated-profiles/src/index.ts | +145, -27 |
| packages/curated/curated-scripts/src/index.ts | +209, -48 |
| scripts/check-workspace-constraints.ts | full file |

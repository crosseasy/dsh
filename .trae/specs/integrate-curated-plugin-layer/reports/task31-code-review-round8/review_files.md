# 待评审文件列表

scope: full_file

用户指定评审范围: `packages/curated/**` 及直接 CLI/boot bridge 与两项 curated 审计脚本；包含未跟踪范围文件。
diff_direction: base → source（范围内按当前工作树完整文件评审，不执行 diff 行过滤）

总文件数: 93
当前内容总行数: 47699
工作树变更行数: 5980
排除文件数: 0

| 文件路径 | 状态 | 当前行数 | 变更行数 |
| -------- | ---- | -------- | -------- |
| apps/cli/src/curated-profile-lock.ts | ?? | 439 | +439, -0 |
| apps/cli/src/curated-profile.ts | = | 153 | +87, -6 |
| apps/cli/src/dump-config.ts | M | 74 | +33, -23 |
| apps/cli/src/plugin.ts | M | 1025 | +410, -264 |
| apps/cli/src/profile-boot.ts | M | 426 | +99, -41 |
| packages/boot/app-boot/src/index.ts | M | 978 | +111, -6 |
| packages/curated/README.i18n.yaml | = | 6 | +0, -0 |
| packages/curated/README.md | = | 49 | +0, -0 |
| packages/curated/README.zh.md | = | 49 | +0, -0 |
| packages/curated/curated-base/README.i18n.yaml | = | 6 | +0, -0 |
| packages/curated/curated-base/README.md | = | 30 | +0, -0 |
| packages/curated/curated-base/README.zh.md | = | 30 | +0, -0 |
| packages/curated/curated-base/cordis.patch.yml | = | 9 | +0, -0 |
| packages/curated/curated-base/package.json | = | 55 | +0, -0 |
| packages/curated/curated-base/src/index.ts | = | 9 | +0, -0 |
| packages/curated/curated-base/src/invariant.ts | = | 26 | +0, -0 |
| packages/curated/curated-base/tests/bundle.spec.ts | = | 76 | +0, -0 |
| packages/curated/curated-base/tsconfig.json | = | 21 | +0, -0 |
| packages/curated/curated-bench/README.i18n.yaml | M | 6 | +2, -2 |
| packages/curated/curated-bench/README.md | M | 48 | +3, -1 |
| packages/curated/curated-bench/README.zh.md | M | 48 | +3, -1 |
| packages/curated/curated-bench/baselines/.keep.json | = | 3 | +0, -0 |
| packages/curated/curated-bench/baselines/ab-comparisons.json | = | 102 | +0, -0 |
| packages/curated/curated-bench/baselines/benchmark.json | = | 65 | +0, -0 |
| packages/curated/curated-bench/baselines/history/2026-08-24.json | = | 32 | +0, -0 |
| packages/curated/curated-bench/baselines/locks/web-curated.json | = | 6 | +0, -0 |
| packages/curated/curated-bench/baselines/locks/web.json | = | 6 | +0, -0 |
| packages/curated/curated-bench/baselines/profiles/web-curated.json | = | 10 | +0, -0 |
| packages/curated/curated-bench/baselines/profiles/web.json | = | 9 | +0, -0 |
| packages/curated/curated-bench/baselines/web-cdp-regression.json | = | 32 | +0, -0 |
| packages/curated/curated-bench/evidence/README.i18n.yaml | = | 6 | +0, -0 |
| packages/curated/curated-bench/evidence/README.md | = | 7 | +0, -0 |
| packages/curated/curated-bench/evidence/README.zh.md | = | 7 | +0, -0 |
| packages/curated/curated-bench/manifests/.keep.json | = | 3 | +0, -0 |
| packages/curated/curated-bench/manifests/curated-candidates.json | = | 56 | +0, -0 |
| packages/curated/curated-bench/package.json | = | 56 | +0, -0 |
| packages/curated/curated-bench/src/index.ts | M | 195 | +52, -16 |
| packages/curated/curated-bench/src/invariant.ts | M | 1258 | +125, -38 |
| packages/curated/curated-bench/src/snapshot.ts | M | 478 | +82, -27 |
| packages/curated/curated-bench/tasks/.keep.json | = | 3 | +0, -0 |
| packages/curated/curated-bench/tasks/curated-tasksets.json | = | 205 | +0, -0 |
| packages/curated/curated-bench/tasks/p2-risk-gates.json | = | 106 | +0, -0 |
| packages/curated/curated-bench/tests/bench.spec.ts | M | 3056 | +373, -4 |
| packages/curated/curated-bench/tsconfig.json | = | 22 | +0, -0 |
| packages/curated/curated-bench/tsdown.config.ts | ?? | 17 | +17, -0 |
| packages/curated/curated-policy/README.i18n.yaml | M | 6 | +2, -2 |
| packages/curated/curated-policy/README.md | M | 40 | +2, -0 |
| packages/curated/curated-policy/README.zh.md | M | 40 | +2, -0 |
| packages/curated/curated-policy/package.json | = | 50 | +0, -0 |
| packages/curated/curated-policy/policy/capability-conflicts.yaml | = | 38 | +0, -0 |
| packages/curated/curated-policy/policy/permission-rules.yaml | = | 25 | +0, -0 |
| packages/curated/curated-policy/policy/plugin-allowlist.yaml | = | 1823 | +0, -0 |
| packages/curated/curated-policy/src/index.ts | M | 2168 | +7, -0 |
| packages/curated/curated-policy/src/installed-lock.ts | ?? | 807 | +807, -0 |
| packages/curated/curated-policy/src/invariant.ts | = | 26 | +0, -0 |
| packages/curated/curated-policy/tests/catalog.spec.ts | M | 3355 | +67, -0 |
| packages/curated/curated-policy/tests/installed-lock.spec.ts | ?? | 1138 | +1138, -0 |
| packages/curated/curated-policy/tsconfig.json | = | 19 | +0, -0 |
| packages/curated/curated-profiles/README.i18n.yaml | M | 6 | +2, -2 |
| packages/curated/curated-profiles/README.md | M | 49 | +3, -2 |
| packages/curated/curated-profiles/README.zh.md | M | 49 | +3, -2 |
| packages/curated/curated-profiles/package.json | = | 50 | +0, -0 |
| packages/curated/curated-profiles/src/index.ts | M | 1477 | +145, -27 |
| packages/curated/curated-profiles/src/invariant.ts | = | 26 | +0, -0 |
| packages/curated/curated-profiles/tests/fixtures/behavior-bundle/cordis.patch.yml | = | 13 | +0, -0 |
| packages/curated/curated-profiles/tests/fixtures/behavior-bundle/package.json | = | 16 | +0, -0 |
| packages/curated/curated-profiles/tests/fixtures/behavior-bundle/plugin.mjs | = | 101 | +0, -0 |
| packages/curated/curated-profiles/tests/fixtures/behavior-profile.ts | = | 121 | +0, -0 |
| packages/curated/curated-profiles/tests/profiles.spec.ts | M | 3489 | +357, -1 |
| packages/curated/curated-profiles/tsconfig.json | = | 24 | +0, -0 |
| packages/curated/curated-scripts/README.i18n.yaml | M | 6 | +2, -2 |
| packages/curated/curated-scripts/README.md | M | 52 | +7, -3 |
| packages/curated/curated-scripts/README.zh.md | M | 54 | +9, -3 |
| packages/curated/curated-scripts/compare-benchmark.mjs | = | 10 | +0, -0 |
| packages/curated/curated-scripts/package.json | = | 71 | +0, -0 |
| packages/curated/curated-scripts/preflight.mjs | = | 10 | +0, -0 |
| packages/curated/curated-scripts/smoke-profile.mjs | = | 10 | +0, -0 |
| packages/curated/curated-scripts/src/bin.ts | = | 34 | +0, -0 |
| packages/curated/curated-scripts/src/compare-benchmark.ts | = | 7 | +0, -0 |
| packages/curated/curated-scripts/src/index.ts | M | 5913 | +274, -62 |
| packages/curated/curated-scripts/src/invariant.ts | = | 26 | +0, -0 |
| packages/curated/curated-scripts/src/preflight.ts | = | 7 | +0, -0 |
| packages/curated/curated-scripts/src/smoke-profile.ts | = | 7 | +0, -0 |
| packages/curated/curated-scripts/src/staging-worker.ts | = | 13 | +0, -0 |
| packages/curated/curated-scripts/src/verify-lock.ts | = | 7 | +0, -0 |
| packages/curated/curated-scripts/tests/commands.spec.ts | M | 15303 | +744, -27 |
| packages/curated/curated-scripts/tests/fixtures/local-git-profile.ts | = | 51 | +0, -0 |
| packages/curated/curated-scripts/tests/packed-entry.e2e.ts | M | 276 | +6, -5 |
| packages/curated/curated-scripts/tsconfig.json | = | 18 | +0, -0 |
| packages/curated/curated-scripts/tsdown.config.ts | = | 23 | +0, -0 |
| packages/curated/curated-scripts/verify-lock.mjs | = | 10 | +0, -0 |
| scripts/audit-curated-candidates.ts | = | 493 | +0, -0 |
| scripts/verify-curated-activation-evidence.ts | = | 1039 | +0, -0 |

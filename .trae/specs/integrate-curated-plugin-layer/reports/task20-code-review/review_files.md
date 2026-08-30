# 待评审文件列表

scope: full_file

用户指定评审范围: `packages/curated/**`; `apps/cli/src/curated-profile.ts`; `apps/cli/tests/curated-profile.spec.ts`; changed `scripts/release/**`; changed `scripts/rescope-vendor*`; curated `pnpm-lock.yaml` entries; directly changed curated package docs, architecture/subsystem docs, `docs/plugin/superpowers/**`, and the active curated governance Agent Note. Excludes `vendor/**`, archived Agent Notes, `.trae/specs/**` planning/status files, generated pairing sidecars except consistency inspection, and unrelated worktree diffs.

diff_direction: base → source（`-` 行 = 旧代码/已删除，`+` 行 = 新代码/待评审）

总文件数: 274
排除文件数: 192（AI 工具/Agent 配置 97 个, 二进制/媒体文件 64 个, 生成/测试目录 30 个, 依赖/包管理 1 个）

| 文件路径 | 变更行数 |
| -------- | -------- |
| docs/arch/review_report/code-optimization-audit.i18n.yaml | +2, -2 |
| docs/architecture.i18n.yaml | +2, -2 |
| docs/config-catalog.i18n.yaml | +2, -2 |
| docs/cookbook/adding-a-package.i18n.yaml | +2, -2 |
| docs/development.i18n.yaml | +2, -2 |
| docs/module-graph.i18n.yaml | +2, -2 |
| "docs/plugin/superpowers/00-\350\203\214\346\231\257\344\270\216\347\233\256\346\240\207.md" | +6, -2 |
| "docs/plugin/superpowers/01-\347\233\256\346\240\207\346\236\266\346\236\204.md" | +13, -11 |
| "docs/plugin/superpowers/02-\346\217\222\344\273\266\347\237\251\351\230\265\344\270\216\346\213\251\344\274\230.md" | +20, -10 |
| "docs/plugin/superpowers/03-\345\256\236\346\226\275\350\267\257\347\272\277\345\233\276.md" | +41, -40 |
| "docs/plugin/superpowers/04-\350\257\204\346\265\213\344\275\223\347\263\273.md" | +15, -13 |
| "docs/plugin/superpowers/05-\345\256\211\345\205\250\344\276\233\345\272\224\351\223\276\344\270\216\351\243\216\351\231\251.md" | +12, -7 |
| docs/subsystems/curated.i18n.yaml | +2, -2 |
| docs/subsystems/workflow.i18n.yaml | +2, -2 |
| knip.json | +13, -0 |
| packages/client/connection/src/client/fixture.ts | +13, -29 |
| packages/core/session/src/request-header.ts | +1, -1 |
| packages/curated/README.i18n.yaml | +2, -2 |
| packages/curated/curated-base/package.json | +0, -1 |
| packages/curated/curated-bench/README.i18n.yaml | +2, -2 |
| packages/curated/curated-bench/baselines/ab-comparisons.json | +1, -0 |
| packages/curated/curated-bench/baselines/locks/web-curated.json | +2, -2 |
| packages/curated/curated-bench/baselines/profiles/web-curated.json | +2, -8 |
| packages/curated/curated-bench/manifests/curated-candidates.json | +5, -5 |
| packages/curated/curated-bench/package.json | +0, -1 |
| packages/curated/curated-policy/README.i18n.yaml | +2, -2 |
| packages/curated/curated-policy/package.json | +0, -1 |
| packages/curated/curated-policy/policy/plugin-allowlist.yaml | +149, -70 |
| packages/curated/curated-policy/src/index.ts | +98, -27 |
| packages/curated/curated-profiles/README.i18n.yaml | +2, -2 |
| packages/curated/curated-profiles/package.json | +0, -1 |
| packages/curated/curated-profiles/src/index.ts | +244, -31 |
| packages/curated/curated-scripts/README.i18n.yaml | +2, -2 |
| packages/curated/curated-scripts/package.json | +1, -1 |
| packages/curated/curated-scripts/src/index.ts | +1147, -242 |
| packages/extensions/tool-cordis/src/api-catalog.ts | +3, -3 |
| packages/llm/llm-pi-ai/README.i18n.yaml | +2, -2 |
| packages/llm/llm/README.i18n.yaml | +2, -2 |
| packages/llm/llm/package.json | +4, -0 |
| packages/llm/token-meter/README.i18n.yaml | +2, -2 |
| packages/llm/token-meter/src/client.ts | +17, -3 |
| packages/plan/plan-mode/README.i18n.yaml | +2, -2 |
| packages/plan/plan-mode/src/client.ts | +8, -5 |
| packages/sdk/README.i18n.yaml | +2, -2 |
| packages/sdk/client/README.i18n.yaml | +2, -2 |
| packages/sdk/client/src/client.ts | +1, -1 |
| packages/sdk/protocol/README.i18n.yaml | +2, -2 |
| packages/sdk/protocol/src/transport.ts | +42, -41 |
| packages/sdk/server/README.i18n.yaml | +2, -2 |
| packages/session/session-stats/README.i18n.yaml | +2, -2 |
| packages/session/session-stats/src/client.ts | +8, -5 |
| packages/settings/settings-file/README.i18n.yaml | +2, -2 |
| packages/settings/settings-file/src/index.ts | +12, -3 |
| packages/settings/settings/README.i18n.yaml | +2, -2 |
| packages/settings/settings/src/index.ts | +57, -40 |
| packages/settings/settings/src/redact.ts | +8, -2 |
| packages/shell/persistent-tool-runtime/src/index.ts | +10, -1 |
| packages/subagent/subagent-codex/src/wire.ts | +46, -3 |
| packages/workflow/README.i18n.yaml | +2, -2 |
| packages/workflow/tool-ralph/README.i18n.yaml | +2, -2 |
| packages/workflow/tool-ralph/src/index.ts | +6, -1 |
| packages/workflow/tool-workflow/README.i18n.yaml | +2, -2 |
| packages/workflow/tool-workflow/src/index.ts | +6, -1 |
| packages/workflow/workflow-worker-thread/README.i18n.yaml | +2, -2 |
| packages/workflow/workflow-worker-thread/src/host.ts | +8, -10 |
| packages/workflow/workflow-worker-thread/src/index.ts | +4, -3 |
| packages/workflow/workflow/README.i18n.yaml | +2, -2 |
| packages/workflow/workflow/src/index.ts | +7, -5 |
| packages/workflow/workflow/src/runtime-types.ts | +5, -3 |
| packages/workflow/workflow/src/types.ts | +1, -1 |
| python/README.i18n.yaml | +2, -2 |
| python/sdk/README.i18n.yaml | +2, -2 |
| python/sdk/src/deepseek_harness/client.py | +42, -7 |
| scripts/check-workspace-constraints.ts | +4, -5 |
| scripts/oxlint-contract.spec.ts | +87, -0 |
| scripts/release/families.spec.ts | +20, -2 |
| scripts/rescope-vendor.spec.ts | +20, -1 |
| scripts/rescope-vendor.ts | +3, -3 |
| scripts/run-gates.ts | +1, -0 |
| scripts/snapshots/translation-prompt-v4/request-response.expected.json | +2, -2 |
| tsconfig.base.client.json | +1, -0 |
| tsconfig.base.json | +1, -0 |

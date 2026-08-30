# Task 14 Snapshot Counts Report

## RED

前一代理确认旧基线仍记录 `activeCount: 13`、`rejectedCount: 23`、`admissionTiers.default: 13`，与更新后的 curated 候选目录不一致，导致 `exports directories containing JSON benchmark assets` 断言失败。

## GREEN

已运行：

```sh
timeout 55s node_modules/.bin/vitest run packages/curated/curated-bench/tests/bench.spec.ts -t "exports directories containing JSON benchmark assets"
```

结果摘要：`packages/curated/curated-bench/tests/bench.spec.ts` 通过；`1 passed`、`15 skipped`，测试文件 `1 passed`，退出码 0。

## 文件变更

- `packages/curated/curated-bench/baselines/profiles/web-curated.json`：将 `bundles` 调整为当前 `web-curated` 模板的精确列表，移除 `dsh-context` 和 `dsh-config-manager`。
- `.trae/specs/integrate-curated-plugin-layer/task-14-snapshot-counts-report.md`：记录本次 RED/GREEN 和快照处理结论。

## 历史快照

未修改带日期的历史 snapshot。它们记录当时的基线状态；本次只修正当前 `web-curated` profile 基线，避免把历史证据改写成当前状态。

## Reviewer Follow-up

已处理 `bench.spec.ts` 的 reviewer findings：资产导出测试中的 current `web-curated` lock/profile 部分只保留 JSON 文件存在性检查，派生一致性检查迁入 `commands.spec.ts` 的 focused policy/profile snapshot 对齐测试。

GREEN：

```sh
timeout 55s node_modules/.bin/vitest run packages/curated/curated-bench/tests/bench.spec.ts -t "exports directories containing JSON benchmark assets"
timeout 55s node_modules/.bin/vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t "keeps curated benchmark snapshots aligned with policy and profiles"
```

结果摘要：两个 focused runs 均通过；`bench.spec.ts` 为 `1 passed`、`15 skipped`，`commands.spec.ts` 为 `1 passed`、`151 skipped`。

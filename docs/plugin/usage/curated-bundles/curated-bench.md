# @deepseek-ai/dsh-curated-bench 使用指南

## Summary

提供精选插件准入使用的结构化 benchmark 资产与只读服务。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要读取精选准入 benchmark 资产。
- 需要验证 curated-base 插入的 benchmark 服务行。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`cordis-plugin`。
- Inventory 装配入口：`packages/curated/curated-bench/src/index.ts:120; mounted by packages/curated/curated-base/cordis.patch.yml:9`。
- Inventory 类型为 `cordis-plugin`，通过目标 profile 的 Cordis 行挂载。
- 手动组合时，将插件行加入目标 `cordis.yml`，并确认依赖服务也在同一配置树中。
```yaml
- name: '@deepseek-ai/dsh-curated-bench'
```


## 实际使用

- 通过 curated-base 或手动 cordis.yml 挂载该插件。
- 消费者读取 curated benchmark 资产；本包自身不执行 benchmark。

## 可观察结果

- Benchmark assets and baselines are packaged and validated. It does not execute A/B workloads here.
- Inventory 预期成功信号：Observable behavior matches package purpose: Structured benchmark assets for curated plugin admission

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Curated-base assembly and tests。
- 证据记录：Curated-base patch parse and web-curated dump include `curated-bench`; `packages/curated/curated-bench/tests/bench.spec.ts` passed 96 tests.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本轮运行的是资产与 bundle 测试，不执行 A/B 或故障 workload。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

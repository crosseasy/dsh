# @deepseek-ai/dsh-tool-fs-search 使用指南

## Summary

`@deepseek-ai/dsh-tool-fs-search` 向模型暴露 `glob` 和 `grep` 发现工具，并通过打包的 ripgrep 执行搜索。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要模型按 glob 或 grep 搜索工作区。
- 需要使用打包 ripgrep 而不是宿主 `rg`。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 模型可见入口是 `glob`、`grep`；完整 schema 由生成的工具目录维护。

## 实际使用

- 让模型调用 `glob` 或 `grep`。
- 提供工作区内的 pattern 和可选路径。
- 观察返回匹配列表或截断后的 spill 提示。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：`Filesystem batch passed; rg-backed search and presentation behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/tool-fs-search.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/fs/tool-fs-search/src/index.ts](../../../../packages/fs/tool-fs-search/src/index.ts)。
- inventory 验证入口：`packages/fs/tool-fs-search/src/index.ts:128; mounted by packages/bundle/base/cordis.patch.yml:270, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:61, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:188 ...`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Focused unit tests, tool catalog, profile dump`。
- Task 3 证据条目：`packages/fs/tool-fs-search/tests/tools.spec.ts; integration.spec.ts; presentation.spec.ts; docs/tool-catalog.md; dump output includes @deepseek-ai/dsh-tool-fs-search`。
- Task 3 结果：`Filesystem batch passed; rg-backed search and presentation behavior covered.`。

## 限制与故障排查

- 本轮限制：`rg sidecar-specific test was not run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

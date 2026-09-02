# @deepseek-ai/dsh-tool-lsp 使用指南

## Summary

`@deepseek-ai/dsh-tool-lsp` 向模型暴露单个 `lsp` 工具，执行定义、引用、实现和 hover 查询。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要模型查询定义、引用、实现或 hover。
- 需要在没有 provider 时得到结构化不可用结果。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 模型可见入口是 `lsp`；完整 schema 由生成的工具目录维护。

## 实际使用

- 加载 LSP provider。
- 调用 `lsp`，传入文件、位置和操作。
- 观察 location、hover 或 `LSP_UNAVAILABLE` 结果。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：`LSP batch passed; `LSP_UNAVAILABLE`/provider-backed tool behavior and render path covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/tool-lsp.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/lsp/tool-lsp/src/index.ts](../../../../packages/lsp/tool-lsp/src/index.ts)。
- inventory 验证入口：`packages/lsp/tool-lsp/src/index.ts:97; docs/tool-catalog.md`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Focused unit tests and tool catalog`。
- Task 3 证据条目：`packages/lsp/tool-lsp/tests/tool-lsp.spec.ts; integration.spec.ts; load-path.spec.ts; render.spec.ts; docs/tool-catalog.md`。
- Task 3 结果：`LSP batch passed; `LSP_UNAVAILABLE`/provider-backed tool behavior and render path covered.`。

## 限制与故障排查

- 本轮限制：`No real language server e2e run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

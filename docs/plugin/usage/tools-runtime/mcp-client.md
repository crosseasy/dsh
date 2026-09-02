# @deepseek-ai/dsh-mcp-client 使用指南

## Summary

`@deepseek-ai/dsh-mcp-client` 连接 MCP server，并把远端工具注册到 `ctx.tools`。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要接入外部 MCP server 的工具。
- 需要把 MCP 工具注册进 DSH 工具 registry。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 在配置中声明 MCP server。
- 启动 profile 后等待插件连接并注册远端工具。
- 在工具 catalog 或模型可见工具列表中观察 MCP 工具。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Code-runtime/MCP batch passed; tool registration/application/reconnect paths covered with fixtures.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/mcp-client.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/mcp/mcp-client/src/index.ts](../../../../packages/mcp/mcp-client/src/index.ts)。
- inventory 验证入口：`packages/mcp/mcp-client/src/index.ts:146; docs/config-catalog.md`。
- Task 3 验证方法：`Fixture-based unit tests`。
- Task 3 证据条目：`packages/mcp/mcp-client/tests/mcp-client.spec.ts; apply.spec.ts; load-path.spec.ts; reconnect.spec.ts`。
- Task 3 结果：`Code-runtime/MCP batch passed; tool registration/application/reconnect paths covered with fixtures.`。

## 限制与故障排查

- 本轮限制：`Degraded: no real MCP server was used.`。
- 真实 MCP 路径需要可启动的 MCP server；无 server 时只能验证 fixture-based 注册和重连行为。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

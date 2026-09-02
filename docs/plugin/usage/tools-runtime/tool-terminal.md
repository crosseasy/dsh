# @deepseek-ai/dsh-tool-terminal 使用指南

## Summary

`@deepseek-ai/dsh-tool-terminal` 向模型暴露六个持久 PTY 工具。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要模型打开、读取、发送、发信号或关闭持久 terminal。
- 需要把 terminal send 放到 background job 中。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 模型可见入口是 `terminal_open`、`terminal_send`、`terminal_read`、`terminal_signal`、`terminal_list`、`terminal_close`；完整 schema 由生成的工具目录维护。

## 实际使用

- 调用 `terminal_open` 创建 PTY。
- 用 `terminal_send` 输入命令，并用 `terminal_read` 读取输出。
- 用 `terminal_signal` 或 `terminal_close` 控制生命周期。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：`Terminal clean subset passed; six terminal tools, loader, and rendering paths covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/tool-terminal.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/terminal/tool-terminal/src/index.ts](../../../../packages/terminal/tool-terminal/src/index.ts)。
- inventory 验证入口：`packages/terminal/tool-terminal/src/index.ts:146; docs/tool-catalog.md`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Focused unit tests and tool catalog`。
- Task 3 证据条目：`packages/terminal/tool-terminal/tests/tools.spec.ts; loader-composition.spec.ts; render.spec.ts; docs/tool-catalog.md`。
- Task 3 结果：`Terminal clean subset passed; six terminal tools, loader, and rendering paths covered.`。

## 限制与故障排查

- 本轮限制：`Underlying terminal-bash has one failing cancellation branch.`。
- 该路径依赖 `terminal-bash` 时，需要同时关注其 provider-write-after-timeout cancellation 缺口。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

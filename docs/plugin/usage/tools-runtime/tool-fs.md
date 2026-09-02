# @deepseek-ai/dsh-tool-fs 使用指南

## Summary

`@deepseek-ai/dsh-tool-fs` 向模型暴露 `read`、`write`、`edit` 和 `read_image` 文件工具。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要模型读取、写入、编辑文件或读取图片。
- 需要文件操作写入 session event log。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 模型可见入口是 `read`、`read_image`、`write`、`edit`；完整 schema 由生成的工具目录维护。

## 实际使用

- 让模型调用 `read`、`write`、`edit` 或 `read_image`。
- mutation 前先读取目标文件以满足观察策略。
- 观察 `tool/result` 与 `fs/*` session 事件。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：`Filesystem batch passed; read/write/error behavior covered and tool schema is fresh.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/tool-fs.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/fs/tool-fs/src/index.ts](../../../../packages/fs/tool-fs/src/index.ts)。
- inventory 验证入口：`packages/fs/tool-fs/src/index.ts:54; mounted by packages/bundle/base/cordis.patch.yml:267, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:58, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:185 ...`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Focused unit tests, tool catalog, profile dump`。
- Task 3 证据条目：`packages/fs/tool-fs/tests/tools.spec.ts; integration.spec.ts; error.spec.ts; docs/tool-catalog.md; dump output includes @deepseek-ai/dsh-tool-fs`。
- Task 3 结果：`Filesystem batch passed; read/write/error behavior covered and tool schema is fresh.`。

## 限制与故障排查

- 本轮限制：`No live model call.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

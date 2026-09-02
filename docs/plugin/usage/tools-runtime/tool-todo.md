# @deepseek-ai/dsh-tool-todo 使用指南

## Summary

`@deepseek-ai/dsh-tool-todo` 向模型暴露 `todo_write`，把待办状态记录进当前 agent 会话。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要模型维护当前任务清单。
- 需要 UI 根据最新 `todo/write` 事件展示 checklist。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 模型可见入口是 `todo_write`；完整 schema 由生成的工具目录维护。

## 实际使用

- 让模型调用 `todo_write` 提交当前任务列表。
- 每项使用 pending、in_progress 或 completed 状态。
- 观察最新 `todo/write` 事件被 UI 渲染为 checklist。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：``verify-tool-catalog` passed, confirming current schema and source link for `todo_write`.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/tool-todo.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/todo/tool-todo/src/index.ts](../../../../packages/todo/tool-todo/src/index.ts)。
- inventory 验证入口：`packages/todo/tool-todo/src/index.ts:128; mounted by packages/bundle/base/cordis.patch.yml:412, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:235, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:369 ...`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Static/generated catalog plus available test entries`。
- Task 3 证据条目：`packages/todo/tool-todo/tests/tool-todo.spec.ts; integration.spec.ts; projection.spec.ts; invariant.spec.ts; loader-composition.spec.ts; docs/tool-catalog.md`。
- Task 3 结果：``verify-tool-catalog` passed, confirming current schema and source link for `todo_write`.`。

## 限制与故障排查

- 本轮限制：`Degraded: focused todo test files were not run before convergence.`。
- 本轮只用工具目录和源码入口确认 `todo_write` schema；未运行 focused todo 测试。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

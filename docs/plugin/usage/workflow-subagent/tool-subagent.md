# @deepseek-ai/dsh-tool-subagent 使用指南

## Summary

`@deepseek-ai/dsh-tool-subagent` 向模型暴露 `subagent` 和 `list_subagent_models` 委派工具。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `workflow-subagent`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要模型把独立任务委派给子 agent。
- 需要列出可用 subagent model。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 模型可见入口是 `subagent`、`list_subagent_models`；完整 schema 由生成的工具目录维护。

## 实际使用

- 让模型调用 `subagent` 或 `list_subagent_models`。
- 为子 agent 提供完整独立 prompt。
- 观察同步返回结果或 background job id。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：`Subagent tools batch passed; delegation schema, list-models, model-selection settings, and scripted provider behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `workflow-subagent`，文档目标是 `docs/plugin/usage/workflow-subagent/tool-subagent.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/subagent/tool-subagent/src/index.ts](../../../../packages/subagent/tool-subagent/src/index.ts)。
- inventory 验证入口：`packages/subagent/tool-subagent/src/index.ts:307; mounted by packages/bundle/base/cordis.patch.yml:356, packages/bundle/base/cordis.patch.yml:369, packages/bundle/web-app/cordis.patch.yml:47 ...`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Focused unit tests, model-selection tests, tool catalog, profile dump`。
- Task 3 证据条目：`packages/subagent/tool-subagent/tests/tool-subagent.spec.ts; model-selection.spec.ts; model-selection-settings.spec.ts; list-models.spec.ts; scripted-provider.spec.ts; docs/tool-catalog.md; dump output includes two @deepseek-ai/dsh-tool-subagent rows`。
- Task 3 结果：`Subagent tools batch passed; delegation schema, list-models, model-selection settings, and scripted provider behavior covered.`。

## 限制与故障排查

- 本轮限制：`No real model-backed child session.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

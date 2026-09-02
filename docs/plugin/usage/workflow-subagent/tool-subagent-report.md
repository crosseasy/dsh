# @deepseek-ai/dsh-tool-subagent-report 使用指南

## Summary

`@deepseek-ai/dsh-tool-subagent-report` 在可继续的子 agent 内暴露 `report` 工具，把结果送回父会话。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `workflow-subagent`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要子 agent 主动向父会话报告结果。
- 需要在 child 内暴露局部 `report` 工具。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 模型可见入口是 `report`；完整 schema 由生成的工具目录维护。

## 实际使用

- 在可继续的 in-process child agent 中调用 `report`。
- 传入给父会话的结果文本。
- 父会话收到 user-role report message。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：`Subagent tools batch passed; child report delivery behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `workflow-subagent`，文档目标是 `docs/plugin/usage/workflow-subagent/tool-subagent-report.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/subagent/tool-subagent-report/src/index.ts](../../../../packages/subagent/tool-subagent-report/src/index.ts)。
- inventory 验证入口：`packages/subagent/tool-subagent-report/src/index.ts:134; mounted by packages/bundle/base/cordis.patch.yml:377`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Focused unit tests, tool catalog, profile dump`。
- Task 3 证据条目：`packages/subagent/tool-subagent-report/tests/tool-subagent-report.spec.ts; docs/tool-catalog.md; dump output includes @deepseek-ai/dsh-tool-subagent-report`。
- Task 3 结果：`Subagent tools batch passed; child report delivery behavior covered.`。

## 限制与故障排查

- 本轮限制：`No live parent/child model transcript.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

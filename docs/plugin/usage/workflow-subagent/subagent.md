# @deepseek-ai/dsh-subagent 使用指南

## Summary

`@deepseek-ai/dsh-subagent` 提供 `ctx.subagents` registry，用于把任务委派给子 agent。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `workflow-subagent`，类型为Cordis 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要给上层工具提供 subagent registry。
- 需要管理 child session、continuation 和执行结算。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载基础 profile。
- 让 `tool-subagent` 发起一个独立任务。
- 观察 child session、continuation 或结算结果。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Subagent core/provider batch passed; profile dump confirms registry plugin composition.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `workflow-subagent`，文档目标是 `docs/plugin/usage/workflow-subagent/subagent.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/subagent/subagent/src/index.ts](../../../../packages/subagent/subagent/src/index.ts)。
- inventory 验证入口：`packages/subagent/subagent/src/index.ts:651; mounted by packages/bundle/base/cordis.patch.yml:335`。
- Task 3 验证方法：`Focused unit tests and profile dump`。
- Task 3 证据条目：`packages/subagent/subagent/tests/service.spec.ts; control.spec.ts; child-agent.spec.ts; run-settlement.spec.ts; continuation.spec.ts; continuation-inheritance.spec.ts; list-children.spec.ts; assistant-output.spec.ts; timing-projection.spec.ts; invariant.spec.ts; dump output includes @deepseek-ai/dsh-subagent`。
- Task 3 结果：`Subagent core/provider batch passed; profile dump confirms registry plugin composition.`。

## 限制与故障排查

- 本轮限制：`No real external model call.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

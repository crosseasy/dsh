# @deepseek-ai/dsh-subagent-acp 使用指南

## Summary

`@deepseek-ai/dsh-subagent-acp` 通过 ACP 子进程驱动外部 subagent。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `workflow-subagent`，类型为Cordis 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要把外部 ACP server 作为 subagent backend。
- 需要跨进程驱动子 agent。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 配置字段以生成的配置目录为准；缺少必需字段时应在加载或首次调用路径显式失败。

## 实际使用

- 配置 ACP server 命令。
- 加载 ACP provider。
- 通过 subagent 工具把任务发送到外部 agent。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Config catalog verifies loadable config and required services.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `workflow-subagent`，文档目标是 `docs/plugin/usage/workflow-subagent/subagent-acp.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/subagent/subagent-acp/src/index.ts](../../../../packages/subagent/subagent-acp/src/index.ts)。
- inventory 验证入口：`packages/subagent/subagent-acp/src/index.ts:128; docs/config-catalog.md`。
- 配置 schema：见生成的 [配置目录](../../../config-catalog.md)。
- Task 3 验证方法：`Static/source validation and available tests`。
- Task 3 证据条目：`packages/subagent/subagent-acp/tests/subagent-acp.spec.ts; loader-composition.e2e.ts; subagent-acp.e2e.ts; docs/config-catalog.md`。
- Task 3 结果：`Config catalog verifies loadable config and required services.`。

## 限制与故障排查

- 本轮限制：`Degraded: focused ACP tests were not run before convergence; no real ACP server.`。
- 真实委派需要外部 ACP server；本轮只确认配置目录和源码入口。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

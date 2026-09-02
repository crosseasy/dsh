# @deepseek-ai/dsh-subagent-dsh-sdk 使用指南

## Summary

`@deepseek-ai/dsh-subagent-dsh-sdk` 通过 TypeScript SDK 的 stdio JSON-RPC 子进程驱动 DSH runtime。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `workflow-subagent`，类型为Cordis 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要把另一个 DSH runtime 作为 subagent backend。
- 需要通过 stdio JSON-RPC 连接子进程。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 配置字段以生成的配置目录为准；缺少必需字段时应在加载或首次调用路径显式失败。

## 实际使用

- 配置子 DSH runtime 启动命令。
- 加载 SDK provider。
- 通过 subagent 工具发送任务，并观察 stdio JSON-RPC 通信结果。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Config catalog verifies loadable config and required services.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `workflow-subagent`，文档目标是 `docs/plugin/usage/workflow-subagent/subagent-dsh-sdk.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/subagent/subagent-dsh-sdk/src/index.ts](../../../../packages/subagent/subagent-dsh-sdk/src/index.ts)。
- inventory 验证入口：`packages/subagent/subagent-dsh-sdk/src/index.ts:178; docs/config-catalog.md`。
- 配置 schema：见生成的 [配置目录](../../../config-catalog.md)。
- Task 3 验证方法：`Static/source validation and available tests`。
- Task 3 证据条目：`packages/subagent/subagent-dsh-sdk/tests/subagent-dsh-sdk.spec.ts; loader-composition.e2e.ts; docs/config-catalog.md`。
- Task 3 结果：`Config catalog verifies loadable config and required services.`。

## 限制与故障排查

- 本轮限制：`Degraded: focused DSH SDK subagent tests were not run before convergence; no live model route.`。
- 真实委派需要可启动的子 DSH runtime 和可用模型路由；本轮没有执行 live model route。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

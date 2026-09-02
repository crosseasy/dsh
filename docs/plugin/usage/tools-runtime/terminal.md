# @deepseek-ai/dsh-terminal 使用指南

## Summary

`@deepseek-ai/dsh-terminal` 提供持久 PTY session registry，供终端工具打开、发送、读取、发信号和关闭会话。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要持久 PTY session，而不是每次调用新进程。
- 需要按 owner 隔离终端句柄。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 配置字段以生成的配置目录为准；缺少必需字段时应在加载或首次调用路径显式失败。

## 实际使用

- 加载 terminal service 和一个 PTY backend。
- 调用 terminal 工具打开、发送、读取或关闭 session。
- 观察 owner-scoped terminal id 和工具结果。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Terminal clean subset passed; terminal registry/service behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/terminal.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/terminal/terminal/src/index.ts](../../../../packages/terminal/terminal/src/index.ts)。
- inventory 验证入口：`packages/terminal/terminal/src/index.ts:476; mounted by packages/bundle/sdk-minimal/cordis.patch.yml:51, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:120, packages/preset/agent-presets/presets/minimal/agent.cordis.yml:28`。
- 配置 schema：见生成的 [配置目录](../../../config-catalog.md)。
- Task 3 验证方法：`Focused unit tests and profile source`。
- Task 3 证据条目：`packages/terminal/terminal/tests/service.spec.ts; docs/config-catalog.md`。
- Task 3 结果：`Terminal clean subset passed; terminal registry/service behavior covered.`。

## 限制与故障排查

- 本轮限制：`Broad terminal-bash session file has one separate failing cancellation case.`。
- 该路径依赖 `terminal-bash` 时，需要同时关注其 provider-write-after-timeout cancellation 缺口。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

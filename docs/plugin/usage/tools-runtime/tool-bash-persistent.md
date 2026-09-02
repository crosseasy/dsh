# @deepseek-ai/dsh-tool-bash-persistent 使用指南

## Summary

`@deepseek-ai/dsh-tool-bash-persistent` 向模型暴露 owner-scoped 的持久 Bash 工具。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要模型复用同一个 Bash shell 状态。
- 需要跨命令保留 cwd、环境变量或交互上下文。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 模型可见入口是 `bash`；完整 schema 由生成的工具目录维护。

## 实际使用

- 让模型调用持久 `bash`。
- 在一次调用中建立状态，再在下一次调用中复用该状态。
- 用工具结果确认同一 owner 的 PTY session 保留状态。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：`Shell/guard and terminal clean subset passed; persistent shell tool/loader behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/tool-bash-persistent.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/shell/tool-bash-persistent/src/index.ts](../../../../packages/shell/tool-bash-persistent/src/index.ts)。
- inventory 验证入口：`packages/shell/tool-bash-persistent/src/index.ts:138; mounted by packages/bundle/sdk-minimal/cordis.patch.yml:131, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:128, packages/preset/agent-presets/presets/minimal/agent.cordis.yml:37`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Focused unit tests and loader tests`。
- Task 3 证据条目：`packages/shell/tool-bash-persistent/tests/tools.spec.ts; loader-composition.spec.ts; profile presets reference persistent bash`。
- Task 3 结果：`Shell/guard and terminal clean subset passed; persistent shell tool/loader behavior covered.`。

## 限制与故障排查

- 本轮限制：`No manual PTY session through CLI.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

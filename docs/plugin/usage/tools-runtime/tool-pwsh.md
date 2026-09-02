# @deepseek-ai/dsh-tool-pwsh 使用指南

## Summary

`@deepseek-ai/dsh-tool-pwsh` 向模型暴露一次性 `pwsh` 工具。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要模型执行一次性 PowerShell 命令。
- 需要 Windows 组合中使用 PowerShell 方言。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 模型可见入口是 `pwsh`；完整 schema 由生成的工具目录维护。

## 实际使用

- 让模型调用 `pwsh`。
- 使用 PowerShell 语法和 `$env:NAME` 读取环境。
- 观察 stdout/stderr 和退出码。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：`Shell/guard batch passed; pwsh tool and loader behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/tool-pwsh.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/shell/tool-pwsh/src/index.ts](../../../../packages/shell/tool-pwsh/src/index.ts)。
- inventory 验证入口：`packages/shell/tool-pwsh/src/index.ts:145; mounted by packages/bundle/base/cordis.patch.yml:257, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:50, packages/preset/agent-presets/presets/ptc/agent.cordis.yml:56 ...`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Focused unit tests, tool catalog, profile dump`。
- Task 3 证据条目：`packages/shell/tool-pwsh/tests/tools.spec.ts; integration.spec.ts; loader.spec.ts; docs/tool-catalog.md; dump output includes @deepseek-ai/dsh-tool-pwsh`。
- Task 3 结果：`Shell/guard batch passed; pwsh tool and loader behavior covered.`。

## 限制与故障排查

- 本轮限制：`No Windows host execution.`。
- macOS 本轮不能覆盖 Windows PowerShell 主机差异；Windows 专属行为需在 Windows 环境复测。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

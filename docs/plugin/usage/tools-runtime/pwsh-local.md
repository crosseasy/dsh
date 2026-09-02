# @deepseek-ai/dsh-pwsh-local 使用指南

## Summary

`@deepseek-ai/dsh-pwsh-local` 把 PowerShell 命令交给本机 `pwsh` 进程执行。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要在 Windows/PowerShell 语境执行一次性命令。
- 需要让 `tool-pwsh` 使用本机 `pwsh`。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 配置字段以生成的配置目录为准；缺少必需字段时应在加载或首次调用路径显式失败。

## 实际使用

- 加载 PowerShell provider。
- 让 `pwsh` 工具执行一次 PowerShell 命令。
- 观察 stdout/stderr 和退出码。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Shell/guard batch passed; pwsh executor/settings behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/pwsh-local.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/shell/pwsh-local/src/index.ts](../../../../packages/shell/pwsh-local/src/index.ts)。
- inventory 验证入口：`packages/shell/pwsh-local/src/index.ts:155; docs/config-catalog.md`。
- 配置 schema：见生成的 [配置目录](../../../config-catalog.md)。
- Task 3 验证方法：`Focused unit tests`。
- Task 3 证据条目：`packages/shell/pwsh-local/tests/executor.spec.ts; settings.spec.ts; docs/config-catalog.md`。
- Task 3 结果：`Shell/guard batch passed; pwsh executor/settings behavior covered.`。

## 限制与故障排查

- 本轮限制：`No real Windows host run.`。
- macOS 本轮不能覆盖 Windows PowerShell 主机差异；Windows 专属行为需在 Windows 环境复测。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

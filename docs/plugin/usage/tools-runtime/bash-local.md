# @deepseek-ai/dsh-bash-local 使用指南

## Summary

`@deepseek-ai/dsh-bash-local` 把 bash 命令交给本机子进程执行，是 `bash` 工具的本地执行提供方。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要在本机执行短生命周期 bash 命令。
- 需要让 `tool-bash` 使用本机 subprocess provider。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 配置字段以生成的配置目录为准；缺少必需字段时应在加载或首次调用路径显式失败。

## 实际使用

- 加载一个使用本地 shell provider 的 profile。
- 让 `@deepseek-ai/dsh-tool-bash` 发起一次前台 `bash` 命令。
- 命令由本机 subprocess 执行，结果回到 `tool/result`。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Shell/guard test batch passed; executor/settings behavior is observable through tests.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/bash-local.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/shell/bash-local/src/index.ts](../../../../packages/shell/bash-local/src/index.ts)。
- inventory 验证入口：`packages/shell/bash-local/src/index.ts:121; docs/config-catalog.md`。
- 配置 schema：见生成的 [配置目录](../../../config-catalog.md)。
- Task 3 验证方法：`Focused unit tests and config catalog`。
- Task 3 证据条目：`packages/shell/bash-local/tests/executor.spec.ts; packages/shell/bash-local/tests/settings.spec.ts; docs/config-catalog.md`。
- Task 3 结果：`Shell/guard test batch passed; executor/settings behavior is observable through tests.`。

## 限制与故障排查

- 本轮限制：`No live agent shell tool call was run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

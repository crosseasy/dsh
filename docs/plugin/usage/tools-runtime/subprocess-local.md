# @deepseek-ai/dsh-subprocess-local 使用指南

## Summary

`@deepseek-ai/dsh-subprocess-local` 在本机执行 subprocess 操作，并提供进程退出、终端桥接和进程检查能力。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要在本机启动和管理 subprocess。
- 需要为 shell、rg 搜索或 terminal backend 提供进程能力。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载本地 subprocess provider。
- 通过 shell、grep 或 terminal backend 发起进程。
- 观察进程退出、stdout/stderr 或 terminal 事件。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Subprocess/sandbox batch passed; dump confirms local subprocess provider composition.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/subprocess-local.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/subprocess/subprocess-local/src/index.ts](../../../../packages/subprocess/subprocess-local/src/index.ts)。
- inventory 验证入口：`packages/subprocess/subprocess-local/src/index.ts:195; mounted by packages/bundle/base/cordis.patch.yml:206, packages/bundle/sdk-minimal/cordis.patch.yml:48`。
- Task 3 验证方法：`Focused unit tests and profile dump`。
- Task 3 证据条目：`packages/subprocess/subprocess-local/tests/local.spec.ts; spawn.spec.ts; terminal.spec.ts; process-exit.spec.ts; process-inspector.spec.ts; headless/web dump output includes @deepseek-ai/dsh-subprocess-local`。
- Task 3 结果：`Subprocess/sandbox batch passed; dump confirms local subprocess provider composition.`。

## 限制与故障排查

- 本轮限制：`Windows-specific inspector tests were not run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

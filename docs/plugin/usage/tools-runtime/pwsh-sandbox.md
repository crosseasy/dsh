# @deepseek-ai/dsh-pwsh-sandbox 使用指南

## Summary

`@deepseek-ai/dsh-pwsh-sandbox` 把 PowerShell 命令交给沙箱包装后的执行器。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要让 PowerShell 命令经过 sandbox provider。
- 需要在 Windows 权限语境观察 sandbox 结果。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 配置字段以生成的配置目录为准；缺少必需字段时应在加载或首次调用路径显式失败。

## 实际使用

- 加载 sandbox policy、sandbox backend 和 PowerShell sandbox provider。
- 通过 `pwsh` 工具执行需要文件访问的命令。
- 观察允许结果或 sandbox denial。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Static evidence shows loadable sandbox provider and config catalog entry.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/pwsh-sandbox.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/shell/pwsh-sandbox/src/index.ts](../../../../packages/shell/pwsh-sandbox/src/index.ts)。
- inventory 验证入口：`packages/shell/pwsh-sandbox/src/index.ts:126; mounted by packages/bundle/base/cordis.patch.yml:227`。
- 配置 schema：见生成的 [配置目录](../../../config-catalog.md)。
- Task 3 验证方法：`Static/source and available test entry only`。
- Task 3 证据条目：`packages/shell/pwsh-sandbox/tests/sandbox.spec.ts; mounted by packages/bundle/base/cordis.patch.yml:227; docs/config-catalog.md`。
- Task 3 结果：`Static evidence shows loadable sandbox provider and config catalog entry.`。

## 限制与故障排查

- 本轮限制：`Degraded: its focused tests were not run before convergence; Windows ACL e2e was not run.`。
- macOS 本轮不能覆盖 Windows PowerShell 主机差异；Windows 专属行为需在 Windows 环境复测。
- 本轮只做静态/source/test-entry 确认；未运行 focused `pwsh-sandbox` 测试。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

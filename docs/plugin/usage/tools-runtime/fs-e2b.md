# @deepseek-ai/dsh-fs-e2b 使用指南

## Summary

`@deepseek-ai/dsh-fs-e2b` 把文件系统操作转到 E2B sandbox 内执行。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要把文件读写映射到 E2B sandbox。
- 需要在远端环境中验证文件效果。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 配置字段以生成的配置目录为准；缺少必需字段时应在加载或首次调用路径显式失败。

## 实际使用

- 加载 E2B sandbox 和 `fs-e2b` provider。
- 通过文件工具或 provider 调用读取远端 sandbox 文件。
- 在工具结果中观察远端文件内容或错误。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`E2B batch passed; filesystem adapter behavior is covered against test doubles.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/fs-e2b.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/e2b/fs-e2b/src/index.ts](../../../../packages/e2b/fs-e2b/src/index.ts)。
- inventory 验证入口：`packages/e2b/fs-e2b/src/index.ts:561; docs/config-catalog.md`。
- 配置 schema：见生成的 [配置目录](../../../config-catalog.md)。
- Task 3 验证方法：`Mock/local unit tests`。
- Task 3 证据条目：`packages/e2b/fs-e2b/tests/filesystem.spec.ts; docs/config-catalog.md`。
- Task 3 结果：`E2B batch passed; filesystem adapter behavior is covered against test doubles.`。

## 限制与故障排查

- 本轮限制：`Degraded: no real E2B filesystem session.`。
- 真实 E2B 路径需要外部凭据和可用远端 sandbox；无凭据时只能验证 mock、本地适配器和配置入口。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

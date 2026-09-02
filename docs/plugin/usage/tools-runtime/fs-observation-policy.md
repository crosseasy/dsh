# @deepseek-ai/dsh-fs-observation-policy 使用指南

## Summary

`@deepseek-ai/dsh-fs-observation-policy` 为文件读取、写入和编辑添加已观察状态与版本保护策略。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要强制读后写或读后改的可观察路径。
- 需要让文件变更留下 `fs/*` 事件证据。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载基础 profile。
- 先读取目标文件，再通过文件工具写入或编辑。
- 插件在 `fs/*` 事件路径检查 observed state 和版本。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Filesystem batch passed; observation decisions covered by tests.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/fs-observation-policy.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/fs/fs-observation-policy/src/index.ts](../../../../packages/fs/fs-observation-policy/src/index.ts)。
- inventory 验证入口：`packages/fs/fs-observation-policy/src/index.ts:106; mounted by packages/bundle/base/cordis.patch.yml:264`。
- Task 3 验证方法：`Focused unit tests and profile source`。
- Task 3 证据条目：`packages/fs/fs-observation-policy/tests/policy.spec.ts; mounted by packages/bundle/base/cordis.patch.yml:264`。
- Task 3 结果：`Filesystem batch passed; observation decisions covered by tests.`。

## 限制与故障排查

- 本轮限制：`No browser/UI rendering check.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

# @deepseek-ai/dsh-fs-sandbox 使用指南

## Summary

`@deepseek-ai/dsh-fs-sandbox` 按当前 sandbox 模式约束文件写入和编辑，并允许读路径经过底层文件系统提供方。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要根据当前 sandbox mode 允许或拒绝文件 mutation。
- 需要在 workspace-write 或 read-only 场景下保护宿主文件。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载 sandbox policy、sandbox backend 和 FS sandbox provider。
- 在 read-only 或 workspace-write 模式下触发文件写入或编辑。
- 允许路径完成操作；越界 mutation 返回拒绝结果。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Filesystem batch passed; dump confirms composed profile provider.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/fs-sandbox.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/fs/fs-sandbox/src/index.ts](../../../../packages/fs/fs-sandbox/src/index.ts)。
- inventory 验证入口：`packages/fs/fs-sandbox/src/index.ts:147; mounted by packages/bundle/base/cordis.patch.yml:494`。
- Task 3 验证方法：`Focused unit tests and profile dump`。
- Task 3 证据条目：`packages/fs/fs-sandbox/tests/fs-sandbox.spec.ts; packages/fs/fs-sandbox/tests/containment.spec.ts; headless/web dump output includes @deepseek-ai/dsh-fs-sandbox`。
- Task 3 结果：`Filesystem batch passed; dump confirms composed profile provider.`。

## 限制与故障排查

- 本轮限制：`Platform-specific sandbox kernel enforcement was not separately e2e-tested.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

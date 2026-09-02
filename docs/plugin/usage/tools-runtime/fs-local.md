# @deepseek-ai/dsh-fs-local 使用指南

## Summary

`@deepseek-ai/dsh-fs-local` 把 `ctx.fs` 文件系统操作映射到本机工作区。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要让文件工具访问本地工作区。
- 需要为上层工具提供 `ctx.fs` 本地实现。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载本地 FS provider。
- 通过 `read`、`write`、`edit` 或 `str_replace_editor` 访问工作区文件。
- 观察返回内容和对应 session 事件。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Filesystem batch passed; local read/write/list behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/fs-local.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/fs/fs-local/src/index.ts](../../../../packages/fs/fs-local/src/index.ts)。
- inventory 验证入口：`packages/fs/fs-local/src/index.ts:258; mounted by packages/bundle/sdk-minimal/cordis.patch.yml:69, packages/preset/agent-presets/presets/minimal/agent.cordis.yml:81`。
- Task 3 验证方法：`Focused unit tests`。
- Task 3 证据条目：`packages/fs/fs-local/tests/filesystem.spec.ts; packages/fs/fs-local/tests/fsio.spec.ts`。
- Task 3 结果：`Filesystem batch passed; local read/write/list behavior covered.`。

## 限制与故障排查

- 本轮限制：`No live model-facing FS call was run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

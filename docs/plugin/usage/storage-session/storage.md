# @deepseek-ai/dsh-storage

## Summary

提供 `ctx.storage` 后端注册表和数据形式挂载入口。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/storage/storage/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 组合中存在会话日志之外的持久数据。
- 多个后端或数据形式需要通过同一注册表协调。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/storage/storage/src/index.ts:98; mounted by packages/bundle/base/cordis.patch.yml:146`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-storage'
```

## 实际使用

- 与至少一个 backend 和数据形式一起挂载。
- 消费方通过 `ctx.storage` 解析后端或形式。
- 配置错误以稳定 `StorageError` code 报出。

## 可观察结果

- Storage registry registers backends and disposes contributions correctly; default profiles mount `id: storage`.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/storage/storage/src/index.ts:98; mounted by packages/bundle/base/cordis.patch.yml:146`。
- 本轮命令证据：C1/C2 mount; C4 `packages/storage/storage/tests/registry.spec.ts`。

## 限制与故障排查

- Backend-specific persistence is covered by `storage-json` and `storage-sqlite`.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

# @deepseek-ai/dsh-storage-sqlite

## Summary

把领域 KV 记录保存到 SQLite 数据库。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/storage/storage-sqlite/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 领域记录更新频繁，或部署偏好单个 SQLite 数据库。
- 需要按记录更新，而不是重写整个 JSON 单元。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/storage/storage-sqlite/src/index.ts:158; docs/config-catalog.md`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-storage-sqlite'
```

## 实际使用

- 配置 SQLite 数据库路径。
- 让领域数据形式写入记录。
- 通过 source tests 或数据库文件观察按行持久化。

## 可观察结果

- SQLite storage backend persists and queries storage state in source tests.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/storage/storage-sqlite/src/index.ts:158; docs/config-catalog.md`。
- 本轮命令证据：C4 `sqlite-backend.spec.ts`; C9 invariant spec。

## 限制与故障排查

- Not mounted in default profile dumps; Node SQLite is experimental and printed the expected warning in C4.
- 默认 profile 未挂载该后端；本轮通过源码测试覆盖，且 Node SQLite 输出实验性警告。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

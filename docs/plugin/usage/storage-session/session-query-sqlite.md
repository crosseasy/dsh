# @deepseek-ai/dsh-session-query-sqlite

## Summary

用 SQLite FTS5 索引会话历史，提供搜索、读取和追踪后端。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session-query/session-query-sqlite/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 用户或模型需要搜索历史会话。
- 部署接受使用 SQLite FTS5 维护派生索引。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session-query/session-query-sqlite/src/index.ts:1103; mounted by packages/bundle/base/cordis.patch.yml:130`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-query-sqlite'
```

## 实际使用

- 挂载会话查询服务和 SQLite 后端。
- 按 `openAt` 配置启动或首次搜索时打开索引。
- 通过查询服务或 `tool-session-query` 搜索、读取和追踪会话事件。

## 可观察结果

- SQLite query store indexes and queries session events. Node emitted the expected experimental SQLite warning while tests passed.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session-query/session-query-sqlite/src/index.ts:1103; mounted by packages/bundle/base/cordis.patch.yml:130`。
- 本轮命令证据：C1/C2 mount with `path: ':memory:'`, `openAt: never`; C4 `sqlite.spec.ts`, `query.spec.ts`。

## 限制与故障排查

- Default profile uses in-memory/open-on-demand config; durable external DB path was not exercised.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

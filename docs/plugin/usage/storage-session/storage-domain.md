# @deepseek-ai/dsh-storage-domain

## Summary

在已注册存储后端上提供 schema 校验的领域 KV 数据形式。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/storage/storage-domain/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 包需要按领域读写版本化 KV 记录。
- 写入需要 schema 校验和进程内变更事件。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/storage/storage-domain/src/index.ts:200; mounted by packages/bundle/base/cordis.patch.yml:154`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-storage-domain'
```

## 实际使用

- 先挂载 `storage` 和目标后端。
- 由消费方声明领域名称、版本和 schema。
- 使用 `ctx.storageDomain` 读写该领域的版本化记录。

## 可观察结果

- Storage domain selects the JSON backend in default profiles and passes domain/invariant tests.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/storage/storage-domain/src/index.ts:200; mounted by packages/bundle/base/cordis.patch.yml:154`。
- 本轮命令证据：C1/C2 mount; C4 `domain.spec.ts`; C9 invariant spec。

## 限制与故障排查

- Alternate backend deployments depend on profile config; SQLite backend tested separately.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

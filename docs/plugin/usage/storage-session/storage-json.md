# @deepseek-ai/dsh-storage-json

## Summary

把领域 KV 记录保存为本地 JSON 文件。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/storage/storage-json/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 需要可检查、可备份的本地 JSON 持久化。
- 写入量适合文件粒度的原子发布。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/storage/storage-json/src/index.ts:109; mounted by packages/bundle/base/cordis.patch.yml:149`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-storage-json'
```

## 实际使用

- 配置 `root` 和布局。
- 让领域数据形式写入记录。
- 在根目录下检查 `single` 或 `per-record` JSON 文件。

## 可观察结果

- JSON storage backend reads/writes local storage data under the configured root.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/storage/storage-json/src/index.ts:109; mounted by packages/bundle/base/cordis.patch.yml:149`。
- 本轮命令证据：C1/C2 mount; C4 `packages/storage/storage-json/tests/json-backend.spec.ts`。

## 限制与故障排查

- Only temp/local filesystem paths were exercised.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

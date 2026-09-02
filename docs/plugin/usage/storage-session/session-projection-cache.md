# @deepseek-ai/dsh-session-projection-cache

## Summary

把投影状态写入 `session_projcache` 存储域，加速冷会话列表和重放。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-projection-cache/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 冷会话列表需要快速显示投影值。
- 重放长日志时希望从可信 checkpoint 开始。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-projection-cache/src/index.ts:323; mounted by packages/bundle/base/cordis.patch.yml:163`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-projection-cache'
```

## 实际使用

- 挂载 `storage`、后端、`storage-domain` 与本包。
- 让会话创建、结束轮次或释放。
- 缓存把投影状态写入 storage domain，冷读取从 checkpoint 继续折叠。

## 可观察结果

- Projection cache writes and reads cached projection state using configured event/interval thresholds.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-projection-cache/src/index.ts:323; mounted by packages/bundle/base/cordis.patch.yml:163`。
- 本轮命令证据：C1/C2 mount; C4 `packages/session/session-projection-cache/tests/cache.spec.ts`。

## 限制与故障排查

- Only local temp-backed cache behavior was tested.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

# @deepseek-ai/dsh-goal

## Summary

在会话日志中维护同一会话的持久目标状态、阶段和修订。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/goal/goal/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 一个目标需要跨多轮保留、恢复和审计。
- 命令或模型工具需要共享同一份 goal 状态。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/goal/goal/src/index.ts:624; mounted by packages/bundle/base/cordis.patch.yml:299`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-goal'
```

## 实际使用

- 通过 `/goal` 命令或 `tool-goal` 创建目标。
- 在同一会话里编辑、暂停、恢复、完成或阻塞目标。
- 恢复会话后继续读取日志中的最新 goal 状态。

## 可观察结果

- Goal state changes, projections, invariants, and a production headless Loader smoke path persist a `goal/change` event without starting an extra round.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/goal/goal/src/index.ts:624; mounted by packages/bundle/base/cordis.patch.yml:299`。
- 本轮命令证据：C1/C2 mount; C7 goal/projection/invariant specs; C6 `goal.e2e.ts`。

## 限制与故障排查

- Real multi-round model execution was not run.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

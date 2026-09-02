# @deepseek-ai/dsh-session-checkpoint-policy

## Summary

在模型请求和顶层工具副作用前强制会话持久化检查点。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-checkpoint-policy/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 持久化部署需要在模型请求或工具副作用前先落盘。
- 崩溃恢复必须能区分已持久调用、缺失工具结果和完成步骤。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-checkpoint-policy/src/index.ts:63; mounted by packages/bundle/base/cordis.patch.yml:400`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-checkpoint-policy'
```

## 实际使用

- 与会话持久化后端一起挂载。
- 执行模型请求或顶层工具调用。
- 在危险动作开始前，策略先要求持久化检查点成功。

## 可观察结果

- Checkpoint policy persists complete requests before model dispatch and repairs missing tool results after a hard crash.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-checkpoint-policy/src/index.ts:63; mounted by packages/bundle/base/cordis.patch.yml:400`。
- 本轮命令证据：C1/C2 mount; C5 `session-checkpoint-policy.spec.ts`; C6 `crash-recovery.e2e.ts`。

## 限制与故障排查

- Crash recovery e2e is skipped on Windows by test declaration; this run was macOS.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

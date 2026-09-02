# @deepseek-ai/dsh-command-goal

## Summary

提供 `/goal` 命令，让用户直接管理同一会话内的持久目标。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/goal/command-goal/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 用户要直接创建、查看、暂停、恢复或清除长期目标。
- 交互式部署已经提供斜杠命令入口。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/goal/command-goal/src/index.ts:189; mounted by packages/bundle/base/cordis.patch.yml:305, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:83, packages/preset/agent-presets/presets/ptc/agent.cordis.yml:102 ...`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-command-goal'
```

## 实际使用

- 在交互式界面输入 `/goal` 查看当前目标。
- 用 `/goal` 的创建、编辑、暂停、恢复或清除子命令管理目标。
- 被接受的变更通过 `goal/change` 事件持久化。

## 可观察结果

- Goal command parser/handler behavior passes source tests; headless default profile mounts it enabled.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/goal/command-goal/src/index.ts:189; mounted by packages/bundle/base/cordis.patch.yml:305, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:83, packages/preset/agent-presets/presets/ptc/agent.cordis.yml:102 ...`。
- 本轮命令证据：C1 enabled; C2 disabled in web; C7 `command-goal.spec.ts`。

## 限制与故障排查

- Web profile disables it, as shown in C2.
- Web profile 默认禁用该命令；本轮证据显示 headless 启用、web 禁用。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

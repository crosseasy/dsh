# @deepseek-ai/dsh-goal-round-driver

## Summary

当 active goal 允许续行且 agent 空闲时，自动启动下一轮 Goal Round。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/goal/goal-round-driver/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- active goal 需要在 agent 空闲后自动进入下一轮。
- 部署希望 Round 上限和阻塞记录留在 goal 事件中。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/goal/goal-round-driver/src/index.ts:76; mounted by packages/bundle/base/cordis.patch.yml:302`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-goal-round-driver'
```

## 实际使用

- 确保会话存在 active goal，且续行未暂停、Round 未耗尽。
- 等待 agent 空闲。
- 驱动器会启动下一轮由 goal-round prompt 驱动的模型轮次。

## 可观察结果

- Goal round admission/driver behavior passes source-owned tests.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/goal/goal-round-driver/src/index.ts:76; mounted by packages/bundle/base/cordis.patch.yml:302`。
- 本轮命令证据：C1/C2 mount; C7 `goal-round-driver.spec.ts`。

## 限制与故障排查

- No live model continuation was executed.
- 本轮没有执行真实多轮模型续行；证据来自源码测试。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

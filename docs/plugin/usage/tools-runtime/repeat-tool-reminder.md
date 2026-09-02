# @deepseek-ai/dsh-repeat-tool-reminder 使用指南

## Summary

`@deepseek-ai/dsh-repeat-tool-reminder` 在 agent 重复执行相同工具调用时提供提示，帮助用户从 transcript 中看见潜在的工具循环。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Cordis 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要发现模型连续重复同一工具调用。
- 需要在不修改具体工具插件的前提下提醒 agent 调整操作。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 在加载 `@deepseek-ai/dsh-repeat-tool-reminder` 的 profile 中正常让 agent 调用工具。
- 当相同工具调用连续重复时，插件通过 guard 路径向 agent 注入提醒。
- 用户观察 transcript 中的提醒，而不是调用一个独立工具。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Shell/guard test batch passed; reminder policy behavior is covered by tests and mounted in base.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/repeat-tool-reminder.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/guard/repeat-tool-reminder/src/index.ts](../../../../packages/guard/repeat-tool-reminder/src/index.ts)。
- inventory 验证入口：`packages/guard/repeat-tool-reminder/src/index.ts:162; mounted by packages/bundle/base/cordis.patch.yml:435`。
- Task 3 验证方法：`Focused unit tests and headless/base composition source`。
- Task 3 证据条目：`packages/guard/repeat-tool-reminder/tests/repeat-tool-reminder.spec.ts; inventory entry packages/guard/repeat-tool-reminder/src/index.ts:162; mounted by packages/bundle/base/cordis.patch.yml:435`。
- Task 3 结果：`Shell/guard test batch passed; reminder policy behavior is covered by tests and mounted in base.`。

## 限制与故障排查

- 本轮限制：`No live model transcript was created in this subtask.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

# @deepseek-ai/dsh-subagent-fork-in-process 使用指南

## Summary

`@deepseek-ai/dsh-subagent-fork-in-process` 在同进程 fork 一个继承父 session 前缀的子 agent。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `workflow-subagent`，类型为Cordis 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要在同进程继承父日志前缀来分叉子 agent。
- 需要低成本复用父上下文。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载 fork provider。
- 通过 `subagent_fork` 或对应配置创建子 agent。
- 观察子 agent 继承父 session 前缀后返回结果。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Subagent core/provider batch passed; fork provider behavior and composition covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `workflow-subagent`，文档目标是 `docs/plugin/usage/workflow-subagent/subagent-fork-in-process.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/subagent/subagent-fork-in-process/src/index.ts](../../../../packages/subagent/subagent-fork-in-process/src/index.ts)。
- inventory 验证入口：`packages/subagent/subagent-fork-in-process/src/index.ts:99; mounted by packages/bundle/base/cordis.patch.yml:343`。
- Task 3 验证方法：`Focused unit tests and profile dump`。
- Task 3 证据条目：`packages/subagent/subagent-fork-in-process/tests/subagent-fork-in-process.spec.ts; headless/web dump output includes @deepseek-ai/dsh-subagent-fork-in-process`。
- Task 3 结果：`Subagent core/provider batch passed; fork provider behavior and composition covered.`。

## 限制与故障排查

- 本轮限制：`Multi-subagent stress test was not run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

# @deepseek-ai/dsh-workflow-worker-thread 使用指南

## Summary

`@deepseek-ai/dsh-workflow-worker-thread` 在 worker thread 中执行模型编写的 orchestration script。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `workflow-subagent`，类型为Cordis 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要执行模型写出的 orchestration script。
- 需要把 workflow 运行移出宿主事件循环。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载 workflow engine。
- 通过 workflow 工具提交 JavaScript orchestration script。
- 观察 worker thread 运行脚本并桥接 subagent 调用。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Workflow batch passed; worker-thread workflow runtime/session/meta/realm behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `workflow-subagent`，文档目标是 `docs/plugin/usage/workflow-subagent/workflow-worker-thread.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/workflow/workflow-worker-thread/src/index.ts](../../../../packages/workflow/workflow-worker-thread/src/index.ts)。
- inventory 验证入口：`packages/workflow/workflow-worker-thread/src/index.ts:205; mounted by packages/bundle/base/cordis.patch.yml:380, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:216, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:350 ...`。
- Task 3 验证方法：`Focused unit/integration tests and profile dump`。
- Task 3 证据条目：`packages/workflow/workflow-worker-thread/tests/workflow-worker-thread.spec.ts; integration.spec.ts; session.spec.ts; meta.spec.ts; realm.spec.ts; headless/web dump output includes @deepseek-ai/dsh-workflow-worker-thread`。
- Task 3 结果：`Workflow batch passed; worker-thread workflow runtime/session/meta/realm behavior covered.`。

## 限制与故障排查

- 本轮限制：`Built-worker/e2e/source-worker compat tests were not run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

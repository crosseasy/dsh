# @deepseek-ai/dsh-tool-web 使用指南

## Summary

`@deepseek-ai/dsh-tool-web` 向模型暴露 `web_search` 和 `web_fetch` 工具。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `web`，类型为工具插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要模型调用 `web_search` 或 `web_fetch`。
- 需要把 provider 选择隐藏在 `ctx.web` 后面。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Web profile 可用 `pnpm dsh web --dump-default-config` 检查组合中是否包含该插件。
- 模型可见入口是 `web_fetch`、`web_search`；完整 schema 由生成的工具目录维护。

## 实际使用

- 让模型调用 `web_fetch` 或 `web_search`。
- 请求会进入 `ctx.web`，再由注册 provider 执行。
- 观察 `tool/call` 和 `tool/result`。

## 可观察结果

- 成功路径会产生 `tool/call` 和 `tool/result`；涉及持久状态的工具还会写入对应 session event。
- 本轮观察信号见验证证据中的 Task 3 结果：`Web batch passed; `web_fetch`/`web_search` schemas are fresh and tool behavior/load path covered.`。
- 本轮未为 `web` 指南单独新增截图；该页使用命令、源码和测试证据。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `web`，文档目标是 `docs/plugin/usage/web/tool-web.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/web/tool-web/src/index.ts](../../../../packages/web/tool-web/src/index.ts)。
- inventory 验证入口：`packages/web/tool-web/src/index.ts:83; mounted by packages/bundle/base/cordis.patch.yml:465, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:242, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:376 ...`。
- 工具 schema：见生成的 [工具目录](../../../tool-catalog.md)。
- Task 3 验证方法：`Focused unit/integration tests, tool catalog, profile dump`。
- Task 3 证据条目：`packages/web/tool-web/tests/tool-web.spec.ts; integration.spec.ts; spill.spec.ts; load-path.spec.ts; docs/tool-catalog.md; dump output includes @deepseek-ai/dsh-tool-web`。
- Task 3 结果：`Web batch passed; `web_fetch`/`web_search` schemas are fresh and tool behavior/load path covered.`。

## 限制与故障排查

- 本轮限制：`No live model-triggered web tool call.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

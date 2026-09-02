# @deepseek-ai/dsh-code-runtime-worker-thread 使用指南

## Summary

`@deepseek-ai/dsh-code-runtime-worker-thread` 在 worker thread 中执行模型生成的代码，用于隔离 `run_code`、workflow 和同类执行路径。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要把模型生成的代码放到 worker thread 中执行。
- 需要 workflow 或 PTC code runtime 不阻塞宿主事件循环。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载 headless 或 web profile。
- 通过依赖 `ctx.codeRuntime` 的 PTC 或 workflow 路径提交代码执行。
- 观察 worker 启动、执行输出和 JSON 结果。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Code-runtime/MCP batch passed; profile dump shows headless and web compositions include the worker-thread runtime.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/code-runtime-worker-thread.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/code-runtime/code-runtime-worker-thread/src/index.ts](../../../../packages/code-runtime/code-runtime-worker-thread/src/index.ts)。
- inventory 验证入口：`packages/code-runtime/code-runtime-worker-thread/src/index.ts:561; mounted by packages/bundle/headless/cordis.patch.yml:20, packages/bundle/web-app/cordis.patch.yml:50`。
- Task 3 验证方法：`Focused unit tests and profile dump`。
- Task 3 证据条目：`packages/code-runtime/code-runtime-worker-thread/tests/bootstrap.spec.ts; runtime.spec.ts; worker-json.spec.ts; output-json.spec.ts; source-worker.compat.spec.ts; headless/web dump output includes the plugin`。
- Task 3 结果：`Code-runtime/MCP batch passed; profile dump shows headless and web compositions include the worker-thread runtime.`。

## 限制与故障排查

- 本轮限制：`Built-lib e2e was not run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

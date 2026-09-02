# @deepseek-ai/dsh-bash-sandbox 使用指南

## Summary

`@deepseek-ai/dsh-bash-sandbox` 把 bash 命令交给沙箱包装后的执行器，使命令执行返回沙箱拒绝或执行结果。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要用 sandbox 约束 bash 命令的文件访问。
- 需要把沙箱拒绝作为工具结果反馈给模型。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载同时包含 sandbox policy、sandbox backend 和 bash sandbox provider 的 profile。
- 通过 `bash` 工具执行会读写文件的命令。
- 允许的访问返回正常 stdout/stderr；被策略拒绝的访问返回 sandbox denial。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Shell/guard test batch passed; profile dump shows the sandbox bash provider loaded.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/bash-sandbox.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/shell/bash-sandbox/src/index.ts](../../../../packages/shell/bash-sandbox/src/index.ts)。
- inventory 验证入口：`packages/shell/bash-sandbox/src/index.ts:117; mounted by packages/bundle/base/cordis.patch.yml:221, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:159`。
- Task 3 验证方法：`Focused unit tests and profile dump`。
- Task 3 证据条目：`packages/shell/bash-sandbox/tests/sandbox.spec.ts; headless/web dump output includes @deepseek-ai/dsh-bash-sandbox`。
- Task 3 结果：`Shell/guard test batch passed; profile dump shows the sandbox bash provider loaded.`。

## 限制与故障排查

- 本轮限制：`Platform e2e sandbox tests (`bwrap`, `seatbelt`, `landlock`) were not run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

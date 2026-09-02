# @deepseek-ai/dsh-sandbox-policy 使用指南

## Summary

`@deepseek-ai/dsh-sandbox-policy` 解析每次调用的 sandbox 模式、工作区根目录和部署默认值。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要统一每次工具调用的 sandbox mode。
- 需要把 session 与部署默认值合并成可执行策略。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 启动带 sandbox policy 的 profile。
- 执行一个可被 policy 解析的工具调用。
- 观察调用使用 session sandbox mode 和 workspace root。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Subprocess/sandbox batch passed; dump confirms policy composition.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/sandbox-policy.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/sandbox/sandbox-policy/src/index.ts](../../../../packages/sandbox/sandbox-policy/src/index.ts)。
- inventory 验证入口：`packages/sandbox/sandbox-policy/src/index.ts:182; mounted by packages/bundle/base/cordis.patch.yml:215, packages/bundle/sdk-minimal/cordis.patch.yml:42`。
- Task 3 验证方法：`Focused unit tests and profile dump`。
- Task 3 证据条目：`packages/sandbox/sandbox-policy/tests/policy.spec.ts; invariant.spec.ts; headless/web dump output includes @deepseek-ai/dsh-sandbox-policy`。
- Task 3 结果：`Subprocess/sandbox batch passed; dump confirms policy composition.`。

## 限制与故障排查

- 本轮限制：`No end-to-end denied file operation through a live agent.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

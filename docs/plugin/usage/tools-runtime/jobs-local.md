# @deepseek-ai/dsh-jobs-local 使用指南

## Summary

`@deepseek-ai/dsh-jobs-local` 提供进程内 background job 注册表，保存运行中的后台任务并暴露输出与停止能力。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要在本进程记录 background job。
- 需要让多个工具共享同一组 job 控制能力。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载基础 profile。
- 用支持 background 的工具启动后台任务。
- 随后通过 `job_list`、`job_output` 或 `job_kill` 观察和控制任务。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Jobs batch passed; profile dump confirms background job runtime composition.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/jobs-local.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/jobs/jobs-local/src/index.ts](../../../../packages/jobs/jobs-local/src/index.ts)。
- inventory 验证入口：`packages/jobs/jobs-local/src/index.ts:534; mounted by packages/bundle/base/cordis.patch.yml:82, packages/bundle/sdk-minimal/cordis.patch.yml:108`。
- Task 3 验证方法：`Focused unit tests and profile dump`。
- Task 3 证据条目：`packages/jobs/jobs-local/tests/jobs.spec.ts; loader-composition.spec.ts; headless/web dump output includes @deepseek-ai/dsh-jobs-local`。
- Task 3 结果：`Jobs batch passed; profile dump confirms background job runtime composition.`。

## 限制与故障排查

- 本轮限制：`No live long-running tool job was started.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

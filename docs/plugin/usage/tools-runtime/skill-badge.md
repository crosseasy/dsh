# @deepseek-ai/dsh-skill-badge 使用指南

## Summary

`@deepseek-ai/dsh-skill-badge` 向 skill registry 提供内置 DSH badge skill。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要提供仓库内置 DSH badge skill。
- 需要在 skill catalog 中展示固定内置技能。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 加载基础 profile。
- 通过 skill catalog 或 `skill` 工具列出内置 skill。
- 观察 DSH badge skill 由该 provider 提供。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Jobs/schedule/skill batch passed; badge behavior covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/skill-badge.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/skill/skill-badge/src/index.ts](../../../../packages/skill/skill-badge/src/index.ts)。
- inventory 验证入口：`packages/skill/skill-badge/src/index.ts:58; mounted by packages/bundle/base/cordis.patch.yml:286`。
- Task 3 验证方法：`Focused unit tests`。
- Task 3 证据条目：`packages/skill/skill-badge/tests/skill-badge.spec.ts; mounted by packages/bundle/base/cordis.patch.yml:286`。
- Task 3 结果：`Jobs/schedule/skill batch passed; badge behavior covered.`。

## 限制与故障排查

- 本轮限制：`No UI badge rendering check.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

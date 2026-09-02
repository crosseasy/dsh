# @deepseek-ai/dsh-web 使用指南

## Summary

`@deepseek-ai/dsh-web` 提供 `ctx.web` registry，统一搜索与抓取提供方。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `web`，类型为Cordis 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要统一搜索和抓取 provider 的选择。
- 需要让 `tool-web` 不关心具体后端。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Web profile 可用 `pnpm dsh web --dump-default-config` 检查组合中是否包含该插件。

## 实际使用

- 加载 web registry 和至少一个 provider。
- 让上层 `tool-web` 提交搜索或抓取请求。
- registry 按 provider 选择规则返回标准化结果。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Web batch passed; provider selection and service behavior covered.`。
- 本轮未为 `web` 指南单独新增截图；该页使用命令、源码和测试证据。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `web`，文档目标是 `docs/plugin/usage/web/web.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/web/web/src/index.ts](../../../../packages/web/web/src/index.ts)。
- inventory 验证入口：`packages/web/web/src/index.ts:202; mounted by packages/bundle/base/cordis.patch.yml:451`。
- Task 3 验证方法：`Focused unit tests and profile source`。
- Task 3 证据条目：`packages/web/web/tests/web.spec.ts; mounted by packages/bundle/base/cordis.patch.yml:451`。
- Task 3 结果：`Web batch passed; provider selection and service behavior covered.`。

## 限制与故障排查

- 本轮限制：`No live browser/CDP interaction in this subtask.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

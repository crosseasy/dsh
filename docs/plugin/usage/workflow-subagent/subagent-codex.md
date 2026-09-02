# @deepseek-ai/dsh-subagent-codex 使用指南

## Summary

`@deepseek-ai/dsh-subagent-codex` 提供 Codex 一次性 subagent bundle。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `workflow-subagent`，类型为组合包。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要把 Codex 作为一次性 subagent provider。
- 需要通过 bundle patch 安装一组 provider 配置。

## 启用与启动

- 这是组合包。把它安装到目标 profile layer 后再启动该 profile：`pnpm dsh plugin --profile <profile> add @deepseek-ai/dsh-subagent-codex`。
- 本轮只确认了 bundle manifest 和 `cordis.patch.yml` 存在；没有启动真实 Codex CLI。
- 如果安装后的 profile 无法加载，请先检查外部 CLI、模型凭据和 profile patch 是否同时可用。

## 实际使用

- 安装或加载该 bundle patch。
- 配置可用 Codex CLI 和模型凭据。
- 通过 subagent 工具选择 Codex provider 执行一次任务。

## 可观察结果

- 成功路径会让 bundle patch 声明的 provider 出现在目标 profile 的加载结果中。
- 本轮观察信号见验证证据中的 Task 3 结果：`Bundle patch exists and inventory includes it as a workflow-subagent bundle.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `workflow-subagent`，文档目标是 `docs/plugin/usage/workflow-subagent/subagent-codex.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/subagent/subagent-codex/cordis.patch.yml](../../../../packages/subagent/subagent-codex/cordis.patch.yml)。
- inventory 验证入口：`packages/subagent/subagent-codex/cordis.patch.yml (bundle manifest dsh.bundle.patch)`。
- Task 3 验证方法：`Static bundle/source validation and available tests`。
- Task 3 证据条目：`packages/subagent/subagent-codex/cordis.patch.yml; packages/subagent/subagent-codex/tests/loader-composition.e2e.ts; subagent-codex.spec.ts; inventory marks bundle manifest dsh.bundle.patch`。
- Task 3 结果：`Bundle patch exists and inventory includes it as a workflow-subagent bundle.`。

## 限制与故障排查

- 本轮限制：`Degraded: tests were not run before convergence; no real Codex CLI or model key was used.`。
- 真实委派需要 Codex CLI 或 app-server 协议入口可用；本轮没有执行真实 CLI。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

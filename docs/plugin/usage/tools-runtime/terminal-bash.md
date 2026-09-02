# @deepseek-ai/dsh-terminal-bash 使用指南

## Summary

`@deepseek-ai/dsh-terminal-bash` 用 subprocess terminal primitive 提供 bash PTY backend。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要 Bash 作为持久 PTY backend。
- 需要让 persistent shell 和 terminal 工具共享 bash 会话。

## 启用与启动

- 该插件已由仓库 profile 或 bundle patch 装配。使用目标 profile 启动 DSH，即可让依赖它的工具或服务路径生效。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。
- 配置字段以生成的配置目录为准；缺少必需字段时应在加载或首次调用路径显式失败。

## 实际使用

- 加载 bash PTY backend。
- 通过 persistent bash 或 terminal 工具打开 shell 并发送命令。
- 观察 PTY 输出和 session 状态。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Terminal clean subset passed and neighboring cancellation tests passed.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/terminal-bash.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/terminal/terminal-bash/src/index.ts](../../../../packages/terminal/terminal-bash/src/index.ts)。
- inventory 验证入口：`packages/terminal/terminal-bash/src/index.ts:222; mounted by packages/bundle/sdk-minimal/cordis.patch.yml:54, packages/bundle/sdk-minimal/cordis.patch.yml:60, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:123 ...`。
- 配置 schema：见生成的 [配置目录](../../../config-catalog.md)。
- Task 3 验证方法：`Partial focused tests`。
- Task 3 证据条目：`packages/terminal/terminal-bash/tests/local.spec.ts; index.spec.ts; config.spec.ts; selected session.spec.ts cases; docs/config-catalog.md`。
- Task 3 结果：`Terminal clean subset passed and neighboring cancellation tests passed.`。

## 限制与故障排查

- 本轮限制：`Not fully passing: isolated test `releases a timed-out cancellation when the provider write later rejects` fails with `SEND_ACTIVE`.`。
- 已确认失败缺口：`packages/terminal/terminal-bash/tests/session.spec.ts` 中 `releases a timed-out cancellation when the provider write later rejects` 可复现 `SEND_ACTIVE`，因此本指南不能声称该插件完整通过。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

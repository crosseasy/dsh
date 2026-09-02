# hooks-codex 使用指南

## Summary

`@deepseek-ai/dsh-hooks-codex` 把 Codex hooks.json 配置接入 DSH 的拦截能力。它适合在 Codex hook 环境中把外部 hook 调用转为 DSH 可观察的拦截事件。本轮只通过 inventory/config 做降级确认，没有调用 Codex hook 环境。该指南记录外部前提和最小验证路径，不声称 hook invocation 已运行。

## 适用场景

- 需要让 Codex hook 事件进入 DSH。
- 排查 Codex hooks.json 与 DSH bridge 的装配。
- 确认该集成插件存在于配置目录。

## 启用与启动

- 包路径：`packages/hooks/hooks-codex`。
- 插件分类：`integration-hooks`，inventory kind 为 `integration-plugin`。
- 当前 inventory 记录的装配入口是 `packages/hooks/hooks-codex/src/index.ts:82; docs/config-catalog.md`。
- Web 共享入口使用 `pnpm dsh web --no-open --port 3080` 的既有 listener；外部 hook、ACP、webhook 或 cordis preset 需要对应独立前提。

## 实际使用

1. 准备 Codex hook 环境和 hooks.json。
2. 启动包含 `@deepseek-ai/dsh-hooks-codex` 的 Cordis 配置。
3. 触发 Codex hook 并观察 DSH 拦截结果或会话事件。

## 可观察结果

- inventory/config 确认该插件存在。
- 本轮没有触发浏览器路径。
- 共享 Web 页面 clean 不适用于外部 hook invocation。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/integration-hooks/hooks-codex.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `hooks-codex` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `integration-hooks` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E7 覆盖 inventory/config 降级确认。 |
| 补充证据 | 本轮未为 `integration-hooks` 指南单独新增截图；hook 触发状态以命令证据和限制说明为准。 |

## 限制与故障排查

- 需要 Codex hook 环境。
- 本轮没有调用 hook。
- 如果 hook 没有进入 DSH，先验证 Codex 是否实际执行 hooks.json，再检查 bridge 配置。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

# webhook 使用指南

## Summary

`@deepseek-ai/dsh-webhook` 运行 fire-and-forget webhook 规则，并为匹配请求创建 workspace-backed DSH session。它适合把外部 HTTP webhook 转成 DSH 会话启动请求。本轮只通过 inventory/config 做降级确认，没有发送 webhook HTTP 请求。该指南只描述验证前提和共享入口，不声称 webhook rule runtime 已处理请求。

## 适用场景

- 需要从外部系统触发 DSH session。
- 排查 webhook runtime 是否在配置中存在。
- 验证 webhook-github 等 adapter 的下游运行时前提。

## 启用与启动

- 包路径：`packages/webhook/webhook`。
- 插件分类：`integration-hooks`，inventory kind 为 `integration-plugin`。
- 当前 inventory 记录的装配入口是 `packages/webhook/webhook/src/index.ts:178; docs/config-catalog.md`。
- Web 共享入口使用 `pnpm dsh web --no-open --port 3080` 的既有 listener；外部 hook、ACP、webhook 或 cordis preset 需要对应独立前提。

## 实际使用

1. 启动包含 webhook runtime 的 profile。
2. 配置可匹配的 webhook rule。
3. 向 webhook route 发送请求，并观察新 session 或规则处理结果。

## 可观察结果

- inventory/config 确认 webhook 插件存在。
- 当前 Web 页面验证没有触发 inbound webhook。
- 共享页面 clean 不适用于 webhook HTTP 请求。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/integration-hooks/webhook.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `webhook` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `integration-hooks` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E7 覆盖 inventory/config 降级确认。 |
| 补充证据 | 本轮未为 `integration-hooks` 指南单独新增截图；webhook 触发状态以命令证据和限制说明为准。 |

## 限制与故障排查

- 本轮未发送 webhook 请求。
- 需要明确 route、rule 和请求 payload 才能验证处理结果。
- 如果没有创建 session，先检查 rule 匹配条件和 workspace 配置。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

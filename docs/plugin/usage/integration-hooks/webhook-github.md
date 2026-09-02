# webhook-github 使用指南

## Summary

`@deepseek-ai/dsh-webhook-github` 为 webhook runtime 提供带签名校验的 GitHub HTTP webhook adapter。它适合把 GitHub webhook payload 安全地交给 DSH webhook runtime。本轮只通过 inventory/config 做降级确认，没有提供 GitHub payload 或 secret。该指南记录签名和 payload 前提，不声称 GitHub webhook 已处理。

## 适用场景

- 需要从 GitHub webhook 触发 DSH session。
- 排查 GitHub adapter 是否装配。
- 确认 webhook runtime 与 GitHub adapter 的验证前提。

## 启用与启动

- 包路径：`packages/webhook/webhook-github`。
- 插件分类：`integration-hooks`，inventory kind 为 `integration-plugin`。
- 当前 inventory 记录的装配入口是 `packages/webhook/webhook-github/src/index.ts:47; docs/config-catalog.md`。
- Web 共享入口使用 `pnpm dsh web --no-open --port 3080` 的既有 listener；外部 hook、ACP、webhook 或 cordis preset 需要对应独立前提。

## 实际使用

1. 启动包含 `webhook` 和 `webhook-github` 的配置。
2. 配置 GitHub webhook secret 和可匹配规则。
3. 发送带 GitHub 签名 header 的 payload，并观察 runtime 处理结果。

## 可观察结果

- inventory/config 确认 GitHub webhook adapter 存在。
- 本轮没有触发浏览器路径。
- 共享页面 clean 不适用于 GitHub webhook 请求。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/integration-hooks/webhook-github.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `webhook-github` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `integration-hooks` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E7 覆盖 inventory/config 降级确认。 |
| 补充证据 | 本轮未为 `integration-hooks` 指南单独新增截图；GitHub webhook 触发状态以命令证据和限制说明为准。 |

## 限制与故障排查

- 需要 GitHub payload 和 secret。
- 本轮未发送 webhook 请求。
- 如果请求被拒绝，先验证签名 header 和 payload body 是否与 secret 匹配。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

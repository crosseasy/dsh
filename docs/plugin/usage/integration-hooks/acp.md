# acp 使用指南

## Summary

`@deepseek-ai/dsh-acp` 通过 JSON-RPC stdio 提供 automation-only Agent Client Protocol 服务。它适合外部自动化客户端通过 ACP 驱动 DSH agent。本轮 inventory 标记它由 `acp-app` bundle 装配，不属于 `http://127.0.0.1:3080/` web profile 的可见路径。该指南只记录静态装配确认和独立 profile 前提，不声称 ACP protocol call 已执行。

## 适用场景

- 需要通过 ACP 客户端驱动 DSH agent。
- 排查 ACP app bundle 是否包含协议服务。
- 区分 web-app 页面验证和 ACP stdio 服务验证。

## 启用与启动

- 包路径：`packages/acp/acp`。
- 插件分类：`integration-hooks`，inventory kind 为 `integration-plugin`。
- 当前 inventory 记录的装配入口是 `packages/acp/acp/src/index.ts:97; mounted by packages/bundle/acp-app/cordis.patch.yml:16`。
- Web 共享入口使用 `pnpm dsh web --no-open --port 3080` 的既有 listener；外部 hook、ACP、webhook 或 cordis preset 需要对应独立前提。

## 实际使用

1. 使用 ACP app 对应 profile 或 bundle 启动服务。
2. 从 ACP 客户端发起 JSON-RPC stdio 请求。
3. 观察客户端收到协议响应或 agent 会话事件。

## 可观察结果

- inventory 标记该插件为 `acp-app` bundle mount。
- 当前 Web 页面验证不覆盖 ACP 独立服务。
- 共享页面 clean 不能作为 ACP protocol call 通过的证据。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/integration-hooks/acp.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `acp` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `integration-hooks` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E7 覆盖 inventory 装配记录。 |
| 补充证据 | 本轮未为 `integration-hooks` 指南单独新增截图；ACP 启动状态以命令证据和限制说明为准。 |

## 限制与故障排查

- 本轮未启动 ACP app。
- 本轮未执行 ACP JSON-RPC 调用。
- 需要完整验证时，应启动 ACP profile 并记录一个请求/响应 transcript。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

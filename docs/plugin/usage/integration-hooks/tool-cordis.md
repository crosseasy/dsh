# tool-cordis 使用指南

## Summary

`@deepseek-ai/dsh-tool-cordis` 让模型检查 live runtime、定义动态 Cordis 插件，并运行、停止或删除这些插件。它适合在 opt-in cordis preset 中让模型操作动态 Cordis 插件。本轮通过 inventory 和生成的 tool catalog 确认 toolset 存在，但当前 Web session 使用 standard preset，没有触发 `tool-cordis` 工具调用。该指南记录工具入口和限制，不声称 session log 中已有 `tool/call` 与 `tool/result`。

## 适用场景

- 需要模型定义或运行动态 Cordis 插件。
- 需要查询 Cordis Inspect provider 再生成插件代码。
- 排查 cordis preset 中工具 schema 是否暴露。

## 启用与启动

- 包路径：`packages/extensions/tool-cordis`。
- 插件分类：`integration-hooks`，inventory kind 为 `tool-plugin`。
- 当前 inventory 记录的装配入口是 `packages/extensions/tool-cordis/src/index.ts:34; mounted by packages/preset/agent-presets/presets/cordis/agent.cordis.yml:252`。
- Web 共享入口使用 `pnpm dsh web --no-open --port 3080` 的既有 listener；外部 hook、ACP、webhook 或 cordis preset 需要对应独立前提。

## 实际使用

1. 切换到包含 `@deepseek-ai/dsh-tool-cordis` 的 cordis preset。
2. 先调用 `cordis_inspect_list` 和 `cordis_inspect_query` 读取可用 provider。
3. 用 `cordis_define` 定义 package，再用 `cordis_run` 激活；需要停用时调用 `cordis_stop`，需要删除时调用 `cordis_undefine`。

## 可观察结果

- `docs/tool-catalog.md` 记录 `cordis_define`、`cordis_inspect_list`、`cordis_inspect_query`、`cordis_inspect_self`、`cordis_run`、`cordis_stop` 和 `cordis_undefine`。
- inventory 标记它由 cordis preset 装配。
- 当前 standard preset 页面没有触发该 tool。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/integration-hooks/tool-cordis.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `tool-cordis` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `integration-hooks` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E7 覆盖 inventory 记录。 |
| 补充证据 | `docs/tool-catalog.md` 覆盖工具 schema 行。 |
| 补充证据 | 本轮未为 `integration-hooks` 指南单独新增截图；工具调用状态以命令证据和限制说明为准。 |

## 限制与故障排查

- 该 toolset 不在所有 shipped tree 中默认启用。
- 本轮未切换 cordis preset，也未执行 `tool-cordis` 调用。
- 动态插件代码会进入真实运行时，验证时应使用隔离会话并先查询 Inspect provider。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

# client-ui-cordis 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-cordis` 为 `cordis_define` 等动态 Cordis 工具结果提供 keyed tool row 和 run/stop UI。它适合在 conversation UI 中展示模型定义动态插件后的运行控制。本轮验证了 Cordis 组合出的 conversation UI 和共享 boot 入口可用，但当前会话没有打开 Cordis 专属 tool detail。该指南记录共享入口，不声称动态插件卡片已完整操作。

## 适用场景

- 需要在前端看到动态 Cordis 工具结果。
- 排查 `cordis_define` tool row 没有专用呈现的问题。
- 验证 client UI slot 能被 Cordis 插件贡献。

## 启用与启动

- 包路径：`packages/extensions/ui-cordis`。
- 插件分类：`integration-hooks`，inventory kind 为 `client-ui-plugin`。
- 当前 inventory 记录的装配入口是 `packages/extensions/ui-cordis/src/index.ts:9; mounted by packages/bundle/web-app/cordis.patch.yml:228`。
- Web 共享入口使用 `pnpm dsh web --no-open --port 3080` 的既有 listener；外部 hook、ACP、webhook 或 cordis preset 需要对应独立前提。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`。
2. 打开包含工具调用的会话页。
3. 在使用 cordis preset 并触发 `cordis_define` 后，查看对应 tool row 的 run/stop 控制。

## 可观察结果

- 当前会话页显示 tool rows 和 Cordis 组合出的 conversation UI。
- 共享 boot/UI 入口可用。
- 首页 reload 采样 clean。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/integration-hooks/client-ui-cordis.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `client-ui-cordis` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `integration-hooks` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E3 覆盖 conversation UI 和 tool rows。 |
| 补充证据 | E4 覆盖共享 boot entry。 |

## 限制与故障排查

- 当前会话没有 Cordis 专属 tool detail。
- 本轮未执行 `cordis_define`。
- 需要完整验证时，应切换到 cordis preset 并记录一个动态插件定义、运行和停止流程。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

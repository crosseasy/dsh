# api-session-controller 使用指南

## Summary

`@deepseek-ai/dsh-api-session-controller` 为 Web app 提供 session 读取、命令和实时控制传输。它适合验证浏览器能读取当前会话、显示 session 日志入口，并渲染对话与轨迹标签。本轮在会话页看到 session crumb、Session 日志按钮、消息流、系统提示词行和工具调用行。该指南覆盖已有 session 的读取和投影，不执行创建或删除 session 的副作用操作。

## 适用场景

- 确认会话页能读取当前 session 内容。
- 排查对话页空白、会话标题缺失或 Session 日志入口不可见的问题。
- 验证 session controller 与前端 conversation UI 的共享路径。

## 启用与启动

- 包路径：`packages/api/session-controller`。
- 插件分类：`api`，inventory kind 为 `client-runtime-plugin`。
- 当前 inventory 记录的装配入口是 `packages/api/session-controller/src/index.ts:392; mounted by packages/bundle/web-app/cordis.patch.yml:92`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`，用 Chrome 打开已认证 DSH 页面。
2. 在左侧选择一个已有会话。
3. 确认主区域显示会话标题、Session 日志按钮、“对话 / 轨迹”标签、消息流和工具调用摘要。

## 可观察结果

- 当前会话显示“列出你的全部技能”标题和消息流。
- 页面展示“Session 日志”“对话”“轨迹”和工具调用摘要。
- 首页 reload 采样没有 console error、runtime exception、HTTP >=400 response 或非取消 loading failure。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/api/api-session-controller.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `api-session-controller` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `api` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E3 覆盖会话页、侧边栏、conversation 和 tool rows 共享 UI 截图。 |
| 补充证据 | E2 记录 fresh reload 后的页面状态。 |

## 限制与故障排查

- 本轮没有创建、删除或变更 session，避免改写用户会话状态。
- 如果会话列表为空，先确认 session persistence/provider 是否装配，再检查 session controller。
- 如果“轨迹”标签可见但内容异常，需要补充轨迹切换的独立 CDP 证据。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

# host-frontend-static 使用指南

## Summary

`@deepseek-ai/dsh-host-frontend-static` 为 Web shell 提供 SPA dist、显式 index entry 和静态资源回退。它适合验证本地 Web GUI 是否能从 host 服务加载前端页面和静态资源。本轮复用 `pnpm dsh web --no-open --port 3080` 启动的服务，并在已认证 Chrome target 中加载完整 DSH 页面。浏览器外 `curl -I` 返回 `401`，因此本指南以 Chrome 已认证上下文作为用户可见验证路径。

## 适用场景

- 确认本地 Web app 的前端资源可以加载。
- 排查浏览器中页面空白、静态资源缺失或 SPA fallback 异常。
- 验证 host webserver 与 frontend static 插件的组合。

## 启用与启动

- 包路径：`packages/host/frontend-static`。
- 插件分类：`host`，inventory kind 为 `host-plugin`。
- 当前 inventory 记录的装配入口是 `packages/host/frontend-static/src/index.ts:113; docs/config-catalog.md`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 运行或复用 `pnpm dsh web --no-open --port 3080`。
2. 用连接到 `http://127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。
3. 等待页面 readyState 为 `complete`，确认标题和主界面出现。

## 可观察结果

- 页面标题为“列出你的全部技能 — DSH 本地构建”。
- Chrome CDP 首页采样显示 boot entries、插件列表、侧边栏和对话内容。
- HTTP >=400 response 为 `0`，非取消 loading failure 为 `0`。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/host/host-frontend-static.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `host-frontend-static` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `host` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E0 记录服务、Chrome、target、401 未认证 HEAD 和页面加载状态。 |
| 补充证据 | E1 记录首页 CDP 页面加载、console 和 network 采样。 |
| 补充证据 | E3 记录会话页共享 UI 状态采样。 |

## 限制与故障排查

- 未认证的浏览器外 HEAD 请求返回 `401`，不能用它判断前端资源不可用。
- 本轮没有重启服务或覆盖完整 route matrix。
- 如果 Chrome 中仍空白，先检查前端产物是否已构建，再检查 webserver route。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

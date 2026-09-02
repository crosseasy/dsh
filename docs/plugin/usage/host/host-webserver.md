# host-webserver 使用指南

## Summary

`@deepseek-ai/dsh-host-webserver` 提供 Web route 注册、HTTP/upgrade 路由、index transform 和静态 dist fallback。它适合验证本地 DSH Web host 是否监听指定端口并服务浏览器页面。本轮复用 `pnpm dsh web --no-open --port 3080` 产生的 node listener，Chrome target 成功加载认证后的页面。该指南覆盖本地 Web 服务和页面加载，不覆盖所有路由组合。

## 适用场景

- 确认 web profile 已启动 HTTP listener。
- 排查 `127.0.0.1:3080` 页面无法打开的问题。
- 验证 frontend static、API gateway 和 webserver 的共享启动路径。

## 启用与启动

- 包路径：`packages/host/webserver`。
- 插件分类：`host`，inventory kind 为 `host-plugin`。
- 当前 inventory 记录的装配入口是 `packages/host/webserver/src/index.ts:364; mounted by packages/bundle/web-app/cordis.patch.yml:117`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 运行或复用 `pnpm dsh web --no-open --port 3080`。
2. 用 Chrome CDP target 打开 `http://127.0.0.1:3080/`。
3. 确认页面加载完成并显示 DSH 本地构建界面。

## 可观察结果

- 命令证据记录 `node` 进程监听 `127.0.0.1:3080`。
- Chrome target 已复用并加载完整页面。
- 首页和设置页采样均没有 console/runtime/log 错误，也没有 HTTP >=400 response。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/host/host-webserver.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `host-webserver` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `host` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E0 记录 listener、启动命令和 Chrome CDP 信息。 |
| 补充证据 | E1 记录首页 CDP 页面加载、console 和 network 采样。 |
| 补充证据 | E3 记录会话页共享 UI 状态采样。 |

## 限制与故障排查

- 本轮没有重启 webserver。
- 未认证 `curl -I` 返回 `401`，这只说明请求缺少浏览器认证状态。
- 如果端口被占用，先确认 listener PID，再决定是否切换端口或停止旧进程。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

# api-gateway 使用指南

## Summary

`@deepseek-ai/dsh-api-gateway` 让浏览器端通过 Typert Remote Host dispatcher 和 Client API endpoint 访问 Web profile 暴露的远程能力。它适合验证 Web 页面是否能完成启动握手、读取 client entry，并通过 gateway 使用已装配的 remote 能力。本轮在本地服务中观察到 `window.__DSH_BOOT__` 包含 `@deepseek-ai/dsh-api-gateway`，会话页和设置页都能完成加载。该指南只覆盖 Web app 的共享入口，不覆盖手写 wire API 调用。

## 适用场景

- 确认 Web profile 的 API gateway 已随页面启动。
- 排查浏览器端无法加载会话、设置或 workspace 数据的入口问题。
- 为其他 API controller 的使用验证提供共享前置条件。

## 启用与启动

- 包路径：`packages/api/gateway`。
- 插件分类：`api`，inventory kind 为 `client-runtime-plugin`。
- 当前 inventory 记录的装配入口是 `packages/api/gateway/src/index.ts:1201; mounted by packages/bundle/base/cordis.patch.yml:46`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`，并用连接到 `http://127.0.0.1:9333` 的 Chrome 打开页面。
2. 在页面加载完成后读取 `window.__DSH_BOOT__.entries`。
3. 确认 entry 列表包含 `@deepseek-ai/dsh-api-gateway`，并打开会话页或设置页观察远程数据是否渲染。

## 可观察结果

- 会话页加载出 workspace、会话 crumb、消息流和设置入口。
- Task 3 的 CDP 采样显示首页和设置页 console/runtime/log 事件为 `0`，HTTP >=400 response 为 `0`，非取消 network failure 为 `0`。
- gateway 的成功信号来自共享 Web app 渲染和 boot entry，不来自单独的手写 API 请求。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/api/api-gateway.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `api-gateway` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `api` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E4 `window.__DSH_BOOT__` 输出包含 gateway entry。 |
| 补充证据 | E2 和 E5 分别覆盖首页 reload 与设置页打开后的 clean console/network 结果。 |

## 限制与故障排查

- 如果浏览器外的 `curl -I` 返回 `401`，这是未携带浏览器认证状态的预期现象；用已认证 Chrome target 验证页面。
- 如果 `window.__DSH_BOOT__` 缺失，先确认 web profile 服务仍在 `3080` 端口运行。
- 本轮没有直接调用 gateway wire API；需要接口级调试时应补充 targeted remote call 证据。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

# client-connection 使用指南

## Summary

`@deepseek-ai/dsh-client-connection` 让 Web 客户端连接 host 侧 remote 服务，并把会话、工作区和设置数据加载到浏览器界面。

## 适用场景

- 启动 Web 客户端后需要读取会话、工作区和设置数据。
- 排查页面能否连上 host 侧 API、remote 服务和模块入口。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/connection/src/index.ts:99; mounted by packages/bundle/web-app/cordis.patch.yml:163`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 启动本地 Web 服务并用已认证 Chrome 打开 `http://127.0.0.1:3080/`。
2. 刷新页面，确认左侧工作区、当前会话内容和设置面板都能加载。
3. 如果要验证设置通道，点击“设置”并确认通用设置内容出现。

## 可观察结果

会话页和设置页都能显示 remote 数据；Task 3 的首页和设置页采样没有 console/runtime/network 错误。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-connection` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-connection.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“页面 reload 后会话、workspace 和设置 remote 数据均可显示，说明浏览器连接通道可用。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E5；console/network 结论：首页和设置页 clean。

## 限制与故障排查

没有单独做断线和重连测试。若页面停在空白或数据缺失，先确认服务监听 `127.0.0.1:3080`，再用 Chrome CDP 检查 console、runtime exception 和 HTTP >=400 response。

Task 3 对该插件记录的限制是：未单独断线/重连测试。

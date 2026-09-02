# client-ui-session 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-session` 把 session controller 数据接入 React，并提供 session-scoped slots。

## 适用场景

- 用户需要查看当前会话标题、面包屑和 Session 日志入口。
- 排查会话投影是否驱动 Web UI。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-session/src/index.ts:4; mounted by packages/bundle/web-app/cordis.patch.yml:190`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 查看会话标题、breadcrumb 和“Session 日志”按钮。
3. 确认当前会话内容渲染。

## 可观察结果

会话 crumb、Session 日志按钮、当前会话标题和 session 内容可见；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-session` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-session.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“会话 crumb、Session 日志按钮、当前会话标题和 session 内容可见。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有创建或删除 session。若会话内容缺失，先检查 api-session-controller 和 session projection。

Task 3 对该插件记录的限制是：未创建/删除 session。

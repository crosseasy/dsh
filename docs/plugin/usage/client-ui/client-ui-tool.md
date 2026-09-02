# client-ui-tool 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-tool` 渲染客户端工具调用树，并为不同工具提供 keyed presentation slot。

## 适用场景

- 用户需要查看一次会话中的工具调用数量和调用行。
- 排查工具结果是否以 Web 卡片或行项目呈现。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-tool/src/index.ts:4; mounted by packages/bundle/web-app/cordis.patch.yml:225`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开包含工具调用的会话。
2. 查看消息流中的工具调用数量和 tool row。
3. 必要时点击 tool row 查看详情侧栏。

## 可观察结果

当前会话显示“30 次工具调用”，并有 tool row/button 与详情侧栏提示；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-tool` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-tool.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“当前会话显示“30 次工具调用”，并有 tool row/button 与详情侧栏提示。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有点击每一种 tool row。若特定工具卡片缺失，先确认该工具是否注册了 presentation slot。

Task 3 对该插件记录的限制是：未点击每一种 tool row。

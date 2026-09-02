# client-ui-conversation 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-conversation` 组装会话主区域、composer、视图导航和对话内容。

## 适用场景

- 用户需要在 Web 页面阅读会话、切换对话和轨迹视图。
- 排查会话主区域是否能装载各类消息和工具行。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-conversation/src/index.ts:16; mounted by packages/bundle/web-app/cordis.patch.yml:208`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开本地 Web 服务。
2. 选择已有会话。
3. 观察“对话/轨迹”tab、系统提示词行、消息流和 tool rows。

## 可观察结果

会话主区域显示“对话/轨迹”tab、消息流、system prompt 行和 tool rows；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-conversation` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-conversation.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“会话主区域显示“对话/轨迹”tab、消息流、system prompt 行和 tool rows。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有切换所有 node 类型。若主区域缺失，先检查 session projection 是否返回当前会话，再检查 conversation 插件 mount。

Task 3 对该插件记录的限制是：未切换所有 node 类型。

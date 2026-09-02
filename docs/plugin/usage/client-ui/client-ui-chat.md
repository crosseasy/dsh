# client-ui-chat 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-chat` 提供聊天会话目标、消息节点渲染和消息详情区域。

## 适用场景

- 用户需要阅读当前会话中的用户消息和 assistant 回复。
- 排查聊天消息、思考状态或 token/time metadata 是否渲染。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-chat/src/index.ts:13; mounted by packages/bundle/web-app/cordis.patch.yml:214`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 选择一个已有会话。
3. 观察用户消息、assistant 回复、思考状态和消息 metadata。

## 可观察结果

当前会话消息流显示用户消息、assistant 回复、思考状态和 token/time metadata；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-chat` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-chat.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“当前会话消息流显示用户消息、assistant 回复、思考状态和 token/time metadata。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E3；E2；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有发送新消息。若消息流为空，先确认 session controller 和 conversation UI 已加载，再检查当前会话是否有消息投影。

Task 3 对该插件记录的限制是：未发送新消息。

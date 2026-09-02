# client-ui-message-feedback 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-message-feedback` 在 assistant 消息操作区提供“好的回答”和“有问题的回答”反馈按钮。

## 适用场景

- 用户需要对 assistant 消息提交正向或负向反馈。
- 排查 messageFeedback remote 与消息 action strip 是否连通。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-message-feedback/src/index.ts:9; mounted by packages/bundle/web-app/cordis.patch.yml:279`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开包含 assistant 回复的会话。
2. 查看 assistant 消息底部操作区。
3. 确认“好的回答”和“有问题的回答”按钮可见。

## 可观察结果

assistant 消息下方显示“好的回答”“有问题的回答”按钮；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-message-feedback` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-message-feedback.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“assistant 消息下方显示“好的回答”“有问题的回答”按钮。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有点击反馈按钮。若按钮可见但提交失败，需要再检查 `messageFeedback` host remote。

Task 3 对该插件记录的限制是：未点击反馈按钮。

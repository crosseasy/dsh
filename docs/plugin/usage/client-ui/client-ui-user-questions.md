# client-ui-user-questions 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-user-questions` 为 `ask_user_question` 提供 Web composer 接管和 plan-review 表示。

## 适用场景

- agent 需要向用户提出结构化问题。
- 计划审阅或人工确认需要在 Web UI 中显示。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-user-questions/src/index.ts:14; mounted by packages/bundle/web-app/cordis.patch.yml:303`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 确认共享 boot/UI 入口可用。
3. 在触发 ask-user 的会话中观察提问卡片或 composer 接管状态。

## 可观察结果

本轮共享 boot/UI 入口可用；当前会话没有 ask-user card。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-user-questions` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-user-questions.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“共享 boot/UI 入口可用；当前会话没有 ask-user card。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E4；E3；console/network 结论：共享页面 clean。

## 限制与故障排查

本轮没有触发用户提问卡。需要产生 `ask_user_question` 事件的会话继续验证。

Task 3 对该插件记录的限制是：未触发用户提问卡。

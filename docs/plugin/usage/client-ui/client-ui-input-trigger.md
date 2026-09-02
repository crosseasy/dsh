# client-ui-input-trigger 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-input-trigger` 识别输入框中的 `/` 和 `@`，并把候选菜单选择路由到已注册来源。

## 适用场景

- 用户需要通过 `/` 打开指令，或通过 `@` 引用文件和会话。
- 排查 composer 中 trigger 菜单是否启用。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-input-trigger/src/index.ts:9; mounted by packages/bundle/web-app/cordis.patch.yml:247`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 查看底部输入框 placeholder。
3. 确认文案包含“发消息或做任务…”以及“调用指令 @ 文件或对话”。

## 可观察结果

输入框显示 `发消息或做任务… / 调用指令 @ 文件或对话`；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-input-trigger` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-input-trigger.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“输入框显示“发消息或做任务… / 调用指令 @ 文件或对话”。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有执行 slash command 或 mention 选择。若触发菜单不出现，先检查 commands、reference、skill 或 subagent 来源是否注册。

Task 3 对该插件记录的限制是：未执行 slash command 或 mention。

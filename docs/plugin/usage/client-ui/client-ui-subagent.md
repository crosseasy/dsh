# client-ui-subagent 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-subagent` 提供 subagent 会话目录、继续路由 UI 和 `@` 引用来源。

## 适用场景

- 用户需要在 Web 会话中引用或继续 subagent 结果。
- 排查 subagent 相关 UI 是否装载。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-subagent/src/index.ts:9; mounted by packages/bundle/web-app/cordis.patch.yml:256`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 确认共享 UI boot 可用。
3. 在包含 subagent 结果的会话中观察 subagent 卡片或引用入口。

## 可观察结果

当前会话文本显示 subagent/workflow/ralph 能力，且共享 UI boot 可用；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-subagent` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-subagent.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“当前会话文本显示 subagent/workflow/ralph 能力；共享 UI boot 可用。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有触发 subagent card。需要包含 subagent 运行记录的会话继续验证。

Task 3 对该插件记录的限制是：未触发 subagent card。

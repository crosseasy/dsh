# client-ui-schedule 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-schedule` 为 Web 会话头部提供 active schedule catalog 的只读展示入口。

## 适用场景

- 会话存在 schedule 时，需要在 Web 头部查看活动计划。
- 排查 schedule UI 插件是否在 client inventory 中存在。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-schedule/src/index.ts:7; mounted by packages/bundle/web-app/cordis.patch.yml:265`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 确认共享 boot/UI 入口可用。
3. 在包含 active schedule catalog 的会话中查看 session header。

## 可观察结果

inventory 标记该插件存在；当前页面未显示 schedule UI。共享页面采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-schedule` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-schedule.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“inventory 标记该项存在；当前页面未显示 schedule UI。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E7；E4；console/network 结论：共享页面 clean。

## 限制与故障排查

本轮没有触发 schedule，且先前清单显示 schedule 禁用；不能声称运行通过。需要启用 schedule 并提供活动计划后继续验证。

Task 3 对该插件记录的限制是：当前会话未触发 schedule，且先前清单显示 schedule 禁用；不声称运行通过。

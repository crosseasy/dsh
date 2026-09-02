# client-ui-approval 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-approval` 为需要用户审批的交互提供 Web composer 接管和审批卡片呈现。

## 适用场景

- 工具或操作需要在 Web 会话中等待用户批准。
- 排查 approval 请求是否能通过客户端 UI 呈现。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-approval/src/index.ts:4; mounted by packages/bundle/web-app/cordis.patch.yml:211`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开本地 Web 会话页。
2. 确认浏览器 boot entry 加载共享 UI 插件。
3. 在产生 approval 请求的会话中观察 composer 区域或审批卡片。

## 可观察结果

本轮共享会话页和 boot entry 可用；当前会话没有 approval 请求卡片。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-approval` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-approval.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“共享 boot entry 可见；当前会话没有 approval 请求卡片。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E4；E3；console/network 结论：共享页面 clean。

## 限制与故障排查

本轮没有单独触发审批流，不能声称 approval card 渲染通过。需要带 approval 请求的会话或工具调用来继续验证。

Task 3 对该插件记录的限制是：未单独触发审批流；不能声称 approval card 渲染通过。

# client-ui-deliverables 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-deliverables` 为 Web 最终回复和 turn tail 中的产物文件提供可点击展示入口。

## 适用场景

- 会话产生文件产物后，需要在最终回复中打开对应文件。
- 排查 deliverables 面板或 artifact 链接是否注册。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-deliverables/src/index.ts:22; mounted by packages/bundle/web-app/cordis.patch.yml:238`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 确认共享 boot entry 和会话 UI 正常加载。
3. 在包含产物输出的会话中查看最终回复尾部或文件引用。

## 可观察结果

本轮共享 boot/UI 入口可用；当前页面没有可见 deliverables 面板或 artifact。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-deliverables` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-deliverables.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“当前页面共享 boot/UI 入口可用；没有可见 deliverables 面板或 artifact。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E4；E3；console/network 结论：共享页面 clean。

## 限制与故障排查

本轮没有单独触发 deliverables 输出。需要包含产物文件的会话继续验证点击路径。

Task 3 对该插件记录的限制是：未单独触发 deliverables 输出。

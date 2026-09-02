# client-ui-renderer 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-renderer` 绑定 React slot、`ctx.uiRenderer` 和装配后的应用根节点。

## 适用场景

- Web 客户端需要把各插件贡献的 slot 渲染成 React 页面。
- 排查多个 UI 插件同时装配时的根渲染状态。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-renderer/src/index.ts:4; mounted by packages/bundle/web-app/cordis.patch.yml:187`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开本地 Web 服务。
2. 观察 layout、settings、conversation、sidebar 和 tool rows 是否同时显示。
3. 点击“设置”确认 overlay 也能渲染。

## 可观察结果

多个 slot UI 共同渲染成功，包括 layout、settings、conversation、sidebar、tool rows；首页和设置页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-renderer` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-renderer.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“多个 slot UI 共同渲染成功: layout、settings、conversation、sidebar、tool rows。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；E5；console/network 结论：首页和设置页 clean。

## 限制与故障排查

本轮没有做 slot 层级异常测试。若页面整体不渲染，先检查 renderer mount 和 boot entry。

Task 3 对该插件记录的限制是：未做 slot 层级异常测试。

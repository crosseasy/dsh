# client-ui-layout 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-layout` 提供 Web AppFrame、侧栏、主会话区、输入区和可拖拽布局状态。

## 适用场景

- 用户需要完整的三栏 Web shell。
- 排查页面区域、导航或 panel 状态是否正确渲染。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-layout/src/index.ts:4; mounted by packages/bundle/web-app/cordis.patch.yml:184`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开本地 Web 服务。
2. 观察左侧侧栏、主会话区域和底部输入区。
3. 确认页面 shell 已完整渲染。

## 可观察结果

shell、侧边栏、主会话区和底部输入区同时渲染；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-layout` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-layout.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“shell、侧边栏、主会话区、底部输入区同时渲染。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有测试窄屏或折叠布局。若区域缺失，先确认 renderer 和 layout 插件都已装载。

Task 3 对该插件记录的限制是：未测试窄屏/折叠布局。

# client-ui-trajectory 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-trajectory` 在会话中提供轨迹事件账本和交互式时间概览入口。

## 适用场景

- 用户需要从对话切换到轨迹查看执行事件。
- 排查 trajectory view 是否注册到 conversation ViewMap。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-trajectory/src/index.ts:4; mounted by packages/bundle/web-app/cordis.patch.yml:306`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 查看主区域顶部。
3. 确认“轨迹”tab 可见。

## 可观察结果

会话页显示“轨迹”tab；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-trajectory` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-trajectory.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“会话页显示“轨迹”tab。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有切换到轨迹 tab。若 tab 缺失，先检查 conversation ViewMap 和 trajectory 插件 mount。

Task 3 对该插件记录的限制是：未切换到轨迹 tab。

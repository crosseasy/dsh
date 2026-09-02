# client-ui-sidebar 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-sidebar` 提供侧栏中的会话树、搜索、工作区分组和状态点。

## 适用场景

- 用户需要切换工作区或已有会话。
- 排查侧栏是否显示新会话、搜索、workspace 和 session 列表。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-sidebar/src/index.ts:4; mounted by packages/bundle/web-app/cordis.patch.yml:193`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开本地 Web 服务。
2. 查看左侧侧栏。
3. 确认品牌、新会话、搜索、workspace 和 session 列表可见。

## 可观察结果

左侧 sidebar 显示品牌、新会话、搜索、workspace 和 session 列表；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-sidebar` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-sidebar.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“左侧 sidebar 显示品牌、新会话、搜索、workspace 和 session 列表。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有折叠或展开侧栏。若侧栏为空，先检查 workspace controller 和 session tree 数据。

Task 3 对该插件记录的限制是：未折叠/展开测试。

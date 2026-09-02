# client-ui-brand-official 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-brand-official` 在 Web 客户端侧栏提供 DSH 官方品牌按钮和本地构建标识。

## 适用场景

- 需要确认当前 Web 页面属于 DSH 本地构建。
- 排查侧栏品牌 slot 是否被正确占用。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-brand-official/src/index.ts:7; mounted by packages/bundle/web-app/cordis.patch.yml:218`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开本地 Web 服务。
2. 查看左上角品牌区域。
3. 确认品牌按钮显示“DSH 本地构建”。

## 可观察结果

左上角品牌按钮显示“DSH 本地构建”；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-brand-official` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-brand-official.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“左上角品牌按钮显示“DSH 本地构建”。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E3；E2；console/network 结论：首页 clean。

## 限制与故障排查

本轮只验证当前品牌显示，没有覆盖其他品牌变体。若品牌区域为空，先核对 sidebar 和 brand plugin 是否都在 Web app 中装载。

Task 3 对该插件记录的限制是：只验证当前品牌显示。

# client-ui-settings-plugin-inventory 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-settings-plugin-inventory` 在 Web 插件设置中提供只读 Cordis Loader 插件清单。

## 适用场景

- 用户需要在 Web 设置页查看当前装配的插件。
- 排查插件 inventory 是否被 host 和 client 共同暴露。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-settings-plugin-inventory/src/index.ts:4; mounted by packages/bundle/web-app/cordis.patch.yml:205`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开设置面板。
2. 进入“插件”相关设置区域。
3. 查看插件清单截图或页面中的 inventory 表格。

## 可观察结果

设置导航显示“插件”，并已有插件 inventory 分类截图资产；设置页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-settings-plugin-inventory` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-settings-plugin-inventory.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“设置导航显示“插件”；已有插件 inventory 分类截图资产；host/plugin inventory 在 inventory 中为 web-app mount。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![settings-plugin-inventory.png](../_assets/client-ui/settings-plugin-inventory.png)。
- 证据编号：E5；E7；E9；console/network 结论：设置页 clean；E9 只作为截图资产，不附带独立 console/network 采样。

## 限制与故障排查

本轮没有逐行核对 inventory table 内容。若清单为空，先检查 host-plugin-inventory remote，再检查该设置页插件是否装载。

Task 3 对该插件记录的限制是：未逐行核对 inventory table 内容。

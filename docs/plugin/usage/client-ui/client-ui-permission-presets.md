# client-ui-permission-presets 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-permission-presets` 在通用设置和当前会话指令中展示权限模式。

## 适用场景

- 用户需要查看新会话默认权限。
- 用户需要通过 `/permission` 查看或调整当前会话权限。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-permission-presets/src/index.ts:9; mounted by packages/bundle/web-app/cordis.patch.yml:286`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开设置面板。
2. 进入默认的“通用设置”。
3. 确认“权限”和“工作区内修改”等权限模式文案可见。

## 可观察结果

设置通用页显示“权限”和“工作区内修改”默认权限模式；设置页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-permission-presets` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-permission-presets.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“设置通用页显示“权限”和“工作区内修改”默认权限模式。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![settings-general.png](../_assets/client-ui/settings-general.png)。
- 证据编号：E5；E6；console/network 结论：设置页 clean。

## 限制与故障排查

本轮没有展开权限 selector，也没有执行 `/permission`。若选项缺失，先检查 permissions projection 和设置页注册。

Task 3 对该插件记录的限制是：未展开权限 selector。

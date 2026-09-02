# client-ui-model-selection 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-model-selection` 在 composer 中展示模型目录、当前 session 选择和模型强度选项。

## 适用场景

- 用户需要查看当前会话使用的模型。
- 排查模型 selector 是否读取到共享 model catalog 和 session projection。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-model-selection/src/index.ts:9; mounted by packages/bundle/web-app/cordis.patch.yml:283`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 查看底部输入区附近的模型选择器。
3. 确认显示当前模型和强度。

## 可观察结果

底部模型 selector 显示 `DeepSeek-V4-Flash` 和 `High`；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-model-selection` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-model-selection.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“底部模型 selector 显示 `DeepSeek-V4-Flash` 和 `High`。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有切换模型。若 selector 为空，先确认模型 catalog 和 session.selectModel remote 可用。

Task 3 对该插件记录的限制是：未切换模型。

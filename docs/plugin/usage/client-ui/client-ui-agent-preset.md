# client-ui-agent-preset 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-agent-preset` 在设置面板中提供 Agent 预设入口，用于查看默认预设和会话相关预设配置。

## 适用场景

- 用户需要从设置页进入 Agent 预设配置。
- 排查 Web 设置页是否挂载了 Agent 预设导航项。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-agent-preset/src/index.ts:9; mounted by packages/bundle/web-app/cordis.patch.yml:291`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开本地 Web 服务。
2. 点击左侧“设置”。
3. 在设置面板导航中确认“Agent 预设”入口可见。

## 可观察结果

设置面板显示“Agent 预设”导航入口；设置页采样没有 console/runtime/network 错误。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-agent-preset` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-agent-preset.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“设置面板显示“Agent 预设”导航入口。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![settings-general.png](../_assets/client-ui/settings-general.png)。
- 证据编号：E5；E6；console/network 结论：设置页 clean。

## 限制与故障排查

本轮没有进入 Agent 预设详情页。若入口缺失，先核对 Web app patch 中的 mount，再检查 settings namespace 是否注册成功。

Task 3 对该插件记录的限制是：未进入 Agent 预设详情页。

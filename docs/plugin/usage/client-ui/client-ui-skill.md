# client-ui-skill 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-skill` 为 Web skill 引用和 skill 工具调用行提供专用展示。

## 适用场景

- 用户需要在会话中查看 skills 概览或 skill 工具结果。
- 排查 skill reference 来源是否接入输入区。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-skill/src/index.ts:9; mounted by packages/bundle/web-app/cordis.patch.yml:253`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 查看当前会话内容中关于 skills 的输出。
3. 确认输入区指令入口可见。

## 可观察结果

当前会话内容显示 skills 概览与工具能力说明，输入区命令入口可见；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-skill` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-skill.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“当前会话内容显示 skills 概览与工具能力说明；输入区命令入口可见。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有触发 skill picker 或 skill tool card。需要包含 skill 工具调用的会话继续验证。

Task 3 对该插件记录的限制是：未触发 skill picker 或 skill tool card。

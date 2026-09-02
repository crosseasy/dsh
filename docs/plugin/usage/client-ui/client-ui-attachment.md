# client-ui-attachment 使用指南

## Summary

`@deepseek-ai/dsh-client-ui-attachment` 为输入框附件、消息图片和轨迹图片提供客户端展示入口。

## 适用场景

- 用户需要在输入区引用文件或对话。
- 会话消息或轨迹中需要展示图片附件。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/ui-attachment/src/index.ts:4; mounted by packages/bundle/web-app/cordis.patch.yml:221`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开会话页。
2. 查看输入框 placeholder 是否显示 `@ 文件或对话`。
3. 在已有消息区域确认 file link button 节点或附件入口可见。

## 可观察结果

输入框显示 `@ 文件或对话`，消息流存在 file link button 节点；首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-ui-attachment` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-ui-attachment.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“输入框 placeholder 显示 `@ 文件或对话`，消息流存在 file link button 节点。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E2；E3；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有上传附件，也没有打开文件 picker。若附件入口不可见，先确认输入触发器和 reference 插件是否同时装载。

Task 3 对该插件记录的限制是：未上传附件或打开文件 picker。

# client-locale 使用指南

## Summary

`@deepseek-ai/dsh-client-locale` 提供 Web 客户端的语言偏好和内置中文文案，设置页和会话页通过它显示本地化文本。

## 适用场景

- 需要确认 Web 客户端按当前语言显示设置、导航和操作文案。
- 排查硬编码文案或语言偏好没有生效的问题。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/locale/src/index.ts:16; mounted by packages/bundle/web-app/cordis.patch.yml:181`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 打开本地 Web 服务。
2. 点击“设置”。
3. 在设置面板中观察“通用设置”“模型”“插件”“权限”“语言”“外观”等中文文案。

## 可观察结果

设置面板显示中文导航和设置项；Task 3 设置页采样没有 console/runtime/network 错误。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-locale` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-locale.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“页面显示中文 locale 文案，包括“设置”“通用设置”“模型”“插件”“权限”。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![settings-general.png](../_assets/client-ui/settings-general.png)。
- 证据编号：E5；E6；console/network 结论：设置页 clean。

## 限制与故障排查

本轮没有切换语言。若文案语言不符合预期，优先检查设置页语言偏好、host-backed preference 和对应 locale 字典。

Task 3 对该插件记录的限制是：未切换语言。

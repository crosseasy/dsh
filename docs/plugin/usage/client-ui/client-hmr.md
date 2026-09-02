# client-hmr 使用指南

## Summary

`@deepseek-ai/dsh-client-hmr` 为脚本加载的客户端 entry 提供开发期热更新入口，本地服务加载时会随 Web 客户端运行。

## 适用场景

- 开发客户端插件时需要让本地页面感知新的 client entry 构建结果。
- 确认本地 Web 构建页面包含 client runtime entry。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/hmr/src/index.ts:68; mounted by packages/bundle/web-app/cordis.patch.yml:149`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 启动本地 Web 服务并打开会话页。
2. 读取 `window.__DSH_BOOT__`，确认 client runtime entry 存在。
3. 普通使用不需要手动操作 HMR；它随本地 Web 页面加载。

## 可观察结果

页面完成加载，`window.__DSH_BOOT__` 可读，Task 3 共享会话页采样没有 console/runtime/network 错误。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-hmr` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-hmr.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“`window.__DSH_BOOT__` 中存在 client runtime entry；当前服务为本地构建页面。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E4；E3；console/network 结论：共享页面 clean。

## 限制与故障排查

本轮没有触发文件变更后的 HMR 更新。若热更新未生效，先确认当前运行的是本地构建服务，再检查 HMR 事件流和浏览器 console。

Task 3 对该插件记录的限制是：未触发 HMR 更新。

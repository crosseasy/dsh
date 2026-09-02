# client-modules 使用指南

## Summary

`@deepseek-ai/dsh-client-modules` 生成并提供浏览器端模块 entry 图，Web 客户端通过 `window.__DSH_BOOT__` 装载插件模块。

## 适用场景

- Web 页面需要加载多个客户端插件 entry。
- 排查某个 client UI 插件没有出现在浏览器启动清单中的问题。

## 启用与启动

该插件不需要通过独立的 `dsh plugin add` 命令启用；当前 Web app 组合会按 Cordis 配置提供它的入口或挂载记录。inventory 记录的入口是 `packages/client/modules/src/index.ts:1027; mounted by packages/bundle/web-app/cordis.patch.yml:158`。

本地验证使用已有服务：

```sh
pnpm dsh web --no-open --port 3080
```

启动后，用带 CDP `127.0.0.1:9333` 的 Chrome 打开 `http://127.0.0.1:3080/`。普通 `curl -I` 没有浏览器凭据时会返回 `401`，因此页面验证以已认证 Chrome target 为准。

## 实际使用

1. 启动本地 Web 服务并打开页面。
2. 在 Chrome CDP 中读取 `window.__DSH_BOOT__.entries`。
3. 确认启动清单包含 client runtime、settings、conversation 等 entry，且页面正常渲染。

## 可观察结果

`window.__DSH_BOOT__` 存在并包含 `rev`、`entries`、`batches`；会话页完成渲染且首页采样 clean。

## 验证证据

- 静态范围：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中 `client-modules` 的 `category` 为 `client-ui`，`exclusionReason` 为 `null`，文档目标为 `docs/plugin/usage/client-ui/client-modules.md`。
- 页面采样：`/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 的 Client UI 表记录“`window.__DSH_BOOT__.entries` 返回动态 client entry 和 module URL；应用完成加载。”。
- 服务基线：`/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录服务 URL、Chrome CDP target、页面 load 和 clean console/network 结果。
- 截图引用：![conversation-sidebar.png](../_assets/client-ui/conversation-sidebar.png)。
- 证据编号：E4；E2；console/network 结论：首页 clean。

## 限制与故障排查

本轮没有逐个 module factory 做独立 materialize 检查。若单个模块缺失，先看 boot entries，再核对 bundle route 和插件 mount 记录。

Task 3 对该插件记录的限制是：未逐个模块 factory 做独立 materialize 检查。

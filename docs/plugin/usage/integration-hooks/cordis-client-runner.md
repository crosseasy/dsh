# cordis-client-runner 使用指南

## Summary

`@deepseek-ai/dsh-cordis-client-runner` 在浏览器端运行动态双端插件包的 client half，并处理事件订阅、闭包求值和 loader entry。它适合验证 Web app 能加载 Cordis client runner，并把动态 client entry 接入现有 UI 运行时。本轮 `window.__DSH_BOOT__` 输出包含 `@deepseek-ai/dsh-cordis-client-runner`，会话页完成组合渲染。该指南不单独动态加载一个新 client plugin。

## 适用场景

- 确认动态 Cordis client runner 已随 web-app profile 加载。
- 排查动态插件 client entry 无法进入浏览器运行时的问题。
- 验证 cordis-host-runner 与 client-runner 的共享装配路径。

## 启用与启动

- 包路径：`packages/extensions/cordis-client-runner`。
- 插件分类：`integration-hooks`，inventory kind 为 `client-runtime-plugin`。
- 当前 inventory 记录的装配入口是 `packages/extensions/cordis-client-runner/src/index.ts:9; mounted by packages/bundle/web-app/cordis.patch.yml:175`。
- Web 共享入口使用 `pnpm dsh web --no-open --port 3080` 的既有 listener；外部 hook、ACP、webhook 或 cordis preset 需要对应独立前提。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`，并通过 Chrome CDP 打开页面。
2. 读取 `window.__DSH_BOOT__.entries`。
3. 确认 entry 列表包含 `@deepseek-ai/dsh-cordis-client-runner`，并观察会话 UI 正常渲染。

## 可观察结果

- boot entry 中出现 cordis-client-runner。
- 会话页、侧边栏和 tool rows 同时渲染成功。
- 首页 reload 采样 clean。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/integration-hooks/cordis-client-runner.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `cordis-client-runner` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `integration-hooks` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E4 覆盖 boot entry。 |
| 补充证据 | E3 覆盖共享 UI 渲染。 |

## 限制与故障排查

- 本轮未单独加载新 client plugin。
- 如果动态插件等待浏览器响应，应补充 `cordis_inspect_query` 或 runner state 证据。
- 如果页面没有响应 client query，先确认 Chrome 页面处于 active target。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

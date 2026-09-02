# api-remotes 使用指南

## Summary

`@deepseek-ai/dsh-api-remotes` 把应用选择的 Host 能力聚合成浏览器可用的 Remote BFF。它适合验证设置、会话和 workspace 等 Host 能力是否通过 Web profile 对浏览器开放。本轮通过设置面板和 boot entry 观察到 remotes 入口可用，设置页能显示通用设置、模型、插件、Agent 预设等导航。该指南覆盖共享 remotes 入口，不逐个 remote namespace 做手写调用。

## 适用场景

- 确认 Web app 能读取 Host 侧 remote 能力。
- 排查设置页、会话页或 workspace 列表无法取数的问题。
- 验证 web-app bundle 中 remotes 插件是否装配。

## 启用与启动

- 包路径：`packages/api/remotes`。
- 插件分类：`api`，inventory kind 为 `client-runtime-plugin`。
- 当前 inventory 记录的装配入口是 `packages/api/remotes/src/index.ts:37; mounted by packages/bundle/web-app/cordis.patch.yml:172`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`，用 Chrome CDP 打开页面。
2. 点击页面左侧的“设置”。
3. 观察设置 overlay 是否显示“通用设置”“模型”“插件”“Agent 预设”“权限”等导航。

## 可观察结果

- 设置面板打开成功，并展示多个由 remotes 支撑的配置区域。
- Task 3 记录 `window.__DSH_BOOT__` 含 api gateway、session、workspace、remotes 和 settings 相关 entry。
- 设置页打开采样没有 console error、runtime exception 或 HTTP >=400 response。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/api/api-remotes.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `api-remotes` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `api` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E4 覆盖 boot entry。 |
| 补充证据 | E5 记录真实点击“设置”后的设置面板状态。 |
| 补充证据 | E6 是设置通用页截图资产。 |

## 限制与故障排查

- 本轮没有手写调用每个 remote namespace。
- 如果设置 overlay 空白，先检查 gateway 和 remotes 是否同时出现在 boot entry 中。
- 如果页面请求失败，优先对照 CDP network 中的 HTTP >=400 response，而不是从插件装配状态推断。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

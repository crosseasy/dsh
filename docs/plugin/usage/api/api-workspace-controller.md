# api-workspace-controller 使用指南

## Summary

`@deepseek-ai/dsh-api-workspace-controller` 为 Web app 提供 workspace 命令和可重连状态传输。它适合验证侧边栏能读取 workspace 分组、显示工作区名称，并暴露 workspace 相关操作入口。本轮在会话页侧边栏观察到 `oa` 和 `dsh` 两个 workspace，以及新会话和搜索入口。该指南只覆盖 workspace 列表读取和 UI 入口，不创建新的 workspace。

## 适用场景

- 确认 web profile 能投影 workspace 列表。
- 排查侧边栏工作区为空或会话列表无法归组的问题。
- 验证 workspace controller 与 sidebar UI 的共享读取路径。

## 启用与启动

- 包路径：`packages/api/workspace-controller`。
- 插件分类：`api`，inventory kind 为 `client-runtime-plugin`。
- 当前 inventory 记录的装配入口是 `packages/api/workspace-controller/src/index.ts:123; mounted by packages/bundle/web-app/cordis.patch.yml:101`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`，通过 Chrome CDP 打开首页。
2. 观察左侧 sidebar 的“工作区”区域。
3. 确认可见 workspace 名称、workspace 分组和会话列表入口。

## 可观察结果

- 侧边栏显示“工作区”“oa”“dsh”和会话列表。
- 页面同时渲染主会话区和底部输入区，说明 workspace 数据没有阻塞整体 layout。
- 首页 reload 采样保持 clean console/network。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/api/api-workspace-controller.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `api-workspace-controller` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `api` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E3 是会话页、侧边栏和 workspace 的共享截图。 |
| 补充证据 | E2 记录 workspace/sidebar 文本来自页面 state。 |

## 限制与故障排查

- 本轮没有新增、删除或切换 workspace。
- 如果 workspace 名称不出现，先检查用户数据目录和 workspace provider，再检查 controller。
- 如果只有浏览器外请求失败，注意 baseline 记录未认证 `curl -I` 返回 `401`。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

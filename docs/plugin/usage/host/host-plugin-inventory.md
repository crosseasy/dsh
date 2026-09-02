# host-plugin-inventory 使用指南

## Summary

`@deepseek-ai/dsh-host-plugin-inventory` 向 Web 设置页提供当前 Cordis Loader 插件状态的只读 Remote 投影。它适合查看当前 web-app profile 中装配的插件清单，并用于定位插件是否已经进入运行配置。本轮通过 inventory 记录确认该插件为 web-app mount，并在设置页看到“插件”入口。该指南不直接调用 `pluginInventory/list` remote。

## 适用场景

- 确认插件 inventory provider 已装配。
- 在设置页查看插件清单入口。
- 排查某个插件是否出现在当前 profile 的装配状态中。

## 启用与启动

- 包路径：`packages/host/plugin-inventory`。
- 插件分类：`host`，inventory kind 为 `host-plugin`。
- 当前 inventory 记录的装配入口是 `packages/host/plugin-inventory/src/index.ts:92; mounted by packages/bundle/web-app/cordis.patch.yml:88`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`。
2. 打开设置 overlay。
3. 进入“插件”入口查看插件清单。

## 可观察结果

- 设置页导航显示“插件”。
- Task 1 inventory 标记该插件由 web-app bundle 装配。
- 设置页采样 clean。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/host/host-plugin-inventory.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `host-plugin-inventory` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `host` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E7 覆盖 inventory 装配记录。 |
| 补充证据 | E5 覆盖设置页“插件”入口。 |

## 限制与故障排查

- 本轮未直接调用 `pluginInventory/list` remote，也未逐行核对清单表格。
- 如果设置页有“插件”入口但列表为空，需要补充 remote 返回值证据。
- 该插件只读投影当前 loader 状态，不负责启动或停止插件。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

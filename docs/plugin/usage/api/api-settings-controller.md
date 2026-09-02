# api-settings-controller 使用指南

## Summary

`@deepseek-ai/dsh-api-settings-controller` 通过 settings-domain 能力向 Web 设置页提供配置读取和保存入口。它适合验证设置页能通过 remote 读取权限、语言、外观、字号和对话显示等配置。本轮通过真实 CDP mouse event 点击“设置”，设置 overlay 正常打开并显示通用设置内容。该指南只覆盖读取和显示，不保存设置变更。

## 适用场景

- 确认设置面板可以打开并读取当前配置。
- 排查权限、语言、外观或模型设置无法显示的问题。
- 验证 settings controller 与 settings UI 的共享入口。

## 启用与启动

- 包路径：`packages/api/settings-controller`。
- 插件分类：`api`，inventory kind 为 `remote-api-plugin`。
- 当前 inventory 记录的装配入口是 `packages/api/settings-controller/src/index.ts:343; mounted by packages/bundle/web-app/cordis.patch.yml:97`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`。
2. 在 Chrome 页面左侧点击“设置”。
3. 确认设置 overlay 默认显示“通用设置”，并能看到“权限”“语言”“外观”“字号”“对话显示”等字段。

## 可观察结果

- 设置面板显示“通用设置 / 模型 / 插件 / Agent 预设 / 打开配置文件 / 权限 / 语言 / 外观”等项目。
- 设置页打开采样没有 console error、runtime exception、HTTP >=400 response 或非取消 loading failure。
- 本轮没有触发保存动作，因此不会改变用户配置。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/api/api-settings-controller.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `api-settings-controller` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `api` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E5 记录设置面板点击和页面状态。 |
| 补充证据 | E6 是设置通用页截图资产。 |

## 限制与故障排查

- 本轮没有修改或保存设置。
- 如果设置页打不开，先确认 `api-remotes` 和 `api-gateway` entry 存在。
- 如果保存路径需要验证，应使用单独测试 profile，避免污染用户配置。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

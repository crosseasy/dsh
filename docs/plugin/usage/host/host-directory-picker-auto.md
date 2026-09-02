# host-directory-picker-auto 使用指南

## Summary

`@deepseek-ai/dsh-host-directory-picker-auto` 在 Web GUI host 启动时根据宿主环境选择可用的目录选择后端。它适合把目录选择入口交给当前环境支持的 native 或 browse provider。本轮在设置页观察到“打开配置文件”共享入口，并通过 inventory 确认该插件由 web-app bundle 装配。该指南不点击系统 picker，避免产生宿主 UI 副作用。

## 适用场景

- 希望 Web host 自动选择目录选择实现。
- 排查设置页“打开配置文件”入口缺失的问题。
- 在不同宿主环境中确认目录选择入口是否可见。

## 启用与启动

- 包路径：`packages/host/directory-picker-auto`。
- 插件分类：`host`，inventory kind 为 `host-plugin`。
- 当前 inventory 记录的装配入口是 `packages/host/directory-picker-auto/src/index.ts:61; mounted by packages/bundle/web-app/cordis.patch.yml:84`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`。
2. 打开设置 overlay。
3. 在设置导航中确认“打开配置文件”入口存在。

## 可观察结果

- 设置页显示“打开配置文件”入口。
- inventory 标记该插件由 `packages/bundle/web-app/cordis.patch.yml` 装配。
- 设置页采样 clean，说明共享入口没有产生浏览器错误。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/host/host-directory-picker-auto.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `host-directory-picker-auto` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `host` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E5 和 E6 覆盖设置页与“打开配置文件”入口。 |
| 补充证据 | E7 覆盖 inventory 装配记录。 |

## 限制与故障排查

- 本轮没有点击系统 picker。
- 如果入口可见但点击无效，需要分别验证 native 和 browse provider。
- 如果当前环境不支持 native picker，auto provider 应回落到可用实现；本轮未单独验证回落分支。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

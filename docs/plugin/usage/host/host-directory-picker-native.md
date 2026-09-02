# host-directory-picker-native 使用指南

## Summary

`@deepseek-ai/dsh-host-directory-picker-native` 提供宿主操作系统原生目录选择后端。它适合在桌面宿主允许打开系统选择器时提供目录选择体验。本轮通过 inventory/config 确认 native provider 存在，并通过设置页共享入口确认目录选择入口可见。当前 profile 未单独触发 native picker，因此本指南只记录装配和入口验证。

## 适用场景

- 需要使用宿主系统目录选择 dialog。
- 排查 native picker 与自动选择 provider 的组合。
- 验证 native provider 是否可被配置装配。

## 启用与启动

- 包路径：`packages/host/directory-picker-native`。
- 插件分类：`host`，inventory kind 为 `host-plugin`。
- 当前 inventory 记录的装配入口是 `packages/host/directory-picker-native/src/index.ts:20; docs/config-catalog.md`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`。
2. 打开设置页。
3. 在可接受宿主 UI 副作用的验证环境中点击“打开配置文件”。

## 可观察结果

- inventory/config 记录 native provider 存在。
- 设置页显示“打开配置文件”共享入口。
- 设置页采样 clean。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/host/host-directory-picker-native.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `host-directory-picker-native` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `host` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E7 覆盖 inventory/config 降级确认。 |
| 补充证据 | E6 覆盖设置页共享入口。 |

## 限制与故障排查

- 本轮没有打开系统 picker。
- native provider 的 OS dialog 行为需要人工或专用 UI 自动化验证。
- 如果入口可见但 native dialog 没有出现，检查当前配置是否选择了 native provider，而不是 auto 或 browse。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

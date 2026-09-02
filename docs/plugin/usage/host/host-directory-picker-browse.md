# host-directory-picker-browse 使用指南

## Summary

`@deepseek-ai/dsh-host-directory-picker-browse` 提供基于应用内浏览的目录选择后端。它适合在不能或不希望调用原生系统选择器时，通过 Web host 的文件系统浏览能力选择目录。本轮通过 inventory/config 确认该 provider 存在，并通过设置页共享入口观察到目录选择入口。当前 profile 没有单独选择 browse provider，因此本指南不声称 browse picker 已被点击执行。

## 适用场景

- 需要无原生 dialog 的目录浏览路径。
- 排查 directory picker 自动选择的 browse fallback。
- 验证配置中 browse provider 可被装配。

## 启用与启动

- 包路径：`packages/host/directory-picker-browse`。
- 插件分类：`host`，inventory kind 为 `host-plugin`。
- 当前 inventory 记录的装配入口是 `packages/host/directory-picker-browse/src/index.ts:187; docs/config-catalog.md`。
- 本轮 Web 可见路径使用 `pnpm dsh web --no-open --port 3080` 的既有 listener，并通过 Chrome CDP `127.0.0.1:9333` 观察。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`。
2. 打开设置页并定位“打开配置文件”入口。
3. 在需要验证 browse provider 时，用专门配置选择 browse 后端，再点击入口。

## 可观察结果

- inventory/config 记录该 host provider 存在。
- 设置页共享入口可见。
- 设置页采样 clean。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/host/host-directory-picker-browse.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `host-directory-picker-browse` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `host` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E7 覆盖 inventory/config 降级确认。 |
| 补充证据 | E6 覆盖设置页共享入口。 |

## 限制与故障排查

- 当前 profile 未单独选择 browse provider。
- 本轮未触发目录列表或创建目录等 browse 行为。
- 如果需要证明 browse provider 的文件系统操作，应使用测试目录并记录 remote method 结果。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

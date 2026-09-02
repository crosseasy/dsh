# cordis-host-runner 使用指南

## Summary

`@deepseek-ai/dsh-cordis-host-runner` 在 Host 侧维护动态插件定义、sandbox 生命周期和 invoke handler 表。它适合支撑模型定义的双端动态 Cordis 插件，并把 host half 与 browser client half 连接起来。本轮通过 `window.__DSH_BOOT__` 和页面渲染确认当前 host/client 组合可运行，并通过 inventory 确认 web-app mount。该指南不验证动态卸载、重载或 sandbox failure。

## 适用场景

- 需要运行模型定义的动态 Cordis 插件。
- 排查 `cordis_run` 之后 Host runner 没有响应的问题。
- 确认 web-app profile 包含 Host runner 和 Client runner 组合。

## 启用与启动

- 包路径：`packages/extensions/cordis-host-runner`。
- 插件分类：`integration-hooks`，inventory kind 为 `integration-plugin`。
- 当前 inventory 记录的装配入口是 `packages/extensions/cordis-host-runner/src/index.ts:903; mounted by packages/bundle/web-app/cordis.patch.yml:104`。
- Web 共享入口使用 `pnpm dsh web --no-open --port 3080` 的既有 listener；外部 hook、ACP、webhook 或 cordis preset 需要对应独立前提。

## 实际使用

1. 启动或复用 `http://127.0.0.1:3080/`。
2. 确认 boot entry 和插件 inventory 包含 runner 相关条目。
3. 在 cordis preset 中通过 `cordis_define` 和 `cordis_run` 触发动态插件。

## 可观察结果

- web-app host runner 装配 client entries。
- `window.__DSH_BOOT__` 和页面渲染证明当前 host/client 组合可运行。
- 首页 reload 采样 clean。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/integration-hooks/cordis-host-runner.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `cordis-host-runner` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `integration-hooks` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E4 覆盖 boot entry。 |
| 补充证据 | E3 覆盖页面渲染。 |

## 限制与故障排查

- 本轮未验证动态卸载、重载或失败恢复。
- 如果 `cordis_run` 返回等待审批，需要按 approval 流程继续，不要重复发起审批。
- 如果 client package 没有响应，检查 Chrome target 是否打开且 runner entry 是否存在。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

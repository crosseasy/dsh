# hooks-claude-code 使用指南

## Summary

`@deepseek-ai/dsh-hooks-claude-code` 把 Claude Code hooks.json 或 settings hook 配置接入 DSH 的拦截能力。它适合在 Claude Code hook 环境中复用 DSH 的会话、权限或工具拦截路径。本轮只通过 inventory/config 做降级确认，没有调用 Claude Code hook 环境。该指南明确外部 hook 前提，不把共享 Web 页面 clean 结果套用到 hook invocation。

## 适用场景

- 需要让 Claude Code hook 事件进入 DSH。
- 排查 hooks.json 或 settings hook 是否被 DSH bridge 加载。
- 确认该集成插件存在于配置目录。

## 启用与启动

- 包路径：`packages/hooks/hooks-claude-code`。
- 插件分类：`integration-hooks`，inventory kind 为 `integration-plugin`。
- 当前 inventory 记录的装配入口是 `packages/hooks/hooks-claude-code/src/index.ts:97; docs/config-catalog.md`。
- Web 共享入口使用 `pnpm dsh web --no-open --port 3080` 的既有 listener；外部 hook、ACP、webhook 或 cordis preset 需要对应独立前提。

## 实际使用

1. 准备 Claude Code hook 环境和对应 hooks/settings 配置。
2. 启动包含 `@deepseek-ai/dsh-hooks-claude-code` 的 Cordis 配置。
3. 触发 Claude Code hook 并观察 DSH 拦截结果或会话事件。

## 可观察结果

- inventory/config 确认该插件存在。
- 本轮没有触发浏览器路径。
- 共享 Web 页面 clean 不适用于外部 hook invocation。

## 验证证据

| 证据 | 本指南使用方式 |
|---|---|
| Inventory | `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 记录该插件 `exclusionReason == null`，目标文档路径为 `docs/plugin/usage/integration-hooks/hooks-claude-code.md`。 |
| 服务基线 | `/tmp/dsh-plugin-usage-evidence/service-baseline.md` 记录本地服务、Chrome CDP target、console/network 汇总和未认证 HEAD 的 `401`。 |
| Task 3 证据 | `/tmp/dsh-plugin-usage-evidence/verification-ui-host-api.md` 中对应 `hooks-claude-code` 的行记录本轮观察和限制。 |
| 分类截图说明 | 本轮未为 `integration-hooks` 指南单独新增截图；该页使用 CDP 和命令证据。 |
| 补充证据 | E7 覆盖 inventory/config 降级确认。 |
| 补充证据 | 本轮未为 `integration-hooks` 指南单独新增截图；hook 触发状态以命令证据和限制说明为准。 |

## 限制与故障排查

- 需要 Claude Code hook 环境。
- 本轮没有调用 hook。
- 如果 hook 没有进入 DSH，先验证外部工具是否实际执行 hooks 配置，再检查 DSH bridge。
- 如果需要把共享入口提升为插件专属通过结论，补充一次只触发该插件的命令、Remote 调用、协议请求或 UI 操作，并记录新的 console/network 结果。

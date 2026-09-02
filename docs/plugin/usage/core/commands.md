# @deepseek-ai/dsh-commands

## Summary

`dsh-commands` 提供 `/command` 注册表，让交互式 UI 直接把命令发给当前 agent，而不是写成用户消息交给模型。

## 适用场景

- UI 需要提供 `/permission`、`/compact`、feedback 或其他插件命令。
- 插件希望命令按 agent scope 注册，并允许局部命令覆盖同名全局命令。
- 命令结果应由 adapter 渲染，不进入模型历史。

## 启用与启动

- headless 和 web 默认配置 dump 都显示该插件。
- 命令生产者插件通过 `ctx.commands.register()` 增加具体命令。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-commands'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 启动包含该插件和至少一个命令生产者的 interactive profile。
- 在支持命令的输入框中输入 `/command [input]`。
- 命令 handler 在接收 agent 的 scope 内执行，并返回 adapter 可渲染的结果。

## 可观察结果

- 命令运行记录进入 session log。
- 命令结果显示给用户，但不会追加为模型可见 user message。
- 源码测试覆盖命令注册、解析、scope 和 invariant。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-commands`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/commands.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:293`；源码入口见 [packages/interaction/commands/src/index.ts](../../../../packages/interaction/commands/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1、C2；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/interaction/commands/README.md`](../../../../packages/interaction/commands/README.md)。
- 源码测试路径：`packages/interaction/commands/tests/commands.spec.ts`、`packages/interaction/commands/tests/invariant.spec.ts`。

## 限制与故障排查

- 本轮没有在浏览器中触发 slash command。
- 没有命令生产者时，该注册表本身不会提供用户可执行命令。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

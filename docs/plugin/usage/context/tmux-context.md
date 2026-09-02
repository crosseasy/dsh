# @deepseek-ai/dsh-tmux-context

## Summary

`dsh-tmux-context` 在 agent 运行于真实 tmux pane 时，把 session、window、pane 和布局信息追加为模型上下文。它是 opt-in 插件，默认 headless/web 组合不启用。

## 适用场景

- agent 在 tmux 中运行，用户希望模型知道当前 pane 和 window 位置。
- 任务需要区分当前 pane 与同 window 的其他 pane，但不需要读取其他 pane 内容。
- 需要把 tmux 位置变化以 durable session event 形式进入 replay。

## 启用与启动

- 在自定义 profile 的 `cordis.yml` 中添加该插件。
- 用 `pnpm dsh --profile <profile> --dump-default-config` 确认该行进入最终组合。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-tmux-context'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 从真实 tmux pane 内启动 agent，使进程控制终端匹配 `$TMUX_PANE` 的 `#{pane_tty}`。
- 可设置 `refreshIntervalMs` 限制重复注入。
- 开始下一轮用户请求，插件在首个 step 采样 tmux 状态。

## 可观察结果

- 模型可见三行 tmux 位置消息，包含 session、window、pane、active 标记和 layout。
- 不在真实 tmux pane、查询失败或位置未变化时，不新增模型上下文。
- 源码测试覆盖 tmux 状态解析、注入和 no-op 路径。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-tmux-context`，category 为 `context`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/context/tmux-context.md`。
- 装配入口：`docs/config-catalog.md`；源码入口见 [packages/context/tmux-context/src/index.ts](../../../../packages/context/tmux-context/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/context/tmux-context/README.md`](../../../../packages/context/tmux-context/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-tmux-context)。
- 源码测试路径：`packages/context/tmux-context/tests/tmux-context.spec.ts`。

## 限制与故障排查

- 本轮没有在 tmux 内启动真实模型请求。
- 插件不读取其他 pane 的可见文本，也不记录像素尺寸。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

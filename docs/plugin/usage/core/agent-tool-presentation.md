# @deepseek-ai/dsh-agent-tool-presentation

## Summary

`dsh-agent-tool-presentation` 为某个 agent preset 固定工具展示方式。它可以让该 agent 看到 native schemas、PTC `run_code` SDK，或两者同时存在。

## 适用场景

- 一个进程中有多个 agent，需要按 preset 区分工具展示方式。
- PTC 模式需要把多个工具折叠成 `run_code` 加生成 SDK。
- 希望一个 agent 覆盖 `dsh-tools` 的部署默认 presentation mode。

## 启用与启动

- inventory 指向 `packages/preset/agent-presets/presets/ptc/agent.cordis.yml` 的装配行。
- 该插件需要 `ctx.tools`，且 `mode` 必填。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-agent-tool-presentation'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 在 agent preset 的 Cordis tree 中添加该插件，并设置 `mode: native`、`ptc` 或 `both`。
- 启动使用该 preset 的 agent。
- 用 tool catalog 对照 `run_code` 在 PTC 模式下的模型可见 schema。

## 可观察结果

- `native` 暴露可见工具 schema；`ptc` 暴露 `run_code` 和生成 SDK；`both` 同时暴露两种形式。
- 同一进程中其他 agent 不受该 preset 行影响。
- 源码测试覆盖 presentation mode 选择与 invariant。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-agent-tool-presentation`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/agent-tool-presentation.md`。
- 装配入口：`packages/preset/agent-presets/presets/ptc/agent.cordis.yml:266`；源码入口见 [packages/core/agent-tool-presentation/src/index.ts](../../../../packages/core/agent-tool-presentation/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/core/agent-tool-presentation/README.md`](../../../../packages/core/agent-tool-presentation/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-agent-tool-presentation)。
- 源码测试路径：`packages/core/agent-tool-presentation/tests/agent-tool-presentation.spec.ts`。

## 限制与故障排查

- 本地没有名为 `ptc` 的 dsh profile 可直接 dump。
- PTC 真实调用需要 code runtime 和模型请求，本轮未执行。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

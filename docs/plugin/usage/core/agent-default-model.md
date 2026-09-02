# @deepseek-ai/dsh-agent-default-model

## Summary

`dsh-agent-default-model` 为新 agent 提供默认 provider 和 model。入口读取 `ctx.agentDefaultModel`，用户设置可覆盖组合默认值。

## 适用场景

- 部署希望所有新 session 从同一 provider/model 开始。
- CLI、Host 或 SDK entry point 不应各自维护一份默认模型。
- 需要把模型默认值保留在 Cordis 组合配置中。

## 启用与启动

- headless 默认配置 dump 显示该插件。
- base 配置为 `provider: deepseek-official`、`model: deepseek-v4-flash`。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-agent-default-model'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 在 profile patch 中配置默认 provider/model。
- 创建新 agent 或新 session，让入口读取当前默认值。
- 如果 settings provider 中保存了用户选择，下一次读取会返回保存值。

## 可观察结果

- 新 agent 在没有 session 自己选择的情况下使用统一默认模型。
- 保存后的用户模型选择不要求修改每个入口。
- 源码测试覆盖默认模型服务读取和配置行为。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-agent-default-model`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/agent-default-model.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:76`；源码入口见 [packages/core/agent-default-model/src/index.ts](../../../../packages/core/agent-default-model/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/core/agent-default-model/README.md`](../../../../packages/core/agent-default-model/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-agent-default-model)。
- 源码测试路径：`packages/core/agent-default-model/tests/agent-default-model.spec.ts`。

## 限制与故障排查

- 该插件只选择默认模型，不验证 provider 凭据是否可用。
- 无 `DEEPSEEK_API_KEY` 时不能证明默认模型能完成一次生成。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

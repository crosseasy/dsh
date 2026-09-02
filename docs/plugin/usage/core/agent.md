# @deepseek-ai/dsh-agent

## Summary

`dsh-agent` 提供所有插件编程使用的 live Agent handle 和 `ctx.agents` 注册表。它声明 agent 事件和 initiator scope，但不负责具体模型循环。

## 适用场景

- UI、hook、SDK server 或扩展插件需要创建、恢复、发送消息、取消或等待 agent。
- 插件需要把异步工作归属到发起它的 agent。
- 需要观察 agent 生命周期事件，但不想依赖具体 loop 实现。

## 启用与启动

- headless 和 sdk 默认配置 dump 都显示该插件。
- `dsh-agent-loop` 在运行时注册具体 factory；单独的 `dsh-agent` 不会发起模型请求。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-agent'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 在插件中通过 `ctx.agents` 获取或创建 live Agent。
- 用 Agent handle 发送 follow-up prompt、注入上下文、取消活动或等待 idle。
- 需要替换 driver 时，提供另一个实现并注册到 `ctx.agents`。

## 可观察结果

- 运行时存在 live agent 注册表，消费者可按 agent scope 解析工具、命令和用户交互。
- agent 相关事件可被其他插件观察或拦截。
- 源码测试覆盖 registry、initiator、model selection 和 invariant。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-agent`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/agent.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:68, packages/bundle/sdk-minimal/cordis.patch.yml:102, packages/bundle/sdk-minimal/cordis.patch.yml:117`；源码入口见 [packages/core/agent/src/index.ts](../../../../packages/core/agent/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/core/agent/README.md`](../../../../packages/core/agent/README.md)。
- 源码测试路径：`packages/core/agent/tests/agent.spec.ts`、`packages/core/agent/tests/agent-initiator.spec.ts`、`packages/core/agent/tests/model-selection.spec.ts`、`packages/core/agent/tests/invariant.spec.ts`。

## 限制与故障排查

- 该插件是接口和注册表，不直接调用 LLM。
- 本轮没有执行 live `pnpm dsh --profile headless "..."`。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

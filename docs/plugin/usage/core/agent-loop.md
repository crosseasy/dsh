# @deepseek-ai/dsh-agent-loop

## Summary

`dsh-agent-loop` 是默认 agent driver。它创建或恢复 agent，组装 system prompt 和工具 schema，调用 LLM，调度工具，并把每个结果写回 session log。

## 适用场景

- 需要标准 DeepSeek Harness agent 运行循环。
- profile 希望启动时自动创建或恢复指定 agent。
- 工具调用需要按并发安全分类调度，并保留完整会话事件。

## 启用与启动

- headless、web 和 sdk 默认配置 dump 都显示该插件。
- base 配置 `agents: []`，overlay 或用户入口负责创建具体 agent。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-agent-loop'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 有模型凭据时可运行 `pnpm dsh --profile headless "hello"` 触发完整 loop。
- 启动时创建 agent 时，在 `agents` 数组中提供 `id`、`cwd`、`sessionId` 或 `resumeSessionId`。
- 用 `maxParallelToolCalls` 限制每个 step 内可并行安全执行的工具调用数量。

## 可观察结果

- 成功轮次会写入 user、assistant、tool、request header 和 agent 生命周期事件。
- 配置的 agent 会在插件启动时创建或恢复。
- 源码测试覆盖 loop、tool calls、resume、request reconstruction、cancellation 和 settings。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-agent-loop`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/agent-loop.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:487, packages/bundle/sdk-minimal/cordis.patch.yml:123, packages/bundle/sdk-minimal/cordis.patch.yml:126`；源码入口见 [packages/core/agent-loop/src/index.ts](../../../../packages/core/agent-loop/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1、C2；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/core/agent-loop/README.md`](../../../../packages/core/agent-loop/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-agent-loop)。
- 源码测试路径：`packages/core/agent-loop/tests/loop.spec.ts`、`packages/core/agent-loop/tests/tool-calls.spec.ts`、`packages/core/agent-loop/tests/resume.spec.ts`、`packages/core/agent-loop/tests/request-reconstruction.spec.ts`、`packages/core/agent-loop/tests/invariant.spec.ts`。

## 限制与故障排查

- 本轮没有真实 LLM key，不声明模型轮次已完成。
- 改变 loop 行为属于架构敏感路径，应优先通过插件扩展点实现。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

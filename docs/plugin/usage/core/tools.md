# @deepseek-ai/dsh-tools

## Summary

`dsh-tools` 提供工具注册表和执行管线。工具插件注册 schema 和 executor 后，模型调用会经过 policy、guard、dispatch wrapper、post-execute、content finalization 和结果通知。

## 适用场景

- 需要让模型调用 shell、filesystem、web、workflow 或自定义工具。
- 工具作者需要 typed schema、输出渲染、timeout、并发安全分类和 UI presentation intent。
- 部署需要在 native、PTC `run_code` 或 both 模式之间选择工具展示。

## 启用与启动

- headless、web 和 sdk 默认配置 dump 都显示该插件。
- 默认 `mode` 为 `native`；`ptc` 或 `both` 需要可用 `ctx.codeRuntime`。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-tools'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 工具插件调用 `ctx.tools.register(defineTool(...))`。
- agent loop 从 `ctx.tools.schemas(scope)` 获取当前 agent 可见 schema。
- 模型发起 tool call 后，registry 验证参数并运行完整执行管线。

## 可观察结果

- 成功或失败都以 `tool/call` 和 `tool/result` 形式进入 session log。
- PTC 模式下模型直接看到 `run_code`，内部 SDK 调用仍回到同一工具执行管线。
- tool catalog 记录 `run_code` schema；源码测试覆盖 schema、JSON validation、PTC 和 execution mode。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-tools`，category 为 `core`，kind 为 `tool-plugin`，docPath 为 `docs/plugin/usage/core/tools.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:475, packages/bundle/sdk-minimal/cordis.patch.yml:99, packages/curated/curated-profiles/tests/fixtures/behavior-bundle/cordis.patch.yml:11`；源码入口见 [packages/core/tools/src/index.ts](../../../../packages/core/tools/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1、C2；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/core/tools/README.md`](../../../../packages/core/tools/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-tools)。
- 工具 catalog：[`docs/tool-catalog.md`](../../../tool-catalog.md#deepseek-aidsh-tools)。
- 源码测试路径：`packages/core/tools/tests/tools.spec.ts`、`packages/core/tools/tests/schema.spec.ts`、`packages/core/tools/tests/json-schema.spec.ts`、`packages/core/tools/tests/ptc.spec.ts`、`packages/core/tools/tests/invariant.spec.ts`。

## 限制与故障排查

- 本轮没有真实 LLM 触发工具调用。
- 工具 body 必须合作式响应 `exec.signal`。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

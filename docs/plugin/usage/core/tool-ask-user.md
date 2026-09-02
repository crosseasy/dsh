# @deepseek-ai/dsh-tool-ask-user

## Summary

`dsh-tool-ask-user` 向模型暴露 `ask_user_question` 工具。模型可用它提出简短问题，工具等待人类 answerer 返回后把答案作为普通 tool result 交回 loop。

## 适用场景

- 模型缺少继续执行所需的信息，需要暂停询问用户。
- 需要让模型在几个互斥选项或自定义输入之间获得用户判断。
- 交互应复用 `ctx.userQuestions`，而不是让工具自己实现 UI。

## 启用与启动

- agent presets 装配该工具，tool catalog 记录模型可见名称 `ask_user_question`。
- 该插件需要 `ctx.tools` 和 `ctx.userQuestions`。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-tool-ask-user'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 启动带该工具的 agent preset。
- 模型调用 `ask_user_question`，传入一个或多个 `{ id, question, header?, options?, multi_select? }`。
- UI 或本地 answerer 返回答案后，loop 记录 tool result 并继续。

## 可观察结果

- 成功结果是 compact JSON 文本，形如 `{ "answers": [...] }`。
- 无 answerer、abort、空问题或 delegated child agent 会成为明确工具错误。
- tool catalog 记录 schema；源码测试覆盖 tool behavior。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-tool-ask-user`，category 为 `core`，kind 为 `tool-plugin`，docPath 为 `docs/plugin/usage/core/tool-ask-user.md`。
- 装配入口：`packages/preset/agent-presets/presets/cordis/agent.cordis.yml:232, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:366, packages/preset/agent-presets/presets/ptc/agent.cordis.yml:245`；源码入口见 [packages/interaction/tool-ask-user/src/index.ts](../../../../packages/interaction/tool-ask-user/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/interaction/tool-ask-user/README.md`](../../../../packages/interaction/tool-ask-user/README.md)。
- 工具 catalog：[`docs/tool-catalog.md`](../../../tool-catalog.md#deepseek-aidsh-tool-ask-user)。
- 源码测试路径：`packages/interaction/tool-ask-user/tests/tool-ask-user.spec.ts`。

## 限制与故障排查

- 本轮没有真实模型工具调用，也没有触发 Web ask-user card。
- runtime-owned child agent 不能直接 ask user。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

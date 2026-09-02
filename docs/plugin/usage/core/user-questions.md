# @deepseek-ai/dsh-user-questions

## Summary

`dsh-user-questions` 提供 `ctx.userQuestions` 服务。工具或权限插件可用它暂停当前操作，等待人类回答一个或多个短问题。

## 适用场景

- 模型-facing 工具需要在继续前向用户确认选择。
- plan review、权限选择或其他交互需要复用同一个 question/answer API。
- Web answerer 需要只接受带 live Agent scope 的请求。

## 启用与启动

- headless 默认配置 dump 显示该插件。
- 具体 UI answerer 由 Web/Remote Events 等插件提供；该包本身是服务定义和 waterfall。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-user-questions'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 消费者调用 `ctx.userQuestions.ask({ questions, agent, signal })`。
- 每个 question 使用稳定 `id`；answer 会 echo 该 `id`。
- 带 `agent` 的请求必须指向准确 live runtime root。

## 可观察结果

- 第一个接受请求的 answerer 返回答案。
- 无 provider、abort、bad intent 或 delegated caller 等情况返回明确错误。
- 源码测试覆盖 question API、Agent scope 和错误路径。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-user-questions`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/user-questions.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:65`；源码入口见 [packages/interaction/user-questions/src/index.ts](../../../../packages/interaction/user-questions/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/interaction/user-questions/README.md`](../../../../packages/interaction/user-questions/README.md)。
- 源码测试路径：`packages/interaction/user-questions/tests/user-questions.spec.ts`。

## 限制与故障排查

- 该插件不渲染 UI；没有 answerer 时 agentless request 会失败。
- 本轮没有触发真实 user-question UI。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

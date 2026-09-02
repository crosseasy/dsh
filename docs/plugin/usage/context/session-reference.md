# @deepseek-ai/dsh-session-reference

## Summary

`dsh-session-reference` 让当前对话引用其他会话。Host 把 `@label` 转成 `dsh-session:` URI 后，插件为模型追加受限、只读、不可信的会话快照。

## 适用场景

- 用户需要在一个会话中引用另一个已有会话的上下文。
- Host UI 需要列出同 workspace 或标题匹配的 session 候选。
- 需要把外部 session 内容带入模型，但不允许其中的指令直接获得权限。

## 启用与启动

- `pnpm dsh --profile web --dump-default-config` 可看到该插件。
- 该插件需要 `ctx.sessionQuery`，Web profile 同时装配 session query 相关 provider。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-session-reference'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 在支持 reference 的输入框中选择或输入 canonical `dsh-session:` 引用。
- 发送消息后，插件在请求准备阶段读取被引用 session 的当前 surface。
- 模型收到当前消息和紧随其后的 `## Referenced sessions` 快照。

## 可观察结果

- 快照包含固定警告，说明引用内容是不可信背景。
- 每条消息最多引用 `maxReferences` 个 session，每个来源受 `maxReferenceBytes` 限制。
- C3 执行 `packages/context/session-reference/tests/session-reference.spec.ts` 并通过。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-session-reference`，category 为 `context`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/context/session-reference.md`。
- 装配入口：`packages/bundle/web-app/cordis.patch.yml:65`；源码入口见 [packages/context/session-reference/src/index.ts](../../../../packages/context/session-reference/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C2、C3；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/context/session-reference/README.md`](../../../../packages/context/session-reference/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-session-reference)。
- 源码测试路径：`packages/context/session-reference/tests/session-reference.spec.ts`。

## 限制与故障排查

- 本轮没有通过 Chrome 重新触发 session reference picker。
- 引用是快照，不是 fork、订阅或源 session 的实时链接。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

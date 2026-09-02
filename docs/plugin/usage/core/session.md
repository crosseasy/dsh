# @deepseek-ai/dsh-session

## Summary

`dsh-session` 提供 append-only session log 和内存 session store。模型可见历史由 session event 派生，持久化由单独 provider 订阅 `session/event` 和 `session/flush` 完成。

## 适用场景

- 任何 agent session 需要记录用户、assistant、工具和 request header。
- 插件需要向 session log 追加自己的事件并让 replay 可重建。
- 需要 fork、deriveMessages 或 flush durability barrier。

## 启用与启动

- headless、web 和 sdk 默认配置 dump 都显示该插件。
- 该插件只提供内存 store；持久化需要 session persistence provider。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-session'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 通过 `ctx.sessions.create()` 创建 live session，或通过 `ctx.sessions.get(id)` 查找。
- 用 `session.append(type, data, opts)` 追加 typed event。
- 需要模型消息时调用 `deriveMessages()`，需要 durable checkpoint 时调用 `ctx.sessions.flush(session)`。

## 可观察结果

- surface events 派生为模型消息，raw log 保留完整历史。
- fork 从稳定边界创建 child session。
- C3 执行 session 相关测试并通过。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-session`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/session.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:34, packages/bundle/sdk-minimal/cordis.patch.yml:82, packages/bundle/sdk-minimal/cordis.patch.yml:114`；源码入口见 [packages/core/session/src/index.ts](../../../../packages/core/session/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1、C2、C3；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/core/session/README.md`](../../../../packages/core/session/README.md)。
- 源码测试路径：`packages/core/session/tests/session.spec.ts`、`packages/core/session/tests/json.spec.ts`、`packages/core/session/tests/invariant.spec.ts`、`packages/core/session/tests/repair.spec.ts`。

## 限制与故障排查

- session store 不发起 LLM 请求，也不自己保存到磁盘。
- 本轮没有真实模型轮次。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

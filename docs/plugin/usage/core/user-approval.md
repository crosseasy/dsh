# @deepseek-ai/dsh-user-approval

## Summary

`dsh-user-approval` 为敏感操作提供一次性 allow/reject 决策。它通过 `ctx.approval.request()` 调用 answerer waterfall，并按 policy 在无 answerer 时 fail closed。

## 适用场景

- 工具或插件需要在执行写入、外部调用或高风险动作前询问用户。
- 部署需要 `ask` 或 `never` 的 per-session approval policy。
- 需要把 approval 请求写入 session audit log。

## 启用与启动

- headless 默认配置 dump 显示该插件。
- Web 或 ACP 等通道可提供 answerer；没有 answerer 时 `ask` policy 返回 unavailable。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-user-approval'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 消费者构造一次具体 action 的 approval request。
- 调用 `ctx.approval.request(req)` 等待 `allowed-once`、`rejected`、`cancelled` 或 `unavailable`。
- 工具根据结果执行或返回用户可见拒绝/不可用消息。

## 可观察结果

- 每个 approval request 记录在请求 session 的 audit log 中。
- `never` policy 不提示用户并确定性拒绝。
- 源码测试覆盖 approval waterfall、policy 和 invariant。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-user-approval`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/user-approval.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:231, packages/curated/curated-profiles/tests/fixtures/behavior-bundle/cordis.patch.yml:7`；源码入口见 [packages/interaction/user-approval/src/index.ts](../../../../packages/interaction/user-approval/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/interaction/user-approval/README.md`](../../../../packages/interaction/user-approval/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-user-approval)。
- 源码测试路径：`packages/interaction/user-approval/tests/approval.spec.ts`、`packages/interaction/user-approval/tests/invariant.spec.ts`。

## 限制与故障排查

- 授权只适用于请求的那一次 action。
- 本轮没有触发真实 UI approval card。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

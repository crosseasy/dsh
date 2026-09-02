# @deepseek-ai/dsh-sdk-jsonrpc-server

## Summary

`dsh-sdk-jsonrpc-server` 通过 stdio 提供 JSON-RPC 服务，让进程外 SDK client 驱动 Harness agent。它打开 session、排队用户 prompt，并把 session event 和 agent 状态流回 client。

## 适用场景

- 需要从 TypeScript/Python SDK 或其他进程控制 DSH agent。
- 需要 stdout 只承载 JSON-RPC frame 的自动化入口。
- 需要在 SDK app 或 minimal SDK profile 中复用标准组合。

## 启用与启动

- `pnpm dsh --profile sdk --dump-default-config` 可看到该插件。
- 实际运行时应通过 `dsh` profile 启动，不要把 package bin 当作应用入口。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-sdk-jsonrpc-server'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 让 SDK client 通过 stdio 连接该 profile。
- 以 `sessionId` 打开或复用 session，然后发送用户 prompt。
- client 读取 JSON-RPC event stream，直到 agent idle 或请求结束。

## 可观察结果

- stdout 只输出 JSON-RPC frame。
- `shutdown` 请求会 dispose root runtime 并以 0 退出。
- 源码测试覆盖 plugin apply、server、plugin shape 和 built-scope carrier e2e。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-sdk-jsonrpc-server`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/sdk-jsonrpc-server.md`。
- 装配入口：`packages/bundle/sdk-app/cordis.patch.yml:18, packages/bundle/sdk-minimal/cordis.patch.yml:12`；源码入口见 [packages/sdk/server/src/index.ts](../../../../packages/sdk/server/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/sdk/server/README.md`](../../../../packages/sdk/server/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-sdk-jsonrpc-server)。
- 源码测试路径：`packages/sdk/server/tests/server.spec.ts`、`packages/sdk/server/tests/plugin-apply.spec.ts`、`packages/sdk/server/tests/plugin-shape.spec.ts`、`packages/sdk/server/tests/built-scope-carrier.e2e.ts`。

## 限制与故障排查

- 本轮没有启动真实 stdio SDK client，也没有模型 key 支持一次完整 prompt。
- 如果组合里有 stdout logger，会破坏 JSON-RPC 传输。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

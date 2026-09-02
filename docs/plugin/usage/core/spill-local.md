# @deepseek-ai/dsh-spill-local

## Summary

`dsh-spill-local` 把过大的工具文本结果保存到本地私有 session 文件，并返回可让模型后续读取或 grep 的路径 locator。它是 spill storage provider，不负责判断何时 spill。

## 适用场景

- 工具结果可能很大，但部署希望保留完整文本。
- agent 与 spill 文件位于同一主机，模型可通过文件工具读取 locator。
- 需要启动时清理过期 spill 文件。

## 启用与启动

- headless 默认配置 dump 显示该插件。
- 可配置 `root` 和 `cleanupPeriodDays`；省略 `root` 会使用私有临时目录。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-spill-local'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 同时装配一个调用 `ctx.spillStore` 的 policy 或工具消费者。
- 让工具产生超过 policy 阈值的纯文本结果。
- 按返回的 locator 使用文件读取或搜索工具查看完整内容。

## 可观察结果

- 完整文本落在当前用户私有、session-scoped 的本地文件中。
- 模型可见结果包含 locator 和 retrieval guidance。
- 源码测试覆盖 loader composition 和本地 spill store 行为。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-spill-local`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/spill-local.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:391`；源码入口见 [packages/spill/spill-local/src/index.ts](../../../../packages/spill/spill-local/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/spill/spill-local/README.md`](../../../../packages/spill/spill-local/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-spill-local)。
- 源码测试路径：`packages/spill/spill-local/tests/spill-local.spec.ts`、`packages/spill/spill-local/tests/loader-composition.spec.ts`。

## 限制与故障排查

- 该插件不决定阈值；没有 policy 或消费者时不会自动处理工具结果。
- 跨主机或远程 sandbox 需要不同 storage provider 或额外映射。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

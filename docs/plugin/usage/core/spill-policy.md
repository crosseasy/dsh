# @deepseek-ai/dsh-spill-policy

## Summary

`dsh-spill-policy` 在工具最终结果超过 `maxInlineBytes` 时，把完整纯文本交给 `ctx.spillStore`，并把模型可见结果替换为有界预览和 locator。

## 适用场景

- 需要限制工具结果进入模型上下文的字节数。
- 需要保留完整输出供后续读取。
- 需要对 `run_code` sub-call 的 durable log copy 应用相同上限。

## 启用与启动

- headless 默认配置 dump 显示该插件，base 配置 `maxInlineBytes: 50000`。
- 该插件需要 `ctx.tools`，并需要 `ctx.spillStore` provider 才能保存完整文本。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-spill-policy'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 设置 `maxInlineBytes` 为正整数；省略该字段会让 policy 成为 no-op。
- 运行可能产生大文本的工具。
- 从结果中的 preview 判断内容范围，必要时按 locator 读取完整文件。

## 可观察结果

- 模型可见工具结果被替换为 head/tail 预览、spill locator 和读取说明。
- spill 失败时保留原始结果。
- 源码测试覆盖阈值、替换和 fallback 行为。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-spill-policy`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/spill-policy.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:394`；源码入口见 [packages/spill/spill-policy/src/index.ts](../../../../packages/spill/spill-policy/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/spill/spill-policy/README.md`](../../../../packages/spill/spill-policy/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-spill-policy)。
- 源码测试路径：`packages/spill/spill-policy/tests/spill-policy.spec.ts`。

## 限制与故障排查

- 只处理纯文本工具结果。
- 本轮没有通过真实 LLM 触发超大工具结果。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

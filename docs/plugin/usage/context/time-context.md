# @deepseek-ai/dsh-time-context

## Summary

`dsh-time-context` 在请求准备阶段向模型追加当前时间、浏览器时区策略和上一条可见消息后的 elapsed 时间。默认 headless/web 组合不启用它，Schedule Web overlay 会按需装配。

## 适用场景

- 用户用“今天”“明早”“两小时后”等相对时间表达任务。
- Web 请求携带浏览器时区，或部署愿意设置 fallback `timeZone`。
- 需要把时间采样作为 durable session event 保留下来。

## 启用与启动

- 在自定义 profile 的 `cordis.yml` 中添加该插件。
- 用 `pnpm dsh --profile <profile> --dump-default-config` 确认该行进入最终组合。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-time-context'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 设置 `timeZone` 作为浏览器时区缺失时的显示 fallback，或省略它使用进程时区。
- 设置正整数 `refreshIntervalMs` 限制重复注入；省略或 `0` 表示每个合格 step 都注入。
- 启动启用该插件的 agent，让请求进入 `agent/pre-step`。

## 可观察结果

- 模型可见一条三行时间上下文。
- 同一 open turn 出现多个浏览器时区时，提示要求模型向用户澄清。
- 源码测试覆盖 request-zone、时间注入和 invariant。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-time-context`，category 为 `context`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/context/time-context.md`。
- 装配入口：`docs/config-catalog.md`；源码入口见 [packages/context/time-context/src/index.ts](../../../../packages/context/time-context/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/context/time-context/README.md`](../../../../packages/context/time-context/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-time-context)。
- 源码测试路径：`packages/context/time-context/tests/time-context.spec.ts`、`packages/context/time-context/tests/time-context.e2e.ts`、`packages/context/time-context/tests/request-zone.spec.ts`、`packages/context/time-context/tests/invariant.spec.ts`。

## 限制与故障排查

- 本轮没有启动带该 opt-in 行的真实 profile，也没有执行模型请求。
- fallback 时区不是用户授权；时区来源混合或缺失时模型仍需澄清。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

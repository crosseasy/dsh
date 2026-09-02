# @deepseek-ai/dsh-token-meter

## Summary

从持久会话日志测量 token 用量与上下文压力，供压缩和 UI 投影复用。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/llm/token-meter/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 压缩、上下文压力提示或 UI 需要 token 用量估算。
- 需要把 provider usage 与本地启发式估算统一到同一会话投影。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/llm/token-meter/src/index.ts:334; mounted by packages/bundle/base/cordis.patch.yml:324`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-token-meter'
```

## 实际使用

- 与 session 服务和需要计量的消费方一起挂载。
- 让会话产生 request header、消息、工具结果或 provider usage。
- 消费方调用 `ctx.tokenMeter.measure()`，或读取 `tokenUsage`、`contextPressure`、`contextBreakdown` 投影。

## 可观察结果

- Request measurement, route pricing, and token usage projection are covered. It was not exercised against a live provider response in this pass.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/llm/token-meter/src/index.ts:334; mounted by packages/bundle/base/cordis.patch.yml:324`。
- 本轮命令证据：Headless and web-curated dumps include `token-meter`; base patch parse includes `token-meter:@deepseek-ai/dsh-token-meter`; token-meter focused tests passed 52 tests across `token-meter.spec.ts`, `route-pricing.spec.ts`, and `token-usage-projection.spec.ts`.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。

## 限制与故障排查

- 本轮未接入真实 provider usage；计量行为由 mock/session-log 单元测试覆盖。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

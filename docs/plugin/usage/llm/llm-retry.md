# @deepseek-ai/dsh-llm-retry

## Summary

在 agent loop 的模型请求失败扩展点上按提供方策略重试失败请求。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/llm/llm-retry/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 模型请求可能因限流、空响应、上下文溢出等可恢复失败而需要重试。
- 需要在同一个持久步骤内记录每次重试尝试。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/llm/llm-retry/src/index.ts:29; mounted by packages/bundle/base/cordis.patch.yml:85, packages/bundle/sdk-minimal/cordis.patch.yml:105`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-llm-retry'
```

## 实际使用

- 与 `dsh-llm` 和 provider adapter 一起挂载。
- 让 agent loop 遇到可恢复的模型请求失败。
- 读取会话日志中的 `llm/retry` 记录和后续成功或终态失败。

## 可观察结果

- Retry plugin is present in assembled profiles and the loader path accepts its registration. Transport retry behavior was not re-run beyond the selected loader test in this pass.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/llm/llm-retry/src/index.ts:29; mounted by packages/bundle/base/cordis.patch.yml:85, packages/bundle/sdk-minimal/cordis.patch.yml:105`。
- 本轮命令证据：Dumps include `llm-retry`; base and sdk-minimal patch parses include `llm-retry:@deepseek-ai/dsh-llm-retry`; `packages/llm/llm-retry/tests/loader-composition.spec.ts` passed 1 test.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- 没有 API key 时，本轮未复现真实传输失败后的端到端重试，只验证装配和 loader 路径。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

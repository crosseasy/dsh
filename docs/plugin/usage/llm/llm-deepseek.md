# @deepseek-ai/dsh-llm-deepseek

## Summary

把 DeepSeek 官方 chat-completions 协议翻译为 harness 的流式 LLM 分片。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/llm/llm-deepseek/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 部署使用 DeepSeek 官方 chat-completions API。
- 需要 DeepSeek 路由的 thinking、reasoning、图片请求与 usage 映射。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/llm/llm-deepseek/src/index.ts:405; mounted by packages/bundle/base/cordis.patch.yml:501, packages/bundle/sdk-minimal/cordis.patch.yml:27`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-llm-deepseek'
```

## 实际使用

- 设置 `DEEPSEEK_API_KEY` 或通过凭据服务提供同等密钥。
- 启动挂载 `llm-deepseek` 的 profile，例如 headless、web-curated 或 sdk-minimal。
- 执行一次会触发 DeepSeek 路由的 agent 任务或适配器测试。

## 可观察结果

- The native DeepSeek adapter is mounted and its dynamic settings/credentials composition is covered. With no key, only configuration and fail-closed skip behavior were verified.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/llm/llm-deepseek/src/index.ts:405; mounted by packages/bundle/base/cordis.patch.yml:501, packages/bundle/sdk-minimal/cordis.patch.yml:27`。
- 本轮命令证据：Dumps include `llm-deepseek`; base and sdk-minimal patch parses include `llm-deepseek:@deepseek-ai/dsh-llm-deepseek`; `packages/llm/llm-deepseek/tests/loader-composition.spec.ts` passed 5 tests; `adapter.e2e.ts` skipped without `DEEPSEEK_API_KEY`.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- 没有 `DEEPSEEK_API_KEY` 时，本轮只验证配置、装配和 keyless e2e self-skip/fail-closed；真实 DeepSeek completion 未执行。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

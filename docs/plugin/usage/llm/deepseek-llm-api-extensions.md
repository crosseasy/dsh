# @deepseek-ai/dsh-deepseek-llm-api-extensions

## Summary

为 DeepSeek 官方 LLM API 请求注册可组合的顶层扩展字段。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/llm/deepseek-llm-api-extensions/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- DeepSeek 官方适配器需要插件贡献额外请求字段。
- 扩展字段必须由拥有者注册和准备，而不是让适配器硬编码所有字段。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/llm/deepseek-llm-api-extensions/src/index.ts:132; mounted by packages/bundle/base/cordis.patch.yml:31, packages/bundle/sdk-minimal/cordis.patch.yml:18`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-deepseek-llm-api-extensions'
```

## 实际使用

- 与 `@deepseek-ai/dsh-llm-deepseek` 一起挂载。
- 让贡献插件注册属于自己的 DeepSeek 请求字段。
- 发起官方 DeepSeek 路由请求时，适配器会在序列化后准备这些扩展字段。

## 可观察结果

- DeepSeek API extension registry is available to composed LLM adapters. No external provider call was required.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/llm/deepseek-llm-api-extensions/src/index.ts:132; mounted by packages/bundle/base/cordis.patch.yml:31, packages/bundle/sdk-minimal/cordis.patch.yml:18`。
- 本轮命令证据：Dumps include `deepseek-llm-api-extensions`; base and sdk-minimal patch parses include the row; `packages/llm/deepseek-llm-api-extensions/tests/registry.spec.ts` passed 7 tests.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- 没有 API key 时，本轮只验证注册表和装配，未向 DeepSeek API 发送真实请求。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

# @deepseek-ai/dsh-llm

## Summary

提供与供应商无关的 `ctx.llm` 流式模型调用、适配器注册和模型元数据解析。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/llm/llm/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 任一插件或 loop 需要通过统一接口调用模型。
- 组合需要注册多个提供方、列出模型或解析模型调用默认值。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/llm/llm/src/index.ts:1092; mounted by packages/bundle/base/cordis.patch.yml:28, packages/bundle/sdk-minimal/cordis.patch.yml:79`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-llm'
```

## 实际使用

- 与至少一个适配器一起挂载。
- 消费方调用 `ctx.llm.stream()` 或 agent loop 发起模型步骤。
- 消费方读取分片流；`usage` 在 `finish` 前出现，失败通过稳定 code 归类。

## 可观察结果

- Provider-neutral LLM registry behavior and API-key handling are exercised, including absent-key handling. Real provider completion was not run.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/llm/llm/src/index.ts:1092; mounted by packages/bundle/base/cordis.patch.yml:28, packages/bundle/sdk-minimal/cordis.patch.yml:79`。
- 本轮命令证据：Dumps include `llm`; base and sdk-minimal patch parses include `llm:@deepseek-ai/dsh-llm`; `packages/llm/llm/tests/service.spec.ts` passed 85 tests and `packages/llm/llm/tests/api-key.spec.ts` passed 17 tests.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- 没有 API key 时，本轮只验证服务、API key 处理和 mock/loader 路径，未执行真实 provider completion。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

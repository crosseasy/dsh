# @deepseek-ai/dsh-llm-pi-ai

## Summary

通过 pi-ai 配置多条 LLM 路由，可服务 OpenAI 兼容网关或自托管提供方。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/llm/llm-pi-ai/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 部署通过 pi-ai 接入多个 provider 或 OpenAI 兼容网关。
- 需要从 settings 或授权记录动态激活路由。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/llm/llm-pi-ai/src/index.ts:143; mounted by packages/bundle/base/cordis.patch.yml:108`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-llm-pi-ai'
```

## 实际使用

- 在 settings 中配置 pi-ai profile 或自定义 provider route。
- 准备该 provider 所需的密钥、OAuth 或本地凭据文件。
- 通过选定路由发起模型请求；没有路由时插件可休眠挂载。

## 可观察结果

- The dormant adapter boots with zero routes and can register a route from settings in the loader-composition test. No live pi-ai provider request was made.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/llm/llm-pi-ai/src/index.ts:143; mounted by packages/bundle/base/cordis.patch.yml:108`。
- 本轮命令证据：Headless and web-curated dumps include `llm-pi-ai`; base patch parse includes `llm-pi-ai:@deepseek-ai/dsh-llm-pi-ai`; `packages/llm/llm-pi-ai/tests/loader-composition.spec.ts` passed 3 tests; `adapter.e2e.ts` skipped without `DEEPSEEK_API_KEY`.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- 没有 `DEEPSEEK_API_KEY` 且未配置 pi-ai 外部凭据时，本轮只验证配置、装配和 keyless e2e self-skip/fail-closed；真实 provider completion 未执行。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

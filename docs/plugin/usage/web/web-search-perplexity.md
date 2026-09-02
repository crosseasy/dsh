# @deepseek-ai/dsh-web-search-perplexity 使用指南

## Summary

`@deepseek-ai/dsh-web-search-perplexity` 通过 Perplexity API 提供搜索。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `web`，类型为Cordis 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要使用 Perplexity 作为搜索 provider。
- 需要通过配置接入外部搜索 API。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Web profile 可用 `pnpm dsh web --dump-default-config` 检查组合中是否包含该插件。
- 配置字段以生成的配置目录为准；缺少必需字段时应在加载或首次调用路径显式失败。

## 实际使用

- 配置 Perplexity provider 所需 API key。
- 通过 `web_search` 发起查询。
- 观察 Perplexity 响应被转换为 DSH web result。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`Web batch passed; provider request/response behavior covered by tests.`。
- 本轮未为 `web` 指南单独新增截图；该页使用命令、源码和测试证据。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `web`，文档目标是 `docs/plugin/usage/web/web-search-perplexity.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/web/web-search-perplexity/src/index.ts](../../../../packages/web/web-search-perplexity/src/index.ts)。
- inventory 验证入口：`packages/web/web-search-perplexity/src/index.ts:52; docs/config-catalog.md`。
- 配置 schema：见生成的 [配置目录](../../../config-catalog.md)。
- Task 3 验证方法：`Focused unit tests and config catalog`。
- Task 3 证据条目：`packages/web/web-search-perplexity/tests/perplexity.spec.ts; docs/config-catalog.md`。
- Task 3 结果：`Web batch passed; provider request/response behavior covered by tests.`。

## 限制与故障排查

- 本轮限制：`Degraded: `perplexity.e2e.ts` was not run; no external key/network.`。
- 真实搜索 e2e 需要对应外部 provider 的 key 和网络；无 key 时只能验证配置、请求转换和错误路径。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

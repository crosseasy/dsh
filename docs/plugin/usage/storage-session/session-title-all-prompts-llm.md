# @deepseek-ai/dsh-session-title-all-prompts-llm

## Summary

通过 LLM 总结所有用户提示词，作为会话标题 provider。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-title-all-prompts-llm/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 标题需要综合所有用户提示词，而不是只取第一条。
- 部署已配置 `ctx.llm` 和标题 provider 的共享 LLM 设置。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-title-all-prompts-llm/src/index.ts:34; docs/config-catalog.md`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-title-all-prompts-llm'
```

## 实际使用

- 配置共享标题 LLM provider。
- 让会话出现新的用户提示词。
- provider 用全部符合条件的用户消息生成标题候选。

## 可观察结果

- Provider behavior over all prompts is validated by source-owned tests.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-title-all-prompts-llm/src/index.ts:34; docs/config-catalog.md`。
- 本轮命令证据：C5 `packages/session/session-title-all-prompts-llm/tests/provider.spec.ts`。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- Not mounted in default profile dumps; no real LLM request was run.
- 没有 API key 时，本轮只验证 provider 单元测试，未执行真实标题生成。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

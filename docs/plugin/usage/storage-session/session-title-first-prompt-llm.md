# @deepseek-ai/dsh-session-title-first-prompt-llm

## Summary

通过 LLM 总结第一条用户提示词，作为会话标题 provider。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-title-first-prompt-llm/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 全新会话需要根据第一条用户提示词自动命名。
- 部署已配置 `ctx.llm` 和标题 provider 的共享 LLM 设置。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-title-first-prompt-llm/src/index.ts:34; mounted by packages/bundle/base/cordis.patch.yml:56`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-title-first-prompt-llm'
```

## 实际使用

- 配置共享标题 LLM provider。
- 创建全新非 fork 会话并发送第一条用户提示词。
- provider 为该首条提示词生成标题候选；失败时保留 fallback。

## 可观察结果

- Local provider and Loader composition tests pass; default profiles mount `id: session-title-llm`.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-title-first-prompt-llm/src/index.ts:34; mounted by packages/bundle/base/cordis.patch.yml:56`。
- 本轮命令证据：C1/C2 mount; C5 provider and loader-composition specs; C6 real API e2e skipped。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- Real DeepSeek title generation requires `DEEPSEEK_API_KEY`; C6 skipped that test without the key.
- 没有 `DEEPSEEK_API_KEY` 时，本轮 real API e2e self-skip；只验证本地 provider、Loader composition 和装配。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

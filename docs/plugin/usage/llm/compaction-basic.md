# @deepseek-ai/dsh-compaction-basic

## Summary

在上下文压力升高或显式压缩时，用 LLM 生成摘要并替换较早历史。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/compaction/compaction-basic/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 长会话需要自动压缩，避免上下文窗口溢出。
- 部署希望使用随附的 LLM 摘要后端，而不是自定义压缩 provider。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/compaction/compaction-basic/src/index.ts:432; mounted by packages/bundle/base/cordis.patch.yml:327, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:133, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:273 ...`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-compaction-basic'
```

## 实际使用

- 运行已包含 `compaction-basic` 的 base-backed profile。
- 让会话产生足够长的历史，或通过 `/compact` 触发按需压缩。
- 观察 `compaction/summary` 事件和后续请求的上下文压力变化。

## 可观察结果

- The basic compaction provider is assembled with the base profile and the Loader composition path accepts it. Real summary generation is limited to configuration/mock coverage without `DEEPSEEK_API_KEY`.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/compaction/compaction-basic/src/index.ts:432; mounted by packages/bundle/base/cordis.patch.yml:327, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:133, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:273 ...`。
- 本轮命令证据：Dumps include `compaction-basic`; base patch parse includes `compaction-basic:@deepseek-ai/dsh-compaction-basic`; `packages/compaction/compaction-basic/tests/loader-composition.spec.ts` passed 5 tests.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- 没有 API key 时，本轮只验证 profile 装配、Loader composition 和 mock 路径，没有执行真实摘要请求。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

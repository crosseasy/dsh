# @deepseek-ai/dsh-compaction-tool-result-pruner

## Summary

在压缩前以无模型调用的方式修剪超大文本工具结果。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/compaction/compaction-tool-result-pruner/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 工具输出很长，压缩前需要先缩短模型可见文本。
- 希望降低压缩请求成本，并保留原始工具结果用于回放。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/compaction/compaction-tool-result-pruner/src/index.ts:187; mounted by packages/bundle/base/cordis.patch.yml:405, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:139, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:279 ...`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-compaction-tool-result-pruner'
```

## 实际使用

- 与 `compaction-basic` 一起挂载。
- 让会话包含超出预算的文本工具结果。
- 触发压缩；插件会先替换工具结果的模型可见文本，再由 token meter 判断是否还需要摘要。

## 可观察结果

- Oversized tool-result pruning behavior and reduction accounting are covered by unit tests. It was not exercised inside a live model request.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/compaction/compaction-tool-result-pruner/src/index.ts:187; mounted by packages/bundle/base/cordis.patch.yml:405, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:139, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:279 ...`。
- 本轮命令证据：Dumps include `tool-result-pruner`; base patch parse includes `tool-result-pruner:@deepseek-ai/dsh-compaction-tool-result-pruner`; `packages/compaction/compaction-tool-result-pruner/tests/tool-result-pruner.spec.ts` passed 10 tests.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- 修剪是 model-free 路径；本轮未在真实模型请求中观察修剪后的后续摘要。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

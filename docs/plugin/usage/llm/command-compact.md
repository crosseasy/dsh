# @deepseek-ai/dsh-command-compact

## Summary

提供 `/compact` 斜杠命令，让用户在聊天界面显式触发会话压缩。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/compaction/command-compact/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 用户希望在长会话里立即压缩较早历史。
- 部署已挂载命令注册表与压缩后端。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/compaction/command-compact/src/index.ts:85; mounted by packages/bundle/base/cordis.patch.yml:332, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:136, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:276 ...`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-command-compact'
```

## 实际使用

- 打开已挂载命令适配器的聊天界面。
- 输入 `/compact`。
- 阅读命令结果；成功时较早历史会被摘要替换，近期历史保留。

## 可观察结果

- Manual compact command is mounted in base-backed profiles and its command behavior is covered against the compaction service path. No real summarization call was made because no API key is present.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/compaction/command-compact/src/index.ts:85; mounted by packages/bundle/base/cordis.patch.yml:332, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:136, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:276 ...`。
- 本轮命令证据：Headless and web-curated dumps include `command-compact`; base patch parse includes `command-compact:@deepseek-ai/dsh-command-compact`; `packages/compaction/command-compact/tests/command-compact.spec.ts` passed 11 tests.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。

## 限制与故障排查

- 没有 API key 时，本轮没有执行真实摘要请求；证据只覆盖装配和命令处理测试。
- 没有可压缩历史时会返回 `No compactable history yet.`。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

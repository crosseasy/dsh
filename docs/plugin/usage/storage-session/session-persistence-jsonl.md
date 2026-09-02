# @deepseek-ai/dsh-session-persistence-jsonl

## Summary

把每个会话持久化为仅追加 JSONL 日志，默认使用带校验的 Zstandard 帧。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-persistence-jsonl/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 部署需要产品默认的会话持久化后端。
- 外部工具需要按会话定位或读取日志文件。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-persistence-jsonl/src/index.ts:989; mounted by packages/bundle/base/cordis.patch.yml:111, packages/bundle/sdk-minimal/cordis.patch.yml:165`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-persistence-jsonl'
```

## 实际使用

- 配置日志根目录并启动 profile。
- 让会话追加事件。
- 需要外部读取时调用 `locate(meta)` 或在 `compression: none` 下按行查看日志。

## 可观察结果

- JSONL session persistence writes, loads, rejects malformed persisted events, and supports the mounted `dshHomePath('sessions')` profile config.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-persistence-jsonl/src/index.ts:989; mounted by packages/bundle/base/cordis.patch.yml:111, packages/bundle/sdk-minimal/cordis.patch.yml:165`。
- 本轮命令证据：C1/C2 mount; C4 `packages/session/session-persistence-jsonl/tests/jsonl.spec.ts`。

## 限制与故障排查

- Compression compatibility and Win32-specific tests were not rerun in this收敛 step.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

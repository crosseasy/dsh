# @deepseek-ai/dsh-session-telemetry-otel

## Summary

把会话遥测记录交给 OpenTelemetry 日志管线。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-telemetry-otel/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 部署要把会话记录输出到 OTel 日志管线。
- 需要在保留本地日志不变的同时输出脱敏遥测。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-telemetry-otel/src/index.ts:301; mounted by packages/bundle/base/cordis.patch.yml:191`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-telemetry-otel'
```

## 实际使用

- 配置 OTel 日志导出器或使用本地 fixture collector。
- 让会话产生可导出的记录。
- 插件把脱敏 ledger 记录交给 OTel SDK 日志管线。

## 可观察结果

- OTel telemetry exports redacted ledger records to the fixture collector, keeps canonical logs unmodified, supports feedback-only mode, and prints the disabled-mode warning.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-telemetry-otel/src/index.ts:301; mounted by packages/bundle/base/cordis.patch.yml:191`。
- 本轮命令证据：C1/C2 mount; C5 `otel.spec.ts`; C6 `loader-composition.e2e.ts`。

## 限制与故障排查

- Remote OTLP endpoint was not contacted; fixture collector is the local degradation path.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

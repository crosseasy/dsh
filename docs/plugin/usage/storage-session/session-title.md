# @deepseek-ai/dsh-session-title

## Summary

为会话维护可显示标题，支持回退、显式命名和异步 provider。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-title/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 会话列表需要稳定标题。
- 标题可来自第一条用户消息、显式重命名或异步 provider。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-title/src/index.ts:831; mounted by packages/bundle/base/cordis.patch.yml:49, packages/bundle/sdk-minimal/cordis.patch.yml:85`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-title'
```

## 实际使用

- 启动含本包的 profile。
- 创建新会话或显式重命名。
- 服务接受 fallback、provider 或 user revision，并以 `session/title` 事件持久化。

## 可观察结果

- Fallback/provider title selection, persistence, and projection behavior pass source tests; default profiles mount `id: session-title`.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-title/src/index.ts:831; mounted by packages/bundle/base/cordis.patch.yml:49, packages/bundle/sdk-minimal/cordis.patch.yml:85`。
- 本轮命令证据：C1/C2 mount; C5 `session-title.spec.ts`, `provider.spec.ts`, `persistence.spec.ts`, `projection.spec.ts`。

## 限制与故障排查

- Real LLM title replacement belongs to provider plugins below.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

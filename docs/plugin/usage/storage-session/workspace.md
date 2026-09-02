# @deepseek-ai/dsh-workspace

## Summary

维护持久 workspace 记录，并把会话附加到命名项目目录。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/workspace/workspace/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- Web 或宿主组合需要按项目组织会话。
- 移除 workspace 时只解除分组，不删除目录或会话。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/workspace/workspace/src/index.ts:663; mounted by packages/bundle/web-app/cordis.patch.yml:62`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-workspace'
```

## 实际使用

- 启动 web profile。
- 通过 UI 或 host 服务创建、选择、隐藏或移除 workspace。
- 会话按 workspace 附加；移除 workspace 不删除文件夹或会话。

## 可观察结果

- Workspace state and invariants pass source-owned tests; web profile mounts `id: workspace`.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/workspace/workspace/src/index.ts:663; mounted by packages/bundle/web-app/cordis.patch.yml:62`。
- 本轮命令证据：C2 mount; C8 `workspace.spec.ts`, `invariant.spec.ts`。

## 限制与故障排查

- Host directory picker/UI workflow was outside this scoped verification.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

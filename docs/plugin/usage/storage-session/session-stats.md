# @deepseek-ai/dsh-session-stats

## Summary

把完整会话日志折叠为轮次、步骤、LLM、工具和耗时统计。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-stats/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- UI 需要完整日志口径的轮次、步骤和耗时统计。
- 分页窗口不足以计算全会话统计时。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-stats/src/index.ts:27; mounted by packages/bundle/web-app/cordis.patch.yml:73`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-stats'
```

## 实际使用

- 挂载 `session-projection` 与本包。
- 让会话产生完整轮次和步骤事件。
- 客户端读取 `sessionStats` 投影得到全日志统计。

## 可观察结果

- Session stats projection derives observable counts/state from session events; web profile mounts `id: session-stats`.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-stats/src/index.ts:27; mounted by packages/bundle/web-app/cordis.patch.yml:73`。
- 本轮命令证据：C2 mount; C4 `packages/session/session-stats/tests/projection.spec.ts`。

## 限制与故障排查

- `loader-composition.spec.ts` was not rerun after the user requested immediate收敛.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

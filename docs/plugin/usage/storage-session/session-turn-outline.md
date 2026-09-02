# @deepseek-ai/dsh-session-turn-outline

## Summary

把完整会话日志折叠为每轮的提示词和回复预览。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-turn-outline/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 客户端需要展示每轮提示词与最终回复预览。
- 分页历史尚未加载完整日志，但仍需轮次导航。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-turn-outline/src/index.ts:27; mounted by packages/bundle/web-app/cordis.patch.yml:78`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-turn-outline'
```

## 实际使用

- 挂载 `session-projection` 与本包。
- 让会话产生多个 turn。
- 客户端读取 `turnOutline` 投影，用 seq 定位要分页加载的轮次。

## 可观察结果

- Turn outline registers through Loader composition and projects per-turn outline data.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-turn-outline/src/index.ts:27; mounted by packages/bundle/web-app/cordis.patch.yml:78`。
- 本轮命令证据：C2 mount; C5 `loader-composition.spec.ts`, `projection.spec.ts`。

## 限制与故障排查

- Web visual rendering was not rechecked in Chrome during this收敛 step.
- 本轮没有重复浏览器展示；证据来自 web profile 装配和投影测试。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

# @deepseek-ai/dsh-session-projection

## Summary

注册从会话事件折叠出的逐会话投影，并向客户端提供当前值。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-projection/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 客户端需要读取 todo、goal、统计等日志派生状态。
- 领域包只想注册纯折叠单元，不想自己维护订阅。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-projection/src/index.ts:672; mounted by packages/bundle/base/cordis.patch.yml:139, packages/bundle/sdk-minimal/cordis.patch.yml:39`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-projection'
```

## 实际使用

- 与会话服务一起挂载。
- 领域插件注册投影单元。
- 客户端读取快照或订阅 `session/projection` 推送帧。

## 可观察结果

- Projection units register, compute session views, and dispose cleanly through the registry.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-projection/src/index.ts:672; mounted by packages/bundle/base/cordis.patch.yml:139, packages/bundle/sdk-minimal/cordis.patch.yml:39`。
- 本轮命令证据：C1/C2 mount; C4 `packages/session/session-projection/tests/registry.spec.ts`。

## 限制与故障排查

- UI projection delivery was covered through consumer tests, not a live browser.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

# @deepseek-ai/dsh-authorization

## Summary

让插件通过与用户的授权对话获取可持久化凭据。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/credentials/authorization/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 插件需要让用户完成登录或授权，再把结果交给凭据存储。
- 授权流程必须由 owning plugin 管理，并能失败关闭。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/credentials/authorization/src/index.ts:437; docs/config-catalog.md`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-authorization'
```

## 实际使用

- 挂载需要授权的 provider 插件和本包。
- 当 provider 缺少凭据时，由拥有者发起授权对话。
- 用户完成授权后，授权结果交给凭据 provider 保存。

## 可观察结果

- Authorization records and invariants are validated by source-owned tests.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/credentials/authorization/src/index.ts:437; docs/config-catalog.md`。
- 本轮命令证据：C3 `packages/credentials/authorization/tests/authorization.spec.ts`; C8 invariant spec。

## 限制与故障排查

- Not observed in default headless/web profile dumps; use source tests and config catalog as local degradation evidence.
- 本轮未观察默认 profile 装配；证据来自源码测试和 config catalog 降级路径。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

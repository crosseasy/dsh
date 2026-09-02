# @deepseek-ai/dsh-credentials-local

## Summary

从启动环境、用户凭据文件和 `.env` 层解析并保存本地凭据。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/credentials/credentials-local/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 本机部署需要保存 API key、授权记录或 provider 登录状态。
- 用户可能同时使用环境变量、凭据文件和项目 `.env`。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/credentials/credentials-local/src/index.ts:935; mounted by packages/bundle/base/cordis.patch.yml:98`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-credentials-local'
```

## 实际使用

- 通过启动环境、用户凭据文件、项目 `.env` 或设置界面提供密钥。
- 保存后等待 watcher 热重载。
- 后续 provider 请求按固定优先级读取最新凭据。

## 可观察结果

- Local credentials records persist, migrate, watch external edits, drain pending writes, and redact through the service contract.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/credentials/credentials-local/src/index.ts:935; mounted by packages/bundle/base/cordis.patch.yml:98`。
- 本轮命令证据：C1/C2 mount; C3 `local.spec.ts`; C8 records/migration/watcher/drain specs。

## 限制与故障排查

- No real external credential was stored; tests use local temp roots.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

# @deepseek-ai/dsh-settings-file

## Summary

把用户设置保存到 `settings.yaml` 或 JSON，并在外部编辑后热重载。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/settings/settings-file/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 用户设置需要以可编辑文件保存并热重载。
- 写入方需要保留未触碰 YAML 节点和注释。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/settings/settings-file/src/index.ts:380; mounted by packages/bundle/base/cordis.patch.yml:91`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-settings-file'
```

## 实际使用

- 启动使用默认 harness home 的 profile，或显式配置 settings 文件路径。
- 通过服务或直接编辑文件修改设置。
- 观察热重载结果；非法运行时编辑会保留最后可用设置并告警。

## 可观察结果

- File-backed settings load through real Loader composition, persist local settings, retain last good data over invalid edits, suppress self-write echoes, and handle concurrent file locking.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/settings/settings-file/src/index.ts:380; mounted by packages/bundle/base/cordis.patch.yml:91`。
- 本轮命令证据：C1/C2 mount; C3 `loader-composition.spec.ts`, `local.spec.ts`; C8 watcher/lock/concurrency specs。

## 限制与故障排查

- Abstract `@deepseek-ai/dsh-settings` is covered by C8 but is not directly loadable.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

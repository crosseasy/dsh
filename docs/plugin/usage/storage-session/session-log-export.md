# @deepseek-ai/dsh-session-log-export

## Summary

在 Web 界面提供会话树 ZIP 下载，包括会话、子会话与附件。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session-query/session-log-export/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- Web 用户需要下载会话、子会话和附件做审计或复现。
- 需要一个命令和按钮共享同一归档下载路径。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`client-runtime-plugin`。
- 本轮装配入口：`packages/session-query/session-log-export/src/index.ts:73; mounted by packages/bundle/web-app/cordis.patch.yml:59`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-log-export'
```

## 实际使用

- 启动 web profile。
- 在 Session Header 点击 `Session log`，或输入 `/export`。
- 浏览器收到包含会话树和附件的 ZIP 下载。

## 可观察结果

- Web profile mounts `id: session-log-download`; host route/archive/command and client controller/dialog/header behavior pass source-owned tests.
- Inventory 预期成功信号：The browser plugin roster loads this package and its transport/module/locale service is observable from the Web app.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session-query/session-log-export/src/index.ts:73; mounted by packages/bundle/web-app/cordis.patch.yml:59`。
- 本轮命令证据：C2 mount; C9 controller/header/archive/client/route/invariant/command/dialog specs。

## 限制与故障排查

- Live browser download was not repeated; tests cover host and client logic without Chrome.
- 本轮没有重复执行浏览器下载；证据来自 web profile 装配和 host/client 源码测试。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

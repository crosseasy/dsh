# @deepseek-ai/dsh-attachment-local

## Summary

在 `DSH_HOME` 下保存内容寻址附件与规范化图片，并缓存请求变体。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/attachment/attachment-local/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 会话包含用户或工具提供的图片、文件附件。
- 部署接受附件只保存在本机 `DSH_HOME` 中。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/attachment/attachment-local/src/index.ts:268; mounted by packages/bundle/base/cordis.patch.yml:119`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-attachment-local'
```

## 实际使用

- 启动包含 base 存储层的 profile。
- 通过 UI、工具或测试入口提交图片/附件。
- 后端保存内容寻址对象，并为模型请求生成路由专用图片变体。

## 可观察结果

- Local attachment store publishes content-addressed objects, deduplicates equal bytes, normalizes input, and routes image request encodings correctly.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/attachment/attachment-local/src/index.ts:268; mounted by packages/bundle/base/cordis.patch.yml:119`。
- 本轮命令证据：C1/C2 mount; C7 index/store/request-image specs; C9 image/encoding/normalization/verification specs。

## 限制与故障排查

- One store test skipped in C7 due environment/platform guard; live UI attachment flow was not repeated.
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

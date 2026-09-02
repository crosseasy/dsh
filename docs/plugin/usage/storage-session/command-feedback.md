# @deepseek-ai/dsh-command-feedback

## Summary

提供 `/feedback` 命令，把用户反馈写入会话侧记录而不启动模型。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/feedback/command-feedback/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 用户想给整段会话提交文字反馈。
- 反馈不应进入模型上下文，也不应启动新轮次。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/feedback/command-feedback/src/index.ts:100; mounted by packages/bundle/base/cordis.patch.yml:296`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-command-feedback'
```

## 实际使用

- 在 Web 聊天界面输入 `/feedback <text>`。
- 命令立即写入反馈记录并返回确认。
- 不会触发模型轮次，也不会把反馈文本加入模型历史。

## 可观察结果

- Command feedback command registers through Loader composition and records the expected feedback events.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/feedback/command-feedback/src/index.ts:100; mounted by packages/bundle/base/cordis.patch.yml:296`。
- 本轮命令证据：C1/C2 mount; C7 `command-feedback.spec.ts`, `loader-composition.spec.ts`。

## 限制与故障排查

- Interactive command invocation in a live UI was not performed.
- 本轮没有在 live UI 中输入 `/feedback`；证据来自 profile 装配和命令测试。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

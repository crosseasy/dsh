# @deepseek-ai/dsh-message-feedback

## Summary

为单条 assistant 消息保存评分和备注，供 Web UI 读取和修改。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/feedback/message-feedback/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- Web UI 要保存针对某条 assistant 消息的好评、差评或备注。
- 评分需要随会话存储而保留，但不进入模型历史。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/feedback/message-feedback/src/index.ts:383; mounted by packages/bundle/web-app/cordis.patch.yml:53`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-message-feedback'
```

## 实际使用

- 在 Web UI 对某条 assistant 消息选择评分并可填写备注。
- 服务把评分绑定到目标消息并保存。
- 列表或重新打开会话时读取该消息的当前反馈。

## 可观察结果

- Message feedback service records and validates feedback through source-owned tests; web profile mounts `id: message-feedback`.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/feedback/message-feedback/src/index.ts:383; mounted by packages/bundle/web-app/cordis.patch.yml:53`。
- 本轮命令证据：C2 mount; C7 `message-feedback.spec.ts`, `loader-composition.spec.ts`。

## 限制与故障排查

- Browser feedback UI was not rechecked.
- 本轮没有重复浏览器评分 UI；证据来自 web profile 装配和服务测试。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

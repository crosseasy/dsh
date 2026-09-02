# @deepseek-ai/dsh-tool-session-query

## Summary

向模型暴露会话历史搜索、追踪和事件读取工具。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session-query/tool-session-query/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 模型需要查找既往会话事件、来源链路或相关历史。
- 访问范围必须限制在调用方相同 cwd 的会话。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`tool-plugin`。
- 本轮装配入口：`packages/session-query/tool-session-query/src/index.ts:57; docs/tool-catalog.md`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md)；工具 schema 另见 [工具目录](../../../tool-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-tool-session-query'
```

## 实际使用

- 让模型调用 `session_search` 或相关只读工具。
- 模型只能查询与调用方相同 cwd 的会话。
- 结果以无游标纯文本返回，适合继续读取事件或追踪来源。

## 可观察结果

- Model-facing session query tool schema and execution behavior return expected local results and errors.
- Inventory 预期成功信号：A real agent exposes the documented model-visible tool schema and records a tool/call plus tool/result on invocation.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session-query/tool-session-query/src/index.ts:57; docs/tool-catalog.md`。
- 本轮命令证据：C4 `packages/session-query/tool-session-query/tests/tool-session-query.spec.ts`。

## 限制与故障排查

- The separate `sqlite-integration.spec.ts` was not rerun after the user requested immediate收敛.
- 本轮没有通过真实 LLM 调用工具；证据来自工具 schema 与执行行为测试。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

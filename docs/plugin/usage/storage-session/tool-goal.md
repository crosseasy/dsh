# @deepseek-ai/dsh-tool-goal

## Summary

向模型暴露 `get_goal`、`create_goal` 和 `update_goal` 三个同会话目标工具。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/goal/tool-goal/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 模型需要读取或更新当前 goal。
- 权限需要根据当前轮次的人类消息或 Goal Round 在执行时判断。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`tool-plugin`。
- 本轮装配入口：`packages/goal/tool-goal/src/index.ts:186; mounted by packages/bundle/base/cordis.patch.yml:419, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:86, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:226 ...`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md)；工具 schema 另见 [工具目录](../../../tool-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-tool-goal'
```

## 实际使用

- 让模型读取当前目标或根据用户直接请求创建目标。
- 模型用精确 id 与 revision 调用更新工具。
- 工具把变更写成 goal 事件，并由投影显示新状态。

## 可观察结果

- Model-facing goal tool schema and execution behavior pass source-owned tests.
- Inventory 预期成功信号：A real agent exposes the documented model-visible tool schema and records a tool/call plus tool/result on invocation.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/goal/tool-goal/src/index.ts:186; mounted by packages/bundle/base/cordis.patch.yml:419, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:86, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:226 ...`。
- 本轮命令证据：C1 enabled; C2 disabled in web; C7 `tool-goal.spec.ts`。

## 限制与故障排查

- No live model tool call was made through a real LLM.
- Web profile 默认禁用该模型工具；本轮没有真实 LLM 工具调用。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

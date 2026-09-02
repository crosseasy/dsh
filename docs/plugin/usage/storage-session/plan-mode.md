# @deepseek-ai/dsh-plan-mode

## Summary

让 agent 进入需用户批准后才执行的计划模式，并记录计划状态。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/plan/plan-mode/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- 用户希望 agent 先提交计划并等待批准。
- 会话恢复或 fork 后仍要保留计划模式状态。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`tool-plugin`。
- 本轮装配入口：`packages/plan/plan-mode/src/index.ts:464; mounted by packages/bundle/base/cordis.patch.yml:308, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:99, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:239 ...`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md)；工具 schema 另见 [工具目录](../../../tool-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-plan-mode'
```

## 实际使用

- 在支持命令的会话输入 `/plan` 或由工具进入计划模式。
- 让 agent 输出计划并请求批准。
- 批准后才进入执行；`/plan off` 可退出。

## 可观察结果

- `exit_plan_mode`/plan-mode integration, projection, and invariants pass source-owned tests; headless dump shows configured plan-mode instructions.
- Inventory 预期成功信号：A real agent exposes the documented model-visible tool schema and records a tool/call plus tool/result on invocation.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/plan/plan-mode/src/index.ts:464; mounted by packages/bundle/base/cordis.patch.yml:308, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:99, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:239 ...`。
- 本轮命令证据：C1 enabled; C2 disabled in web; C7 plan-mode specs; C9 invariant spec。

## 限制与故障排查

- No interactive plan approval UI was exercised.
- Web profile 默认禁用模型侧 mutation 工具；本轮没有执行交互式计划批准 UI。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

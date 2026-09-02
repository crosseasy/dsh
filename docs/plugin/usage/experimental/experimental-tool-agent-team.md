# @deepseek-ai/dsh-experimental-tool-agent-team 使用指南

## Summary

向模型暴露实验 Team 工具，用于创建 teammate、发送消息、等待进展和管理任务板。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要让模型显式创建并协调 teammate。
- 需要在 Team domain 之上使用 scoped 工具。
- 本页按 inventory 的 `experimental` 分类处理：它记录源码 checkout 中可观察或可解析的实验装配，不表示稳定发布 API。
- 未在本轮证据中执行的 UI、Team runtime 或真实工具调用，不在本页声明为已验证。

## 启用与启动

- Inventory 分类：`experimental`；类型：`tool-plugin`。
- Inventory 装配入口：`packages/experimental/tool-agent-team/src/index.ts:398; mounted by packages/experimental/agent-team-profile/cordis.patch.yml:37`。
- Inventory 类型为 `tool-plugin`，通过目标 profile 的 Cordis 行挂载。
- 工具 schema 由生成的工具目录维护；本轮只记录 inventory 与验证文件中已经确认的范围。
```yaml
- name: '@deepseek-ai/dsh-experimental-tool-agent-team'
```


## 实际使用

- 通过 experimental-agent-team-profile 的 `tool-agent-team` 行启用。
- 让模型调用 Team 工具前，确保 agent-team 服务已挂载。

## 可观察结果

- The bundle declares the model-visible tool row. No live agent/tool invocation was made because no key and no active team run were available.
- Inventory 预期成功信号：A real agent exposes the documented model-visible tool schema and records a tool/call plus tool/result on invocation.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Profile assembly through experimental bundle and source/test entry。
- 证据记录：Mounted by `packages/experimental/agent-team-profile/cordis.patch.yml`; source/test entry: `packages/experimental/tool-agent-team/src/index.ts`, `packages/experimental/tool-agent-team/tests/tool-team.spec.ts`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 实验工具 schema 不承诺稳定；本轮没有真实 agent/tool 调用。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

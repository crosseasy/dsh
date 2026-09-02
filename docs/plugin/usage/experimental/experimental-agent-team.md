# @deepseek-ai/dsh-experimental-agent-team 使用指南

## Summary

提供实验 Team domain：Lead、teammate roster、持久 mailbox 和共享任务 DAG。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要在一个会话中运行具名 teammate 团队。
- 需要消息和任务状态通过会话日志持久化。
- 本页按 inventory 的 `experimental` 分类处理：它记录源码 checkout 中可观察或可解析的实验装配，不表示稳定发布 API。
- 未在本轮证据中执行的 UI、Team runtime 或真实工具调用，不在本页声明为已验证。

## 启用与启动

- Inventory 分类：`experimental`；类型：`experimental-plugin`。
- Inventory 装配入口：`packages/experimental/agent-team/src/index.ts:324; mounted by packages/experimental/agent-team-profile/cordis.patch.yml:28`。
- Inventory 类型为 `experimental-plugin`，通过目标 profile 的 Cordis 行挂载。
- 手动组合时，将插件行加入目标 `cordis.yml`，并确认依赖服务也在同一配置树中。
```yaml
- name: '@deepseek-ai/dsh-experimental-agent-team'
```


## 实际使用

- 通过 experimental-agent-team-profile 的 `agent-team` 行启用。
- 与 experimental-tool-agent-team 一起挂载，让模型能创建和协调 teammate。

## 可观察结果

- The bundle declares the service row. Runtime roster, mailbox, and task DAG behavior were not re-run after the immediate convergence request.
- Inventory 预期成功信号：Observable behavior matches package purpose: Implicit-root Agent Teams roster, durable peer mailbox, and shared task DAG

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Profile assembly through experimental bundle and source/test entry。
- 证据记录：Mounted by `packages/experimental/agent-team-profile/cordis.patch.yml`; source/test entry: `packages/experimental/agent-team/src/index.ts`, `packages/experimental/agent-team/tests/team.spec.ts`, `persistence.spec.ts`, and `projection-events.spec.ts`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 实验服务不进入稳定发布；本轮只验证 bundle 声明和源码/测试入口，未运行 Team roster/mailbox/DAG。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

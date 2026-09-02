# @deepseek-ai/dsh-persona 使用指南

## Summary

在 preset 组合内部注册会话级 persona 段落，改变单个 agent 的系统提示词身份。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 某个 preset 需要不同于部署默认值的人设。
- 需要在 agent preset 文件中声明完整或局部 persona。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`profile-plugin`。
- Inventory 装配入口：`packages/preset/persona/src/index.ts:56; mounted by packages/preset/agent-presets/presets/cordis/agent.cordis.yml:18, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:44, packages/preset/agent-presets/presets/minimal/agent.cordis.yml:10 ...`。
- Inventory 类型为 `profile-plugin`，通过 profile 或 preset 组合挂载。
- preset 相关行为以 `agent.cordis.yml` 为装配入口；请在目标 preset 或 Web profile 组合中确认该行。
```yaml
- name: '@deepseek-ai/dsh-persona'
```


## 实际使用

- 在目标 preset 的 `agent.cordis.yml` 中挂载本插件。
- 不要把本插件作为全局 profile 行使用；它属于 preset scope。

## 可观察结果

- Persona plugin is a preset-owned profile plugin. No separate runtime invocation was executed here.
- Inventory 预期成功信号：Observable behavior matches package purpose: Composition-authored deployment persona section for the DeepSeek Harness

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Static source and preset-reference validation。
- 证据记录：Inventory points to `packages/preset/persona/src/index.ts` and preset mounts under `packages/preset/agent-presets/presets/*/agent.cordis.yml`; source/test entry: `packages/preset/persona/tests/persona.spec.ts`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本轮只验证 preset 文件引用和源码/测试入口；没有单独执行 persona 渲染。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

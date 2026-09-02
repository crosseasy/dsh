# @deepseek-ai/dsh-agent-presets 使用指南

## Summary

按 preset 的 `agent.cordis.yml` 为每个 agent 会话组装工具、提示词段落和 skill。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要 Web 会话按 preset 切换 agent 组合。
- 需要排查 preset 装配是否进入 web-app 层。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`profile-plugin`。
- Inventory 装配入口：`packages/preset/agent-presets/src/index.ts:1017; mounted by packages/bundle/web-app/cordis.patch.yml:448`。
- Inventory 类型为 `profile-plugin`，通过 profile 或 preset 组合挂载。
- preset 相关行为以 `agent.cordis.yml` 为装配入口；请在目标 preset 或 Web profile 组合中确认该行。
```yaml
- name: '@deepseek-ai/dsh-agent-presets'
```


## 实际使用

- 通过 web-app 的 `agent-presets` 行启用。
- 查看 shipped preset 或 `<dshHome>/.agent-presets` 中的 `agent.cordis.yml`。

## 可观察结果

- Profile plugin row is assembled by web-app. Preset runtime behavior was not separately executed in this curtailed pass.
- Inventory 预期成功信号：Observable behavior matches package purpose: Per-session agent composition from preset cordis.yml files for the DeepSeek Harness

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Web-app patch parse and source/test entry。
- 证据记录：Patch parse for `@deepseek-ai/dsh-web-app` includes `agent-presets:@deepseek-ai/dsh-agent-presets`; source/test entry: `packages/preset/agent-presets/src/index.ts`, `packages/preset/agent-presets/tests/*.spec.ts`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本轮只验证 web-app patch 声明和源码/测试入口；没有单独执行 preset runtime 行为。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

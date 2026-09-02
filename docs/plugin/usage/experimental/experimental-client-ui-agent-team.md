# @deepseek-ai/dsh-experimental-client-ui-agent-team 使用指南

## Summary

在实验 Web 会话页头提供 Agent Teams roster、任务板和 teammate 导航入口。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要从浏览器查看实验 Team roster。
- 需要管理共享任务板并跳转 teammate 会话。
- 本页按 inventory 的 `experimental` 分类处理：它记录源码 checkout 中可观察或可解析的实验装配，不表示稳定发布 API。
- 未在本轮证据中执行的 UI、Team runtime 或真实工具调用，不在本页声明为已验证。

## 启用与启动

- Inventory 分类：`experimental`；类型：`client-ui-plugin`。
- Inventory 装配入口：`packages/experimental/client-ui-agent-team/src/index.ts:4; mounted by packages/experimental/agent-team-web-profile/cordis.patch.yml:6`。
- Inventory 类型为 `client-ui-plugin`，通过目标 profile 的 Cordis 行挂载。
- 手动组合时，将插件行加入目标 `cordis.yml`，并确认依赖服务也在同一配置树中。
```yaml
- name: '@deepseek-ai/dsh-experimental-client-ui-agent-team'
```


## 实际使用

- 通过 experimental-agent-team-web-profile 的 `ui-agent-team` 行启用。
- 打开 Web UI 后在对话标题栏查看 Team action。

## 可观察结果

- Web UI row is declared by the profile. UI slot rendering was out of scope and not claimed.
- Inventory 预期成功信号：Chrome CDP observes the owned UI slot, card, panel, setting, or conversation view with no new console error.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Bundle patch parse and static source/test entry。
- 证据记录：Mounted by the experimental web profile as `ui-agent-team`; source/test entry: `packages/experimental/client-ui-agent-team/src/index.ts`, `packages/experimental/client-ui-agent-team/tests/*.spec.tsx`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 实验 UI 不进入稳定发布；本轮没有新增截图，也没有执行浏览器 UI 路径。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

# @deepseek-ai/dsh-experimental-agent-team-profile 使用指南

## Summary

提供叠加在 base 上的实验 Agent Teams Host profile 层，插入 Team 服务和 Team scoped 工具。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要在源码 checkout 中试用 Agent Teams。
- 需要保留一次性 delegation，同时禁用重名的全局 continuable-child controls。
- 本页按 inventory 的 `experimental` 分类处理：它记录源码 checkout 中可观察或可解析的实验装配，不表示稳定发布 API。
- 未在本轮证据中执行的 UI、Team runtime 或真实工具调用，不在本页声明为已验证。

## 启用与启动

- Inventory 分类：`experimental`；类型：`experimental-bundle`。
- Inventory 装配入口：`packages/experimental/agent-team-profile/cordis.patch.yml (bundle manifest dsh.bundle.patch)`。
- Inventory 类型为 `experimental-bundle`，manifest 使用 `dsh.bundle.patch` 指向 `packages/experimental/agent-team-profile/cordis.patch.yml`。
- 作为 profile 层使用时，用 `dsh plugin --profile <name> add <package-or-local-path>` 加入目标 profile；随发行版 profile 已包含的 bundle 不需要重复添加。
```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-experimental-agent-team-profile
```


## 实际使用

- 在已包含 base 的 profile 中添加该 bundle。
- 用 patch 解析或 profile dump 确认 agent-team 与 tool-agent-team 行。

## 可观察结果

- Host experimental agent-team profile layer is parseable and declares the service and tool rows. The team runtime was not executed.
- Inventory 预期成功信号：Loader entry list contains the patch rows declared by the bundle manifest.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Bundle patch parse。
- 证据记录：Patch parse reported `patch=./cordis.patch.yml`, `entries=6`, rows `agent-team:@deepseek-ai/dsh-experimental-agent-team` and `tool-agent-team:@deepseek-ai/dsh-experimental-tool-agent-team`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 实验 profile 不进入稳定发布；本轮未执行 Team runtime。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

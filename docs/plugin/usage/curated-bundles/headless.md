# @deepseek-ai/dsh-headless 使用指南

## Summary

提供一次性命令行任务 profile 层，直接驱动 agent 运行单个任务并退出。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要脚本或 CI 运行一个 dsh 任务。
- 需要无浏览器、无 HTTP server 的命令行表层。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`bundle`。
- Inventory 装配入口：`packages/bundle/headless/cordis.patch.yml (bundle manifest dsh.bundle.patch)`。
- Inventory 类型为 `bundle`，manifest 使用 `dsh.bundle.patch` 指向 `packages/bundle/headless/cordis.patch.yml`。
- 作为 profile 层使用时，用 `dsh plugin --profile <name> add <package-or-local-path>` 加入目标 profile；随发行版 profile 已包含的 bundle 不需要重复添加。
```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-headless
```


## 实际使用

- 运行 `pnpm dsh --profile headless "<task>"`。
- 没有模型密钥时先用 `--dump-default-config` 验证组合。

## 可观察结果

- Headless bundle is parseable and contributes the one-shot runner rows. A headless task was not run because no model key is present.
- Inventory 预期成功信号：Loader entry list contains the patch rows declared by the bundle manifest.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Profile dump and bundle patch parse。
- 证据记录：Headless dump includes base LLM/compaction rows and the headless layer; patch parse reported `headless-startup:@deepseek-ai/dsh-headless/startup` and `headless-runner:@deepseek-ai/dsh-headless`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本轮没有执行真实 headless 模型任务，因为没有 provider key。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

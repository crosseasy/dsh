# @deepseek-ai/dsh-base 使用指南

## Summary

提供 base-backed profile 的共享核心层，插入模型、工具、会话、权限、存储、web 和 agent-loop 等基础行。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要为自定义 profile 提供共享 dsh 核心能力。
- 需要确认 headless 或 web-curated 等 profile 继承的基础插件集合。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`bundle`。
- Inventory 装配入口：`packages/bundle/base/cordis.patch.yml (bundle manifest dsh.bundle.patch)`。
- Inventory 类型为 `bundle`，manifest 使用 `dsh.bundle.patch` 指向 `packages/bundle/base/cordis.patch.yml`。
- 作为 profile 层使用时，用 `dsh plugin --profile <name> add <package-or-local-path>` 加入目标 profile；随发行版 profile 已包含的 bundle 不需要重复添加。
```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-base
```


## 实际使用

- 让目标 profile 把本 bundle 放在第一层。
- 用 profile dump 确认基础行已经进入最终配置。

## 可观察结果

- Base bundle contributes the shared provider, metering, compaction, and tool rows used by base-backed profiles.
- Inventory 预期成功信号：Loader entry list contains the patch rows declared by the bundle manifest.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Profile dump and bundle patch parse。
- 证据记录：Headless and web-curated dumps show base LLM/compaction/token rows; patch parse reported `entries=1`, `ids=86`, including LLM, retry, pi-ai, token-meter, compaction, web, and DeepSeek adapter rows.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本轮没有逐一运行 base 插入的每个插件；各插件行为由各自指南和测试负责。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

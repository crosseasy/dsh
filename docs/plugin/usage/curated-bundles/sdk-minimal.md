# @deepseek-ai/dsh-sdk-minimal 使用指南

## Summary

提供独立的极简 SDK profile，显式组合 JSON-RPC、DeepSeek adapter、持久 shell、编辑器和 JSONL 会话。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- SDK 客户端需要小型、跨平台、无 base/web/settings 的 coding-agent runtime。
- 需要 danger-full-access 双工具 profile，并能接受隔离 workspace 前提。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`bundle`。
- Inventory 装配入口：`packages/bundle/sdk-minimal/cordis.patch.yml (bundle manifest dsh.bundle.patch)`。
- Inventory 类型为 `bundle`，manifest 使用 `dsh.bundle.patch` 指向 `packages/bundle/sdk-minimal/cordis.patch.yml`。
- 作为 profile 层使用时，用 `dsh plugin --profile <name> add <package-or-local-path>` 加入目标 profile；随发行版 profile 已包含的 bundle 不需要重复添加。
```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-sdk-minimal
```


## 实际使用

- 运行 `pnpm dsh --profile sdk-minimal --dump-default-config` 检查组合。
- 真实调用前提供 `DEEPSEEK_API_KEY`，并使用隔离 workspace。

## 可观察结果

- Standalone SDK-minimal composition is parseable and intentionally omits base-backed compaction/token-meter rows. No SDK model call was made.
- Inventory 预期成功信号：Loader entry list contains the patch rows declared by the bundle manifest.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Profile dump and bundle patch parse。
- 证据记录：Sdk-minimal dump includes `deepseek-llm-api-extensions`, `plugin-package-inventory-deepseek`, `llm-deepseek`, `llm`, and `llm-retry`; patch parse reported `entries=1`, `ids=33`, including SDK startup/server and LLM rows.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本轮只验证配置 dump 与 patch 解析；没有执行 SDK 模型调用。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

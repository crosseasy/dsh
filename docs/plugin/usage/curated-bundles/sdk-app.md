# @deepseek-ai/dsh-sdk-app 使用指南

## Summary

提供 SDK stdio JSON-RPC 应用层，在 base 之上声明 SDK startup 与 JSON-RPC server 行。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要 TypeScript 或 Python SDK 通过 stdio 连接 harness runtime。
- 需要 base-backed SDK profile，而不是极简独立树。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`bundle`。
- Inventory 装配入口：`packages/bundle/sdk-app/cordis.patch.yml (bundle manifest dsh.bundle.patch)`。
- Inventory 类型为 `bundle`，manifest 使用 `dsh.bundle.patch` 指向 `packages/bundle/sdk-app/cordis.patch.yml`。
- 作为 profile 层使用时，用 `dsh plugin --profile <name> add <package-or-local-path>` 加入目标 profile；随发行版 profile 已包含的 bundle 不需要重复添加。
```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-sdk-app
```


## 实际使用

- SDK 客户端启动 `dsh --profile sdk` 或等价 profile。
- 通过 JSON-RPC 初始化 session 并让 server 处理请求。

## 可观察结果

- SDK app layer declares startup and JSON-RPC server rows. SDK stdio runtime was not launched.
- Inventory 预期成功信号：Loader entry list contains the patch rows declared by the bundle manifest.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Bundle patch parse。
- 证据记录：Patch parse reported `sdk-app-startup:@deepseek-ai/dsh-sdk-app` and `sdk-jsonrpc-server:@deepseek-ai/dsh-sdk-jsonrpc-server`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本轮只验证 patch 可解析和行声明；未启动 SDK stdio runtime。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

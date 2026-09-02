# @deepseek-ai/dsh-lsp-stdio 使用指南

## Summary

`@deepseek-ai/dsh-lsp-stdio` 通过 stdio 启动语言服务器，并把 JSON-RPC 结果翻译成 DSH 的 LSP 查询结果。 本指南记录当前 checkout 中可复现的启用方式、触发入口和观察信号。该插件在 inventory 中归类为 `tools-runtime`，类型为Service Provider 插件。本轮证据来自 `/tmp/dsh-plugin-usage-evidence/verification-tools-workflow.md`；对外部凭据、真实 provider 或已知失败分支，本页只写已验证范围。

## 适用场景

- 需要通过 stdio 管理语言服务器进程。
- 需要把语言服务器 JSON-RPC 响应标准化。

## 启用与启动

- 该插件是可加载插件。把包名写入目标 `cordis.yml` 或 profile patch，并按配置目录提供必需字段。
- Headless profile 可用 `pnpm dsh --profile headless --dump-default-config` 检查组合中是否包含相关运行时或工具插件。

## 实际使用

- 在配置中声明语言服务器启动命令。
- 加载 `lsp-stdio` provider。
- 通过 `lsp` 工具查询一个源文件位置。

## 可观察结果

- 成功路径会让依赖服务、provider 或 registry 的下游工具返回结果。
- 本轮观察信号见验证证据中的 Task 3 结果：`LSP batch passed; stdio framing/lifecycle/translation covered.`。

## 验证证据

- inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中该条目的分类是 `tools-runtime`，文档目标是 `docs/plugin/usage/tools-runtime/lsp-stdio.md`，`exclusionReason` 为 `null`。
- 源码入口：[packages/lsp/lsp-stdio/src/index.ts](../../../../packages/lsp/lsp-stdio/src/index.ts)。
- inventory 验证入口：`packages/lsp/lsp-stdio/src/index.ts:126; docs/config-catalog.md`。
- Task 3 验证方法：`Focused unit tests`。
- Task 3 证据条目：`packages/lsp/lsp-stdio/tests/provider.spec.ts; instance.spec.ts; connection.spec.ts; framing.spec.ts; translate.spec.ts; lifecycle.spec.ts`。
- Task 3 结果：`LSP batch passed; stdio framing/lifecycle/translation covered.`。

## 限制与故障排查

- 本轮限制：``typescript-server.e2e.ts` and built-lib e2e were not run.`。
- 如果插件不可见，先确认 profile dump 中包含包名，再按 evidence 表中的测试文件定位失败路径。

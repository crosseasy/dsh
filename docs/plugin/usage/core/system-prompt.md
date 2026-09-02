# @deepseek-ai/dsh-system-prompt

## Summary

`dsh-system-prompt` 组装每个模型 step 的系统提示和工具 schema。插件可贡献有序 prompt section、运行时上下文、工具 schema provider 和变量。

## 适用场景

- 部署需要设置 harness identity、persona 或模型可见 tool order。
- 插件需要给 system prompt 添加稳定 section 或动态 runtime context。
- agent scope 需要覆盖全局 prompt 贡献。

## 启用与启动

- headless、web 和 sdk 默认配置 dump 都显示该插件。
- base 配置 `persona: ""`；其他 overlay 可设置部署 persona、runtime context 和 tool order。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-system-prompt'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 在 profile config 中设置 `includeHarnessIdentity`、`includeRuntimeContext`、`persona` 或 `toolOrder`。
- 插件通过 registry 添加 prompt section 或工具 schema provider。
- agent loop 在每个 step 调用 assembly，把结果写入 request header 并发送给模型。

## 可观察结果

- 模型请求包含按顺序渲染的 system prompt 与当前可见工具 schema。
- 未知 tool name 或缺失变量会在 assembly 或 load 阶段失败。
- 源码测试覆盖 assembly、scoped override、tool order 和 invariant。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-system-prompt`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/system-prompt.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:480, packages/bundle/sdk-minimal/cordis.patch.yml:92, packages/curated/curated-profiles/tests/fixtures/behavior-bundle/cordis.patch.yml:3`；源码入口见 [packages/core/system-prompt/src/index.ts](../../../../packages/core/system-prompt/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1、C2；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/core/system-prompt/README.md`](../../../../packages/core/system-prompt/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-system-prompt)。
- 源码测试路径：`packages/core/system-prompt/tests/system-prompt.spec.ts`、`packages/core/system-prompt/tests/scoped.spec.ts`、`packages/core/system-prompt/tests/tool-order.spec.ts`、`packages/core/system-prompt/tests/invariant.spec.ts`。

## 限制与故障排查

- 本轮没有真实模型请求，因此未捕获 provider 实际收到的 prompt。
- 模型可见的新增上下文必须同时可从 session log 重建。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

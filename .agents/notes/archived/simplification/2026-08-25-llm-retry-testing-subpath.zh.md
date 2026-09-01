# Agent Note: LLM retry testing subpath

Status: implemented
Archived: 2026-08-26

[English](2026-08-25-llm-retry-testing-subpath.md) | 中文

## Problem

`RetryInternals` 和确定性重试安装入口只服务于仓库测试，用于替换 jitter 采样。从 `@deepseek-ai/dsh-llm-retry` 暴露它们，会让不可序列化的测试 hook 看起来像生产重试策略配置。

## Decision

`@deepseek-ai/dsh-llm-retry/testing` 拥有 `RetryInternals` 和确定性的 `apply(ctx, config, internals)` 入口。包根入口导出生产插件契约：`name`、`inject`、空 `Config`、`apply(ctx, config)`、`RetryId` 和持久重试事件类型。

生产入口和测试入口共享同一个私有安装器，因此确定性测试会运行生产重试实现，而根入口不能接受第三个参数。

包导出把 `./testing` 指向 `lib/types/testing.js` 和 `lib/types/testing.d.ts`，匹配该包现有的类型输出子路径模式，而不新增运行时 bundle 入口。

## Alternatives considered

**继续从包根入口暴露 `RetryInternals`。** 被拒绝，因为包根入口是生产插件 API。这些 hook 是没有生产调用方的不可序列化时序控制；把它们留在 `Config` 旁边会暗示部署支持。

**把随机采样器做成插件配置字段。** 被拒绝，因为重试 jitter 是提供方重试设置拥有的生产策略细节；确定性随机数是测试需要，不是部署配置能力。

**在测试中复制重试监听器。** 被拒绝，因为测试将不再运行生产组合使用的同一套恢复生命周期、dispose 和持久事件代码。

## Consequences

生产代码从 `@deepseek-ai/dsh-llm-retry` 导入时无法访问确定性 hook，也不能用测试专用第三参数调用 `apply()`。需要确定性 jitter 的仓库测试依赖 testing 子路径，使测试专用用法可搜索，同时保留生产重试行为和事件契约。

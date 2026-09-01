# Agent Note: Tools testing subpath

Status: implemented
Archived: 2026-08-26

[English](2026-08-25-tools-testing-subpath.md) | 中文

## Problem

`defineContentToolFixture` 只服务于仓库测试，这些测试有意把呈现内容当作规范工具值。从 `@deepseek-ai/dsh-tools` 暴露这个 fixture，会让仅用于测试的 helper 看起来像生产工具作者 API 的一部分。

## Decision

`@deepseek-ai/dsh-tools/testing` 拥有 `defineContentToolFixture` 和 `ContentToolFixtureOptions`。包根入口导出生产包使用的注册表、schema、执行、Code Mode 和呈现约定；测试通过显式 testing 子路径导入该 fixture。

包导出把 `./testing` 指向 `lib/types/testing.js` 和 `lib/types/testing.d.ts`，匹配该包现有的类型输出子路径模式，而不新增运行时 bundle 入口。

## Alternatives considered

**继续从包根入口暴露该 fixture。** 被拒绝，因为包根入口是工具作者和消费方使用的生产 API。content-as-value helper 被有意限定为测试用途；继续暴露会保留一个没有生产调用方、但看起来属于生产 API 的入口。

**把 fixture 移到共享 test-support 包。** 被拒绝，因为该 helper 专属于 tools 包的 schema 与执行类型。单独建包会增加另一条依赖边，而不会让该 helper 在面向 tools 的测试之外变得有用。

**在每个测试中内联原始工具定义。** 被拒绝，因为重复的 fixture 会让测试反复重述同一个规范 content-value 输出 schema，并隐藏它们把内容用作值的原因。

## Consequences

生产代码从 `@deepseek-ai/dsh-tools` 导入时无法访问该 content fixture。需要该 fixture 的仓库测试依赖 testing 子路径，使测试专用用法可搜索，并由 package export 检查负责该子路径。

# Agent Note: LLM retry testing subpath

Status: implemented
Archived: 2026-08-26

English | [中文](2026-08-25-llm-retry-testing-subpath.zh.md)

## Problem

`RetryInternals` and the deterministic retry installer exist so repository tests can replace jitter sampling. Exposing them from `@deepseek-ai/dsh-llm-retry` made non-serializable test hooks look like production retry policy configuration.

## Decision

`@deepseek-ai/dsh-llm-retry/testing` owns `RetryInternals` and the deterministic `apply(ctx, config, internals)` entry point. The package root exports the production plugin contract: `name`, `inject`, empty `Config`, `apply(ctx, config)`, `RetryId`, and the durable retry event types.

The production and testing entries share the same private installer, so deterministic tests exercise the production retry implementation while the root entry cannot accept a third argument.

The package export points `./testing` at `lib/types/testing.js` and `lib/types/testing.d.ts`, matching the package's existing type-output subpath pattern without adding a runtime bundle entry.

## Alternatives considered

**Keep `RetryInternals` on the package root.** Rejected because the root is the production plugin API. The hooks are non-serializable timing controls with no production caller, and keeping them beside `Config` would imply deployment support.

**Make the random sampler a plugin config field.** Rejected because retry jitter is a production policy detail owned by provider retry settings; deterministic randomness is a test need, not deployment configurability.

**Duplicate the retry listener in tests.** Rejected because tests would stop exercising the same recovery lifecycle, disposal, and durable event code that production composition uses.

## Consequences

Production imports from `@deepseek-ai/dsh-llm-retry` cannot access deterministic hooks or call `apply()` with a test-only third argument. Repository tests that need deterministic jitter depend on the testing subpath, making test-only use searchable while preserving the production retry behavior and event contracts.

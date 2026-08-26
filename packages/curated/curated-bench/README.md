# `@deepseek-ai/dsh-curated-bench`

English | [中文](README.zh.md)

`@deepseek-ai/dsh-curated-bench` owns structured benchmark inputs for the curated plugin layer. Every execution-related asset identifies itself as `observed`, `fixture`, or `planned`; the checked-in default is a plan with no fabricated runs.

## Assets

- `manifests/`: read-only candidate audit summaries.
- `tasks/`: capability task-set definitions for search, memory, browser, MCP, cost, and profile smoke checks.
- `baselines/`: official profile snapshots, curated profile snapshots, and dynamic A/B comparison inputs.

## API

The package exports directory locators for the three asset roots, a read-only `ctx.curatedBench` asset service, and an invariant companion that validates planned canary, Chrome CDP 9333, A/B comparison, and embedded rollback snapshot digests. Consumers read explicit JSON files from those directories; the package does not run benchmarks itself.

An observed comparison is admissible only when baseline and candidate records identify identical model, prompt, workspace, network, and seed values; carry the same task-and-attempt set; include every required critical task; and repeat each task at least five times per profile. Threshold decisions use raw values before report rounding. Rollback data embeds complete lock and profile snapshots under SHA-256 digests, so a result identifies immutable, restorable prior inputs rather than mutable path references.

## Model Experience

### Benchmark assets

#### What the model sees

The package registers no prompt text, tool schema, user message, assistant-visible result, or session event. Benchmark records become model-visible only when another tool or command includes their content in a prompt.

#### Token effect

Zero direct token cost from `@deepseek-ai/dsh-curated-bench`.

#### KV Cache effect

No direct cache effect; callers that quote benchmark data own that request content.

## Known Limitations and Deferred Work

- **Records are classified**: fixture and planned records are not accepted evidence and do not count as canary or fault execution.
- **Long runs remain pending**: the checked-in search, memory, browser, MCP, fault, and canary campaigns contain no fabricated runs. Operators must supply provenance-bearing observed records; planned and fixture data cannot count as completion evidence.

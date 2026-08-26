# `@deepseek-ai/dsh-curated-scripts`

English | [中文](README.zh.md)

`@deepseek-ai/dsh-curated-scripts` owns the source-tree command implementations for curated plugin admission and profile evidence. The package exports testable command functions and ships thin bin wrappers for `verify-lock`, `preflight`, `smoke-profile`, and `compare-benchmark`.

## Commands

- `verify-lock` validates catalog metadata statically, including the computed eight-dimension score and required Node/core-patch declarations. With one or more absolute `--artifact-root` values, it also resolves installed artifacts and checks immutable provenance, manifests, patches, dependencies, install hooks, Node compatibility, and core-path changes without executing package scripts.
- `preflight` accepts either an explicit fixture for non-observed static validation or an absolute `--profile-root` for observed validation. Observed validation resolves every installed bundle manifest and patch plus the profile patch, then enforces the authoritative provider/fallback policy, duplicate registrations, memento/permission-rules/LoongSuite safe settings, data-handling defaults, and secret rejection across ordinary config and curated metadata. Permission execution remains delegated to the resolved permission plugin.
- `smoke-profile` requires an absolute `--profile-root` for observed CLI smoke. It resolves and imports installed candidate artifacts, then runs `--dump-config` and `--help` under one 55-second wall-clock deadline with a scrubbed child environment. Missing or invalid artifacts fail closed; the command does not create synthetic bundle shims.
- `compare-benchmark` requires explicit `observed`, `fixture`, or `planned` evidence. Observed comparisons require execution ids, timestamps, identical model/prompt/workspace/network/seed values, matching task-and-attempt keys, at least five repetitions per task, and complete required critical tasks. It evaluates non-compensable thresholds from raw values and validates SHA-256 digests over embedded rollback snapshots.

## API

Each `run*` function accepts CLI-style string arguments and returns a `CommandResult` with `status`, `stdout`, and `stderr`. Observed lock verification uses `--artifact-root`; observed preflight and smoke use `--profile-root` and optionally separate `--artifact-root` values. JSON reports identify evidence provenance. Fixture benchmark records return `unverified`, planned campaigns return `pending`, and neither can return `accepted` or serve as canary or fault-execution evidence. `createSmokeProfileChildRunner(command, baseArgs)` creates a runner with a scrubbed environment and bounded subprocess execution.

## Model Experience

### Offline curated verification

#### What the model sees

The commands run outside the agent runtime and emit text or JSON to their caller. They register no prompt text, tool schema, user message, assistant-visible result, or session event.

#### Token effect

Zero direct token cost from `@deepseek-ai/dsh-curated-scripts`.

#### KV Cache effect

No direct cache effect; diagnostics become model-visible only if a caller explicitly includes command output in another prompt.

## Known Limitations and Deferred Work

- **No third-party installation**: the commands read caller-supplied installed artifacts but do not install packages or run candidate install lifecycle scripts.
- **Static results are not runtime evidence**: rootless lock verification and explicit preflight fixtures are labeled non-observed; preflight fixtures are never accepted as observed profile evidence, and smoke requires a real installed profile.
- **Smoke execution is bounded**: observed smoke uses the supplied installed profile and a single wall-clock deadline that includes artifact inspection and child stages.
- **No long-run evidence is checked in**: the default benchmark lists pending campaigns without fabricated runs. `compare-benchmark` evaluates supplied records but does not execute external workloads, fault campaigns, or 3–7 day canaries.

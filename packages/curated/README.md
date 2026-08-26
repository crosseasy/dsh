# Curated Packages

English | [中文](README.zh.md)

`packages/curated/` is the package-group container for the curated plugin layer.

- `curated-base`: Defines the base curated bundle that inserts curated policy and benchmark services into profiles.
- `curated-policy`: Owns curated plugin policy data and policy behavior for the curated layer.
- `curated-profiles`: Owns curated profile templates and writes selected profiles into a DSH home without changing shipped profiles.
- `curated-scripts`: Provides source-tree `verify-lock`, `preflight`, `smoke-profile`, and `compare-benchmark` commands for curated gates.
- `curated-bench`: Serves read-only curated manifests, task sets, baselines, A/B records, and rollback snapshots.

## Governance Boundary

The curated group is a composition and admission layer. It does not modify `packages/core/agent-loop`, the session wire format, or the shipped `web` and `headless` profile templates. Third-party candidates are recorded as pinned audit facts and profile bundle names; this repository does not vendor their source or execute their install lifecycle scripts during curated admission checks.

## Profile Tiers

The intended `web-curated` baseline has 12 candidates. Its current admissible active baseline has ten: toolkit, web search, memento, MCP panel, checkpoint rewind, LSP actions, permission rules, smooth streaming, upstream radar, and LoongSuite telemetry. `dsh-context` is rejected because its pinned artifact has no Node compatibility evidence, and `dsh-config-manager` is rejected because its profile config cannot enforce dry-run or execution confirmation. The layer does not claim all 12 target candidates are active.

`web-coding` and `web-enterprise` currently use the same ten-candidate baseline as `web-curated`; enterprise materialization additionally requires `ignore-scripts=true`. `web-research` materializes the baseline plus the admitted `plugin-session-export` scenario candidate. Mneme, vision routing, and the other high-risk candidates remain inactive pending their required evidence, while `web-personal` contains only the three installation-owned foundation bundles.

Profile materialization writes the approved memento, permission-rules, and LoongSuite safety settings, and preflight rejects weaker values. Permission execution remains delegated to the permission plugin; the curated layer verifies its resolved bundle config instead of introducing a second authorization path.

Rejected and fallback candidates remain in the allowlist with audit evidence and stay out of active profile templates. The inactive pool covers the named search, memory, MCP, browser, context, cost, import/edit, review, notification, and desktop alternatives used by conflict policy and A/B assets; `dsh-llm-fallbacks` and `dsh-feishu` stay inactive until their recorded rejection reasons are resolved.

## Model Experience

### Curated package group

#### What the model sees

The package group itself registers no prompt text, tool schema, user message, assistant-visible result, or session event; model-visible behavior belongs to the selected first-party package or installed third-party bundle.

#### Token effect

Zero direct token cost from `packages/curated/`.

#### KV Cache effect

No direct cache effect; any profile bundle that registers prompt sections or tools owns its own cache stability.

## Known Limitations and Deferred Work

- **Snapshot-based admission**: catalog-only validation proves that checked-in fields are internally consistent, including the computed eight-dimension score, Node/core-patch declarations, capability policy, and metadata secret checks. Observed verification requires caller-supplied installed artifacts resolved from the exact commit.
- **No bundled third-party source**: curated profiles name third-party bundles, but this repository does not vendor them or make them available without a profile installation step.
- **External evidence remains pending**: third-party installation, Chrome browser regression, search, memory, MCP, and browser A/B workloads, real-candidate fault injection, and 3–7 day canaries have not been executed by these packages. Fixtures and planned records cannot supply that evidence.

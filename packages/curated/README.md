# Curated Packages

English | [中文](README.zh.md)

`packages/curated/` is the package-group container for the curated plugin layer.

- `curated-base`: Defines the base curated bundle that inserts curated policy and benchmark services into profiles.
- `curated-policy`: Owns curated plugin policy data and policy behavior for the curated layer.
- `curated-profiles`: Owns curated profile templates and writes selected profiles into a DSH home without changing shipped profiles.
- `curated-scripts`: Provides source-tree `verify-lock`, `preflight`, `smoke-profile`, and `compare-benchmark` commands for curated gates.
- `curated-bench`: Serves read-only curated manifests, task sets, baselines, A/B records, and rollback snapshots.

All five packages are public members of the DSH release family. `@deepseek-ai/dsh` installs `curated-base` and `curated-profiles`; the release order publishes policy and benchmark assets before their consumers, then publishes the user-facing curated command package after `dsh` and its other runtime dependencies.

## Governance Boundary

The curated group is a composition and admission layer. It does not modify `packages/core/agent-loop`, the session wire format, or the shipped `web` and `headless` profile templates. Third-party candidates are recorded as pinned audit facts and profile bundle names; this repository does not vendor their source or execute their install lifecycle scripts during curated admission checks.

## Profile Tiers

The intended `web-curated` baseline has 12 candidates. Web search, memento, MCP panel, checkpoint rewind, LSP actions, and LoongSuite telemetry are static/install qualification candidates, but none has a keyless assembled runnable snapshot of its pinned artifact, so the runtime-active count is zero. Web search also lacks its required `@anweat/dsh-browser` bundle/runtime dependency. The other six target candidates retain their artifact, compatibility, or safety rejections.

All five profiles contain only the three installation-owned foundation bundles and write `ignore-scripts=true`. The six qualification candidates retain their exact npm or Git identities, source-content, installed-tree, and runtime dependency closure digests without entering runnable templates. Curated workspaces grant no third-party builds and permit no dependency patch transformations.

Profile materialization writes an empty profile patch while no third-party candidate is active. Candidate-specific safety settings remain catalog evidence for later admission; the curated layer does not compensate for an unsafe artifact with a profile override.

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

- **Managed-profile admission**: mandatory launcher admission checks curated template, manifest, package-manager, and user-layer composition before startup or config dump. The four managed profile files must be ordinary files; all are checked before any is read or written, and missing files use exclusive creation. An existing curated `.npmrc` must exactly equal the generated `ignore-scripts=true` file, and a curated manifest cannot contain a `pnpm` field. Observed verification additionally requires a managed profile, validates both lockfiles against each catalog-owned runtime closure digest, rejects patched package state, and hashes the direct candidate tree. It does not detect arbitrary post-install rewrites of transitive dependency files that leave both lockfiles unchanged. Standalone artifact roots remain metadata-only.
- **No bundled third-party source**: curated profiles name third-party bundles, but this repository does not vendor them or make them available without a profile installation step.
- **External evidence remains pending**: every selected active candidate, including a consumer that names a required runtime bundle, must own `runtimeActivationEvidence` keyed by exactly its `targetProfiles`; every profile value binds the real pinned artifact's keyless assembled snapshot and install, enable, restart, and disable-or-uninstall records to that map key, checked-in paths, and SHA-256 values, with every declared runtime bundle present. The repository documentation and DSH release gates return only redacted policy diagnostics before reading evidence when catalog policy fails. Otherwise they parse every profile's records, bind them to the candidate, map key, current profile composition digest, artifact identities, operation, and successful observed command result, require a Git-tracked candidate/profile/operation snapshot command and replay it, redact key/value secrets, Authorization values, and scheme URL userinfo in candidate, profile, and path identifiers, reject secret-bearing record or artifact argv including URL userinfo and secret query parameters without echoing arguments, and verify each separately referenced artifact through a bounded stable descriptor read. Ordinary candidate IDs and snapshot paths containing `authorization` remain valid. Each keyless assembled record also proves waterfall delegation and zero duplicate token injection or external requests. E3/E4, Chrome browser regression, search, memory, MCP, A/B workloads, fault injection, and canaries remain pending.

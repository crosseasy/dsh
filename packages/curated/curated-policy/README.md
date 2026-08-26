# `@deepseek-ai/dsh-curated-policy`

English | [中文](README.zh.md)

`@deepseek-ai/dsh-curated-policy` owns the checked-in curated plugin allowlist and exposes read-only policy queries through `ctx.curatedPolicy`.

The package loads the candidate lock, authoritative capability conflict rules, and permission rule seeds. Before publishing `ctx.curatedPolicy`, it computes the 100-point admission score from eight bounded dimensions, validates any declared total, requires active candidates to carry verified Node evidence and no core patch, validates provider/fallback relationships and profile conflicts, rejects secret-like metadata, and checks permission policy structure and ordering. The curated command package separately validates fail-closed settings in resolved permission artifacts and profile config. The Cordis plugin registers the service with an effect, so unloading the plugin removes `ctx.curatedPolicy`.

## Service Contract

`CuratedPolicy` freezes the parsed catalog and returns immutable candidate arrays. `listCandidates()` returns every audited candidate in catalog order. `getProfileCandidates(profileId)` returns only active candidates assigned to the requested profile, also in catalog order.

`validateCandidateLock(catalog)` checks deterministic catalog assertions: schema version, full Git SHAs, declared source status, Node and core-patch fields for active candidates, candidate IDs, GitHub repository URLs, inactive hard-rejected candidates, duplicate active resources, and secret-like material. `validatePolicySemantics(catalog, conflicts, permissions)` checks referenced providers, fallback capabilities, unmanaged providers, permission rule IDs and ordering, and every configured profile. The package invariant loads and validates all three checked-in policy catalogs.

## Model Experience

### Curated policy service

#### What the model sees

`ctx.curatedPolicy` is a same-process query service for plugins and commands. It registers no prompt text, tool schema, user message, assistant-visible result, or session event.

#### Token effect

Zero direct token cost from `@deepseek-ai/dsh-curated-policy`.

#### KV Cache effect

No direct cache effect; a caller that turns policy data into prompt text or tools owns that model-visible registration.

## Known Limitations and Deferred Work

- **Catalog validation is not upstream evidence**: the allowlist records audit assertions, and the policy package checks their consistency without fetching or re-auditing upstream repositories. Artifact evidence requires a separately supplied exact-commit installation.
- **Unverified controls stay inactive**: candidates without runtime compatibility evidence or enforceable safety configuration retain machine-readable rejection records and are excluded from active profile queries. The 12-candidate `web-curated` target has a current admissible active baseline of ten: `dsh-context` lacks Node evidence, and `dsh-config-manager` lacks profile-level dry-run or execution-confirmation control. Memento, permission-rules, and LoongSuite telemetry are active only with checked-in safe profile config.
- **Install lifecycle scripts are not executed**: the policy package records third-party install scripts as facts, but it does not run them during load or validation.
- **No profile writing or permission execution**: profile materialization belongs to `@deepseek-ai/dsh-curated-profiles`, CLI reporting belongs to `@deepseek-ai/dsh-curated-scripts`, and tool authorization remains delegated to the selected permission plugin. The curated layer validates that plugin's fail-closed artifact and profile configuration.

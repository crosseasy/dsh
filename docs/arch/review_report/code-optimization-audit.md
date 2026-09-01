# Repository Optimization Audit

English | [中文](code-optimization-audit.zh.md)

This reference maps twelve repository optimization concerns to their current implementations and verification. Each row links the production code or active Agent Note that owns the behavior. This page is a traceability index, not an implementation backlog or a substitute for [`docs/architecture.md`](../../architecture.md).

## Current assessment

The repository implements all twelve changes with their required acceptance coverage. The audited paths contain no known open implementation or verification defect.

| Status | Count |
| --- | ---: |
| Resolved | 12 |
| Open verification gap | 0 |
| Open implementation defect | 0 |

## Resolution index

| No. | Status | Current implementation, verification, and authority |
| --- | --- | --- |
| 1 | Resolved | Settings [`describeForWire()`](../../../packages/settings/settings/src/redact.ts) rejects schema compositions it cannot redact safely, removes secret defaults and unsafe error metadata, and is the only settings path used by ApiProxy. [`plugin-config-overlay.e2e.ts`](../../../apps/web/tests/plugin-config-overlay.e2e.ts) boots an overlay package whose Host namespace and `dsh.client` card meet through the real Web composition, while its HTTP assertion keeps secret values and defaults off the wire. The [fail-closed Settings wire](../../../.agents/notes/implemented/bug-fix/2026-08-25-fail-closed-settings-wire-description.md) and [plugin-owned settings surface](../../../.agents/notes/implemented/architecture/2026-08-12-plugin-owned-settings-surface.md) Notes own the decisions. |
| 2 | Resolved | [`gatesForMode('hygiene')`](../../../scripts/run-gates.ts) makes `build` a dependency of artifact consumers, while [`workspace-residue.ts`](../../../scripts/workspace-residue.ts) gives cleanup and workspace constraints one residue definition. The process smoke in [`run-gates.spec.ts`](../../../scripts/run-gates.spec.ts) runs the complete graph from absent and present artifact states and preserves an unknown-directory failure. The [parallel gate graph Note](../../../.agents/notes/implemented/process/2026-07-06-parallel-pre-push-gates.md) owns the command behavior. |
| 3 | Resolved | Agent presets track generation holders, retire superseded generations, and dispose each generation once after its final agent or cold-reader lease releases it. The [generation reclamation Note](../../../.agents/notes/implemented/bug-fix/2026-08-25-preset-generation-reclamation.md) owns the lifecycle. |
| 4 | Resolved | Settings registrations own watcher activity and tails; replacement reconciliation, commit-point revision checks, and namespace-monotonic raw revisions preserve cache and write consistency across replacement and no-owner intervals. The [settings write-integrity Note](../../../.agents/notes/implemented/architecture/2026-07-30-settings-write-path-integrity.md) owns these rules. |
| 5 | Resolved | Agent Instructions uses tri-state root-marker probes, stops on unavailable markers, and shares a configurable aggregate UTF-8 read budget between baseline loading and reconciliation. The [workspace-context Note](../../../.agents/notes/implemented/feature/2026-06-24-workspace-context.md) owns discovery and last-good behavior. |
| 6 | Resolved | ACP reuses the shared out-of-process cwd, capability, settlement, and run-handle helpers while retaining its protocol-specific cancellation and EOF teardown. The [TypeScript SDK/subagent Note](../../../.agents/notes/implemented/feature/2026-07-27-typescript-sdk-and-sdk-subagent-backend.md) owns that split. |
| 7 | Resolved | `FileSystem.lstat`, `FsPathInfo`, and provider-only no-follow helpers are absent from the filesystem service and providers; direct platform `lstat` calls remain where real security or publication logic needs them. The [filesystem simplification Note](../../../.agents/notes/implemented/simplification/2026-08-25-remove-unconsumed-filesystem-lstat.md) owns the removal. |
| 8 | Resolved | Session-reference ranking and preparation are private, `CompactionResult` retains only consumed projection fields, and tools plus llm-retry expose deterministic helpers only through `/testing` subpaths. The [session-reference](../../../.agents/notes/implemented/simplification/2026-08-25-session-reference-private-preparation.md) and [compaction](../../../.agents/notes/implemented/feature/2026-06-18-compaction-capability-seam.md) Notes own the product interfaces; the [tools](../../../packages/core/tools/README.md) and [llm-retry](../../../packages/llm/llm-retry/README.md) READMEs own the testing exports. |
| 9 | Resolved in scoped form | `LocalSendLifecycle`, the private persistent-tool runtime, the one-shot executor, sandbox settlement, and pure shell result rendering remove shared lifecycle duplication. Registration, approval, work-directory policy, prompts, and dialect behavior remain in Bash/Pwsh adapters by design. The [one-shot](../../../.agents/notes/implemented/simplification/2026-08-25-one-shot-shell-runtime.md) and [persistent](../../../.agents/notes/implemented/simplification/2026-08-25-persistent-shell-tool-runtime.md) Notes own the split. |
| 10 | Resolved | `WorkflowStartRequest` carries no signal; each returned `WorkflowRun` owns cancellation, and consumers bridge aborts with pre-start checks, an immediate post-start recheck, listener removal, and quiescent disposal. The [workflow cancellation Note](../../../.agents/notes/implemented/simplification/2026-08-26-workflow-single-cancellation-owner.md) owns the ordering. |
| 11 | Resolved | TypeScript has directional client and server JSON-RPC transports over shared framing, Python exposes only the client role, and Codex keeps its genuine bidirectional initialization behavior in a private transport. The [directional JSON-RPC Note](../../../.agents/notes/implemented/simplification/2026-07-19-make-jsonrpc-directional.md) owns the protocol roles. |
| 12 | Resolved | The client fixture imports the same plan, session-statistics, token-usage, context-pressure, and request-composition folds used by production projections; shared-vector tests compare their wire views. The [projection-state Note](../../../.agents/notes/implemented/architecture/2026-08-19-session-projection-state-and-client-views.md) owns the client-safe split. |

## Retained boundaries

- Keep the DeepSeek and pi-ai adapters, and the JSONL and SQLite persistence providers, as independent implementations.
- Keep workflow progress, events, and metadata, and keep the compaction Service Definition separate from its basic provider.
- Share Shell lifecycle and pure result projection only; Bash and Pwsh adapters continue to own dialect and product-policy differences.
- Share genuine wire primitives between the Claude Code and Codex hook bridges while keeping their payload and dialect mappings separate.
- Do not split files solely by length or replace the repository's framing, atomic-write, and timer implementations without proving that a maintained dependency preserves their limits, cancellation, platform, and deterministic-test requirements.
- A zero-clone `duplication` result does not rule out semantic duplication; ownership and behavior analysis remain necessary.

The linked code, package documentation, and Agent Notes own current behavior and rationale; tests provide executable evidence. Transient command counts, branch names, commit hashes, and implementation sequencing do not belong in this current-state index.

# Current Repository Code Optimization Audit

English | [中文](code-optimization-audit.zh.md)

This report records optimization opportunities in the current repository that were cross-checked against production references, implementation code, test surfaces, or existing Agent Notes. The audit baseline is branch `feat_825` at commit `b150a551b8d4`; the scope covers `packages/`, `apps/`, `examples/`, `python/`, and `scripts/`, excluding vendored Cordis implementation and archived Agent Notes. This document is an implementation backlog, not an authority that replaces `docs/architecture.md` or Agent Notes; non-mechanical work still requires a new or revised Agent Note before implementation.

## Conclusion

The most urgent work is not a large directory reorganization. Two issues should block a public release: Settings secret redaction fails open for schema compositions that the walker cannot recognize, and the standalone local quality-gate entry point is not reproducible from a clean artifact state. The next group covers generations, watchers, instruction loading, and child-process management that can accumulate resources or amplify lifecycle races. Public surfaces without consumers, mirrored implementations, and test-only exports should be narrowed after those issues.

| Priority | Meaning | Count |
| --- | --- | ---: |
| P0 | Complete before public release or trusted verification | 2 |
| P1 | Clear resource, security, lifecycle, or maintenance benefit; schedule as near-term independent changes | 5 |
| P2 | Well-supported simplifications that can follow P0/P1 as domain-specific changes | 5 |

| No. | Priority | Opportunity | Primary benefit |
| --- | --- | --- | --- |
| 1 | P0 | Make Settings wire redaction fail closed | Prevent third-party schemas from leaking secrets and defaults |
| 2 | P0 | Restore a reproducible quality-gate baseline | Give later changes a trustworthy acceptance path |
| 3 | P1 | Reclaim superseded preset generations | Stop plugins and file watchers from accumulating on every save |
| 4 | P1 | Make Settings registration disposal truly quiescent | Prevent post-unload callbacks and stale replacement caches |
| 5 | P1 | Add tri-state root probes and an aggregate read budget to Agent Instructions | Prevent incorrect ancestor instructions and unbounded I/O |
| 6 | P1 | Reuse the out-of-process lifecycle core in the ACP subagent | Remove duplicate cancellation, settlement, and cwd logic |
| 7 | P1 | Remove the unconsumed `FileSystem.lstat` seam | Narrow FS provider obligations and platform code |
| 8 | P2 | Narrow redundant or test-only public surfaces | Reduce the type, documentation, and dynamic-call matrix |
| 9 | P2 | Extract a private Bash/Pwsh lifecycle core | Apply mirrored lifecycle fixes in one place |
| 10 | P2 | Give Workflow a single cancellation owner | Remove dual-channel abort races |
| 11 | P2 | Narrow JSON-RPC transports by direction | Remove unused peer roles in the Python and TypeScript implementations |
| 12 | P2 | Make fixtures reuse product projection folds | Prevent demo data from drifting from production projection semantics |

## P0: Pre-release blockers

### 1. Settings wire redaction must fail closed

**Evidence.** The `walk()` function in [`redact.ts`](../../packages/settings/settings/src/redact.ts) traverses only `object`, `dict`, and `array`. Its default branch returns the value unchanged, so a `role('secret')` behind a union, intersection, or transform crosses the wire with an empty `secrets` list. [Settings provider](../../packages/settings/settings/src/index.ts) applies `describe({ redactSecrets: true })` only to `value/base/user` while still sending `schema.toJSON()`, which may contain a secret `.default(...)`. The settings RPC in [`api-proxy.ts`](../../packages/host/apiproxy/src/api-proxy.ts) is a production consumer. The gap is also documented in the [Settings README](../../packages/settings/settings/README.md) and the [plugin-owned settings surface Note](../../.agents/notes/implemented/architecture/2026-08-12-plugin-owned-settings-surface.md).

**Impact.** The current first-party secret schemas are mostly direct object fields, so this audit does not establish that an existing configuration is already leaking. However, the settings surface serves arbitrary namespaces registered by dynamic plugins. Schemas that cannot be proven traversable are still allowed onto the wire, widening the risk beyond schemas that can be statically audited in this repository.

**Recommendation.**

- Add a single `describeForWire()` path that proves a schema is safely traversable before generating the redacted value, layers, and schema envelope; reject the entire namespace when safety cannot be proven.
- Remove secret defaults, schema error text that may echo input, and other unnecessary metadata; Host RPC must no longer call the general `describe()` method with a Boolean switch.
- Add tests for unions, intersections, transforms, defaults, nested dicts/arrays, and adversarial error text, plus one assembled overlay-plugin-to-browser-settings-card test.

**Acceptance.** A schema that cannot be proven safe fails before RPC; wire fixtures contain no secret, secret default, or original rejected input; existing direct-object secrets continue to work as `{ path, set }`.

### 2. Restore a reproducible quality-gate baseline

**Evidence.** [`run-gates.ts`](../../scripts/run-gates.ts) gives artifact consumers a `build` dependency in `check-all` mode, but direct `hygiene` mode calls `hygieneLeafGates()` without that dependency. On a clean checkout, `publint`, built package invariants, and the NodeNext consumer check therefore consume nonexistent `lib/` artifacts. [`check-workspace-constraints.ts`](../../scripts/check-workspace-constraints.ts) also interprets every directory at `packages/<group>/<pkg>` depth as a package, while [`clean.ts`](../../scripts/clean.ts) separately knows how to remove manifest-less directories that contain only safe build residue.

**Current reproduction.** `pnpm run constraints` fails on the manifest-less residue directories `packages/bundle/fusion`, `packages/client/schema-form`, and `packages/client/web-react`. After a build, `publint` and built package invariants pass, which identifies artifact prerequisites rather than generated content as the direct `hygiene` problem. CI's `check-all` path already declares the build dependency, so this is a mismatch between the documented local entry point and the integrated gate graph rather than a CI release-graph failure.

**Recommendation.**

- Make `pnpm run hygiene` build its artifact consumers, or split it into clearly named source-only and artifact-ready commands; the same command must not change meaning according to whether local `lib/` happens to exist.
- Define the hierarchy check's residue prerequisite: have the orchestrator run the safe clean first, or make the checker ignore only the manifest-less build residue already defined by `clean.ts`.
- Add a clean-checkout smoke for each documented standalone gate command so future gate-graph changes cannot silently depend on artifacts or residue from an earlier command.

**Acceptance.** Running `pnpm run hygiene` on both a clean checkout and a completed build produces the same conclusion; recognized safe residue has an explicit cleanup or ignore owner while a real unexpected package directory still fails loud; CI and local entry points reuse one gate graph.

## P1: Near-term work

### 3. Reclaim superseded preset generations

**Evidence.** Agent-presets [`ensureStanding()`](../../packages/preset/agent-presets/src/index.ts) removes the current pointer and mounts a new generation when the composition stamp changes, but it never disposes the old scope. The [`README.md`](../../packages/preset/agent-presets/README.md) explicitly states that a “superseded generation is never reclaimed.” The old generation must remain available to agents already running on it, but the roster has no joined-agent count and therefore cannot know when release is safe. The settings-page authoring flow turns composition changes into per-save events, while `dsh-skill-filesystem` installs watchers for every generation by default.

**Impact.** Creating a session after each edit can permanently add a complete plugin/effect set and file watchers until process exit. Resource use in a long-running Web Host grows with the number of configuration saves.

**Recommendation.** Model a standing mount as a generation owner with `joinedAgents`, `retired`, and one-shot `dispose` state. Mark the old generation retired after publishing its replacement. Agent bind/unbind and cold-read holders participate in the count, and the last holder calls `await scope.dispose()`. Cover concurrent `ensureStanding`, mount-failure rollback, parent/child agents bound to the same generation, and roster teardown.

**Acceptance.** Existing sessions remain unchanged after a save; the old generation's skill watchers and effects are released after its final session exits; repeated save/create/close cycles keep the resource count bounded.

### 4. Settings registration disposal must drain its watchers and resynchronize replacements

**Evidence.** The fiber disposer for Settings provider [`register()`](../../packages/settings/settings/src/index.ts) only deletes the registration; it neither marks the registration's watchers inactive nor waits for their tails. Whole-service teardown drains `writeQueues` and `pendingTails`, but an individual plugin hot-unload does not. At the same time, an in-flight persist owned by an old registration can update the document after a replacement registration takes over the namespace. The code suppresses notifications to the old owner but does not re-resolve the replacement from the new document.

**Impact.** An asynchronous `onChange` can outlive plugin unload. During hot replacement, storage and the document may contain the new value while the replacement registration keeps a stale resolved cache until another external publish or write occurs.

**Recommendation.** Give each registration its own lifecycle owner. Its disposer first prevents new watcher invocations and then drains invocations that already started; queued invocations that have not started must skip. When an old write reaches storage after replacement, re-resolve the current registration from the committed raw section, advance its revision, and notify under the new owner's rules.

**Acceptance.** Add tests for unload during a slow watcher, unload with queued watchers, registration replacement during persist, and old-write success/failure racing a new write; prove that no work owned by that registration remains when its disposer returns.

### 5. Agent Instructions needs tri-state root markers and an aggregate read budget

**Root-marker evidence.** [`existsAsMarker()`](../../packages/context/agent-instructions/src/files.ts) converts every `resolve/stat` error into “absent,” after which `findProjectRoot()` continues upward and can cross the real project root to an ancestor `.git`. Candidate instruction-file probes in the same module already distinguish `present/absent/unavailable`; root-marker probes discard that distinction.

**Read-budget evidence.** `readBounded()` has only a per-file `maxSourceBytes` limit. `loadBaselineInstructionSet()` reads every candidate before `maxBytes` limits the rendered result. The default output budget is 64 KiB and the per-file read limit is 1 MiB, but directory depth and aggregate candidate bytes have no common bound. A remote FS provider magnifies the difference into network and latency cost.

**Recommendation.**

- Return `present/absent/unavailable` from root-marker probes and continue upward only for confirmed absence. Initial loading should fail explicitly on unavailable; dynamic reconciliation should retain the last good state rather than selecting a different authority above that directory.
- Add a deployment-configurable `maxTotalSourceBytes` separate from model-output `maxBytes`. Read planning must preserve more-specific directories first, and budget exhaustion must be a distinct state rather than a file-removal signal.
- Make baseline loading and dynamic reconciliation share one budget implementation and account for exact UTF-8 bytes read.

**Acceptance.** Cover provider permission errors, cancellation, another ancestor `.git`, deep directories, same-directory deduplication, budget exhaustion, and last-good retention. Update the keyless snapshot for any model-visible behavior change.

### 6. Make the ACP subagent reuse the existing out-of-process lifecycle core

**Evidence.** The [shared out-of-process helpers](../../packages/subagent/subagent/src/out-of-process.ts) provide `NO_START_CAPABILITIES`, cwd resolution/validation, `settleRunResult`, and `subprocessRunHandle`, and the DSH SDK, Claude Code, and Codex providers already use them. [`subagent-acp/src/index.ts`](../../packages/subagent/subagent-acp/src/index.ts) retains separate cwd logic, while [`subagent-acp/src/run.ts`](../../packages/subagent/subagent-acp/src/run.ts) separately maintains cancellation races, result settlement, abort-listener cleanup, and idempotent disposal. The existing [TypeScript SDK/subagent Note](../../.agents/notes/implemented/feature/2026-07-27-typescript-sdk-and-sdk-subagent-backend.md) already states that these helpers should be shared.

**Recommendation.** Move ACP onto the existing helpers while retaining ACP's EOF/kill teardown ladder and timer configuration bounds. Error text, output folding, cancellation before readiness, and visible behavior after prompt settlement are hard invariants. Do not add ACP-specific diagnostics to the shared core merely to make the implementations look uniform.

**Acceptance.** Cover cancellation before readiness, failure/cancel races, spawn failure, repeated disposal, EOF grace, and memoized teardown, then run the ACP/subagent keyless snapshots. Success means a net deletion of code rather than another forwarding abstraction.

### 7. Remove the unconsumed `FileSystem.lstat`

**Evidence.** The [FS service](../../packages/fs/fs/src/index.ts) exposes `lstat` and [`FsPathInfo`](../../packages/fs/fs/src/types.ts), and the local and E2B providers implement them. A search for `.lstat(` in production source under `packages/`, `apps/`, `examples/`, and `scripts/` finds only the declaration and provider implementations; every other call is in tests. The local provider also retains `PathLinkInfo`, `pathLinkType`, and `probeNoFollow` for this method. Instruction discovery moved to normal reads and delegated trust to sandbox/policy under the [follow-instruction-symlinks Note](../../.agents/notes/implemented/feature/2026-07-21-follow-instruction-symlinks.md).

**Recommendation.** During pre-release, remove `lstat`, `FsPathInfo`, and both provider implementations, then delete no-follow helpers and tests that have no remaining references. If a real no-follow consumer appears later, design the seam around its concrete security requirements instead of retaining a speculative API.

**Acceptance.** Focused FS, fs-local, and fs-e2b tests pass; `rg 'lstat|FsPathInfo|probeNoFollow'` retains only external platform APIs or explicit explanations; the API catalog, README, typecheck, build, and doc-sync remain synchronized.

## P2: Independently schedulable simplifications

### 8. Narrow redundant or test-only public surfaces

| Surface | Current evidence | Smallest surface to retain |
| --- | --- | --- |
| [`SessionReferenceResolver.listCandidates/prepare`](../../packages/context/session-reference/src/index.ts) | Both methods are called only by same-class orchestration but enter the API catalog as Service methods; the browser needs only unary Remote `candidates` | Retain Remote candidates, canonical URIs, and pre-step behavior; make ranking and snapshot preparation private |
| [`CompactionResult`](../../packages/compaction/compaction/src/types.ts) | `compactionId/sourceCommandId/startSeq/endSeq/summary` have no fixed production reads and duplicate durable events; `summarySeq` and shadowed fields have real consumers | Retain `summarySeq`, `shadowedRange`, `shadowedSeqs`, and `shadowedTokenCount` |
| [tools testing export](../../packages/core/tools/src/testing.ts), [llm-retry internals](../../packages/llm/llm-retry/src/index.ts), and several implementation helpers | Comments already mark them test-only/internal and fixed external consumers are tests, yet they are exposed from product roots or the formal `apply` signature | Move them to explicit `/testing` subpaths or test-support; product roots retain only plugins, services, and supported types |

Implement these changes as separate package-specific commits and establish deletion evidence with a production-reference inventory first. Do not apply the [old dead-core-spine proposal](../../.agents/notes/proposed/simplification/2026-07-04-prune-dead-core-spine-api.md) wholesale: some listed fields are already gone, and `CompactionResult.summarySeq` now has a real consumer. Rewrite that proposal against current code before using it.

### 9. Extract a private Bash/Pwsh lifecycle core

**Evidence.** `bash-local/pwsh-local`, `tool-bash/tool-pwsh`, the two persistent tools, and the two sandbox providers contain mirrored implementation sets, with some files explicitly excluded from duplicate detection through `jscpd:ignore`. The one-shot and persistent twins are loaded by real bundles/presets according to platform, so they are not dead code. The [pwsh parity Note](../../.agents/notes/implemented/feature/2026-08-02-pwsh-tool-bash-parity.md) deferred a shared core until a persistent twin existed; the [persistent PTY Note](../../.agents/notes/implemented/architecture/2026-08-11-pwsh-persistent-pty.md) shows that condition is now satisfied.

**Recommendation.** First extract a private, pure core for persistent session registries, scrollback/status, timeout/abort/reset, and teardown. Bash/Pwsh adapters continue to own markers, wrappers, prompt echo, argv, paths, and environment semantics. Extract common one-shot deadline, background mapping, and presentation behavior only when doing so produces a net deletion. Do not publish a generic shell tool that hides dialect differences.

**Related local issue.** Terminal-bash [`LocalPtySession`](../../packages/terminal/terminal-bash/src/session.ts) tracks `active`, two timers, an abort disposer, interrupting, activeWrite, pollingReady, and polling at the same time; the source already has a consolidation TODO. Fold one send's state into a single lifecycle owner before deciding whether it belongs in the dialect core.

**Acceptance.** Require a net line deletion and fewer `jscpd` exceptions. Bash/Pwsh loaders, persistent terminal behavior, sandbox/ACL behavior, cancellation and timeout tests, and related snapshots must remain green.

### 10. Give Workflow a single cancellation owner

**Evidence.** [`WorkflowStartRequest`](../../packages/workflow/workflow/src/runtime-types.ts) carries a `signal`, while the returned `WorkflowRun` also owns `cancel()`. Both production callers, tool-workflow and tool-ralph, pass the same `exec.signal` into `start()` and then register another listener that calls `run.cancel()`. The worker host therefore maintains `inputSignal/inputSignalAbort`, and one abort travels through two paths.

**Recommendation.** If `start()` continues to publish its holder synchronously, remove the request signal and host listener, leaving holder-owned `run.cancel()` as the only runtime cancellation path. Both tools should handle a pre-aborted signal before the call and delegate aborts during execution to the holder. This recommendation narrows cancellation only; it does not delete workflow progress/events/meta, which the [rejected workflow simplification Note](../../.agents/notes/rejected/simplification/2026-07-12-collapse-workflow-to-foreground-core.md) explicitly preserves.

**Acceptance.** Cover pre-aborted signals, abort during execution, abort after settlement, reentrant cancellation, and disposal quiescence; keep worker built-artifact tests and workflow/Ralph snapshots green.

### 11. Narrow JSON-RPC transports to their actual direction

**Evidence.** The TypeScript [`JsonRpcLineTransport`](../../packages/sdk/protocol/src/transport.ts) implements inbound requests/outbound responses and outbound requests/inbound responses together. The real server needs only inbound requests plus outbound notifications, while the client needs outbound requests plus inbound notifications. [`python/sdk/client.py`](../../python/sdk/src/deepseek_harness/client.py) still exposes `notify`, `next_request`, `respond`, and `respond_error` and maintains a server-request queue, but the current server sends no requests to clients.

**Recommendation.** Keep one shared frame parser/writer and split server/client roles into directional narrow interfaces. Delete the Python client's dormant server-role API, `IncomingRequest`, and queue. First revise the [directional JSON-RPC proposal](../../.agents/notes/proposed/simplification/2026-07-19-make-jsonrpc-directional.md): its old prompt-settlement design has been replaced by the current “return message id immediately” protocol and must not re-enter the implementation.

**Acceptance.** Update both TypeScript and Python SDK expected outputs. Cover malformed frames, unknown methods, notifications, request-id correlation, process exit, and concurrent requests without adding a speculative bidirectional peer.

### 12. Make fixtures reuse product projection folds

**Evidence.** The [client connection fixture](../../packages/client/connection/src/client/fixture.ts) independently implements `foldPlan/planViewOf`, `sessionStatsOf`, token usage, context pressure, and request composition, with comments explicitly describing them as fixture parallels of product projections. The corresponding production implementations live in [plan-mode](../../packages/plan/plan-mode/src/index.ts), the [session-stats projection](../../packages/session/session-stats/src/projection.ts), and [token-meter projections](../../packages/llm/token-meter/src/usage-projection.ts). The type system does not force a fixture update when a production fold changes.

**Recommendation.** Extract each projection's event-to-state fold into a pure module owned by its domain package with no Cordis/Node dependencies. The production `ProjectionDefinition` and fixture driver should both call that module, while the fixture remains responsible only for scenarios and wire events. Do not bundle the entire Host registry into the browser or create a cross-domain “universal fixture projection” package.

**Acceptance.** Drive the production definition and fixture with the same event vectors and compare each wire view by key. After deleting parallel constants and folds from the fixture, keep client demo/screenshot tests and projection-package tests green.

## Recommended implementation order

1. Fix items 1 and 2 first to establish a secure, reproducible release baseline.
2. Split items 3, 4, and 5 into three lifecycle/defensive PRs, each with its own Agent Note, focused tests, and required snapshots.
3. Items 6 and 7 are high-confidence simplifications that either delete code or reuse an existing core; implement them in parallel after restoring the baseline.
4. Split item 8 by package into small PRs; do not mix unrelated domains in one “dead API cleanup” change.
5. For items 9 through 12, write a design Note with invariants and a regression matrix before implementation, then require net code deletion, one lifecycle owner, or a common product/fixture source as appropriate.

## Changes this audit explicitly does not recommend

- Do not merge the DeepSeek and pi-ai LLM adapters or the JSONL and SQLite persistence backends; the repository intentionally keeps them as independent implementations and consistency proof surfaces.
- Do not split `api-proxy.ts`, `TrajectoryTable.tsx`, or generated API catalogs solely because they are long; first identify independent ownership, stable inputs/outputs, or real change coupling.
- Do not broadly merge the Claude Code and Codex hook bridges; genuine wire primitives are already shared, while payload and dialect mappings intentionally differ.
- Do not directly replace the current JSON-RPC, LSP framing, atomic-write, or timer helpers with third-party packages. The [dependency-swap audit](../../.agents/notes/rejected/simplification/2026-07-26-dependency-swaps-rejected-by-nih-audit.md) shows that such replacements cannot delete the current limit, cancellation, Windows-permission, or deterministic-test logic.
- Do not delete workflow progress/events/meta or merge the compaction Service Definition with its basic provider; existing rejected Notes protect these capability seams.
- Do not read a zero-clone `duplication` result as “no duplication.” Bash/Pwsh mirrors use explicit ignores, and fixture parallels are semantic duplication; both require ownership and behavior analysis.

## Audit and validation record

| Command/check | Result | Details |
| --- | --- | --- |
| `pnpm run duplication` | Passed | 1,196 TS/TSX files and 0 non-exempt clones on the final audit baseline |
| `pnpm run build` | Passed | Source, types, and the Web bundle were generated successfully |
| `pnpm run verify-built-package-invariants` | Passed | Verified every current package artifact companion after the build |
| `pnpm run publint` | Passed | Passed after the build; it cannot pass independently when artifacts are absent on a clean checkout |
| `pnpm run constraints` | Failed | Manifest-less cross-branch/build residue at deleted fusion, schema-form, and web-react package paths |
| `pnpm run hygiene` | Baseline not green | Artifact gates lack a build prerequisite in a clean artifact state; after building, the tracked constraints issue still blocks completion |

This audit did not run the full unit-test, coverage, e2e, or snapshot suites because the report changes no product behavior. When implementing an item, select the focused tests described in its acceptance section and follow `docs/testing.md` for model-visible behavior, dual-SDK outputs, and built-artifact paths.

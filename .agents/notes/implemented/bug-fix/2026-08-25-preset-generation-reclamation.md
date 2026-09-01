# Agent Note: Superseded preset generations release after their final holder

Status: implemented

English | [中文](2026-08-25-preset-generation-reclamation.zh.md)

## Problem

Each preset edit creates a new standing generation for later sessions, while existing sessions must keep the generation that produced their history. The old implementation preserved that correctness by keeping every superseded generation mounted until process teardown. That leaked the plugins and effects owned by each generation; `dsh-skill-filesystem` can install file watchers, so repeated edit-and-create cycles accumulated live watchers even after every old agent had left.

Cold readers have the same lifetime hazard. A `session.history` or `skill.list` call can resolve a detached session's recorded preset without owning an Agent. If the recorded generation is superseded while the read is assembling presenters or catalogs, releasing it immediately can remove the very registry entries the read selected.

## Decision

`AgentPresets` models each standing mount as a generation owner: preset id, scope key, scope, composition stamp, holder count, retired flag, and memoized disposal promise. The current generation remains mounted with zero holders because it is the reusable answer for the next agent or cold read. A superseded generation becomes retired only after its replacement has mounted successfully, and disposal runs exactly once after the final holder releases. Roster teardown disposes every active and retired generation through the same memoized path.

`mount()` and `recompose()` acquire a generation holder before binding or rebinding the agent scope. The previous holder is released only after the new binding succeeds, so a failed refresh or failed recompose leaves the agent on its existing generation. `composeFrom()` resolves the parent's current generation by standing key and acquires that same generation rather than re-reading the preset id; a child therefore stays on the same plugin instances as its parent even if the composition file changes.

`acquireStanding(id?)` is the host-reader API. It returns `{ presetId, key, release() }`; callers pass `key` as the registry view scope and release the lease in `finally`. `release()` is idempotent, so callers can put cleanup on multiple exit paths without double-disposing a generation.

## Alternatives considered

**Dispose superseded generations immediately.** Rejected because existing agents and cold readers can still resolve tools, prompts, skill providers, and presenters from that generation. Immediate disposal would make their histories and in-flight reads inconsistent with the composition they selected.

**Keep the naked `standingKeyFor()` API and add best-effort pruning elsewhere.** Rejected because a bare key gives a caller no ownership obligation. The code that can race a refresh must hold the generation explicitly and release it at the end of the read.

**Re-resolve a child's preset id.** Rejected for the existing child-inheritance reason: the child must inherit the parent's exact generation, not a later file edit or a missing preset error.

## Testing

`packages/preset/agent-presets/tests/mount.spec.ts` covers final-holder disposal, parent/child holder independence, idempotent cold-reader release, concurrent refresh single-publication, refresh rollback, and roster teardown. `packages/host/apiproxy/tests/api-proxy-agent-preset.spec.ts` covers `session.history` and `skill.list` releasing cold-reader leases across success, error, and degraded paths.

## Consequences

Preset edits are still safe for running sessions, but their old plugin effects are bounded by live holders rather than process lifetime. Cold reads have an explicit cleanup obligation. A reader that cannot acquire the recorded preset still degrades to the global view, preserving the existing availability contract.

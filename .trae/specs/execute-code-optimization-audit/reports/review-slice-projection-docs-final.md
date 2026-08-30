# Final Review Slice: Projection Folds, Docs, Agent Notes, i18n

STATUS: PASS

## Scope

Reviewed the current staged and unstaged worktree slice for:

- client fixture projection fold reuse in `packages/client/connection`;
- projection-related README, subsystem page, Agent Note, and i18n sidecar updates;
- `docs/plugin/superpowers` updates, including the new local plan/spec files and links;
- no edits under `.agents/notes/archived/`;
- no Host registry import or newly added runtime peer for the fixture path.

This was a read-only review except for writing this report.

## Findings

No blocking findings.

## Review Notes

- `packages/client/connection/src/client/fixture.ts` now calls the domain-owned complete-log helpers from `@deepseek-ai/dsh-plan-mode/client`, `@deepseek-ai/dsh-session-stats/client`, and `@deepseek-ai/dsh-token-meter/client` for `plan`, `tokenUsage`, `contextPressure`, `contextBreakdown`, and `sessionStats`. The removed fixture-local aliases/reducer wrapper do not leave a parallel reducer for those values.
- `packages/client/connection/tests/fixture.client.spec.ts` compares the client helpers against the production `ProjectionDefinition` init/apply/view functions on a non-default event vector. The production-definition imports are test-only source imports; the runtime fixture does not import the Host registry or mount production projection registries.
- The fold dependency chain checked for `projection-fold.ts`, `usage-fold.ts`, `breakdown-fold.ts`, `surface-projection.ts`, `estimate.ts`, `request-header.ts`, and `call-config.ts` does not import Cordis, Node built-ins, Host packages, `ProjectionDefinition`, or registry/runtime APIs.
- `@deepseek-ai/dsh-llm/call-config` is exported and mapped in TypeScript paths so `dsh-session/request-header` can avoid the root `dsh-llm` runtime face. `client-connection/package.json` was not changed in this slice; no new runtime peer was added there.
- README/subsystem prose is present-tense and states current contracts rather than PR history. Implemented Agent Notes retain the implemented skeleton and current-state wording; the updated rejected note remains in `rejected/` and only records the partial supersession.
- Translation sidecars are hash-only updates, and `verify-translation-pairing` confirms all in-scope pairs are consistent.
- `.agents/notes/archived/` has no diff. The full `doc-sync` run also passed the archived-note verifier.
- `docs/plugin/superpowers/` remains excluded from bilingual pairing by `docs/i18n/README.md`; the new `06-*` document and `plans/` / `specs/` files are local planning material. Markdown link validation resolves their relative links.

## Checks Run

- `gtimeout 55s pnpm --silent vitest run packages/client/connection/tests/fixture.client.spec.ts` -> 38 tests passed.
- `gtimeout 55s pnpm --silent vitest run scripts/client-bundle-purity.spec.ts` -> 17 tests passed.
- `gtimeout 55s pnpm --silent exec tsc -p packages/client/connection/tsconfig.json --noEmit` -> passed.
- `gtimeout 55s pnpm --silent run verify-module-graph` -> `docs/module-graph.md is up to date`.
- `gtimeout 55s pnpm --silent run verify-translation-pairing` -> 1024 pairs consistent.
- `gtimeout 55s pnpm --silent run verify-agent-note-format` -> 607 Agent Notes conform.
- `gtimeout 55s pnpm --silent run verify-md-links ...docs/plugin/superpowers...` -> 2081 files checked, all links/fragments resolve.
- `gtimeout 55s pnpm --silent run doc-sync` -> 28 passed, 0 failed, 0 skipped in 47.14s.
- `gtimeout 55s git diff --check` and `gtimeout 55s git diff --cached --check` -> passed.

## Residual Risk

This review did not re-audit unrelated curated, workflow, JSON-RPC, SDK, or Python behavior beyond the documentation and dependency edges touched by this slice. The broad worktree contains staged and unstaged changes outside this slice; those should rely on their own review reports and focused gates.

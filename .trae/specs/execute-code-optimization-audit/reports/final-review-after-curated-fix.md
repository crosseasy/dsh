# Final Code Review After Curated Fix

Status: FAIL

## Critical Findings

None.

## Important Findings

1. `packages/curated/curated-scripts/README.i18n.yaml` is stale after README edits.

   The English and Chinese curated-scripts READMEs both changed the `smoke-profile` description at `packages/curated/curated-scripts/README.md:11` and `packages/curated/curated-scripts/README.zh.md:11`, but the pairing sidecar still records the old blob hashes at `packages/curated/curated-scripts/README.i18n.yaml:5-6`. The repository gate confirms this:

   ```sh
   gtimeout 55s pnpm run verify-translation-pairing
   ```

   Result: failed only for `packages/curated/curated-scripts/README.md` and `packages/curated/curated-scripts/README.zh.md` as out of sync with `packages/curated/curated-scripts/README.i18n.yaml`.

   Impact: `doc-sync` will fail, and the bilingual pair is not recorded as reviewed-consistent. Re-record this pair after confirming the English and Chinese wording.

## Previous Important Findings Rechecked

- Fixed: explicit fixture preflight with `--profile-root` remains non-observed and cannot report `accepted`.
- Fixed: installed `smoke-profile` bundle comparison is order-sensitive.
- Fixed: same-layer Cordis insert-then-patch is accepted while duplicate inserted ids in the same observed layer are rejected.

## Supplemental Review Coverage

- Workflow cancellation: no Critical/Important finding. `WorkflowStartRequest` no longer carries a signal; Consumers precheck, bridge later aborts at most once to `WorkflowRun.cancel()`, detach listeners, and await disposal. Worker-run cancellation keeps the first reason and `dispose()` waits for host-side child quiescence.
- TypeScript/Python JSON-RPC directionality: no Critical/Important finding. Generic TS client ignores server requests; server ignores direction-external frames; Codex keeps its private request-handling subclass; Python ignores inbound requests before response correlation and rejects boolean ids.
- Client fixture projection fold: no Critical/Important finding. Fixture projections reuse domain-owned client folds for plan, session stats, token usage, context pressure, and context breakdown, with parity tests against production definitions.
- Curated policy/scripts: no additional Critical/Important finding beyond the stale README sidecar above.
- Docs/prose/Agent Notes/i18n sidecars: no additional Critical/Important finding. Agent Note format passes, changed/new note pairs verified where sampled, and doc references resolve. Prose recall hits in superpowers docs are anchored by the new evidence-ranking page and did not constitute reasoning-transcript leakage.

## Verification Run

- `gtimeout 55s pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t "fixture preflight|reordered installed bundle|same-layer Cordis patch|duplicate inserted entry"`: passed, 4 tests.
- `gtimeout 55s pnpm exec vitest run packages/workflow/tool-workflow/tests/tool-workflow.spec.ts packages/workflow/tool-ralph/tests/tool-ralph.spec.ts -t "abort|cancel|dispose|quiescence|reentry"`: passed, 18 tests.
- `gtimeout 55s pnpm exec vitest run packages/sdk/protocol/tests/transport.spec.ts packages/subagent/subagent-codex/tests/subagent-codex.spec.ts -t "server request|notification|direction|initialized|request"`: passed, 23 tests.
- `gtimeout 55s pnpm exec vitest run packages/client/connection/tests/fixture.client.spec.ts -t "projection|fixture|fold"`: passed, 4 tests.
- `gtimeout 55s env PYTHONPATH=python/sdk/src python -m pytest python/sdk/tests/test_client.py -k "server_request or id_only_frame or boolean_id_request or public_api"`: passed, 3 tests.
- `gtimeout 55s pnpm run verify-agent-note-format`: passed.
- `gtimeout 55s pnpm run verify-doc-budgets`: passed.
- `gtimeout 55s pnpm run verify-doc-refs`: passed.
- `gtimeout 55s pnpm run verify-translation-pairing`: failed for `packages/curated/curated-scripts/README.md` and `packages/curated/curated-scripts/README.zh.md`.

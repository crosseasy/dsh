# Review Slice: Workflow Cancellation and JSON-RPC Directionality

STATUS: FAIL

Scope reviewed:

- `packages/workflow/**`
- `packages/sdk/**`
- `python/sdk/**`
- `packages/subagent/subagent-codex/src/wire.ts`
- `packages/subagent/subagent-codex/tests/subagent-codex.spec.ts`
- Related public workflow subsystem docs checked for API consistency: `docs/subsystems/workflow.md`, `docs/subsystems/workflow.zh.md`

## Findings

### F1. `disposeGraceMs` public Config JSDoc still says it bounds `dispose()`

Severity: Medium

Location: `packages/workflow/workflow-worker-thread/src/index.ts:43-48`

The public `Config.disposeGraceMs` JSDoc still says `5000 ms); also bounds dispose().`, but the implementation now deliberately waits for host-side provider starts and child disposal after worker termination:

- `WorkerRun.dispose()` races only `result + childQuiescence` against `sleep(disposeGraceMs)`, then terminates the worker and awaits `childQuiescence()` again.
- `packages/workflow/workflow-worker-thread/README.md` now documents the new contract correctly: `disposeGraceMs` bounds worker settlement and termination, not provider-owned cleanup.
- `docs/subsystems/workflow.md` also says provider start/disposal can delay `dispose()`.

Impact: generated/public Config documentation can still promise a bounded public `dispose()` call even though the new lifecycle contract intentionally allows provider-owned cleanup to extend beyond `disposeGraceMs`. Callers choosing a timeout from the config catalog or JSDoc may rely on a guarantee the implementation no longer provides.

Suggested fix: update the `disposeGraceMs` JSDoc in `packages/workflow/workflow-worker-thread/src/index.ts` to match the README, e.g. "bounds cancellation force-settlement and worker termination; public `dispose()` then awaits remaining host-side provider starts and child disposal."

## Notes

- I did not find a request-id correlation regression in the TypeScript or Python client transport paths. Direction-outside request frames no longer settle client waiters, and server response/notification frames are ignored by the server transport.
- The Codex app-server still handles its private server-request dialect through a package-local subclass, without restoring `onRequest()` to the shared SDK client transport.
- Workflow consumers no longer pass caller signals in `WorkflowStartRequest`; they reject pre-aborted calls and bridge later aborts to the returned run at most once.

## Verification Run

- `gtimeout 55s pnpm exec vitest run packages/sdk/protocol/tests/transport.spec.ts packages/workflow/tool-workflow/tests/tool-workflow.spec.ts packages/workflow/tool-ralph/tests/tool-ralph.spec.ts` — passed, 62 tests.
- `gtimeout 55s pnpm exec vitest run packages/workflow/workflow-worker-thread/tests/workflow-worker-thread.spec.ts` — passed, 54 tests.
- `gtimeout 55s pnpm exec vitest run packages/subagent/subagent-codex/tests/subagent-codex.spec.ts` — passed, 59 tests.
- `gtimeout 55s uv run pytest tests/test_client.py -q` from `python/sdk` — passed, 30 tests.
- `gtimeout 55s pnpm exec tsc -p packages/sdk/protocol/tsconfig.json --noEmit` — passed.
- `gtimeout 55s pnpm exec tsc -p packages/sdk/client/tsconfig.json --noEmit` — passed.
- `gtimeout 55s pnpm exec tsc -p packages/workflow/workflow-worker-thread/tsconfig.json --noEmit` — passed.
- `gtimeout 55s pnpm exec tsc -p packages/subagent/subagent-codex/tsconfig.json --noEmit` — passed.
- `gtimeout 55s pnpm exec tsc -p packages/workflow/tool-workflow/tsconfig.json --noEmit` — passed.
- `gtimeout 55s pnpm exec tsc -p packages/workflow/tool-ralph/tsconfig.json --noEmit` — passed.
- `gtimeout 55s pnpm exec tsc -p packages/workflow/workflow/tsconfig.json --noEmit` — passed.

Initial `gtimeout 55s python -m pytest python/sdk/tests/test_client.py -q` failed during collection because the repository root Python environment did not have `deepseek_harness` installed; the package-local `uv run` command above passed.

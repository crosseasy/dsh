# Reverify Snapshots and SDK Expected Outputs

Date: 2026-08-26
Workspace: `/Users/bytedance/opencode/agent/dsh`
Role: snapshot and SDK expected-output revalidation only.

## Status

STATUS: PASS_WITH_NOTES

All requested executable coverage that is available on this host passed under a `gtimeout 55s` shell wrapper. No `git commit`, `git push`, `git merge`, `git rebase`, or `git reset` command was run.

## Inputs Read

- `.trae/specs/execute-code-optimization-audit/spec.md`
- `.trae/specs/execute-code-optimization-audit/tasks.md`
- `.trae/specs/execute-code-optimization-audit/checklist.md`
- `docs/testing.md`
- `.trae/specs/execute-code-optimization-audit/reports/snapshots-sdk-docs.md`
- `.trae/specs/execute-code-optimization-audit/reports/reverify-browser-settings-cdp.md`

Relevant local process guidance read:

- `verification-before-completion`
- `dsh-pre-push-checks`
- `systematic-debugging`

## Environment Notes

- `node_modules/.bin/vitest` and `node_modules/.bin/tsx` are present.
- `dist-exe/dsh-jsonrpc-agent-pkg-macos-arm64` is present, with its `rg` and `spawn-helper` sidecars.
- `python/sdk/.venv/bin/python` and `python/sdk/.venv/bin/pytest` are present.
- `pwsh` is not on `PATH`; ACP PowerShell snapshot scenarios are therefore skipped by the suite's own `hasPwsh` guard.
- A relative `UV_PROJECT_ENVIRONMENT=python/sdk/.venv` invocation made `uv` create `python/sdk/python/sdk/.venv`; that local side effect was removed with `gtimeout 55s rm -rf python/sdk/python`, and a follow-up check confirmed `python/sdk/python` is absent.
- Final DSH-path-scoped process scan found no `vitest`, `dsh-jsonrpc`, `jsonrpc-demo`, `acp-demo`, `headless-driver`, `smoke-python-runtime`, or `apps/cli/src/bin.ts web` process left by this run. A broader `pgrep vitest` matched unrelated `/Users/bytedance/opencode/oa/record2playwright` work outside this workspace.

## Command Results

### Official / Fallback Probe

| Command | Exit | Result |
| --- | ---: | --- |
| `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 pnpm run test:snapshot -- examples/jsonrpc-agent/tests/sdk.snapshot.ts -t 'replays text-turn through the SDK'` | 124 | Timed out before a Vitest result. |
| `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 pnpm run test:snapshot -- examples/jsonrpc-agent/tests/sdk.snapshot.ts -t 'replays text-turn through the SDK' --reporter=verbose` | 124 | The package-script form invoked `vitest ... -- examples/...`, which did not stay limited to the requested file; it ran multiple snapshot files and hit the 55s cap. Its partial output showed `examples/jsonrpc-agent/tests/sdk.snapshot.ts` 4/4 passed, but the command itself is not counted as passing evidence. |
| `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 pnpm exec vitest run --config vitest.snapshot.config.ts examples/jsonrpc-agent/tests/sdk.snapshot.ts -t 'replays text-turn through the SDK' --reporter=verbose` | 0 | Official focused `pnpm exec` path works: 1 passed, 3 skipped. |

### TypeScript SDK Expected Outputs

| Command | Exit | Result |
| --- | ---: | --- |
| `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/jsonrpc-agent/tests/sdk.snapshot.ts --reporter=verbose` | 0 | Source-mode JSON-RPC SDK snapshots passed: 4 passed (`text-turn`, `bash-tool`, `subagent-spawn-in-process`, `persistent-tools`). |
| `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/jsonrpc-agent/tests/sdk.snapshot.ts --reporter=verbose` | 0 | Built/lib JSON-RPC SDK snapshots passed: 4 passed. |
| `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib pnpm exec vitest run --config vitest.snapshot.config.ts examples/jsonrpc-agent/tests/sdk.snapshot.ts --reporter=verbose` | 0 | Official focused built/lib JSON-RPC SDK snapshots passed: 4 passed. |

### Python SDK Expected Outputs

| Command | Exit | Result |
| --- | ---: | --- |
| `gtimeout 55s env PYTHONPATH=python/sdk/src:python/sdk-runtime/src python/sdk/.venv/bin/python scripts/smoke-python-runtime.py --scenario sdk-minimal --exe dist-exe/dsh-jsonrpc-agent-pkg-macos-arm64` | 0 | Fallback source-path smoke passed; validates `scripts/snapshots/python-sdk-single-exe/minimal/model-visible.json`. |
| `gtimeout 55s env PYTHONPATH=python/sdk/src:python/sdk-runtime/src python/sdk/.venv/bin/python scripts/smoke-python-runtime.py --scenario sdk-snapshot --exe dist-exe/dsh-jsonrpc-agent-pkg-macos-arm64` | 0 | Fallback source-path smoke passed; validates `scripts/snapshots/python-sdk-single-exe/advanced/`. |
| `gtimeout 55s env PYTHONPATH=python/sdk/src:python/sdk-runtime/src python/sdk/.venv/bin/python scripts/smoke-python-runtime.py --scenario sdk-fs-search --exe dist-exe/dsh-jsonrpc-agent-pkg-macos-arm64` | 0 | Fallback source-path smoke passed; covers packaged runtime FS/search path. |
| `gtimeout 55s env UV_PROJECT_ENVIRONMENT=/Users/bytedance/opencode/agent/dsh/python/sdk/.venv uv run --project python/sdk python scripts/smoke-python-runtime.py --scenario sdk-minimal --exe dist-exe/dsh-jsonrpc-agent-pkg-macos-arm64` | 0 | Official Python SDK smoke passed; validates minimal expected output. |
| `gtimeout 55s env UV_PROJECT_ENVIRONMENT=/Users/bytedance/opencode/agent/dsh/python/sdk/.venv uv run --project python/sdk python scripts/smoke-python-runtime.py --scenario sdk-snapshot --exe dist-exe/dsh-jsonrpc-agent-pkg-macos-arm64` | 0 | Official Python SDK smoke passed; validates advanced expected output. |
| `gtimeout 55s env PYTHONPATH=python/sdk/src:python/sdk-runtime/src python/sdk/.venv/bin/pytest python/sdk/tests/test_client.py python/sdk/tests/test_runtime_resolution.py python/sdk/tests/test_bundled_runtime.py -q` | 0 | Python SDK client/runtime tests passed. |

### JSON-RPC Transport Unit Coverage

| Command | Exit | Result |
| --- | ---: | --- |
| `gtimeout 55s node_modules/.bin/vitest run packages/sdk/protocol/tests/transport.spec.ts packages/sdk/client/tests/sdk-client.spec.ts packages/sdk/server/tests/server.spec.ts --reporter=verbose` | 0 | 3 files passed; 71 tests passed. Covers request-id correlation, malformed frames, notifications, process exit, and directional client/server behavior. |

### ACP Snapshot Coverage

All commands below used `DSH_SNAPSHOT=replay`, `DSH_SNAPSHOT_MAX_CONCURRENCY=1`, and `DSH_EXAMPLE_MODE=lib` for CI-like built artifact replay unless noted.

- Source workflow: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'workflow-run' --reporter=verbose`
  Exit 0; 1 passed, 92 skipped.
- Source FS: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'fs-read|fs-write|fs-edit|fs-policy-reject|fs-delete-recreate|fs-glob-sampling' --reporter=verbose`
  Exit 0; 9 passed, 84 skipped.
- Source shell: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'bash-tool-turn|pty-tools|persistent-pwsh-tool-turn|pwsh-tool-turn' --reporter=verbose`
  Exit 0; 2 passed, 91 skipped; pwsh scenarios skipped because `pwsh` is unavailable.
- Source lifecycle/sandbox: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'session-query-spill|background-job-admission|cancel-tool-calls|session-sandbox-root' --reporter=verbose`
  Exit 0; 4 passed, 89 skipped.
- Source ACP baseline protocol: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'text-turn' --reporter=verbose`
  Exit 0; 1 passed, 92 skipped.
- Built/lib workflow, code-mode, and advanced ACP: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'workflow-run|code-mode-workspace-context|both-mode-turn|advanced-toolchain|cordis-inspect-jsdoc' --reporter=verbose`
  Exit 0; 5 passed, 88 skipped.
- Built/lib FS, session-query, and sandbox-root: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'fs-read|fs-write|fs-edit|fs-policy-reject|fs-delete-recreate|fs-glob-sampling|session-query-spill|session-sandbox-root' --reporter=verbose`
  Exit 0; 11 passed, 82 skipped.
- Built/lib shell: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'bash-tool-turn|pty-tools|persistent-pwsh-tool-turn|pwsh-tool-turn|bash-spill|cancel-tool-calls' --reporter=verbose`
  Exit 0; 4 passed, 89 skipped; pwsh scenarios skipped because `pwsh` is unavailable.
- Built/lib Agent Instructions: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'agent-instructions|code-mode-workspace-context' --reporter=verbose`
  Exit 0; 2 passed, 91 skipped.
- ACP fixture guards: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/acp.snapshot.ts -t 'snapshot fixtures|packed ACP fixture retains' --reporter=verbose`
  Exit 0; 8 passed, 85 skipped.
- ACP goal snapshot file: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/acp-agent/tests/goal.snapshot.ts --reporter=verbose`
  Exit 0; 2 passed.

### Headless Snapshot Coverage

- Source headless PTY: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/headless.snapshot.ts -t 'replays persistent PTY tools' --reporter=verbose`
  Exit 0; 1 passed, 14 skipped.
- Source headless advanced toolchain: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/headless.snapshot.ts -t 'replays the advanced toolchain' --reporter=verbose`
  Exit 0; 1 passed, 14 skipped.
- Source provider retry and compaction: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/headless.snapshot.ts -t 'retries a transient provider failure|recovers from context overflow' --reporter=verbose`
  Exit 0; 2 passed, 13 skipped.
- Built/lib selected headless snapshots: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/headless.snapshot.ts -t 'replays the advanced toolchain|replays persistent PTY tools|retries a transient provider failure|recovers from context overflow' --reporter=verbose`
  Exit 0; 4 passed, 11 skipped.
- Built/lib product headless profile and startup failure: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/headless.snapshot.ts -t 'runs one task through the product headless profile command|prints a terminal model failure through the product headless profile command|prints the original Loader activation error' --reporter=verbose`
  Exit 0; 3 passed, 12 skipped.
- Headless Agent Instructions resume: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/workspace-context-resume.snapshot.ts --reporter=verbose`
  Exit 0; 2 passed.
- Headless subagent inheritance/diagnostic: `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 DSH_EXAMPLE_MODE=lib node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/subagent-inheritance.snapshot.ts examples/headless-agent/tests/subagent-diagnostic.snapshot.ts --reporter=verbose`
  Exit 0; 2 passed.

## Settings Coverage Note

`rg` found no ACP/headless snapshot scenario whose test name or scenario metadata directly targets Settings. The repository's Settings snapshot surfaces are Web tests:

- `apps/web/tests/settings-chrome.e2e.ts`
- `apps/web/tests/models-settings.e2e.ts`

Those tests launch Playwright Chromium directly, while the workspace browser rule requires external Chrome over CDP port `9333`. I did not run them in this reverify pass. The Settings UI path is covered by the existing CDP report at `.trae/specs/execute-code-optimization-audit/reports/reverify-browser-settings-cdp.md`, which reports PASS and no browser console warnings/errors.

## Failures / Limitations

- `pnpm run test:snapshot -- ...` is not usable as a 55-second focused command because the package-script argument form ran beyond the requested file filter and timed out with exit 124. `pnpm exec vitest run --config vitest.snapshot.config.ts <files>` worked and was used for official focused Vitest coverage.
- PowerShell snapshot coverage is unavailable on this host: `command -v pwsh` reported `pwsh missing`, and the ACP suite skipped `pwsh-tool-turn` and `persistent-pwsh-tool-turn`.
- Web settings snapshots were not rerun here for the reason above; the external Chrome/CDP settings reverify report remains the settings evidence for this audit.

## Final Verdict

The requested keyless snapshot and dual SDK expected-output coverage that can run on this host within 55 seconds passed. Remaining limitations are environmental or scope-related, not observed product snapshot mismatches.

# Focused Tests Report

Status: FAIL
Generated: 2026-08-26
Scope: Current completed focused validation commands for Tasks 1-19. No business code was edited. No git commit/push/merge/rebase/reset was run. Every shell command below was wrapped with `gtimeout 55s`.

## Preflight

| Command | Exit | Key Output |
| --- | ---: | --- |
| `gtimeout 55s wc -l .trae/specs/execute-code-optimization-audit/spec.md .trae/specs/execute-code-optimization-audit/tasks.md .trae/specs/execute-code-optimization-audit/checklist.md docs/testing.md` | 0 | 386 total lines. |
| `gtimeout 55s cat .trae/specs/execute-code-optimization-audit/spec.md` | 0 | Spec read completely. |
| `gtimeout 55s cat .trae/specs/execute-code-optimization-audit/tasks.md` | 0 | Tasks read completely; Task 1-19 marked done, Task 20 pending. |
| `gtimeout 55s cat .trae/specs/execute-code-optimization-audit/checklist.md` | 0 | Checklist read completely; several final verification items still unchecked. |
| `gtimeout 55s cat docs/testing.md` | 0 | Testing policy read completely. |
| `gtimeout 55s git status --short --branch` | 0 | Branch `feat_825...origin/feat_825`; many pre-existing modified/added files. |
| `gtimeout 55s rg --files .trae/specs/execute-code-optimization-audit` | 0 | Found `spec.md`, `tasks.md`, `checklist.md`, `progress.md`. |
| `gtimeout 55s cat .trae/specs/execute-code-optimization-audit/progress.md` | 0 | Empty file. |

## Canonical `pnpm exec vitest` Attempts

These commands did not reach Vitest. `pnpm` ran a dependency status check, invoked `pnpm install`, and failed during root `postinstall`.

| Command | Exit | Key Output |
| --- | ---: | --- |
| `gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/redact.spec.ts packages/host/apiproxy/tests/api-proxy-config.spec.ts packages/client/ui-settings/tests/schema.client.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts` | 1 | `[install-lefthook] refusing to overwrite unowned hooks directory .../.git/dsh-hooks`; `pnpm install` failed. |
| `gtimeout 55s pnpm exec vitest run scripts/run-gates.spec.ts scripts/check-workspace-constraints.spec.ts scripts/clean.spec.ts` | 1 | Same `install-lefthook` ownership failure. |
| `gtimeout 55s pnpm exec vitest run packages/preset/agent-presets/tests/mount.spec.ts packages/host/apiproxy/tests/api-proxy-agent-preset.spec.ts packages/settings/settings/tests/settings.spec.ts --maxWorkers=1` | 1 | Same `install-lefthook` ownership failure. |

Diagnostics:

| Command | Exit | Key Output |
| --- | ---: | --- |
| `gtimeout 55s pnpm config get verify-deps-before-run` | 0 | `undefined`. |
| `gtimeout 55s pnpm config get manage-package-manager-versions` | 0 | `undefined`. |
| `gtimeout 55s ls -l ./node_modules/.bin/vitest ./node_modules/.bin/tsx ./node_modules/.bin/tsc ./node_modules/.bin/jscpd` | 0 | Local tool binaries exist. |
| `gtimeout 55s ./node_modules/.bin/vitest --version` | 0 | `vitest/4.1.8 darwin-arm64 node-v24.14.0`. |

## Focused Unit / Integration Results

| Surface | Command | Exit | Key Output |
| --- | --- | ---: | --- |
| Settings wire, ApiProxy config, UI settings schema, pi-ai config | `gtimeout 55s ./node_modules/.bin/vitest run packages/settings/settings/tests/redact.spec.ts packages/host/apiproxy/tests/api-proxy-config.spec.ts packages/client/ui-settings/tests/schema.client.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts` | 0 | 4 files, 73 tests passed. |
| Hygiene scripts | `gtimeout 55s ./node_modules/.bin/vitest run scripts/run-gates.spec.ts scripts/check-workspace-constraints.spec.ts scripts/clean.spec.ts` | 0 | 3 files, 65 tests passed. |
| Preset generation and Settings registration lifecycle | `gtimeout 55s ./node_modules/.bin/vitest run packages/preset/agent-presets/tests/mount.spec.ts packages/host/apiproxy/tests/api-proxy-agent-preset.spec.ts packages/settings/settings/tests/settings.spec.ts --maxWorkers=1` | 0 | 3 files, 188 tests passed. |
| Agent Instructions unit | `gtimeout 55s ./node_modules/.bin/vitest run packages/context/agent-instructions/tests/agent-instructions.spec.ts` | 0 | 1 file, 161 tests passed. |
| Agent Instructions e2e | `gtimeout 55s ./node_modules/.bin/vitest run --config vitest.e2e.config.ts packages/context/agent-instructions/tests/agent-instructions.e2e.ts` | 0 | 1 file skipped; 3 tests skipped due e2e key gating. |
| Subagent out-of-process and ACP unit | `gtimeout 55s ./node_modules/.bin/vitest run packages/subagent/subagent/tests/out-of-process.spec.ts packages/subagent/subagent-acp/tests/subagent-acp.spec.ts` | 0 | 2 files, 61 tests passed; Node emitted `MaxListenersExceededWarning`. |
| ACP loader composition e2e | `gtimeout 55s ./node_modules/.bin/vitest run --config vitest.e2e.config.ts packages/subagent/subagent-acp/tests/loader-composition.e2e.ts` | 0 | 1 file, 1 test passed. |
| FS service/local/E2B/tool FS | `gtimeout 55s ./node_modules/.bin/vitest run packages/fs/fs/tests/service.spec.ts packages/fs/fs-local/tests/filesystem.spec.ts packages/e2b/fs-e2b/tests/filesystem.spec.ts packages/fs/tool-fs/tests/tools.spec.ts packages/fs/tool-fs/tests/integration.spec.ts` | 0 | 5 files, 219 tests passed. |
| Session-reference and compaction | `gtimeout 55s ./node_modules/.bin/vitest run packages/context/session-reference/tests/session-reference.spec.ts packages/compaction/compaction/tests/compaction.spec.ts packages/compaction/compaction-basic/tests/compaction-basic.spec.ts packages/compaction/command-compact/tests/command-compact.spec.ts` | 0 | 4 files, 112 tests passed. |
| Tools `/testing` and llm-retry `/testing` | `gtimeout 55s ./node_modules/.bin/vitest run packages/core/tools/tests/tools.spec.ts packages/core/tools/tests/ts-types.spec.ts packages/core/tools/tests/schema.spec.ts packages/llm/llm-retry/tests/retry.spec.ts packages/llm/llm-retry/tests/loader-composition.spec.ts packages/llm/llm-retry/tests/persistence.spec.ts packages/llm/llm-retry/tests/transport-recovery.spec.ts packages/llm/llm-retry/tests/invariant.spec.ts` | 0 | 8 files, 221 tests passed. |
| FS lstat source inventory | `gtimeout 55s bash -lc 'if rg "FileSystem\\.lstat|FsPathInfo|probeNoFollow|PathLinkInfo|pathLinkType" packages scripts --glob "!packages/**/lib/**"; then exit 1; else test $? -eq 1; fi'` | 0 | No source matches. |
| Terminal and shell private runtimes | `gtimeout 55s ./node_modules/.bin/vitest run packages/terminal/terminal-bash/tests/session.spec.ts packages/shell/persistent-tool-runtime/tests/runtime.spec.ts packages/shell/shell-runtime/tests/runtime.spec.ts` | 0 | 3 files, 55 tests passed. |
| Persistent bash/pwsh tools | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/tool-bash-persistent/tests/tools.spec.ts packages/shell/tool-pwsh-persistent/tests/tools.spec.ts packages/shell/tool-bash-persistent/tests/loader-composition.spec.ts packages/shell/tool-pwsh-persistent/tests/loader-composition.spec.ts` | 0 | 3 files passed, 1 skipped; 39 tests passed, 1 skipped. |
| Local bash/pwsh executors | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/bash-local/tests/executor.spec.ts packages/shell/bash-local/tests/settings.spec.ts packages/shell/pwsh-local/tests/executor.spec.ts packages/shell/pwsh-local/tests/settings.spec.ts` | 0 | 4 files, 52 tests passed, 27 skipped; Node emitted `MaxListenersExceededWarning`. |
| Bash/pwsh sandbox suites | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/bash-sandbox/tests/sandbox.spec.ts packages/shell/pwsh-sandbox/tests/sandbox.spec.ts` | 0 | 2 files, 65 tests passed, 13 skipped; Node emitted `MaxListenersExceededWarning`. |
| One-shot bash/pwsh tools, first run | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/tool-bash/tests/tools.spec.ts packages/shell/tool-bash/tests/integration.spec.ts packages/shell/tool-pwsh/tests/tools.spec.ts packages/shell/tool-pwsh/tests/integration.spec.ts` | 1 | 1 failed, 150 passed, 6 skipped. Failure: `reports a timeout even when the command traps the signal and exits 0`; output contained `[stderr]\nTerminated: 15\n[timed out after 100ms]\n[exit code: 143]`. |
| One-shot failed test isolated | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/tool-bash/tests/tools.spec.ts -t 'reports a timeout even when the command traps the signal and exits 0'` | 0 | 1 test passed, 85 skipped. |
| One-shot bash/pwsh tools, rerun | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/tool-bash/tests/tools.spec.ts packages/shell/tool-bash/tests/integration.spec.ts packages/shell/tool-pwsh/tests/tools.spec.ts packages/shell/tool-pwsh/tests/integration.spec.ts` | 0 | 3 files passed, 1 skipped; 151 tests passed, 6 skipped. |
| Tool-bash single file rerun | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/tool-bash/tests/tools.spec.ts` | 0 | 1 file, 86 tests passed; Node emitted `MaxListenersExceededWarning`. |
| Workflow cancellation and worker suites | `gtimeout 55s ./node_modules/.bin/vitest run packages/workflow/tool-workflow/tests/tool-workflow.spec.ts packages/workflow/tool-ralph/tests/tool-ralph.spec.ts packages/workflow/tool-ralph/tests/integration.spec.ts packages/workflow/workflow-worker-thread/tests/workflow-worker-thread.spec.ts packages/workflow/workflow-worker-thread/tests/session.spec.ts packages/workflow/workflow/tests/workflow.spec.ts` | 0 | 6 files, 145 tests passed. |
| TypeScript JSON-RPC protocol/client/server and Codex subagent | `gtimeout 55s ./node_modules/.bin/vitest run packages/sdk/protocol/tests/transport.spec.ts packages/sdk/client/tests/sdk-client.spec.ts packages/sdk/server/tests/server.spec.ts packages/subagent/subagent-codex/tests/subagent-codex.spec.ts` | 0 | 4 files, 130 tests passed; output also contained `approval policy is Never; reject command`. |
| Client fixture projections and domain folds | `gtimeout 55s ./node_modules/.bin/vitest run packages/client/connection/tests/fixture.client.spec.ts packages/plan/plan-mode/tests/projection.spec.ts packages/session/session-stats/tests/projection.spec.ts packages/llm/token-meter/tests/token-usage-projection.spec.ts packages/llm/token-meter/tests/context-breakdown-projection.spec.ts packages/core/session/tests/request-header.spec.ts` | 0 | 6 files, 101 tests passed. |

## Built Artifact / SDK / Snapshot Results

| Surface | Command | Exit | Key Output |
| --- | --- | ---: | --- |
| Built artifact smokes | `gtimeout 55s ./node_modules/.bin/vitest run --config vitest.e2e.config.ts packages/workflow/workflow-worker-thread/tests/built-worker.e2e.ts packages/sdk/server/tests/built-scope-carrier.e2e.ts packages/api/remotes/tests/built-lib.e2e.ts packages/examples/acp-demo/tests/built-bin.e2e.ts` | 0 | 4 files, 6 tests passed. |
| Python SDK direct pytest | `gtimeout 55s python -m pytest python/sdk/tests/test_client.py` | 2 | Collection failed: `ModuleNotFoundError: No module named 'deepseek_harness'`. |
| Python SDK source-path pytest | `gtimeout 55s env PYTHONPATH=python/sdk/src python -m pytest python/sdk/tests/test_client.py` | 0 | 30 tests passed. |
| TypeScript SDK JSON-RPC snapshots | `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 ./node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/jsonrpc-agent/tests/sdk.snapshot.ts` | 0 | 4 tests passed: text-turn, bash-tool, subagent-spawn-in-process, persistent-tools. |
| Headless selected snapshots | `gtimeout 55s env DSH_SNAPSHOT=replay DSH_SNAPSHOT_MAX_CONCURRENCY=1 ./node_modules/.bin/vitest run --config vitest.snapshot.config.ts examples/headless-agent/tests/headless.snapshot.ts -t 'retries a transient provider failure|recovers from context overflow|replays two fresh Ralph rounds|replays persistent PTY tools'` | 0 | 4 tests passed, 11 skipped. |

## Pending / Not Yet Run

- Top-level `pnpm run typecheck`, `pnpm run lint`, `pnpm run duplication`, `pnpm run doc-sync`, `pnpm run build`, and `pnpm run hygiene` were not run before the user requested immediate report flush.
- Clean-state vs built-state `pnpm run hygiene` comparison was not run.
- Chrome CDP `9333` Settings UI verification was not run.
- ACP snapshot subset for FS/workflow was not run yet.
- Full `doc-sync` generated catalog/type-equivalence/export-JSDoc verification was not run.

## Failures And Debugging Notes

### Failure 1: `pnpm exec vitest` blocked before tests

Evidence:

- Three independent `pnpm exec vitest ...` commands exited 1 before running Vitest.
- Shared failure: `pnpm install` ran first, then root `postinstall` failed with `[install-lefthook] refusing to overwrite unowned hooks directory /Users/bytedance/opencode/agent/dsh/.git/dsh-hooks`.
- Local `./node_modules/.bin/vitest` exists and successfully ran equivalent focused suites.

Hypotheses:

1. `pnpm` 11 dependency-status verification is trying to repair or validate install state before `exec`, and that path invokes lifecycle scripts.
2. The checkout has an existing `.git/dsh-hooks` directory that lacks the marker/ownership state expected by `scripts/install-lefthook.mjs`, so any install/postinstall path fails closed.

Suggested fix:

- Inspect `.git/dsh-hooks` ownership marker and Git hook configuration with the owner of the worktree. Repair by running the documented hook installer only after confirming whether the existing hook directory is user-owned. Do not bypass this silently in CI gates.
- For validation-only local reruns before repair, use already-installed binaries (`./node_modules/.bin/vitest`, `./node_modules/.bin/tsx`, etc.) and record that canonical `pnpm` entry is blocked.

### Failure 2: One-shot bash timeout test failed once, passed in isolation and on rerun

Evidence:

- First grouped one-shot command exited 1.
- Failed assertion in `packages/shell/tool-bash/tests/tools.spec.ts`: expected trapped-timeout output not to contain `[exit code:]`.
- Actual output contained `[stderr]\nTerminated: 15\n[timed out after 100ms]\n[exit code: 143]`.
- The exact test passed when isolated, and the same grouped command passed on rerun.

Hypotheses:

1. The test is timing-sensitive on macOS bash/process signaling: `sleep` can terminate with 143 before the shell's `trap "exit 0" TERM` path wins, making the rendered exit-code marker nondeterministic.
2. Parallel shell/process-heavy suites cause scheduling pressure that changes whether the parent shell traps SIGTERM before the child `sleep` reports termination.

Suggested fix:

- Make the test's trap scenario deterministic, for example by ensuring the shell process itself receives and handles TERM before child termination determines the observed exit status, or assert the intended executor result fields separately from platform-dependent stderr/child exit behavior.
- Consider isolating this specific timeout race test or using a helper script that proves the trapped zero-exit path reliably on macOS.

### Failure 3: Python SDK direct pytest cannot import package

Evidence:

- `python -m pytest python/sdk/tests/test_client.py` exited 2 during collection with `ModuleNotFoundError: No module named 'deepseek_harness'`.
- `PYTHONPATH=python/sdk/src python -m pytest python/sdk/tests/test_client.py` exited 0 with 30 tests passed.

Hypotheses:

1. The Python SDK package is not installed into the active Python environment, so direct pytest lacks source import roots.
2. The intended local test invocation for source checkout requires `PYTHONPATH=python/sdk/src` or an editable install, but that prerequisite is not encoded in the direct command.

Suggested fix:

- Document or script the local Python SDK source invocation, or install the SDK editable in the validation environment before direct pytest.

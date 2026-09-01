# Shell Timeout Flake Reverification

Status: PASS
Generated: 2026-08-26
Scope: Reverify the one-shot bash/pwsh tool timeout flake reported in `focused-tests.md`. No business code was edited. No git commit/push/merge/rebase/reset was run. Every shell command was wrapped with `gtimeout 55s`.

## Source Failure

`focused-tests.md` recorded one prior grouped one-shot bash/pwsh run failure:

- Command: `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/tool-bash/tests/tools.spec.ts packages/shell/tool-bash/tests/integration.spec.ts packages/shell/tool-pwsh/tests/tools.spec.ts packages/shell/tool-pwsh/tests/integration.spec.ts`
- Failed test: `packages/shell/tool-bash/tests/tools.spec.ts` / `reports a timeout even when the command traps the signal and exits 0`
- Observed output: `[stderr]\nTerminated: 15\n[timed out after 100ms]\n[exit code: 143]`
- Follow-up evidence in the source report: the exact test passed in isolation, and the same grouped command passed on rerun.

## Reverification Runs

| Run | Command | Exit | Result |
| --- | --- | ---: | --- |
| 1 | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/tool-bash/tests/tools.spec.ts packages/shell/tool-bash/tests/integration.spec.ts packages/shell/tool-pwsh/tests/tools.spec.ts packages/shell/tool-pwsh/tests/integration.spec.ts` | 0 | 3 files passed, 1 skipped; 151 tests passed, 6 skipped. |
| 2 | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/tool-bash/tests/tools.spec.ts packages/shell/tool-bash/tests/integration.spec.ts packages/shell/tool-pwsh/tests/tools.spec.ts packages/shell/tool-pwsh/tests/integration.spec.ts` | 0 | 3 files passed, 1 skipped; 151 tests passed, 6 skipped. |
| 3 | `gtimeout 55s ./node_modules/.bin/vitest run packages/shell/tool-bash/tests/tools.spec.ts packages/shell/tool-bash/tests/integration.spec.ts packages/shell/tool-pwsh/tests/tools.spec.ts packages/shell/tool-pwsh/tests/integration.spec.ts` | 0 | 3 files passed, 1 skipped; 151 tests passed, 6 skipped. |

Each run also emitted the existing `MaxListenersExceededWarning` from Node and Vite's `vite-tsconfig-paths` deprecation notice. Neither warning caused a test failure in this pass.

## Conclusion

The shell timeout flake was not reproduced across three consecutive grouped one-shot bash/pwsh tool runs.

FAILURES: none

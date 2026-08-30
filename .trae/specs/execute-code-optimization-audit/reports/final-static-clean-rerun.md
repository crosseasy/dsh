# Final static clean rerun

Date: 2026-08-26

Scope:

- Read `.trae/specs/execute-code-optimization-audit/spec.md`, `tasks.md`, `checklist.md`, and `reports/final-static-after-dup-fix.md` before verification.
- Did not run `git commit`, `git push`, `git merge`, `git rebase`, or `git reset`.
- Every shell command was run through `gtimeout 55s`.
- Ran cleanup for `scripts/staged-lint-probe-*` temporary files using `gtimeout 55s find scripts -maxdepth 1 -name 'staged-lint-probe-*' -delete`.
- A follow-up `gtimeout 55s find scripts -maxdepth 1 -name 'staged-lint-probe-*' -print` returned no output.
- No official verification command hit the 55 second timeout, so no leaf-level decomposition was needed.

## Results

| Command | Result | Evidence |
| --- | --- | --- |
| `gtimeout 55s pnpm run lint` | PASS | Official pnpm entry completed with exit code 0. `run-oxlint.ts .` reported `Found 0 warnings and 0 errors` across 2645 files with 89 rules. |
| `gtimeout 55s pnpm run hygiene` | PASS | `run-gates` reported `14 passed, 0 failed, 0 skipped in 23.17s`. |
| `gtimeout 55s pnpm run duplication` | PASS | `jscpd` reported `No duplicates found` and `Found 0 clones` across 1218 analyzed files. |
| `gtimeout 55s pnpm run typecheck` | PASS | Official pnpm entry completed with exit code 0; `build:lib:host` and `typecheck:contracts-ready` completed. |
| `gtimeout 55s pnpm run build` | PASS | Official pnpm entry completed with exit code 0; root host/client builds and web frontend `vite build` completed, recording 200 client artifacts with 1 public value. |
| `gtimeout 55s pnpm run doc-sync` | PASS | `run-gates` reported `28 passed, 0 failed, 0 skipped in 32.64s`. |
| `gtimeout 55s git diff --check` | PASS | Command exited 0 with no output. |
| `gtimeout 55s git status --short -- vendor .agents/notes/archived` | PASS | Command exited 0 with no output, so no `vendor/` or `.agents/notes/archived/` changes were present. |

## Cleanup note

- A preliminary `gtimeout 55s rm -f scripts/staged-lint-probe-*` returned `zsh:1: no matches found: scripts/staged-lint-probe-*`; the subsequent `find ... -delete` cleanup command completed successfully and the follow-up scan found no matching files.

## Failures

None.

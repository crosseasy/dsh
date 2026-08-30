# Final static gates after duplication fix

Date: 2026-08-26

Scope:

- Read `.trae/specs/execute-code-optimization-audit/spec.md`, `tasks.md`, `checklist.md`, `reports/reverify-pnpm-doc-gates.md`, and `reports/fix-curated-scripts-duplication.md` before verification.
- Did not run `git commit`, `git push`, `git merge`, `git rebase`, or `git reset`.
- Every shell command was run through `gtimeout 55s`.
- No official command hit the 55 second timeout, so no leaf-level decomposition was needed.

## Results

| Command | Result | Evidence |
| --- | --- | --- |
| `gtimeout 55s pnpm run duplication` | PASS | `jscpd` reported `No duplicates found` and `Found 0 clones` across 1218 analyzed files. |
| `gtimeout 55s pnpm run typecheck` | PASS | Official pnpm entry completed with exit code 0; `build:lib:host` and `typecheck:contracts-ready` completed. |
| `gtimeout 55s pnpm run lint` | FAIL | Official pnpm entry completed before timeout with exit code 1. `run-oxlint.ts .` reported one `@stylistic(max-len)` error in `scripts/staged-lint-probe-9e281eef-acfc-4a62-8ba5-c139efeafe36.ts:1:1`: line length 346 exceeds 140. |
| `gtimeout 55s pnpm run build` | PASS | Official pnpm entry completed with exit code 0; root library build, client build, and web frontend `vite build` completed. |
| `gtimeout 55s pnpm run hygiene` | FAIL | Official pnpm entry completed before timeout with exit code 1. `run-gates` reported 13 passed, 1 failed, 0 skipped; failing gate was `knip`, which reported one unused file: `scripts/staged-lint-probe-9e281eef-acfc-4a62-8ba5-c139efeafe36.ts`. |
| `gtimeout 55s pnpm run doc-sync` | PASS | Official pnpm entry completed with exit code 0; `run-gates` reported 28 passed, 0 failed, 0 skipped in 39.87s. |
| `gtimeout 55s git diff --check` | PASS | Command exited 0 with no output. |
| `gtimeout 55s git status --short -- vendor .agents/notes/archived` | PASS | Command exited 0 with no output, so no `vendor/` or `.agents/notes/archived/` changes were present. |

## Failure context

- `gtimeout 55s git status --short -- scripts/staged-lint-probe-9e281eef-acfc-4a62-8ba5-c139efeafe36.ts` returned `?? scripts/staged-lint-probe-9e281eef-acfc-4a62-8ba5-c139efeafe36.ts`.
- The `lint` and `hygiene` failures are both attributable to that untracked probe file.
- No files were removed, reverted, committed, pushed, merged, rebased, or reset during this verification.

## Failures

1. `gtimeout 55s pnpm run lint` fails on `@stylistic(max-len)` for `scripts/staged-lint-probe-9e281eef-acfc-4a62-8ba5-c139efeafe36.ts:1:1`.
2. `gtimeout 55s pnpm run hygiene` fails because `knip` reports `scripts/staged-lint-probe-9e281eef-acfc-4a62-8ba5-c139efeafe36.ts` as an unused file.

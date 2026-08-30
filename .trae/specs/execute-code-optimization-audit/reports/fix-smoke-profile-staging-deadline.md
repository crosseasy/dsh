# Smoke Profile Staging Deadline Fix

STATUS: PASS

## Scope

- Read `.trae/specs/execute-code-optimization-audit/spec.md`.
- Read `.trae/specs/execute-code-optimization-audit/reports/verify-curated-semantic-fix.md`.
- Read `packages/curated/curated-scripts/src/index.ts`.
- Read `packages/curated/curated-scripts/tests/commands.spec.ts`.
- Did not run `git commit`, `git push`, `git merge`, `git rebase`, or `git reset`.
- Did not revert user changes.

## Root Cause

`runSmokeProfile()` only checked the aggregate deadline around `prepare()` and after installed artifact inspection. When no `prepare()` was provided and the command budget was already exhausted, installed artifact inspection still ran and could return an unrelated artifact failure before the staging timeout result.

## Fix

- Reused a single `deadline` in `runSmokeProfile()`.
- Added a deadline check after staging preparation and before synchronous installed artifact inspection.
- Preserved synchronous `validateCandidateArtifact()`.
- Preserved ordered installed bundle comparison through `sameOrderedStrings()`.

## Red-Green Evidence

- RED: `gtimeout 55s pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t "returns a staging timeout before inspection when no budget remains"`
  - Failed with artifact unresolved instead of `smoke-profile budget exhausted during staging`.
- GREEN: same focused command passed after the fix.

## Verification Commands

- `gtimeout 55s pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts`
  - PASSED: 2 files passed, 234 tests passed.
- `gtimeout 55s pnpm run lint`
  - PASSED: oxlint reported 0 warnings and 0 errors after `build:lib:host`.
- `gtimeout 55s pnpm run duplication`
  - PASSED: 0 clones.

## Failures

- None.

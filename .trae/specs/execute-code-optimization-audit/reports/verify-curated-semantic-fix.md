# Curated Semantic Fix Verification

STATUS: FAIL

## Scope

- Read `.trae/specs/execute-code-optimization-audit/spec.md`, `tasks.md`, `checklist.md`, and `reports/final-review-curated-semantics.md` first.
- Reviewed only the curated-scripts semantics relevant to the three Important findings.
- Did not run `git commit`, `git push`, `git merge`, `git rebase`, or `git reset`.
- Did not modify code. This report is the only written artifact.

## Important Findings

### 1. Fixture preflight accepted as observed

STATUS: FIXED

Evidence:

- `packages/curated/curated-scripts/src/index.ts:836` now computes `observed` as `parsed.fixture === undefined && profileRoot !== undefined`.
- `packages/curated/curated-scripts/src/index.ts:842-844` still loads fixture entries when `--fixture` is supplied, so the installed profile is not falsely treated as observed evidence.
- `packages/curated/curated-scripts/tests/commands.spec.ts:1394-1405` covers `--fixture` plus `--profile-root` and expects `observed: false`, `accepted: false`.

### 2. Smoke accepts reordered bundle lists

STATUS: FIXED

Evidence:

- `packages/curated/curated-scripts/src/index.ts:762-763` defines `sameOrderedStrings()`.
- `packages/curated/curated-scripts/src/index.ts:1148-1150` uses ordered comparison for installed smoke profile bundles.
- `packages/curated/curated-scripts/tests/commands.spec.ts:2814-2840` rejects reordered installed bundle lists before running child checks.

### 3. Same-layer duplicate check rejects insert-then-patch

STATUS: FIXED

Evidence:

- `packages/curated/curated-scripts/src/index.ts:923-935` checks same-layer duplicate inserted entries before composing layers, then uses `composeEntries()`.
- `packages/curated/curated-scripts/src/index.ts:2127-2137` scopes same-layer duplicate detection to entries produced by `insert`, not later id-targeted patch rows.
- `packages/curated/curated-scripts/tests/commands.spec.ts:1542-1580` accepts same-layer insert followed by id-targeted patch.
- `packages/curated/curated-scripts/tests/commands.spec.ts:1586-1608` still rejects duplicate inserted ids in one observed patch layer.

## Verification Commands

- `gtimeout 55s pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts`
  - First run: FAILED, 2 failed and 231 passed. The failures were:
    - `smoke-profile command > validates installed artifacts without importing candidate main files or creating a no-op bundle shim`, `commands.spec.ts:2804`, expected status `0` but received `1`.
    - `smoke-profile command > redacts nested JSON secret values from prefixed staging diagnostics`, `commands.spec.ts:2934`, leaked `plainsecret123` in a staging diagnostic.
  - Narrow reruns of both failed tests passed.
  - Full command rerun: PASSED, 2 files passed, 233 tests passed.
- `gtimeout 55s pnpm run duplication`: PASSED, 0 clones.
- `gtimeout 55s pnpm --filter @deepseek-ai/dsh-curated-scripts run typecheck`: PASSED.
- Focused package lint was unavailable because `@deepseek-ai/dsh-curated-scripts` has no `lint` script.
- `gtimeout 55s pnpm run lint`: FAILED before oxlint during `build:lib:host`:
  - `packages/curated/curated-scripts/tests/commands.spec.ts(2974,9): error TS2345: Argument of type 'unknown' is not assignable to parameter of type 'string | undefined'.`
- Additional focused oxlint check:
  - `gtimeout 55s pnpm exec tsx scripts/run-oxlint.ts packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts`
  - FAILED with `typescript(require-await)` at `packages/curated/curated-scripts/src/index.ts:1098`: `validateAndLoadCandidateArtifact()` is `async` but has no `await`.

## Failures

- Repository lint is not passing.
- Focused oxlint is not passing.
- The first full focused vitest run failed but could not be reproduced by narrow reruns or the second full run.

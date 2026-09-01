# Curated Final Review Slice

STATUS: PASS

## Scope

- Read `.trae/specs/execute-code-optimization-audit/spec.md`.
- Read `.trae/specs/execute-code-optimization-audit/reports/final-review-curated-semantics.md`.
- Read `.trae/specs/execute-code-optimization-audit/reports/fix-smoke-profile-staging-deadline.md`.
- Reviewed the current diff for:
  - `packages/curated/curated-scripts/src/index.ts`
  - `packages/curated/curated-scripts/tests/commands.spec.ts`
  - `packages/curated/curated-policy/src/index.ts`
  - `packages/curated/curated-policy/tests/catalog.spec.ts`
  - `packages/curated/curated-bench/baselines/ab-comparisons.json`
  - `packages/curated/curated-bench/baselines/locks/web-curated.json`
  - `packages/curated/curated-bench/baselines/profiles/web-curated.json`
  - `packages/curated/curated-bench/manifests/curated-candidates.json`
  - `packages/curated/curated-bench/tests/bench.spec.ts`
- Checked relevant surrounding implementation in `packages/boot/app-boot/src/profile.ts`, `packages/boot/app-boot/src/index.ts`, `vendor/include/src/index.ts`, and `packages/curated/curated-profiles/src/index.ts`.
- No source files were modified. No `git commit`, `git push`, `git merge`, `git rebase`, or `git reset` was run.

## Findings

No Critical or Important defects were found in this slice.

## Prior Important Regression Checks

- Fixture preflight with `--profile-root`: fixed. `runPreflight()` now derives `observed` from `parsed.fixture === undefined && profileRoot !== undefined`, and the regression test keeps fixture validation non-observed and not accepted even when a profile root is also supplied.
- Ordered smoke profile bundles: fixed. Installed smoke profile inspection now validates all installed bundle entries are strings and compares against the selected template with `sameOrderedStrings()`. The regression test rejects reordered bundle lists before invoking the runner.
- Same-layer insert-then-patch semantics: fixed. Installed preflight composes raw patch layers through `composeEntries()`, while duplicate checks distinguish effective duplicate entry ids from duplicate inserted rows. Tests cover accepting a same-layer Cordis insert followed by an id-targeted patch and rejecting duplicate inserted ids.

## Staging Timeout Check

No residual staging timeout regression was found. `runSmokeProfile()` uses one deadline across preparation, installed artifact inspection, and child stages. It checks the deadline before synchronous artifact inspection, checks again after inspection via `settleBeforeDeadline(Promise.resolve(), deadline)`, and returns the staging timeout before the runner is invoked when the budget is already exhausted or consumed by inspection.

## Additional Curated Checks

- `sameStrings()` remains order-insensitive only for set-like comparisons: artifact dependency sets and benchmark comparison keys. Profile bundle order uses `sameOrderedStrings()`.
- `smoke-profile` no longer imports candidate main files during staging; it validates package metadata, patch existence, patch parseability, and main file existence without executing package code.
- Catalog parsing now requires explicit `scoreDimensions` and `nodeEngineEvidence`; the policy tests cover missing-field rejection.
- Bench snapshot counts match the current policy/profile views: 37 candidates, 11 active globally, 10 active for `web-curated`, and admission tiers `{ default: 11, scenario: 1, experimental: 0, rejected: 25 }`.

## Verification

- `gtimeout 55s pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-bench/tests/bench.spec.ts`
  - Passed: 3 files, 252 tests.
- `gtimeout 55s git diff --check -- packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/src/index.ts packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-bench/baselines/ab-comparisons.json packages/curated/curated-bench/baselines/locks/web-curated.json packages/curated/curated-bench/baselines/profiles/web-curated.json packages/curated/curated-bench/manifests/curated-candidates.json packages/curated/curated-bench/tests/bench.spec.ts`
  - Passed.

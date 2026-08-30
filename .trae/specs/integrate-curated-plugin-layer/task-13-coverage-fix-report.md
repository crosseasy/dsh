# Task 13 Curated Scripts Coverage Fix Report

## Scope

- Target: `packages/curated/curated-scripts/src/index.ts` line 2138 coverage gap in the duplicate entry ID helper.
- Test file: `packages/curated/curated-scripts/tests/commands.spec.ts`.
- Production code: unchanged.

## Existing Test Coverage

- `commands.spec.ts` already contains the focused observed-layer case `accepts Cordis overrides across observed layers but rejects duplicate inserts across layers`.
- The case exercises composed/effective patch entries through `runPreflight()` with installed bundle patches.
- Its accepted branch verifies a config-only override for `shared-entry` composes without producing duplicate entry ID issues, covering the normal empty-issues return path.
- Its rejected branch verifies duplicate `insert` entries across layers still produce `preflight-entry-id-duplicate`, so the same-layer helper is not the only covered path.

## RED Evidence

Command:

```sh
timeout 55s node_modules/.bin/vitest run --coverage packages/curated/curated-scripts/tests/commands.spec.ts
```

Result: exit 1. The test file passed (`151 passed`), but the unscoped repository coverage gate failed on unrelated packages. The coverage table already showed `packages/curated/curated-scripts/src/index.ts` at `100%` statements, branches, functions, and lines.

## GREEN Evidence

Focused test:

```sh
timeout 55s node_modules/.bin/vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t "accepts Cordis overrides across observed layers but rejects duplicate inserts across layers"
```

Result: exit 0, `1 passed`, `150 skipped`.

Focused coverage:

```sh
timeout 55s node_modules/.bin/vitest run --coverage --coverage.include=packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts
```

Result: exit 0, `151 passed`; coverage for `index.ts` was `100%` statements, `100%` branches, `100%` functions, and `100%` lines.

## Notes

- No git commit, push, merge, rebase, reset, or staging operation was run.
- `commands.spec.ts` was already dirty before this report was written; this pass did not add another overlapping test.

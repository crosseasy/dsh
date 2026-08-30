# Mechanical Fix: Curated Test Assertion

## Status

PARTIAL

## Scope

- Updated `packages/curated/curated-scripts/tests/commands.spec.ts`.
- Replaced the hand-written `typeof stageError` throw guards with `expect(stageError).toBeTypeOf('string')` in:
  - `redacts nested JSON secret values from prefixed staging diagnostics`
  - `redacts text secrets after malformed embedded JSON diagnostics`
- No business implementation files were changed.

## Verification

- `gtimeout 55s pnpm run lint`: PASS
  - `run-oxlint.ts .` reported `Found 0 warnings and 0 errors.`
- `gtimeout 55s pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts`: FAIL
  - `packages/curated/curated-policy/tests/catalog.spec.ts`: PASS, 79 tests.
  - `packages/curated/curated-scripts/tests/commands.spec.ts`: 154 passed, 1 failed.
  - The two modified redaction tests passed.

## Failures

- `packages/curated/curated-scripts/tests/commands.spec.ts > smoke-profile command > returns a staging timeout before inspection when no budget remains`
  - Expected issue message: `smoke-profile budget exhausted during staging`
  - Actual issue message: `artifact stage failed for "@deepseek-ai/dsh-toolkit": package is not installed or resolvable`
  - Focused repro command also failed consistently:
    `gtimeout 55s pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t "returns a staging timeout before inspection when no budget remains"`
  - This failure is outside the two requested redaction assertion edits and was not fixed.

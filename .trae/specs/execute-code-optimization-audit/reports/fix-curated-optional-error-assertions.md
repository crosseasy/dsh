# fix-curated-optional-error-assertions

Status: partial

Changed:

- `packages/curated/curated-scripts/tests/commands.spec.ts`

Fix:

- Extracted `payload.stages[0]?.error` into `stageError` in the staging-diagnostics assertions.
- Added `typeof stageError !== 'string'` guards before `.toContain()` / `.not.toContain()` so the contains assertions receive `string`.
- Did not change product implementation.

Verification:

- `gtimeout 55s pnpm run lint`: exit 0; oxlint reported 0 warnings and 0 errors.
- `gtimeout 55s pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts`: exit 1.

Failures:

- `packages/curated/curated-scripts/tests/commands.spec.ts > smoke-profile command > returns a staging timeout before inspection when no budget remains`
- Expected issue message: `smoke-profile budget exhausted during staging`
- Actual issue message: `artifact stage failed for "@deepseek-ai/dsh-toolkit": package is not installed or resolvable`
- `packages/curated/curated-policy/tests/catalog.spec.ts` passed: 79 tests.

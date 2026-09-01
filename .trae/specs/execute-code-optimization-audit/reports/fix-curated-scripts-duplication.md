# Fix curated-scripts duplication

Date: 2026-08-26

Scope:

- Read `spec.md`, `tasks.md`, `checklist.md`, `reports/reverify-pnpm-doc-gates.md`, root `AGENTS.md`, and `packages/AGENTS.md`.
- Did not run `git commit`, `git push`, `git merge`, `git rebase`, or `git reset`.
- Every shell command was run through `gtimeout 55s`.

## Root Cause Hypothesis

`pnpm run duplication` failed because `duplicateEntryIdIssues()` and `sameLayerDuplicateEntryIdIssues()` each implemented the same entry-id scan and diagnostic construction. The intended behavior differs only in which entry list is scanned: composed/effective entries for full patch validation, and raw flattened entries for same-layer installed patch checks.

Alternative fixes considered:

- Keep both functions and add a jscpd ignore: rejected because the clone is small and the logic can be shared locally.
- Merge the two call sites into one branch: rejected because the two public validation contexts remain distinct.
- Extract a private helper: selected because it removes the clone while preserving both callers' current entry selection.

## Change

- Added private `duplicateEntryIdIssuesFor()` in `packages/curated/curated-scripts/src/index.ts`.
- Kept `duplicateEntryIdIssues()` applying `effectivePatchEntries(entries)`.
- Kept `sameLayerDuplicateEntryIdIssues()` scanning the caller-provided flattened patch entries directly.
- No diagnostic code, message text, target selection, or caller behavior was changed.

## Command Output Summary

| Command | Result | Evidence |
| --- | --- | --- |
| `gtimeout 55s pnpm run duplication` | PASS | `jscpd` reported `No duplicates found` and `Found 0 clones`. |
| `gtimeout 55s pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts` | PASS | 2 test files passed; 230 tests passed. Vitest printed the existing `vite-tsconfig-paths` deprecation warning. |
| `gtimeout 55s pnpm --filter @deepseek-ai/dsh-curated-scripts run typecheck` | PASS | Package typecheck ran `tsc -b --pretty false` and exited 0. pnpm printed expected unsupported-platform warnings for Linux landlock packages on Darwin. |

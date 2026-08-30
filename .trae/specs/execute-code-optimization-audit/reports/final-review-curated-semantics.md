# Final Review: curated-scripts semantics

STATUS: FAIL

## Scope

- Reviewed current workspace diff for `packages/curated/curated-scripts/src/index.ts`.
- Required context read: `spec.md`, `tasks.md`, `checklist.md`, `reports/final-code-review.md`, `reports/fix-curated-scripts-duplication.md`, root `AGENTS.md`, `packages/AGENTS.md`, and `docs/defensive-patterns.md`.
- Additional semantic context read: `packages/boot/app-boot/src/profile.ts`, `vendor/include/src/index.ts`, curated profile templates/invariant, curated scripts README, CLI profile reference, and focused `commands.spec.ts` changes.
- No `git commit`, `git push`, `git merge`, `git rebase`, `git reset`, or code modification was performed.

## Critical Findings

None.

## Important Findings

### 1. Fixture preflight can be reported as observed and accepted without reading the installed profile

- Location: `packages/curated/curated-scripts/src/index.ts:837-858`
- Impact: Passing both `--fixture` and an absolute `--profile-root` now validates only the fixture (`loaded = { entries: loadPatchEntries(parsed.fixture), issues: [] }`) but marks the result `observed: true` and `accepted: true` solely because `profileRoot !== undefined`. `parseArgs()` does not make the flags mutually exclusive, and `exactRoot()` only checks that the path is absolute (`packages/curated/curated-scripts/src/index.ts:1874-1940`). This violates the documented evidence contract that explicit fixtures are non-observed and never accepted, while observed preflight resolves the real profile manifest, installed bundle manifests/patches, and profile patch (`packages/curated/curated-scripts/README.md:10`, `:16`, `:37`).
- Evidence: A 55-second repro returned status `0` with `{"observed":true,"accepted":true}` for `--fixture <empty-patch> --profile-root <missing absolute dir> --json`; the installed profile path was never read.
- Severity: Important. This can produce false observed acceptance evidence for a profile that was not actually inspected.

### 2. Smoke accepts reordered bundle lists even though bundle order is profile semantics

- Location: `packages/curated/curated-scripts/src/index.ts:756-759` and `packages/curated/curated-scripts/src/index.ts:1129-1142`
- Impact: `sameStrings()` now sorts both inputs and `inspectInstalledSmokeProfile()` uses it to compare installed `dsh.profile.bundles` with the selected template. Bundle order is not metadata noise: profile boot applies bundle patch layers in manifest order, later layers win, and curated templates document ordered bundle lists (`apps/cli/reference/README.md:9`, `packages/boot/app-boot/README.md:38`, `packages/curated/curated-profiles/src/index.ts:27-30`). A reordered installed profile can therefore mount different effective config while `smoke-profile` reports observed success for the selected template.
- Evidence: The added test at `packages/curated/curated-scripts/tests/commands.spec.ts:2760-2777` locks the order-insensitive behavior. A 55-second repro with installed bundles `["fixture-b","fixture-a"]` and template `["fixture-a","fixture-b"]` returned status `0`, `ok: true`, `observed: true`.
- Severity: Important. This weakens observed smoke evidence by accepting a profile that is not the selected ordered template.

### 3. Same-layer duplicate checking rejects a valid Cordis insert-then-patch pattern

- Location: `packages/curated/curated-scripts/src/index.ts:918-920` and `packages/curated/curated-scripts/src/index.ts:2119-2138`
- Impact: Observed installed preflight calls `sameLayerDuplicateEntryIdIssues(flattenPatchEntries(patchLayer))` before `composeEntries()`. `flattenPatchEntries()` puts inserted rows and later id-targeted patches from the same patch file into one flat list, so a valid Cordis pattern like `- insert: [{ id: x, name: ... }]` followed by `- id: x; config: ...` is flagged as `preflight-entry-id-duplicate`. The include implementation explicitly indexes inserted entries so later patches in the same list can target them (`vendor/include/src/index.ts:77-101`), and `composeEntries()` is the boot-equivalent composition path (`packages/boot/app-boot/src/profile.ts:405-419`).
- Evidence: `composeEntries([[{ insert: [{ id: "x", name: "./plugin.mjs" }] }, { id: "x", config: { v: 1 } }]])` produces one effective entry, while current observed preflight on the same installed patch returns `preflight-entry-id-duplicate`.
- Severity: Important. This creates a false fail for a profile that the real Loader can mount, and it makes observed preflight stricter than the boot semantics it is meant to verify.

## Notes

- The `sameStrings()` change is acceptable for artifact dependency sets and benchmark comparison keys, where order is not semantic. The defect is its reuse for ordered profile bundle layers.
- `loadInstalledProfileEntries()` using `composeEntries()` is directionally correct for cross-layer override semantics; the semantic issue is the extra raw same-layer duplicate scan that treats legitimate patch targets as duplicate inserted entries.

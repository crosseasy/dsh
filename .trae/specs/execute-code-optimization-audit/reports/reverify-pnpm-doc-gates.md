# Reverify pnpm and doc gates

Date: 2026-08-26

Scope:

- Read `.trae/specs/execute-code-optimization-audit/spec.md`, `tasks.md`, `checklist.md`, `reports/static-gates.md`, and `reports/snapshots-sdk-docs.md` before verification.
- Did not run `git commit`, `git push`, `git merge`, `git rebase`, or `git reset`.
- Every shell command was run through `gtimeout 55s`.

## Official pnpm entries

| Command | Result | Evidence |
| --- | --- | --- |
| `gtimeout 55s pnpm run typecheck` | PASS | Official pnpm entry completed; hook sync ran successfully before the gate. |
| `gtimeout 55s pnpm run lint` | PASS | Official pnpm entry completed. |
| `gtimeout 55s pnpm run duplication` | FAIL | `jscpd` found 1 TypeScript clone in `packages/curated/curated-scripts/src/index.ts`: `[2118:53 - 2133:9]` duplicates `[2136:30 - 2151:9]`, 16 lines / 62 tokens. |
| `gtimeout 55s pnpm run build` | PASS | Official pnpm entry completed. |
| `gtimeout 55s pnpm run hygiene` | PASS | Official pnpm entry completed; artifact consumers ran after the build gate. |
| `gtimeout 55s pnpm run doc-sync` | PASS | Rerun passed with `28 passed, 0 failed, 0 skipped in 31.54s`. |

Notes:

- An earlier `doc-sync` attempt in this reverify run hit the 55s wrapper while reporting a transient `cordis catalog` read of a missing `packages/core/oxlint-contract-host-.../src/context.ts` path.
- The direct `verify-cordis-catalog` leaf passed, and the later official `doc-sync` rerun passed, so no persistent doc-sync failure remains.

## doc-sync leaf coverage

| Command | Result | Evidence |
| --- | --- | --- |
| `gtimeout 55s pnpm run doc-typecheck` | PASS | Leaf completed. |
| `gtimeout 55s pnpm run docs:build` | PASS | VitePress build completed; `verify-doc-site-fragments` reported `2410 internal fragment reference(s) resolve; 183 raw-Markdown file(s) and llms.txt emitted`. |
| `gtimeout 55s pnpm run verify-doc-graphs` | PASS | Leaf completed. |
| `gtimeout 55s node_modules/.bin/tsx scripts/verify-md-links.ts` | PASS | `2081 file(s) checked, all relative cross-links and fragments resolve`; this proves the `docs/plugin/superpowers/plans` link repair. |
| `gtimeout 55s pnpm run verify-type-equiv` | PASS | Leaf completed. |
| `gtimeout 55s pnpm run verify-cordis-catalog` | PASS | Leaf completed. |
| `gtimeout 55s pnpm run verify-mermaid` | PASS | Leaf completed. |
| `gtimeout 55s pnpm run verify-scoped-events` | PASS | `packages/core/scope/src/scoped-events.generated.ts is up to date`. |
| `gtimeout 55s pnpm run verify-translation-pairing` | PASS | `1024 pair(s) checked across all in-scope documentation, all consistent`. |
| `gtimeout 55s pnpm run verify-md-wrap` | PASS | `2034 file(s) checked, no hard-wrapped prose paragraphs`. |
| `gtimeout 55s pnpm run verify-client-catalog` | PASS | `packages/extensions/cordis-client-runner/src/client/slot-catalog.ts is up to date`. |
| `gtimeout 55s pnpm run verify-export-jsdoc` | PASS | Every exported package API name is documented. |
| `gtimeout 55s pnpm run verify-tool-catalog` | PASS | `docs/tool-catalog.md is up to date`. |
| `gtimeout 55s pnpm run verify-config-catalog` | PASS | `docs/config-catalog.md is up to date`. |
| `gtimeout 55s pnpm run verify-persistence-catalog` | PASS | `docs/persistence-catalog.md` and `packages/core/session/src/known-event-types.ts` are up to date. |
| `gtimeout 55s pnpm run verify-public-repository-links` | PASS | Tracked files reference no unavailable repository. |
| `gtimeout 55s pnpm run verify-doc-refs` | PASS | `2150 file(s) checked, all documentation references resolve`. |
| `gtimeout 55s pnpm run verify-package-paths` | PASS | `4176 file(s) checked, all packages/* references resolve`. |
| `gtimeout 55s pnpm run verify-config-source-ownership` | PASS | No shipped configuration uses the ordinary inline environment form for credentials or endpoints. |
| `gtimeout 55s pnpm run verify-package-readme-model-experience` | PASS | `234 README(s) checked`, all conform. |
| `gtimeout 55s pnpm run verify-agent-note-classification` | PASS | `607 Agent Note(s) checked, structure consistent`. |
| `gtimeout 55s pnpm run verify-agent-note-format` | PASS | `607 Agent Note(s) checked`, all conform to the file format. |
| `gtimeout 55s pnpm run verify-archived-agent-notes` | PASS | `429 frozen artifact(s) checked across 6 kind(s)`. |
| `gtimeout 55s pnpm run verify-skill-invocation-metadata` | PASS | `6 cross-product skill policy pair(s) aligned`. |
| `gtimeout 55s pnpm run verify-translation-prompt` | PASS | Both translation directions render and examples assemble. |
| `gtimeout 55s pnpm run verify-doc-budgets` | PASS | `9 budgeted docs within ceiling`. |
| `gtimeout 55s pnpm exec vitest run scripts/project-doc-site.spec.ts scripts/verify-doc-site-fragments.spec.ts` | PASS | 2 files passed, 64 tests passed. |
| `gtimeout 55s pnpm run verify-package-readme-limitations` | PASS | `234 package READMEs checked (1 whitelisted), all conform`. |

## Diff check

| Command | Result | Evidence |
| --- | --- | --- |
| `gtimeout 55s git diff --check` | PASS | Command exited 0 with no output before and after writing this report. |

## Failures

1. `gtimeout 55s pnpm run duplication` fails because `jscpd` detects a clone between `duplicateEntryIdIssues` and `sameLayerDuplicateEntryIdIssues` in `packages/curated/curated-scripts/src/index.ts`.

# Fusion Regression Report

English | [中文](fusion-regression-report.zh.md)

Date: 2026-08-23

Status: `TASK_41_REVIEW_COMPLETE_TASK_42_REOPENED_TASK_43_PENDING`

## Current Scope

Fusion Web selects one external row, exact `@linxin666/dsh-pet@0.2.9`. Git Graph, ModLens, SSH, Remote Web UI, Task Board, Skin Center, and Better Sidebar remain unmounted blockers. The public Fusion TUI remains phase 2 `BLOCKED`.

Task 39 froze `HEAD=a5e6deb6f9fbf17d31e8a593722cb0063969549a`, an empty index, and 44 product/support paths relative to the verified Fusion baseline. That historical scope consists of 43 product paths plus `.gitignore`, which owns support policy for excluded execution artifacts. Adding the `docs/user/guide/fusion-tui-profile.*` triplet makes the current scope 47 paths and invalidates the old package and reviews. Task 41 independent reviews are complete; Task 42 final review reopened acceptance for the Task 43 findings. Final verification, the 47-path package, independent reviews, and delivery bookkeeping remain pending.

## Task 42 Verification Evidence

Before the final review reopened acceptance, the Task 42 focused suite passed 200/200 tests across six files. `pnpm run typecheck`, `pnpm run build`, zero-error `pnpm run lint`, `pnpm run hygiene`, `pnpm run doc-sync` with 28/28 gates, `pnpm run docs:check` with 46/46 tests, working-tree and index diff checks, protected-product-scope checks, and the empty-index check all exited `0`. TUI was `NOT RUN (not affected)` because those reviewed changes did not touch TUI, shared preset, core, session, subprocess, or terminal product paths. These results do not replace Task 43.6 final verification.

## Tracked Runtime Evidence

The Task 42 formal runtime evidence is the Pet-only built acceptance invoked through a tracked command and tracked source paths. The Task 42 working-tree source and fixture lock are identified by their content hashes.

| Evidence | UTC interval | Command | Input identity | Recorded result |
| --- | --- | --- | --- | --- |
| Built acceptance | `2026-08-23T13:55:49Z` to `2026-08-23T13:56:02Z` | `DSH_SNAPSHOT=replay pnpm run test:fusion:acceptance:built` | `HEAD=a5e6deb6f9fbf17d31e8a593722cb0063969549a`; Task 42 `apps/web/tests/fusion-real-composition.acceptance.ts` SHA-256 `2c55d78201c17e66c3e66507b407449b9d576f7267dcb25988163379973f48e8`; Task 42 `apps/web/tests/fixtures/fusion-profile/pnpm-lock.yaml` SHA-256 `fd49d8cd89abe36dd8caa05bbb71b144c74bbc178387f3958c8ef847ff215000` | exit `0`; 1/1 |

The Task 42 full driver and oracle provide local supporting evidence. The ignored harness command `sh .superpowers/sdd/ralph-round6-task34-web/run-driver.sh` passed 39/39 twice consecutively, from `2026-08-23T14:16:36Z` to `2026-08-23T14:17:04Z` and from `2026-08-23T14:17:16Z` to `2026-08-23T14:17:37Z`. `TASK34_PHASE=task42-compact-fix node --import tsx .superpowers/sdd/ralph-round6-task34-web/driver-oracles.test.mts` passed 50/50 from `2026-08-23T14:18:02Z` to `2026-08-23T14:18:03Z`. Because `.superpowers/` is ignored, these harness inputs are unavailable from a clean checkout; their results cannot replace the tracked built acceptance or Task 43.6 final verification.

The first system Chrome driver run passed 26 assertions before a `/compact` synchronization race: the UI summary was visible and `compaction/end` preceded the matching successful `command/done` by 6 ms, so the driver's single history read arrived too early. The local driver now uses its bounded conditional wait to reread fresh history until the known compact command id has both successful `command/done` and `compaction/end`, then applies the unchanged lifecycle assertion. No fixed sleep was added, and the two consecutive 39/39 runs above passed after the fix.

Across both consecutive runs, console, page, HTTP, and slot error counts were `0`. The only network failures were two expected export `HEAD` requests per run: each received HTTP 200 before `net::ERR_ABORTED` and matched the export ledger. Cleanup left no server target, listener, process, process-group descendant, service or mock-provider port, temporary directory, or cleanup error.

## Tracked Review And Scope Metadata

The Task 34 V2 package and its review inputs were local-only. Their hashes and verdict counts are omitted because the package cannot be reconstructed from a clean checkout; that review does not establish the current 47-path result.

The Task 39 freeze records source `108b96a10a34941d93ad99b35c3a1f2cee16a9e2`, destination `a5e6deb6f9fbf17d31e8a593722cb0063969549a`, and the historical 44-path scope. Its local manifest and patch construction are not tracked as reproducible commands, so their hashes are omitted. Task 40 reviewed that scope and confirmed VAL-001 through VAL-009. The added TUI guide triplet and Task 43 findings invalidate the old package and verdicts; Task 43.6 owns the final 47-path package and reviews.

## Historical Results

The local commands and complete inputs for the historical stages below are not tracked. Their detailed counts are omitted, and none is current acceptance evidence:

| Stage | External rows | Recorded result | Current meaning |
| --- | --- | --- | --- |
| Six-row Web | ModLens, Task Board, SSH, Remote Web UI, Pet, Git Graph | Local success report only | Superseded by Pet and Git Graph authorization findings |
| Four-row Web | ModLens, Task Board, SSH, Remote Web UI | Local success report only | Superseded by Task Board lifecycle |
| Three-row Web | ModLens, SSH, Remote Web UI | Local success report only | Superseded by package lifecycle findings |
| Zero-row Web | none | Local success report only | Superseded by later Pet admission |
| Two-row Web | Pet and Git Graph `0.2.9` | Local success report only | Superseded by Git Graph active-operation lifecycle |
| One-row Web | Pet `0.2.9` | Task 42 tracked built acceptance passed 1/1; the ignored local driver and oracle are supporting evidence only | Task 43.6 final 47-path package and independent reviews pending |

## Current Acceptance Contracts

- The shared profile setup copies only the four tracked fixture files, rejects pre-installation `node_modules`, performs the frozen install, and verifies the Pet `0.2.9` manifest and resolved entry.
- HTTP snapshots compare status, a normalized complete multimap built from Node HTTP(S) raw header pairs, and original body bytes. Per-request connection and framing headers are explicitly excluded; Pet root normalization replaces only the located boot payload bytes in the captured `Buffer`.
- Command timeout, caller cancellation, and readiness cancellation settle only after the complete process tree stops within the cleanup budget.
- The CI EXIT trap preserves a non-zero acceptance status while terminating and waiting for the Chrome process group and removing its profile.
- Private-package mutation settles callback, removal, and installed-entry integrity checks independently; one failure is rethrown unchanged and multiple failures form an ordered `AggregateError`.

## TUI

The source-validation `dsh-tui@0.7.1` run remains historical PASS evidence under its 41-package rc.5 source closure. The public package series has 20 installable versions through the no-cache response cutoff `2026-08-23T11:18:55Z`. Exact `0.9.0`, published at `2026-08-23T05:35:34.508Z`, passes artifact and license checks, then fails single Liangshen ownership because it packages eight Liangshen files with no supported opt-out. Security, public closure, isolated installation, profile composition, and PTY checks are `NOT RUN` after that first failure. Task 42 recorded TUI as `NOT RUN (not affected)`.

## Remaining Acceptance

Task 41 independent reviews are complete. Task 42 final review reopened acceptance for the Task 43 findings. Final verification, the 47-path package, independent bits, DSH, security, documentation, and plan/design/spec/checklist reviews, and delivery bookkeeping remain pending for Task 43.6.

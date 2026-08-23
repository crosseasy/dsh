# DSH Five-Repository Fusion Implementation Plan (v2)

English | [中文](2026-08-19-dsh-five-repo-fusion.zh.md)

> **For agentic workers:** execute tasks with `superpowers:subagent-driven-development` or `superpowers:executing-plans`, and track steps with checkboxes.
>
> **Historical plan:** this document records the v2 execution plan. The 2026-08-21 Task 12 section records verified outcomes without rewriting earlier planned work as if it had already been known.

**Current status:** Tasks 12 through 38 are complete. The final V2 `exact-product-worktree` package contains exactly 43 product paths, with package SHA-256 `74e694a7c5e5bc18452596b0ec70a7379de1d3459c2073d8f0e1eee9c7b34170` and patch SHA-256 `1f71831a467bd652af7eeedf1561b0e431c95088d7e3cc26c9dfc4e2d5921581`. Its bits review is P0/P1/P2 `0/0/0`, its security review is clean, and its product-documentation and plan/design/spec alignment reviews are Critical/Important/Minor `0/0/0`.

**Current result:** the product delivery selects one external row, exact Pet `0.2.9`. System Chrome 151 through CDP `9333` passes the current built acceptance 1/1, the full Web driver passes 39/39, and the runtime-final oracle passes 50/50. Console, page, network, and cleanup diagnostics are clean, and pre/post target, listener, process, port, and temporary-directory checks leave no residue. Git Graph `0.2.9` is blocked because an active JSON operation and its child process can outlive row-fiber disposal. The Task 22 and Task 29 two-row results remain superseded historical evidence for their exact runs. ModLens `3.24.0` fails server-side request safety before lifecycle or Chrome validation. A fresh no-cache Better Sidebar packument contains 15 installable versions and no release above `0.15.2`; exact `0.15.2` is the sole candidate after the prior cutoff and fails the public rc.5 peer closure at 0/14 before security, lifecycle, isolated installation, composition, boot, or Chrome. These blockers remain unmounted. Task 30 repairs transactional late acquisition, pre-acquisition CI trap ownership, private complete-package Pet mutation, explicit settlement including `Promise.reject(undefined)`, orthogonal failure aggregation with identity-only reference deduplication, one shared cleanup deadline, and observed best-effort outer disposal after deadline expiry. Historical zero-row, three-row, four-row, and six-row results also remain superseded evidence. TUI is `NOT RUN (not affected)`, and public TUI delivery remains phase 2 BLOCKED. Full repository coverage and the actual GitHub-hosted job were not run locally. HEAD remains `6e0f654` with an empty index; restoring staged-only delivery or cleaning commit history requires separate user authorization.

**Goal:** preserve a pure Fusion bundle (`@deepseek-ai/dsh-fusion`), one shared `liangshen` preset, and reproducible exact-row profile assembly while leaving `packages/core/**`, the agent loop, and the session format unchanged.

**Architecture:** the repository-owned integration point lives in `packages/bundle/fusion/`, `apps/cli/config/agent-presets/liangshen/`, profile assembly documentation, and owning tests. The Fusion patch and profile dependency map contain only Pet `0.2.9`.

**Technology:** TypeScript ESM, pnpm workspaces, Cordis plugins, dsh profiles and patches, Vitest, system Chrome with CDP `9333`, and real PTYs.

---

## Global Constraints

- Keep `packages/core/**`, the agent loop, and the session format unchanged. Non-Fusion package edits are limited to restoring the six `cordis/*` runtime event ids, constraining rescope to module and package-metadata references rather than event, locale, or data ids, synchronizing producers, allowlists, consumers, tests, and generated documentation, and bounding REAL process output.
- Accept an exact package only after isolated install, composition, real boot, visible target capability, clean browser or terminal diagnostics, complete effect/disposer ownership, and disconnect remounting. Record peer drift without treating it alone as a runtime failure.
- Pin every external package exactly; do not use `^`, `~`, or `latest`.
- Keep third-party runtime dependencies out of `packages/bundle/fusion/package.json`.
- Keep the REAL composition fixture limited to the exact Pet dependency and React peers, with no external `allowBuilds`; no Pet or React entry belongs in the repository root, whose package, lockfile, and workspace files remain unchanged.
- Keep one implementation for each capability and reject duplicate rows.
- Use system Chrome through CDP `9333`; do not call `chromium.launch()` or use an IDE browser.
- Keep default unit and coverage tests offline. Only the explicit REAL composition lane may install profile-local external packages.
- Keep each REAL process stdout/stderr diagnostic tail byte-bounded at 64 KiB while preserving cross-chunk readiness matching.
- Keep `cordis/request-run`, `cordis/request-run-resolved`, `cordis/dynamic-package`, `cordis/dynamic-retract`, `cordis/inspect-query`, and `cordis/inspect-query-resolved` as the sole event ids; add no compatibility aliases.
- Preserve failed and blocked evidence. Do not convert a historical failure into a success.
- Do not reset, rebase, create another commit, push, or merge during Tasks 33 through 35. Restoring a staged-only delivery or cleaning commit history requires separate user authorization and does not block code or runtime verification.
- Deliver phase 1 independently; a phase 2 blocker does not invalidate accepted phase 1 capabilities.

---

## Key References

- Design: `docs/superpowers/specs/2026-08-19-dsh-five-repo-fusion-design.md`
- Patch bundle template: [`packages/bundle/base/`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/base)
- Bundle mechanism: [`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)
- Profile boot: [`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)
- Plugin composition: [`apps/cli/src/plugin.ts`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)
- Preset template: [`standard/`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/config/agent-presets/standard)
- Root build policy: [`pnpm-workspace.yaml`](file:///Users/bytedance/opencode/agent/dsh/pnpm-workspace.yaml)
- Compatibility evidence: `docs/superpowers/plans/fusion-compat-matrix.md`

---

## Phase 1: Core Web Delivery

### Task 0: Lock Exact External Versions

**Purpose:** apply the runtime-experience criterion to each candidate and record exact versions, declared peers, build approvals, capability evidence, and blockers.

- [ ] Build repository artifacts.
- [ ] Test ModLens and each retained Web package in an isolated profile.
- [ ] Verify that describe-image, AionUI Panel, and aggregate `web-ui-all` rows are absent.
- [ ] Append evidence to the compatibility matrix without replacing historical rounds.

### Task 1: Create the Pure Fusion Bundle

**Purpose:** add the smallest buildable patch bundle with no third-party runtime dependencies.

- [ ] Add the package manifest, patch, ESM entry, invariant companion, README pair, and owning test.
- [ ] Register the package in compiler and hygiene inputs only where required.
- [ ] Verify focused tests, typecheck, build, package invariant, and hygiene.

### Task 2: Mount Accepted Web Rows

**Purpose:** insert only exact, accepted profile-owned package rows.

- [ ] Start with a failing exact-set test.
- [ ] Add selected rows to `cordis.patch.yml`.
- [ ] Assert that duplicate and blocked rows remain absent.
- [ ] Verify the focused test and configuration checks.

### Task 3: Add the Shared Liangshen Preset

**Purpose:** preserve one repository-owned preset for Web and TUI.

- [ ] Derive the two-phase tool anchoring from exact source `0.2.4`.
- [ ] Keep the repository sandbox and approval path on Windows; do not copy the unconfined custom Bash implementation.
- [ ] Verify discovery, mounting, isolation, snapshots, and focused platform tests.

### Task 4: Assemble and Validate the Web Profile

**Purpose:** document and run `base -> web-app -> fusion` with exact profile-local dependencies.

- [ ] Record exact dependencies and profile-local build approvals.
- [ ] Boot the real profile and inspect it with system Chrome CDP `9333`.
- [ ] Verify all accepted entries, clean diagnostics, and cleanup.
- [ ] Update paired product guidance and its website projection.

### Task 5: Regress Existing Web Behavior and Deduplication

**Purpose:** prove that accepted Fusion rows do not alter existing `base + web-app` paths.

- [ ] Verify conversation, tool cards, New Session, session list, fork, resume, compact, export, Search, Settings, and model selection.
- [ ] Verify one ModLens image tool, no `describe_image`, no AionUI Panel, one remote implementation, and one Liangshen owner.
- [ ] Verify stock Web, headless, and ACP isolation.
- [ ] Preserve command, browser, and cleanup evidence in the regression report.

### Task 6: Define the Desktop Consumption Contract

**Purpose:** document exact npm consumption and capability ownership without modifying or publishing the external desktop repository.

- [ ] Document the Fusion profile, remote ownership, and desktop-shell responsibilities.
- [ ] Verify package exports, files, and external NodeNext consumption.
- [ ] Run documentation checks without publishing.

---

## Phase 2: Gated Extensions

### Task 7: Better Sidebar

- [ ] Select the highest exact candidate that passes runtime and security criteria.
- [ ] Require an immutable deployment policy that prevents `terminal_*` model-tool registration while preserving the complete Settings experience and functional UI Terminal.
- [ ] If both criteria pass, mount one right-workbench row beside the native left sidebar and verify Files, Editor, Terminal, and Source Control.
- [ ] Otherwise keep Better Sidebar unmounted, record the phase 2 blocker, and preserve phase 1.

### Task 8: TUI

**Current result:** source runtime PASS; public delivery BLOCKED.

- [ ] Select the highest exact version with one Liangshen owner and a consumable package graph.
- [ ] Verify header, status, input, tool promotion, message round trip, durable replay, supported exit, and cleanup in real fresh and resumed PTYs.
- [ ] Record DSH and React peer drift without hiding it.
- [ ] Publish paired guidance only for the accepted recipe.

---

## Final Review Tasks

### Task 9: Original Final Verification

- [ ] Run focused tests, typecheck, build, hygiene, documentation checks, lint, diff checks, and real Web/TUI smoke tests.
- [ ] Complete independent checklist, code, security, architecture, performance, and system-semantics reviews.
- [ ] Record the owning Agent Note and preserve the planning/evidence staging boundary.

### Task 10: Fresh Delivery Review

- [ ] Review the current staged delivery from zero, excluding execution records.
- [ ] Fix Critical and Important findings and independently rereview each fix.

### Task 11: Refresh External Candidates

- [ ] Fetch fresh package metadata and test any higher candidate before changing a lock.
- [ ] Reconcile manifests, guides, decisions, profile manifests, and lockfiles.

### Task 12: 2026-08-21 Task-Level Convergence

- [x] Record the isolated and assembled Chrome evidence that originally admitted license-consistent Git Graph `0.1.11`; the later independent security validation supersedes that admission.
- [x] Verify ModLens `3.22.1` Settings and paste-policy surfaces.
- [x] Resolve package-license identity for Task Board, Remote Web UI, Pet, Skin Center, and Git Graph; license identity does not waive the later Pet and Git Graph authorization blockers.
- [x] Remove Better Sidebar when no acceptable deployment switch can preserve the complete workbench while preventing unsafe model tools.
- [x] Preserve the historical six-row 156/156 runtime aggregate, seven-item/402-token compaction, and restart-resume evidence as superseded evidence rather than current final acceptance.
- [x] Correct durable prose and bilingual semantics using only verified claims.
- [x] Independently confirm the Git Graph revoked-device authorization bypass and the Pet unauthenticated state read/write path; classify Pet, Git Graph, Skin Center, and Better Sidebar as external blockers.
- [x] Reduce the product patch, profile dependency metadata, tests, and product guidance to exactly ModLens `3.22.1`, Task Board `0.1.11`, SSH `0.2.5`, and Remote Web UI `0.1.11`.
- [x] Add a checked-in REAL composition lane that activates all four rows through system Chrome CDP `9333`, never calls `chromium.launch()`, and leaves default unit and coverage tests offline.
- [x] Keep REAL composition dependencies, lock data, and build approvals fixture/profile-local; do not add third-party packages to the root dependencies, root lockfile, or root `allowBuilds`.
- [x] Rerun the complete four-row Web oracle, including existing Web behavior, deduplication, clean diagnostics, compaction, restart-resume, and blocker absence. The independent new result is 170/170 with seven items/401 tokens, 448 to 160 projected tokens, and restart of the same durable session.
- [x] Task 12.11: remove Task Board from the product patch, profile metadata, REAL fixture, tests, and product guidance; converge on the three-row target; withdraw the Task Board-only `data-pane="conversation"` AppFrame contract; preserve the 26-release lifecycle/license/runtime blocker without a shim or core change.
- [x] Task 12.12: restore the six runtime event ids to `cordis/*`; make rescope rewrite module imports but not event or locale ids; update every producer, Remote allowlist, consumer, test, and generated document; add positive module-import and negative event/locale controls; add no alias.
- [x] Task 12.13: independently rereview the TDD implementation that limits each REAL process stdout/stderr diagnostic tail to 64 KiB while preserving cross-chunk readiness matching.
- [x] Task 12.14: rebuild the checked-in fixture for the historical three-row stage, rerun its gate and complete Web oracle, and synchronize that stage's product and generated documentation with their bilingual sidecars. The gate passed 1/1; the complete oracle passed 174/174 with seven items/402 tokens, projected message tokens from 449 to 155, and the same session retaining 155 after restart. Later lifecycle reviews supersede this admission evidence.
- [x] Task 12.15: audit ModLens, SSH, and Remote Web UI lifecycle ownership and revoke the historical three-row admission. ModLens loses route disposers across all DSH candidates; SSH leaves active terminal and SSH sessions open in 26/26 releases; Remote Web UI accepts 0/26 releases because `0.1.11` leaks SSE, tunnel quiescence, client subscriptions, and a failed-pair root while `0.1.12+` also conflicts on manifest/LICENSE identity.
- [x] Task 12.16: repair vendored rescope classification with AST context so module imports continue to rewrite while event and locale ids remain unchanged; retain the dedicated implementation and review reports under `.superpowers/sdd/task13-final/`.
- [x] Task 12.17: converge the Fusion bundle, manifest, REAL fixture/tests, product guidance, desktop contract, website labels, Agent Note, and execution records on zero external rows and eight blockers while preserving the pure ESM exports and invariant companion.

Task 12.7 through Task 12.14 remain checked only as completed historical stages. Their three-row 1/1 and 174/174, four-row 1/1 and 170/170, and six-row 156/156 results are superseded by the later lifecycle and security reviews and do not satisfy Task 13. The top-level Task 12 cross-domain review is complete.

### Task 13: Final Whole-Delivery Acceptance

- [x] Run the complete relevant static and documentation checks.
- [x] Reconfirm the final zero-row Web profile through system Chrome CDP `9333`: the REAL gate passes 1/1, the complete oracle passes 196/196, all three negative controls block as intended, compact records seven items/401 tokens and 448 to 155 projected message tokens, restart retains 155, and the independent review records `EVIDENCE PASS / RUNTIME PASS`. Historical three-row, four-row, and six-row results do not satisfy this item.
- [x] Retain the pure rc.5 source-validation PTY PASS while keeping public delivery phase 2 BLOCKED until a consistent rc.5 closure is publicly available or a new Harness baseline is explicitly approved and fully revalidated.
- [x] Complete the independent checklist review, then append progress once.

### Tasks 14-17: Round 3 Review Convergence

- [x] Repair rescope classification for multiline and TSX/JSX module references, explicit Node resolution calls, and package-manifest dependency keys in valid JSON/JSONC fences while preserving runtime, locale, data, and malformed-fence text.
- [x] Bound REAL command and process-tree cleanup with one deadline, including outcome settlement after tree exit.
- [x] Normalize Chrome target matching by HTTP(S) origin and include the aggregate Web UI package in the documented forbidden set.
- [x] Reconcile acceptance records, stage only the 58 product files, rerun affected and repository-wide checks, and complete exact-staged code and security reviews without unresolved P0, P1, or P2 findings.

### Task 18: Post-Cutoff External Candidate Audit

The audit uses the `2026-08-21T02:11:00Z` cutoff and covers every later release. ModLens now has 76 total releases, 38 DSH candidates, and three post-cutoff candidates; exact `3.23.1` passes artifact, license, install, and composition checks but fails direct dispose/remount. Each of the 17 Web UI identities has both `0.2.6` and `0.2.7` after the cutoff; all 34 exact tarballs are bound, and the applicable license, security, lifecycle, ownership, and deduplication decisions preserve zero Fusion Web rows.

Better Sidebar has 13 releases and exact `0.15.0` remains blocked by deployment ownership and the unconfined ambient-environment PTY sink, not by bypassing the complete ToolRuntime. dsh-TUI has 19 releases; exact `0.8.7` and `0.8.8` each have 24 non-rc.5 peers, zero root and 15 packaged `workspace:*` values, and eight packaged Liangshen files. The historical public-install query covered a direct 23-package subset; the fresh complete source-closure query found exact rc.5 for 0/41 packages. Both new TUI candidates fail static ownership and public-closure gates, so installation and PTY runtime are `NOT RUN`. The [compatibility matrix](fusion-compat-matrix.md) owns the detailed version totals, results, and evidence paths.

### Task 22: Web UI `0.2.8` and `0.2.9` Audit

Task 22 and its independent rereview are complete historical evidence. That task admitted exact Pet and Git Graph `0.2.9`; Task 33 supersedes the Git Graph admission after the later active-operation lifecycle finding. The [compatibility matrix](fusion-compat-matrix.md) owns the freshness cutoff, release totals, ordered checks, per-identity results, and assembled runtime evidence.

Task 23 historically compared each blocked `GET` response with the complete stable response from an independently booted `base + web-app` profile. Mounted JSON, redirect, stock-title route-owned HTML, 404, and 405 controls all differed and failed; at that checkpoint, the admitted Git route was verified separately with `POST /git/branches`. Task 35 supersedes absolute cross-profile root equality while retaining byte-for-byte equality between each profile's blocked `GET` responses and its own `GET /`.

### Task 26: ModLens `3.24.0` and Better Sidebar `0.15.1`

Task 26 is complete. ModLens now has 77 releases and 39 DSH candidates; exact `3.24.0` passes artifact, license, dependency-closure, isolated-install, and composition checks, then fails because a cross-site `POST /modlens/paste` writes the submitted image. Better Sidebar now has 14 installable releases; exact `0.15.1` passes artifact and license checks, then fails because all 14 DSH peer ranges require `^0.1.0-rc.8` and the public registry provides exact rc.5 for 0/14 peer packages. The first failures make every later candidate lifecycle, boot, and Chrome check `NOT RUN`; the two-row Fusion selection remained unchanged at that historical checkpoint.

### Task 28: Better Sidebar `0.15.2`

Task 28 is complete. The execution-time no-cache packument cutoff is `2026-08-22T17:01:07Z`; `latest` is `0.15.2`, the packument has 15 installable manifests, and exact `0.15.2` is the sole release after the prior cutoff. It passes identity, integrity, path safety, and MIT license checks, then fails because all 14 DSH peers require `^0.1.0-rc.8` and the public registry provides exact rc.5 for 0/14 packages. Security, lifecycle, isolated installation, composition, boot, and Chrome are `NOT RUN`; the two-row Fusion selection remained unchanged at that historical checkpoint.

### Task 29: Superseded Two-Row Web Regression

Task 29 is complete historical evidence. One fresh assembled run of the exact Pet and Git Graph `0.2.9` profile passed 36/36 assertions through system Chrome CDP `9333`. It covered conversation rendering, the tool card, New Session create-or-reuse, the session list, fork, resume, compact, both export paths, Search, Settings, model selection, Pet, Git Graph, stock Web behavior, and fresh headless and ACP isolation. Exit, console, page, network, slot, process, port, CDP target, temporary-directory, process-group, and cleanup diagnostics were clean, and the independent rereview reported no findings. Task 33 supersedes this run for current admission without changing its measurements.

### Task 30: Final Convergence

The final exact-staged V8 package is `.superpowers/sdd/round5-final-staged-v8/review-package.md`, with SHA-256 `d4d9e99624bd8f7612e92c477efeaadea1b2b37ee0f268ea6df4704fda42c8dc` and index tree `d77fb5a65673db4232f5ace22726dbf9e091dc29`; it contains 41 files, 3,276 insertions, and 506 deletions. Four focused files pass 110/110 tests. Typecheck, build, zero-error lint, and hygiene pass. Translation pairing checks 945 pairs, Agent Note format checks 542 notes, archived-note verification checks 426 frozen artifacts, Markdown wrap checks 1,874 files, Markdown links check 1,911 files, and document budgets check 9 documents.

System Chrome 151 through CDP `9333` passes the built acceptance 1/1, with zero Fusion targets and listeners afterward. Task 28 summarize regenerates 0/14 and its blocker assertion exits 1 as expected; Task 29 oracles pass 10/10. The Task 28 and Task 29 task reviews are complete. The V8 bits review reports P0/P1/P2 `0/0/0`, the DSH review reports `PASS / APPROVE` with zero findings, and the security review finds no exploitable issue.

All validated remediation findings are closed: transactional late acquisition; the CI trap; the private Pet package copy; explicit settlement that preserves `Promise.reject(undefined)`; orthogonal failure aggregation with object-identity deduplication; one shared cleanup deadline; and observed best-effort outer disposal after that deadline expires. The independent plan/design/spec alignment is `APPROVED` with Critical/Important/Minor `0/0/0`; final checklist, staging, and Git reconciliation and the single final progress append are complete. Full repository coverage and the actual GitHub-hosted job were not run locally.

### Task 35: Pet-Only Root HTML Oracle

- [x] Within each profile, require every blocked `GET` response snapshot to equal that profile's own `GET /`, including byte-for-byte body equality.
- [x] Across the independently booted `base + web-app` and Fusion profiles, require every non-fallback response snapshot and body to remain byte-for-byte identical.
- [x] Require one parseable `window.__DSH_BOOT__` assignment per root response, no Pet entry in baseline, exactly one additional valid Pet entry in Fusion, and a graph revision derived from each side's complete ordered entries.
- [x] Remove the Pet entry from the Fusion graph, recompute the revision from the remaining complete ordered entries, and require the complete Fusion HTML to equal the baseline HTML byte for byte.
- [x] Reject any additional client entry, shared-entry field or order drift, invalid baseline or Fusion graph revision, body difference outside the boot script, mounted JSON, redirect, stock-title route-owned HTML, 404, or 405 control response.
- [x] Synchronize the specification, plan, design, checklist, compatibility matrix, regression report, and owning Agent Note in English and Chinese, re-record all five sidecars, and run the named documentation checks.
- [x] Complete independent review and focused tests; pass the Pet-only built acceptance 1/1 through system Chrome 151/CDP `9333`, the full Web driver 39/39, and the runtime-final oracle 50/50; leave no target, listener, process, port, or temporary-directory residue; then resume Task 34.

---

## Self-Review

- The runtime criterion measures the installed product rather than peer metadata alone.
- Profile ownership prevents third-party dependency trees from polluting the repository workspace.
- Pet `0.2.9` remains admitted by complete evidence. Git Graph `0.2.9` is blocked until a new exact release rejects new work during disposal, cancels and awaits every active JSON/SSE operation and process tree, and passes an in-flight unload plus same-Context remount negative control.
- Every other Web UI identity stops at its first failed or not-selected mandatory check; downstream checks are not inferred from historical evidence.
- First-load visibility cannot waive plugin lifecycle ownership: ModLens, SSH, Remote Web UI, Task Board, and Git Graph remain excluded until a published version satisfies its recorded cleanup, quiescent disposal, disconnect remounting, license identity, rc.5 runtime, and same-page lifecycle requirements.
- Package rescope changes module specifiers, not runtime event or locale ids; the six `cordis/*` ids remain canonical without aliases.
- TUI `0.7.1` and Liangshen source `0.2.4` retain single preset ownership. The pure rc.5 source-validation runtime passes. The historical public-install attempt found 23 missing packages in its direct subset, while the fresh complete query finds exact rc.5 for 0/41 packages; no supported public assembly exists.
- Historical failures and measurements remain evidence. The document header states the current Pet-only delivery status; the Task 12 and Task 22/29 sections label their zero-row, three-row, four-row, six-row, and two-row runtime stages as superseded evidence.

---

## Execution Handoff

Tasks 34 through 38 are complete. The 43-path V2 package and all final reviews are clean; HEAD remains `6e0f654` with an empty index, and staged-only restoration or history cleanup requires separate user authorization.

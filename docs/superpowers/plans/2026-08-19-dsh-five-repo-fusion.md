# DSH Five-Repository Fusion Implementation Plan (v2)

English | [中文](2026-08-19-dsh-five-repo-fusion.zh.md)

> **For agentic workers:** execute tasks with `superpowers:subagent-driven-development` or `superpowers:executing-plans`, and track steps with checkboxes.
>
> **Historical plan:** this document records the v2 execution plan. The 2026-08-21 Task 12 section records verified outcomes without rewriting earlier planned work as if it had already been known.

**Current status:** Tasks 12 through 21 are complete. The Task 18 post-cutoff candidate audit, Task 21 rescope and product-document corrections, independent reviews, final verification remediation, Chrome CDP recovery, and final 64-file alignment review are approved.

**Current result:** the final Web external set is empty. ModLens, SSH, Remote Web UI, Task Board, Pet, Git Graph, Skin Center, and Better Sidebar are evidence-backed blockers; no shim, core change, weakened lifecycle criterion, or historical runtime count may admit them. The post-cutoff audit covers ModLens `3.22.2`/`3.23.0`/`3.23.1`, Web UI `0.2.6`/`0.2.7` for all 17 identities, Better Sidebar `0.15.0`, and dsh-TUI `0.8.7`/`0.8.8`. Pet and Git Graph have static authorization fixes in both new Web UI waves but fail exact license identity; their complete security and runtime checks are `NOT RUN`. Better Sidebar registers through `ctx.tools` but has no package-owned approval decision or immutable deployment lock before model commands reach an unconfined ambient-environment PTY. The current oracle passes 196/196 with compact at seven items/401 tokens, projected message tokens from 448 to 155, and restart retention at 155. The historical three-row 1/1 gate and 174/174 oracle, the four-row 1/1 and 170/170 results, and the six-row 156/156 result remain superseded evidence. The six runtime event ids use canonical `cordis/*` names without aliases. The rescope classifier preserves event and locale ids while recognizing module and package-metadata references, including package dependency keys in valid JSON/JSONC fences; malformed fences remain unchanged. The independently rereviewed REAL process helper keeps a 64 KiB byte-bounded tail per stream. TUI `0.7.1` source runtime passes; `0.8.7` and `0.8.8` runtime is `NOT RUN`, and public delivery remains phase 2 BLOCKED.

**Goal:** preserve a pure Fusion bundle (`@deepseek-ai/dsh-fusion`), one shared `liangshen` preset, and reproducible zero-row profile assembly while leaving `packages/core/**`, the agent loop, and the session format unchanged.

**Architecture:** the repository-owned integration point lives in `packages/bundle/fusion/`, `apps/cli/config/agent-presets/liangshen/`, profile assembly documentation, and owning tests. The Fusion patch and profile dependency map remain empty until a published external package passes every admission criterion.

**Technology:** TypeScript ESM, pnpm workspaces, Cordis plugins, dsh profiles and patches, Vitest, system Chrome with CDP `9333`, and real PTYs.

---

## Global Constraints

- Keep `packages/core/**`, the agent loop, and the session format unchanged. Non-Fusion package edits are limited to restoring the six `cordis/*` runtime event ids, constraining rescope to module and package-metadata references rather than event, locale, or data ids, synchronizing producers, allowlists, consumers, tests, and generated documentation, and bounding REAL process output.
- Accept an exact package only after isolated install, composition, real boot, visible target capability, clean browser or terminal diagnostics, complete effect/disposer ownership, and disconnect remounting. Record peer drift without treating it alone as a runtime failure.
- Pin every external package exactly; do not use `^`, `~`, or `latest`.
- Keep third-party runtime dependencies out of `packages/bundle/fusion/package.json`.
- Keep the zero-row REAL composition fixture and profile free of external dependencies, React peers, and external `allowBuilds`; never add them to the repository root `package.json`, root lockfile, or root `pnpm-workspace.yaml`.
- Keep one implementation for each capability and reject duplicate rows.
- Use system Chrome through CDP `9333`; do not call `chromium.launch()` or use an IDE browser.
- Keep default unit and coverage tests offline. Only the explicit REAL composition lane may install profile-local external packages.
- Keep each REAL process stdout/stderr diagnostic tail byte-bounded at 64 KiB while preserving cross-chunk readiness matching.
- Keep `cordis/request-run`, `cordis/request-run-resolved`, `cordis/dynamic-package`, `cordis/dynamic-retract`, `cordis/inspect-query`, and `cordis/inspect-query-resolved` as the sole event ids; add no compatibility aliases.
- Preserve failed and blocked evidence. Do not convert a historical failure into a success.
- Tracked planning and execution records under `.trae/specs/**` and `docs/superpowers/**` already have Git index entries; keep this round's working-tree modifications to them unstaged. Do not add currently untracked translation counterparts, sidecars, or `.superpowers/**` reports to the Git index.
- Do not commit, push, merge, rebase, or reset without user authorization.
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

---

## Self-Review

- The runtime criterion measures the installed product rather than peer metadata alone.
- Profile ownership prevents third-party dependency trees from polluting the repository workspace.
- ModLens, SSH, Remote Web UI, Task Board, Pet, Git Graph, Skin Center, and Better Sidebar are evidence-backed external blockers, not omitted successes.
- Runtime visibility cannot waive route authorization or artifact-license identity: Pet and Git Graph `0.1.11` retain their historical authorization defects, while `0.2.6` and `0.2.7` have static authorization fixes but remain excluded by exact license conflicts before complete security/runtime validation.
- First-load visibility cannot waive plugin lifecycle ownership: ModLens, SSH, Remote Web UI, and Task Board remain excluded until a published version satisfies complete effect/disposer cleanup, quiescent disposal, disconnect remounting, license identity, rc.5 runtime, and same-page lifecycle validation.
- Package rescope changes module specifiers, not runtime event or locale ids; the six `cordis/*` ids remain canonical without aliases.
- TUI `0.7.1` and Liangshen source `0.2.4` retain single preset ownership. The pure rc.5 source-validation runtime passes. The historical public-install attempt found 23 missing packages in its direct subset, while the fresh complete query finds exact rc.5 for 0/41 packages; no supported public assembly exists.
- Historical failures remain evidence. The document header and Task 18 outcome state the current candidate and delivery status; the Task 12 section labels its three-row, four-row, and six-row runtime stages as superseded evidence.

---

## Execution Handoff

Tasks 12 through 21 are complete. The final Fusion Web external set remains empty, TUI `0.7.1` source runtime remains PASS, TUI `0.8.7` and `0.8.8` runtime remains `NOT RUN`, and public TUI delivery remains phase 2 BLOCKED. The exact 64-file product delivery is staged; planning and execution records remain outside the staged product set. The final progress record is `Round 5 Final 64-File Alignment (2026-08-22)`.

# DSH Five-Repository Fusion Technical Design (v2)

English | [中文](2026-08-19-dsh-five-repo-fusion-design.zh.md)

- Date: 2026-08-19 (v1); 2026-08-20 (v2); Task 12 evidence integrated on 2026-08-21; Task 18, Task 22, and Task 26 evidence integrated on 2026-08-22; Task 28 and Task 29 evidence integrated on 2026-08-23
- Status: historical design updated through completed Task 30, including final gates, task reviews, V8 code/security reviews, remediations, independent plan/design/spec alignment, final reconciliation, and progress
- Repository policy: this tracked planning document retains its existing Git index entry; this round's working-tree modification remains unstaged
- Current result: the staged product delivery contains the exact two-row Pet and Git Graph `0.2.9` profile; its fresh current-composition Web regression passes 36/36 assertions across the complete workflow, exact-row checks, stock behavior, headless and ACP isolation, diagnostics, and cleanup; ModLens `3.24.0` fails server-side request safety, and the sole Better Sidebar release after the prior cutoff, exact `0.15.2`, fails the public rc.5 peer closure before security, lifecycle, installation, or runtime checks; Task 30 adds transactional outer-resource ownership, pre-acquisition CI trap ownership, a private complete-package Pet mutation, explicit rejection settlement, orthogonal failure aggregation with identity-only reference deduplication, one shared cleanup deadline, and observed best-effort outer disposal after deadline expiry; the four-state Pet and Git Graph authorization matrix, selected rows, and public TUI phase 2 BLOCKED verdict remain unchanged

---

## 0. Summary

The Fusion layer composes DeepSeek Harness `0.1.0-rc.5` with capabilities originating from five external repositories:

| Repository | Role | Delivery ownership |
| --- | --- | --- |
| `deepseek-harness-desktop` | Electron shell | Contract only; the external repository is not modified |
| `liustack/modlens` | Image bridge | Exact `3.24.0` server-side request safety fails; no Fusion row |
| `zhu1090093659/dsh-web-ui` | Web capability packages and Liangshen source | `0.2.6` through `0.2.9` audited; Pet and Git Graph `0.2.9` accepted; Liangshen `0.2.4` source retained; other identities are blocked or `NOT SELECTED` |
| `ccch1mneyyy/dsh-TUI` | Terminal UI | Source runtime selected at exact `0.7.1`; `0.8.7`/`0.8.8` statically blocked and runtime `NOT RUN` |
| `omdsh-dev/DSH-better-sidebar` | Right-side workbench | Exact `0.15.2` public rc.5 peer closure fails; not mounted |

Fusion is composition and curation, not a rewrite. Repository code owns the patch bundle, the security-adapted Liangshen preset, the Web profile recipe, TUI delivery-status documentation, tests, and durable product documentation. External package trees remain profile-owned.

The final Web external row set contains `pet` and `ui-git-graph`.

---

## 1. Historical v2 Corrections

### 1.1 Runtime Evidence Replaces Peer Metadata as the Oracle

The original plan treated a peer range containing rc.5 as mandatory. That rule could never accept packages published for later release candidates even when they ran correctly on rc.5.

The v2 criterion accepts an exact version only when isolated installation, composition, real boot, visible target capability, and clean diagnostics pass. Declared peer drift remains recorded evidence and can expose risk, but does not independently prove runtime failure.

### 1.2 Profile Ownership Prevents Repository Pollution

Putting external runtime dependencies in `packages/bundle/fusion/package.json` would install their React, native, editor, SSH, and terminal trees in the repository workspace and conflict with root build policy.

The Fusion package therefore contains only the patch layer and workspace dependencies. Exact external packages and build approvals live in the profile installation root.

### 1.3 Phase 2 Failure Does Not Roll Back Phase 1

The design separates core Web capabilities from the optional right-side workbench and TUI. A blocked extension stays unmounted with complete evidence; accepted capabilities remain deliverable.

---

## 2. Compatibility And Acceptance Criterion

An exact external package passes on rc.5 only when all applicable checks succeed:

1. Exact isolated installation succeeds with profile-local build approvals.
2. The composed profile resolves exactly the intended rows.
3. The real Web or TUI entry starts.
4. The target capability is visible and functional.
5. Browser or terminal diagnostics are clean.
6. License identity and security requirements are satisfied.
7. The resolved DSH runtime dependency graph does not exceed the fixed rc.5 baseline; only peer-range drift receives the documented exception.
8. Plugin-owned subscriptions, roots, observers, listeners, timers, and other resources have complete effect/disposer ownership, and disconnected mounts reattach without duplicate resources.

The criterion proves the tested local composition. It does not promise cross-platform behavior, future API stability, or untested credential-dependent workflows.

License and security failures are first-class blockers. Runtime success cannot waive conflicting artifact licenses, and a functional UI cannot waive a model-tool path that bypasses sandboxing, approval, or environment scrubbing.

---

## 3. Capability Ownership

| Capability | Owner | Excluded duplicate or blocker |
| --- | --- | --- |
| Image understanding | No accepted external owner | The first 38 DSH-capable ModLens versions lack target routes or lose their route disposers; exact `3.24.0` fails server-side request safety before lifecycle |
| Task board | No accepted owner | All 28 published versions fail at least one mandatory check; `0.2.9` stops at lifecycle |
| SSH entry and hosts API | No accepted owner | All 28 SSH releases leave accepted standalone terminal sessions outside plugin disposal |
| Mobile remote UI | No accepted Fusion owner | Remote Web UI accepts 0/28 releases; desktop may retain its own implementation |
| Pet UI | `@linxin666/dsh-pet@0.2.9` | Exact license, authorization, lifecycle, ownership, deduplication, and Chrome checks pass |
| Branch selection and commit topology | `@linxin666/dsh-client-ui-git-graph@0.2.9` | Exact license, authorization, lifecycle, ownership, deduplication, and Chrome checks pass |
| Skin management | No accepted owner | `0.1.12` through `0.2.9` license conflict; `0.1.11` slot invisible |
| Right-side workbench | No accepted owner | Better Sidebar `0.15.2` fails the public rc.5 peer closure at 0/14; later checks are `NOT RUN` |
| Liangshen preset | Repository preset sourced from `0.2.4` | `0.2.8`/`0.2.9` retain unconfined Windows custom Bash; TUI `0.8.7`/`0.8.8` each package a second owner |
| Terminal UI | Source runtime: dsh-TUI `0.7.1`; no public delivery | `0.8.7`/`0.8.8` each package eight Liangshen files, and the fresh complete public rc.5 closure is 0/41 |

ModLens, SSH, Remote Web UI, and Task Board remain excluded until published versions pass their first failing mandatory checks and every later check. Pet and Git Graph are pinned to exact `0.2.9`; older authorization-defective or license-conflicting releases remain rejected. Files, editor, UI Terminal, and Source Control remain the blocked right-workbench capability.

---

## 4. Layered Architecture

```text
L3  Desktop shell contract
L2  Repository Fusion patch, shared Liangshen preset, profile recipes, tests, docs
L1  Pet and Git Graph 0.2.9
L0  DeepSeek Harness core, agent loop, and session format
```

L0 remains unchanged. Cordis maintenance restores six runtime event ids to `cordis/*`, constrains vendored package rescope to module and package-metadata references rather than event, locale, or data ids, and synchronizes the owning API, extension packages, tests, and generated documentation without moving Fusion behavior into the agent loop.

The Web profile orders `base -> web-app -> fusion`. The TUI profile orders `base -> dsh-tui`. The two entries share the repository Liangshen preset but do not render concurrently.

---

## 5. Components

### 5.1 `@deepseek-ai/dsh-fusion`

The package is a pure patch bundle. Its manifest records Pet and Git Graph `0.2.9` in `profileDependencies` and does not declare external packages as standard runtime dependencies. Its patch inserts exactly `pet` and `ui-git-graph`.

The owning test compares the complete two-entry dependency map and row set, rejects blocked and duplicate-capability packages, and loads the bundle through real profile composition.

### 5.2 Shared `liangshen` Preset

The repository preset retains the verified two-phase anchoring from source `0.2.4`. On Windows it uses the repository Bash sandbox and approval path rather than upstream `custom-bash.mjs`, which can run without OS confinement.

The preset is the sole Liangshen owner for Web and TUI. TUI versions that synchronize another Liangshen directory are rejected.

### 5.3 `fusion` And `fusion-tui` Profiles

The Web profile is a reproducible two-row recipe rather than a built-in template. It installs the two exact packages and React `18.3.1` peers without native build approvals. Fusion TUI has no supported public recipe while the registry cannot reproduce its validated rc.5 closure.

The Web profile has no `allowBuilds` entries.

### 5.4 Desktop Shell Contract

The repository documents exact npm consumption, Fusion profile selection, and capability ownership. Fusion supplies no remote implementation, so the desktop shell may retain and manage its own. This repository does not modify, publish, or claim runtime acceptance for the external desktop repository.

---

## 6. Integration And Security Rules

- A bare patch row must have one matching exact profile dependency; missing or extra mappings fail validation.
- Routes reachable through Remote Web UI exposure must enforce server-side request trust and live device authorization; content validation and workspace membership do not authorize a caller.
- Model-visible tools may register through `ctx.tools`, but registration alone does not supply sandboxing, an approval decision, or environment scrubbing. A package that reaches its own PTY sink must provide the missing controls or an immutable deployment lock.
- A user setting is not an immutable deployment policy.
- Disabling an entire settings service is not an acceptable narrow Better Sidebar fix because it breaks all sidebar preference persistence while leaving misleading controls visible.
- Missing external packages fail loudly at boot.
- Model-visible inputs remain reconstructable from the session log.
- Runtime event ids remain `cordis/request-run`, `cordis/request-run-resolved`, `cordis/dynamic-package`, `cordis/dynamic-retract`, `cordis/inspect-query`, and `cordis/inspect-query-resolved`; package rescope must not rewrite these ids or locale ids, and no compatibility aliases are added.
- The checked-in REAL composition gate must boot the exact two-row `base -> web-app -> fusion` profile through system Chrome CDP `9333`; it must not call `chromium.launch()` or use an IDE browser.
- Default unit and coverage tests remain offline. The fixture/profile contains only exact Pet and Git Graph `0.2.9` plus React `18.3.1` peers and no external build approvals. Task 22 adds no Pet, Git Graph, or React entry to the repository root, and the root package, lockfile, and workspace files have no Task 22 diff.
- The REAL process helper retains at most a 64 KiB byte-bounded diagnostic tail for each of stdout and stderr while detecting readiness markers split across chunks.

Better Sidebar remains blocked until an upstream deployment policy hides or disables the unsafe setting, rejects persisted attempts to enable it, prevents tool registration, and preserves the functional UI Terminal and complete Settings experience.

---

## 7. Failure Modes

- **ModLens server safety:** exact `3.24.0` passes artifact, license, dependency-closure, isolated-install, and composition checks, but `POST /modlens/paste` accepts a cross-site request that `/modlens/config` rejects and writes the submitted image. Lifecycle, boot, capability, and Chrome checks are `NOT RUN`; the first 38 DSH candidates retain their recorded route lifecycle results.
- **SSH lifecycle:** all 28 published releases leave accepted standalone terminal sessions outside `SshEngine.dispose()`.
- **Remote Web UI:** 28 releases remain excluded. Exact `0.2.9` fixes license identity but fails security because its `/remote` authorization can be disabled; downstream lifecycle and runtime checks are `NOT RUN`.
- **Task Board lifecycle:** all 28 published versions fail at least one required condition. Exact `0.2.9` fixes license identity but discards its top-level settings subscription disposer. No shim or core change is allowed.
- **License identity:** the `0.2.8` wave has ten direct conflicts; in `0.2.9`, Chat Recovery and Skin Center remain directly conflicted, while Skins and `web-ui-all` inherit a conflicted dependency closure.
- **Describe Image authorization:** exact `0.2.8` and `0.2.9` accept a non-loopback cross-site upload on `/describe-image` and reach the attachment store.
- **Remote Web UI authorization:** exact `0.2.9` skips live device authorization for `/remote` HTTP and WebSocket routes when `requirePairingForLan:false`.
- **Pet and Git Graph:** exact `0.2.9` fixes license identity, retains server-side authorization, and passes live negative controls, disposer/remount checks, isolated profile checks, and the combined Chrome runtime gate.
- **Sidebar public closure:** the execution-time no-cache packument has 15 installable manifests and no release above `0.15.2`. Exact Better Sidebar `0.15.2` declares 14 DSH peers at `^0.1.0-rc.8`; the public registry provides exact rc.5 for 0/14. Security, lifecycle, isolated installation, composition, boot, and Chrome are `NOT RUN` after that first failure.
- **Peer drift:** accepted packages may declare later DSH or different React peers. Record drift and rely on exact runtime evidence; rerun the oracle after any dependency change.
- **Slot drift:** a client can load successfully but register a slot absent from rc.5, as Skin Center `0.1.11` demonstrates.
- **Event-id rescope:** six public `cordis/*` runtime events were rewritten as npm subpaths even though exact-string in-process and wire dispatch does not normalize them. Internal consistency does not make the new ids semantically valid.
- **Acceptance output growth:** unbounded stdout/stderr accumulation can exhaust memory and repeatedly rescan prior output. The independently rereviewed helper retains a 64 KiB byte-bounded tail per stream and preserves cross-chunk readiness matching.
- **Probe errors:** fixed waits and incorrect preconditions can produce false failures. Acceptance probes use capability conditions and preserve rejected attempts as non-final evidence.

---

## 8. Verification Strategy

### 8.1 Existing Web Behavior

Verify conversation rendering, tool cards, New Session create-or-reuse behavior, session list, fork, resume, compact, both export paths, Search, Settings, model selection, stock Web isolation, headless isolation, and ACP isolation.

### 8.2 Exact-Row Web Checks

Verify exactly two external Host rows and browser entries, one Pet root, one Git Graph chip, live Pet-state and Git-branches probes, and no external model tools; every blocked identity must be absent while stock Web remains visible and diagnostics stay clean.

Blocked-route absence compares the complete stable `GET` response with an independently booted `base + web-app` profile. Mounted JSON, redirect, stock-title route-owned HTML, 404, and 405 controls must differ and fail; `POST /git/branches` independently proves the admitted Git route is mounted.

### 8.3 TUI Checks

Verify exact `0.7.1`, one Liangshen owner, no DSH runtime package above rc.5 in the lock, header, model and context state, input, Bash-to-`run_code` promotion, complete response, continuous durable events, resumed rendering, supported exit, and no residual process.

### 8.4 Evidence Levels

Package-level evidence does not prove assembled behavior. The final Web oracle must use the exact two-row `base -> web-app -> fusion` profile through system Chrome CDP `9333`, and final TUI evidence must use the runnable profile through real PTYs. Default unit and coverage suites remain offline.

---

## 9. 2026-08-21 Task 12 Outcome

The historical six-row Web profile has exact manifest, lock, bundle-order, build-approval, package, focused-path, and clean-diagnostics evidence. Its verifier passed 156 of 156 runtime assertions, real compaction replaced seven history items representing 402 tokens, and the same durable session resumed after restart. The later Pet and Git Graph authorization findings supersede that run as final acceptance evidence.

The historical four-row set was ModLens `3.22.1`, Task Board `0.1.11`, SSH `0.2.5`, and Remote Web UI `0.1.11`. Its checked-in REAL composition lane passed 1/1 through system Chrome CDP `9333`, kept exact external dependencies, lock data, and build approvals fixture-local, and remained outside default unit, coverage, Web, and CI collections.

The historical complete four-row oracle passed 170 of 170 assertions. Real compaction shadowed seven items and 401 tokens, reduced projected message tokens from 448 to 160, and restored the same durable session after server restart. The Task Board lifecycle review supersedes the four-row gate and oracle for final acceptance: first load succeeded, but same-page unload/HMR and disconnect remounting did not pass, and none of 26 published versions satisfies lifecycle, license identity, and rc.5 runtime together.

The historical three-row target contained ModLens `3.22.1`, SSH `0.2.5`, and Remote Web UI `0.1.11`. Its checked-in gate passed 1/1 and its complete oracle passed 174/174, with seven items/402 tokens, projected message tokens from 449 to 155, and restart retention at 155 in the same session. The ModLens, SSH, and Remote Web UI lifecycle reviews supersede that admission. At the superseded Task 13 stage, all eight decision-bearing capabilities were blockers, forbidden duplicate rows were rejected, and non-target identities such as Community Plugins, Plugin Manager, Skill Explorer, and Desktop Launcher remained `NOT SELECTED`; that target therefore had zero external rows.

The six runtime event ids use the original `cordis/*` names across producers, the Remote allowlist, consumers, tests, and generated documentation. Rescope positive and negative controls preserve module and package-metadata rewriting without changing event, locale, or data ids; valid JSON/JSONC dependency maps round-trip, malformed fences remain byte-identical, and no compatibility alias exists. The independently rereviewed REAL process helper bounds each stdout/stderr diagnostic tail to 64 KiB while preserving cross-chunk readiness matching and process-tree settlement.

TUI `0.7.1` has reproducible fresh and resumed real PTY evidence with durable replay, supported exits, and no residual processes under a 41-package pure rc.5 source-validation closure. The npm registry lacks rc.5 releases for 23 packages required by that graph, so no supported public command can reproduce it. TUI runtime validation passes, but public delivery remains phase 2 BLOCKED. Liangshen remains sourced from `0.2.4` with the repository security adaptation.

Task 12.1 through Task 12.14 retain task-level and historical evidence, and Task 12.15 through Task 12.17 complete lifecycle review, rescope repair, and zero-row product convergence. Tasks 12 through 17 are complete: the final zero-row REAL gate passes 1/1, the complete oracle passes 196/196, all three negative controls block as intended, and the Round 3 exact-staged code and security reviews are approved.

---

## 10. 2026-08-22 Task 18 Outcome

The post-cutoff audit starts after `2026-08-21T02:11:00Z`. ModLens has 76 total releases, 38 DSH candidates, and three post-cutoff candidates; exact `3.23.1` directly fails dispose/remount. Each of the 17 Web UI identities has two post-cutoff versions, `0.2.6` and `0.2.7`; all 34 exact artifacts have identity, integrity, license, and applicable security, lifecycle, ownership, or deduplication decisions. Better Sidebar has 13 releases, with exact `0.15.0` blocked at its deployment-policy and PTY sink checks.

dsh-TUI has 19 total releases and two post-cutoff candidates, `0.8.7` and `0.8.8`. Both exact artifacts have 24 non-rc.5 DSH peers, zero root and 15 packaged `workspace:*` values, and eight packaged Liangshen files. The historical 23-package count is the direct public-install subset; the fresh complete query finds exact rc.5 for 0/41 packages in the historical source-validation closure. Both candidates fail single-owner and public-closure checks before installation, so their profile and PTY checks are `NOT RUN`. The historical `0.7.1` source runtime PASS remains unchanged.

No Round 5 candidate passed or failed Chrome or PTY validation. Exact mandatory failures make those downstream checks `NOT RUN`. The detailed family counts, artifact/license results, and evidence paths live in the [compatibility matrix](../plans/fusion-compat-matrix.md).

---

## 11. 2026-08-22 Task 22 Outcome

Task 22 and its independent rereview are complete. Fusion admits exact Pet and Git Graph `0.2.9`; the other identities stop at their first failed or not-selected mandatory check. The [compatibility matrix](../plans/fusion-compat-matrix.md) owns the freshness cutoff, release counts, ordered checks, per-identity stop points, and assembled runtime evidence.

---

## 12. 2026-08-22 Task 26 Outcome

Task 26 audits exact ModLens `3.24.0` and Better Sidebar `0.15.1` without a shim or core change. Both tarballs pass identity, integrity, path-safety, and MIT license checks. ModLens has 77 releases and 39 DSH candidates; its no-DSH dependency closure, isolated install, and one-row composition pass before the cross-site paste request fails server safety. Better Sidebar has 14 installable releases; its public rc.5 peer closure fails before installation completes. Every later check is `NOT RUN`, and the two-row Fusion result does not change.

---

## 13. 2026-08-23 Task 28 Outcome

The execution-time no-cache Better Sidebar packument has the HTTP cutoff `2026-08-22T17:01:07Z`, dist-tags `latest: 0.15.2` and `beta: 0.12.0-beta.1`, 16 time-map version keys, and 15 installable manifests. Exact `0.15.2`, published at `2026-08-22T15:35:41.933Z`, is the sole candidate after the prior cutoff. Its identity, SHA-1 and SHA-512 SRI, tar path safety, and MIT license checks pass. The public rc.5 closure fails because all 14 DSH peers require `^0.1.0-rc.8` and exact rc.5 is available for 0/14 packages. Security, lifecycle, isolated installation, composition, boot, and Chrome are `NOT RUN`; the two-row Fusion result does not change.

---

## 14. 2026-08-23 Task 29 Outcome

The exact Pet and Git Graph `0.2.9` profile passes 36/36 assertions in one fresh assembled run through system Chrome CDP `9333`. The run covers conversation rendering, the tool card, New Session create-or-reuse, the session list, fork, resume, compact, both export paths, Search, Settings, model selection, Pet, Git Graph, and unchanged stock Web behavior. Fresh headless and ACP checks remain isolated from Fusion. Exit, console, page, network, slot, process, port, CDP target, temporary-directory, process-group, and cleanup diagnostics are clean, and the independent rereview reports no findings. Historical zero-row, three-row, four-row, and six-row results remain superseded evidence.

---

## 15. 2026-08-23 Task 30 Outcome

The authoritative exact-staged V8 package is `.superpowers/sdd/round5-final-staged-v8/review-package.md`, SHA-256 `d4d9e99624bd8f7612e92c477efeaadea1b2b37ee0f268ea6df4704fda42c8dc`, for index tree `d77fb5a65673db4232f5ace22726dbf9e091dc29`; it contains 41 files, 3,276 insertions, and 506 deletions. Four focused files pass 110/110 tests. Typecheck, build, zero-error lint, and hygiene pass. Translation pairing checks 945 pairs; Agent Note format, archived-note verification, Markdown wrap, Markdown links, and document budgets check 542 notes, 426 frozen artifacts, 1,874 files, 1,911 files, and 9 documents respectively.

System Chrome 151 through CDP `9333` passes the built acceptance 1/1, with zero Fusion targets and listeners afterward. Task 28 summarize regenerates 0/14 and its blocker assertion exits 1 as expected; Task 29 oracles pass 10/10. The Task 28 and Task 29 task reviews are complete. The V8 bits review reports P0/P1/P2 `0/0/0`, the DSH review reports `PASS / APPROVE` with zero findings, and the security review finds no exploitable issue.

The remediation set covers transactional late acquisition, the CI trap, the private Pet package copy, explicit `pending`/`fulfilled`/`rejected` settlement that preserves `Promise.reject(undefined)`, aggregation of orthogonal cancellation/operation/resource/final-cleanup failures with object-identity deduplication, one cleanup deadline shared by acquisition/disposal/final-cleanup/operation settlement, and observed best-effort outer disposal after deadline expiry without extending that deadline. The independent plan/design/spec alignment is `APPROVED` with Critical/Important/Minor `0/0/0`; final checklist, staging, and Git reconciliation and the single final progress append are complete. Full repository coverage and the actual GitHub-hosted job were not run locally.

---

## 16. Revalidation Conditions

Rerun license, security, lifecycle, package, and assembled runtime checks when an external version changes. Revalidate Pet and Git Graph from the first check rather than carrying the `0.2.9` verdict forward. Reconsider ModLens only after its mutating routes enforce the applicable request-trust policy and every route disposer belongs to its plugin fiber. Reconsider SSH only after disposal closes and awaits every accepted terminal and SSH resource. Reconsider Remote Web UI only after live device authorization cannot be disabled and its complete resource cleanup passes. Reconsider Task Board only after one published artifact owns every client subscription and passes same-page unload/HMR validation. Reconsider Skin Center only after a published artifact has consistent license identity and a visible rc.5-compatible Settings registration. Reconsider Better Sidebar only after a complete public dependency closure exists for the approved Harness baseline and a package-owned approval decision or immutable deployment policy satisfies the security and complete-workbench requirements.

Retain the historical zero-row 1/1 and 196/196, six-row 156/156, four-row 1/1 and 170/170, and three-row 1/1 and 174/174 results only as superseded evidence. The current Web target has two exact external rows. TUI public delivery can be reconsidered only after a consistent public closure is available for the approved Harness baseline and one Liangshen owner remains; either path requires complete installation, lock, ownership, PTY, resume, exit, cleanup, and public-command revalidation.

---

## 17. Execution Handoff

Tasks 28 through 30 are complete. Task 30 closed the final gates, task reviews, V8 package binding, broad code and security reviews, all validated remediations, independent plan/design/spec alignment, final checklist/staging/Git reconciliation, and the single final progress append. Planning and evidence records remain outside the staged product set. Full repository coverage and the actual GitHub-hosted job remain CI-owned and were not run locally.

---

## Appendix A: Repository References

- Bundle mechanism: [`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)
- Patch template: [`packages/bundle/base/`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/base)
- Profile boot: [`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)
- Presets: [`packages/preset/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/preset/README.md)
- Composition command: [`apps/cli/src/plugin.ts`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)
- Root build policy: [`pnpm-workspace.yaml`](file:///Users/bytedance/opencode/agent/dsh/pnpm-workspace.yaml)

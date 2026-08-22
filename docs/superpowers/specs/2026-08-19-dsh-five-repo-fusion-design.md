# DSH Five-Repository Fusion Technical Design (v2)

English | [中文](2026-08-19-dsh-five-repo-fusion-design.zh.md)

- Date: 2026-08-19 (v1); 2026-08-20 (v2); Task 12 evidence integrated on 2026-08-21; Task 18 evidence integrated on 2026-08-22
- Status: historical design with Tasks 12 through 21 complete; the Task 18 candidate audit, Task 21 delivery, final verification remediation, Chrome CDP recovery, and final 64-file alignment review are approved
- Repository policy: this tracked planning document retains its existing Git index entry; this round's working-tree modification remains unstaged
- Current result: the final Web external set is empty; ModLens, SSH, Remote Web UI, Task Board, Pet, Git Graph, Skin Center, and Better Sidebar are evidence-backed blockers; Task 18 covers every post-cutoff ModLens, 17-identity Web UI, Better Sidebar, and dsh-TUI release without claiming a candidate Chrome or PTY PASS; the zero-row REAL gate passes 1/1, the complete oracle passes 196/196, all three negative controls block as intended, compact records seven items/401 tokens and 448 to 155 projected message tokens, restart retains 155, and the final exact-staged code and security reviews are approved; the historical three-row 1/1 and 174/174, four-row 1/1 and 170/170, and six-row 156/156 results remain superseded evidence; the six runtime event ids use canonical `cordis/*` names without aliases; rescope preserves event and locale ids while recognizing module and package-metadata references, including dependency keys in valid JSON/JSONC fences, and leaves malformed fences unchanged; the independently rereviewed REAL process helper keeps a 64 KiB byte-bounded tail per stream; TUI `0.7.1` source runtime passes, `0.8.7` and `0.8.8` runtime is `NOT RUN`, and public delivery remains phase 2 BLOCKED

---

## 0. Summary

The Fusion layer composes DeepSeek Harness `0.1.0-rc.5` with capabilities originating from five external repositories:

| Repository | Role | Delivery ownership |
| --- | --- | --- |
| `deepseek-harness-desktop` | Electron shell | Contract only; the external repository is not modified |
| `liustack/modlens` | Image bridge | Exact `3.23.1` dispose/remount fails; no Fusion row |
| `zhu1090093659/dsh-web-ui` | Web capability packages and Liangshen source | Both `0.2.6`/`0.2.7` waves audited; Liangshen `0.2.4` source retained; eight decision-bearing capabilities are blockers, forbidden duplicate rows are rejected, and non-target identities including Community Plugins, Plugin Manager, Skill Explorer, and Desktop Launcher remain `NOT SELECTED` |
| `ccch1mneyyy/dsh-TUI` | Terminal UI | Source runtime selected at exact `0.7.1`; `0.8.7`/`0.8.8` statically blocked and runtime `NOT RUN` |
| `omdsh-dev/DSH-better-sidebar` | Right-side workbench | Exact `0.15.0` security/ownership blocker; not mounted |

Fusion is composition and curation, not a rewrite. Repository code owns the patch bundle, the security-adapted Liangshen preset, the Web profile recipe, TUI delivery-status documentation, tests, and durable product documentation. External package trees remain profile-owned.

The final Web external row set is empty.

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
| Image understanding | No accepted external owner | 38/38 DSH-capable ModLens versions lack target routes or lose their route disposers; exact `3.23.1` fails dispose/remount |
| Task board | No accepted owner | All 26 published versions fail at least one of lifecycle ownership/remounting, manifest/LICENSE identity, or rc.5 runtime |
| SSH entry and hosts API | No accepted owner | All 26 SSH releases leave active terminal and SSH sessions open after plugin disposal |
| Mobile remote UI | No accepted Fusion owner | Remote Web UI accepts 0/26 releases; desktop may retain its own implementation |
| Pet UI | No accepted owner | `0.1.11` authorization defect is historical; `0.2.6`/`0.2.7` have static guards but fail exact license identity |
| Branch selection and commit topology | No accepted owner | `0.1.11` revocation defect is historical; `0.2.6`/`0.2.7` have static guards but fail exact license identity |
| Skin management | No accepted owner | `0.1.12` through `0.2.7` license conflict; `0.1.11` slot invisible |
| Right-side workbench | No accepted owner | Better Sidebar `0.15.0` lacks package-owned approval and an immutable deployment lock before its unconfined ambient-environment PTY sink |
| Liangshen preset | Repository preset sourced from `0.2.4` | `0.2.6`/`0.2.7` retain unconfined Windows custom Bash; TUI `0.8.7`/`0.8.8` each package a second owner |
| Terminal UI | Source runtime: dsh-TUI `0.7.1`; no public delivery | `0.8.7`/`0.8.8` each package eight Liangshen files, and the fresh complete public rc.5 closure is 0/41 |

ModLens, SSH, Remote Web UI, and Task Board remain excluded until published versions provide complete effect/disposer cleanup, quiescent disposal, disconnect remounting, consistent manifest/LICENSE identity, and rc.5 same-page lifecycle validation. Pet and Git Graph `0.2.6` and `0.2.7` enforce static server-side authorization, but remain excluded because those exact artifacts fail license identity before complete negative-control and runtime validation. Files, editor, UI Terminal, and Source Control remain the blocked right-workbench capability.

---

## 4. Layered Architecture

```text
L3  Desktop shell contract
L2  Repository Fusion patch, shared Liangshen preset, profile recipes, tests, docs
L1  No admitted external Web package
L0  DeepSeek Harness core, agent loop, and session format
```

L0 remains unchanged. Cordis maintenance restores six runtime event ids to `cordis/*`, constrains vendored package rescope to module and package-metadata references rather than event, locale, or data ids, and synchronizes the owning API, extension packages, tests, and generated documentation without moving Fusion behavior into the agent loop.

The Web profile orders `base -> web-app -> fusion`. The TUI profile orders `base -> dsh-tui`. The two entries share the repository Liangshen preset but do not render concurrently.

---

## 5. Components

### 5.1 `@deepseek-ai/dsh-fusion`

The package is a pure patch bundle. Its manifest retains an empty `profileDependencies` object and does not declare external packages as standard runtime dependencies. Its final patch is empty.

The owning test compares the complete empty dependency map and row set, rejects all eight external blockers plus duplicate-capability packages, and loads the bundle through real profile composition.

### 5.2 Shared `liangshen` Preset

The repository preset retains the verified two-phase anchoring from source `0.2.4`. On Windows it uses the repository Bash sandbox and approval path rather than upstream `custom-bash.mjs`, which can run without OS confinement.

The preset is the sole Liangshen owner for Web and TUI. TUI versions that synchronize another Liangshen directory are rejected.

### 5.3 `fusion` And `fusion-tui` Profiles

The Web profile is a reproducible zero-row recipe rather than a built-in template. It has no external package, React peer provider, or native build approval. Fusion TUI has no supported public recipe while the registry cannot reproduce its validated rc.5 closure.

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
- The checked-in REAL composition gate must boot the zero-row `base -> web-app -> fusion` profile through system Chrome CDP `9333`; it must not call `chromium.launch()` or use an IDE browser.
- Default unit and coverage tests remain offline. The fixture/profile and repository root contain no external dependencies, React peers, or external build approvals.
- The REAL process helper retains at most a 64 KiB byte-bounded diagnostic tail for each of stdout and stderr while detecting readiness markers split across chunks.

Better Sidebar remains blocked until an upstream deployment policy hides or disables the unsafe setting, rejects persisted attempts to enable it, prevents tool registration, and preserves the functional UI Terminal and complete Settings experience.

---

## 7. Failure Modes

- **ModLens lifecycle:** 38 of 38 published DSH candidates either lack both target routes or call `WebServer.register()` without retaining the route disposers. Exact `3.23.1` passes artifact, license, install, composition, and initial-route checks, but both routes survive disposal and prevent clean same-Context remounting.
- **SSH lifecycle:** all 26 published releases leave accepted terminal WebSockets and standalone SSH clients and channels active after plugin disposal.
- **Remote Web UI lifecycle:** 0 of 26 published releases pass the combined criterion. Version `0.1.11` removes and remounts routes, but open pairing/mobile SSE streams, tunnel quiescence, client subscription disposers, and a failed-pair React root remain incomplete; releases `0.1.12+` also have conflicting manifest/LICENSE identity.
- **Task Board lifecycle:** all 26 published versions fail at least one required condition. License-consistent `0.1.11` has first-load and historical four-row runtime evidence, but it does not place the complete UI disposer and top-level subscription in Cordis effects and does not remount after its container disconnects. Later releases retain lifecycle defects, introduce manifest/LICENSE conflict, or require later runtimes. No shim or core change is allowed.
- **License identity:** published Task Board, Remote Web UI, Pet, Skin Center, and Git Graph releases `0.1.12` through `0.2.7` declare Apache-2.0 while shipping BSD-3-Clause license text. Remote Web UI uses license-consistent `0.1.11`; Skin Center `0.1.11` still fails visibility.
- **Pet authorization:** Pet `0.1.11` registers exact `/api/pet/*` routes without Host, Origin, socket, or live-device checks, allowing an unpaired caller that reaches the shared WebServer to read and persist Pet state. Exact `0.2.6` and `0.2.7` add static request guards, but fail license identity before complete security/runtime validation.
- **Git Graph authorization:** Git Graph `0.1.11` registers `/git/*` outside the Remote Web UI pairing route and permits a revoked device with a known workspace path to read or mutate branches. Exact `0.2.6` and `0.2.7` add static request guards, but fail license identity before complete security/runtime validation.
- **Sidebar model tools:** Better Sidebar `0.15.0` registers eight optional `terminal_*` tools through `ctx.tools`, so they enter the generic ToolRuntime pre-execute chain. The package supplies no approval decision or immutable deployment lock, and model commands reach `nodePty.spawn` with ambient `process.env` outside Harness confinement and environment scrubbing.
- **Peer drift:** accepted packages may declare later DSH or different React peers. Record drift and rely on exact runtime evidence; rerun the oracle after any dependency change.
- **Slot drift:** a client can load successfully but register a slot absent from rc.5, as Skin Center `0.1.11` demonstrates.
- **Event-id rescope:** six public `cordis/*` runtime events were rewritten as npm subpaths even though exact-string in-process and wire dispatch does not normalize them. Internal consistency does not make the new ids semantically valid.
- **Acceptance output growth:** unbounded stdout/stderr accumulation can exhaust memory and repeatedly rescan prior output. The independently rereviewed helper retains a 64 KiB byte-bounded tail per stream and preserves cross-chunk readiness matching.
- **Probe errors:** fixed waits and incorrect preconditions can produce false failures. Acceptance probes use capability conditions and preserve rejected attempts as non-final evidence.

---

## 8. Verification Strategy

### 8.1 Existing Web Behavior

Verify conversation rendering, tool cards, New Session create-or-reuse behavior, session list, fork, resume, compact, both export paths, Search, Settings, model selection, stock Web isolation, headless isolation, and ACP isolation.

### 8.2 Zero-Row Web Checks

Verify zero external Host rows, browser entries, client resources, UI roots, routes, and tools; all eight blocker identities must be absent while stock Web remains visible and diagnostics stay clean.

### 8.3 TUI Checks

Verify exact `0.7.1`, one Liangshen owner, no DSH runtime package above rc.5 in the lock, header, model and context state, input, Bash-to-`run_code` promotion, complete response, continuous durable events, resumed rendering, supported exit, and no residual process.

### 8.4 Evidence Levels

Package-level evidence does not prove assembled behavior. The final Web oracle must use the zero-row `base -> web-app -> fusion` profile through system Chrome CDP `9333`, and final TUI evidence must use the runnable profile through real PTYs. The checked-in REAL composition lane must boot the empty Fusion layer, while default unit and coverage suites remain offline.

---

## 9. 2026-08-21 Task 12 Outcome

The historical six-row Web profile has exact manifest, lock, bundle-order, build-approval, package, focused-path, and clean-diagnostics evidence. Its verifier passed 156 of 156 runtime assertions, real compaction replaced seven history items representing 402 tokens, and the same durable session resumed after restart. The later Pet and Git Graph authorization findings supersede that run as final acceptance evidence.

The historical four-row set was ModLens `3.22.1`, Task Board `0.1.11`, SSH `0.2.5`, and Remote Web UI `0.1.11`. Its checked-in REAL composition lane passed 1/1 through system Chrome CDP `9333`, kept exact external dependencies, lock data, and build approvals fixture-local, and remained outside default unit, coverage, Web, and CI collections.

The historical complete four-row oracle passed 170 of 170 assertions. Real compaction shadowed seven items and 401 tokens, reduced projected message tokens from 448 to 160, and restored the same durable session after server restart. The Task Board lifecycle review supersedes the four-row gate and oracle for final acceptance: first load succeeded, but same-page unload/HMR and disconnect remounting did not pass, and none of 26 published versions satisfies lifecycle, license identity, and rc.5 runtime together.

The historical three-row target contained ModLens `3.22.1`, SSH `0.2.5`, and Remote Web UI `0.1.11`. Its checked-in gate passed 1/1 and its complete oracle passed 174/174, with seven items/402 tokens, projected message tokens from 449 to 155, and restart retention at 155 in the same session. The ModLens, SSH, and Remote Web UI lifecycle reviews supersede that admission. The eight decision-bearing capabilities are blockers, forbidden duplicate rows are rejected, and non-target identities such as Community Plugins, Plugin Manager, Skill Explorer, and Desktop Launcher remain `NOT SELECTED`; the current target therefore has zero external rows.

The six runtime event ids use the original `cordis/*` names across producers, the Remote allowlist, consumers, tests, and generated documentation. Rescope positive and negative controls preserve module and package-metadata rewriting without changing event, locale, or data ids; valid JSON/JSONC dependency maps round-trip, malformed fences remain byte-identical, and no compatibility alias exists. The independently rereviewed REAL process helper bounds each stdout/stderr diagnostic tail to 64 KiB while preserving cross-chunk readiness matching and process-tree settlement.

TUI `0.7.1` has reproducible fresh and resumed real PTY evidence with durable replay, supported exits, and no residual processes under a 41-package pure rc.5 source-validation closure. The npm registry lacks rc.5 releases for 23 packages required by that graph, so no supported public command can reproduce it. TUI runtime validation passes, but public delivery remains phase 2 BLOCKED. Liangshen remains sourced from `0.2.4` with the repository security adaptation.

Task 12.1 through Task 12.14 retain task-level and historical evidence, and Task 12.15 through Task 12.17 complete lifecycle review, rescope repair, and zero-row product convergence. Tasks 12 through 17 are complete: the final zero-row REAL gate passes 1/1, the complete oracle passes 196/196, all three negative controls block as intended, and the Round 3 exact-staged code and security reviews are approved.

---

## 10. 2026-08-22 Task 18 Outcome

The post-cutoff audit starts after `2026-08-21T02:11:00Z`. ModLens has 76 total releases, 38 DSH candidates, and three post-cutoff candidates; exact `3.23.1` directly fails dispose/remount. Each of the 17 Web UI identities has two post-cutoff versions, `0.2.6` and `0.2.7`; all 34 exact artifacts have identity, integrity, license, and applicable security, lifecycle, ownership, or deduplication decisions. Better Sidebar has 13 releases, with exact `0.15.0` blocked at its deployment-policy and PTY sink checks.

dsh-TUI has 19 total releases and two post-cutoff candidates, `0.8.7` and `0.8.8`. Both exact artifacts have 24 non-rc.5 DSH peers, zero root and 15 packaged `workspace:*` values, and eight packaged Liangshen files. The historical 23-package count is the direct public-install subset; the fresh complete query finds exact rc.5 for 0/41 packages in the historical source-validation closure. Both candidates fail single-owner and public-closure checks before installation, so their profile and PTY checks are `NOT RUN`. The historical `0.7.1` source runtime PASS remains unchanged.

No Round 5 candidate passed or failed Chrome or PTY validation. Exact mandatory failures make those downstream checks `NOT RUN`. The detailed family counts, artifact/license results, and evidence paths live in the [compatibility matrix](../plans/fusion-compat-matrix.md).

---

## 11. Revalidation Conditions

Rerun license, security, lifecycle, package, and assembled runtime checks when an external version changes. Reconsider ModLens only after every route disposer belongs to its plugin fiber. Reconsider SSH only after disposal closes and awaits every accepted terminal and SSH resource. Reconsider Remote Web UI only after plugin disposal closes open SSE streams, awaits tunnel and update processes, disposes client subscriptions and roots, and preserves route remounting. Reconsider Task Board only after a published artifact satisfies complete effect/disposer ownership, disconnect remounting, consistent manifest/LICENSE identity, rc.5 runtime, and same-page unload/HMR validation. Reconsider Pet or Git Graph only when one exact artifact combines consistent license identity with the required server-side authorization and passes revocation/unpaired negative controls plus the complete runtime oracle. Reconsider Skin Center only after a published artifact has consistent license identity and a visible rc.5-compatible Settings registration. Reconsider Better Sidebar only after a package-owned approval decision or immutable deployment policy satisfies the security and complete-workbench requirements.

Retain the historical six-row 156/156, four-row 1/1 and 170/170, and three-row 1/1 and 174/174 results only as superseded evidence. The current Web target is zero external rows; its final REAL gate passes 1/1 and its complete oracle passes 196/196, with compact at seven items/401 tokens, projected message tokens from 448 to 155, and restart retention at 155. Cordis restoration includes module and package-metadata positive controls, event/locale/data negative controls, malformed-fence rejection, and synchronized producers, allowlists, consumers, tests, and generated documentation. The process fix has independent rereview of byte bounds, readiness matching, and lifecycle settlement. TUI public delivery can be reconsidered only after a consistent public closure is available for the approved Harness baseline and one Liangshen owner remains; either path requires complete installation, lock, ownership, PTY, resume, exit, cleanup, and public-command revalidation.

---

## 12. Execution Handoff

Tasks 12 through 21 are complete. The final Fusion Web external set remains empty, TUI `0.7.1` source runtime remains PASS, TUI `0.8.7` and `0.8.8` runtime remains `NOT RUN`, and public TUI delivery remains phase 2 BLOCKED. The exact 64-file product delivery is staged; planning and execution records remain outside the staged product set. The final progress record is `Round 5 Final 64-File Alignment (2026-08-22)`.

---

## Appendix A: Repository References

- Bundle mechanism: [`packages/bundle/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/README.md)
- Patch template: [`packages/bundle/base/`](file:///Users/bytedance/opencode/agent/dsh/packages/bundle/base)
- Profile boot: [`packages/boot/app-boot/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/boot/app-boot/README.md)
- Presets: [`packages/preset/README.md`](file:///Users/bytedance/opencode/agent/dsh/packages/preset/README.md)
- Composition command: [`apps/cli/src/plugin.ts`](file:///Users/bytedance/opencode/agent/dsh/apps/cli/src/plugin.ts)
- Root build policy: [`pnpm-workspace.yaml`](file:///Users/bytedance/opencode/agent/dsh/pnpm-workspace.yaml)

# Fusion Phase 1 Regression Report

English | [中文](fusion-regression-report.zh.md)

Date: 2026-08-21

Status: `DONE_WITH_CONCERNS`

Scope: historical Task 5 evidence plus the 2026-08-21 Task 12 convergence supplement. The historical matrix remains unchanged.

Current result: the final Web external set is empty. ModLens, SSH, Remote Web UI, Task Board, Pet, Git Graph, Skin Center, and Better Sidebar are evidence-backed blockers. The final zero-row REAL gate passes 1/1, the complete oracle passes 196/196, all three negative controls block as intended, compact records seven items/401 tokens and 448 to 155 projected message tokens, restart retains 155, and the independent review records `EVIDENCE PASS / RUNTIME PASS`. The historical three-row 1/1 and 174/174, four-row 1/1 and 170/170, and six-row 156/156 results remain superseded evidence. TUI source runtime passes, public delivery remains phase 2 BLOCKED, and Liangshen remains sourced from `0.2.4`.

## Result

The matrix contains 24 PASS and 4 BLOCKED rows. No product code was changed. The live fusion checks used system Google Chrome 151 through CDP `http://127.0.0.1:9333`.

| Area | Status | Evidence |
| --- | --- | --- |
| Conversation rendering | PASS | Live seeded fusion session rendered both turns and `FIRST_DONE`; `browser/fusion-regression-final-pass.json`. |
| Tool cards | PASS | Live DOM reported one bash card and two read cards; `browser/fusion-regression-final-pass.json`, `browser/conversation-tool-cards.png`. |
| New Session | PASS | Live control accessible name `新建会话`; blank composer returned with no extra materialized row; `browser/fusion-regression-final.json`. |
| Session list | PASS | Live tree `未分组` contained selected row `NavScenario: first run bash to`; `browser/fusion-regression-final-pass.json`. |
| Fork | PASS | Keyless assembled Web replay passed `message-actions.e2e.ts`; live focused continuation is covered by the composite-CDP BLOCKED row below. |
| Resume | PASS | The live cold seeded session rendered persisted history without a model request; `browser/session-history-final.response.json`. |
| Compact | PASS | Keyless assembled Web replay passed the compact history and command paths; live focused continuation is covered by the composite-CDP BLOCKED row. |
| Export | PASS | Keyless assembled Web replay passed header and `/export` ZIP paths; live focused continuation is covered by the composite-CDP BLOCKED row. |
| Search | PASS | Keyless assembled Web replay passed `navigation-panes.e2e.ts`; live focused continuation is covered by the composite-CDP BLOCKED row. |
| Settings | PASS | Live General, Models, Plugins, Escape, and close-button flow passed; plugin inventory contained 165 rows; `browser/fusion-regression-final-pass.json`. |
| Model selection | PASS | Live picker switched DeepSeek-V4-Pro to DeepSeek-V4-Flash and updated the accessible current-model name; `browser/fusion-regression-final-pass.json`. |
| Editor | BLOCKED | Live fusion DOM and accessibility trees contain no Web Editor. Plugin inventory contains only disabled `@deepseek-ai/dsh-tool-str-replace-editor`, which is not a Web Editor. Stock Web source/tests expose file-open and native settings-document actions, not an Editor. Files/editor/terminal/Git belong to better-sidebar in Task 7. Reviewer must resolve the phase 1 specification contradiction. |
| `describe_image` absent | PASS | Runtime Loader inventory has no `@linxin666/dsh-tool-describe-image`; Liangshen focused test's exact standard/phase tool lists contain no `describe_image`. Third-party identity is row `describe-image`, tool `describe_image`; `third-party/describe-image/`. |
| AionUI panel absent | PASS | Runtime Loader inventory has no `@linxin666/dsh-client-ui-aionui-panel`. Its real row is `ui-dsh-aionui-panel`; its slots are `conversation.input.dock` ids `aionui-drag-file`/`aionui-mermaid-chat` and `web-ui.plugin.item` id `aionui-panel`; `third-party/aionui-panel/`. |
| `web-ui-all` absent | PASS | Structured composed dump and live Loader inventory contain no aggregate row; `dump-config.analysis.json`, `browser/fusion-regression-final-pass.json`. |
| Remote implementation unique | PASS | Exactly one live row `include:remote-web-ui`, one accessible `移动端远程控制` button, one client resource, and `/m/` HTTP 200; `browser/fusion-regression-final-pass.json`, `browser/mobile-route.headers.txt`. Pair-token issue is not exercised on loopback because the plugin requires `--host 0.0.0.0` or `publicBaseUrl`. |
| Liangshen unique | PASS | Loader rows contain no Liangshen plugin; `agentPreset.list` contains exactly one id `liangshen`, and the live picker selected `梁神模式`; `browser/fusion-regression-final.json`. |
| Slot/service conflicts | PASS | Boot remained healthy; live `[data-slot-error]` was empty; startup logs contain no duplicate/conflict/service-registration match. |
| Composite live CDP exit 0 | BLOCKED | Focused live steps and diagnostics are saved, but no single composite run reached exit 0. The final failed run had clean console/network/page diagnostics and passed conversation, tools, Settings, model selection, New Session, inventory, Liangshen, Editor absence, and remote uniqueness; Search helper timing then prevented the dependent live fork/export/compact sequence. These product paths passed in keyless assembled Web replay. |
| Stock Web isolation | PASS | Fresh-home default dump has 129 rows and no fusion identities; real stock server reached HTTP 200. The final inventory helper remained blocked by a helper RPC-envelope mismatch, so the structured Loader dump plus real boot are the isolation evidence. |
| Headless isolation | PASS | Fresh-home dump has 81 rows and no Host/browser/fusion rows; built-bin focused test passed 1/1. |
| Headless behavior | BLOCKED | The requested real command exited 1 with `MISSING_CREDENTIAL`; this is not counted as behavior success. |
| ACP isolation | PASS | Real stdio keyless focused test passed framed JSON-RPC and `session/new` 2/2 in an independent home. |
| Fusion owning test | PASS | 1/1. |
| Liangshen focused test | PASS | 1/1 with `vitest.e2e.config.ts`. The research command without the e2e config found no tests; both outputs are retained. |
| `pnpm run test:gui` | PASS | 272 files, 3757 passed, 1 skipped. |
| `DSH_SNAPSHOT=replay pnpm run test:web` | BLOCKED | 74 files and 252 tests passed; one `workspace-management` hover-action click timed out. Relevant Task 5 files, including navigation and message actions, passed. Focused prerequisite + rename rerun passed 2/2; related source/test paths have no current diff. |
| ACP focused test | PASS | 2 passed, 1 unrelated skipped. |

## Runtime Inventory

The composed fusion dump has 135 entries. The six active fusion rows are:

| Row id | Module |
| --- | --- |
| `modlens` | `@liustack/modlens@3.22.0` |
| `ui-task-board` | `@linxin666/dsh-client-ui-task-board@0.2.4` |
| `ssh` | `@linxin666/dsh-ssh@0.2.4` |
| `remote-web-ui` | `@linxin666/dsh-remote-web-ui@0.2.4` |
| `pet` | `@linxin666/dsh-pet@0.2.4` |
| `ui-skin-center` | `@linxin666/dsh-client-ui-skin-center@0.2.4` |

The live Plugins inventory accessible names are `modlens, 已挂载, 已启用`, `ui-task-board, 已挂载, 已启用`, `ssh, 已挂载, 已启用`, `remote-web-ui, 已挂载, 已启用`, `pet, 已挂载, 已启用`, and `ui-skin-center, 已挂载, 已启用`.

## Commands

```text
pnpm exec vitest run packages/bundle/fusion/tests/fusion.spec.ts
pnpm exec vitest run --config vitest.e2e.config.ts apps/cli/tests/web-agent-presets.e2e.ts -t 'anchors `liangshen`, promotes it to Code Mode, and re-anchors after compaction'
pnpm run test:gui
DSH_SNAPSHOT=replay pnpm run test:web
DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/workspace-management.e2e.ts -t 'adds two workspaces|renames a workspace'
pnpm exec vitest run --config vitest.e2e.config.ts examples/acp-agent/tests/acp.e2e.ts -t 'emits only framed JSON-RPC|session/new succeeds over real stdio'
pnpm exec vitest run --config vitest.e2e.config.ts apps/cli/tests/built-bin.e2e.ts -t 'prints the headless profile without Host or browser layers'
```

## Diagnostics And Cleanup

The accepted live fusion step evidence has empty console warnings, console errors, page errors, failed requests, non-2xx responses, and slot errors. A deliberately attempted loopback pair issue produced HTTP 409 in an earlier rejected run; the final acceptance does not treat that interaction as passing because the plugin requires a reachable bind or public base.

Servers on ports `43350` and `43351` were stopped and have no listeners. Task-created localhost targets were closed. The pre-existing Chrome process on CDP 9333 remains running; user-owned pages were not closed. No cookies, storage, or tokens were read. No Git staging, commit, push, merge, rebase, or reset was performed.

## Self-review

- Correctness: runtime identities come from structured dump, live Loader inventory, accessibility trees, and exact third-party packages, not grep-only absence claims.
- Scope: no Task 6-9 implementation and no product code changes.
- Simplicity: evidence helpers are untracked Task 5 artifacts; no reusable product abstraction was added.
- Security: browser actions stayed on known localhost URLs and did not inspect browser credentials.
- Reviewer decisions: phase 1 Editor remains contradictory; phase 1 must not be declared fully green while the four BLOCKED rows remain.

## Final Task 5 Supplement

This append-only supplement records the final evidence and reviewer decision. The original `DONE_WITH_CONCERNS` status and 24 PASS / 4 BLOCKED matrix above remain the historical result before the focused fixes; they are not rewritten. The corrected [design §8.1](../specs/2026-08-19-dsh-five-repo-fusion-design.md#81-existing-web-behavior) and [Task 5 plan](2026-08-19-dsh-five-repo-fusion.md#task-5-regress-existing-web-behavior-and-deduplication) assign Files/Web Editor/Terminal/Git to Task 7 rather than Task 5.

- **Search:** [exit `0`](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/search.exit.txt) and the [result with empty diagnostics](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/search.json) show the seeded result opened, the query cleared, and the normal session tree restored; [target evidence](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/search-targets.json) records closure.
- **Fork:** [exit `0`](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/fork.exit.txt) and the [fork result](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/fork.json) record HTTP 200 from `/api/session.fork`, one additional row, and selection of the new session; [target evidence](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/fork-targets.json) records closure.
- **Compact:** the [accessibility capture](../../../.superpowers/sdd/v2-task-5-fix-evidence/live-compact-original/compact-accessibility.json) contains `已压缩 7 条历史记录（约 423 tokens）`, while the [successful event chain](../../../.superpowers/sdd/v2-task-5-fix-evidence/live-compact-original/compact-command-success.jsonl) and [persisted session events 262-267](../../../.superpowers/sdd/v2-task-5-fix-evidence/live-compact-original/session.after-compact.jsonl) contain `compaction/summary`, `compaction/end`, and `command/done` with `kind: success`. The assembled cold-resume coverage is retained in the [Web test output](../../../.superpowers/sdd/v2-task-5-evidence/tests/test-web.stdout.log). The final review explicitly treats earlier helper-level `accepted: false` records as stale indexes rather than contrary runtime evidence.
- **Header export:** the [export run exit `0`](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/export.exit.txt) and [header result](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/export.json) record HTTP 200 and a non-empty 7,273-byte ZIP.
- **`/export`:** the same [focused result](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/export.json) separately records HTTP 200 and a non-empty 7,372-byte ZIP for the slash command; [target evidence](../../../.superpowers/sdd/v2-task-5-fix-evidence/live/export-targets.json) records closure.
- **Keyless headless:** the focused product-path [exit code](../../../.superpowers/sdd/v2-task-5-fix-evidence/headless/exit-code.txt) is `0`; the [test output](../../../.superpowers/sdd/v2-task-5-fix-evidence/headless/stdout.txt) records 1 passed test, and the [expected assistant output](../../../.superpowers/sdd/v2-task-5-fix-evidence/headless/expected-assistant-output.txt) is `CLI tool round trip complete: CLI_TOOL_ROUND_TRIP`.
- **Runtime tool catalog:** the focused command [exited `0`](../../../.superpowers/sdd/v2-task-5-fix-evidence/tool-catalog/exit.txt), and the assembled fusion [runtime registry capture](../../../.superpowers/sdd/v2-task-5-fix-evidence/tool-catalog/catalog.json) reports `describe_image: 0` and `modlens_read_image: 1` from `context.tools.schemas()` for `@liustack/modlens@3.22.0`.

The final independent [review](../../../.superpowers/sdd/v2-task-5-rereview.md) is `APPROVED` for both specification compliance and evidence quality. Task 5 therefore concludes `APPROVED`: the four earlier blockers are resolved, the unrelated full-Web hover timeout remains non-blocking, and no Task 5 acceptance gap remains.

## 2026-08-21 Task 12 Convergence

The Task 11 PASS and the later six-row runtime PASS are superseded as current final results by the Task 12 security findings; they remain valid historical evidence for the versions and checks they covered.

- **Historical six-row composition:** [the assembled runtime report](../../../.superpowers/sdd/v3-task-12-final-web-runtime.md) and [independent rereview](../../../.superpowers/sdd/v3-task-12-runtime-evidence-rereview.md) record 156/156 runtime assertions for the six exact rows, existing Web paths, deduplication, exact locks and build approvals, clean diagnostics, actual compact of seven items and 402 tokens, and restart resume of the same durable session. Those checks did not cover the later Pet or Git Graph authorization findings and cannot close final acceptance.
- **Historical four-row composition:** the selected set was ModLens `3.22.1`, Task Board `0.1.11`, SSH `0.2.5`, and Remote Web UI `0.1.11`. [The checked-in REAL composition report](../../../.superpowers/sdd/v3-task-12-four-row-real-gate-implementation.md) records 1/1 PASS through system Chrome CDP `9333`. [The complete four-row oracle](../../../.superpowers/sdd/v3-task-12-final-four-row-web-runtime.md) records 170/170 assertions, compact of seven items and 401 tokens, projected tokens from 448 to 160, and restart of the same durable session. The Task Board lifecycle finding supersedes this evidence; it is not the current or final Web result.
- **Historical three-row composition:** the selected set was ModLens `3.22.1`, SSH `0.2.5`, and Remote Web UI `0.1.11`. [The checked-in REAL composition gate](../../../.superpowers/sdd/v3-task-12-task-board-removal.md) passed 1/1 through system Chrome CDP `9333`, with fixture-local dependencies, lock data, and build approvals and exclusion from default unit, coverage, Web, and CI collections. [The complete three-row oracle](../../../.superpowers/sdd/v3-task-12-final-three-row-web-runtime.md) passed 174/174 assertions with clean diagnostics and blocker absence; compact shadowed seven items and 402 tokens, projected message tokens fell from 449 to 155, and the same session retained 155 after restart. Its [independent rereview](../../../.superpowers/sdd/v3-task-12-final-three-row-web-runtime-review.md) was `EVIDENCE PASS / RUNTIME PASS`. The ModLens, SSH, and Remote Web UI lifecycle reviews supersede this admission evidence.
- **Pet:** [the final security review](../../../.superpowers/sdd/v3-task-12-final-security-review.md) and [independent validation](../../../.superpowers/sdd/v3-task-12-pet-security-validation.md) show that exact `/api/pet/*` routes permit unpaired remote state reads and persistent mutations. Pet remains excluded.
- **Git Graph:** [the final security review](../../../.superpowers/sdd/v3-task-12-final-security-review.md) and [independent validation](../../../.superpowers/sdd/v3-task-12-gitgraph-security-validation.md) show that `/git/*` remains reachable after Remote Web UI device revocation. Git Graph remains excluded.
- **Skin Center:** [license investigation](../../../.superpowers/sdd/v3-task-12-license-investigation.md) blocks published `0.1.12` through `0.2.5`; [the `0.1.11` runtime report](../../../.superpowers/sdd/v3-task-12-skin-0111-runtime.md) records successful install, composition, boot, and client load but an rc.5-invisible Settings card.
- **Better Sidebar:** [the security investigation](../../../.superpowers/sdd/v3-task-12-sidebar-security-investigation.md) records that optional `terminal_*` model tools bypass session sandboxing, approval, and environment scrubbing. No acceptable deployment switch preserves the complete workbench, so the row remains unmounted.
- **TUI and Liangshen:** [the TUI report](../../../.superpowers/sdd/v3-task-13-tui-runtime.md) and [independent rereview](../../../.superpowers/sdd/v3-task-12-runtime-evidence-rereview.md) record fresh/resume PTY runtime PASS for exact `0.7.1` under a 41-package pure rc.5 source closure. The npm registry lacks 23 required rc.5 packages, so no supported public command can reproduce that closure and TUI public delivery remains phase 2 BLOCKED. [The Liangshen audit](../../../.superpowers/sdd/v3-task-12-liangshen-license.md) retains exact source `0.2.4` and the repository security adaptation.

The historical three-row checked-in REAL composition gate used system Chrome CDP `9333`, contained no browser launch fallback, and left default unit, coverage, Web, and CI collections offline. Its fixture/profile dependencies, lock data, and `allowBuilds` did not modify the root dependencies, root lockfile, or root `allowBuilds`.

Task 12.1 through Task 12.17 have task-level evidence or authoritative audits. The top-level Task 12 cross-domain review and Task 13 acceptance are complete. The final zero-row REAL gate passes 1/1, and the complete oracle passes 196/196 with independent `EVIDENCE PASS / RUNTIME PASS`.

## 2026-08-21 Zero-Row Convergence

- **ModLens:** [the lifecycle review](../../../.superpowers/sdd/task13-final/modlens-lifecycle-review.md) blocks every published DSH candidate because target routes are absent or their disposers are discarded.
- **SSH:** [the lifecycle review](../../../.superpowers/sdd/task13-final/ssh-lifecycle-review.md) blocks 26/26 releases because accepted terminal and SSH sessions remain active after plugin disposal.
- **Remote Web UI:** [the lifecycle review](../../../.superpowers/sdd/task13-final/remote-web-ui-lifecycle-review.md) blocks 26/26 releases. Version `0.1.11` passes route unload/remount but fails open SSE, tunnel quiescence, client subscription, and failed-pair root cleanup; versions `0.1.12+` also conflict on manifest/LICENSE identity.
- **Product convergence:** Task 12.17 makes the Fusion patch, profile dependency map, REAL fixture, and external build approvals empty and records all eight blockers. The minimum package RED/GREEN cycle and focused zero-row acceptance are recorded in `.superpowers/sdd/task13-final/zero-row-convergence-report.md`.
- **Current gate:** the final zero-row REAL gate passes 1/1 through system Chrome CDP `9333`; the complete oracle passes 196/196, all three negative controls block at 195/196 with exit 1, compact records seven items/401 tokens and 448 to 155 projected message tokens, and restart retains 155.
- **Independent review:** the zero-row evidence and runtime review records `EVIDENCE PASS / RUNTIME PASS` with no blocking finding.

# Fusion Phase 1 Regression Report

English | [中文](fusion-regression-report.zh.md)

Date: 2026-08-23

Status: `DONE`

Scope: the historical Task 5 matrix, the historical Task 12 and zero-row supplements, and the current Task 22 two-row result.

Current result: the Fusion Web external set contains exact Pet and Git Graph `0.2.9`. Their license identity, security negative controls, lifecycle, ownership, deduplication, isolated profiles, and combined Chrome CDP `9333` runtime pass. The [compatibility matrix](fusion-compat-matrix.md) owns the per-version results, and the [Fusion ownership decision](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) owns admission and revalidation. The other Web UI identities stop at their first failed or not-selected mandatory check. Historical zero-row, three-row, four-row, and six-row results remain superseded evidence. TUI source runtime passes, public delivery remains phase 2 BLOCKED, and Liangshen remains sourced from `0.2.4`.

## Historical Task 5 Result

The Task 5 matrix contained 24 PASS and 4 BLOCKED rows. That evidence run changed no product code and used system Google Chrome 151 through CDP `http://127.0.0.1:9333`.

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

## Historical Task 5 Six-Row Runtime Inventory

The Task 5 composed Fusion dump had 135 entries. Its six active Fusion rows were:

| Row id | Module |
| --- | --- |
| `modlens` | `@liustack/modlens@3.22.0` |
| `ui-task-board` | `@linxin666/dsh-client-ui-task-board@0.2.4` |
| `ssh` | `@linxin666/dsh-ssh@0.2.4` |
| `remote-web-ui` | `@linxin666/dsh-remote-web-ui@0.2.4` |
| `pet` | `@linxin666/dsh-pet@0.2.4` |
| `ui-skin-center` | `@linxin666/dsh-client-ui-skin-center@0.2.4` |

The Task 5 live Plugins inventory exposed `modlens, 已挂载, 已启用`, `ui-task-board, 已挂载, 已启用`, `ssh, 已挂载, 已启用`, `remote-web-ui, 已挂载, 已启用`, `pet, 已挂载, 已启用`, and `ui-skin-center, 已挂载, 已启用`.

## Historical Task 5 Commands

```text
pnpm exec vitest run packages/bundle/fusion/tests/fusion.spec.ts
pnpm exec vitest run --config vitest.e2e.config.ts apps/cli/tests/web-agent-presets.e2e.ts -t 'anchors `liangshen`, promotes it to Code Mode, and re-anchors after compaction'
pnpm run test:gui
DSH_SNAPSHOT=replay pnpm run test:web
DSH_SNAPSHOT=replay pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/workspace-management.e2e.ts -t 'adds two workspaces|renames a workspace'
pnpm exec vitest run --config vitest.e2e.config.ts examples/acp-agent/tests/acp.e2e.ts -t 'emits only framed JSON-RPC|session/new succeeds over real stdio'
pnpm exec vitest run --config vitest.e2e.config.ts apps/cli/tests/built-bin.e2e.ts -t 'prints the headless profile without Host or browser layers'
```

## Historical Task 5 Diagnostics And Cleanup

The accepted live fusion step evidence has empty console warnings, console errors, page errors, failed requests, non-2xx responses, and slot errors. A deliberately attempted loopback pair issue produced HTTP 409 in an earlier rejected run; the final acceptance does not treat that interaction as passing because the plugin requires a reachable bind or public base.

Servers on ports `43350` and `43351` were stopped and have no listeners. Task-created localhost targets were closed. The pre-existing Chrome process on CDP 9333 remains running; user-owned pages were not closed. No cookies, storage, or tokens were read. No Git staging, commit, push, merge, rebase, or reset was performed.

## Historical Task 5 Self-review

- Correctness: runtime identities come from structured dump, live Loader inventory, accessibility trees, and exact third-party packages, not grep-only absence claims.
- Scope: no Task 6-9 implementation and no product code changes.
- Simplicity: evidence helpers are untracked Task 5 artifacts; no reusable product abstraction was added.
- Security: browser actions stayed on known localhost URLs and did not inspect browser credentials.
- Reviewer decisions: phase 1 Editor remains contradictory; phase 1 must not be declared fully green while the four BLOCKED rows remain.

## Historical Task 5 Final Supplement

This append-only supplement records the final evidence and reviewer decision. The original `DONE_WITH_CONCERNS` status and 24 PASS / 4 BLOCKED matrix above remain the historical result before the focused fixes; they are not rewritten. The corrected [design §8.1](../specs/2026-08-19-dsh-five-repo-fusion-design.md#81-existing-web-behavior) and [Task 5 plan](2026-08-19-dsh-five-repo-fusion.md#task-5-regress-existing-web-behavior-and-deduplication) assign Files/Web Editor/Terminal/Git to Task 7 rather than Task 5.

- **Search:** the seeded result opened, the query cleared, the normal session tree returned, and the browser target closed.
- **Fork:** `/api/session.fork` returned HTTP 200, added one row, selected the new session, and closed the browser target.
- **Compact:** the UI reported `已压缩 7 条历史记录（约 423 tokens）`; the persisted event chain contained `compaction/summary`, `compaction/end`, and successful `command/done`. Assembled cold resume passed. The final review treated earlier helper-level `accepted: false` records as stale indexes rather than contrary runtime evidence.
- **Header export:** the header action returned HTTP 200 with a non-empty 7,273-byte ZIP.
- **`/export`:** the slash command separately returned HTTP 200 with a non-empty 7,372-byte ZIP and closed its browser target.
- **Keyless headless:** the focused product path exited `0`, passed one test, and produced `CLI tool round trip complete: CLI_TOOL_ROUND_TRIP`.
- **Runtime tool catalog:** the assembled Fusion catalog reported `describe_image: 0` and `modlens_read_image: 1` from `context.tools.schemas()` for `@liustack/modlens@3.22.0`.

The final independent review is `APPROVED` for both specification compliance and evidence quality. Task 5 therefore concludes `APPROVED`: the four earlier blockers are resolved, the unrelated full-Web hover timeout remains non-blocking, and no Task 5 acceptance gap remains.

## 2026-08-21 Task 12 Convergence

The Task 11 PASS and the later six-row runtime PASS are superseded as current final results by the Task 12 security findings; they remain valid historical evidence for the versions and checks they covered.

- **Historical six-row composition:** 156/156 runtime assertions covered the six exact rows, existing Web paths, deduplication, exact locks and build approvals, clean diagnostics, compaction of seven items and 402 tokens, and restart resume of the same durable session. Those checks did not cover the later Pet or Git Graph authorization findings and cannot close final acceptance.
- **Historical four-row composition:** the selected set was ModLens `3.22.1`, Task Board `0.1.11`, SSH `0.2.5`, and Remote Web UI `0.1.11`. Its REAL gate passed 1/1 through system Chrome CDP `9333`; the complete oracle passed 170/170, compacted seven items and 401 tokens, reduced projected tokens from 448 to 160, and resumed the same durable session. The Task Board lifecycle finding supersedes this evidence.
- **Historical three-row composition:** the selected set was ModLens `3.22.1`, SSH `0.2.5`, and Remote Web UI `0.1.11`. Its REAL gate passed 1/1 through system Chrome CDP `9333` with fixture-local dependencies, lock data, and build approvals; the complete oracle passed 174/174, compacted seven items and 402 tokens, reduced projected message tokens from 449 to 155, and retained 155 after restart. Its independent rereview was `EVIDENCE PASS / RUNTIME PASS`. The ModLens, SSH, and Remote Web UI lifecycle reviews supersede this admission evidence.
- **Pet:** historical `0.1.11` `/api/pet/*` routes permit unpaired remote state reads and persistent mutations. That exact version remains excluded.
- **Git Graph:** historical `0.1.11` `/git/*` remains reachable after Remote Web UI device revocation. That exact version remains excluded.
- **Skin Center:** published `0.1.12` through `0.2.5` fail license identity; `0.1.11` installs, composes, boots, and loads its client, but its Settings card is invisible on rc.5.
- **Better Sidebar:** optional `terminal_*` model tools bypass session sandboxing, approval, and environment scrubbing. No acceptable deployment switch preserves the complete workbench, so the row remains unmounted.
- **TUI and Liangshen:** exact `0.7.1` passes fresh/resume PTY runtime under a 41-package pure rc.5 source closure. The npm registry lacks 23 required rc.5 packages, so no supported public command can reproduce that closure and TUI public delivery remains phase 2 BLOCKED. Liangshen retains exact source `0.2.4` and the repository security adaptation.

The historical three-row checked-in REAL composition gate used system Chrome CDP `9333`, contained no browser launch fallback, and left default unit, coverage, Web, and CI collections offline. Its fixture/profile dependencies, lock data, and `allowBuilds` did not modify the root dependencies, root lockfile, or root `allowBuilds`.

Task 12.1 through Task 12.17 have task-level evidence or authoritative audits. The top-level Task 12 cross-domain review and Task 13 acceptance are complete. At that superseded stage, the zero-row REAL gate passed 1/1 and the complete oracle passed 196/196 with independent `EVIDENCE PASS / RUNTIME PASS`.

## 2026-08-21 Zero-Row Convergence

This section records the superseded zero-row stage.

- **ModLens:** every audited DSH candidate was blocked because target routes were absent or their disposers were discarded.
- **SSH:** all 26 releases audited at that stage left accepted terminal and SSH sessions active after plugin disposal.
- **Remote Web UI:** all 26 releases audited at that stage were blocked. Version `0.1.11` passed route unload/remount but failed open SSE, tunnel quiescence, client subscription, and failed-pair root cleanup; versions `0.1.12+` also conflicted on manifest/LICENSE identity.
- **Product convergence:** Task 12.17 made the Fusion patch, profile dependency map, REAL fixture, and external build approvals empty and recorded all eight blockers.
- **Historical gate:** the zero-row REAL gate passed 1/1 through system Chrome CDP `9333`; the complete oracle passed 196/196, all three negative controls blocked at 195/196 with exit 1, compact recorded seven items/401 tokens and 448 to 155 projected message tokens, and restart retained 155.
- **Independent review:** the zero-row evidence and runtime review records `EVIDENCE PASS / RUNTIME PASS` with no blocking finding.

## 2026-08-22 Task 22 Two-Row Convergence

Task 22 and its independent rereview are complete. Fusion admits exact Pet and Git Graph `0.2.9`; the [compatibility matrix](fusion-compat-matrix.md) owns freshness, release totals, ordered stop points, lifecycle and security results, and the blocked capability set. The [Fusion ownership decision](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) owns the admission rationale and revalidation conditions.

The tracked [Fusion patch](../../../packages/bundle/fusion/cordis.patch.yml) contains exactly `pet` and `ui-git-graph`, and its [profile dependencies](../../../packages/bundle/fusion/package.json) pin both packages to `0.2.9`. The [REAL acceptance](../../../apps/web/tests/fusion-real-composition.acceptance.ts) compares the complete ordered model input and blocked-route responses with an independently booted `base + web-app` profile, checks live Pet-state and Git-branches data, and verifies visible controls, clean diagnostics, and cleanup.

## 2026-08-23 Task 29 Two-Row Web Regression

The one-shot Task 29 driver completed with exit `0`, empty stderr, and 36/36 PASS assertions against system Google Chrome 151 through CDP `http://127.0.0.1:9333`. It used exact profile-local Pet and Git Graph `0.2.9`, repository commit `108b96a10a34941d93ad99b35c3a1f2cee16a9e2`, driver SHA-256 `6afc44191217200cfbe0630b4e5e445d9109f284c71b9343ef34d082691bf2d0`, oracle SHA-256 `4b2e8684f7506f92924bec641a289da300e2fa70dec869e5d3df7e8d4069e112`, oracle-test SHA-256 `cfcfd643678c00d22bd977e1c2ae8ae5525cd211603c51d76b208ffdb462d37e`, and fixture-lock SHA-256 `5459fff341481642aacb7f9fb31c9caf114cc4ae737927550bb05d04a96f68c9`.

- **Existing Web workflows:** conversation rendering, the read tool card, blank-session reuse, active-session creation, session list and rename projection, Search, fork, cold resume, `/compact`, header export, `/export`, and model selection all passed in one fresh assembled run.
- **Fork and compact identity:** the selected row carried the unique title derived from the returned child id. The compact `command/run`, successful `command/done`, and start/summary/end events shared one command id and compaction id; `done.sourceEventSeq` equaled `summary.seq`, and `end.error` was absent.
- **Settings:** General, Models, and Plugins navigation passed, as did Escape and Close dismissal. The 161-row DOM inventory exactly matched the live `pluginInventory/list` RPC snapshot; its complete external set was exactly `@linxin666/dsh-pet@0.2.9` and `@linxin666/dsh-client-ui-git-graph@0.2.9`, both enabled and active.
- **Export semantics:** both ZIPs contained the root `session.jsonl` and expected fork descendant log. Header and slash ledgers each bound the trigger, unique HEAD Request identity, HTTP 200 response, Download URL/completion, and ZIP SHA-256; the abort request-id set and global download URL multiset exactly matched those two operations.
- **Composition and isolation:** Pet remained unique, Git Graph exposed live `task29` branch data on blank sessions and hid after conversation start, and fresh stock Web, headless, headless behavior, and ACP checks contained no Fusion leakage.
- **Diagnostics and cleanup:** console warnings/errors, page errors, HTTP failures, slot errors, and unexpected network failures were empty. Both Fusion service PGIDs have persisted startup trees and empty final snapshots; both ports, the model-provider port, Task-created CDP targets, the profile link, and the temporary directory were removed. A controlled child proved leader-only cleanup can miss a descendant while the PGID oracle detects it; all 10 oracle controls passed.
- **Append-only scope:** the cumulative index-to-worktree diff includes Task 22 historical prose cleanup that predates Task 29. Task 29 facts occur only in this final section; the header remains at Task 22 current state, and links to untracked `.superpowers/**` evidence remain removed so the tracked report has no clean-checkout dead links.

The exact long-running command was started in the background and polled in intervals shorter than one minute:

```text
sh .superpowers/sdd/round5-task29/run-driver.sh
```

The complete RED/GREEN analysis, command ledger, provenance, diagnostics, screenshots, accessibility snapshots, RPC and DOM inventories, and cleanup records are under `.superpowers/sdd/round5-task29/`; the consolidated report is `.superpowers/sdd/round5-task29-report.md`.

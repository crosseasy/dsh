# Fusion Phase 1 Regression Report

Date: 2026-08-20

Status: `DONE_WITH_CONCERNS`

Scope: Task 5 only. Task 6-9 were not implemented or modified.

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

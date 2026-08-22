# Fusion compatibility matrix

English | [中文](fusion-compat-matrix.zh.md)

Status: **DONE_WITH_CONCERNS**

Checked through: `2026-08-21T23:30:28.583Z`

Baseline: `@deepseek-ai/dsh@0.1.0-rc.5`, macOS arm64, Node.js `v24.14.0`. The repository launcher used pnpm `11.7.0`; isolated profiles used pnpm `11.18.0`. Round 1 artifacts remain under `/private/tmp/dsh-fusion-task0.X4pqGN`; Round 2 runtime artifacts are under `/private/tmp/fusion-round2-webui-modlens.RAdgfl` and `/private/tmp/fusion-round2-*`; Round 3 publication reports are under `/tmp/fusion-round3-*`; Round 4 publication evidence is under `/tmp/fuse-five-*-round4*`; Round 7 reports and TUI publication artifacts are under `/tmp/fusion-round7-*`; Round 8 reports are under `/tmp/dsh-fusion-round8-*-report.md`, with TUI artifacts under `/tmp/dsh-fusion-round8-tui.fKKD9z/`; Round 9 reports are under `/tmp/fuse-five-repositories-round9-*.md`, with fresh TUI registry evidence under `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/`; Round 10 reports are under `/tmp/fuse-five-repositories-round10-*.md`, with fresh registry evidence in the directories listed in the evidence index; Round 11 reports are `/tmp/fuse-five-repositories-round11-sidebar.md` and `/tmp/fuse-five-repositories-round11-tui.md`, with evidence under `/tmp/fuse-five-repositories-round11-sidebar-evidence-ZHGfQ2/` and `/tmp/fuse-five-repositories-round11-tui-evidence-9906d414-9693-4265-b991-cf6f57874c3c/`; Round 12 updated reports are `/tmp/fuse-five-repositories-round12-sidebar.md` and `/tmp/fuse-five-repositories-round12-tui.md`, with repaired evidence under `/tmp/fuse-five-repositories-round12-sidebar-evidence-fix-a9127c2b-77c2-40ca-b11d-359805d5f5cc/` and `/tmp/fuse-five-repositories-round12-tui-evidence-fix-348d5f9c-7068-42a6-a3b3-d9be6c2156e1/`, repair report `/tmp/fuse-five-repositories-round12-evidence-fix.md`, and rereview report `/tmp/fuse-five-repositories-round12-evidence-rereview.md`; Round 13 reports are `/tmp/fusion-round13-sidebar-report.md` and `/tmp/fusion-round13-tui-report.md`, with evidence under `/tmp/fusion-round13-sidebar-evidence.D72yMW/` and `/tmp/fusion-round13-tui-evidence-806ac590-6679-43c5-8f2c-0a9d87757ac2/`, and independent review `/tmp/fusion-round13-evidence-review.md`; Round 14 reports are `/tmp/fusion-round14-sidebar-report.md` and `/tmp/fusion-round14-tui-report.md`, with evidence under `/tmp/fusion-round14-sidebar-evidence-zEJSrCsn/` and `/tmp/fusion-round14-tui-evidence-b3c4f38f-ad80-4270-8433-5ce6eeea4dd1/`, and independent review `/tmp/fusion-round14-evidence-review.md`; Round 15 reports are `/tmp/fusion-round15-sidebar-report.md` and the repaired `/tmp/fusion-round15-tui-report.md`, with evidence under `/tmp/fusion-round15-sidebar-evidence-PArhqmkh/` and `/tmp/fusion-round15-tui-evidence-fix-ba261be2-8086-4a09-8aad-18cd225f54b5/`, repair report `/tmp/fusion-round15-tui-evidence-fix-report.md`, and final rereview `/tmp/fusion-round15-evidence-rereview.md`; Round 16 reports and independent reviews are `/tmp/dsh-fusion-round16-sidebar-report.md`, `/tmp/dsh-fusion-round16-sidebar-review.md`, `/tmp/dsh-fusion-round16-tui-report.md`, and `/tmp/dsh-fusion-round16-tui-review.md`, with evidence under `/tmp/dsh-fusion-round16-sidebar-evidence.MahuvZQC/` and `/tmp/dsh-fusion-round16-tui-evidence-4ea95909-ce88-4813-9207-5e3c8fe10abc/`; Round 17 reports are `/tmp/fusion-round17-sidebar-report.md`, `/tmp/fusion-round17-tui-report.md`, and `/tmp/fusion-round17-evidence-review.md`, with evidence under `/tmp/fusion-round17-sidebar-evidence-mcPmfe6K/` and `/tmp/fusion-round17-tui-evidence-5b0933e5-76f4-4ba5-b3a2-3f66a9e68b25/`; Round 18 reports are `/tmp/dsh-fusion-round18-sidebar/report.md` and `/tmp/dsh-fusion-round18-tui/report.md`, with evidence under `/tmp/dsh-fusion-round18-sidebar/` and `/tmp/dsh-fusion-round18-tui/`, and independent review `/tmp/dsh-fusion-round18-evidence-review.md`; Round 19 reports are `/private/tmp/dsh-fusion-round19-sidebar-bZennRT5/report.md` and `/private/tmp/dsh-fusion-round19-tui-KlLljWNS/report.md`, with independent review `/private/tmp/dsh-fusion-round19-evidence-review.md`, sidebar cutoff `2026-08-19T18:49:16Z`, and TUI cutoff `2026-08-19T18:46:52.548Z`.

Current result: the final Web external set is empty. ModLens, SSH, Remote Web UI, Task Board, Pet, Git Graph, Skin Center, and Better Sidebar are blocked by the lifecycle, license, security, or ownership evidence below. The Task 18 audit covers every release after the `2026-08-21T02:11:00Z` cutoff: ModLens `3.22.2`, `3.23.0`, and `3.23.1`; Web UI `0.2.6` and `0.2.7` for each of 17 identities; Better Sidebar `0.15.0`; and dsh-TUI `0.8.7` and `0.8.8`. No Round 5 candidate reached Chrome or PTY validation because an exact-artifact mandatory check failed first. The final zero-row REAL gate passes 1/1, the complete oracle passes 196/196, all three negative controls block as intended, compact records seven items/401 tokens and 448 to 155 projected message tokens, restart retains 155, and the independent review records `EVIDENCE PASS / RUNTIME PASS`. The historical three-row 1/1 and 174/174, four-row 1/1 and 170/170, and six-row 156/156 results remain superseded evidence. TUI `0.7.1` source runtime passes, `0.8.7` and `0.8.8` runtime is `NOT RUN`, public delivery remains phase 2 BLOCKED, and Liangshen remains sourced from `0.2.4`.

Round 20 reports are `/tmp/fusion-round20-sidebar-report.md`, `/tmp/fusion-round20-tui-report.md`, and `/tmp/fusion-round20-workspace-audit.md`, with publication evidence under `/tmp/fusion-round20-sidebar-evidence.qz5emCs5/` and `/tmp/fusion-round20-tui-evidence-WPEgcLJ3/`, sidebar cutoff `2026-08-19T19:07:10Z`, and TUI cutoff `2026-08-19T19:09:18.503Z`.

Round 21 reports are `.superpowers/sdd/task-0-{modlens,sidebar,webui,tui}-report.md` and `.superpowers/sdd/task-0-review.md`, with sidebar cutoff `2026-08-20T02:40:36.996Z` and TUI cutoff `2026-08-20T02:43:21Z`.

This record uses four independent result levels:

- `PASS`: the named operation ran successfully.
- `FAIL`: the named operation ran and exited unsuccessfully or contradicted the rc.5 requirement.
- `NOT RUN`: no evidence exists for that operation.
- `BLOCKED`: an earlier required level failed, so the later operation could not establish compatibility.

Installation does not imply boot, and boot does not imply browser or console success. A package is compatible with rc.5 only when metadata, isolated installation, profile-layer resolution, actual boot, and the applicable browser or terminal check pass.

## Result matrix

| Package or group | Exact candidate | Metadata against rc.5 | Isolated install | Profile layer | Actual boot | Browser / console or terminal | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| final zero-row Web composition | none | PASS: no external artifact | PASS: minimal fixture has no external dependency, React peer, or build approval | PASS: empty patch and profile dependency map | PASS: Task 13 REAL gate 1/1 | PASS: oracle 196/196, negative controls 3/3, independent `EVIDENCE PASS / RUNTIME PASS` | **PASS** |
| `@liustack/modlens` | none accepted; latest audited `3.23.1` | PASS artifact/license/install; FAIL lifecycle | PASS at `3.23.1` | NOT ACCEPTED: row removed | Chrome `NOT RUN` | BLOCKED: 38/38 DSH candidates lack target routes or lose route disposers; `3.23.1` routes survive disposal and block clean remount | **BLOCKED** |
| `@linxin666/dsh-ssh` | none accepted; latest audited `0.2.7` | PASS license identity; FAIL lifecycle | Round 5 `NOT RUN` after mandatory lifecycle failure | NOT ACCEPTED: row removed | Round 5 `NOT RUN` | BLOCKED: 26/26 releases leave active terminal and SSH sessions open after disposal | **BLOCKED** |
| `@linxin666/dsh-remote-web-ui` | none accepted; latest audited `0.2.7` | `0.1.11` identity PASS; `0.1.12+` license conflict; FAIL lifecycle | Round 5 `NOT RUN` after mandatory failures | NOT ACCEPTED: row removed | Round 5 `NOT RUN`; historical `0.1.11` route unload/remount PASS | BLOCKED: 0/26 accepted; open SSE, tunnel quiescence, client subscription, and failed-pair root cleanup fail | **BLOCKED** |
| historical three-row Web composition | ModLens `3.22.1`, SSH `0.2.5`, Remote Web UI `0.1.11` | FAIL final lifecycle criterion | Historical install PASS | Historical three-row layer PASS | Historical gate 1/1 and oracle 174/174 PASS | Historical seven items/402 tokens and 449 to 155 projected tokens do not waive lifecycle failures | **SUPERSEDED** |
| historical four-row Web composition | final three rows plus Task Board `0.1.11` | FAIL final lifecycle criterion | Historical install PASS | Historical four-row layer PASS | Historical gate 1/1 and oracle 170/170 PASS | Historical seven items/401 tokens and 448 to 160 projected tokens do not waive the Task Board lifecycle failure | **SUPERSEDED** |
| historical six-row Web composition | historical four rows plus Pet `0.1.11` and Git Graph `0.1.11` | FAIL final security criterion | Historical install PASS | Historical six-row layer PASS | Historical boot PASS | Historical 156/156 runtime assertions did not cover the authorization failures | **SUPERSEDED** |
| `@linxin666/dsh-pet` | none accepted; latest audited `0.2.7` | Static authorization PASS at `0.2.6`/`0.2.7`; exact license identity FAIL | Round 5 `NOT RUN` after license failure | NOT ACCEPTED | Round 5 negative controls/runtime `NOT RUN` | BLOCKED: the `0.1.11` authorization defect remains historical; the new artifacts fail license identity before complete security/runtime admission | **BLOCKED** |
| `@linxin666/dsh-client-ui-git-graph` | none accepted; latest audited `0.2.7` | Static authorization PASS at `0.2.6`/`0.2.7`; exact license identity FAIL | Round 5 `NOT RUN` after license failure | NOT ACCEPTED | Round 5 negative controls/runtime `NOT RUN` | BLOCKED: the `0.1.11` revocation defect remains historical; the new artifacts fail license identity before complete security/runtime admission | **BLOCKED** |
| `@linxin666/dsh-client-ui-skin-center` | none accepted; latest audited `0.2.7` | BLOCKED: `0.1.12+` license conflict; `0.1.11` license-consistent | Round 5 `NOT RUN` after license failure | NOT ACCEPTED | Round 5 visibility/runtime `NOT RUN`; historical `0.1.11` slot invisible | BLOCKED: exact `0.2.6` and `0.2.7` license identity fails | **BLOCKED** |
| `dsh-better-sidebar` | none accepted; latest audited `0.15.0` | Artifact/license PASS; security and deployment ownership FAIL | Declared-peer install PASS; rc.5 public closure BLOCKED | NOT ACCEPTED: row removed from Fusion | Round 5 Web/lifecycle `NOT RUN` | BLOCKED: tools register through `ctx.tools`, but no package-owned approval decision or immutable deployment lock prevents direct unconfined ambient-environment PTY execution | **BLOCKED** |
| `@linxin666/dsh-liangshen` source | retain `0.2.4`; reject `0.2.6`/`0.2.7` | Artifact/license PASS; FAIL Windows policy and single ownership | Round 5 `NOT RUN` after mandatory failures | PASS: repository preset remains sole owner | Round 5 runtime `NOT RUN` | NOT ACCEPTED: new sources retain unconfined Windows Bash, while audited TUI artifacts package a second Liangshen owner | **PASS at `0.2.4`** |
| `@deepseek-harness-tui/dsh-tui` | source runtime `0.7.1`; reject `0.8.7`/`0.8.8` | Exact artifacts/licenses PASS; ownership and public rc.5 closure FAIL | `0.8.7`/`0.8.8` `NOT RUN`; historical source closure PASS | Historical source validation PASS: `base + dsh-tui`, profile-owned `code-runtime` row | Historical `0.7.1` fresh/resume PASS; new candidates `NOT RUN` | 19 releases; 24 non-rc.5 peers, zero root and 15 packaged `workspace:*` values, eight Liangshen files, and fresh complete closure 0/41 | **BLOCKED for public delivery** |

All eight external Web decisions are blockers. The final zero-row REAL gate passes 1/1 and the complete zero-row oracle passes 196/196 with independent `EVIDENCE PASS / RUNTIME PASS`. TUI runtime passes under the pure rc.5 source closure, but public delivery remains a phase 2 blocker until a consistent rc.5 closure is publicly available or a new Harness baseline is explicitly approved and fully revalidated.

## Historical evidence through Round 21

### Package evidence

### modlens

`@liustack/modlens@3.21.1` declares no `@deepseek-ai/dsh-*` peer dependencies, uses `dsh.bundle.patch: ./cordis.patch.yml`, declares `dsh.client.platform: web`, exports `./client`, and contributes row id `modlens`.

The isolated profile contains `base + web-app + modlens`. The real Web profile booted on port `3081`, returned HTTP `200`, rendered a populated `#root`, exposed the immediate modlens boot entry, and served the modlens client module with HTTP `200`. Chrome CDP `9333` captured 76 successful requests, no load failures, no non-2xx responses, no console messages, and no uncaught exceptions. The candidate is a complete PASS against rc.5.

### better-sidebar

The Round 20 full npm registry request ended at the fresh cutoff `2026-08-19T19:07:10Z` and returned HTTP `200`, cache `MISS`, and no `Age`; the outbound trace confirms a unique nonce, `Cache-Control: no-cache, no-store, max-age=0`, and `Pragma: no-cache`. Registry metadata reports `modified: 2026-08-19T18:11:22.931Z`, with no new manifest after the Round 19 cutoff. The installable version set contains 12 manifests with `latest: 0.14.0`. The registry `time` map also contains `0.12.0` at `2026-08-14T15:38:59.005Z`, but that time-only entry has no installable manifest or dist-tag and is not a candidate:

- `0.10.0` through `0.13.0` require all 15 DSH peers at `^0.1.0-rc.6`.
- `0.13.1` requires all 15 DSH peers at `^0.1.0-rc.7`.
- `0.14.0`, published at `2026-08-19T18:11:22.558Z`, requires all 13 DSH peers at `^0.1.0-rc.8`.

Semver `7.7.2` accepts rc.5 for 0 of 178 DSH peer declarations, so all 12 installable version manifests produce 0 compatible candidates. Candidate tarball integrity, candidate manifest validation, isolated installation, native build policy, profile layering, actual boot, Chrome CDP `9333` inspection, and browser console inspection remain `NOT RUN`. The Round 19 independent evidence review remains a historical `PASS_WITH_CONCERNS` with 0 Critical, 0 Important, and 2 Minor findings: the Round 19 sidebar report labels gzip-compressed transfer bytes as response body size, and its `SHA256SUMS` omits the exact semver tooling. Neither finding changes the Round 19 registry content or compatibility result, and neither establishes compatibility for Round 20.

### web-ui

The accepted composition is the retained direct `0.1.20` set:

```text
@linxin666/dsh-client-ui-web-ui-settings@0.1.20
@linxin666/dsh-client-ui-community-plugins@0.1.20
@linxin666/dsh-client-ui-task-board@0.1.20
@linxin666/dsh-client-ui-git-graph@0.1.20
@linxin666/dsh-pet@0.1.20
@linxin666/dsh-remote-web-ui@0.1.20
@linxin666/dsh-live-stats@0.1.20
@linxin666/dsh-ssh@0.1.20
@linxin666/dsh-skins@0.1.20
```

The profile root must provide these exact normal peer dependencies:

```json
{
  "react": "18.3.1",
  "react-dom": "18.3.1"
}
```

The isolated pnpm `11.18.0` profile must approve only these exact install-script dependencies:

```yaml
allowBuilds:
  cloudflared@0.7.3: true
  cpu-features@0.0.10: true
  ssh2@1.17.0: true
```

With those entries, exact installation, `pnpm peers check`, profile-layer reconciliation, boot, and HTTP all pass. Chrome CDP `9333` verified all nine required client entries and assets exactly once, including remote Web UI and skin center. The 47-entry roster had no duplicate ids; describe-image, AionUI panel, and Liangshen were absent from the roster and network. All 111 requests completed without failure or non-2xx response, and the browser reported no warning, error, assertion, log error, or uncaught exception.

`@linxin666/dsh-web-ui-all@0.1.20` remains a fallback only. It passes exact installation, peer checking with the same React providers, profile-layer reconciliation, boot, and HTTP. It has no Round 2 CDP acceptance evidence and includes duplicate AionUI panel and describe-image rows. Any fallback composition must disable real row ids `web-ui-dsh-aionui-panel` and `web-ui-describe-image`.

### TUI

The Round 20 npm registry request completed at the fresh cutoff `2026-08-19T19:09:18.503Z` and returned HTTP `200`, cache `MISS`, and no `Age`; the outbound trace confirms a unique nonce, `Cache-Control: no-cache, no-store, max-age=0`, and `Pragma: no-cache`. The packument still contains 16 versions with `latest: 0.8.5`, registry `modified: 2026-08-19T17:00:13.026Z`, and no new version after the Round 19 cutoff. Version `0.8.5` was published at `2026-08-19T17:00:12.602Z`:

- `0.5.0` through `0.8.0` require DSH peers at `^0.1.0-rc.6`.
- `0.8.1` through `0.8.5` require DSH peers at `^0.1.0-rc.7` and publish seven root runtime dependency values as `workspace:*`.

Semver `7.8.5` accepts rc.5 for 0 of 169 published DSH peer declarations, so all 16 versions produce 0 compatible candidates. The freshly downloaded exact `0.8.5` tarball passes SHA-1, SHA-512 SRI, and root identity checks, but it still has seven root runtime `workspace:*` values and 22 across all 18 packaged manifests. This exact-version static audit does not make `0.8.5` an rc.5 candidate. No rc.5 candidate exists, so isolated installation, profile composition, profile manifest inspection, actual boot, terminal top bar, status area, input area, Liangshen selection, and message round trip remain `NOT RUN`. The Round 20 evidence verifier reports 41/41 assertions passing; this proves internal evidence consistency, not rc.5 compatibility. The Round 19 independent evidence review remains a historical `PASS_WITH_CONCERNS` with 0 Critical, 0 Important, and 2 sidebar-only Minor findings.

### Historical mounting outcome

- modlens `3.21.1` is a complete rc.5 PASS.
- The retained direct web-ui `0.1.20` composition is a complete rc.5 PASS with exact React peer providers and exact `allowBuilds`; the aggregate is only a fallback with duplicates.
- better-sidebar has no rc.5-compatible published candidate through `2026-08-19T19:07:10Z`: 12 installable version manifests, `latest: 0.14.0`, registry `modified: 2026-08-19T18:11:22.931Z`, and 0/178 accepting DSH peer declarations; time-only `0.12.0` has no manifest and is not a candidate, while `0.14.0` requires 13 DSH peers at `^0.1.0-rc.8`. TUI has no rc.5-compatible published candidate through `2026-08-19T19:09:18.503Z`: 16 versions, `latest: 0.8.5`, and 0/169 accepting declarations; `0.8.5` still contains seven root and 22 total runtime `workspace:*` values.
- The Round 19 independent evidence review remains a historical `PASS_WITH_CONCERNS` with 0 Critical, 0 Important, and 2 sidebar-only Minor findings. Round 20 adds fresh publication evidence and a 41/41 internal TUI evidence verification without claiming an independent Round 20 review or compatibility PASS.
- The required five-repository fusion remains **BLOCKED**. Sidebar candidate tarball, manifest, install, profile, boot, and CDP checks and TUI isolated install, profile, actual boot, terminal UI, and message round trip remain `NOT RUN`; no compatibility shim, Harness upgrade, or inferred runtime result is accepted.

### Round 21 refresh

Fresh registry enumeration still finds 12 installable `dsh-better-sidebar` manifests with 0/178 DSH peer declarations accepting rc.5 and 16 dsh-TUI versions with 0/169 accepting rc.5. No exact candidate exists for either mandatory package.

Runtime negative controls do not change the candidate result. Better-sidebar `0.14.0` loaded through web-ui-all `0.2.4` with a clean Chrome CDP console, manually mounted `0.10.0` also loaded, and dsh-TUI `0.8.5` rendered under an inner PTY; the TUI first emitted upstream-drift warnings for 23 rc.5 packages against its rc.7 validation baseline.

The independent Round 21 review is `APPROVED_BLOCKED` with no Critical or Important findings. It confirms that runtime permissiveness cannot waive published peer requirements and that Tasks 1-9 remain blocked by Task 0A.

## Evidence index

- Round 1 metadata, tarballs, installs, and profiles: `/private/tmp/dsh-fusion-task0.X4pqGN/`
- Sidebar registry report: `/private/tmp/fusion-round2-sidebar-report.md`
- TUI registry report: `/private/tmp/fusion-round2-tui-report.md`
- Web-ui install, layer, peer, boot, and HTTP report: `/private/tmp/fusion-round2-webui-runtime-report.md`
- Web-ui Chrome CDP report: `/private/tmp/fusion-round2-webui-browser-report.md`
- modlens Chrome CDP report: `/private/tmp/fusion-round2-modlens-browser-report.md`
- Round 2 web-ui and modlens profile evidence: `/private/tmp/fusion-round2-webui-modlens.RAdgfl/`
- Round 3 sidebar release report: `/tmp/fusion-round3-sidebar-report.md`
- Round 3 sidebar registry response: `/tmp/fusion-round3-sidebar-registry.json`
- Round 3 TUI publication report: `/tmp/fusion-round3-tui-report.md`
- Round 3 inspected TUI tarball: `/tmp/fusion-round3-tui.iOeeir/deepseek-harness-tui-dsh-tui-0.8.3.tgz`
- Round 4 sidebar publication report: `/tmp/fuse-five-sidebar-round4.md`
- Round 4 sidebar registry response: `/tmp/fuse-five-sidebar-round4-registry.json`
- Round 4 verified sidebar tarballs: `/tmp/fuse-five-sidebar-round4-tarballs/`
- Round 4 TUI publication report: `/tmp/fuse-five-tui-round4.md`
- Round 4 TUI registry response: `/tmp/fuse-five-tui-round4-registry.json`
- Round 4 inspected TUI tarball and manifest: `/tmp/fuse-five-tui-round4-tarball/` and `/tmp/fuse-five-tui-round4-extract/package/package.json`
- Round 5 checks were performed by independent subagents; no durable /tmp report path was produced.
- Round 6 sidebar and TUI checks were streamed by independent subagents; no new durable `/tmp` report was produced.
- Round 7 sidebar report: `/tmp/fusion-round7-sidebar-report.md`; no separate registry response or tarball was written because no new candidate existed.
- Initial Round 7 TUI report and registry response for historical `0.8.3` evidence: `/tmp/fusion-round7-tui-report.md` and `/tmp/fusion-round7-tui-registry.json`
- Initial Round 7 inspected TUI `0.8.3` tarball and extraction: `/tmp/fusion-round7-tui.04owYN/dsh-tui-0.8.3.tgz` and `/tmp/fusion-round7-tui.04owYN/extract/package/`
- Round 7 TUI `0.8.4` cutoff-correction report: `/tmp/fusion-round7-tui-0.8.4-report.md`
- Round 7 TUI `0.8.4` registry response, tarball, extraction, verification JSON, and verification script: `/tmp/fusion-round7-tui-0.8.4.3EDad0/registry.json`, `/tmp/fusion-round7-tui-0.8.4.3EDad0/dsh-tui-0.8.4.tgz`, `/tmp/fusion-round7-tui-0.8.4.3EDad0/extract/package/`, `/tmp/fusion-round7-tui-0.8.4.3EDad0/artifact-verification.json`, and `/tmp/fusion-round7-tui-0.8.4.3EDad0/verify-artifact.mjs`
- Round 8 sidebar audit report: `/tmp/dsh-fusion-round8-sidebar-report.md`
- Round 8 TUI audit report: `/tmp/dsh-fusion-round8-tui-report.md`
- Round 8 TUI fresh registry body and headers: `/tmp/dsh-fusion-round8-tui.fKKD9z/fresh-registry.json` and `/tmp/dsh-fusion-round8-tui.fKKD9z/fresh-registry.headers`
- Round 8 TUI registry analysis, tarball, extracted manifest, and artifact analysis: `/tmp/dsh-fusion-round8-tui.fKKD9z/registry-analysis.json`, `/tmp/dsh-fusion-round8-tui.fKKD9z/dsh-tui-0.8.4.tgz`, `/tmp/dsh-fusion-round8-tui.fKKD9z/extract/package/package.json`, and `/tmp/dsh-fusion-round8-tui.fKKD9z/artifact-analysis.json`
- Round 9 sidebar audit report: `/tmp/fuse-five-repositories-round9-sidebar.md`
- Round 9 TUI audit report: `/tmp/fuse-five-repositories-round9-tui.md`
- Round 9 TUI fresh nonce and no-cache `MISS` registry body and headers: `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/registry.json` and `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/registry.headers`
- Round 9 TUI independent registry comparison artifacts: `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/npm-view.json`, `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/comparison.json`, `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/request.url`, and `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/curl.meta`
- Round 10 sidebar audit report: `/tmp/fuse-five-repositories-round10-sidebar.md`
- Round 10 sidebar fresh registry evidence: `/tmp/fuse-five-repositories-round10-sidebar-evidence.round10-sidebar-20260819T152651Z-4248a3d6-ec9f-4cbd-8159-360b24e37379/`
- Round 10 TUI audit report: `/tmp/fuse-five-repositories-round10-tui.md`
- Round 10 TUI fresh registry evidence: `/tmp/fuse-five-repositories-round10-tui-evidence-1fc4a2fc-ea9b-4fd1-a442-15e4dc9b2281/`
- Round 11 sidebar audit report: `/tmp/fuse-five-repositories-round11-sidebar.md`
- Round 11 sidebar unique evidence directory: `/tmp/fuse-five-repositories-round11-sidebar-evidence-ZHGfQ2/`
- Round 11 TUI audit report: `/tmp/fuse-five-repositories-round11-tui.md`
- Round 11 TUI unique evidence directory: `/tmp/fuse-five-repositories-round11-tui-evidence-9906d414-9693-4265-b991-cf6f57874c3c/`
- Round 12 updated sidebar audit report: `/tmp/fuse-five-repositories-round12-sidebar.md`
- Round 12 repaired sidebar evidence directory: `/tmp/fuse-five-repositories-round12-sidebar-evidence-fix-a9127c2b-77c2-40ca-b11d-359805d5f5cc/`
- Round 12 updated TUI audit report: `/tmp/fuse-five-repositories-round12-tui.md`
- Round 12 repaired TUI evidence directory: `/tmp/fuse-five-repositories-round12-tui-evidence-fix-348d5f9c-7068-42a6-a3b3-d9be6c2156e1/`
- Round 12 evidence repair report: `/tmp/fuse-five-repositories-round12-evidence-fix.md`
- Round 12 post-repair independent rereview: `/tmp/fuse-five-repositories-round12-evidence-rereview.md`
- Round 13 sidebar audit report: `/tmp/fusion-round13-sidebar-report.md`
- Round 13 sidebar evidence directory: `/tmp/fusion-round13-sidebar-evidence.D72yMW/`
- Round 13 TUI audit report: `/tmp/fusion-round13-tui-report.md`
- Round 13 TUI evidence directory: `/tmp/fusion-round13-tui-evidence-806ac590-6679-43c5-8f2c-0a9d87757ac2/`
- Round 13 independent evidence review: `/tmp/fusion-round13-evidence-review.md`
- Round 14 sidebar audit report: `/tmp/fusion-round14-sidebar-report.md`
- Round 14 sidebar evidence directory: `/tmp/fusion-round14-sidebar-evidence-zEJSrCsn/`
- Round 14 TUI audit report: `/tmp/fusion-round14-tui-report.md`
- Round 14 TUI evidence directory: `/tmp/fusion-round14-tui-evidence-b3c4f38f-ad80-4270-8433-5ce6eeea4dd1/`
- Round 14 independent evidence review: `/tmp/fusion-round14-evidence-review.md`
- Round 15 sidebar audit report: `/tmp/fusion-round15-sidebar-report.md`
- Round 15 sidebar evidence directory: `/tmp/fusion-round15-sidebar-evidence-PArhqmkh/`
- Round 15 repaired TUI audit report: `/tmp/fusion-round15-tui-report.md`
- Round 15 repaired TUI evidence directory: `/tmp/fusion-round15-tui-evidence-fix-ba261be2-8086-4a09-8aad-18cd225f54b5/`
- Round 15 TUI evidence repair report: `/tmp/fusion-round15-tui-evidence-fix-report.md`
- Round 15 final independent evidence rereview: `/tmp/fusion-round15-evidence-rereview.md`
- Round 16 sidebar audit report: `/tmp/dsh-fusion-round16-sidebar-report.md`
- Round 16 sidebar evidence directory: `/tmp/dsh-fusion-round16-sidebar-evidence.MahuvZQC/`
- Round 16 sidebar independent evidence review: `/tmp/dsh-fusion-round16-sidebar-review.md`
- Round 16 TUI audit report: `/tmp/dsh-fusion-round16-tui-report.md`
- Round 16 TUI evidence directory: `/tmp/dsh-fusion-round16-tui-evidence-4ea95909-ce88-4813-9207-5e3c8fe10abc/`
- Round 16 TUI independent evidence review: `/tmp/dsh-fusion-round16-tui-review.md`
- Round 17 sidebar audit report: `/tmp/fusion-round17-sidebar-report.md`
- Round 17 sidebar evidence directory: `/tmp/fusion-round17-sidebar-evidence-mcPmfe6K/`
- Round 17 TUI audit report: `/tmp/fusion-round17-tui-report.md`
- Round 17 TUI evidence directory: `/tmp/fusion-round17-tui-evidence-5b0933e5-76f4-4ba5-b3a2-3f66a9e68b25/`
- Round 17 independent evidence review: `/tmp/fusion-round17-evidence-review.md`
- Round 18 sidebar audit report and evidence directory: `/tmp/dsh-fusion-round18-sidebar/report.md` and `/tmp/dsh-fusion-round18-sidebar/`
- Round 18 TUI audit report and evidence directory: `/tmp/dsh-fusion-round18-tui/report.md` and `/tmp/dsh-fusion-round18-tui/`
- Round 18 independent evidence review: `/tmp/dsh-fusion-round18-evidence-review.md`
- Round 19 sidebar audit report: `/private/tmp/dsh-fusion-round19-sidebar-bZennRT5/report.md`
- Round 19 TUI audit report: `/private/tmp/dsh-fusion-round19-tui-KlLljWNS/report.md`
- Round 19 independent evidence review: `/private/tmp/dsh-fusion-round19-evidence-review.md`
- Round 20 sidebar audit report: `/tmp/fusion-round20-sidebar-report.md`
- Round 20 sidebar evidence directory: `/tmp/fusion-round20-sidebar-evidence.qz5emCs5/`
- Round 20 TUI audit report: `/tmp/fusion-round20-tui-report.md`
- Round 20 TUI evidence directory: `/tmp/fusion-round20-tui-evidence-WPEgcLJ3/`
- Round 20 workspace audit: `/tmp/fusion-round20-workspace-audit.md`
- Round 21 package reports: `.superpowers/sdd/task-0-modlens-report.md`, `.superpowers/sdd/task-0-sidebar-report.md`, `.superpowers/sdd/task-0-webui-report.md`, and `.superpowers/sdd/task-0-tui-report.md`
- Round 21 independent blocker review: `.superpowers/sdd/task-0-review.md`

At Round 20, the passing modlens and Web UI results did not establish full fusion compatibility. The Round 19 independent evidence review and Round 20 publication facts through the sidebar cutoff `2026-08-19T19:07:10Z` and TUI cutoff `2026-08-19T19:09:18.503Z` preserve that historical **BLOCKED** verdict.

## Round 22: phase 1 runtime lock

Round 22 applies the runtime-experience criterion to the highest exact versions parsed from the packages' dist-tags. A DSH peer range that excludes rc.5 is recorded but is not independently blocking. Evidence is in `.superpowers/sdd/v2-task-0-report.md`.

| Package | Exact version | Declared DSH peer | Runtime criterion | Profile `allowBuilds` | Notes |
| --- | --- | --- | --- | --- | --- |
| `@liustack/modlens` | `3.22.0` | none | **PASS**: install, row `modlens`, boot `43101`, CDP boot entry and client resource, `/modlens/config` `200`, clean page console/network | none | The image bridge is present; no provider credential or inference was exercised. |
| `@linxin666/dsh-liangshen` | `0.2.4` | none | **PASS**: install, row `liangshen`, boot `43102`, preset sync and `agentPreset.list` visibility, clean page console/network | none | Host-only source package; synced `liangshen` exposes `梁神模式`, the two-tool anchor, and `run_code` promotion. It is not a fusion browser row. |
| `@linxin666/dsh-client-ui-task-board` | `0.2.4` | none | **PASS**: install, row `ui-task-board`, boot `43103`, CDP client entry, `[data-dsh-taskboard-entry]`, `任务看板`, clean page console/network | none | Profile provides `react@18.3.1` for declared peer `react@^18.2.0`. |
| `@linxin666/dsh-ssh` | `0.2.4` | none | **PASS**: install, row `ssh`, boot `43104`, CDP client entry, `[data-dsh-ssh-entry]`, `SSH`, hosts API `200`, clean page console/network | `cpu-features@0.0.10`, `ssh2@1.17.0` | Profile provides `react@18.3.1` and `react-dom@18.3.1` for declared React peers. |
| `@linxin666/dsh-remote-web-ui` | `0.2.4` | none | **PASS**: install, row `remote-web-ui`, boot `43105`, CDP client entry and remote-control button, `/m/` `200`, clean page console/network | `cloudflared@0.7.3` | Profile provides `react@18.3.1` and `react-dom@18.3.1` for declared React peers. |
| `@linxin666/dsh-pet` | `0.2.4` | none | **PASS**: install, row `pet`, boot `43106`, CDP client entry, `[data-dsh-pet-root]` and `[data-pet-dock]`, pet state/assets loaded, clean page console/network | none | Profile provides `react@18.3.1` and `react-dom@18.3.1` for declared React peers. |
| `@linxin666/dsh-client-ui-skin-center` | `0.2.4` | none | **PASS**: install, row `ui-skin-center`, boot `43107`, CDP client entry, `body[data-dsh-skin-center]`, catalog API `200`, clean page console/network | none | Profile provides `react@18.3.1` for declared peer `react@^18.2.0`. |

All seven packages pass the phase 1 runtime lock on rc.5. None declares an `@deepseek-ai/dsh-*` peer; newer DSH versions appear only in development dependencies. The isolated manifests and composed rows contain no `dsh-tool-describe-image`, `dsh-client-ui-aionui-panel`, or `dsh-web-ui-all` reference. The repository root received no dependency or `allowBuilds` change.

The original Chrome endpoint exited after an interrupted diagnostic probe. Round 22 restored the required `127.0.0.1:9333` endpoint with a dedicated system Google Chrome process and reran the affected checks. This is an evidence-collection concern, not a package runtime failure. All test servers and the replacement Chrome process were stopped.

Round 22 fix evidence is preserved under `.superpowers/sdd/v2-task-0-evidence/`; its binding index is `.superpowers/sdd/v2-task-0-evidence/INDEX.md` and its top-level checksum manifest is `.superpowers/sdd/v2-task-0-evidence/SHA256SUMS`. The seven accepted supplemental runs reuse the recorded Round 22 profiles on ports `43201` through `43207` and retain exact add transcripts, dump-config output, server logs and HTTP results, system Google Chrome/CDP identity, per-package capability and clean-diagnostics JSON, exact profile manifests/locks/`allowBuilds`, and cleanup checks. The Chrome on `9333` was a pre-existing process from another task and was not launched or stopped by this fix run; every supplemental CDP page target and test server created by the fix run was closed.

## Round 22: Task 7 better-sidebar runtime gate

`dsh-better-sidebar@0.14.0` remains the highest exact registry version. Its rc.8 DSH peer ranges are recorded drift against rc.5. A profile-local exact install passed with `node-pty@1.1.0` approved in that profile only; the native module loaded, the three-bundle roster remained `base + web-app + fusion`, and the candidate composition produced exactly one `better-sidebar` row beside the enabled native `ui-sidebar`.

Chrome CDP `9333` established partial runtime behavior on the direct Fusion composition: native left sidebar and right workbench coexisted; Files issued `POST /sidebar/api/fs.search` with the selected session, opened `package.json` into CodeMirror, and Source Control issued two successful `git.status` requests and rendered branch/change data. The accepted diagnostic capture had 126 HTTP `200` responses, no HTTP error, no non-cancelled network failure, no console warning/error, and no runtime exception.

The terminal acceptance path is **BLOCKED**. The real `/sidebar/ws/terminal` socket opened and carried the complete `printf <unique-marker>\r` command as fragmented sent frames, but received frames contained only command echo plus `\r\n`. The marker occurred once in the received stream, not twice, and no command output or new prompt appeared. This does not prove that the native PTY executed the command. Task 7 therefore does not add `dsh-better-sidebar` to the Fusion manifest, patch, or user guide. Evidence is under `.superpowers/sdd/v2-task-7-evidence/`; the report is `.superpowers/sdd/v2-task-7-report.md`.

## Round 22: Task 8 dsh-TUI runtime gate

`@deepseek-harness-tui/dsh-tui@0.7.1` is the highest exact published version that passes the rc.5 runtime criterion. Versions `0.8.6` through `0.7.2` are rejected because they package and synchronize a second Liangshen preset without a supported opt-out; `0.7.1` contains no packaged Liangshen directory or `workspace:*` dependency values, so the repository-shipped `liangshen` remains the sole preset owner. No lower TUI version needs selection after `0.7.1` passes.

The preserved runtime-oracle overlay contains the ordered `@deepseek-ai/dsh-base` and `@deepseek-harness-tui/dsh-tui` bundle layers. Its profile-local dependencies use repository `link:` entries for `@deepseek-ai/dsh-code-runtime-worker-thread` and `@deepseek-ai/dsh-llm-replay`, plus exact `@deepseek-harness-tui/dsh-tui@0.7.1`; the profile patch inserts the linked worker as the host `code-runtime` row. The published production recipe instead pins `@deepseek-ai/dsh-code-runtime-worker-thread@0.1.0-rc.5` and TUI `0.7.1` by exact semver and has no replay provider dependency.

A fresh `160x50` node-pty run started the repository CLI with `DSH_HOME=<isolated> pnpm dsh --profile fusion-tui`, selected the shipped `liangshen`, rendered the TUI header, status and input area, sent the fixed user message, completed the phase-1 `bash` call with `BOOTSTRAP_OK`, promoted to `run_code`, rendered `42` and `TASK8_TUI_ROUNDTRIP_OK`, and wrote continuous durable events from seq `0` through `48`. A second real PTY set `DSH_TUI_RESUME_SESSION=41a9e214-2a1b-4721-b02b-96726bb2a120` and rendered the same transcript from the durable log.

Both PTYs used the supported idle exit sequence of two `Ctrl+C` inputs within three seconds. Each process reported exit code `0`; scans after exit found zero known child PIDs and zero commands matching the profile, session root, or isolated DSH home after excluding the scanner and evidence driver themselves.

Each run recorded exactly 20 `[dsh-tui] upstream drift` warnings for installed rc.5/rc.7 DSH packages against the TUI's rc.6 validation baseline. This peer drift is a **RECORDED RISK**, not a separate runtime blocker. The graph resolves React once at `19.2.8` while `dsh-working-activity@0.2.6` declares React `^18.2.0`; paced streaming and status rendering completed without a hook or reconciler crash, so that mismatch is also a **RECORDED RISK**.

Task 8 evidence is under `.superpowers/sdd/v2-task-8-evidence/`, with the final auditable runs in `final-pty-0.7.1/{fresh,resume}/`; each directory contains the exact command and environment, argv, timestamped driver steps, raw and normalized transcripts, running process tree, exit assertions, and post-exit process scan. The Task 8 report is `.superpowers/sdd/v2-task-8-report.md`. Task 8 is **PASS**; at that checkpoint, the overall five-repository fusion remained blocked independently by the then-unresolved Task 7 terminal result.

The acceptance overlay's repository `link:` dependencies and replay provider are test-only evidence inputs. The product guide's exact `0.1.0-rc.5` worker dependency and absence of replay define the published production recipe.

### Task 7 review correction

The preceding Task 7 terminal conclusion is superseded by the fresh review-fix run. The original probe ended its nominal wait when the first marker appeared in command echo, so its later stream inspection occurred before the login shell completed startup and could not establish a timeout.

The corrected probe sent one unique `printf '%s\n' '<marker>'` command and started an independent 30-second monotonic deadline after Enter. Every terminal WebSocket sent and received frame records both its CDP monotonic timestamp and local `time.monotonic_ns()`. The first marker cannot terminate the wait; success requires a second marker followed by a new prompt, while socket close or frame error terminates explicitly.

The fresh system Google Chrome CDP `9333` run reached the second marker and subsequent `(base) bytedance@DW79MHGWKN fusion %` prompt after 12.40 seconds, with no terminal socket close or error. Files search, CodeMirror editor, Source Control, native-left/right-workbench coexistence, and terminal execution passed; all 139 HTTP responses were `200`, with no runtime exception, console/log warning or error, bad response, or non-cancelled network failure. `dsh-better-sidebar@0.14.0` therefore passes the rc.5 runtime criterion despite its recorded rc.8 peer drift and is included as one Fusion row with profile-local `node-pty@1.1.0` build approval.

The authoritative evidence is `.superpowers/sdd/v2-task-7-evidence/review-fix/browser/sidebar-runtime.json`; the report is `.superpowers/sdd/v2-task-7-report.md`. `.superpowers/sdd/v2-task-7-evidence/INDEX.md` identifies the final artifacts, and `.superpowers/sdd/v2-task-7-evidence/SHA256SUMS` binds them.

## 2026-08-21 runtime-candidate refresh

Fresh no-cache registry requests cover the seven Web candidates through `2026-08-21T02:10:34Z`, sidebar through `2026-08-21T02:11:06.609Z`, and TUI through `2026-08-21T02:11:07.120Z`. Runtime oracles then applied the same rc.5 installation, composition, actual-surface, capability, and diagnostics criterion.

| Package | Current decision | Runtime result | Profile-local build approvals |
| --- | --- | --- | --- |
| `@liustack/modlens` | promote to `3.22.1` | PASS | none |
| `@linxin666/dsh-client-ui-task-board` | promote to `0.2.5` | PASS with recorded rc.8 DSH peer drift | none |
| `@linxin666/dsh-ssh` | promote to `0.2.5` | PASS | `cpu-features@0.0.10`, `ssh2@1.17.0` |
| `@linxin666/dsh-remote-web-ui` | promote to `0.2.5` | PASS | `cloudflared@0.7.3` |
| `@linxin666/dsh-pet` | promote to `0.2.5` | PASS | none |
| `@linxin666/dsh-client-ui-skin-center` | promote to `0.2.5` | PASS | none |
| `@linxin666/dsh-liangshen` | retain source lock `0.2.4`; reject `0.2.5` | REJECT AS SOURCE: the repository preset masks the candidate runtime, and its Windows shell path bypasses the repository sandbox/approval chain | none |
| `dsh-better-sidebar` | retain `0.14.0` | PASS; no newer release exists at the cutoff | `node-pty@1.1.0` |
| `@deepseek-harness-tui/dsh-tui` | retain `0.7.1` | PASS; every higher release retains a second Liangshen owner, and `0.8.1` onward also retain packaged `workspace:*` values | none |

Evidence is in `.superpowers/sdd/v3-task-11-web-versions-report.md`, `.superpowers/sdd/v3-task-11-sidebar-tui-versions-report.md`, `.superpowers/sdd/v3-task-11-modlens-runtime-report.md`, `.superpowers/sdd/v3-task-11-webui-runtime-report.md`, and `.superpowers/sdd/v3-task-11-consistency-report.md`. The six promotions preserve the accepted profile-local approvals, bundle order, sole capability owners, root-workspace isolation, sidebar version, and TUI version.

## 2026-08-21 Task 12 convergence

Task 12 license, security, and lifecycle review superseded the Task 11 current-result table without altering its historical evidence. At that checkpoint, the selected Web set was ModLens `3.22.1`, SSH `0.2.5`, and Remote Web UI `0.1.11`.

The historical six-row `base -> web-app -> fusion` profile established exact manifest and lock resolution, exact build approvals, six package capabilities, existing Web paths, tool-catalog deduplication, clean diagnostics, 156/156 runtime assertions, actual compact of seven items and 402 tokens, and restart resume. The later authorization findings mean this evidence cannot establish final acceptance. The historical reports remain `.superpowers/sdd/v3-task-12-final-web-runtime.md` and `.superpowers/sdd/v3-task-12-runtime-evidence-rereview.md`.

Pet remains externally blocked. Pet `0.1.11` registers exact `/api/pet/*` routes without Host, Origin, socket, or live-device authorization; an unpaired request that reaches the shared WebServer can read and persist Pet state. Evidence is in `.superpowers/sdd/v3-task-12-final-security-review.md` and `.superpowers/sdd/v3-task-12-pet-security-validation.md`.

Git Graph remains externally blocked. Git Graph `0.1.11` registers `/git/*` outside the Remote Web UI pairing route, so a revoked device that knows a workspace path can reach branch reads and mutations. Evidence is in `.superpowers/sdd/v3-task-12-final-security-review.md` and `.superpowers/sdd/v3-task-12-gitgraph-security-validation.md`.

Skin Center remains externally blocked. Published versions `0.1.12` through `0.2.5` have conflicting manifest and packaged-license identities. License-consistent `0.1.11` installs, composes, boots, and loads its client, but its `web-ui.plugin.item` registration is not rendered by the rc.5 Settings slots. Evidence is in `.superpowers/sdd/v3-task-12-license-investigation.md` and `.superpowers/sdd/v3-task-12-skin-0111-runtime.md`.

Better Sidebar remains a phase 2 security blocker and is not mounted. Its optional `terminal_*` model tools can use a host PTY outside the session sandbox, approval, and environment-scrubbing path. The only effective configuration-level mitigation disables the complete sidebar settings namespace and breaks the Settings experience, so it is not an acceptable deployment switch. Evidence is in `.superpowers/sdd/v3-task-12-sidebar-security-investigation.md`.

The historical four-row checked-in REAL composition evidence is `.superpowers/sdd/v3-task-12-four-row-real-gate-implementation.md`, with independent rereview in `.superpowers/sdd/v3-task-12-four-row-real-gate-review.md`. The gate activated all four rows through system Chrome CDP `9333`, contained no browser launch fallback, left default unit, coverage, Web, and CI collections offline, and kept external dependencies, lock data, and `allowBuilds` fixture-local. Its 1/1 result is superseded by the Task Board lifecycle finding.

The historical complete four-row oracle is `.superpowers/sdd/v3-task-12-final-four-row-web-runtime.md`, with evidence and runtime rereview in `.superpowers/sdd/v3-task-12-final-four-row-web-runtime-review.md`. It passed 170/170 assertions; real compaction shadowed seven items and 401 tokens, reduced projected message tokens from 448 to 160, and restored the same durable session after restart. This result is superseded and is not the current Web verdict.

The historical three-row checked-in REAL composition gate passed 1/1 through system Chrome CDP `9333`. The complete oracle in `.superpowers/sdd/v3-task-12-final-three-row-web-runtime.md` passed 174/174 assertions with clean diagnostics and blocker absence; real compaction shadowed seven items and 402 tokens, reduced projected message tokens from 449 to 155, and retained 155 in the same session after restart. Its independent rereview in `.superpowers/sdd/v3-task-12-final-three-row-web-runtime-review.md` was `EVIDENCE PASS / RUNTIME PASS`. The later ModLens, SSH, and Remote Web UI lifecycle reviews supersede this admission evidence.

Liangshen remains sourced from exact `0.2.4`, whose license identity is consistent; the repository retains its security-adapted Windows composition. TUI `0.7.1` passes high-quality fresh/resume PTY validation under a 41-package pure rc.5 source closure. The npm registry lacks rc.5 releases for 23 packages required by that graph, so no supported public command can reproduce it and public delivery remains phase 2 BLOCKED. Evidence is in `.superpowers/sdd/v3-task-12-liangshen-license.md`, `.superpowers/sdd/v3-task-13-tui-runtime.md`, and `.superpowers/sdd/v3-task-12-runtime-evidence-rereview.md`.

## 2026-08-21 Task 13 lifecycle convergence

The authoritative ModLens review is `.superpowers/sdd/task13-final/modlens-lifecycle-review.md`: all 38 DSH-capable candidates either lack both target routes or discard their route disposers. The real `3.22.1` Loader probe leaves `/modlens/paste` and `/modlens/config` active after disposal and rejects replacement handlers on same-Context remount.

The authoritative SSH review is `.superpowers/sdd/task13-final/ssh-lifecycle-review.md`: all 26 published versions leave accepted terminal WebSockets and standalone SSH clients and channels active after plugin disposal. The real `0.2.5` probe confirms that an active shell remains usable after awaited fiber disposal.

The authoritative Remote Web UI review is `.superpowers/sdd/task13-final/remote-web-ui-lifecycle-review.md`: 0 of 26 published versions pass the combined criterion. Version `0.1.11` removes and remounts its 12 Host routes, but open pairing/mobile SSE streams, tunnel quiescence, two client subscription disposers, and the failed-pair React root remain incomplete; versions `0.1.12+` also have conflicting manifest/LICENSE identities.

These findings reduce the current Fusion Web target to zero external rows. Task 12.17 updates the bundle, fixture, tests, product documentation, desktop contract, website labels, Agent Note, and execution records. The final zero-row REAL gate passes 1/1 and the complete Web oracle passes 196/196. All three negative controls block at 195/196 with exit 1, compact records seven items/401 tokens and 448 to 155 projected message tokens, restart retains 155, and the independent review records `EVIDENCE PASS / RUNTIME PASS`.

## Round 23: Task 18 post-cutoff audit

Round 23 audits every release after the `2026-08-21T02:11:00Z` cutoff. The independent rereview approved specification compliance and evidence quality after exact Web UI `0.2.6` and dsh-TUI `0.8.7` artifacts closed the first review's coverage gap. This round changes no admission decision: Fusion Web retains zero external rows, and Fusion TUI public delivery remains phase 2 **BLOCKED**.

| Family | Fresh evidence cutoff | Current counts | Exact post-cutoff set |
| --- | --- | --- | --- |
| ModLens | `2026-08-21T22:38:40.412Z` | 76 releases; 38 DSH candidates | `3.22.2`, `3.23.0`, `3.23.1` |
| Web UI | `2026-08-21T23:30:28.583Z` | 17 identities; totals listed below | `0.2.6`, `0.2.7` for every identity |
| Better Sidebar | `2026-08-21T22:38:00Z` | 13 releases | `0.15.0` |
| dsh-TUI | `2026-08-21T23:28:19.483Z` | 19 releases | `0.8.7`, `0.8.8` |

The 17 Web UI identity totals are: Chat Recovery 4, AionUI Panel 26, Community Plugins 11, Git Graph 26, Plugin Manager 6, Skill Explorer 8, Skin Center 27, Task Board 26, Web UI Settings 26, Desktop Launcher 4, Liangshen 16, Pet 26, Remote Web UI 26, Skins 28, SSH 26, describe-image 17, and `web-ui-all` 28.

| Candidate | Artifact and license | Security, lifecycle, or ownership | Downstream result |
| --- | --- | --- | --- |
| ModLens `3.23.1` | Exact identity, integrity, MIT license, install, import, profile add, and composition PASS | Initial routes PASS; direct Loader probe FAIL because both routes survive disposal and duplicate-route rejection prevents remount | Web boot, capability visibility, and Chrome diagnostics `NOT RUN` |
| Web UI `0.2.6`/`0.2.7` | All 34 exact tarballs pass registry identity and integrity. Ten identities in each wave have manifest/LICENSE conflicts; seven are license-consistent | Pet and Git Graph have static server authorization in both waves, but license fails before complete security admission. Task Board, SSH, and Remote Web UI retain exact lifecycle failures; Skin Center fails license; Liangshen fails Windows policy and single ownership; AionUI, describe-image, and `web-ui-all` violate deduplication or ownership | Decision-bearing installs, candidate Chrome, negative controls, and runtime are `NOT RUN`; non-target identities remain not selected |
| Better Sidebar `0.15.0` | Exact identity, integrity, MIT license, declared-peer install, and native load PASS | `agentTerminalTools` remains user-writable. Eight tools register through `ctx.tools` and enter the generic pre-execute chain, but the package supplies no approval decision or immutable deployment lock; model commands reach `nodePty.spawn` with ambient `process.env` outside Harness confinement and environment scrubbing | rc.5 public install is blocked; Web boot, Chrome, and lifecycle are `NOT RUN` |
| dsh-TUI `0.8.7`/`0.8.8` | Both exact artifacts pass identity, integrity, and MIT license checks | Each has 24 non-rc.5 DSH peers, zero root and 15 packaged `workspace:*` values, and eight packaged Liangshen files with an active second owner. Fresh complete historical source-closure queries find exact rc.5 for 0/41 packages | Install, profile composition, fresh/resume PTY, UI, round trip, replay, exit, and cleanup are `NOT RUN` |

The TUI closure counts describe different evidence sets. The historical 23-package result is the direct subset queried by the public-install attempt; the fresh 0/41 result covers the complete package set used by the historical pure rc.5 source-validation closure. Neither result says that the other 18 packages were historically available. The historical `0.7.1` source runtime remains PASS; neither `0.8.7` nor `0.8.8` has a runtime PASS or FAIL.

Round 5 uses mandatory checks in order, so the recorded `NOT RUN` results are valid rather than missing acceptance evidence. License, lifecycle, security-policy, deduplication, single-owner, or public-closure failures reject the exact artifact before a candidate browser or PTY run could establish compatibility. The Chrome CDP `9333` observations in the reports are environment preflight only.

Evidence:

- ModLens `3.23.1`: `.superpowers/sdd/round5-modlens/report.md`
- Web UI `0.2.7` and Liangshen `0.2.7`: `.superpowers/sdd/round5-webui/report.md`
- Better Sidebar `0.15.0`: `.superpowers/sdd/round5-sidebar/report.md`
- dsh-TUI `0.8.8`: `.superpowers/sdd/round5-tui/report.md`
- Web UI `0.2.6`: `.superpowers/sdd/round5-webui-026/report.md`
- dsh-TUI `0.8.7`: `.superpowers/sdd/round5-tui-087/report.md`
- First independent review and accepted rereview: `.superpowers/sdd/round5-external-review.md` and `.superpowers/sdd/round5-external-rereview.md`

# Fusion compatibility matrix

Status: **BLOCKED**

Checked through: `2026-08-20T02:43:21Z`

Baseline: `@deepseek-ai/dsh@0.1.0-rc.5`, macOS arm64, Node.js `v24.14.0`. The repository launcher used pnpm `11.7.0`; isolated profiles used pnpm `11.18.0`. Round 1 artifacts remain under `/private/tmp/dsh-fusion-task0.X4pqGN`; Round 2 runtime artifacts are under `/private/tmp/fusion-round2-webui-modlens.RAdgfl` and `/private/tmp/fusion-round2-*`; Round 3 publication reports are under `/tmp/fusion-round3-*`; Round 4 publication evidence is under `/tmp/fuse-five-*-round4*`; Round 7 reports and TUI publication artifacts are under `/tmp/fusion-round7-*`; Round 8 reports are under `/tmp/dsh-fusion-round8-*-report.md`, with TUI artifacts under `/tmp/dsh-fusion-round8-tui.fKKD9z/`; Round 9 reports are under `/tmp/fuse-five-repositories-round9-*.md`, with fresh TUI registry evidence under `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/`; Round 10 reports are under `/tmp/fuse-five-repositories-round10-*.md`, with fresh registry evidence in the directories listed in the evidence index; Round 11 reports are `/tmp/fuse-five-repositories-round11-sidebar.md` and `/tmp/fuse-five-repositories-round11-tui.md`, with evidence under `/tmp/fuse-five-repositories-round11-sidebar-evidence-ZHGfQ2/` and `/tmp/fuse-five-repositories-round11-tui-evidence-9906d414-9693-4265-b991-cf6f57874c3c/`; Round 12 updated reports are `/tmp/fuse-five-repositories-round12-sidebar.md` and `/tmp/fuse-five-repositories-round12-tui.md`, with repaired evidence under `/tmp/fuse-five-repositories-round12-sidebar-evidence-fix-a9127c2b-77c2-40ca-b11d-359805d5f5cc/` and `/tmp/fuse-five-repositories-round12-tui-evidence-fix-348d5f9c-7068-42a6-a3b3-d9be6c2156e1/`, repair report `/tmp/fuse-five-repositories-round12-evidence-fix.md`, and rereview report `/tmp/fuse-five-repositories-round12-evidence-rereview.md`; Round 13 reports are `/tmp/fusion-round13-sidebar-report.md` and `/tmp/fusion-round13-tui-report.md`, with evidence under `/tmp/fusion-round13-sidebar-evidence.D72yMW/` and `/tmp/fusion-round13-tui-evidence-806ac590-6679-43c5-8f2c-0a9d87757ac2/`, and independent review `/tmp/fusion-round13-evidence-review.md`; Round 14 reports are `/tmp/fusion-round14-sidebar-report.md` and `/tmp/fusion-round14-tui-report.md`, with evidence under `/tmp/fusion-round14-sidebar-evidence-zEJSrCsn/` and `/tmp/fusion-round14-tui-evidence-b3c4f38f-ad80-4270-8433-5ce6eeea4dd1/`, and independent review `/tmp/fusion-round14-evidence-review.md`; Round 15 reports are `/tmp/fusion-round15-sidebar-report.md` and the repaired `/tmp/fusion-round15-tui-report.md`, with evidence under `/tmp/fusion-round15-sidebar-evidence-PArhqmkh/` and `/tmp/fusion-round15-tui-evidence-fix-ba261be2-8086-4a09-8aad-18cd225f54b5/`, repair report `/tmp/fusion-round15-tui-evidence-fix-report.md`, and final rereview `/tmp/fusion-round15-evidence-rereview.md`; Round 16 reports and independent reviews are `/tmp/dsh-fusion-round16-sidebar-report.md`, `/tmp/dsh-fusion-round16-sidebar-review.md`, `/tmp/dsh-fusion-round16-tui-report.md`, and `/tmp/dsh-fusion-round16-tui-review.md`, with evidence under `/tmp/dsh-fusion-round16-sidebar-evidence.MahuvZQC/` and `/tmp/dsh-fusion-round16-tui-evidence-4ea95909-ce88-4813-9207-5e3c8fe10abc/`; Round 17 reports are `/tmp/fusion-round17-sidebar-report.md`, `/tmp/fusion-round17-tui-report.md`, and `/tmp/fusion-round17-evidence-review.md`, with evidence under `/tmp/fusion-round17-sidebar-evidence-mcPmfe6K/` and `/tmp/fusion-round17-tui-evidence-5b0933e5-76f4-4ba5-b3a2-3f66a9e68b25/`; Round 18 reports are `/tmp/dsh-fusion-round18-sidebar/report.md` and `/tmp/dsh-fusion-round18-tui/report.md`, with evidence under `/tmp/dsh-fusion-round18-sidebar/` and `/tmp/dsh-fusion-round18-tui/`, and independent review `/tmp/dsh-fusion-round18-evidence-review.md`; Round 19 reports are `/private/tmp/dsh-fusion-round19-sidebar-bZennRT5/report.md` and `/private/tmp/dsh-fusion-round19-tui-KlLljWNS/report.md`, with independent review `/private/tmp/dsh-fusion-round19-evidence-review.md`, sidebar cutoff `2026-08-19T18:49:16Z`, and TUI cutoff `2026-08-19T18:46:52.548Z`.

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
| `@liustack/modlens` | `3.21.1` | PASS: no DSH peer range; bundle patch, `web` client, and `./client` export present | PASS | PASS: `base + web-app + modlens` | PASS: HTTP `200` | PASS: Chrome CDP `9333`, client HTTP `200`, 76/76 requests HTTP `200`, no console errors or exceptions | **PASS** |
| `dsh-better-sidebar` | none | FAIL: all 12 installable version manifests require rc.6, rc.7, or rc.8 DSH peers | NOT RUN: metadata blocked | NOT RUN | NOT RUN | NOT RUN | **BLOCKED**: no rc.5 candidate |
| retained direct web-ui packages | exact `0.1.20` set | PASS: no DSH peer mismatch; exact peer providers `react@18.3.1` and `react-dom@18.3.1` satisfy `^18.2.0` | PASS with exact `allowBuilds` entries | PASS: all retained direct bundles reconciled | PASS: HTTP `200` | PASS: Chrome CDP `9333`, all retained assets loaded once, exclusions absent, no failed requests, console errors, or exceptions | **PASS** |
| `@linxin666/dsh-web-ui-all` | `0.1.20` fallback only | PASS with the same exact React peer providers | PASS with exact `allowBuilds` entries | PASS: explicit aggregate layer | PASS: HTTP `200` | NOT RUN | Fallback only; duplicates AionUI panel and describe-image |
| `@deepseek-harness-tui/dsh-tui` | none | FAIL: all 16 releases require rc.6 or rc.7 DSH peers; latest audited release `0.8.5` has seven root and 22 total runtime `workspace:*` values | NOT RUN: no rc.5 candidate | NOT RUN | NOT RUN | NOT RUN | **BLOCKED**: no rc.5 candidate |

modlens and the retained direct web-ui composition pass individually. There is no complete exact-version `COMPAT[...]` set for Task 1 or Task 2 because sidebar and TUI remain blocked; this matrix does not claim full fusion compatibility.

## Package evidence

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

## Mounting outcome

- modlens `3.21.1` is a complete rc.5 PASS.
- The retained direct web-ui `0.1.20` composition is a complete rc.5 PASS with exact React peer providers and exact `allowBuilds`; the aggregate is only a fallback with duplicates.
- better-sidebar has no rc.5-compatible published candidate through `2026-08-19T19:07:10Z`: 12 installable version manifests, `latest: 0.14.0`, registry `modified: 2026-08-19T18:11:22.931Z`, and 0/178 accepting DSH peer declarations; time-only `0.12.0` has no manifest and is not a candidate, while `0.14.0` requires 13 DSH peers at `^0.1.0-rc.8`. TUI has no rc.5-compatible published candidate through `2026-08-19T19:09:18.503Z`: 16 versions, `latest: 0.8.5`, and 0/169 accepting declarations; `0.8.5` still contains seven root and 22 total runtime `workspace:*` values.
- The Round 19 independent evidence review remains a historical `PASS_WITH_CONCERNS` with 0 Critical, 0 Important, and 2 sidebar-only Minor findings. Round 20 adds fresh publication evidence and a 41/41 internal TUI evidence verification without claiming an independent Round 20 review or compatibility PASS.
- The required five-repository fusion remains **BLOCKED**. Sidebar candidate tarball, manifest, install, profile, boot, and CDP checks and TUI isolated install, profile, actual boot, terminal UI, and message round trip remain `NOT RUN`; no compatibility shim, Harness upgrade, or inferred runtime result is accepted.

## Round 21 refresh

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

The passing modlens and web-ui results do not establish full fusion compatibility. The Round 19 independent evidence review remains historical evidence, while the Round 20 publication facts through the sidebar cutoff `2026-08-19T19:07:10Z` and TUI cutoff `2026-08-19T19:09:18.503Z` leave the overall status **BLOCKED** until compatible sidebar and TUI publications pass their required runtime checks.

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

# Fusion Compatibility Matrix

English | [中文](fusion-compat-matrix.zh.md)

Status: **TASK_42_STATIC_RUNTIME_PASS_FINAL_PACKAGE_REVIEW_PENDING**

Checked through: no-cache registry response window ending `2026-08-23T11:18:55Z`; current-worktree static and system Chrome runtime evidence through `2026-08-23T14:18:03Z`

Baseline: `@deepseek-ai/dsh@0.1.0-rc.5`, macOS arm64, Node.js `v24.14.0`, repository pnpm `11.7.0`, isolated-profile pnpm `11.18.0`.

## Evidence Ownership

This tracked matrix records dated package counts and candidate stop points. The [tracked regression record](fusion-regression-report.md) owns current-worktree static and runtime evidence, including the tracked built acceptance and the reproducibility classification for local-only supporting runs. Earlier ignored or machine-local work products are not clean-checkout evidence owners.

The no-cache freshness capture ending `2026-08-23T11:18:55Z` used local scripts and response files that are not tracked. Its dated counts below are retained as non-reproducible candidate history and cannot establish current acceptance.

## Ordered Admission

This record uses four independent result levels:

- `PASS`: the named operation ran successfully.
- `FAIL`: the named operation ran and failed or contradicted an rc.5 requirement.
- `NOT RUN`: no evidence exists because an earlier required check failed or the identity was not selected.
- `BLOCKED`: an earlier required check prevents compatibility or public delivery.

Web package checks run in this order: artifact identity and integrity, license identity, security, single-owner requirements, dependency closure, exact isolated installation, profile composition, actual boot, target capability and diagnostics, complete resource ownership with quiescent disposal, and disconnect remounting. TUI package checks run artifact identity and integrity, license identity, single Liangshen ownership, security, public dependency closure, exact isolated installation, profile composition, and PTY runtime. The first failure stops the candidate; later checks remain `NOT RUN`.

## Current Result Matrix

| Package or group | Exact candidate | First failing check or accepted evidence | Downstream result | Current decision |
| --- | --- | --- | --- | --- |
| Fusion Web composition | Pet `0.2.9` | Package admission passes; current tracked built acceptance passes 1/1; the fresh local-only driver passes 39/39 twice consecutively and its oracle passes 50/50 under system Chrome `151.0.7922.172` through CDP `9333` | Local-only harness inputs are unavailable from a clean checkout and cannot replace tracked acceptance; final package and independent reviews remain pending | **SELECTED** |
| `@linxin666/dsh-pet` | `0.2.9` | Exact identity, integrity, Apache-2.0 license identity, server authorization, client lifecycle, and isolated runtime pass | Revalidate from artifact identity after any input changes | **ACCEPTED** |
| `@linxin666/dsh-client-ui-git-graph` | latest audited `0.2.9` | Active JSON operation and Git child outlive row-fiber disposal | New candidate runtime `NOT RUN` | **BLOCKED** |
| `@liustack/modlens` | latest audited `3.24.0` | Cross-site `POST /modlens/paste` passes where `/modlens/config` rejects and writes supplied bytes | Lifecycle, boot, capability, and Chrome `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-ssh` | latest audited `0.2.9` | Active standalone terminal session remains outside plugin disposal | Installation and runtime `NOT RUN` after lifecycle failure | **BLOCKED** |
| `@linxin666/dsh-remote-web-ui` | latest audited `0.2.9` | `requirePairingForLan:false` bypasses live authorization for `/remote` HTTP and WebSocket handlers | Lifecycle and runtime `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-client-ui-task-board` | latest audited `0.2.9` | Client discards the top-level settings subscription disposer | Ownership, runtime, and remounting `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-client-ui-skin-center` | latest audited `0.2.9` | Manifest and packaged LICENSE identity conflict | Later checks `NOT RUN` | **BLOCKED** |
| `dsh-better-sidebar` | latest audited `0.15.2` | Public rc.5 closure fails: exact rc.5 exists for 0/14 required DSH peers | Security, lifecycle, installation, composition, boot, and Chrome `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-liangshen` source | retain `0.2.4`; reject `0.2.8`/`0.2.9` | Later sources retain an unconfined Windows shell path; repository preset remains sole owner | Candidate runtime `NOT RUN` | **RETAIN `0.2.4`** |
| `@deepseek-harness-tui/dsh-tui` | source runtime `0.7.1`; reject latest `0.9.0` | `0.9.0` packages a second Liangshen owner without supported opt-out | Security, closure, installation, composition, and PTY `NOT RUN` | **PUBLIC DELIVERY BLOCKED** |

The Fusion Web patch and profile dependency map contain only exact Pet `0.2.9`. The other seven decision-bearing Web capabilities remain unmounted. Public Fusion TUI remains phase 2 `BLOCKED`.

## TUI `0.9.0` Freshness Result

The Task 40 local no-cache response for `@deepseek-harness-tui/dsh-tui` completed at `2026-08-23T11:18:55Z`. It reported 20 installable versions and identified exact `0.9.0`, published at `2026-08-23T05:35:34.508Z`, as the sole candidate after the prior cutoff `2026-08-21T23:28:19.483Z`. The response, tarball, and recomputation script are not tracked, so these counts are non-reproducible historical context rather than current acceptance evidence.

The local capture reported passing artifact identity, integrity, path safety, and MIT license identity. Exact hashes and entry counts are omitted because their source artifacts and commands cannot be reconstructed from a clean checkout.

Single Liangshen ownership is the first TUI-family failure. The local tarball inspection reported eight Liangshen files, a packaged-preset installer that writes to the Harness user preset root, and no supported opt-out. Security, public rc.5 closure, isolated installation, profile composition, and fresh/resume PTY round-trip, exit, and cleanup checks are `NOT RUN` after this failure. No PTY check was run for `0.9.0`.

## Current Web Oracle

The checked-in REAL lane copies only `cordis.patch.yml`, `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` from the fixture before frozen installation. Ignored source `node_modules` never enters the target profile.

Each HTTP snapshot contains status, a normalized ordered multimap built from Node HTTP(S) raw header pairs except `connection`, `content-length`, `date`, `keep-alive`, and `transfer-encoding`, plus original body bytes. These exclusions are per-request connection or framing data; body bytes are compared separately. Within each profile, every blocked `GET` equals that profile's own `GET /`. Across the independently booted baseline and Fusion profiles, every non-fallback response remains equal. Pet-only root comparison locates the unique decoded boot assignment in the original `Buffer`, replaces only that payload byte interval after removing Pet and recomputing the revision, and compares all resulting bytes with baseline.

The CI EXIT trap preserves a failing acceptance status while completing Chrome process-group and profile cleanup. Command timeout, caller cancellation, and readiness cancellation settle only after the full process tree stops. Private-package mutation reports callback, directory-removal, and installed-entry hash failures independently and preserves their order in an `AggregateError`.

## Historical Checkpoints

| Checkpoint | Dated input | Recorded result | Current meaning |
| --- | --- | --- | --- |
| Early sidebar/TUI registry scan | Sidebar `2026-08-19T19:07:10Z`; TUI `2026-08-19T19:09:18.503Z` | Sidebar 12 manifests and TUI 16 versions had no rc.5 peer-compatible candidate | Historical metadata only |
| Post-cutoff audit | Through `2026-08-21T23:30:28.583Z` by family | ModLens `3.23.1`, Web UI `0.2.6`/`0.2.7`, Better Sidebar `0.15.0`, TUI `0.8.7`/`0.8.8` all stopped at recorded mandatory checks | Superseded by later candidates where applicable |
| Web UI `0.2.8`/`0.2.9` | Through `2026-08-22T12:37:33.085Z` | Pet and Git Graph passed the checks then exercised | Git Graph later blocked by active-operation lifecycle |
| Better Sidebar `0.15.2` | HTTP cutoff `2026-08-22T17:01:07Z` | Artifact/license pass; public rc.5 closure 0/14 | Later checks `NOT RUN` |
| Task 35 Pet-only runtime | Through `2026-08-23T05:16:28Z` | Built acceptance is reproducible from tracked tree `a5e6deb6f9fbf17d31e8a593722cb0063969549a`; other local results are not | Historical context only |

Historical zero-row, two-row, three-row, four-row, and six-row runtime results remain measurements only for their exact compositions. They cannot waive a later security, lifecycle, ownership, license, or closure failure.

## Revalidation

Revalidate from artifact identity whenever the Harness version, external version or tarball, peer baseline, resolved React or native dependency graph, patch row, profile build approval, or Liangshen owner changes. Web revalidation includes exact installation, config dump, boot, same-Context unload/remount, open-resource disposal, the complete system Chrome CDP `9333` oracle, and clean diagnostics. TUI public delivery additionally requires one Liangshen owner, a supported public dependency closure, exact installation and lock inspection, fresh and resumed real PTY message round trips, durable events, supported exit, and process cleanup.

# Agent Note: Fusion profile external-plugin ownership

Status: implemented

English | [中文](2026-08-19-fusion-profile-external-plugin-ownership.zh.md)

## Problem

Fusion combines packages that release independently from DeepSeek Harness. Their declared peer ranges can lag or lead the Harness release even when the packages run together, while a successful boot alone does not prove that the intended UI or terminal capability works. Treating peer ranges as the compatibility verdict rejects working combinations; treating installation or boot as sufficient accepts incomplete ones.

Putting those packages in the Fusion bundle's normal dependency sections would install their trees with the repository or Harness distribution rather than with the profile that selected them. Aggregate packages can also reintroduce competing image tools, workbenches, mobile access, or Liangshen presets. Either choice obscures which package owns a capability and which lockfile and native-build approvals reproduce it.

## Decision

An external package enters the candidate set only when its manifest license identity agrees with its packaged authorization text. Fusion selects the highest exact candidate that passes the runtime oracle on the target Harness release: it installs in an isolated profile, the ordered profile composition resolves, the target Web or terminal interface starts, the intended capability is observed through that interface, and its resources have complete effect/disposer ownership and disconnect remounting. A peer-range mismatch is recorded as drift but is not independently a failure.

The Fusion bundle's `dsh.bundle.profileDependencies` is empty because no external Web package satisfies every admission criterion. Its patch contributes no rows. The checked-in `test:fusion:acceptance` lane boots `base -> web-app -> fusion` through system Chrome CDP `9333`, verifies zero external Host rows, browser entries, client resources, UI roots, routes, and tools, and remains outside default unit, coverage, Web, and CI collections. TUI source validation selects `@deepseek-harness-tui/dsh-tui@0.7.1` with `@deepseek-ai/dsh-code-runtime-worker-thread@0.1.0-rc.5`, but that runtime result does not establish a publicly installable profile.

`@deepseek-ai/dsh-fusion` carries no third-party package in `dependencies`, `devDependencies`, `peerDependencies`, or `optionalDependencies`. Its `dsh.bundle.profileDependencies` object is static ownership metadata: [`verify-cordis-config`](../../../../scripts/verify-cordis-config.ts) requires an exact npm version for every profile-owned bare patch row, rejects unused mappings, and rejects a mapped package repeated in any standard dependency section. The runtime does not read this object or install from it.

Each profile owns its package manifest, lockfile, and pnpm workspace settings. The current Web profile has no external installation, peer provider, or build approval; none belongs in the repository root. Its bundle order is explicitly `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, then `@deepseek-ai/dsh-fusion`. Fusion is not a `PROFILE_TEMPLATES` entry, so a missing `fusion` profile fails until a user assembles it. Fusion TUI has no supported public assembly command while the required rc.5 package closure is unavailable.

This decision specializes the installation and ordering model in [profile plugin bundles](2026-08-05-profile-plugin-bundles.md) and uses the sole external-plugin distribution path retained by [removing the repository Plugin path](../simplification/2026-08-09-remove-repository-plugin.md).

## Capability ownership

ModLens is an external lifecycle blocker. Its 76 releases include 38 DSH candidates, and all 38 either lack both target routes or call `WebServer.register()` without retaining the route disposers. Exact `3.23.1`, the latest of three post-cutoff candidates, passes artifact, license, installation, composition, and initial-route checks; disposal leaves `/modlens/paste` and `/modlens/config` active, and a same-Context remount rejects the replacement handlers as duplicates while the old closures continue serving.

SSH is an external lifecycle blocker. All 26 published versions keep accepted terminal WebSockets and their standalone SSH clients and channels outside plugin-owned disposal. The selected `0.2.5` removes future route dispatch and clears its sweep interval, but an active terminal remains usable after awaited fiber disposal.

Task Board is an external lifecycle blocker. None of its 26 published versions simultaneously provides complete effect/disposer ownership with disconnect remounting, consistent manifest and packaged LICENSE identity, and rc.5 runtime support. License-consistent `0.1.11` loads initially on rc.5, but its complete UI disposer and top-level subscription are not Cordis effects and its detached container does not remount. Exact `0.2.6` and `0.2.7` retain those lifecycle defects and have conflicting manifest and packaged LICENSE identities. Task Board can re-enter consideration only when one published artifact satisfies all three conditions and passes same-page unload, HMR, remount, and resource-cleanup checks.

Remote Web UI is an external lifecycle blocker with 0 of 26 published versions accepted. Version `0.1.11` removes all 12 Host routes and remounts them without stale handlers, but open pairing and mobile SSE streams have no plugin-level close path, tunnel disposal does not await Cloudflared exit, two client settings subscriptions discard their disposers, and a failed-pair timeout can leave an unmanaged React root. Releases `0.1.12` and later also have conflicting manifest and packaged LICENSE identities. The Electron consumer may retain and own the lifecycle of its own remote implementation because Fusion provides none.

Git Graph remains excluded. Version `0.1.11` historically exposes `/git/*` outside Remote Web UI pairing and revocation through the public tunnel, including operations that read and change the shared workspace branch. Exact `0.2.6` and `0.2.7` add static server-side authorization to every inspected JSON and SSE route, but both fail manifest and packaged license identity before revocation negative controls or runtime validation. One exact artifact must combine the authorization fix, consistent license identity, and a passing target Harness runtime oracle.

Pet remains excluded. Version `0.1.11` historically registers exact `/api/pet/*` routes that bypass Host, Origin, and pairing checks through the public tunnel. Exact `0.2.6` and `0.2.7` add static server-side authorization to every inspected API, asset, runtime, and decoration route, but both fail manifest and packaged LICENSE identity before unpaired/revoked negative controls or runtime validation. One exact artifact must combine the authorization fix, consistent license identity, and a passing target Harness runtime oracle.

Fusion excludes Skin Center. Published releases `0.1.12` through `0.2.7` declare Apache-2.0 in their manifests but package a BSD-3-Clause LICENSE; `0.1.11` has consistent BSD-3-Clause identity but registers `web-ui.plugin.item`, which the rc.5 Settings page does not render. Skin Center can re-enter consideration only when a published artifact has consistent license identity and its Settings controls are visible through the target Harness slots.

The right-side Files, editor, terminal, and Source Control workbench remains a phase 2 external blocker. `dsh-better-sidebar@0.15.0` lets a user enable eight model-visible `terminal_*` tools. They register through `ctx.tools` and enter the generic ToolRuntime pre-execute chain, but the package supplies no approval decision or immutable deployment lock; model commands reach `nodePty.spawn` with ambient `process.env` outside Harness confinement and environment scrubbing. Fusion does not mount better-sidebar, and isolating its settings service is not an accepted substitute because every sidebar setting write fails.

The repository-shipped `apps/cli/config/agent-presets/liangshen/` directory solely owns the Liangshen preset used by Web and TUI and retains `@linxin666/dsh-liangshen@0.2.4` as its source lock. Exact `0.2.6` and `0.2.7` retain the unconfined Windows shell path and cannot replace the repository adaptation. `@deepseek-harness-tui/dsh-tui@0.7.1` solely owns the terminal presentation in the validated source composition, while the profile owns its host `code-runtime` row. The 19-release TUI series has two post-cutoff versions, `0.8.7` and `0.8.8`; each exact tarball contains eight Liangshen files and actively synchronizes a second owner without a supported opt-out. Version `0.7.1` remains the source-runtime selection, and the new candidates' PTY runtime is `NOT RUN`. This source-validation result does not restore the first-party package removed by the [TUI package decision](../simplification/2026-08-04-remove-tui-package.md) or make Fusion TUI publicly deliverable.

## Delivery status

The selected Web profile has zero external rows. Its checked-in REAL composition lane boots `base -> web-app -> fusion` through system Chrome CDP `9333` and passes 1/1. The complete Web oracle passes 196/196, and all three negative controls block at 195/196 with exit 1. It confirms that ModLens, SSH, Remote Web UI, Task Board, Pet, Git Graph, Skin Center, and Better Sidebar contribute no Host row, browser entry, client resource, UI root, route, or tool. The stock Web interface remains visible, console, page, network, process, port, target, and temporary-directory cleanup remain clean, compaction shadows seven items and 401 tokens, projected message tokens fall from 448 to 155, and restart retains 155. Its independent review records `EVIDENCE PASS / RUNTIME PASS`. The historical three-row 1/1 gate and 174/174 complete oracle remain superseded by the ModLens, SSH, and Remote Web UI lifecycle reviews. The historical four-row and six-row evidence remains superseded by the Task Board lifecycle and Pet/Git Graph authorization findings.

Fusion TUI runtime and delivery have separate verdicts. A source-validation profile with 41 rc.5 Harness packages passes fresh and resumed PTY checks, durable replay, supported exit, and process cleanup. The historical public-install attempt found 23 missing packages in the direct subset it queried; the fresh complete query finds exact rc.5 for 0/41 packages in the historical source closure. Exact TUI `0.8.7` and `0.8.8` each declare 24 non-rc.5 DSH peers, have zero root and 15 packaged `workspace:*` values, and fail single Liangshen ownership and public closure before installation. Their install and PTY checks are `NOT RUN`, and Fusion TUI remains phase 2 BLOCKED for public delivery.

## Revalidation

The affected profile must rerun license-identity checks and the complete runtime oracle when the Harness version, an external package version or tarball, the declared peer baseline, the resolved React or native dependency graph, a Fusion patch row, a profile build approval, or the owning Liangshen preset changes. Revalidation selects the highest exact version whose manifest and packaged authorization text agree and whose runtime oracle, including quiescent disposal and disconnect remounting, passes; a peer-range change alone neither proves nor disproves runtime compatibility. Public delivery also requires every package in the validated dependency closure to be available from a supported public source.

Web revalidation includes `pnpm run test:fusion:acceptance`, isolated exact installation for any proposed candidate, config dump and boot, same-Context unload/remount, open-resource disposal, the complete assembled Web oracle through system Chrome CDP port `9333`, and clean console, page, network, and slot diagnostics. TUI public delivery can be reconsidered after a consistent public rc.5 closure is available or a new Harness baseline is explicitly approved; either path requires exact installation, lock inspection, config dump, fresh and resumed real PTY message round trips, durable session events, supported exit, process cleanup, and verified public commands.

Git Graph and Pet each require one exact artifact to retain their `0.2.6`/`0.2.7` static server-side authorization, have consistent manifest and packaged license identity, and pass live unpaired/revoked negative controls plus the complete runtime oracle. Skin Center additionally requires a Settings slot supported by the target Harness release. The right-side workbench additionally requires a package-owned approval decision or immutable deployment policy that hides or disables the `agentTerminalTools` control, rejects persisted or API attempts to enable it, prevents `terminal_*` registration, and preserves both settings persistence and UI Terminal execution. Its oracle inspects the model tool catalog before and after a rejected settings write and exercises UI Terminal through Chrome.

Task Board additionally requires complete effect/disposer ownership, remounting after its container disconnects, consistent manifest and packaged LICENSE identity, and rc.5 runtime support in one published artifact. Its oracle unloads and remounts the row and AppFrame on one page and verifies one connected root with no observer, listener, timer, or subscription growth.

ModLens additionally requires every registered route disposer to belong to its plugin fiber. SSH additionally requires disposal to close and await every accepted WebSocket, SSH client, channel, and shell session. Remote Web UI additionally requires plugin-level closure of open pairing and mobile SSE streams, awaited tunnel and update processes, disposed client subscriptions, and removal of every plugin-created React root.

## Verification

The `verify-cordis-config` unit coverage pins the exact-version, row-correspondence, unused-entry, and standard-dependency exclusion rules. The Fusion package test pins empty profile dependency metadata, absence of third-party dependency entries, the empty patch, all eight blocker exclusions, and Loader resolution through a real profile composition.

Package-specific lifecycle audits cover all published ModLens, SSH, and Remote Web UI candidates. The checked-in REAL composition lane pins system Chrome CDP `9333`, a fixture with no external dependencies or build approvals, zero external Host rows and browser entries, no external client resources, UI roots, routes, or tools, stock Web visibility, process cleanup, and default-suite isolation. The complete zero-row Web oracle passes 196/196, its three negative controls block as intended, and its independent review records `EVIDENCE PASS / RUNTIME PASS`; the historical three-row complete oracle does not satisfy this current verification.

The source-validation Fusion TUI profile pins `dsh-tui@0.7.1`, the repository Liangshen preset, the profile-owned worker-thread code runtime, and 41 rc.5 Harness packages. Terminal rendering, a complete message and tool round trip, durable event replay in a second PTY, clean supported exits, and process cleanup pass. Its upstream DSH and React peer warnings remain recorded drift because the exercised runtime paths complete. This evidence does not satisfy public delivery: 23 was the historical direct-install subset, while the fresh complete query finds exact rc.5 for 0/41 packages. Exact `0.8.7` and `0.8.8` stop at static ownership and closure failures, so their runtime remains `NOT RUN`.

## Alternatives considered

**Declare third-party packages in the Fusion bundle's dependency sections.** Rejected because installation would move from the selecting profile to the bundle or repository graph, native build approvals would lose their profile owner, and the root would carry dependencies unused by other profiles.

**Add Fusion and Fusion TUI to `PROFILE_TEMPLATES`.** Rejected because built-in templates auto-initialize and are installation-owned. Fusion combines independently released packages and requires explicit exact installs, lockfiles, peer providers, and build approvals that the user must review and retain together. Fusion TUI additionally lacks a supported public package closure, so a template would advertise an installation that cannot reproduce the validated runtime.

**Mount an aggregate Web UI bundle.** Rejected because the aggregate also carries duplicate capability rows. Direct retained subpackages make remote access and the other selected UI features explicit without reintroducing `aionui-panel`.

**Use newer Web UI artifacts with conflicting license identity.** Rejected because manifest metadata and the packaged LICENSE identify different licenses in published releases `0.1.12` through `0.2.7`. Runtime success does not resolve that distribution ambiguity.

**Retain the last visible ModLens, SSH, or Remote Web UI rows.** Rejected because first-load capability evidence does not satisfy lifecycle admission. Their leaked routes, active sessions, SSE streams, subprocesses, subscriptions, or roots can outlive the owning plugin fiber; a bundle shim or historical runtime count cannot waive that failure.

**Retain Git Graph `0.1.11`.** Rejected because its `/git/*` routes bypass live pairing and revocation on the Remote Web UI public tunnel and can read or mutate the shared workspace branch. A bundle-side wrapper would be a compatibility shim and cannot reliably authorize routes already registered by the external package.

**Retain Pet `0.1.11` or select a newer fenced release.** Rejected because `0.1.11` exposes exact `/api/pet/*` routes outside Host, Origin, and pairing checks, while newer fenced releases have conflicting manifest and packaged LICENSE identities.

**Retain Task Board `0.1.11` or add a bundle-side lifecycle shim.** Rejected because `0.1.11` leaves its complete UI disposer and top-level subscription outside Cordis effects and does not remount after its container disconnects. A bundle shim or AppFrame-specific host contract would move external package lifecycle ownership into the repository without producing a published artifact that also satisfies license identity and rc.5 runtime support.

**Isolate better-sidebar from the settings service.** Rejected because isolation prevents model terminal tools from registering but leaves an enabled-looking control and makes every sidebar setting write fail. Removing the package preserves the security rule without presenting a broken settings experience as a completed workbench.

**Add compatibility shims or change core packages for an external release.** Rejected because a shim can hide a real package incompatibility and makes core behavior depend on an optional profile. A version that fails installation, composition, startup, or capability observation remains unselected.

**Use declared peer ranges as the compatibility verdict.** Rejected because prerelease peer declarations do not establish runtime failure, and both accepted Web and TUI packages have exercised paths outside their declared Harness or React baselines. The runtime oracle records the drift and tests the behavior.

**Publish a TUI recipe that resolves a mixed Harness graph.** Rejected because a registry installation that selects rc.6 or rc.8 packages does not reproduce the validated rc.5 runtime and violates the fixed baseline.

**Keep duplicate implementations as fallbacks.** Rejected because duplicate tools, workbenches, remote access, or presets make selection and lifecycle order part of behavior. One owner per capability makes absence and reintroduction mechanically reviewable.

## Consequences

Fusion Web has a reproducible zero-row external integration layer without adding third-party trees or native build approvals to the profile or repository root. The package remains a publishable ESM bundle with its patch export and invariant companion, so a future accepted row can enter through the same reviewed composition point.

Users assembling the non-built-in Web profile preserve its manifest, minimal lockfile, and workspace settings together. Fusion does not provide ModLens, SSH, Remote Web UI, Task Board, Git Graph, Pet, Skin Center, the right-side Files, editor, terminal, and Source Control workbench, or a publicly installable TUI profile while their external blockers remain. Every relevant Harness, package, dependency-graph, patch, approval, or preset change incurs license review, isolated installation, lifecycle and security review, and empirical Web or TUI revalidation; the evidence proves the tested platform and paths, not general cross-platform compatibility.

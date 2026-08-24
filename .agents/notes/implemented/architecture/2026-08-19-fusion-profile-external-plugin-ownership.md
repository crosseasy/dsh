# Agent Note: Fusion profile external-plugin ownership

Status: implemented

English | [中文](2026-08-19-fusion-profile-external-plugin-ownership.zh.md)

## Problem

Fusion combines packages that release independently from DeepSeek Harness. Declared peer ranges can lag or lead the Harness release, while installation or a successful boot alone does not prove that the intended capability works, enforces authorization, releases its resources, or remounts cleanly.

Putting external packages in the Fusion bundle's standard dependency sections would move installation ownership into the repository or Harness distribution. Aggregate packages can also reintroduce duplicate tools, workbenches, remote access, or Liangshen presets, obscuring both capability ownership and the profile inputs that reproduce an installation.

## Decision

Fusion evaluates Web candidates in this order: artifact identity and integrity, license identity, security, single-owner requirements, dependency closure, exact isolated installation, profile composition, actual boot, target capability and diagnostics, complete resource ownership with quiescent disposal, then disconnect remounting. TUI candidates follow artifact identity and integrity, license identity, single Liangshen ownership, security, supported public dependency closure, exact isolated installation, profile composition, then PTY runtime. The first failure blocks the candidate and leaves every later check `NOT RUN`. A peer-range mismatch is recorded as drift, but the resolved lock must not raise DSH above the approved Harness baseline. Compatibility shims and core-package changes cannot waive an external package failure.

`@deepseek-ai/dsh-fusion` carries no third-party package in a standard dependency section. Its `dsh.bundle.profileDependencies` contains exact `@linxin666/dsh-pet@0.2.9`, and its patch contributes only the `pet` row. Each assembled profile owns its manifest, lockfile, pnpm workspace settings, peer providers, and build approvals. The Web order is `@deepseek-ai/dsh-base` -> `@deepseek-ai/dsh-web-app` -> `@deepseek-ai/dsh-fusion`; Fusion is not a `PROFILE_TEMPLATES` entry, so users assemble it explicitly.

Pet admission requires server-side authorization for the exact API GET routes `state`, `pets`, and `diagnostics` and for the asset, runtime, and decoration handler families. Non-loopback unpaired and revoked requests return 403 before Pet service or asset access; paired and loopback requests are allowed. Disposing the row fiber removes every registered route, and remounting on the same Context does not duplicate routes.

The repository preset remains the sole Liangshen owner for Web and TUI. A source-validation TUI runtime and a publicly installable TUI profile are separate verdicts: source execution cannot establish public delivery when the required dependency closure is unavailable or a candidate installs a second Liangshen owner. This decision does not restore the first-party package removed by the [TUI package decision](../simplification/2026-08-04-remove-tui-package.md).

This decision specializes the installation and ordering model in [profile plugin bundles](2026-08-05-profile-plugin-bundles.md) and uses the external-plugin distribution path retained by [removing the repository Plugin path](../simplification/2026-08-09-remove-repository-plugin.md).

## Capability ownership

- **Pet:** exact `0.2.9` is the sole admitted external Web capability while its license, authorization, lifecycle, profile, and assembled-runtime checks continue to pass.
- **Git Graph `0.2.9`:** the first stable failure is that an active JSON operation and its Git child process outlive row-fiber disposal. Re-entry requires row disposal to reject new work, cancel and await all active JSON and SSE operations and their complete process trees within a bounded deadline, then pass in-flight unload and same-Context remount checks.
- **ModLens `3.24.0`:** the first stable failure is that cross-site `POST /modlens/paste` accepts a request rejected by `/modlens/config` and writes the supplied bytes. Re-entry requires every mutating route to enforce the applicable request-trust policy and every route disposer to belong to the plugin fiber.
- **SSH `0.2.9`:** the first stable failure is that an accepted standalone terminal session remains outside plugin disposal. Re-entry requires disposal to close and await every accepted WebSocket, SSH client, channel, and shell session.
- **Remote Web UI `0.2.9`:** the first stable failure is that `requirePairingForLan:false` disables live authorization for `/remote` HTTP and WebSocket handlers. Re-entry requires live device authorization to be non-disableable and plugin disposal to close streams, processes, subscriptions, and roots.
- **Task Board `0.2.9`:** the first stable failure is that the client drops the top-level settings subscription disposer. Re-entry requires one published artifact with consistent license identity, complete effect/disposer ownership, same-page unload and remount behavior, and target-Harness runtime support.
- **Skin Center `0.2.9`:** the first stable failure is inconsistent manifest and packaged LICENSE identity. Re-entry requires a license-consistent published artifact whose Settings controls are visible on the target Harness release.
- **Better Sidebar `0.15.2`:** the first stable failure is the absence of a supported public rc.5 dependency closure. Re-entry requires a supported public closure and a package-owned immutable policy that prevents model terminal-tool registration while preserving settings persistence and UI Terminal behavior.

Aggregate Web UI rows, Describe Image, AionUI Panel, and other unselected identities do not enter Fusion as fallbacks.

Source validation of TUI `0.7.1` proves only the tested source-built rc.5 runtime; no supported public source reconstructs that closure, so it does not establish public delivery. The current audited TUI candidate `0.9.0` first fails single Liangshen ownership because it installs a second owner without a supported opt-out; security, public closure, installation, composition, and PTY remain `NOT RUN`. Public re-entry requires one Liangshen owner, a supported public closure for the approved Harness baseline, exact installation and lock inspection, fresh and resumed real PTY message round trips, durable events, supported exit, process cleanup, and verified public commands.

## Verification levels

- Package and configuration checks pin exact Pet `0.2.9`, the sole `pet` row, its absence from standard dependency sections, `base -> web-app -> fusion` ordering, profile-local installation inputs, and the absence of all seven blockers and duplicate owners.
- Direct checks load the profile-installed Pet `lib/index.js` through its real `apply` export. They verify the registered route set; four-state authorization for the exact `state`, `pets`, and `diagnostics` GET routes and the asset, runtime, and decoration GET handler families; and the five mutating POST routes `interact`, `set-visible`, `set-config`, `set-name`, and `set-pet`. Non-loopback unpaired and revoked requests must return 403 before service access, asset access, or mutation; paired and loopback requests must reach the handler.
- Row-fiber disposal removes every route, and same-Context remount followed by disposal leaves no duplicate or retained route.
- Private-copy mutations remove the API-state guard, the `pets` guard, the `diagnostics` guard, the asset guard, the shared POST guard, and the route disposer independently. Each mutation must fail through the real registration path; only a complete private package copy may be changed, and the installed entry hash must remain unchanged on success, failure, or cancellation.
- The assembled acceptance uses system Google Chrome CDP `9333`, boots the exact one-row profile, verifies one Pet browser entry and root with live state, confirms the absence of blocked rows and external model tools, applies the layered baseline and root-response oracle, and requires clean console, page, network, process, port, target, and temporary-directory cleanup. Default unit and coverage suites remain offline.
- Within each profile, every blocked `GET` response must equal that profile's own `GET /` in status, original body bytes, and the normalized ordered multimap of all headers except the per-request connection and framing fields `connection`, `content-length`, `date`, `keep-alive`, and `transfer-encoding`. Every non-fallback response must remain equal across the independently booted `base + web-app` and Fusion profiles.
- Each root response must contain exactly one parseable `window.__DSH_BOOT__` assignment. Baseline contains no Pet entry, Fusion adds exactly one valid Pet entry, and each graph revision derives from that graph's complete ordered entries. Removing the Pet entry from Fusion and recomputing the revision from the remaining complete ordered entries must make the complete Fusion HTML equal baseline byte for byte. Any additional client entry, shared-entry field or order drift, invalid graph revision, body difference outside the boot script, mounted JSON, redirect, stock-title route-owned HTML, 404, or 405 control response must fail.

## Coverage and gaps

- The required checked-in acceptance covers one-row composition, Pet authorization and lifecycle, the response oracle, browser diagnostics and cleanup, the complete conversation, tool-card, session-list, fork, resume, compact, export, Search, Settings, and model-selection workflow, fresh Web and headless profile isolation, a real headless turn, built ACP stdio, and resolved ACP Loader composition. This coverage uses tracked inputs and does not depend on an ignored local driver.
- Web evidence does not establish TUI behavior.
- A first-failure stop deliberately leaves each blocked candidate's later checks unexecuted; `NOT RUN` is not a pass.
- Current evidence is limited to its tested versions, platform, and paths and does not establish general cross-platform compatibility.

## Revalidation

Any Harness version, external artifact or tarball, declared peer baseline, resolved React or native dependency graph, Fusion row, profile build approval, or Liangshen-owner change restarts validation at artifact identity. Pet reruns the complete Pet and assembled-Web verification contract. A blocked capability must first satisfy its named re-entry condition, then run every remaining admission stage. No historical result carries across changed inputs.

## Alternatives considered

**Declare third-party packages in the Fusion bundle's dependency sections.** Rejected because installation, lock, peer-provider, and native-build ownership belongs to the selecting profile, and repository-root consumers should not receive unused external trees.

**Add Fusion or Fusion TUI to `PROFILE_TEMPLATES`.** Rejected because built-in templates are installation-owned and auto-initialize. Fusion requires explicit review of exact external inputs, and TUI has no reproducible public package closure.

**Mount an aggregate Web UI bundle or keep duplicate fallbacks.** Rejected because aggregate rows reintroduce blocked or competing capability owners and make selection and lifecycle order observable behavior.

**Use declared peer ranges as the compatibility verdict.** Rejected because prerelease peer declarations neither prove nor disprove behavior on the fixed Harness baseline.

**Add bundle shims or change core packages for an external release.** Rejected because that transfers external authorization or lifecycle ownership into the repository and conceals a package defect.

**Publish a TUI recipe over a mixed Harness graph.** Rejected because resolving later release-candidate packages does not reproduce the validated rc.5 source runtime.

## Consequences

Fusion Web provides one explicit external capability without adding third-party dependency trees or native build approvals to the repository root. Users must preserve the profile manifest, lockfile, workspace settings, peers, and approvals together.

Blocked capabilities remain absent until a published candidate satisfies its complete admission sequence. Revalidation costs include license, security, lifecycle, installation, and real Web or TUI execution; the resulting evidence applies only to the tested versions, platform, and paths.

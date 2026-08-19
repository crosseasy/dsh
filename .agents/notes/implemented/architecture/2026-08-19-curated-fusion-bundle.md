# Agent Note: Curated fusion bundle composes exact external plugins

Status: implemented

English | [中文](2026-08-19-curated-fusion-bundle.zh.md)

## Problem

The verified external Web plugins ship as independently installable bundles, while `@linxin666/dsh-web-ui-all` also aggregates them with duplicate image handling, a deprecated panel, unrelated plugin-management rows, and a different `dsh-better-sidebar` version. Applying both the aggregate and standalone bundles would mount duplicate Cordis rows, and allowing each dependency to contribute its own profile layer would leave composition order and deduplication outside one owner.

The TUI and Desktop are separate hosts with their own rows and lifecycle responsibilities. Treating them as contents of the same Web bundle would couple terminal or Electron startup to a patch whose purpose is only to select Web-capable external plugins.

## Decision

`@deepseek-ai/dsh-fusion` is a thin meta-bundle over `dsh-web-app`. It declares a data-only `dsh.bundle.patch`, has no runtime API or coordination plugin, and directly inserts the selected standalone rows under the explicit-layer rules of the [profile plugin bundle decision](2026-08-05-profile-plugin-bundles.md).

The manifest pins one exact runtime dependency for every inserted package. The patch row names and dependency keys form the same set, so the fusion package is the single composition owner and none of those dependencies is also applied as a profile bundle.

Deduplication selects `@liustack/modlens` as the image-understanding implementation and `dsh-better-sidebar` as the right-side workbench. The patch omits `@linxin666/dsh-web-ui-all`, both describe-image rows, the deprecated AionUI panel rows, `@linxin666/dsh-skins`, and all Liangshen runtime rows. It mounts only the independently verified settings, task-board, Git-graph, remote-Web, SSH, pet, and skin-center packages.

Install-script approval covers only scripts present in the selected dependency closure. `cloudflared`, `cpu-features`, and `ssh2` are approved for the remote-Web and SSH packages. `node-pty@1.2.0-beta.15` remains the core subprocess backend dependency, while `node-pty@1.1.0` is approved separately for the `dsh-better-sidebar@0.13.1` closure; an unversioned `node-pty` approval is not part of the policy.

The TUI remains a separate profile bundle over `dsh-base` because it replaces core rows and owns terminal startup. Desktop remains an external Electron host that selects a Web-capable profile and applies its own shell patch afterward; fusion neither embeds nor disables Desktop lifecycle rows. The Liangshen system preset is a separate decision, and this bundle neither installs nor synchronizes it.

## Alternatives considered

**Use `@linxin666/dsh-web-ui-all`.** Rejected because it installs and mounts non-selected features, duplicates the chosen image and sidebar implementations, and pins a different sidebar dependency. Disabling rows after installing the aggregate would retain the larger dependency closure and two composition owners.

**List every external package as a profile bundle.** Rejected because each dependency would apply its own patch in addition to fusion's curated rows. A single fusion patch keeps row ids, order, exclusions, and exact dependencies reviewable together.

**Add runtime glue to fusion.** Rejected because the selected plugins already own their Host and Client behavior. Coordination code would create a second runtime API without a behavior that the patch format cannot express.

**Combine Web, TUI, Desktop, and Liangshen in one bundle.** Rejected because their startup mechanisms and ownership differ: TUI replaces terminal composition, Desktop supplies an Electron shell after profile selection, and Liangshen is preset content rather than a retained Web row.

## Consequences

The fusion package has one small responsibility: publish an exact dependency set and its corresponding Cordis rows. Version changes require updating the dependency and row evidence together and repeating installation, Loader, and browser verification.

The dependency closure may run only the explicitly approved lifecycle scripts. A new transitive script or `node-pty` version fails installation until reviewed and added with the narrowest applicable package selector.

Web composition gains the selected external features without duplicate image, panel, skin-carrier, sidebar, or Liangshen rows. TUI and Desktop keep independent integration and release verification, and the separate Liangshen decision can establish preset ownership without changing the fusion bundle.

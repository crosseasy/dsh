# `@deepseek-ai/dsh-curated-profiles`

English | [中文](README.zh.md)

`@deepseek-ai/dsh-curated-profiles` defines deterministic curated profile templates and materializes them into a DSH home. It creates only `profiles/<curated-name>/package.json`, `cordis.patch.yml`, `pnpm-workspace.yaml`, and `.npmrc`; existing files are preserved byte-for-byte after curated policy validation succeeds.

The package does not change the shipped `web` or `headless` profile templates. Curated profiles layer `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `@deepseek-ai/dsh-curated-base` before any admitted third-party bundle names.

## API

- `CURATED_PROFILE_TEMPLATES` maps `web-curated`, `web-coding`, `web-research`, `web-enterprise`, and `web-personal` to ordered bundle lists.
- `materializeCuratedProfile(profileName, home, options)` writes the selected profile under `home` and returns the profile directory; `options.userLayer: false` skips existing user-patch parsing for a bundles-only recovery diagnostic.
- `materializeCuratedProfileForLoad(profileName, home, options)` materializes the profile and returns descriptor-bound managed-file bytes that the caller must close after loading and admission.
- `generatedCuratedProfileFiles(profileName)` returns the complete generated managed-file bytes for transaction staging without writing the live profile.
- `openExistingCuratedProfileFiles(profileName, home, dir, options)` validates and retains an existing profile without creating or changing files.
- `assertCuratedProfileAdmission(profileName, profile, additionalUserLayers, options)` enforces the template, catalog assignment, package-manager, and user-layer rules before config dump or Loader activation.

Materialization validates all existing managed inputs before publishing missing files, retains each new file in the same descriptor snapshot, accepts a concurrently published file only when its bytes match, and removes files created by the current call in reverse order if a later publication or identity check fails. Materialization and admission use curated-policy's current-profile completeness predicate before adding a selected dependency; focused unit tests validate template and dependency consistency, while the repository `verify-curated-activation-evidence` gate checks catalog-to-template relationships. The package invariant is an explained empty installer because fixed templates expose no runtime relationship to observe.

## Scenario policy

The intended `web-curated` baseline has 12 candidates. Six have static/install qualification evidence, but none has a keyless assembled runnable snapshot of its pinned artifact, so the runtime-active count is zero. Web search also lacks its required `@anweat/dsh-browser` bundle/runtime dependency. All five templates contain only the three installation-owned foundation bundles.

The profile patch is empty while no third-party candidate is active. Candidate-specific safety settings remain in the catalog for future admission. Every profile writes `ignore-scripts=true`, and generated workspaces contain no build grant, `patchedDependencies`, or `packageExtensions`.

## Model Experience

### Profile file materialization

#### What the model sees

`materializeCuratedProfile()` writes profile files only. It contributes no prompt text, tool schema, user message, assistant-visible result, or session event; profile boot owns any model-visible behavior from the selected bundles.

#### Token effect

Zero direct token cost from `@deepseek-ai/dsh-curated-profiles`.

#### KV Cache effect

No direct cache effect; cache stability depends on the bundle rows loaded when the materialized profile is launched.

## Known Limitations and Deferred Work

- **Candidate installation and runtime evidence are external**: materialization includes no third-party bundle until `runtimeActivationEvidence` has exactly the candidate's target-profile keys and each selected profile has a complete keyless assembled snapshot plus retained install, enable, restart, and disable-or-uninstall evidence. Every required runtime bundle must also be selected from another active same-profile candidate with complete evidence for that profile, and both candidates enter profile dependencies. E3/E4, browser behavior, A/B results, fault recovery, and canary completion remain pending.
- **Existing files are validated, not rewritten**: `package.json`, `cordis.patch.yml`, `pnpm-workspace.yaml`, and `.npmrc` must be ordinary files rather than symlinks, junctions, or other file types. Materialization opens existing files with `O_NOFOLLOW` where available, requires matching nonzero device/inode identities across `lstat` and `fstat`, reads and validates bytes from that descriptor, and checks descriptor, file path, and profile-directory identity before and after the read. The CLI retains one snapshot across initial generic profile loading and curated admission, uses its identity assertion immediately before and after every shared `profiles/node_modules` fallback mutation, and then creates and closes a fresh snapshot for every live recomposition; each snapshot supplies the profile-patch bytes and is rechecked before return. Replacement of a managed file or its profile-directory ancestor therefore fails closed without reading an external symlink target. Missing files are written through descriptor-checked random temporary files while the directory snapshot remains open, then published with an exclusive hard link. The generated `cordis.yml` is likewise written to a checked random sibling, atomically renamed over the root config, and followed by another snapshot check. If an ancestor points to an unrelated replacement target at publication, that target lacks the random temporary source, so publication fails without sending root-config content there. Node exposes no cross-platform descriptor-relative equivalents of `openat`, `linkat`, `renameat`, and `unlinkat`: between the final directory identity check and a path-based `linkSync` or `renameSync`, a process with the same filesystem permissions can move the already-open original directory outside the DSH home and point the original path back to that same inode. In that case, publication can place the complete temporary file under its managed filename in the moved original directory before the following identity check fails closed. Callers must exclusively manage the DSH home during materialization and initial CLI preparation. The temporary descriptor always closes; if initial identity acquisition fails, cleanup removes the still-reachable random path without attempting identity-based unlink, while later cleanup verifies the acquired identity before `unlink`. An unreachable random temporary file may remain in a moved original directory, and the identity check plus `unlink` is not an atomic compare-and-unlink against same-permission replacement. Existing `.npmrc` bytes must equal `ignore-scripts=true`; manifest `pnpm` fields, template drift, build grants, dependency patching, package extensions, and pnpmfile hooks reject. Enterprise validates governed plugin settings on the effective composition. Safe existing files remain byte-for-byte unchanged.
- **Boot admission is mandatory**: `dsh` startup and config dump require exact template-order bundles and catalog assignments, retain installation-first bundle resolution, and reject dynamic expressions or unapproved plugin/group insertions from profile, home, and command-line patches. Enterprise restrictions apply again after every static composition and live user-patch reload. A bundles-only recovery diagnostic uses `userLayer: false`, so it still validates the manifest and package-manager state without parsing the profile patch. The separate observed preflight continues to own artifact-tree and lockfile verification.
- **No generic network enforcement**: profile output includes only candidate-supported controls recorded in the catalog. A candidate that lacks configuration required by the approved policy remains inactive; deployment-owned network restrictions are outside this package.
- **Scenario split is static**: `web-personal` currently contains only the shared profile shell because no personal-only candidate has passed admission; coding, research, and enterprise additions are fixed in the checked-in templates.

# `@deepseek-ai/dsh-curated-profiles`

English | [中文](README.zh.md)

`@deepseek-ai/dsh-curated-profiles` defines deterministic curated profile templates and materializes them into a DSH home. It creates only `profiles/<curated-name>/package.json`, `cordis.patch.yml`, `pnpm-workspace.yaml`, and `.npmrc`; existing files are preserved byte-for-byte.

The package does not change the shipped `web` or `headless` profile templates. Curated profiles layer `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `@deepseek-ai/dsh-curated-base` before any admitted third-party bundle names.

## API

- `CURATED_PROFILE_TEMPLATES` maps `web-curated`, `web-coding`, `web-research`, `web-enterprise`, and `web-personal` to ordered bundle lists.
- `materializeCuratedProfile(profileName, home)` writes the selected profile under `home` and returns the profile directory.

## Scenario policy

The intended `web-curated` baseline has 12 candidates; its current admissible active baseline has ten. `dsh-context` is rejected for missing Node compatibility evidence, and `dsh-config-manager` is rejected because its artifact exposes no profile-level dry-run or execution-confirmation control. `web-coding` and `web-enterprise` use the same ten-candidate baseline. `web-research` materializes that baseline plus the admitted `plugin-session-export` scenario candidate; mneme and vision routing remain inactive research candidates. `web-personal` contains only the three installation-owned foundation bundles.

The profile patch explicitly configures memento with approval-gated writes and automatic proposals disabled, permission rules with invalid-rule-file failure and enforcement enabled, and LoongSuite with content capture disabled. Preflight rejects weaker values. Permission decisions remain delegated to the permission plugin. `web-enterprise` writes `ignore-scripts=true`; if an existing enterprise `.npmrc` has any other effective value, materialization fails before writing profile files.

## Model Experience

### Profile file materialization

#### What the model sees

`materializeCuratedProfile()` writes profile files only. It contributes no prompt text, tool schema, user message, assistant-visible result, or session event; profile boot owns any model-visible behavior from the selected bundles.

#### Token effect

Zero direct token cost from `@deepseek-ai/dsh-curated-profiles`.

#### KV Cache effect

No direct cache effect; cache stability depends on the bundle rows loaded when the materialized profile is launched.

## Known Limitations and Deferred Work

- **Candidate installation and runtime evidence are external**: materialization records bundle names but does not install or exercise third-party packages. The curated scripts inspect a caller-supplied installed profile and fail when an artifact cannot be resolved; generated profile files do not prove installation, browser behavior, A/B results, fault recovery, or canary completion.
- **Existing profile files win with one enterprise exception**: rerunning materialization preserves existing files, but an existing `web-enterprise/.npmrc` must keep `ignore-scripts=true`.
- **Scenario split is static**: `web-personal` currently contains only the shared profile shell because no personal-only candidate has passed admission; coding, research, and enterprise additions are fixed in the checked-in templates.

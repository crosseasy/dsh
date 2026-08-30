# Agent Note: npm access is owned by package manifests

Status: implemented

English | [中文](2026-08-13-public-vendor-and-native-sequences.zh.md)

## Problem

Packages in the `@deepseek-ai` scope do not inherit one access level from the scope or their release family. Leaving access implicit or setting it only in a publication command makes a package's availability depend on operator state rather than the manifest reviewed with its dependency graph.

A restricted dependency blocks an otherwise public consumer. Harness packages declare the vendored framework as peer dependencies, `dsh-sandbox-local` declares the Landlock entry as a dependency, and `@deepseek-ai/dsh` installs both curated and ordinary dsh packages. Anonymous installation therefore requires every direct and transitive package in that closure to be public; publishing only the CLI or only its curated dependencies does not suffice.

## Decision

Access is a property of each package manifest, not of the npm scope, release sequence, or version:

| Sequence | Members | `publishConfig.access` |
|---|---|---|
| vendored framework | the nine `vendor/*` packages | `public` |
| native | the three `native/landlock-run/packages/*` packages | `public` |
| dsh | all 234 non-experimental `packages/*/*` and `apps/*` members, including the five curated packages | `public` |

`packages/experimental/*` is not part of the dsh release family; those packages remain private and omit `publishConfig`. `check-workspace-constraints.ts` requires every release member to be publishable and public, so a newly selected dsh, vendored, or native package cannot silently retain restricted access.

**No publish path passes `--access`.** A command-line option overrides the manifest that owns the fact, so `publish.ts` passes none and the native workflow passes none. Each packed manifest decides, and a future package-specific exception must change that manifest and the corresponding workspace constraint explicitly.

Harness consumers reference the Landlock entry as `workspace:^` rather than `workspace:*`, so a published harness package accepts the entry's patch and minor releases instead of pinning one exact version. The entry keeps `workspace:*` for its two platform packages, where the binary must match the entry version exactly.

`@deepseek-ai/dsh` and all of its current direct and transitive workspace dependencies declare public access. The dsh publish order places curated policy and benchmark assets before their consumers, places `curated-base` and `curated-profiles` before the CLI, and publishes `curated-scripts` after the CLI dependency it executes. A complete dsh publication is therefore anonymously installable without resolving a private workspace package.

## Alternatives considered

**Keep the dsh family restricted while publishing only curated, vendored, and native dependencies publicly.** Rejected because `@deepseek-ai/dsh` also depends on many non-curated dsh packages. A public CLI with any restricted direct or transitive dependency is not anonymously installable, while a restricted CLI exposes no public installation path for the curated integration it carries.

**Keep everything restricted and grant a read-only team instead.** `npm access grant read-only <org:team> <package>` is per-package with no scope wildcard, so covering the set means one grant per package plus a standing reconciliation job for every package added afterwards. It also only reaches organization members, which does not serve an installable public artifact.

**Publish public from the publish path instead of the manifests.** Rejected because it would override the manifest that the workspace constraint checks and make repository review insufficient to establish a package's access.

## Consequences

- **All 246 current release members publish publicly, and that is not cleanly reversible.** Returning a package to restricted access requires a paid plan plus `npm access set status=private`, and anything already downloaded or mirrored stays out.
- **`@deepseek-ai/dsh` is anonymously installable only while its complete dependency closure remains public.** The release-family and workspace-constraint tests pin the 234-member set, including all five curated packages, and the packed-install probe verifies the assembled closure.
- **Published payload policy carries more weight because every release artifact is world-readable.** dsh packages reject source and declaration maps; `vendor/cordis` publishes `src` deliberately because its export map declares `./src/*`; the Landlock entry publishes `src/main.c` as a documented audit surface.
- **The release sequences do not require the npm private-packages plan.** The `402 Payment Required` failure that blocked the first native publication cannot recur for a public package.
- **Unauthenticated `npm view` is a usable registry check for every release sequence.** A restricted package would instead return `E404` without credentials, which is indistinguishable from an absent version.

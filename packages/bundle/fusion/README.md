---
description: "The fusion profile bundle that adds the admitted Pet external integration after the base and Web application bundles, for users composing or validating fusion profiles."
kind: "package-bundle"
---

# @deepseek-ai/dsh-fusion

English | [中文](README.zh.md)

## Summary

`dsh-fusion` is a static profile bundle for a custom fusion profile: it applies after [`dsh-base`](../base/README.md) and [`dsh-web-app`](../web-app/README.md) and inserts the admitted Pet integration. Users add or remove it through the normal `dsh plugin --profile` bundle flow after the profile already has the base and Web layers. The package records `@linxin666/dsh-pet@0.2.9` in `dsh.bundle.profileDependencies`; it does not make Pet a runtime dependency of this bundle. It is not a library and it does not ship the external Electron application.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Use this package only for a fusion profile that already composes the base and Web application bundles. The bundle activates because its manifest declares `dsh.bundle.patch`; a plain plugin without that declaration would be installed as a dependency but would not contribute a profile layer.

### Install into a profile

```text
dsh plugin --profile <name> add @deepseek-ai/dsh-fusion
dsh plugin --profile <name> remove @deepseek-ai/dsh-fusion
```

The profile must also make `@linxin666/dsh-pet@0.2.9` available as a profile-owned dependency before the Loader resolves the patch row. The manifest records that dependency for profile validation without adding third-party runtime dependencies to `dsh-fusion` itself.

### What you get

The layer inserts one `pet` row from the accepted `@linxin666/dsh-pet` package. The Pet package owns its browser and Host routes; this bundle owns only the admitted row, the exact external package version, and the absence of blocked fusion candidates.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals - click to expand</summary>

The bundle is a static patch document with one insert entry. It mounts no service of its own, emits no events, and carries no mutable runtime state.

### Patch document

[`cordis.patch.yml`](cordis.patch.yml) inserts `{ id: 'pet', name: '@linxin666/dsh-pet' }`. [`package.json`](package.json) declares the patch path and the profile-owned Pet dependency, while keeping `dependencies`, `optionalDependencies`, and `peerDependencies` free of that external runtime package.

### Source map

| File | Role |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | The bundle patch: the accepted Pet row |
| [`src/index.ts`](src/index.ts) | Package entry; carries no runtime API |
| [`src/invariant.ts`](src/invariant.ts) | Invariant companion: no runtime invariant; the package is a static patch-list carrier |
| [`tests/fusion.spec.ts`](tests/fusion.spec.ts) | Manifest, profile-dependency, Loader, and blocked-candidate checks |

### Admission ownership

Repository verification follows the [Fusion external-profile acceptance](../../../docs/testing.md#tiers). The owning [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) records the durable admission and revalidation requirements.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [base bundle](../base/README.md) - shared profile core that must precede this layer.
- [web-app bundle](../web-app/README.md) - browser application layer that must precede this layer.
- [Fusion external plugin Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) - accepted external set and blocked candidates.
- [Testing tiers](../../../docs/testing.md#tiers) - verification tier vocabulary used by fusion admission.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through the inserted Pet row: it adds browser and Host routes but no model-visible tool or prompt.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits describe the current fusion bundle. They are not an admission path for other external packages.

- **The bundle is not a built-in profile template** - consumers assemble `base`, `web-app`, and `fusion` explicitly, then provide the exact profile dependency recorded in the manifest.
- **Only Pet is admitted** - Git Graph `0.2.9` is blocked because an active JSON operation and its child process can outlive row-fiber disposal. Image understanding, SSH, mobile remote UI, Task Board, Skin Center, and the right-side Files, editor, terminal, and Source Control workbench also remain absent.
- **The desktop integration is a consumption contract** - this package does not modify or ship the external Electron application.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers - click to expand</summary>

None.

</details>

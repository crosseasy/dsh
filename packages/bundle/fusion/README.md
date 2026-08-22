# `@deepseek-ai/dsh-fusion`

English | [中文](README.zh.md)

The static patch layer applied after [`dsh-base`](../base/README.md) and [`dsh-web-app`](../web-app/README.md) in a fusion profile. No external package currently satisfies every admission criterion, so [`cordis.patch.yml`](cordis.patch.yml) is empty and the manifest's `dsh.bundle.profileDependencies` is `{}`. This package retains its ESM entry, patch export, and invariant companion without a runtime API or third-party runtime dependency.

Repository acceptance is explicit rather than part of the default test collections: `pnpm run test:fusion:acceptance` builds and boots `base -> web-app -> fusion` through system Chrome CDP `9333`. The gate verifies that Fusion contributes no external Host row, browser entry, client resource, UI root, route, or tool while the stock Web interface remains visible and console, page, network, process, port, target, and temporary-directory cleanup stay clean.

## Model Experience

Indirectly, through no inserted rows: the empty patch adds no model-visible input or tool.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- **The bundle is not a built-in profile template** - consumers assemble `base`, `web-app`, and `fusion` explicitly. The current empty profile dependency map requires no external package, React peer provider, or profile-local build approval.
- **The bundle contributes zero external rows** - image understanding, SSH, mobile remote UI, Task Board, Pet, Git Graph, Skin Center, and the right-side Files, editor, terminal, and Source Control workbench are absent. Consumers must not add candidate packages or patch rows to bypass admission. The owning [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) defines the zero-row decision, package-specific blockers, and revalidation requirements.
- **The desktop integration is a consumption contract** - this package does not modify or ship the external Electron application.

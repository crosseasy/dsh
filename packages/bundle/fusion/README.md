# `@deepseek-ai/dsh-fusion`

English | [中文](README.zh.md)

The static patch layer applied after [`dsh-base`](../base/README.md) and [`dsh-web-app`](../web-app/README.md) in a fusion profile. [`cordis.patch.yml`](cordis.patch.yml) mounts Pet from the exact `0.2.9` package; the manifest's `dsh.bundle.profileDependencies` records that profile-owned dependency without adding third-party runtime dependencies to this bundle.

Repository acceptance is explicit rather than part of the default test collections: `pnpm run test:fusion:acceptance` builds and boots `base -> web-app -> fusion` through system Chrome CDP `9333`. The gate verifies the exact Pet row, Pet capability surface, blocked-package absence, stock Web behavior, clean diagnostics, and process, port, target, and temporary-directory cleanup.

## Model Experience

Indirectly, through the inserted Pet row: it adds browser and Host routes but no model-visible tool or prompt.

#### KV Cache effect

None.

## Known Limitations and Deferred Work

- **The bundle is not a built-in profile template** - consumers assemble `base`, `web-app`, and `fusion` explicitly, then install the exact profile dependencies and React peers documented in the product guide.
- **Only Pet is admitted** - Git Graph `0.2.9` is blocked because an active JSON operation and its child process can outlive row-fiber disposal. Image understanding, SSH, mobile remote UI, Task Board, Skin Center, and the right-side Files, editor, terminal, and Source Control workbench also remain absent. Consumers must not add other candidate packages or patch rows to bypass admission. The owning [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) defines the accepted set, package-specific blockers, and revalidation requirements.
- **The desktop integration is a consumption contract** - this package does not modify or ship the external Electron application.

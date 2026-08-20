# `@deepseek-ai/dsh-fusion`

English | [中文](README.zh.md)

The static patch layer applied after [`dsh-base`](../base/README.md) and [`dsh-web-app`](../web-app/README.md) in a fusion profile. The manifest's `dsh.bundle.profileDependencies` maps every profile-owned bare package referenced by [`cordis.patch.yml`](cordis.patch.yml) to its exact version. This metadata records static ownership only: consumers install those packages into the same profile before boot, and the runtime neither reads the field nor installs packages. A missing package fails boot through normal Loader resolution. This package has no runtime API or third-party runtime dependencies.

## Model Experience

Indirectly, through the rows inserted by the fusion patch; each inserted package owns its model-facing behavior.

#### KV Cache effect

None directly; each inserted package owns its effect.

## Known Limitations and Deferred Work

- **The bundle is not a built-in profile template** - consumers assemble `base`, `web-app`, and `fusion` explicitly and install every package in `dsh.bundle.profileDependencies` into that profile.
- **External versions are profile-owned** - the metadata is not an installation recipe; peer providers and profile-local build approvals remain the consumer's responsibility, and the compatibility matrix must be rerun when dsh or an external package changes.
- **The desktop integration is a consumption contract** - this package does not modify or ship the external Electron application.

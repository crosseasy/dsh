# Agent Note: Remove the unconsumed filesystem no-follow operation

Status: implemented

English | [中文](2026-08-25-remove-unconsumed-filesystem-lstat.zh.md)

## Problem

`FileSystem.lstat` and `FsPathInfo` required every filesystem provider and every test provider to implement path-level metadata that does not follow the final symbolic link. No fixed production consumer called the method. Instruction discovery, its former consumer, deliberately follows symbolic links through `resolve` and `stat`; the [instruction symlink decision](../feature/2026-07-21-follow-instruction-symlinks.md) assigns confinement to filesystem policy and sandboxing instead.

The unused operation also kept local-only `PathLinkInfo`, `pathLinkType`, and `probeNoFollow` code, an E2B projection, dedicated tests, public documentation, type-equivalence entries, and generated Cordis API catalog entries.

## Decision

The filesystem Service Definition exposes target metadata only through `stat(FsTarget, signal?)`. It does not expose a path-level no-follow operation or `FsPathInfo`. The local and E2B providers implement the eleven production operations consumed by the filesystem tools and other plugins.

Node and platform `lstat` calls remain where they protect concrete operations such as atomic publication, persistence checks, cleanup, executable resolution, and filesystem discovery. Those calls are implementation details of their owners and do not restore a generic `ctx.fs` operation.

## Alternatives considered

- **Keep `lstat` for a possible future security consumer.** Rejected because no production consumer defines the required policy, error semantics, or remote behavior. A future caller must establish those requirements before adding a provider obligation.
- **Remove the public operation but retain provider-specific no-follow helpers.** Rejected because the local and E2B helpers had no remaining caller and would preserve code and tests without product behavior.
- **Provide a compatibility alias or optional method.** Rejected because the project is pre-release and optional provider methods would move the same unsupported decision onto consumers.

## Consequences

Filesystem providers and test doubles implement one fewer method, and the public type and generated API catalog no longer advertise unsupported no-follow metadata. Existing filesystem reads, listings, mutations, symlink-following target identity, and independent Node/platform safety checks are unchanged.

The filesystem capability gives up generic final-component symlink inspection. Reintroducing it requires a fixed production consumer and coordinated Service Definition, provider, policy, documentation, and coverage semantics rather than a speculative helper.

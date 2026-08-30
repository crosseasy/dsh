# sdk/ — drive Harness runtimes from another process

English | [中文](README.zh.md)

This group contains the directional protocol stack for driving a Harness runtime from another process: clients send requests and receive responses or notifications, while the server receives requests and sends responses or notifications. Callers supply the runtime executable and its `cordis.yml`; this group does not create, configure, build, or launch developer projects. The [TypeScript SDK decision](../../.agents/notes/implemented/feature/2026-07-27-typescript-sdk-and-sdk-subagent-backend.md) owns the client contract, the [directional transport decision](../../.agents/notes/implemented/simplification/2026-07-19-make-jsonrpc-directional.md) owns the protocol roles, and the [toolchain removal](../../.agents/notes/implemented/simplification/2026-08-11-remove-sdk-project-toolchain.md) owns the product boundary.

| Package | Role |
|---|---|
| [`protocol/`](protocol/README.md) | Defines the SDK runtime wire protocol |
| [`client/`](client/README.md) | Drives a Harness runtime through the TypeScript client API |
| [`server/`](server/README.md) | Serves out-of-process SDK clients over stdio JSON-RPC |

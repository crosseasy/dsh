# shell/ - shell capability family

English | [中文](README.zh.md)

The capability family spans the canonical executor seam, its implementations, the shared shell environment, and the model-facing tools. All are **product** packages.

| Package | Role | ctx key |
|---|---|---|
| [`shell/`](shell/README.md) | Defines the executor contract shared by Service Providers and Consumers. | `ctx.shell` |
| [`shell-runtime/`](shell-runtime/README.md) | Shares one-shot process lifecycle and sandbox settlement for Bash and PowerShell adapters. | (helper package) |
| [`bash-local/`](bash-local/README.md) | Executes commands through the local [`subprocess`](../subprocess/README.md) service. | (registers `ctx.shell`) |
| [`bash-sandbox/`](bash-sandbox/README.md) | Applies the configured [`sandbox`](../sandbox/README.md) backend before local execution. | (registers `ctx.shell`) |
| [`pwsh-local/`](pwsh-local/README.md) | Executes PowerShell commands with Windows-specific process behavior. | (registers `ctx.shell`) |
| [`shell-env/`](shell-env/README.md) | Provides the managed `DSH_*` environment shared by shell tools. | `ctx.shellEnv` |
| [`tool-bash/`](tool-bash/README.md) | Exposes Bash execution and background-job integration to the model. | (registers on `ctx.tools`) |
| [`tool-pwsh/`](tool-pwsh/README.md) | Exposes PowerShell execution to the model. | (registers on `ctx.tools`) |
| [`persistent-tool-runtime/`](persistent-tool-runtime/README.md) | Shares persistent shell lifecycle mechanics for Bash and PowerShell adapters. | (helper package) |
| [`tool-bash-persistent/`](tool-bash-persistent/README.md) | Exposes an owner-scoped persistent Bash PTY to the model. | (registers on `ctx.tools`) |
| [`tool-pwsh-persistent/`](tool-pwsh-persistent/README.md) | Exposes an owner-scoped persistent PowerShell PTY to the model. | (registers on `ctx.tools`) |

A leaf `cordis.yml` selects one executor implementation and the model-facing tools it needs. A sandboxed composition also selects a `ctx.sandbox` provider; the [ACP example](../../examples/acp-agent/) shows one complete wiring.

The subsystem reference — request/spec vocabulary, results, background processes, the service, and events — is [docs/subsystems/shell.md](../../docs/subsystems/shell.md).

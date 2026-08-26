# @deepseek-ai/dsh-shell-runtime

English | [中文](README.zh.md)

Private helper package for one-shot shell executors backed by `ctx.subprocess`. It supplies the shared foreground and background process lifecycle used by `dsh-bash-local` and `dsh-pwsh-local`, plus the shell-agnostic sandbox settlement used by their sandboxing adapters; it does not register `ctx.shell` itself.

## API Contract

`OneShotShellExecutor` extends the `dsh-shell` Service Definition base and keeps `runArgv()` / `startArgv()` as protected hooks for executor subclasses. An adapter passes an exact argv, resolved cwd, stdin, explicit env, output budgets, spill budget, grace period, timeout identity, and dropped-collector diagnostic. The runtime owns shared request defaulting and caps, subprocess spawn construction, collect-reader validation, foreground timeout/abort classification, final stdout/stderr projection, background read cursors, spawn-failure single-delivery, and kill settlement.

`OneShotSandboxSettlement` wraps a confined foreground or background invocation around those hooks. The adapter supplies the resolved mode, provider-wrapped argv, enforcement value, denial signatures, and runner-failure rules; the runtime classifies foreground results, translates runner infrastructure failures through the adapter's error factory, and stores background sandbox facts by `ShellProcess` until it stamps and removes them at settlement.

`oneShotShellSettings()` projects adapter-owned env defaults, caller env, Harness env, and resolved runtime budgets into the settings consumed by those lifecycle hooks.

The runtime resolves only shell-agnostic request fields. Bash keeps `bash -c`, `TERM=dumb`, its public config schema, and its diagnostic prefix in `dsh-bash-local`; PowerShell keeps executable probing, `ENCODING_PREAMBLE`, its public config schema, and the absence of `TERM=dumb` in `dsh-pwsh-local`. Sandboxing adapters keep policy resolution and provider dialect data while delegating settlement to this package.

## Model Experience

### One-shot shell lifecycle

#### What the model sees

The model sees this runtime only through `dsh-tool-bash` and `dsh-tool-pwsh`, whose schemas, rendering, background-job integration, and sandbox escalation text are unchanged.

#### Token effect

Zero direct token effect.

#### KV Cache effect

No direct invalidation; this package contributes no system-prompt section or tool schema.

## Known Limitations and Deferred Work

- The runtime only supports collect-mode subprocess execution for one-shot commands.
- It does not cover persistent PTY sessions; those use [`dsh-persistent-tool-runtime`](../persistent-tool-runtime/README.md).
- It does not own sandbox policy, provider selection, or dialect signatures; sandboxing adapters pass those per-call facts into `OneShotSandboxSettlement`.

# @deepseek-ai/dsh-persistent-tool-runtime

English | [中文](README.zh.md)

Private helper package for persistent shell tools backed by `ctx.terminals`. It registers one model-facing tool from a caller-provided `PersistentShellDialect` and owns the owner-scoped PTY cache, first-call de-duplication, same-owner command serialization, owner/plugin cleanup, scrollback paging, command deadlines, reset handling, and common text result framing.

## Config

The package has no Cordis plugin config. Callers pass a `PersistentShellDialect` to `registerPersistentShellTool()`.

## API Contract

`registerPersistentShellTool(ctx, config)` registers `config.toolName` through `ctx.tools.register()`. The registered tool accepts one required string parameter named `command`, rejects blank commands, requires an owning Agent, renders output as text, and presents calls with the terminal card title set to the submitted command.

The dialect supplies every shell-specific hook and model-facing string: tool name and description, command-parameter description, terminal backend type, timeout and output limits, timeout identity, lifecycle/reset labels, initialization, marker creation, command wrapping, complete and partial output extraction, and partial-completion detection. The runtime never parses shell syntax itself; it only asks the dialect where command output begins, where completion is proven, and how incomplete retained output should be framed.

## Owner-Scoped PTY Lifecycle

Each Agent owns at most one live PTY session per registered tool. Concurrent first calls for the same Agent share one pending spawn; later calls for that Agent run serially so shell state is observed in command order. Calls from different Agents use different PTYs and do not wait on each other.

The runtime spawns the configured terminal backend in the Agent session cwd when one is available, then runs the dialect initializer before the first command. Plugin disposal aborts in-flight creation, waits for tracked creations to settle, and kills every live PTY owned by the plugin. Agent-scope disposal removes that Agent's cached session reference so a later owner uses a fresh PTY.

## Output, Timeout, and Reset Behavior

Each command is wrapped with fresh dialect markers and submitted once. The runtime reads retained scrollback in pages, prefers a dialect-proven complete capture, falls back to dialect partial capture when the backend proves partial completion, and appends nonzero command status as `[exit code: N]`.

`maxOutputChars` bounds command-output text before fixed diagnostics are appended. When retained output is incomplete, the runtime prepends `lostPrefixMessage`; when output exceeds the bound or is known incomplete, it appends `truncatedMessage`.

`timeoutMs` applies to one command execution. Timeout returns bounded partial output with the common timeout notice, resets the PTY, and appends `resetMessage`. Initialization failure, send failure, command abort, and observed shell exit also clear the cached PTY; shell exit returns the best partial capture plus `[shell exited: code N]`, `[shell killed by signal: SIG]`, or `[shell exited]`, then appends `resetMessage`.

## Model Experience

### Persistent shell tool results

#### What the model sees

The model sees this runtime only through `dsh-tool-bash-persistent` and `dsh-tool-pwsh-persistent`, which use it for lifecycle, timeout, reset, and retained-output framing while keeping their own tool schemas and dialect-specific text. This package contributes no standalone system-prompt section or generated tool catalog entry.

#### Token effect

Zero direct token effect. Consuming tools own schema text and dialect-specific result text; this runtime can add fixed status, clipping, lost-prefix, timeout, and reset diagnostics to their tool results.

#### KV Cache effect

Append-only tool results follow the reusable request prefix. The runtime preserves a stable prefix while the consuming tool schema and dialect strings remain unchanged.

## Known Limitations and Deferred Work

- The runtime requires a real `ctx.terminals` backend and an owning Agent; it rejects agentless calls instead of creating process-global shell state.
- The runtime is not a generic shell abstraction: callers must provide dialect hooks for marker creation, command wrapping, initialization, completion detection, and output extraction.
- Reset discards shell state after timeout, abort, initialization failure, send failure, or shell exit; there is no checkpoint or replay of cwd, environment, functions, aliases, or background jobs.
- One-shot shell execution and sandbox settlement remain owned by their current packages.

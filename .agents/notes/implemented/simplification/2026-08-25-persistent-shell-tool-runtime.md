# Agent Note: Persistent shell tool runtime

Status: implemented

English | [中文](2026-08-25-persistent-shell-tool-runtime.zh.md)

## Problem

The persistent Bash and PowerShell tools carried duplicate owner-scoped PTY lifecycle code: shell creation, first-call de-duplication, same-owner command serialization, scrollback paging, deadline handling, reset-on-uncertain-state, and plugin teardown. The duplicated code was large enough to require a broad `jscpd` exclusion around the PowerShell tool, so future lifecycle fixes could drift between dialects.

## Decision

`@deepseek-ai/dsh-persistent-tool-runtime` owns the shared lifecycle for model-facing persistent shell tools. It registers one tool from a `PersistentShellDialect`, lazily creates one `ctx.terminals` session per exact Agent, serializes commands for that owner, leaves different owners independent, pages retained scrollback, applies the command deadline, and closes cached sessions on shell exit, timeout, abort, send failure, or plugin disposal. The Agent-scope runtime disposer only removes that owner from the pending and live caches; the terminal service's owner lifecycle closes the actual PTY.

Plugin disposal starts every live-session close, waits for all of them to settle, clears the live cache, and then reports the first close failure through Cordis teardown diagnostics. One failing session therefore cannot let disposal return while another close remains in progress.

`dsh-tool-bash-persistent` and `dsh-tool-pwsh-persistent` are dialect adapters. They keep their public `Config`, tool names, schema text, model-visible descriptions, marker creation, command wrappers, shell initialization text, prompt/echo handling, completion detection, and status parsing. The runtime formats only the shared timeout/reset/status framing and delegates command extraction to the adapter.

## Alternatives considered

**Publish one generic persistent shell tool.** Rejected because Bash and PowerShell command quoting, prompt setup, echo behavior, and platform limitations are model-visible enough that hiding them behind one configurable tool would blur the contract.

**Keep duplicated adapters with a smaller jscpd exception.** Rejected because the duplicated lifecycle is exactly where cancellation, timeout, and teardown bugs recur; leaving two copies would preserve the drift risk that prompted the review finding.

**Move dialect parsing into the runtime.** Rejected for this extraction. The shared runtime receives adapter hooks for completed and partial output so shell-specific marker and prompt rules stay near the wrapper that creates them.

## Consequences

Lifecycle fixes for persistent shell tools now land once in `persistent-tool-runtime`, while dialect changes stay isolated in the adapter packages. The [persistent Bash and string-replacement editor decision](../feature/2026-07-29-persistent-bash-str-replace-editor.md) and [persistent PowerShell decision](../architecture/2026-08-11-pwsh-persistent-pty.md) own the model-visible dialect behavior that this runtime preserves. The broad PowerShell full-file duplication exemption is gone; any remaining similarity must be local and justified. The package has no direct model surface, but its behavior is covered through shared runtime tests and both persistent tool suites.

# Agent Note: One-shot shell runtime

Status: implemented

English | [中文](2026-08-25-one-shot-shell-runtime.zh.md)

## Problem

`dsh-bash-local` and `dsh-pwsh-local` need the same one-shot process lifecycle: build the collected subprocess spawn, fuse foreground timeout with upstream cancellation, classify `timedOut` versus `aborted`, project final stdout/stderr, keep consuming cursors for background reads, inject one spawn-failure note, and settle `kill()`. `dsh-bash-sandbox` and `dsh-pwsh-sandbox` need the same foreground/background sandbox settlement while retaining different argv construction and provider dialect data. `dsh-tool-bash` and `dsh-tool-pwsh` also need byte-identical foreground projection, foreground/background rendering, background output schemas, and process outcome mapping while keeping separate tool names, schema prose, prompts, routing, and dialect rules. Lifecycle or rendering ownership inside dialect packages makes a shared fix easy to miss.

## Decision

`@deepseek-ai/dsh-shell-runtime` owns the shared one-shot lifecycle as a private helper package. `OneShotShellExecutor` extends the `dsh-shell` Service Definition base and provides protected `runArgv()` / `startArgv()` hooks. Adapter packages pass the exact argv, resolved cwd, stdin, explicit environment, output budgets, spill budget, grace period, timeout code, and dropped-collector diagnostic.

The runtime also owns shared request defaulting, numeric cap validation, and the merge order for adapter-provided env defaults, caller env, and Harness env. `dsh-bash-local` and `dsh-pwsh-local` keep their public `Config` schema, diagnostic prefix, argv construction, executable resolution, and environment defaults.

`OneShotSandboxSettlement` owns shell-agnostic foreground and background sandbox settlement. Sandboxing adapters pass the resolved mode, provider-wrapped argv, enforcement value, denial signatures, runner-failure rules, and executor-owned `SANDBOX_UNAVAILABLE` factory. The settlement object stores background facts by `ShellProcess`, stamps each process once before `done` resolves, and removes the facts after settlement.

`@deepseek-ai/dsh-shell` owns the shell tools' shared pure one-shot result helpers: `projectShellForegroundResult`, `renderShellResult`, `renderShellProcessRead`, `SHELL_BACKGROUND_OUTPUT_PROPERTIES`, `shellProcessOutcome`, and `parseExitStatus`. The helpers define the foreground tool-output projection, model-visible foreground and background result text, background output schema properties, background process outcome fields, and terminal-card exit-status parsing. The Bash and PowerShell tool packages keep registration, schema text, approval and escalation routing, workdir/default policy, tool identity, job kind, prompt text, argv/executable/env dialect behavior, and shell-specific limitations.

## Alternatives considered

**Make one configurable Bash/Pwsh executor.** Rejected because the executor identity is the shell it spawns. PowerShell executable probing, UTF-8 preamble, Windows signal facts, and Bash's `TERM=dumb` policy remain clearer as package-local behavior.

**Keep duplicated lifecycle with narrower `jscpd` ignores.** Rejected because foreground deadlines and background settlement are the parts most likely to drift. A smaller ignore would hide less code but would not remove the duplicate owner.

**Keep sandbox settlement in each sandbox adapter.** Rejected because foreground runner-failure precedence, spawn-attribution guards, denial classification, and background fact cleanup are identical once the adapter supplies provider dialect data. Duplicating them would keep the highest-risk lifecycle behavior split across Bash and PowerShell.

**Extract a generic configurable shell tool base.** Rejected because the model-facing tool identity is dialect-specific. Bash and PowerShell keep distinct schema prose, system prompt text, approval routing constraints, workdir/default policy, job kind, and argv/executable/env guidance; only the pure model-result helpers are shared.

## Consequences

One-shot shell lifecycle and sandbox settlement fixes land once in `shell-runtime`, and one-shot tool result/projection fixes land once in `dsh-shell`, while Bash and PowerShell differences stay visible in their adapter packages. Broad shell lifecycle duplication exclusions are absent. Shared helper behavior is pinned by `dsh-shell` render tests and the existing Bash/PowerShell tool and executor suites.

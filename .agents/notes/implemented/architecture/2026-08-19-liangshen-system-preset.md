# Agent Note: Liangshen is a canonical system preset

Status: implemented

English | [中文](2026-08-19-liangshen-system-preset.zh.md)

## Problem

The Web Liangshen package and dsh-TUI both distribute a preset named `liangshen`, but they install it through Host startup code into the writable Harness-home preset root. Their preset contents differ, and retaining either synchronizer as runtime composition would make the active implementation depend on which Host ran first and which package last rewrote the directory.

The CLI already supplies a system preset root before the user root. The [agent-preset decision](2026-08-03-per-session-agent-presets.md) makes that ordered directory list the deployment roster and gives the first root ownership of a duplicate id.

## Decision

`apps/cli/config/agent-presets/liangshen/` is the canonical `liangshen` implementation for every profile composed by this CLI. It contains the complete five-file preset published in `@linxin666/dsh-liangshen@0.2.2` under `presets/liangshen/`:

- `preset.yml`
- `agent.cordis.yml`
- `tool-bootstrap.mjs`
- `custom-bash.mjs`
- `NOTICE`

The five files are copied byte-for-byte. The sibling `licenses/` directory retains the publishing package's Apache-2.0 license for its two-phase isolation extensions and complete MIT licenses for the adapted DeepSeek Harness Minimal and Standard presets and `xiaobright/dsh-anchored-standard`. The retained `NOTICE` identifies which files contain those portions.

`apps/cli/tests/web-agent-presets.e2e.ts` reads each of the five canonical files as a raw `Buffer` and pins its SHA-256 digest. A local rewrite, line-ending conversion, or partial source update therefore fails the assembled Web e2e before it can silently redefine this preset.

No `@linxin666/dsh-liangshen` Host row is mounted and the package is not a fusion dependency. Its Host plugin only synchronizes the packaged preset into a user root and publishes guidance; those operations would create a second owner without adding behavior to the system-root composition. This keeps the separation established by the [curated fusion bundle](2026-08-19-curated-fusion-bundle.md): fusion selects Web plugins, while the CLI preset roster owns Liangshen.

dsh-TUI 0.8.3 still writes its packaged `liangshen` tree and `.dsh-tui-managed.json` marker under `$DSH_HOME/.agent-presets/liangshen`; that version has no switch to disable synchronization. The physical user-root copy therefore remains on disk. It does not participate in discovery, parsing, or activation because the configured system root is earlier and first-root-wins selects the canonical directory.

## Alternatives considered

**Mount the `@linxin666/dsh-liangshen` Host synchronization row.** Rejected because it writes a second copy into the user root, introduces a runtime dependency whose plugin is not needed after extraction, and leaves upgrades with two independent owners.

**Use the dsh-TUI user-root copy as the shared implementation.** Rejected because its files differ from the selected Web implementation and a later user root cannot override a shipped system id.

**Fork dsh-TUI solely to suppress its disk copy.** Rejected because the unused copy does not affect resolution, while maintaining a product fork would add code and release ownership only to remove inert files.

## Consequences

Web and TUI profiles resolve the same system-owned `liangshen` directory. Its initial assembled tool list is exactly `bash` and `str_replace_editor`; platform gates select persistent Bash on POSIX and the copied Git Bash adapter on Windows.

Upgrading Liangshen requires selecting a new exact published source, reviewing all five files together, copying them without local rewrites, updating the pinned hashes and retained licenses, preserving the notice, and re-running composition, root-precedence, Windows-gate, and license checks. The TUI-managed user copy may drift independently but remains inactive while the system root keeps the id.

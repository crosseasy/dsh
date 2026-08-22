# Fusion TUI profile delivery status

English | [中文](fusion-tui-profile.zh.md)

Fusion TUI public delivery is **phase 2 BLOCKED**. The selected terminal interface is `@deepseek-harness-tui/dsh-tui@0.7.1`, but there is no supported public command that assembles its complete dependency graph on `@deepseek-ai/dsh@0.1.0-rc.5`.

## Selected components

- TUI `0.7.1` is the highest published version that preserves one Liangshen owner and passes the source-validation runtime checks.
- The repository-shipped `liangshen` preset, sourced from `@linxin666/dsh-liangshen@0.2.4`, remains the only Liangshen owner for Web and TUI.
- The host profile owns the worker-thread code runtime; Liangshen remains its preset consumer.
- TUI `0.7.2` and later are not selected because they package and synchronize another Liangshen preset. The latest audited candidates, `0.8.7` and `0.8.8`, each contain eight Liangshen files and no supported opt-out.

## Current publication evidence

The TUI series has 19 published versions. The two versions after the `2026-08-21T02:11:00Z` cutoff are `0.8.7` and `0.8.8`. Each exact artifact passes identity, integrity, and MIT license checks, declares 24 DSH peers that do not accept rc.5, has zero root and 15 packaged `workspace:*` values, and actively synchronizes its packaged Liangshen copy.

Both candidates fail single Liangshen ownership and public rc.5 closure before installation. Their profile composition, fresh/resume PTY, UI, message round trip, replay, exit, and cleanup checks are therefore `NOT RUN`, not runtime PASS or FAIL.

## Runtime evidence and public delivery

Source validation exercised TUI `0.7.1` with a complete 41-package rc.5 Harness closure. Terminal rendering, the message and tool round trip, durable resume, supported exit, and process cleanup passed. This proves that the selected TUI can run on that exact source-built closure.

That result does not provide a public installation source. The historical public-install attempt found 23 missing rc.5 packages in the direct subset it queried. A fresh query of all 41 packages in the historical source-validation closure finds exact rc.5 for 0/41; it does not imply that the other 18 packages were historically available. Installing TUI `0.7.1` from the registry cannot reproduce the validated closure and may either fail or resolve a mixed rc.6/rc.8 Harness graph. Such a graph is not an accepted Fusion TUI installation.

For that reason, this guide does not provide create, add, verify, or start commands. Source-only verification is technical runtime evidence, not a supported public assembly path.

## Known risks

TUI `0.7.1` declares an rc.6 Harness baseline, so a pure rc.5 graph emits upstream-drift warnings. The graph also resolves React once at `19.2.8`, while `dsh-working-activity@0.2.6` declares React `^18.2.0`. These mismatches did not prevent the validated runtime paths from completing, but they remain revalidation risks.

Version `0.7.1` itself contains no `workspace:*` dependency values and does not package Liangshen. The zero root `workspace:*` count in `0.8.7` and `0.8.8` does not remove their 15 packaged values, second Liangshen owner, or missing-public-closure blocker.

## Unblocking delivery

Public delivery can proceed only after one of these conditions is met:

1. A consistent rc.5 closure for every required Harness package becomes publicly available.
2. A new Harness baseline is explicitly approved for Fusion TUI.

Either change requires a complete revalidation of exact installation, the resolved lock, single Liangshen ownership, terminal behavior, durable resume, supported exit, cleanup, and the documented public commands before this guide can provide an assembly recipe.

See [Fusion external-plugin ownership](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) for the version selection, ownership rules, and revalidation conditions.

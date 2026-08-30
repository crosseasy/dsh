# Agent Note: Session reference private preparation

Status: implemented

English | [中文](2026-08-25-session-reference-private-preparation.zh.md)

## Problem

`SessionReferenceResolver` exposed candidate ranking and snapshot preparation as public Cordis service methods even though production callers only need generated Remote discovery, canonical URI helpers, and `agent/pre-step` insertion. Keeping the extra methods public made internal ordering and validation look like reusable host APIs.

## Decision

`ctx.sessionReferenceResolver` exposes only `remoteExportCandidates()` as its public Service method. Candidate ranking remains an implementation detail behind that Remote method, and snapshot preparation remains an implementation detail of the outer `agent/pre-step` listener that processes accepted direct user messages. The URI helpers and exported data records remain public because hosts and generated clients still exchange canonical mentions and candidate payloads through them.

## Alternatives considered

**Keep `listCandidates()` public for tests.** Rejected because tests can cover discovery through the same Remote method that hosts call. A direct public method would preserve an unsupported limit override and keep the generated Cordis catalog wider than production needs.

**Keep `prepare()` public for programmatic hosts.** Rejected because preparation belongs after downstream `agent/pre-step` listeners accept the final message batch. A public method would let callers bypass that ordering and make malformed structured-reference objects part of the service contract.

**Move session discovery behind an API Proxy route.** Rejected because Typert Remote already provides the host-facing unary discovery call without a reference-specific gateway route.

## Consequences

The generated Cordis surface contains only `remoteExportCandidates()` for `ctx.sessionReferenceResolver`. Tests cover ranking, cancellation, fallback titles, canonical mentions, snapshot insertion, deduplication, self-reference, limits, read failures, cancellation, tag-safe JSON, byte budgets, source mutation, recursive snapshot exclusion, and no-reference pass-through through Remote discovery and `agent/pre-step` behavior.

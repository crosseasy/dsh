# Agent Note: Fail-closed Settings wire descriptions

Status: implemented

English | [中文](2026-08-25-fail-closed-settings-wire-description.zh.md)

## Problem

Settings RPC served every registered namespace, but its redactor traversed only `object`, `dict`, and `array`. A secret below a union, intersection, or transform therefore remained in resolved, composition, or user values, while `schema.toJSON()` also serialized secret defaults and transform callback source. Write failures returned arbitrary schema or provider messages that could quote rejected input. The `llm-pi-ai` `headers` dict could carry `Authorization` or `api-key` values without declaring that fact to the redactor.

## Decision

`SettingsProvider.describeForWire(ns?)` is the only path from a registered namespace to an RPC descriptor. It inspects the complete live Schemastery graph before serialization, redacts resolved, `base`, and `user` values, sanitizes defaults in the serialized schema through the same traversal, and emits the `{ path, set }` secret sidecar. `describe()` remains the verbatim same-process API.

Direct secret leaves under `object`, `dict`, and `array` are supported. A secret under `union` or `intersect`, any `transform`, malformed relation metadata, and every unsupported node reject with fixed text that contains no node metadata or value. Union and intersection nodes without secret descendants remain available for ordinary enum and composition schemas.

ApiProxy uses `describeForWire()` for reads and write responses. It preflights the addressed namespace before schema validation or persistence and replaces schema, validation, and storage messages with fixed `settings-rejected` text; revision conflicts retain their structured revisions. `llm-pi-ai` marks the complete `headers` dict as one opaque secret field because its production request path accepts credential-bearing headers.

## Alternatives considered

**Keep `describe({ redactSecrets: true })` and extend only its value walker.** Rejected because it leaves schema defaults and callback source on a second serialization path and still performs persistence before proving the response safe.

**Traverse the selected union branch or merge intersection redactions.** Rejected because the schema does not provide one stable path set independent of the current value, while the client needs a deterministic write-only field ledger.

**Allow transforms after deleting the serialized callback.** Rejected because the rehydrated client schema would not preserve validation semantics, and executing or serializing plugin callbacks at the wire boundary is unnecessary.

**Require all provider credentials to use `apiKeyEnv`.** Rejected because supported pi-ai routes already accept credential-bearing custom headers; marking the existing field secret reflects production behavior without removing that capability.

## Consequences

An unsupported namespace fails the complete Settings read rather than returning a partial or unsafe descriptor, and its writes fail before persistence. RPC errors do not expose rejected values, callback source, or provider diagnostics. Direct object secrets retain their existing `{ path, set }` behavior, while `llm-pi-ai` header names and values become write-only as one field. Dynamic plugins must keep wire-exposed schemas within the supported callback-free subset or move unsupported configuration outside Settings RPC.

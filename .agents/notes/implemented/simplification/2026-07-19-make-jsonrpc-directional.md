# Agent Note: Keep SDK JSON-RPC transport directional

Status: implemented

English | [中文](2026-07-19-make-jsonrpc-directional.zh.md)

## Problem

The SDK JSON-RPC bridge has fixed request ownership, but a symmetric transport gives both endpoints request initiation and response handling. The runtime server never initiates an SDK request, and the TypeScript and Python SDK clients never answer one. Exposing those roles adds pending-request and response APIs with no SDK consumer and allows an unexpected server request to enter client correlation state.

The Codex app-server protocol is separate from the SDK protocol and does send requests to its client for unattended approval decisions. Its real bidirectional requirement must not widen the SDK client API.

## Decision

`dsh-sdk-protocol` keeps one internal newline-delimited frame parser and writer while exporting two role-specific transports. `JsonRpcLineServerTransport` accepts requests and sends responses or notifications; it ignores response and notification frames from clients. `JsonRpcLineClientTransport` sends requests or notifications and accepts responses or notifications; it ignores server requests, which cannot settle a pending request. The client notification method remains because the Codex app-server handshake requires outbound `initialized`.

`subagent-codex` owns a private `CodexJsonRpcTransport` subclass for the app-server's actual server-request methods. It reuses the shared parser, writer, request correlation, notification dispatch, and closure behavior, but its response handler is not part of the SDK protocol package's client role.

The Python `HarnessClient` sends requests and receives responses or notifications. It has no `IncomingRequest`, inbound request queue, `notify`, `next_request`, `respond`, or `respond_error` API. Unexpected server requests and malformed frames are ignored before response correlation.

`session/prompt` retains immediate enqueue settlement as `{ messageId }`. High-level TypeScript and Python runs own the interval from that durable inbox receipt through the next whole-agent idle, using `session.event` and `session.status`; the protocol has no `session.finished` notification or synchronous prompt outcome.

## Verification

Per-direction TypeScript transport tests pin request correlation, notifications, ignored direction-external frames, malformed input, handler errors, abort, stream closure, and flush behavior. Codex wire tests pin its private server-request responses and `initialize` → `initialized` handshake. Python client tests pin unexpected request isolation, malformed frames, concurrent correlation, notifications, runtime exit, removed public APIs, and immediate message-id settlement. Built JSON-RPC smoke tests and both SDK output snapshots cover the assembled protocol.

## Alternatives considered

**Keep a generic symmetric JSON-RPC peer.** Rejected because the SDK protocol has no server-originated request, and future interactive methods require their own typed protocol design rather than dormant generic APIs.

**Remove Codex server-request handling with the SDK peer role.** Rejected because Codex 0.147.0 uses those requests for command, file, permission, user-input, and MCP decisions. A private product adapter preserves that current behavior without exposing it to SDK clients.

**Settle `session/prompt` synchronously or add `session.finished`.** Rejected because one prompt does not own all work before the agent next becomes idle. The message id is the durable enqueue receipt; session events and status transitions describe later activity without claiming prompt-level causality.

## Consequences

SDK consumers cannot initiate runtime notifications or answer runtime requests through `HarnessClient`, and unexpected request frames cannot steal response waiters. The TypeScript transport still carries outbound notifications for the current Codex handshake. A future SDK server-request method requires an explicit typed addition and client ownership model.

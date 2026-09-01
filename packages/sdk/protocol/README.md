# @deepseek-ai/dsh-sdk-protocol

English | [中文](README.zh.md)

The shared wire protocol for the DeepSeek Harness SDK runtime: directional newline-delimited JSON-RPC 2.0 transports plus the named request, result, and notification types both wire ends speak. The package root enumerates the protocol consumer interface; source modules are not exported as deep imports. The server side is the [`dsh-sdk-jsonrpc-server`](../server/README.md) plugin; clients are [`dsh-sdk-client`](../client/README.md) (TypeScript) and the [Python SDK](../../../python/README.md) (which mirrors these types but does not import them). A pure library — no plugin, no Config, no registration.

## Transport

`JsonRpcLineServerTransport` and `JsonRpcLineClientTransport` share one frame parser and writer over caller-owned byte streams, with one compact JSON frame per `\n`-terminated line. The server accepts requests and sends responses or notifications; direction-external responses and client notifications are ignored. The client sends requests or notifications and accepts responses or notifications; server requests are ignored and cannot settle a pending request. Malformed JSON lines are ignored. `start()` attaches stream listeners, while `close()` detaches them and rejects client requests without destroying the streams. Missing server handlers answer `-32601`; handler rejections answer `-32603` with the error message. An error response rejects the correlated client `request()` with `JsonRpcResponseError`, preserving the wire `code` and optional `data`.

## Wire types

`types.ts` names every payload of the protocol served by `HarnessSdkJsonRpcServer`:

| Direction | Method | Types |
|---|---|---|
| client→server | `initialize` | `InitializeParams` → `InitializeResult` |
| client→server | `session/prompt` | `SessionPromptParams` → `SessionPromptResult` (durable enqueue receipt) |
| client→server | `shutdown` | no params → `{}` |
| server→client | `session.event` | `SessionEventNotification` (every session in the runtime, unfiltered) |
| server→client | `session.status` | `SessionStatusNotification` (whole-agent `running`/`idle` transition) |
| server→client | `subagent.started` | `SubagentStartedNotification` |
| server→client | `subagent.finished` | `SubagentFinishedNotification` (in-process runs only) |

`HarnessSdkRequestMap` and `HarnessSdkNotificationMap` index these by method name. `SessionPromptResult.messageId` identifies the queued `UserMessage`; it does not identify a later assistant message, turn ending, or prompt result. Clients combine the open-ended `session.event` stream with agent-wide `session.status` according to their own activity ownership. `SubagentFinishedNotification.lastAssistantMessage` contains the child's last non-empty assistant message or, when no such message exists, its accumulated assistant text; the field is absent when the child produced neither. `InitializeParams.maxTokens` is an optional positive safe integer that caps each conversation-model output for SDK-created agents and their in-process descendants; omission allows the selected adapter's exact-model default to apply, or otherwise preserves provider behavior. The notification payload types depend on `SessionEvent` (`dsh-session`), `ContentBlock` (`dsh-llm`), and `SubagentStopReason` (`dsh-subagent`) — the protocol streams full session-log envelopes, so the session vocabulary is part of the wire contract. `serverInfo.name` stays the wire-stable `deepseek-harness-sdk-runtime`.

## Model Experience

None, as this package defines the client-facing wire protocol; the model-visible surfaces belong to the runtime plugins composed behind the serving [`dsh-sdk-jsonrpc-server`](../server/README.md) entry.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No protocol-version negotiation** — the handshake carries only `serverInfo.version` (`0.0.1`, unvalidated by clients); pre-release stance, no compatibility promise.
- **No cancel or session-close methods** — a client abandons a turn by closing the runtime process; see the [`dsh-sdk-jsonrpc-server` README](../server/README.md).
- **No server→client requests** — both SDK clients ignore that direction and expose no response API; adding an interactive request requires an explicit protocol design.

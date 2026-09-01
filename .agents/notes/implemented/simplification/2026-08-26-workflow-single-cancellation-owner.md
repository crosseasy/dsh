# Agent Note: Workflow run owns cancellation

Status: implemented

English | [中文](2026-08-26-workflow-single-cancellation-owner.zh.md)

## Problem

A synchronous workflow start exposed cancellation through both `WorkflowStartRequest.signal` and the returned `WorkflowRun.cancel()`. The workflow and Ralph Consumers passed the same caller signal into the request and also attached a listener that called the run handle, so one abort entered the worker host through two paths. The host needed input-signal listener state solely to reconcile those duplicate paths.

Removing the request signal still leaves one attach-time race to handle. A caller signal may abort during synchronous `start()` or while the Consumer installs its listener. Listener registration followed by an immediate state check closes that race, but both observations can invoke the callback unless forwarding is independently idempotent.

## Decision

`WorkflowStartRequest` contains startup data only. `WorkflowEngine.start()` returns synchronously, and the returned `WorkflowRun` is the sole runtime cancellation authority.

Each Consumer owns its caller signal with the same sequence: reject an already-aborted call before `start()`; after the run returns, attach a guarded listener that forwards at most one abort to `run.cancel()`; immediately recheck the signal; then detach the listener and await `run.dispose()` in `finally`. The guard is claimed before calling `run.cancel()` so synchronous reentry cannot forward a second cancellation.

`WorkflowRun.cancel()` remains idempotent and keeps the first reason. The worker host's `AbortController` is an internal fanout from that method to pending and published children, not another public cancellation channel. Disposal joins the same run-owned cancellation and cleanup state, bounds worker settlement and termination, and returns after every host-side provider start and child disposal reaches quiescence.

Workflow metadata, run ids, progress narration, lifecycle events, durable records, and agent start/end pairing remain unchanged.

## Testing

The workflow and Ralph Consumer tests cover pre-aborted calls, abort during synchronous start, mid-flight abort, post-settlement abort, listener-installation reentry, at-most-once forwarding, listener detachment, and disposal quiescence. Worker-thread tests cover immediate cancellation, mid-flight children, first-reason arbitration under reentrant cancellation, at-most-once worker cancel delivery, forced settlement, and quiescent disposal. Built-worker and keyless workflow/Ralph snapshots exercise the assembled artifacts without changing their expected output.

## Supersession audit

This decision partially supersedes only the cancellation portion of the rejected [collapse-workflow proposal](../../rejected/simplification/2026-07-12-collapse-workflow-to-foreground-core.md). That note remains active and cross-linked because its broader proposal to remove workflow metadata, progress events, run identity, and lifecycle pairing remains a meaningful rejected alternative.

The implemented [dynamic-workflows](../feature/2026-07-05-dynamic-workflows.md) and [Ralph workflow tool](../feature/2026-07-19-fresh-agent-ralph-workflow-tool.md) notes remain active because they own the capability and policy rationale; their cancellation descriptions point here. No other active Agent Note owns the duplicate workflow cancellation channel, and this scoped audit archives or deletes no note.

## Alternatives considered

**Keep the request signal as a defensive fallback.** Rejected because `start()` publishes the handle synchronously. Consumers can cover pre-start and attach-time aborts without giving the engine a second public path, and duplicate paths make reason arbitration and listener disposal harder to prove.

**Make `start()` asynchronous.** Rejected because the engine completes request validation and handle publication synchronously. Introducing an asynchronous readiness phase would widen the service contract solely to preserve a cancellation channel that has no ownership interval.

**Share a cross-package bridge helper.** Rejected because each Consumer needs only a local guarded callback around its own `exec.signal`, and a new exported utility would add API surface without removing meaningful complexity.

## Consequences

The engine has one public cancellation operation and no caller-signal listener lifecycle. Consumers carry a small explicit bridge and must preserve the precheck, attach, immediate recheck, detach, and dispose ordering. Repeated or reentrant abort observations cause one `run.cancel()` call, while the run itself remains responsible for first-reason arbitration, worker termination, child cancellation, and quiescence.

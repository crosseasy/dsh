# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260823-001] correction

**Logged**: 2026-08-23T05:16:00Z
**Priority**: high
**Status**: resolved
**Area**: tests

### Summary

An observed cleanup promise still needs an earlier bounded settlement path when it ignores cancellation.

### Details

`Promise.allSettled` prevents unhandled rejections but can itself wait forever. Hierarchical teardown such as Playwright page, context, and browser closure must preserve dependency order instead of starting all closes concurrently. Process cleanup must prove process-tree exit before allowing bounded observation of non-process disposal and filesystem cleanup.

### Suggested Action

Use thunk-started cleanup tasks, permanently attach fulfillment and rejection observers, report pending tasks at an earlier deadline, close dependent resources in order, and reserve process-specific termination and exit checks for owned process work.

### Metadata

- Source: user_feedback
- Related Files: apps/web/tests/fusion-real-process.ts, apps/web/tests/fusion-real-composition.acceptance.ts
- Tags: cancellation, cleanup, promise-observation, quiescence

### Resolution

- **Resolved**: 2026-08-23T05:19:00Z
- **Notes**: Added bounded permanent observation, an uncancellable-never-settles regression, sequential Playwright cleanup, and process-exit verification.

---

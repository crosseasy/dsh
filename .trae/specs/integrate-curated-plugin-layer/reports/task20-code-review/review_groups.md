# Task 20.1 Review Groups

## Group 1: Policy and benchmark data

Grouping: capability ownership and data flow.

Focus: catalog parsing, fail-closed admission, immutable query results, benchmark integrity, rollback evidence, invariants, and test strength.

Files:

- `packages/curated/curated-policy/**`
- `packages/curated/curated-bench/**`

## Group 2: Profile materialization and CLI bridge

Grouping: user entry path and profile lifecycle.

Focus: deterministic composition, existing-file preservation, enterprise rejection, Loader behavior, registration disposal, and CLI argument/error propagation.

Files:

- `packages/curated/curated-base/**`
- `packages/curated/curated-profiles/**`
- `apps/cli/src/curated-profile.ts`
- `apps/cli/tests/curated-profile.spec.ts`

## Group 3: Curated command runtime

Grouping: validation and execution call chain.

Focus: lock provenance, installed-artifact validation, Cordis composition, timeout and subprocess lifecycle, secret redaction, benchmark decisions, packed entry points, and negative tests.

Files:

- `packages/curated/curated-scripts/**`

## Group 4: Release, rescope, lock, and documentation closure

Grouping: distribution and documentation ownership.

Focus: publish ordering and dependency closure, vendoring idempotence, lockfile consistency, current-state prose, bilingual parity, and implemented Agent Note accuracy.

Files:

- changed `scripts/release/**`
- changed `scripts/rescope-vendor.ts`
- changed `scripts/rescope-vendor.spec.ts`
- curated entries in `pnpm-lock.yaml`
- directly changed curated package READMEs
- `docs/architecture.md`
- `docs/architecture.zh.md`
- `docs/subsystems/curated.md`
- `docs/subsystems/curated.zh.md`
- `docs/plugin/superpowers/**`
- `.agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md`
- `.agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.zh.md`

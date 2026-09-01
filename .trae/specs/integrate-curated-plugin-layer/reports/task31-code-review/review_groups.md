# Task 31 Final Review Groups

scope: full_file

## Group 1: Lock and Profile Admission

Grouping: shared policy and profile-admission call chain

Focus: exact npm/Git provenance, root/installed lock equality, runtime closure and tree identity, immutability, profile selection, redaction, and fail-closed behavior.

Files:

- packages/curated/curated-policy/src/index.ts
- packages/curated/curated-policy/src/installed-lock.ts
- packages/curated/curated-profiles/src/index.ts

## Group 2: CLI and App Boot

Grouping: profile preparation, config dump, install activation, and Loader root-consumption call chain

Focus: descriptor ownership, root binding, rename validation, rollback identity, cleanup, ordinary-profile compatibility, and nested include semantics.

Files:

- apps/cli/src/curated-profile-lock.ts
- apps/cli/src/curated-profile.ts
- apps/cli/src/dump-config.ts
- apps/cli/src/plugin.ts
- apps/cli/src/profile-boot.ts
- packages/boot/app-boot/src/index.ts

## Group 3: Curated Commands

Grouping: observed command runtime

Focus: artifact resolver fallback, shared lock admission, lifecycle-script refusal, secret redaction, subprocess cleanup, timeout accounting, and result semantics.

Files:

- packages/curated/curated-scripts/src/index.ts

## Group 4: Benchmark and Publication

Grouping: benchmark asset reads plus publication contract

Focus: canonical containment, descriptor identity, mandatory assets, package payload completeness, generated chunk publication, and workspace constraint symmetry.

Files:

- packages/curated/curated-bench/package.json
- packages/curated/curated-bench/src/index.ts
- packages/curated/curated-bench/src/invariant.ts
- packages/curated/curated-bench/src/snapshot.ts
- packages/curated/curated-bench/tsdown.config.ts
- scripts/check-workspace-constraints.ts

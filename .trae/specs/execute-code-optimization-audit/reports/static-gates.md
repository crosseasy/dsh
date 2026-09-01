# Task 20 Static Gates Report

Date: 2026-08-26
Workspace: `/Users/bytedance/opencode/agent/dsh`
Scope: final verification subagent for Task 20 static gates.

## Constraints

- No `git commit`, `git push`, `git merge`, `git rebase`, `git reset`, or rollback commands were run.
- No business code was edited.
- Every shell command run for this verification used `gtimeout 55s`.
- No command is currently running.

## Required Inputs

- Read: `.trae/specs/execute-code-optimization-audit/spec.md`
- Read: `.trae/specs/execute-code-optimization-audit/tasks.md`
- Read: `.trae/specs/execute-code-optimization-audit/checklist.md`
- Read: `docs/arch/review_report/code-optimization-audit.md`

## Gate Results

| Command | Status | Notes |
| --- | --- | --- |
| `gtimeout 55s pnpm run typecheck` | FAIL | Failed before the script body during pnpm dependency pre-run check. Root `postinstall` ran `node scripts/install-lefthook.mjs` and failed with `refusing to overwrite unowned hooks directory /Users/bytedance/opencode/agent/dsh/.git/dsh-hooks`. |
| `gtimeout 55s pnpm run lint` | FAIL | Same pre-script failure as `typecheck`. |
| `gtimeout 55s pnpm run duplication` | FAIL | Same pre-script failure as `typecheck`. |
| `gtimeout 55s pnpm run build` | FAIL | Same pre-script failure as `typecheck`. |
| `gtimeout 55s pnpm run hygiene` | FAIL | Same pre-script failure as `typecheck`. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run typecheck` | PASS | Script body completed successfully within 55 seconds. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run lint` | PASS | Script body completed successfully; oxlint reported 0 warnings and 0 errors. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run duplication` | PASS | Script body completed successfully; jscpd reported 0 clones. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run build` | PASS | Script body completed successfully; host, client, and web build completed. Vite chunk size warnings and tsdown dependency bundle hints were non-fatal. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run hygiene` | PASS | Completed-build-state script body completed successfully; `run-gates: 14 passed, 0 failed, 0 skipped in 24.77s`. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run clean` | PASS | Cleaned artifact state successfully; `clean: removed 249 paths`. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run hygiene` after clean | TIMEOUT | Clean-state full graph hit the 55 second wrapper. It reached `run-gates: PASS build (53.72s)` and started `publint`, `built-package-invariants`, and `node-next types` before `gtimeout` exited 124. This is a time-cap timeout, not a reported hygiene gate failure. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run publint` | PASS | Decomposed clean-state artifact consumer completed successfully. Output included existing publint warnings, but command exited 0. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run verify-built-package-invariants` | PASS | Decomposed clean-state artifact consumer completed successfully; `234 compiled companion(s) passed plain-Node Loader checks`. |
| `gtimeout 55s pnpm --config.verify-deps-before-run=false run verify-node-next-types` | PASS | Decomposed clean-state artifact consumer completed successfully; `243 workspace package declaration API(s) compile under NodeNext`. |
| `gtimeout 55s git diff --check` | PASS | No whitespace errors reported. |
| `gtimeout 55s git status --short -- vendor .agents/notes/archived` | PASS | No `vendor/` or `.agents/notes/archived/` changes reported. |

## Hygiene Gate Graph Evidence

Static inspection confirms `scripts/run-gates.ts` defines the `hygiene` graph with a `build` gate and passes `artifactNeeds: ['build']` into the hygiene artifact consumers. The artifact consumers verified in code are `publint`, `built-package-invariants`, and `node-next-types`.

`scripts/run-gates.spec.ts` also contains a focused test asserting that `publint`, `built-package-invariants`, and `node-next-types` each have `needs: ['build']` in `gatesForMode('hygiene')`.

Runtime evidence from `gtimeout 55s pnpm --config.verify-deps-before-run=false run hygiene` confirms `build` passed before `publint`, `built-package-invariants`, and `node-next-types` started, and all three artifact consumers passed.

Completed-build state:

- Full `hygiene` graph completed in 24.77 seconds.
- Result: PASS.

Clean artifact state:

- `clean` completed first and removed 249 artifact paths.
- Full `hygiene` from clean artifact state used the same `hygiene` graph and successfully completed `build`, but `build` took 53.72 seconds, leaving too little time for artifact consumers under the required `gtimeout 55s` wrapper.
- The remaining artifact consumers from that same graph were decomposed and run individually after `build`; `publint`, `built-package-invariants`, and `node-next-types` all passed.
- Result under decomposition: PASS.
- Result for a single clean-state full-graph command under the mandated 55 second cap: TIMEOUT.

Conclusion:

- Same gate graph: YES. Static code and focused test coverage show both states use the `hygiene` graph with artifact consumers depending on `build`.
- Gate conclusion consistency: YES under the allowed 55-second decomposition strategy. Both completed-build and clean-artifact states reached passing gate bodies.
- Official raw `pnpm run ...` entrypoints fail because of the local hooks ownership/pre-run dependency check issue.

## Systematic Debugging Notes

### Hypothesis 1: pnpm dependency pre-run check is blocked by an unowned hooks directory

Evidence:

- All original `pnpm run ...` aggregate commands failed before their script bodies.
- Failure message: `refusing to overwrite unowned hooks directory /Users/bytedance/opencode/agent/dsh/.git/dsh-hooks`.
- `git config --get core.hooksPath` points to `/Users/bytedance/opencode/agent/dsh/.git/dsh-hooks`.
- `.git/dsh-hooks` exists but lacks the `.dsh-lefthook-owned` ownership marker expected by `scripts/install-lefthook.mjs`.

Suggested fix:

- Repair the local hooks installation state through the repository-approved setup path so `.git/dsh-hooks` is either absent before install or contains the expected `.dsh-lefthook-owned` marker. Do this outside this verification-only task and avoid deleting or overwriting user-managed hooks without explicit approval.

### Hypothesis 2: The gate script bodies themselves are healthy after bypassing the dependency pre-run check

Evidence:

- With `pnpm --config.verify-deps-before-run=false`, `typecheck`, `lint`, `duplication`, `build`, and `hygiene` all completed successfully within 55 seconds.
- `hygiene` reported `14 passed, 0 failed, 0 skipped`.

Suggested fix:

- Treat the current failing surface as local setup/pre-run hook ownership, not as evidence of TypeScript, lint, duplication, build, or hygiene gate-body regressions.



Evidence:

- Static inspection shows the intended dependency is present in `scripts/run-gates.ts`.
- Runtime hygiene output showed `build` completed before artifact consumers started in the completed-build state.
- A dedicated clean-state full `hygiene` run reached `PASS build (53.72s)` and then timed out under `gtimeout 55s` after starting artifact consumers.
- The decomposed artifact consumers from that same graph all passed after the clean-state build.

Suggested fix:

- Preserve the `hygiene` gate graph dependency from artifact consumers to `build`; if changing gate orchestration, keep or strengthen the focused test in `scripts/run-gates.spec.ts`.

### Hypothesis 4: Clean-state full hygiene needs more than the mandatory one-minute command cap on this machine

Evidence:

- Completed-build-state `hygiene` finished in 24.77 seconds.
- Clean-state `hygiene` spent 53.72 seconds on `build` alone, then started artifact consumers and was killed by `gtimeout` with exit 124.
- The artifact consumers passed when decomposed after the clean-state build.

Suggested fix:

- Keep the graph dependency as-is, but for local verification under a hard 55 second command cap, run clean-state hygiene as `clean`, then the graph until `build`, then artifact consumers as separate leaf gates. If the official acceptance requires a single command from clean state, the local command cap must be raised or build time reduced.

## Final Status

STATUS: FAIL

Reason:

- The official raw `pnpm run typecheck`, `pnpm run lint`, `pnpm run duplication`, `pnpm run build`, and `pnpm run hygiene` entrypoints fail before script execution because of the local hooks ownership/pre-run dependency check.
- Gate bodies pass when the dependency pre-run check is bypassed for verification.
- Clean-state full `hygiene` exceeds the mandated 55 second single-command cap, but the same graph's leaf gates pass when decomposed.

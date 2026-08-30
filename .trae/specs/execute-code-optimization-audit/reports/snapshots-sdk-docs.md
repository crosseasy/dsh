# Snapshots, SDK Expected-Output, and Doc-Sync Validation Report

Date: 2026-08-26
Workspace: `/Users/bytedance/opencode/agent/dsh`
Role: snapshots / SDK expected-output / documentation synchronization verification only.

## Status

STATUS: FAIL

No long-running command is still active. Every validation shell command was launched under `gtimeout 55s`.

## Inputs Read

- `gtimeout 55s cat .trae/specs/execute-code-optimization-audit/spec.md` — PASS
- `gtimeout 55s cat .trae/specs/execute-code-optimization-audit/tasks.md` — PASS
- `gtimeout 55s cat .trae/specs/execute-code-optimization-audit/checklist.md` — PASS
- `gtimeout 55s cat docs/AGENTS.md` — PASS
- `gtimeout 55s cat docs/testing.md` — PASS
- `gtimeout 55s cat docs/i18n/README.md` — PASS
- Loaded relevant validation skills: `dsh-pre-push-checks`, `dsh-doc-site-sync`, `verification-before-completion`, `systematic-debugging`.

## Workspace / Environment Evidence

- `gtimeout 55s git status --short --branch` — PASS; branch `feat_825...origin/feat_825`, dirty tree with broad code/doc/Agent Note changes and untracked `docs/plugin/superpowers/plans/`, `docs/plugin/superpowers/specs/`.
- `gtimeout 55s git rev-parse --show-toplevel` — PASS; `/Users/bytedance/opencode/agent/dsh`.
- `gtimeout 55s pnpm --version` — PASS; `11.7.0`.
- `gtimeout 55s node --version` — PASS; `v24.14.0`.
- `gtimeout 55s which uv` — PASS; `/Users/bytedance/.local/bin/uv`.
- `gtimeout 55s find dist-exe -maxdepth 2 -type f -name 'dsh-jsonrpc-agent-pkg-*' -print` — PASS; macOS runtime exe and sidecars exist.

## Aggregate Commands

- `gtimeout 55s pnpm run doc-sync` — FAIL before doc gates. `pnpm` ran dependency status/install, then `postinstall` failed: `scripts/install-lefthook.mjs` refused to overwrite unowned `.git/dsh-hooks`.
- `gtimeout 55s pnpm exec tsx --version` — FAIL with the same `postinstall` blocker.
- `gtimeout 55s env npm_config_verify_deps_before_run=false pnpm exec tsx --version` — FAIL with the same `postinstall` blocker.
- `gtimeout 55s env npm_config_verify_deps_before_run=false pnpm run doc-sync` — FAIL with the same `postinstall` blocker.

## Passed Leaf Checks

- `gtimeout 55s node_modules/.bin/tsx scripts/verify-type-equiv.ts` — PASS; 400 primary blocks and 400 paired derivatives match.
- `gtimeout 55s node_modules/.bin/tsx scripts/gen-config-catalog.ts --check` — PASS; `docs/config-catalog.md` up to date.
- `gtimeout 55s node_modules/.bin/tsx scripts/gen-tool-catalog.ts --check` — PASS; `docs/tool-catalog.md` up to date.
- `gtimeout 55s node_modules/.bin/tsx scripts/gen-persistence-catalog.ts --check` — PASS; `docs/persistence-catalog.md` and `packages/core/session/src/known-event-types.ts` up to date.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-export-jsdoc.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/gen-cordis-catalog.ts --check` — PASS; 97 generated files/regions up to date.
- `gtimeout 55s node_modules/.bin/tsx scripts/gen-cordis-api.ts --check` — PASS; 97 generated files/regions up to date.
- `gtimeout 55s node_modules/.bin/tsx scripts/gen-client-catalog.ts --check` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/gen-doc-graphs.ts --check` — PASS; 8 graph docs up to date.
- `gtimeout 55s node_modules/.bin/tsx scripts/gen-module-graph.ts --check` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/doc-typecheck.ts` — PASS; 83 blocks compiled, 741 type-equiv/catalog blocks checked elsewhere, 905 paired derivatives.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-translation-pairing.ts` — PASS; 1024 pairs consistent.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-md-wrap.ts` — PASS; 2034 files checked.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-doc-refs.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-mermaid.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/gen-scoped-events.ts --check` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-public-repository-links.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-package-paths.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-config-source-ownership.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-package-readme-model-experience.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-agent-note-classification.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-agent-note-format.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-archived-agent-notes.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-skill-invocation-metadata.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-translation-prompt.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-doc-budgets.ts` — PASS.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-package-readme-limitations.ts` — PASS.
- `gtimeout 55s node_modules/.bin/vitest run scripts/project-doc-site.spec.ts scripts/verify-doc-site-fragments.spec.ts` — PASS; 64 tests.
- `gtimeout 55s node_modules/.bin/tsx scripts/verify-doc-site-fragments.ts` — PASS; 2410 fragment references resolve, 183 raw Markdown files and `llms.txt` emitted.

## Failed Leaf Checks

- `gtimeout 55s node_modules/.bin/tsx scripts/verify-md-links.ts` — FAIL. Broken relative links in `docs/plugin/superpowers/plans/2026-08-26-深度调研复评优化-plan.md`:
  - line 130: `../../README.md`
  - lines 164, 172: `../../00-背景与目标.md`
  - line 199: `../../01-目标架构.md`
  - line 226: `../../02-插件矩阵与择优.md`
  - line 261: `../../04-评测体系.md`
  - lines 271, 280: `../../05-安全供应链与风险.md`
- `gtimeout 55s node_modules/.bin/vitepress build website` — FAIL. Direct root binary path does not exist: `node_modules/.bin/vitepress`.

## Coverage Gaps

- Full `pnpm run doc-sync` did not execute its gate graph because `pnpm` fails during pre-run dependency status/install.
- Fresh VitePress build was not completed; only doc-site projection tests and fragment verification ran.
- Affected keyless snapshots were not yet run.
- TypeScript SDK expected-output snapshots under `examples/jsonrpc-agent/tests/sdk.snapshot.ts` were not yet run.
- Python SDK expected-output checks under `scripts/snapshots/python-sdk-single-exe/` were not yet run, though the local macOS runtime exe exists.
- Full `pnpm run typecheck`, `pnpm run lint`, `pnpm run duplication`, `pnpm run build`, and `pnpm run hygiene` were not yet run.

## Systematic Debugging Notes

### Failure: `pnpm run` / `pnpm exec` blocked before gates

Hypothesis 1: `.git/dsh-hooks` exists without the ownership marker expected by `scripts/install-lefthook.mjs`, so `postinstall` refuses to overwrite it.
Evidence: all affected commands fail at `. postinstall$ node scripts/install-lefthook.mjs` with `refusing to overwrite unowned hooks directory /Users/bytedance/opencode/agent/dsh/.git/dsh-hooks`; `find .git/dsh-hooks -maxdepth 1 -type f -print` printed no files.

Hypothesis 2: pnpm 11.7 is running its dependency status/install check before `run` and `exec`, and the attempted environment override did not disable it.
Evidence: both `pnpm run doc-sync` and `pnpm exec tsx --version` ran `pnpm install`; `env npm_config_verify_deps_before_run=false ...` still ran the same install path and failed at the same `postinstall`.

Suggested fix: inspect `scripts/install-lefthook.mjs` ownership criteria, then with explicit user approval either restore the expected owned hook metadata or move/remove the empty unowned `.git/dsh-hooks` directory. After that, rerun `pnpm run doc-sync` and the aggregate checks normally. Do not delete or overwrite the directory without user approval.

### Failure: `verify-md-links`

Hypothesis 1: the plan file was placed in `docs/plugin/superpowers/plans/`, but its links were authored as if the file lived directly under `docs/plugin/superpowers/`.
Evidence: every broken `../../*.md` target exists one directory up from the plan file as `../*.md`.

Hypothesis 2: generated plan/spec documents under `docs/plugin/superpowers/plans/` were added to the documentation tree even though they are planning artifacts, so ordinary Markdown gates now validate them.
Evidence: `git status` shows untracked `docs/plugin/superpowers/plans/` and `docs/plugin/superpowers/specs/`; `verify-md-links` scans them and fails on plan-internal task links.

Suggested fix: either adjust those links to `../README.md` and `../00-...md` style, or move planning/spec artifacts out of the tracked documentation tree if they are not intended to satisfy repository Markdown gates.

### Failure: direct VitePress invocation

Hypothesis 1: `vitepress` is a website workspace dependency, not a root binary, so the direct command used the wrong binary path.
Evidence: root `node_modules/.bin` did not list `vitepress`; `website/package.json` declares `vitepress` in its own `devDependencies`.

Hypothesis 2: the install state may be incomplete because pnpm's pre-run dependency check is blocked by `postinstall`, leaving the expected workspace binary unavailable.
Evidence: all pnpm script/exec paths attempt an install and fail before command execution.

Suggested fix: after resolving the pnpm hook-install blocker, run the official `pnpm run docs:build` / `pnpm run doc-sync` path. If direct execution is still needed, use the workspace-local VitePress binary or workspace exec path after verifying it exists.

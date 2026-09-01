# Task 19.4 CLI, PTY, and Documentation Verification

Date: 2026-08-26

Verdict: **PASS**

## Scope and constraints

This verification read `.trae/specs/integrate-curated-plugin-layer/{spec,tasks,checklist}.md`, the seven current `docs/plugin/superpowers/` planning documents and index, the current curated governance Agent Note triplet, the Agent Note rules, and the Round 4/Task 18 reports. It made no source edit, changed no task/checklist/progress file, and ran no `git commit`, `push`, `merge`, `rebase`, `reset`, `add`, `restore`, or index-writing command. This report is the only file created.

Every potentially long command used `timeout 50`, below the requested 55-second limit. The two source CLI smokes used isolated homes under `/tmp/dsh-task19-4-headless` and `/tmp/dsh-task19-4-curated`.

## Official headless CLI

Command:

```sh
timeout 50 env DSH_HOME=/tmp/dsh-task19-4-headless/home pnpm dsh --profile headless --help
```

Result: exit 0. The real source launcher printed `Usage: dsh --profile headless [options] [task...]`, the one-shot description, and `-h, --help`.

Command:

```sh
timeout 50 env DSH_HOME=/tmp/dsh-task19-4-headless/home pnpm dsh --profile headless --dump-config
```

Result: exit 0. The dump contained 333 lines, 10,569 bytes, six `# ==` layer markers, and SHA-256 `a0a0e9f380872097cb7f8b7356f36433a2afeb8de5044a9e63d4ed47b4bee9f5`. The materialized manifest was:

```json
{"name":"dsh-profile-headless","dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","@deepseek-ai/dsh-headless"]}}}
```

## Curated CLI and materialization

`web-personal` was selected because it is a real curated profile with no third-party candidate dependencies. It exercises curated materialization and the repository-owned base, Web app, and curated bundle layers without requiring installation or network access.

Command:

```sh
timeout 50 env DSH_HOME=/tmp/dsh-task19-4-curated/home pnpm dsh --profile web-personal --help
```

Result: exit 0. The real source launcher printed `Usage: dsh --profile web [options]` and the Web app help without starting the server.

Command:

```sh
timeout 50 env DSH_HOME=/tmp/dsh-task19-4-curated/home pnpm dsh --profile web-personal --dump-config
```

Result: exit 0. The dump contained 508 lines, 15,955 bytes, 25 `# ==` layer markers, and SHA-256 `75bc89ef46b50b86050448ec5e5fd44c43d0eec11990568bd2c4251408725dee`. Materialization created `.npmrc`, `cordis.patch.yml`, `cordis.yml`, `package.json`, and `pnpm-workspace.yaml`. The manifest was:

```json
{"name":"dsh-profile-web-personal","dependencies":{},"dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","@deepseek-ai/dsh-curated-base"]}}}
```

The generated `.npmrc` was `ignore-scripts=false`; the workspace selected `nodeLinker: hoisted` and `autoInstallPeers: false`.

## PTY and no-network proof

macOS `/usr/bin/script` allocated `/dev/ttys017`:

```sh
timeout 50 /usr/bin/script -q -e /tmp/dsh-task19-4-tty.typescript /usr/bin/tty
```

Result: exit 0 with `/dev/ttys017`.

An interactive `script -q /tmp/dsh-task19-4-pty-session.typescript` session then ran both help commands with `DEEPSEEK_API_KEY` explicitly removed. `dsh --profile headless --help` reported `headless_rc=0`; `dsh --profile web-personal --help` reported `curated_rc=0`; the shell then exited and `script` returned exit 0. Help handling exits before profile boot, so neither invocation submitted a model request, opened a listener, or started a browser.

In command mode, macOS `script` reported terminal stdin but relayed stdout through the capture pipe. The dedicated `tty` command above is the authoritative PTY allocation evidence.

## Browser applicability

The current `CURATED_PROFILE_TEMPLATES.web-personal.bundles` value is exactly:

```json
["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","@deepseek-ai/dsh-curated-base"]
```

Filtering the current catalog for candidates where `active && targetProfiles.includes("web-personal")` returned `[]`; the active UI/browser/client candidate subset was also `[]`. No curated candidate, including an intrusive UI candidate, was active in the tested profile. The command used `--help` and did not start the repository-owned Web server. Therefore no browser was started and Chrome CDP 9333 was not applicable under Task 19.4's conditional browser rule.

## Documentation and generated artifacts

Command:

```sh
timeout 50 pnpm run doc-sync
```

Result: exit 0; 28 passed, 0 failed, 0 skipped in 38.03 seconds. The run included documentation build/typecheck, links, wrapping, budgets, translation pairing, Agent Note checks, and generated graph/catalog freshness.

Focused bilingual and Agent Note checks:

- `pnpm run verify-translation-pairing packages/curated/README.md packages/curated/curated-bench/README.md packages/curated/curated-profiles/README.md packages/curated/curated-scripts/README.md .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md`: exit 0; five named pairs consistent.
- `pnpm run verify-agent-note-format`: exit 0; 605 notes conform.
- `pnpm run verify-agent-note-classification`: exit 0; 605 notes have consistent structure.
- `pnpm run verify-archived-agent-notes`: exit 0; 435 frozen artifacts across six kinds checked.

Focused generated-artifact checks:

- `pnpm run verify-doc-graphs`: exit 0; eight graph docs current.
- `pnpm run verify-cordis-catalog`: exit 0; 97 generated files/regions current.
- `pnpm run verify-config-catalog`: exit 0.
- `pnpm run verify-tool-catalog`: exit 0.
- `pnpm run verify-client-catalog`: exit 0.
- `pnpm run verify-persistence-catalog`: exit 0.
- `find packages/curated/curated-bench -type f -name '*.json' -exec jq empty {} +`: exit 0.
- Focused `Wave 3B audit date|keeps curated benchmark snapshots aligned` tests across `catalog.spec.ts` and `commands.spec.ts`: exit 0; two passed.

Current generated values are:

```text
curated-candidates.json: generatedAt=2026-08-26 candidateCount=37 activeCount=10 rejectedCount=26
locks/web-curated.json: createdAt=2026-08-26 candidateCount=37 activeCount=10
profiles/web-curated.json: createdAt=2026-08-26 bundleCount=13
```

## Stale-claim searches

A targeted search over all direct `docs/plugin/superpowers/*.md`, the curated README pairs, and the curated governance Agent Note pair rejected positive claims that smoke imports or initializes candidates, claims of 11 active candidates, claims that current admission is E3, and claims of automatic lock restoration. Result: `stale-claim-matches=0`.

Positive current-state searches confirmed:

- Smoke validates installed files and CLI dump/help but does not import or initialize candidate modules or start profile runtime.
- The repository has no persisted external-candidate E3 install/enable/restart/uninstall evidence.
- `evidenceKind: observed` remains an input-provider assertion, not authenticated producer identity.
- `web-research` uses the ten-candidate baseline; `web-enterprise` uses five build-free active candidates.

The three current curated generated artifacts contain no `2026-08-25`, `11 active`, or `"activeCandidates": 11` stale values.

## Git and staging boundary

`git rev-parse HEAD` returned `bfc3aa43b0b42871f02dd3dde8b5a4654cb89e7e`. `git diff --cached --quiet -- docs/plugin/superpowers .trae/specs` exited 0 and reported `planning-staged-paths=0`. The planning paths remain only unstaged or untracked, including this report. `git diff --cached --check` exited 0.

The worktree was already broadly dirty before this verification. Existing changes were preserved, and no staging or history operation was performed.

## Verifier diagnostics

Three initial evidence wrappers failed after successful underlying operations: one searched for obsolete `# source:` dump markers instead of the actual `# ==` markers, one assigned zsh's read-only `status` variable, and one stale-claim regex crossed multiple facts on a single physical Markdown line. A first JSON summary also queried nonexistent top-level count fields and printed `null`. The commands above are the corrected independent reruns; all underlying acceptance checks exited 0.

## Conclusion

Task 19.4's independent CLI/PTy and documentation verification passes. Official headless and locally materialized curated help/config surfaces work, the PTY path enters and exits without a model call, no active UI candidate makes CDP 9333 applicable, documentation and generated artifacts are current, relevant bilingual and Agent Note checks pass, and planning/spec paths remain outside the index.

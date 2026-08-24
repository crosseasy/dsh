# Errors

Command failures and integration errors captured during development.

---

## [ERR-20260822-002] doc-sync

**Logged**: 2026-08-22T14:13:00Z
**Priority**: high
**Status**: resolved
**Area**: docs

### Code Mode Failure

The aggregate `pnpm run doc-sync` exceeded the user's one-minute command limit.

### Error

```text
run-gates: 28 passed, 0 failed, 0 skipped in 76.22s.
```

### Context

- The command completed successfully, but its elapsed time violated the explicit per-command budget.
- The individual documentation gates are independently invocable.

### Suggested Fix

Run the relevant `doc-sync` child gates separately with bounded waits instead of invoking the aggregate command in this workspace.

### Metadata

- Reproducible: yes
- Related Files: scripts/run-gates.ts

### Code Mode Resolution

- **Resolved**: 2026-08-22T14:13:00Z
- **Notes**: All subsequent verification uses individual child gates or commands known to finish below one minute.

---

## [ERR-20260822-002] doc-sync

**Logged**: 2026-08-22T14:12:20Z
**Priority**: medium
**Status**: resolved
**Area**: docs

### Summary

The aggregate `doc-sync` command exceeded the user's one-minute command limit.

### Error

```text
run-gates: 28 passed, 0 failed, 0 skipped in 76.22s.
```

### Context

- The command completed successfully but ran longer than the permitted foreground duration.
- Its 28 independent gates can be invoked separately when a strict one-minute ceiling applies.

### Suggested Fix

Run the relevant `doc-sync` leaf gates separately and keep each invocation below 60 seconds.

### Metadata

- Reproducible: yes
- Related Files: scripts/run-gates.ts

### Resolution

- **Resolved**: 2026-08-22T14:12:20Z
- **Notes**: Subsequent documentation verification uses leaf commands instead of the aggregate.

---

## [ERR-20260822-001] integrated_code_mode

**Logged**: 2026-08-22T13:14:06Z
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary

The code-mode runtime did not expose the deferred multi-agent tool discovered by `tool_search`.

### Error

```text
TypeError: tools.integrated_multi_agent_v2_spawn_agent is not a function
```

### Context

- Attempted to dispatch six independent review agents through `integrated_code_mode.Exec`.
- `ALL_TOOLS` contained no agent tool, so the discovered multi-agent namespace must be called directly.

### Suggested Fix

Use `integrated_multi_agent_v2.spawn_agent` directly when the agent tool is absent from `ALL_TOOLS`.

### Metadata

- Reproducible: yes
- Related Files: none

### Agent Tool Resolution

- **Resolved**: 2026-08-22T13:14:06Z
- **Notes**: Switched to the directly exposed deferred tool namespace.

---

## [ERR-20260822-002] verify_translation_pairing_args

**Logged**: 2026-08-22
**Priority**: low
**Status**: resolved
**Area**: docs

### Pairing Invocation Error

`verify-translation-pairing.ts` treats `--` as an unknown flag when invoked through `pnpm run`.

### Pairing Invocation Resolution

Invoked the script directly with `pnpm exec tsx` and positional document paths; all 9 scoped pairs passed.

---

## [ERR-20260822-003] zsh_inline_javascript_expansion

**Logged**: 2026-08-22
**Priority**: low
**Status**: resolved
**Area**: tooling

### Shell Quoting Failure

An inline `node -e` verification used a JavaScript template literal inside a double-quoted zsh argument, so zsh expanded `${...}` and failed with `bad substitution`.

### Shell Quoting Resolution

Use a single-quoted JavaScript argument or avoid template literals in inline shell commands.

---

## [ERR-20260822-004] zsh_read_only_status

**Logged**: 2026-08-22
**Priority**: low
**Status**: resolved
**Area**: tooling

### Zsh Variable Failure

A shell verification assigned to `status`, which is a read-only special parameter in zsh.

### Zsh Variable Resolution

Use a neutral local name such as `code` for captured exit status.

---

## [ERR-20260822-005] markdownlint_cli_unavailable

**Logged**: 2026-08-22
**Priority**: low
**Status**: resolved
**Area**: tooling

### Markdown Linter Availability

`pnpm exec markdownlint-cli2` failed because this workspace does not install that command.

### Markdown Linter Resolution

Use the repository's own document gates and direct structural checks instead of assuming a standalone Markdown linter is available.

---

## [ERR-20260822-006] jq_scope_in_array_membership

**Logged**: 2026-08-22T14:18:18Z
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary

A `jq` validation expression evaluated `.severity` after changing the input to the allowed-values array.

### Error

```text
jq: error: Cannot index array with string "severity"
```

### Context

- Attempted to validate JSONL severity membership with `(["P0","P1","P2"] | index(.severity))`.
- The pipe changed `.` from the finding object to the array before `.severity` was evaluated.

### Suggested Fix

Bind the finding severity before constructing the array, for example `.severity as $severity | ["P0","P1","P2"] | index($severity)`.

### Metadata

- Reproducible: yes
- Related Files: .superpowers/sdd/ralph2-final-code-review/postfix/comments.jsonl

### Resolution

- **Resolved**: 2026-08-22T14:18:18Z
- **Notes**: Reran validation with the severity value bound before the array pipeline.

---

## [ERR-20260822-007] code_mode_missing_spawn_agent

**Logged**: 2026-08-22
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary

`integrated_code_mode.Exec` did not expose the discovered `spawn_agent` function and failed with `TypeError: tools.spawn_agent is not a function`.

### Resolution

Use the direct `integrated_multi_agent_v2.spawn_agent` interface when Code Mode does not list the subagent function.

---

## [ERR-20260822-008] npm_packument_fetch_timeout

**Logged**: 2026-08-22
**Priority**: low
**Status**: resolved
**Area**: tooling

### Registry Query Failure

A direct Node `fetch` of 20 npm packuments timed out during connection establishment and returned no partial result.

### Registry Query Resolution

Use the workspace package manager's configured registry path (`pnpm view`) with bounded parallelism when direct registry fetches cannot connect.

---

## [ERR-20260822-009] zsh_backtick_expansion

**Logged**: 2026-08-22T16:10:15Z
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary

A read-only `rg` pattern used Markdown backticks inside a double-quoted zsh argument, so zsh attempted command substitution.

### Error

```text
zsh: command not found: 1.3
zsh: command not found: 9333
```

### Context

- The failed commands only searched documentation and did not write files.
- Markdown literals containing backticks were embedded directly in double-quoted shell patterns.

### Suggested Fix

Use single-quoted shell patterns for Markdown literals that contain backticks.

### Metadata

- Reproducible: yes
- Related Files: none

### Resolution

- **Resolved**: 2026-08-22T16:10:15Z
- **Notes**: Subsequent searches use single-quoted patterns.

---

## [ERR-20260823-004] macos_tmpdir_cleanup_race

**Logged**: 2026-08-23
**Priority**: medium
**Status**: resolved
**Area**: testing

### Cleanup Race Summary

A failed Fusion authorization mutation left a temporary profile after `fs.rm()` raced with the local Git trace daemon creating `.git/ai/working_logs`.

### Cleanup Race Resolution

Check the actual `os.tmpdir()` path on macOS, not only `/private/tmp`. Recursive test-fixture cleanup uses bounded `ENOTEMPTY` retries, and mutation evidence is accepted only when stderr has no cleanup failure and no matching temporary root remains.

---

## [ERR-20260823-001] stale_exec_session_poll

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Stale Session Summary

A short read-only command returned no output, and a follow-up poll used an execution id that had already expired.

### Stale Session Resolution

Poll only when the command result explicitly reports `Process running with session ID`.

---

## [ERR-20260823-002] pnpm_virtual_store_path_assumption

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Virtual Store Summary

A read-only search assumed `node_modules/@vitest/runner` existed as a direct path, but pnpm had not linked that package at the root.

### Virtual Store Resolution

Use the installed `vitest` declaration bundle or resolve pnpm packages through their actual linked path before searching.

---

## [ERR-20260823-003] typescript_files_with_project_config

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### TypeScript Command Summary

TypeScript 6 rejected an ad hoc `tsc --noEmit <files>` invocation because the repository has a `tsconfig.json` and explicit files require `--ignoreConfig`.

### TypeScript Command Resolution

Use the repository's compiler-face commands (`pnpm run typecheck`) for authoritative checking; use `--ignoreConfig` only for an intentionally standalone probe.

---

## [ERR-20260823-005] tsx_eval_top_level_await

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Eval Mode Summary

`pnpm exec tsx -e` compiled a temporary lifecycle probe as CommonJS and rejected top-level `await`.

### Eval Mode Resolution

Run ESM probes with `node --import tsx/esm --input-type=module -e`; the unchanged probe then completed and reported the expected serial disposal order.

---

## [ERR-20260823-006] pnpm_argument_separator_forwarding

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### CLI Invocation Summary

`pnpm run verify-translation-pairing -- <paths>` forwarded the separator itself, which the repository script rejected as an unknown flag. A later `--cached` invocation also failed when it omitted the required staged pair paths.

### CLI Invocation Resolution

Invoke the TypeScript verifier directly with `pnpm exec tsx scripts/verify-translation-pairing.ts <flags> <paths>`; both worktree and `--cached` checks then passed.

### Metadata

- Recurrence-Count: 2

---

## [ERR-20260823-007] bsd_awk_capture_groups

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Portability Summary

macOS BSD `awk` rejected the GNU-style third argument to `match()` in a staged-blob comparison.

### Portability Resolution

Use `split(field, parts, /\.\./)` for the blob range; the portable comparison confirmed all 41 authority-package target blob IDs match the index.

---

## [ERR-20260823-008] oxlint_void_resolver_type

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Lint Summary

The focused Oxlint run rejected `Promise.withResolvers<void>()` under `typescript/no-invalid-void-type`.

### Lint Resolution

Use `Promise.withResolvers<undefined>()` for a notification promise with no payload and call `resolve(undefined)` explicitly.

---

## [ERR-20260823-009] zsh_path_loop_variable

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Shell Variable Summary

A zsh loop used `path` as its item variable while generating a review package. In zsh, `path` is tied to `PATH`, so the first assignment removed command lookup and made later commands fail. The same mistake recurred in a staged-blob verification loop on 2026-08-23.

### Shell Variable Resolution

Never use zsh's special `path` variable for assignments or loop variables; use a name such as `file_path`. Regenerate incomplete output or rerun read-only verification from scratch after the failure.

### Metadata

- Reproducible: yes
- Recurrence-Count: 2

---

## [ERR-20260823-010] testing_doc_budget

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: documentation

### Budget Summary

Expanding the Fusion cleanup description added exactly 13 words beyond `docs/testing.md`'s 1,150-word ceiling.

### Budget Resolution

Keep the detailed timeout contract in the owning CI Agent Note and summarize it in `docs/testing.md`; the document budget and full translation-pair check then passed.

---

## [ERR-20260823-011] zsh_readonly_status

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Shell Variable Summary

A zsh verification script tried to assign a command exit code to `status`, which is a read-only special parameter.

### Shell Variable Resolution

Use a neutral name such as `exit_code` when capturing command status in portable shell snippets.

---

## [ERR-20260823-012] vitest_temporary_root_discovery

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: testing

### Test Discovery Summary

A V7/V8 red-check placed the temporary spec under `.superpowers/`, which did not match the repository Vitest include globs. Changing Vitest's root then inherited missing workspace setup and package-resolution assumptions, so both attempts collected zero tests.

### Test Discovery Resolution

Use a temporary config with the repository root, its TypeScript path and decorator plugins, and an explicit include for the temporary spec. The corrected run collected 71 tests and failed only the intended regression.

---

## [ERR-20260823-013] markdownlint_cli_unavailable

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Tool Availability Summary

An optional artifact-only check invoked `pnpm exec markdownlint-cli2`, but the repository does not install that command.

### Tool Availability Resolution

Do not report the optional command as evidence. Use the repository-owned Markdown checks and editor diagnostics instead of assuming a generic linter is available.

---

## [ERR-20260823-014] deferred_multi_agent_exec_visibility

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary

`integrated_code_mode.Exec` did not expose the deferred `integrated_multi_agent_v2` methods through `tools`.

### Error

```text
TypeError: tools.spawn_agent is not a function
```

### Context

- The multi-agent namespace had been discovered with `tool_search`, but `ALL_TOOLS` inside Exec contained no agent methods.
- No workspace mutation occurred before the call failed.

### Suggested Fix

Call the discovered `integrated_multi_agent_v2` tools directly when they are absent from `ALL_TOOLS`.

### Metadata

- Reproducible: yes
- Related Files: `.learnings/ERRORS.md`

---

## [ERR-20260823-015] code_mode_regex_file_path_enotdir

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Regex Search Failure

`search_by_regex` failed with `spawn ENOTDIR` when a parallel call used a
single file as `search_directory_or_file`.

### Regex Search Resolution

Use repository-directory searches or `rg` through `run_command` when the
search target is a single file. Do not retry the same failing tool call.

---

## [ERR-20260823-016] completed_agent_status_stale

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Agent Follow-Up Failure

`list_agents` still reported a notified-complete agent as `running`, but
`followup_task` rejected it because the target had finished.

### Agent Follow-Up Resolution

Treat completion notifications as authoritative and spawn a new focused fixer
instead of relying on stale list status.

---

## [ERR-20260823-017] readonly_audit_used_write_tree

**Logged**: 2026-08-23
**Priority**: high
**Status**: resolved
**Area**: git

### Read-Only Audit Violation

A read-only verification pre-audit invoked `git write-tree`. The command
returned the existing `HEAD^{tree}` object and did not change refs, the index,
or the worktree, but it can write an object and therefore violates a strict
read-only audit.

### Read-Only Audit Resolution

Fingerprint the index with `git ls-files -s | shasum -a 256` and use
`git rev-parse HEAD^{tree}` only for the committed tree. Exclude
`git write-tree` from verification procedures.

---

## [ERR-20260823-018] translation_pairing_extra_separator

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: documentation

### Pairing Command Failure

A named `verify-translation-pairing` invocation passed an extra `--`; the
repository script rejected the unknown flag with exit code 2.

### Pairing Command Resolution

Pass the named document paths directly after the script name. The corrected
command completed successfully.

---

## [ERR-20260823-019] process_probe_self_match_exposed_environment

**Logged**: 2026-08-23
**Priority**: high
**Status**: resolved
**Area**: security

### Process Probe Failure

A `ps ... | rg '<command pattern>'` probe matched its own shell wrapper. The
internal tool output therefore included the wrapper's expanded environment.
No output was written to workspace evidence or repeated to the user.

### Process Probe Resolution

The issue recurred with `pgrep -f` because the wrapper command line contained
the search pattern. Use only a known PID, a listening-port owner, or exact
process-name matching that does not inspect the wrapper's full command line.
Never persist or quote self-matched shell command lines from process probes.

---

## [ERR-20260823-020] runtime_evidence_copy_quoting

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Evidence Copy Failure

A Task 35 auxiliary evidence-copy command had invalid nested shell quoting and
failed during parsing before performing file operations.

### Evidence Copy Resolution

The runtime verifier used an equivalent command without nested quoting and
copied the intended 33 evidence files. Runtime checks and cleanup were
unaffected.

---

## [ERR-20260823-021] status_search_unescaped_group

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Status Search Failure

An `rg` alternation contained an unescaped literal opening parenthesis and
failed with `regex parse error: unclosed group`.

### Status Search Resolution

Use repeated fixed-string `-e` patterns for status phrases that contain
punctuation. The corrected search located every stale Task 35 status.

---

## [ERR-20260823-022] zsh_reserved_path_variable

**Logged**: 2026-08-23
**Priority**: low
**Status**: resolved
**Area**: tooling

### Reconciliation Probe Failure

A post-close helper used zsh's reserved `PATH` variable for a temporary path,
invalidating the first excluded-drift probe. The issue later recurred with
lowercase `path`, which is tied to `PATH` in zsh.

### Reconciliation Probe Resolution

Use neutral names such as `candidate_file` for scalar path variables in zsh.
Both verifiers renamed the variable and reran the probes successfully; the
failed outputs were not used as evidence.

---

## [ERR-20260824-001] translation_pairing_and_finished_agent_followup

**Logged**: 2026-08-24
**Priority**: low
**Status**: resolved
**Area**: tooling

### Tooling Failure Summary

A verifier was mistakenly delegated `pnpm run verify-translation-pairing -- <pair>`.
pnpm 11.7.0 forwarded the bare `--`, and the script correctly reported
`unknown flag(s): --`. A `followup_task` call also failed because its subagent
had already finished.

### Tooling Resolution

Use `pnpm run verify-translation-pairing <pair>`, which passed. Spawn a new
verifier instead of calling `followup_task` on a finished subagent.

---

# Task 20.2 Fix Report

Date: 2026-08-26

## Scope and method

This report records the Task 20.2 security, code-quality, and specification fixes. Each defect class follows systematic debugging and strict test-driven development: at least two hypotheses are evaluated, a focused regression test is observed failing for the expected reason, the minimum production change is applied, and the same test is observed passing.

The existing Task 20 specification is the design authority. Managed profiles retain npm SRI or exact Git commit verification and bind executable admission to selected catalog ownership. Every active candidate additionally pins a catalog-owned direct-candidate tree digest. Explicit unmanaged artifact roots remain metadata-only, and package-authored standalone acquisition sidecars cannot establish observed success.

## 1. Effective entry ownership

### 1A. Hypotheses

1. **Selected:** ownership is tracked during composition, but observed preflight validates only optional `config.curated` claims and never rejects an enabled executable row whose owner is the profile or an unapproved bundle. Evidence: profile-inserted rows receive `profile:<name>` ownership, `readCuratedEntry()` returns no issue when `config.curated` is absent, and no later check rejects that owner.
2. The Loader may erase all source ownership during overrides, making ownership enforcement impossible. Rejected: `composeObservedEntries()` places a temporary token on inserted rows, collects it into a `WeakMap`, and existing ID-only override tests show bundle ownership survives composition.

### 1B. TDD evidence

- RED: four focused cases showed that enabled executable rows inserted by profile and home patches were accepted and explicit overlays were unsupported; the disabled fallback control passed.
- GREEN: five focused cases passed after all three user-controlled layers were composed and enabled executable rows required approved catalog or installation-owned provenance; the catalog-owned nested override remained accepted.

## 2. Installed artifact tree integrity

### 2A. Hypotheses

1. **Selected:** lock verification authenticates npm resolution metadata or Git identity, but installed package bytes are checked only through selected manifest fields and file existence; package-authored standalone sidecars are accepted as provenance. Evidence: `createInstalledArtifactResolver()` reads `.dsh-curated-artifact.json`, while `inspectResolvedArtifact()` never hashes the installed tree.
2. Existing npm SRI or Git commit checks already authenticate the installed directory after extraction. Rejected: both checks authenticate the package-manager resolution record, not the bytes currently present under `node_modules`; modified main, patch, manifest, or extra executable files retain the same lock metadata.

### 2B. TDD evidence

- RED: catalog validation accepted active candidates with missing, malformed, or placeholder tree digests; verify-lock, observed preflight, and observed smoke accepted modified main, patch, and manifest bytes plus added or removed files; a package-authored sidecar could still yield observed success without an external byte expectation.
- GREEN: every active candidate now records `treeSha256`. All three observed commands recompute SHA-256 over sorted UTF-8 POSIX relative paths and raw file bytes, reject any mismatch, and require the catalog digest in addition to npm SRI or an exact Git commit. Explicit unmanaged roots report `observed: false` and select no artifacts. The six active catalog values were computed from the isolated audited installation.

## 3. Secret-shaped YAML diagnostic redaction

### 3A. Hypotheses

1. **Selected:** command redaction consumes only the first whitespace-delimited token after a YAML key, and policy redaction replaces only messages matching a narrow token pattern. Evidence: `apiKey: correct horse battery staple` leaves a suffix in command diagnostics, while policy `redactSecretText()` returns the complete YAML code frame unchanged.
2. `js-yaml` omits source lines from parser errors, so scalar-aware redaction is unnecessary. Rejected: Task 20 probes show parser exceptions include source code frames with the malformed line and continuation marker.

### 3B. TDD evidence

- RED: 17 focused cases exposed complete code frames in policy diagnostics, erased unrelated parser context, or retained scalar suffixes, single-line and multiline quoted values, block continuations, auth values, and PEM payloads in command diagnostics.
- GREEN: 19 focused cases passed after both loaders used the original YAML to redact secret-bearing code-frame lines and continuations while preserving unrelated lines, locations, and caret context. Explicit indentation and chomping indicators are covered.

## 4. Malformed effective entries

### 4A. Hypotheses

1. **Selected:** malformed rows are silently removed before composition and during nested traversal. Evidence: `loadPatchLayer()` returns `parsed.filter(isRecord)`, while nested `insert` and group `config` traversal also uses `filter(isRecord)`.
2. `entryListSchema` rejects all non-record rows before these filters run. Rejected: the existing test deliberately supplies `- malformed` and observes accepted preflight.

### 4B. TDD evidence

- RED: focused Vitest failed top-level, nested, and config-only override cases because scalar rows were silently filtered before or after composition.
- GREEN: seven focused cases passed after patch validation rejected malformed inserts and final-tree validation rejected malformed top-level, grouped, deeply nested, config-only override, and installation-owned entries.

## 5. Artifact path containment and file bounds

### 5A. Hypotheses

1. **Selected:** lexical path checks do not establish package ownership. Evidence: drive, UNC, and mixed separators are not all rejected, `resolve()` does not prevent symlink escape, and callers accept existence without requiring a bounded regular file.
2. Catalog ownership makes path values trusted enough for lexical validation. Rejected: installed `package.json` supplies `main` and `dsh.bundle.patch`, so a modified package can redirect inspection outside its canonical package directory.

### 5B. TDD evidence

- RED: focused cases accepted manifest, bundle-patch, and main paths that used Windows drive, UNC, or mixed separators on macOS; symlinks could resolve outside the package; FIFO and oversized main files reached artifact validation without a regular-file or byte-bound rejection.
- GREEN: managed package roots must remain under the canonical profile `node_modules` root. Package files are canonicalized, opened with no-follow where supported, checked with descriptor `fstat()` before and after bounded reads, and rejected when they are symlinks, non-regular, over 16 MiB, part of a tree over 64 MiB, or changed during the read. Portable path and containment checks run on every host.

## 6. Runtime dependency lock provenance

### 6A. Hypotheses

1. **Selected:** direct candidate resolution is validated, but no code traverses its runtime dependency graph. Evidence: the registry and Git lock readers return after checking one importer and one package record.
2. The catalog's direct `externalDependencies` names are sufficient provenance. Rejected: names do not bind versions, registry integrity, Git commits, optional descendants, or root/installed lock agreement.

### 6B. TDD evidence

- RED: a managed npm candidate remained accepted when a reachable registry dependency lacked integrity, used `latest`, omitted a nested resolution, or when a reachable Git resolution used a floating commit. A root/installed closure mismatch was also accepted.
- GREEN: both pnpm v9 locks are traversed from each selected candidate through `dependencies` and `optionalDependencies`, including peer-suffixed snapshot keys. Every reachable registry locator must use an exact version with SRI; every reachable Git locator must use an immutable full commit or commit-addressed GitHub tarball. Missing records and differing root/installed closures fail.

## 7. Security model

pnpm verifies registry archive integrity while installing. Observed admission validates the complete reachable dependency lock provenance and detects direct candidate-tree tampering with the catalog-owned digest. It does not claim to detect an attacker who can rewrite arbitrary transitive dependency files after installation. No transitive catalog tree-hash inventory was added.

## 8. Smoke total deadline

### 8A. Hypotheses

1. **Selected:** synchronous artifact inspection runs in the parent before any cancellable wait, so the claimed 55-second total deadline cannot interrupt blocked or slow filesystem work. Evidence: `inspectInstalledSmokeProfile()` completes before `settleBeforeDeadline(Promise.resolve(), deadline)`.
2. The post-inspection monotonic check is sufficient because local filesystem reads are bounded. Rejected: no file-size bound exists and local paths may reside on slow or network-backed filesystems; a post-hoc timeout is not a total execution deadline.

### 8B. TDD evidence

- RED: `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'terminates blocked observed staging' --reporter=dot` failed because the parent returned the ordinary bundle-list validation error instead of timing out the blocking staging worker.
- GREEN: the same focused test passed after production observed staging moved to a worker. The execution budget starts at function entry; after synchronous worker construction returns, inspection and result collection use the recomputed remainder. The test uses a worker blocked in `Atomics.wait()`, observes the timeout in under one second, then completes a second smoke call to prove no referenced worker or timer remains live.
- BUILT GREEN: `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/packed-entry.e2e.ts --config vitest.e2e.config.ts --reporter=dot` passed after the packed command invoked the emitted `lib/staging-worker.js` before its consumer-local fake DSH bin.

## 9. Rollback baseline binding

### 9A. Hypotheses

1. **Selected:** snapshot envelopes validate internal digests and kinds but not the compared baseline profile or the baseline's snapshot references. Evidence: `readRollbackSnapshot()` accepts any non-empty `snapshot.profile`, and `validateComparableProfiles()` never compares references or profile names.
2. The digest implicitly binds snapshots to the benchmark baseline. Rejected: the digest authenticates only the caller-supplied embedded object; a valid digest can describe an unrelated profile.

### 9B. TDD evidence

- RED: four focused cases showed that validly digested snapshots and references for unrelated profiles were accepted.
- GREEN: seven focused comparison cases passed after snapshot profiles and baseline reference filenames were bound to `baseline.profile`.

## 10. Dependency lifecycle execution

### 10A. Hypotheses

1. **Selected:** script suppression was an enterprise-only template setting, while the CLI delegated installation without an independent command-level prohibition. Evidence: four templates wrote `ignore-scripts=false`, and `runPlugin()` passed caller arguments directly to pnpm.
2. Removing build grants alone prevents lifecycle execution. Rejected: pnpm versions before build allowlists execute lifecycle scripts by default, and an existing `.npmrc` could explicitly enable them.

### 10B. TDD evidence

- RED: all-profile materialization expected `ignore-scripts=true` but received `false` for `web-curated`; unsafe existing files, including manifest-level build grants, were preserved and accepted. An isolated pnpm 9 install executed a fixture package's `postinstall` and created its sentinel.
- GREEN: every template writes `ignore-scripts=true`; existing script-enabled files and true workspace- or manifest-level build grants reject before writes; observed preflight rejects the same state. `dsh plugin` forces `--config.ignore-scripts=true` and `npm_config_ignore_scripts=true`, rejects caller overrides, and the pnpm 9 fixture installs without creating the sentinel.

## 11. Package transformation provenance

### 11A. Hypotheses

1. **Selected:** workspace package transformations were outside admission, and registry resolution truncated every parenthesized locator suffix as peer context. Evidence: `patchedDependencies` and `packageExtensions` were not read, while `1.0.0(patch_hash=...)` reduced to `1.0.0`.
2. The installed direct-candidate tree digest makes patch metadata irrelevant. Rejected: package-manager transformations can affect reachable runtime packages and executable resolution outside the direct candidate directory.

### 11B. TDD evidence

- RED: observed commands accepted a direct npm locator with `patch_hash`, lockfile `patchedDependencies`, `packageExtensionsChecksum`, or `pnpmfileChecksum` metadata, and profile workspace `patchedDependencies`, `packageExtensions`, or pnpmfile hooks.
- GREEN: managed admission rejects all of those transformations and preserves ordinary peer suffix handling. Materialization applies the same fail-closed policy without deleting or rewriting unsafe user files.

## 12. Disabled admission and malformed-YAML redaction

### 12A. Hypotheses

1. **Selected:** preflight treated only absent and literal-false `disabled` values as active, while Cordis Loader coerces ordinary values and evaluates `!!js`; unapproved rows with `null`, `0`, an empty string, or a dynamic expression could therefore evade ownership admission before Loader execution.
2. Loader rejected non-boolean `disabled` values before mounting. Rejected: a real nested Loader composition mounted absent, `false`, `null`, `0`, empty-string, and dynamic-false rows, skipped literal-true and dynamic-true rows, and evaluated both dynamic expressions.
3. **Selected:** malformed-YAML sanitization recognized only complete secret-key spellings and could leave block continuations or values under prefixed and suffixed keys in parser code frames.
4. Generic token-pattern replacement covered all malformed-YAML values. Rejected: exact probes exposed `registryToken` in policy diagnostics and a second block-scalar line in both policy and command diagnostics.

### 12B. TDD evidence

- RED: the real-Loader/preflight regression showed that nested unapproved `null`, `0`, empty-string, and `!!js` rows were omitted from ownership failures; exact malformed-YAML probes exposed the values described above.
- GREEN: observed admission treats every `disabled` value except literal `true` as active or potentially active and rejects dynamic expressions before Loader evaluation. Permission providers separately retain the stricter absent-or-literal-false requirement through every ancestor. Both YAML loaders replace complete scalar and block values for keys containing token, key, secret, password, cookie, credential, or auth variants while retaining line, caret, and unrelated context.

## 13. Task 20.2 follow-up hypotheses

These hypotheses were recorded before the follow-up regression tests or production edits.

### 13A. Group admission before Loader import

1. **Selected:** Cordis imports and mounts a group even when its raw entry has `disabled: true`, because `Entry._disabled()` returns `false` for every truthy `group` before consulting `disabled`. Observed admission must therefore validate every composed group independently of disabled state.
2. Literal `disabled: true` prevents the group module import and only descendants need ownership checks. Rejected by the Loader source: groups are always enabled, while descendant disablement is derived from ancestor options only after the group exists.
3. The current follow-up condition is too strict in the opposite direction because it rejects a group owned by an approved catalog candidate. The required allowlist is approved catalog ownership **or** installation ownership, for both groups and executable plugin rows.

### 13B. Dynamic YAML tags in user-controlled layers

1. **Selected:** parsing profile, home, and overlay patches with the Loader schema can construct `!!js` nodes before ownership is inherited from an approved row; checking the composed row's owner afterward cannot make the expression safe. These layers must reject dynamic tags while reading YAML.
2. Ownership inheritance from an approved `id` and `name` is enough because Loader evaluates only `disabled`. Rejected: Loader also evaluates plugin config, and user layers can replace `name`, `config`, or nested group content before Loader import.
3. Installation-owned and approved catalog bundle patches are trusted code-bearing inputs and may retain repository-approved dynamic tags. Static user overrides remain valid.

### 13C. Package-manager dependency overrides

1. **Selected:** package-manager policy checks are conditional on the five built-in curated profile names, so a managed observed profile with another name can retain `pnpm.overrides` or the equivalent workspace override and still reach lock/artifact resolution.
2. Lockfile `overrides` fields are sufficient evidence of every active override. Rejected: pnpm can read overrides from root `package.json` or `pnpm-workspace.yaml`, and an existing or hand-produced lock need not carry a trustworthy matching field.
3. Materialization already checks its five supported profiles, but verify-lock, observed preflight, and observed smoke need the same fail-closed rule for every managed profile root before installation or execution.

### 13D. Escape-aware malformed-YAML redaction

1. **Selected:** the current formatter avoids leakage by deleting the entire source snippet, so it neither preserves required non-secret context nor proves escape-aware key classification. Reintroducing a code frame requires decoding quoted YAML keys before classifying them and marking every scalar continuation line.
2. Matching the rendered exception text with a regular expression is sufficient. Rejected: escaped Unicode and escaped quotes hide the semantic key from text regexes, while multiline quoted, plain, and block scalars place secret suffixes on later code-frame lines.
3. Redacting complete source lines identified from the original YAML while retaining line prefixes and the caret preserves useful parser location/context without retaining any scalar fragment.

### 13E. Smoke total deadline

1. **Selected:** a Promise race cannot interrupt synchronous artifact inspection in the parent thread. Production observed staging must execute in a worker or child process whose inspection can be terminated when the execution budget expires.
2. File-size bounds make synchronous inspection bounded enough. Rejected: opening or reading a FIFO, device, or slow filesystem entry can block before the regular-file and size checks complete.
3. Trusted in-process test hooks may keep their current direct path, but the real observed CLI path must serialize only profile paths and bundle names into the isolated staging process.

### 13F. Rollback baseline binding recheck

1. **Selected for verification only:** `validateComparableProfiles()` already binds both embedded snapshot profiles and both baseline snapshot filenames to `baseline.profile`; the existing four negative tests cover each relation.
2. Digest validation alone provides the binding. Rejected by the existing tests and implementation: a valid digest authenticates an unrelated snapshot unless the explicit profile/reference comparisons run.

### 13G. Follow-up RED/GREEN evidence

- **Group and dynamic YAML RED:** `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'matches Loader disabled semantics|accepts complete disabled, grouped|dynamic YAML|approved catalog-owned group' --reporter=dot` failed three cases: catalog-owned groups were rejected and catalog-owned `!!js` was rejected. The real Loader assertion proved a `disabled:true` group still had a live fiber.
- **Group and dynamic YAML GREEN:** the same command passed 9 tests after candidate and installation bundle patches were allowed to carry audited expressions, candidate-owned groups were admitted, and every user-controlled profile/home/overlay `!!js` remained rejected before Loader evaluation.
- **Override RED:** `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'managed custom profile' --reporter=dot` failed both custom-profile cases because verify-lock accepted root-manifest and workspace overrides.
- **Override GREEN:** the same command passed two tests after every managed `dsh.profile` root rejected package transformations independently of the five template names. The tests require verify-lock, observed preflight, and observed smoke to reject before the smoke runner is called.
- **YAML redaction RED:** the policy and command invocations filtered by `escape-aware secret values` each failed six cases because the formatter omitted the complete code frame instead of preserving redacted context.
- **YAML redaction GREEN:** both filtered commands passed after quoted YAML keys were decoded with the failsafe schema, undecodable secret-shaped keys fell back conservatively, and complete scalar/continuation lines were replaced. Cases cover Unicode escapes, escaped quotes, `registryToken`, `serviceApiKey`, block scalars, PEM bodies, full original values, and multiword suffixes.
- **Rollback recheck GREEN:** `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'mismatched rollback|digest does not match|computes statistics' --reporter=dot` passed six tests. No rollback production change was needed.

## 14. Task-level rereview hypotheses

These hypotheses were recorded before the task-level rereview regression tests or production edits.

### 14A. Installation-owned bundle shadowing

1. **Selected:** observed profile loading sends installation-owned package names through the same profile-first resolver as unknown local packages, then derives `installationOwned` from the requested name rather than the resolved package directory. A profile-local package can therefore supply the trusted patch and seed owner inheritance.
2. Owner inheritance by effective entry `id` and `name` is independently enough to grant installation ownership to an unrelated profile row. Rejected as the primary cause: inheritance is required for legal static overrides, and it becomes unsafe here only because the profile-local shadow was admitted as the installation-owned source.
3. The regression discriminator is a profile-local fake `@deepseek-ai/dsh-base` with an audited-only `!!js` value plus a malicious entry, followed by a profile insertion with the same `id` and `name`. Correct installation-anchor resolution ignores the fake package and rejects the profile insertion as unapproved.

### 14B. Explicit YAML mapping-key redaction

1. **Selected:** secret-line discovery handles only implicit `key: value` mappings. YAML's explicit `? key` and `: value` syntax separates classification from the scalar line, so no secret state reaches the value or its continuations.
2. `js-yaml` omits explicit mapping values from malformed-input snippets. Rejected by a direct parser probe: the exception snippet contains the explicit key, complete value line, malformed line, and caret.
3. The regression discriminator covers plain, quoted, escaped-key, folded, block, and multiline quoted values in both policy and command diagnostics. Every secret suffix must be absent while the malformed line, unrelated line, location, and caret remain.

### 14C. Curated plugin command mutation

1. **Selected:** `runPlugin()` rejects only selected option spellings and otherwise forwards the complete pnpm argv. Mutating subcommands such as `pkg set`, `config set`, and `patch` therefore bypass flag-only checks.
2. The CLI argument parser already constrains plugin management to package add/remove/list operations. Rejected: it intentionally stores every trailing token as pnpm argv, and existing ordinary-profile tests rely on commands such as `why`.
3. The minimum enforcement is a curated-profile command allowlist for canonical `add`, `remove`, and `list`, plus rejection of writable package transformations, lifecycle build grants, and caller-controlled script settings within those commands. Ordinary profiles retain the existing forwarding behavior, while every install still receives the forced ignore-scripts option and environment.

## Verification

- Final focused aggregate across commands, policy, profiles, CLI, and workspace-constraint tests: 439 passed in six files.
- Combined focused coverage: 393 tests passed; statements, branches, functions, and lines are 100% for `curated-policy/src/index.ts`, `curated-scripts/src/index.ts`, and `curated-scripts/src/staging-worker.ts`.
- Packed artifact entry: one E2E passed through `vitest.e2e.config.ts`.
- Curated policy, profiles, and scripts package typechecks passed.
- Scoped oxlint passed with 0 warnings and 0 errors.
- Curated-scripts `tsdown` built `index.js`, `bin.js`, `invariant.js`, and `staging-worker.js`.
- `pnpm run constraints` passed after the worker artifact was added to the package file allowlist.
- Named translation-pairing checks passed for both affected package READMEs and the curated governance Agent Note.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run doc-sync` ran all 28 gates: 26 passed and two failed on pre-existing out-of-scope changes (`JsonlSessionPersistence.config` JSDoc and the `docs/subsystems/curated` bilingual-pair record). These files were not modified for Task 20.2.

### Final command log

- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-profiles/tests/profiles.spec.ts apps/cli/tests/curated-profile.spec.ts apps/cli/tests/plugin-install-scripts.spec.ts scripts/check-workspace-constraints.spec.ts --reporter=dot` — exit 0, 439 passed.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts --coverage --coverage.include='packages/curated/curated-scripts/src/index.ts' --coverage.include='packages/curated/curated-scripts/src/staging-worker.ts' --coverage.include='packages/curated/curated-policy/src/index.ts' --reporter=dot` — exit 0, 393 passed, every per-file coverage metric 100%.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm --filter @deepseek-ai/dsh-curated-scripts --filter @deepseek-ai/dsh-curated-policy --filter @deepseek-ai/dsh-curated-profiles run typecheck` — exit 0 for all three packages.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec tsx scripts/run-oxlint.ts packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/src/staging-worker.ts packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-scripts/tests/packed-entry.e2e.ts packages/curated/curated-policy/src/index.ts packages/curated/curated-policy/tests/catalog.spec.ts scripts/check-workspace-constraints.ts` — exit 0, no warnings or errors.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run constraints` — exit 0.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec tsdown --config packages/curated/curated-scripts/tsdown.config.ts` — exit 0 and emitted the staging worker.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/packed-entry.e2e.ts --config vitest.e2e.config.ts --reporter=dot` — exit 0, one packed built-artifact test passed through the emitted worker.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run verify-translation-pairing packages/curated/curated-scripts/README.md packages/curated/curated-policy/README.md .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md` — exit 0, three pairs consistent.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run verify-agent-note-format` — exit 0, 605 notes conform.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run doc-sync` — exit 1 after 63.80 seconds, with 26 passes and the two out-of-scope failures above. This aggregate exceeded the requested 55-second command ceiling; it was allowed to finish so no gate process remained running.

## Deferred concerns

The completed subset covers effective-entry ownership across bundle/profile/home/overlay composition, dynamic expression rejection in user-controlled layers, malformed entry rejection, escape-aware secret-shaped YAML diagnostic redaction, lifecycle-script suppression, dependency transformation rejection, the smoke total deadline, and rollback baseline binding.

- **Rollback execution**: baseline profile/reference binding remains enforced, but `compare-benchmark` only returns digest-validated snapshots and reasons. It does not authenticate the evidence producer or atomically restore the prior lock and profile; an external operator owns restoration.
- **Repository documentation gate**: the full `doc-sync` aggregate remains red only for the two out-of-scope dirty-worktree failures recorded above; Task 20.2's named bilingual pairs are current.

## 14D. Task-level rereview RED/GREEN evidence

- **Installation anchor RED:** the canonical-anchor regression failed because a profile-local fake `@deepseek-ai/dsh-base` containing an audited-only `!!js` value and malicious entry produced one effective row, while the real installation bundle produced 78.
- **Installation anchor GREEN:** the same test passed after installation-owned names resolved only from the dsh installation anchor and other non-catalog bundles resolved from the profile root. The fake package produced the same result as a control profile with no shadow package, so its patch did not enter composition or receive installation ownership.
- **Explicit YAML key RED:** policy and command tests each failed all five explicit-key cases because `? apiKey` did not carry secret classification to the following `: value` line.
- **Explicit YAML key GREEN:** both suites passed plain, quoted, Unicode-escaped-key, folded, and multiline quoted cases after the shared formatter tracked explicit key/value pairs and scalar continuations. Parser reason, file, line, column, malformed line, caret, and unrelated context remain visible.
- **Curated plugin command RED:** the source-bin test returned zero and invoked the fake pnpm for `pkg set pnpm.overrides.x=y`; a second RED run showed `add --config.pnpm.overrides.x=1` also reached pnpm.
- **Curated plugin command GREEN:** the source-bin test passed after curated profiles allowed only canonical `add`, `remove`, and `list` commands and rejected package transformations, pnpmfile hooks, build grants, and caller script settings before invoking pnpm. The same test proves an ordinary profile still forwards `pkg set`, and every allowed invocation receives forced ignore-scripts configuration.

## Task-level rereview verification

- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --reporter=dot` — exit 0, 296 passed.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts --reporter=dot` — exit 0, 107 passed before the final no-value branch case was added; the final coverage run included all 108 policy tests.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run apps/cli/tests/plugin-install-scripts.spec.ts --reporter=dot` — exit 0, two source-bin integration tests passed.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts --coverage --coverage.include='packages/curated/curated-scripts/src/index.ts' --coverage.include='packages/curated/curated-policy/src/index.ts' --coverage.reporter=text --reporter=dot` — exit 0, 404 passed; statements, branches, functions, and lines were 100% for both included source files.
- `PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run typecheck:contracts-ready` — exit 0.
- Scoped Oxlint over the six affected TypeScript source and test files — exit 0 with no warnings or errors.
- Translation pairing for the CLI reference and curated-scripts README pairs — exit 0, two pairs consistent.
- Scoped and full unstaged `git diff --check`, plus staged `git diff --cached --check` — exit 0.
- The first concurrent coverage attempt was invalid because two Vitest processes shared `coverage/.tmp`; the serialized rerun above is the coverage result.
- Repository-wide `pnpm run lint` reached Oxlint and exited 1 on 1,131 errors in pre-existing untracked generated `.d.ts` files, including `packages/boot/app-boot/src/index.d.ts` and `profile.d.ts`. Those files were present before this task and were not edited or removed. The scoped lint result above covers every TypeScript file changed by this fix.

## 15. Second-round Important fixes

### 15A. Sequence and compact explicit-key redaction hypotheses

1. **Selected:** the scanner records the line's leading whitespace for `- ? apiKey`, but YAML places that explicit key and its `: value` indicator two columns inside the sequence marker. The value line therefore does not match the pending key indentation, and compact `? apiKey : secret` is decoded as one key instead of a key/value pair.
2. `js-yaml` excludes these values from `mark.snippet`, making further source analysis unnecessary. Rejected: direct parser probes retained the sequence value, compact pair, malformed line, location, and caret.
3. Replacing the complete parser snippet is the only safe response. Rejected: syntax-aware source line selection can redact the secret scalar and its continuations while retaining unrelated diagnostic context.

### 15B. DSH installation-anchor hypotheses

1. **Selected:** `new URL('../../../../apps/cli/package.json', import.meta.url)` identifies the repository checkout from the source package but does not identify `@deepseek-ai/dsh` in built and external-consumer layouts. The same emitted module can therefore inspect the repository installation instead of the consumer's DSH installation.
2. Resolving installation-owned bundles from the profile first would make every layout work. Rejected: a profile-local package could then impersonate an installation-owned bundle and receive trusted ownership.
3. The package dependency is insufficient for anchor discovery. Rejected: `@deepseek-ai/dsh-curated-scripts` declares `@deepseek-ai/dsh` as a runtime dependency, and `createRequire(import.meta.url).resolve('@deepseek-ai/dsh/package.json')` resolves the package manifest in source, built, and external-consumer layouts.

### 15C. TDD and implementation evidence

- **YAML RED:** policy and command focused runs each failed all seven new cases. Sequence values remained visible because the pending explicit key used the physical line indent, and compact values remained visible because the separator was not parsed outside quoted key syntax.
- **YAML GREEN:** the scanner now records the explicit `?` marker's semantic column after an optional sequence indicator, detects an unquoted compact value separator, decodes quoted keys through the failsafe schema, and marks scalar continuation lines from the correct value indentation. Both suites pass plain, Unicode-escaped, escaped double-quoted, escaped single-quoted, multiline quoted, multiline plain, block, and compact cases. Every asserted original value and suffix is absent; unrelated context, malformed `broken: [` line, line and column, and caret remain.
- **Installation anchor RED:** the packed external-consumer preflight returned 135 entries from the source repository installation instead of the three entries staged under the consumer's real `@deepseek-ai/dsh` package.
- **Installation anchor GREEN:** `DSH_INSTALL_ANCHOR` now resolves `@deepseek-ai/dsh/package.json` from the running curated-scripts module and is reused for both installation-owned bundle resolution and the DSH executable. The source-layout shadow test passes, emitted artifacts contain package resolution instead of the repository-relative path, and the packed external consumer accepts exactly three installation-side entries while ignoring its profile-local same-name bundle.

### 15D. Second-round verification

- Full focused unit tests: `packages/curated/curated-policy/tests/catalog.spec.ts` passed 115 tests and `packages/curated/curated-scripts/tests/commands.spec.ts` passed 303 tests.
- Combined focused coverage passed 418 tests and reported 100% statements, branches, functions, and lines for both `curated-policy/src/index.ts` and `curated-scripts/src/index.ts`.
- Package typechecks for curated-policy and curated-scripts passed; repository `typecheck:contracts-ready` also passed.
- Scoped Oxlint over both source files and all three changed test files passed with 0 warnings and 0 errors.
- Curated-scripts type emission and `tsdown` bundling passed; the packed external-consumer E2E passed one test through `vitest.e2e.config.ts`.
- Repository `lint:contracts-ready` exited 1 on 1,130 errors in pre-existing untracked generated `.d.ts` files, beginning with `packages/boot/cmdline/src/index.d.ts`. None of those files is part of this fix, and the scoped lint covers every changed TypeScript file.
- `utree flush` completed with no failed-reason payload.
- Full unstaged and staged `git diff --check` passed.

## 16. Boot admission, runtime dependency closure, and catalog order

### 16A. Mandatory curated boot admission hypotheses

1. **Selected:** `ensureCuratedProfile()` only materializes missing files, then `prepareProfile()` calls the generic loader without curated admission. A hand-edited manifest, profile or home patch, or successful plugin mutation can therefore reach `dsh` boot and `--dump-config` without the composition checks enforced by observed preflight.
2. Observed preflight is already part of normal profile loading. Rejected by the CLI call graph: `runProfile()` and `runDumpConfig()` call `prepareProfile()`, while only the standalone curated command package calls `runPreflight()`.
3. Importing the curated command package into the launcher is the smallest repair. Rejected because `curated-scripts` already depends on the profile and CLI packages; the reverse dependency would create a release cycle and would couple normal boot to artifact and lock inspection.

### 16B. Catalog-owned runtime dependency closure hypotheses

1. **Selected:** the root and installed pnpm closures are compared only with each other. An attacker who changes the same reachable transitive exact version and SRI in both locks preserves equality and passes admission because the catalog has no closure digest.
2. The direct candidate tree digest or direct registry SRI transitively authenticates every installed dependency. Rejected: the direct digest covers only files under the candidate package directory, and the direct SRI authenticates only the candidate archive. Hoisted transitive package identities remain separate lock records.
3. Recording every transitive file tree is required. Rejected because the requested trust anchor is the deterministic closure of sorted package identity plus exact registry SRI or immutable Git commit; direct candidate bytes remain covered by the existing tree digest.

### 16C. Catalog query order hypotheses

1. **Selected:** `getProfileCandidates()` filters catalog entries and then explicitly sorts by descending `targetProfiles.length`, moving shared candidates ahead of earlier profile-specific candidates.
2. Catalog copying, freezing, or query caching changes order. Rejected: `copyCatalog()` preserves array order, `deepFreeze()` does not reorder it, and the cache stores the first computed result unchanged.

### 16D. Boot-admission follow-up hypotheses

#### Root-file write ordering

1. **Selected:** normal composition called `prepareProfile()` before reading home and command-line patches. `prepareProfile()` therefore rewrote `cordis.yml` before admission could reject an unsafe higher layer.
2. Higher layers cannot be read until `cordis.yml` exists. Rejected: profile, home, and overlay patches have independent paths and parse without the generated root config.

#### Truthy group semantics

1. **Selected:** executable identity traversal recognized only `group === true`, while Cordis treats every truthy `group` value as a group. A string-valued group could therefore hide an unapproved child from admission.
2. Patch composition normalizes every group value to a boolean before identity traversal. Rejected by the RED case: the composed entry retained `group: 'enabled'`, and the old traversal did not visit its child.

### 16E. TDD evidence

- **Catalog order RED:** the focused policy test expected `specific, shared` in catalog order and received `shared, specific`. **GREEN:** removing the secondary `targetProfiles.length` sort made the same focused test pass while preserving the frozen cached result.
- **Boot admission RED:** focused CLI tests showed that `prepareProfile()` accepted a curated manifest with an extra bundle and a profile patch containing `!!js`; a real source `dsh --profile web-personal` invocation reached Loader import of an injected package; an unsafe home patch was rejected only after `cordis.yml` had been rewritten; `dsh plugin --profile web-personal add/remove` invoked the fake pnpm and returned zero. **GREEN:** the same tests passed after mandatory admission ran in `prepareProfile()` before root-file writes, normal boot, config dump, and live user-layer recomposition, while curated plugin add/remove rejected before pnpm.
- **Root-file ordering RED:** a sentinel `cordis.yml` changed before an unsafe home patch failed admission. **GREEN:** home and overlay layers are now loaded and passed into `prepareProfile()` before root generation; the source-bin regression confirms that the unsafe home patch and sentinel root retain their original bytes.
- **Truthy group RED:** an additional user layer with `group: 'enabled'` and an injected child passed admission because only literal `true` triggered recursive identity collection. **GREEN:** identity collection records `Boolean(entry.group)` and descends into every truthy group; the same case now fails with `user patches introduce an unapproved executable or group`.
- **Closure RED:** a managed fixture changed `registry-dep@2.0.0` to the same attacker SRI in both root and installed locks and `verify-lock` returned zero. **GREEN:** `verify-lock`, observed preflight, and observed smoke all rejected the same two-lock mutation with `runtime dependency closure SHA-256 differs from the catalog`.
- **Preservation and regressions:** rejection tests compare the original manifest, profile patch, home patch, overlay, and pnpm log bytes after failure. Focused CLI coverage also boots the ordinary `web`, `headless`, and custom preparation paths and confirms a profile-local `@deepseek-ai/dsh-base` shadow does not replace the installation-owned bundle.

### 16F. Implementation and trust split

`@deepseek-ai/dsh-curated-profiles` now exports `assertCuratedProfileAdmission()`. The launcher invokes it after installation-first profile resolution and again after loading home and command-line overlays. It requires the manifest and resolved layers to match `CURATED_PROFILE_TEMPLATES` exactly, requires the non-installation bundle suffix to equal active catalog assignments in catalog order, applies the existing package-manager safety checks, rejects `!!js` anywhere in user-controlled layers, and rejects effective executable or group identities absent from the bundle-only composition. HMR recomposition repeats the same check before applying changed profile or home patches.

This mandatory boot admission intentionally does not import `@deepseek-ai/dsh-curated-scripts`: that package already depends on the CLI and profile packages. Normal startup and config dump therefore perform composition, manifest, and package-manager admission without a release dependency cycle. Explicit observed `verify-lock`, preflight, and smoke retain the deeper installed artifact tree, canonical path, package metadata, and lockfile checks.

Every active catalog candidate now carries `runtimeDependencyClosureSha256`. The digest hashes each sorted runtime dependency identity with a byte-length prefix; registry identities include the exact package key and SRI, while Git identities include the package key and immutable repository/commit or commit-addressed tarball. Both managed lockfiles are traversed independently, must produce the same identity list, and must each match the catalog digest. The six values were computed from a fresh isolated `web-curated` installation under `/tmp/dsh-task20-closure-117.B0sk85` using the repository-pinned pnpm 11.7.0; the resulting observed `verify-lock` selected six candidates and returned `ok:true`.

Curated plugin membership is fixed by the repository-owned templates. `dsh plugin` permits `list` for curated profiles and rejects `add` or `remove` before materialization or pnpm execution; ordinary profiles retain general pnpm forwarding. `CuratedPolicy.getProfileCandidates()` now preserves catalog order, while `CURATED_PROFILE_TEMPLATES` remains unchanged.

### 16G. Verification

- The final focused coverage run passed 479 tests across policy, profiles, scripts, CLI admission/plugin, and benchmark assets. `curated-policy/src/index.ts`, `curated-profiles/src/index.ts`, and `curated-scripts/src/index.ts` each reported 100% statements, branches, functions, and lines.
- Curated policy, profiles, scripts, and bench package typechecks passed. The CLI TypeScript project also passed.
- Scoped Oxlint passed with zero warnings and zero errors across all changed TypeScript source and tests.
- The Host type-emission and bundling command completed successfully under the 50-second limit.
- A fresh pnpm 11.7.0 `web-curated` installation passed observed `verify-lock` and preflight with six selected candidates and 143 composed entries. The rebuilt published smoke entry passed manifest, bundle-parse, `dump-config`, and `help`.
- A separate temporary `web-personal` profile passed a real source `--dump-config`; after an unapproved plugin insertion, the normal source startup exited nonzero before Loader activation with the boot-admission diagnostic.
- Type-equivalence, Cordis catalog freshness, named translation pairing, Agent Note format, Markdown wrapping, Markdown links, JSON parsing, document budgets, workspace constraints, scoped diff check, full unstaged diff check, and staged diff check passed.
- The repository-wide export-JSDoc leaf remains blocked by pre-existing untracked generated declarations: `packages/session/session-persistence-jsonl/src/index.d.ts:53` lacks JSDoc for `JsonlSessionPersistence.config`. No Task 20 file caused that diagnostic.
- No browser check was run because this change enables no UI candidate and changes no browser-visible behavior. No long-cycle evidence was claimed.

### 16H. Final command evidence after the follow-up fixes

- `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-profiles/tests/profiles.spec.ts packages/curated/curated-scripts/tests/commands.spec.ts apps/cli/tests/curated-profile.spec.ts apps/cli/tests/plugin-install-scripts.spec.ts packages/curated/curated-bench/tests/bench.spec.ts --coverage --coverage.include='packages/curated/curated-policy/src/index.ts' --coverage.include='packages/curated/curated-profiles/src/index.ts' --coverage.include='packages/curated/curated-scripts/src/index.ts' --coverage.reporter=text --reporter=dot` — exit 0 in 16.4 seconds; all 479 tests passed and every included source file reported 100% statements, branches, functions, and lines.
- `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run build:lib:host` — exit 0 in 12.6 seconds; the emitted CLI and curated-scripts entries include the final root-write ordering and truthy-group changes.
- `gtimeout 50s env COREPACK_ENABLE_PROJECT_SPEC=0 corepack pnpm@11.7.0 install --frozen-lockfile=false` in a newly materialized temporary `web-curated` profile — exit 0 in 5.1 seconds with 106 packages installed under pnpm 11.7.0.
- The rebuilt `dsh-curated-smoke-profile` published entry ran against that installation and returned `ok:true`; manifest, bundle-parse, dump-config, and help all passed.
- `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run apps/cli/tests/curated-profile.spec.ts -t 'rejects unsafe curated boot and dump layers while accepting a legal dump' --reporter=dot` — exit 0; one real source-bin temporary-profile integration test passed.
- `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'rejects an unapproved executable nested in an approved group' --reporter=dot` — exit 0; the truthy-group regression passed.

## 17. pnpm v9 runtime dependency aliases

### 17A. Hypotheses recorded before regression tests or production edits

1. **Selected:** closure traversal assumes every dependency locator is a bare version or Git locator and prepends the declaration key when finding package and snapshot records. A legal pnpm v9 alias such as `alias-js-yaml: js-yaml@4.1.0` is therefore looked up as `alias-js-yaml@js-yaml@4.1.0` instead of the real target key `js-yaml@4.1.0`. The repository lock contains the same pnpm v9 form for `string-width-cjs`, `strip-ansi-cjs`, and `wrap-ansi-cjs`.
2. Alias records are malformed lock input and should remain rejected. Rejected: pnpm v9 emits alias dependency values as either `<target-name>@<exact-version>` or `npm:<target-name>@<exact-version>`, while package and snapshot records use the real target name. Scoped targets and peer-suffixed snapshots follow the same rule.
3. **Selected:** resolving only the real target is insufficient because closure de-duplication currently keys on the target snapshot. Two declaration aliases that resolve to the same snapshot can collapse to one identity, and an identity containing only the target key and integrity does not bind which alias selected it. Alias identities must include both the declaration name and normalized real target while ordinary dependency identities remain byte-for-byte unchanged.

### 17B. TDD and implementation evidence

- **RED:** `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'validates the complete runtime dependency closure' --reporter=dot` exited 1 because the optional alias was reported as unresolved under the fabricated key `alias-optional@npm:optional-target@3.0.0`.
- **GREEN:** the same focused test passed after alias locators were normalized to their real target name, exact version, and peer suffix for package and snapshot lookup. Alias identities prepend the declaration name to the resolved target identity, while distinct identity and expanded-snapshot sets retain every alias declaration without recursively expanding the same target more than once.
- The fixture accepts unscoped `js-yaml@4.1.0`, scoped `npm:@scope/target@2.0.0(peer-dep@1.0.0)`, and optional `npm:optional-target@3.0.0` aliases. It rejects a missing target, inexact target, absent or mismatched integrity, declaration rename, and same-integrity retarget.

### 17C. Verification

- The complete `curated-scripts` suite passed 303 tests. Focused coverage reran the same 303 tests and reported 100% statements, branches, functions, and lines for `curated-scripts/src/index.ts`.
- The `@deepseek-ai/dsh-curated-scripts` package typecheck passed, and scoped Oxlint reported zero warnings and zero errors for the changed source and test.
- The existing fresh `web-curated` installation contains no alias locator in either managed lock. Source `verify-lock` selected all six active candidates and returned `ok:true`, so the active catalog and benchmark closure digests remain unchanged.
- The curated-scripts README and governance Agent Note pairs are consistent. Agent Note format, Markdown wrapping, scoped unstaged diff check, and staged diff check passed.

## 18. Published commands, smoke environment, and rollback artifact binding

### 18A. Published command hypotheses

1. **Selected:** every package-manager shim invokes the package manifest's `lib/bin.js`, so `process.argv[1]` identifies `bin.js` instead of the manifest command name. Basename dispatch therefore cannot select any of the four commands after installation.
2. pnpm and npm preserve the requested manifest command name in another stable argument or environment variable. Rejected as the command contract: those values are package-manager-specific, while four explicit executable modules give Node the same unambiguous entry on POSIX and Windows.

### 18B. Smoke child environment hypotheses

1. **Selected:** `scrubbedParentEnv()` removes only its shared ambient set, and `smokeChildEnv()` filters overrides before merging without removing all credential-shaped names already retained from the ambient environment. `AUTH`, `CREDENTIAL`, and `COOKIE` ambient names can therefore reach the child, while generic `KEY` and substring forms are not uniformly covered.
2. The shared subprocess scrub should reject credential-shaped explicit overrides for every consumer. Rejected because the subprocess contract deliberately permits a consumer to supply a child-owned API key after the ambient scrub; ACP, MCP, and subagent providers rely on that explicit opt-in. Smoke has the stricter no-credential requirement and owns the final merged-environment filter.

### 18C. Rollback reference hypotheses

1. **Selected:** comparison validates the embedded snapshot digest and the baseline profile name, but never reads the file named by `baseline.lockSnapshot` or `baseline.profileSnapshot`. A valid embedded snapshot can therefore be returned while the recorded baseline actually references different bytes.
2. Matching filename suffixes bind the embedded snapshot to the referenced baseline artifact. Rejected because a filename authenticates neither content nor containment, and the current references are interpreted nowhere.
3. **Selected:** the checked-in `locks/web.json` still contains a mutable `catalogRef`, and `locks/web-curated.json` stores aggregate maps instead of complete active candidate identities. Those files are not self-contained restoration inputs and the invariant does not compare them with embedded or current benchmark state.

### 18D. Benchmark trust-language hypotheses

1. **Selected:** existing prose says producer identity is not attested, but some accepted-result descriptions can still be read as independent authentication. The current contract needs one direct statement that both `evidenceKind: observed` and the producer-supplied run fields remain operator-trusted and have no cryptographic authentication.
2. Digest-valid rollback snapshots authenticate benchmark run production. Rejected because the digest protects snapshot bytes only; it says nothing about who produced the run records or whether their `observed` label is true.

### 18E. Published default-asset resolution hypotheses

1. **Selected:** source-relative paths such as `../../curated-policy` rely on the repository's `packages/curated/<package>/src` layout. From an installed scoped package's `lib/`, the same traversal names an undeclared `@deepseek-ai/curated-policy` sibling, so the correct command entry still cannot load its default assets.
2. tsdown copies or rewrites those external data paths for the package layout. Rejected by the installed-bin diagnostic, which names the nonexistent scoped sibling path unchanged.

### 18F. RED/GREEN evidence

- **Published bins RED:** the packed external-consumer test found all four manifest commands mapped to `lib/bin.js`; package-manager shims therefore supplied `bin.js` as `argv[1]`. **GREEN:** four executable source modules now select one command each and delegate to the shared `runCuratedCommand()` runner. The package manifest, tsdown entries, publication file constraint, and packed E2E all use the four emitted files.
- **Published assets RED:** after the entry fix, installed `verify-lock` reached its runner but failed while resolving the nonexistent `@deepseek-ai/curated-policy` path. **GREEN:** default policy and benchmark assets resolve from their declared package dependencies, while curated-base resolves from the installed DSH anchor.
- **Smoke environment RED:** real child probes received explicit `AUDIT_KEY_ID` and ambient `SERVICE_AUTH_MODE`. **GREEN:** the final merged smoke environment removes names containing `KEY`, `PASSWORD`, `SECRET`, `TOKEN`, `AUTH`, `CREDENTIAL`, or `COOKIE`, case-insensitively, while retaining `PATH`, `HOME`, locale, proxy, and the two required smoke-owned `DSH_*` values. The shared subprocess contract remains unchanged because its consumers intentionally permit explicit credentials.
- **Rollback binding RED:** comparison accepted `../locks/web.json` and accepted a referenced lock whose canonical content differed from the embedded snapshot; the bench invariant also accepted the mismatch. **GREEN:** references are relative POSIX JSON paths from the fixture directory, canonicalized and contained before a 1 MiB regular-file read. Baseline reference content must canonically equal the digest-verified embedded lock and profile snapshots. Candidate references must identify the candidate profile and contain no mutable `catalogRef`.
- **Current snapshot RED:** `locks/web-curated.json` contained a mutable catalog path and only aggregate digest maps. **GREEN:** it contains all six active candidate identities, source commits, package names, bundle patches, tarball digests, tree digests, closure digests, and npm identities where applicable. The bench invariant checks candidate IDs, active count, tree and closure maps, and profile bundle order.
- **Trust wording GREEN:** curated package docs, the subsystem reference, the benchmark design page, and the governance Agent Note state that `observed`, producer metadata, run fields, and `accepted` have no cryptographic producer/evidence authentication. They also state that the operator performs restoration and that no automatic or atomic restore is provided.

### 18G. Verification

- Focused coverage: 328 tests passed across `commands.spec.ts` and `bench.spec.ts`; `curated-scripts/src/index.ts`, `curated-bench/src/invariant.ts`, and `curated-bench/src/snapshot.ts` each reported 100% statements, branches, functions, and lines.
- Root `pnpm run typecheck` passed, including the Host build and Client project references.
- Scoped Oxlint passed with zero warnings and errors over all changed TypeScript source and tests.
- The curated-scripts tsdown build emitted the shared runner, staging worker, and four executable entries.
- Packed E2E ran `pnpm pack`, installed the tarball into an external consumer with pnpm, and invoked all four package-manager shims. `verify-lock`, fixture preflight, and observed smoke produced their expected successful results; the default planned comparison produced its expected pending result.
- The workspace-constraint test passed eight tests, and `pnpm run constraints` passed with the four bin artifacts in the package payload.
- The four affected bilingual pairs passed named translation verification; all 605 active Agent Notes passed the format check. Markdown wrapping, links, and documentation budgets passed.
- Full unstaged and staged diff whitespace checks passed. No vendor path changed, and no Git write operation was executed.

## 19. Rollback snapshot review fixes

### 19A. Canonical snapshot read hypotheses

1. **Selected:** containment was checked against `realpathSync.native(unresolved)`, but the reader then reopened `unresolved`. Replacing an ancestor after `realpath` redirected the read outside the fixture root, and replacing the final file on a platform without `O_NOFOLLOW` opened a different inode.
2. Opening with `O_NOFOLLOW` alone closes the race. Rejected: it protects only the final path component on supporting platforms; it does not prevent an ancestor replacement and is unavailable on some supported hosts.
3. A post-open path check alone proves the bytes came from the approved file. Rejected: the path can name a different regular file unless the pre-open canonical target identity, descriptor identity, and post-open path identity all agree.

### 19B. Rollback candidate hypotheses

1. **Selected:** top-level repository/commit audit fields mixed with optional npm fields do not identify which source an operator must install. Each candidate needs shared artifact identities plus one discriminated `installSource`.
2. A full Git commit retained beside npm version and SRI makes an npm candidate more reproducible. Rejected: those fields describe two different acquisition paths and permit a consumer to choose the wrong one.
3. Git repository and commit are sufficient. Rejected: monorepo candidates also require an explicit `repositoryPath`, and direct Git installation must record that no install lifecycle script is needed.

### 19C. TDD and implementation evidence

- **Snapshot RED:** the static final-symlink case exposed raw `ELOOP`; controlled replacements between canonicalization and open caused both an ancestor symlink and a final symlink on a simulated no-`O_NOFOLLOW` platform to return outside JSON.
- **Snapshot GREEN:** the reader rejects a static final symlink and FIFO, opens only the canonical target, uses `O_NOFOLLOW` where available, and compares nonzero device/inode identity across the pre-open path, descriptor `fstat()` before and after the bounded read, and post-open canonical path. The same three focused cases passed.
- **Candidate RED:** a valid exact npm `installSource` and a valid exact Git `installSource` were rejected by the old top-level-field parser; the invariant accepted a current candidate with no install source.
- **Candidate GREEN:** shared candidate fields now require non-placeholder tarball, tree, and runtime-closure digests. `installSource.kind: npm` contains exactly an exact npm version and canonical 64-byte SHA-512 SRI; `kind: git` contains exactly a normalized HTTPS repository, non-placeholder full commit, explicit safe repository path, and empty lifecycle-script record. Missing, mixed, floating, malformed, and placeholder values reject. The `web` lock keeps its legal empty baseline, while `web-curated` records five npm sources and one Git source.

### 19D. Scope

The comparator still returns validated immutable rollback inputs to an external operator. This change does not implement automatic or atomic restoration and does not authenticate the evidence producer.

### 19E. Verification

- Focused coverage passed 334 tests across `commands.spec.ts` and `bench.spec.ts`; `curated-scripts/src/index.ts`, `curated-bench/src/invariant.ts`, and `curated-bench/src/snapshot.ts` each reported 100% statements, branches, functions, and lines.
- Curated-bench and curated-scripts package typechecks passed. The repository typecheck passed after its required Host build.
- Scoped Oxlint passed with zero warnings and errors over all five affected TypeScript source and test files.
- The packed external-consumer E2E passed, and `verify-package-invariants` accepted all 234 hand-owned package companions.
- The three affected bilingual pairs and Markdown wrapping check passed.
- Repository lint reached Oxlint and failed only on 1,130 diagnostics in pre-existing untracked generated declaration files. The independent export-JSDoc check likewise failed only on the pre-existing `packages/session/session-persistence-jsonl/src/index.d.ts:53` declaration.

## 20. Rollback snapshot second-round review

### 20A. Initial identity hypotheses

1. **Selected:** the reader discarded the first `lstat(unresolved)` identity and used the later `lstat(canonical)` result as the expected identity. Replacing the target with another contained regular file between those calls therefore let the replacement define both the expected identity and opened descriptor.
2. Opening the canonical path and checking it after the read is sufficient. Rejected: those checks prove only that the descriptor matches the replacement path, not that it matches the object accepted by the initial unresolved-path check.
3. Removing the first `lstat` produces an equally secure single chain. Rejected: the review requires replacements after that exact initial observation to fail, and the nonzero device/inode identity returned by the existing check can bind the unresolved path, canonical target, and descriptor without another API or abstraction.

### 20B. Static asset invariant hypotheses

1. **Selected:** fixed checked-in JSON assets have no authoritative event stream or mutable-data relationship to observe at runtime. Their exported validator belongs in unit and build checks, while the package companion remains an explained empty installer.
2. Registering the validator catches deployment-time asset corruption. Rejected: the invariant registry is for runtime relationships, not a second load-time pass over fixed files. Static validation remains directly testable through `validateCuratedBenchAssets()`.

### 20C. TDD and implementation evidence

- **Identity RED:** the first `lstat()` returned the original file identity, then a mocked `realpath()` entry replaced the target with a separately created contained regular file before canonicalization and the second `lstat()`. The reader returned the replacement JSON instead of failing.
- **Identity GREEN:** the first identity must match the canonical target's second `lstat()` before open and remains the expected identity for both descriptor checks. The exact race now reports `snapshot changed while it was being read`; existing containment, regular-file, size, content, ancestor replacement, and final-symlink replacement cases remain green.
- **Invariant RED:** with every static sentinel forced absent, the registered runtime installer emitted three asset failures.
- **Invariant GREEN:** `validateCuratedBenchAssets()` remains exported and covered directly, while the package-specific `No runtime invariant:` installer emits nothing for the same missing assets.

### 20D. Focused verification

- The two regression tests passed after both failed for their intended pre-fix behavior.
- The complete curated-bench suite passed 25 tests.
- Scoped coverage reported 100% statements, branches, functions, and lines for `curated-bench/src/invariant.ts` and `curated-bench/src/snapshot.ts`.
- The curated-bench static checks in the curated-scripts suite passed four tests.
- Root typecheck passed, including Host build and Client project references.
- Scoped Oxlint passed with zero warnings and errors over the four changed TypeScript files.
- Source and built package-invariant checks each accepted all 234 companions.
- The curated-bench README pair, Markdown wrapping, HEAD diff check, and staged diff check passed; the tracked diff contains no vendor path.
- `doc-sync` completed in 32.96 seconds with 26 passes and two failures from existing out-of-scope dirty files: stale `docs/config-catalog.md` and missing JSDoc on `packages/session/session-persistence-jsonl/src/index.d.ts:53`.

## 21. Candidate catalog fact re-audit

Date: 2026-08-27

### 21A. Method and digest decision

This audit rebuilt evidence from the checked-in 37-candidate enumeration without accepting earlier reports as proof. Every repository page, GitHub commit API result, fixed-commit codeload response, extracted package manifest, declared bundle patch, license file, lifecycle-script subset, and dependency union was read again with a per-command deadline below 55 seconds. The dependency union is the sorted union of `dependencies`, `optionalDependencies`, and `peerDependencies`; lifecycle scripts are `preinstall`, `install`, `postinstall`, `prepare`, and `prepack`, matching production inspection.

Two hypotheses explained the suspect archive values. Hypothesis A was stale or incorrectly copied codeload bytes. Hypothesis B was that a codeload byte hash is not a durable source identity even when currently correct. Both matter: 11 checked-in values differed from fresh fixed-commit downloads, and [GitHub's source-archive documentation](https://docs.github.com/repositories/working-with-files/using-files/downloading-source-code-archives#stability-of-source-code-archives) states that compression settings and the outer byte layout may change while extracted commit content remains the same. Catalog schema v2 therefore replaces `tarballSha256` with `sourceContentSha256`. The repository-owned audit implementation reads the fixed commit from a temporary bare Git object database, starts the digest with `dsh-source-content-v1\0`, sorts entries globally by UTF-8 POSIX relative path bytes, and hashes length-prefixed entry mode, object type, path, and blob bytes. npm installation remains pinned by exact version plus SHA-512 SRI, and observed installed bytes remain pinned separately by `treeSha256`.

### 21B. All-candidate reachability

| Candidate set | Count | Repository | Commit API | Codeload | Result |
|---|---:|---:|---:|---:|---|
| `sourceStatus: verified` | 23 | 200 | 200 | 200 | Manifest, bundle path, source content, and requested metadata inspected |
| `sourceStatus: unreachable` | 14 | 200 | 422 | 404 | Repository exists, but the recorded 40-character SHA is not available and package facts cannot be verified |

Verified candidates: `dsh-toolkit`, `dsh-context`, `dsh-web-search-pro`, `dsh-memento`, `dsh-mcp-panel`, `dsh-checkpoint-rewind`, `dsh-lsp-actions`, `dsh-permission-rules`, `dsh-smooth-stream`, `upstream-radar`, `dsh-plugin-hub`, `dsh-plugin-check`, `plugin-session-export`, `loongsuite-dsh-plugin`, `dsh-config-manager`, `dsh-better-sidebar`, `dsh-agent-team-gui`, `dsh-background-agents`, `dsh-computer-use`, `dsh-vision-router`, `dsh-llm-fallbacks`, `dsh-univer-office`, and `dsh-feishu`.

Unreachable commits: `dsh-plugin-guide`, `dsh-free-web-search`, `dsh-mneme`, `dsh-mcp-manager`, `dsh-tabbit`, `dsh-context-doctor`, `dsh-cost-meter`, `tokenledger`, `dsh-chat-import`, `dsh-message-edit`, `dsh-auto-review`, `plugin-notify`, `deepseek-harness-desktop`, and `martty`. Their rejection evidence now records the repository 200 / commit API 422 / codeload 404 distinction instead of claiming that the repository itself is unavailable.

### 21C. Corrected fixed facts

- Replaced all 23 reachable candidates' codeload-byte `tarballSha256` values with reproducible `sourceContentSha256` values and advanced the candidate schema and generated summary to version 2.
- Corrected complete dependency unions for `dsh-context`, `dsh-plugin-check`, `dsh-config-manager`, `dsh-better-sidebar`, `dsh-agent-team-gui`, `dsh-background-agents`, `dsh-computer-use`, `dsh-vision-router`, `dsh-llm-fallbacks`, `dsh-univer-office`, and `dsh-feishu`.
- Corrected lifecycle scripts for `dsh-plugin-check` (`prepack: npm run build`) and `dsh-agent-team-gui` (`prepack` and `prepare`, both `pnpm run build`).
- Removed stale GitHub rate-limit warnings from candidates whose fixed archives were fully inspected in this audit.
- Replaced the obsolete authentication warning for `dsh-plugin-guide` with the same exact unreachable-commit evidence used by the other 13 unavailable pins.
- Kept `dsh-llm-fallbacks` license as MIT because the pinned `LICENSE` file is the MIT license; added the missing fact that its package manifest omits `license`.
- Confirmed the five active npm artifacts against exact registry manifests: names, versions, integrity, license, Node range, bundle patch, dependency union, and lifecycle-script records match the catalog. `dsh-web-search-pro` and `dsh-mcp-panel` intentionally record the script-free npm manifests while their audited Git sources declare `prepare`.

### 21D. Preserved decisions and unresolved evidence

The active set remains exactly `dsh-web-search-pro`, `dsh-memento`, `dsh-mcp-panel`, `dsh-checkpoint-rewind`, `dsh-lsp-actions`, and `loongsuite-dsh-plugin`. All five profile templates are byte-for-byte unchanged by this audit. No README claim promoted a candidate.

The 14 unavailable commits remain factually unverifiable beyond their public repository and failed fixed-SHA endpoints; their license, package name, Node engine, bundle patch, scripts, and dependencies remain null or empty with hard rejection evidence. `dsh-context`, `dsh-plugin-hub`, and `plugin-session-export` have verified package manifests with no `engines.node`. `dsh-llm-fallbacks` has a verified MIT license file but no manifest license field. Long-cycle browser, Office, IM, multi-agent, and canary evidence remains pending and was not inferred from static source.

### 21E. Verification

- The policy, benchmark, and command suites passed 454 tests. Focused coverage reported 100% statements, branches, functions, and lines for `curated-policy/src/index.ts`, `curated-bench/src/invariant.ts`, `curated-bench/src/snapshot.ts`, and `curated-scripts/src/index.ts`.
- Default metadata-only `verify-lock` returned `ok:true`, `catalogCandidateCount:37`, and `selectedCandidateCount:0`.
- The root typecheck, scoped Oxlint, workspace constraints, type-equivalence check, Agent Note format, five named bilingual pairs, catalog/lock/profile freshness test, scoped/full unstaged diff checks, and staged diff check passed.
- Full repository lint reached Oxlint and failed only on 1,130 diagnostics in pre-existing untracked generated declaration files.
- `doc-sync` completed 25 of 28 gates. Its remaining failures are pre-existing dirty-worktree drift in the generated Cordis catalog, generated config catalog, and `JsonlSessionPersistence.config` declaration JSDoc.
- No browser run was required because the active set, profile templates, and browser-visible behavior did not change. No Git write operation was executed.

## 22. Catalog re-audit review hypotheses

### 22A. Reproducible source-content digest

1. **Selected:** the catalog stores normalized source-content results, but the repository has no implementation that can reproduce them. The prior audit depended on an untracked extraction script, so tests cannot prove its ordering, entry-type handling, symlink behavior, or rejection paths.
2. The existing installed-tree digest can audit source commits without another implementation. Rejected: it walks a materialized filesystem, rejects symlinks, and does not bind Git entry modes or object types. Source audit must read the pinned commit from Git's object database without a checkout.
3. Hashing only relative paths and blob bytes is sufficient. Rejected: a regular file, executable file, and symbolic link can carry identical bytes under different Git modes. The source digest must bind entry mode, object type, relative path, and blob bytes.

### 22B. Generated catalog ownership

1. **Selected:** `packages/extensions/tool-cordis/src/api-catalog.ts` is stale because the Cordis catalog generator has not projected the current `CuratedCandidate` owner declaration. The owner already exposes `sourceContentSha256`, while the generated declaration still exposes `tarballSha256`.
2. A second schema still owns `tarballSha256`. Rejected: the curated policy parser rejects that key, and repository search finds it only in a negative compatibility test and stale generated output.
3. `docs/config-catalog.md` should be repaired directly. Rejected: it is generated from package config declarations and runtime schemas; the owner declarations must remain authoritative and the official generator must produce the English catalog.

### 22C. TDD and implementation evidence

- **RED:** the new local Git fixture suite failed because `scripts/audit-curated-candidates.ts` did not exist. The repository command-entry test then failed because `package.json` had no `audit-curated-candidates` script. A real invocation exposed pnpm's leading `--` separator before any network or catalog operation; its focused parser regression failed before the parser accepted that standard form.
- **GREEN:** the fixture suite passes stable-order and object-database-only checks, proves that content, executable mode, and symlink mode produce four distinct digests, rejects a gitlink, tree object, and backslash path, and terminates a blocked fetch under the supplied deadline. The repository command accepts either one catalog candidate or an explicit repository and commit, permits only canonical HTTPS GitHub URLs, creates a temporary bare repository, fetches with a 50-second maximum total budget, and reads blobs with `ls-tree -z` plus `cat-file --batch`.
- The digest starts with `dsh-source-content-v1\0`. Every entry is globally sorted by UTF-8 POSIX relative path bytes; entry mode, object type, path, and blob bytes are each prefixed with an unsigned 64-bit big-endian byte length before hashing. Modes other than `100644`, `100755`, and `120000`, every non-blob entry, non-portable paths, blobs over 128 MiB, and trees over 256 MiB fail closed. Symlink blobs contain link-target bytes and are never followed.
- The new framing changed all 23 verified values. The allowlist, policy expectations, candidate manifest, and six-candidate rollback lock now contain values emitted by this implementation.

### 22D. Final verified-candidate re-run

Every row ran `gtimeout 52s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm run audit-curated-candidates -- --candidate <candidate> --timeout-ms 50000`. All commands exited 0 and returned `matchesCatalog:true`; observed wall times were approximately 2.5–7.6 seconds.

| Candidate argument | Entries | `sourceContentSha256` | Result |
| --- | ---: | --- | --- |
| `dsh-toolkit` | 297 | `4674b31fa798d66629f4fcac7edad917c10e1b68b37a86103178a645747da14b` | match |
| `dsh-context` | 99 | `06fa51a9c04a462d7455debd18ba2bcd8e9cbc6dd32753cba1e687ed58722360` | match |
| `dsh-web-search-pro` | 124 | `10f5c774c9eae23337db8e4ecf5a5805243693a057b1074ef8ba639d74d1cd2f` | match |
| `dsh-memento` | 74 | `5e44a5e6e68c6364b2ebe91bd5ff13df27e71bf45e7f31a718850374ab5b6884` | match |
| `dsh-mcp-panel` | 83 | `8ff0d62a3eddb3857fc324d2c3bb5250048d04d4dca064864b3565fbea6a16eb` | match |
| `dsh-checkpoint-rewind` | 67 | `03c437ce36f67762d0f00b5df9243aa2e4a363e523c0c743953d5cf45a3abd27` | match |
| `dsh-lsp-actions` | 91 | `3fa924a6b928633f472f9321fe3b01af4c5f68e5ef452b7098e5471efe61ee58` | match |
| `dsh-permission-rules` | 79 | `ac562528675cdbaf364856c1adb2785f3b0738a101ccfc578b93007fa4d14652` | match |
| `dsh-smooth-stream` | 65 | `1a0322713fafeaccbb77e92fa2673da363676516cde88512b4949b43299573c8` | match |
| `upstream-radar` | 423 | `211f62a59d2d28bef03e76728412a341b5c35890a6e58ce8f143d59fd18fc0b6` | match |
| `dsh-plugin-hub` | 20 | `dc5ce2b08737a2e1941bcbe581fda063ab63cf3d89d5355cfc98a2b6f40efc87` | match |
| `dsh-plugin-check` | 50 | `d0bb42f6664076960df363569f217da833082a9c3412edcbceebaf8deb145295` | match |
| `plugin-session-export` | 646 | `da7f8e55285057328909c0db840d617aa8cf7e90a647d0bc7f5e79e15d985480` | match |
| `loongsuite-dsh-plugin` | 33 | `6bf862e166fc1a3547d8764db2759381b4ee99f4ca9856c4b1ad7c74ed37e893` | match |
| `dsh-config-manager` | 288 | `b01aecfe0782bbcecd2d5cd60e897d162b79dde0cfe50d8ff6003e6568cdd06b` | match |
| `dsh-better-sidebar` | 297 | `16530eca80d7a25fce018da18d3ab2e1f3a2a44120fb89f39da2ee9383f0fcd2` | match |
| `dsh-agent-team-gui` | 97 | `1fa83ba2e1b638089f82ffb52527bba630127c1bd4f0076dd9c7cabbb20d999d` | match |
| `dsh-background-agents` | 126 | `c5910d771b2a1eea8faf14ed5e88719da91f54f3ff4fc54dad1b477c95be9f07` | match |
| `dsh-computer-use` | 116 | `95a18b85e4c5b5097d2095096373bd99705bc26d63eb664c14b0e91ce3dc3f3e` | match |
| `dsh-vision-router` | 271 | `7e6a3492d703fc2ca2adc81f376485b23e8c018e5a227c2522e7bf70db909356` | match |
| `dsh-llm-fallbacks` | 171 | `61fd65893d6917c73c366ae5fc2c2480159b2ce56e2ebb9d5ce7a1995a65eacf` | match |
| `dsh-univer-office` | 290 | `6e1af85f2ba357fbeb6fa4f5adcfba7cc71efa056ef3b1ab2f33ce552f8fc8e6` | match |
| `dsh-feishu` | 183 | `ff0f3da84d88036fbef2f80a936c93e28d4326b9f068b31cce19735e8661fae8` | match |

### 22E. Verification

- `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run scripts/audit-curated-candidates.spec.ts --reporter=dot` passed six offline tests after the missing-module and missing-command RED runs.
- `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-bench/tests/bench.spec.ts --coverage --coverage.include='packages/curated/curated-policy/src/index.ts' --coverage.include='packages/curated/curated-bench/src/invariant.ts' --coverage.include='packages/curated/curated-bench/src/snapshot.ts' --coverage.reporter=text --reporter=dot` passed 145 tests with 100% statements, branches, functions, and lines for all three included files.
- `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --coverage --coverage.include='packages/curated/curated-scripts/src/index.ts' --coverage.reporter=text --reporter=dot` passed 309 tests with 100% statements, branches, functions, and lines.
- The initial combined coverage command reached the 50-second hard limit before producing a report. A concurrent split attempt then invalidated the curated-scripts run because both Vitest processes shared `coverage/.tmp`; the two serialized commands above are the valid coverage evidence.
- Host typecheck and bundling, Client typecheck, scoped Oxlint, Cordis catalog freshness, config catalog freshness, type equivalence, all 1,022 bilingual pairs, Agent Note format, Markdown wrapping, and staged/unstaged diff checks passed.
- `packages/extensions/tool-cordis/src/api-catalog.ts`, `docs/config-catalog.md`, and `docs/config-catalog.zh.md` contain no `tarballSha256`. The generated Cordis declaration exposes `sourceContentSha256` from the `CuratedCandidate` owner.

## 23. Catalog v2 review fix

Repository search found no code or automated test consumer for `tests/fixtures/latest-dep.json`; the only reference is the documented manual negative command in the implementation roadmap. The fixture remains because its `commit: "latest"` case records useful rejection behavior and may include user-authored changes that must survive rollback.

The fixture now uses catalog schema version 2, replaces `tarballSha256` with `sourceContentSha256`, and carries non-placeholder `treeSha256` and `runtimeDependencyClosureSha256` values required for an active v2 candidate. Its mutable commit remains unchanged, and `validateCandidateLock()` still reports `candidate-commit-unpinned`.

The policy suite now keeps the legacy field in an explicit schema-v1 negative input, rejects it during parsing, scans repository JSON and YAML assets to prevent the field from entering schema-v2 data, and directly proves the retained fixture's v2 fields and unpinned-commit rejection.

Verification:

- `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts --reporter=dot` passed 122 tests.
- `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec tsx scripts/run-oxlint.ts packages/curated/curated-policy/tests/catalog.spec.ts` completed with zero warnings and zero errors.

## 24. Documentation evidence audit

Date: 2026-08-27

Verdict: **DONE_WITH_CONCERNS**

### 24A. Evidence semantics

The E0-E5 ladder and benchmark `evidenceKind` are independent classifications. `planned` records only that a campaign has not run and cannot establish E1 by itself. `fixture` records input provenance; sufficiently specific fixture content can support E1 or E2, but the label adds no evidence. `observed`, producer metadata, and run fields are operator assertions, while `accepted` records structural, comparability, and threshold success; neither independently proves E3 or E4. E5 requires reproduction in another environment. The deep-research candidate conclusions remain bounded at E1.

The current documents no longer treat the temporary Task 19.2 installation command as retained evidence. Its profile root and lifecycle artifacts were not preserved, so current durable conclusions remain configuration and artifact checks. Candidate initialization, enable/restart/unload, user-path execution, and long-cycle campaigns remain pending.

### 24B. Session invariant

The regression matrix now separates two facts. First-party JSONL persistence and Host export are pinned by their owner tests, including verbatim `readRaw`, reopen/round-trip behavior, and ZIP preservation of the stored root artifact. The inactive `plugin-session-export` candidate remains a separate admission fact and does not stand in for the first-party session path.

### 24C. Owner documentation

The scoped owner audit found the new facts in their owning surfaces without adding duplicate README prose:

- curated-policy types and README own `sourceContentSha256` and runtime dependency closure declarations;
- curated-profiles API JSDoc and README own mandatory boot admission;
- curated-scripts README and public JSDoc own distinct bins, credential-shaped environment removal, and the execution-budget limits;
- curated-bench snapshot code and README own referenced rollback-content equality and external restoration;
- the active curated governance Agent Note records the cross-package decisions and evidence limitations.

The smoke public JSDoc states that one execution budget starts at function entry, synchronous `Worker` construction cannot be preempted, the remaining budget is recomputed after construction, and worker inspection and child stages are terminable. It also states that the command does not import candidates, initialize plugins, or start the profile runtime.

### 24D. Scope audit

The catalog contains 37 candidates and exactly six active candidates. The ten Markdown files under `docs/plugin/superpowers/` contain zero checked boxes and 92 pending boxes; no long-cycle item was marked complete. Markdown links and fragments resolve. The prose recall scan produced only the sanctioned Chinese phrase “保持私有” in an Agent Note alternative.

### 24E. Verification

- First-party JSONL persistence and Host session export: two test files, 186 tests passed.
- Official headless one-task snapshot: one test passed with 14 unrelated scenarios skipped by the title filter.
- Markdown links: 2,077 files passed.
- Markdown wrapping: 2,030 files passed.
- Type equivalence: 400 owner blocks and 400 paired derivatives passed.
- Translation pairing: all 1,022 in-scope pairs passed; `docs/plugin/superpowers/` remains excluded and no translation was created.
- Agent Note format: all 605 active notes passed.
- Document budgets: all nine budgeted documents passed.
- Package README Model Experience and limitations checks: all 234 package READMEs passed.
- Cordis catalog freshness, curated-scripts typecheck, scoped Oxlint, owner-fact assertions, and staged/combined scoped diff checks passed.
- `verify-export-jsdoc` remains blocked by the pre-existing untracked generated declaration `packages/session/session-persistence-jsonl/src/index.d.ts:53`, where `JsonlSessionPersistence.config` lacks JSDoc. The source owner is outside this task, and this audit did not edit or remove the generated file.

No Git write operation was executed. Existing staged and unrelated dirty-worktree content was preserved.

## 25. Documentation review and detached smoke-worker termination

Date: 2026-08-27

### 25A. Assumptions and hypotheses

1. **Assumption:** the index present at task start belongs to earlier work. This task may add worktree changes but must not run `git add` or otherwise alter the existing index.
2. **Assumption:** current owner prose comprises the `docs/plugin/superpowers` topic pages and index, the curated-scripts public JSDoc and README pair, and the active curated governance Agent Note pair. Historical review reports remain evidence snapshots; this section appends the corrected result instead of rewriting their chronology.
3. **Selected documentation hypothesis:** the standalone-sidecar success claim survived in `03`, `05`, and the superpowers README because those pages copied an earlier resolver design. Evidence: current resolver semantics, curated package READMEs, and the active governance note already state that unmanaged roots are metadata-only and package-authored sidecars are not admission evidence.
4. The current resolver may still convert `.dsh-curated-artifact.json` from an unmanaged root into observed success, making the prose intentional. Rejected: the complete curated-scripts suite pins unmanaged roots to `observed: false`, and owner prose consistently requires a managed `dsh.profile` plus both lockfiles for observed verification.
5. **Selected timeout hypothesis:** the staging deadline settled the result Promise, but `finally` then awaited `worker.terminate()` without a second bound. A delayed termination Promise therefore extended `runSmokeProfile()` beyond its wall-clock budget.
6. Removing the `await` alone is sufficient. Rejected: timeout, message, and error paths would retain worker listeners or an event-loop reference, and a detached termination rejection could become unhandled. Cleanup must synchronously clear the timer, remove listeners, and unreference the worker before initiating termination with a rejection sink.

### 25B. TDD evidence

- **RED:** `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'detaches staging workers and timers without awaiting delayed termination' --reporter=dot` exited 1. The 250 ms watchdog reported `runSmokeProfile awaited delayed worker termination`.
- **GREEN:** the same command passed after every worker settlement path cleared its timer and listeners, called `unref()`, and initiated `terminate()` without awaiting it. The fake worker covers timeout, normal message, and error outcomes; after each call it has no listeners or reference, the tracked timer set is empty, and a late termination rejection produces no `unhandledRejection`.
- The smoke-profile-focused run passed 66 tests. The complete curated-scripts run passed 310 tests and reported 100% statements, branches, functions, and lines for `src/index.ts` and `src/staging-worker.ts`.

### 25C. Documentation result

- `03`, `05`, and the superpowers README now state that a standalone artifact root is metadata-only with `observed:false` and that package-authored `.dsh-curated-artifact.json` cannot establish observed success.
- The retained Ralph spec and plan state that this task does not run `git add` or change the pre-existing index. The plan is reduced from 327 to 66 lines and links to `06` instead of copying its evidence table and current prose.
- Public JSDoc, the curated-scripts README pair, and the active governance Agent Note pair state that the deadline bounds command results, not complete worker exit. Termination is best-effort after timers, listeners, and the worker reference are released.

### 25D. Verification

- Curated-scripts package typecheck passed.
- Scoped Oxlint over the changed source and test passed with zero warnings and zero errors.
- Repository `pnpm run lint` completed its Host build, then exited 1 on 1,130 pre-existing diagnostics in untracked generated `src/*.d.ts` files such as `packages/test-support/loader-smoke/src/index.d.ts` and `packages/boot/cmdline/src/index.d.ts`. No failing path belongs to this fix.
- Markdown links checked 2,077 files; Markdown wrapping checked 2,030 files; translation pairing checked all 1,022 pairs; Agent Note format checked all 605 active notes.
- The chain-of-thought recall battery found no hits in `docs/plugin/superpowers`. The stale standalone-sidecar-success scan found no hit in current owner docs.
- No Git write operation was executed. Existing staged and unrelated dirty-worktree content remains untouched.

## 26. Worker-construction deadline and checklist history re-review

Date: 2026-08-27

### 26A. Assumptions and hypotheses

1. **Assumption:** the existing index is user-owned state. This fix may change the worktree only; it must not add, remove, or replace any staged content.
2. **Assumption:** a fake Worker that blocks synchronously in its constructor is the narrow deterministic test control for constructor cost. It exercises the production deadline code without adding a production option or depending on operating-system worker startup variance.
3. **Selected deadline hypothesis:** `runSmokeStagingWorker()` computes `remaining` before `new Worker(...)` and reuses it for the timeout timer. A slow constructor therefore receives its construction time plus the old remaining budget. Evidence: a 60 ms injected constructor under a 40 ms total budget returned after 104.48 ms.
4. Cleanup or detached termination is the source of the extra elapsed time. Rejected: the existing fake Worker keeps `terminate()` unresolved, while synchronous cleanup removes listeners and references before the command returns. The RED elapsed time matches the constructor delay plus the stale 40 ms timer.

### 26B. TDD and implementation evidence

- **RED:** `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'detaches staging workers and timers without awaiting delayed termination' --reporter=dot` failed because 104.48 ms exceeded the 85 ms bound.
- **GREEN:** worker construction is followed by a fresh `deadline - performance.now()` calculation. An exhausted budget returns the staging timeout through the existing `finally`, which clears the timer, removes listeners, unreferences the worker, initiates termination exactly once, and observes a late termination rejection.
- The regression injects a 60 ms synchronous constructor under a 40 ms budget and requires elapsed time from 60 ms through 85 ms. The same test covers ordinary timeout, message, and error settlement; every fake Worker ends unreferenced with no listeners, no tracked timer remains, and no `unhandledRejection` is observed.
- The preparation wait, injected synchronous inspection check, worker wait, and both child-stage waits all derive remaining time from the same monotonic execution budget. Synchronous `Worker` construction cannot be preempted; its elapsed time is charged when the command recomputes the remainder. No stage receives a replacement relative budget.
- The exact focused test passed. The complete `commands.spec.ts` coverage run passed 310 tests and reported 100% statements, branches, functions, and lines for `src/index.ts` and `src/staging-worker.ts`.
- The curated-scripts package typecheck passed. Scoped Oxlint over the changed source and test reported zero warnings and zero errors.
- `pnpm run doc-sync` completed in 38.55 seconds with 27 passes and one failure from the pre-existing untracked generated declaration `packages/session/session-persistence-jsonl/src/index.d.ts:53`, where `JsonlSessionPersistence.config` lacks JSDoc. No Task 20 file caused that diagnostic.

### 26C. Checklist history

The two earlier checked items now state only that their corresponding rounds added no staged content and did not change the index that already existed at those times. They no longer imply that the current index is empty. The final current-round item still requires both no newly staged content and an unchanged pre-existing index.

## 27. Final bits review wave 1

Date: 2026-08-27

These hypotheses were recorded before adding the regression tests or changing production code.

### 27A. Flow-mapping YAML diagnostic redaction

1. **Selected:** malformed-YAML redaction extracts only the first mapping key from each physical line, so a later secret key in a flow mapping does not mark that line for redaction. The reproduced diagnostic for `{visible: ok, apiKey: LEAK123, broken: [}` contains `LEAK123`.
2. Generic secret-value patterns should remove the value after YAML formatting. Rejected: an ordinary credential value has no token prefix or PEM marker, so only key-aware code-frame redaction can identify it.

### 27B. Canonical npm integrity

1. **Selected:** policy validation checks only the `sha512-` prefix and Base64 character set. It does not decode the digest, require 64 bytes, require canonical Base64, or reject a repeated-byte placeholder. `sha512-a` therefore produces no integrity issue.
2. Downstream benchmark snapshot validation makes the policy check sufficient. Rejected: catalog admission calls `validateCandidateLock()` independently, and its accepted result reaches profile materialization and observed command setup before rollback snapshot validation is relevant.

### 27C. Git audit environment isolation

1. **Selected:** `runGit()` spreads `process.env`, so Git-specific variables take precedence over each command's `-C` repository. Setting `GIT_DIR` to another object database makes `auditGitCommit()` read that repository.
2. `-C <gitDirectory>` always fixes repository identity. Rejected by the Git probe: `GIT_DIR` overrides repository discovery after `-C`; configuration and alternate-object variables can likewise redirect inputs.
3. Keeping the ambient environment is necessary to launch Git. Rejected: Git needs a small launch environment containing path, home, locale, proxy, temporary-directory, and Windows process variables; ambient Git controls and credential-shaped values are not required.

### 27D. Incomplete JSON auth redaction

1. **Selected:** complete JSON uses structural key redaction, but the text fallback has a separate quoted-key allowlist that omits `auth`, `auth_*`, and `*_auth`. An unterminated `{"auth":"plain confidential value"` fragment is returned unchanged.
2. The unquoted assignment fallback covers quoted JSON keys. Rejected: its key expression cannot cross the closing quote before the colon.
3. Secret-value patterns cover arbitrary auth values. Rejected: ordinary confidential text has no bearer, provider-token, or private-key marker.

### 27E. Git repository identity

1. **Selected:** `normalizeGitRepository()` clears query parameters before identity comparison and does not reject URL credentials. Manifest and lock URLs carrying credentials can therefore compare equal to the clean catalog repository.
2. Catalog secret scanning rejects credentialized dependency strings. Rejected: recursive secret scanning treats the whole dependency URL as a scalar and does not parse query keys or URL user information.
3. The commit fragment already prevents this ambiguity. Rejected: direct Git parsers extract the commit before repository normalization; the query remains part of the repository capture and is silently discarded.

### 27F. Artifact tree resource bounds

1. **Selected:** artifact hashing recursively enumerates the complete tree and stores every file before applying only a byte limit. Deep directory chains can exhaust the call stack, and many zero-byte entries can consume unbounded traversal time and memory.
2. The 64 MiB tree limit also bounds entry count. Rejected: directories, links, and zero-byte files contribute no content bytes.
3. Smoke's worker deadline bounds every caller. Rejected: observed `verify-lock` and `preflight` perform the same synchronous inspection in the main process.

### 27G. TDD and implementation evidence

- **Flow-mapping YAML RED:** policy and command diagnostics both exposed `LEAK123` from a later escaped `apiKey` in one malformed flow-mapping line.
- **Flow-mapping YAML GREEN:** the shared policy formatter scans every mapping separator outside escaped single- and double-quoted regions. Any secret-shaped key marks the complete physical line for redaction, while parser reason, file identity, line, column, caret, and existing unrelated-line behavior remain unchanged.
- **npm integrity RED:** policy admission accepted short, non-canonical, wrong-length, and repeated-byte `sha512-` values.
- **npm integrity GREEN:** `isExactNpmIntegrity()` requires canonical Base64 decoding to exactly 64 non-placeholder bytes. Policy admission and benchmark rollback validation use that one helper, and positive command fixtures carry valid SHA-512 SRI values.
- **Git audit environment RED:** a real audit invoked through a Git probe inherited `GIT_DIR`, `GIT_OBJECT_DIRECTORY`, and a token-shaped variable, so the probe rejected the invocation before reading the requested repository.
- **Git audit environment GREEN:** Git receives an allowlisted launch environment containing path, home, locale, proxy, certificate, temporary-directory, and required Windows process variables. Ambient `GIT_*` and credential-shaped names are removed before controlled non-interactive Git settings are added.
- **Incomplete JSON RED:** staging failures containing unterminated quoted `auth`, `auth_*`, `*_auth`, and escaped `auth` keys serialized their ordinary confidential values.
- **Incomplete JSON GREEN:** the text fallback scans escaped JSON string keys and redacts quoted, unterminated, malformed-key, and unquoted values whose decoded or conservative fallback key matches the structural secret-key rule.
- **Git URL RED:** matching credential-query URLs in the profile manifest and both pnpm lockfiles were normalized to the clean catalog repository and accepted.
- **Git URL GREEN:** repository parsing rejects username, password, and query fields before normalization, requires a two-segment GitHub HTTPS URL, and preserves the existing separately parsed full commit and repository path.
- **Artifact bounds RED:** an exact 1,000-entry tree was accepted, but a 1,001st entry reached ordinary type or digest validation; a 65-level directory tree was also accepted.
- **Artifact bounds GREEN:** iterative traversal counts every child file, directory, and link before type handling, accepts exactly 1,000 entries and 64 nested directory levels, and returns stable `artifact-entry-count-exceeded` or `artifact-depth-exceeded` issues above those limits. Existing byte, containment, symlink, regular-file, and descriptor-stability checks remain in place.

### 27H. Verification

- The RED runs failed for all six intended pre-fix behaviors before production changes.
- Complete owning tests passed: curated policy 123, curated benchmark 25, curated scripts 321, and source audit 7.
- Per-file package coverage reported 100% statements, branches, functions, and lines for `curated-policy/src/index.ts`, `curated-bench/src/snapshot.ts`, and `curated-scripts/src/index.ts`. The repository's package-source coverage gate does not include `scripts/audit-curated-candidates.ts`; its complete owning suite passed, and its separate informational instrumentation reported 73.15% statements, 63.08% branches, 89.47% functions, and 79.16% lines.
- Curated policy, benchmark, and scripts package typechecks passed. Root Host and Client typecheck passed.
- Workspace constraints passed after adding the benchmark-to-policy helper dependency.
- Scoped Oxlint reported zero warnings and errors over the seven changed TypeScript source and test files.
- Both changed README pairs, repository Markdown wrapping, and targeted staged and unstaged diff checks passed.
- `doc-sync` completed 27 of 28 gates. The only failure is the pre-existing untracked generated declaration `packages/session/session-persistence-jsonl/src/index.d.ts:53`, where `JsonlSessionPersistence.config` lacks JSDoc; no Task 20 file appears in the failure.
- No Git write operation was executed, and existing staged and unrelated dirty-worktree content was not changed intentionally.

## 28. Wave 1 remaining-item re-review

Date: 2026-08-27

These assumptions and hypotheses were recorded before adding the remaining regression tests or changing production code.

### 28A. Assumptions

1. The existing index and unrelated worktree changes are user-owned. This re-review may change only the report and the policy/scripts source and test files; it must not run a Git write operation.
2. Malformed YAML and JSON diagnostics fail closed at the physical-line or field value that carries a secret while retaining unrelated lines, stable locations, and parser carets.
3. Artifact traversal may retain the final global path sort required by the tree digest, but directory enumeration must stop as soon as the global entry count exceeds 1,000 and must close every opened directory on success or failure.

### 28B. Zero-space YAML flow mappings

1. **Selected:** `yamlMappingKeys()` and `yamlMappingSeparator()` recognize `:` only when the following character is whitespace or end-of-line. Flow mappings permit zero whitespace after `:`, so quoted, escaped, single-quoted, and unquoted secret keys in `{visible:ok,"apiKey":"LEAK",broken:[}` are not classified and their physical line remains visible.
2. `js-yaml` normalizes flow mappings before diagnostic formatting. Rejected: `formatYamlParseError()` receives the original source and parser snippet, and secret-line discovery operates on that source text.
3. Redacting only the matched value is sufficient. Rejected: malformed flow syntax does not provide a reliable scalar endpoint; replacing the complete corresponding physical line is the existing fail-closed rule and preserves other source lines plus location metadata.

### 28C. Invalid whole-JSON fallback

1. **Selected:** whole-document `JSON.parse()` and embedded-fragment `JSON.parse()` both fail when any value contains an illegal escape such as `\q`; safety then depends entirely on the quoted-field scanner. That scanner decodes legal key escapes independently, but its unquoted value branch stops at the first whitespace and can expose the remaining words.
2. A failed whole-document parse prevents legal key escapes from being decoded. Rejected: `decodeJsonString()` parses each completed key token independently, so legal Unicode and quote escapes remain decodable even when another token makes the document invalid.
3. Generic token replacement covers the exposed suffix. Rejected: ordinary multiword authentication values have no provider token prefix and therefore require key-aware field redaction through the next structural delimiter or physical-line end.

### 28D. Bounded artifact directory consumption

1. **Selected:** iterative traversal avoids call-stack growth, but `readdirSync(directory, { withFileTypes: true })` materializes every entry in one directory before the loop can enforce `MAX_ARTIFACT_ENTRY_COUNT`. A flat directory far above the limit is therefore fully read before the stable count error is returned.
2. The 1,000-entry global count bounds `readdirSync` allocation. Rejected: the count is checked only after `readdirSync` has returned its complete array.
3. Reading one directory into a bounded local array is required for deterministic hashing. Rejected: the digest already sorts the complete bounded file list by UTF-8 path after traversal, so directory entries can be processed one at a time without changing the hash order.

### 28E. TDD evidence

- **YAML RED:** both policy and command focused runs failed all five zero-space cases. Double-quoted, Unicode-escaped, quote-escaped, unquoted, and single-quoted secret keys left the malformed flow-mapping line visible.
- **YAML GREEN:** flow-collection depth now permits a mapping separator without trailing whitespace while preserving the stricter block-mapping rule. Both focused suites redact the complete physical line and retain the parser location and caret; the existing escape-aware malformed-YAML cases continue to retain unrelated diagnostic lines.
- **JSON RED:** a wholly invalid object containing legal Unicode- and quote-escaped secret keys, an illegal `\q` value escape, and an unquoted `auth_header` value retained `auth multiword value` after replacing only its first word.
- **JSON GREEN:** quoted keys are still decoded independently of the whole document, while an unquoted secret value is replaced through its next comma, closing bracket, closing brace, or physical-line end. The focused case hides `auth`, escaped `auth`, escaped `apiKey`, `auth_*`, and multiword values.
- **Artifact RED:** the flat-directory spy observed zero `Dir.readSync()` calls because the implementation used `readdirSync()` and materialized all 1,104 entries before returning `artifact-entry-count-exceeded`.
- **Artifact GREEN:** iterative traversal opens each directory with `opendirSync()`, consumes one `Dirent` per `readSync()`, and closes the handle in `finally`. The over-limit fixture observes exactly 1,001 reads and one close; the existing exact 1,000-entry fixture succeeds. Files remain globally sorted by UTF-8 relative path before hashing.

### 28F. Verification

- The complete policy and scripts owning suites passed 454 tests.
- The same 454 tests passed with 100% statements, branches, functions, and lines for `curated-policy/src/index.ts` and `curated-scripts/src/index.ts`.
- Curated-policy and curated-scripts package typechecks passed.
- Scoped Oxlint over both source files and both owning test files completed with zero warnings and zero errors.
- Final scoped unstaged and staged diff whitespace checks passed after this evidence append.

## 29. Final bits review wave 2

Date: 2026-08-27

These assumptions and hypotheses were recorded before adding regression tests or changing production code.

### 29A. Assumptions

1. The existing index and unrelated worktree changes are user-owned. This fix may change only the curated profile, CLI, directly associated test, and report files, and must not run a Git write operation.
2. Enterprise restrictions apply to the final composed entry tree after bundle, profile, Harness-home, explicit CLI, and live-reloaded user layers. A static override remains valid only when the resulting approved entry still satisfies the enterprise restrictions.
3. `--dump-default-config` is a recovery path that excludes every user patch, but it still validates the curated template manifest, resolved bundle order, catalog assignment, and package-manager state.
4. Curated `dsh plugin --help` and `list` are read-only. They may materialize a missing profile, while package-state mutations and package-manager transformations remain rejected before pnpm starts.

### 29B. Enterprise restrictions on final composition

1. **Selected:** mandatory admission compares only executable identities after profile, home, and CLI overlays. An override that preserves an approved `id` and `name` therefore bypasses the enterprise configuration checks, which currently run only while materializing the profile patch. The same gap applies when `composeLive()` re-reads profile and home patches.
2. `validateExistingEnterprisePatch()` already validates the final composition. Rejected: it composes a synthetic governed-plugin base with only the profile patch and runs before home and CLI overlays are loaded. `assertCuratedProfileAdmission()` never calls the enterprise configuration validator.
3. Rejecting every enterprise override is necessary. Rejected: curated admission intentionally accepts static configuration overrides of approved entries, and the other curated profiles must retain that behavior. Enterprise needs the same identity admission plus restrictions on the resulting effective configuration.

### 29C. Default-only recovery

1. **Selected:** `prepareProfile(name, false)` skips the profile patch only in `loadProfile()`, but `ensureCuratedProfile()` first calls `materializeCuratedProfile()`, whose enterprise validation parses the existing patch unconditionally. A malformed or malicious enterprise patch therefore breaks the recovery command before the loader's `userLayer: false` option has any effect.
2. Home or CLI overlay loading causes the failure. Rejected: `runDumpConfig()` already omits both layer classes when `defaultOnly` is true; the remaining parser is the materializer's existing-enterprise-patch check.
3. Skipping all curated validation is required for recovery. Rejected: manifest and package-manager validation do not parse the user patch and remain necessary to prevent a default dump from trusting a divergent template or unsafe package-manager state.

### 29D. Curated plugin help

1. **Selected:** the curated command allowlist contains only `list` and runs before `ensureCuratedProfile()`. `dsh plugin --profile <curated> --help` is therefore rejected with exit code 2 and cannot materialize a missing profile.
2. Commander consumes `--help` before plugin dispatch. Rejected: plugin arguments after the `plugin` subcommand are forwarded through `invocation.args`; `runPlugin()` receives `--help` and applies its own curated allowlist.
3. Allowing `--help` would also allow package writes. Rejected: pnpm help is read-only, while add, remove, package transformation flags, and every other curated command remain outside the explicit read-only allowlist.

### 29E. TDD and implementation evidence

- **Enterprise composition RED:** an additional static layer kept the approved `memento` identity but changed `writePolicy` to `auto`; `assertCuratedProfileAdmission()` returned normally. The same test covered `captureContent`, `captureBody`, body egress, anonymous vision fallback, browser download, non-dry-run import, and session writes, plus a reloaded profile patch equivalent to `composeLive()`.
- **Enterprise composition GREEN:** both existing-patch materialization and mandatory admission compose an effective entry tree and pass it to one enterprise validator. Profile, Harness-home, CLI overlay, and live reload layers therefore receive the same identity and final-config checks. A later safe override can repair a weaker lower layer because admission evaluates the final composition, while non-enterprise static overrides retain their existing behavior.
- **LoongSuite RED/GREEN:** the first final-composition implementation still accepted `captureContent: true`; the added regression failed before `isSafeEnterpriseConfig()` required `captureContent === false` for `loongsuite-observability`, then passed.
- **Default-only RED:** a malformed existing enterprise patch made the source `--dump-default-config` command exit 1 from `validateExistingEnterprisePatch()` before `loadProfile(..., { userLayer: false })`.
- **Default-only GREEN:** `userLayer` is an explicit option propagated through `prepareProfile()`, `ensureCuratedProfile()`, `materializeCuratedProfile()`, and admission. The recovery command skips profile, home, and CLI user-patch parsing while retaining manifest, package-manager, resolved bundle order, and catalog assignment checks. On the same malformed patch, default-only exits 0 while ordinary dump and boot exit nonzero.
- **Plugin help RED:** source and built `dsh plugin --profile <curated> --help` both exited 2, and the source path did not create the profile manifest.
- **Plugin help GREEN:** the curated read-only command set contains only `--help` and `list`. Source and built entry tests exit 0 and materialize the profile; add, remove, package-state commands, transformations, build grants, and script-enabling flags still reject before pnpm starts.

### 29F. Verification

- The final focused profile and CLI run passed 49 tests and reported 100% statements, branches, functions, and lines for `packages/curated/curated-profiles/src/index.ts`.
- The built CLI test for first-use curated `plugin --help` passed. The built Web profile composition suite passed 30 tests, and the focused built HMR test passed.
- Root Host and Client typecheck passed. The targeted Host build refreshed the curated-profiles and CLI built entries.
- Scoped Oxlint over the eight changed TypeScript source and test files completed with zero warnings and zero errors.
- Full repository lint completed its Host build, then failed on 1,130 diagnostics from pre-existing untracked generated declaration files under paths including `packages/session/session-persistence-jsonl/src/*.d.ts` and `packages/test-support/llm-replay/src/index.d.ts`; no Task 20 source or test file appeared in the failures.
- `doc-sync` passed 27 of 28 gates. The sole failure remains the pre-existing untracked `packages/session/session-persistence-jsonl/src/index.d.ts:53`, where `JsonlSessionPersistence.config` lacks JSDoc.
- The three changed bilingual README pairs passed targeted pairing verification; the corpus-wide pairing gate also passed within `doc-sync`.
- Chrome 151 answered the required CDP 1.3 endpoint on port 9333. This change has no browser-rendered UI; Web verification used the real Web profile composition tests rather than launching a second non-CDP browser.
- Scoped staged and unstaged whitespace checks passed before this report append. No Git write operation was executed, and the existing index and unrelated worktree changes were preserved.

## 30. Final bits review wave 2 Important resolution

Date: 2026-08-27

### 30A. Assumptions and hypotheses

1. **Assumption:** `materializeCuratedProfile()` is the owner of the exact first-use bytes for `package.json`, `cordis.patch.yml`, `pnpm-workspace.yaml`, and `.npmrc`. A read-only plugin command may create those missing files through ensure, but it must preserve all four afterward.
2. **Assumption:** the existing index and unrelated worktree changes are user-owned. This fix may change only the CLI plugin implementation, its source and built-entry tests, and this report; it must not run a Git write operation.
3. **Selected hypothesis:** successful curated `--help` and `list` calls reach the ordinary-profile `reconcilePlugins()` path. With template dependencies absent from `node_modules`, `exportsPatch()` returns false and reconciliation removes those fixed bundles from the manifest.
4. `ensureCuratedProfile()` rewrites valid existing profile files. Rejected: materialization writes each owned file only when absent, and byte snapshots remain stable when reconciliation is bypassed.
5. pnpm's nonzero status causes the mutation. Rejected: the prior implementation called reconciliation only for status zero. Nonzero `--help` and `list` cases remain in the regression matrix to pin the complete read-only contract.

### 30B. TDD and implementation evidence

- **Test-control correction:** the first source RED attempt used `web-personal`, whose template has no third-party dependencies, so the old reconciliation had nothing to remove and the test passed. Changing the fixture to dependency-bearing `web-curated` made both source and built tests fail on the first successful `--help` manifest-byte comparison.
- **RED:** source and built entry tests each observed `package.json` losing the six curated candidate bundles after successful `--help` with no installed dependencies. The other three owned files remained equal, which isolated the mutation to reconciliation.
- **GREEN:** `runPlugin()` records whether the profile is curated before dispatch, reads reconciliation state only for ordinary profiles, and calls `reconcilePlugins()` only after a successful ordinary-profile command. Curated `--help` and `list` return pnpm's status without reconciliation for both zero and nonzero results.
- **Self-review RED/GREEN:** the first guard skipped reconciliation but routed successful curated commands through the shared failure `else`, so the built test observed a false `pnpm failed` diagnostic. Separating the nonzero diagnostic branch from the successful ordinary-profile reconciliation branch removed that diagnostic while retaining nonzero reporting.
- Both tests compare raw bytes for all four owned files against an independently materialized template after `--help` and `list` with status zero and nonzero. The first command materializes the missing profile, later commands exercise existing files, and no test creates `node_modules`.
- The existing built-entry update test still activates a dependency that gains `dsh.bundle`, proving ordinary-profile reconciliation remains unchanged.

### 30C. Verification

- Source plugin policy suite: 3 tests passed.
- Built CLI focused suite: the curated byte-preservation test and ordinary-profile reconciliation test passed.
- Focused source coverage: 3 tests passed; `apps/cli/src/plugin.ts` reported 39.18% statements, 27.58% branches, 71.42% functions, and 37.14% lines. CLI app sources are outside the repository's per-file `packages/*/*/src` 100% coverage scope; the changed curated success and failure branches executed in process.
- Root typecheck passed, including Host build and Client project references.
- Repository lint reached Oxlint and failed on 1,131 diagnostics in pre-existing untracked generated declaration files under `packages/**/src/*.d.ts`; no changed CLI file appeared in the failures. Scoped Oxlint over the implementation and both tests passed with zero warnings and zero errors.
- Repository Markdown wrapping and both unstaged and staged diff whitespace checks passed after the report update.
- No Git write operation was executed, and no manifest, patch, workspace, or npmrc file in the repository was edited.

## 31. Final bits review wave 3

Date: 2026-08-27

These assumptions and hypotheses were recorded before adding regression tests or changing production code.

### 31A. Assumptions

1. Every embedded or referenced object whose `kind` is `curated-lock-snapshot` or `curated-profile-snapshot` uses current schema version `2`. Missing, legacy, and future versions fail closed. An empty lock snapshot remains valid when it has `schemaVersion: 2`, the expected kind and profile, and an empty `candidates` array.
2. An exact npm version is a complete SemVer 2.0 version without a leading `v`, range operator, or distribution tag. Valid prerelease and build metadata remain accepted.
3. The existing index and unrelated worktree changes are user-owned. This fix may change only curated policy, benchmark, scripts, their directly associated tests and assets, and this report; it must not run a Git write operation.

### 31B. Snapshot schema version

1. **Selected:** rollback readers validate digest, kind, profile, and payload but never require `schemaVersion`. Both `readRollbackSnapshot()` and `readBenchmarkProfileSnapshot()` therefore accept missing, legacy, and future versions, while `validateSnapshotEnvelope()` and `validateReferencedSnapshot()` repeat the same omission in the static benchmark validator.
2. Only checked-in default assets are stale, while runtime validation already rejects incompatible versions. Rejected by source inspection: the current readers do not compare `schemaVersion` at all, and the test helper still emits candidate references plus an embedded profile snapshot with version `1`.
3. Requiring a non-empty candidate list would close the gap. Rejected because the official `web` baseline intentionally has no curated candidates; schema compatibility and candidate cardinality are independent rules.

### 31C. Exact npm SemVer

1. **Selected:** the current exact-version regular expressions model only three numeric components plus an optional permissive prerelease. They accept empty prerelease identifiers, consecutive dots, and numeric prerelease identifiers with leading zeroes, and they omit valid build metadata.
2. npm package-manager resolution will reject malformed versions before these validators run. Rejected because policy catalogs and rollback benchmark JSON are parsed and validated directly, including by static checks that do not invoke npm.
3. **Selected:** keeping separate corrected expressions in policy and benchmark would retain semantic drift. Policy catalog validation, benchmark rollback validation, and scripts lock-closure validation all consume the same exact-version concept, so one small exported predicate in curated-policy is the minimum single owner.
4. Adding `semver` is simpler and safer. Rejected for this scope because no curated package directly depends on it, strict SemVer 2.0 exact-version recognition is small, and adding a dependency would require a direct declaration plus publication-closure verification without deleting meaningful owned code.

### 31D. TDD and implementation evidence

- **SemVer RED:** the policy test failed all 19 table rows because the requested shared `isExactNpmVersion()` export did not exist. The bench test rejected valid `1.2.3-alpha.1+build.01`, and accepted `1.2.3-01` and `1.2.3-alpha..1`. The managed-lock test accepted `2.0.0-01` as an exact registry locator and failed later on the closure digest instead of the version rule.
- **SemVer GREEN:** curated-policy exports one documented SemVer 2.0 exact-version predicate. Policy catalog admission, benchmark rollback candidates, and scripts runtime lock traversal call it directly. The table accepts valid core, prerelease, and build forms, and rejects empty input, leading `v`, ranges, tags, leading-zero core numbers, empty identifiers, consecutive dots, and leading-zero numeric prerelease identifiers. No dependency was added.
- **Snapshot RED:** compare-benchmark accepted missing, legacy, and future schema versions for both embedded snapshots and all four baseline/candidate lock/profile references. The static benchmark validator did not report incompatible embedded or referenced versions, and the two dated default snapshots still declared version `1`.
- **Snapshot GREEN:** curated-bench exports one documented schema assertion requiring the numeric value `2`. Both compare-benchmark readers and both static-validator paths use it before kind, profile, or payload validation. The six default lock/profile assets and ordinary test fixtures declare version `2`; explicit negative fixtures cover missing, `1`, and `3`. The empty `web` lock remains valid with an empty `candidates` array.

### 31E. Verification

- Complete focused suites passed: curated policy 146 tests, curated benchmark 29 tests, and curated scripts 333 tests.
- Combined focused coverage passed 508 tests and reported 100% statements, branches, functions, and lines for `curated-policy/src/index.ts`, `curated-bench/src/invariant.ts`, `curated-bench/src/snapshot.ts`, and `curated-scripts/src/index.ts`.
- All three package typechecks and the root Host/Client typecheck passed. Scoped Oxlint over the seven changed TypeScript source and test files passed with zero warnings or errors.
- Workspace constraints, publint, NodeNext declaration compilation, runtime dependency closure, type equivalence, Cordis catalog freshness, config catalog freshness, and the three named README pairing checks passed.
- `doc-sync` completed 27 of 28 gates in 40.45 seconds. Its sole failure was the pre-existing untracked generated declaration `packages/session/session-persistence-jsonl/src/index.d.ts:53`, where `JsonlSessionPersistence.config` has no JSDoc.
- Root lint reached Oxlint and failed on 1,130 diagnostics from pre-existing untracked generated declaration files under `packages/**/src/*.d.ts`; no Task 20 source or test file appeared in the failures.
- Repository Markdown wrapping and both unstaged and staged diff whitespace checks passed after the final report update.
- No browser or transcript snapshot applies because this change affects offline policy and benchmark validation only. No Git write operation was executed.

## 32. Final bits review wave 3 Important resolution

Date: 2026-08-27

### 32A. Assumptions

1. A file under `baselines/locks/` is a published rollback lock and must independently identify every candidate's exact installation source; a schema-version claim cannot substitute for recoverable content.
2. A dated lock/profile pair with no consumer or benchmark reference has no compatibility obligation. Deleting it is safer than reconstructing candidate history without evidence.
3. The existing index and unrelated worktree changes are user-owned. This fix may change only curated-bench validation, its direct tests and assets, the owning documentation pair and Agent Note pair, and this report; it must not run a Git write operation.

### 32B. Hypotheses

1. **Selected:** the dated pair is retained only by a static filename assertion. Repository-wide `rg` found no runtime, script, benchmark, or documentation reference to either file, while the dated lock has a mutable `catalogRef`, no `candidates` array, and an unsupported claim of 21 active candidates. The pair can be deleted without replacing it.
2. A legitimate rollback consumer still reads the dated profile and requires the pair to remain available. Rejected by the same repository-wide reference search; no consumer names either path or derives the date.
3. The dated lock can be repaired by synthesizing 21 candidate records from current catalog data. Rejected because no immutable record identifies those 21 historical candidates or their exact installation sources, so such a file would invent rollback evidence.
4. Existing benchmark-reference validation is sufficient to prevent another bad published snapshot. Rejected by the RED test: an unreferenced malformed lock and profile under the published directories produced no validation message.

### 32C. TDD and implementation evidence

- **RED:** `gtimeout 50s env PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false pnpm exec vitest run packages/curated/curated-bench/tests/bench.spec.ts -t 'validates every published lock and profile snapshot' --reporter=dot` failed because `validateCuratedBenchAssets()` returned an empty array for unreferenced malformed snapshots.
- **GREEN:** the same focused test passed after static validation enumerated every direct JSON file under `baselines/locks/` and `baselines/profiles/`. It now requires schema version 2, directory-matched kind, a non-empty profile, the required array payload, no lock `catalogRef`, complete lock candidates with exact install sources, and non-empty profile bundle names.
- **Independent lock rules RED/GREEN:** a second focused run failed when a lock with both `catalogRef` and a missing `candidates` array reported only the missing payload. Moving the mutable-reference check before payload validation made the same test pass, so both defects are reported independently.
- The unused `locks/2026-08-24.json` and `profiles/web-curated-2026-08-24.json` files and their filename-only test assertions were deleted. No historical candidate record was created.

### 32D. Verification

- The complete curated-bench suite passed 30 tests. Its focused coverage run passed the same 30 tests and reported 100% statements, branches, functions, and lines for `curated-bench/src/invariant.ts` and `curated-bench/src/snapshot.ts`.
- The curated-bench package typecheck passed. Scoped Oxlint over the changed implementation and test reported zero warnings and zero errors.
- Package-level publint completed with `All good!`.
- `pnpm pack --dry-run --json` listed only `locks/web.json`, `locks/web-curated.json`, `profiles/web.json`, and `profiles/web-curated.json` under the snapshot directories; neither deleted dated asset is present.
- `doc-sync` passed 27 of 28 gates in 36.64 seconds, including documentation build, links, type equivalence, catalogs, translation pairing, Markdown wrapping, Agent Note checks, budgets, and site checks. The sole failure is the pre-existing untracked generated declaration `packages/session/session-persistence-jsonl/src/index.d.ts:53`, where `JsonlSessionPersistence.config` lacks JSDoc; no file in this fix caused that diagnostic.
- Repository-wide `rg` found no remaining dated-pair reference under `packages`, `apps`, `scripts`, `docs`, or `.agents`. Unstaged, staged, and combined-HEAD diff whitespace checks all passed.
- No browser or transcript snapshot applies because this change affects offline benchmark asset validation only. No Git write operation was executed.

## 33. Final bits review wave 3 recursive snapshot resolution

Date: 2026-08-27

### 33A. Assumptions

1. Published-snapshot validation recursively enumerates every entry in the `baselines/locks` and `baselines/profiles` trees, rejects symbolic links and entries that are neither regular files nor directories, and validates every JSON file in those trees as a snapshot. Each tree permits at most 1024 entries and 64 directory levels below its root.
2. Nested lock and profile directories are valid publication layout. The validator must accept valid nested snapshots rather than narrowing the package glob and removing an already supported layout.
3. Static validation must terminate predictably on malformed package trees. It may reject symbolic links, non-regular entries, and trees exceeding explicit directory or entry limits because none is required by the JSON publication contract.
4. Existing index and unrelated worktree changes are user-owned. This fix may change only curated-bench validation, its direct tests, and this report; it must not run a Git write operation.

### 33B. Hypotheses

1. **Selected:** `validatePublishedSnapshots()` scans only direct children with `readdirSync(root)`, while the package publishes recursive JSON globs. A nested malformed snapshot therefore enters the tarball without receiving schema, kind, profile, or payload validation.
2. The validator already recurses indirectly through `CuratedBench.listAssets()`. Rejected by source inspection: `validatePublishedSnapshots()` does not call the service and filters only one `readdirSync()` result per directory.
3. The smallest fix is to reject all child directories and change the package glob to direct children. Rejected because the existing package and service APIs intentionally support nested JSON assets; recursive validation preserves that contract with fewer manifest changes.
4. Pack output may already exclude nested files despite the manifest glob. This will be tested against `pnpm pack --dry-run --json`; the regression test requires the packed baselines list to equal the package's recursive JSON asset list.

### 33C. TDD and implementation evidence

- **RED:** the four focused tests produced three expected failures and one pass. Nested version/kind defects, a snapshot symlink, a FIFO, and directory/entry limit cases all returned no diagnostics; the independent pack-list test passed.
- **GREEN:** the same four tests passed after the static validator iteratively enumerated every entry in the lock and profile snapshot trees, rejected symbolic links and entries that were neither regular files nor directories, applied the default stable path sort within each tree for deterministic diagnostics, and applied the existing schema version 2, directory-specific kind, profile, payload, and candidate validation to every JSON file. The ordering does not participate in a digest.
- Each lock or profile tree permits at most 1024 entries and 64 directory levels below its root; level 65 is rejected.
- Valid nested lock and profile snapshots remain accepted.

### 33D. Verification

- Complete curated-bench suite: 35 tests passed.
- Focused coverage: the same 35 tests passed; `curated-bench/src/invariant.ts` and `curated-bench/src/snapshot.ts` each reported 100% statements, branches, functions, and lines.
- Curated-bench package typecheck passed.
- Scoped Oxlint over `src/invariant.ts` and `tests/bench.spec.ts` reported zero warnings and zero errors.
- Package publint completed with `All good!`.
- `pnpm pack --dry-run --json` matched the recursive `baselines` JSON asset list.
- Unstaged, staged, and combined-HEAD diff whitespace checks passed for the implementation, tests, and this report.
- No Git write operation was executed.

## 34. Final review profile-snapshot and report-contract fixes

Date: 2026-08-27

### 34A. Assumptions and hypotheses recorded before implementation

1. **Assumption:** a profile snapshot's `bundles` array is the complete ordered restoration input, including foundation bundles such as `@deepseek-ai/dsh-base`; it is not the optional third-party candidate list. An empty array cannot restore any current profile and is invalid. Empty lock `candidates` arrays remain valid for profiles with no third-party candidates.
2. **Assumption:** every embedded, referenced, and published profile snapshot uses the same `bundles` requirement: a non-empty array whose entries are non-empty strings. Missing values, non-arrays, empty arrays, and empty elements fail closed.
3. **Assumption:** compare-benchmark validates caller-supplied execution and run records, but its JSON comparison output projects only execution provenance, aggregate profile summaries, the decision and reasons, and immutable snapshots. It must not add raw run records or other caller task data.
4. **Selected validation hypothesis:** profile bundle validation is duplicated or absent across benchmark invariant and comparison paths. One curated-bench snapshot helper can make embedded, referenced, published, and comparison validation use the same rule and diagnostics.
5. Independent local checks are safer because invariant and comparison inputs have different labels. Rejected: separate implementations already drifted; aligned tests should exercise both consumers of one shared helper.
6. **Selected prose hypothesis:** the README and `BenchmarkProfileSummary.execution` JSDoc imply that raw run fields are retained in JSON output. The implementation instead summarizes runs and emits execution provenance, so the prose must describe that projection without widening output.

### 34B. TDD and implementation evidence

- **RED:** the aligned invariant and comparison tests each failed all four missing, non-array, empty-array, and empty-element cases. The invariant omitted the requested diagnostics. Comparison used one coarse error for some invalid values and accepted an empty embedded profile bundle list as an `accepted` result.
- **GREEN:** `assertBenchmarkProfileSnapshotBundles()` now owns the non-empty array and non-empty string-entry rules. Published, embedded, current-candidate, and referenced invariant paths call it; embedded and referenced compare-benchmark paths call the same helper. The aligned focused tests passed four cases in each owning suite.
- Empty profile bundle arrays are rejected because profile snapshots restore the complete ordered composition. Empty lock candidate arrays remain valid for profiles with no third-party candidates.
- The first package typecheck exposed that a `void` assertion did not narrow `profile.bundles` for the current-candidate comparison. Returning the validated `readonly string[]` from the helper fixed the type error without a call-site cast or duplicate filtering.
- The README pair and public JSDoc now state that execution and run fields are validated as input. Comparison JSON retains execution provenance, aggregate profile summaries, decisions and reasons, and immutable snapshots; it does not retain raw run records. No output field was added.

### 34C. Verification

- Focused owning suites passed: curated-bench 39 tests and curated-scripts 337 tests.
- Combined focused coverage passed 376 tests. `curated-bench/src/invariant.ts`, `curated-bench/src/snapshot.ts`, and `curated-scripts/src/index.ts` each reported 100% statements, branches, functions, and lines.
- Curated-bench and curated-scripts package typechecks passed.
- Scoped Oxlint over the five changed TypeScript source and test files completed with zero warnings and zero errors.
- The curated-scripts README pair check passed, and its pair record matches the current English and Chinese blob hashes.
- Scoped unstaged, staged, and scoped combined-HEAD diff whitespace checks passed. No Git write operation was executed.

## 35. Final review referenced-lock and pending-output fixes

Date: 2026-08-27

### 35A. Assumptions recorded before implementation

1. A referenced lock snapshot uses the same required `candidates` array and candidate schema as the compare-benchmark CLI. Missing and non-array values must fail rather than suppress candidate validation; an empty array remains valid.
2. Pending JSON retains the command-wide `command` and `ok` fields, then reports only `evidenceKind`, `status`, `pendingCampaigns`, and the baseline/candidate `profile` identities. It must not expose rollback snapshots, aggregate summaries, decisions, or reasons for work that has not completed.
3. Observed and fixture inputs with completed runs retain the existing comparison projection: execution provenance, aggregate profile summaries, status and reasons, and immutable snapshots, without raw run records.

### 35B. Hypotheses

1. **Selected:** referenced lock validation is conditional on `Array.isArray(snapshot.candidates)`, so missing and wrong-type values bypass the candidate validator while arrays still validate each item.
2. The shared rollback-candidate validator accepts missing candidates. Rejected by source inspection: `assertBenchmarkLockSnapshotCandidates()` already requires an array and validates every element; the referenced path does not call it.
3. **Selected:** pending output is formatted separately but still carries `previousSnapshots`, causing the general completed-comparison README and JSDoc description to overstate pending detail.
4. The comparison formatter is shared by completed and pending results. Rejected by source inspection: `formatPendingBenchmark()` owns pending JSON independently of `formatBenchmarkComparison()`.

### 35C. TDD and implementation evidence

- **Referenced lock RED:** the focused table produced two failures and one pass. Missing and object-valued `candidates` produced no referenced-lock diagnostic, while an array containing `null` reached the existing item validator.
- **Referenced lock GREEN:** `validateReferencedSnapshot()` now calls `assertBenchmarkLockSnapshotCandidates()` unconditionally for lock snapshots. The same three cases pass with the shared CLI diagnostics for missing, wrong-type, and invalid-element values.
- **Pending output RED:** the exact pending JSON assertion failed only because `previousSnapshots` was present.
- **Pending output GREEN:** `formatPendingBenchmark()` omits `previousSnapshots`. Its JSON contains the common `command` and `ok` fields, `evidenceKind`, `status`, `pendingCampaigns`, and baseline/candidate `profile` identities. The README pair and `runCompareBenchmark()` JSDoc separately describe this pending projection and the aggregate completed observed/fixture projection.

### 35D. Verification

- Complete focused tests passed 379 tests across `bench.spec.ts` and `commands.spec.ts`.
- Focused coverage passed the same 379 tests and reported 100% statements, branches, functions, and lines for `curated-bench/src/invariant.ts` and `curated-scripts/src/index.ts`.
- Curated-bench and curated-scripts package typechecks passed.
- Scoped Oxlint over the two changed source files and two test files reported zero warnings and zero errors.
- The curated-scripts README pair check passed.
- Scoped unstaged, staged, and scoped combined-HEAD diff whitespace checks passed. No Git write operation was executed.

## 36. Final cross-code review fixes

Date: 2026-08-27

Verdict: **DONE_WITH_SPEC_REVIEW_PENDING**

### 36A. Assumptions

1. Existing staged and unrelated worktree changes are user-owned. This round changes only the reviewed curated command, audit, publication, test, documentation, specification, and report files and performs no Git write operation.
2. Source-tree `.mjs` wrappers remain repository development entries. The npm package exposes only the four built `lib/*.js` command bins.
3. Injected smoke runners remain trusted test controls and may use an explicit profile root outside `$DSH_HOME/profiles/<profile>`. Their reports remain `observed:true` because they still inspect the supplied installed profile, but production child execution requires the canonical Harness-home layout.

### 36B. Observed profile identity hypotheses

1. **Selected:** observed preflight and smoke validate `dsh.profile.bundles` but do not bind `manifest.name` to the requested profile. Smoke then derives a Harness home from the supplied path and launches the requested profile, so inspection and child execution can identify different profiles.
2. Template bundle equality implicitly identifies the requested profile. Rejected: profiles can share bundle lists, and `web-personal` remains accepted after changing only its manifest name.
3. Validating only the manifest name is sufficient for production smoke. Rejected: an arbitrary canonical directory can carry the right manifest name while the child still starts `$DSH_HOME/profiles/<profile>` at a different path.

### 36C. Candidate audit URL hypotheses

1. **Selected:** the repository regular expression treats query and fragment text as part of the second path segment, and the original string reaches Git arguments and JSON output. Credential-bearing query or fragment values can therefore be accepted and echoed.
2. Git rejects credential-bearing HTTPS repository URLs before output can expose them. Rejected: the current probe reaches `spawnSync`, and Git diagnostics may include the complete argv URL.
3. Redacting only caught errors is sufficient. Rejected: successful explicit audits serialize the original repository string, so validation must first produce one credential-free canonical URL used by both Git and JSON.

### 36D. Published source-wrapper hypotheses

1. **Selected:** the package `files` list and workspace publication allowlist explicitly include four source-tree `.mjs` wrappers that import `tsx/esm/api` and unpublished `src/index.ts`. The packed package does not declare `tsx`, so those entries cannot run after installation.
2. The package manager rewrites source-wrapper imports to the built entries during packing. Rejected: the packed files preserve the original imports and omit `src/index.ts`.
3. Publishing `tsx` and `src/index.ts` is the smallest correction. Rejected: the four built bins already provide the complete published command interface; adding source runtime dependencies and duplicate public entries widens the package without need.

### 36E. Home-patch derivation hypotheses

1. **Selected:** `endsWith('profiles')` classifies `myprofiles` and other suffix matches as the Harness profile container, so observed preflight can load an unrelated ancestor `cordis.patch.yml`.
2. `dirname(profileRoot)` always comes from `resolveProfileDir()` and therefore always has the exact basename `profiles`. Rejected: `--profile-root` is an arbitrary absolute external input and existing tests pass temporary roots directly.
3. Checking only the parent basename is sufficient. Rejected: the canonical profile directory name must also equal the requested profile or the derived home patch belongs to another profile identity.

### 36F. Worker-construction deadline hypotheses

1. **Selected:** the implementation starts one absolute execution budget at function entry and recomputes the remaining time after synchronous `new Worker(...)`, but JavaScript cannot interrupt that constructor while it is running. Existing prose that says the wall-clock budget bounds worker startup can therefore imply a guarantee the implementation cannot provide.
2. The post-construction remaining-time check provides strict constructor wall-clock enforcement. Rejected: it can fail immediately after construction returns, but it cannot make a synchronously blocked constructor return at the deadline.
3. Moving construction to another JavaScript Promise would provide preemption. Rejected: synchronous constructor work still blocks the same thread before the Promise can race. A caller that requires a hard operating-system deadline must supervise the CLI process externally.

### 36G. Deferred snapshot finding

The finding that active curated compositions lack a third-party real-runtime application snapshot is not implemented in this round. It conflicts with the explicit E3 state and scope: current owner documents state that installation, initialization, restart, unload, and user-path artifacts are pending and that planned, fixture, or configuration-smoke evidence cannot be upgraded to E3. Whether active candidates must be removed until such a snapshot exists, or whether the current pending/non-goal classification is permitted, requires final specification review.

### 36H. TDD and verification evidence

- **Profile identity and home derivation RED:** two manifest-name cases returned status 0 with `observed:true` and `accepted:true`; a profile under `myprofiles/custom-curated` loaded its unrelated ancestor patch and failed on the injected entry. **GREEN:** the focused run passed both manifest cases and the parent-directory case after observed manifests required the exact requested name and home derivation required canonical `profiles/<profile>`.
- **Audit URL RED:** `.git/` remained unnormalized; query and fragment secrets passed validation and reached the Git executable; the command entry ran until its timeout instead of rejecting the URL. **GREEN:** eight focused cases passed after URL parsing required credential-free HTTPS `github.com`, exactly two decoded path segments, no search or hash, and one normalized repository string for Git and JSON.
- **Published wrapper RED:** packed E2E found `verify-lock.mjs` in the installed tarball. **GREEN:** the rebuilt packed external consumer contains none of the four source wrappers, contains all four built bin entries, runs all four package-manager shims, rejects a misplaced production profile root before child execution, and passes.
- **Deadline prose:** public JSDoc, the curated-scripts README pair, the governance Agent Note pair, and Task 20 spec/checklist/tasks now state the executable behavior: the 55-second budget starts at function entry; remaining time is recomputed after synchronous worker construction and exhaustion fails immediately; JavaScript cannot preempt the constructor; worker inspection and child stages are terminable; a hard operating-system deadline requires an external CLI supervisor.
- Focused owning tests passed 361 tests: curated scripts 339, source audit 14, and workspace constraints 8.
- Curated-scripts focused coverage passed all 339 tests and reported 100% statements, branches, functions, and lines for `src/index.ts`.
- Root typecheck passed, including Host build and Client project references.
- Scoped Oxlint passed with zero warnings and errors over the six affected TypeScript source and test files. Repository lint reached Oxlint and failed on 806 pre-existing untracked generated declaration diagnostics under `packages/**/src/*.d.ts`; no in-scope source or test file appeared in the failures.
- Workspace constraints passed. `pnpm pack --dry-run --json` contains all four `lib/{verify-lock,preflight,smoke-profile,compare-benchmark}.js` entries and none of the four source `.mjs` wrappers.
- The packed external-consumer E2E passed after installing the tarball and running all four bins.
- `doc-sync` passed all 28 gates in 31.49 seconds. Named README and Agent Note translation pairing and Markdown wrapping also passed.
- Unstaged, staged, scoped combined-HEAD, and untracked audit-file whitespace checks passed. No Git write operation was executed.

## 37. Final candidate audit URL review fix

Date: 2026-08-27

### 37A. Assumptions and hypotheses

1. **Assumption:** every percent-encoded GitHub owner or repository path segment is non-canonical for this audit command. Rejecting `%` before decoding is intentionally stricter than accepting encoded unreserved characters and avoids reproducing GitHub's evolving owner and repository naming rules.
2. **Assumption:** Git stderr and process-launch errors are untrusted because Git may repeat its repository argument and credential-helper diagnostics may contain secrets. The command therefore retains the distinct timeout reason but maps every other Git launch or exit failure to `Git source audit failed`.
3. **Selected hypothesis:** WHATWG URL parsing leaves encoded `?` and `#` delimiters in `pathname`; the existing decoded-segment checks reject encoded slash and backslash but accept encoded query, fragment, and ordinary characters. The accepted path is then passed to Git and can be emitted by Git diagnostics.
4. URL parsing decodes every reserved delimiter before validation. Rejected by direct probes: `%3F`, `%23`, and `%61` remained encoded in `pathname`.
5. Redacting only command-entry errors is sufficient. Rejected because `auditRepositorySource()` is exported and `runGit()` exposed raw `spawnSync` errors and stderr to direct callers.

### 37B. TDD and implementation evidence

- **RED:** the focused audit suite failed six tests. Uppercase and lowercase `%3F`, `%23`, and `%61` path encodings reached Git instead of returning the canonical-URL error; the encoded command case reached its timeout; and a failing Git probe exposed both the canonical repository URL and the multiword secret from stderr. The same run also confirmed that the existing decoded-path checks already rejected uppercase and lowercase encoded slash and backslash.
- **GREEN:** path validation rejects every path segment containing `%` before decoding. Git timeouts retain `Git source audit timed out`; every other Git launch or nonzero-exit failure returns `Git source audit failed` without stderr, argv, the untrusted URL, or secret material.
- The complete focused audit suite passed 24 tests, including raw userinfo, query, and fragment rejection; uppercase and lowercase encoded delimiters; encoded slash and backslash; encoded unreserved characters; multiword secrets; Git launch errors; and Git stderr failures.
- Root `typecheck` and `lint` were run with 50-second process limits. Both stopped in `build:lib:host` on the same pre-existing `apps/cli/src/plugin.ts` errors: unused `CURATED_PLUGIN_COMMANDS` at line 31 and missing `CURATED_READ_ONLY_PLUGIN_COMMANDS` at line 144. Neither command reported an audit source or test error after the test tuple typing correction.
- Scoped Oxlint reported zero warnings and zero errors for `scripts/audit-curated-candidates.ts` and `scripts/audit-curated-candidates.spec.ts`.
- Unstaged, staged, scoped combined-HEAD, and untracked audit-file diff checks emitted no whitespace diagnostics.
- No Git write operation was executed.

## 38. Final specification blocker resolution

Date: 2026-08-27

Verdict: **DONE_WITH_CONCERNS**

### 38A. Root-cause hypotheses

1. **Selected:** six candidates entered runnable profiles after static and installation checks even though no real pinned artifact had a keyless assembled runnable snapshot. The repository testing policy requires that snapshot before model-visible third-party behavior can ship.
2. Observed `verify-lock`, `preflight`, and `smoke-profile` can substitute for the assembled snapshot. Rejected: smoke validates files and CLI configuration but does not import or initialize candidates or run their user path.
3. Only `dsh-web-search-pro` must be disabled because its required `@anweat/dsh-browser` bundle is absent. Rejected: that dependency is an additional defect, while all six candidates independently lack the required assembled snapshot.

### 38B. Fail-closed result

- The six static/install qualification candidates are inactive and each records `assembled-keyless-snapshot-missing`. Web search additionally records `required-runtime-dependency-missing` for `@anweat/dsh-browser`.
- Source-content, installed-tree, runtime dependency closure, npm, Git, score, and resource audit fields remain in the allowlist.
- `CURATED_BASELINE_BUNDLES` is empty. All five curated profiles contain only `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `@deepseek-ai/dsh-curated-base`; generated profile patches and dependency maps are empty.
- The generated candidate manifest reports zero active and 36 rejected candidates. The `web-curated` lock has no candidates, and its profile snapshot contains only installation-owned bundles.
- The 12-candidate target remains unchanged. Reactivation requires a real pinned artifact, a keyless assembled runnable snapshot, every required dependency bundle, and retained install, enable, restart, disable or uninstall evidence. E3/E4, A/B, fault, and canary evidence remains pending.
- The retained superpowers design and execution plan state the current target, qualification, and runtime counts and link the detailed evidence rules to `06`; they do not retain temporary installation-command history as current evidence.

### 38C. Deadline contract

The smoke command computes one absolute deadline at function entry. Synchronous `Worker` construction cannot be preempted; after construction returns, the command recomputes the remaining budget and fails immediately when it is exhausted. Worker execution and child stages are terminable. A hard operating-system deadline requires an outer supervisor for the CLI process.

### 38D. TDD and verification

- RED: focused policy, profile, and benchmark tests failed on `active:true`, six third-party baseline bundles, and `activeCount:6`.
- GREEN: the six-file focused suite passed 591 tests. Policy, profile, benchmark, scripts, CLI, real-composition, and negative paths all passed.
- Per-file coverage passed at 100% statements, branches, functions, and lines for curated policy, profiles, benchmark invariant/snapshot, and scripts/staging-worker sources.
- Four curated package typechecks, root typecheck, workspace constraints, scoped Oxlint, JSON parsing, six named bilingual pairs, Agent Note format, Markdown wrapping, and `doc-sync` 28/28 passed.
- The packed curated command E2E passed. Built CLI checks passed the curated profile byte contract and official `web`/`headless` dump paths. The official headless one-task assembled snapshot passed.
- Unstaged and staged diff whitespace checks passed. No vendor or archived Agent Note path was changed by this resolution, and no Git write operation was executed.

### 38E. Concern

Repository-wide `pnpm run lint` reached Oxlint and failed on 806 diagnostics in pre-existing untracked generated `packages/**/src/*.d.ts` files. No file changed by this resolution appeared in those diagnostics; scoped Oxlint over every changed TypeScript source and test passed with zero warnings and errors.

## 39. Final convergence review fixes

Date: 2026-08-27

Verdict: **DONE**

### 39A. Root-cause hypotheses

1. **Non-JSON Authorization diagnostics:** selected hypothesis: the keyed text fallback replaced only the first non-whitespace token, so Basic, custom-scheme, and plain multiword values leaked their suffix. Alternative: the JSON fragment scanner was truncating the value; rejected because these diagnostics fail JSON parsing and reach the plain-text fallback.
2. **Catalog repository URLs:** selected hypothesis: the broad repository regular expression treated query, fragment, encoded path, and `.git` suffix text as an otherwise valid second segment. Alternative: repository normalization removed those components before policy validation; rejected because `validateCandidateLock()` performed no URL parse or normalization.
3. **Smoke worker quiescence:** selected hypothesis: `void worker.terminate()` let normal, error, constructor-overrun, and timeout paths return while the worker remained alive. Alternative: removing listeners and calling `unref()` established quiescence; rejected by the repository teardown rule because those operations release observers but do not await worker exit.
4. **Planning history dates:** selected hypothesis: a syntactically matched invalid month produced an invalid `Date`, and `toISOString()` threw `RangeError`. Alternative: JavaScript date rollover alone explained the defect; retained as a second case because an invalid day can normalize without throwing and still must be rejected.
5. **Runtime activation:** selected hypothesis: `active`, rejection removal, and artifact digests were sufficient for policy acceptance because the schema had no runtime-evidence field. Alternative: prose and pending evidence records prevented activation; rejected because neither is consulted by `validateCandidateLock()`.

### 39B. TDD and implementation evidence

- **Authorization RED/GREEN:** Basic, custom-scheme, and plain multiword values leaked text after the first token. The fallback now detects secret-shaped plain assignment keys and redacts the rest of that physical line while preserving the key and preceding non-secret context; Bearer, Basic, custom-scheme, and plain cases pass.
- **Repository URL RED/GREEN:** query, fragment, encoded-path, and `.git` forms passed the old regular expression. Policy now parses URLs, requires credential-free HTTPS `github.com`, exactly two safe canonical segments, no port/search/hash/encoding, and no `.git` or trailing slash; diagnostics contain neither the rejected URL nor query credentials.
- **Worker RED/GREEN:** the fake worker proved `runSmokeProfile()` returned before delayed termination settled. Cleanup now clears the timer and listeners, unreferences the worker, and awaits `terminate()` on constructor-overrun, timeout, success, and error paths. The test requires termination to settle before return and observes no listeners, tracked timers, references, or unhandled rejection; the real blocked-worker timeout also passes.
- **Date RED/GREEN:** an invalid month raised `RangeError`; an invalid non-leap day normalized to another date. Validation now requires a finite parsed timestamp and exact canonical UTC round-trip, returning the stable `createdAt must be a YYYY-MM-DD date` issue for both.
- **Activation RED/GREEN:** changing the qualified web-search row to `active: true` and deleting rejections produced no policy issue, and no repository evidence gate existed. `runtimeActivationEvidence` now requires a keyless assembled snapshot, install, enable, restart, and disable-or-uninstall path/SHA pairs plus a required-runtime-bundle list matching the catalog declaration. Paths must be safe repository-relative POSIX paths and digests must be non-placeholder lowercase SHA-256 values. `verify-curated-activation-evidence` is a top-level `doc-sync` leaf that checks regular contained files and their actual byte digests. The checked catalog remains 37 candidates, zero active, with `@anweat/dsh-browser` explicitly declared for web search.

### 39C. Verification

- Focused policy, scripts, bench, profile, repository-gate, and gate-graph suites passed 659 tests.
- Focused package coverage passed 554 tests with 100% statements, branches, functions, and lines for `curated-policy/src/index.ts`, `curated-scripts/src/index.ts`, and `curated-bench/src/invariant.ts`.
- Root `pnpm run typecheck` passed.
- Root `pnpm run lint` passed over 2,658 files with zero warnings and zero errors.
- `pnpm run doc-sync` passed all 29 leaves, including type equivalence, all translation pairs, Agent Note format, catalog freshness, and the new activation-evidence gate.
- Workspace constraints, explicit Cordis/config catalog checks, the activation-evidence command, and the checked catalog assertion (`37` candidates, `0` active, `0` policy issues) passed.
- No browser run applies because the catalog has zero active UI candidates. No Git write operation was executed.

## 40. Final five-item review follow-up

Date: 2026-08-27

### 40A. Assumptions and hypotheses recorded before implementation

1. **Assumption:** a non-JSON diagnostic key may be qualified by dotted or bracket notation. The final decoded key segment determines whether the physical line contains a secret; matching only a key at line start is insufficient.
2. **Assumption:** once a secret-shaped assignment key is found, every character after its `:` or `=` separator on that physical line is secret. Redaction stops at the newline so unrelated context on later lines remains visible.
3. **Assumption:** the canonical catalog and audit URL is exactly `https://github.com/<owner>/<repository>` with the authored host casing, no `.git` suffix, and no trailing slash. Package-manager Git syntax may add `git+` and one exact lowercase `.git` suffix before normalization; `.GIT` and `.Git` are rejected rather than interpreted as repository names.
4. **Selected secret hypothesis:** `redactPlainSecretAssignments()` recognizes only one unqualified `[A-Za-z0-9_-]+` key, while the later regular expression replaces only one non-whitespace value token. Qualified `Authorization` keys therefore reach the token fallback and leak the remaining words.
5. **Selected URL hypothesis:** audit, policy, and curated-scripts each use a case-sensitive `.git` check. Mixed-case suffixes survive normalization and are accepted as ordinary repository names.
6. URL host normalization by `URL` is sufficient for canonical input. Rejected because `URL` lowercases the host; an explicit canonical string comparison is required to reject authored mixed-case host and trailing-slash forms consistently.

### 40B. TDD and implementation evidence

- **Secret RED:** four focused cases failed. `request.headers.Authorization` replaced only `Basic` and retained `second basic secret words`; double-quoted, single-quoted, and unquoted bracket forms retained the entire value.
- **Secret GREEN:** the physical-line scanner finds each `:` or `=`, parses the qualified assignment path to its final dotted or bracketed key, applies the existing case-insensitive secret-key predicate, and replaces the complete remaining physical line. Dotted, quoted bracket, unquoted bracket, and mixed-case `Authorization` cases retain the key and following non-secret line while removing every value word.
- **Canonical URL RED:** audit accepted lowercase, uppercase, and mixed-case `.git` suffixes, trailing slash, alternate host casing, an invalid leading-hyphen owner, and a repository name containing `~`; policy accepted `.GIT` and `.Git`. The invalid audit values reached Git and returned the generic Git failure instead of the canonical-URL rejection.
- **Canonical URL GREEN:** catalog and audit inputs must equal `https://github.com/<owner>/<repository>` exactly after parsing and must satisfy the same owner and repository name rules. Audit and policy reject every case variant of `.git`, trailing slash, encoded paths, alternate host casing, invalid owner, and invalid repository name. Curated-scripts applies the same canonical result after allowing only transport-owned `git+` and one exact lowercase `.git`; `.GIT` and `.Git` fail closed.
- **Coverage correction:** the first package coverage run passed 517 tests but reported 99.89% statements and 99.86% branches for curated-scripts. A mixed-case host case exercised the canonical string comparison, and an impossible `matchAll()` index fallback was removed in favor of the standard iterator contract. The rerun reached 100% statements, branches, functions, and lines for both changed package source files.

### 40C. Verification

- The complete focused audit, policy, and command suites passed 548 tests.
- Focused package coverage passed 517 tests with 100% statements, branches, functions, and lines for `curated-policy/src/index.ts` and `curated-scripts/src/index.ts`.
- Root `pnpm run typecheck` passed after the final source changes.
- Root `pnpm run lint` passed over 2,658 files with zero warnings and zero errors. Its first run identified the added long regular-expression line and unnecessary type assertion; both were fixed before the final run.
- `pnpm run doc-sync` passed all 29 gates, including translation pairing, Markdown, API documentation, generated catalogs, and activation evidence.
- The curated-scripts README pair records the strict canonical URL and exact lowercase transport suffix rules, and its pairing hashes match the edited files.
- No browser run applies because neither fix changes a browser surface. No Git write operation was executed.

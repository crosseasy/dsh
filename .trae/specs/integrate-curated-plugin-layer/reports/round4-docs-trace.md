# Task 17 Round 4 documentation trace

Date: 2026-08-26

## Scope and method

This audit read `.trae/specs/integrate-curated-plugin-layer/spec.md` and Task 17 in `tasks.md` first, then independently read every current Markdown document directly under `docs/plugin/superpowers/`: `README.md` and `00` through `06`. Files under `plans/` and `specs/` were excluded. `progress.md` was not read or used.

Classifications:

- **Verified**: current implementation/configuration plus focused test or command evidence supports the requirement.
- **Partial**: a mechanism exists, but the documented acceptance path or evidence is incomplete.
- **Gap**: repository-owned behavior or evidence required by the documents is absent.
- **Contradiction**: current prose disagrees with current implementation/configuration or another current document.
- **Long-cycle pending**: the documents explicitly require external duration, services, browser operation, or workload scale that the repository correctly does not claim to have run.

Severity:

- **P0**: invalidates current admission, startup, security, or evidence claims.
- **P1**: blocks a documented phase exit or leaves a material enforcement/test hole.
- **P2**: localized drift, incomplete follow-up, or low-impact documentation/configuration mismatch.

Fresh local evidence:

- `pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-profiles/tests/profiles.spec.ts packages/curated/curated-base/tests/bundle.spec.ts --reporter=dot`: 103 tests passed.
- `pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-bench/tests/bench.spec.ts --reporter=dot`: 173 tests passed.
- `pnpm exec vitest run apps/cli/tests/curated-profile.spec.ts --reporter=dot`: 4 tests passed.
- Focused TypeScript build for all five curated packages plus `apps/cli`: passed.
- `pnpm run constraints`: passed.
- `git diff --check -- packages/curated apps/cli tsconfig.base.json tsconfig.host.json docs/plugin/superpowers`: passed.
- Rootless `verify-lock --json`: exit 0 with `observed:false`, 37 candidates, no metadata issues.
- Default `compare-benchmark --json`: exit 1 with `evidenceKind:"planned"` and `status:"pending"` for search, memory, browser, MCP, and canary.

## Actionable repository-owned gaps

### P0-1: No standard path can produce the provenance file required by observed verification

The documents require observed lock, preflight, and smoke checks over caller-supplied installed artifacts (`README.md:15`; `00-背景与目标.md:85`; `04-评测体系.md:38-41`; `05-安全供应链与风险.md:20-21,26`). The resolver refuses every catalog candidate unless its installed package contains `.dsh-curated-artifact.json` (`packages/curated/curated-scripts/src/index.ts:533-554`). Repository search finds only that consumer and test fixture writers; profile materialization writes `package.json`, `cordis.patch.yml`, `pnpm-workspace.yaml`, and `.npmrc`, but no provenance record (`packages/curated/curated-profiles/src/index.ts:147-172`). Therefore a normal materialize/install flow cannot produce an observed result without an undocumented external producer.

Impact: the current active/admitted status cannot be reproduced through the shipped workflow, and the P0 observed preflight/smoke requirement is not executable end to end.

Action: add one repository-owned artifact acquisition/provenance command, or change observed verification to derive and verify immutable provenance from package-manager-owned data. Add a built-entry test that starts from a materialized profile rather than a hand-written provenance fixture.

### P0-2: `smoke-profile` does not import candidate modules or prove plugin initialization

The current-state prose says smoke imports candidate entry points (`03-实施路线图.md:19`; `04-评测体系.md:41`), and the implemented Agent Note repeats that claim (`.agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md:17`). The implementation only checks that `manifest.main` exists on disk (`packages/curated/curated-scripts/src/index.ts:1103-1129`), then invokes `dsh --dump-config` and `dsh --help` (`packages/curated/curated-scripts/src/index.ts:1038-1071,1195-1241`). There is no dynamic import in the smoke implementation. Tests cover missing main files, not syntax errors or import-time failures (`packages/curated/curated-scripts/tests/commands.spec.ts:3000-3045`).

Impact: a package with an existing but invalid or throwing entry module can pass the artifact stage, so `web-curated` startup is not established.

Action: import each resolved entry under the same deadline, or run a real profile boot mode that loads plugins and reaches a bounded ready point. Add syntax-error, rejected-import, and initialization-failure tests through that real path.

### P0-3: Observed preflight does not enforce catalog capability/resource claims

The documents require observed preflight to enforce the authoritative provider/fallback table and duplicate service/tool/command/UI/resource claims (`01-目标架构.md:119-123`; `05-安全供应链与风险.md:26-40`). The implementation builds active entries only from a nonstandard `config.curated` object inside composed patches (`packages/curated/curated-scripts/src/index.ts:2226-2301`). Profile materialization emits only each candidate's safety config, not `config.curated` metadata (`packages/curated/curated-profiles/src/index.ts:175-190`). Observed mode also explicitly disables rejection of unmanaged capabilities (`packages/curated/curated-scripts/src/index.ts:842-851,2358-2367`). The observed tests inject `config.curated` into synthetic bundle patches (`packages/curated/curated-scripts/tests/commands.spec.ts:1408-1458,1615-1663`), so they do not cover ordinary third-party patches.

Impact: an installed profile can be reported `accepted:true` while its real third-party patches contribute no capability or resource records to the conflict check.

Action: join installed bundle package names to the checked-in catalog and validate catalog claims against observed manifests/patches; keep observed unmanaged-provider rejection enabled. Add an observed test whose third-party patch contains no curated-only metadata and still detects a catalog-declared conflict.

### P0-4: Materialized profiles disable the build scripts required by active Git dependencies

Every curated profile receives `.npmrc` containing `ignore-scripts=true` (`packages/curated/curated-profiles/src/index.ts:88-95,147-172`), although the documents describe this as the enterprise-specific restriction (`01-目标架构.md:99-101`; `README.md:13`). Five active Git dependencies record required `prepare` scripts: web-search, MCP panel, LSP actions, permission rules, and smooth stream (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:101-159,213-260,302-400,401-439`). The documents require explicit `allowBuilds` for approved Git prepares (`02-插件矩阵与择优.md:126-130`), but the materialized workspace contains no allowlist. The generic plugin CLI only prints an `allowBuilds` hint after pnpm fails (`apps/cli/src/plugin.ts:145-158`).

Impact: a freshly materialized profile can install source pins without producing the built `main` files needed for startup, while the enterprise-only statement is false for the other four profiles.

Action: define the intended installation policy explicitly. Either use prebuilt immutable artifacts, or generate a reviewed `allowBuilds` list while keeping enterprise scripts disabled. Add a clean-home install and startup smoke.

### P0-5: `plugin-session-export` cannot pass the implemented observed lock checks

The catalog marks `plugin-session-export` active and assigns it to `web-research`, but records a repository-relative subpackage manifest path and root-level Node evidence (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:616-653`). The resolver returns the installed package directory (`packages/curated/curated-scripts/src/index.ts:533-554`), while artifact validation resolves `candidate.manifestPath` beneath that directory and compares the installed subpackage's own `engines.node` to the catalog value (`packages/curated/curated-scripts/src/index.ts:602-615,647-660`). For this row that means looking for `node_modules/@dsh-suite/plugin-session-export/packages/plugins/plugin-session-export/package.json`; if corrected to the installed `package.json`, its absent `engines.node` still differs from the catalog's inherited `>=22`.

Impact: the documented statement that this candidate passed admission and is safely materialized (`01-目标架构.md:95-98`; `02-插件矩阵与择优.md:99,120`; `03-实施路线图.md:193`) is incompatible with the observed verifier.

Action: separate repository audit paths from installed artifact paths and represent inherited Node evidence explicitly. Add an observed subpath-package fixture matching this candidate.

### P1-1: Patch completeness is documented but not implemented

The documents require comparison with the official dump to catch omitted fields in whole-config replacement patches (`01-目标架构.md:123-124`; `05-安全供应链与风险.md:32,40`). `validatePatchEntries` checks duplicate ids, secret/data settings, three baseline configs, and curated metadata (`packages/curated/curated-scripts/src/index.ts:2088-2118,2179-2223`); there is no official-dump input or omitted-field comparison. The P0 official dump artifact named by the roadmap is also absent; the checked-in `web` profile baseline only records bundle names (`packages/curated/curated-bench/baselines/profiles/web.json:1-11`).

Impact: a config override can silently erase upstream fields while preflight reports success.

Action: persist or generate the official composed baseline and compare every config-only override against its replaced entry. Add an omitted-field negative test.

### P1-2: The smoke fallback check rejects the wrong capability

The architecture permits one MCP fallback selected by configuration (`02-插件矩阵与择优.md:148-150,168-176`). Smoke unconditionally rejects the bundle name `dsh-mcp-manager` as a "second plugin manager" without checking whether `dsh-mcp-panel` is present (`packages/curated/curated-scripts/src/index.ts:1342-1376`). The corresponding test codifies this conflation (`packages/curated/curated-scripts/tests/commands.spec.ts:3281-3296`).

Impact: an explicit MCP fallback profile cannot pass smoke even though the conflict policy says a lone fallback is valid.

Action: remove this name-based special case and rely on the capability policy over the effective profile; separately model the actual plugin-marketplace manager conflict.

### P1-3: Supply-chain pre-install checks are declarations, not an installation gate

The documents require `dsh-plugin-check`, `upstream-radar`, and poison scanning before installation (`05-安全供应链与风险.md:7-13`). `dsh-plugin-check` is inactive (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:578-615`), `upstream-radar` is merely an active profile bundle (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:440-484`), and no curated installer invokes either tool or a poison scanner. The only install path delegates directly to pnpm (`apps/cli/src/plugin.ts:122-160`).

Impact: the documented pre-install control order is not enforced.

Action: either implement a bounded pre-install verification command and call it before package-manager execution, or rewrite the documents to identify these as pending operator procedures.

### P1-4: Minimal network/data policy is not enforced for active candidates

The documents require least privilege plus per-domain allowlists, upload limits, redaction, and retention (`05-安全供应链与风险.md:42-48`). The catalog stores descriptive `networkAccess` and `credentials` strings (`packages/curated/curated-policy/src/index.ts:163-224`), but profiles only write memento, permission, and OTel overrides (`packages/curated/curated-profiles/src/index.ts:175-190`). Preflight rejects a few literal booleans (`captureBody`, non-dry-run import, session writes, body egress) but has no domain, upload, path, or retention policy (`packages/curated/curated-scripts/src/index.ts:2544-2577`).

Impact: active search and telemetry plugins are admitted without repository-enforced network/data limits.

Action: add enforceable per-candidate profile controls where the plugin supports them; otherwise keep the candidate inactive and record the missing control as a rejection.

### P1-5: Benchmark safety cannot represent every zero-tolerance violation

The rollback policy rejects any path escape, credential leak, unauthorized egress, or unrecoverable corruption (`04-评测体系.md:109-119`). A benchmark run has only an averaged `securityCorrectness` score and `dataLossEvents`; it has no explicit counts for path escape, credential leak, or unauthorized egress (`packages/curated/curated-scripts/src/index.ts:436-455`). Rejection checks only mean security below 95%, data loss, rollback support, startup rate, and critical success decline (`packages/curated/curated-scripts/src/index.ts:1710-1742`).

Impact: one credential or egress violation can be hidden inside a security score of at least 95 and still be accepted.

Action: add explicit zero-tolerance event counters/flags and rejection tests for every documented security rollback line.

### P1-6: Current E3 admission claims have no current E3 evidence

`06-深度调研复评与证据分级.md:20-29` defines E3 as isolated install/enable/restart/uninstall and claims current admission/rejection reached E3. The checked-in benchmark is explicitly `planned` with empty runs (`packages/curated/curated-bench/baselines/benchmark.json:1-74`), the CDP record is planned (`packages/curated/curated-bench/baselines/web-cdp-regression.json:1-31`), and there are no checked-in provenance files or observed reports. Fresh rootless `verify-lock` reported `observed:false`. The package Agent Note correctly says reproducible files do not prove installability/runtime (`.agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md:35-37`), contradicting the E3 claim.

Impact: readers can treat metadata and fixture evidence as a completed runtime admission.

Action: downgrade current candidate conclusions to E1/E2 until immutable E3 reports exist, or check in reproducible E3 records covering install, enable, restart, unload, and exact artifacts.

### P1-7: Active third-party candidates lack the required per-plugin positive, negative, and unload evidence

The evidence guide requires each plugin to have a positive, negative, and unload case (`06-深度调研复评与证据分级.md:54-61`). The real-composition suite exercises a repository-owned behavior fixture and the curated services (`packages/curated/curated-profiles/tests/profiles.spec.ts:642-689`); fault tests route named candidate failures through the same fixture (`packages/curated/curated-scripts/tests/commands.spec.ts:3597-3650`). No test or snapshot loads the 11 active external candidates. Repository search found no curated snapshot scenario.

Impact: active status is not supported by the evidence level the current documents require.

Action: keep candidates inactive until each has real-entry positive, denial/failure, and unload coverage, or narrow the requirement and admission language.

### P2-1: Deep-research follow-up candidates are not registered

The review document says to register `dsh-budget`, `dsh-perm-guard`, `dsh-mask`, `credential-manager`, and `dsh-poison-guard` as candidates, and to resolve `dsh-im-hub`/`dsh-browser` by later A/B or threat modeling (`06-深度调研复评与证据分级.md:31-42`). None appears in the 37-row allowlist or benchmark task assets (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:9-1570`; `packages/curated/curated-bench/tasks/curated-tasksets.json:1-205`). The cost A/B still compares `dsh-cost-meter` with TokenLedger, not `dsh-budget` (`packages/curated/curated-bench/tasks/p2-risk-gates.json:48-52`).

Action: add E0/E1 inactive records and the required evaluation tasks, or mark these recommendations explicitly deferred rather than registered.

### P2-2: Package privacy requirement contradicts the manifests

The architecture document requires every new package manifest to contain `private:true` (`01-目标架构.md:50`), but all five curated manifests omit it and declare public publish configuration, for example `packages/curated/curated-base/package.json:1-7` and `packages/curated/curated-scripts/package.json:1-7`. The repository constraint command still passes.

Action: decide whether curated packages are publishable. Update the planning requirement if publication is intended; otherwise set `private:true` and remove public publication metadata.

### P2-3: Roadmap shell examples can report false success

Several P0 verification commands pipe command output to `tail` and then print `$?` without `pipefail` (`03-实施路线图.md:107-113,123-129,139-142,158-167`). They report the status of `tail`, not the verifier. This conflicts with the requirement that every leaf command independently determine pass/fail (`03-实施路线图.md:5`).

Action: remove the pipelines or use a repository wrapper that preserves the verifier's exit status.

### P2-4: Current documentation contains small factual drift

- `dsh-permission-rules` is described as 21 test files and `upstream-radar` as 57 tests/7 CI (`02-插件矩阵与择优.md:91-93`), while the current catalog records 20 and 58/8 respectively (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:344-363,440-460`).
- OTel's active plugin control is `captureContent:false` (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:703-706`), but the data-boundary checklist calls it `captureBody:false` (`05-安全供应链与风险.md:62-66`). Preflight checks both names for different paths (`packages/curated/curated-scripts/src/index.ts:2216-2221,2547-2552`).

Action: use the audited catalog as the single source for counts and name the actual plugin configuration field consistently.

## Current-state trace

| Requirement | Classification | Evidence |
| --- | --- | --- |
| Monorepo `packages/curated/` topology with five role-specific packages | Verified | `01-目标架构.md:40-62`; package manifests under `packages/curated/*/package.json`; source and invariant files exist. |
| Workspace path and Host aggregate discovery | Verified | `tsconfig.base.json:84,141,277`; `tsconfig.host.json:259-263`; focused typecheck and constraints passed. |
| Curated base is a static bundle loading policy and benchmark services | Verified | `packages/curated/curated-base/cordis.patch.yml:1-9`; `packages/curated/curated-base/tests/bundle.spec.ts:14-50`. |
| No curated change to agent-loop, session format, or shipped profile templates | Verified for curated scope | `SESSION_FORMAT_VERSION` remains `0` at `packages/core/session/src/types.ts:56`; official profile byte preservation is tested at `packages/curated/curated-profiles/tests/profiles.spec.ts:625-639`. The dirty worktree contains an unrelated import-path edit in `packages/core/session/src/request-header.ts`, but no curated dependency or format change. |
| Five deterministic profile templates | Verified | `packages/curated/curated-profiles/src/index.ts:33-86`; `packages/curated/curated-profiles/tests/profiles.spec.ts:93-133`. |
| Current composition: ten baseline candidates, research adds session export, personal has only three foundation bundles | Verified as declared composition | `packages/curated/curated-profiles/src/index.ts:39-85`; `packages/curated/curated-profiles/tests/profiles.spec.ts:93-193`. Runtime admission remains blocked by P0-1 through P0-5. |
| Non-overwriting materialization and preservation of official profiles | Verified | `packages/curated/curated-profiles/src/index.ts:147-172`; `packages/curated/curated-profiles/tests/profiles.spec.ts:575-639`; CLI bridge at `apps/cli/src/curated-profile.ts:13-28` and `apps/cli/src/profile-boot.ts:86-105`. |
| Safe memento, permission-rules, and LoongSuite profile overrides | Verified as configuration | Catalog values: `plugin-allowlist.yaml:204-212,392-400,703-706`; materializer: `curated-profiles/src/index.ts:175-190`; rejection checks: `curated-scripts/src/index.ts:2179-2223`; tests: `curated-profiles/tests/profiles.spec.ts:135-167`. |
| Read-only `ctx.curatedPolicy`, stable ordering, effect disposal | Verified | `packages/curated/curated-policy/src/index.ts:750-834`; `packages/curated/curated-policy/tests/catalog.spec.ts:1328-1351,1405-1413`. |
| Read-only `ctx.curatedBench`, effect disposal | Verified | `packages/curated/curated-bench/src/index.ts:61-108`; `packages/curated/curated-bench/tests/bench.spec.ts:98-112,172-180`. |
| 37 candidates with immutable ids/SHAs and required audit fields | Verified as metadata | Schema and validation: `packages/curated/curated-policy/src/index.ts:163-224,395-545`; catalog: `plugin-allowlist.yaml:1-1570`; rootless lock command returned `observed:false` and no metadata issues. This does not verify upstream artifacts. |
| 12-target/10-active `web-curated` decision and two machine-readable P0 rejections | Verified as policy/config | `plugin-allowlist.yaml:9-100,101-439,440-484,654-745`; template: `curated-profiles/src/index.ts:39-64`; test: `curated-profiles/tests/profiles.spec.ts:116-133`. |
| Static score is the sum of eight bounded dimensions; thresholds are 85/75/65 | Verified | `curated-policy/src/index.ts:26-44,309-319,382-387`; score/catalog tests at `curated-policy/tests/catalog.spec.ts:147-185`. |
| Hard rejections override score and keep failed candidates inactive | Verified for catalog consistency | `curated-policy/src/index.ts:483-527`; rejected rows are excluded by `curated-profiles/src/index.ts:215-232`; tests at `curated-policy/tests/catalog.spec.ts:484-501`. |
| Authoritative capability rules and profile duplicate policy | Partial | Policy validation exists at `curated-policy/src/index.ts:555-730` and tests at `curated-policy/tests/catalog.spec.ts:760-847,1196-1211`; observed profile enforcement has P0-3 and P1-2 gaps. |
| Secret rejection/redaction and scrubbed smoke environment | Verified for represented fields | `curated-scripts/src/index.ts:2097-2108,2468-2489,2591-2627,2697-2705`; tests at `curated-scripts/tests/commands.spec.ts:2197-2249,3762-3815`. |
| Observed checks require absolute roots; fixtures cannot claim acceptance | Verified | `curated-scripts/src/index.ts:805-869,945-1007`; tests at `curated-scripts/tests/commands.spec.ts:1363-1406,3583-3595`. |
| Smoke uses one 55-second wall-clock budget and emits staged JSON | Verified | `curated-scripts/src/index.ts:329-330,1162-1340,1419-1446`; tests at `curated-scripts/tests/commands.spec.ts:3166-3185,3331-3577`. Startup/module loading is still a P0-2 gap. |
| Benchmark requires matching environments/task-attempt sets and at least five repetitions | Verified | `curated-scripts/src/index.ts:1527-1597`; tests at `curated-scripts/tests/commands.spec.ts:3820-3967`. |
| Weighted score, mean/P50/P95, failure distribution, raw threshold decisions | Verified | `curated-scripts/src/index.ts:1643-1770,1820-1877`; threshold tests at `curated-scripts/tests/commands.spec.ts:3988-4131,4159-4279`. |
| Immutable embedded rollback snapshots with SHA-256 | Verified | `curated-scripts/src/index.ts:1483-1525`; digest failure test at `curated-scripts/tests/commands.spec.ts:4133-4157`. |
| Planned/fixture evidence cannot become accepted | Verified | `curated-scripts/src/index.ts:1649-1668,1773-1817`; tests at `curated-scripts/tests/commands.spec.ts:3839-3855,4522-4541`. |
| No new model-visible behavior means no transcript snapshot | Contradiction/gap | Curated governance services themselves are model-invisible, but the new profiles activate external tools and UI. No curated snapshot exists, and only a test fixture exercises tool behavior (`curated-profiles/tests/profiles.spec.ts:642-689`). This does not meet the real-composition snapshot policy in `docs/testing.md:31-49` for the activated profile behavior. |

## Candidate matrix trace

The matrix's current status is represented by the allowlist, but those statuses are metadata decisions rather than observed E3 evidence:

| Priority | Current records | Classification and evidence |
| --- | --- | --- |
| P0 | Active: toolkit, web-search-pro, memento, MCP panel, checkpoint rewind, LSP actions, permission rules, LoongSuite. Rejected: context, config manager. | Verified as catalog/profile composition at `plugin-allowlist.yaml:9-400,654-745` and `curated-profiles/src/index.ts:39-51`. Observed acceptance is a gap under P0-1 through P0-5. |
| P1 | Active: smooth stream, upstream radar, session export. Inactive/rejected: plugin hub, plugin guide, plugin check, better sidebar, free search, MCP manager, context doctor, cost meter, TokenLedger, chat import, message edit, auto review, notify. | Verified as catalog state at `plugin-allowlist.yaml:401-653,746-808,1173-1202,1233-1270,1301-1510`. Session export has the P0-5 verifier contradiction; P1 UI/A/B work remains pending. |
| P2 | Inactive: agent team GUI, background agents, computer use, vision router, LLM fallbacks, Univer Office, Feishu, mneme, Tabbit, desktop, Martty. | Verified as inactive catalog state at `plugin-allowlist.yaml:809-1172,1203-1232,1271-1300,1511-1570`. `dsh-background-agents` is retained without a hard rejection as an inactive fallback; the rest carry rejection/pending evidence as applicable. |

The package summary records 37 candidates, 11 active profile candidates, and 25 rejected candidates (`packages/curated/curated-bench/manifests/curated-candidates.json:1-22`). The eleventh active candidate is research-only session export; it is not part of the ten-candidate `web-curated` baseline.

## P0 trace

| P0 requirement | Classification | Evidence |
| --- | --- | --- |
| P0-1 version and official baseline dump | Partial | Root version/engine are current (`package.json:1-10`). Bundle-only `web` snapshots exist (`curated-bench/baselines/locks/web.json:1-10`; `profiles/web.json:1-11`), but no official `--dump-config` output or startup/token/RSS baseline exists as required by `03-实施路线图.md:29-48`. |
| P0-2 curated package skeleton and discovery | Verified except privacy contradiction | Five packages, path mappings, Host references, README/JSDoc/invariants exist; typecheck and constraints passed. See P2-2 for `private:true`. |
| P0-3 policy YAML and query service | Verified | YAML files at `curated-policy/policy/*.yaml`; loaders/service/effect at `curated-policy/src/index.ts:354-373,750-834`; HMR test at `catalog.spec.ts:1405-1413`. |
| P0-4 preflight conflict detection | Partial | Duplicate and safety checks exist (`curated-scripts/src/index.ts:2088-2407`) with extensive tests, but observed enforcement and patch completeness have P0-3/P1-1 gaps. |
| P0-5 exact lock verification | Partial | Pin, audit-field, artifact, Node, license, dependency, script, and core-path checks exist (`curated-scripts/src/index.ts:485-685,1967-2064`) with negative tests (`commands.spec.ts:560-697,1127-1360`). No normal provenance producer exists, subpath packages fail, and Node ranges use a limited custom parser (`curated-scripts/src/index.ts:770-796`) rather than the documented real semver/includePrerelease semantics (`00-背景与目标.md:22`). |
| P0-6 profile smoke | Partial | Staging, real CLI subprocesses, JSON diagnostics, and deadline exist (`curated-scripts/src/index.ts:945-1071,1162-1446`). Module import, RSS, prompt-token, and schema-token measurements required by `03-实施路线图.md:131-142` are absent. |
| P0-7 first-batch composition | Verified as static composition only | Eight admitted P0 candidates plus two admitted P1 candidates form the ten-bundle baseline (`curated-profiles/src/index.ts:39-58`). Actual third-party install/start evidence is absent. |
| P0 exit: startup, complete old-path regression, zero observed conflicts, observed locks | Gap | Unit/fixture composition verifies tool order, denial side effects, and HMR (`curated-profiles/tests/profiles.spec.ts:642-689`), but no current installed-candidate startup, browser handoff, real permission plugin, session export, or observed lock/preflight record proves `03-实施路线图.md:172-176`. |

## P1 trace

| P1 requirement | Classification | Evidence |
| --- | --- | --- |
| Smooth stream and upstream radar in baseline | Verified as composition | `curated-profiles/src/index.ts:40-51`; catalog records at `plugin-allowlist.yaml:401-484`. |
| Session-export subpackage only in research | Verified as template intent, observed verification broken | `curated-profiles/src/index.ts:53-55,71-75`; exact Git subpath dependency test at `curated-profiles/tests/profiles.spec.ts:351-374`; see P0-5. |
| Plugin hub and better sidebar remain inactive | Verified | `plugin-allowlist.yaml:485-539,746-808`; no current template includes either. |
| Plugin-manager mutual exclusion | Gap | The implemented name check targets MCP manager instead of a second marketplace manager; see P1-2. |
| Sidebar Chrome/CDP 9333 regression | Long-cycle pending | Planned-only record at `curated-bench/baselines/web-cdp-regression.json:1-31`; invariant enforces Chrome/9333 metadata at `curated-bench/src/invariant.ts:124-135`. Sidebar is inactive, so no browser run was required or performed in this audit. |
| Search A/B, at least 100 queries, four subsets | Long-cycle pending | Planned comparison at `curated-bench/baselines/ab-comparisons.json:1-28`; default benchmark leaves search pending at `curated-bench/baselines/benchmark.json:3-16`. |
| P1 exit: each admitted domain >=85, zero conflicts, sidebar regression, completed search A/B | Pending/gap | Active P1 rows score at least 85, but observed conflict evidence is absent; sidebar and search A/B are deliberately pending (`03-实施路线图.md:216-220`). |

## P2 trace

| P2 requirement | Classification | Evidence |
| --- | --- | --- |
| One multi-agent orchestrator plus concurrency/depth/token/timeout budgets | Long-cycle pending | Both orchestrators are inactive (`plugin-allowlist.yaml:809-896`); planned limits exist at `curated-bench/tasks/p2-risk-gates.json:5-16`. |
| Computer use, vision, LLM fallback, Office, and Feishu remain isolated/inactive until their controls pass | Verified as inactive policy; runtime work pending | Candidate rows at `plugin-allowlist.yaml:897-1172`; no current profile activates them. |
| Vision anonymous fallback off, Office resource/fidelity checks, Feishu threat model | Long-cycle pending | Planned controls at `curated-bench/tasks/p2-risk-gates.json:17-36`; no observed runs. |
| Fault injection for search timeout, model 429, browser crash, SQLite lock, permission denial, bad patch, offline network, init exception | Long-cycle pending | Planned list at `curated-bench/tasks/p2-risk-gates.json:38-46`. Repository fixture tests exercise analogous failures (`commands.spec.ts:3597-3650`) but correctly do not establish real-candidate execution. |
| Memory 7-day/200-fact A/B, browser 50-task A/B, MCP and cost A/B | Long-cycle pending | `curated-bench/baselines/ab-comparisons.json:29-102`; all remain `status:"pending"`. |
| Canary 3-7 days, at least 100 tasks, rollout 10/30/100 | Long-cycle pending | `curated-bench/tasks/p2-risk-gates.json:54-66`; invariant at `curated-bench/src/invariant.ts:104-121`; default comparator reports pending. |
| P2 exit | Long-cycle pending | No P2 candidate is active and no observed P2 campaign is checked in; this matches `03-实施路线图.md:266-271` and `05-安全供应链与风险.md:83`. |

## Final classification

- **Verified local mechanisms**: package topology/discovery, deterministic profile templates, non-overwrite behavior, static catalog validation, policy/benchmark service disposal, safe profile overrides, secret redaction/environment scrubbing, bounded staged smoke execution, benchmark comparability/statistics/threshold logic, and explicit pending-evidence handling.
- **Repository-owned gaps**: provenance production, real module/startup smoke, observed conflict derivation, install/build policy, session-export artifact semantics, patch completeness, correct fallback handling, supply-chain pre-install enforcement, network/data controls, zero-tolerance benchmark security fields, per-plugin real-entry evidence, and deep-research candidate registration.
- **Contradictions/drift**: E3 is claimed without E3 artifacts; every profile receives `ignore-scripts=true` despite enterprise-only prose; smoke claims imports it does not perform; package privacy, roadmap exit-code examples, OTel field naming, and two candidate counts disagree with current files.
- **Long-cycle pending by design**: Chrome/sidebar, search, memory, browser, MCP, real-candidate fault injection, Office/vision/IM evaluations, 100/200-task A/B runs, and 3-7 day canary/rollout. Their checked-in assets remain `planned` and the comparator does not accept them.

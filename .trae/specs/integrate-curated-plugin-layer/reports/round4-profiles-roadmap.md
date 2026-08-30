# Task 17 Round 4 Profile and Roadmap Audit

Date: 2026-08-26

Scope: `.trae/specs/integrate-curated-plugin-layer/spec.md`, Task 17 in `.trae/specs/integrate-curated-plugin-layer/tasks.md`, `docs/plugin/superpowers/01-目标架构.md`, `03-实施路线图.md`, `04-评测体系.md`, `05-安全供应链与风险.md`, and the owning curated/profile implementation and tests. This audit used the current worktree and did not reuse `progress.md` conclusions, as required by `.trae/specs/integrate-curated-plugin-layer/tasks.md:101-105`.

## Verdict

- The five templates exist and freshly materialize with deterministic bundle/dependency counts: `web-curated` 13/10, `web-coding` 13/10, `web-research` 14/11, `web-enterprise` 13/10, and `web-personal` 3/0. The definitions are at `packages/curated/curated-profiles/src/index.ts:19-86`, and materialization is at `packages/curated/curated-profiles/src/index.ts:140-172`.
- Fresh materialization uses separate curated profile directories and does not write the official `web` or `headless` templates. The official templates remain owned by `packages/boot/app-boot/src/profile.ts:113-117`; the byte-preservation regression is `packages/curated/curated-profiles/tests/profiles.spec.ts:625-639`.
- The checked-in catalog currently has no active capability-domain duplicates in any of the five profiles. Static validation is implemented at `packages/curated/curated-policy/src/index.ts:673-730`, loaded before policy publication at `packages/curated/curated-policy/src/index.ts:821-835`, and covered at `packages/curated/curated-policy/tests/catalog.spec.ts:350-356`.
- Fresh `web-enterprise` output disables npm lifecycle scripts and excludes every currently inactive vision, IM, browser, Office, and multi-agent candidate. This is not a complete enterprise enforcement guarantee for pre-existing profile files; Finding 3 describes the gap.
- Code prevents records that remain labeled `planned` or `fixture` from returning `accepted`, but it does not prevent a caller from relabeling authored fixture data as `observed`. Therefore the Task 19.3/19.5 provenance requirement is not fully enforced; Finding 1 describes the gap.
- All 60 unchecked roadmap checkboxes remain correctly unchecked as evidence status. Thirty are wholly or partly executable with local source/tests now, while the rest require installed third-party artifacts, external services or credentials, UI activation, prescribed task counts/durations, deployment infrastructure, or future implementation.

## Findings

### 1. High: benchmark provenance is self-asserted, so authored fixture data can be accepted as observed

`loadBenchmarkDataset()` trusts the input string `evidenceKind` after only checking that it is one of three enum values (`packages/curated/curated-scripts/src/index.ts:1453-1480`). The comparison changes non-`observed` input to `unverified`, but any input claiming `observed` receives the computed `accepted`/`rejected`/`rollback` result (`packages/curated/curated-scripts/src/index.ts:1643-1660`). Execution IDs, timestamps, environment fields, task IDs, attempts, and metrics are all caller-authored fields; validation checks consistency and five repetitions, not origin (`packages/curated/curated-scripts/src/index.ts:1527-1597`).

The test suite demonstrates the bypass: `benchmarkFixture()` creates synthetic JSON with `evidenceKind: "observed"` (`packages/curated/curated-scripts/tests/commands.spec.ts:284-328`), writes it to a temporary file, passes it through the public source-tree CLI, and expects `accepted` (`packages/curated/curated-scripts/tests/commands.spec.ts:4284-4296`). This conflicts with the requirement that planned/fixture results cannot be upgraded to observed or accepted (`.trae/specs/integrate-curated-plugin-layer/tasks.md:113-118`) and with the claimed provenance distinction (`docs/plugin/superpowers/04-评测体系.md:135-137`).

Action: define a trusted observed-record production path and bind comparison input to its raw outputs, for example by requiring runner-generated execution manifests plus digests of immutable per-run logs and a campaign specification owned outside the submitted result. Add a negative test that changes only a planned/fixture record's discriminator to `observed` and still receives a non-accepted result. If trusted provenance is intentionally out of scope, narrow Task 19 and the documentation to “reject correctly labeled planned/fixture records”; do not claim upgrade prevention.

### 2. High: observed preflight does not derive capability ownership from installed bundles

Observed preflight resolves each installed bundle and knows its catalog candidate (`packages/curated/curated-scripts/src/index.ts:891-927`), but it does not attach that candidate's capability or resource claims to the composed entries. Capability checks only see entries that voluntarily carry `config.curated` metadata (`packages/curated/curated-scripts/src/index.ts:2088-2118`, `packages/curated/curated-scripts/src/index.ts:2226-2301`). Real third-party bundle patches are not required to contain this repository-specific metadata. Observed mode also disables the unmanaged-capability check (`packages/curated/curated-scripts/src/index.ts:846-851`), although duplicate detection still operates for metadata-bearing entries (`packages/curated/curated-scripts/src/index.ts:2348-2407`).

Consequently, a real installed profile can omit `config.curated` in both provider bundles and receive no capability-domain comparison from observed preflight. The static catalog remains unique, and smoke rejects bundles outside the selected fixed template (`packages/curated/curated-scripts/src/index.ts:1132-1159`), but that does not satisfy the stated observed-preflight guarantee for an independently supplied profile root (`docs/plugin/superpowers/01-目标架构.md:117-125`; `docs/plugin/superpowers/05-安全供应链与风险.md:24-40`).

Action: while resolving installed bundle layers, retain package-to-candidate ownership and validate selected candidate IDs with `validateProfileConflicts(catalog, profile, conflicts)`. Derive candidate resources from verified artifact manifests/patches where possible and use catalog claims only as explicitly labeled static evidence. Add an observed-profile test with two installed governed providers whose patches contain no `config.curated`; it must fail with the capability domain and both package names.

### 3. High: re-materializing an existing enterprise profile can preserve prohibited contents

The only pre-write enterprise check is the existing `.npmrc` value (`packages/curated/curated-profiles/src/index.ts:147-153`). Existing `package.json`, `cordis.patch.yml`, and workspace files are then deliberately left untouched (`packages/curated/curated-profiles/src/index.ts:156-171`). The tests prove generic preservation and the `.npmrc` exception (`packages/curated/curated-profiles/tests/profiles.spec.ts:575-623`), but no test creates an existing enterprise manifest or patch containing anonymous vision fallback, IM body egress, browser download, or an unapproved bundle.

Fresh output is currently conservative because the enterprise template has no scenario additions (`packages/curated/curated-profiles/src/index.ts:77-82`) and risky candidates remain inactive, for example vision (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:949-998`), browser (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:897-948`), Office (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:1051-1111`), and Feishu (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:1112-1172`). Catalog validation relies on exact hand-authored `networkAccess` marker strings (`packages/curated/curated-policy/src/index.ts:620-652`); it does not make an unsafe existing enterprise profile safe.

Action: before returning an existing `web-enterprise`, parse and validate its manifest and patch against the enterprise policy, rejecting unsafe existing content without modifying it. Add tests for each forbidden category and for a valid existing enterprise profile remaining byte-identical.

### 4. Medium: several roadmap commands cannot prove their stated result

The rootless preflight and smoke examples expect success (`docs/plugin/superpowers/03-实施路线图.md:107-113`, `docs/plugin/superpowers/03-实施路线图.md:139-142`, `docs/plugin/superpowers/03-实施路线图.md:162-167`), but current code requires an absolute profile root for observed execution (`packages/curated/curated-scripts/src/index.ts:805-830`, `packages/curated/curated-scripts/src/index.ts:945-958`). Rootless `verify-lock` is valid only as metadata evidence and reports `observed: false` (`packages/curated/curated-scripts/src/index.ts:485-522`).

The examples also pipe through `tail`/`grep` and then print `$?` without enabling `pipefail`, so they report the last pipeline process rather than reliably preserving the gate's status (`docs/plugin/superpowers/03-实施路线图.md:69-74`, `docs/plugin/superpowers/03-实施路线图.md:108-113`, `docs/plugin/superpowers/03-实施路线图.md:124-129`, `docs/plugin/superpowers/03-实施路线图.md:159-167`).

Action: update executable examples to materialize/install a temporary profile, pass absolute `--profile-root`/`--artifact-root`, and capture the command status before formatting output. Keep fixture commands explicitly labeled non-observed.

### 5. Planned gap: automatic rollback is not implemented

The roadmap requires automatic restoration of the previous lock and patch after a rollback-line breach (`docs/plugin/superpowers/03-实施路线图.md:260-264`). The comparator only returns validated embedded snapshots and reasons (`packages/curated/curated-scripts/src/index.ts:1643-1668`); the evaluation document explicitly says it does not rewrite a local profile (`docs/plugin/superpowers/04-评测体系.md:109-119`). This is a correctly unchecked future item, not current completion evidence.

Action: either implement a separately approved rollback command with atomic writes and recovery tests, or change the roadmap requirement from automatic restoration to operator-consumed rollback output.

## Profile Audit

| Profile | Current composition | Result |
| --- | --- | --- |
| `web-curated` | Three foundation bundles plus ten active baseline candidates (`packages/curated/curated-profiles/src/index.ts:33-51`, `packages/curated/curated-profiles/src/index.ts:58-64`). | Fresh materialization passed. No multi-agent, browser, Office, full IM, or automatic-memory alternative is selected. |
| `web-coding` | Same baseline; coding scenario list is empty (`packages/curated/curated-profiles/src/index.ts:52`, `packages/curated/curated-profiles/src/index.ts:65-70`). | Correctly remains pending for orchestrator/browser/sidebar evidence. |
| `web-research` | Same baseline plus only `@dsh-suite/plugin-session-export` (`packages/curated/curated-profiles/src/index.ts:53-55`, `packages/curated/curated-profiles/src/index.ts:71-76`). | Fresh materialization passed; no mneme, vision, or Office bundle is active. |
| `web-enterprise` | Same baseline; enterprise scenario list is empty (`packages/curated/curated-profiles/src/index.ts:56`, `packages/curated/curated-profiles/src/index.ts:77-82`). | Fresh output has `ignore-scripts=true`; unsafe existing files remain a gap. |
| `web-personal` | Foundation bundles only (`packages/curated/curated-profiles/src/index.ts:83-85`). | Fresh materialization passed and the invariant enforces physical isolation (`packages/curated/curated-profiles/src/invariant.ts:21-35`). |

All five derive third-party dependencies only from active, rejection-free, profile-targeted, source-verified catalog rows with a full SHA (`packages/curated/curated-profiles/src/index.ts:201-234`). Current tests compare every materialized manifest to policy-selected candidates (`packages/curated/curated-profiles/tests/profiles.spec.ts:93-133`) and verify personal/provider isolation (`packages/curated/curated-profiles/tests/profiles.spec.ts:169-193`).

## Roadmap Classification

Legend:

- **Local**: can be freshly executed in this worktree without third-party services or credentials.
- **Artifact**: needs pinned third-party packages fetched/built into an installed profile; none of the eleven active profile packages resolves from the current installation.
- **External**: needs a live browser/UI, provider, credential, or remote service.
- **Scale**: requires the prescribed duration, task count, rollout, or deployment evidence and cannot be replaced by a fixture.
- **Procedure**: a review/change-management action rather than a standalone command.
- **Gap**: current implementation or the documented command cannot satisfy the item.

The following table covers all 57 unchecked boxes in `03-实施路线图.md`.

| Line | Item | Classification and current status |
| ---: | --- | --- |
| 38 | P0-1.1 versions | **Local, freshly run**: DSH `0.1.1-rc.2`, Node `v24.14.0`, pnpm `11.7.0`. |
| 41 | P0-1.2 official web dump | **Local, freshly run**: `pnpm dsh --profile web --dump-config` exited 0 with non-empty output. |
| 44 | P0-1.3 three startup baselines | **Scale + Gap**: `--help` is local and passed, but it cannot evidence empty/simple tasks or 30-minute stability. |
| 65 | P0-2.1 package skeleton | **Local** source audit; package already exists. |
| 66 | P0-2.2 workspace resolution | **Local** with current install; the documented `pnpm install` is unnecessary, mutating, and may require network. |
| 69 | P0-2.3 constraints | **Local, freshly run**: exited 0. |
| 72 | P0-2.4 base typecheck | **Local**; not part of this audit's three targeted package typechecks. |
| 89 | P0-3.1 conflict policy | **Local** source/schema audit. |
| 90 | P0-3.2 YAML parse | **Local**; exercised by policy tests. |
| 93 | P0-3.3 policy typecheck | **Local, freshly run**: exited 0. |
| 107 | P0-4.1 preflight implementation | **Local** source and focused tests; observed capability derivation has Finding 2. |
| 108 | P0-4.2 empty baseline | **Local fixture + Gap**: rootless command is stale and cannot be observed. |
| 111 | P0-4.3 duplicate-tool rejection | **Local fixture** and covered by focused tests; it is not observed third-party evidence. |
| 123 | P0-5.1 lock implementation | **Local** source and focused tests. |
| 124 | P0-5.2 pinned catalog | **Local metadata, freshly run**: exit 0, 37 candidates, `observed:false`; artifact verification is **Artifact**. |
| 127 | P0-5.3 `latest` rejection | **Local fixture** and covered by focused tests. |
| 139 | P0-6.1 smoke implementation | **Local** source and focused tests. |
| 140 | P0-6.2 official web smoke | **Local + Gap**: direct official dump/help works, but the documented rootless smoke command now fails by design. |
| 158 | P0-7.1 pin and compose each plugin | **Local metadata** for checked-in pins; installation/execution is **Artifact**. |
| 159 | P0-7.2 static admission | **Local metadata**; observed artifact admission is **Artifact**. |
| 162 | P0-7.3 conflict detection | **Local fixture/static catalog**; observed profile enforcement has Finding 2 and needs **Artifact** inputs. |
| 165 | P0-7.4 profile smoke | **Artifact**: all active third-party packages are absent locally. |
| 168 | P0-7.5 rollback on failure | **Procedure**; automatic rollback remains Finding 5. |
| 174 | P0 exit: curated starts | **Artifact**; no observed installed curated profile is available. |
| 175 | P0 exit: old-path matrix | **Local** for headless and repository fixtures; **Artifact/External** for real curated Web, permissions, and export behavior. |
| 176 | P0 exit: preflight/lock | **Local metadata**; observed all-artifact completion is **Artifact**. |
| 197 | P1-1 plugin-manager exclusivity | **Local fixture/static policy**; real plugin activation is **Artifact**. |
| 198 | P1-1 session-export subpackage | **Local metadata**; real package resolution/smoke is **Artifact**. |
| 204 | P1-2.1 enable sidebar | **Artifact + External**; candidate is inactive at `packages/curated/curated-policy/policy/plugin-allowlist.yaml:746-808`. |
| 205 | P1-2.2 CDP/no errors | **External** Chrome/CDP UI evidence after sidebar activation. |
| 206 | P1-2.3 existing Web paths | **External** UI regression after sidebar activation. |
| 212 | P1-3.1 search A/B | **External + Scale**: at least 100 queries against two providers. |
| 213 | P1-3.2 statistics | **Scale**: only after real search runs. |
| 214 | P1-3.3 thresholds | **Scale**: comparator logic is local, outcome evidence is not. |
| 218 | P1 exit: second-batch admission | **Local** for current static rows; **Artifact/External** for the inactive second-batch candidates. |
| 219 | P1 exit: sidebar regression | **External** UI evidence. |
| 220 | P1 exit: search winner | **External + Scale**. |
| 238 | P2-1.1 one orchestrator | **Local fixture/static policy**; real activation is **Artifact**. |
| 239 | P2-1.2 agent budgets | **Gap + Artifact/External**: values exist only in planned data at `packages/curated/curated-bench/tasks/p2-risk-gates.json:5-15`; runtime enforcement is not shown. |
| 240 | P2-1.3 vision fallback | **Local static exclusion**; real enterprise behavior is **Artifact/External**. |
| 241 | P2-1.4 Office measurements | **Artifact + External + Scale**; candidate declares optional license and browser dependencies at `packages/curated/curated-policy/policy/plugin-allowlist.yaml:1051-1111`. |
| 242 | P2-1.5 Feishu threat model | **External + Procedure**: requires credentials, service review, and deployment-owner decisions. |
| 243 | P2-1 all three checks | **Artifact** for each candidate. |
| 249 | P2-2 search/model/browser/SQLite faults | **Local fixture** for synthetic paths; real search, model 429, and browser faults are **External**, and real memory needs **Artifact**. |
| 250 | P2-2 file/patch/network/init faults | Permission/patch fixtures are **Local**; real network and candidate initialization are **Artifact/External**. |
| 251 | P2-2 fault acceptance | **Local fixture** only; all real fault paths remain pending. |
| 255 | P2-3 memory A/B | **External + Scale**: 7 days, 200 facts, 20 conflict updates, 20 deletions. |
| 256 | P2-3 browser A/B | **External + Scale**: two browser systems and 50 Web tasks. |
| 257 | P2-3 MCP A/B | **External** services/credentials and **Artifact** candidates. |
| 258 | P2-3 cost A/B | **Artifact + External data**: both candidates are currently unreachable (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:1331-1390`). |
| 262 | P2-4.1 canary | **Scale**: 3-7 days and at least 100 real tasks. |
| 263 | P2-4.2 rollout | **External + Scale**: deployment population and 10/30/100% rollout. |
| 264 | P2-4.3 automatic rollback | **Gap + External**: comparator reports snapshots but does not restore them. |
| 268 | P2 exit: scenario profiles/budgets | **Artifact/External + Gap** until candidates activate and budget enforcement exists. |
| 269 | P2 exit: all faults | **External + Artifact**; fixtures cannot satisfy it. |
| 270 | P2 exit: all A/B | **External + Scale**. |
| 271 | P2 exit: canary/rollout | **External + Scale**. |

The following covers all three unchecked boxes in `04-评测体系.md`.

| Line | Item | Classification and current status |
| ---: | --- | --- |
| 63 | Chrome CDP connectivity | **External** and currently inapplicable because no UI candidate is active; run only with Chrome on port 9333 after activation. |
| 64 | Console has no errors | **External** browser-console evidence; no fixture substitute. |
| 65 | Existing panels/URL/handoff unchanged | **External** UI regression evidence; no fixture substitute. |

## Fresh Evidence

All commands were run on 2026-08-26 with a 54-second process alarm.

| Command | Result |
| --- | --- |
| `pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts` | 20/20 passed in 0.785 s. |
| `pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts` | 79/79 passed in 0.569 s. |
| `pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'preflight command\|smoke-profile command\|compare-benchmark command'` | 108 passed, 49 filtered/skipped, in 2.95 s. |
| Five-profile temporary materialization probe | Produced bundle/dependency counts `13/10`, `13/10`, `14/11`, `13/10`, `3/0`; every generated `.npmrc` was `ignore-scripts=true`. |
| `pnpm run constraints` | Exit 0. |
| Curated profiles, policy, and scripts package typechecks | All exited 0. |
| `node packages/curated/curated-scripts/verify-lock.mjs --json` | Exit 0; 37 candidates; `observed:false`; no issues. |
| `node packages/curated/curated-scripts/compare-benchmark.mjs --json` | Exit 1 as required; `planned`, `pending`, five pending campaigns. |
| `pnpm dsh --profile headless --help` | Exit 0. |
| `pnpm dsh --profile web --dump-config` | Exit 0 with non-empty composed configuration. |
| Active third-party package resolution probe | All ten baseline packages plus `@dsh-suite/plugin-session-export` were missing, so observed five-profile preflight/smoke was not run. |
| Static current-catalog policy probe | `validateCandidateLock` returned no issues; `validateProfileConflicts` returned no issues for all five profiles. |

No production files were edited, and no commit, push, merge, rebase, or reset operation was run. This report is the only audit artifact created.

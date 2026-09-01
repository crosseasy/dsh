# Task 18 Review and TDD Report

Date: 2026-08-26
Status: DONE

## Method

Task 18 treats the approved specification as authoritative and the five Round 4 reports as claims to verify. Each accepted defect class records competing root-cause hypotheses before its failing test is added. Production changes follow only after the focused test fails for the expected reason.

## Wave 3C Review Hypotheses

### Managed profile provenance

- Hypothesis A: resolver roots are all treated as optional search locations, so missing managed-profile state falls through to package-authored sidecars or later roots.
- Hypothesis B: package-manager resolution is attempted only after the installed package is found, so a missing managed package is indistinguishable from an ordinary standalone artifact root.
- Selected evidence: `createInstalledArtifactResolver()` loops over roots, continues when `findCandidatePackageDir()` fails, lets `resolvePnpmInstalledArtifact()` return `undefined` for a missing manifest dependency, and then reads `.dsh-curated-artifact.json`. Preflight and smoke pass `[profileRoot, ...artifactRoots]`, allowing both fallback forms.
- Planned proof: every missing managed dependency, root/installed lock resolution, installed package, and required evidence rejects without consulting a package sidecar or later artifact root; a standalone sidecar root without `dsh.profile` remains accepted.

### Shared installed-artifact validation

- Hypothesis A: preflight and smoke resolve provenance but discard every field except `packageDir`, then apply command-specific partial checks.
- Hypothesis B: `validateResolvedArtifact()` already owns the complete package version, license, dependency union, lifecycle script, Node, manifest/patch/main, and repository/commit/path checks, but only verify-lock calls it.
- Selected evidence: `loadInstalledProfileEntries()` calls `resolver.resolve(candidate)?.packageDir`; `inspectInstalledSmokeProfile()` calls `validateCandidateArtifact()`, which checks only package name, patch, and main. Both bypass `validateResolvedArtifact()`.
- Planned proof: one drift table mutates each installed metadata class and requires verify-lock, observed preflight, and observed smoke to reject before smoke child stages run.

### Real materialized pnpm proof

- Hypothesis A: the existing integration test hand-writes `package.json`, workspace, and `.npmrc`, so it does not prove `materializeCuratedProfile()` output.
- Hypothesis B: its Git package lives at repository root, so pnpm's direct-Git `&path:` resolution and hoisted lock/importer representation remain untested.
- Selected evidence: the test creates `plugin.git/package.json` and manually writes all profile files with a root Git dependency.
- Planned proof: copy a repository-owned Git fixture with a package subdirectory into a temporary repository, commit it locally, materialize a temporary curated home, install with pnpm using the generated files, assert the direct-Git `&path:` lock/importer records and hoisted package, then run observed verify-lock, preflight, and smoke against that layout without importing or executing the fixture package.

## Defect Classes

### 1. Multiline PEM redaction

- Hypothesis A: the replacement expression matches only the `BEGIN` line and leaves the payload and footer intact.
- Hypothesis B: structured JSON redaction reintroduces the PEM payload after text redaction.
- Selected evidence: `SECRET_VALUE_REPLACEMENT_PATTERN` ends at `PRIVATE KEY-----` and has no multiline body/footer branch; `redactSecretText()` applies that expression last. A plain-text staging diagnostic therefore exposes the remaining block.
- Planned proof: a staging failure containing a complete multiline PEM must omit the header, payload, and footer.

### 2. Observed profile input validation

- Hypothesis A: secret scanning starts only after patch composition and never scans the profile manifest, profile patch source, `.npmrc`, or workspace metadata.
- Hypothesis B: manifest validation accepts an empty bundle list because it checks element types but not cardinality or the selected curated template.
- Selected evidence: `loadInstalledProfileEntries()` reads `package.json`, accepts `[]`, scans only composed entry configs, and never reads `.npmrc` or `pnpm-workspace.yaml`; it also does not compare curated bundle order with `CURATED_PROFILE_TEMPLATES`.
- Planned proof: plaintext secrets in each profile-owned input, an empty list, and a curated template mismatch must all reject observed preflight without echoing values.

### 3. Policy schema versions and safe defaults

- Hypothesis A: the parsers preserve policy `schemaVersion` but semantic validation checks only the candidate catalog version.
- Hypothesis B: permission defaults are validated only by key and scalar type, so known keys can carry unsafe values.
- Selected evidence: `validatePolicySemantics()` has no conflict/permission version checks and no value checks for `configImportMode`, `otelCaptureBody`, or `credentialStorage`.
- Planned proof: unsupported conflict and permission schema versions and each unsafe known default must prevent policy publication.

### 4. Authoritative observed capability ownership

- Hypothesis A: observed preflight derives providers only from optional `config.curated` fields authored by the installed plugin.
- Hypothesis B: observed mode deliberately disables unmanaged-capability enforcement because the catalog-to-bundle join is discarded during composition.
- Selected evidence: `loadInstalledProfileEntries()` knows each catalog candidate but returns only composed entries; `runPreflight()` passes `enforceGovernedCapabilities: false` for observed input.
- Planned proof: observed bundles without `config.curated` still receive catalog capability/resource claims; catalog-declared duplicate providers reject, explicit inactive fallbacks do not, and legal Cordis overrides remain accepted.

### 5. Published smoke execution

- Hypothesis A: the installed runner points at repository-only `apps/cli/src/bin.ts` and requires undeclared `tsx/esm`.
- Hypothesis B: direct candidate import is required in addition to real profile `--dump-config` and `--help`.
- Selected evidence: `DSH_SOURCE_BIN` is outside the packed package and `tsx` is absent from runtime dependencies. Independent adjudication confirms that the approved spec requires manifest/bundle parsing plus real dump/help, not direct candidate initialization.
- Planned proof: a packed-install test proves the published smoke entry invokes a shipped, package-valid `@deepseek-ai/dsh` built bin with no repository-source dependency. Prose that claims direct import is corrected.

### 6. Installed provenance

- Hypothesis A: `.dsh-curated-artifact.json` is a test-only sidecar with no normal producer.
- Hypothesis B: even with a producer, placing caller-authored provenance inside the evaluated package lets the package assert its own commit and archive digest.
- Selected evidence: repository search finds the sidecar consumer and test writers only. Materialization cannot write inside packages that are not installed yet, and copying catalog values would not create independent evidence.
- Adjudication: rejected as an observed-attestation false positive. The input is trusted local operator state, and the approved specification requires caller-supplied exact installed artifacts rather than cryptographic or independently signed provenance.
- Disposition: keep fail-closed sidecar/metadata checks without adding a new attestation format or producer.

### 7. Install-script policy

- Hypothesis A: unconditional `ignore-scripts=true` prevents active Git packages with required `prepare` hooks from producing their declared `main`.
- Hypothesis B: removing script blocking globally would make enterprise profiles execute third-party lifecycle code.
- Selected evidence: all profiles receive the same `.npmrc`, while five active candidates declare `prepare`; the current workspace emits no `allowBuilds`. Enterprise safety explicitly requires scripts disabled.
- Selected design: enterprise keeps `ignore-scripts=true` and must reject active packages that require prepare; non-enterprise profiles permit lifecycle execution only through a generated exact `allowBuilds` list for audited active dependencies.
- Planned proof: non-enterprise materialization emits exact allowlist entries; enterprise composition rejects required-prepare active bundles instead of silently materializing a broken profile.

### 8. `plugin-session-export` subpath evidence

- Hypothesis A: catalog `manifestPath` is repository-relative even though resolver `packageDir` is already the installed subpackage root.
- Hypothesis B: Node evidence is inherited from the repository root and cannot be observed from the installed subpackage manifest.
- Selected evidence: the row records `packages/plugins/plugin-session-export/package.json`, while installed resolution returns `node_modules/@dsh-suite/plugin-session-export`; the package manifest has no `engines.node`.
- Selected design: record installed `manifestPath: package.json` and represent inherited Node evidence as repository-audit evidence that does not masquerade as an installed manifest field.
- Planned proof: an installed subpath package uses its exact package manifest and does not substitute the repository root.

### 9. Patch completeness claim

- Hypothesis A: the approved specification requires an official dump comparison that is missing.
- Hypothesis B: only planning prose claims this check, while the approved specification requires patch parsing/smoke but no persisted official dump or field-completeness algorithm.
- Selected evidence: the approved spec has no dump-completeness requirement. `docs/plugin/superpowers/01-目标架构.md`, `03-实施路线图.md`, and `05-安全供应链与风险.md` make the stronger claim.
- Disposition: reject implementation as outside the approved Task 18 behavior specification. Correct the planning prose to state that whole-config overrides remain operator-reviewed and are not automatically completeness-checked.

### 10. Inactive MCP fallback

- Hypothesis A: smoke confuses `dsh-mcp-manager` with a second plugin marketplace manager and rejects it by name.
- Hypothesis B: capability policy already permits it as an inactive fallback and would reject only simultaneous active providers.
- Selected evidence: `validateProfileBundles()` unconditionally rejects the bundle name, while `capability-conflicts.yaml` lists it as the MCP fallback and the approved spec explicitly accepts inactive fallbacks.
- Planned proof: a lone explicit MCP fallback passes bundle validation; simultaneous active MCP providers still fail through policy checks.

### 11. Zero-tolerance benchmark incidents

- Hypothesis A: averaged `securityCorrectness` can hide a path escape, credential leak, or unauthorized egress event.
- Hypothesis B: `dataLossEvents` represents only data loss and cannot safely stand in for the other incident classes.
- Selected evidence: `BenchmarkRun` has only `dataLossEvents`; non-compensable checks have no explicit path-escape, credential-leak, or unauthorized-egress counters.
- Planned proof: each incident field independently forces rejection at one event and accepts zero.

### 12. Supply-chain catalog reconciliation and score evidence

- Hypothesis A: archive hashes are stale relative to current immutable GitHub commit archives.
- Hypothesis B: dependency and entry-ID metadata was recorded as a selective summary while observed validation requires the full manifest union and exact patch IDs.
- Selected evidence: the Round 4 supply-chain audit repeated archive downloads and listed eight digest mismatches, ten dependency mismatches, and six entry-ID mismatches. Current validator compares complete dependency sets and exact catalog claims.
- Planned proof: refreshed pinned artifact facts pass catalog tests and observed fixtures without weakening validation.
- Adjudication: per-dimension score evidence references are a false positive and will not be added.

### 13. Current-state prose

- Hypothesis A: docs and Agent Note describe intended behavior as shipped behavior.
- Hypothesis B: rootless examples and E3 claims predate fail-closed observed input requirements.
- Selected evidence: prose claims candidate import, current E3 admission, automatic rollback, and rootless observed commands despite current implementation and checked-in evidence showing otherwise.
- Planned proof: owner READMEs, bilingual Agent Note, and only factually incorrect superpowers passages describe the implemented path; long-cycle campaigns remain explicitly pending.

### 14. Existing enterprise profile validation

- Hypothesis A: materialization checks only an existing `.npmrc`, so prohibited bundles or settings in preserved manifest/patch files survive.
- Hypothesis B: rewriting existing files would enforce safety but violate byte-preservation.
- Selected evidence: `materializeCuratedProfile()` returns preserved manifest and patch files without parsing them. Independent adjudication requires rejection, not mutation.
- Planned proof: unsafe existing enterprise manifests and patches reject before any file changes; a safe existing profile remains byte-identical.

### 15. Active-candidate least-privilege defaults

- Hypothesis A: catalog `networkAccess` and credentials are descriptive only, with no profile-owned setting where candidates expose controls.
- Hypothesis B: a generic network-policy runtime would exceed the approved profile/preflight scope.
- Selected evidence: active candidates currently receive only three profile overrides, while the approved security requirement calls for least-privilege defaults. Adjudication requires enforcing available profile/preflight controls without inventing a runtime service.
- Planned proof: active profile overrides carry explicit data-egress defaults supported by their plugins, and preflight rejects weaker values; unsupported controls keep the candidate inactive or remain explicit operator requirements.

### 16. Curated package privacy

- Hypothesis A: curated package manifests inherited publishable defaults and omitted the repository-required `private:true`.
- Hypothesis B: public `publishConfig` was intentional despite the root package convention.
- Selected evidence: all five curated package manifests omit `private:true`; independent adjudication confirms the repository requirement applies.
- Planned proof: a focused manifest test requires `private:true` on every curated package.

### 17. Snapshot applicability

- Hypothesis A: Task 18 changes are offline governance/profile-file behavior and add no model-visible output.
- Hypothesis B: activating third-party bundles in curated profiles is model-visible and therefore requires assembled snapshots before those candidates can be claimed as runtime-admitted.
- Selected evidence: curated policy, benchmark, materializer, and command packages register no model-visible content; installed third-party behavior is not available in this checkout, and the long-cycle/runtime evidence remains pending.
- Disposition: no new Task 18 transcript snapshot is applicable. The absence of real third-party assembled snapshots remains explicit pending evidence and cannot be replaced by the repository-owned behavior fixture.

## Rejected Findings

- **Automatic profile restoration**: rejected. The approved specification requires rollback decisions to point to the previous snapshots, not an atomic restoration command. Task 18 explicitly forbids speculative automatic restoration.
- **Cryptographic operator attestation**: rejected. No signer, trust root, key lifecycle, or wire format is approved. Exact package-manager lock evidence plus installed-file validation is the scoped provenance mechanism.
- **Observed artifact attestation redesign**: rejected after independent adjudication. The approved trust model accepts caller-supplied local installed evidence and does not require a new independently signed producer.
- **Direct candidate import in smoke**: rejected after independent adjudication. The approved smoke contract is manifest/bundle parsing plus the shipped CLI's real dump/help paths.
- **Per-dimension score evidence references**: rejected after independent adjudication. Arithmetic score validation remains required; a new evidence-reference schema is not.
- **New deep-research candidates**: rejected. Candidate admission requires a scoped decision and supporting audit; Task 18 explicitly forbids adding them.
- **Pre-install scanner orchestration and general network/data enforcement**: rejected for this task. The approved specification requires static admission, profile safety defaults, secret rejection, and enterprise restrictions, but does not define a new package installer or generic runtime network-policy service.
- **Existing enterprise profile mutation**: rejected. Materialization is explicitly non-overwriting. Observed preflight validates existing inputs; silently rewriting them would violate the approved preservation requirement.
- **Benchmark `evidenceKind` attestation**: narrowed to correctly labeled evidence. Preventing a malicious local author from relabeling JSON requires cryptographic or runner-owned attestation, explicitly excluded by Task 18. Planned and fixture records continue to be non-accepted.

## RED/GREEN Evidence

### Recovery baseline

Command:

```sh
pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts --testTimeout=10000
```

RED result: 3 failures and 239 passes. `returns frozen stable candidate query results` returned `specific, shared` instead of the documented `shared, specific` order. Two observed-preflight fixtures also emitted `preflight-profile-template-mismatch` because their partial synthetic manifests used the reserved `dsh-profile-web-curated` name.

Root-cause alternatives:

- The new template check was over-broad, or the partial fixtures incorrectly identified themselves as repository-owned profiles. The check applies only to the exact repository-owned name and its dedicated mismatch case passes, so the fixtures were corrected.
- The query expectation was stale, or removal of the existing specificity sort broke the documented stable result order. The public JSDoc and established test both require shared candidates before scenario-specific candidates, so the sort was restored.

GREEN result after those recovery edits: 242 tests passed.

### Controlled defect proofs

Each command below ran with only the named implementation guard temporarily disabled through `apply_patch`; the guard was restored immediately after the expected failure.

- Multiline PEM: `pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'redacts complete multiline PEM blocks from staging diagnostics' --testTimeout=10000` failed 1/1 because `SUPERSECRETPAYLOAD123` and the PEM footer remained in output.
- Profile-owned patch scan: `pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'rejects secrets in every profile-owned input and empty or mismatched curated compositions' --testTimeout=10000` failed 1/1 because the profile-patch case returned status 0 instead of 1. The test now covers manifest, profile patch, `.npmrc`, workspace metadata, empty composition, template mismatch, and value non-disclosure.
- Policy versions/defaults: `pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts -t 'rejects unsupported policy schemas and unsafe known permission defaults' --testTimeout=10000` failed 1/1 because schema version 2 returned no issue.
- Authoritative observed ownership: `pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'derives observed providers from catalog-owned bundle assignments without curated patch metadata' --testTimeout=10000` failed 1/1 because two catalog-owned active providers were accepted with status 0.

The Round 4 source evidence supplies the RED state for the unconditional MCP rejection: `validateProfileBundles()` rejected `dsh-mcp-manager` solely by package name. The focused GREEN suite passes `accepts a lone explicit MCP fallback bundle`, while the policy tests continue to reject simultaneous active providers and accept inactive fallbacks. Legal cross-layer and same-layer Cordis overrides also pass in the focused suite.

## Final Verification

- `pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts --testTimeout=10000`: 242/242 passed.
- `pnpm --dir packages/curated/curated-scripts run typecheck`: passed.
- `pnpm --dir packages/curated/curated-policy run typecheck`: passed.
- `pnpm exec oxlint packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/src/index.ts packages/curated/curated-policy/tests/catalog.spec.ts`: 0 warnings and 0 errors.
- `git diff --check -- packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/src/index.ts packages/curated/curated-policy/tests/catalog.spec.ts .trae/specs/integrate-curated-plugin-layer/task-18-report.md`: passed before that report update; the final post-review result is recorded below.

## External Pending Work

Chrome/CDP regression for inactive UI candidates, real provider A/B campaigns, real-candidate fault injection, 100/200-task workloads, and 3–7 day canaries remain pending.

## Later Waves

Wave 1 does not handle published smoke packaging, installed-provenance redesign or production, profile materialization and install-script policy, `plugin-session-export` subpath evidence, official-dump patch completeness, supply-chain catalog reconciliation, score evidence, current-state docs or Agent Notes, existing-profile materialization checks, active-candidate network/data controls, package-manifest publication policy, or assembled third-party snapshots.

Explicit path-escape, credential-leak, and unauthorized-egress benchmark incident counters are out of scope: the stopped diff did not start those fields, and the approved specification expresses the safety threshold through `securityCorrectness` and `dataLossEvents`.

## Wave 1 Important Review Resolution

### Profile `.npmrc` basic-auth credential

RED command:

```sh
pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'rejects npm basic auth credentials without echoing them' --testTimeout=10000
```

RED result: exit 1; 1 failed and 162 skipped. The observed preflight returned status 0 instead of 1 for `_auth=dXNlcjpwYXNzd29yZA==`.

GREEN command:

```sh
pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'rejects npm basic auth credentials without echoing them' --testTimeout=10000
```

GREEN result: exit 0; 1 passed and 162 skipped. Secret-key handling now recognizes delimiter-bounded `auth` keys, and the regression assertion confirms the encoded credential is absent from output.

### Mixed authoritative and patch-derived claims

RED command:

```sh
pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'rejects non-catalog patch claims that collide with catalog-owned bundle claims' --testTimeout=10000
```

RED result: exit 1; 1 failed and 163 skipped. The observed preflight returned status 0 instead of 1 because catalog-derived and patch-derived active claims were validated separately.

GREEN command:

```sh
pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'rejects non-catalog patch claims that collide with catalog-owned bundle claims|accepts Cordis overrides across observed layers but rejects duplicate inserts across layers|accepts an inactive fallback provider' --testTimeout=10000
```

GREEN result: exit 0; 3 passed and 161 skipped. Effective active patch claims and authoritative catalog claims now enter one conflict validation. The mixed-origin provider and tool collisions reject, while composed Cordis overrides and inactive fallback behavior remain accepted.

### Review verification

- `pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --testTimeout=10000`: exit 0; 164 passed.
- `pnpm --dir packages/curated/curated-scripts run typecheck`: exit 0.
- `pnpm exec oxlint packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts`: exit 0; 0 warnings and 0 errors.

- `git diff --check -- packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts .trae/specs/integrate-curated-plugin-layer/task-18-report.md`: exit 0.

## Remaining Wave 1 Important Review Resolution

### Installed catalog bundle approval

RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'rejects an installed .* catalog bundle without patch metadata' --testTimeout=10000
```

RED result: exit 1; both focused cases failed because observed preflight accepted an inactive catalog candidate and a candidate assigned only to another profile. Neither installed patch declared `config.curated`.

GREEN result after adding `preflight-bundle-not-approved`: exit 0; 2 passed and 164 skipped. Known catalog bundles must now be active and assigned to the requested profile before observed preflight can accept them.

### Same-candidate catalog and patch claims

RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'merges catalog and patch claims for the same candidate without self-conflicts' --testTimeout=10000
```

RED result: exit 1; the focused case failed because identical authoritative catalog and patch-derived claims from `dsh-web-search-pro` produced provider and tool self-conflicts.

GREEN command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'rejects an installed .* catalog bundle without patch metadata|merges catalog and patch claims for the same candidate without self-conflicts|rejects non-catalog patch claims that collide with catalog-owned bundle claims' --testTimeout=10000
```

GREEN result: exit 0; 4 passed and 163 skipped. Conflict tracking now deduplicates repeated capability and resource ownership by the same candidate, while the existing different-candidate provider and tool collision case still rejects.

### Wave 1 final verification

- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --testTimeout=10000`: exit 0; 167 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm --dir packages/curated/curated-scripts run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts`: exit 0; 0 warnings and 0 errors.
- `git diff --check -- packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts .trae/specs/integrate-curated-plugin-layer/task-18-report.md`: exit 0.

## Final Wave 1 Important Review Resolution

### Resolved bundle ownership

RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'does not let a non-catalog bundle spoof catalog ownership to suppress conflicts|redacts (_auth|auth) credential values from malformed YAML diagnostics' --testTimeout=10000
```

RED result: exit 1; 3 failed and 167 skipped. The spoof test received status 0 instead of 1 because conflict deduplication trusted the non-catalog bundle's `candidateId: dsh-web-search-pro`. Both malformed YAML cases also printed `dXNlcjpwYXNzd29yZA==` verbatim.

GREEN result for the same command: exit 0; 3 passed and 167 skipped. Observed patch claims now carry an internal owner injected from the resolved bundle/catalog assignment through Cordis composition. Provider and resource deduplication compares that trusted owner, so a `local-search` bundle cannot impersonate the selected `dsh-web-search-pro` candidate.

Adjacent ownership command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'merges catalog and patch claims for the same candidate without self-conflicts|rejects non-catalog patch claims that collide with catalog-owned bundle claims|accepts Cordis overrides across observed layers but rejects duplicate inserts across layers|reads duplicate resources from installed manifests and real bundle patches|does not let a non-catalog bundle spoof catalog ownership to suppress conflicts' --testTimeout=10000
```

Result: exit 0; 5 passed and 165 skipped. Legitimate catalog/patch deduplication and Cordis overrides remain accepted, while distinct owners still conflict.

### Malformed YAML credential redaction

The shared text redactor now recognizes bare `auth:` and `_auth:` keys in parser excerpts. The focused GREEN command above proves both values become `[REDACTED]` before JSON output and that neither original credential remains.

### Latest verification evidence

- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --testTimeout=10000`: exit 0; 170 passed in 3.05 seconds.
- `perl -e 'alarm 50; exec @ARGV' pnpm --dir packages/curated/curated-scripts run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts`: exit 0; 0 warnings and 0 errors.
- `git diff --check -- packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts .trae/specs/integrate-curated-plugin-layer/task-18-report.md`: exit 0.

## Latest Wave 1 Important Review Resolution

### Incomplete PEM diagnostics

Root-cause alternatives:

- The complete-block expression required an `END` marker with the same key label, so malformed, absent, or mismatched footers left the `BEGIN` marker and payload unchanged.
- Structured issue formatting could have restored already-redacted text, but both the issue message and stage error received the unchanged source text directly from `redactSecretText()`.

Selected evidence: the focused cases below all exposed their payloads before the replacement expression was widened. Redaction now starts at a private-key `BEGIN` marker and ends at any footer-like `END` line or end-of-text. This removes malformed, unterminated, and mismatched key material while retaining diagnostics before the marker and after an available footer line.

RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'remaining payload while preserving diagnostics' --testTimeout=10000
```

RED result: exit 1; 3 failed and 171 skipped. The malformed-footer, unterminated-block, and mismatched-footer cases each emitted the `BEGIN` marker and synthetic key payload.

Preservation RED command after adding a trailing unrelated diagnostic to the malformed-footer case:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'malformed footer' --testTimeout=10000
```

Preservation RED result: exit 1; 1 failed and 173 skipped. The payload was redacted, but `retry disabled` was also removed.

### Registration evidence provenance

Root-cause alternatives:

- Owner identity alone was too broad: once catalog and patch claims shared an owner, every later patch claim by that bundle was treated as duplicate evidence.
- Cordis composition could have collapsed the two registrations, but the fixture produced two effective entries with distinct entry IDs.

Selected evidence: the focused case returned status 0 with no conflict even though both effective entries registered `shared-search`. `CuratedEntry` now records `catalog` or `patch` evidence. A catalog claim and its first matching patch claim collapse, while another claim from the same evidence source remains an independent registration and conflicts.

RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'rejects duplicate registrations from two effective entries owned by one catalog bundle|redacts a (malformed footer|unterminated block|mismatched footer) through its remaining payload while preserving diagnostics' --testTimeout=10000
```

RED result: exit 1; 1 failed and 173 skipped. The filter selected the same-owner registration case, which returned status 0 instead of 1.

### Focused GREEN and adjacent coverage

Command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'redacts complete multiline PEM blocks|remaining payload while preserving diagnostics|merges catalog and patch claims for the same candidate without self-conflicts|rejects duplicate registrations from two effective entries owned by one catalog bundle|rejects non-catalog patch claims that collide with catalog-owned bundle claims|does not let a non-catalog bundle spoof catalog ownership to suppress conflicts|accepts Cordis overrides across observed layers but rejects duplicate inserts across layers|reads duplicate resources from installed manifests and real bundle patches' --testTimeout=10000
```

Result: exit 0; 10 passed and 164 skipped. Complete, malformed, unterminated, and mismatched PEM cases pass; catalog-plus-patch deduplication and Cordis overrides remain accepted; same-owner duplicate registrations, cross-owner collisions, and spoofed ownership remain rejected.

### Final requested verification

- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --testTimeout=10000`: exit 0; 174 passed in 3.14 seconds.
- `perl -e 'alarm 50; exec @ARGV' pnpm --dir packages/curated/curated-scripts run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts`: exit 0; 0 warnings and 0 errors in 2.4 seconds.
- `git diff --check -- packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts .trae/specs/integrate-curated-plugin-layer/task-18-report.md`: exit 0 after the report append.

## Wave 2

### Install and enterprise policy

The hypotheses and selected evidence for this behavior are recorded in Defect Classes 7 and 14. The checked-in policy removes the five active Git candidates with `prepare` hooks from `web-enterprise`, while non-enterprise profiles write exact `allowBuilds` entries for those five packages. Enterprise keeps `ignore-scripts=true`, emits no build allowance, and policy validation rejects every lifecycle hook assigned to that profile.

Initial RED:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts --testTimeout=10000
```

Result: exit 1; 4 failed and 18 passed. The partial enterprise composition disagreed with policy query ordering and stale enterprise config/invariant expectations.

Focused RED:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'rejects prohibited existing enterprise content before writing any profile file' --testTimeout=10000
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts -t 'reports active web-enterprise candidates that require lifecycle builds' --testTimeout=10000
```

Result: both commands exited 1. Materialization accepted an extra `dsh-web-search-pro` dependency, and policy validation accepted an ordinary `prepare` command.

A direct materialization regression was then added for future catalog drift. With only the pre-write build guard temporarily removed, `rejects enterprise materialization before writes when a selected candidate requires prepare` failed because the operation returned normally. Restoring the guard made the same case pass and kept the profile directory absent.

### Existing-file preservation

Before any write, enterprise materialization now parses all existing owned inputs. The manifest must retain the exact profile name, private marker, pinned dependency map, and ordered bundle list. The patch rejects non-enterprise catalog packages and prohibited egress/download settings. The workspace rejects malformed build policy, `dangerouslyAllowAllBuilds`, `ignoreScripts:false`, and every true `allowBuilds` entry. `.npmrc` must have effective `ignore-scripts=true`. Safe files remain byte-identical.

### Supported least-privilege controls

The hypotheses and selected evidence are recorded in Defect Class 15. Materialization writes only catalog-backed plugin config: memento approval-gated writes and disabled automatic proposals, permission-rules fail-closed loading and enforcement, and LoongSuite `captureContent:false`. Preflight already rejects weaker forms. No generic network runtime or invented candidate fields were added.

`dsh-config-manager` remains inactive because it exposes no profile-level dry-run or execution-confirmation control. Vision, browser-download, Office, and Feishu candidates remain inactive under their recorded enterprise restrictions. Active search, MCP, and upstream-monitoring candidates expose no approved mandatory generic network setting, so their network metadata remains descriptive and deployment-owned rather than represented as runtime enforcement.

### Curated package privacy

The hypotheses and selected evidence are recorded in Defect Class 16. A focused test reads all five curated package manifests. Because the `private:true` edits already existed in the dirty tree when this wave resumed, a controlled proof temporarily removed the field from `curated-base`; the test failed with `base: expected undefined to be true`. The field was immediately restored through `apply_patch`.

The first constraints run then failed because the release-member classifier still treated `packages/curated/*` as publishable. A focused release-family test failed while those five packages remained in the dsh release plan. Curated packages are now excluded from that plan, their contradictory public `publishConfig` fields are removed, and the existing release-family and workspace-constraint checks pass.

### Focused GREEN

- Enterprise existing-file, supported-config, exact-build-allowlist, safe-preservation, and package-privacy cases: 5 passed.
- Enterprise lifecycle-policy case: 1 passed.
- Catalog-drift materialization case: 1 passed, with no profile directory created.
- Full `curated-profiles`: 25 passed.
- Full `curated-policy`: 80 passed.

### Wave 2 final verification

- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts --testTimeout=10000`: exit 0; 25 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts --testTimeout=10000`: exit 0; 80 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --testTimeout=10000`: exit 0; 174 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run scripts/check-workspace-constraints.spec.ts scripts/release/families.spec.ts --testTimeout=10000`: exit 0; 33 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm --dir packages/curated/curated-profiles run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm --dir packages/curated/curated-policy run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm run constraints`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-profiles/src/index.ts packages/curated/curated-profiles/tests/profiles.spec.ts packages/curated/curated-policy/src/index.ts packages/curated/curated-policy/tests/catalog.spec.ts scripts/check-workspace-constraints.ts scripts/release/families.ts scripts/release/families.spec.ts`: exit 0; 0 warnings and 0 errors.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-translation-pairing packages/curated/curated-profiles/README.md`: exit 0; one named pair consistent.
- `git diff --check`: exit 0 after the Wave 2 report append.

Wave 2 status: DONE.

## Wave 2 Important Review Resolution

### Git dependency build identifiers

The root manifest pins `pnpm@11.7.0`. Its locally installed implementation requires the peer-suffix-free lockfile depPath because package-name rules do not approve Git artifacts. The direct-Git fetcher constructs `${manifest.name}@${createGitHostedPkgId(resolution)}`; the GitHub hosted fetcher constructs `${manifest.name}@${resolution.tarball}` from the codeload URL. Both paths print the required full value in `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`.

RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'uses pnpm 11.7 Git dependency identifiers' --testTimeout=45000
```

RED result: exit 1; 1 failed and 26 skipped. The test's temporary local Git dependency first proved that `allowBuilds: { dsh-web-search-pro: true }` was rejected and that pnpm printed `dsh-web-search-pro@git+file://<temporary-repository>#<40-character-commit>: true`. Reinstalling with the materialized workspace also exited 1 because it still emitted package-name-only keys.

Hosted-Git RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'allows only audited prepare scripts outside enterprise' --testTimeout=10000
```

Hosted-Git RED result: exit 1; 1 failed and 26 skipped. The materializer emitted `<package>@git+https://github.com/...#<commit>` while pnpm 11.7 uses `<package>@https://codeload.github.com/.../tar.gz/<commit>` for GitHub-hosted artifacts.

GREEN results: both focused commands exited 0 with 1 passed and 26 skipped. The materializer now emits pnpm 11.7's exact hosted-tarball depPaths for the five GitHub dependencies and retains the direct-Git depPath for non-hosted repositories. The isolated local-fixture pnpm install remained blocked by the package-name-only rule, and `prepared.txt` was absent.

### Existing enterprise LoongSuite patch

RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'rejects existing enterprise LoongSuite content capture without changing bytes' --testTimeout=10000
```

RED result: exit 1; 1 failed and 26 skipped. `materializeCuratedProfile('web-enterprise', home)` returned normally for an existing `loongsuite-observability` row with `captureContent: true`.

GREEN result for the same command: exit 0; 1 passed and 26 skipped. Existing enterprise patch validation now requires `config.captureContent === false` on every `loongsuite-observability` row. The test confirms rejection occurs before writes by comparing `package.json`, `cordis.patch.yml`, `pnpm-workspace.yaml`, and `.npmrc` byte-for-byte.

### Wave 2 Important review verification

- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts --testTimeout=45000`: exit 0; 27 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run apps/cli/tests/curated-profile.spec.ts --testTimeout=10000`: exit 0; 4 passed after removing its stale expectation that enterprise still includes the prepare-dependent permission-rules bundle.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run scripts/check-workspace-constraints.spec.ts scripts/release/families.spec.ts --testTimeout=10000`: exit 0; 33 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm --dir packages/curated/curated-profiles run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm run constraints`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-profiles/src/index.ts packages/curated/curated-profiles/tests/profiles.spec.ts apps/cli/tests/curated-profile.spec.ts`: exit 0; 0 warnings and 0 errors.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-translation-pairing packages/curated/curated-profiles/README.md`: exit 0; one named pair consistent.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-md-wrap packages/curated/curated-profiles/README.md packages/curated/curated-profiles/README.zh.md .trae/specs/integrate-curated-plugin-layer/task-18-report.md`: exit 0.
- `git diff --check`: exit 0 after this report append.

## Wave 2 Remaining Review Resolution

### pnpm 11.7 `allowBuilds` proof

The installed pnpm 11.7.0 implementation confirms both generated identifier forms. Its Git resolver uses `createGitHostedPkgId(resolution)` for direct Git and `resolution.tarball` for GitHub-hosted archives. The direct-Git fetcher passes `createGitHostedPkgId(resolution)` to `preparePackage`, while the GitHub tarball fetcher passes `resolution.tarball` plus an optional `#path:` suffix. `preparePackage` constructs the checked key as `${manifest.name}@${pkgResolutionId}`. `createAllowBuildFunction` classifies source-like non-semver keys as depPath rules, removes only peer suffixes, and exact-matches the resulting key.

The current materializer therefore matches pnpm 11.7.0 exactly:

- GitHub: `<package>@https://codeload.github.com/<owner>/<repository>/tar.gz/<commit>[#path:<subdirectory>]`
- Direct Git: `<package>@git+<repository>#<commit>[&path:<subdirectory>]`

No identifier change was required.

The deterministic regression now creates a temporary local Git dependency with a `prepare` marker, configures only the insufficient package-name rule, runs pnpm 11.7.0, captures the full key from `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`, and compares it with the materialized workspace key. The install remains blocked and the marker is absent; the test never enables or executes the lifecycle script.

RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'derives allowed Git prepare identifiers from pnpm 11.7 blocked resolution' --testTimeout=45000
```

RED result: exit 1; 1 failed and 26 skipped after a controlled regression changed the direct-Git materializer branch to emit only the package name. pnpm suggested `dsh-web-search-pro@git+file://<temporary-repository>#<40-character-commit>`, while the generated workspace lacked that key. The fixture lifecycle script remained blocked.

GREEN result for the same command: exit 0; 1 passed and 26 skipped after restoring the full direct-Git depPath.

The deterministic test exercises pnpm's real direct-Git resolver, matcher, and error-key construction without network access. The live hosted proof below separately exercises the GitHub codeload branch against a pinned active candidate without permitting its lifecycle script.

### Enterprise profile prose

Current-state prose now records that `web-curated` and `web-coding` use the ten-candidate active baseline, while `web-enterprise` intentionally uses only the five build-free active candidates because scripts remain disabled. The paired governance Agent Note and `packages/curated/README` were updated in both languages and re-recorded. The already-correct `curated-profiles` README pair was retained. The superpowers README, architecture, roadmap, and supply-chain pages now carry the same enterprise composition.

### Verification

- Focused RED/GREEN pnpm resolver test: expected RED, then 1 passed.
- Full curated profiles and CLI tests: 31 passed.
- Focused coverage execution: all 27 curated-profile tests passed; the strict per-file gate reported 97.74% statements and 96.34% branches because reachable Wave 2 branches at `index.ts:220,232,306-307,309-314` lacked tests.
- Curated profiles package typecheck: exit 0.
- Repository typecheck: exit 0 before a concurrent unrelated edit; the final rerun is blocked by unused `oldScope` at `packages/settings/settings-file/tests/concurrency.spec.ts:105`.
- Repository lint: exit 0; 0 warnings and 0 errors across 2,645 files.
- Translation pairing write: two records updated.
- Translation pairing check: three named pairs consistent.
- Markdown wrap: 2,030 files checked.
- Markdown links: 2,077 files checked.
- Agent Note format: 605 notes checked.

Wave 2 remaining review status: DONE.

## Wave 2 Coverage Blocker Resolution

All reported branches are reachable through existing profile files or catalog records. Tests now cover a GitHub prepare dependency with a repository subpath, missing nested enterprise profile metadata, a non-record dependency map, non-record workspace YAML, unrestricted builds, enabled workspace scripts, malformed build grants, absent build grants, and explicit false build grants. No production branch was removed or ignored.

The prior `coverage/` report recorded `index.ts` at 173/177 statements, 158/164 branches, 31/31 functions, and 157/157 lines. Those uncovered branches were part of the Wave 2 implementation, so the earlier attribution was incorrect.

### Coverage Closure Verification

- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts --testTimeout=45000`: exit 0; 29 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts --coverage --coverage.include='packages/curated/curated-profiles/src/**/*.ts' --testTimeout=45000`: exit 0; 29 passed. Combined curated-profiles source coverage is 202/202 statements, 179/179 branches, 35/35 functions, and 180/180 lines. `index.ts` is 177/177 statements, 164/164 branches, 31/31 functions, and 157/157 lines; `invariant.ts` is 25/25 statements, 15/15 branches, 4/4 functions, and 23/23 lines.
- `perl -e 'alarm 50; exec @ARGV' pnpm run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm run lint`: exit 0; 0 warnings and 0 errors across 2,645 files.
- `git diff --check`: exit 0 after this report update.

Wave 2 coverage status: DONE.

## Wave 2 Hosted Codeload Evidence Closure

The isolated profile `/tmp/dsh-task18-codeload-proof/profile` depended only on the active `dsh-web-search-pro` candidate at `git+https://github.com/anweat/dsh-web-search-pro.git#4274ab148d926060a4e5e1399ac9e87894ed1a83`. Its workspace configured only `allowBuilds: { dsh-web-search-pro: true }`, and `.npmrc` kept `ignore-scripts=false` so pnpm had to reject an unapproved prepare dependency rather than bypass lifecycle handling.

Command:

```sh
perl -e 'alarm 48; exec @ARGV' env HOME=/tmp/dsh-task18-codeload-proof/home NPM_CONFIG_USERCONFIG=/dev/null pnpm install --reporter=append-only --store-dir /tmp/dsh-task18-codeload-proof/store
```

Result: expected exit 1 in 6.36 seconds under pnpm 11.7.0. pnpm reported `ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED` for `https://codeload.github.com/anweat/dsh-web-search-pro/tar.gz/4274ab148d926060a4e5e1399ac9e87894ed1a83` and suggested this exact grant:

```yaml
allowBuilds:
  dsh-web-search-pro@https://codeload.github.com/anweat/dsh-web-search-pro/tar.gz/4274ab148d926060a4e5e1399ac9e87894ed1a83: true
```

Production `materializeCuratedProfile('web-curated', '/tmp/dsh-task18-codeload-proof/materialized-home')` emitted the identical key. A literal comparison returned `exact-key-match`. The blocked profile contained no `node_modules/dsh-web-search-pro`, lockfile, or `prepared.txt`, so the third-party `prepare` script did not execute. The suggested key was never enabled.

No production change was required. The codeload identifier is now exercised through pnpm's real resolver, while the existing deterministic local-Git regression continues to cover direct-Git key construction without network access.

### Final Closure Verification

- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts --testTimeout=45000`: exit 0; 29 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts --coverage --coverage.include='packages/curated/curated-profiles/src/**/*.ts' --testTimeout=45000`: exit 0; 29 passed, with 100% statements, branches, functions, and lines for both `index.ts` and `invariant.ts`.
- `perl -e 'alarm 50; exec @ARGV' pnpm run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm run lint`: exit 0; 0 warnings and 0 errors across 2,645 files.
- `perl -e 'alarm 50; exec @ARGV' pnpm run doc-sync`: exit 0; 28 passed, 0 failed, and 0 skipped.

## Wave 3A Published Smoke Runner

### Diagnosis

- Hypothesis A was confirmed: the default smoke runner embedded the repository-only `apps/cli/src/bin.ts` path and loaded it through undeclared `tsx/esm`, so an unpacked curated-scripts tarball could not run either CLI stage.
- Hypothesis B was rejected: the approved specification and review adjudication require installed manifest/bundle validation plus the real `--dump-config` and `--help` paths, not direct candidate-module import.

### Release Closure RED

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run --config vitest.e2e.config.ts packages/curated/curated-scripts/tests/packed-entry.e2e.ts --retry=0
```

Result: exit 1; the unpacked package attempted `/tmp/.../consumer/apps/cli/src/bin.ts` through `tsx/esm`, and both `dump-config` and `help` stages failed with `ERR_MODULE_NOT_FOUND`.

### Fix

The default runner now resolves `@deepseek-ai/dsh/package.json`, reads its declared `dsh` bin, and executes that built entry under plain Node. `@deepseek-ai/dsh` is a declared runtime dependency, while the existing `SmokeProfileOptions.runner` remains the injected unit-test path. Candidate handling remains manifest/bundle validation only.

The paired curated-scripts README states the installed-bin behavior. The packed test extracts the actual curated-scripts tarball into an external temporary consumer, installs a file-backed fake `@deepseek-ai/dsh` package entirely inside that consumer, invokes the uninjected default runner, and verifies the resolved bin path and both generated argument lists. Other runtime dependencies remain repository links needed to load the packed entry, so this test does not claim that the complete DSH dependency graph is packed. The separate `apps/cli/tests/built-bin.e2e.ts` suite owns real built-CLI `--dump-config` and `--help` behavior.

### GREEN and Verification

- Focused unit suite: 174 passed.
- Packed-entry smoke: 1 passed; the consumer-local fake DSH bin received `--profile web --dump-config` and `--profile web --help`.
- Built CLI smoke: the separate `apps/cli/tests/built-bin.e2e.ts` suite covers real built DSH `--dump-config` and profile `--help` behavior.
- Curated-scripts package typecheck and build: exit 0.
- Repository typecheck: exit 0.
- Focused lint: 0 warnings and 0 errors across the three changed source/test files.
- Repository lint: 0 warnings and 0 errors across 2,646 files.
- Workspace constraints: exit 0.
- Translation pairing: one named README pair consistent.
- Changed runner coverage: every new statement and function at `index.ts:1176-1188` executed. The strict whole-file coverage command still exits 1 at 99.91% statements and 99.55% branches because of five pre-existing uncovered locations at `index.ts:1014,2194,2252,2457`; none belongs to Wave 3A.

Wave 3A implementation status: DONE. Final repository verification status: BLOCKED by the unrelated concurrent settings-file test edit; curated-scripts package typecheck remains green.

## Wave 3A Important Review Resolution

### Curated-scripts lock importer

The package manifest already declared `@deepseek-ai/dsh` as a runtime dependency, but the repository lock importer omitted it. A plain `pnpm install --lockfile-only --ignore-scripts` exited successfully without updating `pnpm-lock.yaml` because the virtual-store lock already contained the dependency. The authoritative filtered command `pnpm --filter @deepseek-ai/dsh-curated-scripts add '@deepseek-ai/dsh@workspace:^' --lockfile-only --ignore-scripts` updated the repository lock. Its only lockfile diff is the `workspace:^` specifier and `link:../../../apps/cli` resolution under `packages/curated/curated-scripts`.

### Consumer-local DSH bin proof

RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run --config vitest.e2e.config.ts packages/curated/curated-scripts/tests/packed-entry.e2e.ts --retry=0
```

RED result: exit 1; the installed `@deepseek-ai/dsh` package was a junction to the repository `apps/cli` directory, so the new isolation assertion received `true` from `isSymbolicLink()`.

The test now extracts the curated-scripts tarball under a temporary consumer and writes a minimal fake `@deepseek-ai/dsh` manifest and bin as ordinary files under that consumer's `node_modules`. The fake records its canonical entry path and arguments. Assertions require both invocations to use that consumer-local bin and receive `--profile web --dump-config` followed by `--profile web --help`. The packed entry must still omit `apps/cli/src/bin.ts` and `tsx/esm`.

GREEN result for the same command: exit 0; 1 passed. This result proves packed-entry resolution and invocation only. Repository symlinks still supply the packed package's other runtime dependencies, and real CLI behavior remains covered separately by `apps/cli/tests/built-bin.e2e.ts`.

### Important review verification

- Authoritative lock update: `pnpm --filter @deepseek-ai/dsh-curated-scripts add '@deepseek-ai/dsh@workspace:^' --lockfile-only --ignore-scripts` exited 0; the lock diff contains only the missing curated-scripts importer dependency.
- Frozen lock check: `pnpm install --frozen-lockfile --lockfile-only --ignore-scripts` exited 0.
- Packed entry: 1 passed.
- Real built CLI help/config: 2 passed in the separate `apps/cli/tests/built-bin.e2e.ts` suite.
- Curated-scripts commands: 176 passed.
- Focused source coverage: 176 tests passed with 100% statements, functions, and lines for `src/index.ts` and `src/invariant.ts`. Two added cases closed reachable old gaps for optional catalog resources and non-record observed patch members. The strict command still exits 1 at 99.77% branch coverage because `index.ts:2252` is an unused private default and `index.ts:2457` is an internal fallback that observed loading cannot reach; no test-only export or unrelated production rewrite was added.
- Curated-scripts package typecheck: exit 0.
- Focused lint for the changed tests: 0 warnings and 0 errors.
- Repository lint: blocked only by two pre-existing `typescript(no-unsafe-assignment)` diagnostics at `packages/settings/settings-file/tests/concurrency.spec.ts:237` and `:319`.
- Translation pairing for the curated-scripts README: one named pair consistent.
- Markdown wrapping: 2,030 files checked.
- Documentation checks: 27 passed and `doc-typecheck` failed on the same unrelated settings-file edit (`concurrency.spec.ts:138,225,228-231`).

## Wave 3A Coverage Blocker Closure

The strict baseline ran all 176 command tests successfully but exited 1 at 99.77% branch coverage. Its only uncovered branches were `index.ts:2252`, where the sole private caller always supplied `authoritativeEntries`, and `index.ts:2457`, where observed loading had already overwritten curated entries with a typed `ObservedClaimOwner`.

`validatePatchEntries()` now requires `authoritativeEntries` and spreads it directly. `trustedClaimOwner()` retains metadata ownership for fixture input, but observed input reads the loader-injected `ObservedClaimOwner` directly instead of revalidating its required `id` and `label` and retaining an unreachable metadata fallback. Public `PreflightOptions`, command output, and ownership behavior are unchanged. No impossible-path tests were added.

### Wave 3A Closure Verification

- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --testTimeout=10000`: exit 0; 176 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run --config vitest.e2e.config.ts packages/curated/curated-scripts/tests/packed-entry.e2e.ts --retry=0`: exit 0; 1 passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run --coverage --coverage.include=packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts --testTimeout=10000`: exit 0; 176 passed. `index.ts` reached 100% statements, branches, functions, and lines.
- `perl -e 'alarm 50; exec @ARGV' pnpm run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-scripts/src/index.ts`: exit 0; 0 warnings and 0 errors.
- `perl -e 'alarm 50; exec @ARGV' git diff --check`: exit 0 before recording this result.

Wave 3A coverage status: DONE.

## Wave 3B Pinned Metadata and Session Export Rejection

### Source Evidence

Each archive digest below was recomputed directly from `https://codeload.github.com/<owner>/<repository>/tar.gz/<40-character-commit>` with `curl -fsSL --max-time 35 | shasum -a 256`. Dependency sets are the sorted union of `dependencies`, `optionalDependencies`, and `peerDependencies` from each pinned raw `package.json`, matching `observedDependencies()`. Entry IDs come from each package-relative pinned `cordis.patch.yml`. No repository refresh or generator script was run.

| Candidate | Commit | SHA-256 | Runtime dependency set | Bundle entry ID |
| --- | --- | --- | --- | --- |
| `dsh-toolkit` | `2113d11a4e4510720251aa49a800bab917b14330` | `d56d9053fe01328dbe42cd2bb6e07df7870c935cd05f30ee279910d90c41262d` | `@deepseek-ai/cordis`, `@deepseek-ai/dsh-invariants`, `@deepseek-ai/dsh-tools` | `tool-kit` |
| `dsh-web-search-pro` | `4274ab148d926060a4e5e1399ac9e87894ed1a83` | `c790ec0a49daad8076bdb6412342c941dd2c9567951e856ac3378e8e61037f38` | `@anweat/dsh-browser`, `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-connection`, `@deepseek-ai/dsh-client-locale`, `@deepseek-ai/dsh-client-runtime`, `@deepseek-ai/dsh-client-ui-settings`, `@deepseek-ai/dsh-client-ui-settings-plugins`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-credentials`, `@deepseek-ai/dsh-settings`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/schemastery`, `cross-spawn`, `js-yaml`, `jsdom` | `web-search-pro` |
| `dsh-memento` | `ee198efd71dc60f5cd1cd2019e20c63028d2d182` | `94459521c229cfe869c675f7fc9e31edfc690200a77e932fd37b8d42d60595e5` | `@deepseek-ai/cordis`, `@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/schemastery` | `memento` |
| `dsh-mcp-panel` | `da7ee900539a0bcb65e0c40b94376f9f4334008d` | `9678db93350acbb6723ba8206f57352368adcbd3f68f1a4200b199c4664d06c7` | `@deepseek-ai/cordis`, `@deepseek-ai/cordis-plugin-loader`, `@deepseek-ai/dsh-commands`, `@deepseek-ai/dsh-jobs`, `@deepseek-ai/dsh-subprocess`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-typert-protocol`, `@deepseek-ai/schemastery`, `tsdown`, `typescript`, `zod` | `mcp-panel` |
| `dsh-checkpoint-rewind` | `377174b99200ea2f004f03f679f39515505c38f3` | `5c8725fbbc5171f70a7433f723f2ef14926586e3ee7de8a2316f53de32f6af6f` | `@deepseek-ai/cordis`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-storage-domain`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-typert-protocol`, `@deepseek-ai/schemastery`, `zod` | `checkpoint-rewind` |
| `dsh-lsp-actions` | `f86d45c10ce248ae4d0d30118354e3ff07432b0e` | `92ce1f09f1c0b6726c7270d3b3378eecc215a0628324bbeee622869fb9d00aa4` | `@deepseek-ai/cordis`, `@deepseek-ai/dsh-fs`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-sandbox`, `@deepseek-ai/dsh-subprocess`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/schemastery` | `lsp-actions` |
| `dsh-permission-rules` | `36984920b1bfad1d542d1e937f7c99df8d1d848c` | `e56ce2e687fc502a470162e84a1245c5cf44e420dccec89e81e02024ee80d35b` | `@deepseek-ai/cordis`, `@deepseek-ai/dsh-agent`, `@deepseek-ai/dsh-commands`, `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-tools`, `@deepseek-ai/dsh-typert-protocol`, `@deepseek-ai/schemastery`, `@types/react`, `chokidar`, `react`, `tsdown`, `typescript`, `yaml`, `zod` | `permission-rules` |
| `dsh-smooth-stream` | `b8c5eefc1584a5a1d69116a0b038acd2abc4adb6` | `ff75af9cea5594ae7289a5387ae35d06645f2ef5b43de4b4fc3c913c34bfbd23` | `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-connection`, `@deepseek-ai/dsh-client-locale`, `@deepseek-ai/dsh-client-runtime`, `@deepseek-ai/dsh-client-ui-attachment`, `@deepseek-ai/dsh-client-ui-conversation`, `@deepseek-ai/dsh-client-ui-primitives`, `@deepseek-ai/dsh-client-ui-settings`, `@deepseek-ai/dsh-client-ui-settings-plugins`, `@deepseek-ai/dsh-client-ui-slots`, `@deepseek-ai/dsh-host-webserver`, `@deepseek-ai/dsh-settings`, `@deepseek-ai/schemastery`, `react` | `smooth-stream` |
| `upstream-radar` | `e02ca9568d256a5f19c1282b8c95a9844c84aa82` | `9ae0ca51c1c136f3de2ca2eb9553e4a2aebc7a5abce5e41c6cb5a952fb648aae` | none | `upstream-radar` |
| `plugin-session-export` | `acf9d2d960d2b9ac6ae8569a68836a087c2154ee` | `5bcbafb9e6139a33716446f3cc17294961c57e51117272e04961bfdfb2b1d130` | `@deepseek-ai/cordis`, `@deepseek-ai/dsh-session`, `@deepseek-ai/dsh-tools` | `plugin-session-export` |
| `loongsuite-dsh-plugin` | `5e893af6172beb703a98b56ccc5e443495287732` | `31ed315e6d0d48254553fdd586a5d8ef084c90616579184eed2d1e6a349f9005` | `@deepseek-ai/schemastery`, `@loongsuite/otel-util-genai`, `@opentelemetry/api`, `@opentelemetry/exporter-metrics-otlp-proto`, `@opentelemetry/exporter-trace-otlp-proto`, `@opentelemetry/resources`, `@opentelemetry/sdk-metrics`, `@opentelemetry/sdk-trace-base`, `@opentelemetry/semantic-conventions` | `loongsuite-observability` |

The exact pinned subpackage source `https://raw.githubusercontent.com/whyihaveyou/dsh-suite/acf9d2d960d2b9ac6ae8569a68836a087c2154ee/packages/plugins/plugin-session-export/package.json` has no `engines.node`. The candidate therefore records `manifestPath: package.json`, null Node evidence, `active: false`, no target profiles, and `node-compatibility-unverified`; its 40-character commit and MIT license are unchanged. `web-research` now uses only the ten-candidate baseline, and the derived candidate summary records 10 active and 26 rejected candidates.

### RED/GREEN and Verification

- RED: `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-profiles/tests/profiles.spec.ts packages/curated/curated-bench/tests/bench.spec.ts --testTimeout=10000` exited 1 with exactly 6 failures and 121 passes.
- GREEN: the identical command exited 0 with 127 passes.
- Catalog, policy, profiles, bench, and changed-source coverage: `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-profiles/tests/profiles.spec.ts packages/curated/curated-bench/tests/bench.spec.ts --coverage '--coverage.include=packages/curated/{curated-policy,curated-profiles,curated-scripts}/src/{index,invariant}.ts' --testTimeout=45000` exited 0 with 303 passes and 100% statements, branches, functions, and lines in every included file.
- Repository typecheck: `perl -e 'alarm 50; exec @ARGV' pnpm run typecheck` exited 0.
- Workspace constraints: `perl -e 'alarm 50; exec @ARGV' pnpm run constraints` exited 0.
- Scoped lint: `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-profiles/src/index.ts packages/curated/curated-profiles/tests/profiles.spec.ts packages/curated/curated-bench/tests/bench.spec.ts` exited 0 with 0 warnings and 0 errors across four files.
- Translation pairing: each of `packages/curated/README.md`, `packages/curated/curated-profiles/README.md`, and `.agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md` reported one named pair consistent.
- Agent Note format: 605 notes checked and conforming.
- Package README structure: 234 READMEs checked and conforming.
- Commit/license preservation: the scoped zero-context diff contains no changed `commit:` or `license:` line.
- Final diff checks: `git diff --check` and `git diff --cached --check` exited 0 after this report update.

Wave 3B status: DONE.

## Wave 3B Review Findings Resolution

### Smoke description

The curated governance Agent Note now states the shipped behavior: smoke resolves and validates the installed manifest, bundle patch, provenance record, and declared main file, then invokes the shipped CLI's `--dump-config` and `--help` stages. It explicitly states that smoke does not import candidate modules or synthesize bundle shims. The Chinese counterpart carries the same propositions.

The Agent Note pair was re-recorded through `apply_patch` with English blob `e506b539e9bac1697ac9e3bd0fdbbeffae9767cc` and Chinese blob `10d782bcaecdc0b2e5053913ce2f7fdb6fd72ec0`. `.gitignore:41` intentionally ignores `.agents/notes/implemented/`; `git check-ignore` matched that rule, and `git ls-files --error-unmatch` confirmed the governance note is untracked. This task forbids staging, so the triplet remains outside the index. The current Git state does not include the triplet in a commit, and this report does not claim that the triplet will ship from that state.

### Audit timestamps

The refreshed `curated-candidates.json.generatedAt`, `locks/web-curated.json.createdAt`, and `profiles/web-curated.json.createdAt` fields now read `2026-08-26`. Unchanged official-web baselines, `2026-08-24` rollback snapshots, test fixture timestamps, and planning references to the 2026-08-25 upstream research snapshot remain unchanged.

### Timestamp RED

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-scripts/tests/commands.spec.ts -t 'Wave 3B audit date|keeps curated benchmark snapshots aligned' --testTimeout=10000
```

Result: exit 1; one test passed, one failed, and 257 were skipped. The catalog audit-date test passed with the sole audit date `2026-08-26`. The artifact-consistency test failed because the manifest `generatedAt` and both current `web-curated` snapshot `createdAt` values were `2026-08-25` instead of `2026-08-26`.

### Timestamp GREEN

The identical focused command exited 0 with two tests passed and 257 skipped after the three current artifact timestamps were corrected.

### Review-finding verification

- Curated suites: `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-profiles/tests/profiles.spec.ts packages/curated/curated-bench/tests/bench.spec.ts --testTimeout=45000` exited 0 with 304 tests passed across four files.
- Generated JSON: `perl -e 'alarm 50; exec @ARGV' sh -c 'find packages/curated/curated-bench -type f -name "*.json" -exec jq empty {} + && echo "curated benchmark JSON: valid"'` exited 0 and printed `curated benchmark JSON: valid`.
- Translation pairing: `perl -e 'alarm 50; exec @ARGV' pnpm run verify-translation-pairing .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md` exited 0 with one named pair consistent.
- Agent Note format: `perl -e 'alarm 50; exec @ARGV' pnpm run verify-agent-note-format` exited 0 with 605 notes conforming.
- Documentation: `perl -e 'alarm 50; exec @ARGV' pnpm run doc-sync` exited 0 with 28 passed, 0 failed, and 0 skipped in 34.18 seconds.
- Scoped lint: `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-scripts/tests/commands.spec.ts` exited 0 with 0 warnings and 0 errors across two files.
- Targeted stale-content search found none of the removed module-import claims or `2026-08-25` values in the three refreshed current artifacts.
- Diff checks over tracked, staged, ignored Agent Note, and untracked report content exited 0 with no whitespace errors.

Wave 3B review findings status: DONE.

## Wave 3C Normal-Install Provenance

### Root cause and decision

The Wave 3C review hypotheses are recorded at the start of this report. The resolver now classifies every supplied root before resolving a candidate. If any root is a managed profile, that profile is authoritative: a selected candidate must have an exact manifest dependency, matching root and installed pnpm lock records, and a directly hoisted installed package. Missing or mismatched state returns an error without consulting package-authored `.dsh-curated-artifact.json` or any other root. Explicit sidecar acquisition records remain available only when no supplied root is a managed profile.

`inspectResolvedArtifact()` is the single installed-content validator used by verify-lock, observed preflight, and observed smoke. It preserves resolved package-manager metadata and checks repository, commit, repository path, package version, license, dependency union, lifecycle scripts, Node metadata and runtime compatibility, manifest path, bundle patch, main entry, permission-plugin safety settings, and recorded core-path changes. Smoke reports those `artifact-*` issues directly and does not run child stages after validation fails.

No production installer, provenance sidecar producer, cryptographic format, candidate import, or third-party script execution was added.

### RED/GREEN evidence

Baseline command:

```sh
pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'uses normal pnpm install state as observed provenance across curated commands' --testTimeout=45000
```

Baseline result: exit 0; 1 passed and 176 skipped.

Shared-validation RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'uses normal pnpm install state as observed provenance across curated commands' --testTimeout=45000
```

RED result: exit 1; 1 failed and 176 skipped. After installed license drift, observed preflight returned `ok:true` with no issues. The expanded metadata matrix then produced the same expected RED when the preflight and smoke validator calls were temporarily removed: package-version drift reached preflight with an empty issue list.

Managed-provenance RED command:

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'uses normal pnpm install state as observed provenance across curated commands' --testTimeout=45000
```

RED result: exit 1; 1 failed and 176 skipped. Removing the selected dependency while leaving a valid package sidecar made observed preflight return `ok:true`.

GREEN result for the same focused command: exit 0; 1 passed and 176 skipped. The test now checks all three commands across package version, license, dependency union, lifecycle scripts, Node range, bundle patch, main entry, dependency declaration, root and installed lock state, repository, commit, and package path.

The materialized proof uses `materializeCuratedProfile('web-curated', home)` and a repository-owned fixture builder at `packages/curated/curated-scripts/tests/fixtures/local-git-profile.ts`. The fixture creates one local Git repository with every selected candidate in its own `packages/<candidate-id>` subdirectory. pnpm 11.7 installs the generated manifest, workspace, and `.npmrc` without modification. The initial test asserted the `&path:packages/dsh-web-search-pro` specifier in both lock importers and the matching package-record key, but it did not assert the importer `version` or `resolution.path`; the production reader derived the package path from the manifest spec instead of the lockfile. The earlier claim that the lock records independently proved package-path agreement was therefore overstated. The remaining-review closure below records the independent lock-path checks. The test also proves that missing importer entries, package resolution, installed lock evidence, or the installed package reject in all three commands; a valid later sidecar root cannot override the managed failure, while standalone verify-lock still accepts that sidecar root.

Materialized-proof command:

```sh
perl -e 'alarm 52; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'verifies a materialized hoisted profile installed from local Git package subdirectories' --testTimeout=50000
```

RED progression: exit 1 when the test still loaded the checked-in catalog, exit 1 when a file-URL catalog violated the HTTPS repository policy, and exit 1 when the expected generated dependency omitted `.git`. These failures corrected the test setup without weakening production validation.

GREEN result: exit 0; 1 passed and 177 skipped in 5.42 seconds.

### Wave 3C verification

- `perl -e 'alarm 52; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-profiles/tests/profiles.spec.ts --testTimeout=50000`: exit 0; 207 tests passed across two files.
- `perl -e 'alarm 52; exec @ARGV' pnpm exec vitest run --coverage --coverage.include=packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts --testTimeout=50000`: exit 0; 178 tests passed; `index.ts` reached 100% statements, branches, functions, and lines.
- `perl -e 'alarm 50; exec @ARGV' pnpm --dir packages/curated/curated-scripts run typecheck`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-scripts/tests/fixtures/local-git-profile.ts`: exit 0; 0 warnings and 0 errors.
- `perl -e 'alarm 50; exec @ARGV' pnpm run typecheck`: exit 0.
- `perl -e 'alarm 52; exec @ARGV' pnpm run lint`: exit 0; 0 warnings and 0 errors across 2,647 files.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-translation-pairing packages/curated/curated-scripts/README.md`: exit 0; one named pair consistent.
- `perl -e 'alarm 52; exec @ARGV' pnpm run doc-sync`: exit 0; 28 passed, 0 failed, and 0 skipped in 32.19 seconds.
- `git diff --check`: exit 0 after this report update.

Wave 3C initial status: superseded by the remaining-review closure below.

## Wave 3C Remaining Review Closure

### Managed-profile classification

`readManagedProfileManifest()` now distinguishes an absent own `dsh.profile` property from a present malformed value. A root with no profile metadata remains eligible for explicit sidecar acquisition records. A root with `dsh.profile: null`, a string, or an array fails with `profile metadata must be an object` before package or later-root sidecar lookup.

RED command:

```sh
perl -e 'alarm 52; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'fails closed for absent and malformed installed provenance' --testTimeout=50000
```

RED result: exit 1; the valid installed sidecar was returned for the first malformed profile value instead of an error.

GREEN result for the same command: exit 0; 1 passed and 177 skipped.

### Independent pnpm package-path evidence

The pnpm reader now parses the importer `version` as an exact Git locator and compares its normalized repository, full commit, and package path with the manifest declaration. It separately reads `packages[<name>@<version>].resolution.path` and requires exact equality with the manifest and catalog `repositoryPath`. The package-record version remains compared with the installed package manifest.

The real materialized subdirectory fixture confirms that pnpm 11.7 writes the full direct-Git dependency spec into both importer `version` fields and writes `resolution.path: packages/dsh-web-search-pro` into both package records. It mutates both lockfiles together to prove that a pathless importer version, missing `resolution.path`, and mismatched `resolution.path` each reject in verify-lock, observed preflight, and observed smoke.

RED command:

```sh
perl -e 'alarm 52; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'verifies a materialized hoisted profile installed from local Git package subdirectories' --testTimeout=50000
```

RED result: exit 1; verify-lock returned `ok:true` after the importer version's `&path:` component and matching package-record key were removed.

GREEN result for the same command: exit 0; 1 passed and 177 skipped.

### Remaining-review verification

- Full commands and profiles: 207 tests passed.
- Changed-source coverage: 178 tests passed; `packages/curated/curated-scripts/src/index.ts` reached 100% statements, branches, functions, and lines.
- Curated-scripts package typecheck: exit 0.
- Repository typecheck: exit 0.
- Scoped lint: 0 warnings and 0 errors across three files.
- Repository lint: 0 warnings and 0 errors across 2,647 files.
- Documentation: `doc-sync` passed all 28 gates; translation pairing required no generated update because no bilingual owner document changed.
- Report wrapping: 2,030 Markdown files checked with no hard-wrapped prose paragraphs.
- Final tracked and staged diff checks: exit 0 after this report update.

Wave 3C remaining-review status: DONE.

## Wave 4 Documentation Reconciliation

### Current-state corrections

- `docs/plugin/superpowers/README.md`, `00-背景与目标.md`, `01-目标架构.md`, `02-插件矩阵与择优.md`, `03-实施路线图.md`, `04-评测体系.md`, `05-安全供应链与风险.md`, `06-深度调研复评与证据分级.md`, and the local design/plan now distinguish the 12-candidate target from the 10-candidate policy-selected baseline and state that no external-candidate E3 install/enable/restart/uninstall record is persisted.
- The same planning corpus now records that `web-research` uses the ten-candidate baseline and excludes inactive `plugin-session-export`, while `web-enterprise` uses the five active candidates that require no lifecycle build.
- Smoke prose now matches implementation: it validates the profile bundle order, installed manifest, bundle patch, declared main-file existence, and other shared artifact fields before invoking the installed DSH CLI's `--dump-config` and `--help`; it does not directly import candidate modules or create synthetic shims.
- Managed-profile provenance now consistently names the profile manifest dependency, root `pnpm-lock.yaml`, installed `node_modules/.pnpm/lock.yaml`, and installed package. `.dsh-curated-artifact.json` remains available only for standalone artifact roots without `dsh.profile` and cannot override managed state.
- Rootless `verify-lock` is documented as metadata-only with `observed:false`. Rootless preflight and smoke examples now expect their required-root failures, while positive observed examples require an absolute installed profile root.
- `compare-benchmark` is documented as returning a decision, reasons, and immutable digest-verified snapshots. Snapshot restoration remains an external rollout-operator action.
- Config-only patch completeness is documented as operator review against an official `--dump-config` baseline because preflight has no automated official-dump comparison.
- LoongSuite uses `captureContent:false`; `otelCaptureBody:false` remains the permission-policy seed and generic `captureBody:true` rejection applies only to config that actually uses that field.
- The planning matrix now records 20 test files for `dsh-permission-rules` and 58 tests with 8 CI workflows for `upstream-radar`. Deep-research security suggestions remain unregistered research items; no candidate was added.
- The English/Chinese pairs for `packages/curated/README`, `curated-bench/README`, `curated-scripts/README`, and the curated governance Agent Note were updated together. No code or test changed because existing tests already pin the corrected composition, provenance precedence, smoke non-import behavior, and comparison output.

### Pair records

- `packages/curated/README`: English `fd84c899216f7f0f9e7ec8808984e5eab8bfda36`; Chinese `dedad49a1193326a4d3903484ed8d2851314fe02`.
- `packages/curated/curated-bench/README`: English `af28c4e28b3cd6aa4cf9938d66a0c8d7c5082900`; Chinese `a6dec62e5dd70820fb341fbf0d595bbebc04c7d3`.
- `packages/curated/curated-scripts/README`: English `4389d1afcfb25d7cfd095482038e8bc40a1580af`; Chinese `6f380ec708a0e0b12fcd330c6ff3c40bbb0722bc`.
- `.agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance`: English `9a6e0afda08d2cbfe3218d67a16bdc7a9eba81b8`; Chinese `07577506359342a2aca565c6b385472ae3990db9`.

### Checks

- Targeted stale-phrase assertions over all superpowers Markdown, curated README pairs, and the governance note pair: passed.
- `pnpm run verify-md-wrap` over every changed owner/planning document and this report: 2,030 Markdown files checked with no hard-wrapped prose paragraphs.
- `pnpm run verify-md-links`: 2,077 Markdown files checked; all relative links and fragments resolved.
- `pnpm run verify-translation-pairing packages/curated/README.md packages/curated/curated-bench/README.md packages/curated/curated-scripts/README.md .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md`: four named pairs consistent.
- `pnpm run verify-agent-note-format`: 605 Agent Notes checked and conforming.
- `pnpm run doc-sync`: initial run passed 28 gates in 30.42 seconds; the final rerun after terminology cleanup passed 28 gates in 34.50 seconds, with 0 failures and 0 skips in both runs.
- Scoped tracked diff, staged diff, and `docs/plugin/superpowers/` staging checks: passed; no planning document is staged.

Wave 4 status: DONE.

## Wave 4 Documentation Review Correction

### Corrected Claims

- Roadmap `smoke-profile` language now limits the command to installed manifest, bundle patch, declared main-file, and shipped DSH CLI `--dump-config`/`--help` validation. It does not claim candidate import, initialization, profile runtime startup, fault execution, or canary completion; those require separate real-runtime records.
- The E0-E5 mapping now states that `evidenceKind: observed` is an input-provider assertion. The comparator validates record structure, task/environment comparability, repetition, critical-task coverage, and thresholds, but does not prove E3/E4 producer identity. A real E3/E4 conclusion requires independently retained provenance and corresponding installation, lifecycle, user-path, or external-state artifacts.
- The checked-in search, memory, browser, MCP, fault, and canary campaigns remain pending. No signature or attestation mechanism was added.
- Git build authorization language now applies only to Git dependencies whose own manifests declare lifecycle builds. Git dependencies without declared lifecycle builds do not require `allowBuilds` on that basis.
- Equivalent wording was updated in the superpowers README, evaluation guide, local design/plan, and the bilingual curated-bench README. Approved comparison behavior remains unchanged.

### Correction Verification

- Targeted stale-phrase searches found none of the removed smoke-as-startup, direct `observed`-to-E3/E4, or blanket GitHub-prepare claims.
- `pnpm run verify-md-wrap`: 2,030 Markdown files checked.
- `pnpm run verify-md-links`: 2,077 Markdown files checked.
- `pnpm run verify-translation-pairing packages/curated/curated-bench/README.md`: one named pair consistent.
- `pnpm run doc-sync`: final rerun passed 28 gates with 0 failures and 0 skips in 29.28 seconds.

## Wave 4 Prose Finalization

The benchmark API and package README now describe `evidenceKind` as caller-declared data checked for valid structure and run comparability. They explicitly state that `compare-benchmark` does not authenticate producer identity; installed-artifact provenance remains a separate mechanism.

The final task and checklist wording clarifies that records declared `planned` or `fixture` cannot be accepted. Producer identity and `evidenceKind` authenticity are not cryptographically authenticated and remain an operator trust responsibility; the comparator does not claim to prevent malicious relabeling.

- `pnpm run verify-export-jsdoc`: exit 0.
- `pnpm --dir packages/curated/curated-scripts run typecheck`: exit 0.
- `pnpm exec oxlint packages/curated/curated-scripts/src/index.ts`: exit 0; 0 warnings and 0 errors.
- `pnpm run verify-translation-pairing --write packages/curated/curated-scripts/README.md`: exit 0; pair manifest re-recorded.
- `pnpm run verify-translation-pairing packages/curated/curated-scripts/README.md`: exit 0; 1 named pair consistent.
- `pnpm run doc-sync`: exit 0; 28 passed, 0 failed, 0 skipped.
- `git diff --check -- packages/curated/curated-scripts/src/index.ts packages/curated/curated-scripts/README.md packages/curated/curated-scripts/README.zh.md packages/curated/curated-scripts/README.i18n.yaml .trae/specs/integrate-curated-plugin-layer/task-18-report.md`: exit 0.

Task 19.5 states that records declared `planned` or `fixture` remain pending/unverified and cannot be accepted, while `evidenceKind` authenticity remains the operator's responsibility.

## Final Review Finding: Requested Curated Profile Authority

### Final Finding Diagnosis

- Hypothesis A was confirmed: observed template validation depended on `package.json.name === dsh-profile-${profile}`, so a missing or renamed caller-controlled name bypassed the selected curated template.
- Hypothesis B was confirmed: observed preflight disabled governed-capability enforcement. An unknown partial bundle could therefore return `observed:true` and `accepted:true`.
- Requested curated profile names are now authoritative. Their observed bundle lists must exactly match `CURATED_PROFILE_TEMPLATES`, independent of manifest name.
- Governed-capability enforcement now applies to fixture input and requested curated profiles. Catalog-authorized owner IDs remain accepted so valid full materialized profiles do not require conflict rows for unique approved capabilities.
- Synthetic acceptance fixtures now request `custom-curated`. Rejection-only partial curated fixtures retain their original diagnostics and also assert template mismatch.

### Final Finding RED

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'requested curated profile is partial' --testTimeout=10000
```

Result: exit 1; both missing-name and renamed-name cases returned status 0 instead of 1.

### Final Finding Verification

- Focused curated, fixture, non-curated, and full materialized profile paths: 6 passed.
- Full commands and profiles: 209 passed.
- Changed-source coverage: 180 passed; `packages/curated/curated-scripts/src/index.ts` reached 100% statements, branches, functions, and lines.
- Repository typecheck: exit 0.
- Repository lint: exit 0; 0 warnings and 0 errors across 2,647 files. The first lint run found two new unsafe asymmetric-matcher assignments in the updated tests; typed payload assertions corrected them before the clean rerun.
- No owner documentation changed; the existing documentation already requires observed profile composition validation, so `doc-sync` was not applicable.

## Final Provenance Review Finding: pnpm GitHub Codeload Locks

### Root Cause

- Hypothesis A was confirmed: `readPnpmGitResolution()` parsed every importer `version` as a direct `git+` locator and required package records to carry `resolution.type`, `repo`, and `commit`.
- Hypothesis B was rejected: repository and path normalization did not cause the failure because pnpm's GitHub-hosted entry was rejected before those comparisons.
- The shared reader now accepts either the existing exact direct-Git form or pnpm 11.7's exact GitHub codeload form. Codeload entries must use `https://codeload.github.com/<owner>/<repository>/tar.gz/<40-character-commit>[#path:<subdirectory>]`, match the exact manifest repository, commit, and path, resolve through the peer-suffix-free package key, carry `gitHosted:true`, and repeat the exact tarball and path in the package record.

### Captured pnpm 11.7 Evidence

Both captures used `--lockfile-only --ignore-scripts`; pnpm reported that required builds were ignored, and no third-party lifecycle script executed.

```sh
perl -e 'alarm 50; exec @ARGV' env HOME=/tmp/dsh-task18-codeload-proof/home NPM_CONFIG_USERCONFIG=/dev/null corepack pnpm@11.7.0 install --lockfile-only --ignore-scripts --reporter=append-only --store-dir /tmp/dsh-task18-codeload-proof/store
```

Result: exit 0 in 6.8 seconds. The root-package importer retained the exact `git+https://github.com/anweat/dsh-web-search-pro.git#4274ab148d926060a4e5e1399ac9e87894ed1a83` specifier but recorded `version: https://codeload.github.com/anweat/dsh-web-search-pro/tar.gz/4274ab148d926060a4e5e1399ac9e87894ed1a83`. Its package record used the same codeload locator and `resolution: {gitHosted: true, integrity: ..., tarball: <same codeload URL>}`.

```sh
perl -e 'alarm 50; exec @ARGV' env HOME=/tmp/dsh-task18-codeload-subpath/home NPM_CONFIG_USERCONFIG=/dev/null corepack pnpm@11.7.0 install --lockfile-only --ignore-scripts --reporter=append-only --store-dir /tmp/dsh-task18-codeload-subpath/store
```

Result: exit 0 in 11.6 seconds. The subpackage importer recorded the codeload URL plus `#path:packages/plugins/plugin-session-export` and a peer suffix. The `packages` key omitted that peer suffix, while its resolution retained `gitHosted:true`, the bare codeload tarball, and `path: packages/plugins/plugin-session-export`.

### RED/GREEN

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'accepts only exact pnpm 11.7 GitHub codeload provenance across curated commands' --testTimeout=10000
```

RED result: exit 1; 1 failed and 180 skipped. The valid captured codeload form failed with `plugin-a pnpm dependency version must use a full Git commit SHA`.

GREEN result for the same command: exit 0; 1 passed and 180 skipped. The regression covers successful verify-lock, observed preflight, and observed smoke, then requires all three to reject a wrong or missing commit, wrong or missing package path, wrong host, missing `gitHosted` marker, and package-record tarball mismatch.

### Provenance Finding Verification

- Full commands and profiles: 210 tests passed.
- Changed-source coverage: 181 tests passed; `packages/curated/curated-scripts/src/index.ts` reached 100% statements, branches, functions, and lines.
- Repository typecheck: exit 0.
- Scoped lint: exit 0 with 0 warnings and 0 errors across the changed source and test.
- Repository lint: exit 0 with 0 warnings and 0 errors across 2,647 files.
- Markdown wrapping: 2,030 files checked with no hard-wrapped prose paragraphs.
- Tracked, staged, and untracked report diff checks: exit 0.

## Release Closure Correction

### Root Cause and Corrected Assumption

- Hypothesis A was confirmed: the earlier Task 18 correction treated `packages/curated/*` as a private package class, excluded it from `DshFamily`, and changed all five manifests from the repository's public release-member convention to `private:true`.
- Hypothesis B was rejected: the CLI dependencies were not accidental and the curated packages were not intended to be bundled into the CLI. `@deepseek-ai/dsh` resolves `curated-base` and `curated-profiles` as packages, those packages require `curated-policy` and `curated-bench`, and `curated-scripts` exposes user-facing commands.
- The earlier assumption that a new package should be private was copied from stale package-creation wording and applied without checking the release family. The corrected convention is that every non-experimental DSH package is a public release member with `publishConfig.access: "public"`; only `packages/experimental/*` remains private and excluded.

### RED

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run scripts/release/families.spec.ts -t 'includes the publishable curated dependency closure' --testTimeout=10000
```

Result: exit 1; the real DSH family returned zero `packages/curated/*` members instead of all five.

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'keeps every curated package publicly publishable' --testTimeout=10000
```

Result: exit 1; `curated-base` still had `private:true` and no public publication metadata.

### Release Closure GREEN

The DSH family now includes all five curated packages. Its resolved order places policy and benchmark assets before `curated-base`, policy before `curated-profiles`, both CLI dependencies before `@deepseek-ai/dsh`, and `curated-scripts` after `dsh` and its other runtime dependencies. The manifest regression also pins the root and invariant exports, bundle patch, benchmark snapshot and JSON assets, policy YAML files, and all four command entries and wrappers.

- Focused release-family regression: 1 passed.
- Focused curated publication and payload regression: 1 passed.
- Workspace constraints: exit 0.
- Package-level `publint` first reported that all five `./src/*` exports pointed at source files excluded from their tarballs. A new assertion reproduced the defect; removing those five dangling exports made all five package-level `publint` runs pass with `All good!`.
- Full release-family and workspace-constraint tests: 33 passed.
- Full curated profile tests: 29 passed.
- Final combined release, constraint, and curated-profile run: 62 passed.
- Curated packed command-entry e2e: 1 passed.
- All five curated package typechecks: exit 0.
- `release:verify --family dsh`: exit 0 with 234 members; curated positions were bench 142, policy 143, base 144, profiles 145, `dsh` 194, and scripts 206.
- Official build: exit 0.
- The bounded full release pack emitted its final 234-tarball summary but the outer 50-second alarm returned 142. Independent inspection found 234 tarballs and 234 publish-order entries; all five curated tarballs contained their declared runtime, declaration, command, bundle, policy, and benchmark payloads.
- Vendor pack: 9 tarballs, exit 0. Landlock entry build and pack: exit 0.
- Independent packed-closure verification parsed all 234 DSH tarball manifests, found every installed DSH dependency in the packed set, and confirmed all five curated manifests are public without dangling source exports.
- The 244-tarball external install did not complete within the required command-duration bound and was stopped. The package-local packed-entry e2e and actual tarball inspection passed, but the complete clean-install probe is not claimed as passing.
- `verify-built-package-invariants`: 234 compiled companions passed.
- `verify-node-next-types`: 243 workspace package declaration APIs passed.
- `hygiene`: 14 passed after adding the curated-scripts e2e and dynamic `@deepseek-ai/dsh` resolution to its Knip workspace configuration.
- Repository lint: 0 warnings and 0 errors across 2,647 files.
- `doc-sync`: 28 passed, 0 failed, 0 skipped.
- Unstaged and staged `git diff --check`: exit 0; no `.trae/specs/` or `docs/plugin/superpowers/` path is staged.

## Release Policy Documentation Reconciliation

### Current State

- `DshFamily.patterns` selects every non-experimental `packages/*/*/package.json` plus `apps/*/package.json`.
- Runtime discovery returned 234 DSH release members: five curated packages, two app packages, and 227 other non-experimental packages.
- All 234 DSH manifests, all nine vendored manifests, and all three native release manifests declare `publishConfig.access: "public"`. `apps/cli/package.json` therefore proves that `@deepseek-ai/dsh` is public rather than restricted.
- The 246 current release members are publicly installable as a complete dependency closure. Experimental packages remain private and outside the DSH release family.

### Changes

- Updated both languages of `2026-08-10-npm-release-sequences` to name the 234-member non-experimental DSH family, include all five curated packages, describe manifest-owned public access, remove obsolete private-registry consequences, and match the current tag-only vendor bump behavior.
- Updated both languages of `2026-08-13-public-vendor-and-native-sequences` to make package manifests the access authority, record all three current public release sequences, explain why a restricted dependency breaks anonymous installation, and preserve the alternatives and irreversible-publication rationale.
- Updated both languages of `2026-08-06-in-repository-landlock-release` because its direct link to the access decision still claimed that DSH remained restricted.
- Updated the adjacent `scripts/check-workspace-constraints.ts` rationale comment to match the public-access rule it enforces.
- Re-recorded all three touched bilingual sidecars. `docs/architecture.*` and `packages/curated/README*` already matched the current release family and required no edit.
- Kept all three implemented Agent Notes active: their release ordering, dependency-closure rationale, alternatives, and access consequences retain future decision value. No note was archived, rejected, or deleted; no classification was borderline.

### Release Policy Checks

- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-translation-pairing --write .agents/notes/implemented/process/2026-08-06-in-repository-landlock-release.md .agents/notes/implemented/process/2026-08-10-npm-release-sequences.md .agents/notes/implemented/process/2026-08-13-public-vendor-and-native-sequences.md`: exit 0; three sidecars recorded, followed by a no-op confirmation after the final text.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-translation-pairing .agents/notes/implemented/process/2026-08-06-in-repository-landlock-release.md .agents/notes/implemented/process/2026-08-10-npm-release-sequences.md .agents/notes/implemented/process/2026-08-13-public-vendor-and-native-sequences.md`: exit 0; three named pairs consistent.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-agent-note-format`: exit 0; 605 Agent Notes conform.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-agent-note-classification`: exit 0; 605 Agent Notes have consistent structure.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run scripts/release/families.spec.ts scripts/check-workspace-constraints.spec.ts --testTimeout=10000`: exit 0; 33 tests passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm run constraints`: exit 0.
- `perl -e 'alarm 50; exec @ARGV' pnpm run doc-sync`: exit 0; 28 passed, 0 failed, 0 skipped in 32.54 seconds.
- `perl -e 'alarm 50; exec @ARGV' pnpm run lint`: exit 0; build completed and oxlint found 0 warnings and 0 errors across 2,647 files.
- `git diff --check`: exit 0.
- `git diff --cached --check`: exit 0.
- `git diff --no-index --check /dev/null .trae/specs/integrate-curated-plugin-layer/task-18-report.md`: exit 1 with no diagnostics, the expected status for a clean untracked-file diff.
- An initial scoped pairing check used an unsupported `--` separator and exited 2 before checking files; the corrected command above passed.

## Remaining Release Policy Prose Reconciliation

### Changes and Scope

- Updated root `AGENTS.md` to state the enforced split: publishable dsh packages declare public `publishConfig`, experimental/private packages remain private, vendored packages are rescoped and follow their publication policy, and every harness package retains the Cordis peer/dev dependency rule.
- Updated both languages of `2026-06-16-pnpm-over-yarn` so its migration context no longer claims that every package remains private and its constraints description covers the current `vendor`, `packages`, `native`, and `apps` scope.
- Updated both languages of `2026-08-06-in-repository-landlock-release` so partial publication recovery uses the registry-aware idempotent release script: absent versions publish, matching-integrity versions skip, differing content fails, and a transient write failure triggers a registry reread before retry.
- Re-recorded both changed Agent Note sidecars.
- Inspected the directly related active `npm-release-sequences`, `public-vendor-and-native-sequences`, and `experimental-package-name-prefix` notes. Their public release-member, private experimental-package, and registry-aware retry statements already match the implementation, so they required no edit.
- Kept both edited implemented Agent Notes active because their package-manager and release rationale still guide future changes. No Agent Note was archived, rejected, deleted, or reclassified.
- The known stale release-policy wording in `vendor/README.md` remains untouched. Repository prose policy excludes `vendor/**`; this text is upstream/local-modification documentation and is out of scope for this reconciliation.

### Remaining Policy Checks

- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-translation-pairing --write .agents/notes/implemented/process/2026-06-16-pnpm-over-yarn.md .agents/notes/implemented/process/2026-08-06-in-repository-landlock-release.md`: exit 0; two sidecars recorded.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-translation-pairing .agents/notes/implemented/process/2026-06-16-pnpm-over-yarn.md .agents/notes/implemented/process/2026-08-06-in-repository-landlock-release.md`: exit 0; two named pairs consistent.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-agent-note-format`: exit 0; 605 Agent Notes conform.
- `perl -e 'alarm 50; exec @ARGV' pnpm run verify-agent-note-classification`: exit 0; 605 Agent Notes have consistent structure.
- `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run scripts/release/families.spec.ts scripts/check-workspace-constraints.spec.ts --testTimeout=10000`: exit 0; 33 tests passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm run constraints`: exit 0.
- The first bounded `pnpm run doc-sync` run reported only `AGENTS.md` at 1,952 words against its 1,950-word ceiling. Condensing the new policy sentence preserved every required clause; `pnpm run verify-doc-budgets` then passed.
- `perl -e 'alarm 50; exec @ARGV' pnpm run doc-sync`: exit 0; 28 passed, 0 failed, 0 skipped.
- `perl -e 'alarm 50; exec @ARGV' pnpm run lint`: exit 0; build completed and oxlint found 0 warnings and 0 errors across 2,647 files.
- `git diff --check`: exit 0.
- `git diff --cached --check`: exit 0.
- `git diff --no-index --check /dev/null .trae/specs/integrate-curated-plugin-layer/task-18-report.md`: exit 1 with no diagnostics, the expected status for a clean untracked-file diff.
- `git diff --name-only HEAD -- vendor`: no output; no vendored file changed.

## Scoped Managed-Profile and Enterprise-Patch Closure

### Duplicate-entry root cause

- Managed-profile hypothesis A was confirmed: `runVerifyLock()` selected the installed resolver when any root contained `dsh.profile`, but still passed the complete catalog to artifact validation. Valid `web-enterprise` and `web-personal` roots therefore inherited unrelated active-candidate requirements.
- Managed-profile hypothesis B was also confirmed as a required invariant: resolver precedence already searched for a managed root before sidecar roots, so candidate scoping had to preserve that ordering instead of constructing a filtered fallback resolver.
- Enterprise-patch hypothesis A was confirmed: existing validation rejected prohibited package names, selected true-valued egress/download fields, and an unsafe LoongSuite row, but accepted absent or weaker memento rows and did not require selected candidate configuration rows.
- Enterprise-patch hypothesis B was confirmed: the generated profile patch already supplied the authoritative safe memento, permission, and LoongSuite values, so existing-file validation needed to enforce those same settings before the non-overwriting materializer returned.

`verify-lock` now derives the first managed root's profile name from `dsh-profile-<profile>`, validates requested catalog bundles against active profile assignment, requires every active assigned candidate to be requested, and validates artifacts only for that exact candidate set. The existing resolver remains authoritative for the managed root and never consults package sidecars or later roots after a managed failure.

Existing `web-enterprise` patches now require selected configured candidates to retain their generated safety rows. Memento requires `writePolicy: ask`, an empty `writePolicies`, and `proposals.enabled: false`; LoongSuite requires `captureContent: false`; a selected permission candidate requires `badFilePolicy: fail` and `enforce: true`. Explicit body-egress, browser-download, content-capture, import-mode, and session-write controls accept only their fail-closed values. Rejection occurs before any write, and all four owned files remain byte-identical.

### RED evidence

```sh
perl -e 'alarm 52; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'active candidates assigned to each managed profile|missing required managed-profile candidate' --testTimeout=45000
```

Result: exit 1; 2 failed and 181 skipped. The valid `web-enterprise` fixture reported five unrelated `artifact-unreachable` issues for web search, MCP, LSP, permission, and smooth-stream candidates. The missing enterprise memento case also demonstrated that the managed root failed before the later sidecar could be used.

```sh
perl -e 'alarm 52; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'missing or weaker enterprise safety settings|permission settings if enterprise' --testTimeout=45000
```

Result: exit 1; 2 failed and 29 skipped. Materialization returned normally after the memento row was removed and after a selected permission row was removed.

### GREEN evidence

- The identical managed-profile focused command exited 0 with 2 passed and 181 skipped. The five generated profile paths passed with only their own installed roots; the missing memento case failed closed before the later sidecar root.
- The identical enterprise-patch focused command exited 0 with 2 passed and 29 skipped. The expanded matrix rejects missing and weaker memento, LoongSuite, permission, body-egress, import-mode, and session-write settings while preserving every owned file byte-for-byte.
- Additional malformed/inconsistent managed-profile branches passed 3 focused tests, including invalid names and bundle lists, inactive or unassigned requests, and an assigned candidate omitted from the profile.

### Final verification

- Commands and profiles with changed-source coverage: `perl -e 'alarm 52; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-profiles/tests/profiles.spec.ts --coverage --coverage.include=packages/curated/curated-scripts/src/index.ts --coverage.include=packages/curated/curated-profiles/src/index.ts --testTimeout=45000` exited 0 with 215 tests passed and 100% statements, branches, functions, and lines in both changed source files.
- Repository typecheck: `perl -e 'alarm 52; exec @ARGV' pnpm run typecheck` exited 0. An earlier run correctly rejected a test-only `config: undefined` mutation under `exactOptionalPropertyTypes`; deleting the property structurally fixed the test input before the clean rerun.
- Repository lint: `perl -e 'alarm 52; exec @ARGV' pnpm run lint` exited 0 with 0 warnings and 0 errors across 2,647 files.
- The first full commands run exposed one stale assertion that curated workspace packages were private. Current manifests and release-family evidence require public packages, so the assertion now checks public publication metadata; the final combined run includes that correction.
- No bilingual owner document changed. Translation regeneration and `doc-sync` are not applicable to this scoped source, test, and Task 18 evidence update.
- Markdown wrapping: `perl -e 'alarm 50; exec @ARGV' pnpm run verify-md-wrap .trae/specs/integrate-curated-plugin-layer/task-18-report.md` exited 0 with 2,030 files checked and no hard-wrapped prose paragraphs.
- Scoped tracked and staged `git diff --check` commands exited 0. The untracked report check returned the expected `git diff --no-index` status 1 with no diagnostics.
- Final self-review found no unresolved correctness, simplicity, architecture, security, or performance issue in the scoped changes.

## Remaining Enterprise Row-Identity Finding

### Row-Identity Root Cause

- Hypothesis A was confirmed: `hasSafeEnterpriseConfigEntry()` recursively searched every descendant object, so a safe-looking memento or LoongSuite object nested under an unrelated Cordis row satisfied the requirement.
- Hypothesis B was confirmed: raw patch rows were inspected without Cordis composition, so the validator did not apply the Loader rule that a target row with a mismatched `name` is skipped.
- Hypothesis C was confirmed: required enterprise config carried only the catalog entry ID even though the selected catalog row also supplies the expected package name.

Enterprise patch validation now parses with `loadOverlayPatches()`, seeds the selected catalog entry IDs and package names, and composes the profile patch with `composeEntries()`. Only effective rows with the expected ID, plugin name, and safe config satisfy memento, LoongSuite, or selected permission requirements. Ordinary ID-targeted overrides that omit `name` retain Cordis semantics and remain accepted.

### Row-Identity RED/GREEN

```sh
pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'rejects enterprise safety config nested under unrelated or name-mismatched rows' --testTimeout=10000
```

RED result: exit 1; the validator returned normally for safe memento config nested under an unrelated row. The regression table also covers name-mismatched memento and nested or name-mismatched LoongSuite rows, and snapshots all four owned files before each rejection.

GREEN result for the identical command: exit 0; 1 passed and 31 skipped. All four spoof variants reject with `web-enterprise existing patch violates curated policy`, and `package.json`, `cordis.patch.yml`, `pnpm-workspace.yaml`, and `.npmrc` remain byte-identical.

### Row-Identity Verification

- Full profile tests: `pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts --testTimeout=10000` exited 0 with 32 tests passed.
- Profile source coverage: `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts --coverage --coverage.include='packages/curated/curated-profiles/src/**/*.ts' --testTimeout=45000` exited 0 with 32 tests passed and 100% statements, branches, functions, and lines for `index.ts` and `invariant.ts`.
- Package typecheck: `perl -e 'alarm 50; exec @ARGV' pnpm --dir packages/curated/curated-profiles run typecheck` exited 0.
- Scoped lint: `perl -e 'alarm 50; exec @ARGV' pnpm exec oxlint packages/curated/curated-profiles/src/index.ts packages/curated/curated-profiles/tests/profiles.spec.ts` exited 0 with 0 warnings and 0 errors.
- Translation pairing: `perl -e 'alarm 50; exec @ARGV' pnpm run verify-translation-pairing packages/curated/curated-profiles/README.md` exited 0 with the named pair consistent.
- Documentation gates: `perl -e 'alarm 50; exec @ARGV' pnpm run doc-sync` exited 0 with 28 passed, 0 failed, and 0 skipped.
- Repository typecheck: `perl -e 'alarm 50; exec @ARGV' pnpm run typecheck` exited 0.
- Repository lint: `perl -e 'alarm 50; exec @ARGV' pnpm run lint` exited 0 with 0 warnings and 0 errors across 2,647 files.
- Final self-review found no unresolved correctness, simplicity, architecture, security, or performance issue in the scoped change. Final report-format and diff checks follow this report update.

## Enterprise Duplicate-Entry Closure

### Ownership and entry-ID root cause

- Hypothesis A was confirmed: the composed-row check used existential matching, so one safe canonical row allowed another effective row for the same governed plugin under a different ID.
- Hypothesis B was rejected: Cordis composition did not discard the duplicate. `composeEntries()` retained both inserted rows, but validation did not group them by effective plugin `name`.
- Enterprise validation now seeds every selected active candidate's catalog-declared Cordis rows, composes the existing patch with the shared app-boot utility, flattens effective group entries, and requires each governed package name to resolve to exactly its declared entry IDs. Configured memento, LoongSuite, and selected permission rows then pass the existing safety checks.
- Ordinary single ID-targeted overrides still patch the seeded row and remain valid. Every rejection occurs before materialization writes, and the tests compare all four owned files byte-for-byte.

### Duplicate-entry RED/GREEN

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'rejects additional effective rows for governed enterprise plugins before changing bytes' --testTimeout=10000
```

RED result: exit 1 with four expected assertion failures. A safe canonical row masked an unsafe mis-ID `dsh-memento` row, a safe mis-ID LoongSuite row, a duplicate `dsh-checkpoint-rewind` row, and an additional selected permission row.

GREEN result for the same focused test: exit 0 with 1 passed and 32 skipped. The final matrix also covers a governed row nested in an effective Cordis group.

### Duplicate-entry verification

- Full profiles tests: 33 passed.
- Curated-profiles coverage: 33 passed with 100% statements, branches, functions, and lines for `src/index.ts` and `src/invariant.ts`.
- Curated-profiles package typecheck: exit 0.
- Repository typecheck: exit 0.
- Scoped lint: 0 warnings and 0 errors across the source and test files.
- Repository lint: 0 warnings and 0 errors across 2,647 files.
- Translation pairing: the curated-profiles README pair is consistent.
- Documentation: `doc-sync` passed all 28 gates.
- Self-review found no unresolved correctness, simplicity, architecture, security, or performance issue. Final report and diff checks follow this append.
- Post-append focused regression and safe-override verification: 2 passed and 31 skipped.
- Report wrapping: 2,030 Markdown files checked with no hard-wrapped prose paragraphs.
- Tracked and staged `git diff --check` commands exited 0. The untracked report check returned the expected `git diff --no-index` status 1 with no diagnostics.

## Final Ownership and Bundle Entry-ID Closure

### Bundle ownership and entry-ID root cause

- Observed ownership used an ordinary `__dshCuratedClaimOwner` field copied by Cordis composition. A later ID-only patch could replace that field without replacing the entry config, while assigning every patched claim to the later layer also lost the owner of the row that the patch targeted.
- Installed artifact validation checked the declared patch path and candidate-specific permission settings but did not compare the candidate bundle's effective inserted rows with catalog `resources.entryIds`.

Observed composition now removes every caller-supplied ownership marker recursively, adds internal source tokens only to rows inserted by each resolved layer, composes with Cordis, transfers the resolved owners into a `WeakMap`, and removes the temporary tokens before validation. ID-only overrides retain the source owner of the inserted row. Profile inserts receive the profile layer's non-catalog owner, so marker fields in either operation cannot impersonate a catalog candidate.

Each resolved catalog artifact now composes its own bundle patch over an empty entry list, recursively collects effective row IDs, and compares them exactly with `resources.entryIds`. The comparison sorts the case-sensitive lists only; it does not trim or deduplicate them. Extra, missing, substituted, duplicate, and idless rows fail with `artifact-entry-ids-mismatch`. Profile patches remain outside this candidate-local comparison, so an ID-targeted profile override is valid.

### Ownership and entry-ID RED evidence

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'does not let an ID-only profile override forge|does not let a profile insert forge|effective bundle entry IDs|allows a profile patch to override' --testTimeout=10000
```

Result: exit 1; five tests failed and one passed. Both ownership spoof cases demonstrated incorrect ownership, and extra, missing, and substituted bundle IDs were accepted. The legitimate profile override already passed.

### Ownership and entry-ID verification

- Focused ownership and entry-ID GREEN: 8 passed.
- Full commands and profiles: 225 passed.
- Changed-source coverage: 225 passed; `packages/curated/curated-scripts/src/index.ts` reached 100% statements, branches, functions, and lines.
- Repository typecheck: exit 0.
- Repository lint: exit 0 with 0 warnings and 0 errors across 2,647 files.
- Documentation: the curated-scripts README pair records ownership and exact ID behavior; translation pairing passed and `doc-sync` passed all 28 gates.
- No browser or transcript snapshot applies because the change affects offline validation only.

## Nested Cordis Entry Closure

### Nested-entry root cause

- Hypothesis A was rejected: `entryListSchema` preserves nested group arrays, and Cordis patching recursively indexes children under any truthy `group`.
- Hypothesis B was confirmed: observed ownership and preflight validation traversed only top-level effective rows, while ownership tokens and candidate-local entry-ID validation descended only through `group === true`. The ID walk also filtered non-record children before comparison.

Observed source tokens now cover inserted entries, their config-array records, and child lists supplied by group-config overrides. Ownership capture, duplicate-ID checks, capability/resource conflict checks, baseline checks, and secret checks recursively inspect effective entries under every truthy group. ID-only overrides retain the inserted row's owner, replacement child lists belong to the overriding layer, a later override may activate a predeclared group without losing child ownership, and temporary tokens are removed before validation.

Candidate-local entry-ID validation uses the same Cordis truthiness and retains every nested value in its count. Non-record children, records without non-empty IDs, and non-array defined group configs therefore fail `artifact-entry-ids-mismatch` instead of disappearing from comparison. Hidden extra, missing, and substituted nested IDs reject, while a legal nested group and profile replacement of its child list remain accepted.

### Nested-entry RED/GREEN

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'truthy installed Cordis group|allows a profile patch to override a catalog-declared bundle entry ID|inspects nested truthy groups' --testTimeout=10000
```

RED result: exit 1; 5 failed, 2 passed, and 191 skipped. Hidden extra, non-record, and malformed nested children were accepted; the legal truthy-group override failed because its child ID was invisible; nested provider/resource conflicts were absent and the nested secret was attributed only to its parent group.

GREEN result for the identical command: exit 0; 7 passed and 191 skipped. The real observed-profile cases compose installed bundle patches and a profile group-config replacement through the shared Cordis patch implementation.

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'allows a profile override to activate a predeclared nested group' --testTimeout=10000
```

Self-review RED result: exit 1; 1 failed and 198 skipped because the newly effective child had no source owner. GREEN result: exit 0; 1 passed and 198 skipped after inserted config-array records retained source tokens for any later group activation. The combined nested command then passed 8 tests with 191 skipped.

### Nested-entry verification

- Full command suite and curated-scripts source coverage: 199 tests passed with 100% statements, branches, functions, and lines for `src/index.ts`.
- Curated-scripts package typecheck: exit 0.
- Repository typecheck: exit 0.
- Scoped lint: 0 warnings and 0 errors across the changed source and test files.
- Repository lint: 0 warnings and 0 errors across 2,647 files.
- The curated-scripts README and governance Agent Note pairs describe recursive truthy-group behavior; both bilingual pair records are consistent, and all 605 Agent Notes pass format validation.
- No browser or transcript snapshot applies because these are offline installed-profile checks. Final documentation and diff checks follow this report append.

## Final Installed Artifact Entry-Shape Closure

### Entry-shape root cause

- Hypothesis A was rejected: retaining malformed values in the ID count detects idless and non-record rows, but a row with the expected ID and an absent, empty, or non-string plugin name still passes the comparison.
- Hypothesis B was confirmed: bundle patches were parsed with the Loader's `entryListSchema` and composed through Cordis, but artifact validation compared IDs without first requiring every effective top-level and nested row to contain complete Loader identity fields or requiring a truthy group to contain an entry list.

Candidate-local validation now parses the bundle patch with `entryListSchema`, composes the patch through the shared Cordis implementation, and recursively validates the effective rows before reading any IDs. Missing, empty, or non-string `id` and `name` fields, non-record children, and truthy groups without array `config` return `artifact-entry-invalid`. Only complete rows reach the existing exact, case-sensitive ID comparison. Valid disabled entries, truthy groups, same-layer ID-only overrides, profile child-list replacements, and later group activation remain accepted.

### Entry-shape RED/GREEN

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'before comparing effective bundle entry IDs|accepts complete disabled, grouped, and overridden effective bundle entries' --testTimeout=10000
```

RED result: exit 1; six malformed-entry cases failed because preflight returned status 0, while the valid disabled/group/override case passed.

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'effective bundle entry IDs|before comparing effective bundle entry IDs|truthy installed Cordis group|accepts complete disabled, grouped, and overridden effective bundle entries|allows a profile patch to override a catalog-declared bundle entry ID|allows a profile override to activate a predeclared nested group' --testTimeout=10000
```

GREEN result: exit 0; 19 passed and 187 skipped. Shape failures precede ID mismatches, valid empty groups still exercise missing-ID comparison, and valid disabled/group/override forms remain accepted.

### Final entry-shape verification

- Full command tests: `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --testTimeout=10000` exited 0 with 206 tests passed.
- Curated-scripts coverage: `perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts --coverage --coverage.include='packages/curated/curated-scripts/src/index.ts' --testTimeout=45000` exited 0 with 206 tests passed and 100% statements, branches, functions, and lines.
- Installed-resolver Loader composition: the focused `loads and disposes an observable fixture service through the installed resolver` test passed.
- Curated profile composition: the focused `loads actual curated services and a behavior fixture through the profile resolver` test passed.
- Repository typecheck: `perl -e 'alarm 50; exec @ARGV' pnpm run typecheck` exited 0.
- Repository lint: `perl -e 'alarm 50; exec @ARGV' pnpm run lint` exited 0 with 0 warnings and 0 errors across 2,647 files.
- Documentation: both updated bilingual pairs are consistent, and `perl -e 'alarm 50; exec @ARGV' pnpm run doc-sync` passed all 28 gates.
- No browser or transcript snapshot applies because the change affects offline installed-artifact validation only.
- Report wrapping: `perl -e 'alarm 50; exec @ARGV' pnpm run verify-md-wrap .trae/specs/integrate-curated-plugin-layer/task-18-report.md` exited 0 with 2,030 files checked and no hard-wrapped prose paragraphs.
- Tracked and staged `git diff --check` commands exited 0. The untracked report check returned the expected `git diff --no-index` status 1 with no diagnostics.
- `git diff --name-only HEAD -- vendor` produced no output; no vendored file changed.
- Final scoped self-review found no unresolved correctness, simplicity, architecture, security, or performance issue.

## Final Installed Permission Composition Closure

### Permission Composition Root Cause

- Hypothesis A was confirmed: installed artifact entry-ID validation used `composeEntries()`, but permission safety validation separately read `flattenPatchEntries(patchLayer)`. The latter is the raw patch operation stream, not the entries the Loader executes.
- Hypothesis B was rejected: `entryListSchema` preserves the relevant rows, and Cordis `applyEntryPatches()` correctly skips an ID-targeted override whose supplied `name` differs from the effective target.
- A safe name-mismatched no-op could therefore become the only raw row matching the package-name filter and mask an unsafe effective `permission-rules` row. Raw flattening also hid nested effective permission rows.

Installed artifact inspection now composes each parsed bundle patch once with the shared app-boot `composeEntries()` utility. Entry identity validation and permission safety validation consume the same recursively flattened effective entries. The permission row is selected by the catalog-governed `permission-rules` entry ID; its Loader `name` remains free to use a package name or relative module specifier. Multiple effective permission rows remain malformed.

### Permission Composition RED/GREEN

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'validates permission safety from Loader-composed' --testTimeout=10000
```

RED result: exit 1; the name-mismatched safe override was accepted with status 0, and the nested unsafe row produced only `artifact-permission-config-missing`. The duplicate effective-row case already returned `artifact-permission-config-malformed`.

GREEN result for the identical command: exit 0; all three cases passed. The no-op and nested cases report both `artifact-permission-bad-file-policy` and `artifact-permission-enforcement-disabled`, while duplicate effective rows remain malformed.

### Permission Composition Verification

- Full command tests and coverage: 209 tests passed; `packages/curated/curated-scripts/src/index.ts` reached 100% statements, branches, functions, and lines.
- Installed-resolver Loader composition: `loads and disposes an observable fixture service through the installed resolver` passed.
- Curated profile composition: `loads actual curated services and a behavior fixture through the profile resolver` passed.
- Curated-scripts package typecheck: exit 0.
- Repository typecheck: exit 0.
- Scoped lint: 0 warnings and 0 errors across the changed source and test.
- Repository lint: 0 warnings and 0 errors across 2,647 files.
- Report wrapping and tracked, staged, and untracked diff checks: exit 0 with no diagnostics.

## Final Installed Permission Enablement Closure

### Enablement Root Cause

- Hypothesis A was confirmed: permission validation received a flattened effective entry list, so it could inspect the `permission-rules` config but could not retain whether an ancestor group disabled the row.
- Hypothesis B was rejected: preflight's active-entry filtering does not compensate for this gap because installed artifact validation accepts the permission candidate before runtime, and the authoritative catalog claim remains active.
- Installed permission validation now retains the Loader-composed tree and carries unconditional enablement through every truthy ancestor group. The effective `permission-rules` row and every ancestor must omit `disabled` or set it to literal `false`. `true`, `!!js` expressions, and non-boolean values return `artifact-permission-entry-disabled`; valid absent and literal-false values retain Loader semantics.

### Enablement RED/GREEN

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'installed permission enforcement|unconditionally enabled nested groups' --testTimeout=10000
```

RED result: exit 1; five unsafe cases failed because verify-lock returned status 0. The cases covered `disabled: true`, a row-level `!!js` expression, a non-boolean row value, a disabled inner ancestor under an enabled outer group, and a conditional ancestor group. The nested literal-false/absent case passed.

GREEN result with the adjacent Loader-composed permission cases included: exit 0; 9 passed and 206 skipped. The five unsafe cases report `artifact-permission-entry-disabled`; nested groups with literal `false` or absent `disabled` remain accepted.

### Enablement Verification

- Full curated-scripts command suite: 215 tests passed.
- Curated-scripts coverage: 215 tests passed; `src/index.ts` reached 100% statements, branches, functions, and lines.
- Installed-resolver Loader composition: `loads and disposes an observable fixture service through the installed resolver` passed.
- Curated profile composition: `loads actual curated services and a behavior fixture through the profile resolver` passed.
- Repository typecheck: exit 0.
- Repository lint: exit 0 with 0 warnings and 0 errors across 2,647 files.
- The curated-scripts README pair documents unconditional permission enablement and its pairing record was updated.
- Translation pairing: the named curated-scripts README pair is consistent.
- Markdown wrapping: 2,030 files checked with no hard-wrapped prose paragraphs.
- Scoped tracked and staged diff checks exited 0. The untracked report check returned the expected `git diff --no-index` status 1 with no diagnostics.
- No browser or transcript snapshot applies because this is offline installed-artifact validation with no model-visible output.

## Profile-Level Permission Enablement Closure

### Profile enablement root cause

- Observed preflight validated the permission candidate's bundle patch before profile composition, then flattened the final profile entries without retaining ancestor enablement. A profile override could therefore disable the effective `permission-rules` row or a containing group while its safe config still passed.
- Authoritative catalog claims entered conflict validation unconditionally, so a disabled permission provider could still produce duplicate-provider findings.
- Existing enterprise validation composed its seeded candidate rows with the preserved profile patch but discarded row and ancestor enablement before checking permission config.

Observed preflight now carries unconditional enablement through the Loader-composed entry tree. A selected permission candidate requires an effective `permission-rules` provider matched by trusted bundle ownership or the expected plugin name, and that row plus every truthy ancestor group must omit `disabled` or set it to literal `false`. Missing rows return `preflight-permission-entry-missing`; `true`, conditional `!!js`, and other non-false values return `preflight-permission-entry-disabled`. A disabled permission provider contributes no authoritative active claim. Enterprise existing-profile validation applies the same ancestor-aware check before any write.

### Profile enablement RED/GREEN evidence

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'effective profile permission' --testTimeout=10000
```

Initial RED: exit 1; the disabled profile override produced only `preflight-provider-duplicate` instead of the required enablement rejection. A second RED after adding missing-row coverage returned status 0 when a profile group replacement removed the effective permission provider.

GREEN: exit 0; four focused tests passed. Row-level and ancestor `disabled:true` and conditional `!!js` overrides reject, missing effective providers reject, disabled providers do not produce duplicate authoritative claims, and absent/literal-false values plus legal unrelated and provider-preserving overrides remain accepted.

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-profiles/tests/profiles.spec.ts -t 'selected enterprise permission rows' --testTimeout=10000
```

RED: exit 1; existing enterprise materialization accepted `disabled:true` on the selected permission row. GREEN: exit 0; the focused test passed for `disabled:true`, conditional `!!js`, literal `false`, absent values, byte preservation, and an unrelated disabled row.

### Profile enablement final verification

- Full curated scripts: 219 tests passed.
- Full curated profiles: 34 tests passed.
- Real composition: `loads actual curated services and a behavior fixture through the profile resolver` passed.
- Combined changed-source coverage: 253 tests passed; both `curated-scripts/src/index.ts` and `curated-profiles/src/index.ts` reached 100% statements, branches, functions, and lines.
- Repository typecheck: exit 0.
- Repository lint: exit 0 with 0 warnings and 0 errors across 2,647 files.
- Documentation: `doc-sync` passed all 28 gates; the two owner README pairs and active governance Agent Note pair are consistent.
- Tracked and staged `git diff --check` commands exited 0. The untracked report check returned the expected `git diff --no-index` status 1 with no diagnostics.
- Final scoped self-review found no unresolved correctness, simplicity, architecture, security, or performance issue.
- No browser or transcript snapshot applies because the change affects offline profile validation only.

## Task 19.2 Registry Artifact Remediation

### Root cause and RED

A fresh isolated `web-curated` install under pnpm 11.7.0 reproduced the failure. The active Git dependency `dsh-smooth-stream@b8c5eefc1584a5a1d69116a0b038acd2abc4adb6` ran its nested `pnpm install`; that install rejected `esbuild@0.28.2` with `ERR_PNPM_IGNORED_BUILDS`, and the outer install failed with `ERR_PNPM_PREPARE_PACKAGE`. Exact profile `allowBuilds` cannot govern nested dependency builds, so expanding it would not close the execution boundary.

Two source-level RED suites then pinned the remediation. Policy/profile tests failed for missing npm provenance, active Git lifecycle builds, stale profile membership, and generated build allowances. A command test built a pnpm 11.7 registry lock with a peer suffix and failed because observed verification compared `0.1.0(peer-package@2.0.0)` directly with `0.1.0`.

### Registry audit

Read-only npm registry metadata, registry tarballs, pinned Git manifests, release tags, and GitHub comparisons produced these decisions:

| Candidate | Exact npm result | Source correspondence | Decision |
| --- | --- | --- | --- |
| `dsh-web-search-pro` | `0.1.10`, integrity `sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ==` | `v0.1.10` points to the pinned commit; compiled main, MIT license, and bundle patch are present | active |
| `dsh-mcp-panel` | `0.5.1`, integrity `sha512-CnCzRD043IP8JV2KvyaVUBVMz26uwRAUHt9+srovyycorZ6RW58EcuURcG4pr4zXJddNSt0+O7iJbNDQ1fgdsg==` | the pin is two documentation-only commits past `v0.5.1`; compiled main, Apache-2.0 license, and matching patch are present | active |
| `dsh-checkpoint-rewind` | `0.5.5`, integrity `sha512-dKUMlFfDk+K4rezHcgKMlLCBtS/ShW2A6w9ZBmPqJGeVegXxsUXrfgwNRmptqiSkRWzrP3SrbPwpiKYjDs+J5g==` | the pin is one documentation-only commit past `v0.5.5`; compiled main, Apache-2.0 license, and matching patch are present | active |
| `dsh-lsp-actions` | `0.3.4`, integrity `sha512-JUMLUxtSoFsnzn88XBeyUbFrDSNBrT7V+GnaFWozjfe4rPncFaKGKun6T8E9cyAM1W914qgIj3n5X4CMa/0+rg==` | the pin is one pull-request-template-only commit past `v0.3.4`; compiled main, Apache-2.0 license, and matching patch are present | active |
| `dsh-permission-rules` | `0.5.5`, integrity `sha512-gWGzVycnbVSxbqGCp4AicaMTpo9fejmIxICVPwLk72wAepnrrncSuHUsm5Zzdjg/kBCAnRz7KEx3StQqTbesyg==` | runtime source corresponds, but the published bundle omits `enforce: true` | rejected |
| `dsh-smooth-stream` | `0.3.4`, integrity `sha512-YiwYI6Lwu28G5wHvpLFonmuQ+d44EJrp/lzyAp8d5c0B/0Er1p9CfkQvqMadCvMgTA7+pNgT9TBIB93CmaSU0g==` | the pinned source is 13 commits past `v0.3.4` and changes runtime/client code | rejected |
| `@loongsuite/dsh-plugin` | `0.1.1`, integrity `sha512-wQmSzOzyjp0rd3XKFmcK+vXRETqVr0V7xL5qh8El2RujteV4Gkc1vz1OxTG12lQZrjKVWV5ixRRJU1HDlBafog==` | `v0.1.1` points to the pinned commit; compiled main, Apache-2.0 license, and matching patch are present | active in all four curated profiles |
| `@deepseek-ai/dsh-toolkit` | registry returned 404 | the Git source declares `prepack: npm run build:all` | rejected |
| `upstream-radar` | `0.43.5`, integrity `sha512-pcoQzCUqP/E/EOww5amODoDwP4gQVmr6Or99RgkSrjsLRDGkbwbjpKl5WEf9+ddf7iyEme5gqrthOqxKqjvEGA==` | the pinned source is 32 commits past `v0.43.5` and changes runtime code; the Git artifact lacks its compiled export | rejected |

All inspected npm tarballs contained no `preinstall`, `install`, or `postinstall` script. The accepted tarballs contained their compiled package entry and bundle patch; each checked patch was byte-identical to the corresponding pinned source patch. No third-party lifecycle script ran during the audit.

### Implementation and GREEN

The catalog records exact npm version and integrity for the five accepted prebuilt candidates. Active Git candidates with `preinstall`, `install`, `postinstall`, `prepare`, or `prepack` now fail policy validation. Profile generation emits no `allowBuilds`, and the active six-candidate baseline is shared by `web-curated`, `web-coding`, `web-research`, and `web-enterprise`; `web-personal` remains foundation-only. The pnpm registry resolver removes only the importer version's parenthesized peer suffix before exact version and integrity checks.

Fresh isolated installs used separate homes, Corepack directories, npm caches, XDG caches, pnpm homes, temporary directories, and stores under `/tmp/dsh-task19-final3.fflzh0`. Each command started with `env -i`, retained only explicit non-secret variables, used pnpm 11.7.0, and completed under the 54-second outer limit. All five installs exited 0. For each profile, observed `verify-lock`, `preflight`, and `smoke-profile` exited 0; the four shared curated profiles reported six selected candidates and 143 composed entries, while personal reported zero selected candidates and 137 entries. Every smoke passed `manifest`, `bundle-parse`, `dump-config`, and `help`. The negative preflight probe redacted `sk-task19-final-sentinel` to `[REDACTED]`.

The six official `web` and `headless` files initialized in every isolated home retained the same hashes after installation and validation: web manifest `210068ddb9ebc4cdf395ebb53020be6ccaaedb917e74dae16296d62394626398`, headless manifest `563c0b6082748a6e93daad51514f01335c51fc9c44f5f88253383f18ac2557b5`, both patches `ef189a8c27db6d63930aa3046a3040482e952eafcb7487c644d508e8d461f027`, and both workspaces `ae7c5b68e2f157528e62885804e69e88583897b775e03c86fcbe52feaf498aba`.

### Final Task 19.2 verification

- The final curated run passed 356 tests. Every included source file under curated policy, profiles, and scripts reached 100% statements, branches, functions, and lines.
- All four curated package typechecks, repository typecheck, repository build, workspace constraints, and repository lint passed. Lint reported 0 warnings and 0 errors across 2,647 files.
- The four changed bilingual owner pairs are consistent. Repository `doc-sync` passed 26 of 28 gates; only the unrelated dirty generated `packages/extensions/tool-cordis/src/api-catalog.ts` and `docs/config-catalog.md` remained stale.
- Hygiene passed 13 of 14 gates; only the unrelated pre-existing `AGENTS.md` mismatch in `root-agents-vendored-name-contract` failed.
- Current binaries reran observed `verify-lock`, `preflight`, and `smoke-profile` successfully against all five isolated installed roots. The four six-candidate profiles each composed 143 entries; personal selected no external candidate and composed 137 entries.
- Scoped correctness and security review found no unresolved Task 19.2 defect or exploitable issue. Unstaged and staged diff checks passed, and no planning path is staged.

## Task 19.2 Reapplication

The final registry-source implementation was rechecked after the workspace overwrite. Source, tests, catalog data, profile templates, generated benchmark records, owner READMEs, and the governance Agent Note remained intact; the stale `docs/subsystems/curated` baseline summary was restored in both languages and its pairing record regenerated. Fresh registry metadata matched all five exact npm versions and integrity values, and `/tmp/dsh-task19-reapply.eKLW3n` contains five clean installs whose profile-scoped observed verification passes.

## Rescope Vendor Hygiene Closure

### Root cause and TDD

The `root-agents-vendored-name-contract` exact edit still matched only the obsolete vendored-package clause and replaced it with the former ``private: true`` clause. The current root convention replaces the complete upstream sentence because both the dsh publication rule and the vendored publication rule changed. Keeping the substring-only source would have produced a hybrid sentence when applying the codemod to an upstream checkout.

The focused regression imports the exact-edit table, identifies the named recipe, and requires the complete upstream sentence to classify as `pending` and the current final sentence to classify as `applied`. Its RED run exited 1 with one failed and four passed tests because both `find` and `replace` were stale. After the recipe adopted the complete source and target sentences, the same command exited 0 with five passed tests. The upstream fixture splits the literal package token in source so the codemod's residue scan does not mistake test data for an unresolved package reference.

### Fresh verification

- `perl -e 'alarm 50; exec @ARGV' node_modules/.bin/vitest run scripts/rescope-vendor.spec.ts --reporter=dot`: exit 0; 5 tests passed.
- `perl -e 'alarm 50; exec @ARGV' env pnpm_config_verify_deps_before_run=false pnpm run rescope-vendor:check`: exit 0; 4,782 tracked files checked, with no residue and every exact edit idempotent.
- `perl -e 'alarm 50; exec @ARGV' env pnpm_config_verify_deps_before_run=false pnpm run hygiene`: exit 0; 14 passed, 0 failed, and 0 skipped in 21.57 seconds.
- `perl -e 'alarm 50; exec @ARGV' env pnpm_config_verify_deps_before_run=false pnpm run lint`: exit 0; 0 warnings and 0 errors across 2,647 files in 21.6 seconds.
- `git diff --check` and `git diff --cached --check` exited 0. Each untracked report's `git diff --no-index --check /dev/null <report>` returned only the expected status 1 with no whitespace diagnostic. `git diff --name-only -- vendor` and `git status --short -- vendor` produced no output; no `vendor/**` file was edited.

## Task 19.1 Generated Catalog Closure

- Ownership was confirmed from repository scripts and generated-file notices: `scripts/gen-cordis-catalog.ts` owns `packages/extensions/tool-cordis/src/api-catalog.ts`, and `scripts/gen-config-catalog.ts` owns `docs/config-catalog.md`.
- `/opt/homebrew/bin/timeout 54s pnpm run gen-cordis-catalog` exited 0 in 8.57 seconds after computing 97 artifacts and writing only the stale Cordis API catalog. `/opt/homebrew/bin/timeout 54s pnpm run gen-config-catalog` exited 0 in 0.96 seconds and rewrote only its catalog.
- Diff inspection traced every generated change to current source: workflow cancellation and disposal JSDoc, `CuratedCandidate.npmVersion` and `npmIntegrity`, and the curated-policy `Config` declaration at line 255.
- Fresh `verify-cordis-catalog` and `verify-config-catalog` runs exited 0 in 8.58 and 0.98 seconds. The first full `doc-sync` then passed 27 of 28 gates and identified only the regenerated English config catalog's pairing record.
- The reviewed Chinese counterpart already carried the current workflow declaration. Its stale curated-policy source citation was corrected to line 255, and the scoped pairing recorder exited 0.
- A fresh full `doc-sync` exited 0 in 30.27 seconds with 28 passed, 0 failed, and 0 skipped. Scoped oxlint on the generated TypeScript catalog reported 0 warnings and 0 errors.

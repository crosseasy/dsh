# Task 17 Round 4 Code and Test Audit

## Status

FAIL

Scope: `packages/curated/**`, `apps/cli/src/curated-profile.ts`, `apps/cli/src/plugin.ts`, `apps/cli/src/profile-boot.ts`, and directly relevant tests. This audit did not reuse conclusions from `progress.md`.

## Findings

### P1 Behavior Defect: PEM redaction emits the private-key body

Locations: `packages/curated/curated-scripts/src/index.ts:349-350`, `packages/curated/curated-scripts/src/index.ts:2616-2626`

`SECRET_VALUE_REPLACEMENT_PATTERN` matches only a PEM `BEGIN ... PRIVATE KEY` header. `redactSecretText()` therefore replaces the header but returns the key body and `END` footer. A direct `runSmokeProfile()` probe with a staging error containing a PEM returned:

```text
[REDACTED]
SUPERSECRETPAYLOAD123
-----END PRIVATE KEY-----
```

This violates the no-secret-output requirement for smoke diagnostics. Redact the complete PEM block, including multiline payload and footer.

Test gap: the redaction cases at `packages/curated/curated-scripts/tests/commands.spec.ts:2900-2993` cover JSON, prefixed JSON, and token text, but not complete PEM material.

### P1 Behavior Defect: Observed preflight accepts an invalid, secret-bearing profile

Locations: `packages/curated/curated-scripts/src/index.ts:836-864`, `packages/curated/curated-scripts/src/index.ts:883-890`, `packages/curated/curated-scripts/src/index.ts:2097-2107`

Installed-profile validation reads `package.json` but validates only that `dsh.profile.bundles` is an array of non-empty strings. It does not scan the manifest or `.npmrc` for secrets, require at least one bundle, or require a known curated profile to match its template. Secret scanning starts later and covers only composed `entry.config` values.

A direct probe using `{"token":"plain-profile-secret","dsh":{"profile":{"bundles":[]}}}` returned `ok: true`, `observed: true`, and `accepted: true`. Thus an empty `web-curated` profile containing plaintext credentials is accepted as observed preflight evidence. Validate the complete profile input and exact curated composition before setting `accepted`.

Test gap: fixture tests exercise entry-config secrets, while installed-profile tests at `packages/curated/curated-scripts/tests/commands.spec.ts:1408-1740` do not cover manifest or `.npmrc` secrets, empty compositions, or a curated template mismatch.

### P1 Behavior Defect: “Observed” provenance is controlled by the input being evaluated

Locations: `packages/curated/curated-scripts/src/index.ts:533-553`, `packages/curated/curated-scripts/src/index.ts:1453-1480`, `packages/curated/curated-scripts/src/index.ts:1643-1659`

Installed artifact provenance is read from `.dsh-curated-artifact.json` inside the supplied package directory. The resolver does not derive the commit or tarball digest from independently acquired bytes. Benchmark provenance similarly trusts the input file's `evidenceKind: observed`; that string alone permits `accepted`.

The tests demonstrate the weakness: `stageCandidatePackage()` manufactures the sidecar at `packages/curated/curated-scripts/tests/commands.spec.ts:114-154`, and `benchmarkFixture()` labels generated fixture data as observed at `packages/curated/curated-scripts/tests/commands.spec.ts:284-290`; the latter is asserted accepted at `packages/curated/curated-scripts/tests/commands.spec.ts:4159-4167`. This can turn fixture or tampered data into accepted observed evidence, contrary to the provenance requirement. Observation must come from a runner-owned or independently verifiable record.

### P1 Behavior Defect: The published smoke command launches files absent from its package

Locations: `packages/curated/curated-scripts/src/index.ts:334-335`, `packages/curated/curated-scripts/src/index.ts:1065-1071`, `packages/curated/curated-scripts/package.json:38-59`, `apps/cli/package.json:14-19`

The shipped `dsh-curated-smoke-profile` bin runs `../../../../apps/cli/src/bin.ts` through `tsx/esm`. The curated-scripts package neither ships that repository path nor declares `tsx`; the CLI package itself publishes `lib/*.js`, not `src/bin.ts`. Inspection of the packed tarball confirmed that only curated-scripts files are present. A normal installed package therefore cannot execute the advertised observed smoke path.

Use the installed `@deepseek-ai/dsh` built bin and add a packed-install smoke. Current tests invoke source wrappers or injected runners; `packages/curated/curated-scripts/tests/commands.spec.ts:2755-2765` checks only bin declarations.

### P1 Behavior Defect: Policy loading accepts unsupported versions and unsafe defaults

Locations: `packages/curated/curated-policy/src/index.ts:555-617`, `packages/curated/curated-policy/src/index.ts:895-930`, `packages/curated/curated-policy/src/index.ts:821-834`

Conflict and permission parsers retain `schemaVersion`, but `validatePolicySemantics()` never checks either version. Permission defaults are restricted by key and scalar type only; their required values are not enforced. A probe using schema version `2` plus `configImportMode: execute`, `otelCaptureBody: true`, and `credentialStorage: plaintext` returned no issues, allowing `apply()` to publish `ctx.curatedPolicy`.

Reject unsupported policy schema versions and require the three fail-closed default values before service publication.

Test gap: `packages/curated/curated-policy/tests/catalog.spec.ts:1415-1516` covers unknown keys, scalar types, and invalid rule enums, but not policy schema versions or unsafe values for known default keys.

## Coverage Assessment

The benchmark threshold matrix is strong: it covers immediately below, exactly at, and immediately above every specified threshold using unrounded decision inputs (`packages/curated/curated-scripts/tests/commands.spec.ts:3988-4130`). Direct service disposal and fixture Loader/HMR removal are also covered (`packages/curated/curated-policy/tests/catalog.spec.ts:1405-1412`, `packages/curated/curated-bench/tests/bench.spec.ts:172-179`, `packages/curated/curated-profiles/tests/profiles.spec.ts:642-689`). There is no equivalent test that boots a curated profile through `apps/cli/src/profile-boot.ts`, edits a live patch, and then disposes the CLI-owned tree; this remains a test-only coverage gap, not a confirmed behavior defect.

## Verification

- `pnpm exec vitest run packages/curated/curated-policy/tests/catalog.spec.ts packages/curated/curated-profiles/tests/profiles.spec.ts apps/cli/tests/curated-profile.spec.ts --reporter=dot`: 103 tests passed.
- `pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts packages/curated/curated-bench/tests/bench.spec.ts --reporter=dot`: 173 tests passed.
- Curated package TypeScript project build: passed.
- `git diff --check` for the audited paths: passed.
- `pnpm --dir packages/curated/curated-scripts pack --pack-destination /tmp/dsh_task17_round4`: passed; tarball inspection confirmed the missing CLI source/`tsx` runtime path.
- Direct read-only probes confirmed unsafe policy defaults produce `[]`, the secret-bearing empty profile is accepted, and PEM payload text is emitted.

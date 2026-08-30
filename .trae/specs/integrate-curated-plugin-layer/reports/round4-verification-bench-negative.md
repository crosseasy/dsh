# Task 19.3 independent benchmark and negative-path verification

Date: 2026-08-26

Verdict: **PASS**

## Scope and basis

This verification read the current `spec.md`, `tasks.md`, `checklist.md`, benchmark assets, command README, evaluation document, implementation, and command tests. It made no source changes and performed no git history or staging operations. Every command was guarded by a 50-second alarm, below the 55-second task limit.

PASS means the requested local comparison and negative mechanisms produced fresh expected results. It does not mean that planned search, memory, browser, MCP, fault-injection, A/B, or canary campaigns were observed.

## Fresh commands and results

Working directory for every command: `/Users/bytedance/opencode/agent/dsh`.

### Complete comparison command suite

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'compare-benchmark command' --testTimeout=45000
```

Result: exit 0; 1 test file passed; 24 tests passed and 195 skipped out of 219; Vitest duration 1.34s, test execution 614ms.

This suite freshly verified:

- accepted JSON and source-tree CLI wrapper paths;
- rejected and rollback JSON/text paths;
- caller-declared `fixture` returning nonzero `unverified`;
- caller-declared `planned` returning nonzero `pending`;
- all five non-compensable codes in one high-score candidate: `security-correctness-below-95`, `data-loss-detected`, `rollback-impossible`, `startup-failure-rate-above-1`, and `critical-success-rate-drop`;
- all three rollback codes with embedded prior snapshots: `first-token-p95-regression`, `prompt-schema-token-regression`, and `cost-regression-without-success-gain`;
- 26 raw boundary cases. The test covers below/at/above boundaries for security 95%, startup failure 1%, critical-success decline 3 points, first-token P95 growth 15%, token growth 20%, cost growth 20%, and cost-success gain 3 points, plus zero/positive data loss and rollback availability. Exact equality does not trigger strict `>`/`<` gates;
- malformed and incomparable input: missing evidence/provenance, environment mismatch, task/attempt mismatch, fewer than five repetitions, missing critical tasks, four malformed top-level/profile/snapshot cases, 17 provenance/snapshot field cases, four run-field type cases, and five impossible numeric cases;
- mismatched embedded rollback snapshot digest rejection;
- benchmark failure-reason secret rejection without echoing `hidden-benchmark-token`;
- mean, P50, P95, failure distribution, weighted score, and immutable snapshot references.

### Preflight, smoke, subprocess, and local fault negatives

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'rejects duplicate providers, resources, and config secrets with redacted output|rejects malformed patch inputs in text mode|redacts (_auth|auth) credential values from malformed YAML diagnostics|records non-zero child process results as stage failures|enforces the 55 second command limit and reports timeout by stage|contains and redacts provider-interface faults while preserving single-plugin recovery|fails closed on an illegal patch fixture without echoing secret material|captures real child runner output, failures, and timeouts' --testTimeout=45000
```

Result: exit 0; 1 test file passed; 9 tests passed and 210 skipped out of 219; Vitest duration 712ms, test execution 93ms. The count is nine because malformed YAML credential redaction runs once for `_auth` and once for `auth`.

Freshly verified details:

- duplicate active provider plus duplicate entry ID, tool, command, service, UI slot, settings tab, route, port, SQLite path, cache directory, environment variable, waterfall listener, and automation behavior all reject;
- the same duplicate fixture redacts the literal API key and does not print the secret-shaped environment variable;
- malformed top-level YAML rejects in text mode;
- malformed YAML parser diagnostics redact both `_auth` and `auth` credential values;
- illegal-patch YAML fails closed and redacts its secret;
- an injected nonzero child exit becomes `smoke-profile-stage-failed`;
- an injected stage timeout becomes status 124 and `smoke-profile-stage-timeout`;
- the real child runner covers successful output, a missing executable, and an actual timeout;
- seven repository behavior-fixture faults are contained and redacted: search timeout, provider 429, SQLite lock, permission denial, offline network, illegal patch, and initialization exception. Each emits tool call/result events, fails only the staged command, hides its `sk-` value, and permits a subsequent success.

### Benchmark asset validation

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-bench/tests/bench.spec.ts -t 'exports directories containing JSON benchmark assets|rejects benchmark assets with missing rollback snapshot references|rejects malformed snapshot envelopes, profile references, and evidence kinds' --testTimeout=45000
```

Result: exit 0; 1 test file passed; 3 tests passed and 13 skipped out of 16; Vitest duration 340ms, test execution 13ms. This independently exercised checked-in asset discovery plus malformed/missing rollback envelope, digest, profile-reference, and evidence-kind rejection.

### Focused status and wrapper confirmation

```sh
perl -e 'alarm 50; exec @ARGV' pnpm exec vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t 'keeps pending long-cycle campaigns out of accepted status without fabricated runs|runs through the compare-benchmark source-tree wrapper|renders accepted, rejected, and rollback comparisons in text mode|never accepts fixture evidence|rejects asymmetric pending evidence and renders unverified and pending text' --testTimeout=45000
```

Result: exit 0; 1 test file passed; 5 tests passed and 214 skipped out of 219; Vitest duration 660ms, test execution 202ms. This fresh subset confirms the CLI wrapper accepts a structurally valid caller-declared observed fixture, while correctly declared fixture/planned inputs remain non-accepted.

Vitest printed only an informational Vite warning that `vite-tsconfig-paths` can be replaced by native `resolve.tsconfigPaths`; it reported no test warning or failure.

## Default checked-in benchmark

```sh
perl -e 'alarm 50; exec @ARGV' node packages/curated/curated-scripts/compare-benchmark.mjs --json
```

Result: expected exit 1. Output reported `evidenceKind:"planned"`, `ok:false`, `status:"pending"`, baseline `web`, candidate `web-curated`, and exactly five pending campaigns: `web-search`, `memory`, `browser-computer-use`, `mcp-management`, and `canary`. It also returned the digest-verified embedded prior lock/profile snapshots.

```sh
perl -e 'alarm 50; exec @ARGV' node packages/curated/curated-scripts/compare-benchmark.mjs
```

Result: expected exit 1 with exact output:

```text
compare-benchmark: pending (5 campaigns)
```

The default benchmark was not accepted and is not claimed as observed.

## Gaps and evidence limits

- `evidenceKind` and producer identity remain caller-declared and are not cryptographically authenticated. The accepted fixture test proves comparator behavior for an input asserting `observed`; it does not prove who produced that input.
- The seven local behavior faults are repository fixtures, not executions of the external candidates. They cannot satisfy real fault-injection or E3/E4 evidence.
- `browser-crash` is declared in the planned P2 risk asset but has no corresponding local behavior fixture. It remains planned/pending and was not claimed as executed.
- The checked-in search, memory, browser, MCP, 100/200-task A/B, fault campaign, and 3–7 day canary records remain pending. No observed result was manufactured from their planned data.

These are explicit scope/evidence limits rather than failures of the requested local Task 19.3 mechanisms.

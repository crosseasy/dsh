# `@deepseek-ai/dsh-curated-bench`

English | [中文](README.zh.md)

`@deepseek-ai/dsh-curated-bench` owns structured benchmark inputs for the curated plugin layer. Every execution-related asset identifies itself as `observed`, `fixture`, or `planned`; the checked-in default is a plan with no fabricated runs.

## Assets

- `manifests/`: read-only candidate audit summaries.
- `tasks/`: capability task-set definitions for search, memory, browser, MCP, cost, and profile smoke checks.
- `baselines/`: official profile snapshots, curated profile snapshots, dynamic A/B comparison inputs, and non-restorable planning history.

## API

The package exports directory locators for the three asset roots, a read-only `ctx.curatedBench` asset service, and `validateCuratedBenchAssets()` for static asset checks in tests and build gates. Runtime asset listing is iterative and allows at most 1,024 total entries and 64 nested directory levels. Static validation reads each required `.keep.json` as a contained bounded regular file and requires exactly one non-empty `purpose` field; every parsed asset must be plain JSON with finite numbers. Its invariant companion is empty because fixed JSON assets provide no observable event-stream or mutable-data relationship. Consumers read explicit JSON files from those directories; the package does not run benchmarks itself.

The planned P2 fault asset contains exactly search timeout, model 429, browser crash, SQLite lock, permission-denied file, illegal patch, network offline, and plugin-init exception scenarios. Every scenario remains `pending` with no runtime outcome; its allowed outcomes are the scenario's runtime `fail-closed` and recovery results, never smoke success.

The planned P2 profile and A/B records use closed field sets and fixed values from the evaluation plan. Every A/B row remains `pending`, enables mean, P50, P95, and failure-distribution statistics, and carries all five non-compensable thresholds.

A completed comparison is admissible only when baseline and candidate records identify identical model, prompt, workspace, network, seed, DSH build, and measurement implementations; carry the same task-and-attempt set; include every required critical task; and repeat each task at least five times per profile. The DSH build identity records package version, full source revision, source-tree SHA-256, dirty state, executable SHA-256, and Node version. The measurement identity records producer, tokenizer, prompt/schema serialization, timing, pricing, and scoring implementations. Threshold decisions use raw values before report rounding. The benchmark fixture uses schema 3; planned fixtures with no runs may omit execution identities. Every embedded, referenced, or published lock or profile snapshot uses snapshot schema 2. Static published-snapshot validation recursively enumerates every entry in the `baselines/locks` and `baselines/profiles` trees, rejects symbolic links and entries that are neither regular files nor directories, and validates every JSON file in those trees as a snapshot. Each tree permits at most 1024 entries and at most 64 directory levels below its root, so level 65 is rejected. Every validated JSON file must have the kind required by its tree and valid profile and payload fields. Each snapshot reference contains exactly a safe relative JSON path and canonical JSON SHA-256 resolved from the benchmark fixture directory. The reader binds the first unresolved-path identity to the contained canonical target and opened descriptor, uses `O_NOFOLLOW` where available, and verifies descriptor and path identities before and after a bounded regular-file read; replacing the file, an ancestor, or the final path with a symlink after the initial check fails closed. Every stale reference digest rejects. The referenced baseline files must canonically equal the SHA-256-validated embedded lock and profile snapshots, and each referenced profile must exactly equal its authoritative shipped or curated template in order.

The canonical `baselines/locks/web-curated.json` and `baselines/profiles/web-curated.json` snapshots are independently mandatory. Published snapshot traversal reports labelled invariant failures for directory-open and traversal errors, while directory-close failures cannot escape the diagnostic-list API. Snapshot reads require strict UTF-8, and canonical JSON rejects non-finite numbers, objects with non-plain prototypes, sparse or subclassed arrays, and arrays with extra own string or symbol properties before calculating a digest.

Files under `baselines/history` are recursively validated planning records with `kind: curated-planning-history`, `evidenceKind: planned`, `restorable: false`, and a canonical UTC `createdAt` date in `YYYY-MM-DD` form. Invalid calendar months and days produce validator issues rather than date exceptions. The records preserve prior counts, catalog references, profile bundles, former record kinds, former operator instructions, and the migration from their former lock/profile paths. Each migration source is a safe relative JSON path without absolute syntax, backslashes, or `..` segments; lock sources stay under `locks/`, and profile sources stay under `profiles/`. They use history schema 1 and are not rollback snapshots: `compare-benchmark` accepts only explicitly referenced schema 2 lock and profile snapshots.

Each lock candidate records shared package, patch, normalized source-content, installed-tree, and runtime-closure identities plus exactly one `installSource`. Its `bundlePatch` is a package-contained POSIX relative path beginning with `./`. An npm source requires an exact SemVer 2.0 `npmVersion` and SHA-512 `npmIntegrity`; valid prerelease and build metadata are accepted without prefix, range, or tag coercion. A Git source requires a canonical `https://github.com/<owner>/<repo>` repository, full commit, explicit `repositoryPath`, and an empty `installScripts` record. The source-content digest identifies sorted extracted files rather than GitHub's changeable archive encoding. Missing, mixed, floating, or placeholder source data is invalid. A profile with no third-party candidates uses an empty `candidates` array. Comparison returns the decision, reasons, and immutable snapshot content; an external rollout operator performs restoration, with no claim of automatic or atomic restore.

## Model Experience

### Benchmark assets

#### What the model sees

The package registers no prompt text, tool schema, user message, assistant-visible result, or session event. Benchmark records become model-visible only when another tool or command includes their content in a prompt.

#### Token effect

Zero direct token cost from `@deepseek-ai/dsh-curated-bench`.

#### KV Cache effect

No direct cache effect; callers that quote benchmark data own that request content.

## Known Limitations and Deferred Work

- **Records are classified**: fixture and planned records are not accepted evidence and do not count as canary or fault execution. `evidenceKind: observed`, execution metadata, and run fields are input-provider assertions. Neither that label nor an `accepted` decision cryptographically authenticates the producer or evidence; the operator decides whether their provenance is trustworthy.
- **Run evidence remains external**: the checked-in curated lock has no active third-party candidates. Activation requires a real pinned artifact, a keyless assembled snapshot, every required dependency bundle, and retained install, enable, restart, disable or uninstall evidence. E3/E4, search, memory, browser, MCP, A/B, fault, and canary campaigns remain pending.

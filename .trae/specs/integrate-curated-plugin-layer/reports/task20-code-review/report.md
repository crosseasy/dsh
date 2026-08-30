# Task 20.1 Independent Code-Quality Review

## Verdict

Verdict: **CHANGES REQUIRED**

Three high-confidence P0-P2 findings remain: two P1 and one P2.

## Findings

### 1. P1 Robustness: Observed preflight silently accepts non-mapping bundle entries

- Location: `packages/curated/curated-scripts/src/index.ts:2653-2656`
- Confidence: 10/10

`loadPatchLayer()` verifies only that the YAML root is an array, then silently removes every non-object item:

```ts
if (!Array.isArray(parsed)) throw new Error('curated patch must be a top-level YAML array')
return parsed.filter(isRecord)
```

An installed bundle containing a valid entry plus a scalar can therefore reach observed preflight as a reduced patch and return `accepted: true`. The test at `packages/curated/curated-scripts/tests/commands.spec.ts:3399-3425` explicitly codifies this fail-open result. This contradicts the README and Agent Note requirement that every effective top-level row be structurally valid.

Fix: reject the complete patch when any top-level item is not a record, and replace the acceptance test with an observed-preflight rejection assertion.

### 2. P1 Security: Artifact paths can escape the package directory

- Location: `packages/curated/curated-scripts/src/index.ts:1231-1237`
- Confidence: 9/10

`isSafeRelativeArtifactPath()` rejects leading `/`, `..`, and NUL, but accepts Windows drive-absolute and UNC paths. It also accepts package-local symlinks whose targets are outside `packageDir`. `resolveArtifactFile()` then uses the escaped path for the candidate manifest, bundle patch, or main-file check.

An artifact under admission can therefore make validation inspect or approve files outside its package, defeating the claimed artifact containment and fail-closed behavior.

Fix: reject `path.isAbsolute(relativePath)` on the host platform, resolve existing files through `realpath`, and verify separator-aware containment under `realpath(packageDir)`.

### 3. P2 Robustness: The smoke deadline does not bound artifact inspection

- Location: `packages/curated/curated-scripts/src/index.ts:1576-1591`
- Confidence: 9/10

`inspectInstalledSmokeProfile()` performs synchronous manifest, lockfile, patch, and filesystem reads before the next deadline check. A slow network-mounted profile or oversized input can exceed the 55-second command limit; the subsequent `Promise.resolve()` check only reports the timeout after synchronous inspection returns.

Fix: perform artifact inspection in a cancellable child process governed by the remaining deadline, or narrow the documented deadline guarantee and separately bound input size and filesystem behavior.

## Scope

Reviewed full current files under `packages/curated/**`, the CLI curated bridge, changed release/rescope code, curated lockfile entries, and directly changed curated documentation and active Agent Note. `vendor/**`, archived Agent Notes, planning/status artifacts, and unrelated worktree changes were excluded.

Existing Task 18/19 verification evidence was inspected. Tests were not rerun, as requested. No HTML report was generated.

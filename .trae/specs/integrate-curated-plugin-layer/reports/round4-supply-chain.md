# Round 4 Supply-Chain Audit

Date: 2026-08-26

Scope: the 11 active candidates in `packages/curated/curated-policy/policy/plugin-allowlist.yaml`, the generated catalog and lock/profile summaries under `packages/curated/curated-bench`, and the profile composition in `packages/curated/curated-profiles/src/index.ts`. This audit does not reuse conclusions from `progress.md`.

## Method

- Ran the source `verify-lock --json` path without artifact roots. It returned `ok: true`, `observed: false`, 37 candidates, and no issues. This proves only local metadata validation.
- Parsed the current allowlist and profile templates. All 11 active candidates have 40-character lowercase SHAs, scores equal to their eight stored dimensions, `default` tier scores of 85 or higher, and declared profile assignments matching the current templates.
- Ran bounded `git ls-remote` against all 11 repositories. Every repository was reachable. Three pins remain advertised by tags (`dsh-web-search-pro`, `dsh-memento`, and `loongsuite-dsh-plugin`); the other eight are historical commits not present in advertised refs.
- Fetched every pinned raw package manifest, bundle patch, and license file with a 15-second request deadline. All returned HTTP 200 and parsed successfully with the repository's Cordis patch schema. No lifecycle script was executed.
- Queried each pinned Git tree with a 15-second deadline. All responses were complete (`truncated: false`), the exact `*.spec.*`/`*.test.*` and workflow counts matched the allowlist, and no repository contained a `packages/core/**` path.
- Fetched each current GitHub codeload `tar.gz/<full-sha>` archive with a 20- or 25-second deadline and computed SHA-256. Every mismatch was repeated once against the same endpoint.

## Findings

### P0: eight active archive digests do not match current pinned archives

The allowlist digests for `dsh-toolkit`, `dsh-web-search-pro`, `dsh-mcp-panel`, `dsh-checkpoint-rewind`, `dsh-lsp-actions`, `dsh-smooth-stream`, `upstream-radar`, and `plugin-session-export` differ from two fresh downloads of GitHub's `tar.gz/<commit>` archive. Only `dsh-memento`, `dsh-permission-rules`, and `loongsuite-dsh-plugin` matched. The verifier treats a digest difference as `artifact-tarball-sha-mismatch` (`packages/curated/curated-scripts/src/index.ts:595-600`), but rootless verification checks only digest syntax and therefore passed. Until the archive acquisition method is defined and these values are reconciled, the eight pins do not have reproducible archive-integrity evidence.

### P0: observed dependency verification disagrees with the catalog model

`externalDependencies` is selectively populated, while observed verification unions every key from `dependencies`, `optionalDependencies`, and `peerDependencies` and compares that full set verbatim (`packages/curated/curated-scripts/src/index.ts:631-637,738-745`). Fresh manifests therefore disagree for 10 of 11 active candidates; only `upstream-radar` matches. Examples include `dsh-toolkit` recording `[]` while its manifest names three `@deepseek-ai/*` peers, `dsh-web-search-pro` omitting its DSH/client peers and `@anweat/dsh-browser`, and LoongSuite omitting `@deepseek-ai/schemastery`. Any real artifact run reaches `artifact-dependencies-mismatch` even when the intended non-DSH dependency subset is accurate. Either the catalog must contain the complete union or the verifier must implement and document the intended filtering rule.

### P1: `plugin-session-export` cannot pass the implemented Node-engine check

The active row records `nodeEngine: ">=22"` from the repository-root manifest (`packages/curated/curated-policy/policy/plugin-allowlist.yaml:616-645`). The selected package manifest at `packages/plugins/plugin-session-export/package.json` has no `engines.node`; only the monorepo root has `>=22`. Observed verification reads only the selected package manifest and compares its value directly to the catalog (`packages/curated/curated-scripts/src/index.ts:647-660`), so it observes `undefined` and emits `artifact-node-engine-mismatch`. The warning does not make the candidate verifiable under the implemented rule.

### P1: six active `resources.entryIds` disagree with their bundle patches

Fresh pinned patches insert `tool-kit`, `web-search-pro`, `mcp-panel`, `checkpoint-rewind`, `lsp-actions`, and `smooth-stream`. Their allowlist rows instead claim `dsh-toolkit`, `dsh-web-search-pro`, `dsh-mcp-panel`, `dsh-checkpoint-rewind`, `dsh-lsp-actions`, and `dsh-smooth-stream` respectively (`plugin-allowlist.yaml:48-50,148-150,251-253,293-295,335-337,434-436`). The other five active rows match. Because duplicate-resource checks consume the catalog claims, these six real entry IDs are not represented accurately.

### P1 evidence gap: scores are arithmetically valid but not independently substantiated

Every active score equals its eight dimension values and maps to `default` under the implemented thresholds (`packages/curated/curated-policy/src/index.ts:382-387,1025-1044`). The catalog has no per-dimension evidence references, measurements, or dates, however. The highly repeated 86-88 point vectors cannot be independently verified from package manifests, tree counts, or the local validator. Tier and profile consistency pass as local arithmetic/composition facts; the underlying score assignments remain unsupported assertions.

### Core-patch evidence

All complete pinned trees contain no `packages/core/**` path, and all bundle patches load package entries without applying a repository patch. `dsh-lsp-actions` additionally ships `upstream/lsp-action-seam.patch`, which modifies DSH LSP packages and documentation; its pinned README states that the package retains a standalone fallback and the upstream patch is optional. `requiresCorePatch: false` is therefore not disproved, but the optional upstream patch should be recorded as a warning so future removal of the fallback cannot silently change this conclusion. No equivalent source-level proof was present for the other ten candidates beyond the complete tree and bundle-patch observations.

## Per-Candidate Evidence

| Candidate | Pin/repository | Manifest, license, Node, lifecycle hook, bundle patch | Archive SHA-256 | Core evidence | Score/tier/profile | Result |
| --- | --- | --- | --- | --- | --- | --- |
| `dsh-toolkit` | Raw manifest at `2113d11a4e4510720251aa49a800bab917b14330` returned 200; repository reachable | `@deepseek-ai/dsh-toolkit`; MIT file; `^22.19.0 \|\| >=24.0.0`; no lifecycle hook; patch 200 | **Mismatch:** expected `886d8b…cc65`, observed `d56d90…62d` twice | No `packages/core/**` path | 88/default; four baseline profiles match | Fail: archive digest, dependency set, entry ID |
| `dsh-web-search-pro` | Raw manifest at `4274ab148d926060a4e5e1399ac9e87894ed1a83` returned 200; tag `v0.1.10^{}` advertises pin | `dsh-web-search-pro`; MIT file; `^22.19 \|\| >=24`; `prepare: pnpm run build`; patch 200 | **Mismatch:** expected `68324b…c4`, observed `c790ec…7f38` twice | No `packages/core/**` path | 87/default; four baseline profiles match | Fail: archive digest, dependency set, entry ID |
| `dsh-memento` | Raw manifest at `ee198efd71dc60f5cd1cd2019e20c63028d2d182` returned 200; tag `v0.4.5^{}` advertises pin | `dsh-memento`; Apache-2.0 file; `^22.19.0 \|\| >=24.0.0`; no lifecycle hook; patch 200 | Match: `944595…e5` | No `packages/core/**` path | 88/default; four baseline profiles match | Partial: dependency set and score evidence gap |
| `dsh-mcp-panel` | Raw manifest at `da7ee900539a0bcb65e0c40b94376f9f4334008d` returned 200; repository reachable | `dsh-mcp-panel`; Apache-2.0 file; `^22.19.0 \|\| >=24.0.0`; `prepare: node scripts/prepare.mjs`; patch 200 | **Mismatch:** expected `a60ec3…557`, observed `9678db…6c7` twice | No `packages/core/**` path | 87/default; four baseline profiles match | Fail: archive digest, dependency set, entry ID |
| `dsh-checkpoint-rewind` | Raw manifest at `377174b99200ea2f004f03f679f39515505c38f3` returned 200; repository reachable | `dsh-checkpoint-rewind`; Apache-2.0 file; `^22.19.0 \|\| >=24.0.0`; no lifecycle hook; patch 200 | **Mismatch:** expected `58e396…15`, observed `5c8725…f6f` twice | No `packages/core/**` path | 87/default; four baseline profiles match | Fail: archive digest, dependency set, entry ID |
| `dsh-lsp-actions` | Raw manifest at `f86d45c10ce248ae4d0d30118354e3ff07432b0e` returned 200; repository reachable | `dsh-lsp-actions`; Apache-2.0 file; `^22.19.0 \|\| >=24.0.0`; recorded prepare command matches; patch 200 | **Mismatch:** expected `98b91d…724`, observed `92ce1f…aa4` twice | No `packages/core/**`; optional `upstream/lsp-action-seam.patch` exists | 86/default; four baseline profiles match | Fail: archive digest, dependency set, entry ID; core warning absent |
| `dsh-permission-rules` | Raw manifest at `36984920b1bfad1d542d1e937f7c99df8d1d848c` returned 200; repository reachable | `dsh-permission-rules`; Apache-2.0 file; `^22.19.0 \|\| >=24.0.0`; `prepare: node scripts/prepare.mjs`; patch 200 | Match: `e56ce2…35b` | No `packages/core/**` path | 88/default; four baseline profiles match | Partial: dependency set and score evidence gap |
| `dsh-smooth-stream` | Raw manifest at `b8c5eefc1584a5a1d69116a0b038acd2abc4adb6` returned 200; repository reachable | `dsh-smooth-stream`; MIT file; `^22.19.0 \|\| >=24.0.0`; `prepare: tsdown`; patch 200 | **Mismatch:** expected `38f376…4fa`, observed `ff75af…d23` twice | No `packages/core/**` path | 86/default; four baseline profiles match | Fail: archive digest, dependency set, entry ID |
| `upstream-radar` | Raw manifest at `e02ca9568d256a5f19c1282b8c95a9844c84aa82` returned 200; repository reachable | `upstream-radar`; Apache-2.0 file; `>=22`; no lifecycle hook; `!!js` patch parsed with `entryListSchema` | **Mismatch:** expected `3a173e…6c3`, observed `9ae0ca…aae` twice | No `packages/core/**` path | 87/default; four baseline profiles match | Fail: archive digest; score evidence gap |
| `plugin-session-export` | Raw subpackage manifest at `acf9d2d960d2b9ac6ae8569a68836a087c2154ee` returned 200; repository reachable | `@dsh-suite/plugin-session-export`; MIT file; package Node absent/root `>=22`; no lifecycle hook; patch 200 | **Mismatch:** expected `9f2be4…f28`, observed `5bcbaf…130` twice | No `packages/core/**` path | 85/default; `web-research` only matches | Fail: archive digest, dependency set, Node verification |
| `loongsuite-dsh-plugin` | Raw manifest at `5e893af6172beb703a98b56ccc5e443495287732` returned 200; tag `v0.1.1^{}` advertises pin | `@loongsuite/dsh-plugin`; Apache-2.0 file; `>=22.19.0`; no lifecycle hook; patch 200 | Match: `31ed31…005` | No `packages/core/**` path | 86/default; four baseline profiles match | Partial: dependency set and score evidence gap |

The active rows are at `plugin-allowlist.yaml:9-56,101-159,160-212,213-260,261-301,302-343,344-400,401-439,440-484,616-653,654-706`. The ten baseline bundles and research-only bundle are defined at `packages/curated/curated-profiles/src/index.ts:39-80`. The generated catalog summary reports 11 active candidates (`packages/curated/curated-bench/manifests/curated-candidates.json:5-18`), while the `web-curated` lock snapshot correctly reports ten (`packages/curated/curated-bench/baselines/locks/web-curated.json:6-9`).

## Conclusion

Repository reachability, full-SHA form, raw manifest/package/license/patch facts, exact test counts, exact CI counts, install-script recording, arithmetic tiering, and profile assignment are confirmed for the active set except for the `plugin-session-export` Node-engine mismatch. The active set is not supply-chain clean: eight archive digests mismatch current downloads, ten dependency declarations cannot satisfy the observed verifier, six entry-ID claims differ from pinned patches, and all static score vectors lack auditable dimension evidence. These are repository-owned metadata/verifier gaps, not inaccessible-external-check gaps.

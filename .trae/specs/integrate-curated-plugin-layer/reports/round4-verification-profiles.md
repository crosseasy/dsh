# Round 4 Task 19.2 Real-Profile Reapplication Verification

## Verdict

**PASS.** After the source overwrite, the final registry-source solution was present or restored on every owning surface. All five freshly materialized profiles installed successfully and passed profile-scoped observed `verify-lock`, `preflight`, and `smoke-profile`. No profile generated `allowBuilds`, and no Git lifecycle build ran.

## Root Cause

A fresh isolated `web-curated` install from the initial state failed in `dsh-smooth-stream@0.3.4`. Its Git `prepare` launched a nested `pnpm install`, which rejected `esbuild@0.28.2` with `ERR_PNPM_IGNORED_BUILDS`; the outer install then returned `ERR_PNPM_PREPARE_PACKAGE`. A profile's exact `allowBuilds` entry does not authorize nested dependency builds.

## Registry Audit

Read-only npm registry metadata and tarballs were checked against pinned Git manifests, release tags, licenses, compiled entries, and bundle patches. Every inspected npm tarball had no `preinstall`, `install`, or `postinstall` script.

| Candidate | Registry evidence | Pinned-source correspondence | Result |
| --- | --- | --- | --- |
| `dsh-web-search-pro` | `0.1.10`; `sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ==` | `v0.1.10` points to commit `4274ab148d926060a4e5e1399ac9e87894ed1a83`; compiled main, MIT license, and matching patch are present | Active |
| `dsh-mcp-panel` | `0.5.1`; `sha512-CnCzRD043IP8JV2KvyaVUBVMz26uwRAUHt9+srovyycorZ6RW58EcuURcG4pr4zXJddNSt0+O7iJbNDQ1fgdsg==` | Pinned commit is two documentation-only commits past `v0.5.1`; compiled main, Apache-2.0 license, and matching patch are present | Active |
| `dsh-checkpoint-rewind` | `0.5.5`; `sha512-dKUMlFfDk+K4rezHcgKMlLCBtS/ShW2A6w9ZBmPqJGeVegXxsUXrfgwNRmptqiSkRWzrP3SrbPwpiKYjDs+J5g==` | Pinned commit is one documentation-only commit past `v0.5.5`; compiled main, Apache-2.0 license, and matching patch are present | Active |
| `dsh-lsp-actions` | `0.3.4`; `sha512-JUMLUxtSoFsnzn88XBeyUbFrDSNBrT7V+GnaFWozjfe4rPncFaKGKun6T8E9cyAM1W914qgIj3n5X4CMa/0+rg==` | Pinned commit is one pull-request-template-only commit past `v0.3.4`; compiled main, Apache-2.0 license, and matching patch are present | Active |
| `dsh-permission-rules` | `0.5.5`; `sha512-gWGzVycnbVSxbqGCp4AicaMTpo9fejmIxICVPwLk72wAepnrrncSuHUsm5Zzdjg/kBCAnRz7KEx3StQqTbesyg==` | Runtime source corresponds, but the published bundle omits `enforce: true` | Rejected |
| `dsh-smooth-stream` | `0.3.4`; `sha512-YiwYI6Lwu28G5wHvpLFonmuQ+d44EJrp/lzyAp8d5c0B/0Er1p9CfkQvqMadCvMgTA7+pNgT9TBIB93CmaSU0g==` | The pinned source is 13 commits past `v0.3.4` and changes runtime/client code | Rejected |
| `@loongsuite/dsh-plugin` | `0.1.1`; `sha512-wQmSzOzyjp0rd3XKFmcK+vXRETqVr0V7xL5qh8El2RujteV4Gkc1vz1OxTG12lQZrjKVWV5ixRRJU1HDlBafog==` | `v0.1.1` points to commit `5e893af6172beb703a98b56ccc5e443495287732`; compiled main, Apache-2.0 license, and matching patch are present | Active in enterprise and the other curated profiles |
| `@deepseek-ai/dsh-toolkit` | Registry returned 404 | The Git source declares `prepack: npm run build:all` | Rejected |
| `upstream-radar` | `0.43.5`; `sha512-pcoQzCUqP/E/EOww5amODoDwP4gQVmr6Or99RgkSrjsLRDGkbwbjpKl5WEf9+ddf7iyEme5gqrthOqxKqjvEGA==` | The pinned source is 32 commits past `v0.43.5` and changes runtime code; the Git artifact lacks its compiled export | Rejected |

The final active baseline is `dsh-web-search-pro`, `dsh-memento`, `dsh-mcp-panel`, `dsh-checkpoint-rewind`, `dsh-lsp-actions`, and `@loongsuite/dsh-plugin`. The five build-bearing sources use exact npm versions with registry integrity. Memento remains a pinned Git dependency without an install lifecycle hook.

## Fresh Environment

- Evidence root: `/tmp/dsh-task19-reapply.eKLW3n`
- Runtime: Node `v24.14.0`; pnpm `11.7.0`
- Isolation: each profile used a separate DSH home, Corepack directory, pnpm home, npm cache, XDG cache, temporary directory, and pnpm store
- Environment: install and observed checks started with `env -i` and retained only explicit non-secret variables
- Time bound: every command used an outer limit of at most 54 seconds

## Final Profile Matrix

| Profile | Install | Selected | Observed `verify-lock` | Observed `preflight` | Observed `smoke-profile` |
| --- | ---: | ---: | --- | --- | --- |
| `web-curated` | 0 | 6 | pass, 0 issues | pass, accepted, 143 entries | pass: manifest, bundle-parse, dump-config, help |
| `web-coding` | 0 | 6 | pass, 0 issues | pass, accepted, 143 entries | pass: manifest, bundle-parse, dump-config, help |
| `web-research` | 0 | 6 | pass, 0 issues | pass, accepted, 143 entries | pass: manifest, bundle-parse, dump-config, help |
| `web-enterprise` | 0 | 6 | pass, 0 issues | pass, accepted, 143 entries | pass: manifest, bundle-parse, dump-config, help |
| `web-personal` | 0 | 0 | pass, 0 issues | pass, accepted, 137 entries | pass: manifest, bundle-parse, dump-config, help |

The four six-candidate profiles installed 106 packages each from separate empty stores and caches. Personal had no third-party dependencies. pnpm reported peer-dependency warnings but no install failure or lifecycle-build rejection.

## Additional Checks

- A negative preflight invocation replaced `sk-task19-final-sentinel` with `[REDACTED]` and returned the expected nonzero status.
- Official `web` and `headless` profile files retained identical SHA-256 values in all five homes: web manifest `210068ddb9ebc4cdf395ebb53020be6ccaaedb917e74dae16296d62394626398`, headless manifest `563c0b6082748a6e93daad51514f01335c51fc9c44f5f88253383f18ac2557b5`, patch `ef189a8c27db6d63930aa3046a3040482e952eafcb7487c644d508e8d461f027`, and workspace `ae7c5b68e2f157528e62885804e69e88583897b775e03c86fcbe52feaf498aba`.
- The pnpm registry lock parser accepts exact versions carrying pnpm peer suffixes while continuing to compare the exact base version and registry integrity.
- Browser testing does not apply: Task 19.2 exercises installation and CLI configuration parsing and does not start a Web server.

## Final Verification

- Curated tests and coverage: 360 tests passed across the five curated suites; every included source file reached 100% statements, branches, functions, and lines.
- Type safety and build: all five curated package typechecks, repository typecheck, and repository build passed.
- Static checks: workspace constraints and repository lint passed.
- Documentation: the five affected bilingual pairs are consistent; type-equivalent documentation and active Agent Note format checks passed. The overwritten subsystem summary was restored to the six-candidate baseline before the final pairing check.
- Registry metadata: fresh `npm view` responses matched all five exact versions and SHA-512 integrity values recorded in the catalog.
- Diff validation: unstaged and staged `git diff --check` passed. No Git history or index operation was performed.
- Final disk checks retained all five `npmVersion`/`npmIntegrity` pairs, the shared six-candidate templates, zero personal candidates, and no generated `allowBuilds`.
- Final scoped correctness and security review found no unresolved Task 19.2 defect or exploitable issue.

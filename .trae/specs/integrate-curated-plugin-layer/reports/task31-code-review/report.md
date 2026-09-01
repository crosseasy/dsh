# 代码评审报告

- 仓库：dsh
- 检测模式：通用检测
- 检测范围：HEAD current uncommitted Task 31 + untracked installed-lock.ts/spec (full_file)
- 生成时间：2026-08-31 00:20
- 检查文件：36
- 变更行数：2991

## 缺陷统计

- P0：0
- P1：4
- P2：1
- 合计：5

## 缺陷详情

### 1. [P1][安全漏洞] Post-validation activation does not bind all staged plugin bytes

- 位置：`apps/cli/src/plugin.ts:645-650`
- 置信度：10/10

**问题描述**

validateStagedCuratedProfile retains only the four generated profile files and the two lockfiles. The installed candidate directories under node_modules, whose package manifests, bundle patches, and executable modules were consumed during validation, are not retained or rehashed. With any active candidate, a same-permission process can replace or mutate those files after validation.files/locks are checked and before renameSync(stageDir, liveDir); every current assertCurrent/assertMoved call still succeeds and the unvalidated plugin bytes become live. The post-move check also omits ctimeNs, so a same-length mutation of a retained file with restored mtime can evade that check. This is the installed-candidate mutation branch of the prior staged-profile identity finding, and the new whole-directory replacement test does not exercise it.

**修复建议**

Bind and verify every selected installed candidate tree through activation, including package manifests, bundle patches, entry modules, and all tree-digest inputs. Retain those identities through the rename or revalidate the complete tree after the move and before deleting the previous profile; post-move checks for retained files should also compare ctimeNs.

---

### 2. [P1][安全漏洞] Npm peer-resolution drift is accepted across the two installed locks

- 位置：`packages/curated/curated-policy/src/installed-lock.ts:180-185`
- 置信度：10/10

**问题描述**

admitCandidate compares direct resolutions only when candidate.npmVersion is undefined. For npm candidates, root version 1.0.0(peer-a@1.0.0) and installed version 1.0.0(peer-b@1.0.0) both reduce to packageVersion 1.0.0 and can produce the same empty runtime closure, so admission succeeds despite different peer resolution contexts. The newly added rejects-different-npm-peer-resolutions test reproduces this and currently fails because no error is thrown, violating the specification that ordinary peer suffixes remain exact across observed lock evidence.

**修复建议**

Require sameDirectResolution(rootResolution, installedResolution) for npm candidates as well as Git candidates so the snapshotKey, package key, version, and source identity must match before closure comparison.

---

### 3. [P1][安全漏洞] Required benchmark asset validation follows symlinks outside its asset directory

- 位置：`packages/curated/curated-bench/src/invariant.ts:201-210`
- 置信度：10/10

**问题描述**

The new required-file checks call existsSync and then validateTaskSetAsset, whose shared readJsonObject helper uses readFileSync(path) directly. Replacing tasks/curated-tasksets.json with a symlink to a valid JSON file outside dirs.tasks therefore satisfies the presence and schema checks. This was reproduced against copies of the checked-in assets: validateCuratedBenchAssets returned [] with curated-tasksets.json linked outside the configured tasks directory. The same path-based helper is used for other mandatory top-level assets, so the static/release invariant can validate external bytes instead of the packaged benchmark assets.

**修复建议**

Read every required top-level benchmark asset with readContainedBenchmarkJson() or an equivalent descriptor-bound contained reader, rejecting symlinks and canonical paths outside the corresponding configured directory before parsing.

---

### 4. [P1][逻辑错误] Packed smoke fixture omits the now-mandatory no-script policy

- 位置：`packages/curated/curated-scripts/tests/packed-entry.e2e.ts:145-161`
- 置信度：10/10

**问题描述**

The current E2E fixture creates dsh-profile-web without .npmrc, then expects observed smoke to succeed. Fresh pnpm exec vitest run --config vitest.e2e.config.ts packages/curated/curated-scripts/tests/packed-entry.e2e.ts fails on all three attempts because staging now requires ignore-scripts=true. The paired README still claims a missing .npmrc is valid for legacy custom profiles, so both executable evidence and documentation remain inconsistent with the new policy.

**修复建议**

Write .npmrc with ignore-scripts=true when staging the managed custom profile, and update both curated-scripts README variants to remove the obsolete legacy exception.

---

### 5. [P2][业务语义问题] Curated scripts documentation still permits a profile state the commands reject

- 位置：`packages/curated/curated-scripts/README.md:16-16`
- 置信度：10/10

**问题描述**

profileMetadataIssues now emits preflight-profile-scripts-enabled whenever .npmrc is absent for any managed profile, and the new verify-lock/preflight/smoke regression test requires all three commands to fail. The README still says a missing .npmrc remains valid for legacy custom profiles, with the same stale statement in README.zh.md. Operators following the package contract will expect an accepted profile that the shipped commands now reject.

**修复建议**

Update the English and Chinese README paragraphs and pairing metadata to state that every managed custom profile must provide an .npmrc with exactly one effective ignore-scripts=true assignment.

---

# 代码评审报告

- 仓库：deepseek-harness
- 检测模式：通用检测（full_file，分组六组）
- 检测范围：当前完整 packages/curated/**、直接 CLI/boot bridge、scripts activation/audit
- 生成时间：2026-08-31 13:20
- 检查文件：126
- 变更行数：61720

## 缺陷统计

- P0：0
- P1：2
- P2：0
- 合计：2

## 缺陷详情

### 1. [P1][安全漏洞] 共享脱敏器会把 fine-grained GitHub PAT 原样写入 activation 诊断

- 位置：`packages/curated/curated-policy/src/index.ts:337-340`
- 置信度：9/10

**问题描述**

`scripts/verify-curated-activation-evidence.ts` 最终通过 `redactSecretLikeValues()` 清洗所有诊断，但这里的共享 `secretValuePattern` 和 `secretValueReplacementPattern` 只覆盖 `gh[pousr]_` 与 `sk-`，没有覆盖 GitHub fine-grained PAT 的 `github_pat_` 前缀。可复现路径是构造一个通过 `validateCandidateLock()` 的 active candidate，把 `github_pat_11AA22BB33CC44DD55EE66FF77GG88HH` 用作未知 profile key；`curatedActivationEvidenceIssues()` 返回的 `candidate ... names unknown curated profile ...` 会包含完整 token。该行为违反 catalog/profile secret 必须拒绝且诊断不得回显的要求，并可把凭证写入 CI/release 日志。

**修复建议**

让检测与替换正则同时覆盖 `github_pat_[A-Za-z0-9_]+`，并增加经 `curatedActivationEvidenceIssues()` 走完整入口、把该值放入 profile/path 等诊断标识的回归测试。

---

详情请参考完整报告：[report.html](file:///Users/bytedance/opencode/agent/dsh/.trae/specs/integrate-curated-plugin-layer/reports/task32-code-review-final-round8/report.html) ｜ [report.md](file:///Users/bytedance/opencode/agent/dsh/.trae/specs/integrate-curated-plugin-layer/reports/task32-code-review-final-round8/report.md)

### 2. [P1][安全漏洞] 产物目录哈希会漏掉枚举完成后新增的文件

- 位置：`packages/curated/curated-scripts/src/index.ts:1620-1687`
- 置信度：9/10

**问题描述**

`installedArtifactTreeSha256()` 先枚举目录得到 `files`，随后只逐个重新校验这些已发现文件，返回摘要前没有重新读取任何目录成员。因此另一进程可在某目录枚举结束后新增文件，该文件不会进入摘要，也不会触发任何 identity 检查。已通过隔离复现确认：在根目录枚举返回 `null` 后写入 `late-payload.js`，`runVerifyLock()` 仍返回 `status: 0` 且 `issues: []`。对 managed profile 的 verify-lock/preflight/smoke 也会经过同一函数，因而可能把包含 catalog 摘要之外新增代码的候选目录判为有效。

**修复建议**

像 CLI 安装事务的 `installedCandidateTreeSha256()` 一样，记录每个目录的 identity 与排序后的成员/type 列表，并在全部文件读取后重新校验目录 identity 和成员集合；验证根目录 identity 也应贯穿整个哈希过程。增加一个在 `opendirSync().readSync()` 返回末尾后插入文件的回归测试。

---

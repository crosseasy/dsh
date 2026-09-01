# 代码评审报告

- 仓库：dsh
- 检测模式：通用检测
- 检测范围：full_file: apps/cli/src/curated-profile-lock.ts, apps/cli/tests/curated-profile.spec.ts (HEAD context; untracked source included)
- 生成时间：2026-08-31 15:31
- 检查文件：2
- 变更行数：1010

## 缺陷统计

- P0：0
- P1：1
- P2：0
- 合计：1

## 缺陷详情

### 1. [P1][性能问题] Lock contention repeatedly spawns process-identity commands

- 位置：`apps/cli/src/curated-profile-lock.ts:392-392`
- 置信度：9/10

**问题描述**

When one curated install holds the lock, every 50 ms retry calls tryAcquireCuratedProfileLock(), which recomputes processStarted(process.pid). On macOS that synchronously launches /bin/ps, and on Windows it launches PowerShell. A normal concurrent install can hold the lock while pnpm runs, so the waiter may create hundreds or thousands of subprocesses before acquisition or the ten-minute timeout, consuming substantial CPU and process resources for an identity that cannot change during the waiting process.

**修复建议**

Resolve this process's start identity once before entering the retry loop and pass that retained identity into each claim attempt; continue checking the competing owner's current identity on every stale-lock decision.

---

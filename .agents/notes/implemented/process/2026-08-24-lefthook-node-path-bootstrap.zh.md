# Agent Note: Lefthook 包装脚本携带安装时的 Node PATH

Status: implemented

[English](2026-08-24-lefthook-node-path-bootstrap.md) | 中文

## Problem

GUI Git 客户端可能只带有极小的系统 `PATH` 来调用钩子。worktree 本地 Lefthook 包装脚本仍能启动，因为生成的钩子记录了 Lefthook 二进制文件的绝对路径；但 `lefthook.yml` 中的任务依赖 `node_modules/.bin/tsx` shebang 和 `pnpm run typecheck`。当 `PATH` 中缺少 Node/Corepack 目录时，`pre-push` 会在 typecheck 开始前失败，并输出 `sh: pnpm: command not found`。

## Decision

`lefthook install --force` 将钩子文件写入自有的 worktree 钩子目录后，`scripts/install-lefthook.mjs` 会重写每个常规 POSIX `#!/bin/sh` 钩子，把 `dirname(process.execPath)` 前置到 `PATH` 并导出。Windows 钩子文件保持不变。安装脚本保留已有所有权检查，并让已经带有该引导的包装脚本保持幂等。

导出的目录就是运行安装脚本的 Node 工具链，因此通过 Corepack 管理的 `pnpm` 和 `/usr/bin/env node` shebang 都能在终端和 GUI Git 客户端中解析。如果该 Node 安装路径移动，运行 `node scripts/install-lefthook.mjs` 会用当前路径重新生成包装脚本。

## Alternatives considered

**在 `lefthook.yml` 中写入绝对 `pnpm` 路径。** 不采用，因为 `lefthook.yml` 是共享源码，而 pnpm 可执行文件位置随开发者机器和 Node 安装而变化。

**依赖 shell 启动文件。** 不采用，因为 GUI Git 客户端通常不会运行用户交互式 shell 的启动路径，这正是已观察到的失败模式。

**为 GUI 客户端禁用 `pre-push`。** 不采用，因为快速增量 typecheck 是唯一的本地发布钩子；禁用后 GUI push 会弱于终端 push。

## Consequences

生成的 POSIX 钩子依赖安装时使用的 Node 可执行文件路径，与 Lefthook 已生成的绝对 Lefthook 二进制路径一致。安装脚本回归测试会检查生成钩子中的引导内容，clean-shell 钩子调用会验证本地包装脚本能在运行 `typecheck` 前解析 `pnpm`。

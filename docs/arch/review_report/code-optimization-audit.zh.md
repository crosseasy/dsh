# 当前代码仓库优化审查

[English](code-optimization-audit.md) | 中文

本参考页把 12 项代码仓库优化问题映射到当前实现与验证。每一行都链接到负责该行为的生产代码或有效 Agent Note。本文是可追溯性索引，不是实施清单，也不替代 [`docs/architecture.md`](../../architecture.zh.md)。

## 当前结论

仓库实现了全部 12 项变更及其必要验收覆盖。所审查路径没有已知未解决的实现或验证缺陷。

| 状态 | 数量 |
| --- | ---: |
| 已解决 | 12 |
| 未解决验证缺口 | 0 |
| 未解决实现缺陷 | 0 |

## 解决状态索引

| 编号 | 状态 | 当前实现、验证与权威说明 |
| --- | --- | --- |
| 1 | 已解决 | Settings [`describeForWire()`](../../../packages/settings/settings/src/redact.ts) 会拒绝无法安全脱敏的 schema 组合，移除 secret 默认值与不安全错误元数据，也是 ApiProxy 使用的唯一 Settings 描述路径。[`plugin-config-overlay.e2e.ts`](../../../apps/web/tests/plugin-config-overlay.e2e.ts)通过真实 Web 组合启动一个 overlay 包，让 Host namespace 与 `dsh.client` card 汇合，并通过 HTTP 断言保证 secret 值与默认值不会进入 wire。[fail-closed Settings wire](../../../.agents/notes/implemented/bug-fix/2026-08-25-fail-closed-settings-wire-description.zh.md)与 [plugin-owned settings surface](../../../.agents/notes/implemented/architecture/2026-08-12-plugin-owned-settings-surface.zh.md) Agent Note 记录相关决策。 |
| 2 | 已解决 | [`gatesForMode('hygiene')`](../../../scripts/run-gates.ts)让产物消费方依赖 `build`，[`workspace-residue.ts`](../../../scripts/workspace-residue.ts)让清理逻辑与工作区约束共用一份残留定义。[`run-gates.spec.ts`](../../../scripts/run-gates.spec.ts)中的进程冒烟测试会从无构建产物与已有构建产物两种状态运行完整门禁图，并保留未知目录失败。[parallel gate graph Agent Note](../../../.agents/notes/implemented/process/2026-07-06-parallel-pre-push-gates.zh.md)记录命令行为。 |
| 3 | 已解决 | Agent presets 会跟踪 generation holder、退役被替代的 generation，并在最后一个 agent 或冷读 lease 释放后恰好 dispose 一次。[generation reclamation Agent Note](../../../.agents/notes/implemented/bug-fix/2026-08-25-preset-generation-reclamation.zh.md)记录该生命周期。 |
| 4 | 已解决 | Settings 注册拥有 watcher 活跃状态和 tail；replacement reconciliation、提交点 revision 检查和 namespace 单调 RAW revision 在注册替换与暂时无 owner 时保持缓存和写入一致。[settings write-integrity Agent Note](../../../.agents/notes/implemented/architecture/2026-07-30-settings-write-path-integrity.zh.md)记录这些规则。 |
| 5 | 已解决 | Agent Instructions 使用三态根标记探测，遇到 unavailable 标记时停止向上搜索，并在 baseline 加载与 reconciliation 之间共用可配置的 UTF-8 总读取预算。[workspace-context Agent Note](../../../.agents/notes/implemented/feature/2026-06-24-workspace-context.zh.md)记录发现与 last-good 行为。 |
| 6 | 已解决 | ACP（Agent Client Protocol）复用共享的进程外 cwd、capability、settlement 和 run-handle helper，同时保留协议专用的取消与 EOF teardown。[TypeScript SDK/subagent Agent Note](../../../.agents/notes/implemented/feature/2026-07-27-typescript-sdk-and-sdk-subagent-backend.zh.md)记录该职责划分。 |
| 7 | 已解决 | 文件系统服务与提供方不包含 `FileSystem.lstat`、`FsPathInfo` 和仅供 provider 使用的 no-follow helper；真实安全或发布逻辑仍可直接调用平台 `lstat`。[filesystem simplification Agent Note](../../../.agents/notes/implemented/simplification/2026-08-25-remove-unconsumed-filesystem-lstat.zh.md)记录该删除。 |
| 8 | 已解决 | Session-reference 排序与准备逻辑是私有实现，`CompactionResult` 只保留有消费方的投影字段，tools 与 llm-retry 也只通过 `/testing` 子路径暴露确定性测试 helper。[session-reference](../../../.agents/notes/implemented/simplification/2026-08-25-session-reference-private-preparation.zh.md)与 [compaction](../../../.agents/notes/implemented/feature/2026-06-18-compaction-capability-seam.zh.md) Agent Note 记录产品接口；[tools](../../../packages/core/tools/README.zh.md) 与 [llm-retry](../../../packages/llm/llm-retry/README.zh.md) README 记录测试导出。 |
| 9 | 按限定范围解决 | `LocalSendLifecycle`、私有 persistent-tool runtime、one-shot executor、sandbox settlement 与纯 Shell 结果渲染消除共享生命周期重复。注册、审批、工作目录策略、提示词和 dialect 行为按设计继续由 Bash/Pwsh 适配器拥有。[one-shot](../../../.agents/notes/implemented/simplification/2026-08-25-one-shot-shell-runtime.zh.md)与 [persistent](../../../.agents/notes/implemented/simplification/2026-08-25-persistent-shell-tool-runtime.zh.md) Agent Note 记录该职责划分。 |
| 10 | 已解决 | `WorkflowStartRequest` 不携带 signal；返回的 `WorkflowRun` 独占取消，消费方通过启动前检查、启动后立即复查、移除监听器和等待 dispose 完全停稳来桥接 abort。[workflow cancellation Agent Note](../../../.agents/notes/implemented/simplification/2026-08-26-workflow-single-cancellation-owner.zh.md)记录该顺序。 |
| 11 | 已解决 | TypeScript 在共享 framing 上提供方向明确的 client/server JSON-RPC transport，Python 只公开 client 角色，Codex 则在私有 transport 中保留真实的双向初始化行为。[directional JSON-RPC Agent Note](../../../.agents/notes/implemented/simplification/2026-07-19-make-jsonrpc-directional.zh.md)记录协议角色。 |
| 12 | 已解决 | client fixture（测试前置数据）导入与生产投影相同的 plan、session statistics、token usage、context pressure 和 request composition fold；共享 event vector 测试会比较双方的 wire view。[projection-state Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-session-projection-state-and-client-views.zh.md)记录 client-safe 职责划分。 |

## 保留边界

- DeepSeek 与 pi-ai 适配器、JSONL 与 SQLite 持久化提供方继续保持独立实现。
- 保留 workflow progress、event 和 metadata，并保持 compaction Service Definition 与 basic provider 分离。
- 只共享 Shell 生命周期与纯结果投影；Bash 与 Pwsh 适配器继续拥有 dialect 和产品策略差异。
- Claude Code 与 Codex hook bridge 只共享真实 wire primitive，payload 与 dialect 映射继续分离。
- 不要仅因文件较长就拆分文件；在无法证明受维护依赖能保留限制、取消、平台行为与确定性测试要求时，不替换仓库现有 framing、atomic-write 和 timer 实现。
- `duplication` 返回零 clone 不表示没有语义重复；仍需分析所有权与行为。

链接的代码、包文档与 Agent Note 记录当前行为和决策依据，测试提供可执行证据。临时命令计数、分支名、提交哈希和实施顺序不属于这份当前状态索引。

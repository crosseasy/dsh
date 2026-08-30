# Task 26 文档报告

## 状态

DONE_WITH_CONCERNS

## 同步契约

- `SettingsProvider` 在 namespace 写队列开始执行时检查 `expectedRevision`，并把 `assertRevision` 传给 `persist(ns, section, assertRevision)`；提供方在内部对账完成后、首次改变存储前调用该 guard。
- 文件提供方在 writer lock 内完成磁盘对账后调用 guard。对账推进同 namespace revision 时，携带陈旧 `expectedRevision` 的写入以 `SettingsConflictError` 拒绝，且不覆盖外部值。
- 省略 `expectedRevision` 的写入仍按后写胜出处理；文件提供方继续保留其他 namespace 与尚未观察到的同级分节。

## 文档变更

- `packages/settings/settings/README.md`、`README.zh.md`：补充两次 revision 检查的时序、provider 的 `assertRevision` 调用义务，以及省略 revision 的语义。
- `packages/settings/settings-file/README.md`、`README.zh.md`：在读-改-写流程中加入 guard 提交点，并把无条件后写胜出限制收窄为省略 `expectedRevision` 的写入。
- `.agents/notes/implemented/architecture/2026-07-30-settings-write-path-integrity.md`、`.zh.md`：以当前时态记录 provider 约定、文件提供方写锁内检查和有无 `expectedRevision` 的分流；该 note 继续持有跨进程写入完整性与冲突语义，仍有未来决策价值，因此保持 active implemented。
- 三个 `.i18n.yaml` 由 `verify-translation-pairing --write` 重录。所有列出的目标文件都需要更新，没有无需修改的目标文件。

## Docs reviewer 修复

- settings README 的 teardown 语义明确为提交点 revision guard 通过后才改变存储；省略 `expectedRevision` 会通过 guard，陈旧期望值在存储改变前以 `SettingsConflictError` 拒绝。实际落盘的旧 owner 写入由当前 owner 重解析，将原始 revision 推进一次并发出一次 document event。

## 验证

- `gtimeout 55s pnpm run verify-translation-pairing --write packages/settings/settings/README.md`：PASS。
- `gtimeout 55s pnpm run verify-translation-pairing --write packages/settings/settings-file/README.md`：PASS。
- `gtimeout 55s pnpm run verify-translation-pairing --write .agents/notes/implemented/architecture/2026-07-30-settings-write-path-integrity.md`：PASS。
- `gtimeout 55s pnpm run verify-translation-pairing <三个目标 pair>`：PASS，三个具名 pair 一致。
- `gtimeout 55s pnpm run verify-doc-budgets`：PASS，9 份受预算约束的文档均未超限。
- `gtimeout 55s pnpm run verify-md-wrap`：PASS，检查 2030 个文件，无硬换行 prose 段落。
- 目标 `gtimeout 55s git diff --check -- <paths>`：PASS。

## Concerns

- 工作树中已有 Task 24/25 的 Settings 文档、代码、测试改动，以及 tasks/checklist/progress 改动；本次只在当前内容上补充 Task 26 文档契约，未覆盖或回滚这些并发改动。
- 按要求未运行或修改代码测试，也未执行 commit、push、merge、rebase、reset、add、restore 或 checkout。

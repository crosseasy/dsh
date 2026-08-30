# Task 26 实现报告

## 状态

DONE_WITH_CONCERNS

## 根因假设与证据

1. **已确认：基类只在进入 `persist()` 前检查 `expectedRevision`。** `FileSettingsProvider.persistSection()` 在写锁内执行 `reconcileFromDisk()`，该调用可通过 `publish()` 推进同 namespace revision，但旧写随后仍执行原子写回。
2. **已确认：Task 24 的 post-persist raw authority 修复只负责 revision/event 去重。** `beforeCommit` 在 `persist()` 返回后读取，此时陈旧写已覆盖磁盘，因此不能承担提交点冲突检查。
3. **已排除：缺陷由跨 namespace 基类 write queue 并行造成。** file provider 的单一 operation chain 和 writer lock 已串行化文件操作；最小真实 provider 用例在单次 persist 内稳定复现。

## RED

新增真实 `FileSettingsProvider` 回归用例：

```sh
gtimeout 55s pnpm exec vitest run packages/settings/settings-file/tests/concurrency.spec.ts -t "rejects a stale expected revision after persist reconciles the same namespace"
```

修改生产代码前退出码为 1。实际结果为 `status=resolved`、revision `2`、磁盘与 scope 均为 `{ value: 3 }`；期望为 `SettingsConflictError`（expected `0`、actual `1`）、revision `1`，并保留外部 `{ value: 2 }`。

## 实现

- `SettingsProvider.persist()` 接收基类提供的 `assertRevision` guard；基类在队首先检查一次，并由 provider 在内部 reconciliation 后、首次存储变更前再次检查。
- `FileSettingsProvider.persistSection()` 在持有 writer lock、完成 `reconcileFromDisk()` 后调用 guard，再渲染并原子写回。
- 所有仓库内 `SettingsProvider` 实现均已检查；唯一生产实现和测试 provider 均在存储变更前调用 guard。
- 未提供 `expectedRevision` 时 guard 为 no-op，保留 last-write-wins。

## GREEN

- 目标回归：1 passed。
- `packages/settings/settings/tests/settings.spec.ts`：99 passed。
- settings-file watcher/concurrency/lock-race：3 files、17 tests passed。
- `tsc -b`（settings 与 settings-file）：退出码 0。
- 目标 oxlint：16 files，0 warnings，0 errors。
- 目标 `git diff --check`：退出码 0。

## 自审

- Task 24 same-section publish：完整 Settings spec 通过，replacement revision 与 document event 保持单次推进。
- Task 26 stale expected revision：真实文件测试确认冲突发生在写盘前，外部值、scope 与 revision 均保留。
- 无 `expectedRevision`：guard 不执行比较，既有 last-write-wins 路径不变。
- Persist failure：guard 不推进 revision；lock-race failure suites 通过。
- Replacement owner、schema reject、namespace write queue：既有 Settings 99 tests 与 settings-file 17 tests 通过。
- 新增差异无 debug residue；验证命令生成的 `pnpm-lock.yaml` 差异已移除。
- 未执行 commit、push、merge、rebase、reset、add、restore 或 checkout；未编辑 tasks、checklist 或 progress。

## Concerns

- 用户在 focused 验证前要求停止扩大范围并立即写报告，因此没有继续更新 Settings README 与现有 write-integrity Agent Note 中的 protected `persist(ns, section)` provider contract 表述。JSDoc 已准确记录新增 guard 参数。
- 未运行全仓测试、全仓 typecheck 或全仓 lint；按最终指令仅执行 focused 验证。

## Reviewer Important 复审修复

### Finding

提交点 `assertRevision` 捕获发起写入的旧 registration。旧 owner 的写入等待 file lock 时，replacement owner 可以接管 namespace；随后锁内 reconciliation 发布外部不同 section，只推进 replacement revision。旧 guard 仍读取旧 revision，因此放过陈旧写并覆盖外部值。

### RED / GREEN

- RED：`gtimeout 55s pnpm exec vitest run packages/settings/settings-file/tests/concurrency.spec.ts -t "checks a replacement owner revision after waiting for the writer lock" --maxWorkers=1` 退出 1。旧写实际 resolved，磁盘和 replacement scope 从外部 `value: 2` 被覆盖为 `value: 3`，revision 从 1 推进到 2。
- GREEN：提交点 guard 改为读取 `this.registrations.get(ns)?.revision ?? registration.revision`。当前 owner 存在时以其 revision 为准；namespace 暂无 owner 时回退到发起 registration。相同目标命令 1 passed，并返回 `SettingsConflictError`（expected 0、actual 1），磁盘、replacement scope 和 revision 保持外部提交后的状态。
- 回归：Settings `99/99`；settings-file 5 suites、`50/50`；两个 package `tsc -b` 均退出 0；目标 oxlint 为 0 warnings、0 errors。

### 风险复审

- 省略 `expectedRevision` 时 guard 直接返回，last-write-wins 与旧写向 replacement 的正常 transfer 路径不变。
- same-owner 使用当前 registration revision；replacement 存在时使用 replacement revision；无 owner 时的显式 fallback 保留已进入 persist 的旧写。写入在进入 persist 前遇到 disposed/replaced owner 仍由既有队列检查拒绝。
- Task 24 same-section publish、replacement schema reject、service/registration disposal 和 persist failure 分支未改，由完整 Settings 与 settings-file suites 覆盖。
- 新回归通过真实 `FileSettingsProvider`、真实文件与 writer lock 执行；同步点读取 provider 的 operation tail 以证明旧写已进入持久化队列，最终断言只观察错误、磁盘、replacement scope 和 revision。

# Task 27 实现报告

## 状态

DONE

## 根因假设与证据

1. **已确认：registration-owned revision 在 replacement 时重置并发生数字碰撞。** 当前源码把 `revision: 0` 放在 `SettingsRegistration` 上；最小 probe 得到旧 owner `opened=1`、replacement 初始 `0`、外部 publish 后 `1`，因此提交点 guard 把陈旧的 `expectedRevision=1` 错认成当前值。
2. **已确认：无 owner 时 publish 不推进 revision。** 当前 `publish()` 只遍历 live registrations；最小 probe 得到旧 owner dispose 前 revision `1`，无 owner publish 外部值后，新 registration 读取外部值但 revision 回到 `0`。
3. **已排除：writer lock 或 write queue 未串行化。** 两个真实文件用例都在 `<file>.lock` 已存在时启动旧写，并通过 provider operation tail 确认写入已进入持久化链；错误发生在锁释放后的 reconciliation 与 commit-point revision 比较。

## RED

命令：

```sh
gtimeout 55s pnpm exec vitest run packages/settings/settings-file/tests/concurrency.spec.ts -t "stale nonzero revision|namespace has no owner" --maxWorkers=1
```

修改生产代码前退出码为 1，两个新增用例均失败：

- replacement 数字碰撞场景错误 resolved，外部 `value: 2` 被覆盖为 `value: 3`，replacement 收到 revision `1` 和 `2` 两次 document event。
- no-owner 场景错误 resolved，外部 `value: 2` 被覆盖为 `value: 3`，后续 registration revision 重置为 `0`。

## 实现

- `SettingsProvider` 新增 provider-owned `Map<SettingsNamespace, number>`，仅在 namespace 首次成功注册后开始跟踪，并在 provider 生命周期内跨 replacement 和无 owner 空窗保留。
- registration 不再持有 revision；`register()` 初始化 authority，`describe()`、`describeForWire()`、队首检查和 provider commit-point guard 均读取同一 authority。
- `publish()` 先比较所有曾注册 namespace 的前后 RAW section 并推进 authority，再只为当前 registrations 解析和提交 resolved 值。无 owner 时 revision 静默推进，不虚构 watcher、`settings/updated` 或 `settings/document-updated`。
- 写入落盘后同样先依据提交前后的 RAW section 推进 authority，再按当前 owner 执行 same-owner 或 replacement commit。Task 24 的 same-section 去重继续由 RAW equality 保证。

## 回归覆盖

- 非零 replacement：旧 owner 先到 revision `1`，陈旧写等待锁；replacement 接管后外部 section 推进 authority 到 `2`。旧写以 `SettingsConflictError` 拒绝，错误携带 expected `1`、actual `2`，磁盘、scope、descriptor、watcher 和事件均保留外部提交状态。
- no-owner：旧 owner revision `1` 的写等待锁并在 dispose 后留下 owner 空窗；外部 reconciliation 静默推进 authority 到 `2`。旧写冲突且不覆盖磁盘，后续 registration 读取外部值和 revision `2`，空窗期无通知。
- 既有语义保持：Task 24 same-section 只推进一次；Task 26 same-owner/replacement guard；省略 `expectedRevision` 的 last-write-wins；无外部变化时旧写 transfer 到 replacement；schema reject 推进 RAW revision并保留 last-good resolved；dispose 和 write queue 行为。

## GREEN

- Task 27 定向用例：2 passed。
- Settings 完整测试：3 files、123 tests passed。
- Settings-file 完整测试：5 files、52 tests passed。
- 相关 Settings consumers：6 files、66 tests passed。
- `gtimeout 55s pnpm exec tsc -b packages/settings/settings/tsconfig.json --pretty false`：退出码 0。
- `gtimeout 55s pnpm exec tsc -b packages/settings/settings-file/tsconfig.json --pretty false`：退出码 0。
- 目标 oxlint：15 files，0 warnings，0 errors。
- 目标 `git diff --check`：退出码 0。

## Revision 调用审计

`revision` 的初始化只剩首次成功 registration 对 provider map 的 `0` 初始化；descriptor 读取和两个 guard 均调用 `revisionOf(ns)`；RAW 递增只剩 `bumpRevision(ns, before, after)`；write commit 与 publish 均通过该方法推进。不存在 `registration.revision`、registration replacement 重置或旁路递增。

## 改动文件

- `packages/settings/settings/src/index.ts`
- `packages/settings/settings-file/tests/concurrency.spec.ts`
- `packages/settings/settings/README.md`
- `packages/settings/settings/README.zh.md`
- `packages/settings/settings/README.i18n.yaml`
- `.agents/notes/implemented/architecture/2026-07-30-settings-write-path-integrity.md`
- `.agents/notes/implemented/architecture/2026-07-30-settings-write-path-integrity.zh.md`
- `.agents/notes/implemented/architecture/2026-07-30-settings-write-path-integrity.i18n.yaml`
- `.trae/specs/execute-code-optimization-audit/reports/task-27-report.md`

## 文档

Settings README 英中对侧文件明确了 provider-owned revision 跨 registration replacement 与无 owner 空窗保持单调、只随 RAW section 变化推进、replacement 本身不使同一 section 的 `expectedRevision` 陈旧，以及 `settings/document-updated` 只在变化时存在 owner 才触发。

write-integrity Agent Note 英中对侧文件记录了相同机制、disposed old write 的提交点 guard，以及无 `expectedRevision` 时的 last-write-wins；两组 sidecar 记录对应正文的当前 blob hash。

## Concerns

- 未运行全仓测试、全仓 typecheck、全仓 lint 或 coverage；按用户最终指令停止在上述 focused 验证。
- 共享工作树包含大量既有改动；本任务未回滚或改写无关文件，也未执行任何 Git 写操作。

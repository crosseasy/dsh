# Task 24 实现报告

## 状态

DONE

## 根因假设与证据

1. **已确认：`write()` 在 `await persist()` 前捕获的 `current` 已过期。** Provider 可在 `persist()` 返回前调用 `publish()`；此时 replacement owner 已依据相同 raw section 推进到 revision 1。旧写恢复后仍以 await 前的 `current` 比较 `section`，于是再次推进到 revision 2 并重复发出 `settings/document-updated`。源码链路为 `SettingsProvider.write()` 的 `current` 捕获、`await this.persist()`、replacement `bumpRevision()`；`FileSettingsProvider.persistSection()` 的 `reconcileFromDisk()` 会在 persist await 内调用 `publish()`。
2. **已排除：文件 watcher 回放了 provider 自写。** `FileSettingsProvider` 在写后更新 `this.text`，相同文本的后续 `reconcileFromDisk()` 直接返回；无 watcher 的 concrete provider 在 `persist()` 内同步 `publish()` 仍可稳定复现。
3. **已排除：replacement registration 从 revision 0 开始是错误的。** 第一次 `publish()` 从 0 推进到 1 符合现有注册语义；第二次推进发生于旧写恢复后使用过期比较基准。

确认缺陷为 Concurrency/P1：正常 provider 时序可稳定触发 raw revision 和文档事件重复推进。

## RED

命令：

```sh
gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/settings.spec.ts -t "does not advance a replacement revision again when persist publishes the same section"
```

结果：退出码 1。新增用例期望 `{ revision: 1, documentEvents: [['ui-theme', 1]] }`，实际得到 `{ revision: 2, documentEvents: [['ui-theme', 1], ['ui-theme', 2]] }`，与根因一致。

## 改动文件

- `packages/settings/settings/src/index.ts`：`persist()` 返回后读取最新已发布 raw section，随后以该值作为 revision 比较基准；未发布或发布不同 section 时仍按真实 raw 变化推进。
- `packages/settings/settings/tests/settings.spec.ts`：为 concrete provider 增加一次性“persist 返回前 publish”控制，并新增 replacement registration 时序回归用例。
- `.trae/specs/execute-code-optimization-audit/reports/task-24-report.md`：本报告。

## GREEN

- `gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/settings.spec.ts -t "does not advance a replacement revision again when persist publishes the same section"`：1 passed。
- `gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/settings.spec.ts`：99 passed。
- `gtimeout 55s pnpm exec vitest run packages/settings/settings-file/tests/watcher.spec.ts packages/settings/settings-file/tests/concurrency.spec.ts packages/settings/settings-file/tests/lock-race.spec.ts`：16 passed。
- `gtimeout 55s pnpm exec tsc -b packages/settings/settings/tsconfig.json --pretty false`：退出码 0。
- `gtimeout 55s pnpm exec tsx scripts/run-oxlint.ts packages/settings/settings/src/index.ts packages/settings/settings/tests/settings.spec.ts`：0 warnings，0 errors。
- 覆盖率模式运行同一 settings 测试文件时 99 tests passed；命令因仓库配置对所有未运行 package 强制 100% 覆盖率而退出 1。Cobertura 记录显示 Task 24 改动路径已执行；按要求未扩大到全仓覆盖率门禁。

## 自审

- `git diff --check` 通过。
- Scope：仅修改 Settings Service Definition、其既有测试文件和指定报告；未处理 Task 25，未修改受禁的 tasks/checklist/progress 文件。
- Race 分支：provider 未 publish 时保持原单次推进；publish 相同 section 时去重；publish 不同 section 时最终写入仍产生对应推进；replacement 解析失败仍先记录 raw revision，保持 last-good resolved value。
- 既有语义：external publish、watcher 排队/停稳、写队列和 listener containment 未改，相关 115 个测试通过。
- 无调试残留或新增孤儿 import。现有 `TODO` 与本任务无关，未触碰。
- README 与 Settings write-integrity Agent Note 的现有表述仍准确，无需同步。

## 剩余风险

- 未运行全仓测试、全仓 lint 或全仓 coverage；按任务要求仅执行 Settings 相关验证。focused coverage 的退出码只反映未运行 package 无法满足仓库全局 100% 阈值，不代表本次测试失败。

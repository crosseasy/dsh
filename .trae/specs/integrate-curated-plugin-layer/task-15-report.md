Status: DONE_WITH_CONCERNS

## 实现内容

- 修复 observed preflight 的同层重复验证缺口：在 observed profile 的每个原始 bundle/profile patch layer 进入 `composeEntries()` 前扫描重复 entry id，避免同层 `insert` 后 `{ id, config }` 覆盖被 Cordis compose 合并后漏报。
- 当前工作树中 `sameStrings` 已对左右两侧排序后比较，覆盖 artifact dependency 与 smoke bundle list 的顺序无关比较。
- 当前工作树中 `*Env` 字段允许合法环境变量名引用，同时仍拒绝 `ghp_*`、`sk-*` 等 secret-like 值。
- 当前工作树中 smoke staging 失败会返回结构化 JSON，保留 `observed`、`profile`、`stages`，并脱敏 staging error。

## TDD Evidence

RED:

```sh
timeout 55s node_modules/.bin/vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t "rejects duplicate entry ids within one observed patch layer"
```

关键输出：退出码 1；`AssertionError: expected +0 to be 1` at `commands.spec.ts:1555`，证明同层重复被错误接受。

GREEN:

```sh
timeout 55s node_modules/.bin/vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t "rejects duplicate entry ids within one observed patch layer"
```

关键输出：退出码 0；`1 passed | 150 skipped`。

## 其他验证命令与结果

```sh
timeout 55s node_modules/.bin/vitest run packages/curated/curated-scripts/tests/commands.spec.ts -t "normalizes observed dependency and install-script ordering|compares installed and selected bundle lists without regard to order|accepts Cordis overrides across observed layers|rejects duplicate entry ids within one observed patch layer|accepts environment variable names in secret-bearing Env fields|preserves observed profile and stage diagnostics when staging fails"
```

结果：退出码 0；`6 passed | 145 skipped`。

```sh
timeout 55s pnpm exec tsx -e "..."
```

结果：退出码 1；pnpm 在执行前触发 install/status 检查，因 `.git/dsh-hooks` ownership 保护失败；未作为项目失败处理，后续改用 `node_modules/.bin/*`。

未运行：五个 curated profile 的真实 preflight 与 smoke。原因是收到截止指令要求立即停止扩大范围。

## Files changed

- `packages/curated/curated-scripts/src/index.ts`
- `packages/curated/curated-scripts/tests/commands.spec.ts`
- `.trae/specs/integrate-curated-plugin-layer/task-15-report.md`

## Self-review findings / concerns

- Concern: Task 15.4 要求重新验证五个 curated profile 的 preflight 与 smoke；截止指令到达前尚未执行该矩阵。
- No known implementation blocker remains in the focused Task 15 logic.
- 未执行 git commit/push/merge/rebase/reset，未 stage 文件。

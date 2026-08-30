# Task 24-27 最终只读验证

日期：2026-08-26

角色：只读 verifier。唯一授权写入是本报告。

## Verdict

VERDICT: FAIL

- 必需命令组：12/13 通过，1/13 失败，0 个超时。
- 唯一阻塞项：`pnpm run hygiene` 的 `knip` gate 失败，发现 `packages/curated/curated-scripts/tests/packed-entry.e2e.ts` 未使用，以及 `packages/curated/curated-scripts/package.json` 中 `@deepseek-ai/dsh` 依赖未使用。
- 上述两项均位于共享工作树的非 Task 24-27 范围，但本次要求的是全局 `hygiene`，因此不能声明最终全局通过。
- Checklist 24-27 的目标语义：4/4 满足；定向复跑 7/7 tests passed。
- 其余必需检查均在 55 秒内退出 0。

## 范围

验证前已读取：

- `tasks.md` 中 Task 24-27。
- `checklist.md` 中对应四项。
- `task-24-report.md`、`task-25-report.md`、`tasks-24-25-final-verification.md`、`task-26-report.md`、`task-26-docs-report.md`、`task-27-report.md`。
- 当前 `HEAD` 相对 staged/unstaged target diff。

Task 24-27 target 共 34 个 tracked changed paths：19 个 TS 文件、Settings/Settings-file/llm-pi-ai 的 9 个 README pair 文件，以及 write-integrity/fail-closed Note 的 6 个 pair 文件。

## 必需命令

所有命令均使用 `gtimeout 55s`，并按要求顺序运行。

### 1. 目标包测试

```sh
gtimeout 55s pnpm exec vitest run packages/settings/settings/tests packages/settings/settings-file/tests packages/llm/llm-pi-ai/tests
```

退出码：0。结果：PASS，19 files、443 tests passed。

### 2. persist 签名机械更新测试

```sh
gtimeout 55s pnpm exec vitest run packages/interaction/permission-presets/tests/permission-presets.spec.ts packages/web/web-search-deepseek/tests/settings.spec.ts packages/client/ui-conversation/tests/host.client.spec.ts packages/client/ui-settings-general/tests/host.client.spec.ts packages/client/locale/tests/host.client.spec.ts packages/client/ui-theme/tests/host.client.spec.ts packages/shell/bash-local/tests/settings.spec.ts packages/shell/pwsh-local/tests/settings.spec.ts packages/host/apiproxy/tests/api-proxy-config.spec.ts packages/core/agent-default-model/tests/agent-default-model.spec.ts packages/core/agent-loop/tests/settings.spec.ts
```

退出码：0。结果：PASS，11 files、91 tests passed。

### 3. 目标包 TypeScript

```sh
gtimeout 55s pnpm exec tsc -b packages/settings/settings/tsconfig.json packages/settings/settings-file/tsconfig.json packages/llm/llm-pi-ai/tsconfig.json --pretty false
```

退出码：0。结果：PASS，无 diagnostics。

### 4. Task 24-27 全部变更 TS 文件 oxlint

```sh
gtimeout 55s pnpm exec tsx scripts/run-oxlint.ts packages/settings/settings/src/index.ts packages/settings/settings/src/redact.ts packages/settings/settings/tests/memory.ts packages/settings/settings/tests/redact.spec.ts packages/settings/settings/tests/settings.spec.ts packages/settings/settings-file/src/index.ts packages/settings/settings-file/tests/concurrency.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts packages/interaction/permission-presets/tests/permission-presets.spec.ts packages/web/web-search-deepseek/tests/settings.spec.ts packages/client/ui-conversation/tests/host.client.spec.ts packages/client/ui-settings-general/tests/host.client.spec.ts packages/client/locale/tests/host.client.spec.ts packages/client/ui-theme/tests/host.client.spec.ts packages/shell/bash-local/tests/settings.spec.ts packages/shell/pwsh-local/tests/settings.spec.ts packages/host/apiproxy/tests/api-proxy-config.spec.ts packages/core/agent-default-model/tests/agent-default-model.spec.ts packages/core/agent-loop/tests/settings.spec.ts
```

退出码：0。结果：PASS，19 files、0 warnings、0 errors。

### 5. 具名 translation pairing

```sh
gtimeout 55s pnpm run verify-translation-pairing packages/settings/settings/README.md packages/settings/settings-file/README.md packages/llm/llm-pi-ai/README.md .agents/notes/implemented/architecture/2026-07-30-settings-write-path-integrity.md .agents/notes/implemented/bug-fix/2026-08-25-fail-closed-settings-wire-description.md
```

退出码：0。结果：PASS，5 named pairs consistent。

### 6. 全局 typecheck

```sh
gtimeout 55s pnpm run typecheck
```

退出码：0。结果：PASS，host build 与 contracts-ready client typecheck 完成，无 diagnostics。

### 7. 全局 lint

```sh
gtimeout 55s pnpm run lint
```

退出码：0。结果：PASS，2,646 files、0 warnings、0 errors。

### 8. duplication

```sh
gtimeout 55s pnpm run duplication
```

退出码：0。结果：PASS，1,218 files、270,816 lines、1,375,749 tokens，0 clones。

### 9. doc-sync

```sh
gtimeout 55s pnpm run doc-sync
```

退出码：0。结果：PASS，28 passed、0 failed、0 skipped，34.75s。

### 10. build

```sh
gtimeout 55s pnpm run build
```

退出码：0。结果：PASS，host/client/Vite production builds 完成，记录 200 个 client artifacts。输出包含非失败的依赖 bundling、平台和 chunk-size warnings。

### 11. hygiene

```sh
gtimeout 55s pnpm run hygiene
```

退出码：1。结果：FAIL，13 passed、1 failed、0 skipped，15.77s。

失败 gate：`knip`，计数为 1 个 unused file 和 1 个 unused dependency：

- `packages/curated/curated-scripts/tests/packed-entry.e2e.ts`
- `@deepseek-ai/dsh` at `packages/curated/curated-scripts/package.json:52:6`

该失败不是超时，因此未运行超时替代命令。失败路径不在 Task 24-27 target 中，但全局 gate 仍为失败。

### 12. whitespace

```sh
gtimeout 55s git diff --check
gtimeout 55s git diff --cached --check
```

退出码：0、0。结果：PASS，无 whitespace errors。

### 13. target scope

```sh
gtimeout 55s sh -c 'git diff HEAD --name-only -- vendor | wc -l'
```

退出码：0。结果：PASS，vendor target diff count 为 0。

```sh
gtimeout 55s git status --short -- .agents/notes/archived
```

退出码：0。结果：当前共享工作树存在 Round 5 已有的 archived manifest 修改和两个新归档 triplet；Task 24-27 的 34 个 target paths 不含 archived Note，未发现本轮新增 archived diff。

```sh
gtimeout 55s sh -c 'git diff HEAD -U0 -- packages/settings/settings/src/index.ts packages/settings/settings/src/redact.ts packages/settings/settings/tests/memory.ts packages/settings/settings/tests/redact.spec.ts packages/settings/settings/tests/settings.spec.ts packages/settings/settings-file/src/index.ts packages/settings/settings-file/tests/concurrency.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts packages/interaction/permission-presets/tests/permission-presets.spec.ts packages/web/web-search-deepseek/tests/settings.spec.ts packages/client/ui-conversation/tests/host.client.spec.ts packages/client/ui-settings-general/tests/host.client.spec.ts packages/client/locale/tests/host.client.spec.ts packages/client/ui-theme/tests/host.client.spec.ts packages/shell/bash-local/tests/settings.spec.ts packages/shell/pwsh-local/tests/settings.spec.ts packages/host/apiproxy/tests/api-proxy-config.spec.ts packages/core/agent-default-model/tests/agent-default-model.spec.ts packages/core/agent-loop/tests/settings.spec.ts | awk '\''/^\+\+\+/ { next } /^\+/ && /(console\.(log|debug|warn|error)|debugger|TODO|FIXME|XXX)/ { count++ } END { print count+0 }'\'''
```

退出码：0。结果：PASS，新增行中的 `console.log/debug/warn/error`、`debugger`、`TODO`、`FIXME`、`XXX` 命中数为 0。

本次验证未执行 `commit`、`push`、`merge`、`rebase`、`reset`、`add`、`restore` 或 `checkout`。此陈述仅基于本 verifier 当前行动；不对进入本次验证前的工作树历史作无法证实的推断。

## Checklist 24-27

补充定向命令：

```sh
gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/settings.spec.ts packages/settings/settings-file/tests/concurrency.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts -t 'does not advance a replacement revision again when persist publishes the same section|reports .* headers without exposing their names or values|rejects a stale expected revision after persist reconciles the same namespace|rejects a stale nonzero revision that collides after owner replacement|rejects a stale write after reconciliation while the namespace has no owner' --maxWorkers=1
```

退出码：0。结果：PASS，3 files、7 passed、114 skipped。

- Task 24，same-section exactly-once：PASS。真实 provider 时序用例断言 replacement revision 为 `1`，`settings/document-updated` 仅为 `[['ui-theme', 1]]`。
- Task 25，headers false/false/true 且无泄露：PASS。真实 `Config` 与 `describeForWire()` 覆盖 omitted、empty、non-empty 三例，`set` 分别为 false、false、true；header 名称和值不进入 value、schema、序列化可观察输出或错误文本。
- Task 26，persist 内 same-owner stale conflict：PASS。真实 `FileSettingsProvider` 用例断言 `SettingsConflictError` 的 expected/actual 为 `0/1`，磁盘、scope 和 revision 保留外部 `{ value: 2 }`/revision `1`。
- Task 27，namespace revision 跨 replacement/nonzero collision/no-owner 单调：PASS。非零碰撞用例断言 expected/actual 为 `1/2`，replacement descriptor revision 为 `2` 且保留外部值；no-owner 用例断言 reconciliation 静默推进到 revision `2`，陈旧写冲突，后续 owner 继承 revision `2`。

## 范围判断与缺口

- 未运行 coverage，符合明确禁令。
- 未运行浏览器。Task 24-27 没有 UI component 代码增量；Task 25 的 wire 行为由真实 `llm-pi-ai` `Config` 解析和 `describeForWire()` 覆盖，Task 24/26/27 由真实 Settings/FileSettingsProvider 时序覆盖。该范围不需要 Chrome/CDP 验证。
- 无命令超时，因此没有以叶级命令替代超时全局命令。
- `hygiene` 的非目标 `knip` 失败是唯一最终阻塞项。目标测试、类型、lint、文档配对、build、whitespace 和四项语义本身均有通过证据，但不能据此声称全局验证通过。

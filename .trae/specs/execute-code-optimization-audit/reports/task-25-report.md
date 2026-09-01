# Task 25 报告

状态：DONE

## 根因假设与证据

1. 假设 A：Schemastery 会把省略的 `z.dict(...)` 物化为 `{}`，Settings redaction 再以 `value !== undefined` 判断 secret 是否已设置，因此 omitted 与 empty 都误报 `set: true`。
2. 假设 B：Settings 的 layer merge 或 `describeForWire()` 选择 resolved layer 的过程单独制造了空对象，因此应修改 descriptor 的数据来源。

最小复现通过 `node --import tsx/esm --input-type=module` 直接解析 `llm-pi-ai` 的 `Config` 并调用 `describeForWire()`：omitted、empty、non-empty 的解析结果都存在 `headers`，条目数依次为 0、0、1，修复前 sidecar 的 `set` 依次为 true、true、true。schema 检查同时确认 `headers` 节点为 `type: "dict"`、`role: "secret"`，其 Schemastery 默认值为 `{}`。因此假设 A 成立，假设 B 排除：误判在解析结果进入 Settings layer merge 前已经存在。

## RED

命令：

```sh
gtimeout 55s pnpm exec vitest run packages/llm/llm-pi-ai/tests/config.spec.ts
```

结果：退出码 1；14 项中 2 项失败。omitted 与 empty 均预期 `set: false`、实际 `set: true`；non-empty 以及 header 名称和值不出现在 wire value、schema、异常文本或序列化可观察输出中的断言通过。

补充所有权层 RED：

```sh
gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/redact.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts
```

结果：退出码 1；33 项中 3 项失败，分别为 Settings 空 secret dict 以及 `llm-pi-ai` omitted/empty 两例，失败原因均为 `set:true`。

## 改动

- `packages/settings/settings/src/redact.ts`：secret-role `dict` 仅在至少包含一个条目时报告已设置；缺失值与空 dict 报告 `set: false`。scalar、secret `object`、secret `array` 和 malformed present value 保持既有判定。
- `packages/settings/settings/tests/redact.spec.ts`：锁定空 secret dict 与 scalar/object/array 的边界语义。
- `packages/llm/llm-pi-ai/tests/config.spec.ts`：使用真实 `Config` schema 覆盖 omitted/empty/non-empty headers，并检查 header 名称和值不进入 value、schema、错误文本或其他序列化输出。
- `packages/settings/settings/README.md`、`README.zh.md`、`README.i18n.yaml`：同步 sidecar `set` 语义。
- `packages/llm/llm-pi-ai/README.md`、`README.zh.md`、`README.i18n.yaml`：同步 headers 三态语义。
- `.agents/notes/implemented/bug-fix/2026-08-25-fail-closed-settings-wire-description.md`、`.zh.md`、`.i18n.yaml`：同步既有 fail-closed 决策记录；中文标题的既有工作树改动保持不变。

没有修改 `packages/settings/settings/src/index.ts`、`packages/settings/settings/tests/settings.spec.ts` 或 Task 24 文件；这些文件的既有工作树改动均保留。

## GREEN

- `gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/redact.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts`：2 files，33 tests passed。
- `gtimeout 55s pnpm exec vitest run packages/settings/settings/tests`：3 files，122 tests passed。
- `gtimeout 55s pnpm exec vitest run packages/llm/llm-pi-ai/tests`：11 files，268 tests passed。
- `gtimeout 55s pnpm exec tsc -b packages/settings/settings/tsconfig.json --pretty false`：通过。
- `gtimeout 55s pnpm exec tsc -b packages/llm/llm-pi-ai/tsconfig.json --pretty false`：通过。
- `gtimeout 55s pnpm exec tsx scripts/run-oxlint.ts packages/settings/settings/src/redact.ts packages/settings/settings/tests/redact.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts`：0 warnings，0 errors。
- `gtimeout 55s pnpm run verify-translation-pairing packages/settings/settings/README.md packages/llm/llm-pi-ai/README.md .agents/notes/implemented/bug-fix/2026-08-25-fail-closed-settings-wire-description.md`：3 个配对一致。
- `gtimeout 55s pnpm run verify-type-equiv`：400 个 type-equiv 与 400 个双语派生块通过。
- `gtimeout 55s pnpm run verify-doc-budgets`：9 个受预算约束文档通过。
- `gtimeout 55s pnpm run verify-md-wrap`：2030 个文件通过。
- 目标文件 `git diff --check`：通过。

两次带 `--incremental false` 的初始 package typecheck 调用因 composite project 不允许禁用 incremental 而退出码 2；移除该无效参数后，上述两个 `tsc -b` 命令均通过。

## 自审

- Public config/wire：`headers` 仍是一个整体只写 secret slot，sidecar 路径仍仅为 `providers.<route>.headers`。
- 空值边界：仅空 secret `dict` 改为 `set: false`；空字符串、空 secret `object`、空 secret `array` 保持 `set: true`，非空 dict 为 `set: true`。
- 泄露检查：测试中的非空 header 名称和值均不出现在 wire value、schema、异常文本或序列化可观察输出；实现没有新增日志或错误文本。
- Scope drift：生产修改仅 4 行行为/JSDoc；其余是针对性测试和必要的双语契约同步。未处理 Task 24，未覆盖共享工作树的既有改动。
- Debug residue：目标源码与测试没有新增 `console.*`、`debugger`、`TODO`、`FIXME` 或 `XXX`。

## 剩余风险

按用户要求未扩大到全仓门禁；相关 package 测试、typecheck、目标 lint 和必要文档检查均已覆盖。Vitest 输出包含仓库现有的 `vite-tsconfig-paths` 弃用提示，不影响测试结果。

## Reviewer finding 修复

Important finding：secret dict 的空值判断复用了宽松的 `isRecord()`，使零 enumerable keys 的 `Date`、`Map` 等 present malformed value 被误报为 `set: false`。修复将 unset 收窄为原型为 `Object.prototype` 或 `null` 的空 plain record；其他 present value 继续报告 `set: true`。

### Reviewer RED

`gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/redact.spec.ts`：退出码 1；新增的 present `Date` 用例预期 `set: true`、实际 `set: false`，其余 19 项通过。

### Reviewer GREEN

- `gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/redact.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts`：2 files，34 tests passed。
- `gtimeout 55s pnpm exec tsx scripts/run-oxlint.ts packages/settings/settings/src/redact.ts packages/settings/settings/tests/redact.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts`：0 warnings，0 errors。
- `gtimeout 55s pnpm exec tsc -b packages/settings/settings/tsconfig.json --pretty false`：通过。
- 目标源码与测试的 `git diff --check`：通过。

### Reviewer 自审

- 行为范围：仅 schema 为 secret `dict`、值为 plain record 且无 own enumerable keys 时报告 unset；omitted、非空 dict、scalar、secret object、secret array 的既有语义不变。
- Malformed value：零 enumerable keys 的 present `Date` 由回归测试锁定为 `set: true`；同类非 plain object 不再进入空 dict 分支。
- Redaction：值仍在记录 `{ path, set }` 后直接移除，没有新增序列化、日志或错误文本，泄露语义不变。
- 文档：现有 README 与 JSDoc 已准确表述“空 secret dict 为 unset”，本次仅修正实现以符合该事实，无需修改 docs。
- Scope：只增量修改 `redact.ts`、`redact.spec.ts` 和本报告，未处理其他问题或覆盖共享工作树中的既有改动。

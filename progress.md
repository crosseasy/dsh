# Superpowers 实施进度

## 2026-08-29

### 已完成

- 接收目标：严格审查并实现 `docs/plugin/superpowers` 全部功能；自动推进；禁止 commit/push。
- 检查 Git 状态，确认当前工作树包含大量既有未提交改动，后续必须原地保留。
- 运行 planning-with-files 会话恢复脚本并读取上一会话未同步摘要。
- 运行 `git diff --stat HEAD` 建立 404 文件、约 37k+ 新增行的改动基线。
- 启动两个只读审查：规范审查与现有实现盘点；另启动既有验收记录审查。
- 创建持久化计划、发现和进度文件。
- `git diff --check` 与 `git diff --cached --check` 均通过，无空白错误。
- 已在后台启动 curated 核心包、CLI 激活路径、packed entry 与仓库级审计器的聚焦 Vitest 基线。

### 进行中

- 根据协调任务新增安全收口：修复 tracked activation evidence 从 Git index 校验到路径读取之间的祖先 symlink TOCTOU，以及 `.npmrc` 前缀键误匹配和重复安全键未 fail-closed；补直接 adversarial 测试、curated-scripts 双语 README 与现有治理 Agent Note。
- 当前目标文件已有其他并行改动；本轮使用窄函数编辑并在写入前重新读取，避免覆盖共享工作树变化。
- 根据生命周期复审结论实现 #3/#6/#7/#8/#9/#10/#12/#13；范围限制为 CLI、curated-profiles、curated-policy、直接测试/README 与现有治理 Agent Note。
- 五路并行修改已分派：profile 物化事务；权限顺序；plugin 安装事务与只读语义；#10 允许范围设计；watcher setup rollback。
- 合流后统一审查共享工作树差异，补 Agent Note，运行聚焦测试、相关包 typecheck、lint、文档 pairing/doc-sync 和 built CLI 入口验证。

### 测试记录

- `git diff --check`：通过。
- `git diff --cached --check`：通过。
- curated/CLI/审计器聚焦 Vitest：8 个测试文件中 7 个通过；983 个测试中 982 个通过、1 个失败。失败为 `scripts/audit-curated-candidates.spec.ts` 的密钥脱敏用例，预期 `Git source audit failed`，并行运行时实际先得到 `Git source audit timed out`。

### 错误

- 聚焦测试首次运行失败：确认是测试预算脆弱。该用例要验证 fake Git 的失败脱敏，却将包含真实 `git init` 的总预算固定为 1 秒；并行负载下会提前走超时分支。已仅把该用例预算改为 5 秒，保留生产错误分类与所有脱敏断言。
- 修复后单独运行 `pnpm exec vitest run scripts/audit-curated-candidates.spec.ts`：1 文件、31 测试全部通过。
- `pnpm exec vitest run --config vitest.e2e.config.ts packages/curated/curated-scripts/tests/packed-entry.e2e.ts apps/cli/tests/built-bin.e2e.ts`：2 文件、20 测试全部通过。
- 首次尝试使用不存在的 `code-reviewer` 子代理类型失败；已记录并改用 `general-purpose`。
- 已启动三路只读严格复审：供应链/安全边界、profile/CLI 生命周期、benchmark/evidence/rollout 真实性。
- `pnpm run typecheck` 首次运行在 host face 失败：`packages/curated/curated-scripts/tests/commands.spec.ts:618` 将字符串 `"failure"` 赋给了被推断为仅允许 `null` 的 `error` 字段。已将该测试报告对象显式声明为 `Record<string, unknown>`。
- 修复后重新运行 `pnpm run typecheck`：host build/typecheck、tsdown 和 client typecheck 全部通过（exit 0）。
- `pnpm run lint:contracts-ready` 首次失败：`curated-profiles` 一处 void shorthand arrow；CLI 测试 mock 一处无效类型断言和一处返回 void。已按 lint 建议改成 block-bodied callbacks。
- `pnpm run doc-sync`：28/29 通过；仅 translation pairing 失败，涉及 `apps/cli`、`packages/boot/app-boot`、`packages/curated/curated-profiles` 的 README 中英文对已同步编辑但 pairing metadata 未重录。
- 机械 lint 修复后 `pnpm run lint:contracts-ready` 通过。
- 已逐段确认上述三组中英文 README 语义/结构一致，并运行 scoped `verify-translation-pairing --write` 重录 3 个配对记录。
- scoped pairing 校验通过；随后重跑 `pnpm run doc-sync`，29/29 全部通过。
- 修复 superpowers 规范的两项验收歧义：删除与已跟踪文件事实冲突的“不提交计划文档”规则；将仓库治理基础设施、单候选激活、生态 rollout 拆为三套独立 DoD，并在路线图当前状态处明确不得把机制完成映射为 P1/P2 完成。
- Curated 裸 `install` 现在自动追加 `--offline`，profile 已有 `pnpm-lock.yaml` 时再追加 `--frozen-lockfile`；普通 profile 行为不变。CLI 聚焦测试 25/25 通过。
- Observed preflight/smoke 现在拒绝 DSH home、`profiles` 或 profile root 三层中的 symlink/junction；首次检查过宽误拒绝 macOS `/var` 系统别名，缩窄后两条负向测试及完整 `commands.spec.ts` 408/408 通过。
- 更新 CLI 中英文 README/reference 的离线与 frozen-lockfile 语义，重录两组 pairing metadata。
- benchmark/snapshot 严格修复后的 `packages/curated/curated-bench/tests/bench.spec.ts`：68/68 通过，包含 ancestor/final symlink、schema、数值与锁/profile 绑定负向覆盖。
- `@deepseek-ai/dsh-curated-scripts` 与 `@deepseek-ai/dsh-curated-bench` 单包 typecheck 均通过。
- 合并运行 CLI install/profile、curated commands、curated bench：4 文件、501 测试全部通过；fake pnpm 非零日志是失败传播用例的预期输出。
- 修复路线图三条不可执行/伪验证命令：dump 分离并要求空 stderr；实际解析 `curated-base/package.json` 并检查 bundle patch；重复资源负向门禁直接运行现有 Vitest 用例。
- 统一安全执行顺序为机器策略的五阶段，并删除未映射到 DSH 配置的 `workspace-write`/`danger-full-access` 声称。
- 修正 token 回滚线采集：`--dump-config` 不产生 token 数；必须由同一外部 producer/tokenizer 对实际 prompt 与 tool schema 计数，缺少 identity 时保持 pending。

- `curated-profiles` hard-link publication now retains identity after temporary-link removal, and enterprise patch validation owns its safe insert policy; focused suite passes 140/140 and package typecheck passes.
- Profile materialization validates all existing managed files before writes, retains files created during the call, accepts identical concurrent publication, and rolls back its own newly published files in reverse order after later failure.
- Curated policy now derives `active | qualified | pending | rejected`, rejects every inactive candidate without explicit blocker evidence, and gives `dsh-background-agents` a long-cycle blocker. Focused suite passes 208/208 and package typecheck passes.
- Corrected policy secret redaction so `sk-*` only matches at a token boundary; `high-risk-approval-or-auto-review` is preserved while standalone secrets still redact.
- Linked the superpowers README directly to the three-level Definition of Done and synchronized policy/profile README plus governance Agent Note pairs.
- Benchmark fixture schema 3 now binds all four lock/profile snapshot references as `{ path, sha256 }`; descriptor-bound readers reject stale canonical JSON digests before semantics, and comparator output retains those immutable identities.
- Completed benchmark records now require exact matching DSH package/source-tree/dirty/artifact/Node identities plus producer/tokenizer/serialization/timing/pricing/scoring identities. Comparator-side profile snapshots must exactly equal authoritative shipped or curated templates.
- Benchmark/security focused run passed 594/594; policy/profile/CLI focused run passed 371/371; curated-scripts full suite passed 412/412; curated-bench passed 69/69; packed command smoke passed 1/1 after rebuilding the affected package.
- Related curated packages and CLI typecheck passed. `doc-sync` initially found only a stale generated config-catalog source-line link; regeneration and scoped pairing fixed it, then all 29/29 documentation gates passed. `verify-type-equiv` passed 407 source blocks and 407 paired derivatives.
- `pnpm run hygiene` passed all 14 gates, including build, knip, constraints, publint, package invariants, runtime closure, and NodeNext consumption.
- `pnpm run duplication` initially reported 13 clones across new descriptor readers, package-local validators, worker bootstrap, pnpm lock parsing, and activation tests. Shared pnpm parsing and test helpers were extracted; package-role-specific readers/validators and worker bootstraps received narrow justified exclusions. The gate now reports 0 clones.
- `pnpm run lint:contracts-ready`, staged/unstaged diff checks, the 594-test benchmark/security run, and affected package typechecks pass after duplication cleanup.
- `pnpm run build` passed after the final refactors. The packed curated command smoke passed 1/1 against rebuilt artifacts, and `pnpm run verify-curated-activation-evidence` passed.
- Observed curated admission now requires both root and installed pnpm lockfiles even when a generated built-in profile selects zero third-party candidates; exact generated manifests also require `private: true`, the generated dependency-name set, and no extra dependency sections.
- Runtime direct-Git closure entries now bind the locator to the resolved repository, full commit, and package path. Fine-grained `github_pat_*` values join secret detection/redaction. Curated-scripts passes 414/414, package typecheck, lint, duplication, and diff checks.
- Curated plugin help/list are now template-rendered read-only operations: they neither materialize a missing profile nor invoke pnpm. Bare install serializes writers across processes, reclaims interrupted state, installs offline in a private staging home, validates generated files plus root/installed locks and curated admission, preserves the prior live directory on pnpm/validation failure, and activates by directory rename under the lock. CLI lifecycle tests pass 7/7 and the assembled install snapshot passes 2/2.
- Observed artifact descriptor reads now rebind the opened file to its package-relative pathname and regular ancestors before and after reading. Verify-lock requires authoritative built-in bundle order; custom managed profiles reject present false/duplicate script policy and build grants; planned benchmark records with runs require critical-task declarations and repeated-byte build digests reject. Curated-scripts passes 421/421.
- Production observed smoke copies the validated profile and optional home patch into a private execution home, revalidates the copy in the terminable worker, runs both child stages against that snapshot, and removes it after child cleanup. The new focused execution-home and artifact-ancestor race tests pass.

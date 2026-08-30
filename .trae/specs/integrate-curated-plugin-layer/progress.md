## Round 1

- 完成 Task 10 收敛：curated focused tests 和 coverage 通过，coverage 覆盖 `packages/curated/*/src/**/*.ts` 且 included source 均为 100%。
- 修复审查发现：workflow abort lint blocker、diagnostic target 脱敏、active curated metadata/resource fail-closed、smoke-profile 总预算、benchmark 数值范围、inactive non-bundle rejection evidence、enterprise baseline、curated-policy config path validation、复审发现的 policy id 脱敏与 malformed active/smoke 超预算缺口。
- 独立代码复审与安全复审已闭环；最终复审未发现剩余 P0/P1/P2 或可利用安全问题。
- 通过门禁：constraints、typecheck、lint、doc-sync、hygiene、build、git diff --check；`docs/plugin/superpowers` 仅做 markdown wrap 门禁修复，未 staging。
- 关键文件范围：`packages/curated/**`、`packages/workflow/tool-ralph/src/index.ts`、`packages/workflow/tool-workflow/src/index.ts`、`scripts/rescope-vendor.ts`、`scripts/rescope-vendor.spec.ts`、workspace/docs/generated catalog wiring、`.agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.*`。

## Round 2

- **Verdict**: PASS
- **Scope reviewed**: Broad；curated plugin layer 端到端范围，包括 `packages/curated/**`、CLI/profile 物化路径（`apps/cli/src/curated-profile.ts`、`apps/cli/src/plugin.ts`、`apps/cli/src/profile-boot.ts`）、curated policy/preflight/smoke/benchmark 命令、docs/generated catalog wiring 和 spec checklist。
- **Verification results**:
  - Build/Runtime: pass；`dsh-curated-verify-lock` 接受 37 个 candidates，`dsh-curated-preflight web-curated` 接受 18 个 entries，`dsh-curated-smoke-profile web-curated` 在 55s 预算内完成，`dsh-curated-compare-benchmark` 通过；adversarial preflight 拒绝重复 provider/tool 与 secret-like config，且未泄漏原始 token；`pnpm --config.verify-deps-before-run=false run build` 通过；`pnpm --config.verify-deps-before-run=false run hygiene` 14/14 通过。
  - Tests/Coverage: pass；targeted `vitest` 覆盖 6 个 test files、181 个 tests，targeted curated source 与 `apps/cli/src/curated-profile.ts` coverage 均为 100%；constraints、host/client typecheck、lint 和 doc-sync 通过（doc-sync 28/28）。
  - Checklist audit: 27/27 passed，0 failed。
- **Risks and issues**: 无 in-scope blocker；仓库存在 large dirty tree 与本轮 curated 验证无关，verdict 限定为原始 curated plugin layer 行为和直接受影响路径。

## Round 3

- Task 13-16 收敛完成：observed `preflight` 只在未使用 fixture 且有绝对 `--profile-root` 时标记 observed/accepted；observed profile composition 保留 Cordis 跨层覆盖语义并拒绝同层重复 insert；`smoke-profile` staging 校验不再在 verifier 父进程 import 第三方候选 main。
- 修复验证缺口：补充 fixture+profile-root、跨层覆盖、同层重复、installed bundle 顺序、artifact inconsistency、嵌入 JSON/损坏 JSON 脱敏、staging timeout 和 late rejection 覆盖；补录 `packages/curated/curated-scripts/README.i18n.yaml` 的双语 pairing。
- 新鲜证据：`commands.spec.ts` focused staging/budget 9 passed；curated scoped coverage 5 test files、276 tests passed，`packages/curated/**/src/**/*.ts` per-file coverage 100%；`doc-sync` 28 passed；`hygiene` 14 passed；`typecheck` pass；`lint` 0 warnings/0 errors。
- Self-review: 直接修改范围限定在 curated scripts、curated benchmark baseline、curated README sidecar 和 Ralph 状态文件；未执行 git commit/push/merge/rebase/reset；长周期 canary 与大样本 A/B 保持为可执行资产和 pending 状态。

## Round 2

- **Verdict**: PASS
- **Scope reviewed**: Broad；`docs/plugin/superpowers/**` 规划与证据分级、`.trae/specs/integrate-curated-plugin-layer/{spec,tasks,checklist,progress}.md`、`packages/curated/**`、`apps/cli` curated profile bridge、curated 命令 wrappers、repo 文档与静态门禁。
- **Verification results**:
  - Build/Runtime: pass；`pnpm run build` 通过；`verify-lock --json` 接受 37 个候选；临时 observed `web-curated` profile 的 `preflight` accepted=true、entryCount=138，`smoke-profile` manifest/bundle-parse/dump-config/help 全部通过；`compare-benchmark --json` 对默认 planned 长周期资产返回 pending/exit 1，符合“不伪造 observed/canary 证据”的文档状态；adversarial secret fixture 被 `preflight-config-secret` 拒绝且未回显 secret。
  - Tests/Coverage: pass；focused vitest 覆盖 6 个 test files、280 tests；curated coverage 覆盖 5 个 test files、276 tests，`packages/curated/*/src/**/*.ts` per-file coverage 100%；`constraints`、Host/client typecheck、lint、`doc-sync` 28/28、`hygiene` 14/14 和 `git diff --check` 均通过。
  - Checklist audit: 39/39 passed, 0 failed。
- **Risks and issues**: 无 in-scope blocker；工作树存在大量 unrelated staged/dirty 文件，但 `docs/plugin/superpowers/**` 与 `.trae/specs/integrate-curated-plugin-layer/**` 未 staged；长周期搜索、记忆、浏览器、MCP、故障注入和 canary 仍保持 planned/pending，不作为本轮完成证据。

## Task 19.2

- **Verdict**: PASS
- **Registry remediation**: 5 个存在 Git 构建钩子的 active 候选改用与固定源码对应、带完整性值且无安装期脚本的确切 npm 工件；`dsh-memento` 保持为无 lifecycle hook 的固定 Git 依赖。Toolkit、smooth stream、permission rules 与 upstream radar 因缺少可验证安全预构建工件而被拒绝；LoongSuite npm `0.1.1` 恢复为 4 个 curated profile 的 active 候选。所有 profile 均不生成 `allowBuilds`。
- **Real-profile evidence**: `/tmp/dsh-task19-final3.fflzh0` 中五个隔离 profile 均实际安装成功，并由当前二进制重新通过 observed `verify-lock`、`preflight` 与 `smoke-profile`；四个 curated profile 各选中 6 个候选并组合 143 个条目，personal 选中 0 个并组合 137 个条目。
- **Verification**: 356 个 curated 测试通过，纳入范围的源码逐文件 statements/branches/functions/lines 均为 100%；4 个 curated 包 typecheck、仓库 typecheck、build、constraints 与 lint 通过，4 对变更双语 owner 文档一致，tracked/staged diff check 通过。
- **Unrelated repository gates**: `doc-sync` 为 26/28，仅 `packages/extensions/tool-cordis/src/api-catalog.ts` 与 `docs/config-catalog.md` 的既有脏生成内容过期；`hygiene` 为 13/14，仅既有 `AGENTS.md` 导致 `root-agents-vendored-name-contract` 失败。本任务未改写这些无关 owner。
- **Review**: scoped correctness、规格与安全复审未发现未解决的 Task 19.2 缺陷或可利用问题；`docs/plugin/superpowers/**` 与 `.trae/specs/**` 未新增 staged 内容，且未执行 commit、push、merge、rebase、reset 或 add。

## Task 20 dependency provenance

- **Verdict**: PASS for the two dependency-provenance findings.
- **Lifecycle execution**: all five generated profiles write `ignore-scripts=true`; materialization and observed admission reject existing script-enabled or build-grant state without rewriting it; `dsh plugin` independently forces script suppression and rejects override flags. An isolated pnpm 9.15.9 fixture installed a package with a malicious `postinstall` without creating its sentinel.
- **Package transformations**: materialization, lock verification, preflight, and smoke reject `patchedDependencies`, `packageExtensions`, pnpmfile hooks, configured patch directories, their lockfile checksums, and lock locators carrying `patch_hash`. Ordinary peer suffixes and exact npm SRI, Git commit, runtime dependency-closure, and direct-tree verification remain accepted.
- **Verification**: affected tests passed, including 265 curated command tests and two CLI policy tests; `curated-profiles/src/index.ts` and `curated-scripts/src/index.ts` each reached 100% statements, branches, functions, and lines. Five fresh profile installs passed observed `verify-lock`, `preflight`, and `smoke-profile`; typecheck, lint, `doc-sync` 28/28, and `hygiene` 14/14 passed.
- **Repository-wide evidence**: the full configured inventory, split into four bounded low-concurrency shards, passed 15,111 tests with 114 skipped and no failures. A 16-shard instrumented rerun passed 860 files with 10 skipped, but its global threshold remained nonzero because unrelated modified source files outside Task 20 lack full coverage; those files were not changed or reverted.

## Task 20 final specification blocker

- **Verdict**: DONE_WITH_CONCERNS.
- **Fail-closed result**: 12 个目标候选不变；6 个静态/安装资格候选全部改为 inactive 并记录 `assembled-keyless-snapshot-missing`，其中 `dsh-web-search-pro` 另记录缺少 `@anweat/dsh-browser`。Runtime active 为 0，五个模板、`web-curated` lock/profile snapshot 均只保留安装自有基础 bundle。
- **Evidence state**: E3/E4、A/B、故障与 canary 均保持 pending；重新激活必须同时具备真实固定工件、keyless assembled snapshot、全部必需依赖 bundle，以及安装、启用、重启、禁用或卸载证据。
- **Verification**: 6 个 focused test files 共 591 项通过；policy、profiles、bench、scripts 受影响源码逐文件 statements/branches/functions/lines 均为 100%；4 个 curated 包 typecheck、根 typecheck、constraints、scoped lint、packed E2E、built curated/web/headless、官方 headless snapshot、6 对文档 pairing、Agent Note format、Markdown wrap、`doc-sync` 28/28 与 diff check 通过。
- **Concern**: 根 `pnpm run lint` 仅因任务开始前已存在的未跟踪生成 `packages/**/src/*.d.ts` 文件产生 806 条格式诊断而失败；本轮修改文件的 scoped lint 为 0 warning/0 error。本轮未执行 Git 写操作。

## Round 4

- **实际修复**：拒绝同身份重复 profile 插入及非模板依赖，校验 activation evidence 工件语义并绑定 active 候选、必需 bundle 与安装闭包，扩大 benchmark metadata 和完整 Cordis entry 的秘密扫描，约束 P2 故障资产只能声明真实 runtime 结果，并隔离 smoke 子进程的 cwd 与 dotenv 来源；最终复审还闭环了 A/B exact schema、rollback Git 来源与 bundle 路径约束、prototype-like fault ID，以及 curated policy/profile invariant companion 问题。
- **最终测试与 coverage**：行为序列 12/12 文件、929/929 测试通过；curated coverage 5/5 文件、702/702 测试通过，除无可执行项的空 `curated-base/src/index.ts` 外，纳入源码四维 100%；activation evidence verifier 94/94 测试且目标文件四维 100%。
- **最终门禁**：activation evidence gate、constraints、typecheck、根 lint（2,659 文件，0 warning / 0 error）、`doc-sync` 29/29、build、hygiene 14/14、packed/built E2E 20/20、官方 headless snapshot 1/1、工作树与 staged diff check 全部通过；active UI 为 0，CDP 不适用，未执行 Chrome 测试。
- **最终复审**：Bits Code Guard 最终 comments 为 `[]`，独立安全复审未发现可利用问题，规格复审与 invariant/code-quality 复审均为 CLEAN，无未解决 P0–P2 或高置信度实质问题。
- **状态与边界**：catalog 保持目标候选 12、静态/安装资格候选 6、runtime active 0，五个 profile 均为 foundation-only；外部 E3/E4、A-B comparison 与 canary validation 保持 pending，未作为完成证据。
- **Index 与 Git**：`git diff --cached --binary | shasum -a 256` 得到 `0d654fdb471cb3501ae2eaa313af3c23742af74e314420b083783a5ec55b0ba6`，与基线精确匹配；未执行 `git add`、`commit`、`push`、`merge`、`rebase` 或 `reset`。

## Task 22

- **准入缺口**：精选 profile 只接受逐字节等于仓库模板的 `.npmrc`，拒绝 registry、auth、path redirect 和其它附加配置；每个 selected active candidate 自身必须对全部 `targetProfiles` 提供完整当前 profile activation evidence，required bundle provider 的证据不能替代候选自身证据。
- **诊断与顺序**：Activation evidence 的 candidate、profile 与 path 诊断统一经过 secret redaction；聚合 gate 先返回 policy issues，存在静态 policy 问题时不访问 evidence path、Git predicate 或文件 reader。
- **新鲜验证**：Task 22 focused profile 47 项与 evidence 2 项通过；curated 五包 758 项通过，纳入 `packages/curated/*/src/**/*.ts` 的 statements/branches/functions/lines 均为 100%；此前同一最终工作区的 typecheck、根 lint、`doc-sync` 29/29、build、hygiene 14/14、source/lib snapshot、packed entry 和五 profile 真实 install/verify/preflight/smoke 均通过。
- **边界**：staged index SHA-256 仍为 `0d654fdb471cb3501ae2eaa313af3c23742af74e314420b083783a5ec55b0ba6`；未执行 `git add`、commit 或 push。Runtime active 仍为 0，外部 E3/E4、A/B、故障与 canary 继续保持 pending。

## Round 5

- 完成 Task 23–28：受管 profile 的 descriptor/目录 identity、initial 与真实 live HMR 读取、package-manager policy、activation replay、YAML/文本秘密脱敏、smoke 子进程与输出限制、benchmark pending 与 planning-history 绑定均已按 TDD 闭环。
- 最终对抗复审补齐 private replay HOME、固定 locale allowlist、YAML comment/inline/custom-tag/block/multiline 诊断脱敏、脱敏后 child 与最终 report 的 1 MiB 限制、observed 三命令 package-manager 一致性，以及 `verify-lock` canonical profile identity 绑定。
- 新鲜验证：curated + CLI consumer 822/822 且纳入 curated source 四维 100%；activation verifier 108/108 且四维 100%；app-boot/HMR 130/130 且目标 source 四维 100%；root typecheck、root lint（2,659 files，0 warning/error）、`doc-sync` 29/29、build、hygiene 14/14、built/packed E2E 32/32、headless snapshot 1/1、activation gate与 diff checks 全部通过。
- 最终 Bits、独立安全和规格复审均为 CLEAN/PASS，未解决 P0/P1/P2 为 0；catalog 保持 12 个目标、6 个静态/安装资格候选、runtime active 0，五个 profile 均为 foundation-only，E3/E4、真实 A/B、故障与 canary 继续保持 pending。
- 当前无 active UI candidate，因此 Chrome CDP 9333 验收不适用。Index SHA-256 保持 `0d654fdb471cb3501ae2eaa313af3c23742af74e314420b083783a5ec55b0ba6`；未执行 `git add`、commit、push、merge、rebase、reset、checkout 或 worktree。

## Round 6

- 本轮按用户"从零审查并严格执行 `docs/plugin/superpowers/`"要求执行独立复审（Task 29）。并行委派 5 路只读子代理，从零重建需求追踪，不复用旧通过结论：(1) 七份文档需求追踪、(2) curated 源码+覆盖、(3) 候选供应链事实、(4) 五个 profile 组合/隔离、(5) 长周期证据诚实性。五路结论均为 CLEAN/CONFIRMED，无仓库内行为缺口。
- 唯一被标记项：`curated-candidates.json` summary 的 `treeSha256ByCandidate` 与 `runtimeDependencyClosureSha256ByCandidate` 为空 map。经核实为 `bench.spec.ts:121-126` 刻意锁定的契约（断言 length 0），无任何运行时消费该 summary map，权威 `plugin-allowlist.yaml` 仍持有 6 个 tree 与 6 个 closure 真实摘要供 verify-lock/preflight/smoke-profile 校验。判定为非缺陷，遵循简化/外科式改动原则不改动。
- 新鲜证据（全部 < 1 分钟叶级门禁）：commands.spec.ts 400/400；curated-policy+profiles+base 336/336；curated-scripts+bench 468/468；CLI curated bridge 23/23；activation-evidence gate PASS（active=0 无重放）；官方 headless snapshot 1/1；session JSONL 回归 151/151；packed-entry e2e 1/1。Per-file coverage：curated-profiles/src（含 CLI 消费测试）四维 100%，curated-scripts+bench 四维 100%，curated-policy+profiles+base 组合 statements 99.9%（profiles 的 boot-admission 分支由 CLI 消费测试补足至 100%）。
- 静态门禁：constraints PASS、5 个 curated 包 typecheck PASS、scoped lint 0 warning/0 error（29 文件）、doc-sync 29/29 PASS。
- 命令行为核验：verify-lock `--json` exit 0 `observed:false`（metadata-only）；compare-benchmark exit 1 `status:pending` + 5 pendingCampaigns（诚实 pending，不伪造 observed）；preflight/smoke 无 `--profile-root` 时 fail-closed（`*-profile-root-required`）；对抗性 secret fixture 被 `preflight-config-secret` 拒绝且 `[REDACTED]` 不回显原始 token。
- 真实 CLI：`dsh --profile headless --dump-config` exit 0；洁净隔离 DSH home 下五个 curated profile 全部 exit 0、deps=`{}`、`.npmrc=ignore-scripts=true`。对用户既有 `~/.dsh/profiles/web-curated`（早期开发遗留、含第三方依赖）的 dump 被 fail-closed 拒绝——这是"拒绝改写既有 profile"的正确安全行为，本轮遵循不触碰用户既有状态原则未修改用户 home。
- catalog 状态核验：37 个候选、`active:true` 为 0；6 个候选（dsh-web-search-pro、dsh-memento、dsh-mcp-panel、dsh-checkpoint-rewind、dsh-lsp-actions、loongsuite-dsh-plugin）保留 `assembled-keyless-snapshot-missing`，dsh-web-search-pro 另记缺少 `@anweat/dsh-browser`；12 目标基线 12/12 存在，其余 6 个保留各自具体拒绝理由。五个包均为公开 DSH 发布族成员。
- 最终独立对抗复审（code + security + spec-consistency）verdict = CLEAN：秘密脱敏、路径穿越/symlink 逃逸、TOCTOU、fail-closed、生命周期脚本/构建授权拦截、pnpm 变换旁路拒绝、凭证 URL 拒绝、能力冲突一致性、boot admission、幂等物化、benchmark 数学、HMR disposer 均正确；官方 web/headless/agent-loop/session-wire-format 未变。唯一 informational 观察（未来激活 permission 候选于非 enterprise profile 且用户层 disable 时的 enabled-state 检查）当前不可达，非缺陷。
- 边界：本轮仅写入 spec 状态文件（tasks/checklist/progress）与临时 `/tmp` 探针（已删除），未改动任何 curated 源码；staged index SHA-256 保持 `0d654fdb471cb3501ae2eaa313af3c23742af74e314420b083783a5ec55b0ba6` 不变，未新增 `docs/plugin/superpowers/` 或 `.trae/specs/` staged 内容，未执行 commit/push/merge/rebase/reset/add。E3/E4、真实 A/B、故障注入与 3–7 天 canary 继续保持 pending。

## Round 2

- **Verdict**: PASS
- **Scope reviewed**: Broad；精选插件层端到端（`packages/curated/**` 五个包、`apps/cli/src/curated-profile.ts` 与 `profile-boot.ts` 的 boot-admission 桥接、四类命令 verify-lock/preflight/smoke-profile/compare-benchmark、`scripts/verify-curated-activation-evidence.ts` 与 `audit-curated-candidates.ts` 门禁、七份 `docs/plugin/superpowers/` 规划追踪与 spec checklist）。
- **Verification results**:
  - Build/Runtime: pass；真实 CLI（`node --import tsx/esm apps/cli/src/bin.ts`）在洁净隔离 DSH_HOME 下 `--profile headless --dump-config` exit 0，`--profile web-curated --dump-config` exit 0 并物化为 `deps:{}`、`.npmrc=ignore-scripts=true`、bundles 仅 `dsh-base/dsh-web-app/dsh-curated-base`（foundation-only，无第三方）。verify-lock `--json` exit 0（37 candidates，selected 0，`observed:false`）；compare-benchmark `--json` exit 1 诚实 `status:pending` + 5 pendingCampaigns；preflight/smoke 无 `--profile-root` fail-closed exit 1。5 个 curated 包 tsc typecheck 全部 exit 0。
  - Tests/Coverage: pass；curated-scripts commands 400/400，curated policy/profiles/base/bench 404/404，CLI curated-profile bridge 18/18，activation-evidence + candidate-audit 门禁 139/139；scoped oxlint 0 warning/0 error（25 文件）。
  - Checklist audit: 全部 checklist 项通过（`spec.md` 场景、`checklist.md` 六轮共 90+ 勾选项均有本轮命令证据支撑），0 failed。
- **Risks and issues**: 无 in-scope blocker。对抗性探针：向 profile patch 注入明文 secret 被 `preflight-profile-patch-secret` fail-closed（`accepted:false`），原始 secret 泄漏 0 次。官方不变量成立：`packages/core/agent-loop` 无 curated 相关行为改动（仅 settings 测试的独立 revision-assertion 变更，属更广分支非本任务），`profile-boot.ts` 变更为预期的 curated boot-admission。Git 边界完好：index SHA-256 保持 `0d654fdb471cb3501ae2eaa313af3c23742af74e314420b083783a5ec55b0ba6`，HEAD 未变，本轮未执行任何 git 写操作。E3/E4、真实 A/B、故障注入与 3–7 天 canary 按文档诚实保持 pending，不作为完成证据。

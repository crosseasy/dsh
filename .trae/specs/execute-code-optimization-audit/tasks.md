# Tasks

- [x] Task 1: 让 Settings wire redaction fail closed（P0）
  - [x] 在 `packages/settings/settings/tests/redact.spec.ts`、`packages/host/apiproxy/tests/api-proxy-config.spec.ts` 和 `packages/client/ui-settings/tests/schema.client.spec.ts` 先加入 union、intersection、transform、default、nested dict/array、adversarial error text 与直接对象兼容用例，并确认新增用例因现有泄漏行为失败。
  - [x] 在 `packages/settings/settings/src/redact.ts` 与 `packages/settings/settings/src/index.ts` 实现唯一 `describeForWire()`；在 `packages/host/apiproxy/src/api-proxy.ts` 的 read/write 路径统一调用并在 persistence 前 preflight。
  - [x] 审计并修正 `packages/llm/llm-pi-ai/src/config.ts` 中可携带凭据的 headers schema，补充 `config.spec.ts`。
  - [x] 使用 Chrome CDP `9333` 验证 overlay plugin 到 browser settings card 的真实装配路径，控制台不得有新增错误。
  - [x] 更新 Settings、ApiProxy、pi-ai 的 README/JSDoc、`docs/subsystems/settings*`、settings-card cookbook、相关 Agent Note triplet 与生成目录。
  - [x] 验证：`gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/redact.spec.ts packages/host/apiproxy/tests/api-proxy-config.spec.ts packages/client/ui-settings/tests/schema.client.spec.ts packages/llm/llm-pi-ai/tests/config.spec.ts`。

- [x] Task 2: 恢复可复现的 standalone hygiene gate graph（P0）
  - [x] 在 `scripts/run-gates.spec.ts` 先断言 `hygiene` 包含 `build`，且 publint、built invariants、NodeNext consumer 都依赖它，并确认现有实现失败。
  - [x] 在 `scripts/run-gates.ts` 让 `hygiene` 与 `check-all` 复用 artifact dependency graph；保持 `check-workspace-constraints.ts` 对真实意外目录 fail loud，不让只读 hygiene 隐式清理工作区。
  - [x] 更新 `docs/development*`、`docs/cookbook/adding-a-package*` 和既有 parallel-gates Agent Note triplet，删除手工预构建前提。
  - [x] 验证：`gtimeout 55s pnpm exec vitest run scripts/run-gates.spec.ts scripts/check-workspace-constraints.spec.ts scripts/clean.spec.ts`；随后分别在 `pnpm run clean` 后和已有 build 后运行受 55 秒限制的 `pnpm run hygiene`，结论一致。

- [x] Task 3: 回收 superseded preset generations（P1）
  - [x] 在 `packages/preset/agent-presets/tests/mount.spec.ts` 与 `packages/host/apiproxy/tests/api-proxy-agent-preset.spec.ts` 先覆盖 parent/child holders、cold-reader lease、concurrent refresh、mount rollback 和 one-shot dispose。
  - [x] 在 `packages/preset/agent-presets/src/index.ts`、`src/mount.ts` 实现 generation owner 的 holder、retired 与 memoized disposal；agent scope release 和 recompose transfer 必须原子。
  - [x] 将 `standingKeyFor()` 的裸 key 读取改为显式 acquired/released handle，并更新 ApiProxy 两个 cold-read 路径。
  - [x] 更新 preset README、core subsystem、API catalog、新 generation-reclamation Agent Note triplet及既有 standing-mount Note triplet。
  - [x] 验证相关 preset 与 ApiProxy 测试及三个 package focused typecheck，每条命令使用 `gtimeout 55s`。

- [x] Task 4: 让 Settings registration disposal quiescent（P1）
  - [x] 在 `packages/settings/settings/tests/settings.spec.ts` 先覆盖 slow watcher unload、queued watcher skip、old persist success after replacement、old persist failure followed by replacement write。
  - [x] 在 `packages/settings/settings/src/index.ts` 增加 registration-owned active/tails，并在旧 persist 提交后从 committed raw section 重新解析当前 owner、推进 revision、按新 owner 规则通知。
  - [x] 更新 Settings README、settings subsystem、API catalog和既有 settings-write-integrity Agent Note triplet。
  - [x] 验证：`gtimeout 55s pnpm exec vitest run packages/settings/settings/tests/settings.spec.ts --maxWorkers=1` 和 package focused typecheck。

- [x] Task 5: 为 Agent Instructions 增加三态 root probe 与聚合预算（P1）
  - [x] 在 `packages/context/agent-instructions/tests/agent-instructions.spec.ts` 先覆盖 unavailable marker 加 ancestor `.git`、initial failure、last-good retention、deep-first、UTF-8 exact bytes、same-directory dedup 和 exhaustion 非 removal。
  - [x] 在 `src/config.ts` 增加 validated `maxTotalSourceBytes` 和 baseline identity；在 `src/files.ts` 实现 tri-state marker 与共享 budget reader；在 `src/index.ts`/`src/state.ts` 固定已确认 root 并复用该预算。
  - [x] 更新 Agent Instructions README、workspace-context Agent Note triplet、config catalog 和四个受 baseline identity 影响的 keyless snapshots。
  - [x] 验证 focused unit、ACP/headless keyless snapshots、package lint 与 config catalog，每条命令使用 `gtimeout 55s`。

- [x] Task 6: 让 ACP subagent 复用 out-of-process lifecycle core（P1）
  - [x] 在 `packages/subagent/subagent-acp/tests/subagent-acp.spec.ts` 补充 repeated dispose，并用现有测试固定 readiness 前取消、failure/cancel race、spawn failure、EOF grace 和 memoized teardown。
  - [x] 在 `subagent-acp/src/index.ts` 使用 `validateConfiguredCwd`、`resolveChildCwd`、`NO_START_CAPABILITIES`；在 `src/run.ts` 使用 `settleRunResult`、`subprocessRunHandle`，不扩张 shared helper 以容纳 ACP 专属诊断。
  - [x] 保留 startup rollback、`session/cancel`、EOF-first teardown、timer bounds，要求生产代码净删除。
  - [x] 更新 ACP README 和既有 TypeScript SDK/subagent Agent Note triplet。
  - [x] 验证 subagent/out-of-process、ACP unit、loader composition e2e 和 package lint，每条命令使用 `gtimeout 55s`。

- [x] Task 7: 删除 `FileSystem.lstat` seam（P1）
  - [x] 先将 FS、local、E2B 与 tool-fs 测试改为不依赖 service `lstat`，确认生产引用 inventory 只剩需要保留的 Node/platform API。
  - [x] 删除 `FileSystem.lstat`、`FsPathInfo`、两个 provider 实现和仅为它们存在的 `PathLinkInfo`、`pathLinkType`、`probeNoFollow`；保留 atomic publication、SQLite、cleanup 等真实 no-follow 使用。
  - [x] 更新三组 README、filesystem subsystem、type-equiv manifest、Cordis API catalog 和新 simplification Agent Note triplet。
  - [x] 验证 FS focused tests、`rg 'lstat|FsPathInfo|probeNoFollow'` inventory、type-equiv、catalog 与 export JSDoc。

- [x] Task 8: 收窄 SessionReferenceResolver 公共 Service 方法（P2）
  - [x] 先把 `packages/context/session-reference/tests/session-reference.spec.ts` 的直接方法测试改为 Remote candidates 与 pre-step 行为测试。
  - [x] 将 `listCandidates` 与 `prepare` 变为 private，保留 Remote candidates、canonical URI 和 pre-step 语义。
  - [x] 更新 package README、session-reference subsystem、生成 API catalog 和新 simplification Agent Note triplet。
  - [x] 验证 focused tests、typecheck、catalog 与 export JSDoc。

- [x] Task 9: 收窄 `CompactionResult`（P2）
  - [x] 先更新 compaction、compaction-basic、command-compact 测试，只依赖 `summarySeq`、`shadowedRange`、`shadowedSeqs` 和 `shadowedTokenCount`。
  - [x] 从类型和 producer 删除 `compactionId`、`sourceCommandId`、`startSeq`、`endSeq`、`summary`；类型级位置直接使用 `CompactionId`。
  - [x] 更新 compaction README/subsystem、type-equiv、既有 compaction-seam Note；依据当前代码重写或拒绝旧 broad dead-core-spine proposal，不能整包执行旧提案。
  - [x] 验证三个 focused test 文件、type-equiv、catalog 与 export JSDoc。

- [x] Task 10: 将 tools 测试 helper 移到 `/testing` subpath（P2）
  - [x] 增加 `@deepseek-ai/dsh-tools/testing` export 和 `tsconfig.base.json` path，先迁移 repository tests 到新路径。
  - [x] 从 product root 删除 `defineContentToolFixture` re-export，确认无 production import。
  - [x] 更新 package 文档、生成目录和新 simplification Agent Note triplet。
  - [x] 验证 tools focused tests、typecheck、knip、catalog 与 export JSDoc。

- [x] Task 11: 将 llm-retry internals 移到 `/testing` subpath（P2）
  - [x] 先让 retry tests 从 `@deepseek-ai/dsh-llm-retry/testing` 获得 deterministic installation。
  - [x] 恢复 production `apply(ctx, config)`，删除 product root 的 `RetryInternals` 和第三参数，新增 testing export/path。
  - [x] 更新 llm-retry README、生成目录和新 simplification Agent Note triplet。
  - [x] 验证 retry 与 loader-composition tests、typecheck、knip、catalog 与 export JSDoc。

- [x] Task 12: 合并 `LocalPtySession` 单次 send 生命周期状态（P2）
  - [x] 用现有 41 个 race tests 固定 timer、abort、write、interrupt 和 readiness polling 行为，并先补充缺失 race。
  - [x] 在 `packages/terminal/terminal-bash/src/session.ts` 中引入单一 send lifecycle owner，删除平行 flags/disposers，目标净删除 20-60 行。
  - [x] 更新 terminal-bash README 与相关 Agent Note triplet。
  - [x] 验证 `terminal-bash/tests/session.spec.ts`、focused typecheck 和 lint。

- [x] Task 13: 提取 Bash/Pwsh persistent tool 私有 runtime（P2）
  - [x] 为两个 persistent tools 先建立同一组 registry、creation race、serialization、scrollback、deadline、reset、owner cleanup 与 teardown contract tests。
  - [x] 新增私有 `packages/shell/persistent-tool-runtime/`，只拥有共享生命周期；dialect markers、wrappers、prompt echo 与 parsing 留在 adapter。
  - [x] 删除至少 250 行重复生产代码，并移除对应 514 行 full-file `jscpd` exclusion。
  - [x] 更新两个 package README、shell subsystem、新 shell-lifecycle Note 和受影响既有 Note triplets。
  - [x] 验证两组 tools/loader tests、PTY snapshots、typecheck、lint 与 duplication。

- [x] Task 14: 提取 Bash/Pwsh one-shot executor 私有 runtime（P2）
  - [x] 先用两组 executor/settings tests 固定 cwd resolution、deadline classification、collection、background state、cursor 和 kill settlement。
  - [x] 新增私有 `packages/shell/shell-runtime/`，共享 executor lifecycle；argv、environment 与 dialect adapter 保留原位。
  - [x] 删除至少 150 行重复生产代码并减少对应 `jscpd` exclusions。
  - [x] 更新两个 package README、shell subsystem 与 shell-lifecycle Agent Note triplet。
  - [x] 验证 local executor/settings tests、Windows shell test、focused typecheck、lint 与 duplication。

- [x] Task 15: 提取 Bash/Pwsh sandbox settlement core（P2）
  - [x] 先用两个 sandbox suites 固定 per-process fact ownership、ACL、abort、timeout、kill 与 settlement。
  - [x] 将相同 helper 和 lifecycle 抽到既有私有 shell runtime 或单一邻近私有模块；不引入 dialect/config switch。
  - [x] 删除至少 180 行重复生产代码并减少对应 `jscpd` exclusions。
  - [x] 更新两个 sandbox README、shell subsystem、sandbox 与 shell-lifecycle Agent Note triplets。
  - [x] 验证两个 sandbox suites、focused typecheck、lint 与 duplication。

- [x] Task 16: 评估并在满足净删除门槛时提取 one-shot tool 公共逻辑（P2）
  - [x] 对 `tool-bash`/`tool-pwsh` 的 validation、approval、foreground/background routing 和 presentation 建立逐项 production-reference 与差异 inventory。
  - [x] 只有当实现可删除至少 100 行生产代码、无需 dialect/config switch 且快照 byte-identical 时才提取；否则记录证据并保持 adapter 分离。
  - [x] 若提取，更新两组 README、shell subsystem、shell-lifecycle Note 和 jscpd config；若不提取，Task 13-15 的净删除与 ignore 减少仍须满足审计 acceptance。
  - [x] 验证两组 one-shot tool/integration suites、ACP/headless/JSON-RPC/Web 对应 snapshots、typecheck、lint 与 duplication。

- [ ] Task 17: 让 Workflow 只有一个 cancellation owner（P2）
  - [ ] 先在 tool-workflow、tool-ralph 与 worker tests 覆盖 pre-aborted、abort during synchronous start、mid-flight、post-settlement、reentrant cancel 和 dispose quiescence，并断言最多一次 `cancel()`。
  - [ ] 从 `WorkflowStartRequest` 和 WorkerRun 删除 input signal/listener；consumer 在 start 前检查、start 后注册 `run.cancel()` listener 并立即复查，再在 finally detach + dispose。
  - [ ] 更新 Workflow README/subsystem、生成 API catalog、新 simplification Note 和受影响既有 Note triplets。
  - [ ] 验证 workflow focused suites、worker built-artifact tests、Ralph/workflow snapshots、typecheck 与 lint。

- [ ] Task 18: 按实际方向收窄 TypeScript/Python JSON-RPC transports（P2）
  - [ ] 先用 per-direction tests 替换 TypeScript symmetric-pair tests，并为 Python 意外 server-request frame、并发 request、notification、process exit 和 malformed frame 建立用例。
  - [ ] TypeScript 保留共享 frame parser/writer，但提供 server/client 窄接口或实现；删除 server-originated request 与 client-side request handler/response，保留 `subagent-codex` 的 outbound `notify('initialized')`。
  - [ ] Python 删除 `IncomingRequest`、request queue、`notify`、`next_request`、`respond`、`respond_error`，且意外 server request 不得命中 response waiter。
  - [ ] 保持当前 `session/prompt` message-id settlement，不实施旧 proposal 的 `session.finished`/同步结果改造；将 directional JSON-RPC proposal 改写为当前决定并按实际落地迁移 lifecycle。
  - [ ] 更新 SDK/protocol README、Python SDK README、public exports/JSDoc、双 SDK expected outputs、smoke 和生成目录。
  - [ ] 验证 TypeScript protocol/client/server tests、Python SDK tests、built JSON-RPC smoke、snapshots、typecheck 与 doc-sync。

- [ ] Task 19: 让 client fixture 复用领域 projection folds（P2）
  - [ ] 为 plan、session stats、token usage、context pressure 和 context breakdown/request composition 增加 shared event-vector parity tests，先证明 fixture 与 production 可漂移。
  - [ ] 在各领域 package 提取无 Cordis/Node runtime 依赖的 client-safe init/apply/view pure modules，production `ProjectionDefinition` 组合这些函数。
  - [ ] 在 `packages/client/connection/src/client/fixture.ts` 删除 `foldPlan/planViewOf`、`sessionStatsOf`、token usage、context pressure 和 request composition 平行实现，改为领域 subpath imports；不导入 Host registry。
  - [ ] 更新 package exports/dependencies、README、相关 projection Agent Note triplets 和生成目录。
  - [ ] 验证各 projection package tests、fixture client tests、client demo/screenshot tests、typecheck、build graph 与 bundle dependency gate。

- [ ] Task 20: 完成全量分层验证与最终审查
  - [ ] 按 Task 1-19 的 focused commands 逐组运行，所有命令用 `gtimeout 55s`，失败时遵循 systematic-debugging 的假设、证据、修复、重验闭环。
  - [ ] 运行受 55 秒限制的 `pnpm run typecheck`、`pnpm run lint`、`pnpm run duplication`、`pnpm run doc-sync`、`pnpm run build`、`pnpm run hygiene`；超时不是通过，改用拥有同等覆盖的叶级命令并记录缺口。
  - [ ] 运行所有受影响 keyless snapshot、双 SDK expected-output、built-artifact 和 Chrome CDP `9333` Settings UI 验证；检查浏览器 console 无错误。
  - [ ] 由独立 reviewer 对完整 diff 做 correctness、simplicity、architecture、security、performance 和系统语义回归审查，修复所有 Critical/Important findings 后重新验证。
  - [ ] 核对没有 vendor 或 archived Agent Note 改动，没有未经授权 Git 操作，没有回滚用户原有改动；将所有 checklist 项逐条勾选。

## Task Dependencies

- Task 1 与 Task 2 是发布阻塞项，可并行执行；Task 2 完成后，后续 artifact-sensitive 验证才具有可信基线。
- Task 3、Task 4、Task 5、Task 6、Task 7、Task 8、Task 9、Task 10、Task 11、Task 17、Task 18、Task 19 在文件所有权不重叠时可并行。
- Task 12 先于 Task 13；Task 13、Task 14、Task 15 按共享 runtime 的实际文件所有权串行，Task 16 在前三项完成后执行净删除评估。
- Task 20 依赖 Task 1-19 全部完成。

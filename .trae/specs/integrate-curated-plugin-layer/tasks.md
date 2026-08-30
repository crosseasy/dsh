# Tasks

- [x] Task 1: 核验候选来源并冻结审计目录，产出可机器验证的插件事实。
  - [x] 1.1 从 Awesome 清单与 `docs/plugin/superpowers/02-插件矩阵与择优.md` 提取 P0/P1/P2 候选 URL。
  - [x] 1.2 对每个候选执行只读浅克隆/manifest 核验，记录 HEAD SHA、包名、Node engine、license、`dsh.bundle.patch`、测试/CI、安装脚本和外部依赖。
  - [x] 1.3 对无法访问、许可证不清、无 bundle、Node 不兼容或要求核心补丁的候选记录硬拒绝，不将其放入 active profile。
  - [x] 1.4 以 focused schema test 验证目录字段完整、SHA 为 40 位、候选 ID 唯一。

- [x] Task 2: 创建 `packages/curated/` workspace 拓扑和静态 curated bundle。
  - [x] 2.1 新增符合仓库 package 约定的 curated 包骨架、README、invariant companion 和 Host aggregate 引用。
  - [x] 2.2 新增 curated bundle patch，只挂载本仓库拥有的 curated policy，不复制第三方 bundle patch。
  - [x] 2.3 添加 bundle manifest/patch 解析测试和无 default export 回归测试。
  - [x] 2.4 运行新包 focused tests、constraints 和新包 typecheck。

- [x] Task 3: 实现 `curated-policy` 的解析、评分和冲突决策。
  - [x] 3.1 先写失败测试，覆盖合法目录、浮动版本、短 SHA、硬拒绝覆盖评分、同域双 provider、显式 fallback、秘密值和重复资源。
  - [x] 3.2 实现最小 catalog/profile schema 与 `ctx.curatedPolicy` 只读查询。
  - [x] 3.3 实现 registration effect/disposer，并添加 HMR safety 测试。
  - [x] 3.4 运行 package coverage、typecheck 和 lint 叶级检查。

- [x] Task 4: 实现五个 profile 模板及物化操作。
  - [x] 4.1 先写失败测试，覆盖五个模板的 bundle 顺序、P0/P1/P2 分层和 personal 隔离。
  - [x] 4.2 实现写入指定 DSH home 的 profile manifest、空用户 patch 和 pnpm workspace 文件；已有文件不覆盖。
  - [x] 4.3 确保 `web-curated` 只含通过硬门槛的默认候选，coding/research/enterprise/personal 只增加各自能力。
  - [x] 4.4 添加官方 web/headless 文件字节不变测试和重复执行幂等测试。

- [x] Task 5: 实现 `verify-lock` 与 `preflight` 命令。
  - [x] 5.1 先写失败测试，覆盖 `latest`/branch/tag/短 SHA、缺审计字段和 tarball SHA 缺失。
  - [x] 5.2 实现确定性 JSON/文本输出及非零退出码，不泄露秘密值。
  - [x] 5.3 先写失败测试，覆盖重复 provider、entry/tool/command/service/UI slot/端口/SQLite/cache/env 与配置 secret。
  - [x] 5.4 实现 preflight，并使用 Cordis `entryListSchema` 解析 patch。
  - [x] 5.5 运行命令 package coverage、typecheck 和 lint。

- [x] Task 6: 实现 `smoke-profile` 与 `compare-benchmark`。
  - [x] 6.1 先写失败测试，覆盖超时、子进程非零、缺 bundle、非法 profile，以及从函数入口起算并在 worker 构造后重算的 55 秒执行工作预算；正常、错误和超时路径都等待 worker 终止，构造与终止清理不计入硬性总 wall-clock 保证。
  - [x] 6.2 实现 profile smoke 的 JSON 结果，验证 manifest、bundle 解析、dump-config/help 阶段。
  - [x] 6.3 先写 benchmark 统计测试，覆盖均值/P50/P95、失败分布、加权分和五个非补偿门槛。
  - [x] 6.4 实现 rollback 阈值判定与上一版 lock/profile 快照引用。
  - [x] 6.5 运行命令 package coverage、typecheck 和 lint。

- [x] Task 7: 组装 P0/P1/P2 profile 数据并执行准入。
  - [x] 7.1 P0 依次处理 toolkit、context、search、memory、MCP、checkpoint、LSP、permission、OTel、config manager。
  - [x] 7.2 P1 处理 smooth-stream、upstream-radar、plugin-hub、session-export、better-sidebar。
  - [x] 7.3 P2 处理 agent-team/background-agents、computer-use、vision-router、llm-fallbacks、univer-office、feishu。
  - [x] 7.4 每个候选分别运行 verify-lock、preflight 和 profile smoke；失败候选保留审计结果并从 active profile 移除。
  - [x] 7.5 验证每个 profile 同域最多一个 active provider，enterprise 限制和 P0 基线 exclusions 成立。

- [x] Task 8: 添加 real-composition、负向故障与回归覆盖。
  - [x] 8.1 通过 Loader/app-boot 真实组合路径加载 curated bundle/profile，验证启用、禁用、卸载和错误路径。
  - [x] 8.2 注入搜索超时、429、SQLite 锁、无权限文件、非法 patch、断网和初始化失败的本地 fixture；浏览器崩溃没有本地 fixture，继续作为 planned/pending 风险项。
  - [x] 8.3 验证 fail-closed、单插件禁用恢复、错误包含候选/阶段且不包含秘密。
  - [x] 8.4 验证官方 web/headless、工具管线、权限交互和会话日志未改变。

- [x] Task 9: 完成仓库要求的 Agent Note 与包文档。
  - [x] 9.1 新增 proposed/implemented 生命周期正确的英文 Agent Note，记录精选层边界、拒绝直接修改 core 与不执行第三方安装脚本的理由。
  - [x] 9.2 新增中文 counterpart 和 i18n sidecar；实现完成后将内容改为当前事实。
  - [x] 9.3 为每个新包补齐 README、Model Experience、Known Limitations 和导出 JSDoc。
  - [x] 9.4 运行 Agent Note 与文档 focused gates。

- [x] Task 10: 系统验证、审查与 Ralph 状态收敛。
  - [x] 10.1 运行所有 curated focused tests、coverage、constraints、typecheck、lint、doc-sync、build/hygiene 相关叶级命令。
  - [x] 10.2 自审 `git diff`，确认没有改动用户已有文档移动、没有调试残留、没有计划文档进入 staged 状态。
  - [x] 10.3 委派独立代码审查与安全审查；修复发现后重新运行对应门禁。
  - [x] 10.4 更新本文件、`checklist.md` 和 append-only `progress.md`，只有新鲜证据支持时才全部勾选。

- [x] Task 11: 从零建立目标文档到实现与证据的追踪矩阵。
  - [x] 11.1 逐条审计 `docs/plugin/superpowers/` 七份文档，将每个 P0/P1/P2 要求映射到源码、配置、测试或明确的长期评测资产。
  - [x] 11.2 独立核对候选目录的来源、完整 SHA、许可证、bundle 声明、Node 兼容性、安装脚本和 active/rejected 决策，不复用旧验收结论。
  - [x] 11.3 审计五个 profile 的继承、能力域互斥、enterprise 限制、官方 profile 不变量和物化幂等性。
  - [x] 11.4 审计 policy、preflight、verify-lock、smoke-profile 和 compare-benchmark 的成功、拒绝、脱敏、超时与 fail-closed 路径。
  - [x] 11.5 记录所有发现并区分真实实现缺口、陈旧文档、不可在单轮本地完成的长周期评测和无效要求。

- [x] Task 12: 修复 Task 11 发现的可执行缺口。
  - [x] 12.1 为每个行为缺口先添加或确认失败测试，再实施最小修复。
  - [x] 12.2 同步受影响的 README、JSDoc、双语文档、Agent Note 与生成工件；不修改 `docs/plugin/superpowers/` 的规划口径，除非其描述与仓库事实冲突。
  - [x] 12.3 对每项修复运行耗时少于一分钟的 focused test、typecheck、lint 或文档叶级门禁。

- [x] Task 13: 取得不依赖旧记录的新鲜运行证据。
  - [x] 13.1 运行 curated 包 focused tests 与覆盖率、workspace constraints、Host/client typecheck、lint、doc-sync、build 和 hygiene 的相关叶级命令。
  - [x] 13.2 运行 verify-lock、五个 profile 的 preflight/smoke、benchmark 比较和全部负向 fixture，核对退出码与脱敏输出。
  - [x] 13.3 通过真实 CLI/PTy 验证 `web-curated` 与 `headless` 基线路径；需要浏览器时只使用 Chrome CDP 9333，并修复控制台 error。
  - [x] 13.4 检查 diff 与 staging，确认不回滚或覆盖用户改动，不执行 commit/push/merge/rebase/reset，规划工件不进入 staging。

- [x] Task 14: 独立复审并完成 Ralph 收敛。
  - [x] 14.1 委派独立代码审查、安全审查和规格一致性审查，覆盖全部 curated 直接改动与 Task 11 追踪矩阵。
  - [x] 14.2 修复所有 P0-P2 或高置信度实质问题，并重新运行受影响门禁。
  - [x] 14.3 逐项重验新增 checklist，更新任务状态，并向 append-only `progress.md` 追加本轮唯一总结。

- [x] Task 15: 修复 observed profile validation 的新鲜验证缺口。
  - [x] 15.1 修复 `sameStrings`，对双方执行顺序无关比较。
  - [x] 15.2 修复 observed preflight，区分合法 Cordis 层覆盖与同层重复，并允许 `*Env` 字段引用环境变量名而不判为明文 secret。
  - [x] 15.3 修复 smoke staging 失败输出，保留结构化 `observed`、`profile` 和 `stages` 诊断。
  - [x] 15.4 添加 focused tests，并重新验证五个 curated profile 的 preflight 与 smoke。

- [x] Task 16: 收敛 Task 13.1 的本地验证失败项。
  - [x] 16.1 补齐 curated per-file 100% coverage；只测试真实可达且有契约价值的分支，并以等价简化删除不可达分支。
  - [x] 16.2 仅构建缺失的 `dsh-llm` 产物，并重新运行 `commands.spec.ts` 全量。
  - [x] 16.3 使用仓库权威生成命令更新 owner 工件 `docs/module-graph.md`，并验证生成结果新鲜。
  - [x] 16.4 运行 coverage、commands tests、curated policy/scripts typecheck、scoped lint、`verify-module-graph` 和 `git diff --check`，每条命令少于 55 秒。

- [x] Task 17: 从零建立本轮独立审计基线。
  - [x] 17.1 并行委派只读子代理，分别审计七份规划文档的需求追踪、curated 源码与测试覆盖、候选供应链事实、五个 profile 组合，以及未勾选 P0/P1/P2 路线图的证据状态。
  - [x] 17.2 不复用 `progress.md` 的通过结论；每项结论必须引用当前源码、配置、测试或本轮命令输出。
  - [x] 17.3 区分行为缺口、文档与实现漂移、缺少外部环境的长期评测、以及规划明确要求保持 pending 的事项。
  - [x] 17.4 汇总为本轮修复清单；只修复可由当前仓库拥有且能以少于 1 分钟叶级门禁验证的问题。

- [x] Task 18: 以 TDD 修复 Task 17 发现的仓库内缺口。
  - [x] 18.1 每个行为缺口先由子代理添加失败测试并确认按预期失败，再实施最小修复。
  - [x] 18.2 同步受影响的 README、JSDoc、双语 owner 文档、Agent Note 与生成工件；`docs/plugin/superpowers/` 只在其当前事实错误时更新。
  - [x] 18.3 对每项修复执行 focused test、coverage、typecheck、lint 或文档叶级门禁，并保留命令与结果。
  - [x] 18.4 不修改 Agent loop、官方 `web`/`headless` 模板、session wire format 或用户无关改动。
  - [x] 18.5 五个 curated 包均按公开发布约定加入 DSH 发布族；测试固定其依赖顺序、导出、命令入口、数据资产和打包安装闭包。

- [x] Task 19: 取得本轮新鲜的静态、组合与运行时证据。
  - [x] 19.1 运行 curated focused tests 与 per-file coverage、workspace constraints、相关 Host/client typecheck、scoped lint、文档门禁、build/hygiene 叶级检查。
  - [x] 19.2 逐个核对静态/安装资格候选的 runtime 启用证据；六个候选因缺少真实固定工件的 keyless assembled snapshot 而保持 inactive，`dsh-web-search-pro` 还缺少必需的 browser bundle/runtime dependency；不以 observed `verify-lock`、`preflight` 或 `smoke-profile` 替代生命周期证据。
  - [x] 19.3 运行 `compare-benchmark` 的 accepted/rejected/rollback/pending 路径和全部本地可模拟负向 fixture；声明为 `planned` 或 `fixture` 的记录不得被接受，producer identity 与 `evidenceKind` 的真实性未经过密码学认证，仍由 operator trust 负责。
  - [x] 19.4 通过真实 CLI/PTy 验证 `headless` 与 curated profile 启动面；仅在本轮实际启用 UI 候选时使用 Chrome CDP 9333，并修复控制台 error。
  - [x] 19.5 搜索、记忆、浏览器、MCP、故障注入、100/200 任务 A/B 与 3–7 天 canary 只有取得符合文档规模要求的真实记录时才能勾为已运行；声明为 `planned` 或 `fixture` 的记录继续保持 pending/unverified 且不得被接受，`evidenceKind` 真实性仍由 operator 负责。

- [x] Task 20: 独立复审并闭环实质问题。
  - [x] 20.1 复核既有独立规格、代码与安全审查，覆盖 `packages/curated/**`、profile/CLI bridge、直接关联文档与本轮 diff；最终修复由唯一写入代理完成。
  - [x] 20.2 对所有 P0–P2、高置信度行为缺陷、安全问题和规格遗漏完成最小修复，并重新运行覆盖其改动的门禁。
  - [x] 20.3 复审确认无未解决 in-scope 实质问题，且官方 `web`/`headless` 不变量有本轮证据；根 lint 的既有未跟踪生成声明阻塞记录在报告中。
  - [x] 20.4 以 TDD 强制五个 curated profile 和 `dsh plugin` 禁用依赖生命周期脚本，并拒绝既有脚本开启或构建授权配置且不改写用户文件。
  - [x] 20.5 以 TDD 拒绝未由 catalog 独立固定内容的 pnpm patch、package extension、pnpmfile 和 `patch_hash` 转换，同时保留精确 lock integrity、Git commit 与运行时依赖闭包校验。
  - [x] 20.6 以 TDD 将精选组合准入接入正常启动与配置 dump，禁止 `dsh plugin` 改变固定精选模板，并保持普通 profile 与 installation-first 解析。
  - [x] 20.7 以 TDD 为 active 候选固定 runtime 依赖闭包摘要，使 root lock 与 installed lock 必须彼此相同并同时匹配 catalog。
  - [x] 20.8 修复 `CuratedPolicy.getProfileCandidates()` 以 catalog 原始顺序返回，并同步 README/JSDoc、生成工件与 Agent Note。
  - [x] 20.9 将缺少真实固定工件 keyless assembled snapshot 的 6 个候选 fail-closed 为 inactive，清空第三方 profile 基线，并同步 lock/profile/manifest、测试和当前事实文档；`dsh-web-search-pro` 另记录缺少必需 browser bundle/runtime dependency。

- [x] Task 21: 收敛 Ralph 状态与工作区边界。
  - [x] 21.1 从零并行审计 `2026-08-28 本轮复审` checklist，依据当前源码、配置和测试识别 profile 准入、供应链证据、秘密扫描与 P2 资产的高置信度缺口。
  - [x] 21.2 以 TDD 拒绝同身份重复 profile 插入和非模板 `optionalDependencies`/`devDependencies`，并保持普通 profile 与允许的 curated 状态不变。
  - [x] 21.3 以 TDD 解析并校验 activation evidence 工件语义，将 required runtime bundle 绑定到同 profile 的 active 候选和安装闭包。
  - [x] 21.4 以 TDD 扩大 benchmark metadata 与完整 Cordis entry 的秘密扫描，并让 P2 故障资产只能声明真实 runtime fail-closed/recovery 结果。
  - [x] 21.5 隔离 smoke 子进程的 cwd 与 dotenv 来源，确保清理后的环境不会从仓库或 profile `.env` 重新引入凭证。
  - [x] 21.6 同步硬门禁与八维评分文案，运行受影响 focused tests、coverage、typecheck、constraints、lint、文档和 build/pack 叶级门禁。
  - [x] 21.7 委派独立代码、安全和规格复审，修复全部 P0–P2 或高置信度实质问题后重新验证。
  - [x] 21.8 检查工作树和 index 指纹，确认未还原、覆盖或混入用户改动，未执行 commit、push、merge、rebase、reset 或 git add。
  - [x] 21.9 向 append-only `progress.md` 追加本轮唯一总结。

## Task 11 审计结论

1. `smoke-profile` 为外部 bundle 生成 no-op shim，没有加载真实插件，因此不能证明真实插件可运行（`packages/curated/curated-scripts/src/index.ts:542-631`；`packages/curated/curated-scripts/tests/commands.spec.ts:1434-1505`）。
2. preflight 与静态准入信任手写的 allowlist、resource 和总分数据，不从候选工件提取或核对这些事实，也没有八维评分（`packages/curated/curated-scripts/src/index.ts:1100-1430`；`packages/curated/curated-policy/src/index.ts:281-423`）。
3. enterprise 开关和 P2 预算只是元数据；policy `apply` 忽略 enterprise 字段，预算也未进入运行时执行路径（`packages/curated/curated-profiles/src/index.ts:26-51,120-128`；`packages/curated/curated-policy/src/index.ts:587-596`；`packages/curated/curated-bench/tasks/p2-risk-gates.json:4-35`）。
4. 冲突校验只使用 `capability-conflicts.yaml` 的能力域集合，没有执行其中的 provider/fallback/rule；`context` 与 `context-doctor` 的能力名不一致时可绕过策略（`packages/curated/curated-policy/policy/capability-conflicts.yaml:3-38`；`packages/curated/curated-scripts/src/index.ts:1400-1429`）。
5. permission fail-closed 策略仅被解析和查询，没有接入工具执行或审批路径（`packages/curated/curated-policy/policy/permission-rules.yaml:3-30`；`packages/curated/curated-policy/src/index.ts:520-596`）。
6. secret 扫描跳过 curated 元数据，且 smoke 子进程继承未清理的 `process.env`（`packages/curated/curated-scripts/src/index.ts:500,1267-1279`）。
7. `verify-lock` 没有强制核对 Node 兼容性和 requires-core-patch（`packages/curated/curated-scripts/src/index.ts:378-404,1105-1183`）。
8. benchmark 允许 baseline/candidate 使用不可比的任务集和重复次数，在硬门槛前舍入指标，基线以 1ms/1-token 伪造成功记录，rollback 只返回路径字符串（`packages/curated/curated-scripts/src/index.ts:822-970`；`packages/curated/curated-bench/baselines/benchmark.json:6-168`）。
9. regression matrix 主要核对常量和文档化 fixture，没有运行真实 tool、approval 或 session 路径（`packages/curated/curated-bench/baselines/web-cdp-regression.json:1-31`；`packages/curated/curated-bench/tasks/p2-risk-gates.json:37-64`）。
10. 候选复核发现 14 个 repo/SHA 对返回 404，但 `verify-lock` 仍通过；20 个 active pin 均可访问，但 `dsh-permission-rules` 漏记实际 prepare script，`dsh-llm-fallbacks` 的 license 拒绝与仓库 MIT LICENSE 冲突，active `dsh-better-sidebar` 的 78 分不满足 P1 ≥85，active `dsh-plugin-hub` 与 `plugin-session-export` 的 Node 兼容性不可验证（`packages/curated/curated-policy/policy/plugin-allowlist.yaml:216-242,303-329,397-423,491-517,655-680`）。
11. 文档与 profile 分配互相矛盾：research 的 session-export、mneme、vision 归属不一致，基线数量也存在 12 与 15 的冲突（`docs/plugin/superpowers/01-目标架构.md:93-112`；`docs/plugin/superpowers/02-插件矩阵与择优.md:116-120`；`packages/curated/curated-profiles/src/index.ts:60-87`）。
12. 浏览器、搜索、记忆、MCP、canary 等长周期工作仍待执行，不得表述为已通过（`docs/plugin/superpowers/03-实施路线图.md:236-262`；`packages/curated/curated-bench/README.md:33-36`）。

- [x] Task 22: 补齐 Ralph Loop Round 2 发现的精选 profile 与 activation evidence 准入缺口。
  - [x] 22.1 以 TDD 让精选 profile 的 `.npmrc` 只接受仓库生成的安全配置，并拒绝 path redirect、registry、auth 等额外键。
  - [x] 22.2 以 TDD 要求每个 selected active candidate 自身具备与 `targetProfiles` 精确匹配且对当前 profile 完整的 `runtimeActivationEvidence`，不能只校验 required bundle provider。
  - [x] 22.3 以 TDD 让 activation evidence 的所有诊断统一脱敏非法 candidate、profile 和 path 标识；存在 policy issues 时不得继续遍历未验证 evidence。
  - [x] 22.4 运行 focused tests、curated per-file coverage、typecheck、lint、doc-sync、build、hygiene 和 packed entry，复审并确认 index 边界。

- [x] Task 23: 补齐 Ralph Loop Round 2 最终复审发现的 profile 与诊断安全缺口。
  - [x] 23.1 以 TDD 拒绝四个受管 profile 子文件（`package.json`、`cordis.patch.yml`、`pnpm-workspace.yaml`、`.npmrc`）的 symlink/junction；悬空链接不得在 profile 外创建目标，现有外部目标不得读取或修改。
  - [x] 23.2 以 TDD 拒绝 manifest `pnpm.configDependencies` 及其他可加载 package-manager hook/config dependency 的字段，确保 pnpm 不执行。
  - [x] 23.3 以 TDD 对 activation diagnostics 中的 candidate、profile 和 path 做结构化脱敏，覆盖 `key=value`、`Authorization Basic`、URL userinfo，并修复合法 ID/path 含 `authorization` 的误拒绝。
  - [x] 23.4 重跑全量相关门禁和安全/代码复审。

- [x] Task 30: 从零独立复审并严格执行 `integrate-curated-plugin-layer`，取得本轮新鲜证据后收敛。
  - [x] 30.1 并行委派只读子代理，从零重建需求追踪：分别审计七份 `docs/plugin/superpowers/` 规划文档的 P0/P1/P2 要求、curated 源码与 per-file 覆盖、候选供应链事实（完整 40 位 SHA/许可证/bundle/Node engine/安装脚本/active-rejected）、五个 profile 组合与隔离、以及长周期评测证据诚实性；不复用旧通过结论，每项结论引用当前源码、配置、测试或本轮命令输出。
  - [x] 30.2 取得本轮新鲜证据：运行 curated focused tests 与 per-file coverage、workspace constraints、相关 typecheck、scoped lint、doc-sync、build/hygiene 叶级门禁；运行 verify-lock/preflight/smoke-profile/compare-benchmark 的成功、拒绝、超时、回滚、pending 与脱敏路径，核对退出码与脱敏输出（每条命令 < 1 分钟）。
  - [x] 30.3 通过真实 CLI 在洁净隔离 DSH home 下验证 `headless` 与五个 curated profile 启动面；当前无 active UI 候选，Chrome CDP 9333 不适用。
  - [x] 30.4 对本轮发现的任何仓库内行为缺口先添加预期失败测试再最小修复；委派独立代码、安全与规格一致性复审，修复全部 P0–P2 或高置信度实质问题后由唯一写入代理重跑受影响门禁。
  - [x] 30.5 核对 index 与工作树边界，无新增 staged 报告或状态文件，未执行 commit/push/merge/rebase/reset/add；一次验证代理误调用 `git write-tree`，仅返回已存在且等于 HEAD tree 的 `551bbad102aef40396f7597f22c1b95f7aaf0640`，未改变 index、refs 或工作树，也未生成新的 tree 内容；更新 tasks/checklist，并向 append-only `progress.md` 追加本轮唯一总结。

## Task Dependencies

- Task 2 depends on Task 1 的稳定候选数据字段。
- Task 3 depends on Task 1 and Task 2；Task 4 depends on Task 1 and Task 2。
- Task 5 depends on Task 3；Task 6 depends on Task 3 and Task 4。
- Task 3 and Task 4 can run in parallel after Task 2。
- Task 5 and Task 6 can run in parallel after their dependencies。
- Task 7 depends on Tasks 4–6。
- Task 8 depends on Task 7。
- Task 9 can start after Task 2 and finish after Task 8。
- Task 10 depends on Tasks 1–9。
- Task 11 是本轮独立重审起点；11.1–11.4 可由只读子代理并行执行，11.5 汇总其证据。
- Task 12 depends on Task 11；若 Task 11 无实现缺口，Task 12 以“无需修改且有证据”完成。
- Task 13 depends on Task 12；13.1–13.3 可在互不写同一输出时并行。
- Task 14 depends on Tasks 11–13。
- Task 17 是本轮从零重审起点；17.1 的只读审计可并行，17.4 汇总后才能进入 Task 18。
- Task 18 depends on Task 17；互不重叠文件的修复可并行，重叠文件保持单写入代理。
- Task 19 depends on Task 18；19.1–19.4 可在不写同一持久工件时并行。
- Task 20 depends on Tasks 17–19；Task 21 depends on Task 20。Task 21.2–21.5 由单一写入代理顺序完成，21.6–21.7 在实现完成后执行，21.8–21.9 最后收敛。

- [x] Task 24: 修复 Task 23 独立复审要求的受管文件身份绑定与 URL userinfo 脱敏缺口。
  - [x] 24.1 以 TDD 将受管 profile 已存在文件的校验绑定到随后读取的同一 regular-file descriptor/identity，使 curated CLI 的 ensure→load 路径不再按未受保护路径重读 `package.json` 和 `cordis.patch.yml`；symlink、junction、其他文件替换或祖先替换均须 fail closed，且不得读取外部目标。
  - [x] 24.2 以 TDD 将 URL userinfo 脱敏限制在 authority 内并取最后一个 `@` 作为分隔符，覆盖密码包含未转义或编码 `@`，且不误伤 path、query 或 fragment 中的普通 `@`。
  - [x] 24.3 先确认新增测试按预期失败，再实施最小修复，并重跑 focused tests、coverage、静态检查、文档检查、build、packed 验证与独立复审。

- [x] Task 25: 修复本轮真实调用链发现的 curated live HMR profile patch 描述符绑定缺口。
  - [x] 25.1 以 TDD 让 curated live HMR 的 `composeLive()` 每次重组都取得 descriptor-bound managed-file snapshot，使用 snapshot bytes 解析 profile `cordis.patch.yml` 并执行 admission，在返回前复核 identity 并关闭 descriptor；不得继续由 `loadOptionalPatches` 按路径读取后才 admission，确保外部 symlink target 不会被读取，同时保持普通 profile 和 home/explicit overlay 语义不变。
  - [x] 25.2 若为最小实现，恢复并实际使用 app-boot `loadOptionalPatches` 的可选 validated reader；为 reader 提供与缺失分支补齐行为测试和 100% coverage，并覆盖 activation verifier 在 `evidenceIssues` 非空时不 replay 的分支至 100%。
  - [x] 25.3 重跑 focused tests、coverage、full gates，并完成独立复审。

- [x] Task 26: 修复 retained snapshot 重开时的 profile directory identity 绑定与描述符读取验证缺口。
  - [x] 26.1 每次 `openManagedProfileFiles` 或 retained snapshot 打开都将 profile directory identity 绑定到调用时 DSH home 下 `profiles` 目录的 canonical containment；若祖先在 materialization 与 load snapshot 重开之间被替换，必须在任何 `readSync` 前 fail closed。
  - [x] 26.2 以 TDD 强制 `O_NOFOLLOW` 不可用，分别替换 final file 与 ancestor，并监控实际 descriptor/`readSync`；覆盖 initial 与 HMR 调用链，不得只监控 `readFileSync`。
  - [x] 26.3 修正 Agent Note，不再声称 materialization 验证与 load/admission 使用同一 snapshot；重跑相关门禁并完成独立复审。

- [x] Task 27: 补齐真实 initial `prepareProfile()` 调用链的 retained reopen 祖先替换负向回归。
  - [x] 27.1 以 TDD 在 materialization validation snapshot 关闭后、retained snapshot 重开前替换 `profiles` ancestor，强制 `O_NOFOLLOW` 为 `undefined`，监控实际 external descriptor 与 `readSync`，证明在任何外部读取前 fail closed。
  - [x] 27.2 重跑相关 coverage 与独立复审。

- [x] Task 28: 修复 Bits group 2/3/4 复审发现的 activation replay、秘密脱敏、smoke 隔离与 planning-history 绑定缺口。
  - [x] 28.1 Activation replay 使用最小无凭证环境，要求结构化确认至少一个测试匹配，将 worktree bytes 绑定到 stage-0 blob，并在 replay 前复核两者仍一致。
  - [x] 28.2 YAML secret scope 跨 comment 行持续生效，并对 code frame 中的 scalar 执行二次脱敏，确保秘密不会通过注释间隔或诊断摘录泄露。
  - [x] 28.3 Smoke 在残留 process group 未清理时强制失败，且 proxy 仅允许 credential-free origin。
  - [x] 28.4 Planning-history source path 先标准化并拒绝任何 `..` 路径段，同时将 `kind` 绑定到对应的 locks/profiles 来源。
  - [x] 28.5 运行相关 focused tests、coverage 与 full gates，并完成独立代码、安全和规格复审。

- [x] Task 29: 从零独立复审并严格执行 `docs/plugin/superpowers/` 七份规划，取得本轮新鲜证据后收敛。
  - [x] 29.1 并行委派只读子代理，从零重建需求追踪：分别审计七份规划文档的 P0/P1/P2 要求、curated 源码与 per-file 覆盖、候选供应链事实（完整 SHA/许可证/bundle/Node engine/安装脚本/active-rejected）、五个 profile 组合与隔离、以及未勾选长周期评测的证据状态；不复用 `progress.md` 的旧通过结论，每项结论引用当前源码、配置、测试或本轮命令输出。
  - [x] 29.2 取得本轮新鲜证据：运行 curated focused tests 与 per-file coverage、workspace constraints、相关 typecheck、scoped lint、doc-sync、build/hygiene 叶级门禁；运行 verify-lock/preflight/smoke-profile/compare-benchmark 的成功、拒绝、超时、回滚、pending 与脱敏路径，并核对退出码与脱敏输出（每条命令 < 1 分钟）。
  - [x] 29.3 通过真实 CLI 验证 `headless` 与 curated profile 启动面；当前无 active UI 候选，Chrome CDP 9333 不适用。
  - [x] 29.4 本轮五路独立只读审计与最终对抗复审均未发现仓库内行为缺口；唯一被标记项（summary rollup 的空 tree/closure 摘要 map）经核实为 `bench.spec.ts:121-126` 刻意锁定的契约、无运行时消费、权威 `plugin-allowlist.yaml` 仍持有 6+6 真实摘要，非缺陷，遵循简化/外科式改动原则不改动；未修改 `docs/plugin/superpowers/`、Agent loop、官方模板或 session wire format。
  - [x] 29.5 委派独立代码、安全与规格一致性复审，覆盖 `packages/curated/**` 与 CLI bridge；最终对抗复审 verdict = CLEAN，无 P0–P2 或高置信度实质问题（唯一 informational 观察为未来激活 permission 候选时的前瞻性提示，当前不可达）。
  - [x] 29.6 核对工作树与 index 指纹：staged SHA-256 保持 `0d654fdb471cb3501ae2eaa313af3c23742af74e314420b083783a5ec55b0ba6`，未回滚/覆盖/混入用户改动，未执行 commit/push/merge/rebase/reset/add；已向 append-only `progress.md` 追加本轮唯一总结。

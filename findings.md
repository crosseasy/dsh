# Superpowers 审查发现

## 工作树基线

- 当前分支：`feat_825`，跟踪 `origin/feat_825`。
- 工作树在本次任务开始前已有约 404 个文件、37k+ 行新增的未提交改动，核心集中于 curated plugin layer、CLI、bench、policy、profiles、scripts、文档、SDK 与 workflow。
- `docs/plugin/superpowers/` 自身及相关设计/实施计划已被修改，说明本任务很可能是对既有大规模实现做严格复审、补缺与最终验证，而不是从零开发。
- 上一会话摘要显示 curated plugin layer 的 Task 22 已收口，涉及安全 `.npmrc`、candidate evidence、脱敏、policy 等；仍需以文件和测试为准重新核验。

## 已确认问题

1. `scripts/audit-curated-candidates.spec.ts` 的“Git diagnostics 不泄露 secrets”测试把总审计预算设为 1 秒。该测试先执行真实 `git init --bare`，在并行的 983 测试负载下预算可能耗尽于 fake fetch 之前，导致得到正确但非目标分支的 `Git source audit timed out`，而非断言的 `Git source audit failed`。生产代码正确地区分超时和 Git 失败，修复应扩大此非超时测试预算，而不是折叠生产错误分类。
2. 将该用例预算提高到 5 秒后，`scripts/audit-curated-candidates.spec.ts` 31/31 通过；未削弱密钥不出现在错误消息中的断言。
3. `packages/curated/curated-scripts/tests/commands.spec.ts` 的 `benchmarkRun()` 由对象字面量推断出 `failure: null`，随后按失败样本写入字符串无法通过 strict TypeScript。测试返回契约本就是开放的 `Record<string, unknown>`；为局部变量补同一显式类型后 host/client typecheck 通过。
4. `doc-sync` 的 29 项门禁中 28 项通过；唯一失败是三组 README 已共同修改但 `.i18n.yaml` 未重录。`docs/i18n/README.md` 明确要求先人工确认语义一致，再使用 scoped `verify-translation-pairing --write <pair>` 记录两个工作树 blob。
5. lint 发现三处机械问题：一个返回 void 的 shorthand arrow，以及测试 mock 中冗余类型断言/返回 void。均不改变行为，已按规则改成 block-bodied callback。
6. 人工逐段核对 `apps/cli/README*`、`packages/boot/app-boot/README*`、`packages/curated/curated-profiles/README*`：三组新增事实、限制、安全措辞、表格/列表与链接在中英文间语义和结构一致；scoped 记录与 corpus-wide `doc-sync` 均已通过。
7. 规范的“整份计划 DoD”确实把 runtime active=0 的仓库机制完成与 P1/P2 外部实验完成混在一起；已改为三层状态，明确当前只可验收治理基础设施，候选激活与 rollout 继续 pending。

## 规范审计摘要

- `docs/plugin/superpowers/` 共 10 个 Markdown 文件，当前描述的是 curated plugin 治理层、五个 profile、37 个候选目录、四个门禁 CLI、评测/证据/供应链规则和 P0/P1/P2 路线图。
- 当前实现状态按规范事实为：37 candidates、12 个 `web-curated` 目标候选、6 个具备静态/安装资格、0 个 runtime active。仓库没有交付第三方插件运行能力，长期 A/B、故障注入、E3/E4、Chrome CDP 和 canary 仍无真实证据。
- 机制层已经广泛实现：五个 curated 包、profile 物化与 admission、只读插件安装、固定来源及 digest、observed lock/preflight/smoke、activation evidence gate、benchmark comparator、发布接线和大量负向测试。
- 最高优先级规范矛盾：`00` 允许 6 qualification/0 active/pending experiments 作为整份计划 DoD，而 `03` 的 P1/P2 出口要求 A/B、故障注入和 canary 已完成；必须拆分“治理基础设施完成”“候选激活完成”“生态 rollout 完成”。
- 文档中的“本目录 Markdown 不进 Git”与当前所有文件已跟踪直接冲突；应删除或改为历史说明。
- 路线图存在不可执行命令：缺失的 `tests/fixtures/dup-tool.yml`、只打印 `resolved` 而不解析包的命令、不能验证无错误行的 dump 命令，以及没有 tokenizer/采集器定义的 token 比较方法。
- 状态模型缺口：qualification/pending/rejected/active 概念重叠；`dsh-background-agents` 为 `active:false` 且无 rejection，只能隐式推断 pending；E0–E5 与补充评分公式仅存在于文档，不进入机器模型。
- 安全/生命周期缺口：沙箱顺序有两种表述；`workspace-write`/`danger-full-access` 未映射到 DSH 配置；preflight 主要信任 catalog resource claims，不能自动发现运行时代码新增资源；激活证据缺少统一的同进程 unload/HMR 资源前后快照。
- 长周期 A/B、故障注入和 rollout 目前只有 planned/pending 资产及 comparator，没有 producer/orchestrator、owner、环境指纹、结果晋升路径或自动恢复执行器。

## 实现盘点摘要

- 五个 curated 包、CLI 激活入口、发布/打包接线、仓库级 activation-evidence gate、源码审计器、文档、Agent Note 和千级负向测试均已存在；没有发现需要修改 agent-loop 或 session/SDK 协议的功能面。
- 现有 profile 默认安全休眠：五个模板只有安装自有基础 bundle，37 个目录候选全部 `active:false`；其中 6 个达到静态/安装 qualification，但不具备激活证据。
- 生命周期/配置主路径已有较强实现：atomic materialization、descriptor-bound managed files、profile generation retry/reclaim、enterprise user-layer re-admission、curated plugin 命令只读模式与 `install` 限制。
- 评测主路径已有 schema 与比较器：任务/基线/lock/profile 快照、environment/producer metadata、五次重复、非补偿阈值、rollback 摘要校验、planned/fixture/observed 区分。
- 直接必须修复的实现问题：`runPreflight` 对 caller-provided `--profile-root` 主要校验 leaf profile/package artifacts，不完整拒绝 profile-root 祖先 symlink；curated install 仍调用普通 pnpm install，Git 依赖的远程 fetch/prepare 风险没有由机制完全消除，需限定为锁文件/本地 store 可复现安装或更明确拒绝不安全来源。
- 其他未实现项主要是外部证据而非可在本仓库伪造的代码：真实第三方 plugin assembled runnable snapshot、E3/E4 生命周期、Chrome CDP、A/B producer、故障注入执行器、3–7 天 canary/rollout。

## 独立严格复审确认的实现缺陷

- Profile/CLI：curated `install` 缺少原子提交和跨进程串行化；运行中 profile 可能观察到一半更新。
- Profile 物化：四个受管文件逐个发布，失败可留下部分状态；同调用中新建文件未进入 retained snapshot；并发首次物化可能因 `EEXIST` 失败；`$DSH_HOME/profiles` 自身为 symlink/junction 时约束不足。
- CLI 只读命令：`plugin list`/`--help` 在执行 pnpm 前物化 profile，违背只读语义。
- HMR：watcher setup 中途失败时，已注册 watcher 未逆序清理，CLI 也未 dispose 已启动 root。
- Admission：enabled Cordis row 可以通过手写 `curated.active:false` 排除冲突；权限控制 order 只校验相对先后，未拒绝缺少/重复/额外阶段。
- Smoke/lock：`--help` 阶段实际会进入 profile boot/Loader；零候选 profile 缺两份 lock 仍可形成 observed success；artifact tree hash 与后续读取/child 启动之间存在 TOCTOU。
- Benchmark：profile snapshot 子集比较、可变 path-only 引用、缺失 DSH build/measurement identity 和输出丢失引用身份等缺陷已修复。顶层 schema 3 绑定四个 `{ path, sha256 }` 引用，完成记录要求两侧 DSH build 与 producer/tokenizer/serialization/timing/pricing/scoring identity 精确一致，并在 comparator 内对 profile 应用权威模板 exact-order 校验；curated-bench 69 项、curated-scripts 412 项及 packed smoke 均通过。

## 当前安全修复任务

1. `scripts/verify-curated-activation-evidence.ts` 的 tracked-evidence 校验先从 Git index 取得 blob 身份，随后按路径 `readFile`；若检查后受信任祖先被替换为 symlink/junction，读取可跳到仓库外。修复必须把 containment、regular-file、内容上限与稳定 identity 绑定到已打开 descriptor，并在读取前后验证路径祖先/文件 identity 未变化。
2. `packages/curated/curated-scripts/src/index.ts` 的 `.npmrc` 值查找按前缀匹配时会把 `fetch-retries` 或 `deep-registry` 当成受保护的 `retries`/`registry`。修复必须精确解析配置键，并对重复的安全关键键 fail-closed；诊断不得回显值或 URL。
3. 需在直接测试中加入祖先检查后替换、前缀键、重复键、secret 不回显，并同步 curated-scripts README 与现有 `2026-08-25-curated-plugin-layer-governance` Agent Note。Agent Note 当前未归档，可更新；中英文与 pairing metadata 同步处理。

## 本轮生命周期修复约束

- 仅实现已确认的 #3/#6/#7/#8/#9/#10/#12/#13；不修改 curated-bench 或 curated-scripts。
- #3 已实现跨进程 writer serialization、非 live staging、校验后的目录 rename 激活点、失败 staging reclaim，并在 pnpm/校验失败期间保持旧 profile 可用；激活 rename 失败会恢复旧目录。跨平台 Node 没有目录 exchange 操作，因此替换已有 live 目录包含受锁保护的 `live -> previous`、`stage -> live` 两次 rename；无锁 reader 可在两次 rename 之间短暂观察路径缺失，但不会观察部分新目录。
- #6/#7/#8 需要在任何写入前验证所有已有受管输入，事务发布四文件，将新文件纳入 retained identity，接受内容一致的并发发布，并拒绝 `profiles` 根 symlink/junction。
- #9 的安全兼容语义：`plugin list`/`--help` 不创建或更新 profile；缺失 profile 直接从固定模板或 package-manager 只读视图响应，不能隐式安装。
- #10 受“不修改 curated-scripts”限制；必须在允许的 boot/admission 或 policy 层阻止 enabled row 以 `curated.active:false` 逃逸。如果无法使 observed preflight 同时拒绝，应明确记录剩余限制而非声称完全修复。
- #12 将权限顺序与权威五阶段数组做 exact ordered equality。
- #13 将 post-boot timer/HMR/profile/home watcher setup 作为单事务，失败时先逆序释放已完成注册并 dispose root 到 quiescence，再重抛。

## 待填充

- 最终修复记录
- 测试及门禁证据

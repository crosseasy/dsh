# 验收清单

- [x] `packages/curated/` 仅包含职责单一的公开 workspace 包，并遵循 ESM、Cordis peer/dev dependency、Host aggregate、invariant 和 DSH 发布族约定。
- [x] curated bundle 的 manifest 声明有效 `dsh.bundle.patch`，patch 可由 Cordis `entryListSchema` 解析。
- [x] Runtime active 数为 0；6 个静态/安装资格候选保留完整 40 位 commit SHA、来源、许可证、包名、bundle patch、source/tree/runtime closure 与 npm/Git 审计字段，并记录 `assembled-keyless-snapshot-missing`。
- [x] 无法访问、许可证不清、无 bundle、Node 不兼容或要求核心补丁的候选被机器可读地拒绝，未进入 active profile。
- [x] `verify-lock` 拒绝 `latest`、branch、tag、短 SHA 和缺失审计字段，并且错误不回显秘密值。
- [x] `preflight` 拒绝重复 provider、entry、tool、command、service、UI slot、端口、SQLite、cache 和 env 冲突。
- [x] `preflight` 接受未激活的显式 fallback。
- [x] `ctx.curatedPolicy` 查询返回冻结且顺序稳定的结果，fiber dispose 后无 package-owned 注册残留。
- [x] 五个 profile 模板均可物化，重复运行幂等，不覆盖已有 manifest、用户 patch 或 pnpm workspace 文件。
- [x] 五个 curated profile 只包含安装自有基础 bundle；`web-curated` 不含任何未验证第三方候选。
- [x] `web-coding` 只有一个主编排器；`web-research`、`web-enterprise`、`web-personal` 的能力互相隔离。
- [x] `web-enterprise` 禁用匿名视觉 fallback、IM 正文外发、自动安装脚本和未批准浏览器下载。
- [x] `smoke-profile` 从函数入口使用 55 秒执行工作预算，worker 构造后重算余量，预算耗尽时立即失败；正常、错误和超时路径均等待 worker 终止并清除 listener/timer/reference。构造与终止清理是不可抢占开销，硬性总 wall-clock 截止由调用方监督。
- [x] `compare-benchmark` 正确计算均值、P50、P95、失败分布与加权分。
- [x] 五个非补偿门槛和三类回滚阈值均有自动化测试且能覆盖高总分候选。
- [x] P0/P1/P2 每个候选都有 verify-lock、preflight、smoke 结果；失败候选保留审计记录但不阻断可用 profile。
- [x] Loader/app-boot real-composition 测试覆盖 curated bundle/profile 的加载、禁用、卸载和错误路径。
- [x] 本地 fixture 已覆盖搜索超时、429、SQLite 锁、权限拒绝、非法 patch、断网和初始化失败；浏览器崩溃没有本地 fixture，仍在 planned P2 风险资产中保持 pending。本项勾选只表示覆盖范围与待办状态记录准确。
- [x] 官方 `web`/`headless` profile、Agent loop、工具执行顺序、权限交互和 session wire format未发生行为变化。
- [x] 每个新包 README/JSDoc、Model Experience、Known Limitations 和 Agent Note 双语工件完整。
- [x] focused tests 与 coverage 通过。
- [x] `pnpm run constraints`、`pnpm run typecheck`、`pnpm run lint` 通过。
- [x] `pnpm run doc-sync` 相关门禁通过。
- [x] `pnpm run build` 与 `pnpm run hygiene` 的相关验证通过。
- [x] 独立代码审查和安全审查无 P0–P2 未解决发现。
- [x] 用户已有 `docs/arch/code-optimization-audit*` 移动保持原样。
- [x] 对应验收轮次未新增 `docs/plugin/superpowers/` 与 `.trae/specs/` staged 内容，未改变当时既有 index，且未执行 commit/push/merge/rebase/reset。

## 从零重审

- [x] 七份 `docs/plugin/superpowers/` 文档中的每项 P0/P1/P2 要求均映射到实现、自动化证据、长期评测资产或明确拒绝理由。
- [x] 候选目录的完整 SHA、许可证、bundle、Node engine、安装脚本和 active/rejected 决策已由新鲜只读证据独立核对。
- [x] `web-curated`、`web-coding`、`web-research`、`web-enterprise`、`web-personal` 的继承、隔离、互斥与安全默认值符合规划。
- [x] 官方 `web`/`headless`、Agent loop、工具执行顺序、权限交互和 session wire format 未被 curated 实现改变。
- [x] `verify-lock`、`preflight`、`smoke-profile`、`compare-benchmark` 的成功与负向路径均以新鲜输出验证。
- [x] 所有错误输出均脱敏；秘密值、非法配置、重复资源、超时和子进程失败均 fail-closed。
- [x] curated focused tests 与覆盖率、constraints、typecheck、lint、doc-sync、build 和 hygiene 的相关门禁有新鲜通过证据。
- [x] 真实 CLI/PTy 路径可运行；任何浏览器验证仅使用 Chrome CDP 9333，且控制台无 error。
- [x] 长周期 canary、100/200 任务 A/B 等无法在单轮本地伪造的事项具有可执行资产、阈值判定和诚实状态。
- [x] 双语 README/JSDoc/Agent Note/生成工件与最终实现一致，规划目录保持不进入 git。
- [x] 独立代码、安全和规格审查无未解决 P0-P2 或高置信度实质问题。
- [x] 对应复审轮次未新增 spec/task/checklist/progress staged 内容，未改变当时既有 index，且未回滚用户改动或执行 commit/push/merge/rebase/reset。

## 本轮从零严格执行

- [x] 七份 `docs/plugin/superpowers/` 规划文档的全部当前要求已用本轮源码、配置、测试或命令输出重新建立追踪，未复用旧通过结论。
- [x] 本轮发现的所有仓库内行为缺口均先有预期失败的测试，再由最小实现修复并通过 focused 验证。
- [x] 候选完整 SHA、许可证、bundle、Node engine、安装脚本、core-patch 与 active/rejected 决策已用当前工件重新核对。
- [x] 6 个静态/安装资格候选均因缺少真实固定工件的 keyless assembled snapshot 而保持 inactive；`dsh-web-search-pro` 还缺少必需的 browser bundle/runtime dependency，且 observed smoke 未被当作生命周期证据。
- [x] 五个 curated profile 和 `dsh plugin` 均强制禁用依赖生命周期脚本；既有脚本开启或构建授权配置在物化和 observed 准入时拒绝且保持原字节。
- [x] managed curated profile 拒绝未独立固定内容的 pnpm patch、package extension、pnpmfile 与 `patch_hash` 转换，不弱化 npm SRI、Git commit 或运行时依赖闭包校验。
- [x] 正常 `dsh` 启动与 `--dump-config` 对精选 profile 强制执行轻量 boot admission，拒绝模板/catalog 漂移、危险包管理器状态、动态用户表达式和未批准 executable/group 插入；普通 profile 与 installation-first 解析保持不变。
- [x] `dsh plugin` 在调用 pnpm 前拒绝精选 profile 的 `add`/`remove`，不会先修改固定模板；`list` 保持可用。
- [x] 6 个静态/安装资格候选的 source、tree 与 runtime 依赖闭包摘要继续保留；未来 active 候选的 root lock 与 installed lock 必须彼此一致并匹配 catalog。
- [x] `CuratedPolicy.getProfileCandidates()` 按 catalog 原始顺序返回，模板自身的选择顺序不变。
- [x] `verify-lock`、`preflight`、`smoke-profile` 和 `compare-benchmark` 的成功、拒绝、超时、回滚、pending 与脱敏路径均有本轮证据。
- [x] Curated focused tests、受影响源 per-file coverage、constraints、相关 typecheck、文档、build/pack、catalog freshness 与 scoped lint 门禁通过。
- [x] 根 `pnpm run lint` 重新执行并通过，检查 2,659 个文件且为 0 warning / 0 error；任务开始前的生成声明残留未被本轮修改或删除。
- [x] 五个 curated 包均为带 `publishConfig.access: public` 的 DSH 发布族成员，发布顺序满足运行时依赖，实际 tarball 的导出、命令和数据资产完整，且外部打包安装可解析 `dsh` 的 curated 依赖闭包。
- [x] Source 与 built CLI 的 `headless` 和 curated 启动面通过；当前没有 active UI 候选，因此不要求 Chrome CDP 9333 验证。
- [x] 搜索、记忆、浏览器、MCP、故障注入、大样本 A/B 与 canary 中声明为 `planned` 或 `fixture` 的记录未被接受；producer identity 与 `evidenceKind` 的真实性仍由 operator trust 负责，缺少规定规模真实证据的项目继续明确为 pending。
- [x] 官方 `web`/`headless`、Agent loop、工具执行顺序、权限交互和 session wire format 均未发生 curated 行为回归。
- [x] 六个缺少 assembled keyless snapshot 的候选均为 inactive，`dsh-web-search-pro` 另记录缺少必需 browser bundle/runtime dependency，五个模板和 `web-curated` lock/profile snapshot 均不含第三方候选。
- [x] `active: true` 要求完整 `runtimeActivationEvidence`；policy 校验安全相对路径、非占位 SHA-256 与必需 bundle 声明，顶级 doc gate 校验文件存在且摘要匹配，单纯删除 rejection 不能激活候选。
- [x] 既有独立规格、代码与安全审查 finding 均已修复或由本轮 fail-closed 裁决消除；最终 scoped 自审未发现新的 P0–P2、高置信度行为缺陷或安全问题。
- [x] 用户既有脏工作树内容保持原样；本轮未执行 commit、push、merge、rebase 或 reset。
- [x] 本轮未新增 `docs/plugin/superpowers/` 与 `.trae/specs/` staged 内容，既有 index 保持不变，`progress.md` 仅追加一个本轮总结。

## 2026-08-28 本轮复审

- [x] 七份目标文档中的 P0/P1/P2、证据分级和安全要求已重新映射到当前实现、自动化证据或明确 pending 状态。
- [x] 候选 catalog、五个 profile 与 benchmark 资产一致保持目标 12、静态/安装资格候选 6、runtime active 0，且不伪造 E3/E4、A/B 或 canary 证据。
- [x] `curated-policy`、四类命令与 CLI/profile bridge 的成功、拒绝、脱敏、超时、生命周期脚本和包变换路径通过独立审计。
- [x] Curated focused tests、per-file coverage、相关 typecheck、constraints、scoped lint、文档与 build/pack 叶级门禁取得新鲜结果。
- [x] 根 `pnpm run lint` 已重新执行；若仅被任务开始前的生成残留阻塞，则保留原文件并记录准确诊断，受影响文件 scoped lint 必须通过。
- [x] 官方 `web`/`headless`、Agent loop、工具执行顺序、权限交互和 session wire format 未发生 curated 行为回归。
- [x] 独立代码、安全和规格审查无未解决 P0–P2 或高置信度实质问题。
- [x] 工作树与 index 边界已核对；未执行 commit、push、merge、rebase、reset 或 git add，规划工件未新增 staged 内容。

## Ralph Loop Round 2 缺口复验

- [x] 精选 profile 的 `.npmrc` 只接受仓库生成的安全配置，并拒绝 path redirect、registry、auth 等额外键。
- [x] 每个 selected active candidate 自身具备与 `targetProfiles` 精确匹配且对当前 profile 完整的 `runtimeActivationEvidence`，不能只依赖 required bundle provider 的证据。
- [x] Activation evidence 的所有诊断统一脱敏非法 candidate、profile 和 path 标识；存在 policy issues 时不再遍历未验证 evidence。
- [x] Focused tests、curated per-file coverage、typecheck、lint、doc-sync、build、hygiene 和 packed entry 均通过，且复审确认 index 边界未被改变。

## Ralph Loop Round 2 最终复审缺口

- [x] 四个受管 profile 子文件（`package.json`、`cordis.patch.yml`、`pnpm-workspace.yaml`、`.npmrc`）拒绝 symlink/junction；悬空链接不会在 profile 外创建目标，现有外部目标不会被读取或修改。
- [x] Manifest 拒绝 `pnpm.configDependencies` 及其他可加载 package-manager hook/config dependency 的字段，且 pnpm 不会执行。
- [x] Activation diagnostics 对 candidate、profile 和 path 做结构化脱敏，覆盖 `key=value`、`Authorization Basic`、URL userinfo，且合法 ID/path 含 `authorization` 不会被误拒绝。
- [x] 全量相关门禁和安全/代码复审已重新运行。

- [x] 受管 profile 已存在文件的校验绑定到随后读取的同一 regular-file descriptor/identity；curated CLI 的 ensure→load 路径不再按未受保护路径重读 `package.json` 和 `cordis.patch.yml`，且 symlink、junction、其他文件替换或祖先替换均 fail closed，不读取外部目标。
- [x] URL userinfo 脱敏在 authority 内取最后一个 `@`，覆盖密码包含未转义或编码 `@`，且不误伤 path、query 或 fragment 中的普通 `@`。
- [x] 新增测试先按预期失败，再以最小修复通过 focused tests、coverage、静态检查、文档检查、build、packed 验证与独立复审。

- [x] Curated live HMR 的 `composeLive()` 每次重组都取得 descriptor-bound managed-file snapshot，使用 snapshot bytes 解析 profile `cordis.patch.yml` 并执行 admission，在返回前复核 identity 并关闭 descriptor；外部 symlink target 不会被读取，普通 profile 和 home/explicit overlay 语义保持不变。
- [x] App-boot `loadOptionalPatches` 的可选 validated reader 在其属于最小实现时已恢复并实际使用；reader 提供与缺失分支均有行为测试和 100% coverage，activation verifier 在 `evidenceIssues` 非空时不 replay 的分支也达到 100%。
- [x] Focused tests、coverage、full gates 和独立复审均已重新运行。

- [x] 每次 `openManagedProfileFiles` 或 retained snapshot 打开都将 profile directory identity 绑定到调用时 DSH home 下 `profiles` 目录的 canonical containment；祖先在 materialization 与 load snapshot 重开之间被替换时，会在任何 `readSync` 前 fail closed。
- [x] 强制 `O_NOFOLLOW` 不可用并分别替换 final file 与 ancestor 的测试监控实际 descriptor/`readSync`，覆盖 initial 与 HMR 调用链，且不只监控 `readFileSync`。
- [x] Agent Note 不再声称 materialization 验证与 load/admission 使用同一 snapshot；相关门禁和独立复审已重新运行。

- [x] 真实 initial `prepareProfile()` 调用链的 TDD 负向回归在 materialization validation snapshot 关闭后、retained snapshot 重开前替换 `profiles` ancestor，强制 `O_NOFOLLOW` 为 `undefined` 并监控实际 external descriptor 与 `readSync`，证明在任何外部读取前 fail closed。
- [x] 相关 coverage 与独立复审已重新运行。

- [x] Activation replay 使用最小无凭证环境，结构化确认至少一个测试匹配，worktree bytes 与 stage-0 blob 已绑定且在 replay 前复核一致。
- [x] YAML secret scope 跨 comment 行持续生效，code frame 中的 scalar 已执行二次脱敏。
- [x] Smoke 在残留 process group 未清理时强制失败，proxy 仅接受 credential-free origin。
- [x] Planning-history source path 经标准化后拒绝任何 `..` 路径段，且 `kind` 已绑定到对应的 locks/profiles 来源。
- [x] 相关 focused tests、coverage、full gates 与独立代码、安全和规格复审均已重新运行。

## Round 7 从零独立复审并严格执行

- [x] 七份 `docs/plugin/superpowers/` 规划文档的全部当前 P0/P1/P2、证据分级与安全要求已用本轮源码、配置、测试或命令输出从零重新建立追踪，未复用旧通过结论。
- [x] 候选完整 40 位 SHA、许可证、bundle 声明、Node engine、安装脚本、core-patch 与 active/rejected 决策已用当前工件独立重新核对；runtime active 仍为 0，6 个静态/安装资格候选保留 `assembled-keyless-snapshot-missing`，`dsh-web-search-pro` 另记缺少必需 browser bundle/runtime dependency。
- [x] 五个 curated profile 的继承、隔离、能力域互斥、enterprise 限制、`ignore-scripts=true` 与官方 profile 不变量符合规划。
- [x] `verify-lock`、`preflight`、`smoke-profile`、`compare-benchmark` 的成功、拒绝、超时、回滚、pending 与脱敏路径均有本轮新鲜输出，秘密不回显。
- [x] curated focused tests 与 per-file coverage、constraints、相关 typecheck、scoped lint、doc-sync、build/hygiene 叶级门禁有本轮新鲜通过证据。
- [x] 真实 CLI 的 `headless` 与 curated profile 启动面可运行；当前无 active UI 候选，Chrome CDP 9333 不适用。
- [x] 本轮发现的所有仓库内行为缺口均先有预期失败测试，再由最小实现修复并通过 focused 验证；若无实现缺口，则以“无需修改且有本轮证据”闭环。
- [x] 官方 `web`/`headless`、Agent loop、工具执行顺序、权限交互与 session wire format 未发生 curated 行为回归。
- [x] 独立代码、安全和规格审查无未解决 P0–P2 或高置信度实质问题。
- [x] 用户既有脏工作树内容保持原样；当前 `.git/index` SHA-256 为 `65f44b02d33a4745e5b6a6472a2e398e6370ccb4bb6f56aa355562c3fde9d2e5`，cached diff SHA-256 为 `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`，staged paths 为 0；未新增 `docs/plugin/superpowers/`、`.trae/specs/`、报告或状态文件到 staged，未执行 commit/push/merge/rebase/reset/add；一次验证代理误调用 `git write-tree`，仅返回已存在且等于 HEAD tree 的 `551bbad102aef40396f7597f22c1b95f7aaf0640`，未改变 index、refs 或工作树，也未生成新的 tree 内容；`progress.md` 仅追加一个本轮总结。

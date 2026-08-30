# `@deepseek-ai/dsh-curated-policy`

[English](README.md) | 中文

`@deepseek-ai/dsh-curated-policy` 持有签入的精选插件 allowlist，并通过 `ctx.curatedPolicy` 暴露只读策略查询。

该包加载候选锁、权威能力冲突规则和权限规则种子。在发布 `ctx.curatedPolicy` 前，它会根据八个受限维度计算 100 分准入评分、校验任何声明总分、要求每个仓库使用不含凭证的 canonical `https://github.com/<owner>/<repo>` URL、要求每个可达源码具有规范化内容摘要，并要求 active 候选具有已验证 Node 证据、不修改 core、提供直接目录摘要与运行时依赖闭包摘要，以及完整 `runtimeActivationEvidence`。其 profile key 必须与 `targetProfiles` 精确一致；每个 profile 值都把 keyless assembled snapshot 及安装、启用、重启、禁用或卸载记录绑定到非占位 SHA-256，其中的必需 bundle 列表必须匹配候选声明。全部记录及其产物都是[精选 benchmark 证据目录](../curated-bench/evidence/README.zh.md)中唯一、由仓库持有、已跟踪的普通 blob。仓库与 DSH release 的 `verify-curated-activation-evidence` 门禁会遍历每个 profile 值，要求五份记录都命名对应 map key，把当前模板、active 候选集、安装来源、配置覆盖与产物 identity 的 canonical 摘要绑定进证据，并校验 `evidenceKind: observed`、预期 lifecycle 操作、成功命令结果，以及完全匹配的候选、源码、安装目录、runtime closure 与必需 bundle identity。每份记录还会通过路径和 SHA-256 绑定一个独立产物；该产物会重复仓库、package、其它 identity、组合摘要与 operation，并携带完全匹配且不含 secret 的 command argv、零退出码和 observed 成功结果。Argv 必须选择 Git tracked keyless snapshot 中对应 candidate/profile/operation 的测试，门禁会在激活或 DSH release 验证成功前实际重放每个测试。仓库持有的 snapshot producer 仍是受信代码，不是带密码学认证的外部证明；接纳新证据时必须审查该 producer。公开诊断会遮蔽 candidate、profile 与 path 标识中的 key/value secret、Authorization 值、带 scheme URL 的 authority 中直到最后一个 `@` 的完整 userinfo，以及无 scheme `user:pass@host:port` 的 userinfo，其中 host 可以是 DNS 名称或带方括号的 IPv6 literal；这些凭证形式之外的普通 `@` 保持可见。两处 command 表示都会拒绝 Authorization 与 Bearer 值、`sk-*` token、secret、token、password、key 或 cookie 形态的参数，以及 scheme URL、option 赋值 URL 或无 scheme `user:pass@host:port` 中的 URL userinfo，诊断不会回显 argv；含 `authorization` 的普通 candidate ID 与 snapshot path 仍然合法。环境变量名称仍可作为候选配置 metadata，但已执行的 evidence argv 不能携带其秘密值。生产门禁使用 `git ls-files --error-unmatch --stage`，且只接受 stage-zero 普通文件 mode，因此包自身提供的证据、ignored 或 untracked 文件、symlink、`.git` 和 `node_modules` 路径都不能授权激活。每份 keyless assembled 记录与产物还必须报告已验证 waterfall 委托，以及重复 token 注入和外部请求均为 0；这些属于运行时观测，preflight 只校验候选在 catalog 中声明的 listener 与资源 claim。策略加载还要求每个 runtime bundle 都由同一 profile 中另一个具有 activation evidence 的 active 候选提供，并会校验提供方/fallback 关系与 profile 冲突、拒绝疑似 secret metadata，以及检查权限策略结构与顺序。非法 YAML 诊断会保留 parser 原因、已脱敏文件标识、从 1 开始的行列号、caret 和非秘密 code-frame 行，但不会附加仍持有原始源码的 parser exception；带引号键解码会识别由转义隐藏的 secret key，纯注释行不会结束待处理的 secret scalar continuation，保留的 code frame 还会再经过一次 scalar 脱敏。精选命令包会另行校验解析后的权限产物与 profile 配置采用 fail-closed 设置。Cordis 插件通过 effect 注册服务，因此卸载插件会移除 `ctx.curatedPolicy`。

## 服务约定

`CuratedPolicy` 会冻结解析后的 catalog，并返回不可变候选数组。`listCandidates()` 按 catalog 顺序返回全部已 audit 候选。`getProfileCandidates(profileId)` 只返回分配给所请求 profile 的 active 候选，并同样保持 catalog 顺序。`deriveCandidateStatus(candidate)` 根据 active 标记、产物摘要和 blocker code 返回 `active`、`qualified`、`pending` 或 `rejected`；签入 catalog 中的每个 inactive 候选必须至少携带一条 blocker 记录。

`pnpm run audit-curated-candidates -- --candidate <id>` 在 50 秒总期限内将一个固定 commit 抓取到临时 bare Git 仓库。Git 只接收必需的启动、locale、proxy、证书和临时目录变量；继承的 `GIT_*` 与凭证形状变量不能重定向仓库、对象数据库或配置。在 POSIX 上，超时或输出超限会终止隔离的进程组，并在删除临时仓库前等待该进程组消失；Windows 会在 spawn 前拒绝，因为本地 provider 无法证明由 Job Object 支持的进程树静止。该命令通过 `ls-tree` 和 `cat-file --batch` 读取 commit，从不创建 checkout，并拒绝非 blob 条目、不支持的 mode 和非可移植路径。摘要以 `dsh-source-content-v1\0` 开头，按 UTF-8 POSIX 相对路径字节对全部条目排序，再依次哈希 mode、对象类型、路径和 blob 字节；每个组件前都带一个无符号 64 位大端字节长度。因此，symlink 会哈希其 `120000` mode 和链接目标 blob 字节，而不会跟随目标。

`validateCandidateLock(catalog)` 校验确定性的 catalog 声明：schema 版本、完整 Git SHA、canonical GitHub 仓库 URL、每个 `verified` 源码必需的 `sourceContentSha256`、与 canonical 非占位 64 字节 SHA-512 SRI 成对出现的确切 SemVer 2.0 npm 版本、active 候选必需的安装目录与运行时依赖闭包摘要、精确覆盖目标 profile 的激活证据、声明的来源状态、Node 与 core patch 字段、对 active Git lifecycle build 的拒绝、候选 ID、每个 inactive 候选的显式 blocker、profile 重叠的重复 active 资源和疑似 secret 材料。`hasCompleteCurrentProfileActivationEvidence(candidate, profileId)` 导出 profile dependency 物化所使用的同一组 profile/evidence 精确 key、必需 bundle identity、安全路径与非占位 SHA-256 检查。确切版本可以包含合法 prerelease 与 build metadata；range、tag、前导 `v`、空 identifier 和带前导零的 numeric prerelease identifier 均不合法。`isExactNpmVersion()` 向 curated consumer 导出该规则。源码摘要标识固定 Git tree，而不是 GitHub 可变的 source archive 编码。`validatePolicySemantics(catalog, conflicts, permissions)` 校验引用的提供方、fallback 能力、策略外提供方、权限规则 ID 以及每个已配置 profile。`permissions.order` 必须精确等于 `core-sandbox`、`permission-rules`、`high-risk-approval-or-auto-review`、`tool-execution`、`result-audit`；缺少、额外、重复或重新排序任何阶段都不合法。插件加载、聚焦单元测试和仓库 `verify-curated-activation-evidence` 门禁保留这些静态检查。包 invariant 是带说明的空 installer，因为固定 catalog 不提供可观测的运行时关系。

## 模型体验

### Curated policy 服务

#### 模型看到的内容

`ctx.curatedPolicy` 是供插件和命令使用的同进程查询服务。它不注册提示词文本、工具 schema、用户消息、助手可见结果或会话事件。

#### Token 影响

`@deepseek-ai/dsh-curated-policy` 本身没有直接 token 成本。

#### KV Cache 影响

没有直接 cache 影响；把策略数据转成提示词文本或工具的调用方拥有相应的模型可见注册。

## 已知限制与暂缓事项

- **Catalog 校验不是上游证据**：allowlist 记录 audit 声明，策略包在不抓取或重新 audit 上游仓库的情况下检查其一致性。Observed 产物证据要求另行提供从精确 commit 安装的 Git 内容，或 registry integrity 匹配的精确版本 npm 安装，并且已安装字节必须匹配 catalog 目录摘要。
- **未验证运行时行为保持 inactive**：12 个候选的 `web-curated` 目标当前有 6 个静态/安装资格候选，runtime active 数为 0。每个资格候选都记录 `assembled-keyless-snapshot-missing`；Web 搜索还声明并记录其必需 browser runtime bundle 缺失。Inactive 候选可以省略 `runtimeActivationEvidence`。激活要求完整且通过机器校验的证据对象及成功的仓库证据文件门禁；只删除 rejection 并设置 `active: true` 并不足够。
- **禁止 Git lifecycle build**：active Git 依赖不得声明 `preinstall`、`install`、`postinstall`、`prepare` 或 `prepack`。候选可以改为记录经过验证的确切 npm 版本与 integrity；策略会记录其已发布生命周期字段，但不会在校验期间执行这些字段。
- **不写入 profile，也不执行权限决策**：profile 物化属于 `@deepseek-ai/dsh-curated-profiles`，CLI 报告属于 `@deepseek-ai/dsh-curated-scripts`，工具授权仍委托给所选权限插件。精选层校验该插件的 fail-closed 产物与 profile 配置。

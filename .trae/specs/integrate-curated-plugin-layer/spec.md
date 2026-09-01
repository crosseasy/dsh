# DeepSeek Harness 精选插件层规格

## Why

第三方 DSH 插件数量已经超过人工逐项维护的合理范围，且插件的版本、Cordis 注册、权限、数据外发与运行成本可能彼此冲突。仓库需要一个不修改 Agent loop 和既有 `web`/`headless` profile 的精选层，将候选来源、准入规则、profile 组合、静态检查、动态评测和回滚证据统一为可复现工件。

## What Changes

- 在 `packages/curated/` 下新增精选 bundle、策略、profile 模板、评测和命令包；该目录是纯包组容器，五个叶包均为公开的 DSH 发布族成员。
- 维护锁定到完整 Git commit SHA 的候选插件目录，并记录来源、许可证、类别、预期包名、bundle patch、profile 分配及准入档位。
- 提供 `web-curated`、`web-coding`、`web-research`、`web-enterprise` 和 `web-personal` 五个 profile 模板；模板物化到指定 DSH home，不改官方 `web`/`headless` 模板。
- 提供 `verify-lock`、`preflight`、`smoke-profile` 和 `compare-benchmark` 四类命令，并为成功与拒绝路径提供自动化测试。
- 按 P0/P1/P2 执行候选核验与 profile 接入；无法访问、许可证不清、Node 不兼容、无 `dsh.bundle.patch` 或要求修改核心的候选必须被拒绝，不能以占位依赖进入可启动 profile。
- 为该非平凡架构/流程变化新增双语 Agent Note 与配对记录；包 README/JSDoc 同步说明当前行为。
- 不提交 `docs/plugin/superpowers/` 与 `.trae/specs/` 规划工件，不执行 git commit、push、merge、rebase 或 reset。

## Non-Goals

- 不修改 `packages/core/agent-loop`、session wire format 或 `SESSION_FORMAT_VERSION`。
- 不复制或修改第三方插件源码，不为失败候选添加兼容 shim。
- 不把 3–7 天 canary、100 个真实任务或真实外部服务调用伪装成单次本地验证；本变更交付可执行的任务清单、结果格式、阈值判定与回滚机制。
- 不让多个同域 provider 在同一 profile 同时注册。
- 不将主题、桌宠、完整 IM 正文外发或自动进化记忆加入 `web-curated`。

## Impact

- Affected specs: bundle/profile composition、third-party plugin governance、benchmarking、supply-chain verification。
- Affected code: `packages/curated/*`、`tsconfig.base.json`、`tsconfig.host.json`、必要的根级门禁清单、`.agents/notes/*`。
- Existing behavior: 官方 `web`/`headless` profile、Agent loop、工具执行顺序、权限/审批、会话日志保持不变。

## Assumptions

- 候选 URL 以 Awesome DeepSeek Harness 中文清单和 `docs/plugin/superpowers/02-插件矩阵与择优.md` 为来源；审计时解析其当前完整 HEAD SHA 后冻结。
- 第三方 bundle 通过 profile 自身的 `dependencies` 安装，仓库 workspace 不直接依赖它们，避免 `pnpm install` 执行未经批准的第三方 prepare/postinstall。
- `web-curated` 只包含同时通过静态硬门槛、真实固定工件 keyless assembled snapshot、必需依赖 bundle 与完整生命周期证据的候选；失败或证据不完整的候选保留在审计结果中并标注拒绝理由。
- YAML 使用仓库已有 `js-yaml`；Cordis patch 使用 `entryListSchema` 解析，不自写 YAML/parser。
- `smoke-profile` 的 55 秒执行工作预算从函数入口开始计时；worker 构造完成后重新计算剩余预算，若已耗尽则立即失败。运行与检查阶段可终止；同步 `Worker` 构造与 awaited termination cleanup 是不可抢占开销，不属于硬性总 wall-clock 保证。需要硬性操作系统截止时间时由调用方监督 CLI 进程。其他本地命令由调用方施加低于 55 秒的外层截止；长周期评测拆成可恢复的单次任务运行。

## ADDED Requirements

### Requirement: Curated package topology

系统 SHALL 在 `packages/curated/` 下提供职责独立的 workspace 包，并遵循现有 ESM、Cordis peer dependency、Host aggregate、invariant companion、README 和可公开发布包约定。

#### Scenario: Workspace discovery

- **WHEN** 仓库运行 workspace constraints 和 Host typecheck
- **THEN** 所有 curated 包均被唯一发现、位于一个 aggregate，且无 source/artifact plane 混用

#### Scenario: Published dependency closure

- **WHEN** 仓库规划、打包或安装 DSH 发布族
- **THEN** 五个 curated 包均进入发布族，`policy` 与 `bench` 先于 `base`，`policy` 先于 `profiles`，`base` 与 `profiles` 先于 `dsh`，用户命令包 `scripts` 后于其运行时依赖，且每个 tarball 包含其导出、命令和数据资产

#### Scenario: No core modification

- **WHEN** 审查实现 diff
- **THEN** `packages/core/agent-loop`、官方 `PROFILE_TEMPLATES.web/headless` 和 session wire format 均无行为变更

### Requirement: Pinned candidate catalog

系统 SHALL 为每个候选记录稳定 ID、能力域、canonical `https://github.com/<owner>/<repo>` 仓库 URL、完整 40 位 commit SHA、许可证、预期包名、bundle patch、准入档位、profile 分配、网络/凭证/安装脚本事实及审计时间；URL 禁止 username、password、query、fragment、`.git` 后缀和尾斜杠。每个 active 候选还必须固定直接安装目录摘要、完整 runtime 依赖 lock 闭包摘要，以及 key 与 `targetProfiles` 精确一致的 `runtimeActivationEvidence` map；每个 profile 值都必须包含真实固定工件的 keyless assembled snapshot、必需 runtime bundle、安装、启用、重启、禁用或卸载记录，并使用安全仓库相对路径与非占位 64 位小写十六进制 SHA-256。每个 profile 值中的 `requiredRuntimeBundles` 必须匹配候选声明，顶级 repository doc gate 与 DSH release gate 必须遍历每个 profile 的五份记录，将记录绑定到候选、map key、当前模板与 active 组合摘要、源码、安装目录、依赖闭包、operation 与成功 observed 结果，通过稳定 descriptor 读取校验独立工件，并重放精确的 Git tracked candidate/profile/operation keyless snapshot 测试。Record `command` 与 artifact `command.argv` 必须拒绝 secret，包括 scheme URL、option 赋值 URL 和无 scheme `user:pass@host:port` 中的 URL userinfo，且诊断不得回显参数。每份 keyless assembled 记录还必须证明 waterfall 委托并记录重复 token 注入与重复外部请求均为 0。

当前 6 个静态/安装资格候选缺少真实固定工件的 keyless assembled runnable snapshot，因此全部为 inactive；`dsh-web-search-pro` 还缺少必需的 browser bundle/runtime dependency。Runtime active 数为 0，既有 source、tree、runtime closure、npm 与 Git 审计字段继续保留。

#### Scenario: Exact pin accepted

- **WHEN** 候选 source 为完整 commit SHA 且审计字段完整
- **THEN** `verify-lock` 成功并输出该候选的确定性摘要

#### Scenario: Floating or incomplete source rejected

- **WHEN** source 使用 `latest`、branch、tag、短 SHA，或缺许可证/包名/bundle patch
- **THEN** `verify-lock` 非零退出并逐项报告拒绝原因

#### Scenario: Credential-bearing repository rejected

- **WHEN** catalog 仓库 URL 使用非 HTTPS host、username、password、query、fragment、额外路径段、编码路径分隔符、`.git` 后缀或尾斜杠
- **THEN** policy 校验拒绝该 URL，诊断不回显 URL 或其中的凭证

#### Scenario: Active flag cannot bypass runtime evidence

- **WHEN** 候选只删除 `assembled-keyless-snapshot-missing` rejection 并设置 `active: true`，但未提供完整 `runtimeActivationEvidence`
- **THEN** policy 校验与顶级 repository gate 均拒绝激活

#### Scenario: Matching lock tampering rejected

- **WHEN** 攻击者把同一个传递依赖的确切版本或 SRI 同时改入 root lock 与 installed lock
- **THEN** observed `verify-lock`、`preflight` 与 `smoke-profile` 因 runtime 依赖闭包摘要不匹配 catalog 而拒绝

### Requirement: Capability conflict policy

系统 SHALL 对搜索、记忆、MCP、浏览器、多 Agent、上下文压缩和客户端能力域声明最多一个 active provider，并检查重复 entry ID、工具名、命令名、service key、UI slot、端口、SQLite 路径、缓存目录和环境变量。

#### Scenario: Duplicate provider rejected

- **WHEN** 一个 profile 同时启用同域两个 active provider
- **THEN** `preflight` 非零退出，指出能力域和冲突候选

#### Scenario: Explicit fallback accepted

- **WHEN** 第二实现标记为 inactive fallback 且未注册重叠能力
- **THEN** `preflight` 接受该 profile

### Requirement: Profile templates

系统 SHALL 提供 `web-curated`、`web-coding`、`web-research`、`web-enterprise`、`web-personal` 的确定性模板和物化命令。

#### Scenario: Curated baseline

- **WHEN** 物化 `web-curated`
- **THEN** profile 按顺序包含官方 base/web bundle 与 curated policy bundle，并且只包含已满足完整 runtime 启用条件的第三方候选；当前不包含任何第三方候选

#### Scenario: Scenario isolation

- **WHEN** 物化 coding/research/enterprise/personal profile
- **THEN** 每个 profile 只增加其声明能力，`web-personal` 不继承企业或工程场景包

#### Scenario: Existing profile preservation

- **WHEN** 物化任意 curated profile
- **THEN** 已存在的官方 `web`/`headless` 目录和用户 patch 字节不变

#### Scenario: Mandatory boot admission

- **WHEN** `dsh` 启动或 dump 一个内置精选 profile
- **THEN** 在 Loader 激活前强制校验 manifest bundle 与模板及 catalog 分配精确同序、包管理器安全，并拒绝 profile/home/overlay 中的动态表达式和未批准 executable/group 插入；普通 profile 不受影响

### Requirement: Dependency execution provenance

系统 SHALL 为全部五个精选 profile 写入 `ignore-scripts=true`，CLI 插件安装 SHALL 独立强制禁用依赖生命周期脚本，受管精选 profile SHALL 拒绝构建授权及没有独立 catalog 内容 pin 的包变换。

#### Scenario: Unsafe existing profile rejected

- **WHEN** 已有精选 profile 启用脚本、授予任意依赖构建权限，或配置 `patchedDependencies`、`packageExtensions`、pnpmfile hook
- **THEN** 物化与 observed 校验在执行依赖代码或改写用户文件前失败

#### Scenario: Transformed lock rejected

- **WHEN** 根 lock 或 installed lock 包含 `patchedDependencies`、`packageExtensionsChecksum`、`pnpmfileChecksum` 或 `patch_hash` locator
- **THEN** `verify-lock`、observed `preflight` 与 observed `smoke-profile` 均拒绝，且普通 peer suffix 仍按精确版本与 integrity 校验

### Requirement: Curated policy runtime

系统 SHALL 通过 `ctx.curatedPolicy` 暴露只读候选与 profile 查询；注册必须是 effect，卸载后 service/registration 不残留。

#### Scenario: Query approved candidates

- **WHEN** Consumer 查询某 profile 的 active 候选
- **THEN** 返回冻结的只读结果，顺序与 profile 模板一致

#### Scenario: HMR disposal

- **WHEN** curated policy fiber 被 dispose
- **THEN** 所有 package-owned 注册均消失

### Requirement: Static admission and profile smoke

系统 SHALL 实现静态 100 分量表、硬拒绝项、profile 解析 smoke 和 JSON 结果。

#### Scenario: Admission classification

- **WHEN** 候选评分为 85+/75–84/65–74/<65
- **THEN** 分别分类为 default/scenario/experimental/rejected；任何硬拒绝覆盖总分

#### Scenario: Profile smoke

- **WHEN** smoke 指向可物化 profile
- **THEN** 从函数入口共用一个 55 秒执行工作预算；worker 构造返回后重算剩余预算，耗尽时立即失败，后续 manifest、bundle 与 `--dump-config`/`--help` 检查可终止并输出阶段、耗时与失败原因；正常、错误与超时路径都清理 listener/timer 并等待 worker 终止后返回；同步 `Worker` 构造和 termination cleanup 不承诺可抢占，硬性总 wall-clock 截止由 CLI 调用方监督

### Requirement: Dynamic benchmark comparison

系统 SHALL 接受结构化运行记录，计算成功率、质量、安全、可靠性、性能成本、操作体验、升级兼容的加权分数，并输出均值、P50、P95 和失败分布。

#### Scenario: Non-compensable failure

- **WHEN** 安全正确性 <95%、数据丢失 >0、不可回滚、启动失败率 >1% 或关键成功率下降 >3 个百分点
- **THEN** 候选状态为 rejected，无论加权总分

#### Scenario: Rollback threshold

- **WHEN** 首 token P95 增加 >15%、prompt/schema token 增长 >20%、或成本增加 >20% 且成功率提升 <3 个百分点
- **THEN** 比较结果标记 rollback，并指向上一版 lock/profile 快照

### Requirement: Security and data handling

系统 SHALL 默认最小权限，凭证只允许环境变量/credentials service 引用，OTel 正文采集关闭，配置导入要求 dry-run，LLM 审批失败时 fail-closed。

#### Scenario: Secret material rejected

- **WHEN** catalog/profile/benchmark 包含疑似明文 token、cookie、secret 或 private key
- **THEN** preflight 非零退出且不回显秘密值；非 JSON 文本中 secret-shaped key 后的完整标量或物理行被遮蔽，不受 Authorization scheme 或多词值影响

#### Scenario: Enterprise restrictions

- **WHEN** 物化 `web-enterprise`
- **THEN** 匿名视觉 fallback、IM 正文外发、自动安装脚本和未批准浏览器下载均关闭

### Requirement: Regression evidence

系统 SHALL 为新包提供单元测试、Loader/profile real-composition 测试、HMR safety 测试和错误分支测试。第三方候选进入可启动 profile 前必须由真实固定工件提供 keyless assembled runnable snapshot；fixture、mock-only composition 和配置 smoke 不能替代该证据。

#### Scenario: Focused verification

- **WHEN** 实现完成
- **THEN** focused tests、constraints、typecheck、lint、doc-sync、build/hygiene 的相关叶级命令通过

#### Scenario: Dirty workspace preservation

- **WHEN** 验证 git diff
- **THEN** 用户已有 `docs/arch/code-optimization-audit*` 移动保持原样且未被还原或混入本任务修改

## MODIFIED Requirements

### Requirement: Workspace path and aggregate discovery

`tsconfig.base.json` 的 `@deepseek-ai/dsh-*` 与 invariant 路径映射 SHALL 覆盖 `packages/curated/*/src`；`tsconfig.host.json` SHALL 显式引用每个 Host curated 包。该修改只扩展发现范围，不改变既有 package 解析优先级。

## REMOVED Requirements

无。

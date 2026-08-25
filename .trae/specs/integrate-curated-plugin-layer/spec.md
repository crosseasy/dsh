# DeepSeek Harness 精选插件层规格

## Why

第三方 DSH 插件数量已经超过人工逐项维护的合理范围，且插件的版本、Cordis 注册、权限、数据外发与运行成本可能彼此冲突。仓库需要一个不修改 Agent loop 和既有 `web`/`headless` profile 的精选层，将候选来源、准入规则、profile 组合、静态检查、动态评测和回滚证据统一为可复现工件。

## What Changes

- 在 `packages/curated/` 下新增精选 bundle、策略、profile 模板、评测和命令包；该目录是纯包组容器。
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
- `web-curated` 只包含通过静态硬门槛的默认候选；失败候选保留在审计结果中并标注拒绝理由。
- YAML 使用仓库已有 `js-yaml`；Cordis patch 使用 `entryListSchema` 解析，不自写 YAML/parser。
- 所有命令的单次本地执行上限为 55 秒；长周期评测拆成可恢复的单次任务运行。

## ADDED Requirements

### Requirement: Curated package topology

系统 SHALL 在 `packages/curated/` 下提供职责独立的 workspace 包，并遵循现有 ESM、Cordis peer dependency、Host aggregate、invariant companion、README 和发布文件约定。

#### Scenario: Workspace discovery

- **WHEN** 仓库运行 workspace constraints 和 Host typecheck
- **THEN** 所有 curated 包均被唯一发现、位于一个 aggregate，且无 source/artifact plane 混用

#### Scenario: No core modification

- **WHEN** 审查实现 diff
- **THEN** `packages/core/agent-loop`、官方 `PROFILE_TEMPLATES.web/headless` 和 session wire format 均无行为变更

### Requirement: Pinned candidate catalog

系统 SHALL 为每个候选记录稳定 ID、能力域、仓库 URL、完整 40 位 commit SHA、许可证、预期包名、bundle patch、准入档位、profile 分配、网络/凭证/安装脚本事实及审计时间。

#### Scenario: Exact pin accepted

- **WHEN** 候选 source 为完整 commit SHA 且审计字段完整
- **THEN** `verify-lock` 成功并输出该候选的确定性摘要

#### Scenario: Floating or incomplete source rejected

- **WHEN** source 使用 `latest`、branch、tag、短 SHA，或缺许可证/包名/bundle patch
- **THEN** `verify-lock` 非零退出并逐项报告拒绝原因

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
- **THEN** profile 按顺序包含官方 base/web bundle、curated policy bundle和所有已通过 P0 默认候选；不包含多 Agent、浏览器、Office、完整 IM 或自动进化记忆

#### Scenario: Scenario isolation

- **WHEN** 物化 coding/research/enterprise/personal profile
- **THEN** 每个 profile 只增加其声明能力，`web-personal` 不继承企业或工程场景包

#### Scenario: Existing profile preservation

- **WHEN** 物化任意 curated profile
- **THEN** 已存在的官方 `web`/`headless` 目录和用户 patch 字节不变

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
- **THEN** 在 55 秒内完成 manifest、bundle 解析和 `--dump-config`/`--help` 子进程检查，输出启动阶段、耗时与失败原因

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
- **THEN** preflight 非零退出且不回显秘密值

#### Scenario: Enterprise restrictions

- **WHEN** 物化 `web-enterprise`
- **THEN** 匿名视觉 fallback、IM 正文外发、自动安装脚本和未批准浏览器下载均关闭

### Requirement: Regression evidence

系统 SHALL 为新包提供单元测试、Loader/profile real-composition 测试、HMR safety 测试和错误分支测试；不产生新模型可见行为时不新增 transcript snapshot。

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

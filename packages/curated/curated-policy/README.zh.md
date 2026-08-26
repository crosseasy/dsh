# `@deepseek-ai/dsh-curated-policy`

[English](README.md) | 中文

`@deepseek-ai/dsh-curated-policy` 持有签入的精选插件 allowlist，并通过 `ctx.curatedPolicy` 暴露只读策略查询。

该包加载候选锁、权威能力冲突规则和权限规则种子。在发布 `ctx.curatedPolicy` 前，它会根据八个受限维度计算 100 分准入评分、校验任何声明总分、要求 active 候选具有已验证 Node 证据且不修改 core、校验提供方/fallback 关系与 profile 冲突、拒绝疑似 secret metadata，并检查权限策略结构与顺序。精选命令包会另行校验解析后的权限工件与 profile 配置采用 fail-closed 设置。Cordis 插件通过 effect 注册服务，因此卸载插件会移除 `ctx.curatedPolicy`。

## 服务约定

`CuratedPolicy` 会冻结解析后的 catalog，并返回不可变候选数组。`listCandidates()` 按 catalog 顺序返回全部已 audit 候选。`getProfileCandidates(profileId)` 只返回分配给所请求 profile 的 active 候选，并同样保持 catalog 顺序。

`validateCandidateLock(catalog)` 校验确定性的 catalog 声明：schema 版本、完整 Git SHA、声明的来源状态、active 候选的 Node 与 core patch 字段、候选 ID、GitHub 仓库 URL、带硬拒绝的 inactive 候选、重复 active 资源和疑似 secret 材料。`validatePolicySemantics(catalog, conflicts, permissions)` 校验引用的提供方、fallback 能力、策略外提供方、权限规则 ID 与顺序以及每个已配置 profile。包 invariant 会加载并校验三份签入策略 catalog。

## 模型体验

### Curated policy 服务

#### 模型看到的内容

`ctx.curatedPolicy` 是供插件和命令使用的同进程查询服务。它不注册提示词文本、工具 schema、用户消息、助手可见结果或会话事件。

#### Token 影响

`@deepseek-ai/dsh-curated-policy` 本身没有直接 token 成本。

#### KV Cache 影响

没有直接 cache 影响；把策略数据转成提示词文本或工具的调用方拥有相应的模型可见注册。

## 已知限制与暂缓事项

- **Catalog 校验不是上游证据**：allowlist 记录 audit 声明，策略包在不抓取或重新 audit 上游仓库的情况下检查其一致性。工件证据要求另行提供从精确 commit 安装的内容。
- **未验证控制保持 inactive**：缺少运行时兼容性证据或可执行安全配置的候选保留机器可读的拒绝记录，并从 active profile 查询中排除。12 个候选的 `web-curated` 目标当前有 10 个可准入的 active 基线候选：`dsh-context` 缺少 Node 证据，`dsh-config-manager` 缺少 profile 级 dry-run 或执行确认控制。Memento、permission-rules 和 LoongSuite 遥测只有在签入安全 profile 配置时才保持 active。
- **不执行安装生命周期脚本**：策略包把第三方安装脚本记录为事实，但在加载或校验期间不运行它们。
- **不写入 profile，也不执行权限决策**：profile 物化属于 `@deepseek-ai/dsh-curated-profiles`，CLI 报告属于 `@deepseek-ai/dsh-curated-scripts`，工具授权仍委托给所选权限插件。精选层校验该插件的 fail-closed 工件与 profile 配置。

# Curated Packages

[English](README.md) | 中文

`packages/curated/` 是精选插件层的包组容器。

- `curated-base`：定义基础精选组合包，把精选策略和评测资产服务插入 profile。
- `curated-policy`：持有精选层的插件策略数据与策略行为。
- `curated-profiles`：持有精选 profile 模板，并把所选 profile 写入 DSH home，同时不改动已交付 profile。
- `curated-scripts`：提供源树内的 `verify-lock`、`preflight`、`smoke-profile` 和 `compare-benchmark` 命令，用于精选门禁。
- `curated-bench`：提供只读精选清单、任务集、基线、A/B 记录和回滚快照。

## 治理边界

curated 组是组合与准入层。它不修改 `packages/core/agent-loop`、会话协议格式（wire format），也不修改已交付的 `web` 和 `headless` profile 模板。第三方候选以固定 audit 事实和 profile 组合包名称记录；本仓库不会 vendor 其源码，也不会在精选准入检查期间执行其安装生命周期脚本。

## Profile 分层

`web-curated` 的目标基线包含 12 个候选，当前可准入的 active 基线为 10 个：工具包、Web 搜索、memento、MCP 面板、检查点回退、LSP 操作、权限规则、平滑流式渲染、upstream radar 和 LoongSuite 遥测。`dsh-context` 因固定工件缺少 Node 兼容证据而被拒绝，`dsh-config-manager` 因其 profile 配置无法强制 dry-run 或执行确认而被拒绝。该层不声称全部 12 个目标候选都已 active。

`web-coding` 与 `web-enterprise` 当前使用和 `web-curated` 相同的 10 个候选基线；enterprise 物化还要求 `ignore-scripts=true`。`web-research` 会物化该基线以及已准入的场景候选 `plugin-session-export`。Mneme、视觉路由及其他高风险候选在取得所需证据前保持 inactive，`web-personal` 则只包含三个由安装提供的基础组合包。

Profile 物化会写入已批准的 memento、permission-rules 和 LoongSuite 安全设置，preflight 会拒绝更弱的值。权限执行仍委托给权限插件；精选层校验其解析后的 bundle 配置，不引入第二条授权路径。

被拒绝与 fallback 候选仍以 audit 证据保留在 allowlist 中，并且不进入 active profile 模板。Inactive 池覆盖冲突策略和 A/B 资产中命名的搜索、记忆、MCP、浏览器、上下文、费用、导入/编辑、复核、通知和桌面替代项；`dsh-llm-fallbacks` 与 `dsh-feishu` 在其记录的拒绝理由解决前保持 inactive。

## 模型体验

### Curated 包组

#### 模型看到的内容

包组本身不注册提示词文本、工具 schema、用户消息、助手可见结果或会话事件；模型可见行为归所选第一方包或已安装第三方组合包所有。

#### Token 影响

`packages/curated/` 本身没有直接 token 成本。

#### KV Cache 影响

没有直接 cache 影响；任何注册提示词段或工具的 profile 组合包都拥有自身的 cache 稳定性。

## 已知限制与暂缓事项

- **基于快照的准入**：只校验 catalog 仅能证明签入字段内部一致，包括计算得到的八维评分、Node/core-patch 声明、能力策略和 metadata secret 检查。Observed 校验要求调用方提供从精确 commit 解析的已安装工件。
- **不随附第三方源码**：精选 profile 会命名第三方组合包，但本仓库不会 vendor 它们，也不会在没有 profile 安装步骤时让它们可用。
- **外部证据仍待取得**：这些包尚未执行第三方安装、Chrome 浏览器回归、搜索、记忆、MCP 与浏览器 A/B 工作负载、真实候选故障注入或 3–7 天 canary。Fixture 和计划记录不能提供这些证据。

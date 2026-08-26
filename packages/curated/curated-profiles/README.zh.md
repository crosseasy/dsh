# `@deepseek-ai/dsh-curated-profiles`

[English](README.md) | 中文

`@deepseek-ai/dsh-curated-profiles` 定义确定性的精选 profile 模板，并把它们物化到 DSH home。它只创建 `profiles/<curated-name>/package.json`、`cordis.patch.yml`、`pnpm-workspace.yaml` 和 `.npmrc`；已有文件会逐字节保留。

该包不修改已交付的 `web` 或 `headless` profile 模板。精选 profile 会先叠加 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 和 `@deepseek-ai/dsh-curated-base`，然后才是已准入第三方组合包名称。

## API

- `CURATED_PROFILE_TEMPLATES` 将 `web-curated`、`web-coding`、`web-research`、`web-enterprise` 和 `web-personal` 映射到有序组合包列表。
- `materializeCuratedProfile(profileName, home)` 把所选 profile 写到 `home` 下，并返回 profile 目录。

## 场景策略

`web-curated` 的目标基线包含 12 个候选，当前可准入的 active 基线为 10 个。`dsh-context` 因缺少 Node 兼容证据被拒绝，`dsh-config-manager` 因其工件没有 profile 级 dry-run 或执行确认控制而被拒绝。`web-coding` 与 `web-enterprise` 使用相同的 10 个候选基线。`web-research` 会物化该基线以及已准入的场景候选 `plugin-session-export`；mneme 与视觉路由仍是 inactive research 候选。`web-personal` 只包含三个由安装提供的基础组合包。

Profile patch 会明确配置 memento 使用审批式写入并关闭自动 proposal、permission rules 在规则文件非法时失败并启用执行，以及 LoongSuite 关闭正文采集。Preflight 会拒绝更弱的值。权限决定仍委托给权限插件。`web-enterprise` 写入 `ignore-scripts=true`；若已有 enterprise `.npmrc` 的有效值不是 `true`，物化会在写入 profile 文件前失败。

## 模型体验

### Profile 文件物化

#### 模型看到的内容

`materializeCuratedProfile()` 只写 profile 文件。它不贡献提示词文本、工具 schema、用户消息、助手可见结果或会话事件；profile 启动拥有所选组合包带来的任何模型可见行为。

#### Token 影响

`@deepseek-ai/dsh-curated-profiles` 本身没有直接 token 成本。

#### KV Cache 影响

没有直接 cache 影响；cache 稳定性取决于物化后的 profile 启动时加载的组合包行。

## 已知限制与暂缓事项

- **候选安装与运行证据来自外部**：物化只记录组合包名称，不安装或执行第三方包。精选脚本检查调用方提供的已安装 profile，且无法解析工件时失败；生成的 profile 文件不能证明安装、浏览器行为、A/B 结果、故障恢复或 canary 已完成。
- **已有 profile 文件优先，但 enterprise 有一项例外**：重复执行物化会保留已有文件，但已有 `web-enterprise/.npmrc` 必须保持 `ignore-scripts=true`。
- **场景拆分是静态的**：`web-personal` 当前只包含共享 profile 壳层，因为还没有仅面向个人场景的候选通过准入；coding、research 和 enterprise 增量固定在签入模板中。

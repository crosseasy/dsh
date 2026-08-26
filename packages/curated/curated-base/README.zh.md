# `@deepseek-ai/dsh-curated-base`

[English](README.md) | 中文

`@deepseek-ai/dsh-curated-base` 是精选插件层的静态 profile 组合包。它的 `dsh.bundle.patch` manifest 指向 [`cordis.patch.yml`](cordis.patch.yml)，其中插入 `@deepseek-ai/dsh-curated-policy` 和 `@deepseek-ai/dsh-curated-bench` 行。第三方插件行属于其他精选组合包或 profile overlay。

## 组合包约定

该包的主模块不导出运行时 API。它的 package manifest 声明供 profile 组合消费的组合包 patch；可选 invariant companion 记录该组合包除加载精选服务行外不持有运行时 invariant。

## 模型体验

### Curated 服务插入

#### 模型看到的内容

该组合包 patch 插入 `@deepseek-ai/dsh-curated-policy` 与 `@deepseek-ai/dsh-curated-bench` Cordis 行，本身不贡献提示词文本、工具 schema、用户消息、助手可见结果或会话事件。

#### Token 影响

直接 token 成本为零。

#### KV Cache 影响

本身没有直接影响；被插入的精选包拥有它们注册的任何 cache 相关上下文。

## 已知限制与暂缓事项

- **精选行为由其他包持有**：此组合包只加载 `@deepseek-ai/dsh-curated-policy` 和 `@deepseek-ai/dsh-curated-bench`；插件 allowlist、benchmark 资产、执行约束和第三方行属于这些包或其他组合包。
- **不安装候选**：该组合包不安装第三方包，也不运行其安装生命周期脚本。

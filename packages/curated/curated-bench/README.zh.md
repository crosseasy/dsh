# `@deepseek-ai/dsh-curated-bench`

[English](README.md) | 中文

`@deepseek-ai/dsh-curated-bench` 持有精选插件层的结构化 benchmark 输入。每项执行相关资产都显式标为 `observed`、`fixture` 或 `planned`；仓库中的默认记录是没有伪造运行数据的计划。

## 资产

- `manifests/`：只读候选 audit 摘要。
- `tasks/`：搜索、记忆、浏览器、MCP、成本和 profile smoke 检查的能力任务集定义。
- `baselines/`：官方 profile 快照、精选 profile 快照和动态 A/B 比较输入。

## API

该包导出三个资产根目录的定位值、只读 `ctx.curatedBench` 资产服务，以及一个 invariant companion，用来校验计划中的 canary、Chrome CDP 9333、A/B 对比和内嵌回滚快照摘要。消费者从这些目录读取显式 JSON 文件；该包本身不运行 benchmark。

Observed 比较只有在 baseline 与 candidate 记录使用完全相同的模型、提示词、workspace、网络与种子值，携带相同的任务和 attempt 集，包含每个必需关键任务，并且每个 profile 对每项任务至少重复 5 次时才可准入。阈值决策使用报告舍入前的原始值。回滚数据在 SHA-256 摘要下内嵌完整 lock 与 profile 快照，因此结果指向不可变、可恢复的上一组输入，而不是可变路径引用。

## 模型体验

### Benchmark 资产

#### 模型看到的内容

该包不注册提示词文本、工具 schema、用户消息、助手可见结果或会话事件。只有其他工具或命令把 benchmark 记录放进提示词时，这些记录才会变成模型可见内容。

#### Token 影响

`@deepseek-ai/dsh-curated-bench` 本身没有直接 token 成本。

#### KV Cache 影响

没有直接 cache 影响；引用 benchmark 数据的调用方拥有该请求内容。

## 已知限制与暂缓事项

- **记录具有明确分类**：fixture 和 planned 记录不是准入证据，也不计作 canary 或故障执行。
- **长周期运行仍待执行**：签入的搜索、记忆、浏览器、MCP、故障和 canary 评测不包含伪造运行。操作者必须提供带来源信息的 observed 记录；planned 与 fixture 数据不能作为完成证据。

# `@deepseek-ai/dsh-curated-scripts`

[English](README.md) | 中文

`@deepseek-ai/dsh-curated-scripts` 持有精选插件准入与 profile 证据的源树命令实现。该包导出可测试的命令函数，并交付 `verify-lock`、`preflight`、`smoke-profile` 和 `compare-benchmark` 的薄 bin 包装层。

## 命令

- `verify-lock` 静态校验 catalog metadata，包括计算得到的八维评分和必需的 Node/core-patch 声明。提供一个或多个绝对 `--artifact-root` 后，它还会解析已安装工件，并在不执行包脚本的前提下核对不可变来源记录、manifest、patch、依赖、安装 hook、Node 兼容性与核心路径改动。
- `preflight` 接受显式 fixture 进行非观测静态校验，或接受绝对 `--profile-root` 进行观测校验。观测校验会解析每个已安装 bundle 的 manifest 和 patch 以及 profile patch，再执行权威 provider/fallback 策略、重复注册、memento/permission-rules/LoongSuite 安全设置、数据处理默认值，以及普通配置与 curated metadata 的 secret 拒绝。权限执行仍委托给解析到的权限插件。
- `smoke-profile` 的观测 CLI smoke 要求绝对 `--profile-root`。它解析并导入已安装候选工件，然后使用清理后的子进程环境，在同一个 55 秒墙钟期限内运行 `--dump-config` 与 `--help`。缺失或非法工件会 fail-closed；该命令不会创建 synthetic bundle shim。
- `compare-benchmark` 要求证据显式标为 `observed`、`fixture` 或 `planned`。观测比较必须提供执行 ID、时间戳，使用完全相同的模型、提示词、workspace、网络与种子值，具有一致的任务和 attempt 键，每个任务至少重复 5 次，并包含全部必需的关键任务。该命令使用未舍入值判断不可补偿阈值，并校验内嵌回滚快照的 SHA-256 摘要。

## API

每个 `run*` 函数接收 CLI 风格字符串参数，并返回带 `status`、`stdout` 和 `stderr` 的 `CommandResult`。观测 lock 校验使用 `--artifact-root`；观测 preflight 与 smoke 使用 `--profile-root`，也可另行提供 `--artifact-root`。JSON 报告会标明证据来源。Fixture benchmark 记录返回 `unverified`，计划中的评测返回 `pending`；两者都不能返回 `accepted`，也不能作为 canary 或故障执行证据。`createSmokeProfileChildRunner(command, baseArgs)` 使用清理后的环境和有界子进程执行。

## 模型体验

### 离线精选校验

#### 模型看到的内容

这些命令在 agent runtime 之外运行，并向调用方输出文本或 JSON。它们不注册提示词文本、工具 schema、用户消息、助手可见结果或会话事件。

#### Token 影响

`@deepseek-ai/dsh-curated-scripts` 本身没有直接 token 成本。

#### KV Cache 影响

没有直接 cache 影响；只有当调用方显式把命令输出放进另一条提示词时，诊断才会变成模型可见内容。

## 已知限制与暂缓事项

- **不安装第三方包**：这些命令读取调用方提供的已安装工件，但不安装包，也不运行候选安装生命周期脚本。
- **静态结果不是运行时证据**：无 root 的 lock 校验和显式 preflight fixture 会标为非观测；preflight fixture 不会被报告为已通过观测准入，smoke 则要求真实已安装 profile。
- **Smoke 执行有界**：观测 smoke 使用提供的已安装 profile，并对工件检查和子进程阶段应用同一个墙钟期限。
- **仓库不包含长周期运行证据**：默认 benchmark 只列出待执行评测，不伪造运行记录。`compare-benchmark` 会评估输入记录，但不执行外部工作负载、故障评测或 3–7 天 canary。

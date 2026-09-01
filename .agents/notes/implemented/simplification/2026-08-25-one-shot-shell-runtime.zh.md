# Agent Note: 一次性 shell 运行时

Status: implemented

[English](2026-08-25-one-shot-shell-runtime.md) | 中文

## 问题

`dsh-bash-local` 与 `dsh-pwsh-local` 需要同一套一次性进程生命周期：构造带收集器的子进程 spawn、融合前台 timeout 与上游取消、区分 `timedOut` 和 `aborted`、投影最终 stdout/stderr、为后台读取保留消费游标、注入单次 spawn 失败提示，以及结算 `kill()`。`dsh-bash-sandbox` 与 `dsh-pwsh-sandbox` 也需要同一套前台／后台沙箱结算，同时保留各自的 argv 构造和提供方方言数据。`dsh-tool-bash` 与 `dsh-tool-pwsh` 也需要逐字节相同的前台投影、前台／后台渲染、后台输出 schema 和进程结果映射，同时保留独立的工具名称、schema 文案、提示词、路由和方言规则。生命周期或渲染归属留在方言包内部时，共享修复容易被遗漏。

## 决策

`@deepseek-ai/dsh-shell-runtime` 作为私有辅助包拥有共享的一次性生命周期。`OneShotShellExecutor` 扩展 `dsh-shell` 的 Service Definition 基类，并提供 protected `runArgv()` / `startArgv()` 钩子。适配器包传入精确 argv、已解析 cwd、stdin、显式环境、输出预算、spill 预算、grace period、timeout code 和 collect reader 缺失诊断。

运行时还拥有共享请求默认值、数字上限校验，以及适配器提供的 env 默认值、调用方 env 与 Harness env 的合并顺序。`dsh-bash-local` 与 `dsh-pwsh-local` 保留公开 `Config` schema、诊断前缀、argv 构造、可执行文件解析和环境默认值。

`OneShotSandboxSettlement` 拥有与 shell 方言无关的前台和后台沙箱结算。沙箱适配器传入已解析模式、提供方包装后的 argv、enforcement 值、拒绝签名、runner 失败规则，以及执行器拥有的 `SANDBOX_UNAVAILABLE` 错误工厂。结算对象按 `ShellProcess` 存放后台事实，在 `done` 完成前为每个进程写入一次，并在结算后移除这些事实。

`@deepseek-ai/dsh-shell` 拥有 shell 工具共享的纯一次性结果辅助函数：`projectShellForegroundResult`、`renderShellResult`、`renderShellProcessRead`、`SHELL_BACKGROUND_OUTPUT_PROPERTIES`、`shellProcessOutcome` 和 `parseExitStatus`。这些辅助函数定义前台工具输出投影、模型可见的前台与后台结果文本、后台输出 schema 属性、后台进程结果字段，以及 terminal 卡退出状态解析。Bash 与 PowerShell 工具包保留注册、schema 文本、审批与升权路由、workdir／默认值策略、工具身份、job kind、提示词文本、argv／可执行文件／env 方言行为和 shell 专属限制。

## 考虑过的替代方案

**做成一个可配置的 Bash/Pwsh 执行器。** 拒绝。执行器的身份就是它 spawn 的 shell；PowerShell 可执行文件探测、UTF-8 preamble、Windows signal 事实与 Bash 的 `TERM=dumb` 策略保留在各自包内更清晰。

**保留重复生命周期，只缩小 `jscpd` 豁免。** 拒绝。前台 deadline 与后台结算正是最容易漂移的位置；更小的豁免只会少隐藏一些代码，不能移除重复 owner。

**将沙箱结算留在各沙箱适配器中。** 拒绝。只要适配器提供方言数据，前台 runner 失败优先级、spawn 归因 guard、拒绝分类和后台事实清理都是相同行为。复制这些逻辑会继续把风险最高的生命周期行为分散在 Bash 与 PowerShell 中。

**提取一个通用可配置 shell 工具基类。** 拒绝。面向模型的工具身份是方言专属的。Bash 与 PowerShell 保留各自的 schema 文案、系统提示词文本、审批路由约束、workdir／默认值策略、job kind 和 argv／可执行文件／env 指引；只有纯模型结果 helper 共享。

## 后果

一次性 shell 生命周期和沙箱结算修复只需落在 `shell-runtime`，一次性工具结果／投影修复只需落在 `dsh-shell`，Bash 与 PowerShell 差异仍显式保留在适配器包内。宽泛的 shell 生命周期重复代码豁免不存在。共享辅助函数行为由 `dsh-shell` 渲染测试和既有 Bash／PowerShell 工具与执行器套件固定。

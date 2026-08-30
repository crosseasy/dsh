# Agent Note: 持久 shell 工具运行时

Status: implemented

[English](2026-08-25-persistent-shell-tool-runtime.md) | 中文

## 问题

持久 Bash 与 PowerShell 工具曾各自携带重复的 owner 作用域 PTY 生命周期代码：shell 创建、首次调用去重、同一 owner 命令串行化、scrollback 分页、deadline 处理、不确定状态时 reset，以及插件拆卸。这份重复大到需要把整个 PowerShell 工具文件包进 `jscpd` 豁免，后续生命周期修复容易在两个方言之间漂移。

## 决策

`@deepseek-ai/dsh-persistent-tool-runtime` 拥有面向模型的持久 shell 工具共享生命周期。它从 `PersistentShellDialect` 注册一个工具，为每个精确 Agent 惰性创建一个 `ctx.terminals` 会话，串行化该 owner 的命令，让不同 owner 互不阻塞，分页读取保留的 scrollback，应用命令 deadline，并在 shell 退出、timeout、abort、send 失败或插件 dispose（资源释放）时关闭缓存会话。Agent 作用域的运行时 disposer 只从 pending 与 live 缓存中移除该 owner；实际 PTY 由终端服务的 owner 生命周期关闭。

插件 dispose 会启动每个活跃会话的关闭，等待它们全部结算，清空活跃缓存，然后通过 Cordis 拆卸诊断报告第一个关闭失败。因此，一个会话关闭失败不会让 dispose 在另一个关闭仍进行时返回。

`dsh-tool-bash-persistent` 与 `dsh-tool-pwsh-persistent` 是方言适配器。它们保留各自公开 `Config`、工具名、schema 文本、模型可见描述、marker 创建、命令包装层、shell 初始化文本、prompt/echo 处理、完成检测与状态解析。运行时只格式化共享的 timeout/reset/status 文本框架，并把命令提取委托给适配器。

## 考虑过的替代方案

**发布一个通用持久 shell 工具。** 拒绝。Bash 与 PowerShell 的命令 quoting、prompt 初始化、回显行为和平台限制都足够影响模型可见约定，藏进一个可配置工具会模糊契约。

**保留重复适配器，只缩小 jscpd 豁免。** 拒绝。重复的生命周期代码正是取消、timeout 与拆卸缺陷反复出现的位置；保留两份实现会保留本次评审指出的漂移风险。

**把方言解析移入运行时。** 本次抽取拒绝。共享运行时接收 completed/partial output 的适配器钩子，让 shell 专属 marker 与 prompt 规则留在创建包装层的同一个包附近。

## 后果

持久 shell 工具的生命周期修复只需落在 `persistent-tool-runtime`，方言变更仍隔离在适配器包内。[持久 Bash 与字符串替换编辑器决策](../feature/2026-07-29-persistent-bash-str-replace-editor.zh.md)和[持久 PowerShell 决策](../architecture/2026-08-11-pwsh-persistent-pty.zh.md)负责说明此运行时保留的模型可见方言行为。PowerShell 的整文件重复代码豁免已经移除；剩余相似代码必须是局部且有理由的。本包没有直接模型接口，但其行为由共享运行时测试和两个持久工具套件共同覆盖。

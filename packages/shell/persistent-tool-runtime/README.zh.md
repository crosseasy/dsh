# @deepseek-ai/dsh-persistent-tool-runtime

[English](README.md) | 中文

由 `ctx.terminals` 支撑的持久 shell 工具私有辅助包。它根据调用方提供的 `PersistentShellDialect` 注册一个模型可见工具，并拥有 owner 作用域 PTY 缓存、首次调用去重、同 owner 命令串行化、owner/插件清理、scrollback 分页、命令 deadline、reset 处理和通用文本结果包装。

## Config

本包没有 Cordis 插件配置。调用方把 `PersistentShellDialect` 传给 `registerPersistentShellTool()`。

## API Contract

`registerPersistentShellTool(ctx, config)` 通过 `ctx.tools.register()` 注册 `config.toolName`。注册后的工具接受一个名为 `command` 的必填字符串参数，拒绝空白命令，要求存在所属 Agent，把输出渲染为文本，并使用终端卡片展示调用，标题为提交的命令。

dialect 提供所有 shell 专属 hook 和模型可见字符串：工具名和描述、命令参数描述、终端后端类型、timeout 和输出上限、timeout 标识、生命周期/reset 标签、初始化、marker 创建、命令包装、完整和部分输出提取，以及部分完成检测。运行时本身不解析 shell 语法；它只询问 dialect 命令输出从哪里开始、何时证明完成，以及如何包装不完整的保留输出。

## Owner-Scoped PTY Lifecycle

每个 Agent 对每个已注册工具最多拥有一个 live PTY 会话。同一 Agent 的并发首次调用共享一个 pending spawn；该 Agent 的后续调用会串行运行，因此 shell 状态按命令顺序被观察。不同 Agent 的调用使用不同 PTY，彼此不等待。

运行时会在存在 Agent 会话 cwd 时以该 cwd spawn 配置的终端后端，然后在第一条命令前运行 dialect 初始化器。插件 dispose 会中止正在创建的会话，等待已跟踪的创建过程结算，并 kill 该插件拥有的所有 live PTY。Agent 作用域 dispose 会移除该 Agent 的缓存会话引用，因此后续 owner 使用新的 PTY。

## Output, Timeout, and Reset Behavior

每条命令都会带着新的 dialect marker 被包装并提交一次。运行时按页读取保留的 scrollback，优先使用 dialect 证明的完整捕获；当后端证明部分完成时，回退到 dialect 部分捕获；并把非零命令状态追加为 `[exit code: N]`。

`maxOutputChars` 在追加固定诊断前限制命令输出文本。不完整的保留输出会让运行时前置 `lostPrefixMessage`；输出超过上限或已知不完整时，会追加 `truncatedMessage`。

`timeoutMs` 适用于单次命令执行。timeout 会返回带通用 timeout 通知的有界部分输出，reset PTY，并追加 `resetMessage`。初始化失败、send 失败、命令 abort 和观察到 shell 退出也会清理缓存 PTY；shell 退出会返回最佳部分捕获，加上 `[shell exited: code N]`、`[shell killed by signal: SIG]` 或 `[shell exited]`，然后追加 `resetMessage`。

## Model Experience

### Persistent shell tool results

#### What the model sees

间接通过 `dsh-tool-bash-persistent` 和 `dsh-tool-pwsh-persistent` 可见；它们使用此运行时提供生命周期、timeout、reset 和保留输出包装，同时保留各自的工具 schema 和 dialect 专属文本。本包不贡献独立的系统提示词段落或生成的工具目录条目。

#### Token effect

无直接 token effect。消费工具拥有 schema 文本和 dialect 专属结果文本；此运行时可以向它们的工具结果添加固定状态、截断、丢失前缀、timeout 和 reset 诊断。

#### KV Cache effect

仅追加工具结果跟随可复用的请求前缀。当消费工具 schema 和 dialect 字符串保持不变时，运行时会保留稳定前缀。

## Known Limitations and Deferred Work

- 运行时要求真实的 `ctx.terminals` 后端和所属 Agent；它会拒绝无 agent 调用，而不是创建进程全局 shell 状态。
- 运行时不是通用 shell 抽象：调用方必须提供用于 marker 创建、命令包装、初始化、完成检测和输出提取的 dialect hook。
- timeout、abort、初始化失败、send 失败或 shell 退出后的 reset 会丢弃 shell 状态；没有 cwd、环境、函数、别名或后台任务的 checkpoint 或 replay。
- 一次性 shell 执行和沙箱结算仍由当前包拥有。

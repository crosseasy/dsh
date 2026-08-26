# @deepseek-ai/dsh-shell-runtime

[English](README.md) | 中文

基于 `ctx.subprocess` 的一次性 shell 执行器私有 helper 包。它为 `dsh-bash-local` 与 `dsh-pwsh-local` 提供共享的前台与后台进程生命周期，并为它们的沙箱化 adapter 提供与 shell 方言无关的 sandbox settlement；它自身不注册 `ctx.shell`。

## API Contract

`OneShotShellExecutor` 扩展 `dsh-shell` 的 Service Definition 基类，并把 `runArgv()` / `startArgv()` 保留为执行器子类可用的 protected hook。adapter 传入精确 argv、已解析 cwd、stdin、显式 env、输出预算、spill 预算、grace period、timeout identity 和 collect reader 缺失诊断。runtime 负责共享请求默认值与上限、构造 subprocess spawn、校验 collect reader、分类前台 timeout/abort、投影最终 stdout/stderr、维护后台读取游标、单次交付 spawn 失败提示，以及结算 kill。

`OneShotSandboxSettlement` 围绕这些 hook 包装一次受限的前台或后台调用。adapter 提供已解析的模式、provider 包装后的 argv、enforcement 值、拒绝签名和 runner 失败规则；runtime 分类前台结果，通过 adapter 的错误工厂转换 runner 基础设施失败，并按 `ShellProcess` 存放后台沙箱事实，直到结算时写入并移除。

`oneShotShellSettings()` 将 adapter 拥有的 env 默认值、caller env、Harness env 和已解析 runtime 预算投影为这些 lifecycle hook 消费的 settings。

runtime 只解析与 shell 方言无关的请求字段。Bash 的 `bash -c`、`TERM=dumb`、公开配置 schema 和诊断前缀仍在 `dsh-bash-local`；PowerShell 的可执行文件探测、`ENCODING_PREAMBLE`、公开配置 schema 以及不设置 `TERM=dumb` 仍在 `dsh-pwsh-local`。沙箱化 adapter 保留策略解析与 provider 方言数据，并把 settlement 委托给本包。

## Model Experience

### 一次性 shell 生命周期

#### What the model sees

模型只会通过 `dsh-tool-bash` 和 `dsh-tool-pwsh` 间接看到此 runtime；它们的 schema、渲染、后台任务集成和沙箱升级文本均不变。

#### Token effect

无直接 token 影响。

#### KV Cache effect

不会直接导致 KV Cache 失效；本包不贡献 system-prompt section 或 tool schema。

## Known Limitations and Deferred Work

- runtime 只支持一次性命令的 collect-mode subprocess 执行。
- 它不覆盖持久 PTY 会话；后者使用 [`dsh-persistent-tool-runtime`](../persistent-tool-runtime/README.zh.md)。
- 它不拥有沙箱策略、provider 选择或方言签名；沙箱化 adapter 将这些按调用事实传入 `OneShotSandboxSettlement`。

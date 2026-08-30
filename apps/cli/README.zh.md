# `@deepseek-ai/dsh`

[English](README.md) | 中文

`dsh` 是 DeepSeek Harness 中用于启动 profile 的命令；profile 由多个插件组合包 patch 层按顺序叠加而成，其上再应用用户自己的覆盖配置。[`src/args.ts`](src/args.ts) 负责命令语法，[`src/bin.ts`](src/bin.ts) 只加载选中的运行器。无效命令、来自其他模式的选项、配置错误和启动失败都会以非零状态退出。

## 入口模式

| 命令 | 用途 |
|---|---|
| `dsh --profile <name>` | 启动位于 `$DSH_HOME/profiles/<name>` 的指定 profile。 |
| `dsh --profile headless "job"` | 运行一个全新的持久化会话，打印最终答案并退出。 |
| `dsh web` | `--profile web` 的别名。 |
| `dsh plugin --profile <name> <pnpm args>` | 通过 pnpm 管理 profile 插件，并禁用依赖生命周期脚本。 |

运行命令时所在的目录将作为默认 workspace 根目录。`web` 和 `headless` profile 在首次使用时会从随附模板自动初始化。内置精选 profile（`web-curated`、`web-coding`、`web-research`、`web-enterprise` 和 `web-personal`）会在首次启动、配置 dump 或安装时由 `@deepseek-ai/dsh-curated-profiles` 物化，且不会改变随附模板；即使 profile 不存在，精选插件 help 与列表也保持只读。其他任何 profile 都必须通过 `dsh plugin` 创建。

精选 profile 的启动和配置 dump 会在 Loader 激活前执行强制准入：manifest 必须匹配模板与 catalog 分配，包管理器设置必须安全，profile、home 与命令行 patch 层不得包含动态表达式或未批准的 plugin/group 插入。初次准备期间，一份保留的 descriptor-bound snapshot 会在共享 `profiles/node_modules` fallback 的每项 mutation 紧邻前后检查 profile identity；随后通过已校验的随机同级临时文件写入生成的 `cordis.yml`，以原子 rename 发布，并在发布后做最终 identity 检查。在这些检查阶段把 profile 祖先替换为指向无关目标的 symlink 或 junction 时，操作会 fail-closed，且不会把根配置内容写入该目标。这不阻止具有相同文件系统权限的进程把已经打开的原目录移出 DSH home，再在路径式 mutation 前把同一 inode 链回原路径；准备期间调用方必须排他管理 DSH home。每次精选 live 重组都会从一份新的、绑定到 descriptor 的受管文件快照读取 profile patch，在准入后复核其 identity，并在返回前关闭快照；home patch 仍按每代路径读取，命令行 overlay 则在本次运行期间保持固定。Enterprise 限制作用于最终静态组合和每次用户 patch 热重载。精选 profile 的 bundle 成员固定。`dsh plugin --profile <curated-name> install` 会跨进程序列化 writer，在持锁期间恢复或删除中断安装状态，把模板依赖安装到私有 staging home，且禁用生命周期脚本并仅使用本地 pnpm store；它会保留已有 profile patch 与 lockfile，并在目录 rename 激活前校验 staged 生成文件、两份 pnpm lockfile、bundle 解析及准入。pnpm 或校验失败会保持旧 live profile 不变；激活失败会先恢复旧目录再返回。安装器会移除 ambient npm/pnpm 配置，把 pnpm 的 user/global config 固定到 staged `.npmrc`，在 live profile 已有 lockfile 时使用 `--frozen-lockfile`，拒绝 package-manager 根目录重定向、包变换或构建授权环境注入，并且不接受额外参数。本地缺少包时安装会失败，而不会发起网络抓取。精选 `--help` 与 `list` 由签入模板生成，不创建 profile 也不调用 pnpm；会改变依赖集合的命令会在运行 pnpm 前被拒绝。普通 profile 保留通用插件管理与用户 patch 行为。

## 应用参数

启动器只解析自身的 flag，并将其后的所有内容交给已启动的 profile；注入该 profile 的任意应用插件都可以解析这份共享的不可变快照（[`dsh-cmdline`](../../packages/boot/cmdline/README.zh.md)）。因此，启动器的 flag 必须写在最前面；启动器无法识别的第一个 token 标志着应用参数的开始：

```sh
dsh --profile web --port 8080       # --port belongs to the web app
dsh --profile tui --resume <id>     # example, assuming the tui profile is installed; --resume belongs to the terminal app
dsh --profile headless "run the tests"
dsh --profile web --help            # the web app's flags, not the launcher's
dsh --help                          # the launcher's own help
```

<a id="profiles"></a>

## Profile

profile 目录包含一个 `package.json`，其中记录树外插件依赖，以及 profile manifest（元数据清单）`dsh.profile` 和其中按顺序排列的 `bundles` 列表；还包含一个 `cordis.patch.yml`，其中保存用户自己的 patch 层。

配置树以空根为起点，依次叠加以下配置层：
- `dsh.profile.bundles` 中各组合包的 patch
- profile 自身的 `cordis.patch.yml`，然后是 home 级的 `$DSH_HOME/cordis.patch.yml`
- `--patch` 指定的覆盖层

`dsh.profile.bundles` 中列出的组合包先从 dsh 安装目录解析（`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app`、`@deepseek-ai/dsh-headless`），再从 profile 自身的 `node_modules` 解析；pnpm 会将树外插件安装到该目录。

使用 `--dump-default-config` 和 `--dump-config` 可在不启动的情况下检查组合后的配置树。

层的确切优先级、flag、关闭行为、部署默认值和源码执行方式，以 [CLI（命令行界面）行为参考](reference/README.zh.md)为准。

## 开发

生产运行需要已构建的包与前端产物。请在仓库根目录单独运行 `pnpm run build`，然后使用 `pnpm dsh <args...>` 运行 TypeScript 入口并转发所有参数；模块解析约定以[源码执行参考](reference/README.zh.md#source-execution)为准。

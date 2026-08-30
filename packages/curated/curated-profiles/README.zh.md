# `@deepseek-ai/dsh-curated-profiles`

[English](README.md) | 中文

`@deepseek-ai/dsh-curated-profiles` 定义确定性的精选 profile 模板，并把它们物化到 DSH home。它只创建 `profiles/<curated-name>/package.json`、`cordis.patch.yml`、`pnpm-workspace.yaml` 和 `.npmrc`；精选策略校验成功后，已有文件会逐字节保留。

该包不修改已交付的 `web` 或 `headless` profile 模板。精选 profile 会先叠加 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 和 `@deepseek-ai/dsh-curated-base`，然后才是已准入第三方组合包名称。

## API

- `CURATED_PROFILE_TEMPLATES` 将 `web-curated`、`web-coding`、`web-research`、`web-enterprise` 和 `web-personal` 映射到有序组合包列表。
- `materializeCuratedProfile(profileName, home, options)` 把所选 profile 写到 `home` 下，并返回 profile 目录；`options.userLayer: false` 会为仅含 bundle 的恢复诊断跳过已有用户 patch 解析。
- `materializeCuratedProfileForLoad(profileName, home, options)` 物化 profile，并返回绑定到 descriptor 的受管文件字节；调用方必须在加载与准入完成后关闭它。
- `generatedCuratedProfileFiles(profileName)` 返回完整生成受管文件字节，供 transaction staging 使用，而不写入 live profile。
- `openExistingCuratedProfileFiles(profileName, home, dir, options)` 校验并保留已有 profile，且不创建或更改文件。
- `assertCuratedProfileAdmission(profileName, profile, additionalUserLayers, options)` 在配置 dump 或 Loader 激活前强制执行模板、catalog 分配、包管理器和用户层规则。

物化会在发布缺失文件前校验全部已有受管输入，把每个新文件纳入同一 descriptor snapshot，只在并发发布文件的字节一致时接纳它，并在后续发布或 identity 检查失败时按逆序删除本次调用创建的文件。物化与准入在添加所选依赖前使用 curated-policy 的当前 profile 完整性谓词；聚焦单元测试会校验模板与依赖的一致性，仓库 `verify-curated-activation-evidence` 门禁则检查 catalog 与模板之间的关系。包 invariant 是带说明的空 installer，因为固定模板不提供可观测的运行时关系。

## 场景策略

`web-curated` 的目标基线包含 12 个候选。六个候选已取得静态/安装资格证据，但都没有基于其固定产物的 keyless assembled runnable snapshot，因此 runtime active 数为 0。Web 搜索还缺少必需的 `@anweat/dsh-browser` bundle/runtime dependency。五个模板都只包含三个安装自有基础 bundle。

没有第三方候选 active 时，profile patch 为空。候选专属安全设置继续保留在 catalog 中，供后续准入使用。每个 profile 都写入 `ignore-scripts=true`，生成的 workspace 不含构建授权、`patchedDependencies` 或 `packageExtensions`。

## 模型体验

### Profile 文件物化

#### 模型看到的内容

`materializeCuratedProfile()` 只写 profile 文件。它不贡献提示词文本、工具 schema、用户消息、助手可见结果或会话事件；profile 启动拥有所选组合包带来的任何模型可见行为。

#### Token 影响

`@deepseek-ai/dsh-curated-profiles` 本身没有直接 token 成本。

#### KV Cache 影响

没有直接 cache 影响；cache 稳定性取决于物化后的 profile 启动时加载的组合包行。

## 已知限制与暂缓事项

- **候选安装与运行证据来自外部**：只有 `runtimeActivationEvidence` 的 key 与候选目标 profile 精确一致，且每个所选 profile 都有完整 keyless assembled snapshot 以及安装、启用、重启、禁用或卸载证据时，物化才会加入第三方 bundle。每个必需 runtime bundle 还必须来自同一 profile 中另一个对该 profile 具有完整证据的 active 候选，并且两个候选都会进入 profile dependencies。E3/E4、浏览器行为、A/B 结果、故障恢复与 canary 均为 pending。
- **已有文件只校验、不改写**：`package.json`、`cordis.patch.yml`、`pnpm-workspace.yaml` 和 `.npmrc` 必须是普通文件，不能是 symlink、junction 或其它文件类型。物化操作会在宿主支持时使用 `O_NOFOLLOW` 打开已有文件，要求 `lstat` 与 `fstat` 的非零 device/inode identity 一致，从该 descriptor 读取并校验字节，并在读取前后核对 descriptor、文件路径与 profile 目录 identity。CLI 会在初次通用 profile 加载与精选准入期间保留同一份快照，在共享 `profiles/node_modules` fallback 的每项 mutation 紧邻前后调用其 identity assertion，随后为每次 live 重组创建并关闭一份新快照；每份快照都提供 profile patch 字节，并在返回前接受复核。因此受管文件或其 profile 目录祖先被替换时会 fail-closed，且不会读取外部 symlink 目标。缺失文件会在目录 snapshot 保持打开时写入经过 descriptor 校验的随机临时文件，再通过排他 hard link 发布。生成的 `cordis.yml` 同样先写入已校验的随机同级临时文件，再以原子 rename 替换根配置，并在发布后再次检查 snapshot。如果祖先在发布时指向无关 replacement target，该目标没有这份随机临时源，因此发布会失败，且不会把根配置内容写入该目标。Node 没有与 `openat`、`linkat`、`renameat` 和 `unlinkat` 等价的跨平台 descriptor-relative API：在最后一次目录 identity 检查与路径式 `linkSync` 或 `renameSync` 之间，具有相同文件系统权限的进程可以把已经打开的原目录移出 DSH home，再让原路径指回该 inode。此时发布可能先在移动后的原目录中把完整临时文件写成受管文件名，随后的 identity 检查才会 fail-closed。物化与 CLI 初次准备期间，调用方必须排他管理 DSH home。临时 descriptor 始终会被关闭；如果首次 identity 获取失败，cleanup 会在不尝试 identity-based unlink 的情况下删除仍可达的随机路径，取得 identity 后的 cleanup 则会在 `unlink` 前校验该 identity。移动后的原目录中可能留下不可达的随机临时文件，且 identity 检查加 `unlink` 不构成针对同权限替换的原子 compare-and-unlink。已有 `.npmrc` 字节必须等于 `ignore-scripts=true`；manifest `pnpm` 字段、模板漂移、构建授权、依赖 patch、package extension 和 pnpmfile hook 都会被拒绝。Enterprise 会在最终组合结果上校验受治理插件设置。安全的已有文件保持逐字节不变。
- **启动准入不可跳过**：`dsh` 启动和配置 dump 要求 bundle 顺序与模板及 catalog 分配精确一致，保持 installation-first 解析，并拒绝 profile、home 与命令行 patch 中的动态表达式或未批准 plugin/group 插入。每次静态组合和用户 patch 热重载后都会再次执行 enterprise 限制。仅含 bundle 的恢复诊断使用 `userLayer: false`，因此仍会校验 manifest 与包管理器状态，但不会解析 profile patch。独立 observed preflight 继续负责产物目录和 lockfile 深检。
- **没有通用网络执行机制**：profile 输出只包含候选在目录中记录的已有配置控制。缺少已批准策略所要求配置的候选保持 inactive；部署侧网络限制不属于该包。
- **场景拆分是静态的**：`web-personal` 当前只包含共享 profile 壳层，因为还没有仅面向个人场景的候选通过准入；coding、research 和 enterprise 增量固定在签入模板中。

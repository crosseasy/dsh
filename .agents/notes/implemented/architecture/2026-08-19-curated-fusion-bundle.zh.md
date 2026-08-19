# Agent Note: 精选 fusion 组合包组合精确版本的外部插件

Status: implemented

[English](2026-08-19-curated-fusion-bundle.md) | 中文

## Problem

已验证的外部 Web 插件以可独立安装的组合包形式发布，而 `@linxin666/dsh-web-ui-all` 还会聚合这些插件，并额外包含重复的图像处理、已弃用面板、无关的插件管理配置项和不同版本的 `dsh-better-sidebar`。同时应用聚合包和独立组合包会重复挂载 Cordis 配置项；允许每个依赖贡献自己的 profile 层，则会使组合顺序和去重失去单一所有者。

TUI 和 Desktop 是独立宿主，各自持有配置项与生命周期职责。把它们作为同一 Web 组合包的内容，会让终端或 Electron 启动耦合到一个仅用于选择支持 Web 的外部插件的 patch。

## Decision

`@deepseek-ai/dsh-fusion` 是叠加在 `dsh-web-app` 之上的薄 meta-bundle（元组合包）。它声明纯数据的 `dsh.bundle.patch`，没有运行时 API 或协调插件，并按照 [profile 插件组合包决策](2026-08-05-profile-plugin-bundles.md)的显式分层规则直接插入选定的独立配置项。

manifest 为每个插入的包固定一个精确版本运行时依赖。patch 配置项名称与依赖键组成同一集合，因此 fusion 包是唯一的组合所有者，这些依赖都不会再作为 profile 组合包应用。

去重选择 `@liustack/modlens` 作为图像理解实现，选择 `dsh-better-sidebar` 作为右侧工作台。patch 不包含 `@linxin666/dsh-web-ui-all`、两个 describe-image 配置项、已弃用的 AionUI panel 配置项、`@linxin666/dsh-skins` 和全部 Liangshen 运行时配置项；它只挂载已独立验证的 settings、task-board、Git graph、remote-Web、SSH、pet 和 skin-center 包。

安装脚本审批仅覆盖所选依赖闭包中存在的脚本。`cloudflared`、`cpu-features` 和 `ssh2` 为 remote-Web 与 SSH 包获批。`node-pty@1.2.0-beta.15` 仍是核心 subprocess 后端依赖，`node-pty@1.1.0` 则单独为 `dsh-better-sidebar@0.13.1` 闭包获批；策略不包含无版本限定的 `node-pty` 审批。

TUI 保持为 `dsh-base` 之上的独立 profile 组合包，因为它替换核心配置项并持有终端启动。Desktop 保持为外部 Electron 宿主，选择支持 Web 的 profile 后再应用自己的 shell patch；fusion 既不嵌入也不禁用 Desktop 生命周期配置项。Liangshen system preset 属于另一项决策，本组合包既不安装也不同步它。

## Alternatives considered

**使用 `@linxin666/dsh-web-ui-all`。** 否决，因为它会安装并挂载未选择的功能，重复选定的图像与 sidebar 实现，并固定不同的 sidebar 依赖。在安装聚合包后再禁用配置项，仍会保留更大的依赖闭包和两个组合所有者。

**把每个外部包列为 profile 组合包。** 否决，因为每个依赖会在 fusion 的精选配置项之外再次应用自己的 patch。单一 fusion patch 使配置项 id、顺序、排除项和精确依赖可以一起审查。

**给 fusion 添加运行时粘合逻辑。** 否决，因为选定插件已经持有自己的 Host 和 Client 行为。协调代码会在没有 patch 格式无法表达的行为时新增第二个运行时 API。

**把 Web、TUI、Desktop 和 Liangshen 合并到一个组合包。** 否决，因为它们的启动机制和所有权不同：TUI 替换终端组合，Desktop 在选择 profile 后提供 Electron shell，Liangshen 是 preset 内容而不是保留的 Web 配置项。

## Consequences

fusion 包只有一项小职责：发布精确依赖集合及其对应的 Cordis 配置项。版本变更必须一起更新依赖与配置项证据，并重新执行安装、Loader 和浏览器验证。

依赖闭包只能运行明确获批的生命周期脚本。新的传递脚本或 `node-pty` 版本会使安装失败，直到它经过审查并以最窄的适用包选择器加入策略。

Web 组合获得选定的外部功能，同时不包含重复的图像、面板、skin carrier、sidebar 或 Liangshen 配置项。TUI 与 Desktop 保持独立的集成和发布验证，单独的 Liangshen 决策可以在不修改 fusion 组合包的情况下确立 preset 所有权。

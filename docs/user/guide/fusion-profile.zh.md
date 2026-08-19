# Fusion profile

[English](fusion-profile.md) | 中文

`fusion` profile 会在标准浏览器应用之上添加精选的外部 Web 插件集合。它要求使用 dsh `0.1.0-rc.7` 和 pnpm。

## 创建 profile

先安装 Web 应用层：

```sh
dsh plugin --profile fusion add @deepseek-ai/dsh-web-app@0.1.0-rc.7
```

该命令会创建 `$DSH_HOME/profiles/fusion/pnpm-workspace.yaml`。安装 Fusion 层之前，只在此文件中添加以下必要的生命周期脚本许可：

```yaml
allowBuilds:
  node-pty@1.1.0: true
  cloudflared: true
  cpu-features: true
  ssh2: true
```

安装 Fusion 层并启动 profile：

```sh
dsh plugin --profile fusion add @deepseek-ai/dsh-fusion@0.1.0-rc.7
dsh --profile fusion
```

## 验证 profile

`$DSH_HOME/profiles/fusion/package.json` 必须按以下顺序列出组合包层：

```json
[
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "@deepseek-ai/dsh-fusion"
]
```

打开 `dsh` 打印的 URL，并验证：

- 左侧保留标准会话侧边栏。
- 右侧工作台提供资源管理器、编辑器、终端和 Git 标签页。
- 任务看板、皮肤中心、宠物、ModLens、远程 Web、SSH 和贡献的 Web UI 设置均可用。
- Agent preset 选择器包含**梁神模式**；需要使用 Liangshen 的会话必须在启动前选中它。

该 profile 会固定九个 Fusion 运行时包的版本。升级 dsh 或任何 Fusion 包后，请重新创建并验证 profile。

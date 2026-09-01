# 桌面壳消费约定

[English](desktop-shell-contract.md) | 中文

Electron 桌面壳通过已发布的 NPM 包消费 DeepSeek Harness。桌面壳的 `dependencies` 和 lockfile 把 `@deepseek-ai/dsh` 与 `@deepseek-ai/dsh-fusion` 固定为同一个精确版本，例如 `0.1.0-rc.5`。版本范围、Git 依赖、workspace link、内嵌副本和 Git submodule 均不符合该约定。

## Profile 与服务

桌面壳持有一个名为 `fusion` 的内部 profile。其组合包按顺序为 `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 和 `@deepseek-ai/dsh-fusion`；[Fusion Web profile 指南](./fusion-profile.zh.md)定义当前仅含 Pet 的组合。

桌面壳使用 `--profile fusion` 启动已安装的 `dsh` 可执行文件，等待 HTTP 端点就绪，然后在应用窗口中加载该端点。桌面壳还负责随应用生命周期重启和关闭服务。

## 能力所有权

Remote Web UI 保持阻塞期间，Fusion 不提供移动端远程访问。桌面壳可以保留自身的远程实现，并持有该实现的生命周期；消费 Fusion 不要求桌面壳禁用或关闭该实现。

桌面壳负责原生窗口、系统托盘、自动启动服务、应用更新和插件市场。这些原生职责包装 fusion 服务，不重复实现其 Web UI 功能。

## 升级验证

升级时需要同时修改两个精确包版本，并保留精确 Pet profile 依赖。分发使用新 dsh 版本的桌面构建前，需要针对打包后的应用运行兼容矩阵：

- 通过桌面 lockfile 安装并解析两个 NPM 包；
- 组合 fusion profile 并启动服务；
- 应用窗口连接、重新加载、重启和关闭；
- 托盘控制与自动启动服务；
- 应用更新与插件市场流程；
- 桌面壳自有的远程实现在窗口重新加载、服务重启与应用关闭期间正确处理生命周期。

只有该精确 dsh 与 fusion 版本组合的每一项矩阵检查均通过时，桌面构建才可分发。本仓库提供 NPM 产物与 profile 约定；NPM 发布和外部 desktop 仓库变更属于独立发布操作。

# `@deepseek-ai/dsh-fusion`

[English](README.md) | 中文

fusion 组合包是位于 `dsh-web-app` 之上的纯 profile patch 层，用于承载精选的外部插件。它的 manifest（元数据清单）通过 `dsh.bundle.patch` 暴露 [`cordis.patch.yml`](cordis.patch.yml)，预期用在 `dsh-base` 与 `dsh-web-app` 层之后。根模块没有运行时 API。

该 patch 挂载 `@liustack/modlens@3.21.1`、`dsh-better-sidebar@0.13.1` 和七个 `0.2.2` Web UI 包：`@linxin666/dsh-client-ui-web-ui-settings`、`@linxin666/dsh-client-ui-task-board`、`@linxin666/dsh-client-ui-git-graph`、`@linxin666/dsh-remote-web-ui`、`@linxin666/dsh-ssh`、`@linxin666/dsh-pet` 与 `@linxin666/dsh-client-ui-skin-center`。这些运行时依赖都使用精确版本。

该组合不包含 `@linxin666/dsh-web-ui-all`、`@linxin666/dsh-tool-describe-image`、`@linxin666/dsh-client-ui-aionui-panel`、`@linxin666/dsh-skins` 和 `@linxin666/dsh-liangshen` 运行时配置项。

## 模型体验

模型体验由间接挂载的插件提供，每个插件负责自身的模型可见行为。

#### KV Cache 影响

该 patch 自身不添加请求内容；各挂载插件负责自己的提示词、工具 schema、消息贡献及相应的缓存影响。

## 已知限制与暂缓事项

- **兼容性固定为 dsh `0.1.0-rc.7`**：更改 dsh 或任一外部依赖后，必须重新执行安装、启动与浏览器诊断。
- **该组合包依赖 Web 层**：其浏览器插件依赖 `dsh-web-app` 挂载的 Host 和客户端 roster。
- **Liangshen 位于该组合包之外**：该组合既不安装也不同步 Liangshen preset。

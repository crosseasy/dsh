# `@deepseek-ai/dsh-fusion`

[English](README.md) | 中文

fusion profile 在 [`dsh-base`](../base/README.md) 与 [`dsh-web-app`](../web-app/README.md) 之后应用的静态 patch 层。目前没有外部包满足全部准入判据，因此 [`cordis.patch.yml`](cordis.patch.yml) 为空，manifest（元数据清单）的 `dsh.bundle.profileDependencies` 也是 `{}`。该包保留 ESM 入口、patch 导出和 invariant companion，但没有运行时 API 或第三方运行时依赖。

仓库验收使用显式命令，不属于默认测试收集：`pnpm run test:fusion:acceptance` 会构建 `base -> web-app -> fusion` 并通过系统 Chrome CDP `9333` 启动。该门禁验证 Fusion 不会增加任何外部 Host 配置行、浏览器入口、客户端资源、UI root、路由或工具，同时 stock Web 界面保持可见，console、页面、网络、进程、端口、target 与临时目录清理均无异常。

## 模型体验

间接影响为无：空 patch 不插入任何配置行，也不增加模型可见输入或工具。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- **该组合包不是内置 profile 模板**：使用方需要显式组合 `base`、`web-app` 与 `fusion`。当前 profile dependency map 为空，不需要外部包、React peer provider 或 profile 局部构建许可。
- **该组合包提供零条外部配置行**：图像理解、SSH、移动端远程 UI、Task Board、Pet、Git Graph、Skin Center，以及右侧 Files、editor、terminal 和 Source Control 工作台均不存在。使用方不得通过增加候选包或 patch 配置行绕过准入。拥有该决策的 [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) 定义零行决策、各包的具体阻塞原因与重验要求。
- **桌面集成是一项消费约定**：该包不会修改或交付外部 Electron 应用。

# `@deepseek-ai/dsh-fusion`

[English](README.md) | 中文

fusion profile 在 [`dsh-base`](../base/README.md) 与 [`dsh-web-app`](../web-app/README.md) 之后应用的静态 patch 层。[`cordis.patch.yml`](cordis.patch.yml) 从精确 `0.2.9` 包挂载 Pet；manifest（元数据清单）的 `dsh.bundle.profileDependencies` 记录该 profile 持有的依赖，不会把第三方运行时依赖加入本 bundle。

仓库验收使用显式命令，不属于默认测试收集：`pnpm run test:fusion:acceptance` 会构建 `base -> web-app -> fusion` 并通过系统 Chrome CDP `9333` 启动。该门禁验证精确 Pet 配置行、Pet 能力界面、阻塞包缺失、stock Web 行为、干净诊断，以及进程、端口、target 与临时目录清理。

## 模型体验

间接，通过插入的 Pet 配置行：它增加浏览器和 Host 路由，但不增加模型可见工具或提示词。

#### KV Cache 影响

无。

## 已知限制与暂缓事项

- **该组合包不是内置 profile 模板**：使用方需要显式组合 `base`、`web-app` 与 `fusion`，然后安装产品指南记录的精确 profile 依赖和 React peer。
- **只有 Pet 已准入**：Git Graph `0.2.9` 因活跃 JSON 操作及其子进程可越过配置行 fiber dispose 而被阻塞。图像理解、SSH、移动端远程 UI、Task Board、Skin Center，以及右侧 Files、editor、终端和 Source Control 工作台也仍不存在。使用方不得通过增加其他候选包或 patch 配置行绕过准入。拥有该决策的 [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) 定义已接受集合、各包的具体阻塞原因与重验要求。
- **桌面集成是一项消费约定**：该包不会修改或交付外部 Electron 应用。

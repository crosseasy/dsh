---
description: "fusion profile 组合包：在 base 与 Web 应用组合包之后加入已准入的 Pet 外部集成，供用户组合或校验 fusion profile。"
kind: "package-bundle"
---

# @deepseek-ai/dsh-fusion

[English](README.md) | 中文

## 概述

`dsh-fusion` 是自定义 fusion profile 使用的静态 profile 组合包：它在 [`dsh-base`](../base/README.zh.md) 与 [`dsh-web-app`](../web-app/README.zh.md) 之后应用，并插入已准入的 Pet 集成。用户在 profile 已经包含 base 与 Web 层之后，通过常规 `dsh plugin --profile` 组合包流程添加或移除它。本包在 `dsh.bundle.profileDependencies` 中记录 `@linxin666/dsh-pet@0.2.9`；它不会把 Pet 作为本组合包的 runtime 依赖。本包不是库，也不交付外部 Electron 应用。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

仅在已经组合 base 与 Web 应用组合包的 fusion profile 中使用本包。它能激活，是因为 manifest 声明了 `dsh.bundle.patch`；没有该声明的普通插件即使作为依赖安装，也不会贡献 profile 层。

### 安装到 profile

```text
dsh plugin --profile <name> add @deepseek-ai/dsh-fusion
dsh plugin --profile <name> remove @deepseek-ai/dsh-fusion
```

profile 还必须在 Loader 解析 patch 行之前，让 `@linxin666/dsh-pet@0.2.9` 作为 profile 持有的依赖可用。manifest 记录该依赖用于 profile 校验，但不会把第三方 runtime 依赖加入 `dsh-fusion` 自身。

### 你得到什么

该层从已接受的 `@linxin666/dsh-pet` 包插入一个 `pet` 行。Pet 包拥有自己的浏览器与 Host route；本组合包只拥有已准入的行、精确的外部包版本，以及被阻塞 fusion 候选不在其中这一事实。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节 - 点击展开</summary>

本组合包是一份只有一个 insert 条目的静态 patch 文档。它本身不挂载服务、不发出事件，也不携带可变运行时状态。

### Patch 文档

[`cordis.patch.yml`](cordis.patch.yml) 插入 `{ id: 'pet', name: '@linxin666/dsh-pet' }`。[`package.json`](package.json) 声明 patch 路径和 profile 持有的 Pet 依赖，同时让 `dependencies`、`optionalDependencies` 与 `peerDependencies` 不包含该外部 runtime 包。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 组合包 patch：已接受的 Pet 行 |
| [`src/index.ts`](src/index.ts) | 包入口；不携带运行时 API |
| [`src/invariant.ts`](src/invariant.ts) | 不变式伴生插件：无运行时不变式；本包是静态 patch 列表载体 |
| [`tests/fusion.spec.ts`](tests/fusion.spec.ts) | manifest、profile 依赖、Loader 与阻塞候选检查 |

### 准入归属

仓库验证遵循 [Fusion 外部 profile 验收](../../../docs/testing.zh.md#tiers)。拥有该决策的 [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.zh.md) 记录持久准入与重验要求。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [base 组合包](../base/README.zh.md) - 必须早于本层的共享 profile 核心。
- [web-app 组合包](../web-app/README.zh.md) - 必须早于本层的浏览器应用层。
- [Fusion 外部插件 Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.zh.md) - 已接受外部集合与被阻塞候选。
- [测试层级](../../../docs/testing.zh.md#tiers) - fusion 准入使用的验证层级词汇。

-----

<a id="model-experience"></a>
## 模型体验

间接，通过插入的 Pet 行：它增加浏览器和 Host route，但不增加模型可见工具或提示词。

#### KV Cache 影响

无。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制描述当前 fusion 组合包。它们不是其他外部包的准入路径。

- **该组合包不是内置 profile 模板** - 使用方需要显式组合 `base`、`web-app` 与 `fusion`，再提供 manifest 记录的精确 profile 依赖。
- **只有 Pet 已准入** - Git Graph `0.2.9` 因活跃 JSON 操作及其子进程可越过配置行 fiber dispose 而被阻塞。图像理解、SSH、移动端远程 UI、Task Board、Skin Center，以及右侧 Files、editor、终端和 Source Control 工作台也仍不存在。
- **桌面集成是一项消费约定** - 该包不会修改或交付外部 Electron 应用。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文 - 点击展开</summary>

无。

</details>

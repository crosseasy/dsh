---
description: "用于治理第三方 profile 准入的精选插件策略、profile、benchmark 与命令包。"
kind: "package-group"
---

# Curated Packages

[English](README.md) | 中文

## 概述

`packages/curated/` 是精选插件层的包组容器。跨包约定见 [curated 子系统页面](../../docs/subsystems/curated.zh.md)。

## 目录

- [包](#packages)
- [治理边界](#governance-boundary)
- [Profile 分层](#profile-tiers)
- [模型体验](#model-experience)
- [已知限制与暂缓事项](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

<a id="packages"></a>
## 包

- `curated-base`：定义基础精选组合包，把精选策略和评测资产服务插入 profile。
- `curated-policy`：持有精选层的插件策略数据与策略行为。
- `curated-profiles`：持有精选 profile 模板，并把所选 profile 写入 DSH home，同时不改动已交付 profile。
- `curated-scripts`：提供源树内的 `verify-lock`、`preflight`、`smoke-profile` 和 `compare-benchmark` 命令，用于精选门禁。
- `curated-bench`：提供只读精选清单、任务集、基线、A/B 记录和回滚快照。

这五个包都是 DSH 发布族的公开成员。`@deepseek-ai/dsh` 会安装 `curated-base` 与 `curated-profiles`；发布顺序会先发布策略和评测资产，再发布其消费方，最后在 `dsh` 及其他运行时依赖之后发布面向用户的 curated 命令包。

<a id="governance-boundary"></a>
## 治理边界

curated 组是组合与准入层。它不修改 `packages/core/agent-loop`、会话协议格式（wire format），也不修改已交付的 `web` 和 `headless` profile 模板。第三方候选以固定 audit 事实和 profile 组合包名称记录；本仓库不会 vendor 其源码，也不会在精选准入检查期间执行其安装生命周期脚本。

<a id="profile-tiers"></a>
## Profile 分层

`web-curated` 的目标基线包含 12 个候选。Web 搜索、memento、MCP 面板、检查点回退、LSP 操作和 LoongSuite 遥测是静态/安装资格候选，但都没有基于其固定产物的 keyless assembled runnable snapshot，因此 runtime active 数为 0。Web 搜索还缺少必需的 `@anweat/dsh-browser` bundle/runtime dependency。其余 6 个目标候选保留各自的产物、兼容性或安全拒绝。

五个 profile 都只包含三个安装自有基础 bundle，并写入 `ignore-scripts=true`。六个资格候选保留其确切 npm 或 Git identity、源码内容摘要、安装目录摘要与 runtime 依赖闭包摘要，但不进入可启动模板。精选 workspace 不授予任何第三方构建权限，也不允许依赖 patch 变换。

没有第三方候选 active 时，profile 物化写入空 patch。候选专属安全设置继续作为后续准入的 catalog 证据；精选层不会用 profile override 补偿不安全的产物。

被拒绝与 fallback 候选仍以 audit 证据保留在 allowlist 中，并且不进入 active profile 模板。Inactive 池覆盖冲突策略和 A/B 资产中命名的搜索、记忆、MCP、浏览器、上下文、费用、导入/编辑、复核、通知和桌面替代项；`dsh-llm-fallbacks` 与 `dsh-feishu` 在其记录的拒绝理由解决前保持 inactive。

<a id="model-experience"></a>
## 模型体验

### Curated 包组

#### 模型看到的内容

包组本身不注册提示词文本、工具 schema、用户消息、助手可见结果或会话事件；模型可见行为归所选第一方包或已安装第三方组合包所有。

#### Token 影响

`packages/curated/` 本身没有直接 token 成本。

#### KV Cache 影响

没有直接 cache 影响；任何注册提示词段或工具的 profile 组合包都拥有自身的 cache 稳定性。

## 已知限制与暂缓事项

<a id="known-limitations-and-deferred-work"></a>

- **受管 profile 准入**：启动器在启动或配置 dump 前强制检查精选模板、manifest、包管理器和用户层组合。四个受管 profile 文件必须是普通文件；全部文件都在读取或写入其中任何文件之前接受检查，缺失文件使用排他创建。已有精选 `.npmrc` 必须与生成的 `ignore-scripts=true` 文件完全一致，精选 manifest 不得包含 `pnpm` 字段。Observed 校验还要求受管 profile，将两份 lockfile 与 catalog 持有的每个 runtime 闭包摘要比较、拒绝经过 patch 的包状态并哈希直接候选目录。它不会检测同时保持两份 lockfile 不变而对传递依赖文件所做的任意安装后改写。独立产物根目录仍只校验 metadata。
- **不随附第三方源码**：精选 profile 会命名第三方组合包，但本仓库不会 vendor 它们，也不会在没有 profile 安装步骤时让它们可用。
- **外部证据仍待取得**：每个 selected active candidate（包括声明必需 runtime bundle 的 consumer）都必须自行持有 `runtimeActivationEvidence`，其 key 与 `targetProfiles` 精确一致；每个 profile 值都把真实固定产物的 keyless assembled snapshot 以及安装、启用、重启、禁用或卸载记录绑定到该 map key、签入路径和 SHA-256，并包含每个声明的 runtime bundle。Catalog policy 失败时，仓库文档与 DSH release 门禁会在读取 evidence 前仅返回已脱敏的 policy diagnostics；否则会解析每个 profile 的记录，将其绑定到候选、map key、当前 profile 组合摘要、产物 identity、操作和成功 observed 命令结果，要求并重放 Git tracked candidate/profile/operation snapshot 命令，遮蔽 candidate、profile 与 path 标识中的 key/value secret、Authorization 值和带 scheme URL userinfo，拒绝 record 或 artifact argv 中包括 URL userinfo 与 secret query 参数在内的 secret 且不回显参数，并通过有界稳定 descriptor 读取校验每个独立引用产物。含 `authorization` 的普通 candidate ID 与 snapshot path 仍然合法。每份 keyless assembled 记录还会证明 waterfall 委托，并确认重复 token 注入或外部请求均为 0。E3/E4、Chrome 浏览器回归、搜索、记忆、MCP、A/B 工作负载、故障注入与 canary 均为 pending。

<a id="dev-note"></a>
## 开发备注

无。

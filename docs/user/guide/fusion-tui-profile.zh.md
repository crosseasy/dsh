# Fusion TUI profile 交付状态

[English](fusion-tui-profile.md) | 中文

Fusion TUI 公开交付处于**阶段 2 BLOCKED**。选定的终端界面是 `@deepseek-harness-tui/dsh-tui@0.7.1`，但目前没有受支持的公开命令能在 `@deepseek-ai/dsh@0.1.0-rc.5` 上组装其完整依赖图。

## 选定组件

- TUI `0.7.1` 是保持单一 Liangshen 所有者并通过源码验证运行时检查的最高已发布版本。
- 仓库随附的 `liangshen` preset 以 `@linxin666/dsh-liangshen@0.2.4` 为来源，继续作为 Web 与 TUI 唯一的 Liangshen 所有者。
- host profile 持有 worker-thread code 运行时；Liangshen 仍是其 preset 消费方。
- 不选择 TUI `0.7.2` 及更高版本，因为它们会打包并同步另一份 Liangshen preset。最新审计的 `0.8.7` 与 `0.8.8` 各自包含 8 个 Liangshen 文件，且没有受支持的 opt-out。

## 当前发布证据

TUI 系列共有 19 个发布版本。`2026-08-21T02:11:00Z` 截止后的两个版本是 `0.8.7` 与 `0.8.8`。两个精确产物均通过身份、完整性和 MIT 许可证检查，各自声明 24 个不接受 rc.5 的 DSH peer，包含 0 个根与 15 个打包内 `workspace:*` 值，并主动同步其打包的 Liangshen 副本。

两个候选都在安装前因单一 Liangshen 所有权与公开 rc.5 闭包失败。因此它们的 profile 组合、全新／恢复 PTY、UI、消息往返、回放、退出与清理检查均为 `NOT RUN`，而不是运行时 PASS 或 FAIL。

## 运行时证据与公开交付

源码验证使用完整的 41 包 rc.5 Harness 闭包运行了 TUI `0.7.1`。终端渲染、消息与工具往返、持久恢复、受支持退出和进程清理均通过。这证明选定 TUI 可以在该精确的源码构建闭包上运行。

该结果不提供公开安装来源。历史公开安装尝试在其直接查询的子集中发现 23 个缺失的 rc.5 包。新的查询覆盖历史源码验证闭包的全部 41 个包，其中 0/41 提供精确 rc.5；这不表示其余 18 个包在历史上可用。通过注册表安装 TUI `0.7.1` 无法重建已验证闭包，可能直接失败，也可能解析出 rc.6/rc.8 混合 Harness 依赖图。此类依赖图不是已接受的 Fusion TUI 安装。

因此，本指南不提供创建、添加、验证或启动命令。仅源码验证属于技术运行时证据，不是受支持的公开组装路径。

## 已知风险

TUI `0.7.1` 声明 rc.6 Harness 基线，因此纯 rc.5 依赖图会产生 upstream-drift warning。该依赖图还把 React 唯一解析到 `19.2.8`，而 `dsh-working-activity@0.2.6` 声明 React `^18.2.0`。这些不匹配没有阻止已验证运行时路径完成，但仍是重新验证风险。

版本 `0.7.1` 本身不含 `workspace:*` 依赖值，也不打包 Liangshen。`0.8.7` 与 `0.8.8` 的根 `workspace:*` 计数为 0，但这不能解除其 15 个打包内值、第二个 Liangshen 所有者或公开闭包缺失造成的阻塞。

## 解除交付阻塞

公开交付只有在满足以下任一条件后才能继续：

1. 所有所需 Harness 包都具有公开可获取的一致 rc.5 闭包。
2. Fusion TUI 明确批准新的 Harness 基线。

任一变更都必须完整重验精确安装、实际解析的 lock、单一 Liangshen 所有权、终端行为、持久恢复、受支持退出、清理和公开文档命令，然后本指南才能提供组装步骤。

版本选择、所有权规则和重新验证条件见 [Fusion 外部插件所有权](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md)。

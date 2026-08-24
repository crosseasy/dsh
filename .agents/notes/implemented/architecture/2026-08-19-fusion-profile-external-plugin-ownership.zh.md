# Agent Note: Fusion profile 外部插件所有权

Status: implemented

[English](2026-08-19-fusion-profile-external-plugin-ownership.md) | 中文

## 问题

Fusion 组合了与 DeepSeek Harness 独立发布的包。声明的 peer 范围可能落后或领先于 Harness 版本，而仅凭安装或成功启动，不能证明目标能力可用、授权正确、资源已释放或重挂没有重复。

如果把外部包放进 Fusion 组合包的标准依赖区，安装所有权会转移到仓库或 Harness 发行版。聚合包还可能重新引入重复的工具、工作台、远程访问或 Liangshen preset，使能力所有权和复现安装所需的 profile 输入变得不明确。

## 决策

Fusion 按以下顺序评估 Web 候选：产物身份与完整性、许可证身份、安全、单一所有者要求、依赖闭包、精确隔离安装、profile 组合、实际启动、目标能力与诊断、完整资源所有权与完全停稳的资源释放，最后是断连重挂。TUI 候选依次检查产物身份与完整性、许可证身份、单一 Liangshen 所有权、安全、受支持的公开依赖闭包、精确隔离安装、profile 组合和 PTY 运行时。首个失败会阻塞候选，后续检查全部保持 `NOT RUN`。peer 范围不匹配会记录为漂移，但解析出的 lock 不得把 DSH 提升到已批准 Harness 基线之上。兼容 shim 与核心包修改不能豁免外部包失败。

`@deepseek-ai/dsh-fusion` 不在标准依赖区携带第三方包。其 `dsh.bundle.profileDependencies` 包含精确 `@linxin666/dsh-pet@0.2.9`，patch 只增加 `pet` 配置行。每个组装后的 profile 持有自己的 manifest（元数据清单）、锁文件、pnpm workspace 设置、peer provider 和构建许可。Web 顺序为 `@deepseek-ai/dsh-base` -> `@deepseek-ai/dsh-web-app` -> `@deepseek-ai/dsh-fusion`；Fusion 不是 `PROFILE_TEMPLATES` 条目，因此由用户显式组装。

Pet 准入要求精确 API GET route `state`、`pets` 与 `diagnostics`，以及 asset、runtime 与 decoration handler 家族全部执行服务端授权。非 loopback 的未配对与已撤销请求会在访问 Pet 服务或资产前返回 403，已配对与 loopback 请求允许通过。配置行 fiber dispose（资源释放）后，全部已注册 route 都会移除；在同一 Context 上重挂不会产生重复 route。

仓库 preset 继续作为 Web 与 TUI 的唯一 Liangshen 所有者。TUI 源码验证运行时与可公开安装的 TUI profile 是两个独立结论：所需依赖闭包无法从公开来源获得，或候选会安装第二个 Liangshen 所有者时，源码运行结果不能建立公开交付。本决策不会恢复由 [TUI 包决策](../simplification/2026-08-04-remove-tui-package.md)移除的第一方包。

本决策细化了 [profile 插件组合包](2026-08-05-profile-plugin-bundles.md)的安装和排序模型，并使用了[移除 repository 插件路径](../simplification/2026-08-09-remove-repository-plugin.md)后保留的外部插件分发路径。

## 能力所有权

- **Pet：** 精确 `0.2.9` 是唯一准入的外部 Web 能力；只有许可证、授权、生命周期、profile 与组合运行时检查持续通过时才保持准入。
- **Git Graph `0.2.9`：** 首个稳定失败是活跃 JSON 操作及其 Git 子进程在配置行 fiber dispose 后继续存活。重新准入要求配置行 dispose 拒绝新操作，在有界期限内取消并等待全部活跃 JSON／SSE（Server-Sent Events）操作及其完整进程树，再通过进行中卸载与同 Context 重挂检查。
- **ModLens `3.24.0`：** 首个稳定失败是跨站 `POST /modlens/paste` 接受被 `/modlens/config` 拒绝的请求，并写入所提供的字节。重新准入要求每条修改状态的 route 执行适用的请求信任策略，且每个 route disposer 都属于插件 fiber。
- **SSH `0.2.9`：** 首个稳定失败是已接受的独立终端会话不属于插件 dispose。重新准入要求 dispose 关闭并等待每个已接受的 WebSocket、SSH client、channel 与 shell 会话。
- **Remote Web UI `0.2.9`：** 首个稳定失败是 `requirePairingForLan:false` 会对 `/remote` HTTP 与 WebSocket handler 禁用实时授权。重新准入要求实时设备授权不可关闭，且插件 dispose 会关闭 stream、进程、subscription 与 root。
- **Task Board `0.2.9`：** 首个稳定失败是客户端丢弃顶层 settings subscription disposer。重新准入要求一个已发布产物同时具备一致许可证身份、完整 effect/disposer 所有权、同页卸载与重挂行为，以及目标 Harness 运行时支持。
- **Skin Center `0.2.9`：** 首个稳定失败是 manifest 与包内 LICENSE 身份不一致。重新准入要求发布产物的许可证身份一致，且其 Settings 控件在目标 Harness 版本中可见。
- **Better Sidebar `0.15.2`：** 首个稳定失败是缺少受支持的公共 rc.5 依赖闭包。重新准入要求受支持的公共闭包和包自有不可变策略；该策略必须阻止模型终端工具注册，同时保留设置持久化与 UI Terminal 行为。

聚合 Web UI 配置行、Describe Image、AionUI Panel 与其他未选择身份不会作为回退进入 Fusion。

TUI `0.7.1` 的源码验证只证明受测的源码构建 rc.5 运行时；没有受支持的公开来源能够重建该闭包，因此不能建立公开交付。当前已审计 TUI 候选 `0.9.0` 的首个失败是单一 Liangshen 所有权，因为它会安装第二个所有者且没有受支持的 opt-out；安全、公开闭包、安装、组合与 PTY 均保持 `NOT RUN`。公开重新准入要求唯一 Liangshen 所有者、适用于已批准 Harness 基线的受支持公开闭包、精确安装与 lock 检查、全新与恢复真实 PTY 消息往返、持久事件、受支持退出、进程清理和已验证公开命令。

## 验证层级

- 包与配置检查固定精确 Pet `0.2.9`、唯一 `pet` 配置行、标准依赖区中不存在 Pet、`base -> web-app -> fusion` 顺序、profile 局部安装输入，以及全部七个阻塞项和重复所有者均不存在。
- 直接检查通过 profile 所安装 Pet `lib/index.js` 的真实 `apply` 导出加载该包。检查覆盖已注册 route 集合；精确 `state`、`pets` 与 `diagnostics` GET route 和 asset、runtime 与 decoration GET handler 家族的四种授权状态；以及 `interact`、`set-visible`、`set-config`、`set-name` 和 `set-pet` 五条修改状态的 POST route。非 loopback 未配对与已撤销请求必须在服务访问、资产访问或修改前返回 403；已配对与 loopback 请求必须触达 handler。
- 配置行 fiber dispose 会移除每条 route；在同一 Context 重挂后再 dispose，不会留下重复或遗留 route。
- 私有副本变异分别删除 API-state guard、`pets` guard、`diagnostics` guard、asset guard、共享 POST guard 和 route disposer。每项变异都必须通过真实注册路径失败；只能修改完整的私有包副本，并且安装入口 hash 在成功、失败或取消后都必须保持不变。
- 组合验收使用系统 Google Chrome CDP `9333` 启动精确单行 profile，验证唯一 Pet 浏览器 entry 与 root 及其实时状态，确认阻塞配置行与外部模型工具均不存在，执行分层 baseline 与根响应 oracle，并要求 console、page、network、进程、端口、target 和临时目录清理干净。默认单测与覆盖率测试保持离线。
- 在每个 profile 内，每个 blocked `GET` 响应的状态、body 原始字节及规范化有序 header multimap 必须与该 profile 自身的 `GET /` 相等；该 multimap 只排除每次请求产生的连接与传输字段 `connection`、`content-length`、`date`、`keep-alive` 和 `transfer-encoding`。每个非 fallback 响应必须在独立启动的 `base + web-app` 与 Fusion profile 之间保持相等。
- 每个根响应必须各有且仅有一个可解析的 `window.__DSH_BOOT__` 赋值。baseline 不含 Pet entry，Fusion 精确增加一个合法 Pet entry，每侧 graph revision 都由该 graph 的完整、有序 entries 计算。从 Fusion 删除 Pet entry 并按剩余完整、有序 entries 重算 revision 后，完整 Fusion HTML 必须与 baseline 原始字节相等。额外 client entry、共享 entry 字段或顺序漂移、错误 graph revision、boot script 外 body 差异，以及 mounted JSON、redirect、含 stock title 的 route-owned HTML、404 或 405 控制响应都必须使检查失败。

## 覆盖与缺口

- 必需的 checked-in acceptance 覆盖单行组合、Pet 授权与生命周期、响应 oracle、浏览器诊断与清理、完整的对话、工具卡片、会话列表、fork、resume、compact、export、Search、Settings 与模型选择工作流、全新 Web 和 headless profile 隔离、真实 headless 轮次、构建产物 ACP（Agent Client Protocol） stdio，以及解析后的 ACP Loader 组合。该覆盖使用 tracked 输入，不依赖被忽略的本地 driver。
- Web 证据不能建立 TUI 行为。
- 首个失败停止规则会有意保留每个阻塞候选的后续检查不执行；`NOT RUN` 不代表通过。
- 当前证据只适用于受测版本、平台和路径，不能建立通用跨平台兼容性。

## 重新验证

Harness 版本、外部产物或 tarball、声明的 peer 基线、解析出的 React 或原生依赖图、Fusion 配置行、profile 构建许可或 Liangshen 所有者发生任何变化时，都要从产物身份重新开始验证。Pet 必须重新运行完整 Pet 与组合 Web 验证约定。阻塞能力必须先满足其具名重新准入条件，再执行全部剩余准入阶段。输入发生变化后，不得沿用任何历史结果。

## 曾考虑的替代方案

**在 Fusion 组合包依赖区声明第三方包。** 不予采纳，因为安装、lock、peer provider 与原生构建许可应由选择它们的 profile 持有，仓库根消费方不应得到未使用的外部依赖树。

**把 Fusion 或 Fusion TUI 加入 `PROFILE_TEMPLATES`。** 不予采纳，因为内置模板由安装本体持有并会自动初始化。Fusion 要求显式审查精确外部输入，而 TUI 没有可复现的公开包闭包。

**挂载聚合 Web UI 组合包或保留重复回退。** 不予采纳，因为聚合配置行会重新引入阻塞或竞争的能力所有者，使选择和生命周期顺序成为可观察行为。

**以声明的 peer 范围作为兼容性结论。** 不予采纳，因为预发布 peer 声明既不能证明也不能否定固定 Harness 基线上的实际行为。

**为外部版本增加组合包 shim 或修改核心包。** 不予采纳，因为这会把外部授权或生命周期所有权转移到仓库，并掩盖包自身缺陷。

**发布使用混合 Harness 依赖图的 TUI 操作步骤。** 不予采纳，因为解析后续候选版本包不能复现已验证的 rc.5 源码运行时。

## 后果

Fusion Web 提供一项明确的外部能力，不会把第三方依赖树或原生构建许可加入仓库根。用户必须一起保留 profile manifest、锁文件、workspace 设置、peer 与批准配置。

阻塞能力会保持缺失，直到已发布候选满足完整准入顺序。重验成本包括许可证、安全、生命周期、安装，以及真实 Web 或 TUI 执行；所得证据只适用于受测版本、平台和路径。

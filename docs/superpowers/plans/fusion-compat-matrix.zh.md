# Fusion 兼容矩阵

[English](fusion-compat-matrix.md) | 中文

状态：**TASK_42_STATIC_RUNTIME_PASS_FINAL_PACKAGE_REVIEW_PENDING**

检查截至：无缓存注册表响应窗口结束于 `2026-08-23T11:18:55Z`；当前工作树静态与系统 Chrome 运行时证据截至 `2026-08-23T14:18:03Z`

基线：`@deepseek-ai/dsh@0.1.0-rc.5`、macOS arm64、Node.js `v24.14.0`、仓库 pnpm `11.7.0`、隔离 profile pnpm `11.18.0`。

## 证据所有权

本 tracked 矩阵记录带日期的包计数与候选停止点。[tracked 回归记录](fusion-regression-report.md)持有当前工作树的静态与运行时证据，包括 tracked built acceptance，以及仅存在于本地的支持性运行所对应的可复现性分类。较早被忽略或仅存在于本机的工作产物不是 clean-checkout 证据 owner。

结束于 `2026-08-23T11:18:55Z` 的无缓存新鲜度采集使用未受版本控制的本地脚本和响应文件。下列带日期计数仅保留为不可复现的候选历史，不能建立当前验收。

## 有序准入

本记录使用四个独立结果级别：

- `PASS`：命名操作成功运行。
- `FAIL`：命名操作运行后失败，或与 rc.5 要求矛盾。
- `NOT RUN`：更早的必需检查失败或该身份未被选择，因此没有对应证据。
- `BLOCKED`：更早的必需检查阻止兼容性或公开交付。

Web 包检查按以下顺序运行：产物身份与完整性、许可证身份、安全、单一所有者要求、依赖闭包、精确隔离安装、profile 组合、实际启动、目标能力与诊断、具备完全停稳 dispose 的完整资源所有权，以及断连重挂。TUI 包检查顺序为产物身份与完整性、许可证身份、单一 Liangshen 所有权、安全、公共依赖闭包、精确隔离安装、profile 组合与 PTY 运行时。首个失败会停止该候选；后续检查保持 `NOT RUN`。

## 当前结果矩阵

| 包或分组 | 精确候选 | 首个失败检查或已接受证据 | 下游结果 | 当前决定 |
| --- | --- | --- | --- | --- |
| Fusion Web 组合 | Pet `0.2.9` | 包准入通过；当前 tracked built acceptance 通过 1/1；fresh local-only driver 在系统 Chrome `151.0.7922.172` 上使用 CDP `9333` 连续两次取得 39/39，其 oracle 通过 50/50 | clean checkout 无法获得 local-only harness 输入，相关结果不能替代 tracked acceptance；最终 package 与独立复审仍待完成 | **已选择** |
| `@linxin666/dsh-pet` | `0.2.9` | 精确身份、完整性、Apache-2.0 许可证身份、服务端授权、客户端生命周期与隔离运行时通过 | 任何输入变化后从产物身份开始重验 | **已接受** |
| `@linxin666/dsh-client-ui-git-graph` | 最近审计 `0.2.9` | 活跃 JSON 操作与 Git 子进程越过配置行 fiber dispose | 新候选运行时 `NOT RUN` | **BLOCKED** |
| `@liustack/modlens` | 最近审计 `3.24.0` | 跨站 `POST /modlens/paste` 通过 `/modlens/config` 会拒绝的请求并写入所提供字节 | 生命周期、启动、能力与 Chrome `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-ssh` | 最近审计 `0.2.9` | 活跃独立终端会话不属于插件 dispose | 生命周期失败后的安装与运行时 `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-remote-web-ui` | 最近审计 `0.2.9` | `requirePairingForLan:false` 使 `/remote` HTTP 与 WebSocket handler 绕过实时授权 | 生命周期与运行时 `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-client-ui-task-board` | 最近审计 `0.2.9` | 客户端丢弃顶层 settings subscription disposer | 所有权、运行时与重挂 `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-client-ui-skin-center` | 最近审计 `0.2.9` | manifest 与包内 LICENSE 身份冲突 | 后续检查 `NOT RUN` | **BLOCKED** |
| `dsh-better-sidebar` | 最近审计 `0.15.2` | 公共 rc.5 闭包失败：14 个必需 DSH peer 中有 0 个精确 rc.5 | 安全、生命周期、安装、组合、启动与 Chrome `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-liangshen` 来源 | 保留 `0.2.4`；拒绝 `0.2.8`／`0.2.9` | 后续来源保留不受约束的 Windows shell 路径；仓库 preset 保持唯一所有者 | 候选运行时 `NOT RUN` | **保留 `0.2.4`** |
| `@deepseek-harness-tui/dsh-tui` | 源码运行时 `0.7.1`；拒绝最新 `0.9.0` | `0.9.0` 打包第二个 Liangshen 所有者且无受支持 opt-out | 安全、闭包、安装、组合与 PTY `NOT RUN` | **公开交付 BLOCKED** |

Fusion Web patch 与 profile dependency map 只包含精确 Pet `0.2.9`。其余 7 个影响决策的 Web 能力保持未挂载。Fusion TUI 公开交付保持阶段 2 `BLOCKED`。

## TUI `0.9.0` 新鲜度结果

Task 40 对 `@deepseek-harness-tui/dsh-tui` 的本地无缓存响应完成于 `2026-08-23T11:18:55Z`。它报告 20 个可安装版本，并确认精确 `0.9.0` 是上次截止时间 `2026-08-21T23:28:19.483Z` 后的唯一候选；其发布时间为 `2026-08-23T05:35:34.508Z`。响应、tarball 与复算脚本未受版本控制，因此这些计数是不可复现的历史背景，而不是当前验收证据。

本地采集记录的产物身份、完整性、路径安全与 MIT 许可证身份均通过。由于对应源产物与命令无法从 clean checkout 重建，精确 hash 与条目计数已删除。

单一 Liangshen 所有权是 TUI 包族的首个失败项。本地 tarball 检查记录了 8 个 Liangshen 文件、会写入 Harness 用户 preset 根目录的 packaged-preset installer，且没有受支持 opt-out。该失败后的安全、公共 rc.5 闭包、隔离安装、profile 组合以及全新／恢复 PTY 往返、退出与清理检查均为 `NOT RUN`。没有为 `0.9.0` 运行 PTY 检查。

## 当前 Web Oracle

Checked-in REAL lane 在冻结安装前只从 fixture（测试前置数据）复制 `cordis.patch.yml`、`package.json`、`pnpm-lock.yaml` 与 `pnpm-workspace.yaml`。源 fixture 中被忽略的 `node_modules` 不会进入目标 profile。

每个 HTTP 快照包含状态、从 Node HTTP(S) raw header pair 构造且仅排除 `connection`、`content-length`、`date`、`keep-alive` 与 `transfer-encoding` 的规范化有序 multimap，以及 body 原始字节。这些字段是每次请求的连接或传输 framing 数据；body 字节另行比较。每个 profile 内的 blocked `GET` 都与该 profile 自身的 `GET /` 相等。独立启动的 baseline 与 Fusion profile 之间，每个非 fallback 响应保持相等。Pet-only 根响应比较在原始 `Buffer` 中定位唯一已解码 boot assignment，删除 Pet 并重算 revision 后只替换该 payload 字节区间，再将全部结果字节与 baseline 比较。

CI EXIT trap 在完成 Chrome 进程组与 profile 清理时保留失败的 acceptance 状态。Command timeout、调用方取消与 readiness 取消只在完整进程树停止后结算。私有包变异会独立报告 callback、目录删除与安装入口 hash 失败，并在 `AggregateError` 中保留顺序。

## 历史检查点

| 检查点 | 带日期的输入 | 记录结果 | 当前含义 |
| --- | --- | --- | --- |
| 早期 sidebar/TUI 注册表扫描 | Sidebar `2026-08-19T19:07:10Z`；TUI `2026-08-19T19:09:18.503Z` | Sidebar 12 个 manifest 与 TUI 16 个版本均无 peer 兼容 rc.5 的候选 | 仅为历史 metadata |
| 截止后审计 | 按系列截至 `2026-08-21T23:30:28.583Z` | ModLens `3.23.1`、Web UI `0.2.6`／`0.2.7`、Better Sidebar `0.15.0`、TUI `0.8.7`／`0.8.8` 均在已记录强制检查停止 | 适用时由后续候选取代 |
| Web UI `0.2.8`／`0.2.9` | 截至 `2026-08-22T12:37:33.085Z` | Pet 与 Git Graph 通过当时执行的检查 | Git Graph 后来因活跃操作生命周期被阻塞 |
| Better Sidebar `0.15.2` | HTTP 截止时间 `2026-08-22T17:01:07Z` | 产物／许可证通过；公共 rc.5 闭包 0/14 | 后续检查 `NOT RUN` |
| Task 35 Pet-only 运行时 | 截至 `2026-08-23T05:16:28Z` | Built acceptance 可从 tracked tree `a5e6deb6f9fbf17d31e8a593722cb0063969549a` 复现；其他本地结果不可复现 | 仅作历史背景 |

历史零行、两行、三行、四行与六行运行时结果只保留为其精确组合的测量记录。它们不能豁免后续安全、生命周期、所有权、许可证或闭包失败。

## 重新验证

Harness 版本、外部版本或 tarball、peer 基线、解析出的 React 或原生依赖图、patch 配置行、profile 构建许可或 Liangshen 所有者变化时，都要从产物身份开始重验。Web 重验包含精确安装、配置 dump、启动、同 Context 卸载／重挂、开放资源 dispose、完整系统 Chrome CDP `9333` oracle 与干净诊断。TUI 公开交付还要求唯一 Liangshen 所有者、受支持的公开依赖闭包、精确安装与 lock 检查、全新与恢复真实 PTY 消息往返、持久事件、受支持退出和进程清理。

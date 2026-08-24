# Fusion 回归报告

[English](fusion-regression-report.md) | 中文

日期：2026-08-23

状态：`TASK_41_REVIEW_COMPLETE_TASK_42_REOPENED_TASK_43_PENDING`

## 当前范围

Fusion Web 选择唯一外部配置行，即精确 `@linxin666/dsh-pet@0.2.9`。Git Graph、ModLens、SSH、Remote Web UI、Task Board、Skin Center 与 Better Sidebar 保持未挂载的 blocker。Fusion TUI 公开交付保持阶段 2 `BLOCKED`。

Task 39 冻结了 `HEAD=a5e6deb6f9fbf17d31e8a593722cb0063969549a`、空 index，以及相对已验证 Fusion 基线的 44 个产品/支持路径。该历史范围由 43 个产品路径与 `.gitignore` 组成；`.gitignore` 持有排除执行产物的支持策略。纳入 `docs/user/guide/fusion-tui-profile.*` 三联后，当前范围为 47 个路径，旧 package 与复审已失效。Task 41 独立复审已完成；Task 42 最终复审因 Task 43 findings 重开验收。最终复验、47 路径 package、独立复审与交付 bookkeeping 仍待完成。

## Task 42 验证证据

最终复审重开验收前，Task 42 新鲜 focused suite 的 6 个文件通过 200/200 项测试。`pnpm run typecheck`、`pnpm run build`、零错误 `pnpm run lint`、`pnpm run hygiene`、28/28 门禁通过的 `pnpm run doc-sync`、46/46 项测试通过的 `pnpm run docs:check`、工作树与 index diff checks、受保护产品范围检查以及空 index 检查均以 `0` 退出。由于当时已审查改动未触达 TUI、共享 preset、core、session、subprocess 或 terminal 产品路径，TUI 为 `NOT RUN (not affected)`。这些结果不能替代 Task 43.6 最终复验。

## Tracked 运行时证据

Task 42 正式运行时证据是通过 tracked 命令和 tracked 源码路径调用的 Pet-only built acceptance。Task 42 工作树源码与 fixture（测试前置数据） lock 由各自内容 hash 标识。

| 证据 | UTC 时间 | 命令 | 输入标识 | 记录结果 |
| --- | --- | --- | --- | --- |
| Built acceptance | `2026-08-23T13:55:49Z` 至 `2026-08-23T13:56:02Z` | `DSH_SNAPSHOT=replay pnpm run test:fusion:acceptance:built` | `HEAD=a5e6deb6f9fbf17d31e8a593722cb0063969549a`；Task 42 `apps/web/tests/fusion-real-composition.acceptance.ts` SHA-256 `2c55d78201c17e66c3e66507b407449b9d576f7267dcb25988163379973f48e8`；Task 42 `apps/web/tests/fixtures/fusion-profile/pnpm-lock.yaml` SHA-256 `fd49d8cd89abe36dd8caa05bbb71b144c74bbc178387f3958c8ef847ff215000` | 退出码 `0`；1/1 |

Task 42 完整 driver 与 oracle 提供本地支持性证据。被忽略的 harness 命令 `sh .superpowers/sdd/ralph-round6-task34-web/run-driver.sh` 连续两次通过 39/39，时间分别为 `2026-08-23T14:16:36Z` 至 `2026-08-23T14:17:04Z` 和 `2026-08-23T14:17:16Z` 至 `2026-08-23T14:17:37Z`。`TASK34_PHASE=task42-compact-fix node --import tsx .superpowers/sdd/ralph-round6-task34-web/driver-oracles.test.mts` 在 `2026-08-23T14:18:02Z` 至 `2026-08-23T14:18:03Z` 通过 50/50。由于 `.superpowers/` 被忽略，clean checkout 无法获得这些 harness 输入；其结果不能替代 tracked built acceptance 或 Task 43.6 最终复验。

首次系统 Chrome driver 运行先通过 26 项断言，随后遇到 `/compact` 同步竞态：UI summary 已可见，`compaction/end` 比匹配的成功 `command/done` 早 6ms，因此 driver 单次读取 history 的时机过早。本地 driver 现复用自身有界条件等待，反复读取新鲜 history，直到已知 compact command id 同时具有成功 `command/done` 与 `compaction/end`，再应用未修改的生命周期断言。该修复没有增加固定 sleep，修复后的上述两轮连续 39/39 均通过。

两轮连续运行的 console、page、HTTP 与 slot error 计数均为 `0`。每轮仅有两个预期的 export `HEAD` network failure：请求先收到 HTTP 200，随后出现 `net::ERR_ABORTED`，并与 export ledger 匹配。清理后没有遗留 server target、listener、process、process-group descendant、服务或 mock provider 端口、临时目录或 cleanup error。

## Tracked 复审与范围元数据

Task 34 V2 package 及其复审输入仅存在于本地。由于 clean checkout 无法重建该 package，其 hash 与 verdict 计数均已删除；该复审不能建立当前 47 路径结果。

Task 39 冻结记录源 `108b96a10a34941d93ad99b35c3a1f2cee16a9e2`、目标 `a5e6deb6f9fbf17d31e8a593722cb0063969549a` 与历史 44 路径范围。其本地 manifest 和 patch 构造没有作为可复现命令受版本控制，因此相关 hash 已删除。新增 TUI 指南三联与 Task 43 findings 已使旧 package 和结论失效；Task 43.6 持有最终 47 路径 package 与复审。

## 历史结果

下列历史阶段的本地命令与完整输入未受版本控制。其详细计数已删除，且均不构成当前验收证据：

| 阶段 | 外部配置行 | 记录结果 | 当前含义 |
| --- | --- | --- | --- |
| 六行 Web | ModLens、Task Board、SSH、Remote Web UI、Pet、Git Graph | 仅本地成功记录 | 已被 Pet 与 Git Graph 授权 finding 取代 |
| 四行 Web | ModLens、Task Board、SSH、Remote Web UI | 仅本地成功记录 | 已被 Task Board 生命周期取代 |
| 三行 Web | ModLens、SSH、Remote Web UI | 仅本地成功记录 | 已被各包生命周期 finding 取代 |
| 零行 Web | 无 | 仅本地成功记录 | 已被后续 Pet 准入取代 |
| 两行 Web | Pet 与 Git Graph `0.2.9` | 仅本地成功记录 | 已被 Git Graph 活跃操作生命周期取代 |
| 单行 Web | Pet `0.2.9` | Task 42 tracked built acceptance 通过 1/1；被忽略的本地 driver 与 oracle 仅为支持性证据 | Task 43.6 最终 47 路径 package 与独立复审待完成 |

## 当前验收约定

- 共享 profile setup 只复制 4 个 tracked fixture 文件，拒绝安装前出现 `node_modules`，执行冻结安装，并核验 Pet `0.2.9` manifest 与解析出的入口。
- HTTP 快照比较状态、从 Node HTTP(S) raw header pair 构造的规范化完整 multimap 与 body 原始字节。明确排除每次请求产生的连接与传输 framing headers；Pet 根页面规范化只替换捕获 `Buffer` 中已定位的 boot payload 字节。
- Command timeout、调用方取消与 readiness 取消只在完整进程树于 cleanup 预算内停止后结算。
- CI EXIT trap 保留非零 acceptance 状态，同时终止并等待 Chrome 进程组并删除 profile。
- 私有包变异分别结算 callback、目录删除与安装入口完整性检查；单项失败原样抛出，多项失败形成有序 `AggregateError`。

## TUI

源码验证 `dsh-tui@0.7.1` 在其 41 包 rc.5 源码闭包下继续作为历史 PASS 证据。公开包系列截至无缓存响应截止时间 `2026-08-23T11:18:55Z` 有 20 个可安装版本。精确 `0.9.0` 发布于 `2026-08-23T05:35:34.508Z`，通过产物与许可证检查，随后因打包 8 个 Liangshen 文件且没有受支持 opt-out 而在单一 Liangshen 所有权检查失败。该首个失败后的安全、公共闭包、隔离安装、profile 组合与 PTY 检查均为 `NOT RUN`。Task 42 将 TUI 记录为 `NOT RUN (not affected)`。

## 剩余验收

Task 41 独立复审已完成。Task 42 最终复审因 Task 43 findings 重开验收。最终复验、47 路径 package、bits、DSH、安全、文档与 plan/design/spec/checklist 独立复审，以及交付 bookkeeping 留待 Task 43.6。

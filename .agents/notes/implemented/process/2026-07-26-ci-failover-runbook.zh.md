# Agent Note: CI 故障切换手册 — 托管池 → 自有池

Status: implemented

[English](2026-07-26-ci-failover-runbook.md) | 中文

## 问题

必需的拉取请求检查依赖托管 Linux 与 Windows 运行器池。池故障可能使必需作业无限排队，因此无法通过合并工作流修复来恢复。

故障切换必须保持作业隔离与平台边界。尤其是 Fusion 验收独占系统 Google Chrome CDP `9333`，不得与普通工作作业共享自托管 Linux 运行器。

## 决策

两个独立仓库变量控制故障切换。`DSH_CI_FAILOVER_LINUX=selfhosted` 只把三个必需 Linux 工作作业 `node-24`、`node-24-coverage`、`node-24-consumers`，以及 `all-checks-passed` 判定作业重定向到 `vm-backup` 池。`DSH_CI_FAILOVER_WINDOWS=selfhosted` 只把 `windows-native` 重定向到 `dsh-win-ci` 池。一个平台的故障不会重定向另一个平台，每个开关都是写者可管理的仓库状态而非一次合并。

`all-checks-passed.needs` 的精确集合是 `node-24`、`node-24-coverage`、`node-24-consumers`、`fusion-acceptance`、`node-compat`、`python-sdk`、`python-runtime` 与 `windows`。`windows-native` 和热备作业明确不属于该必需聚合。判定作业使用 Linux 选择器，因此发生故障的企业 Linux 池不会在已重定向工作作业完成后继续阻塞该记账作业。

`fusion-acceptance` 始终独立运行在标准 `ubuntu-latest` 上；Linux 故障切换变量永不重定向它。该作业安装并构建隔离 profile，独占系统 Chrome CDP `9333`，并自行负责进程组与 profile 清理。更广泛的标准托管池故障仍可阻塞 Fusion 验收与其他标准托管依赖，而不会将它们静默转移到故障切换池。

`ci-master.yml` 只豁免一个事件不做取消（`${{ github.event_name != 'push' }}`），因此一次 master 推送不会取消上一次推送留下的、仍在运行的演练。每次演练以单门禁工作进程执行完整的未分片聚合流程，耗时长于 master 合并的间隔；在无条件取消下，演练会在得出结论前被后续运行取代，该通道无法产出供响应者查看的就绪证据。

这项豁免比「演练总能跑完」要窄，有两点限制。其一，GitHub 每个组只保留一个待运行条目，更新的待运行条目会顶掉更早的，繁忙时段中间的推送运行仍会以 `cancelled` 结束。其二，该表达式是针对**新触发的运行**求值的，因此自身事件不是 `push` 的运行——例如在 `ci-master.yml` 内的 master 上派发的基准测试，与其演练共用 `CI master-<ref>` 组——求值为 `true`，会取消正在运行中的演练。这属于罕见的手动操作，且下一次 master 推送即可恢复证据，因此不值得为它再加机制。这项豁免换来的是该通道**周期性**地得出结论，而这正是它能作为证据的前提。

这个决定必须放在工作流级：取消作用于被取代的整个运行，作业级 `concurrency` 组并不能豁免其所属作业。采用否定式写法而非仅指名 `pull_request`，是有实质作用的：后者会连 `workflow_dispatch` 一起停止取消，而每次运行器基准测试会在 master 上的同一并发组内同时占用 12 台大规格运行器、最长 15 分钟，届时重复派发会排在演练之前，而不是替换掉已过时的测量。成本之所以可控，是因为 `ci-master.yml` 中一次 master 推送只承载 `wine-apt-cache` 和这两条演练；拉取请求作业位于独立的 `ci.yml`（不监听 `push`），而基准测试在 `ci-master.yml` 内受 `workflow_dispatch` 门控。`scripts/ci-workflow.spec.ts` 会锁定这个推送可达集合——按条件精确匹配，因为否定式事件判断会包含它所排除的事件名——使新的推送可达作业无法悄悄开始累积未取消的运行。

## 作业隔离与预算

- 托管路径保持主路径。自托管 Linux 与 Windows 通道是热备路径，只由对应仓库变量选择。
- Linux 故障切换期间，每个运行器的 coverage 最多使用 8 个 worker，snapshot 最多执行 12 个并发操作；托管路径的 pnpm cache 恢复会跳过，因为持久池持有自身包存储。
- Fusion 在 10 分钟 Vitest 验收外设置 15 分钟 GitHub 作业上限。operation 截止时间为 540 秒，为 setup 与报告留出余量。
- 一个 30 秒 cleanup 截止时间覆盖 pending acquisition 结算、反向 dispose（资源释放）、最终 cleanup 与 operation 结算。到期后会使用已取消 signal 启动每个剩余已取得资源的 disposer、报告未结算工作并返回失败，且不延长该截止时间。
- Fusion launcher 在启动前拒绝已占用的 CDP 端口，并且只有 Chrome 进程仍存活且端口 `9333` 的每个 listener 都属于该进程组时才继续。

## 启用约定

只有对应热备通道为绿色时才能启用故障切换。`serial / linux (self-hosted standby)` 验证 `vm-backup` 上的聚合流程与 Linux 浏览器先决条件；`serial / windows (self-hosted standby)` 验证 `dsh-win-ci` 上的 `check:ci:windows-complete`，以及必需的 Node、pnpm、Git Bash、PowerShell 与符号链接支持。

设置 `DSH_CI_FAILOVER_LINUX=selfhosted` 或 `DSH_CI_FAILOVER_WINDOWS=selfhosted` 只影响变量变更后创建的 workflow run。已排队作业保留其解析出的运行器标签，因此启用故障切换必须启动新的 workflow run。

删除相应变量或将其设为 `selfhosted` 以外的值，会让后续 workflow run 切回托管路径。故障结束后必须启动新的 run，并移除临时增加的运行器实例。

## 信任边界

1. 仓库 **Settings → Secrets and variables → Actions → Variables → New repository variable**：名称 `DSH_CI_FAILOVER_LINUX`（Linux 池故障）或 `DSH_CI_FAILOVER_WINDOWS`（Windows 池故障），值 `selfhosted`。
2. 重新触发必需作业，使其重新解析运行器池。已经为托管标签**排队**的作业不会重定向，也无法原地 re-run，因此对于本手册所述的无限排队故障，应取消卡住的运行并 re-run all jobs，或推送一个新提交；“Re-run failed jobs”只有在作业真正失败（而非仍在排队）时才有用。
3. 切换到此完成。Linux 故障切换状态下，工作流还会把 `DSH_SNAPSHOT_MAX_CONCURRENCY` 降为 12，以限制共享虚拟机上的争抢，并跳过托管路径的 pnpm 缓存恢复，因为虚拟机的持久 store 会直接提供热安装。覆盖率在两个 Linux 池上都使用 4 个单 worker 插桩分区与 2 个豁免 worker。Windows 开关没有并发或缓存分支；它只重定向原生 Windows 作业的运行器池。

两个选择器都排除 `dependabot[bot]`；故障切换期间，依赖项提供的代码继续等待托管容量。仓库变量由具备写权限的协作者管理，拉取请求事件不能设置它们。自托管 runner group 接受这个私有、禁 fork 仓库的工作流，使拉取请求 merge ref 可以执行；因此信任边界是仓库成员资格。把 runner group 限制为默认分支工作流与拉取请求故障切换不兼容。

master 推送的热备通道会运行自有池，但不成为必需判定依赖。工作流级 concurrency 不会在另一次推送到达时取消正在运行的 master 推送演练，因此热备路径可以周期性产生完整就绪结果。

## 曾考虑的替代方案

**通过合并工作流改动来切换池。** 不予采纳，因为不可用的必需检查会阻塞该合并。仓库变量无需修改工作流即可改变路由。

**让自托管池长期处于必需路径。** 不予采纳，因为这会用自有池可用性替代托管池可用性，而不是保留独立验证的回退。

**让 Fusion 验收随 Linux 故障切换重定向。** 不予采纳，因为 Fusion 要求隔离的系统 Chrome 与独占 CDP `9333`；共享持久 Linux 池会把浏览器状态和清理与无关作业耦合。

## 后果

具备写权限的协作者可以通过修改一个仓库变量并重新运行 CI 来恢复一个故障平台，关键路径上不需要合并。Linux 与 Windows 故障保持独立，Fusion 验收和可移植必需作业继续运行在标准托管运行器上。

仓库需要为每个平台维护第二套运行器拓扑、master 推送热备证据、Linux 专属并发与 cache 分支，以及自托管拉取请求执行所依赖的仓库成员信任假设。

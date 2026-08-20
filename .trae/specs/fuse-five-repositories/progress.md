## Round 2

- 完成证据：`@liustack/modlens@3.21.1` 的隔离安装、profile layer、实际 Web boot 和 Chrome CDP `9333` 验证全部 PASS；web-ui retained direct `0.1.20` 集合在精确 `react@18.3.1`、`react-dom@18.3.1` peer provider 与 `cloudflared@0.7.3`、`cpu-features@0.0.10`、`ssh2@1.17.0` 三项精确 `allowBuilds` 下完成安装、layer、boot、资源、去重和 clean console 验证。
- 阻塞：`dsh-better-sidebar` 在 `2026-08-19T12:31:56Z` 的 registry 检查中没有接受 rc.5 的发布版本；`@deepseek-harness-tui/dsh-tui` 在 `2026-08-19 12:32-12:34 UTC` 的检查中同样没有 rc.5 候选，且最新三版仍发布七项 `workspace:*` 运行时范围。全融合保持 `BLOCKED`。
- 关键决定：采用 retained direct web-ui 集合作为已验证方案并保留 remote-web-ui；`@linxin666/dsh-web-ui-all@0.1.20` 仅作备用，因为它包含重复的 AionUI panel 与 describe-image rows，且本轮没有 aggregate CDP 接受证据。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/tasks.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 3

- 本轮复查：sidebar registry 检查截至 `2026-08-19T13:07:49Z`，仍为原 11 个 rc.6/rc.7-only 发布版本；TUI registry 检查于 `2026-08-19T13:10:04Z` 完成，仍为原 14 个版本，重新检查的 `0.8.3` tarball 继续暴露七项 `workspace:*` 运行时范围。
- 同一阻塞：sidebar 与 TUI 均无接受 rc.5 的精确发布版本，TUI manifest 另有 `workspace:*` 缺陷；两者的隔离安装、profile、实际 boot 和交互均未运行，全融合保持 `BLOCKED`，未满足的 tasks/checklist 项保持未勾选。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 4

- 本轮复查：sidebar registry 检查截至 `2026-08-19T13:24:23Z`，11 个现有 tarball 均通过 SHA-1、SHA-512 完整性和内嵌 manifest 对比，但 peer 范围仍只接受 rc.6 或 rc.7；TUI registry 检查于 `2026-08-19T13:22:51Z` 完成，`0.8.3` tarball 再次确认 23 个 rc.7 DSH peers 和七项 `workspace:*` 运行时范围。
- 同一外部阻塞与关键结论：Task 0A 仍未完成，因为 sidebar 与 TUI 均无接受 rc.5 的可消费精确发布版本；因此未运行两者的隔离安装、profile、实际 boot 和交互，全融合保持 `BLOCKED`，未完成的 tasks/checklist 项保持未勾选。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 5

- 本轮新鲜复查：sidebar 截至 `2026-08-19T13:38:05Z` 仍为 11 个 rc.6/rc.7-only 版本，11/11 tarball 校验通过；TUI 于 `2026-08-19T13:34:49Z` 至 `13:36:45Z` 复查，仍为 14 个版本，`0.8.3` tarball 完整性与发布内容再次匹配。
- 同一外部阻塞：sidebar 与 TUI 仍无接受 rc.5 的发布版本，TUI 仍含七项 `@dsh-std` runtime `workspace:*` 依赖，未运行 install、boot、CDP 或 TUI 交互。
- 因此 Task 0A 与后续任务仍未满足，本轮不伪造任何完成状态。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 6

- 本轮核验：sidebar 于 `2026-08-19T13:57:02Z` 至 `13:58:27Z` 检查，仍为 11 个版本且 `latest: 0.13.1`，新鲜 `0.13.1` tarball 完整性与结构正常；TUI 于 `2026-08-19T13:59:13Z` 检查，仍为 14 个版本且 `latest: 0.8.3`，新鲜 `0.8.3` tarball 完整性匹配并有 22 处 `workspace:*` 命中。
- 同一阻塞：sidebar 与 TUI 仍无接受 rc.5 的精确发布版本，TUI `0.8.3` 根 manifest 仍有七项 runtime `workspace:*`；因此 install、boot、CDP 和 TUI 交互均为 `NOT RUN`，全融合保持 `BLOCKED`。
- 决定与理由：Task 0A 和后续任务保持未完成且不勾选，因为 rc.6/rc.7-only peer 范围仍拒绝基线 rc.5，现有发布物不能建立兼容证据。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 7

- 本轮新鲜复查：sidebar 于 `2026-08-19T14:09:05.199Z` 检查，仍为 11 个版本且 `latest: 0.13.1`，registry 版本集合与修改时间均未变化；TUI 于 `2026-08-19T14:07:41Z` 检查，仍为 14 个版本且 `latest: 0.8.3`，新鲜 tarball 的 SHA-1、SHA-512 与发布内容匹配。
- 同一外部阻塞：sidebar 与 TUI 仍无接受 rc.5 的精确发布版本，TUI `0.8.3` 仍有七项根 runtime `workspace:*` 和全 tarball 22 项 runtime `workspace:*`；因此未运行 install、boot、CDP 或 TUI 交互，全融合保持 `BLOCKED`。
- 关键决定：Task 0A 与后续任务保持未完成，`tasks.md` 和 `checklist.md` 不作修改；没有候选发布物时不越过 metadata 检查伪造 runtime 证据。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

- 截止修正（同属 Round 7）：TUI `0.8.4` 于初次记录截止后发布，但其 23 个 DSH peers 仍拒绝 rc.5，根 manifest 七项和全 tarball 22 项 runtime `workspace:*` 泄漏仍使 install、profile、boot 与 terminal 验证保持 `NOT RUN`/`BLOCKED`；兼容矩阵最终截止时间更新为 `2026-08-19T14:17:04Z`。

## Round 8

- 本轮新鲜复查：sidebar 截至 `2026-08-19T14:28:15.546Z` 仍为 11 个版本且 `latest: 0.13.1`，版本集合和 registry 修改时间均未变化；TUI 截至 `2026-08-19T14:31:55Z` 仍为 15 个版本且 `latest: 0.8.4`，新鲜 tarball 的 SHA-1、SHA-512 和发布内容匹配。
- 同一外部阻塞：sidebar 与 TUI 仍无接受 rc.5 的精确发布版本，TUI `0.8.4` 仍有七项根 runtime `workspace:*` 和全 tarball 22 项 runtime `workspace:*`；因此未运行 install、boot、CDP 或 TUI 交互，全融合保持 `BLOCKED`。
- 关键决定：Task 0A 与后续任务保持未完成，`tasks.md` 和 `checklist.md` 不作修改；只刷新 metadata 与 tarball 证据，不把未运行的 runtime 检查记为通过。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 9

- 完成/证据：sidebar 新鲜 registry `MISS` 截至 `2026-08-19T14:49:35Z`；TUI 使用唯一 nonce 与 no-cache 请求取得无 `Age` 的 registry `MISS`，建立并通过复审的最新 cutoff 为 `2026-08-19T15:02:42Z`。
- 发现或修复的问题：首次 TUI `HIT` cutoff 证据被复审拒绝，改用 nonce+no-cache `MISS` 修复并通过复审；sidebar 与 TUI 仍无 rc.5 候选，TUI `0.8.4` 仍有七项根和全 tarball 22 项 runtime `workspace:*` 泄漏。
- 关键决定与理由：全融合保持 `BLOCKED`，sidebar/TUI runtime gates 保持 `NOT RUN`，Task 0A 与后续任务保持未完成，`tasks.md` 和 `checklist.md` 不作修改；外部 linked worktree 状态不归因本轮且未触碰。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 10

- 完成/证据：sidebar fresh registry `MISS` 且无 `Age`，截止 `2026-08-19T15:27:02Z`，仍为 11 个版本且 `latest: 0.13.1`；TUI fresh registry `MISS` 且无 `Age`，截止 `2026-08-19T15:27:06Z`，仍为 15 个版本且 `latest: 0.8.4`；补充证据经独立复审为 PASS。
- 发现或修复：首次复审发现出站请求头证据和 TUI cutoff 证据存在缺陷；补充原始请求 trace、禁缓存请求头及 fresh registry cutoff 后复审 PASS。sidebar 与 TUI 的 peer 仍拒绝 rc.5，TUI `0.8.4` 仍有七项根 runtime `workspace:*` 和全 tarball 22 项 `workspace:*`。
- 关键决定：Task 0A 与全融合继续 `BLOCKED`，sidebar/TUI runtime 检查保持 `NOT RUN`，不修改 `tasks.md` 或 `checklist.md`，不改变 modlens 与 retained direct web-ui 的既有 PASS 结论。
- 文件变更：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 11

- 完成/证据：证据复审 PASS（无 Critical、Important 或 Minor），状态复审 PASS；sidebar fresh cutoff 为 `2026-08-19T15:41:01Z`，仍为 11 个版本且 0/165 DSH peers 接受 rc.5；TUI fresh cutoff 为 `2026-08-19T15:42:11Z`，仍为 15 个版本且 0/146 DSH peers 接受 rc.5，已审计最新发布版本 `0.8.4` 的 tarball 完整性 PASS。
- 发现/修复：状态复审的唯一 Minor 已修复，结果矩阵中的 TUI `Exact candidate` 从 `0.8.4` 改为 `none`；同一外部阻塞继续，sidebar 和 TUI 在 Round 10 后均无新增发布，TUI `0.8.4` 仍有七项根 runtime `workspace:*` 和全包 22 项 runtime `workspace:*`。
- 关键决定/理由：Task 0A 与全融合继续 `BLOCKED`，不修改 `tasks.md` 或 `checklist.md`，不改变 modlens 与 retained direct web-ui 的既有 PASS 结论；sidebar 的 install/profile/boot/CDP 与 TUI 的 install/profile/boot/terminal 均为 `NOT RUN`，因为没有接受 rc.5 的精确候选。
- 文件变更：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 12

- 完成/证据：证据修复验证 PASS，修复后独立复审对证据完整性与阻塞结论均判定 PASS；sidebar fresh cutoff 为 `2026-08-19T16:19:56Z`，仍为 11 个版本且 0/165 DSH peers 接受 rc.5；TUI fresh cutoff 为 `2026-08-19T16:19:57Z`，仍为 15 个版本且 0/146 DSH peers 接受 rc.5。两组证据各有 16/16 结构化断言 PASS 和 31/31 checksum PASS。
- 发现/修复：修复后的请求 trace、nonce、no-cache headers、响应、分析、断言、仓库快照和 checksum 补全了证据链；复审为 0 Critical、0 Important、3 Minor，分别是 `curl.command.txt` 的可重放性、after 快照覆盖的时间范围和旧 evidence pointer，均不影响两次 fresh 请求或持续阻塞结论。
- 关键决定/理由：全融合保持 `BLOCKED`，Task 0A 与后续 tasks/checklist 继续未完成且不作修改；sidebar 与 TUI 均无接受 rc.5 的候选，因此 sidebar install/profile/boot/CDP 和 TUI install/profile/boot/terminal runtime gates 均为 `NOT RUN`；modlens 与 retained direct web-ui 的既有 PASS 结论保持不变，TUI `0.8.4` 的 `workspace:*` 仅保留为 Round 11 历史 tarball 事实。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 13

- 完成/证据：独立复审确认 0 Critical、0 Important；sidebar fresh cutoff 为 `2026-08-19T16:38:37Z`，仍为 11 个可安装版本且 0/165 DSH peers 接受 rc.5；TUI fresh cutoff 为 `2026-08-19T16:38:29Z`，仍为 15 个可安装版本且 0/146 DSH peers 接受 rc.5。当前 `0.8.4` 的 SHA-1 与 SHA-512 发布指纹继续对应已校验 tarball 的七项根 runtime `workspace:*` 和全包 22 项 runtime `workspace:*`。
- 发现/问题：独立复审记录 2 个不改变结论的 Minor，均位于 sidebar 报告：精简 packument 的“精确命令”nonce 与原始证据不一致；`final-assertions.json` 未包含报告声称覆盖的 trace nonce/no-cache/pragma 和接受 peer 数，且未保存成功断言的命令或脚本。完整 packument nonce 与原始证据一致，原始 trace 和分析文件仍可独立证明结论，本轮不修改 `/tmp` 报告。
- 关键决定/理由：全融合继续 `BLOCKED`，Task 0A 与后续 tasks/checklist 保持未完成且不作修改；sidebar 与 TUI 均为 0 个 rc.5 候选，因此 sidebar tarball/install/profile/boot/CDP 与 TUI tarball/install/profile/boot/terminal runtime stages 均为 `NOT RUN`；modlens 与 retained direct web-ui 的既有 PASS 结论保持不变。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 14

- 完成/证据：独立证据复审 PASS，0 Critical、0 Important、0 Minor；sidebar fresh cutoff 为 `2026-08-19T17:02:26Z`，仍为 11 个可安装版本且 0/165 DSH peers 接受 rc.5；TUI 新增 `0.8.5` 后共有 16 个可安装版本且 0/169 DSH peers 接受 rc.5，`0.8.5` tarball 的 SHA-1、SHA-512 和根 manifest 身份均通过复核。
- 发现/问题：sidebar 与 TUI 仍均无 rc.5 候选；TUI `0.8.5` 根 manifest 仍有七项 runtime `workspace:*`，18 个包内 manifest 全包合计仍有 22 项 runtime `workspace:*`。
- 关键决定/理由：全融合继续 `BLOCKED`，Task 0A 与后续任务仍为 `BLOCKED`；sidebar 的 tarball/integrity/manifest/install/profile/boot/CDP 与 TUI 的 candidate install/profile/boot/terminal runtime gates 均为 `NOT RUN`，因为没有接受 rc.5 的精确候选；`tasks.md` 和 `checklist.md` 未修改，modlens 与 retained direct web-ui 的既有 PASS 结论保持不变。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 15

- 完成/证据：最终独立证据复审 PASS，0 Critical、0 Important、0 Minor；sidebar fresh cutoff 为 `2026-08-19T17:23:50Z`，仍为 11 个版本且 0/165 DSH peers 接受 rc.5；修复后的 TUI fresh cutoff 为 `2026-08-19T17:39:16Z`，仍为 16 个版本且 0/169 DSH peers 接受 rc.5，证据链 19/19 PASS、SHA-256 检查 35/35 PASS。
- 发现/修复：TUI fresh 采集无法从空目录重建完整证据链的 Important finding 已由自包含 collector 修复；`0.8.5` tarball 仍有根 manifest 七项、18 个包内 manifest 全包 22 项 runtime `workspace:*`，四项发布物断言均 FAIL（0/4 PASS），表示外部发布物不满足契约，不是审计工具失败。
- 关键决定/理由：全融合与 Task 0A 继续 `BLOCKED`，不修改 `tasks.md` 或 `checklist.md`；sidebar 的 tarball/integrity/manifest/install/profile/boot/CDP 与 TUI 的 isolated install/profile/actual boot/terminal UI/message round trip 均为 `NOT RUN`，因为没有接受 rc.5 且可消费的精确候选。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 16

- 完成/证据：sidebar 独立复审 PASS，0 Critical、0 Important、0 Minor；fresh cutoff 为 `2026-08-19T17:56:25Z`，仍为 11 个版本、`latest: 0.13.1`，且 0/165 DSH peers 接受 rc.5。TUI 独立复审 PASS，0 Critical、0 Important、0 Minor；fresh cutoff 为 `2026-08-19T17:54:29Z`，仍为 16 个版本、`latest: 0.8.5`，且 0/169 DSH peers 接受 rc.5。
- 发现/问题：sidebar 与 TUI 仍均无 rc.5 候选；TUI `0.8.5` 根 manifest 仍有七项 runtime `workspace:*`，18 个包内 manifest 全包仍有 22 项 runtime `workspace:*`。两项 latest tarball 静态审计均不建立 rc.5 兼容。
- 关键决定/理由：全融合与 Task 0A 继续 `BLOCKED`，不修改 `tasks.md` 或 `checklist.md`；sidebar install/profile/boot/CDP 与 TUI install/profile/boot/terminal 均保持 `NOT RUN`，因为没有接受 rc.5 的精确候选；modlens 与 retained direct web-ui 的既有 PASS 保持不变。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 17

- 完成/证据：fresh sidebar cutoff 为 `2026-08-19T18:11:37Z`，registry `modified: 2026-08-19T18:11:22.931Z`，共有 12 个版本、`latest: 0.14.0`，且 0/178 DSH peers 接受 rc.5；fresh TUI cutoff 为 `2026-08-19T18:11:46.587Z`，仍为 16 个版本、`latest: 0.8.5`，且 0/169 DSH peers 接受 rc.5。独立证据复审 PASS，0 Critical、0 Important、0 Minor；该审计 PASS 不表示外部包兼容 PASS。
- 发现/问题：sidebar 新增的 `0.14.0` 仍不接受 rc.5，其 13 个 DSH peers 全部要求 `^0.1.0-rc.8`；TUI 仍无兼容候选，精确 `0.8.5` tarball 仍有根 manifest 七项、18 个包内 manifest 全包 22 项 runtime `workspace:*`。
- 关键决定/理由：全融合与 Task 0A 继续 `BLOCKED`，后续任务保持未完成，`tasks.md` 和 `checklist.md` 不作修改；sidebar install/profile/boot/CDP 与 TUI install/profile/boot/terminal/message round trip runtime gates 均为 `NOT RUN`，因为候选列表为空；modlens 与 retained direct web-ui 的既有 PASS 保持不变。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 18

- 完成证据：sidebar fresh cutoff 为 `2026-08-19T18:28:10Z`，确认 12 个 installable version manifests、`latest: 0.14.0` 和 0/178 DSH peers 接受 rc.5；TUI fresh cutoff 为 `2026-08-19T18:28:50.290Z`，确认 16 个版本、`latest: 0.8.5` 和 0/169 DSH peers 接受 rc.5，精确 `0.8.5` tarball 的 SHA-1、SHA-512 SRI 与根 identity 校验通过。独立证据复核 PASS，0 Critical、0 Important、1 Minor。
- 问题/阻塞：sidebar 的 `time` 中存在无 manifest、无 dist-tag、不能作为候选的 time-only `0.12.0`，报告将 12 个可安装 manifest 泛称为 published versions 是唯一 Minor；sidebar 与 TUI 候选集合仍为空，TUI `0.8.5` 仍有根 manifest 7 项、18 个包内 manifest 合计 22 项 runtime `workspace:*`。
- 关键决定：全融合保持 `BLOCKED`，无候选对应的 sidebar tarball/install/profile/boot/CDP 与 TUI install/profile/boot/terminal/message round trip 保持 `NOT RUN`；矩阵使用 “12 installable version manifests” 并单列 time-only `0.12.0`，保留既有结果数字，不修改 `tasks.md`、`checklist.md` 或 `spec.md`。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 19

- 完成/证据：sidebar fresh cutoff 为 `2026-08-19T18:49:16Z`，确认 12 个 installable version manifests、`latest: 0.14.0` 和 0/178 DSH peers 接受 rc.5；TUI fresh cutoff 为 `2026-08-19T18:46:52.548Z`，确认 16 个版本、`latest: 0.8.5`、0/169 DSH peers 接受 rc.5，以及精确 `0.8.5` tarball 根 manifest 7 项、全部 18 个打包 manifest 合计 22 项 runtime `workspace:*`。独立证据复审为 `PASS_WITH_CONCERNS`，0 Critical、0 Important、2 Minor。
- 发现/问题：两个 Minor 均限于 sidebar 证据质量：报告将 gzip 压缩传输量标作 response body 大小，且 `SHA256SUMS` 未覆盖实际加载的精确 semver 工具；原始 registry 内容、独立候选重算和兼容结论不受影响，不能把证据审计 `PASS_WITH_CONCERNS` 记为兼容 PASS。
- 关键决定/理由：全融合与 Task 0A 保持 `BLOCKED`，不把 Minor 扩大为额外阻断；sidebar 的 candidate tarball/install/profile/boot/CDP/console 与 TUI 的 install/profile/boot/terminal/message round trip runtime checks 均保持 `NOT RUN`，因为两包候选集合仍为空；不修改 `spec.md`、`tasks.md` 或 `checklist.md`。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 20

- 完成/证据：sidebar fresh cutoff 为 `2026-08-19T19:07:10Z`，确认 12 个 installable version manifests、Round 19 cutoff 后 0 个新 manifest、`latest: 0.14.0` 和 0/178 DSH peers 接受 rc.5；TUI fresh cutoff 为 `2026-08-19T19:09:18.503Z`，确认 16 个版本、Round 19 cutoff 后 0 个新版本、`latest: 0.8.5` 和 0/169 DSH peers 接受 rc.5，fresh `0.8.5` tarball 仍有根 manifest 7 项、18 个打包 manifest 合计 22 项 runtime `workspace:*`。TUI 证据内部复核为 41/41 PASS；workspace audit 确认 Task 1-9 无实现文件且 tracked/staged tree 为空。
- 发现/问题：sidebar 与 TUI 的 rc.5 候选集合继续为空，TUI latest tarball 的可消费门继续 FAIL；TUI 的 41/41 PASS 只证明证据内部一致，不表示发布物兼容或运行态通过。Round 19 的独立 `PASS_WITH_CONCERNS` 仅作为历史审计事实保留，本轮不伪造独立复审结论。
- 关键决定/理由：全融合与 Task 0A 继续 `BLOCKED`；sidebar 的 candidate tarball/integrity/manifest/install/profile/boot/CDP/console 与 TUI 的 install/profile/profile manifest/boot/terminal/Liangshen/message round trip 均保持 `NOT RUN`，因为没有接受 rc.5 且可消费的精确候选；modlens 与 retained direct web-ui 的既有 PASS 保持不变，不修改 `spec.md`、`tasks.md` 或 `checklist.md`。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`。

## Round 21

- 完成/证据：fresh sidebar cutoff 为 `2026-08-20T02:40:36.996Z`，仍为 12 个 installable version manifests 且 0/178 DSH peers 接受 rc.5；fresh TUI cutoff 为 `2026-08-20T02:43:21Z`，仍为 16 个版本且 0/169 DSH peers 接受 rc.5。独立 Task 0 复审结论为 `APPROVED_BLOCKED`，0 Critical、0 Important、1 个不改变结论的 Minor。
- 运行时负控：`dsh-better-sidebar@0.14.0` 经 web-ui-all `0.2.4` 加载且 Chrome CDP console 干净，显式挂载的 `0.10.0` 也能加载；`dsh-tui@0.8.5` 在内层 PTY 中渲染顶栏、上下文与工具计数、模型状态和输入区，但先对 23 个 rc.5 包输出 rc.7 upstream-drift 警告。这些负控不能覆盖不满足的 peer 契约，均不构成兼容候选。
- 恢复与决定：误用新建补丁覆盖兼容矩阵后，已从 Trae 本地历史恢复 Round 20 原文并以 SHA-256 `087b5b161e6e37d23ec7c97f27ff4ba8c3c89d5600f54a9ee209dddb1af166e1` 验证，再定向追加本轮记录。Task 0A 与 Tasks 1-9 继续 `BLOCKED`，不修改 `spec.md`、`tasks.md` 或 `checklist.md`，不启动实现。
- 变更文件：`docs/superpowers/plans/fusion-compat-matrix.md`、`.trae/specs/fuse-five-repositories/progress.md`；实现文件、tracked tree 与 staged tree保持不变。

# Fusion 兼容矩阵

[English](fusion-compat-matrix.md) | 中文

状态：**DONE_WITH_CONCERNS**

检查截至：Task 31 新鲜 registry 响应窗口 `2026-08-23T00:56:11Z` 至 `2026-08-23T00:56:17Z`；Task 35 运行时证据截至 `2026-08-23T05:16:28Z`

基线：`@deepseek-ai/dsh@0.1.0-rc.5`、macOS arm64、Node.js `v24.14.0`。仓库 launcher 使用 pnpm `11.7.0`；隔离 profile 使用 pnpm `11.18.0`。Round 1 产物保留在 `/private/tmp/dsh-fusion-task0.X4pqGN`；Round 2 runtime 产物在 `/private/tmp/fusion-round2-webui-modlens.RAdgfl` 和 `/private/tmp/fusion-round2-*`；Round 3 发布报告在 `/tmp/fusion-round3-*`；Round 4 发布证据在 `/tmp/fuse-five-*-round4*`；Round 7 报告和 TUI 发布产物在 `/tmp/fusion-round7-*`；Round 8 报告在 `/tmp/dsh-fusion-round8-*-report.md`，TUI 产物在 `/tmp/dsh-fusion-round8-tui.fKKD9z/`；Round 9 报告在 `/tmp/fuse-five-repositories-round9-*.md`，新的 TUI registry 证据在 `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/`；Round 10 报告在 `/tmp/fuse-five-repositories-round10-*.md`，新的 registry 证据位于 evidence index 列出的目录；Round 11 报告为 `/tmp/fuse-five-repositories-round11-sidebar.md` 和 `/tmp/fuse-five-repositories-round11-tui.md`，证据在 `/tmp/fuse-five-repositories-round11-sidebar-evidence-ZHGfQ2/` 和 `/tmp/fuse-five-repositories-round11-tui-evidence-9906d414-9693-4265-b991-cf6f57874c3c/`；Round 12 更新后的报告为 `/tmp/fuse-five-repositories-round12-sidebar.md` 和 `/tmp/fuse-five-repositories-round12-tui.md`，修复后的证据在 `/tmp/fuse-five-repositories-round12-sidebar-evidence-fix-a9127c2b-77c2-40ca-b11d-359805d5f5cc/` 和 `/tmp/fuse-five-repositories-round12-tui-evidence-fix-348d5f9c-7068-42a6-a3b3-d9be6c2156e1/`，修复报告为 `/tmp/fuse-five-repositories-round12-evidence-fix.md`，复审报告为 `/tmp/fuse-five-repositories-round12-evidence-rereview.md`；Round 13 报告为 `/tmp/fusion-round13-sidebar-report.md` 和 `/tmp/fusion-round13-tui-report.md`，证据在 `/tmp/fusion-round13-sidebar-evidence.D72yMW/` 和 `/tmp/fusion-round13-tui-evidence-806ac590-6679-43c5-8f2c-0a9d87757ac2/`，独立审查为 `/tmp/fusion-round13-evidence-review.md`；Round 14 报告为 `/tmp/fusion-round14-sidebar-report.md` 和 `/tmp/fusion-round14-tui-report.md`，证据在 `/tmp/fusion-round14-sidebar-evidence-zEJSrCsn/` 和 `/tmp/fusion-round14-tui-evidence-b3c4f38f-ad80-4270-8433-5ce6eeea4dd1/`，独立审查为 `/tmp/fusion-round14-evidence-review.md`；Round 15 报告为 `/tmp/fusion-round15-sidebar-report.md` 和修复后的 `/tmp/fusion-round15-tui-report.md`，证据在 `/tmp/fusion-round15-sidebar-evidence-PArhqmkh/` 和 `/tmp/fusion-round15-tui-evidence-fix-ba261be2-8086-4a09-8aad-18cd225f54b5/`，修复报告为 `/tmp/fusion-round15-tui-evidence-fix-report.md`，最终复审为 `/tmp/fusion-round15-evidence-rereview.md`；Round 16 报告和独立审查为 `/tmp/dsh-fusion-round16-sidebar-report.md`、`/tmp/dsh-fusion-round16-sidebar-review.md`、`/tmp/dsh-fusion-round16-tui-report.md` 和 `/tmp/dsh-fusion-round16-tui-review.md`，证据在 `/tmp/dsh-fusion-round16-sidebar-evidence.MahuvZQC/` 和 `/tmp/dsh-fusion-round16-tui-evidence-4ea95909-ce88-4813-9207-5e3c8fe10abc/`；Round 17 报告为 `/tmp/fusion-round17-sidebar-report.md`、`/tmp/fusion-round17-tui-report.md` 和 `/tmp/fusion-round17-evidence-review.md`，证据在 `/tmp/fusion-round17-sidebar-evidence-mcPmfe6K/` 和 `/tmp/fusion-round17-tui-evidence-5b0933e5-76f4-4ba5-b3a2-3f66a9e68b25/`；Round 18 报告为 `/tmp/dsh-fusion-round18-sidebar/report.md` 和 `/tmp/dsh-fusion-round18-tui/report.md`，证据在 `/tmp/dsh-fusion-round18-sidebar/` 和 `/tmp/dsh-fusion-round18-tui/`，独立审查为 `/tmp/dsh-fusion-round18-evidence-review.md`；Round 19 报告为 `/private/tmp/dsh-fusion-round19-sidebar-bZennRT5/report.md` 和 `/private/tmp/dsh-fusion-round19-tui-KlLljWNS/report.md`，独立审查为 `/private/tmp/dsh-fusion-round19-evidence-review.md`，sidebar 截止时间为 `2026-08-19T18:49:16Z`，TUI 截止时间为 `2026-08-19T18:46:52.548Z`。

当前结果：Fusion Web 外部集合仅包含精确 Pet `0.2.9`。其包级准入保持 PASS，当前组合单行通过系统 Chrome 151/CDP `9333` 的 built acceptance 1/1、完整 Web driver 39/39 与 runtime-final oracle 50/50。console、page、network 与 cleanup 诊断干净，pre/post target、listener、process、port 与临时目录检查均无残留。Git Graph `0.2.9` 保持阻塞；Task 22 两行准入与 Task 29 两行 `36/36` 回归继续作为已被取代的历史证据。Task 26 在服务端请求安全检查拒绝 ModLens `3.24.0`。Task 28 在公共 rc.5 peer 闭包检查拒绝 Better Sidebar `0.15.2`；安全、生命周期、隔离安装、组合、启动与 Chrome 均为 `NOT RUN`。历史零行、三行、四行与六行结果也只保留为被取代的证据。Task 35 不影响 TUI，因此 TUI 为 `NOT RUN (not affected)`，公开交付保持阶段 2 BLOCKED。

Task 31 在上述响应窗口内检查了 20 个包，包括全部 17 个 Web UI 身份，并确认截止后候选为 0。该结果未触发产物、许可证、安全、生命周期、所有权、去重、闭包、安装、组合、启动、Chrome 或 PTY 检查，因此既有候选结论保持不变。

Round 20 报告为 `/tmp/fusion-round20-sidebar-report.md`、`/tmp/fusion-round20-tui-report.md` 和 `/tmp/fusion-round20-workspace-audit.md`，发布证据在 `/tmp/fusion-round20-sidebar-evidence.qz5emCs5/` 和 `/tmp/fusion-round20-tui-evidence-WPEgcLJ3/`，sidebar 截止时间为 `2026-08-19T19:07:10Z`，TUI 截止时间为 `2026-08-19T19:09:18.503Z`。

Round 21 报告为 `.superpowers/sdd/task-0-{modlens,sidebar,webui,tui}-report.md` 和 `.superpowers/sdd/task-0-review.md`，sidebar 截止时间为 `2026-08-20T02:40:36.996Z`，TUI 截止时间为 `2026-08-20T02:43:21Z`。

本记录使用四个独立结果级别：

- `PASS`：命名操作成功运行。
- `FAIL`：命名操作运行后失败退出，或与 rc.5 要求矛盾。
- `NOT RUN`：该操作没有证据。
- `BLOCKED`：更早的必需级别失败，因此后续操作无法建立兼容性。

兼容性要求全部适用检查按以下顺序通过：产物身份与完整性、许可证身份、安全、依赖闭包、精确隔离安装、profile 组合、实际 boot、目标能力与诊断、具备完全停稳 dispose 的完整资源与 effect 所有权，以及断连重挂。首个失败会停止该候选，之后每项检查均记为 `NOT RUN`；安装不代表 boot，boot 也不代表完整准入。

## 结果矩阵

| 包或分组 | 精确候选 | 对 rc.5 的 metadata | 隔离安装 | Profile 层 | 实际 boot | 浏览器/console 或终端 | 结果 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 当前单行 Web 组合 | Pet `0.2.9`；包准入 PASS 见下方 | PASS：精确身份、完整性、许可证与授权 | PASS：全新 fixture 局部精确安装 | PASS：恰好一条 `pet` 配置行 | PASS：built acceptance 1/1、完整 driver 39/39 | PASS：Chrome 151/CDP `9333`、runtime-final 50/50、诊断与清理干净 | **PASS** |
| `@liustack/modlens` | 无已接受候选；最新审计 `3.24.0` | 产物／许可证与依赖闭包 PASS；服务端请求安全 FAIL | `3.24.0` PASS | PASS：恰好一条 `modlens` 配置行 | 安全失败后 `NOT RUN` | `NOT RUN`：跨站 `/modlens/paste` 会写入文件；生命周期与 Chrome 在首个失败处停止 | **BLOCKED** |
| `@linxin666/dsh-ssh` | 无已接受候选；最新审计 `0.2.9` | 许可证与安全 PASS；生命周期 FAIL | 生命周期失败后 `NOT RUN` | NOT ACCEPTED：配置行已移除 | `NOT RUN` | BLOCKED：活跃独立终端会话不属于 `SshEngine.dispose()` | **BLOCKED** |
| `@linxin666/dsh-remote-web-ui` | 无已接受候选；最新审计 `0.2.9` | 许可证 PASS；安全 FAIL | 安全失败后 `NOT RUN` | NOT ACCEPTED：配置行已移除 | `NOT RUN` | BLOCKED：`requirePairingForLan:false` 会跳过 `/remote` 的实时设备授权 | **BLOCKED** |
| `@linxin666/dsh-client-ui-task-board` | 无已接受候选；最新审计 `0.2.9` | `0.2.8` 许可证身份 FAIL；`0.2.9` 生命周期 FAIL | 生命周期失败后 `NOT RUN` | NOT ACCEPTED：配置行已移除 | `NOT RUN` | BLOCKED：顶层 settings subscription disposer 被丢弃 | **BLOCKED** |
| 历史三行 Web 组合 | ModLens `3.22.1`、SSH `0.2.5`、Remote Web UI `0.1.11` | 最终生命周期判据 FAIL | 历史安装 PASS | 历史三行层 PASS | 历史 gate 1/1 与 oracle 174/174 PASS | 历史 7 项/402 tokens 与投影 token 449→155 不能豁免生命周期失败 | **已被取代** |
| 历史四行 Web 组合 | 最终三行及 Task Board `0.1.11` | 最终生命周期判据 FAIL | 历史安装 PASS | 历史四行层 PASS | 历史 gate 1/1 与 oracle 170/170 PASS | 历史 7 项/401 tokens 与投影 token 448→160 不能豁免 Task Board 生命周期失败 | **已被取代** |
| 历史六行 Web 组合 | 历史四行及 Pet `0.1.11`、Git Graph `0.1.11` | 最终安全判据 FAIL | 历史安装 PASS | 历史六行层 PASS | 历史 boot PASS | 历史 156/156 运行时断言未覆盖授权失败 | **已被取代** |
| `@linxin666/dsh-pet` | 已接受 `0.2.9` | 精确许可证与授权 PASS | 精确隔离安装 PASS | PASS：唯一 `pet` 配置行 | PASS | PASS：实时状态、唯一 root／dock、干净诊断 | **PASS** |
| `@linxin666/dsh-client-ui-git-graph` | 无已接受候选；最新审计 `0.2.9` | 精确许可证、授权与较早直接 route／SSE 检查 PASS；活跃操作生命周期 FAIL | 历史精确隔离安装 PASS | NOT ACCEPTED：配置行已移除 | 历史隔离启动 PASS | BLOCKED：活跃 JSON 请求与 Git 子进程越过配置行 fiber dispose | **BLOCKED** |
| `@linxin666/dsh-client-ui-skin-center` | 无已接受候选；最新审计 `0.2.9` | 许可证身份 FAIL | `NOT RUN` | NOT ACCEPTED | `NOT RUN` | 许可证失败后 `NOT RUN` | **BLOCKED** |
| `dsh-better-sidebar` | 无已接受候选；最新审计 `0.15.2` | 产物／许可证 PASS；rc.5 公共 peer 闭包 FAIL | 闭包失败后 `NOT RUN` | `NOT RUN` | `NOT RUN` | 安全、生命周期、隔离安装、组合、启动与 Chrome 均为 `NOT RUN` | **BLOCKED** |
| `@linxin666/dsh-liangshen` 源 | 保留 `0.2.4`；拒绝 `0.2.8`／`0.2.9` | 产物／许可证 PASS；Windows 策略 FAIL | 安全失败后 `NOT RUN` | PASS：仓库 preset 保持唯一所有者 | 运行时 `NOT RUN` | 不接受：新来源保留不受约束的 Windows Bash | **PASS at `0.2.4`** |
| `@deepseek-harness-tui/dsh-tui` | 源码运行时 `0.7.1`；拒绝 `0.8.7`／`0.8.8` | 精确产物／许可证 PASS；所有权与公开 rc.5 闭包 FAIL | `0.8.7`／`0.8.8` `NOT RUN`；历史源码闭包 PASS | 历史源码验证 PASS：`base + dsh-tui`，profile 持有 `code-runtime` 配置行 | 历史 `0.7.1` 全新／恢复 PASS；新候选 `NOT RUN` | 19 个版本；24 个非 rc.5 peer、根 `workspace:*` 为 0、打包内为 15、8 个 Liangshen 文件，且新的完整闭包结果为 0/41 | **公开交付 BLOCKED** |

Pet `0.2.9` 包准入与组合单行在各自证据层级均为 PASS，其他 7 个影响决策的外部 Web 能力保持 blocker。只有新的精确 Git Graph 发布版本在 dispose 时拒绝新请求，于有界期限内取消并等待全部活跃 JSON／SSE 操作和完整进程树，并通过进行中 JSON 请求卸载与同 Context 重挂负控后，才能重新考虑准入。ModLens `3.24.0` 与 Better Sidebar `0.15.2` 都在候选 Chrome 验证前停止，因此对应 Chrome 结果为 `NOT RUN`。最近完成的系统 Chrome CDP `9333` 结果是当前单行运行。Task 35 的 TUI 为 `NOT RUN (not affected)`；在一致 rc.5 闭包公开可用，或明确批准新的 Harness 基线并完成全面重验之前，公开交付保持阶段 2 blocker。

Pet-only root HTML oracle 把每个 blocked `GET` 与其自身 profile 的 `GET /` 完整响应快照比较，包括 body 原始字节相等，并在独立启动的 baseline 与 Fusion profile 间逐字节比较每个非 fallback 响应。每个根响应必须各有且仅有一个可解析的 `window.__DSH_BOOT__` 赋值：baseline 不含 Pet entry，Fusion 精确增加一个合法 Pet entry，每侧 graph revision 都由该 graph 的完整、有序 entries 计算。从 Fusion graph 删除 Pet entry 并按剩余完整、有序 entries 重算 revision 后，完整 Fusion HTML 必须与 baseline 原始字节相等。额外 client entry、共享 entry 字段或顺序漂移、任一侧错误 graph revision、boot script 外 body 差异，以及 mounted JSON、redirect、含 stock title 的 route-owned HTML、404 或 405 控制响应均使 oracle 失败。

## 截至 Round 21 的历史证据

### 包证据

### modlens

`@liustack/modlens@3.21.1` 不声明 `@deepseek-ai/dsh-*` peer dependencies，使用 `dsh.bundle.patch: ./cordis.patch.yml`，声明 `dsh.client.platform: web`，导出 `./client`，并贡献 row id `modlens`。

隔离 profile 包含 `base + web-app + modlens`。真实 Web profile 在端口 `3081` boot，返回 HTTP `200`，渲染了填充后的 `#root`，暴露 immediate modlens boot entry，并以 HTTP `200` 提供 modlens client module。Chrome CDP `9333` 捕获 76 个成功请求、无加载失败、无非 2xx 响应、无 console messages、无 uncaught exceptions。这是按当时较窄检查范围得出的历史 boot／浏览器 PASS；完整准入由后续生命周期与安全检查决定。

### better-sidebar

Round 20 完整 npm 注册表请求在新鲜截止时间 `2026-08-19T19:07:10Z` 结束，返回 HTTP `200`、cache `MISS` 且无 `Age`；出站 trace 确认唯一 nonce、`Cache-Control: no-cache, no-store, max-age=0` 和 `Pragma: no-cache`。注册表 metadata 报告 `modified: 2026-08-19T18:11:22.931Z`，Round 19 截止时间之后没有新的 manifest。可安装版本集包含 12 个 manifest，`latest: 0.14.0`。注册表 `time` map 还包含 `0.12.0` 于 `2026-08-14T15:38:59.005Z` 的 time-only entry，但该条目没有可安装 manifest 或 dist-tag，不是候选：

- `0.10.0` 到 `0.13.0` 要求全部 15 个 DSH peers 为 `^0.1.0-rc.6`。
- `0.13.1` 要求全部 15 个 DSH peers 为 `^0.1.0-rc.7`。
- `0.14.0` 发布于 `2026-08-19T18:11:22.558Z`，要求全部 13 个 DSH peers 为 `^0.1.0-rc.8`。

Semver `7.7.2` 对 178 条 DSH peer 声明中 0 条接受 rc.5，因此全部 12 个可安装版本 manifest 产生 0 个兼容候选。候选 tarball integrity、候选 manifest validation、隔离安装、native build policy、profile layering、actual boot、Chrome CDP `9333` inspection 和 browser console inspection 保持 `NOT RUN`。Round 19 独立 evidence review 保持历史 `PASS_WITH_CONCERNS`，含 0 Critical、0 Important 和 2 Minor findings：Round 19 sidebar report 把 gzip-compressed transfer bytes 标为 response body size，且其 `SHA256SUMS` 省略 exact semver tooling。这两个发现都不改变 Round 19 registry 内容或兼容性结果，也不能为 Round 20 建立兼容性。

### web-ui

接受的组合是保留的 direct `0.1.20` 集：

```text
@linxin666/dsh-client-ui-web-ui-settings@0.1.20
@linxin666/dsh-client-ui-community-plugins@0.1.20
@linxin666/dsh-client-ui-task-board@0.1.20
@linxin666/dsh-client-ui-git-graph@0.1.20
@linxin666/dsh-pet@0.1.20
@linxin666/dsh-remote-web-ui@0.1.20
@linxin666/dsh-live-stats@0.1.20
@linxin666/dsh-ssh@0.1.20
@linxin666/dsh-skins@0.1.20
```

Profile root 必须提供这些精确 normal peer dependencies：

```json
{
  "react": "18.3.1",
  "react-dom": "18.3.1"
}
```

隔离 pnpm `11.18.0` profile 必须只批准这些精确 install-script dependencies：

```yaml
allowBuilds:
  cloudflared@0.7.3: true
  cpu-features@0.0.10: true
  ssh2@1.17.0: true
```

有这些条目时，精确安装、`pnpm peers check`、profile-layer reconciliation、boot 和 HTTP 全部通过。Chrome CDP `9333` 验证全部 9 个必需 client entries 和 assets 各一次，包括 remote Web UI 和 skin center。47 项 roster 没有 duplicate ids；describe-image、AionUI panel 和 Liangshen 均未出现在 roster 和 network 中。全部 111 个请求完成且无失败或非 2xx 响应，浏览器没有 warning、error、assertion、log error 或 uncaught exception。

`@linxin666/dsh-web-ui-all@0.1.20` 仍只是 fallback。它通过精确安装、同一 React providers 下的 peer checking、profile-layer reconciliation、boot 和 HTTP。它没有 Round 2 CDP acceptance evidence，并且包含重复 AionUI panel 和 describe-image rows。任何 fallback composition 都必须禁用真实 row ids `web-ui-dsh-aionui-panel` 和 `web-ui-describe-image`。

### TUI

Round 20 npm registry 请求在新鲜截止时间 `2026-08-19T19:09:18.503Z` 完成，返回 HTTP `200`、cache `MISS` 且无 `Age`；出站 trace 确认唯一 nonce、`Cache-Control: no-cache, no-store, max-age=0` 和 `Pragma: no-cache`。Packument 仍包含 16 个版本，`latest: 0.8.5`，registry `modified: 2026-08-19T17:00:13.026Z`，Round 19 截止后没有新版本。版本 `0.8.5` 发布于 `2026-08-19T17:00:12.602Z`：

- `0.5.0` 到 `0.8.0` 要求 DSH peers 为 `^0.1.0-rc.6`。
- `0.8.1` 到 `0.8.5` 要求 DSH peers 为 `^0.1.0-rc.7`，并把 7 个根 runtime dependency values 发布为 `workspace:*`。

Semver `7.8.5` 对 169 条已发布 DSH peer 声明中 0 条接受 rc.5，因此全部 16 个版本产生 0 个兼容候选。新下载的精确 `0.8.5` tarball 通过 SHA-1、SHA-512 SRI 和 root identity checks，但它仍有 7 个根 runtime `workspace:*` 值，以及 18 个 packaged manifests 中总计 22 个 runtime `workspace:*` 值。这个精确版本静态审计不能让 `0.8.5` 成为 rc.5 候选。不存在 rc.5 候选，因此隔离安装、profile composition、profile manifest inspection、actual boot、terminal top bar、status area、input area、Liangshen selection 和 message round trip 均保持 `NOT RUN`。Round 20 evidence verifier 报告 41/41 assertions passing；这证明内部证据一致，不证明 rc.5 兼容。Round 19 独立 evidence review 保持历史 `PASS_WITH_CONCERNS`，含 0 Critical、0 Important 和 2 个 sidebar-only Minor findings。

### 历史挂载结果

- modlens `3.21.1` 具备历史 rc.5 boot／浏览器 PASS；按后续有序检查，它不是完整准入结果。
- 保留的 direct web-ui `0.1.20` 组合在精确 React peer providers 和精确 `allowBuilds` 下具备历史 rc.5 安装、boot 与浏览器 PASS；按后续有序检查，它不是完整准入结果，aggregate 也只是带重复项的 fallback。
- better-sidebar 截至 `2026-08-19T19:07:10Z` 没有 rc.5 兼容的已发布候选：12 个可安装版本 manifest、`latest: 0.14.0`、registry `modified: 2026-08-19T18:11:22.931Z`，并且 0/178 条 DSH peer 声明接受 rc.5；time-only `0.12.0` 没有 manifest，不是候选，而 `0.14.0` 要求 13 个 DSH peers 为 `^0.1.0-rc.8`。TUI 截至 `2026-08-19T19:09:18.503Z` 没有 rc.5 兼容的已发布候选：16 个版本、`latest: 0.8.5`，并且 0/169 条声明接受 rc.5；`0.8.5` 仍包含 7 个根 runtime `workspace:*` 值和总计 22 个 runtime `workspace:*` 值。
- Round 19 独立 evidence review 保持历史 `PASS_WITH_CONCERNS`，含 0 Critical、0 Important 和 2 个 sidebar-only Minor findings。Round 20 添加了截至 sidebar cutoff `2026-08-19T19:07:10Z` 和 TUI cutoff `2026-08-19T19:09:18.503Z` 的新发布事实，以及 41/41 内部 TUI evidence verification，但不声称有独立 Round 20 review 或兼容性 PASS。
- 所需的五仓库 fusion 仍为 **BLOCKED**。Sidebar candidate tarball、manifest、install、profile、boot 和 CDP checks，以及 TUI isolated install、profile、actual boot、terminal UI 和 message round trip 均保持 `NOT RUN`；不接受 compatibility shim、Harness upgrade 或推断出的 runtime result。

### Round 21 refresh

新的 registry enumeration 仍找到 12 个可安装 `dsh-better-sidebar` manifests，其中 0/178 条 DSH peer 声明接受 rc.5；还找到 16 个 dsh-TUI 版本，其中 0/169 条接受 rc.5。任一 mandatory package 都不存在 exact candidate。

Runtime negative controls 不改变 candidate result。Better-sidebar `0.14.0` 通过 web-ui-all `0.2.4` 加载且 Chrome CDP console 干净，手动挂载的 `0.10.0` 也完成加载，dsh-TUI `0.8.5` 在 inner PTY 下渲染；TUI 首先为 23 个 rc.5 package 相对其 rc.7 validation baseline 发出 upstream-drift warnings。

独立 Round 21 review 为 `APPROVED_BLOCKED`，没有 Critical 或 Important findings。它确认 runtime permissiveness 不能豁免 published peer requirements，并确认 Tasks 1-9 仍被 Task 0A 阻塞。

## 证据索引

- Round 1 metadata、tarball、安装和 profile：`/private/tmp/dsh-fusion-task0.X4pqGN/`
- Sidebar registry 报告：`/private/tmp/fusion-round2-sidebar-report.md`
- TUI registry 报告：`/private/tmp/fusion-round2-tui-report.md`
- Web UI 安装、分层、peer、启动和 HTTP 报告：`/private/tmp/fusion-round2-webui-runtime-report.md`
- Web UI Chrome CDP 报告：`/private/tmp/fusion-round2-webui-browser-report.md`
- ModLens Chrome CDP 报告：`/private/tmp/fusion-round2-modlens-browser-report.md`
- Round 2 Web UI 与 ModLens profile 证据：`/private/tmp/fusion-round2-webui-modlens.RAdgfl/`
- Round 3 sidebar 发布报告：`/tmp/fusion-round3-sidebar-report.md`
- Round 3 sidebar registry 响应：`/tmp/fusion-round3-sidebar-registry.json`
- Round 3 TUI 发布报告：`/tmp/fusion-round3-tui-report.md`
- Round 3 已检查的 TUI tarball：`/tmp/fusion-round3-tui.iOeeir/deepseek-harness-tui-dsh-tui-0.8.3.tgz`
- Round 4 sidebar 发布报告：`/tmp/fuse-five-sidebar-round4.md`
- Round 4 sidebar registry 响应：`/tmp/fuse-five-sidebar-round4-registry.json`
- Round 4 已验证的 sidebar tarball：`/tmp/fuse-five-sidebar-round4-tarballs/`
- Round 4 TUI 发布报告：`/tmp/fuse-five-tui-round4.md`
- Round 4 TUI registry 响应：`/tmp/fuse-five-tui-round4-registry.json`
- Round 4 已检查的 TUI tarball 和 manifest：`/tmp/fuse-five-tui-round4-tarball/` 和 `/tmp/fuse-five-tui-round4-extract/package/package.json`
- Round 5 检查由独立 subagent 执行；未生成持久 `/tmp` 报告路径。
- Round 6 sidebar 与 TUI 检查由独立 subagent 流式执行；未生成新的持久 `/tmp` 报告。
- Round 7 sidebar 报告：`/tmp/fusion-round7-sidebar-report.md`；因为没有新候选，所以没有写入独立 registry 响应或 tarball。
- Round 7 初始 TUI 报告及历史 `0.8.3` 证据的 registry 响应：`/tmp/fusion-round7-tui-report.md` 和 `/tmp/fusion-round7-tui-registry.json`
- Round 7 初始检查的 TUI `0.8.3` tarball 与解压目录：`/tmp/fusion-round7-tui.04owYN/dsh-tui-0.8.3.tgz` 和 `/tmp/fusion-round7-tui.04owYN/extract/package/`
- Round 7 TUI `0.8.4` 截止时间修正报告：`/tmp/fusion-round7-tui-0.8.4-report.md`
- Round 7 TUI `0.8.4` registry 响应、tarball、解压目录、验证 JSON 和验证脚本：`/tmp/fusion-round7-tui-0.8.4.3EDad0/registry.json`、`/tmp/fusion-round7-tui-0.8.4.3EDad0/dsh-tui-0.8.4.tgz`、`/tmp/fusion-round7-tui-0.8.4.3EDad0/extract/package/`、`/tmp/fusion-round7-tui-0.8.4.3EDad0/artifact-verification.json` 和 `/tmp/fusion-round7-tui-0.8.4.3EDad0/verify-artifact.mjs`
- Round 8 sidebar 审计报告：`/tmp/dsh-fusion-round8-sidebar-report.md`
- Round 8 TUI 审计报告：`/tmp/dsh-fusion-round8-tui-report.md`
- Round 8 TUI 新鲜 registry 正文和响应头：`/tmp/dsh-fusion-round8-tui.fKKD9z/fresh-registry.json` 和 `/tmp/dsh-fusion-round8-tui.fKKD9z/fresh-registry.headers`
- Round 8 TUI registry 分析、tarball、解压后的 manifest 和产物分析：`/tmp/dsh-fusion-round8-tui.fKKD9z/registry-analysis.json`、`/tmp/dsh-fusion-round8-tui.fKKD9z/dsh-tui-0.8.4.tgz`、`/tmp/dsh-fusion-round8-tui.fKKD9z/extract/package/package.json` 和 `/tmp/dsh-fusion-round8-tui.fKKD9z/artifact-analysis.json`
- Round 9 sidebar audit report：`/tmp/fuse-five-repositories-round9-sidebar.md`
- Round 9 TUI audit report：`/tmp/fuse-five-repositories-round9-tui.md`
- Round 9 TUI fresh nonce and no-cache `MISS` registry body and headers：`/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/registry.json` and `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/registry.headers`
- Round 9 TUI independent registry comparison artifacts：`/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/npm-view.json`, `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/comparison.json`, `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/request.url`, and `/tmp/fuse-five-repositories-round9-tui-evidence.CPyN2H/curl.meta`
- Round 10 sidebar audit report：`/tmp/fuse-five-repositories-round10-sidebar.md`
- Round 10 sidebar fresh registry evidence：`/tmp/fuse-five-repositories-round10-sidebar-evidence.round10-sidebar-20260819T152651Z-4248a3d6-ec9f-4cbd-8159-360b24e37379/`
- Round 10 TUI audit report：`/tmp/fuse-five-repositories-round10-tui.md`
- Round 10 TUI fresh registry evidence：`/tmp/fuse-five-repositories-round10-tui-evidence-1fc4a2fc-ea9b-4fd1-a442-15e4dc9b2281/`
- Round 11 sidebar audit report：`/tmp/fuse-five-repositories-round11-sidebar.md`
- Round 11 sidebar unique evidence directory：`/tmp/fuse-five-repositories-round11-sidebar-evidence-ZHGfQ2/`
- Round 11 TUI audit report：`/tmp/fuse-five-repositories-round11-tui.md`
- Round 11 TUI unique evidence directory：`/tmp/fuse-five-repositories-round11-tui-evidence-9906d414-9693-4265-b991-cf6f57874c3c/`
- Round 12 updated sidebar audit report：`/tmp/fuse-five-repositories-round12-sidebar.md`
- Round 12 repaired sidebar evidence directory：`/tmp/fuse-five-repositories-round12-sidebar-evidence-fix-a9127c2b-77c2-40ca-b11d-359805d5f5cc/`
- Round 12 updated TUI audit report：`/tmp/fuse-five-repositories-round12-tui.md`
- Round 12 repaired TUI evidence directory：`/tmp/fuse-five-repositories-round12-tui-evidence-fix-348d5f9c-7068-42a6-a3b3-d9be6c2156e1/`
- Round 12 evidence repair report：`/tmp/fuse-five-repositories-round12-evidence-fix.md`
- Round 12 post-repair independent rereview：`/tmp/fuse-five-repositories-round12-evidence-rereview.md`
- Round 13 sidebar audit report：`/tmp/fusion-round13-sidebar-report.md`
- Round 13 sidebar evidence directory：`/tmp/fusion-round13-sidebar-evidence.D72yMW/`
- Round 13 TUI audit report：`/tmp/fusion-round13-tui-report.md`
- Round 13 TUI evidence directory：`/tmp/fusion-round13-tui-evidence-806ac590-6679-43c5-8f2c-0a9d87757ac2/`
- Round 13 independent evidence review：`/tmp/fusion-round13-evidence-review.md`
- Round 14 sidebar audit report：`/tmp/fusion-round14-sidebar-report.md`
- Round 14 sidebar evidence directory：`/tmp/fusion-round14-sidebar-evidence-zEJSrCsn/`
- Round 14 TUI audit report：`/tmp/fusion-round14-tui-report.md`
- Round 14 TUI evidence directory：`/tmp/fusion-round14-tui-evidence-b3c4f38f-ad80-4270-8433-5ce6eeea4dd1/`
- Round 14 independent evidence review：`/tmp/fusion-round14-evidence-review.md`
- Round 15 sidebar audit report：`/tmp/fusion-round15-sidebar-report.md`
- Round 15 sidebar evidence directory：`/tmp/fusion-round15-sidebar-evidence-PArhqmkh/`
- Round 15 repaired TUI audit report：`/tmp/fusion-round15-tui-report.md`
- Round 15 repaired TUI evidence directory：`/tmp/fusion-round15-tui-evidence-fix-ba261be2-8086-4a09-8aad-18cd225f54b5/`
- Round 15 TUI evidence repair report：`/tmp/fusion-round15-tui-evidence-fix-report.md`
- Round 15 最终独立证据复审：`/tmp/fusion-round15-evidence-rereview.md`
- Round 16 侧栏审计报告：`/tmp/dsh-fusion-round16-sidebar-report.md`
- Round 16 侧栏证据目录：`/tmp/dsh-fusion-round16-sidebar-evidence.MahuvZQC/`
- Round 16 侧栏独立证据审查：`/tmp/dsh-fusion-round16-sidebar-review.md`
- Round 16 TUI 审计报告：`/tmp/dsh-fusion-round16-tui-report.md`
- Round 16 TUI 证据目录：`/tmp/dsh-fusion-round16-tui-evidence-4ea95909-ce88-4813-9207-5e3c8fe10abc/`
- Round 16 TUI 独立证据审查：`/tmp/dsh-fusion-round16-tui-review.md`
- Round 17 侧栏审计报告：`/tmp/fusion-round17-sidebar-report.md`
- Round 17 侧栏证据目录：`/tmp/fusion-round17-sidebar-evidence-mcPmfe6K/`
- Round 17 TUI 审计报告：`/tmp/fusion-round17-tui-report.md`
- Round 17 TUI 证据目录：`/tmp/fusion-round17-tui-evidence-5b0933e5-76f4-4ba5-b3a2-3f66a9e68b25/`
- Round 17 独立证据审查：`/tmp/fusion-round17-evidence-review.md`
- Round 18 侧栏审计报告与证据目录：`/tmp/dsh-fusion-round18-sidebar/report.md` 和 `/tmp/dsh-fusion-round18-sidebar/`
- Round 18 TUI 审计报告与证据目录：`/tmp/dsh-fusion-round18-tui/report.md` 和 `/tmp/dsh-fusion-round18-tui/`
- Round 18 独立证据审查：`/tmp/dsh-fusion-round18-evidence-review.md`
- Round 19 侧栏审计报告：`/private/tmp/dsh-fusion-round19-sidebar-bZennRT5/report.md`
- Round 19 TUI 审计报告：`/private/tmp/dsh-fusion-round19-tui-KlLljWNS/report.md`
- Round 19 独立证据审查：`/private/tmp/dsh-fusion-round19-evidence-review.md`
- Round 20 侧栏审计报告：`/tmp/fusion-round20-sidebar-report.md`
- Round 20 侧栏证据目录：`/tmp/fusion-round20-sidebar-evidence.qz5emCs5/`
- Round 20 TUI 审计报告：`/tmp/fusion-round20-tui-report.md`
- Round 20 TUI 证据目录：`/tmp/fusion-round20-tui-evidence-WPEgcLJ3/`
- Round 20 工作区审计：`/tmp/fusion-round20-workspace-audit.md`
- Round 21 包报告：`.superpowers/sdd/task-0-modlens-report.md`、`.superpowers/sdd/task-0-sidebar-report.md`、`.superpowers/sdd/task-0-webui-report.md` 和 `.superpowers/sdd/task-0-tui-report.md`
- Round 21 独立阻塞项审查：`.superpowers/sdd/task-0-review.md`

在 Round 20，已经通过的 ModLens 与 Web UI 结果不能证明完整 Fusion 兼容。Round 19 独立证据复审与 Round 20 截至侧栏截止时间 `2026-08-19T19:07:10Z`、TUI 截止时间 `2026-08-19T19:09:18.503Z` 的发布事实保留了当时的 **BLOCKED** 结论。

## Round 22：阶段 1 运行时锁定

Round 22 把运行时经验判据应用于从各包 dist-tag 解析出的最高精确版本。排除 rc.5 的 DSH peer 范围会被记录，但不单独构成阻塞。证据位于 `.superpowers/sdd/v2-task-0-report.md`。

| 包 | 精确版本 | 声明的 DSH peer | 运行时判据 | Profile `allowBuilds` | 备注 |
| --- | --- | --- | --- | --- | --- |
| `@liustack/modlens` | `3.22.0` | 无 | **PASS**：安装、配置行 `modlens`、启动端口 `43101`、CDP 启动入口与客户端资源、`/modlens/config` 返回 `200`、页面控制台与网络诊断干净 | 无 | 图像桥已存在；未使用提供方凭据，也未执行推理。 |
| `@linxin666/dsh-liangshen` | `0.2.4` | 无 | **PASS**：安装、配置行 `liangshen`、启动端口 `43102`、preset 同步与 `agentPreset.list` 可见、页面控制台与网络诊断干净 | 无 | 仅宿主源码包；同步后的 `liangshen` 暴露 `梁神模式`、双工具锚点和 `run_code` 提升。它不是 Fusion 浏览器配置行。 |
| `@linxin666/dsh-client-ui-task-board` | `0.2.4` | 无 | **PASS**：安装、配置行 `ui-task-board`、启动端口 `43103`、CDP 客户端入口、`[data-dsh-taskboard-entry]`、`任务看板`、页面控制台与网络诊断干净 | 无 | Profile 为声明的 peer `react@^18.2.0` 提供 `react@18.3.1`。 |
| `@linxin666/dsh-ssh` | `0.2.4` | 无 | **PASS**：安装、配置行 `ssh`、启动端口 `43104`、CDP 客户端入口、`[data-dsh-ssh-entry]`、`SSH`、hosts API 返回 `200`、页面控制台与网络诊断干净 | `cpu-features@0.0.10`、`ssh2@1.17.0` | Profile 为声明的 React peer 提供 `react@18.3.1` 和 `react-dom@18.3.1`。 |
| `@linxin666/dsh-remote-web-ui` | `0.2.4` | 无 | **PASS**：安装、配置行 `remote-web-ui`、启动端口 `43105`、CDP 客户端入口与远程控制按钮、`/m/` 返回 `200`、页面控制台与网络诊断干净 | `cloudflared@0.7.3` | Profile 为声明的 React peer 提供 `react@18.3.1` 和 `react-dom@18.3.1`。 |
| `@linxin666/dsh-pet` | `0.2.4` | 无 | **PASS**：安装、配置行 `pet`、启动端口 `43106`、CDP 客户端入口、`[data-dsh-pet-root]` 与 `[data-pet-dock]`、宠物状态与资源已加载、页面控制台与网络诊断干净 | 无 | Profile 为声明的 React peer 提供 `react@18.3.1` 和 `react-dom@18.3.1`。 |
| `@linxin666/dsh-client-ui-skin-center` | `0.2.4` | 无 | **PASS**：安装、配置行 `ui-skin-center`、启动端口 `43107`、CDP 客户端入口、`body[data-dsh-skin-center]`、catalog API 返回 `200`、页面控制台与网络诊断干净 | 无 | Profile 为声明的 peer `react@^18.2.0` 提供 `react@18.3.1`。 |

全部 7 个包都通过 rc.5 上的阶段 1 runtime lock。没有包声明 `@deepseek-ai/dsh-*` peer；更新的 DSH 版本只出现在 development dependencies 中。隔离 manifests 和 composed rows 不含 `dsh-tool-describe-image`、`dsh-client-ui-aionui-panel` 或 `dsh-web-ui-all` 引用。仓库根没有收到 dependency 或 `allowBuilds` 变更。

原 Chrome endpoint 在一次中断的诊断探测后退出。Round 22 用专用系统 Google Chrome 进程恢复了必需的 `127.0.0.1:9333` endpoint，并重跑受影响检查。这是证据收集问题，不是包 runtime failure。全部测试服务器和替换 Chrome 进程均已停止。

Round 22 fix evidence 保留在 `.superpowers/sdd/v2-task-0-evidence/`；其 binding index 是 `.superpowers/sdd/v2-task-0-evidence/INDEX.md`，顶层 checksum manifest 是 `.superpowers/sdd/v2-task-0-evidence/SHA256SUMS`。7 个已接受的 supplemental runs 复用端口 `43201` 到 `43207` 上记录的 Round 22 profiles，并保留 exact add transcripts、dump-config output、server logs 和 HTTP results、system Google Chrome/CDP identity、per-package capability and clean-diagnostics JSON、exact profile manifests/locks/`allowBuilds` 以及 cleanup checks。`9333` 上的 Chrome 是另一个任务留下的既有进程，不由本 fix run 启动或停止；fix run 创建的每个 supplemental CDP page target 和 test server 都已关闭。

## Round 22: Task 7 better-sidebar runtime gate

`dsh-better-sidebar@0.14.0` 仍是最高精确 registry 版本。其 rc.8 DSH peer ranges 被记录为相对 rc.5 的漂移。Profile-local exact install 在只批准该 profile 的 `node-pty@1.1.0` 后通过；native module 加载成功，三 bundle roster 保持 `base + web-app + fusion`，候选组合在已启用的原生 `ui-sidebar` 旁产生了恰好一个 `better-sidebar` row。

Chrome CDP `9333` 在 direct Fusion composition 上建立了部分 runtime behavior：原生左侧 sidebar 与右侧 workbench 并存；Files 携带所选 session 发出 `POST /sidebar/api/fs.search`，把 `package.json` 打开进 CodeMirror，Source Control 发出两次成功的 `git.status` 请求并渲染 branch/change data。已接受的 diagnostic capture 有 126 个 HTTP `200` response，无 HTTP error、无非 cancelled network failure、无 console warning/error、无 runtime exception。

Terminal acceptance path 为 **BLOCKED**。真实 `/sidebar/ws/terminal` socket 打开并以 fragmented sent frames 携带完整 `printf <unique-marker>\r` command，但 received frames 只包含 command echo 加 `\r\n`。Marker 在 received stream 中只出现一次，不是两次，且没有 command output 或新 prompt。这不能证明 native PTY 执行了 command。因此 Task 7 不把 `dsh-better-sidebar` 加入 Fusion manifest、patch 或 user guide。证据在 `.superpowers/sdd/v2-task-7-evidence/`；报告是 `.superpowers/sdd/v2-task-7-report.md`。

## Round 22: Task 8 dsh-TUI runtime gate

`@deepseek-harness-tui/dsh-tui@0.7.1` 是通过 rc.5 runtime criterion 的最高精确已发布版本。版本 `0.8.6` 到 `0.7.2` 被拒绝，因为它们打包并同步第二个 Liangshen preset 且没有受支持的 opt-out；`0.7.1` 不含 packaged Liangshen directory 或 `workspace:*` dependency values，因此仓库提供的 `liangshen` 仍是唯一 preset owner。`0.7.1` 通过后无需选择更低 TUI 版本。

保留的运行时判据 overlay 包含有序的 `@deepseek-ai/dsh-base` 和 `@deepseek-harness-tui/dsh-tui` 组合包层。其 profile 局部依赖使用指向 `@deepseek-ai/dsh-code-runtime-worker-thread` 和 `@deepseek-ai/dsh-llm-replay` 的仓库 `link:` 条目，并使用精确的 `@deepseek-harness-tui/dsh-tui@0.7.1`；profile patch 把链接的 worker 插入为宿主 `code-runtime` 配置行。发布的生产操作步骤则通过精确 semver 锁定 `@deepseek-ai/dsh-code-runtime-worker-thread@0.1.0-rc.5` 和 TUI `0.7.1`，且不含 replay provider 依赖。

一个新的 `160x50` node-pty run 使用 `DSH_HOME=<isolated> pnpm dsh --profile fusion-tui` 启动仓库 CLI，选择仓库提供的 `liangshen`，渲染 TUI header、status 和 input area，发送固定 user message，完成 phase-1 `bash` call 并输出 `BOOTSTRAP_OK`，提升到 `run_code`，渲染 `42` 和 `TASK8_TUI_ROUNDTRIP_OK`，并从 seq `0` 到 `48` 写入连续 durable events。第二个真实 PTY 设置 `DSH_TUI_RESUME_SESSION=41a9e214-2a1b-4721-b02b-96726bb2a120`，并从 durable log 渲染相同 transcript。

两个 PTY 都使用 3 秒内输入两次 `Ctrl+C` 的 supported idle exit sequence。每个进程报告 exit code `0`；退出后扫描在排除 scanner 与 evidence driver 自身后，发现 0 个已知 child PIDs，以及 0 条匹配 profile、session root 或隔离 DSH home 的 command。

每次运行都为已安装 rc.5/rc.7 DSH packages 相对 TUI rc.6 validation baseline 记录了恰好 20 条 `[dsh-tui] upstream drift` warning。此 peer drift 是 **RECORDED RISK**，不是单独的 runtime blocker。图中 React 只解析一次，为 `19.2.8`，而 `dsh-working-activity@0.2.6` 声明 React `^18.2.0`；paced streaming 和 status rendering 完成且没有 hook 或 reconciler crash，因此该 mismatch 也是 **RECORDED RISK**。

Task 8 evidence 在 `.superpowers/sdd/v2-task-8-evidence/` 下，最终可审计运行位于 `final-pty-0.7.1/{fresh,resume}/`；每个目录都包含 exact command and environment、argv、timestamped driver steps、raw and normalized transcripts、running process tree、exit assertions 和 post-exit process scan。Task 8 报告为 `.superpowers/sdd/v2-task-8-report.md`。Task 8 为 **PASS**；在该检查点，整体五仓库 fusion 仍由当时未解决的 Task 7 终端结果独立阻塞。

Acceptance overlay 的仓库 `link:` 依赖和 replay provider 是仅用于测试的证据输入。产品指南中的精确 `0.1.0-rc.5` worker 依赖及不含 replay 的要求定义了发布生产操作步骤。

### Task 7 review correction

前述 Task 7 terminal 结论已被新的 review-fix run 取代。原探测在第一个 marker 出现在 command echo 时结束 nominal wait，因此其后续 stream inspection 发生在 login shell 完成启动之前，无法建立 timeout。

修正后的探测发送一个唯一的 `printf '%s\n' '<marker>'` command，并在 Enter 后启动独立的 30 秒 monotonic deadline。每个 terminal WebSocket sent 和 received frame 都记录 CDP monotonic timestamp 与本地 `time.monotonic_ns()`。第一个 marker 不能结束等待；success 要求第二个 marker 后接新 prompt，而 socket close 或 frame error 会显式终止。

新的 system Google Chrome CDP `9333` run 在 12.40 秒后到达第二个 marker 和随后的 `(base) bytedance@DW79MHGWKN fusion %` prompt，且没有 terminal socket close 或 error。Files search、CodeMirror editor、Source Control、native-left/right-workbench coexistence 和 terminal execution 通过；全部 139 个 HTTP responses 为 `200`，无 runtime exception、console/log warning 或 error、bad response、非 cancelled network failure。因此 `dsh-better-sidebar@0.14.0` 尽管有记录的 rc.8 peer drift，仍通过 rc.5 runtime criterion，并以一个 Fusion row 和 profile-local `node-pty@1.1.0` build approval 被纳入。

权威证据是 `.superpowers/sdd/v2-task-7-evidence/review-fix/browser/sidebar-runtime.json`；报告是 `.superpowers/sdd/v2-task-7-report.md`。`.superpowers/sdd/v2-task-7-evidence/INDEX.md` 标识最终 artifacts，`.superpowers/sdd/v2-task-7-evidence/SHA256SUMS` 绑定它们。

## 2026-08-21 运行时候选刷新

新的无缓存 registry 请求覆盖七个 Web 候选至 `2026-08-21T02:10:34Z`，sidebar 至 `2026-08-21T02:11:06.609Z`，TUI 至 `2026-08-21T02:11:07.120Z`。随后的运行时判据继续检查 rc.5 上的安装、组合、真实界面、目标能力和诊断。

| 包 | 当前决策 | 运行时结果 | Profile 局部构建许可 |
| --- | --- | --- | --- |
| `@liustack/modlens` | 升级至 `3.22.1` | PASS | 无 |
| `@linxin666/dsh-client-ui-task-board` | 升级至 `0.2.5` | PASS，记录 rc.8 DSH peer 漂移 | 无 |
| `@linxin666/dsh-ssh` | 升级至 `0.2.5` | PASS | `cpu-features@0.0.10`、`ssh2@1.17.0` |
| `@linxin666/dsh-remote-web-ui` | 升级至 `0.2.5` | PASS | `cloudflared@0.7.3` |
| `@linxin666/dsh-pet` | 升级至 `0.2.5` | PASS | 无 |
| `@linxin666/dsh-client-ui-skin-center` | 升级至 `0.2.5` | PASS | 无 |
| `@linxin666/dsh-liangshen` | 保留源锁 `0.2.4`；拒绝 `0.2.5` | REJECT AS SOURCE：仓库 preset 遮蔽候选运行时，且其 Windows shell 路径绕过仓库沙箱／批准链 | 无 |
| `dsh-better-sidebar` | 保留 `0.14.0` | PASS；截止时间前没有更新版本 | `node-pty@1.1.0` |
| `@deepseek-harness-tui/dsh-tui` | 保留 `0.7.1` | PASS；全部更高版本都保留第二个 Liangshen 所有者，且从 `0.8.1` 起还保留已打包的 `workspace:*` 值 | 无 |

证据位于 `.superpowers/sdd/v3-task-11-web-versions-report.md`、`.superpowers/sdd/v3-task-11-sidebar-tui-versions-report.md`、`.superpowers/sdd/v3-task-11-modlens-runtime-report.md`、`.superpowers/sdd/v3-task-11-webui-runtime-report.md` 和 `.superpowers/sdd/v3-task-11-consistency-report.md`。六个升级版本保持已接受的 profile 局部许可、组合包顺序、唯一能力所有者、仓库根 workspace 隔离、sidebar 版本和 TUI 版本不变。

## 2026-08-21 Task 12 收口

Task 12 的许可证、安全与生命周期复核取代了 Task 11 当前结果表，但不改写其历史证据。在该检查点，选定 Web 集合为 ModLens `3.22.1`、SSH `0.2.5` 和 Remote Web UI `0.1.11`。

历史六行 `base -> web-app -> fusion` profile 已建立精确 manifest 与 lock 解析、精确构建许可、六个包的能力、既有 Web 路径、工具目录去重、干净诊断、156/156 项运行时断言、实际 compact 7 项/402 tokens 和重启恢复。后续授权发现意味着该证据不能建立最终验收。历史报告仍位于 `.superpowers/sdd/v3-task-12-final-web-runtime.md` 和 `.superpowers/sdd/v3-task-12-runtime-evidence-rereview.md`。

Pet 保持外部阻塞。Pet `0.1.11` 注册的 exact `/api/pet/*` 路由不检查 Host、Origin、socket 或实时设备授权；可访问共享 WebServer 的未配对请求可以读取并持久修改 Pet 状态。证据位于 `.superpowers/sdd/v3-task-12-final-security-review.md` 和 `.superpowers/sdd/v3-task-12-pet-security-validation.md`。

Git Graph 保持外部阻塞。Git Graph `0.1.11` 在 Remote Web UI 配对路由之外注册 `/git/*`，因此知道 workspace 路径的已撤销设备可以读取和修改分支。证据位于 `.superpowers/sdd/v3-task-12-final-security-review.md` 和 `.superpowers/sdd/v3-task-12-gitgraph-security-validation.md`。

Skin Center 保持外部阻塞。已发布的 `0.1.12` 至 `0.2.5` manifest 与包内许可证身份冲突。许可证一致的 `0.1.11` 可以安装、组合、启动并加载客户端，但 rc.5 Settings slot 不渲染其 `web-ui.plugin.item` 注册。证据位于 `.superpowers/sdd/v3-task-12-license-investigation.md` 和 `.superpowers/sdd/v3-task-12-skin-0111-runtime.md`。

Better Sidebar 保持阶段 2 安全 blocker，且不挂载。其可选 `terminal_*` 模型工具可以在会话沙箱、批准和环境清洗路径之外使用宿主 PTY。唯一有效的配置级缓解会禁用整个 sidebar settings namespace 并破坏 Settings 体验，因此不是可接受的部署开关。证据位于 `.superpowers/sdd/v3-task-12-sidebar-security-investigation.md`。

历史四行 checked-in REAL composition 证据位于 `.superpowers/sdd/v3-task-12-four-row-real-gate-implementation.md`，独立复审位于 `.superpowers/sdd/v3-task-12-four-row-real-gate-review.md`。该 gate 通过系统 Chrome CDP `9333` 激活全部四行，不含浏览器启动 fallback，使默认 unit、coverage、Web 与 CI 收集保持离线，并把外部依赖、lock 数据和 `allowBuilds` 保持为 fixture 局部配置。其 1/1 结果已被 Task Board 生命周期发现取代。

历史完整四行 oracle 位于 `.superpowers/sdd/v3-task-12-final-four-row-web-runtime.md`，证据与运行时复审位于 `.superpowers/sdd/v3-task-12-final-four-row-web-runtime-review.md`。该 oracle 通过 170/170 项断言；真实 compact 遮蔽 7 项和 401 tokens，使投影消息 token 从 448 降至 160，并在服务重启后恢复同一 durable session。该结果已被取代，不是当前 Web 结论。

历史三行 checked-in REAL composition gate 通过系统 Chrome CDP `9333` 取得 1/1 PASS。`.superpowers/sdd/v3-task-12-final-three-row-web-runtime.md` 中的完整 oracle 以干净诊断和 blocker 排除通过 174/174 项断言；真实 compact 遮蔽 7 项和 402 tokens，使投影消息 token 从 449 降至 155，并在重启同一 session 后保持 155。`.superpowers/sdd/v3-task-12-final-three-row-web-runtime-review.md` 中的独立复审为 `EVIDENCE PASS / RUNTIME PASS`。后续 ModLens、SSH 与 Remote Web UI 生命周期审查已取代该准入证据。

Liangshen 继续使用许可证身份一致的精确版本 `0.2.4` 作为来源；仓库保留其经过安全适配的 Windows 组合。TUI `0.7.1` 在 41 包纯 rc.5 源码闭包下通过高质量的全新／恢复 PTY 验证。npm registry 缺少该依赖图所需的 23 个 rc.5 包，因此没有受支持的公开命令能重建该闭包，公开交付保持阶段 2 BLOCKED。证据位于 `.superpowers/sdd/v3-task-12-liangshen-license.md`、`.superpowers/sdd/v3-task-13-tui-runtime.md` 和 `.superpowers/sdd/v3-task-12-runtime-evidence-rereview.md`。

## 2026-08-21 Task 13 生命周期收敛

ModLens 权威审查为 `.superpowers/sdd/task13-final/modlens-lifecycle-review.md`：全部 38 个 DSH-capable 候选要么同时缺少两条目标 route，要么丢失 route disposer。真实 `3.22.1` Loader probe 在 dispose 后留下 `/modlens/paste` 与 `/modlens/config`，并在同一 Context 重挂时拒绝替代 handler。

SSH 权威审查为 `.superpowers/sdd/task13-final/ssh-lifecycle-review.md`：全部 26 个已发布版本都会在插件 dispose 后留下已接受的 terminal WebSocket，以及独立 SSH client 与 channel。真实 `0.2.5` probe 确认等待 fiber dispose 完成后，活跃 shell 仍可继续使用。

Remote Web UI 权威审查为 `.superpowers/sdd/task13-final/remote-web-ui-lifecycle-review.md`：26 个已发布版本的联合准入结果为 0/26。版本 `0.1.11` 会卸载并重挂 12 条 Host route，但开放的配对／移动端 SSE stream、tunnel 完全停稳、两个客户端 subscription disposer 与 failed-pair React root 仍不完整；版本 `0.1.12+` 另有 manifest/LICENSE 身份冲突。

这些发现把 Task 13 的 Fusion Web 目标收敛为零外部配置行。Task 12.17 同步了 bundle、fixture、测试、产品文档、desktop 契约、网站标签、Agent Note 与执行记录。当时的零行 REAL gate 通过 1/1，完整 Web oracle 通过 196/196。三项负控均以 195/196 和退出码 1 阻断，compact 记录 7 项/401 tokens 和投影消息 token 448→155，重启后保持 155，独立复审结论为 `EVIDENCE PASS / RUNTIME PASS`。

## Round 23：Task 18 截止后审计

Round 23 审计了 `2026-08-21T02:11:00Z` 截止后的全部发布版本。精确 Web UI `0.2.6` 与 dsh-TUI `0.8.7` 产物补齐首次复审发现的覆盖缺口后，独立二次复审批准了规格符合性与证据质量。该轮没有改变准入决定：Fusion Web 当时保持零外部配置行，Fusion TUI 公开交付保持阶段 2 **BLOCKED**。

| 系列 | 新鲜证据截止时间 | 当前计数 | 精确截止后集合 |
| --- | --- | --- | --- |
| ModLens | `2026-08-21T22:38:40.412Z` | 76 个发布版本；38 个 DSH 候选 | `3.22.2`、`3.23.0`、`3.23.1` |
| Web UI | `2026-08-21T23:30:28.583Z` | 17 个身份；总数见下文 | 每个身份均为 `0.2.6`、`0.2.7` |
| Better Sidebar | `2026-08-21T22:38:00Z` | 13 个发布版本 | `0.15.0` |
| dsh-TUI | `2026-08-21T23:28:19.483Z` | 19 个发布版本 | `0.8.7`、`0.8.8` |

17 个 Web UI 身份的版本总数为：Chat Recovery 4、AionUI Panel 26、Community Plugins 11、Git Graph 26、Plugin Manager 6、Skill Explorer 8、Skin Center 27、Task Board 26、Web UI Settings 26、Desktop Launcher 4、Liangshen 16、Pet 26、Remote Web UI 26、Skins 28、SSH 26、describe-image 17、`web-ui-all` 28。

| 候选 | 产物与许可证 | 安全、生命周期或所有权 | 下游结果 |
| --- | --- | --- | --- |
| ModLens `3.23.1` | 精确身份、完整性、MIT 许可证、安装、导入、profile 添加与组合 PASS | 初始路由 PASS；直接 Loader 探针 FAIL，因为两条路由在 dispose 后仍存在，重复路由拒绝导致无法重挂 | Web 启动、能力可见性与 Chrome 诊断为 `NOT RUN` |
| Web UI `0.2.6`／`0.2.7` | 34 个精确 tarball 全部通过注册表身份与完整性校验。每轮各有 10 个身份存在 manifest/LICENSE 冲突，另 7 个许可证一致 | Pet 与 Git Graph 在两轮中均具备静态服务端授权，但许可证在完整安全准入前失败。Task Board、SSH 与 Remote Web UI 保留精确生命周期失败；Skin Center 许可证失败；Liangshen 在 Windows 策略与单一所有权上失败；AionUI、describe-image 与 `web-ui-all` 违反去重或所有权要求 | 决策相关安装、候选 Chrome、负控与运行时为 `NOT RUN`；非目标身份保持未选择 |
| Better Sidebar `0.15.0` | 精确身份、完整性、MIT 许可证、声明 peer 的安装与原生加载 PASS | `agentTerminalTools` 仍可由用户写入。8 个工具通过 `ctx.tools` 注册并进入通用 pre-execute 链，但包未提供批准决策或不可变部署锁；模型命令在 Harness 约束与环境清洗之外，以 ambient `process.env` 到达 `nodePty.spawn` | rc.5 公开安装阻塞；Web 启动、Chrome 与生命周期为 `NOT RUN` |
| dsh-TUI `0.8.7`／`0.8.8` | 两个精确产物均通过身份、完整性和 MIT 许可证检查 | 每个版本都有 24 个非 rc.5 DSH peer、0 个根与 15 个打包内 `workspace:*` 值，以及 8 个带活跃第二所有者的 Liangshen 文件。新的完整历史源码闭包查询在 41 个包中找到 0 个精确 rc.5 | 安装、profile 组合、全新／恢复 PTY、UI、往返、回放、退出与清理均为 `NOT RUN` |

TUI 闭包计数描述不同证据集。历史 23 包结果是公开安装尝试直接查询的子集；新的 0/41 结果覆盖历史纯 rc.5 源码验证闭包使用的完整包集合。两项结果均不表示其余 18 个包在历史上可用。历史 `0.7.1` 源码运行时保持 PASS；`0.8.7` 与 `0.8.8` 均没有运行时 PASS 或 FAIL。

Round 5 按顺序执行强制检查，因此已记录的 `NOT RUN` 是合法结果，而不是缺失的验收证据。许可证、生命周期、安全策略、去重、单一所有者或公开闭包失败会在候选浏览器或 PTY 运行建立兼容性前否决精确产物。报告中的 Chrome CDP `9333` 观测只属于环境预检。

证据：

- ModLens `3.23.1`：`.superpowers/sdd/round5-modlens/report.md`
- Web UI `0.2.7` 与 Liangshen `0.2.7`：`.superpowers/sdd/round5-webui/report.md`
- Better Sidebar `0.15.0`：`.superpowers/sdd/round5-sidebar/report.md`
- dsh-TUI `0.8.8`：`.superpowers/sdd/round5-tui/report.md`
- Web UI `0.2.6`：`.superpowers/sdd/round5-webui-026/report.md`
- dsh-TUI `0.8.7`：`.superpowers/sdd/round5-tui-087/report.md`
- 首次独立复审与通过的二次复审：`.superpowers/sdd/round5-external-review.md` 与 `.superpowers/sdd/round5-external-rereview.md`

## Round 24：Task 22 Web UI `0.2.8` 与 `0.2.9`

可追溯的无缓存 packument 获取截至 `2026-08-22T12:37:33.085Z`；截至该时间，17 份响应均报告 `latest: 0.2.9`，且均不包含 `0.2.10` 或更高版本。`0.2.8` 波次从 `01:55:55.835Z` 持续到 `01:56:29.719Z`；`0.2.9` 波次从 `09:32:20.642Z` 持续到 `09:32:48.011Z`。34 个精确 tarball 全部通过包名／版本身份、SHA-1 与 SHA-512 SRI 检查。当前发布总数为：Chat Recovery 6、AionUI Panel 28、Community Plugins 13、Git Graph 28、Plugin Manager 8、Skill Explorer 10、Skin Center 29、Task Board 28、Web UI Settings 28、Desktop Launcher 6、Liangshen 18、Pet 28、Remote Web UI 28、Skins 30、SSH 28、Describe Image 19、`web-ui-all` 30。

检查严格按身份、完整性、许可证、安全、生命周期、所有权、去重、运行时顺序执行。`NOT RUN` 表示更早的检查失败或该身份未被选择。

| 身份 | `0.2.8` 首个停止点 | `0.2.9` 首个停止点 | 运行时结论 |
| --- | --- | --- | --- |
| Chat Recovery | 许可证 FAIL：BSD manifest、Apache 正文 | 许可证 FAIL：BSD manifest、Apache 正文 | `NOT RUN` |
| AionUI Panel | 许可证 FAIL：Apache manifest、BSD 正文 | 所有权 FAIL：把右侧面板委托给已阻塞的 Better Sidebar | `NOT RUN` |
| Community Plugins | 安全／生命周期 PASS 后 `NOT SELECTED` | 安全／生命周期 PASS 后 `NOT SELECTED` | `NOT RUN` |
| Git Graph | 许可证 FAIL：Apache manifest、BSD 正文 | 全部检查 PASS | Chrome PASS |
| Plugin Manager | 生命周期 FAIL：活跃 CLI 子进程在 dispose 时未取消或等待 | 相同生命周期失败 | `NOT RUN` |
| Skill Explorer | 安全／生命周期 PASS 后 `NOT SELECTED` | 安全／生命周期 PASS 后 `NOT SELECTED` | `NOT RUN` |
| Skin Center | 许可证 FAIL：Apache manifest、BSD 正文 | 相同许可证失败 | `NOT RUN` |
| Task Board | 许可证 FAIL：Apache manifest、BSD 正文 | 生命周期 FAIL：顶层 settings subscription disposer 被丢弃 | `NOT RUN` |
| Web UI Settings | 许可证 FAIL：Apache manifest、BSD 正文 | 安全／生命周期 PASS 后 `NOT SELECTED` | `NOT RUN` |
| Desktop Launcher | 安全／生命周期 PASS 后 `NOT SELECTED` | 安全／生命周期 PASS 后 `NOT SELECTED` | `NOT RUN` |
| Liangshen | 安全 FAIL：Windows shell 明确缺少操作系统约束 | 相同安全失败 | `NOT RUN` |
| Pet | 许可证 FAIL：Apache manifest、BSD 正文 | 全部检查 PASS | Chrome PASS |
| Remote Web UI | 许可证 FAIL：Apache manifest、BSD 正文 | 安全 FAIL：`/remote` 配对可关闭 | `NOT RUN` |
| Skins | 许可证 FAIL：Apache manifest、BSD 正文 | 许可证 FAIL：依赖闭包含冲突的 Skin Center `0.2.9` | `NOT RUN` |
| SSH | 生命周期 FAIL：独立终端会话不属于 engine dispose | 相同生命周期失败 | `NOT RUN` |
| Describe Image | 安全 FAIL：非 loopback 跨站上传触达 attachment 存储 | 相同安全失败 | `NOT RUN` |
| `web-ui-all` | 许可证 FAIL：Apache manifest、BSD 正文 | 许可证 FAIL：依赖闭包含冲突身份 | `NOT RUN` |

Task 22 曾确认 Pet 与 Git Graph `0.2.9` 各自通过未配对、已撤销、已配对与 loopback 授权探针。Pet 精确客户端生命周期测试通过 5/5。Git Graph 的直接 Host 探针 dispose 两条 route 与一个开放 SSE stream，并在同一注册表无重复重挂；其独立 RED 运行检测到遗留 route、开放 SSE 响应、活动 timer 与重复重挂，随后强制清理把全部计数归零。其精确客户端 apply／dispose／重挂测试通过。baseline、Pet-only 与 Git-only profile 都通过真实系统 Chrome CDP `9333` 的加载、路由、诊断与清理检查；组合 REAL gate 证明完整有序 tool-name 列表与 `base + web-app` 基线相等，并提供历史可见性证据。由于这些检查遗漏了配置行 fiber dispose 时的活跃 JSON 操作与子进程，Task 33 已取代 Git Graph 的准入结论。

## Round 25：Task 26 外部候选

新的无缓存 packument 显示 ModLens 有 77 个发布版本和 39 个 DSH 候选，Better Sidebar 有 14 个可安装发布版本。精确 ModLens `3.24.0` 与 Better Sidebar `0.15.1` 均通过 tarball 包名／版本身份、注册表 SHA-1、SHA-512 SRI、路径安全和 MIT manifest／LICENSE 一致性检查。

检查在首个失败处停止：

| 候选 | rc.5 闭包与隔离 profile | 组合 | 服务端安全 | 生命周期 | 启动／Chrome CDP `9333` |
| --- | --- | --- | --- | --- | --- |
| ModLens `3.24.0` | PASS：不含 DSH peer／运行时依赖；精确安装只解析 ModLens、Commander 与 Undici | PASS：恰好一条 `modlens` 配置行 | FAIL：`/modlens/config` 会拒绝的同一跨站请求可被 `POST /modlens/paste` 接受，返回 `200` 并写入所提交的图像字节 | `NOT RUN` | `NOT RUN` |
| Better Sidebar `0.15.1` | FAIL：全部 14 个 DSH peer 范围均要求 `^0.1.0-rc.8`，公共注册表对 14 个 peer 包提供精确 `0.1.0-rc.5` 的数量为 0，精确 profile 安装在缺失闭包处停止 | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |

Better Sidebar 源码差异包括 FileTree 文件拖动过滤、subagent 自动打开防抖、Side Chat 展示和 UI 终端 park 生命周期行为。`config.ts`、`prefs-shared.ts`、`tools.ts`、`agent-pty.ts` 与 `trust-fence.ts` 和 `0.15.0` 字节一致，因此产物仍包含用户可写的 `agentTerminalTools` 开关及继承 ambient 环境的 PTY 实现；该静态观察不能替代闭包失败后跳过的检查。在 Task 26 检查点，Fusion manifest 与两行 patch 保持不变。证据位于 `.superpowers/sdd/ralph-loop-3-task-26/`。

## Round 26：Task 28 Better Sidebar `0.15.2`

新的无缓存 packument 请求在 HTTP 截止时间 `2026-08-22T17:01:07Z` 完成，状态为 `200`、`CF-Cache-Status: MISS`，且无 `Age`。dist-tag 为 `latest: 0.15.2` 与 `beta: 0.12.0-beta.1`。time map 有 16 个版本键，其中 `0.12.0` 只有时间记录且不可安装；packument 有 15 个可安装 manifest。相对上次截止时间 `2026-08-22T15:28:38Z`，精确 `0.15.2` 是唯一新候选，发布时间为 `2026-08-22T15:35:41.933Z`，且不存在更高版本。

精确 `0.15.2` 通过包名／版本身份、注册表 SHA-1 `15c0a057d1e071e5b6c4409949fbad080f4bc6fe`、SHA-512 SRI、218 个条目的 tar 路径与链接安全，以及 MIT manifest／LICENSE 一致性检查。其 14 个 DSH peer 范围仍全部为 `^0.1.0-rc.8`。对每个 peer 的新无缓存请求在 14 个包中找到 0 个精确 `0.1.0-rc.5`，因此公共 rc.5 闭包在首个强制前置检查失败。

检查在该失败处停止：

| 身份 | 完整性 | 许可证 | 公共 rc.5 闭包 | 安全 | 生命周期 | 隔离安装 | 组合／启动／Chrome CDP `9333` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Better Sidebar `0.15.2` | PASS | PASS | FAIL：精确 rc.5 提供方为 0/14 | `NOT RUN` | `NOT RUN` | `NOT RUN` | `NOT RUN` |

在 Task 28 检查点，Fusion 保持 Better Sidebar 未挂载，并保留精确 Pet 与 Git Graph `0.2.9` 配置行。Task 33 随后在保留 Task 28 证据的同时取代该 selected-row 结论。Task 28 报告为 `.superpowers/sdd/round5-task28-report.md`。

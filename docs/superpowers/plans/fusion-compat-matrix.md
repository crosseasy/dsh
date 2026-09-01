# Fusion compatibility matrix

调查日期：2026-08-19。状态：`DONE_WITH_CONCERNS`。

## 基线与状态语义

| 项目 | 精确值 |
| --- | --- |
| dsh 版本 | `0.1.0-rc.7` |
| dsh commit | `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca` |
| Git 引用 | `dsh-v0.1.0-rc.7`、`upstream/master` |
| CLI 包 | `@deepseek-ai/dsh@0.1.0-rc.7` |
| Node 范围 | `^22.19.0 || >=24.0.0` |

`COMPAT.status: 'ok'` 只用于在 dsh rc.7 上完成对应 runtime 报告且结果为 `PASS` 的 npm 包。静态 manifest、peer、模块格式和 row 检查不能单独产生 `ok`。Desktop 只有 `static-contract` 结论，runtime 状态为 `pending`。

## 兼容性矩阵

| 包名 | 验证版本 | 兼容 dsh 版本 | 安装 | boot | console/终端 | 挂载策略 | 备注 |
| --- | ---: | --- | --- | --- | --- | --- | --- |
| `@liustack/modlens` | `3.21.1` | `0.1.0-rc.7` | PASS | PASS，`127.0.0.1:53101` | Chrome CDP `9333` PASS | fusion row `modlens` | client、config 和 paste routes 均为 200；无 console、Runtime、Log 或 network error |
| `dsh-better-sidebar` | `0.13.1` | `0.1.0-rc.7` | PASS，临时 profile 仅允许 `node-pty` build | PASS，`127.0.0.1:53102` | Chrome CDP `9333` PASS | fusion row `better-sidebar` | portal、样式、shell/settings API 和 WebSocket 均已观测；核心左侧 `ui-sidebar` 保留 |
| `@linxin666/dsh-client-ui-web-ui-settings` | `0.2.2` | `0.1.0-rc.7` | PASS | PASS，`127.0.0.1:53201` | Chrome CDP `9333` PASS | standalone row `ui-web-ui-settings` | 独立 profile；client bundle 200；诊断为空 |
| `@linxin666/dsh-client-ui-task-board` | `0.2.2` | `0.1.0-rc.7` | PASS | PASS，`127.0.0.1:53202` | Chrome CDP `9333` PASS | standalone row `ui-task-board` | 独立 profile；client bundle 200；诊断为空 |
| `@linxin666/dsh-client-ui-git-graph` | `0.2.2` | `0.1.0-rc.7` | PASS | PASS，`127.0.0.1:53203` | Chrome CDP `9333` PASS | standalone row `ui-git-graph` | 独立 profile；client bundle 200；诊断为空 |
| `@linxin666/dsh-remote-web-ui` | `0.2.2` | `0.1.0-rc.7` | PASS | PASS，`127.0.0.1:53205` | Chrome CDP `9333` PASS | standalone row `remote-web-ui` | 独立 profile；canonical mobile-remote；client bundle 200；诊断为空 |
| `@linxin666/dsh-ssh` | `0.2.2` | `0.1.0-rc.7` | PASS | PASS，`127.0.0.1:53206` | Chrome CDP `9333` PASS | standalone row `ssh` | 独立 profile；只在临时 profile 允许 `cpu-features`/`ssh2`；client bundle 200；诊断为空 |
| `@linxin666/dsh-pet` | `0.2.2` | `0.1.0-rc.7` | PASS | PASS，`127.0.0.1:53204` | Chrome CDP `9333` PASS | standalone row `pet` | 独立 profile；client bundle 200；诊断为空 |
| `@linxin666/dsh-client-ui-skin-center` | `0.2.2` | `0.1.0-rc.7` | PASS | PASS，`127.0.0.1:53207` | Chrome CDP `9333` PASS | standalone row `ui-skin-center` | 独立 profile；client bundle 200；不使用 retired carrier `dsh-skins` |
| `@linxin666/dsh-liangshen` | `0.2.2` | `0.1.0-rc.7` | PASS | PASS，`127.0.0.1:53208` | Host-only row；assembled Web CDP 诊断为空 | Task 3 的 preset 源，不在 fusion 中挂载 `liangshen` row | 独立 profile；同步五个 preset 文件；Task 3 复制到 system root |
| `@deepseek-harness-tui/dsh-tui` | `0.8.3` | `0.1.0-rc.7` | PASS | PASS，real PTY | TTY PASS，无 upstream drift/runtime warning | 独立 `fusion-tui` profile | `script -q -e` 中渲染 `dsh-TUI v0.8.3` 和 25 个工具；SIGINT 后预期退出 130 |
| Desktop `v2.0.1` | commit `34c8f4b9bf90faaac82deb65661fccbc9d819a0e` | static-contract：rc.7；runtime：`pending` | 本仓未执行 | 本仓未执行 | 外仓 Electron 待验证 | 不加入 fusion bundle；Desktop launcher 叠加自身 patch | 只完成静态契约；不得记为 runtime `ok` |

八个 web-ui 子包先在同一 curated profile 中验证组合关系，再分别在隔离 profile 中完成精确安装与 boot。七个 browser-side 包各有独立 Chrome CDP target、client bundle 200 和干净 console/Runtime/Log/network 记录；host-only Liangshen 单独验证了 preset 同步。curated profile 未安装 `@linxin666/dsh-web-ui-all`、`@linxin666/dsh-tool-describe-image` 或 `@linxin666/dsh-client-ui-aionui-panel`，dump-config 中也没有对应排除 rows。

## rc.7 runtime 证据

### modlens

```sh
pnpm dsh --version
timeout 55s env DSH_HOME=/tmp/fusion-rc7-modlens pnpm dsh plugin --profile web add @liustack/modlens@3.21.1
env DSH_HOME=/tmp/fusion-rc7-modlens pnpm dsh --profile web --dump-config
env DSH_HOME=/tmp/fusion-rc7-modlens pnpm dsh --profile web --host 127.0.0.1 --port 53101
timeout 55s node /tmp/fusion-rc7-modlens-cdp.mjs
```

版本、安装、dump-config、HTTP 和 CDP collector 均 exit 0。Chrome `151.0.7922.140` 通过 CDP `http://127.0.0.1:9333` 打开 `http://127.0.0.1:53101/`；modlens client、`/modlens/config` 和 `/modlens/paste` 均为 200，error/warning 计数均为 0。

### better-sidebar

```sh
env DSH_HOME=/tmp/fusion-rc7-sidebar pnpm dsh plugin --profile web add dsh-better-sidebar@0.13.1
env DSH_HOME=/tmp/fusion-rc7-sidebar pnpm dsh web --dump-config
env DSH_HOME=/tmp/fusion-rc7-sidebar pnpm dsh web --host 127.0.0.1 --port 53102
```

首次安装因 `node-pty@1.1.0` build script 未获允许而拒绝；只在临时 profile 设置 `allowBuilds.node-pty: true` 后重复精确安装并 exit 0。Chrome `151.0.7922.140` 通过 CDP `127.0.0.1:9333` 新建干净 target，打开 `http://127.0.0.1:53102/`；插件 client 和两个 API 为 200，两个 WebSocket 为 101，console、Runtime、Log 和 network error 均为 0。

### curated web-ui

```sh
env DSH_HOME=/tmp/fusion-rc7-webui pnpm dsh plugin --profile web add \
  @linxin666/dsh-client-ui-web-ui-settings@0.2.2 \
  @linxin666/dsh-client-ui-task-board@0.2.2 \
  @linxin666/dsh-client-ui-git-graph@0.2.2 \
  @linxin666/dsh-remote-web-ui@0.2.2 \
  @linxin666/dsh-ssh@0.2.2 \
  @linxin666/dsh-pet@0.2.2 \
  @linxin666/dsh-client-ui-skin-center@0.2.2 \
  @linxin666/dsh-liangshen@0.2.2
env DSH_HOME=/tmp/fusion-rc7-webui pnpm dsh --profile web --dump-config
env DSH_HOME=/tmp/fusion-rc7-webui pnpm dsh --profile web --host 127.0.0.1 --port 53103
```

dump-config 含八个预期 standalone rows。Chrome `151` 的 CDP 1.3 端点为 `http://127.0.0.1:9333`，target 打开 `http://127.0.0.1:53103/`；七个 browser-side client bundle 均为 200，`@linxin666/dsh-liangshen` 的 Host row 同树激活，无 Runtime exception、Log/console warning/error 或非取消 network failure。

逐包隔离验证采用相同的精确安装、dump、后台 Web、CDP 导航与诊断检查：`web-ui-settings`→53201、`task-board`→53202、`git-graph`→53203、`pet`→53204、`remote-web-ui`→53205、`ssh`→53206、`skin-center`→53207、`liangshen`→53208。七个 browser-side 包各自出现在 `window.__DSH_BOOT__.entries`，对应 client bundle 为 200，且 diagnostics 为空；Liangshen 单独同步完整五文件 preset。每次验证均在独立 `DSH_HOME` 运行并在结束后停止服务。

### dsh-TUI

```sh
env DSH_HOME=/tmp/fusion-rc7-tui pnpm dsh plugin --profile fusion-tui add @deepseek-harness-tui/dsh-tui@0.8.3
env DSH_HOME=/tmp/fusion-rc7-tui pnpm dsh --profile fusion-tui --dump-config
TERM=xterm-256color DSH_HOME=/tmp/fusion-rc7-tui \
  /usr/bin/script -q -e /tmp/fusion-rc7-tui/tui.typescript \
  pnpm dsh --profile fusion-tui
```

安装和 dump-config exit 0。`/usr/bin/script` 分配真实 PTY；主运行 20 秒内渲染 `dsh-TUI v0.8.3`、上下文状态、输入框和 25 个工具，随后进程组收到 SIGINT 并按预期 exit 130。直接 drift probe exit 0，`validated` 为 `0.1.0-rc.7` 且 `drift` 为空。

## 精确挂载策略

fusion 使用精确版本的 modlens、better-sidebar 和七个需要运行时 row 的 web-ui 子包。不安装 `@linxin666/dsh-web-ui-all@0.2.2`，因为其 patch 会插入 15 rows、固定旧版 better-sidebar，并启用目标外插件。

`@linxin666/dsh-liangshen@0.2.2` 已通过 rc.7 runtime 验证，但 fusion 不挂载其 Host 同步 row。Task 3 直接从该精确发布物复制完整 preset：

- `preset.yml`
- `agent.cordis.yml`
- `tool-bootstrap.mjs`
- `custom-bash.mjs`
- `NOTICE`

目标为 `apps/cli/config/agent-presets/liangshen/`，即 dsh system preset root。不得只改写两个 YAML 文件或遗漏辅助模块与 NOTICE。

## Liangshen ownership

Task 3 的 system-root 副本是 canonical Liangshen。dsh 的 preset roots 按 system root、user root 排序，并对重复 id 使用 first-root-wins，因此 `fusion` 和 `fusion-tui` 都解析 system-root `liangshen`；TUI 写入 `$DSH_HOME/.agent-presets/liangshen` 的 user-root 副本不参与解析或激活。

这不表示 TUI 副本完全消失。`@deepseek-harness-tui/dsh-tui@0.8.3` 启动时仍执行 packaged-preset 同步，会在磁盘写入 user-root 副本和 `.dsh-tui-managed.json`，且没有关闭开关。Task 3 只能消除运行时 ownership 歧义，不能消除物理重复；这是 Known Limitation。

## COMPAT records

```text
COMPAT['@liustack/modlens'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '3.21.1', status: 'ok', notes: 'runtime-modlens-rc7 PASS; Web 53101; Chrome CDP 9333 clean' }
COMPAT['dsh-better-sidebar'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.13.1', status: 'ok', notes: 'runtime-sidebar-rc7 PASS; Web 53102; Chrome CDP 9333 clean; node-pty explicitly allowed in the temporary profile' }
COMPAT['@linxin666/dsh-client-ui-web-ui-settings'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.2.2', status: 'ok', notes: 'runtime-webui-rc7 PASS; row ui-web-ui-settings' }
COMPAT['@linxin666/dsh-client-ui-task-board'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.2.2', status: 'ok', notes: 'runtime-webui-rc7 PASS; row ui-task-board' }
COMPAT['@linxin666/dsh-client-ui-git-graph'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.2.2', status: 'ok', notes: 'runtime-webui-rc7 PASS; row ui-git-graph' }
COMPAT['@linxin666/dsh-remote-web-ui'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.2.2', status: 'ok', notes: 'runtime-webui-rc7 PASS; row remote-web-ui' }
COMPAT['@linxin666/dsh-ssh'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.2.2', status: 'ok', notes: 'runtime-webui-rc7 PASS; row ssh' }
COMPAT['@linxin666/dsh-pet'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.2.2', status: 'ok', notes: 'runtime-webui-rc7 PASS; row pet' }
COMPAT['@linxin666/dsh-client-ui-skin-center'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.2.2', status: 'ok', notes: 'runtime-webui-rc7 PASS; row ui-skin-center' }
COMPAT['@linxin666/dsh-liangshen'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.2.2', status: 'ok', notes: 'runtime-webui-rc7 PASS; Task 3 source for the complete system-root preset, not a fusion runtime row' }
COMPAT['@deepseek-harness-tui/dsh-tui'] = { compatibleDshVersion: '0.1.0-rc.7', pkgVersion: '0.8.3', status: 'ok', notes: 'runtime-tui-rc7 PASS in a real PTY; no upstream drift' }

DESKTOP_COMPAT = {
  target: 'v2.0.1',
  compatibleDshVersion: '0.1.0-rc.7',
  staticContract: 'ok',
  runtimeStatus: 'pending',
  notes: 'real macOS/Windows Electron validation belongs to the Desktop repository',
}
```

## Desktop static contract

Desktop rows remain `desktop-shell`、`community-market`、`desktop-terminal`、`desktop-diagnostics`、`desktop-pnpm`、`desktop-profiles` and `desktop-updates`. Desktop has no mobile-remote package, row or disable flag. The fusion profile must not persist `dsh-plugin-desktop`; the Desktop launcher selects a Web-capable profile and then applies its own patch.

This repository has not installed, built or launched Desktop. Real Host startup, BrowserWindow, tray, profile switching, market, terminal, updates, renderer console, license closure and installers remain external runtime work.

## Implementation notes

pnpm lifecycle scripts require explicit decisions: `node-pty@1.1.0`, `ssh2@1.17.0`, optional `cpu-features@0.0.10` and `cloudflared@0.7.3` must not be blanket-allowed. The rc.7 runtime records prove the isolated profiles used for this matrix; later fusion installation must preserve explicit allow/deny decisions.

## Concerns

1. Desktop still requires external-repository macOS/Windows Electron, renderer-console, license and installer validation against one exact rc.7 npm package family.
2. Task 3 makes the complete web-ui `0.2.2` Liangshen preset canonical in the system root, but TUI `0.8.3` still writes an unused user-root disk copy and provides no disable switch.

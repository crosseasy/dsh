# 组装 Fusion Web profile

[English](fusion-profile.md) | 中文

Fusion Web profile 在标准 Web 应用上保留外部集成发行层。Pet 与 Git Graph `0.2.9` 已满足全部准入判据，因此该 profile 增加这两条配置行，同时保留三个组合包层：`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 和 `@deepseek-ai/dsh-fusion`。

## 前置条件

使用 `@deepseek-ai/dsh@0.1.0-rc.5`、Node.js 22.19.0 或 24.0.0 及以上版本，以及 pnpm。这些命令会替换新 profile 的 pnpm workspace 设置，因此需要全新的 `DSH_HOME`。

## 创建 profile

创建临时 Harness home，并以与 `dsh` 相同的精确版本添加 Fusion 组合包：

```sh
export DSH_HOME="$(mktemp -d "${TMPDIR:-/tmp}/dsh-fusion.XXXXXX")"
export FUSION_PROFILE="$DSH_HOME/profiles/fusion"

dsh plugin --profile fusion add @deepseek-ai/dsh-fusion@0.1.0-rc.5
dsh plugin --profile fusion add \
  @linxin666/dsh-client-ui-git-graph@0.2.9 \
  @linxin666/dsh-pet@0.2.9 \
  react@18.3.1 \
  react-dom@18.3.1

node --input-type=module - "$FUSION_PROFILE/package.json" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs'

const path = process.argv[2]
const manifest = JSON.parse(readFileSync(path, 'utf8'))
manifest.dsh.profile.bundles = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-fusion',
]
writeFileSync(path, `${JSON.stringify(manifest, undefined, 2)}\n`)
NODE
```

`base` 与 `web-app` 组合包从已安装的 `dsh` 解析，profile 依赖则提供 `fusion`。归一化步骤会明确固定三者的顺序，并防止其他已安装包的组合包声明成为 profile 层。

## 固定 profile 依赖

两个已接受包及其 React peer 由 profile 持有，不需要原生构建许可。请精确保留新发布版本例外：

```sh
cat > "$FUSION_PROFILE/pnpm-workspace.yaml" <<'YAML'
packages:
  - .
nodeLinker: hoisted
autoInstallPeers: false
minimumReleaseAgeExclude:
  - '@linxin666/dsh-client-ui-git-graph@0.2.9'
  - '@linxin666/dsh-pet@0.2.9'
YAML
```

不要把 ModLens、SSH、Remote Web UI 或其传递构建许可加入该 profile 或仓库根目录。

## 确认精确外部依赖

Fusion 包的 [`dsh.bundle.profileDependencies`](../../../packages/bundle/fusion/package.json) 仅包含 Pet 与 Git Graph `0.2.9`，其 patch 只插入 `pet` 与 `ui-git-graph`。其他外部候选必须由一个已发布版本通过完整的许可证、安全、生命周期、所有权、去重、rc.5 和组合运行时判据后才能安装。

## 验证 profile manifest（元数据清单）

启动前检查精确的组合包列表与五项依赖映射：

```sh
node --input-type=module - "$FUSION_PROFILE/package.json" <<'NODE'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const expectedBundles = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-fusion',
]
const expectedDependencies = {
  '@deepseek-ai/dsh-fusion': '0.1.0-rc.5',
  '@linxin666/dsh-client-ui-git-graph': '0.2.9',
  '@linxin666/dsh-pet': '0.2.9',
  react: '18.3.1',
  'react-dom': '18.3.1',
}

if (JSON.stringify(manifest.dsh?.profile?.bundles) !== JSON.stringify(expectedBundles)) {
  throw new Error('fusion profile bundle order does not match the documented recipe')
}
if (Object.keys(manifest.dependencies ?? {}).length !== Object.keys(expectedDependencies).length) {
  throw new Error('fusion profile dependencies do not match the documented recipe')
}
for (const [name, version] of Object.entries(expectedDependencies)) {
  if (manifest.dependencies?.[name] !== version) throw new Error(`${name} must be ${version}`)
}
console.log('fusion profile manifest verified')
NODE
```

该命令会打印 `fusion profile manifest verified`。

## 启动 Web UI

在可用端口上启动该 profile：

```sh
dsh --profile fusion --port 3080
```

打开命令打印的 URL。页面保留 stock Web 界面，包括左侧 `ui-sidebar`、Settings 与 New Session 入口。Pet 显示为唯一的全局 dock，Git Graph 为基于 Git workspace 的会话增加唯一的分支 chip。在新会话的 agent preset 选择器中选择**梁神模式**。Web API 返回的 preset roster 使用 id `liangshen`；该 preset 由仓库持有，不属于 Fusion 外部配置行。

checked-in 浏览器验收通过系统 Chrome CDP `9333` 启动该两行配方。它会验证精确包与配置行身份、唯一 Pet root、唯一 Git Graph chip、Pet 状态与 Git 分支探针返回实时数据、阻塞包缺失、stock Web 可见性、干净诊断与清理。

## 已知限制

- 该 profile 包含两条外部配置行。图像理解、SSH、移动端远程 UI、Task Board、Skin Center，以及右侧 Files、editor、终端和 Source Control 工作台仍不可用。请勿通过安装其他候选包或增加 profile 配置行绕过准入。拥有该决策的 [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) 定义已接受集合、各包的具体阻塞原因与重验要求。

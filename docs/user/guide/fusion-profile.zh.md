# 组装 Fusion Web profile

[English](fusion-profile.md) | 中文

Fusion Web profile 在标准 Web 应用上保留外部集成发行层。目前没有外部包满足全部准入判据，因此该 profile 不增加外部配置行，但仍保留三个组合包层：`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 和 `@deepseek-ai/dsh-fusion`。

## 前置条件

使用 `@deepseek-ai/dsh@0.1.0-rc.5`、Node.js 22.19.0 或 24.0.0 及以上版本，以及 pnpm。这些命令会替换新 profile 的 pnpm workspace 设置，因此需要全新的 `DSH_HOME`。

## 创建 profile

创建临时 Harness home，并以与 `dsh` 相同的精确版本添加 Fusion 组合包：

```sh
export DSH_HOME="$(mktemp -d "${TMPDIR:-/tmp}/dsh-fusion.XXXXXX")"
export FUSION_PROFILE="$DSH_HOME/profiles/fusion"

dsh plugin --profile fusion add @deepseek-ai/dsh-fusion@0.1.0-rc.5

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

## 保持 profile 不含外部包

当前 Fusion profile 不需要外部依赖或构建许可。请保持最小 pnpm workspace 设置：

```sh
cat > "$FUSION_PROFILE/pnpm-workspace.yaml" <<'YAML'
packages:
  - .
YAML
```

不要把 ModLens、SSH、Remote Web UI、对应的 React peer provider 或传递构建许可加入该 profile 或仓库根目录。

## 确认零外部依赖

Fusion 包的 [`dsh.bundle.profileDependencies`](../../../packages/bundle/fusion/package.json) 为 `{}`，patch 也为空。在已发布版本通过完整的许可证、安全、生命周期、rc.5 和组合运行时判据前，请勿安装任何外部候选。

## 验证 profile manifest（元数据清单）

启动前检查精确的组合包列表，并确认 profile 的 `dependencies` 中没有声明任何阻塞包：

```sh
node --input-type=module - "$FUSION_PROFILE/package.json" <<'NODE'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const expectedBundles = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-fusion',
]
const blockedPackages = [
  '@liustack/modlens',
  '@linxin666/dsh-ssh',
  '@linxin666/dsh-remote-web-ui',
  '@linxin666/dsh-web-ui-all',
  '@linxin666/dsh-client-ui-task-board',
  '@linxin666/dsh-pet',
  '@linxin666/dsh-client-ui-git-graph',
  '@linxin666/dsh-client-ui-skin-center',
  'dsh-better-sidebar',
]

if (JSON.stringify(manifest.dsh?.profile?.bundles) !== JSON.stringify(expectedBundles)) {
  throw new Error('fusion profile bundle order does not match the documented recipe')
}
for (const name of blockedPackages) {
  if (manifest.dependencies?.[name] !== undefined) throw new Error(`${name} is blocked`)
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

打开命令打印的 URL。页面保持 stock Web 界面，包括左侧 `ui-sidebar`、Settings 与 New Session 入口。在新会话的 agent preset 选择器中选择**梁神模式**。Web API 返回的 preset roster 使用 id `liangshen`；该 preset 由仓库持有，不属于 Fusion 外部配置行。

checked-in 浏览器验收通过系统 Chrome CDP `9333` 启动该零行配方。它会验证全部 8 个阻塞集成都没有 Host 配置行、浏览器入口、客户端资源、UI root、路由或工具，同时 stock Web 界面保持可见，诊断和清理均无异常。

## 已知限制

- 该 profile 包含零条外部配置行，因此不提供图像理解、SSH、移动端远程 UI、Task Board、Pet、Git Graph、Skin Center，以及右侧 Files、editor、terminal 和 Source Control 工作台。请勿通过安装候选包或增加 profile 配置行绕过准入。拥有该决策的 [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) 定义零行决策、各包的具体阻塞原因与重验要求。

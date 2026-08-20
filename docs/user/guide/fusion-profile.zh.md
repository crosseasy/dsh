# 组装 Fusion Web profile

[English](fusion-profile.md) | 中文

Fusion Web profile 在标准 Web 应用上增加经过筛选的 modlens 与 Web UI 插件。以下步骤会创建一个隔离 profile，其中包含三个组合包层：`@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` 和 `@deepseek-ai/dsh-fusion`。

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

## 允许必要的包构建

把构建许可写入当前 profile，不要写入仓库或其他 profile：

```sh
cat > "$FUSION_PROFILE/pnpm-workspace.yaml" <<'YAML'
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false

allowBuilds:
  cloudflared@0.7.3: true
  cpu-features@0.0.10: true
  ssh2@1.17.0: true
YAML
```

这三项是当前 profile 所需的全部构建许可。不要把它们加入仓库根目录。

## 安装 profile 自有包

通过 profile 的 pnpm 安装根直接安装 [`dsh.bundle.profileDependencies`](../../../packages/bundle/fusion/package.json) 记录的六个包及其 React 对等依赖（peer dependency）提供方：

```sh
pnpm --dir "$FUSION_PROFILE" add --save-exact \
  @liustack/modlens@3.22.0 \
  @linxin666/dsh-client-ui-task-board@0.2.4 \
  @linxin666/dsh-ssh@0.2.4 \
  @linxin666/dsh-remote-web-ui@0.2.4 \
  @linxin666/dsh-pet@0.2.4 \
  @linxin666/dsh-client-ui-skin-center@0.2.4 \
  react@18.3.1 \
  react-dom@18.3.1
```

使用 profile-local pnpm 会把这些包留在 `profiles/fusion/node_modules` 中，而不会把它们各自声明的组合包追加到 `dsh.profile.bundles`。如需复现安装，应一起保留 `package.json`、`pnpm-lock.yaml` 和 `pnpm-workspace.yaml`。

## 验证 profile manifest

启动前检查精确的组合包列表和 profile 自有依赖版本：

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
  '@liustack/modlens': '3.22.0',
  '@linxin666/dsh-client-ui-task-board': '0.2.4',
  '@linxin666/dsh-ssh': '0.2.4',
  '@linxin666/dsh-remote-web-ui': '0.2.4',
  '@linxin666/dsh-pet': '0.2.4',
  '@linxin666/dsh-client-ui-skin-center': '0.2.4',
  react: '18.3.1',
  'react-dom': '18.3.1',
}

if (JSON.stringify(manifest.dsh?.profile?.bundles) !== JSON.stringify(expectedBundles)) {
  throw new Error('fusion profile bundle order does not match the documented recipe')
}
for (const [name, version] of Object.entries(expectedDependencies)) {
  if (manifest.dependencies?.[name] !== version) {
    throw new Error(`${name} must resolve from the profile at ${version}`)
  }
}
console.log('fusion profile manifest verified')
NODE
```

该命令会打印 `fusion profile manifest verified`。如果缺少外部包，profile 启动时会通过正常插件解析流程报错。

## 启动 Web UI

在可用端口上启动该 profile：

```sh
dsh --profile fusion --port 3080
```

打开命令打印的 URL。左侧会话栏仍使用标准 `ui-sidebar`；同一页面还会显示任务看板、皮肤中心、宠物停靠区、移动端远程控制，以及 modlens 图像／设置入口。在新会话的 agent preset 选择器中选择**梁神模式**。Web API 返回的 preset roster 使用 id `liangshen`。

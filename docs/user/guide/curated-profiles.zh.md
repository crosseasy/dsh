# 使用精选 profile

[English](curated-profiles.md) | 中文

DeepSeek Harness 交付五个受治理的 Web profile 模板：`web-curated`、`web-coding`、`web-research`、`web-enterprise` 和 `web-personal`。每个模板都固定其组合包顺序、包管理器策略和已准入依赖集合。当你希望在 Loader 激活前运行这些检查，而不是维护不受限制的自定义 profile 时，请使用精选 profile。

## 选择 profile

| Profile | 适用场景 |
|---|---|
| `web-curated` | 通用受治理 Web 基线 |
| `web-coding` | 面向编码的候选轨道 |
| `web-research` | 面向研究的候选轨道 |
| `web-enterprise` | 企业策略轨道 |
| `web-personal` | 个人界面轨道 |

当前五个模板都只包含安装自有的 `dsh-base`、`dsh-web-app` 和 `dsh-curated-base` 组合包。没有已审计的第三方候选处于 runtime-active 状态。

## 检查依赖集合

列出固定的第三方依赖集合，不创建 profile 状态，也不调用 pnpm：

```sh
dsh plugin --profile web-curated list
```

当前 `web-curated` 模板会报告：

```text
web-curated:
  (no third-party plugin dependencies)
```

将 `web-curated` 替换为另一个内置精选 profile 名称，即可检查对应模板。

## 安装 profile

安装模板的确切依赖集合：

```sh
dsh plugin --profile web-curated install
```

安装过程离线运行，并禁用依赖生命周期脚本。它会在激活 staged 目录之前校验生成的 profile 文件、两份 pnpm lockfile、组合包解析和精选准入。本地缺少包时，安装会失败而不会访问网络。激活前失败时，此前的 live profile 保持不变；激活开始后，只有 activated 与 previous 目录的 identity 仍匹配时，回滚才会恢复旧 profile。精选 profile 会拒绝 `add`、`remove`、包变换、构建授权和额外的 `install` 参数。

## 验证并启动

启动服务器前检查已准入的组合：

```sh
dsh --profile web-curated --dump-config
```

然后启动 Web UI，但不自动打开浏览器：

```sh
dsh --profile web-curated --no-open
```

已安装的发行包包含所需的 Client bundle。源码 checkout 必须先完成 `pnpm run build`；否则启动会报告缺少 `lib/client.js` 产物。服务器打印 URL 后，请按 [Web UI 指南](index.zh.md)配置模型和工作区。

## 限制

精选 profile 名称与依赖集合由已安装发行版本固定。当前模板提供治理基础设施，但不提供第三方 runtime 行为。[精选插件子系统参考](../../subsystems/curated.zh.md)负责准入语义与证据要求；[CLI（命令行界面）参考](../../../apps/cli/reference/README.zh.md)负责命令限制与恢复行为。

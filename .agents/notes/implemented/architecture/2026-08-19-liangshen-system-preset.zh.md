# Agent Note: Liangshen 是规范 system preset

Status: implemented

[English](2026-08-19-liangshen-system-preset.md) | 中文

## Problem

Web Liangshen 包与 dsh-TUI 都分发名为 `liangshen` 的 preset，但它们通过 Host 启动代码将其安装到 Harness home 下的可写 preset 根目录。两者的 preset 内容不同；若保留任一同步器作为运行时组合，实际实现将取决于哪个 Host 先运行以及哪个包最后改写该目录。

CLI 已经把 system preset 根目录放在 user root 之前。[agent preset 决策](2026-08-03-per-session-agent-presets.zh.md)将这组有序目录作为部署名单，并让第一个根目录拥有重复 id。

## Decision

`apps/cli/config/agent-presets/liangshen/` 是本 CLI 组合的所有 profile 共用的规范 `liangshen` 实现。它包含 `@linxin666/dsh-liangshen@0.2.2` 在 `presets/liangshen/` 下发布的完整五文件 preset：

- `preset.yml`
- `agent.cordis.yml`
- `tool-bootstrap.mjs`
- `custom-bash.mjs`
- `NOTICE`

五个文件均按字节复制。同级 `licenses/` 目录保留发布包针对两阶段隔离扩展的完整 Apache-2.0 许可证，以及改编来源 DeepSeek Harness 内置 Minimal 与 Standard preset 和 `xiaobright/dsh-anchored-standard` 的两份完整 MIT 许可证。保留的 `NOTICE` 标明了哪些文件包含这些来源部分。

`apps/cli/tests/web-agent-presets.e2e.ts` 以原始 `Buffer` 读取五个规范文件，并固定各自的 SHA-256 摘要。因此，本地改写、换行符转换或不完整的来源更新都会在 assembled Web e2e 中失败，无法静默重定义该 preset。

组合不挂载 `@linxin666/dsh-liangshen` Host 配置项，fusion 依赖中也不包含该包。它的 Host 插件只会把随包 preset 同步到 user root 并发布说明；在 system-root 组合之外执行这些操作只会产生第二个所有者，不会增加行为。该选择保留了[精选 fusion 组合包](2026-08-19-curated-fusion-bundle.zh.md)确立的职责划分：fusion 选择 Web 插件，CLI preset 名单拥有 Liangshen。

dsh-TUI 0.8.3 仍会把随包的 `liangshen` 目录与 `.dsh-tui-managed.json` 标记写入 `$DSH_HOME/.agent-presets/liangshen`；该版本没有关闭同步的开关。因此，user-root 物理副本仍存在于磁盘上。它不参与发现、解析或激活，因为配置中的 system root 排在前面，first-root-wins 会选择规范目录。

## Alternatives considered

**挂载 `@linxin666/dsh-liangshen` Host 同步配置项。** 否决，因为它会在 user root 写入第二份副本，引入一个提取完成后不再需要其插件的运行时依赖，并让升级流程面对两个独立所有者。

**把 dsh-TUI 的 user-root 副本作为共享实现。** 否决，因为其文件与选定的 Web 实现不同，而且顺序靠后的 user root 无法覆盖随部署交付的 system id。

**仅为阻止磁盘副本而 fork dsh-TUI。** 否决，因为未使用的副本不影响解析，而维护产品 fork 只为删除惰性文件增加了代码和发布职责。

## Consequences

Web 与 TUI profile 都解析同一个 system-owned `liangshen` 目录。其初始组装工具清单精确为 `bash` 和 `str_replace_editor`；平台门控在 POSIX 上选择持久 Bash，在 Windows 上选择复制的 Git Bash 适配器。

升级 Liangshen 时，必须选择一个新的精确发布来源，一并审查五个文件，不作本地改写地复制它们，更新固定的哈希与保留的许可证，保留 notice，并重新运行组合、root precedence、Windows 门控与许可证检查。TUI 管理的 user 副本可以独立漂移，但只要 system root 保留该 id，它就不会激活。

# @deepseek-ai/dsh-permission-presets

## Summary

`dsh-permission-presets` 把 sandbox mode 和 approval policy 组合成用户可选的 Permissions preset。它写入自己的 session event，同时把两个底层机制的值交给各自服务。

## 适用场景

- 用户界面需要一个“权限”选择器，而不是分别暴露 sandbox 和 approval。
- 部署需要为新 session 设置默认权限。
- 需要 `/permission` 命令和 Web 权限设置读取同一套 session projection。

## 启用与启动

- headless 和 web 默认配置 dump 都显示该插件。
- 该插件需要 `shell`、`approval`、`sessions` 和 `sessionProjections`。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-permission-presets'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 在配置中声明 `presets` 和可选 `defaultPreset`，或使用 base 默认表。
- 通过 Web 设置或 `/permission <preset>` 切换当前 session 的权限 preset。
- 需要读取当前状态时，使用 `ctx.permissionPresets.current(session)` 或对应投影。

## 可观察结果

- 切换 preset 会写入 `permission/preset`，并通过正式 setter 写入底层 knob。
- 不匹配任何 preset 的组合显示为派生的 `custom`。
- 源码测试覆盖 preset 应用、projection 和 invariant。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-permission-presets`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/permission-presets.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:236`；源码入口见 [packages/interaction/permission-presets/src/index.ts](../../../../packages/interaction/permission-presets/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1、C2；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/interaction/permission-presets/README.md`](../../../../packages/interaction/permission-presets/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-permission-presets)。
- 源码测试路径：`packages/interaction/permission-presets/tests/permission-presets.spec.ts`、`packages/interaction/permission-presets/tests/projection.spec.ts`、`packages/interaction/permission-presets/tests/invariant.spec.ts`。

## 限制与故障排查

- 该插件不执行 sandbox 或 approval enforcement。
- 本轮没有点击 Web 权限 selector。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

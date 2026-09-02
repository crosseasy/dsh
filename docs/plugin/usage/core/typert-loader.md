# @deepseek-ai/dsh-typert-loader

## Summary

`dsh-typert-loader` 把已装配包导出的 Typert reflection 和 schema 注册到运行时 registry，并在插件卸载时撤回。它让 Remote API、client 和其他反射消费者看到当前组合。

## 适用场景

- Loader composition 中的包需要把生成的 `./typert` 元数据贡献给运行时。
- 嵌套在另一个 Loader entry 后的包需要通过显式 `packages` 列表注册 reflection。
- 动态装卸插件时，需要 Typert registry 跟随 fiber 生命周期撤回条目。

## 启用与启动

- headless 默认配置 dump 显示该插件。
- 该插件需要 `typert` 和 `loader` 服务；可选 `packages` 列表使用精确 npm 包名。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-typert-loader'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 在组合靠前位置装配该插件，让后续 Loader fiber 可被解析。
- 对嵌套贡献，在 config 中填写 `packages`。
- 通过依赖 Typert registry 的 API 或 client runtime 观察反射结果。

## 可观察结果

- 有 `./typert` export 的包会注册 reflection；没有该 export 的包被跳过。
- 卸载包或插件时，对应 reflection 从 registry 撤回。
- 源码测试覆盖 loader 集成和 package resolution。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-typert-loader`，category 为 `core`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/core/typert-loader.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:43`；源码入口见 [packages/typert/loader/src/index.ts](../../../../packages/typert/loader/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/typert/loader/README.md`](../../../../packages/typert/loader/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-typert-loader)。
- 源码测试路径：`packages/typert/loader/tests/loader.spec.ts`。

## 限制与故障排查

- 这是 Node-only loader 集成，不是浏览器插件。
- 本轮没有动态卸载场景。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

# @deepseek-ai/dsh-fusion 使用指南

## Summary

提供 fusion profile 的外部 Pet 集成 patch 层，manifest 记录 `@linxin666/dsh-pet@0.2.9` profile dependency。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要在已有 base 与 web-app 层之后加入已准入的 Pet 外部集成。
- 需要校验 fusion profile 的外部依赖声明。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`bundle`。
- Inventory 装配入口：`packages/bundle/fusion/cordis.patch.yml (bundle manifest dsh.bundle.patch)`。
- Inventory 类型为 `bundle`，manifest 使用 `dsh.bundle.patch` 指向 `packages/bundle/fusion/cordis.patch.yml`。
- 作为 profile 层使用时，用 `dsh plugin --profile <name> add <package-or-local-path>` 加入目标 profile；随发行版 profile 已包含的 bundle 不需要重复添加。
```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-fusion
```


## 实际使用

- 在已经包含 base 与 web-app 的 profile 中添加本 bundle。
- 确认 profile dependency 提供 `@linxin666/dsh-pet@0.2.9`。

## 可观察结果

- Fusion bundle manifest and patch declare the external Pet dependency relationship. The external Pet package was not installed or booted here.
- Inventory 预期成功信号：Loader entry list contains the patch rows declared by the bundle manifest.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Bundle patch parse。
- 证据记录：Patch parse reported `pet:@linxin666/dsh-pet` and `profileDeps={"@linxin666/dsh-pet":"0.2.9"}`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本轮没有安装或启动外部 Pet 包；只验证 bundle manifest 与 patch 声明。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

# @deepseek-ai/dsh-curated-base 使用指南

## Summary

提供精选 profile 的静态基础层，插入 curated-policy 与 curated-bench 两个精选服务行。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要加载精选插件准入策略与 benchmark 资产服务。
- 需要确认 web-curated profile 处于 fail-closed 的精选基础状态。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`bundle`。
- Inventory 装配入口：`packages/curated/curated-base/cordis.patch.yml (bundle manifest dsh.bundle.patch)`。
- Inventory 类型为 `bundle`，manifest 使用 `dsh.bundle.patch` 指向 `packages/curated/curated-base/cordis.patch.yml`。
- 作为 profile 层使用时，用 `dsh plugin --profile <name> add <package-or-local-path>` 加入目标 profile；随发行版 profile 已包含的 bundle 不需要重复添加。
```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-curated-base
```


## 实际使用

- 把本 bundle 加到精选 profile 的 bundle 列表。
- 检查最终配置中是否出现 curated-policy 与 curated-bench 行。

## 可观察结果

- Curated-base inserts only curated policy and benchmark services.
- Inventory 预期成功信号：Loader entry list contains the patch rows declared by the bundle manifest.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Profile dump, bundle patch parse, and tests。
- 证据记录：Web-curated dump includes `# == @deepseek-ai/dsh-curated-base` with `curated-policy` and `curated-bench`; patch parse reported the same two rows; `curated-base/tests/bundle.spec.ts` passed 4 tests.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本 bundle 不安装第三方候选，也不执行候选 runtime。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

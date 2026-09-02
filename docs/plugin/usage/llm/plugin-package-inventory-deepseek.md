# @deepseek-ai/dsh-plugin-package-inventory-deepseek

## Summary

把当前存活 Loader 插件包清单作为 DeepSeek 官方 API 的请求扩展字段。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/llm/plugin-package-inventory-deepseek/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- DeepSeek 官方 API 需要知道当前请求来自哪些已加载插件包。
- 调试提供方请求时需要把 Loader 存活清单随请求传递。

## 启用与启动

- Inventory 分类：`llm`；类型：`cordis-plugin`。
- 本轮装配入口：`packages/llm/plugin-package-inventory-deepseek/src/index.ts:186; mounted by packages/bundle/base/cordis.patch.yml:71, packages/bundle/sdk-minimal/cordis.patch.yml:24`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-plugin-package-inventory-deepseek'
```

## 实际使用

- 与 DeepSeek 官方适配器和 API extensions 一起挂载。
- 启动 profile 后发起 DeepSeek 官方路由请求。
- 适配器把存活 Loader 插件包清单写入 `dsh_plugin_packages` 字段。

## 可观察结果

- DeepSeek package inventory metadata is registered and test-covered.
- Inventory 预期成功信号：A configured run reaches the documented provider/registry path, or a keyless degradation reports the missing credential explicitly.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- Inventory 记录：`packages/llm/plugin-package-inventory-deepseek/src/index.ts:186; mounted by packages/bundle/base/cordis.patch.yml:71, packages/bundle/sdk-minimal/cordis.patch.yml:24`。
- 本轮命令证据：Dumps include `plugin-package-inventory-deepseek`; base and sdk-minimal patch parses include it; `packages/llm/plugin-package-inventory-deepseek/tests/inventory.spec.ts` passed 11 tests.。
- 本轮环境记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；真实提供方调用未执行。

## 限制与故障排查

- 没有 API key 时，本轮只验证字段注册和 inventory 测试，未观察真实 API 请求携带该字段。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

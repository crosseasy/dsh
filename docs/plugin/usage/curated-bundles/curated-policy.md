# @deepseek-ai/dsh-curated-policy 使用指南

## Summary

提供精选插件 allowlist、准入策略和只读策略查询服务。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要判断候选插件是否能进入精选 profile。
- 需要验证 web-curated 当前没有第三方 runtime 依赖。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`cordis-plugin`。
- Inventory 装配入口：`packages/curated/curated-policy/src/index.ts:1371; mounted by packages/curated/curated-base/cordis.patch.yml:7`。
- Inventory 类型为 `cordis-plugin`，通过目标 profile 的 Cordis 行挂载。
- 手动组合时，将插件行加入目标 `cordis.yml`，并确认依赖服务也在同一配置树中。
```yaml
- name: '@deepseek-ai/dsh-curated-policy'
```


## 实际使用

- 通过 curated-base 挂载该插件。
- 运行 `pnpm dsh plugin --profile web-curated list` 观察当前精选依赖。

## 可观察结果

- Curated policy enforces current inactive posture: no third-party runtime candidates enter the profile, and active-candidate evidence is consistent with the empty active set.
- Inventory 预期成功信号：Observable behavior matches package purpose: Curated plugin admission and policy catalog

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Curated-base assembly, CLI, gate, and focused tests。
- 证据记录：Web-curated dump includes `curated-policy`; `dsh plugin --profile web-curated list` reports no third-party dependencies; `pnpm run verify-curated-activation-evidence` passed; filtered policy tests passed 2 tests.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 当前 web-curated active set 为空；本轮验证的是 fail-closed 策略和证据门。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

# @deepseek-ai/dsh-experimental-inspector 使用指南

## Summary

提供实验性 Host 与浏览器 Client Cordis runtime 检查能力，用于 Chrome DevTools 和查询 API。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要在源码 checkout 中检查 Host/Client runtime。
- 需要实验性观察 Console、Sources、Network 或 Cordis tree。
- 本页按 inventory 的 `experimental` 分类处理：它记录源码 checkout 中可观察或可解析的实验装配，不表示稳定发布 API。
- 未在本轮证据中执行的 UI、Team runtime 或真实工具调用，不在本页声明为已验证。

## 启用与启动

- Inventory 分类：`experimental`；类型：`client-runtime-plugin`。
- Inventory 装配入口：`packages/experimental/inspector/src/index.ts:106; docs/config-catalog.md`。
- Inventory 类型为 `client-runtime-plugin`，通过目标 profile 的 Cordis 行挂载。
- 手动组合时，将插件行加入目标 `cordis.yml`，并确认依赖服务也在同一配置树中。
```yaml
- name: '@deepseek-ai/dsh-experimental-inspector'
```


## 实际使用

- 在支持它的实验配置中挂载该插件。
- Web 可见检查需要 Chrome CDP；本轮没有执行 UI/DevTools 路径。

## 可观察结果

- Not exercised in this non-UI pass. The package is browser/inspector-facing, so only source/test availability is recorded here.
- Inventory 预期成功信号：The browser plugin roster loads this package and its transport/module/locale service is observable from the Web app.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Static source/test entry only。
- 证据记录：Inventory points to `packages/experimental/inspector/src/index.ts`; tests exist under `packages/experimental/inspector/tests/*`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 实验包不作为稳定发布承诺；本轮只记录源码与测试入口，未做 UI 实测。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

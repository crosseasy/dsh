# @deepseek-ai/dsh-web-app 使用指南

## Summary

提供浏览器 GUI profile 层，声明 Web host、transport、client roster、settings、conversation 和 agent-presets 行。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前条目，事实来源为 `/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 与 `/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。

## 适用场景

- 需要在浏览器中进行交互式会话。
- 需要验证 web-curated 或 web profile 的 Web 层装配。

## 启用与启动

- Inventory 分类：`curated-bundles`；类型：`bundle`。
- Inventory 装配入口：`packages/bundle/web-app/cordis.patch.yml (bundle manifest dsh.bundle.patch)`。
- Inventory 类型为 `bundle`，manifest 使用 `dsh.bundle.patch` 指向 `packages/bundle/web-app/cordis.patch.yml`。
- 作为 profile 层使用时，用 `dsh plugin --profile <name> add <package-or-local-path>` 加入目标 profile；随发行版 profile 已包含的 bundle 不需要重复添加。
```sh
dsh plugin --profile <name> add @deepseek-ai/dsh-web-app
```


## 实际使用

- 运行 `pnpm dsh --profile web --no-open --port 3080` 启动本地服务。
- 源码 checkout 需要先完成前端构建；本轮非 UI 证据只覆盖 patch 与配置解析。

## 可观察结果

- Web-app layer parse and config replacement path are observable without opening the browser. UI behavior was out of this non-UI pass.
- Inventory 预期成功信号：Loader entry list contains the patch rows declared by the bundle manifest.

## 验证证据

- Inventory：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json`。
- Task 3 证据：`/tmp/dsh-plugin-usage-evidence/verification-llm-bundles.md`。
- 验证方式：Curated profile dump and bundle patch parse。
- 证据记录：Web-curated dump shows web-app patches on base rows; patch parse reported `entries=29`, `ids=87`, including `web-startup`, `webserver`, `web-runtime`, `compaction-basic`, `command-compact`, `tool-web`, and `agent-presets`.。
- 命令环境：verification 文件记录 `DEEPSEEK_API_KEY=unset`、`DEEPSEEK_BASE_URL=unset`；依赖真实 provider 的路径未执行。
- 截图：本分片未新增截图；无已验证浏览器 UI 截图时不引用图片。

## 限制与故障排查

- 本轮没有打开浏览器验证 Web UI；UI 行由其他分片或分类页面记录。
- 如果 profile 中看不到该插件，先用 `pnpm dsh --profile <name> --dump-default-config` 确认最终 Cordis 行，再检查 bundle 或 preset 的有序层是否包含本页记录的装配入口。
- 如果某路径需要外部密钥、第三方包、ACP/SDK client、DevTools 或浏览器交互，本轮只把静态装配、测试或 fail-closed 行为视为已验证。

# @deepseek-ai/dsh-file-reference-local

## Summary

`dsh-file-reference-local` 为 host UI 的 `@file` 输入提供本地文件候选。它按 agent workspace 建立有界索引，并在工具结果后后台刷新候选。

## 适用场景

- Web 或其他 host UI 需要为当前 agent workspace 提供 `@file` 补全。
- 模型可用的 `read` 工具读取 Harness 主机文件系统。
- 大型仓库需要排除构建产物和依赖目录，避免补全阻塞输入。

## 启用与启动

- `pnpm dsh --profile web --dump-default-config` 可看到该插件。
- 自定义组合可设置 `maxResults`、`maxEntries` 和 `excludedDirectories`。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-file-reference-local'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 启动 Web profile，打开会话输入框并输入 `@` 或 `@path`。
- 选择候选文件或目录；带 `/` 的查询直接列目录，普通查询使用模糊排序。
- 工具结果后，下一次候选查询可先返回旧索引并后台刷新。

## 可观察结果

- UI 收到最多 `maxResults` 条候选，并能区分目录候选与文件候选。
- 当 agent 可见 `read` 工具时，系统提示加入一句 `@` 路径读取说明。
- 目录 symlink 不会被遍历，配置排除目录不会出现在候选中。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-file-reference-local`，category 为 `context`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/context/file-reference-local.md`。
- 装配入口：`packages/bundle/web-app/cordis.patch.yml:68`；源码入口见 [packages/context/file-reference-local/src/index.ts](../../../../packages/context/file-reference-local/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C2；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/context/file-reference-local/README.md`](../../../../packages/context/file-reference-local/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-file-reference-local)。
- 源码测试路径：`packages/context/file-reference-local/tests/service.spec.ts`、`packages/context/file-reference-local/tests/search.spec.ts`、`packages/context/file-reference-local/tests/invariant.spec.ts`。

## 限制与故障排查

- 本轮没有单独触发浏览器补全；证据为 Web profile dump、源码测试路径和 package README。
- 远程或虚拟文件系统需要使用匹配命名空间的 provider。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

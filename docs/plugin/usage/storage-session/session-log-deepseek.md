# @deepseek-ai/dsh-session-log-deepseek

## Summary

为 DeepSeek 官方 LLM API 请求附加增量、无损的会话日志后缀。 本指南只覆盖 inventory 中 `exclusionReason == null` 的当前插件项，事实来源为 [包 README](../../../../packages/session/session-log-deepseek/README.zh.md)、inventory 和 Task 3 验证证据。

## 适用场景

- DeepSeek 官方 API 支持接收会话日志增量。
- 部署希望 provider 请求携带可接受水位，而不是重复上传完整历史。

## 启用与启动

- Inventory 分类：`storage-session`；类型：`service-plugin`。
- 本轮装配入口：`packages/session/session-log-deepseek/src/index.ts:70; mounted by packages/bundle/base/cordis.patch.yml:37, packages/bundle/sdk-minimal/cordis.patch.yml:21`。
- 手动组合时，将插件行加入目标 `cordis.yml`，并按 [配置目录](../../../config-catalog.zh.md) 补齐前置服务和配置。

```yaml
- name: '@deepseek-ai/dsh-session-log-deepseek'
```

## 实际使用

- 与 `dsh-llm-deepseek` 和 API extensions 一起挂载。
- 发起官方 DeepSeek 路由请求。
- 适配器附加从上次接受水位之后的 session log 后缀。

## 可观察结果

- DeepSeek session-log upload adapter and invariants pass local source tests; default profiles mount `id: session-log-deepseek`.
- Inventory 预期成功信号：A session, setting, credential, workspace, feedback, or storage operation produces the documented persisted/projection state.

## 验证证据

- 证据文件：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md`。
- Inventory 记录：`packages/session/session-log-deepseek/src/index.ts:70; mounted by packages/bundle/base/cordis.patch.yml:37, packages/bundle/sdk-minimal/cordis.patch.yml:21`。
- 本轮命令证据：C1/C2 mount; C5 `invariant.spec.ts`, `upload.spec.ts`。
- 无真实 API key 时，只把配置、装配、mock 单元路径或 e2e self-skip/fail-closed 行为视为已验证。

## 限制与故障排查

- No live DeepSeek upload was performed; local tests cover adapter behavior without external service credentials.
- 没有 API key 时，本轮只验证适配器和 invariant/upload 测试，未执行真实 DeepSeek 上传。
- 若实际 profile 覆盖了默认 bundle，请先用 `pnpm dsh --profile <name> --dump-config` 或 `--dump-default-config` 确认该插件行仍在生效配置中。

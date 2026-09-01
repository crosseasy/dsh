# Agent Note: Settings wire 描述失败时拒绝

Status: implemented

[English](2026-08-25-fail-closed-settings-wire-description.md) | 中文

## 问题

Settings RPC 服务每个已注册 namespace，但其脱敏器只遍历 `object`、`dict` 与 `array`。因此，union、intersection 或 transform 下的 secret 会留在解析值、组合值或用户值中，而 `schema.toJSON()` 还会序列化 secret 默认值与 transform callback 源码。写入失败会返回任意 schema 或提供方消息，其中可能引用被拒输入。`llm-pi-ai` 的 `headers` 字典能够承载 `Authorization` 或 `api-key` 值，却没有向脱敏器声明这一事实。

## 决定

`SettingsProvider.describeForWire(ns?)` 是已注册 namespace 生成 RPC descriptor 的唯一路径。它在序列化前检查完整的实时 Schemastery 图，对解析值、`base` 与 `user` 值执行脱敏，通过同一遍历清理序列化 schema 中的默认值，并发出 `{ path, set }` secret 伴随列表。缺失的 secret 与空 secret 字典报告 `set: false`；其他已存在的 secret 均报告 `set: true`。`describe()` 保留为同进程原样 API。

系统支持 `object`、`dict` 与 `array` 下的直接 secret 叶节点。`union` 或 `intersect` 下的 secret、任何 `transform`、格式错误的关系元数据，以及任何不受支持的节点，都会以不含节点元数据或值的固定文本拒绝。没有 secret 后代的 union 与 intersection 节点仍可用于普通枚举和组合 schema。

ApiProxy 使用 `describeForWire()` 完成读取与写入响应。它在 schema 校验或持久化前预检被寻址的 namespace，并把 schema、校验与存储消息替换为固定的 `settings-rejected` 文本；revision 冲突保留其结构化 revision。`llm-pi-ai` 把完整 `headers` 字典标记为一个不透明 secret 字段，因为其生产请求路径接受携带凭据的标头。

## 考虑过的备选

**保留 `describe({ redactSecrets: true })`，只扩展其值遍历器。** 否决，因为它会让 schema 默认值与 callback 源码继续留在第二条序列化路径中，并且仍会在证明响应安全之前执行持久化。

**遍历选中的 union 分支或合并 intersection 的脱敏结果。** 否决，因为 schema 无法提供一组独立于当前值的稳定路径，而客户端需要一份确定的只写字段清单。

**删除序列化 callback 后允许 transform。** 否决，因为客户端重建的 schema 将无法保留校验语义，且在 wire 边界执行或序列化插件 callback 没有必要。

**要求所有提供方凭据都使用 `apiKeyEnv`。** 否决，因为受支持的 pi-ai 路由已经接受携带凭据的自定义标头；把现有字段标记为 secret 能反映生产行为，且不删除该能力。

## 影响

不受支持的 namespace 会使完整 Settings 读取失败，而不是返回部分或不安全的 descriptor；对该 namespace 的写入会在持久化前失败。RPC 错误不会暴露被拒值、callback 源码或提供方诊断。直接对象 secret 保留既有 `{ path, set }` 行为，`llm-pi-ai` 标头名称和值则作为一个字段变为只写。动态插件必须让暴露于 wire 的 schema 保持在受支持且不含 callback 的子集中，或把不受支持的配置移出 Settings RPC。

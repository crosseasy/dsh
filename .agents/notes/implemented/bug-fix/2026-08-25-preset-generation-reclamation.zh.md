# Agent Note: 被替代的 preset 代际在最后一个 holder 释放后回收

Status: implemented

[English](2026-08-25-preset-generation-reclamation.md) | 中文

## 问题

每次 preset 编辑都会为后续会话创建新的常驻代际，而既有会话必须保持其历史产生时所用的代际。旧实现通过把每个被替代的代际保留到进程卸载来维持正确性。这会泄漏每个代际拥有的插件与 effect；`dsh-skill-filesystem` 可以安装文件 watcher，因此反复「编辑后创建会话」会在所有旧 agent 离开之后继续累积活的 watcher。

冷读取方也有同样的生命周期风险。`session.history` 或 `skill.list` 可以在不拥有 Agent 的情况下解析 detached session 记录的 preset。如果记录的代际在读取方组装 presenter 或目录时被替代，立即释放它会移除本次读取刚选中的注册条目。

## 决策

`AgentPresets` 把每个常驻挂载建模为一个代际 owner：preset id、scope key、scope、组装 stamp、holder 计数、retired 标志和记忆化 dispose（资源释放）promise。当前代际即使没有 holder 也保持挂载，因为它是下一个 agent 或冷读可复用的答案。被替代的代际只在替换代际成功挂载后才进入 retired，并在最后一个 holder 释放后只 dispose 一次。roster 卸载通过同一条记忆化路径 dispose 每个活动与 retired 代际。

`mount()` 与 `recompose()` 会先取得代际 holder，再绑定或重绑 agent scope。旧 holder 只在新绑定成功后释放，因此刷新失败或重组失败都会让 agent 保持在既有代际上。`composeFrom()` 通过 standing key 解析父方的当前代际，并取得同一个代际，而不是重新读取 preset id；因此即使组装文件发生变化，子 agent 也仍与父方使用同一批插件实例。

`acquireStanding(id?)` 是宿主读取方 API。它返回 `{ presetId, key, release() }`；调用方把 `key` 作为注册表视图 scope，并在 `finally` 中释放 lease。`release()` 是幂等的，因此调用方可以在多条退出路径上放置清理，而不会重复 dispose 同一代际。

## 曾考虑的替代方案

**立即 dispose 被替代的代际。** 否决，因为既有 agent 和冷读取方仍可能从该代际解析工具、提示词、skill 提供方和 presenter。立即 dispose 会让它们的历史与所选组装不一致。

**保留裸 `standingKeyFor()` API，并在其他地方做尽力清理。** 否决，因为裸 key 不给调用方任何所有权义务。可能与刷新竞态的代码必须显式持有代际，并在读取结束时释放它。

**重新解析子 agent 的 preset id。** 否决，原因沿用既有子 agent 继承规则：子 agent 必须继承父方的确切代际，而不是后续文件编辑或缺失 preset 错误。

## 测试

`packages/preset/agent-presets/tests/mount.spec.ts` 覆盖最后一个 holder 释放后的 dispose、父子 holder 相互独立、冷读 lease 幂等释放、并发刷新只发布一次、刷新回滚和 roster 卸载。`packages/host/apiproxy/tests/api-proxy-agent-preset.spec.ts` 覆盖 `session.history` 与 `skill.list` 在成功、错误和降级路径上释放冷读 lease。

## 后果

preset 编辑对运行中会话仍然安全，但旧插件 effect 的保留时间由活跃 holder 决定，而不是整个进程生命周期。冷读取方有明确的清理义务。读取方无法取得已记录 preset 时仍降级到全局视图，保留既有可用性约定。

# 精选激活证据

[English](README.md) | 中文

这个由仓库持有的目录是 `runtimeActivationEvidence` 可以引用激活记录与结果产物的唯一位置。[`verify-curated-activation-evidence`](../../../../scripts/verify-curated-activation-evidence.ts) 门禁只接受这里已跟踪且处于 stage zero 的普通 blob。每个 active 候选提供 key 与 `targetProfiles` 精确一致的 map；每个 profile 值分别包含 `keyless-assembled-snapshot`、`install`、`enable`、`restart` 和 `disable-or-uninstall` JSON 记录，五份记录都命名对应 map key、遵循操作 schema，并通过 SHA-256 绑定各自独立的结果产物。记录的 `command` 数组与产物的 `command.argv` 数组包含不带 secret 值的确切已执行 argv；门禁拒绝携带 secret 的形式，包括 scheme URL、option 赋值 URL 和无 scheme `user:pass@host:port` 值中的 URL userinfo，且诊断不包含参数文本。

包自身提供的证据或伴随文件、ignored 或 untracked 文件、symlink，以及 `.git` 或 `node_modules` 下的文件都不能授权激活。

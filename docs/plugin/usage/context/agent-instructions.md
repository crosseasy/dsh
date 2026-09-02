# @deepseek-ai/dsh-agent-instructions

## Summary

`dsh-agent-instructions` 把用户级和项目级 `AGENTS.md`/`CLAUDE.md` 指令注入模型上下文。它在首次请求写入基线，在成功的文件读写后补充新发现的更深层指令，并用字节预算限制注入内容。

## 适用场景

- 需要模型遵守仓库、子目录或用户级代理说明。
- 需要在文件工具触达新目录后，把更具体的说明带入下一步。
- 需要限制 workspace instructions 对上下文窗口的占用。

## 启用与启动

- `dsh-base` 默认装配该插件；headless 和 web 默认配置 dump 都显示该包。
- 自定义组合至少要提供 `maxBytes`，并可调整候选文件名和项目根标记。
- 可用装配确认命令：`pnpm dsh --profile <profile> --dump-default-config | rg '@deepseek-ai/dsh-agent-instructions'`。
- 本轮禁止真实模型调用路径下的过度声明；无密钥时只确认装配、schema、源码测试和配置事实。

## 实际使用

- 在 workspace 根目录或子目录放置 `AGENTS.md` 或 `CLAUDE.md`。
- 启动包含该插件的 profile，并让 agent 从目标 `cwd` 开始请求。
- 让 agent 成功读取或写入更深目录中的文件；下一步请求会重新核对适用说明。

## 可观察结果

- 首次请求包含一条带 `<system-reminder>` framing 的 durable user message。
- 新发现、替换或移除的指令以插件来源的 `user/message` 进入会话日志。
- 超过预算时，渲染文本会说明被省略或截断的路径。

## 验证证据

- inventory 条目：`/tmp/dsh-plugin-usage-evidence/plugin-inventory.json` 中的 `@deepseek-ai/dsh-agent-instructions`，category 为 `context`，kind 为 `cordis-plugin`，docPath 为 `docs/plugin/usage/context/agent-instructions.md`。
- 装配入口：`packages/bundle/base/cordis.patch.yml:275, packages/preset/agent-presets/presets/cordis/agent.cordis.yml:32, packages/preset/agent-presets/presets/liangshen/agent.cordis.yml:100`；源码入口见 [packages/context/agent-instructions/src/index.ts](../../../../packages/context/agent-instructions/src/index.ts)。
- 命令证据：`/tmp/dsh-plugin-usage-evidence/verification-core-context.md` 中的 C0、C1、C2；C0 确认 CLI 支持 `--profile` 和 `--dump-default-config`，C1/C2 使用 `pnpm dsh --profile ... --dump-default-config` 观察默认组合。
- Package README：[`packages/context/agent-instructions/README.md`](../../../../packages/context/agent-instructions/README.md)。
- 配置 catalog：[`docs/config-catalog.md`](../../../config-catalog.md#deepseek-aidsh-agent-instructions)。
- 源码测试路径：`packages/context/agent-instructions/tests/agent-instructions.spec.ts`、`packages/context/agent-instructions/tests/agent-instructions.e2e.ts`。

## 限制与故障排查

- 没有文件 watcher；外部编辑要等下一次文件工具触达或 session resume。
- 本轮没有执行真实模型请求；无 `DEEPSEEK_API_KEY` 时只确认装配、源码测试路径和日志机制。
- 如果 dump 中看不到该插件，先确认目标 profile 是否安装了包含该 row 的 bundle 或 preset，再检查 `cordis.yml` 中的 `disabled` 条件和依赖服务。

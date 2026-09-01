# Agent Note: npm access 由包 manifest 持有

Status: implemented

[English](2026-08-13-public-vendor-and-native-sequences.md) | 中文

## Problem

`@deepseek-ai` scope 中的包不会从 scope 或发布族继承同一个 access 级别。若 access 保持隐式，或只在发布命令中设置，包的可用性就取决于操作者状态，而不是与依赖图一起接受审查的 manifest。

真正卡住公开消费者的是**受限的依赖**。Harness 包把 vendored 框架声明为对等依赖，`dsh-sandbox-local` 把 Landlock 入口声明为依赖，`@deepseek-ai/dsh` 还会安装 curated 包和普通 dsh 包。因此，匿名安装要求该闭包中的每个直接和传递包都是公开的；只发布 CLI 或只发布其 curated 依赖都不够。

## Decision

Access 是每个包 manifest 的属性，而不是 npm scope、发布序列或版本的属性：

| 序列 | 成员 | `publishConfig.access` |
|---|---|---|
| vendored 框架 | `vendor/*` 九包 | `public` |
| native | `native/landlock-run/packages/*` 三包 | `public` |
| dsh | 所有 234 个非 experimental 的 `packages/*/*` 与 `apps/*` 成员，包括五个 curated 包 | `public` |

`packages/experimental/*` 不属于 dsh 发布族；这些包保持私有且不声明 `publishConfig`。`check-workspace-constraints.ts` 要求每个发布成员都可发布且公开，因此新加入选择范围的 dsh、vendored 或 native 包不能悄然保留 restricted access。

**没有任何发布路径传 `--access`。** 命令行选项会覆盖真正持有该事实的 manifest，因此 `publish.ts` 不传，native workflow 也不传，由各 packed manifest 决定。未来若增加包级例外，必须显式修改该 manifest 和对应 workspace 约束。

harness 消费方引用 Landlock 入口改用 `workspace:^` 而非 `workspace:*`,于是发布出去的 harness 包接受该入口的 patch 与 minor 版本,而不是钉死一个精确版本。入口对它那两个平台包仍保持 `workspace:*` —— 那里二进制必须与入口版本完全一致。

`@deepseek-ai/dsh` 及其当前所有直接和传递 workspace 依赖都声明公开 access。dsh 发布顺序先发布 curated 策略和评测资产，再发布其消费方；`curated-base` 与 `curated-profiles` 位于 CLI 之前，`curated-scripts` 则位于它所执行的 CLI 依赖之后。因此，完整 dsh 发布可以匿名安装，无需解析私有 workspace 包。

## Alternatives considered

**一次性把整个 scope 改成 public。**不予采纳：这会让一次 dsh 发布因 manifest 改动而顺带公开，而不是来自刻意的发布决定。先公开两条依赖序列，能让每一步的已发布包都保持可安装，也是公开 dsh 的前置条件。

**全部保持受限，改为授予一个只读 team。** `npm access grant read-only <org:team> <包>` 是逐包的、没有 scope 通配，覆盖全集意味着每个包一次 grant，外加一个为后续新增包长期补齐的对账任务。它也只能覆盖组织成员，无法服务一个可安装的公开产物。

**在发布路径而不是 manifest 里指定公开。** 不采用，因为它会覆盖 workspace 约束正在校验的 manifest，使仓库审查不足以确定包的 access。

## Consequences

- **当前 246 个发布成员全部公开，而且不能干净地回退。** 让某个包恢复受限 access 需要付费套餐并执行 `npm access set status=private`，且已经被下载或镜像的内容收不回来。
- **`@deepseek-ai/dsh` 只有在完整依赖闭包保持公开时才能匿名安装。** 发布族与 workspace 约束测试固定 234 个成员的集合，其中包括全部五个 curated 包；打包安装探针验证组装后的闭包。
- **每个发布产物都全网可读，因此 payload 策略更重要。** dsh 包拒绝源码与声明映射；`vendor/cordis` 有意发布 `src`，因为其导出映射声明了 `./src/*`；Landlock 入口按文档约定发布 `src/main.c` 作为审计面。
- **这些发布序列不需要 npm 私有包套餐。** 阻塞过首次 native 发布的 `402 Payment Required` 失败形态对公开包不会再出现。
- **无凭据的 `npm view` 可用于检查每条发布序列。** 受限包在没有凭据时会返回 `E404`，与「版本不存在」无法区分。

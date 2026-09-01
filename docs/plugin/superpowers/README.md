# DeepSeek Harness 精选插件层（dsh-curated）执行计划

> 本目录是 Ralph 要求保留的本地执行规划与状态记录，不是产品文档。本轮不执行 `git add`，且不改变任务开始前既有 index。计划蓝本来自飞书文档《DeepSeek Harness 高质量插件集成与评测方案》。规划任务带有耗时 < 1 分钟的叶级验收门禁；当前状态以实现、测试和明确标为 pending 的长周期资产为准。

## 这份计划要做什么

在**当前 monorepo 内**新增一组 `@deepseek-ai/dsh-*` 包，产出一个可锁版本、可回滚、按能力域互斥的**精选插件层**（内部 bundle + 多个 profile + 准入策略 + 评测基线 + 脚本）。`web-curated` 的目标基线固定为 12 个候选；当前 6 个为静态/安装资格候选，runtime active 为 0。

**核心边界**：不修改 DeepSeek Harness 核心；一切通过 documented seams（`ctx.tools`、`ctx.llm`、`ctx.subagents`、`ctx.sandbox`、`session/event`、`tools/pre-execute` 等）扩展与组合。落地形态遵循本仓库既有的 bundle/profile 机制（见 [packages/bundle/README.md](../../../packages/bundle/README.md) 与 [app-boot Profiles](../../../packages/boot/app-boot/README.md#profiles)）。

## 当前实现状态

五个精选 profile 均可确定性物化且不覆盖已有文件，并统一写入 `ignore-scripts=true`。所有模板只包含安装自有基础 bundle，不包含第三方候选。六个静态/安装资格候选保留 source、tree、runtime closure、npm/Git 与资源审计事实，但因缺少真实固定产物的 keyless assembled runnable snapshot 而保持 inactive；`dsh-web-search-pro` 还缺少必需的 `@anweat/dsh-browser` bundle/runtime dependency。其余候选保留各自的产物、兼容性或安全拒绝。

静态准入由八个维度计算，Node/core-patch、能力冲突、元数据 secret 和委托给第三方权限插件的 fail-closed 配置均有拒绝检查。普通 `dsh` 启动与 `--dump-config` 对精选 profile 强制执行轻量组合准入，检查模板与 catalog 分配、包管理器设置，以及 profile/home/overlay 中的动态表达式和未批准可执行插入；安装目录、direct tree 与 lock 深检仍由 observed preflight 负责。没有 `dsh.profile` 的独立产物根只产生 metadata-only、`observed:false` 结果，包内 `.dsh-curated-artifact.json` 不能建立 observed success。Observed preflight 和 smoke 要求绝对 profile root；无 root 时失败，fixture 只产生非观测结果。Smoke 校验 manifest、bundle patch 与 main 文件存在性，再调用已安装 DSH CLI 的 `--dump-config` 和 `--help`；它不直接导入或初始化候选模块，也不启动 profile runtime 或生成 synthetic shim。

候选只有在同时提供真实固定产物、keyless assembled snapshot、全部必需依赖 bundle，以及安装、启用、重启、禁用或卸载证据后才能转为 active。E3/E4、搜索、记忆、浏览器、MCP、真实故障注入、A/B 与 canary 均为 pending；完整定义见 [06](06-深度调研复评与证据分级.md)。Benchmark 中的 `evidenceKind: observed` 是输入提供者断言；比较器只校验结构、可比性和阈值，不证明生产者身份。

## 文档索引

| 文件 | 内容 | 对应飞书章节 |
|---|---|---|
| [00-背景与目标.md](00-背景与目标.md) | 调研结论、落地目标、全局约束、**既有系统不变量清单** | §1、§9 |
| [01-目标架构.md](01-目标架构.md) | `dsh-curated` 目录/发布单元、profile 分层、映射到本仓库 package 拓扑 | §4 |
| [02-插件矩阵与择优.md](02-插件矩阵与择优.md) | 精选插件矩阵、同质择优决策、能力域互斥表 | §2、§3 |
| [03-实施路线图.md](03-实施路线图.md) | **P0/P1/P2 分期 + 叶级门禁**，逐任务 Files/Steps/Verify | §5、§7 |
| [04-评测体系.md](04-评测体系.md) | 静态准入 100 分、动态择优、各能力域测试法、A/B、回滚线 | §6 |
| [05-安全供应链与风险.md](05-安全供应链与风险.md) | 版本锁与供应链、冲突检测、安全与数据边界、风险与未决项 | §4.2–4.4、§8 |
| [06-深度调研复评与证据分级.md](06-深度调研复评与证据分级.md) | E0–E5 证据分级、候选复评对照、指标补充视角、方法论边界 | 深度调研补充〔2026-08-25 §三/§五/§六〕 |

## 阅读顺序

1. 先读 [00-背景与目标.md](00-背景与目标.md) 建立口径与约束。
2. 再读 [01-目标架构.md](01-目标架构.md) 理解落地形态。
3. 执行时以 [03-实施路线图.md](03-实施路线图.md) 为主线，按 P0 → P1 → P2 推进；仓库机制、单候选激活与生态 rollout 的独立完成判据见 [00 §6](00-背景与目标.md#6-分层成功判据definition-of-done)。
4. 每接入一个插件，用 [04-评测体系.md](04-评测体系.md) 做静态准入 + 动态择优。
5. [02](02-插件矩阵与择优.md) 与 [05](05-安全供应链与风险.md) 作为查询型参考随时回查。
6. [06-深度调研复评与证据分级.md](06-深度调研复评与证据分级.md) 作为深度调研的查询型复评参考，与 [02](02-插件矩阵与择优.md)、[05](05-安全供应链与风险.md) 并列随时回查；其插件结论为 E1 候选推荐，不改变当前准入。

## 关键决策（本次规划已确认）

- **落地目标**：当前 monorepo 内新增 packages，不改核心。
- **文档语言**：中文。
- **文档结构**：多文件模块化 + 本 README 索引，单文件控制在 500–1000 行。
- **路线图分期**：重铸为 P0/P1/P2 + 叶级门禁（每步验收命令耗时 < 1 分钟）。

## 术语与口径

- **默认 / 场景 / 实验 / 不纳入**：插件准入的四档决策，定义见 [02](02-插件矩阵与择优.md)。
- **bundle**：manifest 声明 `dsh.bundle.patch` 的 npm 包，是可安装的 patch 层。
- **profile**：`$DSH_HOME/profiles/<name>` 下的组合，由有序 bundle 层 + profile patch + home patch 叠加而成。
- **叶级门禁**：单条耗时 < 1 分钟、可独立判定通过/失败的验收命令。

## 免责与快照

- 插件星标、测试数、CI 数等均来自蓝本文档在 **2026-08-24** 的快照，执行时须以实际克隆核验为准。
- DSH 处于 developer preview（蓝本记录根包版本 `0.1.1-rc.2`，要求 Node.js `^22.19.0 || >=24.0.0`）；破坏性变更会发生，所有第三方插件必须锁定精确版本或 commit SHA。

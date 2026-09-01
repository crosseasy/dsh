## Group 1: 受管进程与异步调用链
分组维度: 调用链路
核心功能: POSIX 进程树终止、输出上限、环境隔离及异步 API 传播
审查重点: timer/abort/listener/pipe cleanup、tree quiescence、PID reuse、output cap、env allowlist、Windows fail-closed、所有直接调用方
文件:
- scripts/run-owned-process.ts (+139, -0)
- scripts/run-owned-process.spec.ts (+291, -0)
- scripts/audit-curated-candidates.ts (+33, -38)
- scripts/audit-curated-candidates.spec.ts (+159, -114)
- scripts/verify-curated-activation-evidence.ts (+22, -16)
- scripts/verify-curated-activation-evidence.spec.ts (+71, -38)
- scripts/release/verify.ts (+8, -3)
- tsconfig.base.json (+1, -0)

## Group 2: 精选 Profile 与命令回归
分组维度: 业务功能
核心功能: profile 物化、准入、smoke 与 benchmark 命令的新增负向覆盖
审查重点: 新增测试是否真实覆盖回归、是否依赖脆弱 mock、是否过度设计
文件:
- packages/curated/curated-profiles/tests/profiles.spec.ts (+236, -1)
- packages/curated/curated-scripts/src/index.ts (+3, -2)
- packages/curated/curated-scripts/tests/commands.spec.ts (+420, -0)

## Group 3: Benchmark 与候选策略验证
分组维度: 业务功能
核心功能: benchmark snapshot 绑定、候选状态与准入证据
审查重点: 拒绝路径准确性、测试断言强度、生产实现与测试一致性
文件:
- packages/curated/curated-bench/tests/bench.spec.ts (+58, -0)
- packages/curated/curated-policy/tests/catalog.spec.ts (+1, -0)
- scripts/verify-curated-activation-evidence.ts (+22, -16)
- scripts/verify-curated-activation-evidence.spec.ts (+71, -38)

## Group 4: 文档与双语记录
分组维度: 代码层级
核心功能: 新进程执行语义的公开契约
审查重点: 与实现、spec、Windows/POSIX 行为和输出限制是否准确一致
文件:
- .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.i18n.yaml (+2, -2)
- .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.md (+2, -2)
- .agents/notes/implemented/architecture/2026-08-25-curated-plugin-layer-governance.zh.md (+4, -0)
- packages/curated/curated-bench/evidence/README.i18n.yaml (+2, -2)
- packages/curated/curated-bench/evidence/README.md (+1, -1)
- packages/curated/curated-bench/evidence/README.zh.md (+1, -1)
- packages/curated/curated-policy/README.i18n.yaml (+2, -2)
- packages/curated/curated-policy/README.md (+1, -1)
- packages/curated/curated-policy/README.zh.md (+1, -1)

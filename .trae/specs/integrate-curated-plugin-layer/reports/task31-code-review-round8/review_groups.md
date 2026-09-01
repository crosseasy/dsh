# 分组评审

策略: 分组评审（93 个文件，47699 行当前内容；超过 500 行阈值）
执行方式: 5 个独立职责组并行收集代码、调用方、静态检查与测试证据；主评审执行跨组接口校验。

## Group 1: 策略目录、安装锁与激活证据
分组维度: 业务功能 + 调用链路
核心功能: 策略目录、安装锁与激活证据
审查重点: 候选目录校验、锁闭包、凭证遮蔽、固定工件与顶级证据门禁
文件数: 15
文件:
- packages/curated/curated-policy/README.i18n.yaml (+2, -2; current 6)
- packages/curated/curated-policy/README.md (+2, -0; current 40)
- packages/curated/curated-policy/README.zh.md (+2, -0; current 40)
- packages/curated/curated-policy/package.json (+0, -0; current 50)
- packages/curated/curated-policy/policy/capability-conflicts.yaml (+0, -0; current 38)
- packages/curated/curated-policy/policy/permission-rules.yaml (+0, -0; current 25)
- packages/curated/curated-policy/policy/plugin-allowlist.yaml (+0, -0; current 1823)
- packages/curated/curated-policy/src/index.ts (+7, -0; current 2168)
- packages/curated/curated-policy/src/installed-lock.ts (+807, -0; current 807)
- packages/curated/curated-policy/src/invariant.ts (+0, -0; current 26)
- packages/curated/curated-policy/tests/catalog.spec.ts (+67, -0; current 3355)
- packages/curated/curated-policy/tests/installed-lock.spec.ts (+1138, -0; current 1138)
- packages/curated/curated-policy/tsconfig.json (+0, -0; current 19)
- scripts/audit-curated-candidates.ts (+0, -0; current 493)
- scripts/verify-curated-activation-evidence.ts (+0, -0; current 1039)

## Group 2: Profile 物化与启动准入
分组维度: 调用链路
核心功能: Profile 物化与启动准入
审查重点: 模板顺序、home/overlay 拒绝、Loader 前置校验、官方 profile 保持与启动桥接
文件数: 17
文件:
- apps/cli/src/curated-profile-lock.ts (+439, -0; current 439)
- apps/cli/src/curated-profile.ts (+87, -6; current 153)
- apps/cli/src/dump-config.ts (+33, -23; current 74)
- apps/cli/src/profile-boot.ts (+99, -41; current 426)
- packages/boot/app-boot/src/index.ts (+111, -6; current 978)
- packages/curated/curated-profiles/README.i18n.yaml (+2, -2; current 6)
- packages/curated/curated-profiles/README.md (+3, -2; current 49)
- packages/curated/curated-profiles/README.zh.md (+3, -2; current 49)
- packages/curated/curated-profiles/package.json (+0, -0; current 50)
- packages/curated/curated-profiles/src/index.ts (+145, -27; current 1477)
- packages/curated/curated-profiles/src/invariant.ts (+0, -0; current 26)
- packages/curated/curated-profiles/tests/fixtures/behavior-bundle/cordis.patch.yml (+0, -0; current 13)
- packages/curated/curated-profiles/tests/fixtures/behavior-bundle/package.json (+0, -0; current 16)
- packages/curated/curated-profiles/tests/fixtures/behavior-bundle/plugin.mjs (+0, -0; current 101)
- packages/curated/curated-profiles/tests/fixtures/behavior-profile.ts (+0, -0; current 121)
- packages/curated/curated-profiles/tests/profiles.spec.ts (+357, -1; current 3489)
- packages/curated/curated-profiles/tsconfig.json (+0, -0; current 24)

## Group 3: 插件安装与 curated 命令运行时
分组维度: 业务功能 + 调用链路
核心功能: 插件安装与 curated 命令运行时
审查重点: ignore-scripts 强制、preflight/verify/smoke 生命周期、worker 超时清理、CLI 错误传播
文件数: 22
文件:
- apps/cli/src/plugin.ts (+410, -264; current 1025)
- packages/curated/curated-scripts/README.i18n.yaml (+2, -2; current 6)
- packages/curated/curated-scripts/README.md (+7, -3; current 52)
- packages/curated/curated-scripts/README.zh.md (+9, -3; current 54)
- packages/curated/curated-scripts/compare-benchmark.mjs (+0, -0; current 10)
- packages/curated/curated-scripts/package.json (+0, -0; current 71)
- packages/curated/curated-scripts/preflight.mjs (+0, -0; current 10)
- packages/curated/curated-scripts/smoke-profile.mjs (+0, -0; current 10)
- packages/curated/curated-scripts/src/bin.ts (+0, -0; current 34)
- packages/curated/curated-scripts/src/compare-benchmark.ts (+0, -0; current 7)
- packages/curated/curated-scripts/src/index.ts (+274, -62; current 5913)
- packages/curated/curated-scripts/src/invariant.ts (+0, -0; current 26)
- packages/curated/curated-scripts/src/preflight.ts (+0, -0; current 7)
- packages/curated/curated-scripts/src/smoke-profile.ts (+0, -0; current 7)
- packages/curated/curated-scripts/src/staging-worker.ts (+0, -0; current 13)
- packages/curated/curated-scripts/src/verify-lock.ts (+0, -0; current 7)
- packages/curated/curated-scripts/tests/commands.spec.ts (+744, -27; current 15303)
- packages/curated/curated-scripts/tests/fixtures/local-git-profile.ts (+0, -0; current 51)
- packages/curated/curated-scripts/tests/packed-entry.e2e.ts (+6, -5; current 276)
- packages/curated/curated-scripts/tsconfig.json (+0, -0; current 18)
- packages/curated/curated-scripts/tsdown.config.ts (+0, -0; current 23)
- packages/curated/curated-scripts/verify-lock.mjs (+0, -0; current 10)

## Group 4: Benchmark、snapshot 与回滚判定
分组维度: 业务功能
核心功能: Benchmark、snapshot 与回滚判定
审查重点: 统计与阈值语义、不可补偿失败、摘要稳定性、invariant 与测试证据
文件数: 27
文件:
- packages/curated/curated-bench/README.i18n.yaml (+2, -2; current 6)
- packages/curated/curated-bench/README.md (+3, -1; current 48)
- packages/curated/curated-bench/README.zh.md (+3, -1; current 48)
- packages/curated/curated-bench/baselines/.keep.json (+0, -0; current 3)
- packages/curated/curated-bench/baselines/ab-comparisons.json (+0, -0; current 102)
- packages/curated/curated-bench/baselines/benchmark.json (+0, -0; current 65)
- packages/curated/curated-bench/baselines/history/2026-08-24.json (+0, -0; current 32)
- packages/curated/curated-bench/baselines/locks/web-curated.json (+0, -0; current 6)
- packages/curated/curated-bench/baselines/locks/web.json (+0, -0; current 6)
- packages/curated/curated-bench/baselines/profiles/web-curated.json (+0, -0; current 10)
- packages/curated/curated-bench/baselines/profiles/web.json (+0, -0; current 9)
- packages/curated/curated-bench/baselines/web-cdp-regression.json (+0, -0; current 32)
- packages/curated/curated-bench/evidence/README.i18n.yaml (+0, -0; current 6)
- packages/curated/curated-bench/evidence/README.md (+0, -0; current 7)
- packages/curated/curated-bench/evidence/README.zh.md (+0, -0; current 7)
- packages/curated/curated-bench/manifests/.keep.json (+0, -0; current 3)
- packages/curated/curated-bench/manifests/curated-candidates.json (+0, -0; current 56)
- packages/curated/curated-bench/package.json (+0, -0; current 56)
- packages/curated/curated-bench/src/index.ts (+52, -16; current 195)
- packages/curated/curated-bench/src/invariant.ts (+125, -38; current 1258)
- packages/curated/curated-bench/src/snapshot.ts (+82, -27; current 478)
- packages/curated/curated-bench/tasks/.keep.json (+0, -0; current 3)
- packages/curated/curated-bench/tasks/curated-tasksets.json (+0, -0; current 205)
- packages/curated/curated-bench/tasks/p2-risk-gates.json (+0, -0; current 106)
- packages/curated/curated-bench/tests/bench.spec.ts (+373, -4; current 3056)
- packages/curated/curated-bench/tsconfig.json (+0, -0; current 22)
- packages/curated/curated-bench/tsdown.config.ts (+17, -0; current 17)

## Group 5: Base bundle 与 curated 包组拓扑
分组维度: 代码层级
核心功能: Base bundle 与 curated 包组拓扑
审查重点: bundle patch、Loader 导出、invariant、发布元数据、包组文档
文件数: 12
文件:
- packages/curated/README.i18n.yaml (+0, -0; current 6)
- packages/curated/README.md (+0, -0; current 49)
- packages/curated/README.zh.md (+0, -0; current 49)
- packages/curated/curated-base/README.i18n.yaml (+0, -0; current 6)
- packages/curated/curated-base/README.md (+0, -0; current 30)
- packages/curated/curated-base/README.zh.md (+0, -0; current 30)
- packages/curated/curated-base/cordis.patch.yml (+0, -0; current 9)
- packages/curated/curated-base/package.json (+0, -0; current 55)
- packages/curated/curated-base/src/index.ts (+0, -0; current 9)
- packages/curated/curated-base/src/invariant.ts (+0, -0; current 26)
- packages/curated/curated-base/tests/bundle.spec.ts (+0, -0; current 76)
- packages/curated/curated-base/tsconfig.json (+0, -0; current 21)

# 代码评审报告

- 仓库：deepseek-harness
- 检测模式：通用检测
- 检测范围：当前工作树完整 curated 范围
- 生成时间：2026-08-31 10:37
- 检查文件：93
- 变更行数：47699

## 缺陷统计

- P0：0
- P1：5
- P2：0
- 合计：5

## 缺陷详情

### 1. [P1][安全漏洞] 非 JSON 配置值可绕过 profile 组合摘要绑定

- 位置：`packages/curated/curated-policy/src/index.ts:1578-1578`
- 置信度：10/10

**问题描述**

当前仅把 config.values 校验为对象；js-yaml 可生成 Date，直接构造服务还可传入 Map、Set、TypedArray、稀疏数组或 Infinity。profile patch 会按实际值生成，但 curatedProfileCompositionSha256 的归一化会把多种非 JSON 对象折叠为空对象，并让 Infinity 在 JSON.stringify 时变为 null，造成配置行为变化而 profileSha256 不变，已绑定的激活证据仍可能通过。聚焦测试中相关拒绝用例当前失败。

**修复建议**

让 YAML 解析和 CuratedPolicy 构造共用递归 JSON 值校验与复制，只接受 null、字符串、布尔值、有限数字、稠密普通数组和普通自有属性对象，再冻结结果。

---

### 2. [P1][安全漏洞] YAML 解析诊断会把 home/overlay 中的密钥原文写到 stderr

- 位置：`packages/boot/app-boot/src/index.ts:368-371`
- 置信度：10/10

**问题描述**

js-yaml 的异常字符串包含源码 code frame，这里把 String(error) 原样拼入错误并保留原始 cause。composeProfile 和 runDumpConfig 会在 curated admission 前直接解析 Harness home 与显式 --patch overlay，因此畸形 YAML 中的 apiKey/token 等值可进入 stderr。规格要求秘密值拒绝时不回显，现行 Agent Note 也要求 malformed curated profile YAML 先经 policy redactor。

**修复建议**

让通用 patch 解析使用 secret-aware YAML formatter，并避免把保留原始源码的 YAMLException 作为 cause 进入最终 CLI 错误链。

---

### 3. [P1][安全漏洞] 候选本地校验把 Git resolution 当作 npm 来源接受

- 位置：`packages/curated/curated-scripts/src/index.ts:1163-1167`
- 置信度：10/10

**问题描述**

当受管 profile 含额外 dependency、不能进入共享 assertCuratedInstalledLocks 时，会走 candidate-local 校验。该分支只比较 integrity，不校验 resolution 来源类型，因此带正确 integrity 的 Git resolution 可冒充 catalog 固定的 npm 来源，破坏精确安装来源约束。聚焦测试“rejects Git provenance on an npm candidate in candidate-local lock checks”当前未抛错。

**修复建议**

在比较 integrity 前复用 installed-lock policy 的来源类型检查，拒绝 type=git、repo、commit、gitHosted 或 GitHub codeload tarball 的 npm 候选 resolution。

---

### 4. [P1][安全漏洞] peer-qualified 依赖会回退到无 suffix snapshot

- 位置：`packages/curated/curated-scripts/src/index.ts:1334-1353`
- 置信度：10/10

**问题描述**

candidate-local 闭包遍历对根记录使用 snapshots[rootSnapshotKey] ?? rootRecord，对传递依赖则从包含无 suffix key的候选列表中选择首个存在项。删除 peer-qualified snapshot 后，校验会读取不对应实际 peer 环境的记录并仍可能匹配 catalog 摘要。规格和现行 Agent Note 都要求普通 peer suffix 按精确解析身份校验；对应聚焦测试当前未抛错。

**修复建议**

当 rootSnapshotKey 或依赖 locator 带 peer suffix 时，要求 snapshots 中存在完整 peer-qualified key；仅无 peer suffix 的 locator 可回退到 package record。

---

### 5. [P1][业务语义问题] 比较器未校验同侧 lock 候选与 profile bundle 属于同一组合

- 位置：`packages/curated/curated-scripts/src/index.ts:4141-4150`
- 置信度：10/10

**问题描述**

比较器只验证 previousSnapshots 与 baseline 引用内容相等，并分别校验 profile 对当前模板，从未关联同一侧的 lock candidates 与 profile bundles。现有 fixture 的 baseline lock 声明 plugin-a，而 baseline profile 只有官方 base/web bundle，runCompareBenchmark 仍接受并把该 lock/profile 对作为回滚资产返回。这样统计可归因于未实际加载的候选，回滚数据也可描述两个不同组合。

**修复建议**

在 baseline 和 candidate 进入统计前，将各自 lockSnapshot.snapshot.candidates[].expectedPackage 与 profileSnapshot.snapshot.bundles 中的第三方 bundle 做精确、唯一且同序的双向校验。

---

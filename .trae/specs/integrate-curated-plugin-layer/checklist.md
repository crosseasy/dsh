# 验收清单

- [x] `packages/curated/` 仅包含职责单一的 workspace 包，并遵循 ESM、Cordis peer/dev dependency、Host aggregate 和 invariant 约定。
- [x] curated bundle 的 manifest 声明有效 `dsh.bundle.patch`，patch 可由 Cordis `entryListSchema` 解析。
- [x] 候选目录中的每个 active source 都是完整 40 位 commit SHA，且有来源、许可证、包名、bundle patch 和审计时间。
- [x] 无法访问、许可证不清、无 bundle、Node 不兼容或要求核心补丁的候选被机器可读地拒绝，未进入 active profile。
- [x] `verify-lock` 拒绝 `latest`、branch、tag、短 SHA 和缺失审计字段，并且错误不回显秘密值。
- [x] `preflight` 拒绝重复 provider、entry、tool、command、service、UI slot、端口、SQLite、cache 和 env 冲突。
- [x] `preflight` 接受未激活的显式 fallback。
- [x] `ctx.curatedPolicy` 查询返回冻结且顺序稳定的结果，fiber dispose 后无 package-owned 注册残留。
- [x] 五个 profile 模板均可物化，重复运行幂等，不覆盖已有 manifest、用户 patch 或 pnpm workspace 文件。
- [x] `web-curated` 不含多 Agent、浏览器、Office、完整 IM 或自动进化记忆。
- [x] `web-coding` 只有一个主编排器；`web-research`、`web-enterprise`、`web-personal` 的能力互相隔离。
- [x] `web-enterprise` 禁用匿名视觉 fallback、IM 正文外发、自动安装脚本和未批准浏览器下载。
- [x] `smoke-profile` 在 55 秒内对有效 profile 给出成功 JSON，对缺 bundle、非法配置、超时和子进程失败给出阶段化非零结果。
- [x] `compare-benchmark` 正确计算均值、P50、P95、失败分布与加权分。
- [x] 五个非补偿门槛和三类回滚阈值均有自动化测试且能覆盖高总分候选。
- [x] P0/P1/P2 每个候选都有 verify-lock、preflight、smoke 结果；失败候选保留审计记录但不阻断可用 profile。
- [x] Loader/app-boot real-composition 测试覆盖 curated bundle/profile 的加载、禁用、卸载和错误路径。
- [x] 可本地模拟的搜索超时、429、浏览器失败、SQLite 锁、权限拒绝、非法 patch、断网和初始化失败均 fail-closed 或可单插件恢复。
- [x] 官方 `web`/`headless` profile、Agent loop、工具执行顺序、权限交互和 session wire format未发生行为变化。
- [x] 每个新包 README/JSDoc、Model Experience、Known Limitations 和 Agent Note 双语工件完整。
- [x] focused tests 与 coverage 通过。
- [x] `pnpm run constraints`、`pnpm run typecheck`、`pnpm run lint` 通过。
- [x] `pnpm run doc-sync` 相关门禁通过。
- [x] `pnpm run build` 与 `pnpm run hygiene` 的相关验证通过。
- [x] 独立代码审查和安全审查无 P0–P2 未解决发现。
- [x] 用户已有 `docs/arch/code-optimization-audit*` 移动保持原样。
- [x] `docs/plugin/superpowers/` 与 `.trae/specs/` 未加入 git staging，未执行 commit/push/merge/rebase/reset。

## 从零重审

- [ ] 七份 `docs/plugin/superpowers/` 文档中的每项 P0/P1/P2 要求均映射到实现、自动化证据、长期评测资产或明确拒绝理由。
- [ ] 候选目录的完整 SHA、许可证、bundle、Node engine、安装脚本和 active/rejected 决策已由新鲜只读证据独立核对。
- [ ] `web-curated`、`web-coding`、`web-research`、`web-enterprise`、`web-personal` 的继承、隔离、互斥与安全默认值符合规划。
- [ ] 官方 `web`/`headless`、Agent loop、工具执行顺序、权限交互和 session wire format 未被 curated 实现改变。
- [ ] `verify-lock`、`preflight`、`smoke-profile`、`compare-benchmark` 的成功与负向路径均以新鲜输出验证。
- [ ] 所有错误输出均脱敏；秘密值、非法配置、重复资源、超时和子进程失败均 fail-closed。
- [ ] curated focused tests 与覆盖率、constraints、typecheck、lint、doc-sync、build 和 hygiene 的相关门禁有新鲜通过证据。
- [ ] 真实 CLI/PTy 路径可运行；任何浏览器验证仅使用 Chrome CDP 9333，且控制台无 error。
- [ ] 长周期 canary、100/200 任务 A/B 等无法在单轮本地伪造的事项具有可执行资产、阈值判定和诚实状态。
- [ ] 双语 README/JSDoc/Agent Note/生成工件与最终实现一致，规划目录保持不进入 git。
- [ ] 独立代码、安全和规格审查无未解决 P0-P2 或高置信度实质问题。
- [ ] 本轮未回滚用户改动，未执行 commit/push/merge/rebase/reset，spec/task/checklist/progress 未进入 staging。

# Agent Note: 会话引用私有准备过程

Status: implemented

[English](2026-08-25-session-reference-private-preparation.md) | 中文

## 问题

`SessionReferenceResolver` 曾把候选排序和快照准备公开为 Cordis 服务方法，但生产调用方只需要生成的 Remote 发现、规范 URI helper 和 `agent/pre-step` 插入行为。继续公开这些额外方法，会让内部顺序和校验看起来像可复用的宿主 API。

## 决策

`ctx.sessionReferenceResolver` 只把 `remoteExportCandidates()` 作为公开 Service 方法。候选排序仍是该 Remote 方法背后的实现细节，快照准备仍是外层 `agent/pre-step` 监听器的实现细节，该监听器只处理已接受的直接用户消息。URI helper 和导出的数据记录保持公开，因为宿主和生成客户端仍通过它们交换规范 mention 与候选 payload。

## 考虑过的替代方案

**为测试保留公开的 `listCandidates()`。** 不予采纳，因为测试可以通过宿主调用的同一个 Remote 方法覆盖发现行为。直接公开该方法会保留一个不受支持的 limit override，并让生成的 Cordis catalog 比生产需求更宽。

**为程序化宿主保留公开的 `prepare()`。** 不予采纳，因为准备过程属于下游 `agent/pre-step` 监听器接受最终消息批次之后的阶段。公开方法会让调用方绕过这个顺序，并把格式错误的结构化引用对象纳入服务约定。

**把会话发现移到 API Proxy 路由之后。** 不予采纳，因为 Typert Remote 已经提供面向宿主的一元发现调用，无需引用专用网关路由。

## 后果

生成的 Cordis surface 只为 `ctx.sessionReferenceResolver` 包含 `remoteExportCandidates()`。测试通过 Remote 发现和 `agent/pre-step` 行为覆盖排序、取消、标题回退、规范 mention、快照插入、去重、自引用、数量限制、读取失败、取消、标签安全 JSON、字节预算、源变更、递归快照排除和无引用透传。

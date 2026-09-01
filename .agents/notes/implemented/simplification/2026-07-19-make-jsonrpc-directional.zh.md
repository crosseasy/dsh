# Agent Note: 保持 SDK JSON-RPC 传输方向单一

Status: implemented

[English](2026-07-19-make-jsonrpc-directional.md) | 中文

## 问题

SDK JSON-RPC 桥接具有固定的请求所有权，但对称传输会同时赋予两个端点发起请求与处理响应的能力。运行时服务端从不发起 SDK 请求，TypeScript 与 Python SDK 客户端也从不应答此类请求。公开这些角色会增加没有 SDK 消费方的待处理请求与响应 API，并允许意外服务端请求进入客户端关联状态。

Codex app-server 协议独立于 SDK 协议，确实会向客户端发送请求，以取得无人值守的审批决定。它真实存在的双向需求不能扩大 SDK 客户端 API。

## 决策

`dsh-sdk-protocol` 保留一套内部的按换行分帧解析器与写入器，同时导出两种角色专用传输。`JsonRpcLineServerTransport` 接收请求并发送响应或通知；它会忽略来自客户端的响应与通知帧。`JsonRpcLineClientTransport` 发送请求或通知并接收响应或通知；它会忽略服务端请求，这些请求不能结算挂起请求。客户端通知方法继续保留，因为 Codex app-server 握手需要发送 `initialized`。

`subagent-codex` 为 app-server 实际存在的服务端请求方法持有私有的 `CodexJsonRpcTransport` 子类。它复用共享解析器、写入器、请求关联、通知分发和关闭行为，但其响应处理器不属于 SDK 协议包的客户端角色。

Python `HarnessClient` 发送请求并接收响应或通知。它不含 `IncomingRequest`、入站请求队列、`notify`、`next_request`、`respond` 或 `respond_error` API。意外服务端请求与非法帧会在响应关联前被忽略。

`session/prompt` 保持以 `{ messageId }` 立即完成入队结算。TypeScript 与 Python 的高层运行从该持久 inbox 回执开始拥有活动区间，直至整个 agent 下一次进入 idle，并使用 `session.event` 与 `session.status`；协议不含 `session.finished` 通知或同步提示词结果。

## 验证

按方向划分的 TypeScript 传输测试固定请求关联、通知、忽略方向外帧、非法输入、处理器错误、中止、流关闭与 flush 行为。Codex 协议测试固定其私有服务端请求响应以及 `initialize` → `initialized` 握手。Python 客户端测试固定意外请求隔离、非法帧、并发关联、通知、运行时退出、已删除的公开 API 与即时 message-id 结算。构建后 JSON-RPC 冒烟测试与两套 SDK 输出快照覆盖组装后的协议。

## 备选方案

**保留通用对称 JSON-RPC 对等端。** 否决，因为 SDK 协议没有服务端发起的请求；未来的交互方法需要独立的类型化协议设计，而不是休眠的通用 API。

**随 SDK 对等端角色一并删除 Codex 服务端请求处理。** 否决，因为 Codex 0.147.0 使用这些请求处理命令、文件、权限、用户输入与 MCP 决定。私有产品适配器既保留当前行为，也不会将其暴露给 SDK 客户端。

**同步结算 `session/prompt` 或增加 `session.finished`。** 否决，因为一个提示词并不拥有 agent 下一次进入 idle 前的全部工作。消息 ID 是持久入队回执；会话事件与状态转换描述后续活动，但不会声称提示词级因果关系。

## 后果

SDK 消费方无法通过 `HarnessClient` 发起运行时通知或响应运行时请求，意外请求帧也无法夺取响应等待项。TypeScript 传输仍为当前 Codex 握手承载出站通知。未来的 SDK 服务端请求方法需要显式的类型化扩展与客户端所有权模型。

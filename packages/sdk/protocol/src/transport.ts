/**
 * Directional newline-delimited JSON-RPC 2.0 transports over byte streams.
 * Servers accept requests and send responses or notifications. Clients send
 * requests or notifications and accept responses or notifications. Frames
 * outside an endpoint's direction and malformed lines are ignored.
 *
 * @module @deepseek-ai/dsh-sdk-protocol/transport
 */

import { randomUUID } from 'node:crypto'
import type { Readable, Writable } from 'node:stream'
import { StringDecoder } from 'node:string_decoder'

type JsonRpcId = string | number
type JsonRpcFrame = Record<string, unknown>
type RequestHandler = (method: string, params: Record<string, unknown>) => Promise<unknown>
type NotificationHandler = (method: string, params: Record<string, unknown>) => void

/** A JSON-RPC error response, preserving the wire `code` and optional `data`. */
export class JsonRpcResponseError extends Error {
  /**
   * @param code - the wire error code, or `undefined` when the peer sent none.
   * @param message - the wire error message.
   * @param data - the optional structured error payload, verbatim.
   */
  constructor(readonly code: number | undefined, message: string, readonly data?: unknown) {
    super(message)
    this.name = 'JsonRpcResponseError'
  }
}

/** Notification-only dependency consumed by {@link HarnessSdkJsonRpcServer}. */
export interface JsonRpcServerNotifier {
  /**
   * Send a server-to-client notification; omitted params produce no `params` member.
   * @param method - the JSON-RPC method name.
   * @param params - the optional notification parameters object.
   */
  notify(method: string, params?: object): void
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
}

abstract class JsonRpcLineEndpoint {
  private buffer = ''
  private readonly decoder = new StringDecoder('utf8')
  private started = false

  constructor(
    private readonly input: Readable,
    private readonly output: Writable,
  ) {}

  /** Attach the input listeners and begin reading frames. Idempotent. */
  start(): void {
    if (this.started) return
    this.started = true
    this.input.on('data', this.onData)
    this.input.on('error', this.onInputError)
    this.input.on('end', this.onInputEnd)
  }

  /** Detach input listeners without destroying the caller-owned streams. */
  close(): void {
    this.input.off('data', this.onData)
    this.input.off('error', this.onInputError)
    this.input.off('end', this.onInputEnd)
  }

  /**
   * Wait for prior frame write callbacks. The empty barrier emits no bytes.
   * @returns a promise that settles with the output write callback.
   */
  flush(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.output.write('', (error) => {
        if (error) reject(error)
        else resolve()
      })
    })
  }

  protected write(message: JsonRpcFrame): void {
    this.output.write(`${JSON.stringify(message)}\n`)
  }

  protected abstract handleFrame(frame: JsonRpcFrame): Promise<void> | void

  protected handleInputFailure(_error: Error): void {}

  private readonly onData = (chunk: Buffer | string): void => {
    this.buffer += typeof chunk === 'string' ? chunk : this.decoder.write(chunk)
    this.drainLines()
  }

  private drainLines(): void {
    for (;;) {
      const newline = this.buffer.indexOf('\n')
      if (newline < 0) break
      const line = this.buffer.slice(0, newline).trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (!line) continue
      void this.handleLine(line)
    }
  }

  private readonly onInputError = (error: Error): void => {
    this.handleInputFailure(error)
  }

  private readonly onInputEnd = (): void => {
    this.buffer += this.decoder.end()
    this.drainLines()
    this.handleInputFailure(new Error('JSON-RPC input closed'))
  }

  private async handleLine(line: string): Promise<void> {
    let message: unknown
    try {
      message = JSON.parse(line)
    } catch {
      // Only JSON syntax errors reach this catch; malformed peer lines are ignored.
      return
    }
    if (!message || typeof message !== 'object') return
    await this.handleFrame(message as JsonRpcFrame)
  }
}

/**
 * Server endpoint for inbound requests and outbound responses or notifications.
 * Response and notification frames received from the client are ignored.
 */
export class JsonRpcLineServerTransport extends JsonRpcLineEndpoint implements JsonRpcServerNotifier {
  private requestHandler: RequestHandler | undefined

  /**
   * @param input - caller-owned client-to-server byte stream.
   * @param output - caller-owned server-to-client byte stream.
   */
  constructor(input: Readable, output: Writable) {
    super(input, output)
  }

  /**
   * Install the request handler, replacing any prior handler.
   * @param handler - resolves to the response `result`; a rejection becomes a
   * `-32603` error response carrying the message.
   */
  onRequest(handler: RequestHandler): void {
    this.requestHandler = handler
  }

  /**
   * Send a server-to-client notification; omitted params produce no `params` member.
   * @param method - the JSON-RPC method name.
   * @param params - the optional notification parameters object.
   */
  notify(method: string, params?: object): void {
    this.write(params === undefined ? { jsonrpc: '2.0', method } : { jsonrpc: '2.0', method, params })
  }

  protected async handleFrame(frame: JsonRpcFrame): Promise<void> {
    const id = frame.id
    const method = frame.method
    if (!isJsonRpcId(id) || typeof method !== 'string') return
    const handler = this.requestHandler
    if (!handler) {
      this.writeError(id, -32601, `method not found: ${method}`)
      return
    }
    try {
      const result = await handler(method, objectParams(frame.params))
      this.write({ jsonrpc: '2.0', id, result })
    } catch (error) {
      this.writeError(id, -32603, error instanceof Error ? error.message : String(error))
    }
  }

  private writeError(id: JsonRpcId, code: number, message: string): void {
    this.write({ jsonrpc: '2.0', id, error: { code, message } })
  }
}

/**
 * Client endpoint for outbound requests or notifications and inbound responses
 * or notifications. Request frames received from the server are ignored.
 */
export class JsonRpcLineClientTransport extends JsonRpcLineEndpoint {
  private notificationHandler: NotificationHandler | undefined
  private readonly pending = new Map<JsonRpcId, PendingRequest>()

  /**
   * @param input - caller-owned server-to-client byte stream.
   * @param output - caller-owned client-to-server byte stream.
   */
  constructor(input: Readable, output: Writable) {
    super(input, output)
  }

  /** Detach listeners and reject pending requests without destroying the streams. */
  override close(): void {
    super.close()
    this.failPending(new Error('JSON-RPC transport closed'))
  }

  /**
   * Install the notification handler, replacing any prior handler.
   * @param handler - invoked per notification with the method and normalized params object.
   */
  onNotification(handler: NotificationHandler): void {
    this.notificationHandler = handler
  }

  /**
   * Send a request and await its response.
   * @param method - the JSON-RPC method name.
   * @param params - the request parameters object.
   * @param signal - optional abandonment signal; aborting removes the pending entry.
   * @returns the result; rejects with {@link JsonRpcResponseError} on an error
   * response, and with a plain `Error` on abort, write failure, or closure.
   */
  request(method: string, params: object, signal?: AbortSignal): Promise<unknown> {
    const id = `req_${randomUUID().replaceAll('-', '')}`
    return new Promise((resolve, reject) => {
      let detach = (): void => {}
      if (signal !== undefined) {
        if (signal.aborted) {
          reject(abortError(signal.reason))
          return
        }
        const onAbort = (): void => {
          this.pending.delete(id)
          reject(abortError(signal.reason))
        }
        signal.addEventListener('abort', onAbort, { once: true })
        detach = () => { signal.removeEventListener('abort', onAbort) }
      }
      this.pending.set(id, {
        resolve: (value) => {
          detach()
          resolve(value)
        },
        reject: (error) => {
          detach()
          reject(error)
        },
      })
      try {
        this.write({ jsonrpc: '2.0', id, method, params })
      } catch (error) {
        this.pending.delete(id)
        detach()
        reject(error instanceof Error ? error : new Error(String(error)))
      }
    })
  }

  /**
   * Send a client-to-server notification; omitted params produce no `params` member.
   * @param method - the JSON-RPC method name.
   * @param params - the optional notification parameters object.
   */
  notify(method: string, params?: object): void {
    this.write(params === undefined ? { jsonrpc: '2.0', method } : { jsonrpc: '2.0', method, params })
  }

  protected override handleInputFailure(error: Error): void {
    this.failPending(error)
  }

  protected handleFrame(frame: JsonRpcFrame): void {
    const id = frame.id
    const method = frame.method
    if (isJsonRpcId(id) && typeof method === 'string') return
    if (isJsonRpcId(id)) {
      this.handleResponse(id, frame)
      return
    }
    if (typeof method === 'string') {
      this.notificationHandler?.(method, objectParams(frame.params))
    }
  }

  private handleResponse(id: JsonRpcId, frame: JsonRpcFrame): void {
    const pending = this.pending.get(id)
    if (!pending) return
    this.pending.delete(id)
    if (frame.error && typeof frame.error === 'object') {
      const error = frame.error as JsonRpcFrame
      pending.reject(new JsonRpcResponseError(
        typeof error.code === 'number' ? error.code : undefined,
        typeof error.message === 'string' ? error.message : 'JSON-RPC error',
        error.data,
      ))
      return
    }
    pending.resolve(frame.result)
  }

  private failPending(error: Error): void {
    const pending = [...this.pending.values()]
    this.pending.clear()
    for (const waiter of pending) waiter.reject(error)
  }
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return typeof value === 'string' || typeof value === 'number'
}

function objectParams(params: unknown): Record<string, unknown> {
  return params && typeof params === 'object' && !Array.isArray(params) ? params as Record<string, unknown> : {}
}

function abortError(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error(`JSON-RPC request aborted: ${String(reason)}`)
}

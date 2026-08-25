import { PassThrough, Writable } from 'node:stream'
import { describe, expect, it } from 'vitest'
import {
  JsonRpcLineClientTransport,
  JsonRpcLineServerTransport,
  JsonRpcResponseError,
} from '../src/index.ts'

type JsonObject = Record<string, unknown>

function clientHarness() {
  const input = new PassThrough()
  const output = new PassThrough()
  return { input, output, transport: new JsonRpcLineClientTransport(input, output) }
}

function serverHarness() {
  const input = new PassThrough()
  const output = new PassThrough()
  return { input, output, transport: new JsonRpcLineServerTransport(input, output) }
}

function readFrames(output: PassThrough): JsonObject[] {
  const chunk = output.read() as Buffer | null
  if (chunk === null) return []
  return chunk.toString('utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as JsonObject)
}

async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 10))
}

describe('JsonRpcLineClientTransport', () => {
  it('sends requests and correlates out-of-order responses while receiving notifications', async () => {
    const { input, output, transport } = clientHarness()
    const notifications: JsonObject[] = []
    transport.onNotification((method, params) => { notifications.push({ method, params }) })
    transport.start()

    const first = transport.request('first', { value: 1 })
    const second = transport.request('second', { value: 2 })
    const [firstFrame, secondFrame] = readFrames(output)
    expect(firstFrame?.method).toBe('first')
    expect(secondFrame?.method).toBe('second')

    input.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'tick' })}\n`)
    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: secondFrame?.id, result: 'two' })}\n`)
    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: firstFrame?.id, result: 'one' })}\n`)

    await expect(first).resolves.toBe('one')
    await expect(second).resolves.toBe('two')
    expect(notifications).toEqual([{ method: 'tick', params: {} }])
    transport.close()
  })

  it('ignores an unexpected server request without settling or answering it', async () => {
    const { input, output, transport } = clientHarness()
    transport.start()

    let settled = false
    const pending = transport.request('client-call', {}).then((value) => {
      settled = true
      return value
    })
    const [request] = readFrames(output)
    input.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: request?.id,
      method: 'server-call',
      params: { unexpected: true },
    })}\n`)
    await settle()

    expect(settled).toBe(false)
    expect(readFrames(output)).toEqual([])

    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: request?.id, result: 'client-result' })}\n`)
    await expect(pending).resolves.toBe('client-result')
    transport.close()
  })

  it('sends the outbound notification required by Codex initialization', () => {
    const { output, transport } = clientHarness()

    transport.notify('initialized')

    expect(readFrames(output)).toEqual([{ jsonrpc: '2.0', method: 'initialized' }])
    transport.close()
  })

  it('preserves structured and malformed JSON-RPC error responses', async () => {
    const { input, output, transport } = clientHarness()
    transport.start()

    const structured = transport.request('structured-error', {})
    const [structuredFrame] = readFrames(output)
    input.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: structuredFrame?.id,
      error: { code: 7, message: 'structured', data: { detail: 'x' } },
    })}\n`)
    const failure = await structured.then(
      () => { throw new Error('request unexpectedly succeeded') },
      (error: unknown) => error,
    )
    expect(failure).toBeInstanceOf(JsonRpcResponseError)
    expect(failure).toMatchObject({ code: 7, message: 'structured', data: { detail: 'x' } })

    const malformed = transport.request('malformed-error', {})
    const [malformedFrame] = readFrames(output)
    input.write(`${JSON.stringify({ jsonrpc: '2.0', id: malformedFrame?.id, error: {} })}\n`)
    await expect(malformed).rejects.toThrow('JSON-RPC error')
    transport.close()
  })

  it('abandons pre-aborted and pending requests without retaining waiter state', async () => {
    const { output, transport } = clientHarness()
    const preAborted = new AbortController()
    preAborted.abort(new Error('already gone'))
    await expect(transport.request('never-sent', {}, preAborted.signal)).rejects.toThrow('already gone')
    expect(readFrames(output)).toEqual([])

    const controller = new AbortController()
    const pending = transport.request('never-answered', {}, controller.signal)
    controller.abort('plain-string-reason')
    await expect(pending).rejects.toThrow('JSON-RPC request aborted: plain-string-reason')
    expect((transport as unknown as { pending: Map<string, unknown> }).pending.size).toBe(0)
    transport.close()
  })

  it('ignores malformed and unmatched frames and preserves split multibyte notifications', async () => {
    const { input, transport } = clientHarness()
    const notifications: JsonObject[] = []
    transport.onNotification((method, params) => { notifications.push({ method, params }) })
    transport.start()
    transport.start()

    input.write('not json\n\nnull\n{"jsonrpc":"2.0","params":{}}\n')
    input.write('{"jsonrpc":"2.0","id":"unknown","result":{"ignored":true}}\n')
    const frame = Buffer.from(`${JSON.stringify({
      jsonrpc: '2.0',
      method: 'message',
      params: { text: '你好' },
    })}\n`)
    const characterStart = frame.indexOf(Buffer.from('你'))
    expect(characterStart).toBeGreaterThanOrEqual(0)
    input.write(frame.subarray(0, characterStart + 1))
    input.write(frame.subarray(characterStart + 1))
    await settle()

    expect(notifications).toEqual([{ method: 'message', params: { text: '你好' } }])
    transport.close()
  })

  it('rejects pending requests when input ends, input errors, or the transport closes', async () => {
    const ended = clientHarness()
    ended.transport.start()
    const endedRequest = ended.transport.request('end', {})
    ended.input.end()
    await expect(endedRequest).rejects.toThrow('JSON-RPC input closed')
    ended.transport.close()

    const errored = clientHarness()
    errored.transport.start()
    const erroredRequest = errored.transport.request('error', {})
    errored.input.emit('error', new Error('input broke'))
    await expect(erroredRequest).rejects.toThrow('input broke')
    errored.transport.close()

    const closed = clientHarness()
    const closedRequest = closed.transport.request('close', {})
    closed.transport.close()
    await expect(closedRequest).rejects.toThrow('JSON-RPC transport closed')
  })

  it('rejects request writes that throw Error and non-Error values', async () => {
    for (const failure of [new Error('write exploded'), 'write string']) {
      const output = {
        write() {
          throw failure
        },
      }
      const transport = new JsonRpcLineClientTransport(new PassThrough(), output as never)
      await expect(transport.request('write-fails', {})).rejects.toThrow(
        failure instanceof Error ? failure.message : failure,
      )
    }
  })

  it('flush waits for prior writes and reports its callback failure', async () => {
    const events: string[] = []
    const output = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        const label = chunk.length === 0 ? 'barrier' : 'frame'
        events.push(`start:${label}`)
        setTimeout(() => {
          events.push(`finish:${label}`)
          callback()
        }, 5)
      },
    })
    const transport = new JsonRpcLineClientTransport(new PassThrough(), output)
    transport.notify('tick')
    await transport.flush()
    expect(events).toEqual([
      'start:frame',
      'finish:frame',
      'start:barrier',
      'finish:barrier',
    ])
    transport.close()

    const failedOutput = {
      write(_chunk: string, callback?: (error?: Error) => void) {
        callback?.(new Error('flush failed'))
        return true
      },
    }
    const failed = new JsonRpcLineClientTransport(new PassThrough(), failedOutput as never)
    await expect(failed.flush()).rejects.toThrow('flush failed')
  })
})

describe('JsonRpcLineServerTransport', () => {
  it('handles inbound requests and normalizes non-object params', async () => {
    const { input, output, transport } = serverHarness()
    const seen: JsonObject[] = []
    transport.onRequest(async (method, params) => {
      seen.push({ method, params })
      return { ok: true }
    })
    transport.start()

    input.write('{"jsonrpc":"2.0","id":7,"method":"array-params","params":[]}\n')
    await settle()

    expect(seen).toEqual([{ method: 'array-params', params: {} }])
    expect(readFrames(output)).toEqual([{ jsonrpc: '2.0', id: 7, result: { ok: true } }])
    transport.close()
  })

  it('writes method-not-found and handler-error responses', async () => {
    const missing = serverHarness()
    missing.transport.start()
    missing.input.write('{"jsonrpc":"2.0","id":"missing","method":"absent"}\n')
    await settle()
    expect(readFrames(missing.output)).toEqual([{
      jsonrpc: '2.0',
      id: 'missing',
      error: { code: -32601, message: 'method not found: absent' },
    }])
    missing.transport.close()

    for (const failure of [new Error('handler boom'), 'string boom']) {
      const rejected = serverHarness()
      rejected.transport.onRequest(async () => { throw failure })
      rejected.transport.start()
      rejected.input.write('{"jsonrpc":"2.0","id":1,"method":"explode"}\n')
      await settle()
      expect(readFrames(rejected.output)).toEqual([{
        jsonrpc: '2.0',
        id: 1,
        error: { code: -32603, message: failure instanceof Error ? failure.message : failure },
      }])
      rejected.transport.close()
    }
  })

  it('ignores direction-outside responses and notifications', async () => {
    const { input, output, transport } = serverHarness()
    let handled = false
    transport.onRequest(async () => {
      handled = true
      return {}
    })
    transport.start()

    input.write('{"jsonrpc":"2.0","id":"client-request","result":{}}\n')
    input.write('{"jsonrpc":"2.0","method":"client-notification"}\n')
    await settle()

    expect(handled).toBe(false)
    expect(readFrames(output)).toEqual([])
    transport.close()
  })

  it('sends notifications and ignores malformed frames', async () => {
    const { input, output, transport } = serverHarness()
    transport.start()
    input.write('not json\n\nnull\n{"jsonrpc":"2.0","params":{}}\n')
    transport.notify('session.status', { sessionId: 'main', status: 'idle' })
    transport.notify('heartbeat')
    await settle()

    expect(readFrames(output)).toEqual([
      { jsonrpc: '2.0', method: 'session.status', params: { sessionId: 'main', status: 'idle' } },
      { jsonrpc: '2.0', method: 'heartbeat' },
    ])
    transport.close()
  })
})

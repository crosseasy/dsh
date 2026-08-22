import { connect, createServer } from 'node:net'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Fiber } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type {
  SubprocessHandle,
  SubprocessRuntime,
} from '@deepseek-ai/dsh-subprocess'
import {
  acceptanceEnvironment,
  isServerPageTarget,
  parseSystemChromeVersion,
  runManagedCommand,
  spawnSpec,
  startManagedProcess,
  stopTree,
} from './fusion-real-process.ts'

const fibers: Fiber[] = []
const roots: string[] = []
const DIAGNOSTIC_OUTPUT_MAX_BYTES = 64 * 1024

async function runtime(): Promise<Context['subprocess']> {
  const ctx = new Context()
  fibers.push(await ctx.plugin(LocalSubprocessRuntime))
  return ctx.subprocess
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-fusion-process-'))
  roots.push(root)
  return root
}

function runtimeWithOutput(
  stdoutChunks: readonly Buffer[],
  stderrChunks: readonly Buffer[] = [],
): Pick<SubprocessRuntime, 'spawn'> {
  return {
    spawn: () => {
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      return {
        pid: 1,
        stdin: undefined,
        stdout,
        stderr,
        collected: {},
        done: Promise.resolve().then(() => {
          for (const chunk of stdoutChunks) stdout.write(chunk)
          for (const chunk of stderrChunks) stderr.write(chunk)
          stdout.end()
          stderr.end()
          return { exitCode: 0, signal: null }
        }),
        terminate: () => {},
        waitForExit: () => Promise.resolve(true),
      }
    },
  }
}

function runtimeWithBufferedReadiness(): Pick<SubprocessRuntime, 'spawn'> {
  return {
    spawn: () => {
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      let stdoutAccesses = 0
      return {
        pid: 1,
        stdin: undefined,
        get stdout() {
          stdoutAccesses += 1
          if (stdoutAccesses === 2) stdout.emit('data', Buffer.from('READY-BUFFERED\n'))
          return stdout
        },
        stderr,
        collected: {},
        done: new Promise<never>(() => {}),
        terminate: () => {},
        waitForExit: () => new Promise<boolean>(() => {}),
      }
    },
  }
}

function neverSettlingHandle(
  treeStops = false,
  treeWaitSettles = true,
  treeWaitDelayMs = 0,
): {
  handle: SubprocessHandle
  rejectDone(error: Error): void
  unboundedWaits(): number
} {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  let rejectDone!: (error: Error) => void
  let unboundedWaits = 0
  const done = new Promise<never>((_resolve, reject) => {
    rejectDone = reject
  })
  return {
    handle: {
      pid: 99,
      stdin: undefined,
      stdout,
      stderr,
      collected: {},
      done,
      terminate: () => {},
      waitForExit: (signal?: AbortSignal) => {
        if (signal !== undefined && treeWaitSettles) {
          return new Promise<boolean>((resolve) => {
            setTimeout(() => { resolve(treeStops) }, treeWaitDelayMs)
          })
        }
        unboundedWaits += 1
        return new Promise<boolean>(() => {})
      },
    },
    rejectDone,
    unboundedWaits: () => unboundedWaits,
  }
}

async function settleWithin<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`operation did not settle within ${String(timeoutMs)}ms`))
    }, timeoutMs)
  })
  try {
    return await Promise.race([operation, timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

async function rejectionWithin(operation: Promise<unknown>, timeoutMs: number): Promise<unknown> {
  try {
    await settleWithin(operation, timeoutMs)
  } catch (error) {
    return error
  }
  throw new Error('expected operation to reject')
}

async function captureChunks(stdoutChunks: readonly Buffer[]): Promise<string> {
  const result = await runManagedCommand(
    runtimeWithOutput(stdoutChunks),
    spawnSpec(['/stub'], process.cwd()),
    'output probe',
    1_000,
  )
  return result.stdout
}

async function unusedPort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('test server has no TCP port')
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error === undefined) resolve()
      else reject(error)
    })
  })
  return address.port
}

async function portAcceptsConnections(port: number): Promise<boolean> {
  return await new Promise<boolean>((resolve) => {
    const socket = connect({ host: '127.0.0.1', port })
    const settle = (open: boolean): void => {
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(500, () => { settle(false) })
    socket.once('connect', () => { settle(true) })
    socket.once('error', () => { settle(false) })
  })
}

async function waitForPidFile(path: string): Promise<number> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const pid = Number((await readFile(path, 'utf8')).trim())
      if (Number.isInteger(pid) && pid > 0) return pid
    } catch {
      // The child has not created the file yet.
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`pid file was not written: ${path}`)
}

async function waitForGone(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`process ${String(pid)} remained alive`)
}

afterEach(async () => {
  vi.useRealTimers()
  await Promise.allSettled(fibers.splice(0).map(fiber => fiber.dispose()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  delete process.env.FUSION_ACCEPTANCE_SECRET_TOKEN
})

describe('Fusion REAL managed processes', () => {
  it('scrubs ambient secrets while adding only the explicit acceptance environment', async () => {
    process.env.FUSION_ACCEPTANCE_SECRET_TOKEN = 'must-not-leak'
    const root = await temporaryRoot()
    const env = acceptanceEnvironment(join(root, 'home'), join(root, 'agents'))
    expect(env).toEqual({
      DEEPSEEK_API_KEY: 'fusion-acceptance-no-model-call',
      DEEPSEEK_BASE_URL: undefined,
      DSH_AGENTS_HOME: join(root, 'agents'),
      DSH_HOME: join(root, 'home'),
      DSH_TELEMETRY_DISABLED: '1',
      NODE_OPTIONS: undefined,
    })
    const result = await runManagedCommand(
      await runtime(),
      spawnSpec([
        process.execPath,
        '-e',
        'process.stdout.write(JSON.stringify({ secret: process.env.FUSION_ACCEPTANCE_SECRET_TOKEN, home: process.env.DSH_HOME }))',
      ], root, env),
      'environment probe',
      2_000,
    )
    expect(JSON.parse(result.stdout)).toEqual({ home: join(root, 'home') })
  })

  it('keeps stdout and stderr independently at the exact diagnostic byte limit', async () => {
    const expectedStdout = 'o'.repeat(DIAGNOSTIC_OUTPUT_MAX_BYTES)
    const expectedStderr = 'e'.repeat(DIAGNOSTIC_OUTPUT_MAX_BYTES)
    const result = await runManagedCommand(
      runtimeWithOutput(
        [Buffer.from(`removed-stdout${expectedStdout}`)],
        [Buffer.from(`removed-stderr${expectedStderr}`)],
      ),
      spawnSpec(['/stub'], process.cwd()),
      'independent output probe',
      1_000,
    )
    expect(result.stdout).toBe(expectedStdout)
    expect(result.stderr).toBe(expectedStderr)
    expect(Buffer.byteLength(result.stdout, 'utf8')).toBe(DIAGNOSTIC_OUTPUT_MAX_BYTES)
    expect(Buffer.byteLength(result.stderr, 'utf8')).toBe(DIAGNOSTIC_OUTPUT_MAX_BYTES)
  })

  it('keeps only the diagnostic suffix from one oversized chunk', async () => {
    const suffix = 's'.repeat(DIAGNOSTIC_OUTPUT_MAX_BYTES)
    const output = await captureChunks([Buffer.from(`removed-prefix${suffix}`)])
    expect(output).toBe(suffix)
    expect(output).not.toContain('removed-prefix')
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(DIAGNOSTIC_OUTPUT_MAX_BYTES)
  })

  it('keeps only the diagnostic suffix after multiple chunks wrap the buffer', async () => {
    const chunks = [
      Buffer.from('removed-prefix'.padEnd(40_000, 'a')),
      Buffer.from('b'.repeat(40_000)),
      Buffer.from(`${'c'.repeat(40_000)}retained-suffix`),
    ]
    const expected = Buffer.concat(chunks).subarray(-DIAGNOSTIC_OUTPUT_MAX_BYTES).toString('utf8')
    const output = await captureChunks(chunks)
    expect(output).toBe(expected)
    expect(output).toContain('retained-suffix')
    expect(output).not.toContain('removed-prefix')
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(DIAGNOSTIC_OUTPUT_MAX_BYTES)
  })

  it('keeps a valid UTF-8 suffix when truncation starts inside a multibyte character', async () => {
    const retained = `${'😀'.repeat(16_383)}x`
    const output = await captureChunks([Buffer.from(`😀${retained}`)])
    expect(output).toBe(retained)
    expect(output).not.toContain('�')
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(DIAGNOSTIC_OUTPUT_MAX_BYTES)
  })

  it('bounds the diagnostic string when invalid UTF-8 bytes expand during decoding', async () => {
    const output = await captureChunks([Buffer.alloc(DIAGNOSTIC_OUTPUT_MAX_BYTES, 0xff)])
    expect(Buffer.byteLength(output, 'utf8')).toBeLessThanOrEqual(DIAGNOSTIC_OUTPUT_MAX_BYTES)
    expect(output).toMatch(/^�+$/u)
  })

  it('recognizes a readiness marker split across stdout chunks', async () => {
    const processTree = await startManagedProcess(
      await runtime(),
      spawnSpec([
        process.execPath,
        '-e',
        [
          "process.stdout.write('READY-')",
          "setTimeout(() => { process.stdout.write('SPLIT\\n'); setInterval(() => {}, 1000) }, 50)",
        ].join(';'),
      ], process.cwd(), {}, 50),
      { label: 'split readiness probe', pattern: /READY-(SPLIT)/u, timeoutMs: 2_000 },
    )
    expect(processTree.ready).toBe('SPLIT')
    await stopTree(processTree.handle, 'split readiness probe', 2_000)
    await expect(processTree.done).resolves.toMatchObject({ signal: 'SIGTERM' })
  })

  it('recognizes a readiness marker whose UTF-8 code point crosses chunks', async () => {
    const marker = Buffer.from('READY-界')
    const processTree = await startManagedProcess(
      runtimeWithOutput([
        marker.subarray(0, marker.length - 2),
        marker.subarray(marker.length - 2),
      ]),
      spawnSpec(['/stub'], process.cwd()),
      { label: 'UTF-8 readiness probe', pattern: /READY-(界)/u, timeoutMs: 100 },
    )
    expect(processTree.ready).toBe('界')
    await expect(processTree.done).resolves.toMatchObject({ exitCode: 0, signal: null })
  })

  it('recognizes a readiness marker already captured before readiness listeners attach', async () => {
    const processTree = await settleWithin(startManagedProcess(
      runtimeWithBufferedReadiness(),
      spawnSpec(['/stub'], process.cwd()),
      { label: 'buffered readiness probe', pattern: /READY-(BUFFERED)/u, timeoutMs: 100 },
    ), 50)
    expect(processTree.ready).toBe('BUFFERED')
    expect(processTree.getStdout()).toContain('READY-BUFFERED')
  })

  it('stops the process tree before rejecting a readiness timeout', async () => {
    const root = await temporaryRoot()
    const port = await unusedPort()
    await expect(startManagedProcess(
      await runtime(),
      spawnSpec([
        process.execPath,
        '-e',
        `require('node:net').createServer(() => {}).listen(${String(port)}, '127.0.0.1'); setInterval(() => {}, 1000)`,
      ], root, {}, 50),
      { label: 'readiness probe', pattern: /never-ready/u, timeoutMs: 300 },
    )).rejects.toThrow('readiness probe did not become ready within 300ms')
    await expect(portAcceptsConnections(port)).resolves.toBe(false)
  })

  it('awaits a failed spawn before rejecting', async () => {
    let spawned: SubprocessHandle | undefined
    const service = await runtime()
    const spawn = service.spawn.bind(service)
    service.spawn = (spec) => {
      spawned = spawn(spec)
      return spawned
    }
    await expect(startManagedProcess(
      service,
      spawnSpec(['/definitely-missing-dsh-fusion-command'], process.cwd()),
      { label: 'spawn failure probe', pattern: /ready/u, timeoutMs: 1_000 },
    )).rejects.toThrow()
    expect(spawned).toBeDefined()
    await expect(spawned!.waitForExit()).resolves.toBe(true)
    await expect(spawned!.done).rejects.toThrow()
  })

  it('rejects failed-start cleanup within budget when the process never settles', async () => {
    const stuck = neverSettlingHandle()
    const failure = await rejectionWithin(startManagedProcess(
      { spawn: () => stuck.handle },
      spawnSpec(['/stub'], process.cwd()),
      {
        label: 'stuck readiness probe',
        pattern: /never-ready/u,
        timeoutMs: 1,
        cleanupTimeoutMs: 1,
      },
    ), 50)
    expect(failure).toBeInstanceOf(AggregateError)
    const errors = (failure as AggregateError).errors
    expect(errors).toHaveLength(2)
    expect(errors[0]).toBeInstanceOf(Error)
    expect((errors[0] as Error).message)
      .toContain('stuck readiness probe did not become ready within 1ms')
    expect(errors[1]).toBeInstanceOf(Error)
    expect((errors[1] as Error).message)
      .toBe('process tree 99 exceeded 1ms cleanup budget')
    expect(stuck.unboundedWaits()).toBe(0)
    stuck.rejectDone(new Error('late failed-start outcome'))
    await new Promise<void>((resolve) => { setImmediate(resolve) })
  })

  it('bounds failed-start cleanup when the process-tree wait ignores its signal', async () => {
    const stuck = neverSettlingHandle(false, false)
    const failure = await rejectionWithin(startManagedProcess(
      { spawn: () => stuck.handle },
      spawnSpec(['/stub'], process.cwd()),
      {
        label: 'signal-ignoring tree probe',
        pattern: /never-ready/u,
        timeoutMs: 1,
        cleanupTimeoutMs: 1,
      },
    ), 50)
    expect(failure).toBeInstanceOf(AggregateError)
    const errors = (failure as AggregateError).errors
    expect(errors).toHaveLength(2)
    expect(errors[1]).toMatchObject({
      message: 'process tree 99 exceeded 1ms cleanup budget',
    })
    stuck.rejectDone(new Error('late signal-ignoring outcome'))
    await new Promise<void>((resolve) => { setImmediate(resolve) })
  })

  it('reports a rejected process-tree cleanup wait', async () => {
    const stuck = neverSettlingHandle()
    stuck.handle.waitForExit = () => Promise.reject(new Error('tree cleanup rejected'))
    const failure = await rejectionWithin(startManagedProcess(
      { spawn: () => stuck.handle },
      spawnSpec(['/stub'], process.cwd()),
      {
        label: 'rejected tree probe',
        pattern: /never-ready/u,
        timeoutMs: 1,
        cleanupTimeoutMs: 10,
      },
    ), 50)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors[1]).toMatchObject({
      message: 'tree cleanup rejected',
    })
    stuck.rejectDone(new Error('late rejected-tree outcome'))
    await new Promise<void>((resolve) => { setImmediate(resolve) })
  })

  it('rejects stopTree within budget when the process never settles', async () => {
    const stuck = neverSettlingHandle()
    const failure = await rejectionWithin(
      stopTree(stuck.handle, 'stuck stop probe', 1),
      50,
    )
    expect(failure).toMatchObject({
      message: 'stuck stop probe process tree 99 exceeded 1ms cleanup budget',
    })
    expect(stuck.unboundedWaits()).toBe(0)
    stuck.rejectDone(new Error('late stop outcome'))
    await new Promise<void>((resolve) => { setImmediate(resolve) })
  })

  it('uses one stopTree deadline when the tree stops but outcome never settles', async () => {
    vi.useFakeTimers()
    const stuck = neverSettlingHandle(true, true, 3_000)
    const failurePromise = rejectionWithin(
      stopTree(stuck.handle, 'stuck stop outcome probe', 5_000),
      6_000,
    )
    await vi.advanceTimersByTimeAsync(3_000)
    await vi.advanceTimersByTimeAsync(2_000)
    await vi.advanceTimersByTimeAsync(1_000)
    const failure = await failurePromise

    expect(failure).toMatchObject({
      message: 'stuck stop outcome probe process outcome for tree 99 exceeded 5000ms cleanup budget',
    })
    expect(vi.getTimerCount()).toBe(0)
    stuck.rejectDone(new Error('late stop outcome settlement'))
    await Promise.resolve()
  })

  it('preserves a rejected stopTree process-tree wait', async () => {
    const stuck = neverSettlingHandle()
    const treeFailure = new Error('stop tree wait rejected')
    stuck.handle.waitForExit = () => Promise.reject(treeFailure)

    await expect(stopTree(stuck.handle, 'rejected stop probe', 5_000))
      .rejects.toBe(treeFailure)
    stuck.rejectDone(new Error('late rejected stop outcome'))
    await Promise.resolve()
  })

  it('preserves a rejected stopTree process outcome', async () => {
    const stuck = neverSettlingHandle()
    const outcomeFailure = new Error('stop outcome rejected')
    stuck.handle.waitForExit = () => Promise.resolve(true)
    const operation = stopTree(stuck.handle, 'rejected outcome probe', 5_000)
    stuck.rejectDone(outcomeFailure)

    await expect(operation).rejects.toBe(outcomeFailure)
  })

  it('returns a normally settled stopTree process outcome', async () => {
    const handle = runtimeWithOutput([]).spawn(spawnSpec(['/stub'], process.cwd()))

    await expect(stopTree(handle, 'normal stop probe', 5_000)).resolves.toEqual({
      exitCode: 0,
      signal: null,
    })
  })

  it('rejects a command timeout within cleanup budget when done never settles', async () => {
    const stuck = neverSettlingHandle()
    const operation = runManagedCommand(
      { spawn: () => stuck.handle },
      spawnSpec(['/stub'], process.cwd(), undefined, 1),
      'stuck command probe',
      1,
    )
    const failure = await rejectionWithin(operation, 50)
    stuck.rejectDone(new Error('late command outcome'))
    await new Promise<void>((resolve) => { setImmediate(resolve) })

    expect(failure).toBeInstanceOf(AggregateError)
    const errors = (failure as AggregateError).errors
    expect(errors).toHaveLength(2)
    expect(errors[0]).toMatchObject({
      message: 'stuck command probe timed out after 1ms\nstdout:\n\nstderr:\n',
    })
    expect(errors[1]).toMatchObject({
      message: 'process tree 99 exceeded 5001ms cleanup budget',
    })
    expect(stuck.unboundedWaits()).toBe(0)
  })

  it('bounds cleanup when the tree stops but command done never settles', async () => {
    vi.useFakeTimers()
    const stuck = neverSettlingHandle(true, true, 3_000)
    const operation = runManagedCommand(
      { spawn: () => stuck.handle },
      spawnSpec(['/stub'], process.cwd(), undefined, 1),
      'stuck command outcome probe',
      1,
    )
    const failurePromise = operation.then(
      () => { throw new Error('expected operation to reject') },
      (error: unknown) => error,
    )
    await vi.advanceTimersByTimeAsync(1)
    await vi.advanceTimersByTimeAsync(3_000)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    const failure = await failurePromise
    stuck.rejectDone(new Error('late stopped-tree outcome'))
    await Promise.resolve()

    expect(failure).toBeInstanceOf(AggregateError)
    const errors = (failure as AggregateError).errors
    expect(errors).toHaveLength(2)
    expect(errors[0]).toMatchObject({
      message: 'stuck command outcome probe timed out after 1ms\nstdout:\n\nstderr:\n',
    })
    expect(errors[1]).toMatchObject({
      message: 'process outcome for tree 99 exceeded 5001ms cleanup budget',
    })
    expect(stuck.unboundedWaits()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('bounds the process-tree wait after command outcome settlement', async () => {
    const stdout = new PassThrough()
    const stderr = new PassThrough()
    let waits = 0
    const handle: SubprocessHandle = {
      pid: 100,
      stdin: undefined,
      stdout,
      stderr,
      collected: {},
      done: Promise.resolve({ exitCode: 0, signal: null }),
      terminate: () => {},
      waitForExit: (signal?: AbortSignal) => {
        waits += 1
        if (waits > 1) return Promise.resolve(false)
        return new Promise<boolean>((resolve) => {
          signal!.addEventListener('abort', () => { resolve(false) }, { once: true })
        })
      },
    }
    const failure = await rejectionWithin(runManagedCommand(
      { spawn: () => handle },
      spawnSpec(['/stub'], process.cwd(), undefined, 1),
      'stuck tree probe',
      1,
    ), 50)

    expect(failure).toBeInstanceOf(AggregateError)
    const errors = (failure as AggregateError).errors
    expect(errors[0]).toMatchObject({
      message: 'stuck tree probe timed out after 1ms\nstdout:\n\nstderr:\n',
    })
    expect(errors[1]).toMatchObject({
      message: 'process tree 100 exceeded 5001ms cleanup budget',
    })
    expect(waits).toBe(2)
  })

  it('does not return from a command timeout until the process is gone', async () => {
    const service = await runtime()
    let spawned: SubprocessHandle | undefined
    const spawn = service.spawn.bind(service)
    service.spawn = (spec) => {
      spawned = spawn(spec)
      return spawned
    }
    await expect(runManagedCommand(
      service,
      spawnSpec([process.execPath, '-e', 'setInterval(() => {}, 1000)'], process.cwd(), {}, 50),
      'slow command',
      100,
    )).rejects.toThrow('slow command timed out after 100ms')
    await expect(spawned!.waitForExit()).resolves.toBe(true)
    await expect(spawned!.done).resolves.toMatchObject({ signal: 'SIGTERM' })
  })

  it.skipIf(process.platform === 'win32')('stops a TERM-trapping descendant before returning', async () => {
    const root = await temporaryRoot()
    const pidFile = join(root, 'descendant.pid')
    const descendantScript = join(root, 'descendant.cjs')
    await writeFile(descendantScript, [
      "const { writeFileSync } = require('node:fs')",
      'process.on("SIGTERM", () => {})',
      'writeFileSync(process.argv[2], String(process.pid))',
      'setInterval(() => {}, 1000)',
      '',
    ].join('\n'))
    const processTree = await startManagedProcess(
      await runtime(),
      spawnSpec([
        '/bin/bash',
        '-c',
        `trap '' TERM; "${process.execPath}" "${descendantScript}" "${pidFile}" & echo READY; wait`,
      ], root, {}, 100),
      { label: 'TERM trap probe', pattern: /READY/u, timeoutMs: 2_000 },
    )
    const descendant = await waitForPidFile(pidFile)
    await stopTree(processTree.handle, 'TERM trap probe', 2_000)
    await expect(processTree.handle.waitForExit(AbortSignal.abort())).resolves.toBe(true)
    await expect(waitForGone(descendant)).resolves.toBeUndefined()
  })
})

describe('system Chrome product validation', () => {
  const base = {
    'Protocol-Version': '1.3',
    webSocketDebuggerUrl: 'ws://127.0.0.1:9333/devtools/browser/id',
  }

  it('accepts Google Chrome', () => {
    expect(parseSystemChromeVersion({ ...base, Browser: 'Chrome/151.0.7922.172' }))
      .toEqual({ ...base, Browser: 'Chrome/151.0.7922.172' })
  })

  it.each([
    ['Chromium', { ...base, Browser: 'Chromium/151.0.0.0' }],
    ['headless Chrome', { ...base, Browser: 'HeadlessChrome/151.0.0.0' }],
    ['missing Browser', base],
  ])('rejects %s', (_label, value) => {
    expect(() => parseSystemChromeVersion(value))
      .toThrow('system Chrome CDP 9333 prerequisite unavailable: invalid /json/version response')
  })
})

describe('Fusion CDP page cleanup', () => {
  const serverUrl = 'http://127.0.0.1:43123'

  it.each([
    ['CDP-normalized root URL', 'http://127.0.0.1:43123/'],
    ['server subpath', 'http://127.0.0.1:43123/sessions/active?view=compact'],
  ])('detects a page target from the server origin: %s', (_label, targetUrl) => {
    expect(isServerPageTarget({ type: 'page', url: targetUrl }, serverUrl)).toBe(true)
  })

  it.each([
    ['different port', { type: 'page', url: 'http://127.0.0.1:43124/' }],
    ['different host', { type: 'page', url: 'http://localhost:43123/' }],
    ['different scheme', { type: 'page', url: 'https://127.0.0.1:43123/' }],
    ['data URL', { type: 'page', url: 'data:text/html,hello' }],
    ['blob URL', { type: 'page', url: 'blob:http://127.0.0.1:43123/id' }],
    ['about URL', { type: 'page', url: 'about:blank' }],
    ['invalid URL', { type: 'page', url: 'not a URL' }],
    ['non-page target', { type: 'worker', url: 'http://127.0.0.1:43123/' }],
    ['non-string URL', { type: 'page', url: undefined }],
  ])('ignores a target outside the server pages: %s', (_label, target) => {
    expect(isServerPageTarget(target, serverUrl)).toBe(false)
  })
})

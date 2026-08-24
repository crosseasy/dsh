import { connect, createServer } from 'node:net'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { spawnSync } from 'node:child_process'
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
  assertFusionCompactLifecycle,
  assertFusionExcludedFromComposition,
  assertFusionExportLedger,
  assertFusionForkSelection,
  assertPetOnlyRootResponse,
  assertSameHttpResponse,
  assertSameModelInput,
  FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS,
  FUSION_ACCEPTANCE_FRAMEWORK_HEADROOM_MS,
  FUSION_ACCEPTANCE_OPERATION_TIMEOUT_MS,
  FUSION_ACCEPTANCE_TIMEOUT_MS,
  isServerPageTarget,
  parseSystemChromeVersion,
  readHttpResponse,
  runAcceptanceLifecycle,
  runManagedCommand,
  setupFusionAcceptanceProfile,
  withOwnedTemporaryRoot,
  spawnSpec,
  startManagedProcess,
  stopTree,
} from './fusion-real-process.ts'

const fibers: Fiber[] = []
const roots: string[] = []
const DIAGNOSTIC_OUTPUT_MAX_BYTES = 64 * 1024
const PET_REVISION = '488510ccdfca'
const PET_ENTRY = {
  id: '@linxin666/dsh-pet',
  url: `/plugins/@linxin666/dsh-pet/client.js?rev=${PET_REVISION}`,
  rev: PET_REVISION,
  inject: [
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-connection',
    '@deepseek-ai/dsh-client-ui-settings',
    '@deepseek-ai/dsh-client-ui-conversation',
  ],
}
const STOCK_BOOT_ENTRIES = [
  {
    id: '@deepseek-ai/dsh-client-runtime',
    url: '/plugins/@deepseek-ai/dsh-client-runtime/client.js?rev=111111111111',
    rev: '111111111111',
    immediately: true,
  },
  {
    id: '@deepseek-ai/dsh-client-ui-settings',
    url: '/plugins/@deepseek-ai/dsh-client-ui-settings/client.js?rev=222222222222',
    rev: '222222222222',
    inject: ['@deepseek-ai/dsh-client-runtime'],
  },
] as const

function bootGraph(entries: readonly unknown[], rev?: string): {
  entries: readonly unknown[]
  rev: string
} {
  return {
    rev: rev ?? createHash('sha1').update(JSON.stringify(entries)).digest('hex').slice(0, 12),
    entries,
  }
}

function responseWithBoot(
  graph: unknown,
  options: { afterScript?: string; assignment?: string; duplicate?: boolean } = {},
): {
  body: Buffer
  headers: Array<readonly [string, readonly string[]]>
  status: number
} {
  const assignment = options.assignment
    ?? `window.__DSH_BOOT__ = ${JSON.stringify(graph)}`
  const script = `<script>${assignment}</script>`
  return {
    status: 200,
    headers: [['content-type', ['text/html; charset=utf-8']]],
    body: Buffer.from(`<!doctype html><html><head>${script}${options.duplicate === true ? script : ''}</head><body>stock</body></html>${options.afterScript ?? ''}`),
  }
}

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

async function withHttpSnapshots(
  routes: Record<string, { body: Buffer; headers?: Record<string, string | string[]> }>,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createHttpServer((request, response) => {
    const route = routes[request.url ?? '/']
    if (route === undefined) {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      ...route.headers,
    })
    response.end(route.body)
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('test server has no TCP port')
  try {
    await run(`http://127.0.0.1:${String(address.port)}`)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error === undefined) resolve()
        else reject(error)
      })
    })
  }
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

async function termTrappingProcessTree(
  root: string,
  ready = false,
  descendantDelayMs = 0,
): Promise<{
  argv: string[]
  descendantPidFile: string
}> {
  const descendantPidFile = join(root, 'descendant.pid')
  const descendantScript = join(root, 'descendant.cjs')
  await writeFile(descendantScript, [
    "const { writeFileSync } = require('node:fs')",
    'process.on("SIGTERM", () => {})',
    `setTimeout(() => writeFileSync(process.argv[2], String(process.pid)), ${String(descendantDelayMs)})`,
    'setInterval(() => {}, 1000)',
    '',
  ].join('\n'))
  return {
    argv: [
      '/bin/bash',
      '-c',
      `trap '' TERM; "${process.execPath}" "${descendantScript}" "${descendantPidFile}" & ${ready ? 'echo READY; ' : ''}wait`,
    ],
    descendantPidFile,
  }
}

afterEach(async () => {
  vi.useRealTimers()
  await Promise.allSettled(fibers.splice(0).map(fiber => fiber.dispose()))
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  delete process.env.FUSION_ACCEPTANCE_SECRET_TOKEN
})

describe('Fusion profile fixture setup', () => {
  it('starts the frozen install without fixture node_modules and verifies the Pet entry', async () => {
    const root = await temporaryRoot()
    const source = join(root, 'source')
    const target = join(root, 'target')
    const trackedFiles = {
      'cordis.patch.yml': '[]\n',
      'package.json': '{"dependencies":{"@linxin666/dsh-pet":"0.2.9"}}\n',
      'pnpm-lock.yaml': 'lockfileVersion: 9.0\n',
      'pnpm-workspace.yaml': 'packages:\\n  - .\\n',
    }
    await Promise.all([
      ...Object.entries(trackedFiles).map(async ([path, contents]) => {
        await mkdir(source, { recursive: true })
        await writeFile(join(source, path), contents)
      }),
      mkdir(join(source, 'node_modules', '@linxin666', 'dsh-pet', 'lib'), { recursive: true })
        .then(async () => {
          await writeFile(
            join(source, 'node_modules', '@linxin666', 'dsh-pet', 'package.json'),
            '{"name":"@linxin666/dsh-pet","version":"0.0.0-tampered"}\n',
          )
          await writeFile(
            join(source, 'node_modules', '@linxin666', 'dsh-pet', 'lib', 'index.js'),
            'throw new Error("tampered fixture entry")\n',
          )
        }),
    ])

    let installSawCleanProfile = false
    const mainPath = await setupFusionAcceptanceProfile(source, target, async () => {
      installSawCleanProfile = !existsSync(join(target, 'node_modules'))
      const packageRoot = join(target, 'node_modules', '@linxin666', 'dsh-pet')
      await mkdir(join(packageRoot, 'lib'), { recursive: true })
      await writeFile(join(packageRoot, 'package.json'), JSON.stringify({
        name: '@linxin666/dsh-pet',
        version: '0.2.9',
        type: 'module',
        main: 'lib/index.js',
        exports: {
          '.': './lib/index.js',
          './package.json': './package.json',
        },
      }))
      await writeFile(join(packageRoot, 'lib', 'index.js'), 'export const installed = true\n')
    })

    expect(installSawCleanProfile).toBe(true)
    expect(JSON.parse(await readFile(join(target, 'package.json'), 'utf8')))
      .toMatchObject({ dependencies: { '@linxin666/dsh-pet': '0.2.9' } })
    expect(mainPath).toBe(
      await realpath(join(target, 'node_modules', '@linxin666', 'dsh-pet', 'lib', 'index.js')),
    )
    await expect(readFile(mainPath, 'utf8')).resolves.toBe('export const installed = true\n')
  })
})

describe('Fusion REAL managed processes', () => {
  it('reserves cleanup and framework headroom inside the Vitest timeout', () => {
    expect(
      FUSION_ACCEPTANCE_OPERATION_TIMEOUT_MS
      + FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS
      + FUSION_ACCEPTANCE_FRAMEWORK_HEADROOM_MS,
    ).toBe(FUSION_ACCEPTANCE_TIMEOUT_MS)
    expect(FUSION_ACCEPTANCE_FRAMEWORK_HEADROOM_MS).toBeGreaterThan(0)
  })

  it('starts cleanup when Vitest cancellation interrupts a signal-independent await', async () => {
    const test = new AbortController()
    const waiting = Promise.withResolvers<undefined>()
    const events: string[] = []
    const reason = new Error('Vitest cancelled the acceptance')
    const lifecycle = runAcceptanceLifecycle({
      testSignal: test.signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async () => {
        events.push('operation:start')
        await waiting.promise
        events.push('operation:settled')
      },
      cleanup: async () => {
        events.push('cleanup:start')
        waiting.resolve(undefined)
        await Promise.resolve()
        events.push('cleanup:settled')
      },
    })

    test.abort(reason)
    await expect(settleWithin(lifecycle, 250)).rejects.toBe(reason)
    expect(events).toEqual([
      'operation:start',
      'cleanup:start',
      'operation:settled',
      'cleanup:settled',
    ])
  })

  it('starts cleanup when the internal operation deadline expires', async () => {
    let cleanupStarted = false
    let operationSignal: AbortSignal | undefined
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 10,
      cleanupTimeoutMs: 20,
      operation: async (signal) => {
        operationSignal = signal
        await new Promise<never>(() => {})
      },
      cleanup: async () => {
        cleanupStarted = true
      },
    })

    const failure = await rejectionWithin(lifecycle, 250)

    expect(operationSignal?.aborted).toBe(true)
    expect(cleanupStarted).toBe(true)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([
      expect.objectContaining({ name: 'TimeoutError' }),
      expect.objectContaining({
        message: 'acceptance operation did not settle before the 20ms cleanup deadline',
      }),
    ])
  })

  it('closes a resource acquired after cancellation before the lifecycle returns', async () => {
    const test = new AbortController()
    const reason = new Error('Vitest cancelled the acceptance')
    const acquisition = Promise.withResolvers<{ closed: boolean }>()
    const resource = { closed: false }
    const lifecycle = runAcceptanceLifecycle({
      testSignal: test.signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async (_signal, resources) => {
        await resources.acquire(
          'late resource',
          async () => await acquisition.promise,
          async (owned) => { owned.closed = true },
        )
      },
      cleanup: async () => {},
    })

    test.abort(reason)
    await Promise.resolve()
    acquisition.resolve(resource)
    await expect(settleWithin(lifecycle, 250)).rejects.toBe(reason)
    expect(resource).toEqual({ closed: true })
  })

  it('keeps an ordinary operation result when its cleanup crosses the operation deadline', async () => {
    const result = await runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 10,
      cleanupTimeoutMs: 100,
      operation: async () => 'ordinary-result',
      cleanup: async () => {
        await new Promise(resolve => setTimeout(resolve, 20))
      },
    })

    expect(result).toBe('ordinary-result')
  })

  it('disposes resources serially in reverse order before returning', async () => {
    const events: string[] = []
    const result = await runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async (_signal, resources) => {
        await resources.acquire(
          'first resource',
          async () => ({ name: 'first' }),
          async () => {
            events.push('first:start')
            await Promise.resolve()
            events.push('first:end')
          },
        )
        await resources.acquire(
          'second resource',
          async () => ({ name: 'second' }),
          async () => {
            events.push('second:start')
            await Promise.resolve()
            events.push('second:end')
          },
        )
        return 'operation result'
      },
      cleanup: async () => {
        events.push('final cleanup')
      },
    })

    expect(result).toBe('operation result')
    expect(events).toEqual([
      'second:start',
      'second:end',
      'first:start',
      'first:end',
      'final cleanup',
    ])
  })

  it('bounds a never-settling operation by the cleanup deadline', async () => {
    vi.useFakeTimers()
    const test = new AbortController()
    const cancellation = new Error('Vitest cancelled the acceptance')
    const lifecycle = runAcceptanceLifecycle({
      testSignal: test.signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 50,
      operation: async () => await new Promise<never>(() => {}),
      cleanup: async () => {},
    })

    test.abort(cancellation)
    const failurePromise = rejectionWithin(lifecycle, 100)
    await vi.advanceTimersByTimeAsync(100)
    const failure = await failurePromise

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([
      cancellation,
      expect.objectContaining({
        message: 'acceptance operation did not settle before the 50ms cleanup deadline',
      }),
    ])
  })

  it('reports a pending acquisition when the cleanup deadline expires', async () => {
    vi.useFakeTimers()
    const test = new AbortController()
    const cancellation = new Error('Vitest cancelled the acceptance')
    const lifecycle = runAcceptanceLifecycle({
      testSignal: test.signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 50,
      operation: async (_signal, resources) => await resources.acquire(
        'pending resource',
        async () => await new Promise<never>(() => {}),
        async () => {},
      ),
      cleanup: async () => {},
    })

    test.abort(cancellation)
    const failurePromise = rejectionWithin(lifecycle, 100)
    await vi.advanceTimersByTimeAsync(100)
    const failure = await failurePromise

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([
      cancellation,
      expect.objectContaining({
        message: 'acceptance operation did not settle before the 50ms cleanup deadline',
      }),
      expect.objectContaining({
        message: 'pending resource acquisition did not settle before the 50ms cleanup deadline',
      }),
    ])
  })

  it('bounds a disposer that ignores the cleanup signal', async () => {
    vi.useFakeTimers()
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 50,
      operation: async (_signal, resources) => await resources.acquire(
        'signal-ignoring resource',
        async () => ({}),
        async () => await new Promise<never>(() => {}),
      ),
      cleanup: async () => {},
    })

    const failurePromise = rejectionWithin(lifecycle, 100)
    await vi.advanceTimersByTimeAsync(100)
    const failure = await failurePromise

    expect(failure).toMatchObject({
      message: 'signal-ignoring resource disposer did not settle before the 50ms cleanup deadline',
    })
  })

  it('starts outer cleanup after an inner disposer exhausts the shared deadline', async () => {
    vi.useFakeTimers()
    const outer = { cleaned: false }
    let cleanupSignal: AbortSignal | undefined
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 50,
      operation: async (_signal, resources) => {
        await resources.acquire(
          'outer resource',
          async () => outer,
          async (resource, signal) => {
            cleanupSignal = signal
            resource.cleaned = true
            await new Promise<never>(() => {})
          },
        )
        await resources.acquire(
          'inner resource',
          async () => ({}),
          async () => await new Promise<never>(() => {}),
        )
      },
      cleanup: async () => {},
    })

    const failurePromise = rejectionWithin(lifecycle, 100)
    await vi.advanceTimersByTimeAsync(100)
    const failure = await failurePromise

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([
      expect.objectContaining({
        message: 'inner resource disposer did not settle before the 50ms cleanup deadline',
      }),
      expect.objectContaining({
        message: 'outer resource disposer did not settle before the 50ms cleanup deadline',
      }),
    ])
    expect(cleanupSignal?.aborted).toBe(true)
    expect(outer.cleaned).toBe(true)
  })

  it('does not report a released resource after another disposer exhausts cleanup', async () => {
    vi.useFakeTimers()
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 50,
      operation: async (_signal, resources) => {
        const released = await resources.acquire(
          'released resource',
          async () => ({}),
          async () => {},
        )
        await resources.release(released)
        await resources.acquire(
          'stuck resource',
          async () => ({}),
          async () => await new Promise<never>(() => {}),
        )
      },
      cleanup: async () => {},
    })

    const failurePromise = rejectionWithin(lifecycle, 100)
    await vi.advanceTimersByTimeAsync(100)
    const failure = await failurePromise

    expect(failure).toMatchObject({
      message: 'stuck resource disposer did not settle before the 50ms cleanup deadline',
    })
  })

  it('shares one cleanup deadline across serial disposers', async () => {
    vi.useFakeTimers()
    const events: string[] = []
    const secondFailure = new Error('second disposer failed')
    const finalFailure = new Error('final cleanup failed')
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 50,
      operation: async (_signal, resources) => {
        await resources.acquire(
          'first resource',
          async () => ({}),
          async () => {
            events.push('first:start')
            await new Promise(resolve => setTimeout(resolve, 30))
            events.push('first:end')
          },
        )
        await resources.acquire(
          'second resource',
          async () => ({}),
          async () => {
            events.push('second:start')
            await new Promise(resolve => setTimeout(resolve, 30))
            events.push('second:end')
            throw secondFailure
          },
        )
      },
      cleanup: async () => {
        events.push('final cleanup')
        throw finalFailure
      },
    })

    const failurePromise = lifecycle.then(
      () => ({
        events: [...events],
        failure: new Error('expected operation to reject'),
      }),
      (failure: unknown) => ({ events: [...events], failure }),
    )
    await vi.advanceTimersByTimeAsync(30)
    await vi.advanceTimersByTimeAsync(70)
    const outcome = await failurePromise

    expect(outcome.failure).toBeInstanceOf(AggregateError)
    expect((outcome.failure as AggregateError).errors).toEqual([
      secondFailure,
      expect.objectContaining({
        message: 'first resource disposer did not settle before the 50ms cleanup deadline',
      }),
      finalFailure,
    ])
    expect(outcome.events).toEqual([
      'second:start',
      'second:end',
      'first:start',
      'final cleanup',
    ])
  })

  it('bounds final cleanup that ignores its signal', async () => {
    vi.useFakeTimers()
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 50,
      operation: async () => 'operation result',
      cleanup: async () => await new Promise<never>(() => {}),
    })

    const failurePromise = rejectionWithin(lifecycle, 100)
    await vi.advanceTimersByTimeAsync(100)
    const failure = await failurePromise

    expect(failure).toMatchObject({
      message: 'acceptance final cleanup did not settle before the 50ms cleanup deadline',
    })
  })

  it('preserves an undefined acquisition rejection', async () => {
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async (_signal, resources) => await resources.acquire(
        'undefined acquisition rejection',
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- exercise legal undefined rejection
        async () => await Promise.reject(undefined),
        async () => {},
      ),
      cleanup: async () => {},
    })

    await expect(lifecycle).rejects.toBeUndefined()
  })

  it('preserves an undefined operation rejection', async () => {
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- exercise legal undefined rejection
      operation: async () => await Promise.reject(undefined),
      cleanup: async () => {},
    })

    await expect(lifecycle).rejects.toBeUndefined()
  })

  it('preserves an undefined cleanup rejection', async () => {
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async () => 'operation result',
      cleanup: async () => {
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- exercise legal undefined rejection
        await Promise.reject(undefined)
      },
    })

    await expect(lifecycle).rejects.toBeUndefined()
  })

  it('reports owned resource and final cleanup failures', async () => {
    const resourceFailure = new Error('resource disposer failed')
    const cleanupFailure = new Error('final cleanup failed')
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async (_signal, resources) => await resources.acquire(
        'failed resource',
        async () => ({}),
        async () => { throw resourceFailure },
      ),
      cleanup: async () => { throw cleanupFailure },
    })

    const failure = await rejectionWithin(lifecycle, 250)
    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([resourceFailure, cleanupFailure])
  })

  it('reports one late disposer failure shared by operation and cleanup', async () => {
    const test = new AbortController()
    const acquisition = Promise.withResolvers<object>()
    const cancellation = new Error('Vitest cancelled the acceptance')
    const disposerFailure = new Error('late disposer failed')
    const lifecycle = runAcceptanceLifecycle({
      testSignal: test.signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async (_signal, resources) => await resources.acquire(
        'late failed resource',
        async () => await acquisition.promise,
        async () => { throw disposerFailure },
      ),
      cleanup: async () => {},
    })

    test.abort(cancellation)
    await Promise.resolve()
    acquisition.resolve({})
    const failure = await rejectionWithin(lifecycle, 250)

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([cancellation, disposerFailure])
  })

  it('observes a disposer rejection that arrives after the cleanup deadline', () => {
    const moduleUrl = new URL('./fusion-real-process.ts', import.meta.url).href
    const probe = `
const { runAcceptanceLifecycle } = await import(${JSON.stringify(moduleUrl)})
const late = Promise.withResolvers()
const lifecycle = runAcceptanceLifecycle({
  testSignal: new AbortController().signal,
  operationTimeoutMs: 1_000,
  cleanupTimeoutMs: 5,
  operation: async (_signal, resources) => {
    await resources.acquire(
      'outer resource',
      async () => ({}),
      async () => {
        await late.promise
        throw new Error('late outer disposer rejection')
      },
    )
    await resources.acquire(
      'inner resource',
      async () => ({}),
      async () => await new Promise(() => {}),
    )
  },
  cleanup: async () => {},
})
const failure = await lifecycle.then(() => undefined, error => error)
if (!(failure instanceof AggregateError)) throw new Error('expected aggregate cleanup failure')
late.resolve()
await new Promise(resolve => setTimeout(resolve, 25))
`
    const result = spawnSync(process.execPath, [
      '--unhandled-rejections=strict',
      '--import',
      'tsx/esm',
      '--input-type=module',
      '--eval',
      probe,
    ], {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 5_000,
    })

    expect(result.status, result.stderr).toBe(0)
  })

  it('reports cancellation and a later independent operation rejection', async () => {
    const test = new AbortController()
    const operation = Promise.withResolvers<never>()
    const cancellation = new Error('Vitest cancelled the acceptance')
    const independent = new Error('late independent failure')
    const lifecycle = runAcceptanceLifecycle({
      testSignal: test.signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async () => await operation.promise,
      cleanup: async () => {},
    })

    test.abort(cancellation)
    await Promise.resolve()
    operation.reject(independent)
    const failure = await rejectionWithin(lifecycle, 250)

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([cancellation, independent])
  })

  it('preserves equal primitive failures from independent occurrences', async () => {
    const duplicate = 'same primitive failure'
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async () => {
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- exercise primitive occurrence preservation
        await Promise.reject(duplicate)
      },
      cleanup: async () => {
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- exercise primitive occurrence preservation
        await Promise.reject(duplicate)
      },
    })

    const failure = await rejectionWithin(lifecycle, 250)

    expect(failure).toBeInstanceOf(AggregateError)
    expect((failure as AggregateError).errors).toEqual([duplicate, duplicate])
  })

  it('reports cancellation once when the operation rejects with the same object', async () => {
    const test = new AbortController()
    const operation = Promise.withResolvers<never>()
    const cancellation = new Error('Vitest cancelled the acceptance')
    const lifecycle = runAcceptanceLifecycle({
      testSignal: test.signal,
      operationTimeoutMs: 1_000,
      cleanupTimeoutMs: 100,
      operation: async () => await operation.promise,
      cleanup: async () => {},
    })

    test.abort(cancellation)
    await Promise.resolve()
    operation.reject(cancellation)

    await expect(lifecycle).rejects.toBe(cancellation)
  })

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

  it('removes nested ACP temp directories after the outer deadline stops the runner', async () => {
    process.env.FUSION_ACCEPTANCE_SECRET_TOKEN = 'must-not-leak'
    let temporaryRoot: string | undefined
    let nestedRoot: string | undefined
    const lifecycle = runAcceptanceLifecycle({
      testSignal: new AbortController().signal,
      operationTimeoutMs: 2_000,
      cleanupTimeoutMs: 2_000,
      operation: async (signal, resources) => {
        temporaryRoot = await resources.acquire(
          'nested ACP temporary root',
          async () => await mkdtemp(join(tmpdir(), 'dsh-fusion-acp-lifecycle-')),
          async (ownedRoot) => {
            await rm(ownedRoot, { recursive: true, force: true })
          },
        )
        const env = withOwnedTemporaryRoot({
          ...acceptanceEnvironment(
            join(temporaryRoot, 'home'),
            join(temporaryRoot, 'agents'),
          ),
          DSH_EXAMPLE_MODE: 'lib',
          TSX_TSCONFIG_PATH: undefined,
        }, temporaryRoot)
        const runner = await startManagedProcess(
          await runtime(),
          spawnSpec([
            process.execPath,
            '--eval',
            [
              "const { mkdtempSync } = require('node:fs')",
              "const { tmpdir } = require('node:os')",
              "const { join } = require('node:path')",
              "const root = mkdtempSync(join(tmpdir(), 'acp-e2e-'))",
              'process.stdout.write(`ACP_READY=${JSON.stringify({ root, tmpdir: process.env.TMPDIR, tmp: process.env.TMP, temp: process.env.TEMP, mode: process.env.DSH_EXAMPLE_MODE, secret: process.env.FUSION_ACCEPTANCE_SECRET_TOKEN ?? null })}\\n`)',
              'setInterval(() => {}, 1000)',
            ].join(';'),
          ], temporaryRoot, env, 50),
          {
            label: 'nested ACP temp runner',
            pattern: /ACP_READY=(\{[^\n]+\})/u,
            timeoutMs: 1_000,
            cleanupTimeoutMs: 1_000,
            signal,
          },
        )
        const ready = JSON.parse(runner.ready) as {
          mode: unknown
          root: unknown
          secret: unknown
          temp: unknown
          tmp: unknown
          tmpdir: unknown
        }
        nestedRoot = String(ready.root)
        expect(ready).toEqual({
          root: nestedRoot,
          tmpdir: temporaryRoot,
          tmp: temporaryRoot,
          temp: temporaryRoot,
          mode: 'lib',
          secret: null,
        })
        expect(nestedRoot.startsWith(join(temporaryRoot, 'acp-e2e-'))).toBe(true)
        expect(existsSync(nestedRoot)).toBe(true)

        const command = runManagedCommand(
          { spawn: () => runner.handle },
          spawnSpec(['/already-running-nested-acp'], temporaryRoot, env, 50),
          'nested ACP temp runner',
          10_000,
          signal,
        )
        const rejection = command.then(
          () => new Error('expected nested ACP temp runner to reject'),
          (error: unknown) => error,
        )
        throw await rejection
      },
      cleanup: async () => {},
    })

    const failure = await rejectionWithin(lifecycle, 5_000)

    expect(failure).toMatchObject({ name: 'TimeoutError' })
    expect(temporaryRoot).toBeDefined()
    expect(nestedRoot).toBeDefined()
    expect(existsSync(temporaryRoot!)).toBe(false)
    expect(existsSync(nestedRoot!)).toBe(false)
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
    const root = await temporaryRoot()
    const tree = process.platform === 'win32'
      ? {
        argv: [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
        descendantPidFile: undefined,
      }
      : await termTrappingProcessTree(root, false, 750)
    const service = await runtime()
    const spawned = service.spawn(spawnSpec(tree.argv, root, {}, 50))
    const descendant = tree.descendantPidFile === undefined
      ? undefined
      : await waitForPidFile(tree.descendantPidFile)
    const operation = runManagedCommand(
      { spawn: () => spawned },
      spawnSpec(['/already-running'], root, {}, 50),
      'slow command',
      500,
    )
    const rejection = expect(operation).rejects
      .toThrow('slow command timed out after 500ms')

    await rejection
    await expect(spawned.waitForExit(AbortSignal.abort())).resolves.toBe(true)
    if (descendant !== undefined) await expect(waitForGone(descendant)).resolves.toBeUndefined()
  })

  it('cancels a managed command and settles its process tree before rejecting', async () => {
    const root = await temporaryRoot()
    const tree = process.platform === 'win32'
      ? {
        argv: [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
        descendantPidFile: undefined,
      }
      : await termTrappingProcessTree(root)
    const service = await runtime()
    let spawned: SubprocessHandle | undefined
    const spawn = service.spawn.bind(service)
    service.spawn = (spec) => {
      spawned = spawn(spec)
      return spawned
    }
    const abort = new AbortController()
    const reason = new Error('acceptance deadline elapsed')
    const operation = runManagedCommand(
      service,
      spawnSpec(tree.argv, root, {}, 50),
      'cancelled command',
      5_000,
      abort.signal,
    )
    const descendant = tree.descendantPidFile === undefined
      ? undefined
      : await waitForPidFile(tree.descendantPidFile)
    abort.abort(reason)
    const failure = await rejectionWithin(operation, 2_000)
    if (failure !== reason) spawned?.terminate()
    expect(failure).toBe(reason)
    await expect(spawned!.waitForExit(AbortSignal.abort())).resolves.toBe(true)
    if (descendant !== undefined) await expect(waitForGone(descendant)).resolves.toBeUndefined()
  })

  it('cancels readiness and settles its process tree before rejecting', async () => {
    const root = await temporaryRoot()
    const tree = process.platform === 'win32'
      ? {
        argv: [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
        descendantPidFile: undefined,
      }
      : await termTrappingProcessTree(root)
    const service = await runtime()
    let spawned: SubprocessHandle | undefined
    const spawn = service.spawn.bind(service)
    service.spawn = (spec) => {
      spawned = spawn(spec)
      return spawned
    }
    const abort = new AbortController()
    const reason = new Error('acceptance deadline elapsed')
    const operation = startManagedProcess(
      service,
      spawnSpec(tree.argv, root, {}, 50),
      {
        label: 'cancelled readiness',
        pattern: /never-ready/u,
        timeoutMs: 5_000,
        cleanupTimeoutMs: 2_000,
        signal: abort.signal,
      },
    )
    const descendant = tree.descendantPidFile === undefined
      ? undefined
      : await waitForPidFile(tree.descendantPidFile)
    abort.abort(reason)
    const failure = await rejectionWithin(operation, 2_000)
    if (failure !== reason) spawned?.terminate()
    expect(failure).toBe(reason)
    await expect(spawned!.waitForExit(AbortSignal.abort())).resolves.toBe(true)
    if (descendant !== undefined) await expect(waitForGone(descendant)).resolves.toBeUndefined()
  })

  it.skipIf(process.platform === 'win32')('stops a TERM-trapping descendant before returning', async () => {
    const root = await temporaryRoot()
    const tree = await termTrappingProcessTree(root, true)
    const processTree = await startManagedProcess(
      await runtime(),
      spawnSpec(tree.argv, root, {}, 100),
      { label: 'TERM trap probe', pattern: /READY/u, timeoutMs: 2_000 },
    )
    const descendant = await waitForPidFile(tree.descendantPidFile)
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

describe('Fusion external route probes', () => {
  const baseline = {
    status: 200,
    headers: [['content-type', ['text/html; charset=utf-8']]] as Array<readonly [string, readonly string[]]>,
    body: Buffer.from('<!doctype html><title>DeepSeek Harness</title><div id="root"></div>'),
  }

  it.each([
    {
      label: 'body-only difference',
      response: {
        ...baseline,
        body: Buffer.from('<!doctype html><title>DeepSeek Harness</title><p>route-owned</p>'),
      },
    },
    {
      label: 'JSON',
      response: {
        status: 200,
        headers: [['content-type', ['application/json']]] as Array<readonly [string, readonly string[]]>,
        body: Buffer.from('{"branches":[]}'),
      },
    },
    {
      label: 'redirect',
      response: {
        status: 302,
        headers: [['location', ['/']]] as Array<readonly [string, readonly string[]]>,
        body: Buffer.alloc(0),
      },
    },
    {
      label: 'route-owned HTML containing the stock title',
      response: {
        status: 200,
        headers: [['content-type', ['text/html; charset=utf-8']]] as Array<readonly [string, readonly string[]]>,
        body: Buffer.from('<!doctype html><title>DeepSeek Harness</title><p>route-owned</p>'),
      },
    },
    {
      label: 'mounted 404 handler',
      response: {
        status: 404,
        headers: [['content-type', ['text/plain']]] as Array<readonly [string, readonly string[]]>,
        body: Buffer.from('mounted not found'),
      },
    },
    {
      label: 'mounted 405 handler',
      response: {
        status: 405,
        headers: [['content-type', ['text/plain']]] as Array<readonly [string, readonly string[]]>,
        body: Buffer.from('mounted method refusal'),
      },
    },
  ])('rejects a mounted $label response that differs from the baseline', ({ response }) => {
    expect(() => {
      assertSameHttpResponse(baseline, response, 'GET /blocked')
    }).toThrow('GET /blocked differs from the base + web-app response')
  })

  it('compares the Fusion fallback with the complete independent baseline response', async () => {
    const acceptance = await readFile(
      new URL('./fusion-real-composition.acceptance.ts', import.meta.url),
      'utf8',
    )

    expect(acceptance).toMatch(
      /assertPetOnlyRootResponse\(\s*baselineRoutes\.fallback,\s*fusionFallback,\s*'GET \/',?\s*\)/u,
    )
    expect(acceptance).toMatch(
      /assertSameHttpResponse\(\s*fusionFallback,\s*await readHttpResponse/u,
    )
  })

  it('rejects a semantic header-only response difference', async () => {
    await withHttpSnapshots({
      '/baseline': { body: Buffer.from('same') },
      '/changed': {
        body: Buffer.from('same'),
        headers: { 'x-mounted-plugin': 'true' },
      },
    }, async (baseUrl) => {
      const baselineResponse = await readHttpResponse(new URL('/baseline', baseUrl))
      const changedResponse = await readHttpResponse(new URL('/changed', baseUrl))

      expect(() => {
        assertSameHttpResponse(baselineResponse, changedResponse, 'GET /blocked')
      }).toThrow('GET /blocked differs from the base + web-app response')
    })
  })

  it('preserves unique lowercase keys and ordered raw header values', async () => {
    await withHttpSnapshots({
      '/headers': {
        body: Buffer.from('same'),
        headers: {
          'set-cookie': ['first=1', 'second=2'],
          'x-comma': 'one, two',
          'x-repeat': ['one', 'two'],
        },
      },
    }, async (baseUrl) => {
      const response = await readHttpResponse(new URL('/headers', baseUrl))

      expect(response.headers).toEqual([
        ['content-type', ['application/octet-stream']],
        ['set-cookie', ['first=1', 'second=2']],
        ['x-comma', ['one, two']],
        ['x-repeat', ['one', 'two']],
      ])
    })
  })

  it('distinguishes repeated headers from one comma-containing header', async () => {
    await withHttpSnapshots({
      '/repeated': {
        body: Buffer.from('same'),
        headers: { 'x-repeat': ['one', 'two'] },
      },
      '/comma': {
        body: Buffer.from('same'),
        headers: { 'x-repeat': 'one, two' },
      },
    }, async (baseUrl) => {
      const repeated = await readHttpResponse(new URL('/repeated', baseUrl))
      const comma = await readHttpResponse(new URL('/comma', baseUrl))

      expect(() => {
        assertSameHttpResponse(repeated, comma, 'GET /repeat')
      }).toThrow('GET /repeat differs from the base + web-app response')
    })
  })

  it.each([
    ['UTF-8 BOM', Buffer.from([0xef, 0xbb, 0xbf, 0x61]), Buffer.from([0x61])],
    ['invalid UTF-8 byte', Buffer.from([0xff]), Buffer.from([0xfe])],
  ])('rejects a %s-only response difference', async (_label, baselineBody, changedBody) => {
    await withHttpSnapshots({
      '/baseline': { body: baselineBody },
      '/changed': { body: changedBody },
    }, async (baseUrl) => {
      const baselineResponse = await readHttpResponse(new URL('/baseline', baseUrl))
      const changedResponse = await readHttpResponse(new URL('/changed', baseUrl))

      expect(() => {
        assertSameHttpResponse(baselineResponse, changedResponse, 'GET /blocked')
      }).toThrow('GET /blocked differs from the base + web-app response')
    })
  })
})

describe('Fusion Pet-only root response', () => {
  const baseline = responseWithBoot(bootGraph(STOCK_BOOT_ENTRIES))
  const fusion = responseWithBoot(bootGraph([...STOCK_BOOT_ENTRIES, PET_ENTRY]))

  it('accepts exactly one valid Pet boot entry', () => {
    expect(() => {
      assertPetOnlyRootResponse(baseline, fusion, 'GET /')
    }).not.toThrow()
  })

  it.each([
    ['status', { ...fusion, status: 201 }],
    ['content type', {
      ...fusion,
      headers: [['content-type', ['text/plain']]] as Array<readonly [string, readonly string[]]>,
    }],
    ['location', {
      ...fusion,
      headers: [
        ...fusion.headers,
        ['location', ['/elsewhere']] as const,
      ],
    }],
  ])('rejects a %s difference', (_label, changedFusion) => {
    expect(() => {
      assertPetOnlyRootResponse(baseline, changedFusion, 'GET /')
    }).toThrow()
  })

  it('rejects Pet in the baseline graph', () => {
    expect(() => {
      assertPetOnlyRootResponse(fusion, fusion, 'GET /')
    }).toThrow()
  })

  it.each([
    ['missing', STOCK_BOOT_ENTRIES],
    ['duplicate', [...STOCK_BOOT_ENTRIES, PET_ENTRY, PET_ENTRY]],
  ])('rejects a %s Pet entry in the Fusion graph', (_label, entries) => {
    expect(() => {
      assertPetOnlyRootResponse(
        baseline,
        responseWithBoot(bootGraph(entries)),
        'GET /',
      )
    }).toThrow()
  })

  it('rejects an additional client entry', () => {
    const extra = {
      id: '@example/extra-client',
      url: '/plugins/@example/extra-client/client.js?rev=333333333333',
      rev: '333333333333',
    }
    expect(() => {
      assertPetOnlyRootResponse(
        baseline,
        responseWithBoot(bootGraph([...STOCK_BOOT_ENTRIES, PET_ENTRY, extra])),
        'GET /',
      )
    }).toThrow()
  })

  it.each([
    ['id', [
      { ...STOCK_BOOT_ENTRIES[0], id: '@deepseek-ai/dsh-client-runtime-changed' },
      STOCK_BOOT_ENTRIES[1],
      PET_ENTRY,
    ]],
    ['url', [
      { ...STOCK_BOOT_ENTRIES[0], url: '/plugins/changed/client.js?rev=111111111111' },
      STOCK_BOOT_ENTRIES[1],
      PET_ENTRY,
    ]],
    ['rev', [
      { ...STOCK_BOOT_ENTRIES[0], rev: 'aaaaaaaaaaaa' },
      STOCK_BOOT_ENTRIES[1],
      PET_ENTRY,
    ]],
    ['inject', [
      STOCK_BOOT_ENTRIES[0],
      { ...STOCK_BOOT_ENTRIES[1], inject: ['@deepseek-ai/dsh-client-connection'] },
      PET_ENTRY,
    ]],
    ['immediately', [
      { ...STOCK_BOOT_ENTRIES[0], immediately: false },
      STOCK_BOOT_ENTRIES[1],
      PET_ENTRY,
    ]],
    ['order', [
      STOCK_BOOT_ENTRIES[1],
      STOCK_BOOT_ENTRIES[0],
      PET_ENTRY,
    ]],
  ])('rejects a shared entry %s difference', (_label, entries) => {
    expect(() => {
      assertPetOnlyRootResponse(
        baseline,
        responseWithBoot(bootGraph(entries)),
        'GET /',
      )
    }).toThrow()
  })

  it.each([
    ['missing assignment', {
      ...baseline,
      body: Buffer.from('<!doctype html><html><head></head><body>stock</body></html>'),
    }],
    ['duplicate assignment', responseWithBoot(bootGraph(STOCK_BOOT_ENTRIES), {
      duplicate: true,
    })],
    ['malformed payload', responseWithBoot({ rev: 'aaaaaaaaaaaa' })],
    ['non-JSON assignment', responseWithBoot(undefined, {
      assignment: 'window.__DSH_BOOT__ = {rev:"aaaaaaaaaaaa",entries:[]}',
    })],
  ])('rejects a %s', (_label, invalidBaseline) => {
    expect(() => {
      assertPetOnlyRootResponse(invalidBaseline, fusion, 'GET /')
    }).toThrow()
  })

  it.each([
    ['URL', {
      ...PET_ENTRY,
      url: `/plugins/@example/wrong/client.js?rev=${PET_REVISION}`,
    }],
    ['revision relation', {
      ...PET_ENTRY,
      rev: 'aaaaaaaaaaaa',
    }],
    ['inject list', {
      ...PET_ENTRY,
      inject: ['@deepseek-ai/dsh-client-runtime'],
    }],
    ['extra field', {
      ...PET_ENTRY,
      unexpected: true,
    }],
  ])('rejects a Pet entry with an invalid %s', (_label, petEntry) => {
    expect(() => {
      assertPetOnlyRootResponse(
        baseline,
        responseWithBoot(bootGraph([...STOCK_BOOT_ENTRIES, petEntry])),
        'GET /',
      )
    }).toThrow()
  })

  it.each([
    ['baseline', responseWithBoot(bootGraph(STOCK_BOOT_ENTRIES, 'aaaaaaaaaaaa')), fusion],
    ['Fusion', baseline, responseWithBoot(bootGraph(
      [...STOCK_BOOT_ENTRIES, PET_ENTRY],
      'aaaaaaaaaaaa',
    ))],
  ])('rejects a %s graph revision not derived from its ordered entries', (
    _label,
    baselineResponse,
    fusionResponse,
  ) => {
    expect(() => {
      assertPetOnlyRootResponse(baselineResponse, fusionResponse, 'GET /')
    }).toThrow()
  })

  it('rejects a body-only difference outside the boot script', () => {
    expect(() => {
      assertPetOnlyRootResponse(
        baseline,
        responseWithBoot(bootGraph([...STOCK_BOOT_ENTRIES, PET_ENTRY]), {
          afterScript: '<p>route-owned</p>',
        }),
        'GET /',
      )
    }).toThrow()
  })

  it('rejects distinct raw bytes outside the boot payload that decode to the same text', () => {
    const baselineWithReplacement = {
      ...baseline,
      body: Buffer.concat([Buffer.from([0xef, 0xbf, 0xbd]), baseline.body]),
    }
    const fusionWithInvalidByte = {
      ...fusion,
      body: Buffer.concat([Buffer.from([0xff]), fusion.body]),
    }

    expect(() => {
      assertPetOnlyRootResponse(
        baselineWithReplacement,
        fusionWithInvalidByte,
        'GET /',
      )
    }).toThrow('HTML outside the allowed Pet boot delta changed')
  })
})

describe('Fusion HTTP deadlines', () => {
  it('aborts a pending response through the acceptance signal', async () => {
    const server = createHttpServer(() => {})
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('test server has no TCP port')
    const abort = new AbortController()
    const reason = new Error('acceptance deadline elapsed')
    try {
      const operation = readHttpResponse(
        new URL('/', `http://127.0.0.1:${String(address.port)}`),
        undefined,
        5_000,
        abort.signal,
      )
      abort.abort(reason)
      expect(await rejectionWithin(operation, 250)).toBe(reason)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve()
          else reject(error)
        })
      })
    }
  })

  it('aborts when a route never sends response headers', async () => {
    const server = createHttpServer(() => {})
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('test server has no TCP port')
    try {
      await expect(readHttpResponse(
        new URL('/', `http://127.0.0.1:${String(address.port)}`),
        undefined,
        25,
      )).rejects.toThrow()
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve()
          else reject(error)
        })
      })
    }
  })

  it('aborts when a route sends headers but never finishes its body', async () => {
    const server = createHttpServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.write('partial')
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (address === null || typeof address === 'string') throw new Error('test server has no TCP port')
    try {
      await expect(readHttpResponse(
        new URL('/', `http://127.0.0.1:${String(address.port)}`),
        undefined,
        25,
      )).rejects.toThrow()
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve()
          else reject(error)
        })
      })
    }
  })
})

describe('Fusion scoped model-input comparison', () => {
  const baseline = {
    system: 'base prompt',
    contexts: [{ name: 'runtime', text: 'stable context' }],
    tools: [{
      name: 'bash',
      description: 'run a command',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string' } },
        required: ['command'],
      },
    }],
  }

  it('rejects a same-name tool schema change', () => {
    expect(() => {
      assertSameModelInput(baseline, {
        ...baseline,
        tools: [{
          ...baseline.tools[0]!,
          parameters: {
            type: 'object',
            properties: { command: { type: 'number' } },
            required: ['command'],
          },
        }],
      })
    }).toThrow('Fusion scoped model input differs from the base + web-app baseline')
  })

  it('rejects a tool added only to the Fusion agent scope', () => {
    expect(() => {
      assertSameModelInput(baseline, {
        ...baseline,
        tools: [
          ...baseline.tools,
          {
            name: 'scoped_external_tool',
            description: 'visible only in this agent scope',
            parameters: { type: 'object', properties: {} },
          },
        ],
      })
    }).toThrow('Fusion scoped model input differs from the base + web-app baseline')
  })

  it('rejects a Fusion prompt contribution', () => {
    expect(() => {
      assertSameModelInput(baseline, {
        ...baseline,
        system: `${baseline.system}\n\nexternal prompt contribution`,
      })
    }).toThrow('Fusion scoped model input differs from the base + web-app baseline')
  })
})

describe('Fusion Web regression oracles', () => {
  const exportUrl = 'http://127.0.0.1:43123/api/session.export?sessionId=source&includeDescendants=true'
  const exportLedger = [
    {
      action: 'header' as const,
      completed: true,
      downloadUrl: exportUrl,
      headRequestId: 'request-header',
      headStatus: 200,
      headUrl: exportUrl,
      zipSha256: 'a'.repeat(64),
    },
    {
      action: 'slash' as const,
      completed: true,
      downloadUrl: exportUrl,
      headRequestId: 'request-slash',
      headStatus: 200,
      headUrl: exportUrl,
      zipSha256: 'b'.repeat(64),
    },
  ]
  const exportFailures = [
    {
      requestId: 'request-header',
      method: 'HEAD',
      url: exportUrl,
      errorText: 'net::ERR_ABORTED',
    },
    {
      requestId: 'request-slash',
      method: 'HEAD',
      url: exportUrl,
      errorText: 'net::ERR_ABORTED',
    },
  ]

  it('accepts reverse-order export aborts paired by request identity', () => {
    expect(() => {
      assertFusionExportLedger(
        exportLedger,
        [...exportFailures].reverse(),
        [exportUrl, exportUrl],
      )
    }).not.toThrow()
  })

  it.each([
    ['duplicate header abort with missing slash abort', [
      exportFailures[0]!,
      { ...exportFailures[0]! },
    ], [exportUrl, exportUrl]],
    ['missing abort', [exportFailures[0]!], [exportUrl, exportUrl]],
    ['unrelated abort', [
      ...exportFailures,
      { ...exportFailures[0]!, requestId: 'request-unrelated' },
    ], [exportUrl, exportUrl]],
    ['extra download', exportFailures, [exportUrl, exportUrl, exportUrl]],
  ])('rejects export ledger mutation: %s', (_label, failures, downloads) => {
    expect(() => {
      assertFusionExportLedger(exportLedger, failures, downloads)
    }).toThrow()
  })

  it.each([
    ['duplicate request id', [
      exportLedger[0]!,
      { ...exportLedger[1]!, headRequestId: exportLedger[0]!.headRequestId },
    ]],
    ['wrong HEAD status', [
      { ...exportLedger[0]!, headStatus: 201 },
      exportLedger[1]!,
    ]],
    ['wrong download URL', [
      { ...exportLedger[0]!, downloadUrl: `${exportUrl}&wrong=true` },
      exportLedger[1]!,
    ]],
    ['invalid ZIP hash', [
      { ...exportLedger[0]!, zipSha256: 'not-a-sha256' },
      exportLedger[1]!,
    ]],
    ['incomplete download', [
      { ...exportLedger[0]!, completed: false },
      exportLedger[1]!,
    ]],
  ])('rejects export entry mutation: %s', (_label, ledger) => {
    expect(() => {
      assertFusionExportLedger(ledger, exportFailures, [exportUrl, exportUrl])
    }).toThrow()
  })

  it('binds the uniquely selected fork row to the returned child id', () => {
    expect(() => {
      assertFusionForkSelection(1, 'Fusion fork session-child', 'session-child')
    }).not.toThrow()
    expect(() => {
      assertFusionForkSelection(2, 'Fusion fork session-child', 'session-child')
    }).toThrow()
    expect(() => {
      assertFusionForkSelection(1, 'Fusion fork session-wrong', 'session-child')
    }).toThrow()
  })

  function compactEvents(): Array<{
    type: string
    seq: number
    data: Record<string, unknown>
    sourceEventSeqs?: number[]
    surfaceOp?: { op: 'replace'; start: number; end: number }
  }> {
    return [
      {
        type: 'user/message',
        seq: 1,
        data: { content: [{ type: 'text', text: 'source question' }] },
      },
      {
        type: 'assistant/message',
        seq: 2,
        data: { content: [{ type: 'text', text: 'source answer' }] },
      },
      {
        type: 'command/run',
        seq: 10,
        data: { commandId: 'compact-command', name: 'compact' },
      },
      {
        type: 'compaction/start',
        seq: 11,
        data: { compactionId: 'compaction', sourceCommandId: 'compact-command' },
      },
      {
        type: 'compaction/summary',
        seq: 12,
        data: {
          compactionId: 'compaction',
          sourceCommandId: 'compact-command',
          summary: [{
            type: 'text',
            text: 'Fusion compact summary: the tracked Pet-only regression remains complete.',
          }],
          provider: 'deepseek-official',
          model: 'deepseek-v4-flash',
          shadowedRange: { start: 1, end: 2 },
          shadowedSeqs: [1, 2],
          shadowedTokenCount: 42,
        },
      },
      {
        type: 'user/message',
        seq: 13,
        data: {
          content: [{ type: 'text', text: '<context_checkpoint>summary</context_checkpoint>' }],
          source: {
            kind: 'plugin',
            plugin: 'compact',
            compactionId: 'compaction',
            sourceCommandId: 'compact-command',
          },
        },
        surfaceOp: { op: 'replace', start: 1, end: 2 },
        sourceEventSeqs: [11, 12, 1, 2],
      },
      {
        type: 'compaction/end',
        seq: 14,
        data: { compactionId: 'compaction', sourceCommandId: 'compact-command' },
      },
      {
        type: 'command/done',
        seq: 15,
        data: {
          commandId: 'compact-command',
          kind: 'success',
          text: 'Compacted 2 history items (~42 tokens).',
          sourceEventSeq: 12,
        },
      },
    ]
  }

  it('accepts one fully paired compact lifecycle', () => {
    expect(assertFusionCompactLifecycle(compactEvents())).toBe('compact-command')
  })

  it.each([
    ['missing command/done', (events: ReturnType<typeof compactEvents>) =>
      events.filter(event => event.type !== 'command/done')],
    ['failed command/done', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'command/done'
        ? { ...event, data: { ...event.data, kind: 'error' } }
        : event)],
    ['wrong sourceCommandId', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'compaction/start'
        ? { ...event, data: { ...event.data, sourceCommandId: 'wrong-command' } }
        : event)],
    ['different compactionId', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'compaction/end'
        ? { ...event, data: { ...event.data, compactionId: 'wrong-compaction' } }
        : event)],
    ['missing summary sourceEventSeq', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'command/done'
        ? { ...event, data: { commandId: 'compact-command', kind: 'success' } }
        : event)],
    ['end error', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'compaction/end'
        ? { ...event, data: { ...event.data, error: 'failed after summary' } }
        : event)],
    ['wrong lifecycle order', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'command/done'
        ? { ...event, seq: 9 }
        : event)],
    ['wrong summary content', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'compaction/summary'
        ? {
          ...event,
          data: {
            ...event.data,
            summary: [{ type: 'text', text: 'unrelated summary' }],
          },
        }
        : event)],
    ['wrong summary provider', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'compaction/summary'
        ? { ...event, data: { ...event.data, provider: 'wrong-provider' } }
        : event)],
    ['wrong summary model', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'compaction/summary'
        ? { ...event, data: { ...event.data, model: 'wrong-model' } }
        : event)],
    ['wrong shadowed range', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'compaction/summary'
        ? { ...event, data: { ...event.data, shadowedRange: { start: 1, end: 1 } } }
        : event)],
    ['wrong shadowed seqs', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'compaction/summary'
        ? { ...event, data: { ...event.data, shadowedSeqs: [1] } }
        : event)],
    ['wrong shadowed token count', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.type === 'compaction/summary'
        ? { ...event, data: { ...event.data, shadowedTokenCount: 41 } }
        : event)],
    ['missing replacement', (events: ReturnType<typeof compactEvents>) =>
      events.filter(event => event.surfaceOp?.op !== 'replace')],
    ['non-adjacent replacement', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.surfaceOp?.op === 'replace'
        ? { ...event, seq: 14 }
        : event.type === 'compaction/end'
          ? { ...event, seq: 15 }
          : event.type === 'command/done'
            ? { ...event, seq: 16 }
            : event)],
    ['replacement with wrong sourceEventSeqs', (events: ReturnType<typeof compactEvents>) =>
      events.map(event => event.surfaceOp?.op === 'replace'
        ? { ...event, sourceEventSeqs: [11, 12, 1] }
        : event)],
  ])('rejects compact lifecycle mutation: %s', (_label, mutate) => {
    expect(() => {
      assertFusionCompactLifecycle(mutate(compactEvents()))
    }).toThrow()
  })

  it.each(['compaction/start', 'compaction/summary', 'compaction/end'])(
    'rejects a compact lifecycle missing %s',
    (type) => {
      expect(() => {
        assertFusionCompactLifecycle(compactEvents().filter(event => event.type !== type))
      }).toThrow()
    },
  )

  it('accepts clean stock profile and ACP composition text', () => {
    expect(() => {
      assertFusionExcludedFromComposition(
        'stock profiles',
        '@deepseek-ai/dsh-base\n@deepseek-ai/dsh-web-app\n@deepseek-ai/dsh-headless\n',
      )
    }).not.toThrow()
  })

  it.each([
    '@deepseek-ai/dsh-fusion',
    '@linxin666/dsh-pet',
    '@liustack/modlens',
    '@linxin666/dsh-client-ui-git-graph',
    '@linxin666/dsh-ssh',
    '@linxin666/dsh-remote-web-ui',
    '@linxin666/dsh-client-ui-task-board',
    '@linxin666/dsh-client-ui-skin-center',
    'dsh-better-sidebar',
    'git-graph',
    'modlens',
    'dsh-ssh',
    'remote-web-ui',
    'ui-task-board',
    'skin-center',
    'better-sidebar',
    'web-ui-all',
    'describe-image',
    'aionui-panel',
    'liangshen',
  ])('rejects excluded composition token %s', (token) => {
    expect(() => {
      assertFusionExcludedFromComposition('isolated profile', `rows:\n  - name: ${token}\n`)
    }).toThrow(token)
  })
})

describe('Fusion Web regression tracked wiring', () => {
  it('binds the active New Session response id to its listed and selected row', async () => {
    const acceptance = await readFile(
      new URL('./fusion-real-composition.acceptance.ts', import.meta.url),
      'utf8',
    )

    expect(acceptance).toContain('const activeSessionId =')
    expect(acceptance).toContain('const activeTitle = `Fusion active ${activeSessionId}`')
    expect(acceptance).toContain('item.sessionId === activeSessionId')
    expect(acceptance).toContain('selectedActive.getByText(activeTitle')
  })

  it('reads ACP resolved runtime inventory through the real Loader composition', async () => {
    const acceptance = await readFile(
      new URL('./fusion-real-composition.acceptance.ts', import.meta.url),
      'utf8',
    )

    expect(acceptance.match(/runAcpResolvedComposition\(/gu)).toHaveLength(2)
    expect(acceptance).toContain('PLUGIN_INVENTORY_BUILT')
    expect(acceptance).toContain('pluginInventory.list()')
    expect(acceptance).toContain('assertFusionExcludedFromComposition')
  })

  it('forces the nested ACP smoke through the built bin without source fallback', async () => {
    const acceptance = await readFile(
      new URL('./fusion-real-composition.acceptance.ts', import.meta.url),
      'utf8',
    )

    expect(acceptance).toMatch(/DSH_EXAMPLE_MODE:\s*'lib'/u)
    expect(acceptance).toContain('ACP_BUILT_BIN')
    expect(acceptance).toContain('TSX_TSCONFIG_PATH: undefined')
    expect(acceptance).toMatch(
      /withOwnedTemporaryRoot\(\{[\s\S]*?DSH_EXAMPLE_MODE:\s*'lib'[\s\S]*?\}, temporaryRoot\)/u,
    )
  })

  it('keeps the complete workflow in the tracked CDP acceptance', async () => {
    const acceptance = await readFile(
      new URL('./fusion-real-composition.acceptance.ts', import.meta.url),
      'utf8',
    )

    expect(acceptance).not.toMatch(
      /\.superpowers\/|driver\.mts|run-driver\.sh|chromium\.launch\(/u,
    )
    expect(acceptance).toContain('chromium.connectOverCDP')
    for (const helper of [
      'runFusionWebRegression',
      'runFreshProfileIsolation',
      'runHeadlessTurn',
      'runAcpStdioSmoke',
    ]) {
      expect(acceptance.match(new RegExp(`${helper}\\(`, 'gu'))).toHaveLength(2)
    }
  })
})

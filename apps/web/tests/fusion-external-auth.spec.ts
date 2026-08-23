import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { Context } from '@deepseek-ai/cordis'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { SubprocessHandle } from '@deepseek-ai/dsh-subprocess'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { afterEach, describe, expect, it } from 'vitest'
import { invokeRoute, withPrivatePackageCopy } from './fusion-external-auth.ts'

const roots: string[] = []

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Fusion external authorization fixtures', () => {
  it('cancels a hanging route and waits for its real child process to stop', async () => {
    const context = new Context()
    await context.plugin(LocalSubprocessRuntime)
    const started = Promise.withResolvers<undefined>()
    const cancellation = new Error('cancel hanging route')
    const controller = new AbortController()
    let child: SubprocessHandle | undefined
    let innerDisposeStarted = false
    let innerDisposed = false
    const route: WebRoute = {
      kind: 'exact',
      path: '/hang',
      handler: async (_request, response) => {
        child = context.subprocess.spawn({
          argv: [process.execPath, '-e', 'setInterval(() => {}, 1_000)'],
          cwd: process.cwd(),
          env: {},
          graceMs: 50,
          stdio: {
            stdin: 'ignore',
            stdout: 'ignore',
            stderr: 'ignore',
          },
        })
        started.resolve(undefined)
        await child.done
        response.writeHead(200)
        response.end('stopped')
      },
    }
    const request = Object.assign(Readable.from([]), {
      method: 'GET',
      url: '/hang',
    }) as unknown as IncomingMessage
    const invocation = (async () => {
      try {
        return await invokeRoute(route, request, controller.signal)
      } finally {
        innerDisposeStarted = true
        await context.fiber.dispose()
        innerDisposed = true
      }
    })()

    let outcome: unknown
    try {
      await started.promise
      controller.abort(cancellation)
      outcome = await Promise.race([
        invocation.then(
          () => 'fulfilled',
          (error: unknown) => error,
        ),
        new Promise(resolve => setTimeout(() => { resolve('pending') }, 250)),
      ])
    } finally {
      if (!innerDisposed) await context.fiber.dispose()
      await invocation.catch(() => undefined)
    }

    expect(outcome).toBe(cancellation)
    expect(innerDisposeStarted).toBe(true)
    expect(innerDisposed).toBe(true)
    await expect(child!.waitForExit(AbortSignal.timeout(2_000))).resolves.toBe(true)
  })

  it('keeps a hard-linked installed package unchanged when private mutation is cancelled', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-fusion-private-package-'))
    roots.push(root)
    const profile = join(root, 'profile')
    const packageRoot = join(profile, 'node_modules', '@example', 'pet')
    const installedMain = join(packageRoot, 'lib', 'index.js')
    const peerMain = join(root, 'store-entry.js')
    await mkdir(join(packageRoot, 'lib'), { recursive: true })
    await writeFile(join(packageRoot, 'package.json'), '{"name":"@example/pet","main":"lib/index.js"}\n')
    await writeFile(installedMain, 'export const guarded = true\n')
    await link(installedMain, peerMain)
    const before = await sha256(installedMain)
    const cancellation = new Error('cancel private mutation')
    const controller = new AbortController()
    let privateRoot: string | undefined

    await expect(withPrivatePackageCopy(packageRoot, profile, controller.signal, async (copyRoot) => {
      privateRoot = copyRoot
      const copiedMain = join(copyRoot, 'lib', 'index.js')
      await writeFile(copiedMain, 'export const guarded = false\n')
      expect(await sha256(installedMain)).toBe(before)
      expect(await sha256(peerMain)).toBe(before)
      controller.abort(cancellation)
      controller.signal.throwIfAborted()
    })).rejects.toBe(cancellation)

    expect(await sha256(installedMain)).toBe(before)
    expect(await sha256(peerMain)).toBe(before)
    expect(privateRoot).toBeDefined()
    expect(existsSync(privateRoot!)).toBe(false)
  })
})

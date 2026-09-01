// Cross-instance and writer-lock behavior: two providers on one document are
// the in-process equivalent of two dsh processes sharing a harness home —
// neither knows the other's cache, so only the read-modify-write cycle under
// the `<file>.lock` sibling keeps both namespaces alive on disk.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { chmod, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  SettingsConflictError,
  settingsNamespace,
  type SettingsScope,
} from '@deepseek-ai/dsh-settings'
import { FileSettingsProvider } from '../src/index.ts'

const AlphaSchema: z<{ value: number }> = z.object({ value: z.number().default(0) })
const BetaSchema: z<{ value: number }> = z.object({ value: z.number().default(0) })

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  while (cleanups.length > 0) await cleanups.pop()!()
})

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-settings-lock-'))
  cleanups.push(() => rm(dir, { recursive: true, force: true }))
  return dir
}

async function boot(config: ConstructorParameters<typeof FileSettingsProvider>[1]): Promise<Context> {
  const ctx = new Context()
  const fiber = ctx.plugin(FileSettingsProvider, config)
  cleanups.push(async () => { await fiber.dispose() })
  await fiber
  return ctx
}

describe('cross-instance writes', () => {
  it('keeps both namespaces when two providers write the same document concurrently', async () => {
    const dir = await tempDir()
    const path = join(dir, 'settings.yaml')
    const first = await boot({ path, watch: false })
    const second = await boot({ path, watch: false })
    const alpha = first.settings.register('alpha', AlphaSchema)
    const beta = second.settings.register('beta', BetaSchema)
    const rounds = [1, 2, 3, 4, 5]
    await Promise.all([
      (async () => { for (const value of rounds) await alpha.update({ value }) })(),
      (async () => { for (const value of rounds) await beta.update({ value }) })(),
    ])
    const text = await readFile(path, 'utf8')
    expect(text).toContain('alpha:')
    expect(text).toContain('beta:')
    // A third instance resolves both final values from the shared document.
    const third = await boot({ path, watch: false })
    expect(third.settings.register('alpha', AlphaSchema).get()).toEqual({ value: 5 })
    expect(third.settings.register('beta', BetaSchema).get()).toEqual({ value: 5 })
  })

  it('rejects a stale expected revision after persist reconciles the same namespace', async () => {
    const dir = await tempDir()
    const path = join(dir, 'settings.yaml')
    await writeFile(path, 'alpha:\n  value: 1\n')
    const ctx = await boot({ path, watch: false })
    const ns = settingsNamespace('alpha')
    const scope = ctx.settings.register(ns, AlphaSchema)
    const openedRevision = ctx.settings.describe().find(entry => entry.ns === ns)!.revision

    await writeFile(path, 'alpha:\n  value: 2\n')
    const outcome = await ctx.settings.update(ns, { value: 3 }, openedRevision).then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    )

    expect({
      status: outcome.status,
      conflict: 'error' in outcome && outcome.error instanceof SettingsConflictError
        ? {
          code: outcome.error.code,
          expected: outcome.error.expected,
          actual: outcome.error.actual,
        }
        : undefined,
      stored: await readFile(path, 'utf8'),
      value: scope.get(),
      revision: ctx.settings.describe().find(entry => entry.ns === ns)!.revision,
    }).toEqual({
      status: 'rejected',
      conflict: {
        code: 'SETTINGS_CONFLICT',
        expected: 0,
        actual: 1,
      },
      stored: 'alpha:\n  value: 2\n',
      value: { value: 2 },
      revision: 1,
    })
  })

  it('checks a replacement owner revision after waiting for the writer lock', async () => {
    const dir = await tempDir()
    const path = join(dir, 'settings.yaml')
    await writeFile(path, 'alpha:\n  value: 1\n')
    const ctx = await boot({ path, watch: false })
    const ns = settingsNamespace('alpha')
    const oldFiber = ctx.plugin({
      inject: ['settings'],
      apply: (child: Context) => {
        child.settings.register(ns, AlphaSchema)
      },
    })
    cleanups.push(async () => { await oldFiber.dispose() })
    await oldFiber
    const openedRevision = ctx.settings.describe().find(entry => entry.ns === ns)!.revision
    await writeFile(`${path}.lock`, 'holder\n')

    const provider = ctx.settings as unknown as { operations: Promise<void> }
    const beforeWrite = provider.operations
    const oldWrite = ctx.settings.update(ns, { value: 3 }, openedRevision)
    await vi.waitFor(() => { expect(provider.operations).not.toBe(beforeWrite) })
    await oldFiber.dispose()

    let replacementScope: SettingsScope<{ value: number }> | undefined
    const replacementFiber = ctx.plugin({
      inject: ['settings'],
      apply: (child: Context) => {
        replacementScope = child.settings.register(ns, AlphaSchema)
      },
    })
    cleanups.push(async () => { await replacementFiber.dispose() })
    await replacementFiber
    await writeFile(path, 'alpha:\n  value: 2\n')
    await rm(`${path}.lock`)

    const outcome = await oldWrite.then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    )
    expect({
      status: outcome.status,
      conflict: 'error' in outcome && outcome.error instanceof SettingsConflictError
        ? {
          code: outcome.error.code,
          expected: outcome.error.expected,
          actual: outcome.error.actual,
        }
        : undefined,
      stored: await readFile(path, 'utf8'),
      value: replacementScope!.get(),
      revision: ctx.settings.describe().find(entry => entry.ns === ns)!.revision,
    }).toEqual({
      status: 'rejected',
      conflict: {
        code: 'SETTINGS_CONFLICT',
        expected: 0,
        actual: 1,
      },
      stored: 'alpha:\n  value: 2\n',
      value: { value: 2 },
      revision: 1,
    })
  })

  it('rejects a stale nonzero revision that collides after owner replacement', async () => {
    const dir = await tempDir()
    const path = join(dir, 'settings.yaml')
    const ctx = await boot({ path, watch: false })
    const ns = settingsNamespace('alpha')
    let oldScope: SettingsScope<{ value: number }> | undefined
    const oldFiber = ctx.plugin({
      inject: ['settings'],
      apply: (child: Context) => {
        oldScope = child.settings.register(ns, AlphaSchema)
      },
    })
    cleanups.push(async () => { await oldFiber.dispose() })
    await oldFiber
    await oldScope!.update({ value: 1 })
    const openedRevision = ctx.settings.describe().find(entry => entry.ns === ns)!.revision
    await writeFile(`${path}.lock`, 'holder\n')

    const provider = ctx.settings as unknown as { operations: Promise<void> }
    const beforeWrite = provider.operations
    const oldWrite = ctx.settings.update(ns, { value: 3 }, openedRevision)
    await vi.waitFor(() => { expect(provider.operations).not.toBe(beforeWrite) })
    await oldFiber.dispose()

    let replacementScope: SettingsScope<{ value: number }> | undefined
    const replacementWatcher = vi.fn()
    const resolvedEvents: Array<{ value: unknown; source: string }> = []
    const documentEvents: Array<[string, number]> = []
    ctx.on('settings/updated', (_namespace, value, _previous, source) => {
      resolvedEvents.push({ value, source })
    })
    ctx.on('settings/document-updated', (namespace, revision) => {
      documentEvents.push([String(namespace), revision])
    })
    const replacementFiber = ctx.plugin({
      inject: ['settings'],
      apply: (child: Context) => {
        replacementScope = child.settings.register(ns, AlphaSchema)
        replacementScope.watch(replacementWatcher)
      },
    })
    cleanups.push(async () => { await replacementFiber.dispose() })
    await replacementFiber
    await writeFile(path, 'alpha:\n  value: 2\n')
    await rm(`${path}.lock`)

    const outcome = await oldWrite.then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    )
    const descriptor = ctx.settings.describe().find(entry => entry.ns === ns)
    expect({
      status: outcome.status,
      conflict: 'error' in outcome && outcome.error instanceof SettingsConflictError
        ? {
          code: outcome.error.code,
          expected: outcome.error.expected,
          actual: outcome.error.actual,
        }
        : undefined,
      stored: await readFile(path, 'utf8'),
      value: replacementScope!.get(),
      descriptor: descriptor === undefined
        ? undefined
        : {
          ns: descriptor.ns,
          user: descriptor.user,
          value: descriptor.value,
          revision: descriptor.revision,
        },
      watcherCalls: replacementWatcher.mock.calls,
      resolvedEvents,
      documentEvents,
    }).toEqual({
      status: 'rejected',
      conflict: {
        code: 'SETTINGS_CONFLICT',
        expected: 1,
        actual: 2,
      },
      stored: 'alpha:\n  value: 2\n',
      value: { value: 2 },
      descriptor: {
        ns,
        user: { value: 2 },
        value: { value: 2 },
        revision: 2,
      },
      watcherCalls: [[{ value: 2 }, { value: 1 }]],
      resolvedEvents: [{ value: { value: 2 }, source: 'provider' }],
      documentEvents: [['alpha', 2]],
    })
  })

  it('rejects a stale write after reconciliation while the namespace has no owner', async () => {
    const dir = await tempDir()
    const path = join(dir, 'settings.yaml')
    const ctx = await boot({ path, watch: false })
    const ns = settingsNamespace('alpha')
    let oldScope: SettingsScope<{ value: number }> | undefined
    const oldFiber = ctx.plugin({
      inject: ['settings'],
      apply: (child: Context) => {
        oldScope = child.settings.register(ns, AlphaSchema)
      },
    })
    cleanups.push(async () => { await oldFiber.dispose() })
    await oldFiber
    await oldScope!.update({ value: 1 })
    const openedRevision = ctx.settings.describe().find(entry => entry.ns === ns)!.revision
    await writeFile(`${path}.lock`, 'holder\n')

    const provider = ctx.settings as unknown as { operations: Promise<void> }
    const beforeWrite = provider.operations
    const oldWrite = ctx.settings.update(ns, { value: 3 }, openedRevision)
    await vi.waitFor(() => { expect(provider.operations).not.toBe(beforeWrite) })
    await oldFiber.dispose()

    const resolvedEvents: unknown[] = []
    const documentEvents: Array<[string, number]> = []
    ctx.on('settings/updated', (...args) => { resolvedEvents.push(args) })
    ctx.on('settings/document-updated', (namespace, revision) => {
      documentEvents.push([String(namespace), revision])
    })
    await writeFile(path, 'alpha:\n  value: 2\n')
    await rm(`${path}.lock`)

    const outcome = await oldWrite.then(
      () => ({ status: 'resolved' as const }),
      (error: unknown) => ({ status: 'rejected' as const, error }),
    )
    let newScope: SettingsScope<{ value: number }> | undefined
    const newFiber = ctx.plugin({
      inject: ['settings'],
      apply: (child: Context) => {
        newScope = child.settings.register(ns, AlphaSchema)
      },
    })
    cleanups.push(async () => { await newFiber.dispose() })
    await newFiber

    const descriptor = ctx.settings.describe().find(entry => entry.ns === ns)
    expect({
      status: outcome.status,
      conflict: 'error' in outcome && outcome.error instanceof SettingsConflictError
        ? {
          code: outcome.error.code,
          expected: outcome.error.expected,
          actual: outcome.error.actual,
        }
        : undefined,
      stored: await readFile(path, 'utf8'),
      value: newScope!.get(),
      descriptor: descriptor === undefined
        ? undefined
        : {
          ns: descriptor.ns,
          user: descriptor.user,
          value: descriptor.value,
          revision: descriptor.revision,
        },
      resolvedEvents,
      documentEvents,
    }).toEqual({
      status: 'rejected',
      conflict: {
        code: 'SETTINGS_CONFLICT',
        expected: 1,
        actual: 2,
      },
      stored: 'alpha:\n  value: 2\n',
      value: { value: 2 },
      descriptor: {
        ns,
        user: { value: 2 },
        value: { value: 2 },
        revision: 2,
      },
      resolvedEvents: [],
      documentEvents: [],
    })
  })
})

describe('writer lock', () => {
  it('waits for a busy writer lock instead of failing', async () => {
    const dir = await tempDir()
    const path = join(dir, 'settings.yaml')
    const ctx = await boot({ path, watch: false })
    const scope = ctx.settings.register('alpha', AlphaSchema)
    await writeFile(`${path}.lock`, 'holder\n')
    const release = setTimeout(() => { void rm(`${path}.lock`, { force: true }) }, 120)
    cleanups.push(async () => { clearTimeout(release) })
    await scope.update({ value: 7 })
    expect(await readFile(path, 'utf8')).toContain('value: 7')
  })

  it('does not steal an old writer lock', async () => {
    const dir = await tempDir()
    const path = join(dir, 'settings.yaml')
    await writeFile(path, 'alpha:\n  value: 4\n')
    const ctx = await boot({ path, watch: false })
    const scope = ctx.settings.register('alpha', AlphaSchema)
    const lockPath = `${path}.lock`
    await writeFile(lockPath, 'slow-holder\n')
    const past = (Date.now() - 60_000) / 1000
    await utimes(lockPath, past, past)

    await expect(scope.update({ value: 9 })).rejects.toThrow(/timed out waiting for the writer lock/)
    expect(await readFile(path, 'utf8')).toContain('value: 4')
    expect(await readFile(lockPath, 'utf8')).toBe('slow-holder\n')
  }, 10_000)

  it.skipIf(process.platform === 'win32')('surfaces a non-contention lock failure as the write error', async () => {
    const dir = await tempDir()
    const path = join(dir, 'settings.yaml')
    const ctx = await boot({ path, watch: false })
    const scope = ctx.settings.register('alpha', AlphaSchema)
    await chmod(dir, 0o500)
    cleanups.push(() => chmod(dir, 0o700))
    await expect(scope.update({ value: 1 })).rejects.toThrow(/EACCES|permission/)
  })
})

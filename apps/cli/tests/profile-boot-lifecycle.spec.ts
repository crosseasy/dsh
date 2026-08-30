import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context, FiberState } from '@deepseek-ai/cordis'
import { initProfile, resolveProfileDir } from '@deepseek-ai/dsh-app-boot'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { afterEach, describe, expect, it, vi } from 'vitest'

const previousHome = process.env.DSH_HOME

interface Deferred {
  promise: Promise<undefined>
  resolve: () => void
}

interface LifecycleFixtureOptions {
  readonly rootStateOnFailure?: FiberState
  readonly profileDisposalFailure?: Error
  readonly rootDisposalFailure?: Error
}

function deferred(): Deferred {
  const result = Promise.withResolvers<undefined>()
  return { promise: result.promise, resolve: () => { result.resolve(undefined) } }
}

afterEach(() => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  vi.doUnmock('@deepseek-ai/dsh-app-boot')
  vi.restoreAllMocks()
  vi.resetModules()
})

function installLifecycleFixture(
  options: LifecycleFixtureOptions = {},
): {
  readonly ctx: Context
  readonly lifecycle: string[]
  readonly rootDisposed: Deferred
  readonly setupFailure: Error
  readonly disposeRoot: ReturnType<typeof vi.fn>
} {
  const setupFailure = new Error('home watcher setup failed')
  const rootDisposed = deferred()
  const lifecycle: string[] = []
  const services = new Map<string, unknown>()
  const loader = {
    create: vi.fn(async ({ name }: { name: string }) => {
      const kind = name.endsWith('timer') ? 'timer' : 'hmr'
      lifecycle.push(`create:${kind}`)
      services.set(kind, {})
      return `${kind}-entry`
    }),
    remove: vi.fn(async (id: string) => {
      lifecycle.push(`remove:${id}`)
    }),
  }
  services.set('loader', loader)
  const fiber = {
    state: FiberState.ACTIVE,
    dispose: vi.fn(async () => {
      lifecycle.push('dispose:root:start')
      await rootDisposed.promise
      lifecycle.push('dispose:root:end')
      if (options.rootDisposalFailure !== undefined) throw options.rootDisposalFailure
    }),
  }
  const ctx = {
    fiber,
    get: (name: string) => services.get(name),
    provide: (name: string, value: unknown) => { services.set(name, value) },
    loader,
  } as unknown as Context

  vi.resetModules()
  vi.doMock('@deepseek-ai/dsh-app-boot', async () => {
    const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-app-boot')>(
      '@deepseek-ai/dsh-app-boot',
    )
    let watchCount = 0
    return {
      ...actual,
      boot: async (...args: Parameters<typeof actual.boot>) => {
        await args[3]?.(ctx)
        return ctx
      },
      installFailLoud: () => () => {},
      watchUserPatches: vi.fn(async () => {
        watchCount++
        lifecycle.push(watchCount === 1 ? 'watch:profile' : 'watch:home')
        if (watchCount === 2) {
          fiber.state = options.rootStateOnFailure ?? FiberState.ACTIVE
          throw setupFailure
        }
        return async () => {
          lifecycle.push('dispose:profile')
          if (options.profileDisposalFailure !== undefined) throw options.profileDisposalFailure
        }
      }),
    }
  })
  vi.spyOn(process, 'on').mockImplementation((() => process) as typeof process.on)
  return { ctx, lifecycle, rootDisposed, setupFailure, disposeRoot: fiber.dispose }
}

describe('profile boot lifecycle', () => {
  it('rolls back post-boot setup in reverse and awaits root quiescence before rejecting', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-cli-profile-lifecycle-'))
    process.env.DSH_HOME = home
    initProfile(resolveProfileDir('lifecycle', home), [])

    const {
      lifecycle,
      rootDisposed,
      setupFailure,
      disposeRoot,
    } = installLifecycleFixture()

    try {
      const { runProfile } = await import('../src/profile-boot.ts')
      let settled = false
      const outcome = runProfile({
        environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: {} }]),
        profile: 'lifecycle',
        patchFiles: [],
        args: [],
      }).then(
        value => ({ status: 'fulfilled' as const, value }),
        (error: unknown) => ({ status: 'rejected' as const, error }),
      ).finally(() => { settled = true })

      await vi.waitFor(() => {
        expect(disposeRoot).toHaveBeenCalledOnce()
      })
      expect(lifecycle).toEqual([
        'create:timer',
        'create:hmr',
        'watch:profile',
        'watch:home',
        'dispose:profile',
        'remove:hmr-entry',
        'remove:timer-entry',
        'dispose:root:start',
      ])
      expect(settled).toBe(false)

      rootDisposed.resolve()

      await expect(outcome).resolves.toEqual({ status: 'rejected', error: setupFailure })
      expect(lifecycle.at(-1)).toBe('dispose:root:end')
    } finally {
      rootDisposed.resolve()
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('suppresses the setup failure only after an exiting root reaches quiescence', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-cli-profile-exiting-'))
    process.env.DSH_HOME = home
    initProfile(resolveProfileDir('exiting', home), [])
    const { lifecycle, rootDisposed, disposeRoot } = installLifecycleFixture({
      rootStateOnFailure: FiberState.UNLOADING,
    })

    try {
      const { runProfile } = await import('../src/profile-boot.ts')
      let settled = false
      const outcome = runProfile({
        environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: {} }]),
        profile: 'exiting',
        patchFiles: [],
        args: [],
      }).finally(() => { settled = true })

      await vi.waitFor(() => {
        expect(disposeRoot).toHaveBeenCalledOnce()
      })
      expect(settled).toBe(false)
      rootDisposed.resolve()

      const result = await outcome
      expect(result.ctx).toBeDefined()
      expect(lifecycle.slice(-2)).toEqual(['dispose:root:start', 'dispose:root:end'])
    } finally {
      rootDisposed.resolve()
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('aggregates rollback failures after attempting every disposer and root disposal', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-cli-profile-rollback-error-'))
    process.env.DSH_HOME = home
    initProfile(resolveProfileDir('rollback-error', home), [])
    const profileDisposalFailure = new Error('profile disposer failed')
    const rootDisposalFailure = new Error('root disposal failed')
    const {
      lifecycle,
      rootDisposed,
      setupFailure,
      disposeRoot,
    } = installLifecycleFixture({ profileDisposalFailure, rootDisposalFailure })

    try {
      const { runProfile } = await import('../src/profile-boot.ts')
      const outcome = runProfile({
        environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: {} }]),
        profile: 'rollback-error',
        patchFiles: [],
        args: [],
      })

      await vi.waitFor(() => {
        expect(disposeRoot).toHaveBeenCalledOnce()
      })
      rootDisposed.resolve()

      let failure: unknown
      try {
        await outcome
      } catch (error) {
        failure = error
      }
      expect(failure).toBeInstanceOf(AggregateError)
      expect((failure as AggregateError).errors).toEqual([
        setupFailure,
        profileDisposalFailure,
        rootDisposalFailure,
      ])
      expect(lifecycle).toContain('remove:hmr-entry')
      expect(lifecycle).toContain('remove:timer-entry')
      expect(lifecycle.at(-1)).toBe('dispose:root:end')
    } finally {
      rootDisposed.resolve()
      rmSync(home, { recursive: true, force: true })
    }
  })
})

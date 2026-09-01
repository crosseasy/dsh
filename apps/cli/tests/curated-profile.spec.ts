import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context, FiberState } from '@deepseek-ai/cordis'
import type { PatchOptions } from '@deepseek-ai/cordis-plugin-include'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import { composeEntries, initProfile, readProfileManifest, resolveProfileDir } from '@deepseek-ai/dsh-app-boot'
import { CURATED_PROFILE_TEMPLATES } from '@deepseek-ai/dsh-curated-profiles'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { load as loadYaml } from 'js-yaml'
import { admitCuratedProfile, ensureCuratedProfile, isCuratedProfileName } from '../src/curated-profile.ts'
import { runDumpConfig } from '../src/dump-config.ts'
import { prepareProfile, prepareProfileForUse } from '../src/profile-boot.ts'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'dsh-cli-curated-profile-'))
const previousHome = process.env.DSH_HOME
const sourceBin = fileURLToPath(new URL('../src/bin.ts', import.meta.url))
const tsxLoader = import.meta.resolve('tsx/esm')
const tsxConfig = fileURLToPath(new URL('../../../tsconfig.json', import.meta.url))

function stageProfileDependencies(profileDir: string, dependencies: Readonly<Record<string, string>>): void {
  for (const packageName of Object.keys(dependencies)) {
    const packageDir = join(profileDir, 'node_modules', packageName)
    mkdirSync(packageDir, { recursive: true })
    writeFileSync(join(packageDir, 'package.json'), JSON.stringify({
      name: packageName,
      version: '0.0.0',
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    }))
    writeFileSync(join(packageDir, 'cordis.patch.yml'), '[]\n')
  }
}

async function runSource(
  home: string,
  args: readonly string[],
  options: { readonly cwd?: string; readonly env?: NodeJS.ProcessEnv } = {},
) {
  return execa(process.execPath, [
    '--import',
    tsxLoader,
    sourceBin,
    ...args,
  ], {
    ...options.cwd === undefined ? {} : { cwd: options.cwd },
    env: { ...process.env, DSH_HOME: home, TSX_TSCONFIG_PATH: tsxConfig, ...options.env },
    reject: false,
    timeout: 40_000,
  })
}

type ConfigRefresh = () => Promise<void> | void

function useRealPatchWatcherBoot(
  refreshes: Map<string, ConfigRefresh>,
  beforeMount?: (rootConfig: string) => void,
): void {
  vi.doMock('@deepseek-ai/dsh-app-boot', async () => {
    const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-app-boot')>(
      '@deepseek-ai/dsh-app-boot',
    )
    return {
      ...actual,
      boot: async (...args: Parameters<typeof actual.boot>) => {
        if (beforeMount !== undefined) {
          beforeMount(args[1])
          return actual.boot(...args)
        }
        const ctx = new Context()
        ctx.provide('dshHomePath', dshHomePath)
        await ctx.plugin(Loader)
        await args[3]?.(ctx)
        await actual.mountRootInclude(ctx, args[1], [], undefined, args[5])
        ctx.provide('hmr', {
          registerConfig: async (filename: string, refresh: ConfigRefresh) => {
            refreshes.set(filename, refresh)
            return async () => {}
          },
        })
        return ctx
      },
      installFailLoud: () => () => {},
    }
  })
}

afterEach(() => {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  vi.doUnmock('node:child_process')
  vi.doUnmock('node:fs')
  vi.doUnmock('@deepseek-ai/dsh-app-boot')
  vi.resetModules()
})

describe('curated profile launcher bridge', () => {
  it.skipIf(process.platform === 'win32')('does not replace an existing empty install lock', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const lockDir = join(home, 'profiles', '.web-personal.install.lock')
    mkdirSync(lockDir, { recursive: true })
    try {
      const { acquireCuratedProfilePreparationLock } = await import('../src/curated-profile-lock.ts')

      expect(() => acquireCuratedProfilePreparationLock('web-personal', home)).toThrow(
        'curated profile lock is held or its owner cannot be verified',
      )
      expect(readdirSync(lockDir)).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not let a delayed stale reclaimer remove a replacement owner', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const profilesDir = join(home, 'profiles')
    const lockDir = join(profilesDir, '.web-personal.install.lock')
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(
      join(lockDir, 'owner.json'),
      `${JSON.stringify({
        pid: 2_147_483_647,
        started: 'completed-process-incarnation',
        token: 'stale',
      })}\n`,
    )
    let acquire!: typeof import('../src/curated-profile-lock.ts')['acquireCuratedProfilePreparationLock']
    let replacement: import('../src/curated-profile-lock.ts').CuratedProfileLock | undefined
    let replacementFailure: unknown
    let interleaved = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const acquireReplacement = (): void => {
        interleaved = true
        try {
          replacement = acquire('web-personal', home)
        } catch (error) {
          replacementFailure = error
        }
      }
      return {
        ...actual,
        mkdirSync: ((...args: Parameters<typeof actual.mkdirSync>) => {
          if (!interleaved && String(args[0]) === join(lockDir, 'reclaim')) {
            acquireReplacement()
          }
          return actual.mkdirSync(...args)
        }),
        renameSync: ((...args: Parameters<typeof actual.renameSync>) => {
          if (!interleaved && String(args[0]) === lockDir) acquireReplacement()
          actual.renameSync(...args)
        }),
      }
    })
    try {
      ({ acquireCuratedProfilePreparationLock: acquire } = await import('../src/curated-profile-lock.ts'))

      expect(() => acquire('web-personal', home)).toThrow(
        'curated profile lock is held or its owner cannot be verified',
      )
      expect(interleaved).toBe(true)
      expect(replacementFailure).toBeUndefined()
      expect(replacement).toBeDefined()
      expect(() => replacement?.assertOwned()).not.toThrow()
      replacement?.release()
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.runIf(process.platform === 'darwin')('queries macOS process identity with a fixed locale', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const execFileSync = vi.fn(() => 'Sat Aug 30 12:34:56 2026\n')
    vi.resetModules()
    vi.doMock('node:child_process', () => ({ execFileSync }))
    try {
      const { acquireCuratedProfilePreparationLock } = await import('../src/curated-profile-lock.ts')

      const lock = acquireCuratedProfilePreparationLock('web-personal', home)
      lock.release()
      expect(execFileSync).toHaveBeenCalledWith(
        '/bin/ps',
        ['-o', 'lstart=', '-p', String(process.pid)],
        {
          encoding: 'utf8',
          env: { LANG: 'C', LC_ALL: 'C' },
        },
      )
    } finally {
      vi.doUnmock('node:child_process')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.runIf(process.platform === 'darwin')('does not reclaim when exact process identity lookup fails', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const lockDir = join(home, 'profiles', '.web-personal.install.lock')
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(
      join(lockDir, 'owner.json'),
      `${JSON.stringify({
        pid: process.pid,
        started: 'different-process-incarnation',
        token: 'stale',
      })}\n`,
    )
    const execFileSync = vi.fn()
      .mockReturnValueOnce('Sat Aug 30 12:34:56 2026\n')
      .mockImplementationOnce(() => {
        throw new Error('process identity unavailable')
      })
    vi.resetModules()
    vi.doMock('node:child_process', () => ({ execFileSync }))
    try {
      const { acquireCuratedProfilePreparationLock } = await import('../src/curated-profile-lock.ts')

      expect(() => acquireCuratedProfilePreparationLock('web-personal', home)).toThrow(
        'curated profile lock is held or its owner cannot be verified',
      )
      expect(existsSync(lockDir)).toBe(true)
    } finally {
      vi.doUnmock('node:child_process')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.runIf(process.platform === 'darwin')('reuses its process start identity while retrying a live lock owner', async () => {
    const root = tmp()
    const profilesDir = join(root, 'profiles')
    const lockDir = join(profilesDir, '.web-personal.install.lock')
    const ownerPid = 987_654
    const lstart = 'Mon Aug 31 12:34:56 2026'
    let ownQueries = 0
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(
      join(lockDir, 'owner.json'),
      `${JSON.stringify({
        pid: ownerPid,
        started: `darwin:${lstart}`,
        token: 'owner',
      })}\n`,
    )
    vi.resetModules()
    vi.doMock('node:child_process', () => ({
      execFileSync: (_file: string, argv: readonly string[]) => {
        if (argv.at(-1) === String(process.pid)) ownQueries += 1
        return `${lstart}\n`
      },
    }))
    const kill = vi.spyOn(process, 'kill').mockReturnValue(true)
    vi.useFakeTimers()
    try {
      const { withCuratedInstallLock } = await import('../src/curated-profile-lock.ts')

      const pending = withCuratedInstallLock('web-personal', profilesDir, () => {})
      await vi.advanceTimersByTimeAsync(50)
      await vi.advanceTimersByTimeAsync(50)
      await vi.advanceTimersByTimeAsync(50)
      rmSync(lockDir, { recursive: true })
      await vi.advanceTimersByTimeAsync(50)
      await pending

      expect(kill).toHaveBeenCalledWith(ownerPid, 0)
      expect(ownQueries).toBe(1)
    } finally {
      vi.useRealTimers()
      kill.mockRestore()
      vi.doUnmock('node:child_process')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.runIf(process.platform === 'darwin')('fails install lock acquisition when its initial process identity is unavailable', async () => {
    const root = tmp()
    const profilesDir = join(root, 'profiles')
    const execFileSync = vi.fn()
      .mockImplementationOnce(() => {
        throw new Error('process identity unavailable')
      })
      .mockReturnValue('Mon Aug 31 12:34:56 2026\n')
    mkdirSync(profilesDir, { recursive: true })
    vi.resetModules()
    vi.doMock('node:child_process', () => ({ execFileSync }))
    try {
      const { withCuratedInstallLock } = await import('../src/curated-profile-lock.ts')

      await expect(withCuratedInstallLock('web-personal', profilesDir, () => {})).rejects.toThrow(
        'cannot verify this process incarnation for curated profile locking',
      )
      expect(execFileSync).toHaveBeenCalledTimes(1)
    } finally {
      vi.doUnmock('node:child_process')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not materialize a live profile while installation owns the rename transition', () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    const profilesDir = join(home, 'profiles')
    const liveDir = join(profilesDir, 'web-personal')
    const previousDir = join(profilesDir, '.web-personal.install-previous')
    const lockDir = join(profilesDir, '.web-personal.install.lock')
    try {
      ensureCuratedProfile('web-personal')
      writeFileSync(join(liveDir, 'cordis.patch.yml'), '# retained user patch\n')
      renameSync(liveDir, previousDir)
      mkdirSync(lockDir)
      writeFileSync(
        join(lockDir, 'owner.json'),
        `${JSON.stringify({ pid: process.pid, token: 'installer' })}\n`,
      )

      expect(() => prepareProfile('web-personal')).toThrow(
        'curated profile lock is held or its owner cannot be verified',
      )
      expect(existsSync(liveDir)).toBe(false)
      expect(readFileSync(join(previousDir, 'cordis.patch.yml'), 'utf8')).toBe(
        '# retained user patch\n',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('leaves an interrupted previous-only install state for installer recovery', () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    const profilesDir = join(home, 'profiles')
    const liveDir = join(profilesDir, 'web-personal')
    const previousDir = join(profilesDir, '.web-personal.install-previous')
    try {
      ensureCuratedProfile('web-personal')
      writeFileSync(join(liveDir, 'cordis.patch.yml'), '# retained user patch\n')
      renameSync(liveDir, previousDir)

      expect(() => prepareProfile('web-personal')).toThrow(
        'curated profile installation requires recovery',
      )
      expect(existsSync(liveDir)).toBe(false)
      expect(readFileSync(join(previousDir, 'cordis.patch.yml'), 'utf8')).toBe(
        '# retained user patch\n',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not release a copied install lock owner as its own', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const profilesDir = join(home, 'profiles')
    mkdirSync(profilesDir, { recursive: true })
    const lockDir = join(profilesDir, '.web-personal.install.lock')
    const originalLockDir = `${lockDir}.original`
    try {
      const { withCuratedInstallLock } = await import('../src/curated-profile-lock.ts')

      await expect(withCuratedInstallLock('web-personal', profilesDir, () => {
        renameSync(lockDir, originalLockDir)
        cpSync(originalLockDir, lockDir, { recursive: true })
      })).rejects.toThrow(
        'curated profile lock ownership changed',
      )
      expect(existsSync(lockDir)).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('aggregates an undefined operation rejection with a release failure', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const profilesDir = join(home, 'profiles')
    mkdirSync(profilesDir, { recursive: true })
    const lockDir = join(profilesDir, '.web-personal.install.lock')
    const originalLockDir = `${lockDir}.original`
    try {
      const { withCuratedInstallLock } = await import('../src/curated-profile-lock.ts')

      const rejection = await withCuratedInstallLock('web-personal', profilesDir, () => {
        renameSync(lockDir, originalLockDir)
        cpSync(originalLockDir, lockDir, { recursive: true })
        return new Promise<never>((_resolve, reject) => {
          // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- Exercises non-Error rejection.
          reject()
        })
      }).catch((error: unknown) => error)

      expect(rejection).toBeInstanceOf(AggregateError)
      const aggregate = rejection as AggregateError
      const errors = aggregate.errors as unknown[]
      expect(errors).toHaveLength(2)
      expect(errors[0]).toBeUndefined()
      expect(errors[1]).toBeInstanceOf(Error)
      expect((errors[1] as Error).message).toContain(
        'curated profile lock ownership changed',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects same-inode lock owner growth before allocation and after reading', async () => {
    for (const mode of ['before-allocation', 'after-read'] as const) {
      const root = tmp()
      const home = join(root, 'home')
      const profilesDir = join(home, 'profiles')
      const lockDir = join(profilesDir, '.web-personal.install.lock')
      const ownerPath = join(lockDir, 'owner.json')
      mkdirSync(lockDir, { recursive: true })
      writeFileSync(ownerPath, `${JSON.stringify({ pid: 2_147_483_647, token: 'stale' })}\n`)
      const ownerDescriptors = new Set<number>()
      const fstatCalls = new Map<number, number>()
      vi.resetModules()
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
        return {
          ...actual,
          openSync: (...args: Parameters<typeof actual.openSync>) => {
            const descriptor = actual.openSync(...args)
            if (String(args[0]) === ownerPath) {
              ownerDescriptors.add(descriptor)
              fstatCalls.set(descriptor, 0)
            }
            return descriptor
          },
          fstatSync: ((...args: Parameters<typeof actual.fstatSync>) => {
            const identity = actual.fstatSync(...args)
            if (ownerDescriptors.has(args[0])) {
              const call = (fstatCalls.get(args[0]) ?? 0) + 1
              fstatCalls.set(args[0], call)
              if (
                (mode === 'before-allocation' && call === 1)
                || (mode === 'after-read' && call === 2)
              ) {
                Object.defineProperty(identity, 'size', { value: 4097n })
              }
            }
            return identity
          }) as typeof actual.fstatSync,
        }
      })
      const allocate = vi.spyOn(Buffer, 'alloc')
      try {
        const { acquireCuratedProfilePreparationLock } = await import('../src/curated-profile-lock.ts')

        expect(() => acquireCuratedProfilePreparationLock('web-personal', home)).toThrow(
          'curated profile lock is held or its owner cannot be verified',
        )
        expect(allocate.mock.calls.some(([size]) => size > 4096)).toBe(false)
        expect(existsSync(lockDir)).toBe(true)
      } finally {
        allocate.mockRestore()
        vi.doUnmock('node:fs')
        vi.resetModules()
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('propagates unexpected lock-owner inspection failures', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const profilesDir = join(home, 'profiles')
    const lockDir = join(profilesDir, '.web-personal.install.lock')
    const ownerPath = join(lockDir, 'owner.json')
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(ownerPath, `${JSON.stringify({ pid: process.pid, token: 'owner' })}\n`)
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
          if (String(args[0]) === ownerPath) throw new Error('unexpected owner inspection failure')
          return actual.lstatSync(...args)
        }) as typeof actual.lstatSync,
      }
    })
    try {
      const { acquireCuratedProfilePreparationLock } = await import('../src/curated-profile-lock.ts')

      expect(() => acquireCuratedProfilePreparationLock('web-personal', home)).toThrow(
        'unexpected owner inspection failure',
      )
      expect(existsSync(lockDir)).toBe(true)
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not reclaim a malformed lock-owner record', () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    const lockDir = join(home, 'profiles', '.web-personal.install.lock')
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(join(lockDir, 'owner.json'), '{')
    try {
      expect(() => prepareProfile('web-personal')).toThrow(
        'curated profile lock is held or its owner cannot be verified',
      )
      expect(existsSync(lockDir)).toBe(true)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reclaims a lock whose PID belongs to a different process incarnation', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const lockDir = join(home, 'profiles', '.web-personal.install.lock')
    mkdirSync(lockDir, { recursive: true })
    writeFileSync(
      join(lockDir, 'owner.json'),
      `${JSON.stringify({
        pid: process.pid,
        started: 'different-process-incarnation',
        token: 'stale',
      })}\n`,
    )
    try {
      const { acquireCuratedProfilePreparationLock } = await import('../src/curated-profile-lock.ts')

      const lock = acquireCuratedProfilePreparationLock('web-personal', home)
      lock.release()
      expect(existsSync(lockDir)).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('renders curated default and ordinary layered dumps in process', () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    try {
      ensureCuratedProfile('web-personal')
      runDumpConfig('web-personal', true, [])
      expect(stdout).toHaveBeenLastCalledWith(expect.stringContaining('@deepseek-ai/dsh-base'))

      const ordinaryDir = resolveProfileDir('ordinary-dump', home)
      initProfile(ordinaryDir, [])
      const profilePatch = join(ordinaryDir, 'cordis.patch.yml')
      const homePatch = join(home, 'cordis.patch.yml')
      const overlay = join(root, 'overlay.yml')
      writeFileSync(profilePatch, '- insert:\n    - id: profile\n      name: profile-plugin\n')
      writeFileSync(homePatch, '- insert:\n    - id: home\n      name: home-plugin\n')
      writeFileSync(overlay, '- insert:\n    - id: overlay\n      name: overlay-plugin\n')
      runDumpConfig('ordinary-dump', false, [overlay])
      const rendered = String(stdout.mock.calls.at(-1)?.[0])
      expect(rendered).toContain(profilePatch)
      expect(rendered).toContain(homePatch)
      expect(rendered).toContain(overlay)

      const emptyHome = join(root, 'empty-home')
      process.env.DSH_HOME = emptyHome
      const emptyDir = resolveProfileDir('empty-dump', emptyHome)
      initProfile(emptyDir, [])
      rmSync(join(emptyDir, 'cordis.patch.yml'))
      runDumpConfig('empty-dump', false, [])
      expect(stdout).toHaveBeenLastCalledWith('\n')
    } finally {
      stdout.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a linked profiles root before healing the module fallback', () => {
    const home = tmp()
    const outside = tmp()
    symlinkSync(outside, join(home, 'profiles'), process.platform === 'win32' ? 'junction' : 'dir')
    process.env.DSH_HOME = home

    expect(() => prepareProfile('web-curated', { userLayer: false })).toThrow(
      'profiles root must be a regular directory',
    )
    expect(existsSync(join(outside, 'node_modules'))).toBe(false)
  })

  it('does not heal the module fallback through a profiles ancestor replaced after snapshot creation', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const externalProfilesDir = join(root, 'external-profiles')
    process.env.DSH_HOME = home
    ensureCuratedProfile('web-personal')
    mkdirSync(externalProfilesDir)
    writeFileSync(join(externalProfilesDir, 'sentinel'), 'external bytes\n')
    const profilesDir = join(home, 'profiles')
    let replaced = false
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-app-boot', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-app-boot')>(
        '@deepseek-ai/dsh-app-boot',
      )
      const fs = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        healProfilesModuleFallback: (...args: Parameters<typeof actual.healProfilesModuleFallback>) => {
          if (!replaced) {
            replaced = true
            fs.renameSync(profilesDir, `${profilesDir}.original`)
            fs.symlinkSync(
              externalProfilesDir,
              profilesDir,
              process.platform === 'win32' ? 'junction' : 'dir',
            )
          }
          actual.healProfilesModuleFallback(...args)
        },
      }
    })
    try {
      const { prepareProfile: prepareRacedProfile } = await import('../src/profile-boot.ts')
      let failure: unknown
      try {
        prepareRacedProfile('web-personal')
      } catch (error) {
        failure = error
      }

      expect({
        entries: readdirSync(externalProfilesDir).sort(),
        failed: failure instanceof Error,
        sentinel: readFileSync(join(externalProfilesDir, 'sentinel'), 'utf8'),
      }).toEqual({
        entries: ['sentinel'],
        failed: true,
        sentinel: 'external bytes\n',
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails closed without publishing cordis.yml through a replaced profile ancestor', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const externalProfileDir = join(root, 'external-profile')
    process.env.DSH_HOME = home
    ensureCuratedProfile('web-personal')
    mkdirSync(externalProfileDir)
    writeFileSync(join(externalProfileDir, 'sentinel'), 'external bytes\n')
    const profileDir = resolveProfileDir('web-personal', home)
    const rootConfig = join(profileDir, 'cordis.yml')
    let replaced = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const replaceProfile = (): void => {
        if (replaced) return
        replaced = true
        actual.renameSync(profileDir, `${profileDir}.original`)
        actual.symlinkSync(
          externalProfileDir,
          profileDir,
          process.platform === 'win32' ? 'junction' : 'dir',
        )
      }
      return {
        ...actual,
        renameSync: (...args: Parameters<typeof actual.renameSync>) => {
          if (String(args[1]) === rootConfig) replaceProfile()
          actual.renameSync(...args)
        },
        writeFileSync: (...args: Parameters<typeof actual.writeFileSync>) => {
          if (String(args[0]) === rootConfig) replaceProfile()
          actual.writeFileSync(...args)
        },
      }
    })
    try {
      const { prepareProfile: prepareRacedProfile } = await import('../src/profile-boot.ts')
      let failure: unknown
      try {
        prepareRacedProfile('web-personal')
      } catch (error) {
        failure = error
      }

      expect({
        entries: readdirSync(externalProfileDir).sort(),
        failed: failure instanceof Error,
        sentinel: readFileSync(join(externalProfileDir, 'sentinel'), 'utf8'),
      }).toEqual({
        entries: ['sentinel'],
        failed: true,
        sentinel: 'external bytes\n',
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not execute a curated root config replaced before Loader mounting', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const marker = join(root, 'executed')
    const payload = join(root, 'payload.mjs')
    process.env.DSH_HOME = home
    writeFileSync(payload, [
      "import { writeFileSync } from 'node:fs'",
      "export const name = 'root-swap-payload'",
      `export function apply() { writeFileSync(${JSON.stringify(marker)}, 'executed\\n') }`,
      '',
    ].join('\n'))
    const refreshes = new Map<string, ConfigRefresh>()
    vi.resetModules()
    useRealPatchWatcherBoot(refreshes, (rootConfig) => {
      writeFileSync(rootConfig, `- id: root-swap-payload\n  name: ${JSON.stringify(payload)}\n`)
    })
    const { runProfile } = await import('../src/profile-boot.ts')
    const processOn = vi.spyOn(process, 'on').mockImplementation((() => process) as typeof process.on)
    try {
      await expect(runProfile({
        environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: {} }]),
        profile: 'web-personal',
        patchFiles: [],
        args: ['--no-open'],
      })).rejects.toThrow(
        'web-personal managed profile file cordis.yml changed while it was being read',
      )
      expect(existsSync(marker)).toBe(false)
    } finally {
      processOn.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('recognizes only curated profile template names', () => {
    expect(isCuratedProfileName('web-curated')).toBe(true)
    expect(isCuratedProfileName('web-coding')).toBe(true)
    expect(isCuratedProfileName('web')).toBe(false)
    expect(isCuratedProfileName('custom')).toBe(false)
  })

  it('materializes a curated profile in DSH_HOME without touching shipped profiles', () => {
    const home = tmp()
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-enterprise')

      const dir = resolveProfileDir('web-enterprise', home)
      const manifest = readProfileManifest('dsh', dir)
      expect(manifest.dsh?.profile?.bundles).toEqual(CURATED_PROFILE_TEMPLATES['web-enterprise'].bundles)
      expect(loadYaml(readFileSync(join(dir, 'cordis.patch.yml'), 'utf8'))).toEqual([])
      expect(readFileSync(join(dir, '.npmrc'), 'utf8')).toBe('ignore-scripts=true\n')
      expect(existsSync(resolveProfileDir('web', home))).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('loads a materialized profile through the CLI profile preparation path', () => {
    const home = tmp()
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-research')
      const profileDir = resolveProfileDir('web-research', home)
      const manifest = readProfileManifest('dsh', profileDir)
      stageProfileDependencies(profileDir, manifest.dependencies ?? {})

      const prepared = prepareProfileForUse('web-research', { userLayer: false })
      const profile = prepared.profile
      prepared.close()
      prepared.close()

      expect(profile.layers.map(layer => layer.packageName)).toEqual(manifest.dsh?.profile?.bundles)
      expect(profile.patches).toEqual([])
      expect(() => {
        admitCuratedProfile('web-research', profile, [], { userLayer: false })
      }).not.toThrow()
      expect(existsSync(resolveProfileDir('web', home))).toBe(false)
      expect(existsSync(resolveProfileDir('headless', home))).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('does not reread a replaced curated manifest after ensure', async () => {
    const home = tmp()
    process.env.DSH_HOME = home
    ensureCuratedProfile('web-personal')
    const profileDir = resolveProfileDir('web-personal', home)
    const manifestPath = join(profileDir, 'package.json')
    const externalManifest = join(tmp(), 'outside-package.json')
    writeFileSync(externalManifest, readFileSync(manifestPath))
    let raced = false
    let externalTargetRead = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        readFileSync: ((...args: Parameters<typeof actual.readFileSync>) => {
          const [path] = args
          if (raced && String(path) === manifestPath) externalTargetRead = true
          return actual.readFileSync(...args)
        }) as typeof readFileSync,
      }
    })
    vi.doMock('@deepseek-ai/dsh-app-boot', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-app-boot')>(
        '@deepseek-ai/dsh-app-boot',
      )
      const fs = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        healProfilesModuleFallback: (...args: Parameters<typeof actual.healProfilesModuleFallback>) => {
          actual.healProfilesModuleFallback(...args)
          if (!raced) {
            raced = true
            fs.renameSync(manifestPath, `${manifestPath}.original`)
            fs.symlinkSync(externalManifest, manifestPath, 'file')
          }
        },
      }
    })
    const { prepareProfile: prepareRacedProfile } = await import('../src/profile-boot.ts')

    expect(() => prepareRacedProfile('web-personal')).toThrow(
      'web-personal managed profile file package.json changed while it was being read',
    )
    expect(externalTargetRead).toBe(false)
  })

  it('rejects a profiles ancestor replacement before initial prepare reads external files', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const externalHome = join(root, 'external')
    process.env.DSH_HOME = home
    ensureCuratedProfile('web-personal')
    process.env.DSH_HOME = externalHome
    ensureCuratedProfile('web-personal')
    process.env.DSH_HOME = home
    const profilesDir = join(home, 'profiles')
    const profileDir = resolveProfileDir('web-personal', home)
    const externalProfilesDir = join(externalHome, 'profiles')
    const managedPaths = new Set([
      join(profileDir, 'package.json'),
      join(profileDir, 'cordis.patch.yml'),
      join(profileDir, 'pnpm-workspace.yaml'),
      join(profileDir, '.npmrc'),
    ])
    const initialDescriptors = new Set<number>()
    const externalDescriptors = new Set<number>()
    let initialDescriptorCount = 0
    let raced = false
    let externalTargetRead = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        constants: { ...actual.constants, O_NOFOLLOW: undefined },
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (managedPaths.has(String(args[0]))) {
            if (raced) externalDescriptors.add(descriptor)
            else {
              initialDescriptors.add(descriptor)
              initialDescriptorCount++
            }
          }
          return descriptor
        },
        closeSync: (descriptor: number) => {
          actual.closeSync(descriptor)
          externalDescriptors.delete(descriptor)
          if (
            !raced
            && initialDescriptors.delete(descriptor)
            && initialDescriptorCount === managedPaths.size
            && initialDescriptors.size === 0
          ) {
            raced = true
            actual.renameSync(profilesDir, `${profilesDir}.original`)
            actual.symlinkSync(
              externalProfilesDir,
              profilesDir,
              process.platform === 'win32' ? 'junction' : 'dir',
            )
          }
        },
        readSync: (...args: Parameters<typeof actual.readSync>) => {
          if (externalDescriptors.has(args[0])) externalTargetRead = true
          return actual.readSync(...args)
        },
      }
    })
    try {
      const { prepareProfile: prepareRacedProfile } = await import('../src/profile-boot.ts')
      expect(() => prepareRacedProfile('web-personal')).toThrow(
        'web-personal profile root resolves outside the DSH home',
      )
      expect(initialDescriptorCount).toBe(managedPaths.size)
      expect(raced).toBe(true)
      expect(externalTargetRead).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('binds curated live profile reads while preserving ordinary live layer semantics', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const overlay = join(root, 'overlay.yml')
    process.env.DSH_HOME = home
    ensureCuratedProfile('web-personal')
    const curatedPatch = join(resolveProfileDir('web-personal', home), 'cordis.patch.yml')
    const externalPatch = join(root, 'external-sentinel.yml')
    writeFileSync(externalPatch, '- id: external-sentinel\n  config:\n    source: external\n')
    writeFileSync(overlay, '- id: overlay-marker\n  config:\n    generation: initial\n')
    let replaceCuratedPatch = false
    let curatedPatchReplaced = false
    let externalTargetRead = false
    let externalDescriptor: number | undefined
    const liveComposers: Array<(patches: PatchOptions[]) => PatchOptions[]> = []
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        constants: { ...actual.constants, O_NOFOLLOW: undefined },
        lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
          const result = actual.lstatSync(...args)
          if (replaceCuratedPatch && !curatedPatchReplaced && String(args[0]) === curatedPatch) {
            curatedPatchReplaced = true
            actual.renameSync(curatedPatch, `${curatedPatch}.original`)
            actual.symlinkSync(externalPatch, curatedPatch, 'file')
          }
          return result
        }) as typeof actual.lstatSync,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (curatedPatchReplaced && String(args[0]) === curatedPatch) externalDescriptor = descriptor
          return descriptor
        },
        readSync: (...args: Parameters<typeof actual.readSync>) => {
          if (args[0] === externalDescriptor) externalTargetRead = true
          return actual.readSync(...args)
        },
      }
    })
    vi.doMock('@deepseek-ai/dsh-app-boot', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-app-boot')>(
        '@deepseek-ai/dsh-app-boot',
      )
      return {
        ...actual,
        boot: async (...args: Parameters<typeof actual.boot>) => {
          const services = new Map<string, unknown>([
            ['loader', { create: async () => undefined }],
            ['hmr', {}],
          ])
          const ctx = {
            fiber: {
              state: FiberState.ACTIVE,
              dispose: async () => undefined,
            },
            get: (name: string) => services.get(name),
            provide: (name: string, value: unknown) => { services.set(name, value) },
            loader: services.get('loader'),
          } as unknown as Context
          await args[3]?.(ctx)
          return ctx
        },
        installFailLoud: () => () => {},
        watchUserPatches: async (
          _ctx: Context,
          options: Parameters<typeof actual.watchUserPatches>[1],
        ) => {
          if (options.compose !== undefined) liveComposers.push(options.compose)
          return async () => {}
        },
      }
    })
    const { runProfile: runCapturedProfile } = await import('../src/profile-boot.ts')
    const processOn = vi.spyOn(process, 'on').mockImplementation((() => process) as typeof process.on)
    try {
      await runCapturedProfile({
        environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: {} }]),
        profile: 'web-personal',
        patchFiles: [],
        args: [],
      })
      expect(liveComposers).toHaveLength(2)
      const curatedCompose = liveComposers[0]!
      writeFileSync(curatedPatch, '- id: curated-marker\n  config:\n    generation: first\n')
      expect(JSON.stringify(curatedCompose([]))).toContain('"generation":"first"')
      writeFileSync(curatedPatch, '- id: curated-marker\n  config:\n    generation: second\n')
      expect(JSON.stringify(curatedCompose([]))).toContain('"generation":"second"')
      writeFileSync(curatedPatch, '- id: curated-marker\n  config:\n    generation: !!js process.env.BAD\n')
      expect(() => curatedCompose([])).toThrow('web-personal existing patch must not contain dynamic expressions')
      writeFileSync(curatedPatch, '[]\n')
      expect(() => curatedCompose([])).not.toThrow()
      const fs = await vi.importActual<typeof import('node:fs')>('node:fs')
      replaceCuratedPatch = true

      expect(() => curatedCompose([])).toThrow(/web-personal managed profile file cordis\.patch\.yml/)

      liveComposers.length = 0
      const ordinaryPatch = join(resolveProfileDir('web', home), 'cordis.patch.yml')
      writeFileSync(join(home, 'cordis.patch.yml'), '- id: home-marker\n  config:\n    generation: initial\n')
      await runCapturedProfile({
        environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: {} }]),
        profile: 'web',
        patchFiles: [overlay],
        args: [],
      })
      expect(liveComposers).toHaveLength(2)
      writeFileSync(ordinaryPatch, '- id: profile-marker\n  config:\n    generation: live\n')
      writeFileSync(join(home, 'cordis.patch.yml'), '- id: home-marker\n  config:\n    generation: live\n')
      writeFileSync(overlay, '- id: overlay-marker\n  config:\n    generation: changed-on-disk\n')

      const ordinaryLive = JSON.stringify(liveComposers[0]!([]))
      expect(ordinaryLive).toContain('"id":"profile-marker"')
      expect(ordinaryLive).toContain('"id":"home-marker"')
      expect(ordinaryLive).toContain('"generation":"live"')
      expect(ordinaryLive).toContain('"id":"overlay-marker"')
      expect(ordinaryLive).toContain('"generation":"initial"')
      expect(ordinaryLive).not.toContain('changed-on-disk')
      fs.unlinkSync(ordinaryPatch)
      const ordinaryWithoutProfilePatch = JSON.stringify(liveComposers[0]!([]))
      expect(ordinaryWithoutProfilePatch).not.toContain('"id":"profile-marker"')
      expect(ordinaryWithoutProfilePatch).toContain('"id":"home-marker"')
      expect(ordinaryWithoutProfilePatch).toContain('"id":"overlay-marker"')
      expect(externalTargetRead).toBe(false)
    } finally {
      processOn.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a final profile patch symlink before the real watcher callback reads its target', async () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    ensureCuratedProfile('web-personal')
    const curatedPatch = join(resolveProfileDir('web-personal', home), 'cordis.patch.yml')
    const externalPatch = join(root, 'external-sentinel.yml')
    writeFileSync(externalPatch, '- id: external-sentinel\n  config:\n    source: external\n')
    let externalReadFile = false
    let externalReadSync = false
    let externalDescriptor: number | undefined
    let replaced = false
    const refreshes = new Map<string, ConfigRefresh>()
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        constants: { ...actual.constants, O_NOFOLLOW: undefined },
        readFileSync: ((...args: Parameters<typeof actual.readFileSync>) => {
          if (replaced && String(args[0]) === curatedPatch) externalReadFile = true
          return actual.readFileSync(...args)
        }) as typeof actual.readFileSync,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (replaced && String(args[0]) === curatedPatch) externalDescriptor = descriptor
          return descriptor
        },
        readSync: (...args: Parameters<typeof actual.readSync>) => {
          if (args[0] === externalDescriptor) externalReadSync = true
          return actual.readSync(...args)
        },
      }
    })
    useRealPatchWatcherBoot(refreshes)
    const { runProfile: runWatchedProfile } = await import('../src/profile-boot.ts')
    const processOn = vi.spyOn(process, 'on').mockImplementation((() => process) as typeof process.on)
    let ctx: Context | undefined
    try {
      ;({ ctx } = await runWatchedProfile({
        environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: {} }]),
        profile: 'web-personal',
        patchFiles: [],
        args: [],
      }))
      expect(refreshes).toHaveLength(2)
      const refresh = refreshes.get(curatedPatch)
      expect(refresh).toBeDefined()
      const fs = await vi.importActual<typeof import('node:fs')>('node:fs')
      fs.renameSync(curatedPatch, `${curatedPatch}.original`)
      fs.symlinkSync(externalPatch, curatedPatch, 'file')
      replaced = true

      await expect(Promise.resolve(refresh?.())).rejects.toThrow(
        /web-personal managed profile file cordis\.patch\.yml/,
      )
      expect(externalReadFile).toBe(false)
      expect(externalReadSync).toBe(false)
    } finally {
      await ctx?.fiber.dispose()
      processOn.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a profiles ancestor replacement before the real watcher callback reads external files', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const externalHome = join(root, 'external')
    process.env.DSH_HOME = home
    ensureCuratedProfile('web-personal')
    process.env.DSH_HOME = externalHome
    ensureCuratedProfile('web-personal')
    process.env.DSH_HOME = home
    const profilesDir = join(home, 'profiles')
    const curatedPatch = join(resolveProfileDir('web-personal', home), 'cordis.patch.yml')
    const externalProfilesDir = join(externalHome, 'profiles')
    const externalManagedPaths = new Set([
      join(resolveProfileDir('web-personal', externalHome), 'package.json'),
      join(resolveProfileDir('web-personal', externalHome), 'cordis.patch.yml'),
      join(resolveProfileDir('web-personal', externalHome), 'pnpm-workspace.yaml'),
      join(resolveProfileDir('web-personal', externalHome), '.npmrc'),
    ])
    let externalReadFile = false
    let externalReadSync = false
    let replaced = false
    const externalDescriptors = new Set<number>()
    const refreshes = new Map<string, ConfigRefresh>()
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        constants: { ...actual.constants, O_NOFOLLOW: undefined },
        readFileSync: ((...args: Parameters<typeof actual.readFileSync>) => {
          if (replaced && String(args[0]) === curatedPatch) externalReadFile = true
          return actual.readFileSync(...args)
        }) as typeof actual.readFileSync,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (replaced && externalManagedPaths.has(actual.realpathSync.native(String(args[0])))) {
            externalDescriptors.add(descriptor)
          }
          return descriptor
        },
        readSync: (...args: Parameters<typeof actual.readSync>) => {
          if (externalDescriptors.has(args[0])) externalReadSync = true
          return actual.readSync(...args)
        },
      }
    })
    useRealPatchWatcherBoot(refreshes)
    const { runProfile: runWatchedProfile } = await import('../src/profile-boot.ts')
    const processOn = vi.spyOn(process, 'on').mockImplementation((() => process) as typeof process.on)
    let ctx: Context | undefined
    try {
      ;({ ctx } = await runWatchedProfile({
        environment: createLaunchEnvironmentSnapshot([{ source: 'process', values: {} }]),
        profile: 'web-personal',
        patchFiles: [],
        args: [],
      }))
      expect(refreshes).toHaveLength(2)
      const refresh = refreshes.get(curatedPatch)
      expect(refresh).toBeDefined()
      const fs = await vi.importActual<typeof import('node:fs')>('node:fs')
      fs.renameSync(profilesDir, `${profilesDir}.original`)
      fs.symlinkSync(
        externalProfilesDir,
        profilesDir,
        process.platform === 'win32' ? 'junction' : 'dir',
      )
      replaced = true

      await expect(Promise.resolve(refresh?.())).rejects.toThrow(
        'profiles root must be a regular directory',
      )
      expect(externalReadFile).toBe(false)
      expect(externalReadSync).toBe(false)
    } finally {
      await ctx?.fiber.dispose()
      processOn.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps ordinary profiles unchanged and resolves curated foundation bundles from the installation first', () => {
    const home = tmp()
    process.env.DSH_HOME = home
    try {
      expect(prepareProfile('web', { userLayer: false }).layers.map(layer => layer.packageName))
        .toEqual(['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
      expect(prepareProfile('headless', { userLayer: false }).layers.map(layer => layer.packageName))
        .toEqual(['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-headless'])
      const customDir = resolveProfileDir('custom', home)
      initProfile(customDir, ['@deepseek-ai/dsh-base'])
      expect(prepareProfile('custom', { userLayer: false }).layers.map(layer => layer.packageName))
        .toEqual(['@deepseek-ai/dsh-base'])

      ensureCuratedProfile('web-personal')
      const curatedDir = resolveProfileDir('web-personal', home)
      const shadowDir = join(curatedDir, 'node_modules/@deepseek-ai/dsh-base')
      mkdirSync(shadowDir, { recursive: true })
      writeFileSync(join(shadowDir, 'package.json'), JSON.stringify({
        name: '@deepseek-ai/dsh-base',
        dsh: { bundle: { patch: './cordis.patch.yml' } },
      }))
      writeFileSync(join(shadowDir, 'cordis.patch.yml'), '- insert:\n    - id: shadow\n      name: shadow\n')
      const curated = prepareProfile('web-personal', { userLayer: false })
      expect(curated.layers[0]?.packageDir).not.toBe(shadowDir)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('keeps normal dotenv loading but skips both layers for an internal guarded launch', async () => {
    const root = tmp()
    const home = join(root, 'home')
    const project = join(root, 'project')
    mkdirSync(home)
    mkdirSync(project)
    writeFileSync(join(project, '.env'), 'PATH=/project-only-path\n')
    writeFileSync(join(home, '.env'), 'BROWSER=./home-only-browser\n')
    try {
      const ordinary = await runSource(home, ['--profile', 'missing'], { cwd: project })
      expect(ordinary.exitCode).not.toBe(0)
      expect(ordinary.stderr).toContain('.env sets "PATH"')

      const guarded = await runSource(home, ['--profile', 'missing'], {
        cwd: project,
        env: { DSH_INTERNAL_DISABLE_DOTENV: '1' },
      })
      expect(guarded.exitCode).not.toBe(0)
      expect(guarded.stderr).toContain('profile "missing" does not exist')
      expect(guarded.stdout).not.toContain('project-only-path')
      expect(guarded.stdout).not.toContain('home-only-browser')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('rejects a curated manifest that diverges from its template without changing existing bytes', () => {
    const home = tmp()
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-personal')
      const profileDir = resolveProfileDir('web-personal', home)
      const manifestPath = join(profileDir, 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        dsh: { profile: { bundles: string[] } }
      }
      manifest.dsh.profile.bundles.push('@deepseek-ai/dsh-headless')
      writeFileSync(manifestPath, JSON.stringify(manifest))
      const before = readFileSync(manifestPath)

      expect(() => prepareProfile('web-personal')).toThrow(
        'web-personal existing manifest violates curated policy',
      )
      expect(() => { ensureCuratedProfile('web-personal') }).toThrow(
        'web-personal existing manifest violates curated policy',
      )
      expect(existsSync(join(home, 'profiles/.web-personal.install.lock'))).toBe(false)
      expect(readFileSync(manifestPath)).toEqual(before)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects dynamic expressions in a curated profile patch without changing existing bytes', () => {
    const home = tmp()
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-personal')
      const patchPath = join(resolveProfileDir('web-personal', home), 'cordis.patch.yml')
      writeFileSync(patchPath, '- id: webserver\n  config:\n    port: !!js process.env.PORT\n')
      const before = readFileSync(patchPath)

      expect(() => prepareProfile('web-personal')).toThrow(
        'web-personal existing patch must not contain dynamic expressions',
      )
      expect(readFileSync(patchPath)).toEqual(before)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects unsafe curated boot and dump layers while accepting a legal dump', async () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-personal')
      const profileDir = resolveProfileDir('web-personal', home)
      const profilePatch = join(profileDir, 'cordis.patch.yml')
      const legal = await runSource(home, ['--profile', 'web-personal', '--dump-config'])
      expect(legal.exitCode, legal.stderr).toBe(0)

      writeFileSync(profilePatch, [
        '- insert:',
        '    - id: injected-group',
        "      name: '@deepseek-ai/cordis-plugin-group'",
        '      group: true',
        '      config:',
        '        - id: injected',
        '          name: injected-plugin',
        '',
      ].join('\n'))
      const profileBytes = readFileSync(profilePatch)
      const boot = await runSource(home, ['--profile', 'web-personal'])
      expect(boot.exitCode).not.toBe(0)
      expect(boot.stderr).toContain('web-personal existing patch introduces an unapproved executable or group')
      expect(readFileSync(profilePatch)).toEqual(profileBytes)

      writeFileSync(profilePatch, '[]\n')
      const homePatch = join(home, 'cordis.patch.yml')
      const rootConfig = join(profileDir, 'cordis.yml')
      writeFileSync(rootConfig, 'existing root bytes\n')
      writeFileSync(homePatch, '- insert:\n    - id: home-injected\n      name: home-plugin\n')
      const homeBytes = readFileSync(homePatch)
      const rootBytes = readFileSync(rootConfig)
      const homeDump = await runSource(home, ['--profile', 'web-personal', '--dump-config'])
      expect(homeDump.exitCode).not.toBe(0)
      expect(homeDump.stderr).toContain('web-personal user patches introduce an unapproved executable or group')
      expect(readFileSync(homePatch)).toEqual(homeBytes)
      expect(readFileSync(rootConfig)).toEqual(rootBytes)

      writeFileSync(homePatch, '[]\n')
      const overlay = join(root, 'overlay.yml')
      writeFileSync(overlay, '- id: webserver\n  disabled: !!js process.env.DISABLE_WEB\n')
      const overlayBytes = readFileSync(overlay)
      const overlayDump = await runSource(home, [
        '--profile',
        'web-personal',
        '--dump-config',
        '--patch',
        overlay,
      ])
      expect(overlayDump.exitCode).not.toBe(0)
      expect(overlayDump.stderr).toContain('web-personal user patches must not contain dynamic expressions')
      expect(readFileSync(overlay)).toEqual(overlayBytes)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('rejects a duplicate approved executable through the CLI admission path', async () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-personal')
      const profile = prepareProfile('web-personal', { userLayer: false })
      const approved = composeEntries([profile.layers.flatMap(layer => layer.patches)])
        .find(entry => typeof entry.id === 'string' && typeof entry.name === 'string')
      if (approved === undefined) throw new Error('missing approved executable fixture')
      writeFileSync(
        join(profile.dir, 'cordis.patch.yml'),
        `- insert:\n    - id: ${JSON.stringify(approved.id)}\n      name: ${JSON.stringify(approved.name)}\n`,
      )

      const result = await runSource(home, ['--profile', 'web-personal', '--dump-config'])

      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('web-personal existing patch introduces an unapproved executable or group')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('rejects malformed curated profile, home, and overlay patches without exposing secret values', async () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-enterprise')
      const profileDir = resolveProfileDir('web-enterprise', home)
      const manifest = readProfileManifest('dsh', profileDir)
      stageProfileDependencies(profileDir, manifest.dependencies ?? {})
      const secret = 'super-secret-value'
      writeFileSync(
        join(profileDir, 'cordis.patch.yml'),
        `- id: memento\n  config:\n    apiKey: ${secret}\n    broken: [\n`,
      )

      const defaultOnly = await runSource(home, ['--profile', 'web-enterprise', '--dump-default-config'])
      expect(defaultOnly.exitCode).not.toBe(0)
      expect(defaultOnly.stderr).toContain('failed to parse overlay')
      expect(defaultOnly.stderr).toContain('[REDACTED]')
      expect(defaultOnly.stderr).not.toContain(secret)

      const ordinaryDump = await runSource(home, ['--profile', 'web-enterprise', '--dump-config'])
      expect(ordinaryDump.exitCode).not.toBe(0)
      expect(ordinaryDump.stderr).toContain('failed to parse overlay')
      expect(ordinaryDump.stderr).not.toContain(secret)

      const boot = await runSource(home, ['--profile', 'web-enterprise'])
      expect(boot.exitCode).not.toBe(0)
      expect(boot.stderr).toContain('failed to parse overlay')
      expect(boot.stderr).not.toContain(secret)

      writeFileSync(join(profileDir, 'cordis.patch.yml'), '[]\n')
      writeFileSync(
        join(home, 'cordis.patch.yml'),
        `- id: webserver\n  config:\n    token: ${secret}\n    broken: [\n`,
      )
      const homeResult = await runSource(home, ['--profile', 'web-enterprise', '--dump-config'])
      expect(homeResult.exitCode).not.toBe(0)
      expect(homeResult.stderr).toContain('[REDACTED]')
      expect(homeResult.stderr).not.toContain(secret)

      writeFileSync(join(home, 'cordis.patch.yml'), '[]\n')
      const overlay = join(root, 'overlay.yml')
      writeFileSync(
        overlay,
        `- id: webserver\n  config:\n    apiKey: ${secret}\n    broken: [\n`,
      )
      const overlayResult = await runSource(
        home,
        ['--profile', 'web-enterprise', '--dump-config', '--patch', overlay],
      )
      expect(overlayResult.exitCode).not.toBe(0)
      expect(overlayResult.stderr).toContain('[REDACTED]')
      expect(overlayResult.stderr).not.toContain(secret)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('admits but omits a safe curated default-only patch and ignores an ordinary malformed patch', async () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-personal')
      const curatedDir = resolveProfileDir('web-personal', home)
      writeFileSync(join(curatedDir, 'cordis.patch.yml'), '- id: webserver\n  config:\n    port: 3999\n')
      const curated = await runSource(home, ['--profile', 'web-personal', '--dump-default-config'])
      expect(curated.exitCode, curated.stderr).toBe(0)
      expect(curated.stdout).not.toContain('3999')
      expect(curated.stdout).not.toContain(join(curatedDir, 'cordis.patch.yml'))

      writeFileSync(
        join(curatedDir, 'cordis.patch.yml'),
        '- insert:\n    - id: unapproved\n      name: unapproved-plugin\n',
      )
      const rejected = await runSource(home, ['--profile', 'web-personal', '--dump-default-config'])
      expect(rejected.exitCode).not.toBe(0)
      expect(rejected.stderr).toContain('existing patch introduces an unapproved executable or group')

      const ordinaryDir = resolveProfileDir('custom-default-dump', home)
      initProfile(ordinaryDir, [])
      writeFileSync(join(ordinaryDir, 'cordis.patch.yml'), 'broken: [\n')
      const ordinary = await runSource(home, ['--profile', 'custom-default-dump', '--dump-default-config'])
      expect(ordinary.exitCode, ordinary.stderr).toBe(0)
      expect(ordinary.stdout.trim()).toBe('')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('rejects third-party executable entries in enterprise home and CLI overlays', async () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-enterprise')
      const profileDir = resolveProfileDir('web-enterprise', home)
      const manifest = readProfileManifest('dsh', profileDir)
      stageProfileDependencies(profileDir, manifest.dependencies ?? {})
      const overlay = join(root, 'overlay.yml')

      writeFileSync(overlay, '[]\n')
      const safe = await runSource(home, ['--profile', 'web-enterprise', '--dump-config', '--patch', overlay])
      expect(safe.exitCode, safe.stderr).toBe(0)

      writeFileSync(
        join(home, 'cordis.patch.yml'),
        '- insert:\n    - id: unverified-memory\n      name: dsh-memento\n      config: {}\n',
      )
      const homeResult = await runSource(home, ['--profile', 'web-enterprise', '--dump-config'])
      expect(homeResult.exitCode).not.toBe(0)
      expect(homeResult.stderr).toContain('web-enterprise user patches introduce an unapproved executable or group')

      writeFileSync(join(home, 'cordis.patch.yml'), '[]\n')
      writeFileSync(
        overlay,
        '- insert:\n    - id: unverified-telemetry\n      name: "@loongsuite/dsh-plugin"\n      config: {}\n',
      )
      const overlayResult = await runSource(home, [
        '--profile',
        'web-enterprise',
        '--dump-config',
        '--patch',
        overlay,
      ])
      expect(overlayResult.exitCode).not.toBe(0)
      expect(overlayResult.stderr).toContain('web-enterprise user patches introduce an unapproved executable or group')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('does not create a custom profile', () => {
    const home = tmp()
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('custom')
      expect(existsSync(resolveProfileDir('custom', home))).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
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
import { createLaunchEnvironmentSnapshot } from '@deepseek-ai/dsh-launch-environment'
import { load as loadYaml } from 'js-yaml'
import { ensureCuratedProfile, isCuratedProfileName } from '../src/curated-profile.ts'
import { prepareProfile } from '../src/profile-boot.ts'

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

function useRealPatchWatcherBoot(refreshes: Map<string, ConfigRefresh>): void {
  vi.doMock('@deepseek-ai/dsh-app-boot', async () => {
    const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-app-boot')>(
      '@deepseek-ai/dsh-app-boot',
    )
    return {
      ...actual,
      boot: async (...args: Parameters<typeof actual.boot>) => {
        const ctx = new Context()
        await ctx.plugin(Loader)
        await args[3]?.(ctx)
        await actual.mountRootInclude(ctx, args[1])
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
  vi.doUnmock('node:fs')
  vi.doUnmock('@deepseek-ai/dsh-app-boot')
  vi.resetModules()
})

describe('curated profile launcher bridge', () => {
  it('rejects a linked profiles root before healing the module fallback', () => {
    const home = tmp()
    const outside = tmp()
    symlinkSync(outside, join(home, 'profiles'), process.platform === 'win32' ? 'junction' : 'dir')
    process.env.DSH_HOME = home

    expect(() => prepareProfile('web-curated', { userLayer: false })).toThrow(
      'web-curated profile root resolves outside the DSH home',
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

      const profile = prepareProfile('web-research', { userLayer: false })

      expect(profile.layers.map(layer => layer.packageName)).toEqual(manifest.dsh?.profile?.bundles)
      expect(profile.patches).toEqual([])
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
        'web-personal profile root resolves outside the DSH home',
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

  it('keeps default-only recovery independent of a broken enterprise patch', async () => {
    const root = tmp()
    const home = join(root, 'home')
    process.env.DSH_HOME = home
    try {
      ensureCuratedProfile('web-enterprise')
      const profileDir = resolveProfileDir('web-enterprise', home)
      const manifest = readProfileManifest('dsh', profileDir)
      stageProfileDependencies(profileDir, manifest.dependencies ?? {})
      writeFileSync(join(profileDir, 'cordis.patch.yml'), '- id: memento\n  config:\n    broken: [\n')

      const defaultOnly = await runSource(home, ['--profile', 'web-enterprise', '--dump-default-config'])
      expect(defaultOnly.exitCode, defaultOnly.stderr).toBe(0)
      expect(defaultOnly.stdout).toContain('# == @deepseek-ai/dsh-base')

      const ordinaryDump = await runSource(home, ['--profile', 'web-enterprise', '--dump-config'])
      expect(ordinaryDump.exitCode).not.toBe(0)
      expect(ordinaryDump.stderr).toContain('failed to parse overlay')

      const boot = await runSource(home, ['--profile', 'web-enterprise'])
      expect(boot.exitCode).not.toBe(0)
      expect(boot.stderr).toContain('failed to parse overlay')
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

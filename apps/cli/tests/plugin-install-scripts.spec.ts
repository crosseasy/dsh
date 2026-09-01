import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_PROFILE_BUNDLES,
  initProfile,
  PROFILE_TEMPLATES,
  resolveProfileDir,
} from '@deepseek-ai/dsh-app-boot'
import { materializeCuratedProfile } from '@deepseek-ai/dsh-curated-profiles'
import { execa, execaSync } from 'execa'
import { describe, expect, it, vi } from 'vitest'
import { runPlugin } from '../src/plugin.ts'

const sourceBin = fileURLToPath(new URL('../src/bin.ts', import.meta.url))
const curatedProfileFiles = ['package.json', 'cordis.patch.yml', 'pnpm-workspace.yaml', '.npmrc'] as const

function readCuratedProfileBytes(profileDir: string): Readonly<Record<string, Buffer>> {
  return Object.fromEntries(curatedProfileFiles.map(file => [file, readFileSync(join(profileDir, file))]))
}

function successfulInstallScript(prefix: readonly string[] = []): string {
  return [
    '#!/bin/sh',
    ...prefix,
    'status="${DSH_TEST_PNPM_STATUS:-0}"',
    'if [ "$status" -eq 0 ]; then',
    '  mkdir -p node_modules/.pnpm',
    '  printf "%s\\n" "lockfileVersion: \'9.0\'" "" "importers:" "  .: {}" > pnpm-lock.yaml',
    '  cp pnpm-lock.yaml node_modules/.pnpm/lock.yaml',
    'fi',
    'exit "$status"',
    '',
  ].join('\n')
}

const provenanceNpmIntegrity =
  'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ=='
const provenanceGitCommit = '0123456789abcdef0123456789abcdef01234567'
const provenanceGitSpec =
  `git+https://github.com/example/plugin-git.git#${provenanceGitCommit}&path:packages/plugin`
const provenanceTransitiveIntegrity =
  'sha512-IDo+gkxEwZHGPilvuXd/3tWgPPN7CH3d79hj6KV5+N0SnjoRg+4oYIYf3j/A+iGqtLFiPL4nysO0F8c57XI0kw=='
const mismatchedTransitiveIntegrity =
  'sha512-We8KeiBr0LW4GKQRzqV1UNChUP8ihrh8ktn4MRJMsy8K/4E7GpQNadwzNOmDZuu52M7FLlCjE7zyF5sh6OknQw=='
const attackerTransitiveIntegrity =
  'sha512-T/DnlFNOqnPK4DEDvgR9dtCHq7Y4Ta8AcybPz8jAZmRqS8evNjvqNFFwHMx2OqdhUv6QFWRQZpkkUkOPDqyFXw=='

function provenanceClosureSha256(
  directSnapshotKey?: string,
  integrity = provenanceTransitiveIntegrity,
): string {
  const identities = [`shared-dep@3.0.0\0registry\0${integrity}`]
  if (directSnapshotKey !== undefined) identities.push(`${directSnapshotKey}\0direct`)
  const digest = createHash('sha256')
  for (const identity of identities.sort()) {
    const bytes = Buffer.from(identity)
    digest.update(`${String(bytes.byteLength)}:`)
    digest.update(bytes)
  }
  return digest.digest('hex')
}

function provenanceTreeSha256(files: Readonly<Record<string, string>>): string {
  const hash = createHash('sha256')
  for (const [path, content] of Object.entries(files).sort(([left], [right]) => left.localeCompare(right))) {
    const pathBytes = Buffer.from(path)
    const contentBytes = Buffer.from(content)
    hash.update(`${String(pathBytes.byteLength)}:`)
    hash.update(pathBytes)
    hash.update(`${String(contentBytes.byteLength)}:`)
    hash.update(contentBytes)
  }
  return hash.digest('hex')
}

function provenancePackageFiles(packageName: string): Readonly<Record<string, string>> {
  return {
    'cordis.patch.yml': '[]\n',
    'index.js': 'export const value = 1\n',
    'lib/secondary.js': 'export const secondary = true\n',
    'package.json': `${JSON.stringify({
      name: packageName,
      version: packageName === 'plugin-npm' ? '1.0.0' : '2.0.0',
      license: 'MIT',
      type: 'module',
      main: 'index.js',
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    })}\n`,
  }
}

function provenanceLock(): Record<string, unknown> {
  return {
    lockfileVersion: '9.0',
    importers: {
      '.': {
        dependencies: {
          'plugin-npm': { specifier: '1.0.0', version: '1.0.0(peer@2.0.0)' },
          'plugin-git': { specifier: provenanceGitSpec, version: provenanceGitSpec },
        },
      },
    },
    packages: {
      'plugin-npm@1.0.0': {
        resolution: { integrity: provenanceNpmIntegrity },
      },
      [`plugin-git@${provenanceGitSpec}`]: {
        resolution: {
          type: 'git',
          repo: 'https://github.com/example/plugin-git.git',
          commit: provenanceGitCommit,
          path: 'packages/plugin',
        },
        version: '2.0.0',
      },
      'shared-dep@3.0.0': {
        resolution: { integrity: provenanceTransitiveIntegrity },
      },
    },
    snapshots: {
      'plugin-npm@1.0.0(peer@2.0.0)': {
        dependencies: { 'shared-dep': '3.0.0' },
      },
      [`plugin-git@${provenanceGitSpec}`]: {
        optionalDependencies: { 'shared-dep': '3.0.0' },
      },
      'shared-dep@3.0.0': {},
    },
  }
}

describe.skipIf(process.platform === 'win32')('plugin installation lifecycle policy', () => {
  it('keeps curated help and list read-only and activates only a successful staged install', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-read-only-'))
    const home = join(root, 'home')
    const expectedHome = join(root, 'expected-home')
    const binDir = join(root, 'bin')
    const log = join(root, 'pnpm.log')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript([
      'printf "fake pnpm: %s\\n" "$*"',
      'printf "%s\\n" "$*" >> "$DSH_TEST_PNPM_LOG"',
    ]))
    chmodSync(pnpm, 0o755)
    const expectedDir = materializeCuratedProfile('web-curated', expectedHome)
    const expectedBytes = readCuratedProfileBytes(expectedDir)
    const profileDir = join(home, 'profiles', 'web-curated')
    const previousEnvironment = {
      home: process.env.DSH_HOME,
      log: process.env.DSH_TEST_PNPM_LOG,
      path: process.env.PATH,
      status: process.env.DSH_TEST_PNPM_STATUS,
    }
    process.env.DSH_HOME = home
    process.env.DSH_TEST_PNPM_LOG = log
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    try {
      expect(await runPlugin('web-curated', ['--help'])).toBe(0)
      expect(await runPlugin('web-curated', ['list'])).toBe(0)
      expect(existsSync(profileDir)).toBe(false)
      expect(existsSync(log)).toBe(false)

      process.env.DSH_TEST_PNPM_STATUS = '7'
      expect(await runPlugin('web-curated', ['install'])).toBe(7)
      expect(existsSync(profileDir)).toBe(false)

      process.env.DSH_TEST_PNPM_STATUS = '0'
      expect(await runPlugin('web-curated', ['install'])).toBe(0)
      expect(readCuratedProfileBytes(profileDir)).toEqual(expectedBytes)
      expect(existsSync(join(profileDir, 'pnpm-lock.yaml'))).toBe(true)
      expect(existsSync(join(profileDir, 'node_modules/.pnpm/lock.yaml'))).toBe(true)
      expect(readdirSync(join(home, '.curated-install-staging'))).toEqual([])
      const liveMarker = join(profileDir, 'live-marker')
      writeFileSync(liveMarker, 'old live profile\n')

      process.env.DSH_TEST_PNPM_STATUS = '7'
      expect(await runPlugin('web-curated', ['install'])).toBe(7)
      expect(readFileSync(liveMarker, 'utf8')).toBe('old live profile\n')
      expect(readdirSync(join(home, '.curated-install-staging'))).toEqual([])
    } finally {
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.log === undefined) delete process.env.DSH_TEST_PNPM_LOG
      else process.env.DSH_TEST_PNPM_LOG = previousEnvironment.log
      if (previousEnvironment.status === undefined) delete process.env.DSH_TEST_PNPM_STATUS
      else process.env.DSH_TEST_PNPM_STATUS = previousEnvironment.status
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('admits exact npm and Git locks and rejects mismatched or jointly tampered closures', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-lock-provenance-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    const packageRoot = join(root, 'packages')
    const rootLockPath = join(root, 'root-lock.json')
    const installedLockPath = join(root, 'installed-lock.json')
    mkdirSync(binDir, { recursive: true })
    for (const packageName of ['plugin-npm', 'plugin-git']) {
      const packageDir = join(packageRoot, packageName)
      mkdirSync(packageDir, { recursive: true })
      for (const [file, content] of Object.entries(provenancePackageFiles(packageName))) {
        mkdirSync(join(packageDir, file, '..'), { recursive: true })
        writeFileSync(join(packageDir, file), content)
      }
    }
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, [
      '#!/bin/sh',
      'mkdir -p node_modules/.pnpm/plugin-npm@1.0.0/node_modules',
      'mkdir -p node_modules/.pnpm/plugin-git@2.0.0/node_modules',
      'cp -R "$DSH_TEST_PACKAGE_ROOT/plugin-npm" node_modules/.pnpm/plugin-npm@1.0.0/node_modules/plugin-npm',
      'cp -R "$DSH_TEST_PACKAGE_ROOT/plugin-git" node_modules/.pnpm/plugin-git@2.0.0/node_modules/plugin-git',
      'if [ "${DSH_TEST_DIRECT_FILE:-}" = "1" ]; then',
      '  cp "$DSH_TEST_PACKAGE_ROOT/plugin-npm/index.js" node_modules/plugin-npm',
      'else',
      '  ln -s .pnpm/plugin-npm@1.0.0/node_modules/plugin-npm node_modules/plugin-npm',
      'fi',
      'ln -s .pnpm/plugin-git@2.0.0/node_modules/plugin-git node_modules/plugin-git',
      'cp "$DSH_TEST_ROOT_LOCK" pnpm-lock.yaml',
      'cp "$DSH_TEST_INSTALLED_LOCK" node_modules/.pnpm/lock.yaml',
      '',
    ].join('\n'))
    chmodSync(pnpm, 0o755)
    const previousEnvironment = {
      home: process.env.DSH_HOME,
      directFile: process.env.DSH_TEST_DIRECT_FILE,
      installedLock: process.env.DSH_TEST_INSTALLED_LOCK,
      packageRoot: process.env.DSH_TEST_PACKAGE_ROOT,
      path: process.env.PATH,
      rootLock: process.env.DSH_TEST_ROOT_LOCK,
    }
    process.env.DSH_HOME = home
    process.env.DSH_TEST_INSTALLED_LOCK = installedLockPath
    process.env.DSH_TEST_PACKAGE_ROOT = packageRoot
    process.env.DSH_TEST_ROOT_LOCK = rootLockPath
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    let admittedIdentities: unknown
    const npmClosureSha = provenanceClosureSha256('plugin-npm@1.0.0(peer@2.0.0)')
    const gitClosureSha = provenanceClosureSha256()
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-profiles', async () => {
      const actualProfiles = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-profiles')>(
        '@deepseek-ai/dsh-curated-profiles',
      )
      const policy = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      const seed = policy.loadCuratedCatalog().candidates[0]
      if (seed === undefined) throw new Error('missing curated candidate fixture')
      const {
        npmVersion: _seedNpmVersion,
        npmIntegrity: _seedNpmIntegrity,
        ...gitSeed
      } = seed
      const catalog = {
        schemaVersion: 2,
        source: policy.loadCuratedCatalog().source,
        candidates: [
          {
            ...seed,
            id: 'plugin-npm',
            expectedPackage: 'plugin-npm',
            repository: 'https://github.com/example/plugin-npm',
            repositoryPath: null,
            commit: provenanceGitCommit,
            npmVersion: '1.0.0',
            npmIntegrity: provenanceNpmIntegrity,
            treeSha256: provenanceTreeSha256(provenancePackageFiles('plugin-npm')),
            runtimeDependencyClosureSha256: npmClosureSha,
            targetProfiles: ['web-curated'],
            active: true,
          },
          {
            ...gitSeed,
            id: 'plugin-git',
            expectedPackage: 'plugin-git',
            repository: 'https://github.com/example/plugin-git',
            repositoryPath: 'packages/plugin',
            commit: provenanceGitCommit,
            treeSha256: provenanceTreeSha256(provenancePackageFiles('plugin-git')),
            runtimeDependencyClosureSha256: gitClosureSha,
            targetProfiles: ['web-curated'],
            active: true,
          },
        ],
      } satisfies import('@deepseek-ai/dsh-curated-policy').CuratedCatalog
      return {
        ...actualProfiles,
        curatedProfileDependenciesForBundles: () => ({
          'plugin-npm': '1.0.0',
          'plugin-git': provenanceGitSpec,
        }),
        assertCuratedProfileLockAdmission: (
          profile: import('@deepseek-ai/dsh-curated-profiles').CuratedProfileName,
          locks: import('@deepseek-ai/dsh-curated-profiles').CuratedProfileLockBytes,
        ) => {
          const identities = policy.assertCuratedInstalledLocks({
            catalog,
            profileId: profile,
            manifestDependencies: {
              'plugin-npm': '1.0.0',
              'plugin-git': provenanceGitSpec,
            },
            rootLock: locks.root,
            installedLock: locks.installed,
          })
          admittedIdentities = identities
          return identities
        },
      }
    })
    const { runPlugin: runProvenancePlugin } = await import('../src/plugin.ts')
    const writeLocks = (rootLock: unknown, installedLock: unknown = rootLock): void => {
      writeFileSync(rootLockPath, JSON.stringify(rootLock))
      writeFileSync(installedLockPath, JSON.stringify(installedLock))
    }
    const runWithLocks = async (rootLock: unknown, installedLock: unknown = rootLock): Promise<number> => {
      writeLocks(rootLock, installedLock)
      return runProvenancePlugin('web-curated', ['install'])
    }
    try {
      const exactLock = provenanceLock()
      expect(await runProvenancePlugin('web-curated', ['list'])).toBe(0)
      expect(await runWithLocks(exactLock)).toBe(0)
      expect(admittedIdentities).toEqual([
        {
          candidateId: 'plugin-npm',
          packageName: 'plugin-npm',
          packageVersion: '1.0.0',
          source: {
            kind: 'npm',
            version: '1.0.0',
            integrity: provenanceNpmIntegrity,
          },
          runtimeDependencyClosureSha256: npmClosureSha,
          treeSha256: provenanceTreeSha256(provenancePackageFiles('plugin-npm')),
        },
        {
          candidateId: 'plugin-git',
          packageName: 'plugin-git',
          packageVersion: '2.0.0',
          source: {
            kind: 'git',
            repository: 'https://github.com/example/plugin-git',
            commit: provenanceGitCommit,
            repositoryPath: 'packages/plugin',
          },
          runtimeDependencyClosureSha256: gitClosureSha,
          treeSha256: provenanceTreeSha256(provenancePackageFiles('plugin-git')),
        },
      ])
      expect(lstatSync(join(home, 'profiles/web-curated/node_modules/plugin-npm')).isSymbolicLink()).toBe(true)
      expect(readlinkSync(join(home, 'profiles/web-curated/node_modules/plugin-npm'))).toBe(
        '.pnpm/plugin-npm@1.0.0/node_modules/plugin-npm',
      )
      const liveMarker = join(home, 'profiles/web-curated/live-marker')
      writeFileSync(liveMarker, 'previous\n')

      const installedMismatch = structuredClone(exactLock)
      const installedPackages = installedMismatch.packages as Record<string, {
        resolution: Record<string, unknown>
      }>
      installedPackages['shared-dep@3.0.0']!.resolution.integrity = mismatchedTransitiveIntegrity
      await expect(runWithLocks(exactLock, installedMismatch)).rejects.toThrow(
        'root and installed pnpm runtime dependency closures differ',
      )

      const jointlyTampered = structuredClone(exactLock)
      const tamperedPackages = jointlyTampered.packages as Record<string, {
        resolution: Record<string, unknown>
      }>
      tamperedPackages['shared-dep@3.0.0']!.resolution.integrity = attackerTransitiveIntegrity
      await expect(runWithLocks(jointlyTampered)).rejects.toThrow(
        'runtime dependency closure SHA-256 differs from the catalog',
      )
      expect(readFileSync(liveMarker, 'utf8')).toBe('previous\n')

      const npmPackageSource = join(packageRoot, 'plugin-npm')
      writeFileSync(join(npmPackageSource, 'unexpected.js'), 'unexpected\n')
      await expect(runWithLocks(exactLock)).rejects.toThrow(
        'curated installed candidate tree differs from the catalog: plugin-npm',
      )
      rmSync(join(npmPackageSource, 'unexpected.js'))
      symlinkSync('index.js', join(npmPackageSource, 'linked.js'))
      await expect(runWithLocks(exactLock)).rejects.toThrow(
        'curated installed candidate tree contains a non-regular entry: plugin-npm',
      )
      rmSync(join(npmPackageSource, 'linked.js'))

      process.env.DSH_TEST_DIRECT_FILE = '1'
      await expect(runWithLocks(exactLock)).rejects.toThrow(
        'installed candidate plugin-npm must be a directory or pnpm link',
      )
      delete process.env.DSH_TEST_DIRECT_FILE

      const deepRoot = join(npmPackageSource, 'deep')
      let deep = deepRoot
      for (let depth = 0; depth < 65; depth += 1) {
        mkdirSync(deep)
        deep = join(deep, 'next')
      }
      await expect(runWithLocks(exactLock)).rejects.toThrow(
        'curated installed candidate tree exceeds the depth limit: plugin-npm',
      )
      rmSync(deepRoot, { recursive: true })

      const entriesRoot = join(npmPackageSource, 'entries')
      mkdirSync(entriesRoot)
      for (let index = 0; index < 1_000; index += 1) {
        writeFileSync(join(entriesRoot, String(index)), '')
      }
      await expect(runWithLocks(exactLock)).rejects.toThrow(
        'curated installed candidate tree exceeds the entry limit: plugin-npm',
      )
      rmSync(entriesRoot, { recursive: true })

      for (let index = 0; index < 4; index += 1) {
        writeFileSync(join(npmPackageSource, `large-${String(index)}`), Buffer.alloc(16 * 1024 * 1024))
      }
      await expect(runWithLocks(exactLock)).rejects.toThrow(
        'curated installed candidate tree exceeds the byte limit: plugin-npm',
      )
      for (let index = 0; index < 4; index += 1) {
        rmSync(join(npmPackageSource, `large-${String(index)}`))
      }

      let candidateIndexOpens = 0
      let activationRenameObserved = false
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
        return {
          ...actual,
          openSync: (...args: Parameters<typeof actual.openSync>) => {
            const path = String(args[0])
            if (path.endsWith(`${sep}node_modules${sep}plugin-npm${sep}index.js`)) {
              candidateIndexOpens += 1
              if (candidateIndexOpens === 2) {
                const earlierPath = join(path, '..', 'cordis.patch.yml')
                const before = actual.lstatSync(earlierPath)
                actual.writeFileSync(earlierPath, '[ ]')
                actual.utimesSync(earlierPath, before.atime, before.mtime)
              }
            }
            return actual.openSync(...args)
          },
          renameSync: (...args: Parameters<typeof actual.renameSync>) => {
            if (
              String(args[0]).includes(`${join(home, '.curated-install-staging')}${sep}`)
              && String(args[1]) === join(home, 'profiles', 'web-curated')
            ) {
              activationRenameObserved = true
            }
            actual.renameSync(...args)
          },
        }
      })
      vi.resetModules()
      const { runPlugin: runHashRacedPlugin } = await import('../src/plugin.ts')
      writeLocks(exactLock)
      await expect(runHashRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated installed candidate tree changed: plugin-npm',
      )
      expect(activationRenameObserved).toBe(false)

      vi.doUnmock('node:fs')
      vi.resetModules()
      let racedDirectoryReads = 0
      let addedLateEntry = false
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
        return {
          ...actual,
          readdirSync: (...args: Parameters<typeof actual.readdirSync>) => {
            const directory = String(args[0])
            if (
              !addedLateEntry
              && !directory.includes(`${sep}.curated-install-staging${sep}`)
              && directory.endsWith(`${sep}plugin-npm${sep}lib`)
            ) {
              const lateEntry = join(directory, 'late.js')
              const entries = actual.readdirSync(...args)
              actual.writeFileSync(lateEntry, 'export const late = true\n')
              addedLateEntry = true
              racedDirectoryReads += 1
              return entries
            }
            return actual.readdirSync(...args)
          },
        }
      })
      vi.resetModules()
      const { runPlugin: runDirectoryRacedPlugin } = await import('../src/plugin.ts')
      writeLocks(exactLock)
      await expect(runDirectoryRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated installed candidate tree changed: plugin-npm',
      )
      expect(racedDirectoryReads).toBeGreaterThan(0)

      vi.doUnmock('node:fs')
      vi.resetModules()
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
        return {
          ...actual,
          renameSync: (...args: Parameters<typeof actual.renameSync>) => {
            actual.renameSync(...args)
            const source = String(args[0])
            const destination = String(args[1])
            if (
              source.includes(`${join(home, '.curated-install-staging')}${sep}`)
              && destination === join(home, 'profiles', 'web-curated')
            ) {
              const entry = join(destination, 'node_modules/plugin-npm/index.js')
              const before = actual.lstatSync(entry)
              actual.writeFileSync(entry, 'export const value = 2\n')
              actual.utimesSync(entry, before.atime, before.mtime)
            }
          },
        }
      })
      vi.resetModules()
      const { runPlugin: runTreeRacedPlugin } = await import('../src/plugin.ts')
      writeLocks(exactLock)
      await expect(runTreeRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated installed candidate tree changed: plugin-npm',
      )
      expect(readFileSync(liveMarker, 'utf8')).toBe('previous\n')

      vi.doUnmock('node:fs')
      vi.resetModules()
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
        return {
          ...actual,
          renameSync: (...args: Parameters<typeof actual.renameSync>) => {
            actual.renameSync(...args)
            const source = String(args[0])
            const destination = String(args[1])
            if (
              source.includes(`${join(home, '.curated-install-staging')}${sep}`)
              && destination === join(home, 'profiles', 'web-curated')
            ) {
              const entry = join(destination, 'node_modules/plugin-npm')
              const target = actual.readlinkSync(entry)
              actual.unlinkSync(entry)
              actual.symlinkSync(target, entry)
            }
          },
        }
      })
      vi.resetModules()
      const { runPlugin: runLinkRacedPlugin } = await import('../src/plugin.ts')
      writeLocks(exactLock)
      await expect(runLinkRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated installed candidate tree changed: plugin-npm',
      )

      vi.doUnmock('node:fs')
      vi.resetModules()
      writeFileSync(pnpm, [
        '#!/bin/sh',
        'mkdir -p node_modules/.pnpm',
        'ln -s "$DSH_TEST_PACKAGE_ROOT/plugin-npm" node_modules/plugin-npm',
        'ln -s "$DSH_TEST_PACKAGE_ROOT/plugin-git" node_modules/plugin-git',
        'cp "$DSH_TEST_ROOT_LOCK" pnpm-lock.yaml',
        'cp "$DSH_TEST_INSTALLED_LOCK" node_modules/.pnpm/lock.yaml',
        '',
      ].join('\n'))
      const { runPlugin: runEscapedPlugin } = await import('../src/plugin.ts')
      writeLocks(exactLock)
      await expect(runEscapedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated installed candidate resolves outside canonical node_modules: plugin-npm',
      )
    } finally {
      vi.doUnmock('node:fs')
      vi.doUnmock('@deepseek-ai/dsh-curated-profiles')
      vi.resetModules()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.directFile === undefined) delete process.env.DSH_TEST_DIRECT_FILE
      else process.env.DSH_TEST_DIRECT_FILE = previousEnvironment.directFile
      if (previousEnvironment.installedLock === undefined) delete process.env.DSH_TEST_INSTALLED_LOCK
      else process.env.DSH_TEST_INSTALLED_LOCK = previousEnvironment.installedLock
      if (previousEnvironment.packageRoot === undefined) delete process.env.DSH_TEST_PACKAGE_ROOT
      else process.env.DSH_TEST_PACKAGE_ROOT = previousEnvironment.packageRoot
      if (previousEnvironment.rootLock === undefined) delete process.env.DSH_TEST_ROOT_LOCK
      else process.env.DSH_TEST_ROOT_LOCK = previousEnvironment.rootLock
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects patched dependency locators before activating a curated install', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-patch-hash-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, '#!/bin/sh\nmkdir -p node_modules/.pnpm\ncp pnpm-lock.yaml node_modules/.pnpm/lock.yaml\n')
    chmodSync(pnpm, 0o755)
    const profileDir = materializeCuratedProfile('web-curated', home)
    const transformedLock = [
      "lockfileVersion: '9.0'",
      'importers:',
      '  .: {}',
      'packages:',
      '  package-a@1.0.0:',
      '    resolution:',
      '      tarball: package-a@1.0.0(patch_hash=attacker)',
      '',
    ].join('\n')
    writeFileSync(join(profileDir, 'pnpm-lock.yaml'), transformedLock)
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    try {
      await expect(runPlugin('web-curated', ['install'])).rejects.toThrow(
        'root pnpm lockfile must not contain patched dependency locators',
      )
      expect(readFileSync(join(profileDir, 'pnpm-lock.yaml'), 'utf8')).toBe(transformedLock)
    } finally {
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each(['symlink', 'oversized'] as const)(
    'rejects a %s retained curated lockfile before invoking pnpm',
    async (kind) => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-live-lock-'))
      const home = join(root, 'home')
      const profileDir = materializeCuratedProfile('web-curated', home)
      const lockPath = join(profileDir, 'pnpm-lock.yaml')
      if (kind === 'symlink') {
        const outside = join(root, 'outside-lock.yaml')
        writeFileSync(outside, "lockfileVersion: '9.0'\n")
        symlinkSync(outside, lockPath)
      } else {
        writeFileSync(lockPath, Buffer.alloc(16 * 1024 * 1024 + 1))
      }
      const previousHome = process.env.DSH_HOME
      process.env.DSH_HOME = home
      try {
        await expect(runPlugin('web-curated', ['install'])).rejects.toThrow(
          kind === 'symlink'
            ? 'curated install file must be regular: pnpm-lock.yaml'
            : 'curated install file exceeds 16777216 bytes: pnpm-lock.yaml',
        )
      } finally {
        if (previousHome === undefined) delete process.env.DSH_HOME
        else process.env.DSH_HOME = previousHome
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it('rejects a retained curated lockfile that grows after opening before allocating', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-live-lock-growth-'))
    const home = join(root, 'home')
    const profileDir = materializeCuratedProfile('web-curated', home)
    const lockPath = join(profileDir, 'pnpm-lock.yaml')
    writeFileSync(lockPath, "lockfileVersion: '9.0'\nimporters:\n  .: {}\n")
    const previousHome = process.env.DSH_HOME
    process.env.DSH_HOME = home
    const lockDescriptors = new Set<number>()
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        openSync: (...args: Parameters<typeof actual.openSync>) => {
          const descriptor = actual.openSync(...args)
          if (String(args[0]).endsWith(`${sep}profiles${sep}web-curated${sep}pnpm-lock.yaml`)) {
            lockDescriptors.add(descriptor)
          }
          return descriptor
        },
        fstatSync: ((...args: Parameters<typeof actual.fstatSync>) => {
          const identity = actual.fstatSync(...args)
          if (lockDescriptors.has(args[0])) {
            Object.defineProperty(identity, 'size', { value: 16_777_217n })
          }
          return identity
        }) as typeof actual.fstatSync,
      }
    })
    try {
      const { runPlugin: runRacedPlugin } = await import('../src/plugin.ts')

      await expect(runRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated install file exceeds 16777216 bytes: pnpm-lock.yaml',
      )
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      if (previousHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('leaves a staged-directory replacement untouched when activation rejects it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-stage-replacement-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript())
    chmodSync(pnpm, 0o755)
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    const liveDir = materializeCuratedProfile('web-curated', home)
    writeFileSync(join(liveDir, 'live-marker'), 'previous\n')
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let replaced = false
      return {
        ...actual,
        renameSync: (...args: Parameters<typeof actual.renameSync>) => {
          const source = String(args[0])
          const destination = String(args[1])
          if (
            !replaced
            && source.includes(`${join(home, '.curated-install-staging')}${sep}`)
            && destination === join(home, 'profiles', 'web-curated')
          ) {
            replaced = true
            actual.renameSync(source, `${source}.validated`)
            actual.mkdirSync(source)
            actual.writeFileSync(join(source, 'attacker-marker'), 'replacement\n')
          }
          actual.renameSync(...args)
        },
      }
    })
    try {
      const { runPlugin: runRacedPlugin } = await import('../src/plugin.ts')
      await expect(runRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated profile activation and rollback both failed',
      )
      expect(readFileSync(join(home, 'profiles/web-curated/attacker-marker'), 'utf8')).toBe('replacement\n')
      expect(readFileSync(
        join(home, 'profiles/.web-curated.install-previous/live-marker'),
        'utf8',
      )).toBe('previous\n')
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects same-inode staged bytes changed after rename and restores the previous profile', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-stage-content-race-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript(['touch -t 202001010000 .npmrc']))
    chmodSync(pnpm, 0o755)
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    const liveDir = materializeCuratedProfile('web-curated', home)
    writeFileSync(join(liveDir, 'live-marker'), 'previous\n')
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        renameSync: (...args: Parameters<typeof actual.renameSync>) => {
          actual.renameSync(...args)
          const source = String(args[0])
          const destination = String(args[1])
          if (
            source.includes(`${join(home, '.curated-install-staging')}${sep}`)
            && destination === join(home, 'profiles', 'web-curated')
          ) {
            const npmrc = join(destination, '.npmrc')
            const before = actual.lstatSync(npmrc)
            actual.writeFileSync(npmrc, 'ignore-scripts=evil\n')
            actual.utimesSync(npmrc, before.atime, before.mtime)
          }
        },
      }
    })
    try {
      const { runPlugin: runRacedPlugin } = await import('../src/plugin.ts')
      await expect(runRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated install file changed: .npmrc',
      )
      expect(readFileSync(join(liveDir, 'live-marker'), 'utf8')).toBe('previous\n')
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('leaves a replacement live profile untouched when post-rename validation fails', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-live-replacement-race-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript())
    chmodSync(pnpm, 0o755)
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    const liveDir = materializeCuratedProfile('web-curated', home)
    writeFileSync(join(liveDir, 'live-marker'), 'previous\n')
    const previousDir = join(home, 'profiles', '.web-curated.install-previous')
    const movedStageDir = join(home, 'profiles', '.web-curated.activated-stage')
    let replaced = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        renameSync: (...args: Parameters<typeof actual.renameSync>) => {
          actual.renameSync(...args)
          const source = String(args[0])
          const destination = String(args[1])
          if (
            !replaced
            &&
            source.includes(`${join(home, '.curated-install-staging')}${sep}`)
            && destination === liveDir
          ) {
            replaced = true
            actual.renameSync(liveDir, movedStageDir)
            actual.mkdirSync(liveDir)
            actual.writeFileSync(join(liveDir, 'replacement-marker'), 'replacement\n')
          }
        },
      }
    })
    try {
      const { runPlugin: runRacedPlugin } = await import('../src/plugin.ts')
      await expect(runRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated profile activation and rollback both failed',
      )
      expect(readFileSync(join(liveDir, 'replacement-marker'), 'utf8')).toBe('replacement\n')
      expect(readFileSync(join(previousDir, 'live-marker'), 'utf8')).toBe('previous\n')
      expect(existsSync(movedStageDir)).toBe(true)

      await expect(runRacedPlugin('web-curated', ['install'])).rejects.toThrow()
      expect(readFileSync(join(liveDir, 'replacement-marker'), 'utf8')).toBe('replacement\n')
      expect(readFileSync(join(previousDir, 'live-marker'), 'utf8')).toBe('previous\n')
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not restore a previous profile directory replaced during failed activation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-rollback-identity-race-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript())
    chmodSync(pnpm, 0o755)
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    const liveDir = materializeCuratedProfile('web-curated', home)
    writeFileSync(join(liveDir, 'live-marker'), 'previous\n')
    const previousDir = join(home, 'profiles', '.web-curated.install-previous')
    const preservedDir = `${previousDir}.preserved`
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        renameSync: (...args: Parameters<typeof actual.renameSync>) => {
          actual.renameSync(...args)
          const source = String(args[0])
          const destination = String(args[1])
          if (source === liveDir && destination === previousDir) {
            actual.renameSync(previousDir, preservedDir)
            actual.mkdirSync(previousDir)
            actual.writeFileSync(join(previousDir, 'attacker-marker'), 'replacement\n')
          } else if (
            source.includes(`${join(home, '.curated-install-staging')}${sep}`)
            && destination === liveDir
          ) {
            actual.writeFileSync(join(destination, '.npmrc'), 'changed\n')
          }
        },
      }
    })
    try {
      const { runPlugin: runRacedPlugin } = await import('../src/plugin.ts')
      await expect(runRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'curated profile activation and rollback both failed',
      )
      expect(existsSync(join(liveDir, 'attacker-marker'))).toBe(false)
      expect(readFileSync(join(preservedDir, 'live-marker'), 'utf8')).toBe('previous\n')
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a stale activation backup introduced after recovery', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-stale-backup-race-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript())
    chmodSync(pnpm, 0o755)
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    const liveDir = materializeCuratedProfile('web-curated', home)
    const previousDir = join(home, 'profiles', '.web-curated.install-previous')
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let previousChecks = 0
      return {
        ...actual,
        existsSync: (path: Parameters<typeof actual.existsSync>[0]) => {
          if (String(path) === previousDir && ++previousChecks === 2) return true
          return actual.existsSync(path)
        },
      }
    })
    try {
      const { runPlugin: runRacedPlugin } = await import('../src/plugin.ts')
      await expect(runRacedPlugin('web-curated', ['install'])).rejects.toThrow(
        'stale curated profile backup was not reclaimed',
      )
      expect(existsSync(liveDir)).toBe(true)
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('warns when the replaced profile cannot be removed after successful activation', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-backup-cleanup-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript())
    chmodSync(pnpm, 0o755)
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    materializeCuratedProfile('web-curated', home)
    const previousDir = join(home, 'profiles', '.web-curated.install-previous')
    let cleanupFailed = false
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        rmSync: (...args: Parameters<typeof actual.rmSync>) => {
          if (String(args[0]) === previousDir && !cleanupFailed) {
            cleanupFailed = true
            throw new Error('cleanup denied')
          }
          actual.rmSync(...args)
        },
      }
    })
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      const { runPlugin: runRacedPlugin } = await import('../src/plugin.ts')
      expect(await runRacedPlugin('web-curated', ['install'])).toBe(0)
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining(
        'stale curated profile backup will be reclaimed later',
      ))
      expect(existsSync(previousDir)).toBe(true)
      expect(await runRacedPlugin('web-curated', ['install'])).toBe(0)
      expect(existsSync(previousDir)).toBe(false)
    } finally {
      stderr.mockRestore()
      vi.doUnmock('node:fs')
      vi.resetModules()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('serializes concurrent curated installs across processes', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-install-lock-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    const count = join(root, 'pnpm-count')
    const release = join(root, 'release-first')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript([
      'count=0',
      'if [ -f "$DSH_TEST_PNPM_COUNT" ]; then count=$(cat "$DSH_TEST_PNPM_COUNT"); fi',
      'count=$((count + 1))',
      'printf "%s" "$count" > "$DSH_TEST_PNPM_COUNT"',
      'if [ "$count" -eq 1 ]; then while [ ! -f "$DSH_TEST_PNPM_RELEASE" ]; do sleep 0.05; done; fi',
    ]))
    chmodSync(pnpm, 0o755)
    const launch = (suffix: string) => execa(process.execPath, [
      '--import',
      'tsx/esm',
      sourceBin,
      'plugin',
      '--profile',
      'web-curated',
      'install',
    ], {
      env: {
        ...process.env,
        DSH_HOME: home,
        DSH_TEST_PNPM_COUNT: count,
        DSH_TEST_PNPM_RELEASE: release,
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        DSH_TEST_PROCESS_SUFFIX: suffix,
      },
      reject: false,
      timeout: 40_000,
    })
    try {
      const first = launch('first')
      for (let attempt = 0; attempt < 200 && !existsSync(count); attempt += 1) {
        await new Promise(resolveDelay => setTimeout(resolveDelay, 10))
      }
      expect(readFileSync(count, 'utf8')).toBe('1')
      const second = launch('second')
      await new Promise(resolveDelay => setTimeout(resolveDelay, 200))
      expect(readFileSync(count, 'utf8')).toBe('1')
      writeFileSync(release, 'release\n')
      const [firstResult, secondResult] = await Promise.all([first, second])
      expect(firstResult.exitCode, firstResult.stderr).toBe(0)
      expect(secondResult.exitCode, secondResult.stderr).toBe(0)
      expect(readFileSync(count, 'utf8')).toBe('2')
      expect(existsSync(join(home, 'profiles/web-curated/package.json'))).toBe(true)
      expect(readdirSync(join(home, 'profiles')).filter(entry => entry.includes('install'))).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('reclaims a dead install lock and interrupted activation state', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-install-reclaim-'))
    const home = join(root, 'home')
    const profilesDir = join(home, 'profiles')
    const liveDir = join(profilesDir, 'web-curated')
    const previousDir = join(profilesDir, '.web-curated.install-previous')
    const lockDir = join(profilesDir, '.web-curated.install.lock')
    const stagingRoot = join(home, '.curated-install-staging')
    const staleStage = join(stagingRoot, 'web-curated-stale')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript())
    chmodSync(pnpm, 0o755)
    materializeCuratedProfile('web-curated', home)
    renameSync(liveDir, previousDir)
    mkdirSync(lockDir)
    writeFileSync(
      join(lockDir, 'owner.json'),
      `${JSON.stringify({
        pid: 2_147_483_647,
        started: 'completed-process-incarnation',
        token: 'stale',
      })}\n`,
    )
    mkdirSync(stagingRoot)
    mkdirSync(staleStage)
    writeFileSync(join(staleStage, 'sentinel'), 'stale\n')
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    try {
      expect(await runPlugin('web-curated', ['install'])).toBe(0)
      expect(existsSync(join(liveDir, 'package.json'))).toBe(true)
      expect(existsSync(previousDir)).toBe(false)
      expect(existsSync(lockDir)).toBe(false)
      expect(existsSync(staleStage)).toBe(false)
    } finally {
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('rejects a replacement introduced after previous-only recovery', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-recovery-identity-'))
    const home = join(root, 'home')
    const profilesDir = join(home, 'profiles')
    const liveDir = materializeCuratedProfile('web-personal', home)
    const previousDir = join(profilesDir, '.web-personal.install-previous')
    const preservedDir = `${previousDir}.preserved`
    renameSync(liveDir, previousDir)
    const previousHome = process.env.DSH_HOME
    process.env.DSH_HOME = home
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let replaced = false
      return {
        ...actual,
        renameSync: (...args: Parameters<typeof actual.renameSync>) => {
          actual.renameSync(...args)
          if (!replaced && String(args[0]) === previousDir && String(args[1]) === liveDir) {
            replaced = true
            actual.renameSync(liveDir, preservedDir)
            actual.mkdirSync(liveDir)
            actual.writeFileSync(join(liveDir, 'replacement-marker'), 'replacement\n')
          }
        },
      }
    })
    try {
      const { runPlugin: runRacedPlugin } = await import('../src/plugin.ts')

      await expect(runRacedPlugin('web-personal', ['install'])).rejects.toThrow(
        'previous curated profile changed during recovery',
      )
      expect(readFileSync(join(liveDir, 'replacement-marker'), 'utf8')).toBe('replacement\n')
      expect(existsSync(join(preservedDir, 'package.json'))).toBe(true)
    } finally {
      vi.doUnmock('node:fs')
      vi.resetModules()
      if (previousHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a curated registry override before invoking pnpm', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-npmrc-policy-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    const log = join(root, 'pnpm.log')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DSH_TEST_PNPM_LOG"\n')
    chmodSync(pnpm, 0o755)
    const profileDir = materializeCuratedProfile('web-curated', home)
    const npmrcPath = join(profileDir, '.npmrc')
    const unsafeNpmrc = 'ignore-scripts=true\nregistry=https://registry.example.test/\n'
    writeFileSync(npmrcPath, unsafeNpmrc)
    const previousEnvironment = {
      home: process.env.DSH_HOME,
      log: process.env.DSH_TEST_PNPM_LOG,
      path: process.env.PATH,
    }
    process.env.DSH_HOME = home
    process.env.DSH_TEST_PNPM_LOG = log
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    try {
      await expect(runPlugin('web-curated', ['install'])).rejects.toThrow(
        'web-curated existing package-manager state violates curated policy',
      )
      expect(existsSync(log)).toBe(false)
      expect(readFileSync(npmrcPath, 'utf8')).toBe(unsafeNpmrc)
    } finally {
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.log === undefined) delete process.env.DSH_TEST_PNPM_LOG
      else process.env.DSH_TEST_PNPM_LOG = previousEnvironment.log
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects curated manifest config dependencies before invoking pnpm', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-config-dependencies-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    const log = join(root, 'pnpm.log')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DSH_TEST_PNPM_LOG"\n')
    chmodSync(pnpm, 0o755)
    const profileDir = materializeCuratedProfile('web-curated', home)
    const manifestPath = join(profileDir, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
    manifest.pnpm = { configDependencies: { '@pnpm/config-plugin': '1.0.0' } }
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    const before = readCuratedProfileBytes(profileDir)
    const previousEnvironment = {
      home: process.env.DSH_HOME,
      log: process.env.DSH_TEST_PNPM_LOG,
      path: process.env.PATH,
    }
    process.env.DSH_HOME = home
    process.env.DSH_TEST_PNPM_LOG = log
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    try {
      await expect(runPlugin('web-curated', ['install'])).rejects.toThrow(
        'web-curated existing package-manager state violates curated policy',
      )
      expect(readCuratedProfileBytes(profileDir)).toEqual(before)
      expect(existsSync(log)).toBe(false)
    } finally {
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.log === undefined) delete process.env.DSH_TEST_PNPM_LOG
      else process.env.DSH_TEST_PNPM_LOG = previousEnvironment.log
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects curated mutations before pnpm while preserving list and ordinary forwarding', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-command-policy-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    const log = join(root, 'pnpm.log')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, successfulInstallScript([
      'printf "%s\\n" "$*" >> "$DSH_TEST_PNPM_LOG"',
    ]))
    chmodSync(pnpm, 0o755)
    const run = async (
      profile: string,
      args: readonly string[],
      environment: Readonly<NodeJS.ProcessEnv> = {},
    ) => execa(process.execPath, [
      '--import',
      'tsx/esm',
      sourceBin,
      'plugin',
      '--profile',
      profile,
      ...args,
    ], {
      env: {
        ...process.env,
        DSH_HOME: home,
        DSH_TEST_PNPM_LOG: log,
        PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        ...environment,
      },
      reject: false,
      timeout: 40_000,
    })
    try {
      const help = await run('web-personal', ['--help'])
      expect(help.exitCode, help.stderr).toBe(0)
      const curatedManifest = join(home, 'profiles', 'web-personal', 'package.json')
      expect(existsSync(curatedManifest)).toBe(false)

      const list = await run('web-personal', ['list'])
      expect(list.exitCode, list.stderr).toBe(0)
      expect(existsSync(curatedManifest)).toBe(false)
      expect(existsSync(log)).toBe(false)
      const install = await run('web-personal', ['install'])
      expect(install.exitCode, install.stderr).toBe(0)
      expect(readFileSync(log, 'utf8')).toContain('--config.ignore-scripts=true --offline install')
      const lockedInstall = await run('web-personal', ['install'])
      expect(lockedInstall.exitCode, lockedInstall.stderr).toBe(0)
      expect(readFileSync(log, 'utf8')).toContain(
        '--config.ignore-scripts=true --offline --frozen-lockfile install',
      )
      for (const argument of [
        '--ignore-scripts',
        '--ignore-scripts=true',
        '--config.ignore-scripts=true',
      ]) {
        const safeOverride = await run('ordinary-profile', ['list', argument])
        expect(safeOverride.exitCode, argument).toBe(0)
        expect(readFileSync(log, 'utf8'), argument).toContain(
          `--config.ignore-scripts=true list ${argument}`,
        )
      }
      const beforeUnsafeLifecycleOverrides = readFileSync(log, 'utf8')
      for (const argument of [
        '--no-ignore-scripts',
        '--ignore-scripts=false',
        '--config.ignore-scripts=false',
      ]) {
        const unsafeOverride = await run('ordinary-profile', ['list', argument])
        expect(unsafeOverride.exitCode, argument).toBe(2)
        expect(unsafeOverride.stderr, argument).toContain(
          'dependency lifecycle scripts cannot be enabled',
        )
        expect(readFileSync(log, 'utf8'), argument).toBe(beforeUnsafeLifecycleOverrides)
      }
      const beforeManifest = readFileSync(curatedManifest)
      const beforeLog = readFileSync(log, 'utf8')
      for (const args of [
        ['add', 'plugin-a'],
        ['remove', '@deepseek-ai/dsh-base'],
        ['install', '--offline'],
        ['install', '--ignore-scripts=true'],
      ]) {
        const result = await run('web-personal', args)
        expect(result.exitCode, args.join(' ')).toBe(2)
        expect(result.stderr).toContain(
          args[0] === 'install'
            ? 'curated profile install accepts no additional arguments'
            : 'curated profile bundle list is fixed',
        )
        expect(readFileSync(curatedManifest), args.join(' ')).toEqual(beforeManifest)
        expect(readFileSync(log, 'utf8'), args.join(' ')).toBe(beforeLog)
      }
      const ordinary = await run('ordinary-profile', ['pkg', 'set', 'pnpm.overrides.x=y'])
      expect(ordinary.exitCode, ordinary.stderr).toBe(0)
      expect(readFileSync(log, 'utf8')).toContain(
        '--config.ignore-scripts=true pkg set pnpm.overrides.x=y',
      )

      const beforeEnvironmentTransform = readFileSync(log, 'utf8')
      for (const environment of [
        { npm_config_pnpmfile: join(root, 'host-pnpmfile.cjs') },
        { NPM_CONFIG_PACKAGE_EXTENSIONS: '{}' },
        { pnpm_config_allowBuilds: 'plugin-a' },
      ]) {
        const environmentTransform = await run('web-personal', ['install'], environment)
        expect(environmentTransform.exitCode, JSON.stringify(environment)).toBe(2)
        expect(environmentTransform.stderr).toContain(
          'package transformations and dependency build grants cannot be enabled',
        )
        expect(readFileSync(log, 'utf8')).toBe(beforeEnvironmentTransform)
      }

      const workspaceRedirect = await run('web-personal', ['install'], {
        npm_config_workspace_dir: join(root, 'outside-workspace'),
      })
      expect(workspaceRedirect.exitCode).toBe(2)
      expect(workspaceRedirect.stderr).toContain(
        'curated profile installation root cannot be redirected through package-manager config',
      )
      expect(readFileSync(log, 'utf8')).toBe(beforeEnvironmentTransform)
      expect(existsSync(join(root, 'outside-workspace', 'pnpm-lock.yaml'))).toBe(false)

      for (const args of [
        ['pkg', 'set', 'pnpm.overrides.x=y'],
        ['config', 'set', 'pnpm.overrides.x', '1'],
        ['patch', 'plugin-a'],
        ['add', '--config.overrides.x=1', 'plugin-a'],
        ['add', '--config.pnpm.overrides.x=1', 'plugin-a'],
        ['add', '--config.patchedDependencies.x=patches/plugin-a.patch', 'plugin-a'],
        ['add', '--config.packageExtensions.x.dependencies.injected=1.0.0', 'plugin-a'],
        ['add', '--config.pnpmfile=custom-pnpmfile.cjs', 'plugin-a'],
        ['add', '--allow-build=plugin-a', 'plugin-a'],
        ['add', '--config.allowBuilds.plugin-a=true', 'plugin-a'],
        ['add', '--config.dangerouslyAllowAllBuilds=true', 'plugin-a'],
        ['add', '--config.onlyBuiltDependencies=plugin-a', 'plugin-a'],
        ['add', '--config.ignore-scripts=false', 'plugin-a'],
      ]) {
        const before = readFileSync(log, 'utf8')
        const result = await run('web-personal', args)
        expect(result.exitCode, args.join(' ')).toBe(2)
        expect(readFileSync(log, 'utf8'), args.join(' ')).toBe(before)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)

  it('enforces curated command policy in process before invoking pnpm', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-command-policy-unit-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    const log = join(root, 'pnpm.log')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$DSH_TEST_PNPM_LOG"\n')
    chmodSync(pnpm, 0o755)
    const previousEnvironment = {
      home: process.env.DSH_HOME,
      log: process.env.DSH_TEST_PNPM_LOG,
      path: process.env.PATH,
      redirect: process.env.npm_config_workspace_dir,
      transform: process.env.pnpm_config_allowBuilds,
    }
    process.env.DSH_HOME = home
    process.env.DSH_TEST_PNPM_LOG = log
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      for (const args of [
        ['--no-ignore-scripts'],
        ['--ignore-scripts=false'],
        ['add', 'plugin-a'],
        ['remove', 'plugin-a'],
        ['install', '--offline'],
        ['unknown'],
        [],
      ]) {
        expect(await runPlugin('web-personal', args), args.join(' ')).toBe(2)
      }
      process.env.npm_config_workspace_dir = join(root, 'outside')
      expect(await runPlugin('web-personal', ['install'])).toBe(2)
      delete process.env.npm_config_workspace_dir
      process.env.pnpm_config_allowBuilds = 'plugin-a'
      expect(await runPlugin('web-personal', ['install'])).toBe(2)
      delete process.env.pnpm_config_allowBuilds
      expect(await runPlugin('web-personal', ['--config.overrides.x=1'])).toBe(2)
      expect(existsSync(log)).toBe(false)
      expect(stderr).toHaveBeenCalled()
    } finally {
      stderr.mockRestore()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.log === undefined) delete process.env.DSH_TEST_PNPM_LOG
      else process.env.DSH_TEST_PNPM_LOG = previousEnvironment.log
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      if (previousEnvironment.redirect === undefined) delete process.env.npm_config_workspace_dir
      else process.env.npm_config_workspace_dir = previousEnvironment.redirect
      if (previousEnvironment.transform === undefined) delete process.env.pnpm_config_allowBuilds
      else process.env.pnpm_config_allowBuilds = previousEnvironment.transform
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('forwards ordinary profile commands and reconciles installed bundle declarations', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-forward-unit-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    const profileDir = resolveProfileDir('ordinary-profile', home)
    const nextManifest = join(root, 'next-package.json')
    const log = join(root, 'pnpm.log')
    mkdirSync(binDir, { recursive: true })
    initProfile(profileDir, ['@deepseek-ai/dsh-base', 'existing-bundle', 'removed-bundle', 'changed-to-plain'])
    const before = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) as Record<string, unknown>
    before.dependencies = {
      '@deepseek-ai/dsh-base': '0.1.1-rc.2',
      'existing-bundle': '1.0.0',
      'removed-bundle': '1.0.0',
      'changed-to-plain': '1.0.0',
    }
    writeFileSync(join(profileDir, 'package.json'), `${JSON.stringify(before, null, 2)}\n`)
    const after = {
      ...before,
      dependencies: {
        'existing-bundle': '1.0.0',
        'changed-to-plain': '2.0.0',
        'new-bundle': '1.0.0',
        'new-plain': '1.0.0',
        missing: '1.0.0',
      },
    }
    writeFileSync(nextManifest, `${JSON.stringify(after, null, 2)}\n`)
    for (const [name, bundle] of [
      ['existing-bundle', true],
      ['changed-to-plain', false],
      ['new-bundle', true],
      ['new-plain', false],
    ] as const) {
      const packageDir = join(profileDir, 'node_modules', name)
      mkdirSync(packageDir, { recursive: true })
      writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify({
        name,
        version: '1.0.0',
        ...bundle ? { dsh: { bundle: { patch: './cordis.patch.yml' } } } : {},
      })}\n`)
      if (bundle) writeFileSync(join(packageDir, 'cordis.patch.yml'), '[]\n')
    }
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, [
      '#!/bin/sh',
      'printf "%s\\n" "$*" >> "$DSH_TEST_PNPM_LOG"',
      'cp "$DSH_TEST_NEXT_MANIFEST" package.json',
      'exit "${DSH_TEST_PNPM_STATUS:-0}"',
      '',
    ].join('\n'))
    chmodSync(pnpm, 0o755)
    const previousEnvironment = {
      home: process.env.DSH_HOME,
      log: process.env.DSH_TEST_PNPM_LOG,
      nextManifest: process.env.DSH_TEST_NEXT_MANIFEST,
      path: process.env.PATH,
      status: process.env.DSH_TEST_PNPM_STATUS,
    }
    process.env.DSH_HOME = home
    process.env.DSH_TEST_PNPM_LOG = log
    process.env.DSH_TEST_NEXT_MANIFEST = nextManifest
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      const relativePlugin = './relative-plugin'
      expect(await runPlugin('ordinary-profile', ['add', relativePlugin])).toBe(0)
      const manifest = JSON.parse(
        readFileSync(join(profileDir, 'package.json'), 'utf8'),
      ) as { dsh: { profile: { bundles: string[] } } }
      expect(manifest.dsh.profile.bundles).toEqual([
        '@deepseek-ai/dsh-base',
        'existing-bundle',
        'new-bundle',
      ])
      expect(readFileSync(log, 'utf8')).toContain(
        `--config.ignore-scripts=true add ${resolve(relativePlugin)}`,
      )
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('new-plain declares no dsh.bundle'))
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('missing declares no dsh.bundle'))

      writeFileSync(nextManifest, readFileSync(join(profileDir, 'package.json')))
      expect(await runPlugin('ordinary-profile', ['list'])).toBe(0)
      process.env.DSH_TEST_PNPM_STATUS = '9'
      expect(await runPlugin('ordinary-profile', ['list'])).toBe(9)
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('pnpm failed in profile directory'))

      delete process.env.DSH_TEST_PNPM_STATUS
      expect(await runPlugin('new-profile', ['list'])).toBe(0)
      expect(existsSync(join(resolveProfileDir('new-profile', home), 'package.json'))).toBe(true)

      const sparseDir = resolveProfileDir('sparse-profile', home)
      mkdirSync(sparseDir, { recursive: true })
      const sparseManifest = `${JSON.stringify({ name: 'dsh-profile-sparse-profile', private: true })}\n`
      writeFileSync(join(sparseDir, 'package.json'), sparseManifest)
      writeFileSync(nextManifest, sparseManifest)
      expect(await runPlugin('sparse-profile', ['list'])).toBe(0)
    } finally {
      stderr.mockRestore()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.log === undefined) delete process.env.DSH_TEST_PNPM_LOG
      else process.env.DSH_TEST_PNPM_LOG = previousEnvironment.log
      if (previousEnvironment.nextManifest === undefined) delete process.env.DSH_TEST_NEXT_MANIFEST
      else process.env.DSH_TEST_NEXT_MANIFEST = previousEnvironment.nextManifest
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      if (previousEnvironment.status === undefined) delete process.env.DSH_TEST_PNPM_STATUS
      else process.env.DSH_TEST_PNPM_STATUS = previousEnvironment.status
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('uses only own template entries when initializing ordinary profiles', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-property-name-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, '#!/bin/sh\nexit 0\n')
    chmodSync(pnpm, 0o755)
    const previousEnvironment = {
      home: process.env.DSH_HOME,
      path: process.env.PATH,
    }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      for (const [profile, expectedBundles] of [
        ['web', PROFILE_TEMPLATES.web],
        ['toString', DEFAULT_PROFILE_BUNDLES],
        ['constructor', DEFAULT_PROFILE_BUNDLES],
        ['__proto__', DEFAULT_PROFILE_BUNDLES],
      ] as const) {
        expect(await runPlugin(profile, ['list']), profile).toBe(0)
        const manifest = JSON.parse(
          readFileSync(join(resolveProfileDir(profile, home), 'package.json'), 'utf8'),
        ) as { dsh: { profile: { bundles: string[] } } }
        expect(manifest.dsh.profile.bundles, profile).toEqual(expectedBundles)
      }
    } finally {
      stderr.mockRestore()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('materializes the installed lock when pnpm omits it for an empty curated profile', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-empty-installed-lock-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, [
      '#!/bin/sh',
      'printf "%s\\n" "lockfileVersion: \'9.0\'" "" "importers:" "  .: {}" > pnpm-lock.yaml',
      '',
    ].join('\n'))
    chmodSync(pnpm, 0o755)
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
    try {
      expect(await runPlugin('web-curated', ['install'])).toBe(0)
      const profileDir = join(home, 'profiles', 'web-curated')
      expect(readFileSync(join(profileDir, 'node_modules/.pnpm/lock.yaml'))).toEqual(
        readFileSync(join(profileDir, 'pnpm-lock.yaml')),
      )
    } finally {
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each(['parent-identity', 'escaped-child'] as const)(
    'rejects a %s race while materializing an empty installed lock',
    async (race) => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-empty-installed-lock-race-'))
      const home = join(root, 'home')
      const binDir = join(root, 'bin')
      const outside = join(root, 'outside')
      mkdirSync(binDir, { recursive: true })
      mkdirSync(outside)
      const pnpm = join(binDir, 'pnpm')
      writeFileSync(pnpm, [
        '#!/bin/sh',
        'printf "%s\\n" "lockfileVersion: \'9.0\'" "" "importers:" "  .: {}" > pnpm-lock.yaml',
        '',
      ].join('\n'))
      chmodSync(pnpm, 0o755)
      const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
      process.env.DSH_HOME = home
      process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
      let stageDir: string | undefined
      vi.resetModules()
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
        const mockedRealpath = ((...args: Parameters<typeof actual.realpathSync>) =>
          actual.realpathSync(...args)) as typeof actual.realpathSync
        Object.defineProperty(mockedRealpath, 'native', {
          value: (...args: Parameters<typeof actual.realpathSync.native>) => {
            if (
              race === 'escaped-child'
              && stageDir !== undefined
              && String(args[0]) === join(stageDir, 'node_modules')
            ) {
              return outside
            }
            return actual.realpathSync.native(...args)
          },
        })
        return {
          ...actual,
          lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
            const identity = actual.lstatSync(...args)
            if (
              race === 'parent-identity'
              && stageDir !== undefined
              && String(args[0]) === stageDir
              && actual.existsSync(join(stageDir, 'node_modules'))
            ) {
              Object.defineProperty(identity, 'ino', {
                value: (identity as ReturnType<typeof actual.lstatSync> & { ino: bigint }).ino + 1n,
              })
            }
            return identity
          }) as typeof actual.lstatSync,
          mkdirSync: ((...args: Parameters<typeof actual.mkdirSync>) => {
            const result = actual.mkdirSync(...args)
            const path = String(args[0])
            if (
              path.endsWith(`${sep}node_modules`)
              && path.includes(`${join(home, '.curated-install-staging')}${sep}`)
            ) {
              stageDir = resolve(path, '..')
            }
            return result
          }),
          realpathSync: mockedRealpath,
        }
      })
      try {
        const { runPlugin: runRacedPlugin } = await import('../src/plugin.ts')

        await expect(runRacedPlugin('web-curated', ['install'])).rejects.toThrow(
          race === 'parent-identity'
            ? 'curated installed lock node_modules parent changed'
            : 'curated installed lock node_modules resolves outside its parent',
        )
        expect(existsSync(join(outside, 'lock.yaml'))).toBe(false)
      } finally {
        vi.doUnmock('node:fs')
        vi.resetModules()
        if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
        else process.env.DSH_HOME = previousEnvironment.home
        if (previousEnvironment.path === undefined) delete process.env.PATH
        else process.env.PATH = previousEnvironment.path
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it.each(['node_modules', '.pnpm'] as const)(
    'does not materialize an empty installed lock through a linked %s directory',
    async (linkedParent) => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-empty-installed-lock-link-'))
      const home = join(root, 'home')
      const binDir = join(root, 'bin')
      const outside = join(root, 'outside')
      mkdirSync(binDir, { recursive: true })
      mkdirSync(outside)
      const pnpm = join(binDir, 'pnpm')
      writeFileSync(pnpm, [
        '#!/bin/sh',
        'printf "%s\\n" "lockfileVersion: \'9.0\'" "" "importers:" "  .: {}" > pnpm-lock.yaml',
        linkedParent === 'node_modules'
          ? 'ln -s "$DSH_TEST_OUTSIDE" node_modules'
          : 'mkdir node_modules && ln -s "$DSH_TEST_OUTSIDE" node_modules/.pnpm',
        '',
      ].join('\n'))
      chmodSync(pnpm, 0o755)
      const previousEnvironment = {
        home: process.env.DSH_HOME,
        outside: process.env.DSH_TEST_OUTSIDE,
        path: process.env.PATH,
      }
      process.env.DSH_HOME = home
      process.env.DSH_TEST_OUTSIDE = outside
      process.env.PATH = `${binDir}${delimiter}${process.env.PATH ?? ''}`
      try {
        await expect(runPlugin('web-curated', ['install'])).rejects.toThrow()
        expect(existsSync(join(outside, 'lock.yaml'))).toBe(false)
      } finally {
        if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
        else process.env.DSH_HOME = previousEnvironment.home
        if (previousEnvironment.outside === undefined) delete process.env.DSH_TEST_OUTSIDE
        else process.env.DSH_TEST_OUTSIDE = previousEnvironment.outside
        if (previousEnvironment.path === undefined) delete process.env.PATH
        else process.env.PATH = previousEnvironment.path
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it('reports missing and inaccessible pnpm executables for ordinary profiles', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-spawn-errors-'))
    const home = join(root, 'home')
    const binDir = join(root, 'bin')
    mkdirSync(binDir, { recursive: true })
    const previousEnvironment = { home: process.env.DSH_HOME, path: process.env.PATH }
    process.env.DSH_HOME = home
    process.env.PATH = binDir
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    try {
      expect(await runPlugin('missing-pnpm', ['list'])).toBe(127)
      expect(stderr).toHaveBeenCalledWith(expect.stringContaining('pnpm not found on PATH'))

      writeFileSync(join(binDir, 'pnpm'), '#!/bin/sh\nexit 0\n')
      await expect(runPlugin('inaccessible-pnpm', ['list'])).rejects.toThrow('EACCES')

      writeFileSync(join(binDir, 'pnpm'), '#!/bin/sh\nkill -TERM $$\n')
      chmodSync(join(binDir, 'pnpm'), 0o755)
      expect(await runPlugin('signaled-pnpm', ['list'])).toBe(1)
    } finally {
      stderr.mockRestore()
      if (previousEnvironment.home === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousEnvironment.home
      if (previousEnvironment.path === undefined) delete process.env.PATH
      else process.env.PATH = previousEnvironment.path
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('prevents an old pnpm from running a dependency postinstall', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-plugin-ignore-scripts-'))
    const home = join(root, 'home')
    const packageDir = join(root, 'compromised-plugin')
    const packDir = join(root, 'pack')
    const binDir = join(root, 'bin')
    const marker = join(root, 'postinstall-ran')
    mkdirSync(packageDir, { recursive: true })
    mkdirSync(packDir, { recursive: true })
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify({
      name: 'compromised-plugin',
      version: '1.0.0',
      type: 'module',
      scripts: { postinstall: 'node postinstall.cjs' },
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    }, null, 2)}\n`)
    writeFileSync(join(packageDir, 'postinstall.cjs'), [
      "const { writeFileSync } = require('node:fs')",
      "writeFileSync(process.env.DSH_TEST_POSTINSTALL_MARKER, 'ran')",
      '',
    ].join('\n'))
    writeFileSync(join(packageDir, 'cordis.patch.yml'), '[]\n')
    const packed = execaSync('npm', ['pack', '--ignore-scripts', '--pack-destination', packDir], {
      cwd: packageDir,
      reject: false,
    })
    expect(packed.exitCode, packed.stderr).toBe(0)
    const tarball = join(packDir, readdirSync(packDir).find(file => file.endsWith('.tgz')) ?? '')
    const pnpm = join(binDir, 'pnpm')
    writeFileSync(pnpm, '#!/bin/sh\nexec corepack pnpm@9.15.9 "$@"\n')
    chmodSync(pnpm, 0o755)

    try {
      const override = await execa(process.execPath, [
        '--import',
        'tsx/esm',
        sourceBin,
        'plugin',
        '--profile',
        'script-safe',
        'add',
        '--workspace-root',
        '--config.ignore-scripts=false',
        tarball,
      ], {
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_TEST_POSTINSTALL_MARKER: marker,
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
        reject: false,
        timeout: 40_000,
      })
      expect(override.exitCode).toBe(2)
      expect(override.stderr).toContain('dependency lifecycle scripts cannot be enabled')
      expect(existsSync(marker)).toBe(false)

      const result = await execa(process.execPath, [
        '--import',
        'tsx/esm',
        sourceBin,
        'plugin',
        '--profile',
        'script-safe',
        'add',
        '--workspace-root',
        tarball,
      ], {
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_TEST_POSTINSTALL_MARKER: marker,
          PATH: `${binDir}${delimiter}${process.env.PATH ?? ''}`,
        },
        reject: false,
        timeout: 40_000,
      })

      expect(result.exitCode, `${result.stdout}\n${result.stderr}`).toBe(0)
      expect(existsSync(marker)).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }, 45_000)
})

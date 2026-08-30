import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { materializeCuratedProfile } from '@deepseek-ai/dsh-curated-profiles'
import { execa, execaSync } from 'execa'
import { describe, expect, it } from 'vitest'
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
    writeFileSync(join(lockDir, 'owner.json'), `${JSON.stringify({ pid: 2_147_483_647, token: 'stale' })}\n`)
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

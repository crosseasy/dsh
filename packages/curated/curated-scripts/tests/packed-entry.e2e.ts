import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const builtPackageEntry = join(packageRoot, 'lib/index.js')
const require = createRequire(import.meta.url)

interface FakeDshInvocation {
  readonly entry: string
  readonly argv: readonly string[]
}

const runtimePackages = {
  '@deepseek-ai/cordis': join(repoRoot, 'vendor/cordis'),
  '@deepseek-ai/cordis-plugin-include': join(repoRoot, 'vendor/include'),
  '@deepseek-ai/dsh-app-boot': join(repoRoot, 'packages/boot/app-boot'),
  '@deepseek-ai/dsh-curated-base': join(repoRoot, 'packages/curated/curated-base'),
  '@deepseek-ai/dsh-curated-bench': join(repoRoot, 'packages/curated/curated-bench'),
  '@deepseek-ai/dsh-curated-policy': join(repoRoot, 'packages/curated/curated-policy'),
  '@deepseek-ai/dsh-curated-profiles': join(repoRoot, 'packages/curated/curated-profiles'),
  '@deepseek-ai/dsh-invariants': join(repoRoot, 'packages/runtime-diagnostics/invariants'),
  '@deepseek-ai/dsh-subprocess': join(repoRoot, 'packages/subprocess/subprocess'),
  'js-yaml': dirname(require.resolve('js-yaml/package.json')),
} as const

function stageBundlePackage(
  ownerRoot: string,
  packageName: string,
  patch: string,
): void {
  const packageDir = join(ownerRoot, 'node_modules', ...packageName.split('/'))
  mkdirSync(packageDir, { recursive: true })
  writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify({
    name: packageName,
    version: '0.0.0-test',
    type: 'module',
    main: 'plugin.js',
    dsh: { bundle: { patch: './cordis.patch.yml' } },
  }, null, 2)}\n`)
  writeFileSync(join(packageDir, 'cordis.patch.yml'), patch)
  writeFileSync(join(packageDir, 'plugin.js'), 'export function apply() {}\n')
}

function stageFakeDshPackage(consumerRoot: string): void {
  const packageDir = join(consumerRoot, 'node_modules/@deepseek-ai/dsh')
  mkdirSync(packageDir, { recursive: true })
  writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify({
    name: '@deepseek-ai/dsh',
    version: '0.0.0-test',
    type: 'module',
    bin: { dsh: 'bin.js' },
  }, null, 2)}\n`)
  const bin = join(packageDir, 'bin.js')
  writeFileSync(bin, [
    "import { writeFileSync } from 'node:fs'",
    "import { join } from 'node:path'",
    "import { fileURLToPath } from 'node:url'",
    'const home = process.env.DSH_HOME',
    'if (home === undefined) throw new Error(\'DSH_HOME is required\')',
    "writeFileSync(join(home, `fake-dsh-invocation-${process.argv.at(-1) === '--help' ? 'help' : 'dump'}.json`), JSON.stringify({",
    '  entry: fileURLToPath(import.meta.url),',
    '  argv: process.argv.slice(2),',
    '}))',
    'process.stdout.write(\'fake dsh ok\\n\')',
    '',
  ].join('\n'))
  stageBundlePackage(packageDir, '@deepseek-ai/dsh-base', `- insert:
    - id: installation-base-a
      name: ./plugin.js
    - id: installation-base-b
      name: ./plugin.js
`)
  stageBundlePackage(packageDir, '@deepseek-ai/dsh-web-app', `- insert:
    - id: installation-web-app
      name: ./plugin.js
`)
}

describe.skipIf(!existsSync(builtPackageEntry))(
  'curated-scripts packed smoke entry',
  () => {
    it('installs the tarball and executes all four bins through their distinct entries', () => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-curated-packed-entry-'))
      const packDir = join(root, 'pack')
      const consumerRoot = join(root, 'consumer')
      const fakeDshOwner = join(root, 'fake-dsh-owner')
      const installedPackage = join(consumerRoot, 'node_modules/@deepseek-ai/dsh-curated-scripts')
      const installedDshPackage = join(consumerRoot, 'node_modules/@deepseek-ai/dsh')
      const home = join(root, 'home')
      const profileRoot = join(home, 'profiles/web')
      mkdirSync(packDir, { recursive: true })
      mkdirSync(consumerRoot, { recursive: true })
      mkdirSync(profileRoot, { recursive: true })
      try {
        const pack = spawnSync('pnpm', ['pack', '--pack-destination', packDir], {
          cwd: packageRoot,
          encoding: 'utf8',
          timeout: 20_000,
        })
        expect(pack.status, `pnpm pack failed:\n${pack.stdout}\n${pack.stderr}`).toBe(0)
        const tarball = join(packDir, readdirSync(packDir).find(file => file.endsWith('.tgz')) ?? '')
        stageFakeDshPackage(fakeDshOwner)
        symlinkSync(
          runtimePackages['@deepseek-ai/dsh-curated-base'],
          join(fakeDshOwner, 'node_modules/@deepseek-ai/dsh-curated-base'),
          'junction',
        )
        const dependencyLinks = {
          '@deepseek-ai/dsh': `link:${join(fakeDshOwner, 'node_modules/@deepseek-ai/dsh')}`,
          ...Object.fromEntries(Object.entries(runtimePackages)
            .map(([name, target]) => [name, `link:${target}`])),
        }
        writeFileSync(join(consumerRoot, 'package.json'), `${JSON.stringify({
          name: 'curated-scripts-external-consumer',
          private: true,
          dependencies: {
            '@deepseek-ai/dsh-curated-scripts': `file:${tarball}`,
            ...dependencyLinks,
          },
        }, null, 2)}\n`)
        writeFileSync(join(consumerRoot, 'pnpm-workspace.yaml'), [
          'packages:',
          '  - .',
          'overrides:',
          ...Object.entries(dependencyLinks).map(([name, target]) =>
            `  ${JSON.stringify(name)}: ${JSON.stringify(target)}`),
          '',
        ].join('\n'))
        const install = spawnSync('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile'], {
          cwd: consumerRoot,
          encoding: 'utf8',
          timeout: 20_000,
        })
        expect(install.status, `pnpm install failed:\n${install.stdout}\n${install.stderr}`).toBe(0)
        expect(lstatSync(installedDshPackage).isSymbolicLink()).toBe(true)
        expect(realpathSync(installedDshPackage).startsWith(`${realpathSync(root)}${sep}`)).toBe(true)
        writeFileSync(join(profileRoot, 'package.json'), `${JSON.stringify({
          name: 'dsh-profile-web',
          private: true,
          dsh: {
            profile: {
              bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
            },
          },
        }, null, 2)}\n`)
        writeFileSync(join(profileRoot, 'cordis.patch.yml'), `- id: installation-base-a
  config:
    source: profile
`)
        stageBundlePackage(profileRoot, '@deepseek-ai/dsh-base', `- insert:
    - id: profile-local-shadow
      name: ./malicious.js
      config:
        payload: !!js process.env.DSH_PROFILE_LOCAL_SHADOW
`)

        const packedManifest = JSON.parse(
          readFileSync(join(installedPackage, 'package.json'), 'utf8'),
        ) as { bin?: Record<string, string>; dependencies?: Record<string, string> }
        const packedSource = readFileSync(join(installedPackage, 'lib/index.js'), 'utf8')
        const fixture = join(root, 'preflight.yml')
        const misplacedProfileRoot = join(home, 'other', 'web')
        cpSync(profileRoot, misplacedProfileRoot, { recursive: true })
        writeFileSync(fixture, '[]\n')
        const invoke = (name: string, args: readonly string[]) => spawnSync(
          join(consumerRoot, 'node_modules/.bin', name),
          args,
          {
            cwd: consumerRoot,
            encoding: 'utf8',
            timeout: 20_000,
          },
        )
        const invocations = {
          verify: invoke('dsh-curated-verify-lock', ['--json']),
          preflight: invoke('dsh-curated-preflight', ['--fixture', fixture, '--json']),
          smoke: invoke('dsh-curated-smoke-profile', [
            '--profile',
            'web',
            '--profile-root',
            profileRoot,
            '--json',
          ]),
          misplacedSmoke: invoke('dsh-curated-smoke-profile', [
            '--profile',
            'web',
            '--profile-root',
            misplacedProfileRoot,
            '--json',
          ]),
          compare: invoke('dsh-curated-compare-benchmark', ['--json']),
        }

        expect(new Set(Object.values(packedManifest.bin ?? {})).size).toBe(4)
        for (const wrapper of [
          'verify-lock.mjs',
          'preflight.mjs',
          'smoke-profile.mjs',
          'compare-benchmark.mjs',
        ]) {
          expect(existsSync(join(installedPackage, wrapper)), wrapper).toBe(false)
        }
        expect(
          invocations.verify.status,
          `verify-lock failed:\n${invocations.verify.stdout}\n${invocations.verify.stderr}`,
        ).toBe(0)
        expect(JSON.parse(invocations.verify.stdout)).toMatchObject({
          command: 'verify-lock',
          ok: true,
        })
        expect(invocations.preflight.status, invocations.preflight.stderr).toBe(0)
        expect(JSON.parse(invocations.preflight.stdout)).toMatchObject({
          command: 'preflight',
          accepted: false,
          issues: [],
        })
        expect(
          invocations.smoke.status,
          `smoke-profile failed:\n${invocations.smoke.stdout}\n${invocations.smoke.stderr}`,
        ).toBe(0)
        expect(JSON.parse(invocations.smoke.stdout)).toMatchObject({
          command: 'smoke-profile',
          ok: true,
          observed: true,
          stages: [
            { name: 'staging', ok: true },
            { name: 'manifest', ok: true },
            { name: 'bundle-parse', ok: true },
            { name: 'dump-config', ok: true, status: 0 },
            { name: 'help', ok: true, status: 0 },
          ],
        })
        expect(invocations.misplacedSmoke.status).toBe(1)
        expect(JSON.parse(invocations.misplacedSmoke.stdout)).toMatchObject({
          command: 'smoke-profile',
          observed: true,
          issues: [expect.objectContaining({
            message: 'production observed smoke profile root must be $DSH_HOME/profiles/web',
          })],
        })
        expect(invocations.compare.status).toBe(1)
        expect(JSON.parse(invocations.compare.stdout)).toMatchObject({
          command: 'compare-benchmark',
          evidenceKind: 'planned',
          status: 'pending',
        })
        expect(packedManifest.dependencies).toHaveProperty('@deepseek-ai/dsh')
        expect(packedManifest.dependencies).not.toHaveProperty('tsx')
        expect(packedSource).not.toContain('apps/cli/src/bin.ts')
        expect(packedSource).not.toContain('tsx/esm')
        expect(readFileSync(join(home, 'fake-dsh-invocations.jsonl'), 'utf8')
          .trim()
          .split('\n')
          .map(line => JSON.parse(line) as FakeDshInvocation)).toEqual([
          {
            entry: realpathSync(join(installedDshPackage, 'bin.js')),
            argv: ['--profile', 'web', '--dump-config'],
          },
          {
            entry: realpathSync(join(installedDshPackage, 'bin.js')),
            argv: ['--profile', 'web', '--help'],
          },
        ])
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }, 50_000)
  },
)

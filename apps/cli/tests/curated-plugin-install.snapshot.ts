/** Assembled keyless snapshots for fixed curated profile installation. */

import {
  chmodSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveExampleLaunch } from '@deepseek-ai/dsh-loader-smoke'
import { execa } from 'execa'
import { afterEach, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const sourceBin = join(repoRoot, 'apps/cli/src/bin.ts')
const builtBin = join(repoRoot, 'apps/cli/lib/bin.js')
const tsconfigPath = join(repoRoot, 'tsconfig.json')
const tempRoots: string[] = []
const runnable = process.platform !== 'win32'

if (process.env.DSH_EXAMPLE_MODE === 'lib' && !existsSync(builtBin)) {
  throw new Error('curated plugin install snapshot requires the built CLI in lib mode')
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(): {
  readonly root: string
  readonly home: string
  readonly binDir: string
  readonly invocation: string
  readonly environment: string
} {
  const root = mkdtempSync(join(tmpdir(), 'dsh-curated-install-snapshot-'))
  tempRoots.push(root)
  const home = join(root, 'home')
  const binDir = join(root, 'bin')
  const invocation = join(root, 'pnpm-invocation.txt')
  const environment = join(root, 'pnpm-environment.txt')
  mkdirSync(binDir, { recursive: true })
  const pnpm = join(binDir, 'pnpm')
  writeFileSync(pnpm, [
    '#!/bin/sh',
    'printf "%s\\n" "$*" > "$DSH_TEST_PNPM_INVOCATION"',
    'printf "%s|%s|%s|%s\\n" "$NPM_CONFIG_IGNORE_SCRIPTS" "$npm_config_ignore_scripts" "$NPM_CONFIG_USERCONFIG" "$NPM_CONFIG_GLOBALCONFIG" > "$DSH_TEST_PNPM_ENVIRONMENT"',
    'mkdir -p node_modules/.pnpm',
    'printf "%s\\n" "lockfileVersion: \'9.0\'" "" "importers:" "  .: {}" > pnpm-lock.yaml',
    'cp pnpm-lock.yaml node_modules/.pnpm/lock.yaml',
    '',
  ].join('\n'))
  chmodSync(pnpm, 0o755)
  return { root, home, binDir, invocation, environment }
}

async function run(
  state: ReturnType<typeof fixture>,
  args: readonly string[],
) {
  const launch = resolveExampleLaunch({
    srcBin: sourceBin,
    libBin: builtBin,
    tsconfigPath,
    configArgs: args,
  })
  return execa(launch.command, launch.args, {
    env: {
      ...process.env,
      ...launch.env,
      DSH_HOME: state.home,
      DSH_TEST_PNPM_ENVIRONMENT: state.environment,
      DSH_TEST_PNPM_INVOCATION: state.invocation,
      PATH: `${state.binDir}${delimiter}${process.env.PATH ?? ''}`,
    },
    reject: false,
    timeout: 30_000,
  })
}

describe.skipIf(!runnable)('curated plugin install assembled snapshot', () => {
  it('installs exactly the materialized template with lifecycle scripts disabled', async () => {
    const state = fixture()
    const result = await run(state, ['plugin', '--profile', 'web-curated', 'install'])
    const profileDir = join(state.home, 'profiles/web-curated')
    const manifest = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
      dsh?: { profile?: { bundles?: string[] } }
    }

    expect({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      pnpmInvocation: readFileSync(state.invocation, 'utf8').trim(),
      pnpmEnvironment: readFileSync(state.environment, 'utf8')
        .trim()
        .replaceAll(state.root, '{{root}}')
        .replace(/web-curated-[^/]+/gu, 'web-curated-{{stage}}'),
      bundles: manifest.dsh?.profile?.bundles,
      dependencies: manifest.dependencies,
      npmrc: readFileSync(join(profileDir, '.npmrc'), 'utf8').trim(),
    }).toMatchInlineSnapshot(`
      {
        "bundles": [
          "@deepseek-ai/dsh-base",
          "@deepseek-ai/dsh-web-app",
          "@deepseek-ai/dsh-curated-base",
        ],
        "dependencies": {},
        "exitCode": 0,
        "npmrc": "ignore-scripts=true",
        "pnpmEnvironment": "true|true|{{root}}/home/.curated-install-staging/web-curated-{{stage}}/profiles/web-curated/.npmrc|{{root}}/home/.curated-install-staging/web-curated-{{stage}}/profiles/web-curated/.npmrc",
        "pnpmInvocation": "--config.ignore-scripts=true --offline install",
        "stderr": "",
        "stdout": "",
      }
    `)
  })

  it('rejects install arguments before invoking pnpm', async () => {
    const state = fixture()
    const result = await run(state, [
      'plugin',
      '--profile',
      'web-curated',
      'install',
      '--offline',
    ])

    expect({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      pnpmInvoked: existsSync(state.invocation),
    }).toMatchInlineSnapshot(`
      {
        "exitCode": 2,
        "pnpmInvoked": false,
        "stderr": "dsh: curated profile install accepts no additional arguments",
        "stdout": "",
      }
    `)
  })
})

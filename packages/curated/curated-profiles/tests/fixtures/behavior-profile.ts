import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  boot,
  composeEntries,
  loadProfile,
  resolveProfileDir,
} from '@deepseek-ai/dsh-app-boot'
import type { Context } from '@deepseek-ai/cordis'

type CuratedFixtureFault =
  | 'success'
  | 'approval-denied'
  | 'search-timeout'
  | 'provider-429'
  | 'sqlite-lock'
  | 'permission-denied-file'
  | 'offline-network'
  | 'illegal-patch'
  | 'initialization-exception'

export interface CuratedFixtureContentBlock {
  readonly type: string
  readonly text?: string
}

interface CuratedFixtureRun {
  readonly result: {
    readonly isError: boolean
    readonly content: readonly CuratedFixtureContentBlock[]
  }
  readonly order: readonly string[]
  readonly events: readonly string[]
}

export interface CuratedBehaviorFixture {
  sideEffects(): number
  run(fault: CuratedFixtureFault): Promise<CuratedFixtureRun>
}

const repoRoot = fileURLToPath(new URL('../../../../..', import.meta.url))
const fixturePackage = fileURLToPath(new URL('./behavior-bundle', import.meta.url))
const packagePaths = {
  '@deepseek-ai/dsh-curated-base': join(repoRoot, 'packages/curated/curated-base'),
  '@deepseek-ai/dsh-curated-policy': join(repoRoot, 'packages/curated/curated-policy'),
  '@deepseek-ai/dsh-curated-bench': join(repoRoot, 'packages/curated/curated-bench'),
  '@deepseek-ai/dsh-system-prompt': join(repoRoot, 'packages/core/system-prompt'),
  '@deepseek-ai/dsh-session': join(repoRoot, 'packages/core/session'),
  '@deepseek-ai/dsh-user-approval': join(repoRoot, 'packages/interaction/user-approval'),
  '@deepseek-ai/dsh-tools': join(repoRoot, 'packages/core/tools'),
  '@deepseek-ai/dsh-curated-behavior-fixture': fixturePackage,
} as const

function linkPackage(appDir: string, packageName: string, source: string): void {
  const destination = join(appDir, 'node_modules', packageName)
  mkdirSync(dirname(destination), { recursive: true })
  symlinkSync(source, destination, 'junction')
}

export async function bootCuratedBehaviorProfile(): Promise<{
  readonly ctx: Context
  readonly entry: ReturnType<Context['loader']['resolve']>
  fixture(): CuratedBehaviorFixture
}> {
  const root = mkdtempSync(join(tmpdir(), 'dsh-curated-behavior-'))
  const appDir = join(root, 'app')
  const home = join(root, 'home')
  const profileName = 'curated-behavior'
  const bundles = [
    '@deepseek-ai/dsh-curated-base',
    '@deepseek-ai/dsh-curated-behavior-fixture',
  ]
  for (const [packageName, source] of Object.entries(packagePaths)) {
    linkPackage(appDir, packageName, source)
  }
  const installAnchor = join(appDir, 'package.json')
  writeFileSync(installAnchor, JSON.stringify({
    name: 'dsh-curated-behavior-test-app',
    private: true,
    dependencies: Object.fromEntries(Object.keys(packagePaths).map(packageName => [packageName, '0.0.0'])),
  }))

  const profileDir = resolveProfileDir(profileName, home)
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-curated-behavior',
    private: true,
    dsh: { profile: { bundles } },
  }))
  writeFileSync(join(profileDir, 'cordis.patch.yml'), '[]\n')

  const profile = loadProfile('dsh-curated-behavior-test', profileName, installAnchor, home)
  const configPath = join(profileDir, 'composed.cordis.json')
  writeFileSync(configPath, JSON.stringify(composeEntries([
    ...profile.layers.map(layer => layer.patches),
    profile.patches,
  ])))
  const ctx = await boot(
    'dsh-curated-behavior-test',
    configPath,
    undefined,
    undefined,
    pathToFileURL(installAnchor).href,
  )
  const entry = [...ctx.loader.entries()].find(candidate => candidate.options.id === 'curated-behavior-fixture')
  if (entry === undefined) {
    await ctx.fiber.dispose()
    throw new Error('curated behavior fixture Loader entry is missing')
  }
  return {
    ctx,
    entry,
    fixture() {
      const fixture = ctx.get('curatedBehaviorFixture') as CuratedBehaviorFixture | undefined
      if (fixture === undefined) throw new Error('curated behavior fixture service is unavailable')
      return fixture
    },
  }
}

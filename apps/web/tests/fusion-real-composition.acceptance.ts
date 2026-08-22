import { existsSync } from 'node:fs'
import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Fiber } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import type { ReadyProcess } from './fusion-real-process.ts'
import {
  acceptanceEnvironment,
  isServerPageTarget,
  parseSystemChromeVersion,
  runManagedCommand,
  spawnSpec,
  startManagedProcess,
  stopTree,
} from './fusion-real-process.ts'

const CDP_ENDPOINT = 'http://127.0.0.1:9333'
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const FIXTURE_ROOT = join(REPO_ROOT, 'apps/web/tests/fixtures/fusion-profile')
const FUSION_ROOT = join(REPO_ROOT, 'packages/bundle/fusion')
const BUILT_CLI = join(REPO_ROOT, 'apps/cli/lib/bin.js')
const EXPECTED_BUNDLES = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-fusion',
] as const
const EXPECTED_EXTERNAL = {} as const
const EXPECTED_ROWS: ConfigRow[] = []
const FORBIDDEN_TOKENS = [
  '@liustack/modlens',
  '@linxin666/dsh-ssh',
  '@linxin666/dsh-remote-web-ui',
  '@linxin666/dsh-client-ui-task-board',
  '@linxin666/dsh-pet',
  '@linxin666/dsh-client-ui-git-graph',
  '@linxin666/dsh-client-ui-skin-center',
  'dsh-better-sidebar',
  'modlens',
  'dsh-ssh',
  'remote-web-ui',
  'ui-task-board',
  'pet',
  'git-graph',
  'skin-center',
  'better-sidebar',
  'web-ui-all',
  'describe-image',
  'aionui-panel',
  'liangshen',
] as const

interface ConfigRow {
  id?: string
  name?: string
  disabled?: unknown
  insert?: ConfigRow[]
}

interface ManagedServer extends ReadyProcess {
  url: string
}

interface CdpTarget {
  id?: unknown
  type?: unknown
  url?: unknown
}

const jsExprType = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  construct: value => String(value),
})
const configSchema = yaml.JSON_SCHEMA.extend(jsExprType)

async function cdpVersion(): Promise<ReturnType<typeof parseSystemChromeVersion>> {
  let response: Response
  try {
    response = await fetch(`${CDP_ENDPOINT}/json/version`, {
      signal: AbortSignal.timeout(3_000),
    })
  } catch (error) {
    throw new Error('system Chrome CDP 9333 prerequisite unavailable', { cause: error })
  }
  if (!response.ok) {
    throw new Error(`system Chrome CDP 9333 prerequisite unavailable: HTTP ${String(response.status)}`)
  }
  return parseSystemChromeVersion(await response.json())
}

async function cdpTargets(): Promise<Map<string, CdpTarget>> {
  const response = await fetch(`${CDP_ENDPOINT}/json/list`, {
    signal: AbortSignal.timeout(3_000),
  })
  if (!response.ok) throw new Error(`Chrome CDP target discovery failed: HTTP ${String(response.status)}`)
  const values = await response.json() as CdpTarget[]
  return new Map(values.flatMap(value =>
    typeof value.id === 'string' ? [[value.id, value] as const] : []))
}

function flattenRows(rows: ConfigRow[]): ConfigRow[] {
  return rows.flatMap(row => row.insert === undefined ? [row] : flattenRows(row.insert))
}

function isForbidden(value: string | undefined): boolean {
  if (value === undefined) return false
  const normalized = value.toLowerCase()
  return FORBIDDEN_TOKENS.some(token =>
    token === 'pet'
      ? normalized === 'pet' || normalized.endsWith(':pet') || normalized.endsWith('/dsh-pet')
      : normalized.includes(token))
}

async function portAcceptsConnections(url: string): Promise<boolean> {
  const parsed = new URL(url)
  const port = Number(parsed.port)
  return await new Promise<boolean>((resolveConnection) => {
    const socket = connect({ host: parsed.hostname, port })
    const finish = (open: boolean): void => {
      socket.destroy()
      resolveConnection(open)
    }
    socket.setTimeout(1_000, () => { finish(false) })
    socket.once('connect', () => { finish(true) })
    socket.once('error', () => { finish(false) })
  })
}

async function unlinkPackageLink(path: string): Promise<void> {
  try {
    const stat = await lstat(path)
    if (!stat.isSymbolicLink()) throw new Error(`expected fixture package link at ${path}`)
    await unlink(path)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

async function captureFusionToolNames(
  home: string,
  agentsHome: string,
  scratchDirectory: string,
): Promise<{ port: number; toolNames: string[] }> {
  const previousHome = process.env.DSH_HOME
  const previousAgentsHome = process.env.DSH_AGENTS_HOME
  process.env.DSH_HOME = home
  process.env.DSH_AGENTS_HOME = agentsHome

  try {
    const [{ boot, loadProfile }, { provideCmdline }] = await Promise.all([
      import('@deepseek-ai/dsh-app-boot'),
      import('@deepseek-ai/dsh-cmdline'),
    ])
    const profile = loadProfile(
      'fusion acceptance tool catalog',
      'fusion',
      join(REPO_ROOT, 'apps/cli/package.json'),
      home,
    )
    const testOverlay = [
      { id: 'settings', config: { path: join(scratchDirectory, 'settings.yaml'), watch: false } },
      { id: 'storage-json', config: { root: join(scratchDirectory, 'storages') } },
      { id: 'session-persistence-jsonl', config: { root: join(scratchDirectory, 'sessions') } },
      { id: 'session-telemetry-otel', disabled: true },
      { id: 'webserver', config: { host: '127.0.0.1', port: 0 } },
      { id: 'web-runtime', disabled: true },
      { id: 'client-hmr', disabled: true },
      { id: 'modules', disabled: true },
      { id: 'connection', disabled: true },
      { id: 'directory-picker', disabled: true },
      { insert: [
        { id: 'directory-picker-browse', name: '@deepseek-ai/dsh-host-directory-picker-browse' },
      ] },
    ]
    await mkdir(scratchDirectory, { recursive: true })
    await writeFile(join(scratchDirectory, 'settings.yaml'), '{}\n')
    const context = await boot(
      'fusion acceptance tool catalog',
      join(profile.dir, 'cordis.yml'),
      structuredClone([
        ...profile.layers.flatMap(layer => layer.patches),
        ...profile.patches,
        ...testOverlay,
      ]),
      (bootContext) => {
        provideCmdline(bootContext, { args: [], exit: () => undefined })
      },
    )
    let result: { port: number; toolNames: string[] }
    try {
      result = {
        port: context.webServer.port,
        toolNames: context.tools.schemas().map(tool => tool.name),
      }
    } finally {
      await context.fiber.dispose()
    }
    return result
  } finally {
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    if (previousAgentsHome === undefined) delete process.env.DSH_AGENTS_HOME
    else process.env.DSH_AGENTS_HOME = previousAgentsHome
  }
}

it('boots the zero-row Fusion profile through the real CLI and system Chrome CDP', async () => {
  expect(
    existsSync(join(FIXTURE_ROOT, 'package.json')),
    'checked-in Fusion acceptance fixture is missing',
  ).toBe(true)
  expect(existsSync(BUILT_CLI), `missing built CLI ${BUILT_CLI}; run pnpm build`).toBe(true)

  const fixtureManifest = JSON.parse(
    await readFile(join(FIXTURE_ROOT, 'package.json'), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    dsh?: { profile?: { bundles?: string[] } }
  }
  const fusionManifest = JSON.parse(
    await readFile(join(FUSION_ROOT, 'package.json'), 'utf8'),
  ) as {
    dsh?: { bundle?: { profileDependencies?: Record<string, string> } }
  }
  const fixtureWorkspace = yaml.load(
    await readFile(join(FIXTURE_ROOT, 'pnpm-workspace.yaml'), 'utf8'),
  )
  const fusionPatch = yaml.load(
    await readFile(join(FUSION_ROOT, 'cordis.patch.yml'), 'utf8'),
    { schema: configSchema },
  ) as ConfigRow[]
  expect(fixtureManifest.dependencies).toBeUndefined()
  expect(fixtureManifest.dsh?.profile?.bundles).toEqual(EXPECTED_BUNDLES)
  expect(fixtureWorkspace).toEqual({
    packages: ['.'],
  })
  expect(fusionManifest.dsh?.bundle?.profileDependencies).toEqual(EXPECTED_EXTERNAL)
  expect(flattenRows(fusionPatch).map(({ id, name }) => ({ id, name }))).toEqual(EXPECTED_ROWS)

  await cdpVersion()
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'dsh-fusion-acceptance-'))
  const home = join(temporaryRoot, 'home')
  const agentsHome = join(temporaryRoot, 'agents')
  const workspace = join(temporaryRoot, 'workspace')
  const profile = join(home, 'profiles', 'fusion')
  const packageLink = join(profile, 'node_modules', '@deepseek-ai', 'dsh-fusion')
  const env = acceptanceEnvironment(home, agentsHome)
  const subprocessContext = new Context()
  const cleanupFailures: unknown[] = []
  let browser: Browser | undefined
  let page: Page | undefined
  let primaryFailure: unknown
  let server: ManagedServer | undefined
  let subprocessFiber: Fiber | undefined

  try {
    subprocessFiber = await subprocessContext.plugin(LocalSubprocessRuntime)
    await Promise.all([
      cp(FIXTURE_ROOT, profile, { recursive: true }),
      mkdir(agentsHome, { recursive: true }),
      mkdir(workspace, { recursive: true }),
    ])
    const install = await runManagedCommand(
      subprocessContext.subprocess,
      spawnSpec([
        'pnpm',
        '--dir',
        profile,
        'install',
        '--frozen-lockfile',
        '--prefer-offline',
      ], temporaryRoot, env),
      'pnpm install',
      180_000,
    )
    expect(install.exitCode, `profile install failed:\n${install.stderr}`).toBe(0)
    expect(install.signal).toBeNull()

    await mkdir(dirname(packageLink), { recursive: true })
    await symlink(FUSION_ROOT, packageLink, 'junction')

    const dump = await runManagedCommand(
      subprocessContext.subprocess,
      spawnSpec([
        process.execPath,
        BUILT_CLI,
        '--profile',
        'fusion',
        '--dump-config',
      ], workspace, env),
      'fusion dump-config',
      60_000,
    )
    expect(dump.exitCode, `dump-config failed:\n${dump.stderr}`).toBe(0)
    const dumpedRows = flattenRows(yaml.load(dump.stdout, { schema: configSchema }) as ConfigRow[])
    expect(dumpedRows.filter(row => isForbidden(row.id) || isForbidden(row.name))).toEqual([])
    expect(dumpedRows.filter(row =>
      row.id === 'ui-sidebar' && row.name === '@deepseek-ai/dsh-client-ui-sidebar')).toHaveLength(1)

    const toolCatalog = await captureFusionToolNames(
      home,
      agentsHome,
      join(temporaryRoot, 'tool-catalog'),
    )
    expect(toolCatalog.toolNames.filter(name => name === 'modlens_read_image')).toEqual([])
    expect(toolCatalog.toolNames.filter(name => name === 'describe_image')).toEqual([])
    expect(toolCatalog.toolNames.filter(name => name.startsWith('ssh_'))).toEqual([])
    expect(toolCatalog.toolNames.filter(name => name.startsWith('terminal_'))).toEqual([])
    expect(
      await portAcceptsConnections(`http://127.0.0.1:${String(toolCatalog.port)}`),
      `tool-catalog WebServer port remained open at ${String(toolCatalog.port)}`,
    ).toBe(false)

    const readyServer = await startManagedProcess(
      subprocessContext.subprocess,
      spawnSpec([
        process.execPath,
        BUILT_CLI,
        '--profile',
        'fusion',
        '--host',
        '127.0.0.1',
        '--port',
        '0',
      ], workspace, env),
      {
        label: 'fusion CLI',
        pattern: /dsh web: (http:\/\/127\.0\.0\.1:\d+)/u,
        timeoutMs: 120_000,
        cleanupTimeoutMs: 30_000,
      },
    )
    server = { ...readyServer, url: readyServer.ready }
    expect(
      await server.handle.waitForExit(AbortSignal.abort()),
      'fusion CLI exited after readiness',
    ).toBe(false)

    const consoleDiagnostics: string[] = []
    const httpDiagnostics: string[] = []
    const pageErrors: string[] = []
    const requestFailures: string[] = []
    const requestUrls: string[] = []
    const resourceUrls: string[] = []
    browser = await chromium.connectOverCDP(CDP_ENDPOINT)
    const context = browser.contexts()[0]
    if (context === undefined) throw new Error('system Chrome CDP connection has no default context')
    page = await context.newPage()
    await page.setViewportSize({ width: 1680, height: 1000 })

    page.on('console', (message) => {
      if (['warning', 'error', 'assert'].includes(message.type())) {
        consoleDiagnostics.push(`${message.type()}: ${message.text()}`)
      }
    })
    page.on('pageerror', error => pageErrors.push(String(error)))
    page.on('request', request => requestUrls.push(request.url()))
    page.on('requestfailed', request => requestFailures.push(
      `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown failure'}`,
    ))
    page.on('response', (response) => {
      resourceUrls.push(response.url())
      if (response.status() >= 400) {
        httpDiagnostics.push(`${String(response.status())} ${response.url()}`)
      }
    })

    await page.goto(server.url, { waitUntil: 'load', timeout: 30_000 })
    await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
    expect(await page.getByText('Failed to load plugins', { exact: false }).count()).toBe(0)
    expect(await page.locator('[data-slot-error]').count()).toBe(0)

    const boot = await page.evaluate(() => (
      window as unknown as {
        __DSH_BOOT__?: { entries?: Array<{ id?: unknown; url?: unknown }> }
      }
    ).__DSH_BOOT__)
    if (!Array.isArray(boot?.entries)) throw new Error('window.__DSH_BOOT__.entries is missing')
    const bootEntries = boot.entries
    expect(bootEntries.filter(entry =>
      typeof entry.id === 'string' && isForbidden(entry.id))).toEqual([])
    expect(bootEntries.filter(entry =>
      entry.id === '@deepseek-ai/dsh-client-ui-sidebar')).toHaveLength(1)

    const welcomeNotice = page.getByRole('dialog', {
      name: /^(Internal Testing Notice|内测声明)$/u,
    })
    await welcomeNotice.waitFor({ timeout: 10_000 })
    await welcomeNotice.getByRole('button', { name: /^(Continue|继续)$/u }).click()
    await welcomeNotice.waitFor({ state: 'detached', timeout: 10_000 })

    const settingsTrigger = page.locator('button[aria-haspopup="dialog"]')
    expect(await settingsTrigger.count()).toBe(1)
    await settingsTrigger.click()
    const settings = page.getByRole('dialog', { name: /^(Settings|设置)$/u })
    await settings.waitFor({ timeout: 10_000 })
    await settings.getByRole('button', { name: /^(Plugins|插件)$/u }).click()
    await settings.getByRole('tab', { name: /^(Plugin list|插件列表)$/u }).click()
    const inventoryKeys = await settings.locator('[data-plugin-entry]').evaluateAll(elements =>
      elements.map(element => element.getAttribute('data-plugin-entry') ?? ''))
    expect(inventoryKeys.filter(isForbidden)).toEqual([])
    await page.keyboard.press('Escape')

    const newSession = page.getByRole('button', { name: /^(New Session|新建会话)$/u }).first()
    await newSession.waitFor({ timeout: 10_000 })
    expect(await newSession.isVisible()).toBe(true)
    expect(await settingsTrigger.isVisible()).toBe(true)
    expect(await page.locator([
      '[data-dsh-ssh-entry]',
      '[data-dsh-ssh-view]',
      '[data-dsh-taskboard-entry]',
      '[data-dsh-taskboard-view]',
      '[data-dsh-pet-root]',
      '[data-pet-dock]',
      'body[data-dsh-skin-center]',
      '[data-better-sidebar]',
    ].join(', ')).count()).toBe(0)
    expect(await page.getByRole('button', {
      name: /^(Mobile remote control|移动端远程控制|Remote access|远程访问)$/u,
    }).count()).toBe(0)
    expect(resourceUrls.filter(url => isForbidden(new URL(url).pathname))).toEqual([])

    for (const path of [
      '/api/dsh-ssh/hosts',
      '/api/pet/state',
      '/api/pair/status',
    ]) {
      expect((await fetch(new URL(path, server.url))).status, `external route ${path}`).toBe(404)
    }
    for (const path of ['/git/branches', '/sidebar/api/fs.search']) {
      expect((await fetch(new URL(path, server.url), { method: 'POST' })).status, `external route ${path}`)
        .toBe(405)
    }
    for (const path of ['/modlens/config', '/modlens/paste?model=fusion-acceptance']) {
      const response = await fetch(new URL(path, server.url))
      expect(response.headers.get('content-type'), `external route ${path}`).not.toMatch(/^application\/json\b/u)
    }
    const mobilePage = await fetch(new URL('/m', server.url))
    expect(await mobilePage.text()).not.toMatch(/\/m\/mobile\.js/u)
    const mobileScript = await fetch(new URL('/m/mobile.js', server.url))
    expect(mobileScript.headers.get('content-type')).not.toMatch(/(?:java|ecma)script/iu)
    const serverUrl = new URL(server.url)
    const externalRequests = requestUrls.filter((url) => {
      if (url.startsWith('data:') || url.startsWith('blob:')) return false
      const target = new URL(url)
      return target.hostname !== serverUrl.hostname || target.port !== serverUrl.port
    })
    expect(externalRequests).toEqual([])
    expect(consoleDiagnostics).toEqual([])
    expect(pageErrors).toEqual([])
    expect(requestFailures).toEqual([])
    expect(httpDiagnostics).toEqual([])
    expect(server.getStderr()).not.toMatch(
      /Loader activation failure|unhandled rejection|uncaught exception|Failed to load plugins/iu,
    )
    expect(
      await server.handle.waitForExit(AbortSignal.abort()),
      'fusion CLI exited during browser assertions',
    ).toBe(false)
  } catch (error) {
    primaryFailure = error
  } finally {
    if (page !== undefined) {
      try {
        await page.close()
      } catch (error) {
        cleanupFailures.push(error)
      }
    }
    if (browser !== undefined) {
      try {
        await browser.close()
      } catch (error) {
        cleanupFailures.push(error)
      }
    }
    try {
      await cdpVersion()
      const remainingTargets = await cdpTargets()
      if (server !== undefined) {
        const serverUrl = server.url
        expect(
          [...remainingTargets.values()].filter(target => isServerPageTarget(target, serverUrl)),
          `Fusion acceptance page remained open at ${serverUrl}`,
        ).toEqual([])
      }
    } catch (error) {
      cleanupFailures.push(error)
    }
    if (server !== undefined) {
      try {
        const result = await stopTree(server.handle, 'fusion CLI', 30_000)
        expect(result.exitCode, `fusion CLI stderr:\n${server.getStderr()}`).toBe(0)
        expect(result.signal).toBeNull()
        expect(server.getStderr()).not.toMatch(
          /Loader activation failure|unhandled rejection|uncaught exception|Failed to load plugins/iu,
        )
        expect(await portAcceptsConnections(server.url), `server port remained open at ${server.url}`).toBe(false)
      } catch (error) {
        cleanupFailures.push(error)
      }
    }
    if (subprocessFiber !== undefined) {
      try {
        await subprocessFiber.dispose()
      } catch (error) {
        cleanupFailures.push(error)
      }
    }
    try {
      await unlinkPackageLink(packageLink)
      await rm(temporaryRoot, { recursive: true, force: true })
      expect(existsSync(temporaryRoot), `temporary root remained at ${temporaryRoot}`).toBe(false)
    } catch (error) {
      cleanupFailures.push(error)
    }
  }

  if (primaryFailure !== undefined || cleanupFailures.length > 0) {
    throw new AggregateError(
      [...primaryFailure === undefined ? [] : [primaryFailure], ...cleanupFailures],
      'Fusion REAL composition acceptance failed',
    )
  }
}, 600_000)

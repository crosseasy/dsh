import { existsSync } from 'node:fs'
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { assembleContextFor } from '@deepseek-ai/dsh-agent'
import { SessionId } from '@deepseek-ai/dsh-session'
import { renderContextSections, renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { verifyFusionExternalAuthorization } from './fusion-external-auth.ts'
import { compareOrRefreshGolden, webSnapshotMode } from './scaffold.ts'
import type { ReadyProcess } from './fusion-real-process.ts'
import {
  acceptanceEnvironment,
  assertPetOnlyRootResponse,
  assertSameHttpResponse,
  assertSameModelInput,
  FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS,
  FUSION_ACCEPTANCE_OPERATION_TIMEOUT_MS,
  FUSION_ACCEPTANCE_TIMEOUT_MS,
  isServerPageTarget,
  parseSystemChromeVersion,
  readHttpResponse,
  runAcceptanceLifecycle,
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
const CLI_PACKAGE = join(REPO_ROOT, 'apps/cli/package.json')
const SHIPPED_PRESET_DIR = join(REPO_ROOT, 'apps/cli/config/agent-presets')
const FUSION_ARIA_GOLDEN = join(REPO_ROOT, 'apps/web/tests/snapshots/fusion-profile/ui.expected.md')
const PROCESS_CLEANUP_TIMEOUT_MS = 10_000
const EXPECTED_BUNDLES = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-fusion',
] as const
const EXPECTED_EXTERNAL = {
  '@linxin666/dsh-pet': '0.2.9',
} as const
const EXPECTED_PROFILE_DEPENDENCIES = {
  ...EXPECTED_EXTERNAL,
  react: '18.3.1',
  'react-dom': '18.3.1',
} as const
const EXPECTED_ROWS: ConfigRow[] = [
  { id: 'pet', name: '@linxin666/dsh-pet' },
]
const FORBIDDEN_TOKENS = [
  '@liustack/modlens',
  '@linxin666/dsh-client-ui-git-graph',
  '@linxin666/dsh-ssh',
  '@linxin666/dsh-remote-web-ui',
  '@linxin666/dsh-client-ui-task-board',
  '@linxin666/dsh-client-ui-skin-center',
  'dsh-better-sidebar',
  'git-graph',
  'modlens',
  'dsh-ssh',
  'remote-web-ui',
  'ui-task-board',
  'skin-center',
  'better-sidebar',
  'web-ui-all',
  'describe-image',
  'aionui-panel',
  'liangshen',
] as const
const FALLBACK_PROBES = [
  '/git/branches',
  '/modlens/config',
  '/modlens/paste?model=fusion-acceptance',
  '/m',
  '/m/mobile.js',
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

async function cdpVersion(signal?: AbortSignal): Promise<ReturnType<typeof parseSystemChromeVersion>> {
  let response: Awaited<ReturnType<typeof readHttpResponse>>
  try {
    response = await readHttpResponse(new URL('/json/version', CDP_ENDPOINT), undefined, 3_000, signal)
  } catch (error) {
    throw new Error('system Chrome CDP 9333 prerequisite unavailable', { cause: error })
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`system Chrome CDP 9333 prerequisite unavailable: HTTP ${String(response.status)}`)
  }
  return parseSystemChromeVersion(JSON.parse(response.body))
}

async function cdpTargets(signal?: AbortSignal): Promise<Map<string, CdpTarget>> {
  const response = await readHttpResponse(new URL('/json/list', CDP_ENDPOINT), undefined, 3_000, signal)
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Chrome CDP target discovery failed: HTTP ${String(response.status)}`)
  }
  const values = JSON.parse(response.body) as CdpTarget[]
  return new Map(values.flatMap(value =>
    typeof value.id === 'string' ? [[value.id, value] as const] : []))
}

function flattenRows(rows: ConfigRow[]): ConfigRow[] {
  return rows.flatMap(row => row.insert === undefined ? [row] : flattenRows(row.insert))
}

function isForbidden(value: string | undefined): boolean {
  if (value === undefined) return false
  const normalized = value.toLowerCase()
  return FORBIDDEN_TOKENS.some(token => normalized.includes(token))
}

async function rpc<T>(
  baseUrl: string,
  method: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await readHttpResponse(new URL(`/api/${method}`, baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `fusion-acceptance-${method}`,
      method,
      payload,
    }),
  }, 5_000, signal)
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`${method} returned HTTP ${String(response.status)}`)
  }
  const body = JSON.parse(response.body) as {
    result: { ok: true; value: T } | { ok: false; error: { code: string; message: string } }
  }
  if (!body.result.ok) {
    throw new Error(`${method} failed: ${body.result.error.code}: ${body.result.error.message}`)
  }
  return body.result.value
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

async function captureProfileModelInput(
  profileName: 'fusion' | 'web',
  home: string,
  agentsHome: string,
  scratchDirectory: string,
  workspace: string,
  signal?: AbortSignal,
): Promise<{
  modelInput: Parameters<typeof assertSameModelInput>[0]
  port: number
}> {
  const previousHome = process.env.DSH_HOME
  const previousAgentsHome = process.env.DSH_AGENTS_HOME
  process.env.DSH_HOME = home
  process.env.DSH_AGENTS_HOME = agentsHome

  try {
    signal?.throwIfAborted()
    const [{ boot, loadProfile }, { provideCmdline }] = await Promise.all([
      import('@deepseek-ai/dsh-app-boot'),
      import('@deepseek-ai/dsh-cmdline'),
    ])
    const profile = loadProfile(
      `${profileName} acceptance model input`,
      profileName,
      join(REPO_ROOT, 'apps/cli/package.json'),
      home,
    )
    await writeFile(join(profile.dir, 'cordis.yml'), '[]\n')
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
      {
        id: 'agent-presets',
        config: {
          default: 'standard',
          roots: [{ path: SHIPPED_PRESET_DIR, trust: 'system' }],
          includeUserRoot: false,
        },
      },
      { insert: [
        { id: 'directory-picker-browse', name: '@deepseek-ai/dsh-host-directory-picker-browse' },
      ] },
    ]
    await mkdir(scratchDirectory, { recursive: true })
    await writeFile(join(scratchDirectory, 'settings.yaml'), '{}\n')
    signal?.throwIfAborted()
    const context = await boot(
      `${profileName} acceptance model input`,
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
    let result: {
      modelInput: Parameters<typeof assertSameModelInput>[0]
      port: number
    }
    try {
      signal?.throwIfAborted()
      const handle = await context.agents.create({
        sessionId: SessionId('fusion-acceptance-model-input'),
        meta: { cwd: workspace },
        agentOptions: {
          provider: 'deepseek-official',
          model: 'deepseek-v4-flash',
        },
        setup: agentContext =>
          context.agentPresets.mount(agentContext, 'standard').then(() => undefined),
      })
      try {
        signal?.throwIfAborted()
        const assembly = await context.systemPrompt.assemble(assembleContextFor(handle.agent))
        signal?.throwIfAborted()
        result = {
          port: context.webServer.port,
          modelInput: {
            system: renderPrompt(assembly),
            contexts: renderContextSections(assembly),
            tools: assembly.tools,
          },
        }
      } finally {
        await handle.dispose()
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

async function startProfileServer(
  runtime: Context['subprocess'],
  profile: 'fusion' | 'web',
  workspace: string,
  env: NodeJS.ProcessEnv,
  signal?: AbortSignal,
): Promise<ManagedServer> {
  const ready = await startManagedProcess(
    runtime,
    spawnSpec([
      process.execPath,
      BUILT_CLI,
      '--profile',
      profile,
      '--host',
      '127.0.0.1',
      '--port',
      '0',
    ], workspace, env),
    {
      label: `${profile} CLI`,
      pattern: /dsh web: (http:\/\/127\.0\.0\.1:\d+)/u,
      timeoutMs: 120_000,
      cleanupTimeoutMs: FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS,
      ...signal === undefined ? {} : { signal },
    },
  )
  return { ...ready, url: ready.ready }
}

async function captureBlockedRoutes(
  baseUrl: string,
  workspace: string,
  signal?: AbortSignal,
): Promise<{
  api: Map<string, Awaited<ReturnType<typeof readHttpResponse>>>
  fallback: Awaited<ReturnType<typeof readHttpResponse>>
}> {
  const api = new Map<string, Awaited<ReturnType<typeof readHttpResponse>>>()
  for (const path of ['/api/dsh-ssh/hosts', '/api/pair/status'] as const) {
    api.set(`GET ${path}`, await readHttpResponse(new URL(path, baseUrl), {
      method: 'GET',
      headers: { accept: 'application/json' },
    }, 5_000, signal))
  }
  api.set('POST /git/branches', await readHttpResponse(
    new URL('/git/branches', baseUrl),
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ path: workspace }),
    },
    5_000,
    signal,
  ))
  api.set('POST /sidebar/api/fs.search', await readHttpResponse(
    new URL('/sidebar/api/fs.search', baseUrl),
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: 'fusion-acceptance',
        cwd: workspace,
        query: 'package',
      }),
    },
    5_000,
    signal,
  ))
  const fallback = await readHttpResponse(new URL('/', baseUrl), { method: 'GET' }, 5_000, signal)
  for (const path of FALLBACK_PROBES) {
    assertSameHttpResponse(
      fallback,
      await readHttpResponse(new URL(path, baseUrl), { method: 'GET' }, 5_000, signal),
      `GET ${new URL(path, baseUrl).pathname}`,
    )
  }
  return { api, fallback }
}

it('boots the accepted Fusion profile through the real CLI and system Chrome CDP', async ({ signal: testSignal }) => {
  const subprocessContext = new Context()
  let baselineRoutes: Awaited<ReturnType<typeof captureBlockedRoutes>> | undefined
  let server: ManagedServer | undefined

  await runAcceptanceLifecycle({
    testSignal,
    operationTimeoutMs: FUSION_ACCEPTANCE_OPERATION_TIMEOUT_MS,
    cleanupTimeoutMs: FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS,
    operation: async (operationSignal, resources) => {
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
      expect(fixtureManifest.dependencies).toEqual(EXPECTED_PROFILE_DEPENDENCIES)
      expect(fixtureManifest.dsh?.profile?.bundles).toEqual(EXPECTED_BUNDLES)
      expect(fixtureWorkspace).toEqual({
        packages: ['.'],
        nodeLinker: 'hoisted',
        autoInstallPeers: false,
        minimumReleaseAgeExclude: [
          '@linxin666/dsh-pet@0.2.9',
        ],
      })
      expect(fusionManifest.dsh?.bundle?.profileDependencies).toEqual(EXPECTED_EXTERNAL)
      expect(flattenRows(fusionPatch).map(({ id, name }) => ({ id, name }))).toEqual(EXPECTED_ROWS)

      await cdpVersion(operationSignal)
      const temporaryRoot = await resources.acquire(
        'temporary root',
        async () => await mkdtemp(join(tmpdir(), 'dsh-fusion-acceptance-')),
        async (ownedRoot) => {
          await rm(ownedRoot, {
            recursive: true,
            force: true,
            maxRetries: 10,
            retryDelay: 100,
          })
          expect(existsSync(ownedRoot), `temporary root remained at ${ownedRoot}`).toBe(false)
        },
      )
      const home = join(temporaryRoot, 'home')
      const agentsHome = join(temporaryRoot, 'agents')
      const workspace = join(temporaryRoot, 'workspace')
      const profile = join(home, 'profiles', 'fusion')
      const env = acceptanceEnvironment(home, agentsHome)
      await resources.acquire(
        'subprocess fiber',
        async () => await subprocessContext.plugin(LocalSubprocessRuntime),
        async (fiber) => { await fiber.dispose() },
      )
      await resources.settle('profile setup', async () => {
        await Promise.all([
          cp(FIXTURE_ROOT, profile, { recursive: true }),
          mkdir(agentsHome, { recursive: true }),
          mkdir(workspace, { recursive: true }),
        ])
      })
      const canonicalWorkspace = await realpath(workspace)
      const install = await resources.settle(
        'pnpm install',
        async () => await runManagedCommand(
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
          operationSignal,
        ),
      )
      expect(install.exitCode, `profile install failed:\n${install.stderr}`).toBe(0)
      expect(install.signal).toBeNull()

      await resources.settle(
        'external authorization verification',
        async () => {
          await verifyFusionExternalAuthorization({
            installAnchor: CLI_PACKAGE,
            profile,
            signal: operationSignal,
            versions: EXPECTED_EXTERNAL,
          })
        },
      )

      await resources.acquire(
        'package link',
        async () => {
          const link = join(profile, 'node_modules', '@deepseek-ai', 'dsh-fusion')
          await mkdir(dirname(link), { recursive: true })
          await symlink(FUSION_ROOT, link, 'junction')
          return link
        },
        async (ownedLink) => { await unlinkPackageLink(ownedLink) },
      )

      const dump = await resources.settle(
        'fusion dump-config',
        async () => await runManagedCommand(
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
          operationSignal,
        ),
      )
      expect(dump.exitCode, `dump-config failed:\n${dump.stderr}`).toBe(0)
      const dumpedRows = flattenRows(yaml.load(dump.stdout, { schema: configSchema }) as ConfigRow[])
      expect(dumpedRows.filter(row => isForbidden(row.id) || isForbidden(row.name))).toEqual([])
      for (const expected of EXPECTED_ROWS) {
        expect(dumpedRows.filter(row =>
          row.id === expected.id && row.name === expected.name)).toHaveLength(1)
      }
      expect(dumpedRows.filter(row =>
        row.id === 'ui-sidebar' && row.name === '@deepseek-ai/dsh-client-ui-sidebar')).toHaveLength(1)

      const baselineModelInput = await resources.settle(
        'base + web-app model input',
        async () => await captureProfileModelInput(
          'web',
          home,
          agentsHome,
          join(temporaryRoot, 'model-input-baseline'),
          canonicalWorkspace,
          operationSignal,
        ),
      )
      const fusionModelInput = await resources.settle(
        'Fusion model input',
        async () => await captureProfileModelInput(
          'fusion',
          home,
          agentsHome,
          join(temporaryRoot, 'model-input-fusion'),
          canonicalWorkspace,
          operationSignal,
        ),
      )
      assertSameModelInput(baselineModelInput.modelInput, fusionModelInput.modelInput)
      for (const [label, port] of [
        ['base + web-app', baselineModelInput.port],
        ['Fusion', fusionModelInput.port],
      ] as const) {
        expect(
          await portAcceptsConnections(`http://127.0.0.1:${String(port)}`),
          `${label} tool-catalog WebServer port remained open at ${String(port)}`,
        ).toBe(false)
      }

      const baselineServer = await resources.acquire(
        'base + web-app CLI',
        async () => await startProfileServer(
          subprocessContext.subprocess,
          'web',
          canonicalWorkspace,
          env,
          operationSignal,
        ),
        async (ownedServer) => {
          const result = await stopTree(
            ownedServer.handle,
            'base + web-app CLI',
            PROCESS_CLEANUP_TIMEOUT_MS,
          )
          expect(result.exitCode, `base + web-app CLI stderr:\n${ownedServer.getStderr()}`).toBe(0)
          expect(result.signal).toBeNull()
        },
      )
      baselineRoutes = await captureBlockedRoutes(
        baselineServer.url,
        canonicalWorkspace,
        operationSignal,
      )
      await resources.release(baselineServer)

      server = await resources.acquire(
        'fusion CLI',
        async () => await startProfileServer(
          subprocessContext.subprocess,
          'fusion',
          canonicalWorkspace,
          env,
          operationSignal,
        ),
        async (ownedServer) => {
          const result = await stopTree(
            ownedServer.handle,
            'fusion CLI',
            PROCESS_CLEANUP_TIMEOUT_MS,
          )
          expect(result.exitCode, `fusion CLI stderr:\n${ownedServer.getStderr()}`).toBe(0)
          expect(result.signal).toBeNull()
          expect(ownedServer.getStderr()).not.toMatch(
            /Loader activation failure|unhandled rejection|uncaught exception|Failed to load plugins/iu,
          )
          expect(
            await portAcceptsConnections(ownedServer.url),
            `server port remained open at ${ownedServer.url}`,
          ).toBe(false)
        },
      )
      expect(
        await server.handle.waitForExit(AbortSignal.abort()),
        'fusion CLI exited after readiness',
      ).toBe(false)

      const createdWorkspace = await rpc<{
        workspace: { workspaceId: string }
      }>(server.url, 'workspace.create', { path: workspace }, operationSignal)
      await rpc<{ sessionId: string }>(server.url, 'session.create', {
        workspaceId: createdWorkspace.workspace.workspaceId,
      }, operationSignal)

      const consoleDiagnostics: string[] = []
      const httpDiagnostics: string[] = []
      const pageErrors: string[] = []
      const requestFailures: string[] = []
      const requestUrls: string[] = []
      const resourceUrls: string[] = []
      operationSignal.throwIfAborted()
      const browser = await resources.acquire(
        'browser',
        async () => await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 30_000 }),
        async (ownedBrowser) => { await ownedBrowser.close() },
      )
      const browserContext = await resources.acquire(
        'browser context',
        async () => await browser.newContext({
          locale: 'en-US',
          viewport: { width: 1680, height: 1000 },
        }),
        async (ownedContext) => { await ownedContext.close() },
      )
      const page = await resources.acquire(
        'page',
        async () => await browserContext.newPage(),
        async (ownedPage) => { await ownedPage.close() },
      )
      expect(await page.evaluate(() => navigator.language)).toBe('en-US')

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
      for (const packageName of Object.keys(EXPECTED_EXTERNAL)) {
        expect(bootEntries.filter(entry => entry.id === packageName)).toHaveLength(1)
      }

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

      const newSession = page.getByRole('button', { name: 'New session', exact: true }).first()
      await newSession.waitFor({ timeout: 10_000 })
      expect(await newSession.isVisible()).toBe(true)
      expect(await settingsTrigger.isVisible()).toBe(true)
      const petState = await readHttpResponse(new URL('/api/pet/state', server.url), {
        method: 'GET',
        headers: { accept: 'application/json' },
      }, 5_000, operationSignal)
      expect(petState.status).toBe(200)
      expect(petState.contentType).toMatch(/^application\/json\b/u)
      const petSnapshot = JSON.parse(petState.body) as {
        pet?: { id?: unknown; displayName?: unknown }
      }
      expect(typeof petSnapshot.pet?.id).toBe('string')
      if (typeof petSnapshot.pet?.displayName !== 'string') {
        throw new Error('Pet state has no display name for its visible control')
      }
      await page.locator('[data-dsh-pet-root]').waitFor({ state: 'attached', timeout: 10_000 })
      const petControl = page.getByRole('button', {
        name: petSnapshot.pet.displayName,
        exact: true,
      })
      await petControl.waitFor({ state: 'visible', timeout: 10_000 })
      expect(await page.locator('[data-dsh-pet-root]').count()).toBe(1)
      expect(await page.locator('[data-pet-dock], [data-testid="pet-summon"]').count()).toBe(1)
      expect(await page.locator('[data-gitgraph-chip-anchor]').count()).toBe(0)
      const fusionAria = (await petControl.ariaSnapshot())
        .split(petSnapshot.pet.displayName)
        .join('{{petName}}')
      expect(fusionAria).toContain('{{petName}}')
      await compareOrRefreshGolden(
        FUSION_ARIA_GOLDEN,
        fusionAria,
        webSnapshotMode(),
        'DSH_SNAPSHOT=refresh pnpm run test:fusion:acceptance:built',
      )
      expect(await page.locator([
        '[data-dsh-ssh-entry]',
        '[data-dsh-ssh-view]',
        '[data-dsh-taskboard-entry]',
        '[data-dsh-taskboard-view]',
        'body[data-dsh-skin-center]',
        '[data-better-sidebar]',
      ].join(', ')).count()).toBe(0)
      expect(await page.getByRole('button', {
        name: /^(Mobile remote control|移动端远程控制|Remote access|远程访问)$/u,
      }).count()).toBe(0)
      expect(resourceUrls.filter(url => isForbidden(new URL(url).pathname))).toEqual([])

      if (baselineRoutes === undefined) throw new Error('base + web-app route baseline is missing')
      for (const path of ['/api/dsh-ssh/hosts', '/api/pair/status'] as const) {
        assertSameHttpResponse(
          baselineRoutes.api.get(`GET ${path}`)!,
          await readHttpResponse(new URL(path, server.url), {
            method: 'GET',
            headers: { accept: 'application/json' },
          }, 5_000, operationSignal),
          `GET ${path}`,
        )
      }
      assertSameHttpResponse(
        baselineRoutes.api.get('POST /git/branches')!,
        await readHttpResponse(new URL('/git/branches', server.url), {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({ path: canonicalWorkspace }),
        }, 5_000, operationSignal),
        'POST /git/branches',
      )
      assertSameHttpResponse(
        baselineRoutes.api.get('POST /sidebar/api/fs.search')!,
        await readHttpResponse(new URL('/sidebar/api/fs.search', server.url), {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            sessionId: 'fusion-acceptance',
            cwd: canonicalWorkspace,
            query: 'package',
          }),
        }, 5_000, operationSignal),
        'POST /sidebar/api/fs.search',
      )
      const fusionFallback = await readHttpResponse(
        new URL('/', server.url),
        { method: 'GET' },
        5_000,
        operationSignal,
      )
      assertPetOnlyRootResponse(
        baselineRoutes.fallback,
        fusionFallback,
        'GET /',
      )
      for (const path of FALLBACK_PROBES) {
        assertSameHttpResponse(
          fusionFallback,
          await readHttpResponse(new URL(path, server.url), { method: 'GET' }, 5_000, operationSignal),
          `GET ${new URL(path, server.url).pathname}`,
        )
      }
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
    },
    cleanup: async (cleanupSignal) => {
      cleanupSignal.throwIfAborted()
      await cdpVersion(cleanupSignal)
      const remainingTargets = await cdpTargets(cleanupSignal)
      if (server !== undefined) {
        const serverUrl = server.url
        expect(
          [...remainingTargets.values()].filter(target => isServerPageTarget(target, serverUrl)),
          `Fusion acceptance page remained open at ${serverUrl}`,
        ).toEqual([])
      }
    },
  })
}, FUSION_ACCEPTANCE_TIMEOUT_MS)

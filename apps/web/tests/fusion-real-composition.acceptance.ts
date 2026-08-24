import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { lstat, mkdir, mkdtemp, readFile, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { strFromU8, unzipSync } from 'fflate'
import yaml from 'js-yaml'
import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
  type Request,
} from 'playwright'
import { expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { assembleContextFor } from '@deepseek-ai/dsh-agent'
import { parseSessionLog } from '@deepseek-ai/dsh-llm-replay'
import { SessionId } from '@deepseek-ai/dsh-session'
import { renderContextSections, renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { verifyFusionExternalAuthorization } from './fusion-external-auth.ts'
import { compareOrRefreshGolden, webSnapshotMode } from './scaffold.ts'
import type {
  AcceptanceLifecycleOptions,
  FusionExportLedgerEntry,
  FusionNetworkFailure,
  ReadyProcess,
} from './fusion-real-process.ts'
import {
  acceptanceEnvironment,
  assertFusionCompactLifecycle,
  assertFusionExcludedFromComposition,
  assertFusionExportLedger,
  assertFusionForkSelection,
  assertPetOnlyRootResponse,
  assertSameHttpResponse,
  assertSameModelInput,
  FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS,
  FUSION_ACCEPTANCE_OPERATION_TIMEOUT_MS,
  FUSION_ACCEPTANCE_TIMEOUT_MS,
  httpResponseBodyText,
  isServerPageTarget,
  parseSystemChromeVersion,
  readHttpResponse,
  runAcceptanceLifecycle,
  runManagedCommand,
  setupFusionAcceptanceProfile,
  spawnSpec,
  startManagedProcess,
  stopTree,
  withOwnedTemporaryRoot,
} from './fusion-real-process.ts'

const CDP_ENDPOINT = 'http://127.0.0.1:9333'
const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const FIXTURE_ROOT = join(REPO_ROOT, 'apps/web/tests/fixtures/fusion-profile')
const FUSION_ROOT = join(REPO_ROOT, 'packages/bundle/fusion')
const BUILT_CLI = join(REPO_ROOT, 'apps/cli/lib/bin.js')
const CLI_PACKAGE = join(REPO_ROOT, 'apps/cli/package.json')
const SHIPPED_PRESET_DIR = join(REPO_ROOT, 'apps/cli/config/agent-presets')
const FUSION_ARIA_GOLDEN = join(REPO_ROOT, 'apps/web/tests/snapshots/fusion-profile/ui.expected.md')
const ACP_CONFIG = join(REPO_ROOT, 'examples/acp-agent/cordis.yml')
const ACP_BUILT_BIN = join(REPO_ROOT, 'packages/examples/acp-demo/lib/bin.js')
const APP_BOOT_BUILT = join(REPO_ROOT, 'packages/boot/app-boot/lib/index.js')
const PLUGIN_INVENTORY_BUILT = join(REPO_ROOT, 'packages/host/plugin-inventory/lib/index.js')
const ACP_INVENTORY_MARKER = 'FUSION_ACP_RUNTIME_INVENTORY='
const PROCESS_CLEANUP_TIMEOUT_MS = 10_000
const SOURCE_TITLE = 'Fusion tracked source session'
const TOOL_PROMPT = 'FUSION_TOOL: read fusion.txt, then report completion.'
const FIRST_REPLY = 'FUSION_CONVERSATION_OK'
const SECOND_REPLY = 'FUSION_SECOND_TURN_OK'
const COMPACT_REPLY = 'Fusion compact summary: the tracked Pet-only regression remains complete.'
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

interface BrowserRequestRecord {
  method: string
  requestId: string
  url: string
}

interface BrowserDiagnostics {
  console: string[]
  downloads: string[]
  http: string[]
  failures: FusionNetworkFailure[]
  page: string[]
  started: BrowserRequestRecord[]
}

interface LocalProvider {
  baseUrl: string
  close(): Promise<void>
  port: number
  requests: Array<{
    kind: 'compact' | 'reply' | 'second' | 'title' | 'tool'
    model: unknown
  }>
}

type AcceptanceResources = Parameters<AcceptanceLifecycleOptions<unknown>['operation']>[1]

interface HistoryEvent {
  data?: Record<string, unknown>
  seq?: number
  type: string
}

interface SessionHistory {
  events: Array<{ event: HistoryEvent }>
}

interface SessionList {
  items: Array<{
    projections?: { values?: { title?: unknown } }
    sessionId: string
  }>
}

const jsExprType = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  construct: value => String(value),
})
const configSchema = yaml.JSON_SCHEMA.extend(jsExprType)
const requestIds = new WeakMap<Request, string>()
let nextRequestId = 1

function requestIdentity(request: Request): string {
  const existing = requestIds.get(request)
  if (existing !== undefined) return existing
  const identity = `fusion-request-${String(nextRequestId++).padStart(4, '0')}`
  requestIds.set(request, identity)
  return identity
}

function watchPage(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    console: [],
    downloads: [],
    failures: [],
    http: [],
    page: [],
    started: [],
  }
  page.on('request', (request) => {
    diagnostics.started.push({
      requestId: requestIdentity(request),
      method: request.method(),
      url: request.url(),
    })
  })
  page.on('download', download => diagnostics.downloads.push(download.url()))
  page.on('console', (message) => {
    if (['warning', 'error', 'assert'].includes(message.type())) {
      diagnostics.console.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', error => diagnostics.page.push(String(error)))
  page.on('requestfailed', (request) => {
    diagnostics.failures.push({
      requestId: requestIdentity(request),
      method: request.method(),
      url: request.url(),
      errorText: request.failure()?.errorText ?? 'unknown failure',
    })
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      diagnostics.http.push(
        `${String(response.status())} ${response.request().method()} ${response.url()}`,
      )
    }
  })
  return diagnostics
}

async function assertPageDiagnostics(
  page: Page,
  diagnostics: BrowserDiagnostics,
  exportLedger: readonly FusionExportLedgerEntry[] = [],
): Promise<void> {
  expect(await page.locator('[data-slot-error]').allTextContents()).toEqual([])
  expect(diagnostics.console).toEqual([])
  expect(diagnostics.page).toEqual([])
  expect(diagnostics.http).toEqual([])
  if (exportLedger.length === 0) expect(diagnostics.failures).toEqual([])
  else assertFusionExportLedger(exportLedger, diagnostics.failures, diagnostics.downloads)
}

async function waitForCondition(
  check: () => boolean | Promise<boolean>,
  label: string,
  signal: AbortSignal,
  timeoutMs = 30_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    signal.throwIfAborted()
    if (await check()) return
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error(`timed out waiting for ${label}`)
}

function writeSse(response: import('node:http').ServerResponse, chunks: unknown[]): void {
  response.writeHead(200, {
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'content-type': 'text/event-stream; charset=utf-8',
  })
  for (const chunk of chunks) response.write(`data: ${JSON.stringify(chunk)}\n\n`)
  response.end('data: [DONE]\n\n')
}

async function startLocalProvider(): Promise<LocalProvider> {
  const requests: LocalProvider['requests'] = []
  const server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
    request.on('end', () => {
      try {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
          max_tokens?: unknown
          messages?: Array<{ content?: unknown; role?: unknown }>
          model?: unknown
        }
        const serialized = JSON.stringify(body.messages ?? [])
        const title = body.max_tokens === 64
        const compact = serialized.includes('You are now acting as a compaction engine')
        const hasToolResult = body.messages?.some(message => message.role === 'tool') === true
        const tool = serialized.includes('FUSION_TOOL') && !hasToolResult
        const second = serialized.includes('FUSION_SECOND')
        const kind = title ? 'title' : compact ? 'compact' : tool ? 'tool' : second ? 'second' : 'reply'
        requests.push({ kind, model: body.model })
        if (tool) {
          writeSse(response, [
            {
              choices: [{
                index: 0,
                delta: {
                  tool_calls: [{
                    index: 0,
                    id: 'fusion-read-call',
                    type: 'function',
                    function: { name: 'read', arguments: '{"file_path":"fusion.txt"}' },
                  }],
                },
                finish_reason: null,
              }],
            },
            {
              choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }],
              usage: { prompt_tokens: 20, completion_tokens: 8 },
            },
          ])
          return
        }
        const text = title
          ? SOURCE_TITLE
          : compact
            ? COMPACT_REPLY
            : second
              ? SECOND_REPLY
              : FIRST_REPLY
        writeSse(response, [
          { choices: [{ index: 0, delta: { content: text }, finish_reason: null }] },
          {
            choices: [{ index: 0, delta: { content: '' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 20, completion_tokens: text.length },
          },
        ])
      } catch (error) {
        response.writeHead(500, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: String(error) }))
      }
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('Fusion local provider did not bind a TCP port')
  }
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    port: address.port,
    requests,
    close: async () => {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) resolve()
          else reject(error)
        })
      })
    },
  }
}

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
  return parseSystemChromeVersion(JSON.parse(httpResponseBodyText(response)))
}

async function cdpTargets(signal?: AbortSignal): Promise<Map<string, CdpTarget>> {
  const response = await readHttpResponse(new URL('/json/list', CDP_ENDPOINT), undefined, 3_000, signal)
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Chrome CDP target discovery failed: HTTP ${String(response.status)}`)
  }
  const values = JSON.parse(httpResponseBodyText(response)) as CdpTarget[]
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
  const body = JSON.parse(httpResponseBodyText(response)) as {
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

async function readExportZip(
  path: string,
  expectedEntries: readonly string[],
): Promise<{ content: string; sha256: string }> {
  const bytes = await readFile(path)
  const archive = unzipSync(bytes)
  expect(Object.keys(archive).sort()).toEqual([...expectedEntries].sort())
  const parent = archive['session.jsonl']
  if (parent === undefined) throw new Error('Fusion export omitted session.jsonl')
  return {
    content: strFromU8(parent),
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

async function openRegressionPage(
  resources: AcceptanceResources,
  browser: Browser,
  serverUrl: string,
  label: string,
): Promise<{
  context: BrowserContext
  diagnostics: BrowserDiagnostics
  page: Page
}> {
  const context = await resources.acquire(
    `${label} browser context`,
    async () => await browser.newContext({
      acceptDownloads: true,
      locale: 'en-US',
      viewport: { width: 1680, height: 1000 },
    }),
    async (ownedContext) => { await ownedContext.close() },
  )
  const page = await resources.acquire(
    `${label} page`,
    async () => await context.newPage(),
    async (ownedPage) => { await ownedPage.close() },
  )
  const diagnostics = watchPage(page)
  await page.goto(serverUrl, { waitUntil: 'load', timeout: 30_000 })
  await page.waitForSelector('[class*="frame"]', { timeout: 30_000 })
  const welcome = page.getByRole('dialog', {
    name: /^(Internal Testing Notice|内测声明)$/u,
  })
  if (await welcome.count() > 0) {
    await welcome.getByRole('button', { name: /^(Continue|继续)$/u }).press('Enter')
    await welcome.waitFor({ state: 'detached', timeout: 10_000 })
  }
  return { context, diagnostics, page }
}

async function runFreshProfileIsolation(
  runtime: Context['subprocess'],
  workspace: string,
  env: NodeJS.ProcessEnv,
  temporaryRoot: string,
  signal: AbortSignal,
): Promise<{ headlessHome: string }> {
  const homes = {
    web: join(temporaryRoot, 'isolated-web-home'),
    headless: join(temporaryRoot, 'isolated-headless-home'),
  }
  for (const profile of ['web', 'headless'] as const) {
    const dump = await runManagedCommand(
      runtime,
      spawnSpec([
        process.execPath,
        BUILT_CLI,
        '--profile',
        profile,
        '--dump-config',
      ], workspace, { ...env, DSH_HOME: homes[profile] }),
      `${profile} isolated dump-config`,
      60_000,
      signal,
    )
    expect(dump.exitCode, `${profile} dump-config failed:\n${dump.stderr}`).toBe(0)
    expect(dump.signal).toBeNull()
    assertFusionExcludedFromComposition(`${profile} dump-config`, dump.stdout)
  }
  return { headlessHome: homes.headless }
}

async function runHeadlessTurn(
  runtime: Context['subprocess'],
  workspace: string,
  env: NodeJS.ProcessEnv,
  headlessHome: string,
  signal: AbortSignal,
): Promise<void> {
  const result = await runManagedCommand(
    runtime,
    spawnSpec([
      process.execPath,
      BUILT_CLI,
      '--profile',
      'headless',
      'FUSION_HEADLESS_ISOLATION',
    ], workspace, { ...env, DSH_HOME: headlessHome }),
    'headless local-provider turn',
    60_000,
    signal,
  )
  expect(result.exitCode, result.stderr).toBe(0)
  expect(result.signal).toBeNull()
  expect(result.stdout).toContain(FIRST_REPLY)
  expect(result.stderr).not.toMatch(
    /Loader activation failure|unhandled rejection|uncaught exception|Failed to load plugins/iu,
  )
}

async function runAcpStdioSmoke(
  runtime: Context['subprocess'],
  env: NodeJS.ProcessEnv,
  temporaryRoot: string,
  signal: AbortSignal,
): Promise<void> {
  expect(existsSync(ACP_BUILT_BIN), `missing built ACP bin ${ACP_BUILT_BIN}`).toBe(true)
  assertFusionExcludedFromComposition(
    'ACP cordis.yml',
    await readFile(ACP_CONFIG, 'utf8'),
  )
  const result = await runManagedCommand(
    runtime,
    spawnSpec([
      'pnpm',
      'exec',
      'vitest',
      'run',
      '--config',
      'vitest.e2e.config.ts',
      'examples/acp-agent/tests/acp.e2e.ts',
      '-t',
      'emits only framed JSON-RPC|session/new succeeds over real stdio',
    ], REPO_ROOT, withOwnedTemporaryRoot({
      ...env,
      DSH_E2E_MAX_WORKERS: '1',
      DSH_EXAMPLE_MODE: 'lib',
      DSH_HOME: join(temporaryRoot, 'isolated-acp-home'),
      TSX_TSCONFIG_PATH: undefined,
    }, temporaryRoot)),
    'ACP keyless real-stdio smoke',
    90_000,
    signal,
  )
  expect(result.exitCode, result.stderr).toBe(0)
  expect(result.signal).toBeNull()
  expect(result.stdout).toMatch(/2 passed/u)
  expect(`${result.stdout}\n${result.stderr}`).not.toMatch(
    /packages\/examples\/acp-demo\/src\/bin\.ts|--import[^\n]*tsx/iu,
  )
}

async function runAcpResolvedComposition(
  runtime: Context['subprocess'],
  env: NodeJS.ProcessEnv,
  temporaryRoot: string,
  signal: AbortSignal,
): Promise<void> {
  for (const artifact of [APP_BOOT_BUILT, PLUGIN_INVENTORY_BUILT]) {
    expect(existsSync(artifact), `missing built ACP inventory artifact ${artifact}`).toBe(true)
  }
  const probe = `
const { boot } = await import(${JSON.stringify(pathToFileURL(APP_BOOT_BUILT).href)})
const { default: PluginInventoryGateway } =
  await import(${JSON.stringify(pathToFileURL(PLUGIN_INVENTORY_BUILT).href)})
const ctx = await boot('Fusion ACP runtime inventory', ${JSON.stringify(ACP_CONFIG)})
try {
  await ctx.plugin(PluginInventoryGateway)
  const pluginInventory = ctx.get('pluginInventory')
  process.stderr.write(${JSON.stringify(ACP_INVENTORY_MARKER)} + JSON.stringify(pluginInventory.list()) + '\\n')
} finally {
  await ctx.fiber.dispose()
}
`
  const result = await runManagedCommand(
    runtime,
    spawnSpec([
      process.execPath,
      '--input-type=module',
      '--eval',
      probe,
    ], temporaryRoot, {
      ...env,
      DEEPSEEK_API_KEY: 'keyless-acp-loader-inventory',
      DSH_HOME: join(temporaryRoot, 'acp-inventory-home'),
      DSH_PERMISSION_MODE: 'danger-full-access',
      DSH_SNAPSHOT: undefined,
      TSX_TSCONFIG_PATH: undefined,
    }),
    'ACP resolved Loader inventory',
    30_000,
    signal,
  )
  expect(result.exitCode, result.stderr).toBe(0)
  expect(result.signal).toBeNull()
  expect(result.stdout).toBe('')
  const inventoryLine = result.stderr
    .split('\n')
    .find(line => line.startsWith(ACP_INVENTORY_MARKER))
  if (inventoryLine === undefined) throw new Error('ACP Loader inventory marker is missing')
  const inventory = JSON.parse(inventoryLine.slice(ACP_INVENTORY_MARKER.length)) as {
    entries: Array<{
      enabled: boolean
      entryId: string
      fiberPhase: string | null
      moduleName: string
    }>
  }
  expect(inventory.entries.length).toBeGreaterThan(0)
  expect(inventory.entries).toContainEqual(expect.objectContaining({
    enabled: true,
    fiberPhase: 'active',
    moduleName: '@deepseek-ai/dsh-acp-demo',
  }))
  expect(inventory.entries.filter(entry =>
    entry.enabled && entry.fiberPhase !== 'active')).toEqual([])
  assertFusionExcludedFromComposition(
    'ACP resolved Loader inventory',
    JSON.stringify(inventory.entries),
  )
}

async function runFusionWebRegression(options: {
  browser: Browser
  context: BrowserContext
  diagnostics: BrowserDiagnostics
  env: NodeJS.ProcessEnv
  page: Page
  provider: LocalProvider
  resources: AcceptanceResources
  runtime: Context['subprocess']
  server: ManagedServer
  serverUrls: string[]
  signal: AbortSignal
  sourceSessionId: string
  workspace: string
}): Promise<ManagedServer> {
  const {
    browser,
    context,
    diagnostics,
    env,
    page,
    provider,
    resources,
    runtime,
    server: firstServer,
    serverUrls,
    signal,
    sourceSessionId,
    workspace,
  } = options
  const initialList = await rpc<SessionList>(firstServer.url, 'session.list', {}, signal)
  const createsBeforeReuse = diagnostics.started.filter(request =>
    request.method === 'POST'
    && new URL(request.url).pathname === '/api/session.create').length
  await page.getByRole('button', { name: 'New session', exact: true }).first().press('Enter')
  await new Promise(resolve => setTimeout(resolve, 250))
  const reusedList = await rpc<SessionList>(firstServer.url, 'session.list', {}, signal)
  expect(reusedList.items).toHaveLength(initialList.items.length)
  expect(diagnostics.started.filter(request =>
    request.method === 'POST'
    && new URL(request.url).pathname === '/api/session.create')).toHaveLength(createsBeforeReuse)

  const initialModel = page.getByRole('button', { name: /current DeepSeek-V4-Flash/u })
  await initialModel.waitFor({ timeout: 10_000 })
  await initialModel.press('Enter')
  await page.getByRole('menuitem', { name: /^Model/u }).press('Enter')
  await page.getByRole('menuitemradio', { name: 'DeepSeek-V4-Pro', exact: true }).press('Enter')
  const proModel = page.getByRole('button', { name: /current DeepSeek-V4-Pro/u })
  await proModel.waitFor({ timeout: 10_000 })
  await proModel.press('Enter')
  await page.getByRole('menuitem', { name: /^Model/u }).press('Enter')
  await page.getByRole('menuitemradio', { name: 'DeepSeek-V4-Flash', exact: true }).press('Enter')
  await page.getByRole('button', { name: /current DeepSeek-V4-Flash/u })
    .waitFor({ timeout: 10_000 })

  let input = page.locator('textarea:enabled').first()
  await input.fill(TOOL_PROMPT)
  await input.press('Enter')
  await page.getByText(FIRST_REPLY, { exact: true }).waitFor({ timeout: 30_000 })
  await page.locator('[data-variant="read"]').waitFor({ timeout: 15_000 })
  expect(await page.getByText('fusion.txt', { exact: false }).count()).toBeGreaterThan(0)
  const firstHistory = await rpc<SessionHistory>(
    firstServer.url,
    'session.history',
    { sessionId: sourceSessionId },
    signal,
  )
  const firstEvents = firstHistory.events.map(item => item.event)
  const completedTurn = firstEvents.find(event => event.type === 'turn/end')
  expect((completedTurn?.data?.reason as { kind?: unknown } | undefined)?.kind).toBe('completed')
  const readCall = firstEvents.find(event =>
    event.type === 'tool/call' && event.data?.name === 'read')
  const readCallId = readCall?.data?.callId
  expect(typeof readCallId).toBe('string')
  const readResult = firstEvents.find(event => (
    event.type === 'tool/result'
    && (event.data?.message as {
      source?: { callId?: unknown }
    } | undefined)?.source?.callId === readCallId
  ))
  expect(readResult).toBeDefined()
  expect(JSON.stringify(readResult?.data?.message)).toContain('FUSION_FILE_OK')
  expect(
    ((readResult?.data?.message as {
      content?: Array<{ isError?: unknown }>
    } | undefined)?.content?.[0]?.isError),
  ).toBe(false)
  expect(provider.requests.filter(request =>
    request.kind === 'tool' || request.kind === 'reply')).toEqual([
    { kind: 'tool', model: 'deepseek-v4-flash' },
    { kind: 'reply', model: 'deepseek-v4-flash' },
  ])

  const renamed = await rpc<{ title: string }>(
    firstServer.url,
    'session.rename',
    { sessionId: sourceSessionId, title: SOURCE_TITLE },
    signal,
  )
  expect(renamed.title).toBe(SOURCE_TITLE)
  await waitForCondition(async () => {
    const list = await rpc<SessionList>(firstServer.url, 'session.list', {}, signal)
    return list.items.some(item =>
      item.sessionId === sourceSessionId
      && item.projections?.values?.title === SOURCE_TITLE)
  }, 'renamed source session projection', signal)
  await page.getByText(SOURCE_TITLE, { exact: true }).first().waitFor({ timeout: 10_000 })
  expect(await page.locator('[role="treeitem"][aria-selected="true"]').count()).toBe(1)

  const countBeforeCreate = (await rpc<SessionList>(
    firstServer.url,
    'session.list',
    {},
    signal,
  )).items.length
  const createResponse = page.waitForResponse(response =>
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/session.create')
  await page.getByRole('button', { name: 'New session', exact: true }).first().press('Enter')
  const activeWire = await createResponse
  expect(activeWire.status()).toBe(200)
  const activeEnvelope = await activeWire.json() as {
    result?: { ok?: unknown; value?: { sessionId?: unknown } }
  }
  const activeSessionId = activeEnvelope.result?.value?.sessionId
  if (typeof activeSessionId !== 'string') {
    throw new Error('active session.create omitted the session id')
  }
  await waitForCondition(
    async () => {
      const list = await rpc<SessionList>(firstServer.url, 'session.list', {}, signal)
      return list.items.length === countBeforeCreate + 1
        && list.items.some(item => item.sessionId === activeSessionId)
    },
    'active-session create',
    signal,
  )
  expect(diagnostics.started.filter(request =>
    request.method === 'POST'
    && new URL(request.url).pathname === '/api/session.create'))
    .toHaveLength(createsBeforeReuse + 1)
  const titlesBeforeActiveTurn = provider.requests.filter(request => request.kind === 'title').length
  input = page.locator('textarea:enabled').first()
  await input.fill('FUSION_ACTIVE_SESSION')
  await input.press('Enter')
  await waitForCondition(async () => {
    const history = await rpc<SessionHistory>(
      firstServer.url,
      'session.history',
      { sessionId: activeSessionId },
      signal,
    )
    return history.events.some(item =>
      item.event.type === 'turn/end'
      && (item.event.data?.reason as { kind?: unknown } | undefined)?.kind === 'completed')
      && provider.requests.filter(request => request.kind === 'title').length
        > titlesBeforeActiveTurn
  }, 'active-session completed turn and title', signal)
  const activeTitle = `Fusion active ${activeSessionId}`
  expect((await rpc<{ title: string }>(
    firstServer.url,
    'session.rename',
    { sessionId: activeSessionId, title: activeTitle },
    signal,
  )).title).toBe(activeTitle)
  await waitForCondition(async () => {
    const list = await rpc<SessionList>(firstServer.url, 'session.list', {}, signal)
    return list.items.some(item =>
      item.sessionId === activeSessionId
      && item.projections?.values?.title === activeTitle)
  }, 'active-session unique title', signal)
  const selectedActive = page.locator('[role="treeitem"][aria-selected="true"]')
  await selectedActive.getByText(activeTitle, { exact: true }).waitFor({ timeout: 10_000 })
  expect(await selectedActive.count()).toBe(1)

  const searchButton = page.getByRole('button', { name: 'Search sessions' })
  if (await searchButton.getAttribute('aria-expanded') !== 'true') {
    await searchButton.press('Enter')
  }
  const search = page.getByPlaceholder('Search sessions', { exact: false })
  const searchTree = page.getByRole('tree', { name: 'Search results' })
  const emptySearchResponse = page.waitForResponse(response =>
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/session.search')
  await search.fill('FUSION_NO_SUCH_SESSION')
  expect((await emptySearchResponse).status()).toBe(200)
  await waitForCondition(
    async () => await searchTree.getByRole('treeitem').count() === 0,
    'zero-result session search',
    signal,
  )
  const sourceSearchResponse = page.waitForResponse(response =>
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/session.search')
  await search.fill(SOURCE_TITLE)
  expect((await sourceSearchResponse).status()).toBe(200)
  await waitForCondition(
    async () => await searchTree.getByRole('treeitem').count() === 1,
    'source session search result',
    signal,
  )
  await searchTree.getByText(SOURCE_TITLE, { exact: true }).click()
  await page.getByText(FIRST_REPLY, { exact: true }).waitFor({ timeout: 15_000 })
  expect(await page.locator('[role="treeitem"][aria-selected="true"]')
    .getByText(SOURCE_TITLE, { exact: true }).count()).toBe(1)
  await page.getByRole('button', { name: 'Clear search' }).press('Enter')
  expect(await search.inputValue()).toBe('')
  await page.getByRole('tree', { name: 'Sessions' }).waitFor({ timeout: 10_000 })

  input = page.locator('textarea:enabled').first()
  await input.fill(`FUSION_SECOND ${'preserve tracked Fusion context '.repeat(160)}`)
  await input.press('Enter')
  await page.getByText(SECOND_REPLY, { exact: true }).waitFor({ timeout: 30_000 })
  expect(provider.requests.find(request => request.kind === 'second')).toEqual({
    kind: 'second',
    model: 'deepseek-v4-flash',
  })

  const forkResponse = page.waitForResponse(response =>
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/session.fork')
  await page.getByRole('button', { name: 'Branch into a new conversation' }).last().press('Enter')
  const forkWire = await forkResponse
  expect(forkWire.status()).toBe(200)
  const forkEnvelope = await forkWire.json() as {
    result?: { ok?: unknown; value?: { sessionId?: unknown } }
  }
  const childId = forkEnvelope.result?.value?.sessionId
  if (typeof childId !== 'string') throw new Error('session.fork omitted the child session id')
  await waitForCondition(
    async () => (await rpc<SessionList>(
      firstServer.url,
      'session.list',
      {},
      signal,
    )).items.length === countBeforeCreate + 2,
    'fork child session',
    signal,
  )
  const childTitle = `Fusion fork ${childId}`
  await rpc(
    firstServer.url,
    'session.rename',
    { sessionId: childId, title: childTitle },
    signal,
  )
  const selectedFork = page.locator('[role="treeitem"][aria-selected="true"]')
  await selectedFork.getByText(childTitle, { exact: true }).waitFor({ timeout: 10_000 })
  assertFusionForkSelection(
    await selectedFork.count(),
    await selectedFork.getByText(childTitle, { exact: true }).innerText(),
    childId,
  )

  const firstOrigin = new URL(firstServer.url).origin
  expect(diagnostics.started.filter(({ url }) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return false
    return new URL(url).origin !== firstOrigin
  })).toEqual([])
  await assertPageDiagnostics(page, diagnostics)
  const firstPid = firstServer.handle.pid
  const firstUrl = firstServer.url
  await resources.release(page)
  await resources.release(context)
  await resources.release(firstServer)
  expect(await portAcceptsConnections(firstUrl), 'first Fusion server port remained open').toBe(false)

  const server = await resources.acquire(
    'fusion CLI after cold restart',
    async () => await startProfileServer(runtime, 'fusion', workspace, env, signal),
    async (ownedServer) => {
      const result = await stopTree(
        ownedServer.handle,
        'fusion CLI after cold restart',
        PROCESS_CLEANUP_TIMEOUT_MS,
      )
      expect(result.exitCode, `restarted Fusion CLI stderr:\n${ownedServer.getStderr()}`).toBe(0)
      expect(result.signal).toBeNull()
      expect(ownedServer.getStderr()).not.toMatch(
        /Loader activation failure|unhandled rejection|uncaught exception|Failed to load plugins/iu,
      )
      expect(await portAcceptsConnections(ownedServer.url)).toBe(false)
    },
  )
  serverUrls.push(server.url)
  expect(server.handle.pid).not.toBe(firstPid)
  expect(await server.handle.waitForExit(AbortSignal.abort())).toBe(false)

  const resumed = await openRegressionPage(resources, browser, server.url, 'resumed Fusion')
  const resumedPage = resumed.page
  await resumedPage.getByText(SOURCE_TITLE, { exact: true }).first().click()
  await resumedPage.getByText(FIRST_REPLY, { exact: true }).waitFor({ timeout: 15_000 })
  await resumedPage.getByText(SECOND_REPLY, { exact: true }).waitFor({ timeout: 15_000 })
  const resumedHistory = await rpc<SessionHistory>(
    server.url,
    'session.history',
    { sessionId: sourceSessionId },
    signal,
  )
  expect(resumedHistory.events.some(item =>
    item.event.type === 'turn/end'
    && (item.event.data?.reason as { kind?: unknown } | undefined)?.kind === 'completed')).toBe(true)

  const exportLedger: FusionExportLedgerEntry[] = []
  const exportEntries = ['session.jsonl', `subagents/${childId}/session.jsonl`]
  const headerHead = resumedPage.waitForResponse(response =>
    response.request().method() === 'HEAD'
    && new URL(response.url()).pathname === '/api/session.export')
  const headerDownload = resumedPage.waitForEvent('download')
  await resumedPage.getByRole('button', { name: 'Session log' }).press('Enter')
  const headerResponse = await headerHead
  const headerDownloadResult = await headerDownload
  const headerPath = await headerDownloadResult.path()
  if (headerPath === null) throw new Error('header export did not produce a local ZIP')
  const headerZip = await readExportZip(headerPath, exportEntries)
  expect(headerZip.content).toContain(sourceSessionId)
  await resumedPage.getByRole('dialog', { name: 'Session download started' })
    .getByText('Close', { exact: true }).press('Enter')
  const headerRequestId = requestIdentity(headerResponse.request())
  await waitForCondition(
    () => resumed.diagnostics.failures.some(failure =>
      failure.requestId === headerRequestId),
    'header export HEAD abort',
    signal,
  )
  exportLedger.push({
    action: 'header',
    completed: true,
    downloadUrl: headerDownloadResult.url(),
    headRequestId: headerRequestId,
    headStatus: headerResponse.status(),
    headUrl: headerResponse.url(),
    zipSha256: headerZip.sha256,
  })

  const resumedInput = resumedPage.locator('textarea:enabled').first()
  const slashHead = resumedPage.waitForResponse(response =>
    response.request().method() === 'HEAD'
    && new URL(response.url()).pathname === '/api/session.export')
  const slashDownload = resumedPage.waitForEvent('download')
  await resumedInput.fill('/export')
  await resumedPage.getByRole('option', { name: /export/u }).waitFor({ timeout: 10_000 })
  await resumedInput.press('Enter')
  const slashResponse = await slashHead
  const slashDownloadResult = await slashDownload
  const slashPath = await slashDownloadResult.path()
  if (slashPath === null) throw new Error('/export did not produce a local ZIP')
  const slashZip = await readExportZip(slashPath, exportEntries)
  const slashEvents = parseSessionLog(slashZip.content)
  const exportRun = slashEvents.findLast(event =>
    event.type === 'command/run' && event.data.name === 'export')
  if (exportRun?.type !== 'command/run') throw new Error('/export ZIP omitted command/run')
  expect(slashEvents.some(event =>
    event.type === 'command/done'
    && event.data.commandId === exportRun.data.commandId
    && event.data.kind === 'success')).toBe(true)
  await resumedPage.getByRole('dialog', { name: 'Session download started' })
    .getByText('Close', { exact: true }).press('Enter')
  const slashRequestId = requestIdentity(slashResponse.request())
  await waitForCondition(
    () => resumed.diagnostics.failures.some(failure =>
      failure.requestId === slashRequestId),
    '/export HEAD abort',
    signal,
  )
  exportLedger.push({
    action: 'slash',
    completed: true,
    downloadUrl: slashDownloadResult.url(),
    headRequestId: slashRequestId,
    headStatus: slashResponse.status(),
    headUrl: slashResponse.url(),
    zipSha256: slashZip.sha256,
  })
  assertFusionExportLedger(
    exportLedger,
    resumed.diagnostics.failures,
    resumed.diagnostics.downloads,
  )

  await resumedInput.fill('/compact')
  await resumedPage.getByRole('option', { name: /compact/u }).waitFor({ timeout: 10_000 })
  await resumedInput.press('Enter')
  await resumedPage.getByText(/^Compacted \d+ history items \(~\d+ tokens\)$/u)
    .waitFor({ timeout: 30_000 })
  let compacted = await rpc<SessionHistory>(
    server.url,
    'session.history',
    { sessionId: sourceSessionId },
    signal,
  )
  const compactRun = compacted.events.map(item => item.event).find(event =>
    event.type === 'command/run' && event.data?.name === 'compact')
  const compactCommandId = compactRun?.data?.commandId
  if (typeof compactCommandId !== 'string') {
    throw new Error('/compact omitted its command id')
  }
  await waitForCondition(async () => {
    compacted = await rpc<SessionHistory>(
      server.url,
      'session.history',
      { sessionId: sourceSessionId },
      signal,
    )
    const events = compacted.events.map(item => item.event)
    return events.some(event =>
      event.type === 'command/done'
      && event.data?.commandId === compactCommandId
      && event.data?.kind === 'success')
      && events.some(event =>
        event.type === 'compaction/end'
        && event.data?.sourceCommandId === compactCommandId)
  }, `compact command ${compactCommandId}`, signal)
  expect(assertFusionCompactLifecycle(
    compacted.events.map(item => item.event),
  )).toBe(compactCommandId)
  expect(provider.requests.some(request =>
    request.kind === 'compact'
    && request.model === 'deepseek-v4-flash')).toBe(true)

  const settingsTrigger = resumedPage.getByRole('button', { name: 'Settings', exact: true })
  await settingsTrigger.press('Enter')
  let settings = resumedPage.getByRole('dialog', { name: 'Settings' })
  await settings.waitFor({ timeout: 10_000 })
  expect(await settings.getByRole('button', { name: 'General' })
    .getAttribute('aria-current')).toBe('true')
  await settings.getByRole('button', { name: 'Models' }).press('Enter')
  expect(await settings.getByRole('button', { name: 'Models' })
    .getAttribute('aria-current')).toBe('true')
  await settings.getByRole('button', { name: 'Plugins', exact: true }).press('Enter')
  await settings.getByRole('tab', { name: 'Plugin list', exact: true }).press('Enter')
  const inventory = await rpc<{
    entries: Array<{
      enabled: boolean
      entryId: string
      fiberPhase: string | null
      moduleName: string
    }>
  }>(server.url, 'pluginInventory/list', { args: {} }, signal)
  const inventoryRows = settings.locator('[data-plugin-entry]')
  await waitForCondition(
    async () => await inventoryRows.count() === inventory.entries.length,
    'plugin inventory DOM',
    signal,
  )
  expect(await inventoryRows.evaluateAll(elements =>
    elements.map(element => element.getAttribute('data-plugin-entry') ?? '')))
    .toEqual(inventory.entries.map(entry => entry.entryId))
  expect(inventory.entries.filter(entry =>
    !entry.moduleName.startsWith('@deepseek-ai/')
    && !entry.moduleName.startsWith('cordis:'))).toEqual([{
    enabled: true,
    entryId: 'include:pet',
    fiberPhase: 'active',
    moduleName: '@linxin666/dsh-pet',
  }])
  await resumedPage.keyboard.press('Escape')
  expect(await resumedPage.getByRole('dialog', { name: 'Settings' }).count()).toBe(0)
  await settingsTrigger.press('Enter')
  settings = resumedPage.getByRole('dialog', { name: 'Settings' })
  await settings.getByRole('button', { name: 'Close' }).press('Enter')
  expect(await resumedPage.getByRole('dialog', { name: 'Settings' }).count()).toBe(0)

  expect(await resumedPage.locator('[data-dsh-pet-root]').count()).toBe(1)
  const resumedPet = await readHttpResponse(
    new URL('/api/pet/state', server.url),
    { method: 'GET', headers: { accept: 'application/json' } },
    5_000,
    signal,
  )
  expect(resumedPet.status).toBe(200)
  const resumedOrigin = new URL(server.url).origin
  expect(resumed.diagnostics.started.filter(({ url }) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) return false
    return new URL(url).origin !== resumedOrigin
  })).toEqual([])
  await assertPageDiagnostics(resumedPage, resumed.diagnostics, exportLedger)
  await resources.release(resumedPage)
  await resources.release(resumed.context)
  return server
}

it('boots the accepted Fusion profile through the real CLI and system Chrome CDP', async ({ signal: testSignal }) => {
  const subprocessContext = new Context()
  let baselineRoutes: Awaited<ReturnType<typeof captureBlockedRoutes>> | undefined
  let server: ManagedServer | undefined
  const serverUrls: string[] = []

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
      const provider = await resources.acquire(
        'loopback model provider',
        startLocalProvider,
        async (ownedProvider) => {
          await ownedProvider.close()
          expect(
            await portAcceptsConnections(ownedProvider.baseUrl),
            `model provider port remained open at ${ownedProvider.baseUrl}`,
          ).toBe(false)
        },
      )
      const env = {
        ...acceptanceEnvironment(home, agentsHome),
        DEEPSEEK_API_KEY: 'fusion-acceptance-local-provider',
        DEEPSEEK_BASE_URL: provider.baseUrl,
      }
      await resources.acquire(
        'subprocess fiber',
        async () => await subprocessContext.plugin(LocalSubprocessRuntime),
        async (fiber) => { await fiber.dispose() },
      )
      await resources.settle('profile directories', async () => {
        await Promise.all([
          mkdir(agentsHome, { recursive: true }),
          mkdir(workspace, { recursive: true }),
        ])
        await writeFile(join(workspace, 'fusion.txt'), 'FUSION_FILE_OK\n')
      })
      const canonicalWorkspace = await realpath(workspace)
      await resources.settle('profile setup and pnpm install', async () => {
        await setupFusionAcceptanceProfile(FIXTURE_ROOT, profile, async () => {
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
            operationSignal,
          )
          expect(install.exitCode, `profile install failed:\n${install.stderr}`).toBe(0)
          expect(install.signal).toBeNull()
        })
      })

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
      serverUrls.push(server.url)
      expect(
        await server.handle.waitForExit(AbortSignal.abort()),
        'fusion CLI exited after readiness',
      ).toBe(false)

      const createdWorkspace = await rpc<{
        workspace: { workspaceId: string }
      }>(server.url, 'workspace.create', { path: workspace }, operationSignal)
      const source = await rpc<{ sessionId: string }>(server.url, 'session.create', {
        workspaceId: createdWorkspace.workspace.workspaceId,
      }, operationSignal)

      operationSignal.throwIfAborted()
      const browser = await resources.acquire(
        'browser',
        async () => await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 30_000 }),
        async (ownedBrowser) => { await ownedBrowser.close() },
      )
      const browserContext = await resources.acquire(
        'browser context',
        async () => await browser.newContext({
          acceptDownloads: true,
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
      const diagnostics = watchPage(page)
      expect(await page.evaluate(() => navigator.language)).toBe('en-US')

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
      const continueButton = welcomeNotice.getByRole('button', { name: /^(Continue|继续)$/u })
      await continueButton.press('Enter')
      await welcomeNotice.waitFor({ state: 'detached', timeout: 10_000 })

      const settingsTrigger = page.locator('button[aria-haspopup="dialog"]')
      expect(await settingsTrigger.count()).toBe(1)
      await settingsTrigger.press('Enter')
      const settings = page.getByRole('dialog', { name: /^(Settings|设置)$/u })
      await settings.waitFor({ timeout: 10_000 })
      await settings.getByRole('button', { name: /^(Plugins|插件)$/u }).press('Enter')
      await settings.getByRole('tab', { name: /^(Plugin list|插件列表)$/u }).press('Enter')
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
      expect(petState.headers).toContainEqual([
        'content-type',
        [expect.stringMatching(/^application\/json\b/u)],
      ])
      const petSnapshot = JSON.parse(httpResponseBodyText(petState)) as {
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
      expect(diagnostics.started.map(request => request.url)
        .filter(url => isForbidden(new URL(url).pathname))).toEqual([])

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
      expect(server.getStderr()).not.toMatch(
        /Loader activation failure|unhandled rejection|uncaught exception|Failed to load plugins/iu,
      )
      expect(
        await server.handle.waitForExit(AbortSignal.abort()),
        'fusion CLI exited during browser assertions',
      ).toBe(false)
      server = await runFusionWebRegression({
        browser,
        context: browserContext,
        diagnostics,
        env,
        page,
        provider,
        resources,
        runtime: subprocessContext.subprocess,
        server,
        serverUrls,
        signal: operationSignal,
        sourceSessionId: source.sessionId,
        workspace: canonicalWorkspace,
      })
      const isolation = await runFreshProfileIsolation(
        subprocessContext.subprocess,
        canonicalWorkspace,
        env,
        temporaryRoot,
        operationSignal,
      )
      await runHeadlessTurn(
        subprocessContext.subprocess,
        canonicalWorkspace,
        env,
        isolation.headlessHome,
        operationSignal,
      )
      await runAcpStdioSmoke(
        subprocessContext.subprocess,
        env,
        temporaryRoot,
        operationSignal,
      )
      await runAcpResolvedComposition(
        subprocessContext.subprocess,
        env,
        temporaryRoot,
        operationSignal,
      )
    },
    cleanup: async (cleanupSignal) => {
      cleanupSignal.throwIfAborted()
      await cdpVersion(cleanupSignal)
      const remainingTargets = await cdpTargets(cleanupSignal)
      for (const serverUrl of serverUrls) {
        expect(
          [...remainingTargets.values()].filter(target => isServerPageTarget(target, serverUrl)),
          `Fusion acceptance page remained open at ${serverUrl}`,
        ).toEqual([])
      }
    },
  })
}, FUSION_ACCEPTANCE_TIMEOUT_MS)

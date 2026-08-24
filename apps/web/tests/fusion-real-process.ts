import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { copyFile, mkdir, readFile, realpath } from 'node:fs/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { SubprocessHandle, SubprocessOutcome, SubprocessRuntime, SubprocessSpawnSpec } from '@deepseek-ai/dsh-subprocess'
import type { ContextSnapshotSection, ToolSchema } from '@deepseek-ai/dsh-llm'
import { JSDOM } from 'jsdom'

const DIAGNOSTIC_OUTPUT_MAX_BYTES = 64 * 1024
const BOOT_ASSIGNMENT_PREFIX = 'window.__DSH_BOOT__ = '
const PET_ENTRY_ID = '@linxin666/dsh-pet'
const FUSION_COMPACT_SUMMARY =
  'Fusion compact summary: the tracked Pet-only regression remains complete.'
const FUSION_COMPACT_PROVIDER = 'deepseek-official'
const FUSION_COMPACT_MODEL = 'deepseek-v4-flash'
const FUSION_PROFILE_FIXTURE_FILES = [
  'cordis.patch.yml',
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
] as const
// Node generates these connection/framing fields per request. Body bytes are
// compared directly, including after the permitted Pet boot-entry rewrite.
const HTTP_TRANSPORT_HEADERS = new Set([
  'connection',
  'content-length',
  'date',
  'keep-alive',
  'transfer-encoding',
])
const PET_INJECT = [
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-ui-conversation',
] as const
const FUSION_COMPOSITION_TOKENS = [
  '@deepseek-ai/dsh-fusion',
  '@linxin666/dsh-pet',
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

/** Total Vitest budget for the Fusion acceptance, including its final cleanup. */
export const FUSION_ACCEPTANCE_TIMEOUT_MS = 600_000

/** Cleanup reserve excluded from the acceptance's cancellable operation budget. */
export const FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS = 30_000

/** Vitest return and reporting reserve after acceptance cleanup. */
export const FUSION_ACCEPTANCE_FRAMEWORK_HEADROOM_MS = 30_000

/** Cancellable operation budget before cleanup and framework reserves. */
export const FUSION_ACCEPTANCE_OPERATION_TIMEOUT_MS =
  FUSION_ACCEPTANCE_TIMEOUT_MS
  - FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS
  - FUSION_ACCEPTANCE_FRAMEWORK_HEADROOM_MS

/** Inputs for an acceptance operation whose cleanup must begin on cancellation. */
export interface AcceptanceLifecycleOptions<T> {
  cleanup(signal: AbortSignal): Promise<void>
  cleanupTimeoutMs: number
  operation(signal: AbortSignal, resources: AcceptanceResourceOwner): Promise<T>
  operationTimeoutMs: number
  testSignal: AbortSignal
}

interface ObservedPromise<T> {
  done: Promise<void>
  state:
    | { status: 'pending' }
    | { status: 'fulfilled'; value: T }
    | { reason: unknown; status: 'rejected' }
}

interface OwnedAcquisition<T> {
  acquired: ObservedPromise<T>
  disposal: ObservedPromise<void> | undefined
  dispose(signal: AbortSignal): Promise<void>
  label: string
}

interface AcceptanceCleanupDeadline {
  dispose(): void
  expired: Promise<void>
  signal: AbortSignal
  timeoutMs: number
}

/** Transactional owner for resources acquired by one acceptance operation. */
interface AcceptanceResourceOwner {
  /**
   * Register an acquisition before it starts and dispose its result during lifecycle cleanup.
   * @param label - Resource name used in cleanup diagnostics.
   * @param acquire - Acquisition started only after ownership is registered.
   * @param dispose - Teardown for a successfully acquired resource.
   * @returns The acquired resource while the lifecycle remains active.
   */
  acquire<T>(
    label: string,
    acquire: () => Promise<T>,
    dispose: (resource: T, signal: AbortSignal) => Promise<void>,
  ): Promise<T>

  /**
   * Release one acquired resource before final lifecycle cleanup.
   * @param resource - Value previously returned by `acquire`.
   */
  release(resource: unknown): Promise<void>

  /**
   * Register a self-cleaning resource operation that must settle before lifecycle return.
   * @param label - Operation name used in cleanup diagnostics.
   * @param run - Signal-aware operation with its own rollback.
   * @returns The operation result while the lifecycle remains active.
   */
  settle<T>(label: string, run: () => Promise<T>): Promise<T>
}

/** Result with decoded stdout/stderr suffixes whose UTF-8 encoding is at most 64 KiB each. */
export interface ManagedCommandResult extends SubprocessOutcome {
  stderr: string
  stdout: string
}

/** Live process retained after its readiness marker appears. */
export interface ReadyProcess {
  done: Promise<ManagedCommandResult>
  getStderr(): string
  getStdout(): string
  handle: SubprocessHandle
  ready: string
}

/** Fields required from the system Chrome `/json/version` response. */
export interface SystemChromeVersion {
  Browser: string
  'Protocol-Version': string
  webSocketDebuggerUrl: string
}

/** Normalized complete response data observed from one route probe. */
export interface HttpResponseSnapshot {
  body: Buffer
  headers: Array<readonly [name: string, values: readonly string[]]>
  status: number
}

interface BootGraph {
  entries: unknown[]
  rev: string
}

interface ParsedBootGraph {
  contentEnd: number
  contentStart: number
  graph: BootGraph
}

/** Stable fields passed into one scoped model request. */
export interface ModelInputSnapshot {
  contexts: ContextSnapshotSection[]
  system: string
  tools: ToolSchema[]
}

/** One completed browser export operation and its HEAD request identity. */
export interface FusionExportLedgerEntry {
  action: 'header' | 'slash'
  completed: boolean
  downloadUrl: string
  headRequestId: string
  headStatus: number
  headUrl: string
  zipSha256: string
}

/** One browser request failure retained for export identity checks. */
export interface FusionNetworkFailure {
  errorText: string
  method: string
  requestId: string
  url: string
}

/** Minimal durable event fields consumed by the compact lifecycle oracle. */
export interface FusionCompactEvent {
  data?: Record<string, unknown>
  seq?: number
  sourceEventSeqs?: number[]
  surfaceOp?: unknown
  type: string
}

function isSafeIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.every((item: unknown) => typeof item === 'number' && Number.isSafeInteger(item))
}

/**
 * Require the two export actions to own distinct, complete downloads and HEAD aborts.
 * @param ledger - Header and slash export records in execution order.
 * @param failures - Browser request failures observed for the page.
 * @param downloads - Download URLs observed for the page.
 */
export function assertFusionExportLedger(
  ledger: readonly FusionExportLedgerEntry[],
  failures: readonly FusionNetworkFailure[],
  downloads: readonly string[],
): void {
  if (JSON.stringify(ledger.map(entry => entry.action)) !== '["header","slash"]') {
    throw new Error('Fusion exports must run in header then slash order')
  }
  if (new Set(ledger.map(entry => entry.headRequestId)).size !== ledger.length) {
    throw new Error('Fusion exports must use unique HEAD request ids')
  }
  for (const entry of ledger) {
    if (entry.headStatus !== 200) {
      throw new Error(`${entry.action} export HEAD returned ${String(entry.headStatus)}`)
    }
    if (entry.downloadUrl !== entry.headUrl) {
      throw new Error(`${entry.action} export download URL differs from its HEAD URL`)
    }
    if (!entry.completed) {
      throw new Error(`${entry.action} export download did not complete`)
    }
    if (!/^[a-f0-9]{64}$/u.test(entry.zipSha256)) {
      throw new Error(`${entry.action} export ZIP SHA-256 is invalid`)
    }
  }
  if (failures.length !== ledger.length) {
    throw new Error('Fusion export abort count differs from the export ledger')
  }
  for (const entry of ledger) {
    const matches = failures.filter(failure => failure.requestId === entry.headRequestId)
    if (matches.length !== 1) {
      throw new Error(`${entry.action} export HEAD abort identity is not unique`)
    }
    const failure = matches[0]!
    if (
      failure.method !== 'HEAD'
      || failure.url !== entry.headUrl
      || failure.errorText !== 'net::ERR_ABORTED'
    ) {
      throw new Error(`${entry.action} export HEAD abort does not match its request`)
    }
  }
  const actualDownloads = [...downloads].sort()
  const expectedDownloads = ledger.map(entry => entry.downloadUrl).sort()
  if (JSON.stringify(actualDownloads) !== JSON.stringify(expectedDownloads)) {
    throw new Error('Fusion export download URL multiset differs from the ledger')
  }
}

/**
 * Require the selected session row to be the returned fork child.
 * @param selectedCount - Number of selected session rows.
 * @param selectedTitle - Exact title rendered in the selected row.
 * @param childId - Child id returned by `session.fork`.
 */
export function assertFusionForkSelection(
  selectedCount: number,
  selectedTitle: string,
  childId: string,
): void {
  if (selectedCount !== 1) throw new Error('Fusion fork must select exactly one session row')
  if (selectedTitle !== `Fusion fork ${childId}`) {
    throw new Error('Fusion fork selected row is not bound to the returned child id')
  }
}

/**
 * Require one successful command and compaction transaction with shared identities.
 * @param events - Durable session events after `/compact` settles.
 * @returns The compact command id.
 */
export function assertFusionCompactLifecycle(
  events: readonly FusionCompactEvent[],
): string {
  const runs = events.filter(event =>
    event.type === 'command/run' && event.data?.name === 'compact')
  if (runs.length !== 1) throw new Error('expected exactly one compact command/run')
  const commandId = runs[0]?.data?.commandId
  if (typeof commandId !== 'string') {
    throw new Error('compact command/run omitted its command id')
  }
  const done = events.filter(event =>
    event.type === 'command/done' && event.data?.commandId === commandId)
  if (done.length !== 1 || done[0]?.data?.kind !== 'success') {
    throw new Error('compact command/done is missing, duplicated, or unsuccessful')
  }
  const compactionEvents = ['compaction/start', 'compaction/summary', 'compaction/end']
    .map((type) => {
      const matches = events.filter(event =>
        event.type === type && event.data?.sourceCommandId === commandId)
      if (matches.length !== 1) {
        throw new Error(`${type} does not uniquely reference the compact command`)
      }
      return matches[0]!
    })
  const compactionId = compactionEvents[0]!.data?.compactionId
  if (
    typeof compactionId !== 'string'
    || compactionEvents.some(event => event.data?.compactionId !== compactionId)
  ) {
    throw new Error('compact lifecycle does not share one compaction id')
  }
  const linkedSummarySeq = compactionEvents[1]!.seq
  if (typeof linkedSummarySeq !== 'number' || done[0].data?.sourceEventSeq !== linkedSummarySeq) {
    throw new Error('compact command/done does not reference the summary event')
  }
  if (Object.hasOwn(compactionEvents[2]!.data ?? {}, 'error')) {
    throw new Error('compact lifecycle ended with an error')
  }
  const [start, summary, end] = compactionEvents
  const runSeq = runs[0]?.seq
  const startSeq = start?.seq
  const summarySeq = summary?.seq
  const endSeq = end?.seq
  const doneSeq = done[0]?.seq
  if (
    typeof runSeq !== 'number'
    || typeof startSeq !== 'number'
    || typeof summarySeq !== 'number'
    || typeof endSeq !== 'number'
    || typeof doneSeq !== 'number'
    || !(runSeq < startSeq && startSeq < summarySeq && summarySeq < endSeq && endSeq < doneSeq)
  ) {
    throw new Error('compact lifecycle events are out of order')
  }
  if (
    JSON.stringify(summary!.data?.summary)
      !== JSON.stringify([{ type: 'text', text: FUSION_COMPACT_SUMMARY }])
    || summary!.data?.provider !== FUSION_COMPACT_PROVIDER
    || summary!.data?.model !== FUSION_COMPACT_MODEL
  ) {
    throw new Error('compact summary content, provider, or model is incorrect')
  }
  const shadowedRange = summary!.data?.shadowedRange as {
    end?: unknown
    start?: unknown
  } | undefined
  const shadowedSeqs = summary!.data?.shadowedSeqs
  const shadowedTokenCount = summary!.data?.shadowedTokenCount
  if (
    shadowedRange === undefined
    || !isSafeIntegerArray(shadowedSeqs)
    || shadowedSeqs.length === 0
    || shadowedRange.start !== shadowedSeqs[0]
    || shadowedRange.end !== shadowedSeqs.at(-1)
    || !Number.isSafeInteger(shadowedTokenCount)
    || (shadowedTokenCount as number) <= 0
    || shadowedSeqs.some(seq => !events.some(event => event.seq === seq))
  ) {
    throw new Error('compact summary shadowed range, seqs, or token count is incorrect')
  }
  const summaryIndex = events.indexOf(summary!)
  const replacement = events[summaryIndex + 1]
  const replacementSource = replacement?.data?.source as Record<string, unknown> | undefined
  const replacementSurface = replacement?.surfaceOp as Record<string, unknown> | undefined
  if (
    replacement?.type !== 'user/message'
    || replacement.seq !== summarySeq + 1
    || replacementSurface?.op !== 'replace'
    || replacementSurface.start !== shadowedRange.start
    || replacementSurface.end !== shadowedRange.end
    || replacementSource?.kind !== 'plugin'
    || replacementSource.plugin !== 'compact'
    || replacementSource.compactionId !== compactionId
    || replacementSource.sourceCommandId !== commandId
    || JSON.stringify(replacement.sourceEventSeqs)
      !== JSON.stringify([startSeq, summarySeq, ...shadowedSeqs])
  ) {
    throw new Error('compact summary is not immediately followed by its bound replacement')
  }
  if (
    replacement.seq >= endSeq
    || endSeq >= doneSeq
    || done[0].data?.text
      !== `Compacted ${String(shadowedSeqs.length)} history items (~${String(shadowedTokenCount)} tokens).`
  ) {
    throw new Error('compact replacement, end, or done event is inconsistent')
  }
  return commandId
}

/**
 * Require a stock profile or ACP composition to exclude Fusion and every external row.
 * @param label - Composition name used in diagnostics.
 * @param text - Serialized config or dump output.
 */
export function assertFusionExcludedFromComposition(label: string, text: string): void {
  const normalized = text.toLowerCase()
  const found = FUSION_COMPOSITION_TOKENS.find(token => normalized.includes(token))
  if (found !== undefined) {
    throw new Error(`${label} unexpectedly contains ${found}`)
  }
}

/**
 * Populate and install the exact Fusion acceptance profile.
 * @param source - Fixture directory containing the tracked profile inputs.
 * @param target - Empty profile directory to populate.
 * @param install - Frozen, profile-local installation operation.
 * @returns The resolved Pet entry after installation.
 */
export async function setupFusionAcceptanceProfile(
  source: string,
  target: string,
  install: () => Promise<void>,
): Promise<string> {
  await mkdir(target, { recursive: true })
  await Promise.all(FUSION_PROFILE_FIXTURE_FILES.map(async (file) => {
    await copyFile(join(source, file), join(target, file))
  }))
  if (existsSync(join(target, 'node_modules'))) {
    throw new Error('Fusion acceptance profile inherited fixture node_modules before installation')
  }
  await install()
  const requireFromProfile = createRequire(join(target, 'package.json'))
  const packageJsonPath = requireFromProfile.resolve(`${PET_ENTRY_ID}/package.json`)
  const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    main?: unknown
    name?: unknown
    version?: unknown
  }
  if (
    manifest.name !== PET_ENTRY_ID
    || manifest.version !== '0.2.9'
    || manifest.main !== 'lib/index.js'
  ) {
    throw new Error('Fusion acceptance profile did not install @linxin666/dsh-pet@0.2.9')
  }
  const mainPath = await realpath(requireFromProfile.resolve(PET_ENTRY_ID))
  const expectedMainPath = await realpath(join(dirname(packageJsonPath), 'lib/index.js'))
  if (mainPath !== expectedMainPath) {
    throw new Error('Fusion acceptance profile resolved an unexpected Pet entry')
  }
  return mainPath
}

/**
 * Decode response bytes for JSON or HTML consumers after snapshot capture.
 * @param response - Snapshot whose original bytes remain available for equality checks.
 * @returns The UTF-8 response text.
 */
export function httpResponseBodyText(response: HttpResponseSnapshot): string {
  return response.body.toString('utf8')
}

/** Explicit environment additions for the isolated Fusion profile. */
export function acceptanceEnvironment(home: string, agentsHome: string): NodeJS.ProcessEnv {
  return {
    DEEPSEEK_API_KEY: 'fusion-acceptance-no-model-call',
    DEEPSEEK_BASE_URL: undefined,
    DSH_AGENTS_HOME: agentsHome,
    DSH_HOME: home,
    DSH_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: undefined,
  }
}

/**
 * Route child-process temporary files into a root owned by the acceptance lifecycle.
 * @param env - Existing explicit child environment.
 * @param temporaryRoot - Directory removed by the lifecycle resource owner.
 * @returns The environment with every supported temporary-directory variable scoped.
 */
export function withOwnedTemporaryRoot(
  env: NodeJS.ProcessEnv,
  temporaryRoot: string,
): NodeJS.ProcessEnv {
  return {
    ...env,
    TMPDIR: temporaryRoot,
    TMP: temporaryRoot,
    TEMP: temporaryRoot,
  }
}

function signalReason(signal: AbortSignal, label: string): Error {
  const reason: unknown = signal.reason
  return reason instanceof Error ? reason : new Error(`${label} was cancelled`)
}

function caughtError(error: unknown, label: string): Error {
  return error instanceof Error ? error : new Error(label, { cause: error })
}

function observePromise<T>(promise: Promise<T>): ObservedPromise<T> {
  const observed: ObservedPromise<T> = {
    done: Promise.resolve(),
    state: { status: 'pending' },
  }
  observed.done = promise.then(
    (value) => {
      observed.state = { status: 'fulfilled', value }
    },
    (reason: unknown) => {
      observed.state = { reason, status: 'rejected' }
    },
  )
  return observed
}

function createAcceptanceCleanupDeadline(timeoutMs: number): AcceptanceCleanupDeadline {
  const controller = new AbortController()
  const expired = Promise.withResolvers<undefined>()
  const timer = setTimeout(() => {
    controller.abort(new Error(
      `acceptance cleanup exceeded its ${String(timeoutMs)}ms total deadline`,
    ))
    expired.resolve(undefined)
  }, timeoutMs)
  return {
    dispose: () => { clearTimeout(timer) },
    expired: expired.promise,
    signal: controller.signal,
    timeoutMs,
  }
}

async function settlesBeforeDeadline(
  observed: ObservedPromise<unknown>,
  deadline: AcceptanceCleanupDeadline,
): Promise<boolean> {
  if (observed.state.status !== 'pending') return true
  await Promise.race([observed.done, deadline.expired])
  return observed.state.status !== 'pending'
}

function cleanupDeadlineFailure(subject: string, timeoutMs: number): Error {
  return new Error(
    `${subject} did not settle before the ${String(timeoutMs)}ms cleanup deadline`,
  )
}

class AcceptanceResourceOwnerImpl implements AcceptanceResourceOwner {
  private readonly acquisitions: Array<OwnedAcquisition<unknown>> = []
  private readonly byValue = new Map<unknown, OwnedAcquisition<unknown>>()
  private cleanupDeadline: AcceptanceCleanupDeadline | undefined
  private closing = false

  constructor(private readonly operationSignal: AbortSignal) {}

  async acquire<T>(
    label: string,
    acquire: () => Promise<T>,
    dispose: (resource: T, signal: AbortSignal) => Promise<void>,
  ): Promise<T> {
    if (this.closing) throw signalReason(this.operationSignal, label)
    const acquired = observePromise(Promise.resolve().then(acquire))
    const owned: OwnedAcquisition<T> = {
      acquired,
      disposal: undefined,
      label,
      dispose: async (signal) => {
        await acquired.done
        if (acquired.state.status !== 'fulfilled') return
        const resource = acquired.state.value
        owned.disposal ??= observePromise(
          Promise.resolve().then(() => dispose(resource, signal)),
        )
        await owned.disposal.done
        if (owned.disposal.state.status === 'rejected') {
          throw owned.disposal.state.reason
        }
      },
    }
    this.acquisitions.push(owned)
    await acquired.done
    if (acquired.state.status === 'rejected') throw acquired.state.reason
    if (acquired.state.status === 'pending') {
      throw new Error(`${label} acquisition did not settle`)
    }
    const value = acquired.state.value
    this.byValue.set(value, owned)
    if (this.closing) {
      await owned.dispose(this.cleanupDeadline!.signal)
      throw signalReason(this.operationSignal, label)
    }
    return value
  }

  async release(resource: unknown): Promise<void> {
    const owned = this.byValue.get(resource)
    if (owned === undefined) throw new Error('acceptance resource is not owned by this lifecycle')
    await owned.dispose(this.cleanupDeadline?.signal ?? this.operationSignal)
  }

  async settle<T>(label: string, run: () => Promise<T>): Promise<T> {
    return await this.acquire(label, run, async () => {})
  }

  async close(deadline: AcceptanceCleanupDeadline): Promise<unknown[]> {
    this.closing = true
    this.cleanupDeadline = deadline
    const failures: unknown[] = []
    for (const owned of [...this.acquisitions].reverse()) {
      if (deadline.signal.aborted) {
        if (owned.acquired.state.status === 'pending') {
          failures.push(cleanupDeadlineFailure(
            `${owned.label} acquisition`,
            deadline.timeoutMs,
          ))
        } else if (owned.acquired.state.status === 'fulfilled') {
          const disposal = owned.disposal
          if (disposal === undefined) {
            observePromise(owned.dispose(deadline.signal))
            failures.push(cleanupDeadlineFailure(
              `${owned.label} disposer`,
              deadline.timeoutMs,
            ))
          } else if (disposal.state.status === 'pending') {
            failures.push(cleanupDeadlineFailure(
              `${owned.label} disposer`,
              deadline.timeoutMs,
            ))
          } else if (disposal.state.status === 'rejected') {
            failures.push(caughtError(
              disposal.state.reason,
              `${owned.label} cleanup threw a non-Error value`,
            ))
          }
        }
        continue
      }
      const disposal = observePromise(owned.dispose(deadline.signal))
      if (!await settlesBeforeDeadline(disposal, deadline)) {
        const subject = owned.acquired.state.status === 'pending'
          ? `${owned.label} acquisition`
          : `${owned.label} disposer`
        failures.push(cleanupDeadlineFailure(subject, deadline.timeoutMs))
      } else if (disposal.state.status === 'rejected') {
        failures.push(caughtError(
          disposal.state.reason,
          `${owned.label} cleanup threw a non-Error value`,
        ))
      }
    }
    return failures
  }
}

/**
 * Run one acceptance operation and start its single cleanup owner as soon as
 * Vitest cancellation or the internal operation deadline aborts. The method
 * observes both operation and cleanup promises. Normal completion waits for
 * quiescence; after cleanup starts, one total deadline bounds every remaining
 * acquisition, teardown, final cleanup, and operation-settlement wait.
 * @param options - Test signal, deadlines, operation, and cleanup owner.
 * @returns The operation result after cleanup reaches settlement within its deadline.
 */
export async function runAcceptanceLifecycle<T>(
  options: AcceptanceLifecycleOptions<T>,
): Promise<T> {
  const operationSignal = AbortSignal.any([
    options.testSignal,
    AbortSignal.timeout(options.operationTimeoutMs),
  ])
  const resources = new AcceptanceResourceOwnerImpl(operationSignal)
  let cancellationFailure: unknown
  let cleanupDeadline: AcceptanceCleanupDeadline | undefined
  let cleanupTask: ObservedPromise<unknown[]> | undefined
  const startCleanup = (): ObservedPromise<unknown[]> => {
    if (cleanupTask !== undefined) return cleanupTask
    cleanupDeadline = createAcceptanceCleanupDeadline(options.cleanupTimeoutMs)
    let cleanup: Promise<unknown[]>
    try {
      cleanup = resources.close(cleanupDeadline).then(async (resourceFailures) => {
        let finalCleanup: ObservedPromise<void>
        try {
          finalCleanup = observePromise(options.cleanup(cleanupDeadline!.signal))
        } catch (error) {
          return [...resourceFailures, error]
        }
        if (!await settlesBeforeDeadline(finalCleanup, cleanupDeadline!)) {
          return [
            ...resourceFailures,
            cleanupDeadlineFailure(
              'acceptance final cleanup',
              cleanupDeadline!.timeoutMs,
            ),
          ]
        }
        if (finalCleanup.state.status === 'rejected') {
          return [...resourceFailures, finalCleanup.state.reason]
        }
        if (finalCleanup.state.status === 'fulfilled') {
          return resourceFailures
        }
        return [
          ...resourceFailures,
          cleanupDeadlineFailure(
            'acceptance final cleanup',
            cleanupDeadline!.timeoutMs,
          ),
        ]
      })
    } catch (error) {
      cleanup = Promise.reject(caughtError(error, 'acceptance cleanup threw a non-Error value'))
    }
    cleanupTask = observePromise(cleanup)
    return cleanupTask
  }
  const cancelled = Promise.withResolvers<undefined>()
  const onAbort = (): void => {
    cancellationFailure = signalReason(operationSignal, 'acceptance operation')
    startCleanup()
    cancelled.resolve(undefined)
  }
  if (operationSignal.aborted) onAbort()
  else operationSignal.addEventListener('abort', onAbort, { once: true })

  let operation: Promise<T>
  try {
    operation = options.operation(operationSignal, resources)
  } catch (error) {
    operation = Promise.reject(caughtError(error, 'acceptance operation threw a non-Error value'))
  }
  const observedOperation = observePromise(operation)
  await Promise.race([observedOperation.done, cancelled.promise])
  if (observedOperation.state.status !== 'pending') {
    operationSignal.removeEventListener('abort', onAbort)
  }

  const cleanupFailures: unknown[] = []
  try {
    const cleanup = startCleanup()
    await cleanup.done
    if (cleanup.state.status === 'rejected') {
      cleanupFailures.push(cleanup.state.reason)
    } else if (cleanup.state.status === 'fulfilled') {
      cleanupFailures.push(...cleanup.state.value)
    } else {
      cleanupFailures.push(new Error('acceptance cleanup did not settle'))
    }
    await Promise.race([observedOperation.done, cleanupDeadline!.expired])
  } finally {
    operationSignal.removeEventListener('abort', onAbort)
    cleanupDeadline?.dispose()
  }

  const failures: unknown[] = []
  const addFailure = (failure: unknown): void => {
    const hasIdentity = (
      (typeof failure === 'object' && failure !== null)
      || typeof failure === 'function'
    )
    if (!hasIdentity || !failures.includes(failure)) failures.push(failure)
  }
  if (cancellationFailure !== undefined) addFailure(cancellationFailure)
  if (observedOperation.state.status === 'rejected') {
    addFailure(observedOperation.state.reason)
  } else if (observedOperation.state.status === 'pending') {
    addFailure(cleanupDeadlineFailure(
      'acceptance operation',
      options.cleanupTimeoutMs,
    ))
  }
  for (const failure of cleanupFailures) addFailure(failure)
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(failures, 'Fusion REAL composition acceptance failed')
  }
  if (observedOperation.state.status !== 'fulfilled') {
    throw new Error('acceptance operation did not settle')
  }
  return observedOperation.state.value
}

/**
 * Require Fusion to preserve one route's complete stable HTTP response.
 * @param baseline - Response from the independently booted base and web-app profile.
 * @param fusion - Response from the Fusion profile.
 * @param label - HTTP method and pathname used in diagnostics.
 */
export function assertSameHttpResponse(
  baseline: HttpResponseSnapshot,
  fusion: HttpResponseSnapshot,
  label: string,
): void {
  if (
    baseline.status === fusion.status
    && JSON.stringify(baseline.headers) === JSON.stringify(fusion.headers)
    && baseline.body.equals(fusion.body)
  ) return
  throw new Error(
    `${label} differs from the base + web-app response`
    + `\nbaseline: ${JSON.stringify(baseline)}`
    + `\nfusion: ${JSON.stringify(fusion)}`,
  )
}

function failPetOnlyComparison(label: string, detail: string): never {
  throw new Error(`${label} differs from the base + web-app response: ${detail}`)
}

function parseBootGraph(body: Buffer, label: string): ParsedBootGraph {
  const dom = new JSDOM(body.toString('utf8'))
  try {
    const scripts = [...dom.window.document.querySelectorAll('script')]
      .filter(script => script.textContent?.includes('window.__DSH_BOOT__') ?? false)
    if (scripts.length !== 1) {
      return failPetOnlyComparison(
        label,
        `expected exactly one window.__DSH_BOOT__ assignment, found ${String(scripts.length)}`,
      )
    }
    const script = scripts[0]!
    const source = script.textContent ?? ''
    if (!source.startsWith(BOOT_ASSIGNMENT_PREFIX)) {
      return failPetOnlyComparison(label, 'window.__DSH_BOOT__ assignment is malformed')
    }
    let value: unknown
    try {
      value = JSON.parse(source.slice(BOOT_ASSIGNMENT_PREFIX.length))
    } catch {
      return failPetOnlyComparison(label, 'window.__DSH_BOOT__ assignment is not JSON')
    }
    if (
      typeof value !== 'object'
      || value === null
      || Array.isArray(value)
      || typeof (value as { rev?: unknown }).rev !== 'string'
      || !Array.isArray((value as { entries?: unknown }).entries)
    ) {
      return failPetOnlyComparison(label, 'window.__DSH_BOOT__ payload is malformed')
    }
    const sourceBytes = Buffer.from(source)
    const contentStart = body.indexOf(sourceBytes)
    if (
      contentStart < 0
      || body.indexOf(sourceBytes, contentStart + sourceBytes.length) >= 0
    ) {
      return failPetOnlyComparison(label, 'window.__DSH_BOOT__ raw payload is not unique')
    }
    return {
      contentStart,
      contentEnd: contentStart + sourceBytes.length,
      graph: value as BootGraph,
    }
  } finally {
    dom.window.close()
  }
}

function bootGraphRevision(entries: readonly unknown[]): string {
  return createHash('sha1').update(JSON.stringify(entries)).digest('hex').slice(0, 12)
}

function assertValidGraphRevision(graph: BootGraph, label: string): void {
  if (graph.rev !== bootGraphRevision(graph.entries)) {
    failPetOnlyComparison(label, 'boot graph revision is not derived from its ordered entries')
  }
}

function assertValidPetEntry(value: unknown, label: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    failPetOnlyComparison(label, 'Pet boot entry is malformed')
  }
  const entry = value as Record<string, unknown>
  const keys = Object.keys(entry)
  if (
    keys.length !== 4
    || !['id', 'url', 'rev', 'inject'].every(key => keys.includes(key))
  ) {
    failPetOnlyComparison(label, 'Pet boot entry has unexpected fields')
  }
  if (
    entry.id !== PET_ENTRY_ID
    || typeof entry.rev !== 'string'
    || entry.rev.length !== 12
    || entry.rev.split('').some(character => !'0123456789abcdef'.includes(character))
    || entry.url !== `/plugins/${PET_ENTRY_ID}/client.js?rev=${entry.rev}`
  ) {
    failPetOnlyComparison(label, 'Pet boot entry has an invalid id, URL, or revision')
  }
  if (JSON.stringify(entry.inject) !== JSON.stringify(PET_INJECT)) {
    failPetOnlyComparison(label, 'Pet boot entry has an invalid inject list')
  }
}

/**
 * Require the Fusion root response to differ from the stock root only by one valid Pet boot entry.
 * @param baseline - Root response from the independently booted base and web-app profile.
 * @param fusion - Root response from the Fusion profile.
 * @param label - HTTP method and pathname used in diagnostics.
 * @throws When response metadata, boot data, the Pet entry, revisions, shared entries, or remaining HTML differ.
 */
export function assertPetOnlyRootResponse(
  baseline: HttpResponseSnapshot,
  fusion: HttpResponseSnapshot,
  label: string,
): void {
  if (
    baseline.status !== fusion.status
    || JSON.stringify(baseline.headers) !== JSON.stringify(fusion.headers)
  ) {
    failPetOnlyComparison(label, 'status or headers changed')
  }
  const baselineBoot = parseBootGraph(baseline.body, `${label} baseline`)
  const fusionBoot = parseBootGraph(fusion.body, `${label} Fusion`)
  assertValidGraphRevision(baselineBoot.graph, `${label} baseline`)
  assertValidGraphRevision(fusionBoot.graph, `${label} Fusion`)

  const baselinePetEntries = baselineBoot.graph.entries.filter(entry =>
    typeof entry === 'object'
    && entry !== null
    && !Array.isArray(entry)
    && (entry as { id?: unknown }).id === PET_ENTRY_ID)
  if (baselinePetEntries.length !== 0) {
    failPetOnlyComparison(label, 'baseline boot graph contains Pet')
  }
  const petIndexes = fusionBoot.graph.entries.flatMap((entry, index) =>
    typeof entry === 'object'
    && entry !== null
    && !Array.isArray(entry)
    && (entry as { id?: unknown }).id === PET_ENTRY_ID
      ? [index]
      : [])
  if (petIndexes.length !== 1) {
    failPetOnlyComparison(
      label,
      `Fusion boot graph contains ${String(petIndexes.length)} Pet entries`,
    )
  }
  const petIndex = petIndexes[0]!
  assertValidPetEntry(fusionBoot.graph.entries[petIndex], label)
  const sharedEntries = fusionBoot.graph.entries.filter((_entry, index) => index !== petIndex)
  if (JSON.stringify(sharedEntries) !== JSON.stringify(baselineBoot.graph.entries)) {
    failPetOnlyComparison(label, 'shared boot entries changed or were reordered')
  }

  const normalizedGraph = {
    ...fusionBoot.graph,
    rev: bootGraphRevision(sharedEntries),
    entries: sharedEntries,
  }
  const normalizedBody = Buffer.concat([
    fusion.body.subarray(0, fusionBoot.contentStart),
    Buffer.from(BOOT_ASSIGNMENT_PREFIX + JSON.stringify(normalizedGraph)),
    fusion.body.subarray(fusionBoot.contentEnd),
  ])
  if (!normalizedBody.equals(baseline.body)) {
    failPetOnlyComparison(label, 'HTML outside the allowed Pet boot delta changed')
  }
}

function normalizeRawHeaders(
  rawHeaders: readonly string[],
): Array<readonly [name: string, values: readonly string[]]> {
  const valuesByName = new Map<string, string[]>()
  for (let index = 0; index < rawHeaders.length; index += 2) {
    const name = rawHeaders[index]!.toLowerCase()
    if (HTTP_TRANSPORT_HEADERS.has(name)) continue
    const values = valuesByName.get(name)
    if (values === undefined) valuesByName.set(name, [rawHeaders[index + 1]!])
    else values.push(rawHeaders[index + 1]!)
  }
  return [...valuesByName].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
}

/**
 * Require Fusion to preserve every model-visible field assembled for one agent.
 * @param baseline - Scoped request input from the base and web-app profile.
 * @param fusion - Equivalent scoped request input from the Fusion profile.
 */
export function assertSameModelInput(
  baseline: ModelInputSnapshot,
  fusion: ModelInputSnapshot,
): void {
  if (JSON.stringify(baseline) === JSON.stringify(fusion)) return
  throw new Error(
    'Fusion scoped model input differs from the base + web-app baseline'
    + `\nbaseline: ${JSON.stringify(baseline)}`
    + `\nfusion: ${JSON.stringify(fusion)}`,
  )
}

/**
 * Read one complete HTTP response under a single deadline.
 * @param url - Route URL to request.
 * @param init - Request method, headers, and body.
 * @param timeoutMs - Deadline covering headers and the complete body.
 * @param signal - Optional acceptance-wide cancellation signal.
 * @returns Stable response fields suitable for baseline comparison.
 */
export async function readHttpResponse(
  url: URL,
  init?: RequestInit,
  timeoutMs = 5_000,
  signal?: AbortSignal,
): Promise<HttpResponseSnapshot> {
  const signals = [
    AbortSignal.timeout(timeoutMs),
    init?.signal ?? undefined,
    signal,
  ].filter((candidate): candidate is AbortSignal => candidate !== undefined)
  const requestSignal = signals.length === 1 ? signals[0]! : AbortSignal.any(signals)
  requestSignal.throwIfAborted()
  const requestBody = init?.body === undefined || init.body === null
    ? undefined
    : Buffer.from(await new Response(init.body).arrayBuffer())
  requestSignal.throwIfAborted()
  const requestHeaders = init?.headers === undefined
    ? undefined
    : Object.fromEntries(new Headers(init.headers))
  const transport = url.protocol === 'http:'
    ? httpRequest
    : url.protocol === 'https:'
      ? httpsRequest
      : undefined
  if (transport === undefined) {
    throw new TypeError(`Unsupported HTTP response protocol: ${url.protocol}`)
  }

  return await new Promise<HttpResponseSnapshot>((resolve, reject) => {
    let settled = false
    const request = transport(url, {
      headers: requestHeaders,
      method: init?.method,
    }, (response) => {
      const status = response.statusCode
      if (status === undefined) {
        response.resume()
        settleReject(new Error(`HTTP response omitted status for ${url.href}`))
        return
      }
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk))
      })
      response.once('aborted', () => {
        settleReject(new Error(`HTTP response body aborted for ${url.href}`))
      })
      response.once('error', settleReject)
      response.once('end', () => {
        settleResolve({
          status,
          headers: normalizeRawHeaders(response.rawHeaders),
          body: Buffer.concat(chunks),
        })
      })
    })
    const removeAbortListener = (): void => {
      requestSignal.removeEventListener('abort', onAbort)
    }
    const settleResolve = (response: HttpResponseSnapshot): void => {
      if (settled) return
      settled = true
      removeAbortListener()
      resolve(response)
    }
    function settleReject(error: unknown): void {
      if (settled) return
      settled = true
      removeAbortListener()
      request.destroy()
      reject(error instanceof Error
        ? error
        : new Error('HTTP response request failed', { cause: error }))
    }
    const onAbort = (): void => {
      settleReject(requestSignal.reason)
    }
    request.once('error', settleReject)
    requestSignal.addEventListener('abort', onAbort, { once: true })
    if (requestSignal.aborted) {
      onAbort()
      return
    }
    request.end(requestBody)
  })
}

/**
 * Check whether a CDP target is an HTTP(S) page from the server origin.
 * @param target - Untrusted target fields returned by CDP discovery.
 * @param serverUrl - Valid HTTP(S) URL reported by the managed server.
 * @returns `true` only for page targets whose normalized origin matches the server.
 */
export function isServerPageTarget(
  target: { type?: unknown; url?: unknown },
  serverUrl: string,
): boolean {
  if (target.type !== 'page' || typeof target.url !== 'string') return false
  const targetUrl = URL.parse(target.url)
  if (targetUrl === null || !['http:', 'https:'].includes(targetUrl.protocol)) return false
  return targetUrl.origin === new URL(serverUrl).origin
}

/** Build one fully explicit managed-process request. */
export function spawnSpec(
  argv: readonly string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  graceMs = 5_000,
): SubprocessSpawnSpec {
  return {
    argv,
    cwd,
    stdio: { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' },
    graceMs,
    ...env === undefined ? {} : { env },
  }
}

class BoundedBufferTail {
  private readonly buffer = Buffer.allocUnsafe(DIAGNOSTIC_OUTPUT_MAX_BYTES)
  private end = 0
  private length = 0
  private truncated = false

  push(chunk: Buffer): void {
    if (this.length + chunk.length > this.buffer.length) this.truncated = true
    const retained = chunk.length > this.buffer.length
      ? chunk.subarray(chunk.length - this.buffer.length)
      : chunk
    if (retained.length === this.buffer.length) {
      retained.copy(this.buffer)
      this.end = 0
      this.length = this.buffer.length
      return
    }
    const firstLength = Math.min(retained.length, this.buffer.length - this.end)
    retained.copy(this.buffer, this.end, 0, firstLength)
    retained.copy(this.buffer, 0, firstLength)
    this.end = (this.end + retained.length) % this.buffer.length
    this.length = Math.min(this.buffer.length, this.length + retained.length)
  }

  /** Decode a valid UTF-8 suffix whose re-encoded size stays within the byte limit. */
  toString(): string {
    if (this.length === 0) return ''
    const start = (this.end - this.length + this.buffer.length) % this.buffer.length
    let bytes = start + this.length <= this.buffer.length
      ? this.buffer.subarray(start, start + this.length)
      : Buffer.concat([
        this.buffer.subarray(start),
        this.buffer.subarray(0, this.end),
      ], this.length)
    if (this.truncated) {
      let firstComplete = 0
      while (firstComplete < bytes.length && (bytes[firstComplete]! & 0xc0) === 0x80) {
        firstComplete += 1
      }
      bytes = bytes.subarray(firstComplete)
    }
    const value = bytes.toString('utf8')
    let encodedBytes = Buffer.byteLength(value, 'utf8')
    if (encodedBytes <= this.buffer.length) return value
    let firstRetained = 0
    for (const character of value) {
      encodedBytes -= Buffer.byteLength(character, 'utf8')
      firstRetained += character.length
      if (encodedBytes <= this.buffer.length) return value.slice(firstRetained)
    }
    return ''
  }
}

function captureOutput(handle: SubprocessHandle): Omit<ReadyProcess, 'ready'> {
  const stderr = new BoundedBufferTail()
  const stdout = new BoundedBufferTail()
  handle.stderr?.on('data', (chunk: Buffer) => { stderr.push(chunk) })
  handle.stdout?.on('data', (chunk: Buffer) => { stdout.push(chunk) })
  return {
    handle,
    done: handle.done.then(outcome => ({
      ...outcome,
      stderr: stderr.toString(),
      stdout: stdout.toString(),
    })),
    getStderr: () => stderr.toString(),
    getStdout: () => stdout.toString(),
  }
}

async function waitForOutput(
  process: Omit<ReadyProcess, 'ready'>,
  pattern: RegExp,
  label: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<string> {
  return await new Promise((resolveReady, rejectReady) => {
    let settled = false
    const cleanup = (): void => {
      clearTimeout(timer)
      process.handle.stdout?.off('data', inspect)
      process.handle.stderr?.off('data', inspect)
      signal?.removeEventListener('abort', onAbort)
    }
    const resolveOnce = (value: string): void => {
      if (settled) return
      settled = true
      cleanup()
      resolveReady(value)
    }
    const rejectOnce = (error: Error): void => {
      if (settled) return
      settled = true
      cleanup()
      rejectReady(error)
    }
    const inspect = (): void => {
      const output = `${process.getStdout()}\n${process.getStderr()}`
      const match = pattern.exec(output)
      if (match !== null) resolveOnce(match[1] ?? match[0])
    }
    const onAbort = (): void => {
      const reason: unknown = signal?.reason
      rejectOnce(reason instanceof Error ? reason : new Error(`${label} was cancelled`))
    }
    const timer = setTimeout(() => {
      rejectOnce(new Error(
        `${label} did not become ready within ${String(timeoutMs)}ms`
        + `\nstdout:\n${process.getStdout()}\nstderr:\n${process.getStderr()}`,
      ))
    }, timeoutMs)
    if (signal?.aborted === true) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    process.handle.stdout?.on('data', inspect)
    process.handle.stderr?.on('data', inspect)
    inspect()
    void process.done.then((outcome) => {
      rejectOnce(new Error(
        `${label} exited before readiness (code ${String(outcome.exitCode)}, signal ${String(outcome.signal)})`
        + `\nstdout:\n${outcome.stdout}\nstderr:\n${outcome.stderr}`,
      ))
    }, (error: unknown) => {
      rejectOnce(new Error(
        `${label} failed before readiness`
        + `\nstdout:\n${process.getStdout()}\nstderr:\n${process.getStderr()}`,
        { cause: error },
      ))
    })
  })
}

type CleanupPhase = 'outcome' | 'tree'

function createCleanupDeadline(
  pid: number,
  timeoutMs: number,
  label?: string,
): {
  dispose(): void
  error(): Error
  setPhase(phase: CleanupPhase): void
  signal: AbortSignal
  timeout: Promise<never>
} {
  const controller = new AbortController()
  let phase: CleanupPhase = 'tree'
  const error = (): Error => {
    const subject = phase === 'tree'
      ? `process tree ${String(pid)}`
      : `process outcome for tree ${String(pid)}`
    return new Error(
      `${label === undefined ? '' : `${label} `}${subject} exceeded ${String(timeoutMs)}ms cleanup budget`,
    )
  }
  const timeout = new Promise<never>((_resolve, reject) => {
    const timer = setTimeout(() => {
      const failure = error()
      controller.abort(failure)
      reject(failure)
    }, timeoutMs)
    controller.signal.addEventListener('abort', () => { clearTimeout(timer) }, { once: true })
  })
  void timeout.catch(() => {})
  return {
    dispose: () => { controller.abort() },
    error,
    setPhase: (nextPhase) => { phase = nextPhase },
    signal: controller.signal,
    timeout,
  }
}

async function cleanupAfterFailure(
  process: Omit<ReadyProcess, 'ready'>,
  primaryFailure: unknown,
  label: string,
  timeoutMs: number,
): Promise<never> {
  const cleanupFailures: unknown[] = []
  void process.done.catch(() => {})
  process.handle.terminate()
  const deadline = createCleanupDeadline(process.handle.pid, timeoutMs)
  let stopped = false
  try {
    stopped = await Promise.race([
      process.handle.waitForExit(deadline.signal),
      deadline.timeout,
    ])
    if (!stopped) {
      cleanupFailures.push(deadline.error())
    }
  } catch (error) {
    cleanupFailures.push(error)
  }
  if (stopped) {
    deadline.setPhase('outcome')
    try {
      await Promise.race([process.done, deadline.timeout])
    } catch (error) {
      if (error !== primaryFailure && (primaryFailure as Error | undefined)?.cause !== error) {
        cleanupFailures.push(error)
      }
    }
  }
  deadline.dispose()
  if (cleanupFailures.length === 0) throw primaryFailure
  throw new AggregateError([primaryFailure, ...cleanupFailures], `${label} failed and cleanup also failed`)
}

/**
 * Spawn a managed process and return only after its readiness marker appears.
 * The spawn and readiness signals are combined. Cancellation, readiness
 * timeout, or spawn failure terminates the complete process tree and waits for
 * quiescence within the configured cleanup budget.
 * @param runtime - Process runtime used to spawn the managed tree.
 * @param spec - Spawn request; its signal participates in cancellation.
 * @param readiness - Marker, deadline, optional signal, and cleanup budget.
 * @returns The live process after the readiness marker is observed.
 * @throws The cancellation reason or readiness/spawn failure after bounded
 * process-tree cleanup. A cleanup failure is aggregated with the primary
 * failure.
 */
export async function startManagedProcess(
  runtime: Pick<SubprocessRuntime, 'spawn'>,
  spec: SubprocessSpawnSpec,
  readiness: {
    label: string
    pattern: RegExp
    timeoutMs: number
    cleanupTimeoutMs?: number
    signal?: AbortSignal
  },
): Promise<ReadyProcess> {
  const processSignal = spec.signal === undefined
    ? readiness.signal
    : readiness.signal === undefined
      ? spec.signal
      : AbortSignal.any([spec.signal, readiness.signal])
  const process = captureOutput(runtime.spawn({
    ...spec,
    ...processSignal === undefined ? {} : { signal: processSignal },
  }))
  try {
    const ready = await waitForOutput(
      process,
      readiness.pattern,
      readiness.label,
      readiness.timeoutMs,
      processSignal,
    )
    return { ...process, ready }
  } catch (error) {
    return await cleanupAfterFailure(
      process,
      error,
      readiness.label,
      readiness.cleanupTimeoutMs ?? spec.graceMs + 5_000,
    )
  }
}

/**
 * Run one managed command through completion. The caller signal, spawn signal,
 * and command deadline cancel the complete process tree. Before rejecting, the
 * command waits for bounded tree and outcome quiescence; cleanup failure is
 * aggregated with the cancellation, timeout, or process failure.
 * @param runtime - Process runtime used to spawn the managed tree.
 * @param spec - Spawn request; its signal participates in cancellation.
 * @param label - Command name used in timeout and cleanup diagnostics.
 * @param timeoutMs - Deadline for command completion.
 * @param signal - Optional caller cancellation signal.
 * @returns The settled process outcome with bounded stdout and stderr tails.
 * @throws The original cancellation reason, timeout, or process failure after
 * bounded cleanup, or an aggregate containing independent cleanup failures.
 */
export async function runManagedCommand(
  runtime: Pick<SubprocessRuntime, 'spawn'>,
  spec: SubprocessSpawnSpec,
  label: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<ManagedCommandResult> {
  const deadline = new AbortController()
  const signals = [spec.signal, signal, deadline.signal]
    .filter((candidate): candidate is AbortSignal => candidate !== undefined)
  const operationSignal = signals.length === 1 ? signals[0]! : AbortSignal.any(signals)
  const process = captureOutput(runtime.spawn({ ...spec, signal: operationSignal }))
  const cancelled = Promise.withResolvers<never>()
  const onAbort = (): void => {
    process.handle.terminate()
    const reason: unknown = operationSignal.reason
    cancelled.reject(reason instanceof Error ? reason : new Error(`${label} was cancelled`))
  }
  if (operationSignal.aborted) onAbort()
  else operationSignal.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => {
    const error = new Error(
      `${label} timed out after ${String(timeoutMs)}ms`
      + `\nstdout:\n${process.getStdout()}\nstderr:\n${process.getStderr()}`,
    )
    deadline.abort(error)
  }, timeoutMs)
  try {
    const outcome = await Promise.race([process.done, cancelled.promise])
    const stopped = await Promise.race([
      process.handle.waitForExit(operationSignal),
      cancelled.promise,
    ])
    if (!stopped) {
      operationSignal.throwIfAborted()
      throw new Error(
        `${label} timed out after ${String(timeoutMs)}ms`
        + `\nstdout:\n${outcome.stdout}\nstderr:\n${outcome.stderr}`,
      )
    }
    return outcome
  } catch (error) {
    return await cleanupAfterFailure(process, error, label, spec.graceMs + 5_000)
  } finally {
    operationSignal.removeEventListener('abort', onAbort)
    clearTimeout(timer)
  }
}

/** Terminate one managed process tree; reject if quiescence exceeds `timeoutMs`. */
export async function stopTree(
  handle: SubprocessHandle,
  label: string,
  timeoutMs: number,
): Promise<SubprocessOutcome> {
  void handle.done.catch(() => {})
  handle.terminate()
  const deadline = createCleanupDeadline(handle.pid, timeoutMs, label)
  try {
    const stopped = await Promise.race([
      handle.waitForExit(deadline.signal),
      deadline.timeout,
    ])
    if (!stopped) throw deadline.error()
    deadline.setPhase('outcome')
    return await Promise.race([handle.done, deadline.timeout])
  } finally {
    deadline.dispose()
  }
}

/** Validate that a CDP version payload belongs to headed system Chrome. */
export function parseSystemChromeVersion(value: unknown): SystemChromeVersion {
  if (typeof value !== 'object' || value === null) {
    throw new Error('system Chrome CDP 9333 prerequisite unavailable: invalid /json/version response')
  }
  const record = value as Record<string, unknown>
  if (
    typeof record.Browser !== 'string'
    || !record.Browser.startsWith('Chrome/')
    || typeof record['Protocol-Version'] !== 'string'
    || typeof record.webSocketDebuggerUrl !== 'string'
  ) {
    throw new Error('system Chrome CDP 9333 prerequisite unavailable: invalid /json/version response')
  }
  return value as unknown as SystemChromeVersion
}

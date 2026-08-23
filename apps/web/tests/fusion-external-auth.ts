import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { expect } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { healProfilesModuleFallback } from '@deepseek-ai/dsh-app-boot'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'

interface ProfileEntrypoint {
  mainPath: string
  module: Record<string, unknown>
  packageRoot: string
}

interface RouteResult {
  body: string
  status: number
}

interface ExternalVersions {
  '@linxin666/dsh-pet': string
}

interface VerificationOptions {
  installAnchor: string
  profile: string
  signal: AbortSignal
  versions: ExternalVersions
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function routeRequest(
  path: string,
  method: string,
  remoteAddress: string,
  cookie: string | undefined,
  body?: unknown,
): IncomingMessage {
  const request = Object.assign(
    Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]),
    {
      method,
      url: path,
      headers: {
        host: remoteAddress.startsWith('127.') ? '127.0.0.1:43210' : 'fusion.example',
        origin: remoteAddress.startsWith('127.') ? 'http://127.0.0.1:43210' : 'https://fusion.example',
        'sec-fetch-site': 'same-origin',
        'content-type': 'application/json',
        ...cookie === undefined ? {} : { cookie },
      },
      socket: { remoteAddress },
    },
  )
  return request as unknown as IncomingMessage
}

function abortReason(signal: AbortSignal, label: string): Error {
  const reason: unknown = signal.reason
  return reason instanceof Error ? reason : new Error(`${label} was cancelled`)
}

async function withinSignal<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  label: string,
): Promise<T> {
  const cancelled = Promise.withResolvers<never>()
  const onAbort = (): void => { cancelled.reject(abortReason(signal, label)) }
  if (signal.aborted) onAbort()
  else signal.addEventListener('abort', onAbort, { once: true })
  try {
    return await Promise.race([operation, cancelled.promise])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

/**
 * Invoke one in-process Web route under the acceptance cancellation signal.
 * @param route - Registered route whose response lifecycle is exercised.
 * @param request - Synthetic request passed to the route.
 * @param signal - Acceptance cancellation signal.
 * @returns The captured status and body.
 */
export async function invokeRoute(
  route: WebRoute,
  request: IncomingMessage,
  signal: AbortSignal,
): Promise<RouteResult> {
  const result: RouteResult = { body: '', status: 0 }
  const finished = Promise.withResolvers<undefined>()
  const response = {
    writeHead(status: number) {
      result.status = status
      return this
    },
    write(chunk: string | Buffer): boolean {
      result.body += chunk.toString()
      return true
    },
    end(chunk?: string | Buffer): void {
      if (chunk !== undefined) result.body += chunk.toString()
      finished.resolve(undefined)
    },
    on() {
      return this
    },
  }
  const label = `${request.method ?? 'request'} ${request.url ?? '/'}`
  const handler = Promise.resolve().then(
    async () => { await route.handler(request, response as unknown as ServerResponse) },
  )
  await withinSignal(handler, signal, label)
  await withinSignal(finished.promise, signal, label)
  return result
}

function livePairing(tokens: Set<string>): { isPairedDevice(request: IncomingMessage): boolean } {
  return {
    isPairedDevice(request): boolean {
      const cookie = request.headers.cookie
      if (cookie === undefined) return false
      return cookie.split(';').some((part) => {
        const match = /^dsh_pair=(.+)$/u.exec(part.trim())
        return match !== null && tokens.has(match[1]!)
      })
    },
  }
}

async function loadProfileEntrypoint(
  profile: string,
  packageName: keyof ExternalVersions,
  version: string,
  signal: AbortSignal,
  importTag?: string,
): Promise<ProfileEntrypoint> {
  signal.throwIfAborted()
  const requireFromProfile = createRequire(join(profile, 'package.json'))
  const packageJsonPath = requireFromProfile.resolve(`${packageName}/package.json`)
  const packageRoot = dirname(packageJsonPath)
  const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    main?: unknown
    name?: unknown
    version?: unknown
  }
  expect(manifest).toMatchObject({ name: packageName, version, main: 'lib/index.js' })
  const mainPath = await realpath(requireFromProfile.resolve(packageName))
  expect(mainPath).toBe(await realpath(join(packageRoot, 'lib/index.js')))
  const fromProfile = relative(await realpath(profile), mainPath)
  expect(isAbsolute(fromProfile) || fromProfile === '..' || fromProfile.startsWith(`..${sep}`))
    .toBe(false)
  signal.throwIfAborted()
  const moduleUrl = pathToFileURL(mainPath)
  if (importTag !== undefined) moduleUrl.searchParams.set('fusionAcceptance', importTag)
  const loaded: unknown = await import(moduleUrl.href)
  if (!isRecord(loaded)) throw new Error(`Profile main did not export a module object: ${mainPath}`)
  return {
    mainPath,
    module: loaded,
    packageRoot,
  }
}

async function sha256(path: string): Promise<string> {
  return createHash('sha256').update(await readFile(path)).digest('hex')
}

/**
 * Run a mutation against a complete private package copy and keep the installed package read-only.
 * @param packageRoot - Exact profile-installed package root.
 * @param profile - Profile that provides the copied package's dependency resolution.
 * @param signal - Acceptance cancellation signal.
 * @param run - Operation allowed to mutate only the private copy.
 * @returns The callback result after the copy is removed and the installed entry hash is rechecked.
 */
export async function withPrivatePackageCopy<T>(
  packageRoot: string,
  profile: string,
  signal: AbortSignal,
  run: (copyRoot: string) => Promise<T>,
): Promise<T> {
  signal.throwIfAborted()
  const installedMain = join(packageRoot, 'lib', 'index.js')
  const installedHash = await sha256(installedMain)
  const privateParent = await mkdtemp(join(profile, '.fusion-private-package-'))
  const privateRoot = join(privateParent, 'package')
  try {
    await cp(packageRoot, privateRoot, { recursive: true })
    const [installedStat, copiedStat] = await Promise.all([
      stat(installedMain),
      stat(join(privateRoot, 'lib', 'index.js')),
    ])
    if (installedStat.dev === copiedStat.dev && installedStat.ino === copiedStat.ino) {
      throw new Error(`private package entry aliases installed inode ${installedMain}`)
    }
    signal.throwIfAborted()
    return await run(privateRoot)
  } finally {
    await rm(privateParent, { recursive: true, force: true })
    const finalHash = await sha256(installedMain)
    if (finalHash !== installedHash) {
      throw new Error(`profile-installed package entry changed during private mutation: ${installedMain}`)
    }
  }
}

async function loadPackageRootEntrypoint(
  packageRoot: string,
  packageName: keyof ExternalVersions,
  version: string,
  signal: AbortSignal,
  importTag: string,
): Promise<ProfileEntrypoint> {
  const packageJsonPath = join(packageRoot, 'package.json')
  const manifest = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    main?: unknown
    name?: unknown
    version?: unknown
  }
  expect(manifest).toMatchObject({ name: packageName, version, main: 'lib/index.js' })
  const mainPath = await realpath(join(packageRoot, 'lib', 'index.js'))
  signal.throwIfAborted()
  const moduleUrl = pathToFileURL(mainPath)
  moduleUrl.searchParams.set('fusionAcceptance', importTag)
  const loaded: unknown = await import(moduleUrl.href)
  if (!isRecord(loaded)) throw new Error(`Private package main did not export a module object: ${mainPath}`)
  return { mainPath, module: loaded, packageRoot }
}

async function verifyPet(
  entrypoint: ProfileEntrypoint,
  pairingTokens: Set<string>,
  signal: AbortSignal,
): Promise<void> {
  const apply = entrypoint.module.apply
  const PetService = entrypoint.module.PetService
  if (typeof apply !== 'function') {
    throw new Error(`Pet profile main does not export apply: ${entrypoint.mainPath}`)
  }
  if (typeof PetService !== 'function') {
    throw new Error(`Pet profile main does not export PetService: ${entrypoint.mainPath}`)
  }
  const routes: WebRoute[] = []
  let stateCalls = 0
  const pairing = livePairing(pairingTokens)
  const context = new Context()
  context.provide('webServer', {
    register(route: WebRoute): () => void {
      routes.push(route)
      return () => {
        const index = routes.indexOf(route)
        if (index >= 0) routes.splice(index, 1)
      }
    },
  } as never)
  context.provide('remoteWebUiPairing' as never, pairing as never)
  const prototype = (PetService as unknown as {
    prototype: { state: (...args: unknown[]) => Promise<unknown> }
  }).prototype
  const originalState = prototype.state
  prototype.state = async function (...args: unknown[]): Promise<unknown> {
    stateCalls += 1
    return await originalState.apply(this, args)
  }

  try {
    await Promise.resolve((apply as (context: Context, config: unknown) => unknown)(context, {
      persistDir: join(dirname(entrypoint.mainPath), '.fusion-acceptance-pet'),
    }))
    const route = routes.find(candidate =>
      candidate.kind === 'exact' && candidate.path === '/api/pet/state')
    if (route === undefined) throw new Error('Pet profile main did not register /api/pet/state')
    const cookie = 'dsh_pair=fusion-live-token'

    const unpaired = await invokeRoute(
      route,
      routeRequest('/api/pet/state', 'GET', '203.0.113.9', undefined),
      signal,
    )
    if (unpaired.status !== 403) {
      throw new Error(
        `Pet apply registration allowed remote unpaired state access: expected 403, received ${String(unpaired.status)}`,
      )
    }
    expect(stateCalls).toBe(0)
    pairingTokens.add('fusion-live-token')
    expect(await invokeRoute(route, routeRequest('/api/pet/state', 'GET', '203.0.113.9', cookie), signal))
      .toMatchObject({ status: 200 })
    expect(stateCalls).toBe(1)
    pairingTokens.delete('fusion-live-token')
    expect(await invokeRoute(route, routeRequest('/api/pet/state', 'GET', '203.0.113.9', cookie), signal))
      .toMatchObject({ status: 403 })
    expect(stateCalls).toBe(1)
    expect(await invokeRoute(route, routeRequest('/api/pet/state', 'GET', '127.0.0.1', undefined), signal))
      .toMatchObject({ status: 200 })
    expect(stateCalls).toBe(2)
  } finally {
    prototype.state = originalState
    await context.fiber.dispose()
  }
}

async function verifyPetApplyRegistrationMutation(
  profile: string,
  version: string,
  signal: AbortSignal,
): Promise<void> {
  const entrypoint = await loadProfileEntrypoint(
    profile,
    '@linxin666/dsh-pet',
    version,
    signal,
    'resolve-pet-mutation-path',
  )
  const source = await readFile(entrypoint.mainPath, 'utf8')
  const registration = 'const disposers = routes.map((route) => ctx.webServer.register(route));'
  const unguardedRegistration = `const disposers = routes.map((route) => ctx.webServer.register(
				route.path === "/api/pet/state" ? {
					...route,
					handler: async (_request, response) => {
						const value = await service.state();
						response.writeHead(200, { "content-type": "application/json" });
						response.end(JSON.stringify(value));
					}
				} : route
			));`
  const mutated = source.replace(registration, unguardedRegistration)
  if (mutated === source) {
    throw new Error(`Pet apply-registration mutation did not match ${entrypoint.mainPath}`)
  }

  await withPrivatePackageCopy(entrypoint.packageRoot, profile, signal, async (privateRoot) => {
    const privateMain = join(privateRoot, 'lib', 'index.js')
    await writeFile(privateMain, mutated)
    const mutatedEntrypoint = await loadPackageRootEntrypoint(
      privateRoot,
      '@linxin666/dsh-pet',
      version,
      signal,
      'unguarded-pet-apply-registration',
    )
    await expect(verifyPet(mutatedEntrypoint, new Set(), signal)).rejects.toThrow(
      'Pet apply registration allowed remote unpaired state access: expected 403, received 200',
    )
  })
}

/**
 * Load the exact profile-installed Pet main bundle and run its live authorization matrix.
 * @param options - Profile path, installation anchor, version, and acceptance cancellation.
 * @returns A promise that settles after the Pet route passes all four authorization states.
 */
export async function verifyFusionExternalAuthorization(options: VerificationOptions): Promise<void> {
  healProfilesModuleFallback(options.installAnchor, dirname(dirname(options.profile)))
  const pairingTokens = new Set<string>()
  await verifyPetApplyRegistrationMutation(
    options.profile,
    options.versions['@linxin666/dsh-pet'],
    options.signal,
  )
  const pet = await loadProfileEntrypoint(
    options.profile,
    '@linxin666/dsh-pet',
    options.versions['@linxin666/dsh-pet'],
    options.signal,
    'guarded-pet-registration',
  )
  await verifyPet(pet, pairingTokens, options.signal)
}

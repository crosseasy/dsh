import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { expect } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Plugin } from '@deepseek-ai/cordis'
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

interface PetRouteProbe {
  accesses(): number
  body?: Record<string, unknown>
  kind: WebRoute['kind']
  label: string
  method: string
  onUrlAccess?: () => void
  path: string
}

const requestLabels = new WeakMap<IncomingMessage, string>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function routeRequest(
  path: string,
  method: string,
  remoteAddress: string,
  cookie: string | undefined,
  body?: unknown,
  onUrlAccess?: () => void,
): IncomingMessage {
  const request = Object.assign(
    Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]),
    {
      method,
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
  Object.defineProperty(request, 'url', {
    configurable: true,
    enumerable: true,
    get() {
      onUrlAccess?.()
      return path
    },
  })
  const incoming = request as unknown as IncomingMessage
  requestLabels.set(incoming, path)
  return incoming
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
  const label = `${request.method ?? 'request'} ${requestLabels.get(request) ?? '/'}`
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
 * @throws One phase failure unchanged, or an ordered aggregate of independent operation, removal, and integrity failures.
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
  let operation:
    | { status: 'fulfilled'; value: T }
    | { reason: unknown; status: 'rejected' }
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
    operation = { status: 'fulfilled', value: await run(privateRoot) }
  } catch (reason) {
    operation = { reason, status: 'rejected' }
  }
  const failures: unknown[] = []
  if (operation.status === 'rejected') failures.push(operation.reason)
  try {
    await rm(privateParent, { recursive: true, force: true })
  } catch (error) {
    failures.push(error)
  }
  try {
    const finalHash = await sha256(installedMain)
    if (finalHash !== installedHash) {
      throw new Error(`profile-installed package entry changed during private mutation: ${installedMain}`)
    }
  } catch (error) {
    failures.push(error)
  }
  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(failures, 'private package mutation and cleanup failed')
  }
  if (operation.status !== 'fulfilled') {
    throw new Error('private package mutation did not settle')
  }
  return operation.value
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
  const plugin = entrypoint.module as unknown as Plugin.Object<{ persistDir: string }>
  const routes: WebRoute[] = []
  const serviceCalls = {
    diagnostics: 0,
    interact: 0,
    pets: 0,
    setConfig: 0,
    setName: 0,
    setPetId: 0,
    setVisible: 0,
    state: 0,
  }
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
    prototype: Record<keyof typeof serviceCalls, (...args: unknown[]) => Promise<unknown>>
  }).prototype
  const originalMethods = new Map<
    keyof typeof serviceCalls,
    (...args: unknown[]) => Promise<unknown>
  >()
  for (const method of Object.keys(serviceCalls) as Array<keyof typeof serviceCalls>) {
    const original = prototype[method]
    originalMethods.set(method, original)
    prototype[method] = async function (...args: unknown[]): Promise<unknown> {
      serviceCalls[method] += 1
      return await original.apply(this, args)
    }
  }

  let rowFiber: { dispose(): Promise<void> } | undefined
  try {
    rowFiber = await context.plugin(plugin, {
      persistDir: join(dirname(entrypoint.mainPath), '.fusion-acceptance-pet'),
    })
    const expectedRoutes = [
      'exact /api/pet/state',
      'exact /api/pet/pets',
      'exact /api/pet/diagnostics',
      'exact /api/pet/interact',
      'exact /api/pet/set-visible',
      'exact /api/pet/set-config',
      'exact /api/pet/set-name',
      'exact /api/pet/set-pet',
      'prefix /pet',
      'prefix /api/pet/runtime',
      'prefix /api/pet/decoration',
    ]
    expect(routeKeys(routes)).toEqual(expectedRoutes)

    let assetAccesses = 0
    let runtimeAccesses = 0
    let decorationAccesses = 0
    const probes: PetRouteProbe[] = [
      {
        accesses: () => serviceCalls.state,
        kind: 'exact',
        label: 'state',
        method: 'GET',
        path: '/api/pet/state',
      },
      {
        accesses: () => serviceCalls.pets,
        kind: 'exact',
        label: 'pets',
        method: 'GET',
        path: '/api/pet/pets',
      },
      {
        accesses: () => serviceCalls.diagnostics,
        kind: 'exact',
        label: 'diagnostics',
        method: 'GET',
        path: '/api/pet/diagnostics',
      },
      {
        accesses: () => assetAccesses,
        kind: 'prefix',
        label: 'asset',
        method: 'GET',
        onUrlAccess: () => { assetAccesses += 1 },
        path: '/pet/whale-girl/pet.json',
      },
      {
        accesses: () => runtimeAccesses,
        kind: 'prefix',
        label: 'runtime',
        method: 'GET',
        onUrlAccess: () => { runtimeAccesses += 1 },
        path: '/api/pet/runtime/live2d-vendor.js',
      },
      {
        accesses: () => decorationAccesses,
        kind: 'prefix',
        label: 'decoration',
        method: 'GET',
        onUrlAccess: () => { decorationAccesses += 1 },
        path: '/api/pet/decoration/whale/decoration.json',
      },
      {
        accesses: () => serviceCalls.interact,
        body: { kind: 'pet' },
        kind: 'exact',
        label: 'interact',
        method: 'POST',
        path: '/api/pet/interact',
      },
      {
        accesses: () => serviceCalls.setVisible,
        body: { visible: false },
        kind: 'exact',
        label: 'set-visible',
        method: 'POST',
        path: '/api/pet/set-visible',
      },
      {
        accesses: () => serviceCalls.setConfig,
        body: { bottom: 16, right: 12, size: 64, visible: true },
        kind: 'exact',
        label: 'set-config',
        method: 'POST',
        path: '/api/pet/set-config',
      },
      {
        accesses: () => serviceCalls.setName,
        body: { name: 'Fusion Pet' },
        kind: 'exact',
        label: 'set-name',
        method: 'POST',
        path: '/api/pet/set-name',
      },
      {
        accesses: () => serviceCalls.setPetId,
        body: { petId: 'whale-girl' },
        kind: 'exact',
        label: 'set-pet',
        method: 'POST',
        path: '/api/pet/set-pet',
      },
    ]
    for (const probe of probes) {
      const route = routes.find(candidate =>
        candidate.kind === probe.kind && candidate.path === routePrefix(probe))
      if (route === undefined) {
        throw new Error(`Pet profile main did not register ${probe.kind} ${routePrefix(probe)}`)
      }
      await verifyPetRouteAuthorization(
        route,
        probe,
        pairingTokens,
        signal,
      )
    }

    await rowFiber.dispose()
    rowFiber = undefined
    if (routes.length !== 0) {
      throw new Error(`Pet apply registration left routes after row disposal: ${routeKeys(routes).join(', ')}`)
    }
    rowFiber = await context.plugin(plugin, {
      persistDir: join(dirname(entrypoint.mainPath), '.fusion-acceptance-pet'),
    })
    expect(routeKeys(routes)).toEqual(expectedRoutes)
    await rowFiber.dispose()
    rowFiber = undefined
    if (routes.length !== 0) {
      throw new Error(`Pet apply registration left routes after remounted row disposal: ${routeKeys(routes).join(', ')}`)
    }
  } finally {
    for (const [method, original] of originalMethods) prototype[method] = original
    await rowFiber?.dispose()
    await context.fiber.dispose()
  }
}

function routeKeys(routes: readonly WebRoute[]): string[] {
  return routes.map(route => `${route.kind} ${route.path}`)
}

function routePrefix(probe: PetRouteProbe): string {
  if (probe.kind === 'exact') return probe.path
  if (probe.label === 'asset') return '/pet'
  if (probe.label === 'runtime') return '/api/pet/runtime'
  return '/api/pet/decoration'
}

async function verifyPetRouteAuthorization(
  route: WebRoute,
  probe: PetRouteProbe,
  pairingTokens: Set<string>,
  signal: AbortSignal,
): Promise<void> {
  const cookie = 'dsh_pair=fusion-live-token'
  const deniedBeforeAccess = probe.accesses()
  const unpaired = await invokeRoute(
    route,
    routeRequest(probe.path, probe.method, '203.0.113.9', undefined, probe.body, probe.onUrlAccess),
    signal,
  )
  if (unpaired.status !== 403) {
    throw new Error(
      `Pet apply registration allowed remote unpaired ${probe.label} access: expected 403, received ${String(unpaired.status)}`,
    )
  }
  expect(probe.accesses(), `${probe.label} unpaired request reached its handler`).toBe(deniedBeforeAccess)

  pairingTokens.add('fusion-live-token')
  expect(await invokeRoute(
    route,
    routeRequest(probe.path, probe.method, '203.0.113.9', cookie, probe.body, probe.onUrlAccess),
    signal,
  ), `${probe.label} paired request`).toMatchObject({ status: 200 })
  expect(probe.accesses(), `${probe.label} paired request did not reach its handler`)
    .toBeGreaterThan(deniedBeforeAccess)

  pairingTokens.delete('fusion-live-token')
  const revokedBeforeAccess = probe.accesses()
  expect(await invokeRoute(
    route,
    routeRequest(probe.path, probe.method, '203.0.113.9', cookie, probe.body, probe.onUrlAccess),
    signal,
  ), `${probe.label} revoked request`).toMatchObject({ status: 403 })
  expect(probe.accesses(), `${probe.label} revoked request reached its handler`).toBe(revokedBeforeAccess)

  expect(await invokeRoute(
    route,
    routeRequest(probe.path, probe.method, '127.0.0.1', undefined, probe.body, probe.onUrlAccess),
    signal,
  ), `${probe.label} loopback request`).toMatchObject({ status: 200 })
  expect(probe.accesses(), `${probe.label} loopback request did not reach its handler`)
    .toBeGreaterThan(revokedBeforeAccess)
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
  const mutations = [
    {
      expected: 'Pet apply registration allowed remote unpaired state access: expected 403, received 200',
      source: source.replace(
        'const disposers = routes.map((route) => ctx.webServer.register(route));',
        `const disposers = routes.map((route) => ctx.webServer.register(
				route.path === "/api/pet/state" ? {
					...route,
					handler: async (_request, response) => {
						const value = await service.state();
						response.writeHead(200, { "content-type": "application/json" });
						response.end(JSON.stringify(value));
					}
				} : route
			));`,
      ),
      tag: 'unguarded-pet-api-registration',
    },
    {
      expected: 'Pet apply registration allowed remote unpaired pets access: expected 403, received 200',
      source: source.replace(
        `function getRoute(ctx, path, run) {
	return {
		kind: "exact",
		path,
		handler: (req, res) => {
			if (!guard(ctx, req, res)) return;`,
        `function getRoute(ctx, path, run) {
	return {
		kind: "exact",
		path,
		handler: (req, res) => {
			if (path !== "/api/pet/pets" && !guard(ctx, req, res)) return;`,
      ),
      tag: 'unguarded-pet-pets-registration',
    },
    {
      expected: 'Pet apply registration allowed remote unpaired diagnostics access: expected 403, received 200',
      source: source.replace(
        `function getRoute(ctx, path, run) {
	return {
		kind: "exact",
		path,
		handler: (req, res) => {
			if (!guard(ctx, req, res)) return;`,
        `function getRoute(ctx, path, run) {
	return {
		kind: "exact",
		path,
		handler: (req, res) => {
			if (path !== "/api/pet/diagnostics" && !guard(ctx, req, res)) return;`,
      ),
      tag: 'unguarded-pet-diagnostics-registration',
    },
    {
      expected: 'Pet apply registration allowed remote unpaired asset access: expected 403, received 200',
      source: source.replace(
        `function assetHandler(ctx, registry, caps) {
	const aliases = dirAliases(registry);
	return ((req, res) => {
		if (!guard(ctx, req, res)) return;`,
        `function assetHandler(ctx, registry, caps) {
	const aliases = dirAliases(registry);
	return ((req, res) => {`,
      ),
      tag: 'unguarded-pet-asset-registration',
    },
    {
      expected: 'Pet apply registration allowed remote unpaired interact access: expected 403, received 200',
      source: source.replace(
        'if (!guard(ctx, req, res)) return Promise.resolve();',
        '',
      ),
      tag: 'unguarded-pet-post-route',
    },
    {
      expected: 'Pet apply registration left routes after row disposal',
      source: source.replace(
        `const disposers = routes.map((route) => ctx.webServer.register(route));
			return () => {
				for (const dispose of disposers) dispose();
			};`,
        `const disposers = routes.map((route) => ctx.webServer.register(route));
			return () => {};`,
      ),
      tag: 'undisposed-pet-route-registration',
    },
  ] as const

  const failures: unknown[] = []
  for (const mutation of mutations) {
    try {
      if (mutation.source === source) {
        throw new Error(`Pet ${mutation.tag} mutation did not match ${entrypoint.mainPath}`)
      }
      await withPrivatePackageCopy(entrypoint.packageRoot, profile, signal, async (privateRoot) => {
        const privateMain = join(privateRoot, 'lib', 'index.js')
        await writeFile(privateMain, mutation.source)
        const mutatedEntrypoint = await loadPackageRootEntrypoint(
          privateRoot,
          '@linxin666/dsh-pet',
          version,
          signal,
          mutation.tag,
        )
        await expect(verifyPet(mutatedEntrypoint, new Set(), signal)).rejects.toThrow(mutation.expected)
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      failures.push(new Error(`${mutation.tag}: ${detail}`, { cause: error }))
    }
  }
  if (failures.length > 0) {
    throw new AggregateError(failures, 'Pet authorization mutations were accepted')
  }
}

/**
 * Load the exact profile-installed Pet main bundle and run its live authorization matrix.
 * @param options - Profile path, installation anchor, version, and acceptance cancellation.
 * @returns A promise that settles after the Pet route passes all four authorization states.
 */
export async function verifyFusionExternalAuthorization(options: VerificationOptions): Promise<void> {
  await healProfilesModuleFallback({ installAnchor: options.installAnchor, home: dirname(dirname(options.profile)) })
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

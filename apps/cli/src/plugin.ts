/**
 * `dsh plugin --profile <name> <args...>` — profile plugin management as a
 * thin pnpm forwarder for ordinary profiles and a staged installer for curated
 * profiles. Ordinary profiles initialize on first use and reconcile their
 * `dsh.profile.bundles` list after pnpm succeeds. Curated profiles expose
 * repository-owned read-only help/list output and install their fixed dependency
 * set offline in a private staging home before one directory-rename activation.
 * @module @deepseek-ai/dsh/plugin
 */

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  type BigIntStats,
} from 'node:fs'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  DEFAULT_PROFILE_BUNDLES,
  initProfile,
  loadProfile,
  PROFILE_PATCH_FILENAME,
  PROFILE_TEMPLATES,
  readProfileManifest,
  resolveBundleDir,
  resolveProfileDir,
  writeProfileManifest,
  type ProfileManifest,
} from '@deepseek-ai/dsh-app-boot'
import {
  assertCuratedProfileAdmission,
  curatedProfileDependenciesForBundles,
  CURATED_PROFILE_TEMPLATES,
  generatedCuratedProfileFiles,
  openExistingCuratedProfileFiles,
  type CuratedProfileFileSnapshot,
  type CuratedProfileName,
} from '@deepseek-ai/dsh-curated-profiles'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { load as loadYaml } from 'js-yaml'
import { isCuratedProfileName } from './curated-profile.ts'
import { INSTALL_ANCHOR } from './profile-boot.ts'

const NAME = 'dsh'
const IGNORE_SCRIPTS_ARGUMENT = '--config.ignore-scripts=true'
const OFFLINE_ARGUMENT = '--offline'
const FROZEN_LOCKFILE_ARGUMENT = '--frozen-lockfile'
const CURATED_PLUGIN_COMMANDS = new Set(['install', 'list', '--help'])
const CURATED_INSTALL_LOCK_WAIT_MS = 10 * 60 * 1_000
const CURATED_INSTALL_LOCK_RETRY_MS = 50
const CURATED_INSTALL_FILE_LIMIT = 16 * 1024 * 1024
const PACKAGE_TRANSFORMATION_ENVIRONMENT = new RegExp([
  String.raw`^(?:npm|pnpm)[._-]?config[._-](?:pnpm[._-])?(?:`,
  String.raw`overrides|patched[-_.]?dependencies|package[-_.]?extensions|`,
  String.raw`(?:global[-_.]?)?pnpmfile|patches[-_.]?dir|allow[-_.]?builds?|`,
  String.raw`dangerously[-_.]?allow[-_.]?all[-_.]?builds|`,
  String.raw`only[-_.]?built[-_.]?dependencies(?:[-_.]?file)?)$`,
].join(''), 'iu')
const PACKAGE_MANAGER_CONFIG_ENVIRONMENT = /^(?:npm|pnpm)[._-]?config(?:[._-]|$)/iu
const PACKAGE_MANAGER_PATH_REDIRECT_ENVIRONMENT = new RegExp([
  String.raw`^(?:npm|pnpm)[._-]?config[._-](?:`,
  String.raw`workspace[-_.]?dir|lockfile[-_.]?dir|modules[-_.]?dir|`,
  String.raw`virtual[-_.]?store[-_.]?dir)$`,
].join(''), 'iu')
const PACKAGE_TRANSFORMATION_ARGUMENT = new RegExp([
  String.raw`^--(?:config\.)?(?:pnpm[._-])?(?:`,
  String.raw`overrides|patched[-_.]?dependencies|package[-_.]?extensions|`,
  String.raw`(?:global[-_.]?)?pnpmfile|patches[-_.]?dir|allow[-_.]?builds?|`,
  String.raw`dangerously[-_.]?allow[-_.]?all[-_.]?builds|`,
  String.raw`only[-_.]?built[-_.]?dependencies(?:[-_.]?file)?)(?:[.=]|$)`,
].join(''), 'iu')
const IGNORE_SCRIPTS_OVERRIDE = /^--(?:config\.)?(?<negated>no-)?ignore[-_.]?scripts(?:=(?<value>.*))?$/iu

function enablesLifecycleScripts(argument: string): boolean {
  const match = IGNORE_SCRIPTS_OVERRIDE.exec(argument)
  if (match === null) return false
  return match.groups?.negated !== undefined
    || (match.groups?.value !== undefined && match.groups.value.toLowerCase() !== 'true')
}

/**
 * Whether a resolved dependency exports a profile patch, i.e. is a bundle.
 * @param packageName - the dependency's package name.
 * @param profileDir - the profile directory (resolution anchor).
 * @returns true when the package manifest declares `dsh.bundle`.
 */
function exportsPatch(packageName: string, profileDir: string): boolean {
  let dir: string
  try {
    dir = resolveBundleDir(NAME, packageName, INSTALL_ANCHOR, profileDir)
  } catch {
    return false // pnpm reported success yet the package is unresolvable — treat as plain
  }
  const manifest = readProfileManifest(NAME, dir)
  return manifest.dsh?.bundle?.patch !== undefined
}

/**
 * Reconcile `dsh.profile.bundles` against the installed state: pnpm has
 * already written the real installed names (so a git/path/tarball/alias spec
 * on the command line reconciles by its true package name) and materialized
 * the packages. A dependency that resolves to a `dsh.bundle`-declaring
 * package joins the layer stack (appended in dependency order); a
 * dependency-listed name that no longer does — removed, or the installed
 * version dropped the declaration — leaves it. In-box bundles from the
 * profile template are not dependencies and are never touched. Warns once
 * per newly-added bundle-less dependency (a plain library is fine; the
 * warning is orientation).
 */
function reconcilePlugins(before: ProfileManifest, profileDir: string): void {
  const after = readProfileManifest(NAME, profileDir)
  const beforeDeps = new Set(Object.keys(before.dependencies ?? {}))
  const dependencies = Object.keys(after.dependencies ?? {})
  const plugins = after.dsh?.profile?.bundles ?? []
  let changed = false
  for (const packageName of dependencies) {
    const isBundle = exportsPatch(packageName, profileDir)
    if (isBundle && !plugins.includes(packageName)) {
      plugins.push(packageName)
      changed = true
    } else if (!isBundle && !beforeDeps.has(packageName)) {
      process.stderr.write(
        `${NAME}: warning: ${packageName} declares no dsh.bundle — installed as a plain dependency, not a profile layer `
        + '(a later update that gains one activates it automatically)\n',
      )
    }
  }
  const dependencySet = new Set(dependencies)
  for (const packageName of [...plugins]) {
    const wasDependency = beforeDeps.has(packageName) || dependencySet.has(packageName)
    const stillBundle = dependencySet.has(packageName) && exportsPatch(packageName, profileDir)
    if (wasDependency && !stillBundle) {
      plugins.splice(plugins.indexOf(packageName), 1)
      changed = true
    }
  }
  if (!changed) return
  after.dsh = { ...after.dsh, profile: { ...after.dsh?.profile, bundles: plugins } }
  writeProfileManifest(profileDir, after)
}

/**
 * Rewrite relative filesystem specs against the user's invoking directory.
 * @param argument - one pnpm argument, verbatim from argv.
 * @param cwd - the directory `dsh` was invoked from.
 * @returns the argument with a relative path spec anchored to `cwd`.
 */
function anchorPathSpec(argument: string, cwd: string): string {
  const match = /^(?<prefix>(?:file|link):)?(?<path>\.{1,2}(?:[/\\].*)?)$/.exec(argument)
  if (match?.groups?.path === undefined) return argument
  const prefix = match.groups.prefix ?? ''
  return `${prefix}${resolve(cwd, match.groups.path)}`
}

function pluginEnvironment(curated: boolean, npmrcPath: string): NodeJS.ProcessEnv {
  const ambient = curated
    ? Object.fromEntries(Object.entries(process.env)
      .filter(([name]) => !PACKAGE_MANAGER_CONFIG_ENVIRONMENT.test(name)))
    : process.env
  return {
    ...ambient,
    NPM_CONFIG_IGNORE_SCRIPTS: 'true',
    npm_config_ignore_scripts: 'true',
    ...curated
      ? {
        NPM_CONFIG_GLOBALCONFIG: npmrcPath,
        NPM_CONFIG_USERCONFIG: npmrcPath,
        npm_config_globalconfig: npmrcPath,
        npm_config_userconfig: npmrcPath,
      }
      : {},
  }
}

function writeCuratedHelp(profile: CuratedProfileName): void {
  process.stdout.write([
    `Usage: dsh plugin --profile ${profile} <command>`,
    '',
    'Commands:',
    '  list      print the fixed curated dependency set without changing profile state',
    '  install   install the fixed dependency set offline and activate it after validation',
    '  --help    print this help without changing profile state',
    '',
  ].join('\n'))
}

function writeCuratedList(profile: CuratedProfileName): void {
  const template = CURATED_PROFILE_TEMPLATES[profile]
  const dependencies = curatedProfileDependenciesForBundles(template.bundles, profile)
  const lines = [`${profile}:`]
  const entries = Object.entries(dependencies)
  if (entries.length === 0) lines.push('  (no third-party plugin dependencies)')
  else for (const [name, spec] of entries) lines.push(`  ${name} ${spec}`)
  process.stdout.write(`${lines.join('\n')}\n`)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException & { readonly code: string } {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

function sameIdentity(
  left: { readonly dev: bigint; readonly ino: bigint },
  right: { readonly dev: bigint; readonly ino: bigint },
): boolean {
  return left.ino !== 0n && right.ino !== 0n && left.dev === right.dev && left.ino === right.ino
}

function assertRegularDirectory(path: string, label: string): BigIntStats {
  const identity = lstatSync(path, { bigint: true })
  if (identity.isSymbolicLink() || !identity.isDirectory()) {
    throw new Error(`${NAME}: ${label} must be a regular directory: ${path}`)
  }
  return identity
}

function prepareCuratedInstallRoots(home: string): {
  readonly profilesDir: string
  readonly stagingRoot: string
} {
  mkdirSync(home, { recursive: true, mode: 0o700 })
  assertRegularDirectory(home, 'DSH home')
  const profilesDir = join(home, 'profiles')
  const stagingRoot = join(home, '.curated-install-staging')
  for (const [path, label] of [
    [profilesDir, 'profiles root'],
    [stagingRoot, 'curated install staging root'],
  ] as const) {
    mkdirSync(path, { recursive: true, mode: 0o700 })
    assertRegularDirectory(path, label)
  }
  const canonicalHome = realpathSync.native(home)
  for (const path of [profilesDir, stagingRoot]) {
    const fromHome = relative(canonicalHome, realpathSync.native(path))
    if (isAbsolute(fromHome) || fromHome === '..' || fromHome.startsWith(`..${sep}`)) {
      throw new Error(`${NAME}: curated install root resolves outside the DSH home`)
    }
  }
  return { profilesDir, stagingRoot }
}

interface CuratedInstallLock {
  readonly assertOwned: () => void
  readonly release: () => void
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

interface CuratedInstallLockOwner {
  readonly pid: number
  readonly token: string
  readonly lockIdentity: BigIntStats
}

function readLockOwner(lockPath: string): CuratedInstallLockOwner | undefined {
  let descriptor: number | undefined
  try {
    const lockIdentity = assertRegularDirectory(lockPath, 'curated install lock')
    const ownerPath = join(lockPath, 'owner.json')
    const ownerIdentity = lstatSync(ownerPath, { bigint: true })
    if (ownerIdentity.isSymbolicLink() || !ownerIdentity.isFile() || ownerIdentity.size > 4096n) return undefined
    let flags = constants.O_RDONLY | constants.O_NONBLOCK
    /* v8 ignore else -- Windows does not expose O_NOFOLLOW. */
    if (typeof constants.O_NOFOLLOW === 'number') flags |= constants.O_NOFOLLOW
    descriptor = openSync(ownerPath, flags)
    const opened = fstatSync(descriptor, { bigint: true })
    if (!opened.isFile() || !sameIdentity(ownerIdentity, opened)) return undefined
    const bytes = Buffer.alloc(Number(opened.size))
    let offset = 0
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null)
      if (count === 0) break
      offset += count
    }
    const currentOwner = lstatSync(ownerPath, { bigint: true })
    const currentLock = lstatSync(lockPath, { bigint: true })
    const held = fstatSync(descriptor, { bigint: true })
    if (
      offset !== bytes.byteLength
      || currentOwner.isSymbolicLink()
      || !currentOwner.isFile()
      || !sameIdentity(opened, currentOwner)
      || !sameIdentity(opened, held)
      || !sameIdentity(lockIdentity, currentLock)
    ) return undefined
    const parsed = JSON.parse(bytes.toString('utf8')) as unknown
    if (
      typeof parsed !== 'object'
      || parsed === null
      || Array.isArray(parsed)
      || typeof (parsed as { pid?: unknown }).pid !== 'number'
      || typeof (parsed as { token?: unknown }).token !== 'string'
    ) return undefined
    const owner = parsed as { readonly pid: number; readonly token: string }
    if (!Number.isSafeInteger(owner.pid) || owner.pid <= 0 || owner.token.length === 0) return undefined
    return { ...owner, lockIdentity }
  } catch {
    return undefined
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function removeOwnedPath(path: string, parent: string, expectedIdentity?: BigIntStats): void {
  let identity: BigIntStats
  try {
    identity = lstatSync(path, { bigint: true })
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return
    throw error
  }
  if (expectedIdentity !== undefined && !sameIdentity(identity, expectedIdentity)) {
    throw new Error(`${NAME}: owned install path changed before cleanup: ${path}`)
  }
  if (identity.isSymbolicLink() || !identity.isDirectory()) {
    if (expectedIdentity === undefined) {
      throw new Error(`${NAME}: owned install path is not a regular directory: ${path}`)
    }
    unlinkSync(path)
    return
  }
  const canonicalParent = realpathSync.native(parent)
  const canonicalPath = realpathSync.native(path)
  const fromParent = relative(canonicalParent, canonicalPath)
  if (isAbsolute(fromParent) || fromParent === '..' || fromParent.startsWith(`..${sep}`)) {
    throw new Error(`${NAME}: owned install path resolves outside its parent: ${path}`)
  }
  rmSync(path, { recursive: true })
}

function reclaimDeadInstallLock(lockPath: string, parent: string): boolean {
  const owner = readLockOwner(lockPath)
  if (owner === undefined || processIsAlive(owner.pid)) return false
  const lockIdentity = owner.lockIdentity
  const reclaimed = join(parent, `.${basename(lockPath)}.reclaimed-${randomBytes(16).toString('hex')}`)
  try {
    renameSync(lockPath, reclaimed)
  } catch (error) {
    if (isNodeError(error) && ['ENOENT', 'EEXIST', 'ENOTEMPTY'].includes(error.code)) return true
    throw error
  }
  removeOwnedPath(reclaimed, parent, lockIdentity)
  return true
}

async function acquireCuratedInstallLock(profile: CuratedProfileName, profilesDir: string): Promise<CuratedInstallLock> {
  const lockPath = join(profilesDir, `.${profile}.install.lock`)
  const token = randomBytes(16).toString('hex')
  const deadline = Date.now() + CURATED_INSTALL_LOCK_WAIT_MS
  for (;;) {
    const pending = join(profilesDir, `.${profile}.install-lock-${randomBytes(16).toString('hex')}`)
    mkdirSync(pending, { mode: 0o700 })
    const pendingIdentity = lstatSync(pending, { bigint: true })
    try {
      writeFileSync(
        join(pending, 'owner.json'),
        `${JSON.stringify({ pid: process.pid, token })}\n`,
        { encoding: 'utf8', flag: 'wx', mode: 0o600 },
      )
      try {
        renameSync(pending, lockPath)
      } catch (error) {
        if (!isNodeError(error) || !['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) throw error
      }
      if (readLockOwner(lockPath)?.token === token) break
    } finally {
      removeOwnedPath(pending, profilesDir, pendingIdentity)
    }
    if (!reclaimDeadInstallLock(lockPath, profilesDir) && Date.now() >= deadline) {
      throw new Error(`${NAME}: timed out waiting for the curated profile install lock at ${lockPath}`)
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, CURATED_INSTALL_LOCK_RETRY_MS))
  }
  const assertOwned = (): void => {
    if (readLockOwner(lockPath)?.token !== token) {
      throw new Error(`${NAME}: curated profile install lock ownership changed`)
    }
  }
  return {
    assertOwned,
    release: () => {
      assertOwned()
      const lockIdentity = assertRegularDirectory(lockPath, 'curated install lock')
      const released = join(profilesDir, `.${profile}.install-lock-release-${token}`)
      renameSync(lockPath, released)
      removeOwnedPath(released, profilesDir, lockIdentity)
    },
  }
}

async function withCuratedInstallLock<T>(
  profile: CuratedProfileName,
  profilesDir: string,
  operation: (lock: CuratedInstallLock) => Promise<T> | T,
): Promise<T> {
  const lock = await acquireCuratedInstallLock(profile, profilesDir)
  let failure: unknown
  try {
    return await operation(lock)
  } catch (error) {
    failure = error
    throw error
  } finally {
    try {
      lock.release()
    } catch (releaseError) {
      if (failure === undefined) throw releaseError
      throw new AggregateError(
        [failure, releaseError],
        `${NAME}: curated profile install failed and lock release also failed`,
        { cause: failure },
      )
    }
  }
}

function recoverCuratedInstallState(profile: CuratedProfileName, profilesDir: string, stagingRoot: string): void {
  const liveDir = join(profilesDir, profile)
  const previousDir = join(profilesDir, `.${profile}.install-previous`)
  if (existsSync(previousDir)) {
    const previousIdentity = assertRegularDirectory(previousDir, 'previous curated profile')
    if (existsSync(liveDir)) {
      assertRegularDirectory(liveDir, 'curated profile')
      removeOwnedPath(previousDir, profilesDir, previousIdentity)
    } else {
      renameSync(previousDir, liveDir)
    }
  }
  const stagePrefix = `${profile}-`
  for (const entry of readdirSync(stagingRoot)) {
    if (!entry.startsWith(stagePrefix)) continue
    const stagePath = join(stagingRoot, entry)
    const stageIdentity = assertRegularDirectory(stagePath, 'curated install staging home')
    removeOwnedPath(stagePath, stagingRoot, stageIdentity)
  }
}

interface BoundRegularFile {
  readonly bytes: Buffer
  readonly assertCurrent: () => void
  readonly close: () => void
}

/* jscpd:ignore-start -- CLI transaction reads retain path identity across pnpm;
   artifact validation owns different diagnostics and package dependencies. */
function openBoundedRegularFile(root: string, relativePath: string): BoundRegularFile {
  const canonicalRoot = realpathSync.native(root)
  const rootIdentity = assertRegularDirectory(canonicalRoot, 'curated profile root')
  const path = join(canonicalRoot, relativePath)
  const fromRoot = relative(canonicalRoot, path)
  if (isAbsolute(fromRoot) || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
    throw new Error(`${NAME}: curated install file resolves outside its profile`)
  }
  let ancestor = canonicalRoot
  for (const segment of fromRoot.split(sep).slice(0, -1)) {
    ancestor = join(ancestor, segment)
    assertRegularDirectory(ancestor, 'curated install file ancestor')
  }
  const initial = lstatSync(path, { bigint: true })
  if (initial.isSymbolicLink() || !initial.isFile()) {
    throw new Error(`${NAME}: curated install file must be regular: ${relativePath}`)
  }
  if (initial.size > BigInt(CURATED_INSTALL_FILE_LIMIT)) {
    throw new Error(`${NAME}: curated install file exceeds ${String(CURATED_INSTALL_FILE_LIMIT)} bytes: ${relativePath}`)
  }
  let flags = constants.O_RDONLY | constants.O_NONBLOCK
  /* v8 ignore else -- Windows does not expose O_NOFOLLOW. */
  if (typeof constants.O_NOFOLLOW === 'number') flags |= constants.O_NOFOLLOW
  const descriptor = openSync(path, flags)
  try {
    const opened = fstatSync(descriptor, { bigint: true })
    if (!opened.isFile() || !sameIdentity(initial, opened)) {
      throw new Error(`${NAME}: curated install file changed while opening: ${relativePath}`)
    }
    const bytes = Buffer.alloc(Number(opened.size))
    let offset = 0
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null)
      if (count === 0) break
      offset += count
    }
    const assertCurrent = (): void => {
      const currentRoot = lstatSync(canonicalRoot, { bigint: true })
      const current = lstatSync(path, { bigint: true })
      const held = fstatSync(descriptor, { bigint: true })
      if (
        !sameIdentity(rootIdentity, currentRoot)
        || realpathSync.native(root) !== canonicalRoot
        || current.isSymbolicLink()
        || !current.isFile()
        || realpathSync.native(path) !== path
        || !sameIdentity(opened, current)
        || !sameIdentity(opened, held)
        || opened.size !== held.size
        || opened.mtimeNs !== held.mtimeNs
        || opened.ctimeNs !== held.ctimeNs
      ) {
        throw new Error(`${NAME}: curated install file changed: ${relativePath}`)
      }
    }
    if (offset !== bytes.byteLength) {
      throw new Error(`${NAME}: curated install file changed while reading: ${relativePath}`)
    }
    assertCurrent()
    let closed = false
    return {
      bytes,
      assertCurrent: () => {
        if (closed) throw new Error(`${NAME}: curated install file snapshot is closed`)
        assertCurrent()
      },
      close: () => {
        if (closed) return
        closed = true
        closeSync(descriptor)
      },
    }
  } catch (error) {
    closeSync(descriptor)
    throw error
  }
}
/* jscpd:ignore-end */

function readOptionalBoundedRegularFile(root: string, relativePath: string): BoundRegularFile | undefined {
  try {
    return openBoundedRegularFile(root, relativePath)
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${NAME}: ${label} must be a mapping`)
  }
  return value as Record<string, unknown>
}

function assertInstalledLock(
  profile: CuratedProfileName,
  root: string,
  relativePath: string,
  expectedDependencies: Readonly<Record<string, string>>,
): BoundRegularFile {
  const snapshot = openBoundedRegularFile(root, relativePath)
  try {
    const lock = requiredRecord(loadYaml(snapshot.bytes.toString('utf8')), `${profile} ${relativePath}`)
    if (lock.lockfileVersion !== '9.0') {
      throw new Error(`${NAME}: ${profile} ${relativePath} lockfileVersion must be 9.0`)
    }
    if (
      Object.hasOwn(lock, 'overrides')
      || Object.hasOwn(lock, 'patchedDependencies')
      || Object.hasOwn(lock, 'packageExtensions')
    ) {
      throw new Error(`${NAME}: ${profile} ${relativePath} contains a package transformation`)
    }
    const settings = lock.settings
    if (
      typeof settings === 'object'
      && settings !== null
      && !Array.isArray(settings)
      && (
        Object.hasOwn(settings, 'packageExtensionsChecksum')
        || Object.hasOwn(settings, 'pnpmfileChecksum')
      )
    ) {
      throw new Error(`${NAME}: ${profile} ${relativePath} contains a package transformation`)
    }
    const importers = requiredRecord(lock.importers, `${profile} ${relativePath} importers`)
    const rootImporter = requiredRecord(importers['.'], `${profile} ${relativePath} root importer`)
    const dependencies = rootImporter.dependencies === undefined
      ? {}
      : requiredRecord(rootImporter.dependencies, `${profile} ${relativePath} dependencies`)
    const actualNames = Object.keys(dependencies).sort()
    const expectedNames = Object.keys(expectedDependencies).sort()
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
      throw new Error(`${NAME}: ${profile} ${relativePath} dependencies differ from the curated template`)
    }
    for (const [packageName, specifier] of Object.entries(expectedDependencies)) {
      const dependency = requiredRecord(
        dependencies[packageName],
        `${profile} ${relativePath} dependency ${packageName}`,
      )
      if (dependency.specifier !== specifier) {
        throw new Error(`${NAME}: ${profile} ${relativePath} dependency ${packageName} differs from the curated template`)
      }
    }
    snapshot.assertCurrent()
    return snapshot
  } catch (error) {
    snapshot.close()
    throw error
  }
}

function stageCuratedProfile(
  profile: CuratedProfileName,
  stageHome: string,
  liveFiles: CuratedProfileFileSnapshot | undefined,
  liveLock: BoundRegularFile | undefined,
): string {
  const stageDir = resolveProfileDir(profile, stageHome)
  mkdirSync(stageDir, { recursive: true, mode: 0o700 })
  const generated = generatedCuratedProfileFiles(profile)
  for (const [file, generatedContent] of Object.entries(generated)) {
    const content = file === PROFILE_PATCH_FILENAME && liveFiles?.has(PROFILE_PATCH_FILENAME)
      ? liveFiles.readFile(join(liveFiles.dir, PROFILE_PATCH_FILENAME)) as string
      : generatedContent
    writeFileSync(join(stageDir, file), content, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  }
  if (liveLock !== undefined) {
    liveLock.assertCurrent()
    writeFileSync(join(stageDir, 'pnpm-lock.yaml'), liveLock.bytes, { flag: 'wx', mode: 0o600 })
  }
  return stageDir
}

function materializeEmptyInstalledLock(profile: CuratedProfileName, stageDir: string): void {
  const dependencies = curatedProfileDependenciesForBundles(
    CURATED_PROFILE_TEMPLATES[profile].bundles,
    profile,
  )
  const installedLockPath = join(stageDir, 'node_modules/.pnpm/lock.yaml')
  if (Object.keys(dependencies).length > 0 || existsSync(installedLockPath)) return
  const rootLock = openBoundedRegularFile(stageDir, 'pnpm-lock.yaml')
  try {
    mkdirSync(join(stageDir, 'node_modules/.pnpm'), { recursive: true, mode: 0o700 })
    rootLock.assertCurrent()
    writeFileSync(installedLockPath, rootLock.bytes, { flag: 'wx', mode: 0o600 })
    rootLock.assertCurrent()
  } finally {
    rootLock.close()
  }
}

function validateStagedCuratedProfile(
  profile: CuratedProfileName,
  stageHome: string,
  stageDir: string,
): {
  readonly files: CuratedProfileFileSnapshot
  readonly locks: readonly BoundRegularFile[]
} {
  const files = openExistingCuratedProfileFiles(profile, stageHome, stageDir)
  const template = CURATED_PROFILE_TEMPLATES[profile]
  const expectedDependencies = curatedProfileDependenciesForBundles(template.bundles, profile)
  const locks: BoundRegularFile[] = []
  try {
    locks.push(assertInstalledLock(profile, stageDir, 'pnpm-lock.yaml', expectedDependencies))
    locks.push(assertInstalledLock(profile, stageDir, 'node_modules/.pnpm/lock.yaml', expectedDependencies))
    const loaded = loadProfile(NAME, profile, INSTALL_ANCHOR, stageHome, {
      profileFileReader: files.readFile,
    })
    assertCuratedProfileAdmission(profile, stageHome, loaded, [], { profileFiles: files })
    files.assertCurrent()
    for (const lock of locks) lock.assertCurrent()
    return { files, locks }
  } catch (error) {
    files.close()
    for (const lock of locks) lock.close()
    throw error
  }
}

function activateStagedCuratedProfile(
  profile: CuratedProfileName,
  profilesDir: string,
  stageDir: string,
  lock: CuratedInstallLock,
): void {
  const liveDir = join(profilesDir, profile)
  const previousDir = join(profilesDir, `.${profile}.install-previous`)
  lock.assertOwned()
  let movedPrevious = false
  if (existsSync(liveDir)) {
    assertRegularDirectory(liveDir, 'curated profile')
    if (existsSync(previousDir)) {
      throw new Error(`${NAME}: stale curated profile backup was not reclaimed`)
    }
    renameSync(liveDir, previousDir)
    movedPrevious = true
  }
  try {
    lock.assertOwned()
    renameSync(stageDir, liveDir)
  } catch (error) {
    if (movedPrevious && !existsSync(liveDir)) {
      try {
        renameSync(previousDir, liveDir)
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `${NAME}: curated profile activation and rollback both failed`,
          { cause: error },
        )
      }
    }
    throw error
  }
  if (movedPrevious) {
    try {
      const previousIdentity = assertRegularDirectory(previousDir, 'previous curated profile')
      removeOwnedPath(previousDir, profilesDir, previousIdentity)
    } catch (error) {
      process.stderr.write(`${NAME}: warning: stale curated profile backup will be reclaimed later: ${String(error)}\n`)
    }
  }
}

function spawnPnpm(args: readonly string[], dir: string, curated: boolean): number {
  const npmrcPath = join(dir, '.npmrc')
  const result = spawnSync('pnpm', args, {
    cwd: dir,
    env: pluginEnvironment(curated, npmrcPath),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.error !== undefined) {
    const code = (result.error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      process.stderr.write(`${NAME}: pnpm not found on PATH — install pnpm to manage profile plugins\n`)
      return 127
    }
    throw result.error
  }
  return result.status ?? 1
}

async function installCuratedProfile(profile: CuratedProfileName): Promise<number> {
  const home = resolveDshHome()
  const { profilesDir, stagingRoot } = prepareCuratedInstallRoots(home)
  return withCuratedInstallLock(profile, profilesDir, (lock) => {
    recoverCuratedInstallState(profile, profilesDir, stagingRoot)
    const liveDir = join(profilesDir, profile)
    let liveFiles: CuratedProfileFileSnapshot | undefined
    let liveLock: BoundRegularFile | undefined
    let stageHome: string | undefined
    let stageHomeIdentity: BigIntStats | undefined
    let stagedValidation: ReturnType<typeof validateStagedCuratedProfile> | undefined
    try {
      if (existsSync(liveDir)) {
        liveFiles = openExistingCuratedProfileFiles(profile, home, liveDir)
        liveLock = readOptionalBoundedRegularFile(liveDir, 'pnpm-lock.yaml')
      }
      stageHome = mkdtempSync(join(stagingRoot, `${profile}-`))
      stageHomeIdentity = lstatSync(stageHome, { bigint: true })
      const stageDir = stageCuratedProfile(profile, stageHome, liveFiles, liveLock)
      const pnpmArgs = [
        IGNORE_SCRIPTS_ARGUMENT,
        OFFLINE_ARGUMENT,
        ...(liveLock === undefined ? [] : [FROZEN_LOCKFILE_ARGUMENT]),
        'install',
      ]
      const exitCode = spawnPnpm(pnpmArgs, stageDir, true)
      if (exitCode !== 0) {
        process.stderr.write(`${NAME}: pnpm failed while staging curated profile ${profile}\n`)
        return exitCode
      }
      materializeEmptyInstalledLock(profile, stageDir)
      stagedValidation = validateStagedCuratedProfile(profile, stageHome, stageDir)
      liveFiles?.assertCurrent()
      liveLock?.assertCurrent()
      stagedValidation.files.assertCurrent()
      for (const stagedLock of stagedValidation.locks) stagedLock.assertCurrent()
      lock.assertOwned()
      stagedValidation.files.close()
      for (const stagedLock of stagedValidation.locks) stagedLock.close()
      stagedValidation = undefined
      liveFiles?.close()
      liveFiles = undefined
      liveLock?.close()
      liveLock = undefined
      activateStagedCuratedProfile(profile, profilesDir, stageDir, lock)
      return 0
    } finally {
      stagedValidation?.files.close()
      for (const stagedLock of stagedValidation?.locks ?? []) stagedLock.close()
      liveFiles?.close()
      liveLock?.close()
      if (stageHome !== undefined && stageHomeIdentity !== undefined) {
        removeOwnedPath(stageHome, stagingRoot, stageHomeIdentity)
      }
    }
  })
}

/**
 * Run one `dsh plugin` invocation. Curated help and listing are static read-only
 * operations; curated installation is serialized, staged, validated, and then
 * activated. Ordinary profiles retain the pnpm-forwarding behavior.
 * @param profile - the profile name.
 * @param args - pnpm arguments with relative path specs anchored to the invoking directory.
 * @returns the command exit code.
 */
export async function runPlugin(profile: string, args: readonly string[]): Promise<number> {
  const curated = isCuratedProfileName(profile)
  if (args.some(enablesLifecycleScripts)) {
    process.stderr.write(`${NAME}: dependency lifecycle scripts cannot be enabled through plugin management\n`)
    return 2
  }
  if (curated) {
    if (args[0] === 'add' || args[0] === 'remove') {
      process.stderr.write(`${NAME}: curated profile bundle list is fixed; add or remove would diverge from its template\n`)
      return 2
    }
    if (args[0] === 'install' && args.length !== 1) {
      process.stderr.write(`${NAME}: curated profile install accepts no additional arguments\n`)
      return 2
    }
    if (!CURATED_PLUGIN_COMMANDS.has(args[0] ?? '')) {
      process.stderr.write(`${NAME}: curated profiles allow only plugin --help, plugin list, and bare plugin install\n`)
      return 2
    }
    if (args[0] === '--help') {
      writeCuratedHelp(profile)
      return 0
    }
    if (args[0] === 'list') {
      writeCuratedList(profile)
      return 0
    }
    if (Object.keys(process.env).some(name => PACKAGE_MANAGER_PATH_REDIRECT_ENVIRONMENT.test(name))) {
      process.stderr.write(`${NAME}: curated profile installation root cannot be redirected through package-manager config\n`)
      return 2
    }
    if (
      args.some(argument => PACKAGE_TRANSFORMATION_ARGUMENT.test(argument))
      || Object.keys(process.env).some(name => PACKAGE_TRANSFORMATION_ENVIRONMENT.test(name))
    ) {
      process.stderr.write(
        `${NAME}: package transformations and dependency build grants cannot be enabled for curated profiles\n`,
      )
      return 2
    }
    return installCuratedProfile(profile)
  }

  const dir = resolveProfileDir(profile)
  if (!existsSync(join(dir, 'package.json'))) {
    initProfile(dir, PROFILE_TEMPLATES[profile] ?? DEFAULT_PROFILE_BUNDLES)
    process.stderr.write(`${NAME}: initialized profile ${profile} at ${dir}\n`)
  }
  const before = readProfileManifest(NAME, dir)
  const pnpmArgs = [
    IGNORE_SCRIPTS_ARGUMENT,
    ...args.map(argument => anchorPathSpec(argument, process.cwd())),
  ]
  const exitCode = spawnPnpm(pnpmArgs, dir, false)
  if (exitCode !== 0) {
    process.stderr.write(`${NAME}: pnpm failed in profile directory ${dir}\n`)
  } else {
    reconcilePlugins(before, dir)
  }
  return exitCode
}

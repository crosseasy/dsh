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
import { createHash } from 'node:crypto'
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
  readlinkSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  type BigIntStats,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
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
  assertCuratedProfileLockAdmission,
  assertCuratedProfileAdmission,
  curatedProfileDependenciesForBundles,
  CURATED_PROFILE_TEMPLATES,
  generatedCuratedProfileFiles,
  openExistingCuratedProfileFiles,
  type CuratedProfileFileSnapshot,
  type CuratedProfileName,
} from '@deepseek-ai/dsh-curated-profiles'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { isCuratedProfileName } from './curated-profile.ts'
import {
  prepareCuratedProfileLockRoot,
  withCuratedInstallLock,
  type CuratedProfileLock,
} from './curated-profile-lock.ts'
import { INSTALL_ANCHOR } from './profile-boot.ts'

const NAME = 'dsh'
const IGNORE_SCRIPTS_ARGUMENT = '--config.ignore-scripts=true'
const OFFLINE_ARGUMENT = '--offline'
const FROZEN_LOCKFILE_ARGUMENT = '--frozen-lockfile'
const CURATED_PLUGIN_COMMANDS = new Set(['install', 'list', '--help'])
const CURATED_INSTALL_FILE_LIMIT = 16 * 1024 * 1024
const CURATED_INSTALL_TREE_LIMIT = 64 * 1024 * 1024
const CURATED_INSTALL_ENTRY_LIMIT = 1_000
const CURATED_INSTALL_DEPTH_LIMIT = 64
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

function ordinaryProfileBundles(profile: string): readonly string[] {
  if (!Object.hasOwn(PROFILE_TEMPLATES, profile)) return DEFAULT_PROFILE_BUNDLES
  return PROFILE_TEMPLATES[profile] as readonly string[]
}

/**
 * Reconcile `dsh.profile.bundles` against the installed state: pnpm has
 * already written the real installed names (so a git/path/tarball/alias spec
 * on the command line reconciles by its true package name) and materialized
 * the packages. A dependency that resolves to a `dsh.bundle`-declaring
 * package joins the layer stack (appended in dependency order); a
 * dependency-listed name that no longer does — removed, or the installed
 * version dropped the declaration — leaves it. In-box bundles from the
 * profile template remain installation-owned even when a redundant manifest
 * dependency is removed. Warns once
 * per newly-added bundle-less dependency (a plain library is fine; the
 * warning is orientation).
 */
function reconcilePlugins(profile: string, before: ProfileManifest, profileDir: string): void {
  const after = readProfileManifest(NAME, profileDir)
  const beforeDeps = new Set(Object.keys(before.dependencies ?? {}))
  const dependencies = Object.keys(after.dependencies ?? {})
  const plugins = after.dsh?.profile?.bundles ?? []
  const installationOwned = new Set(ordinaryProfileBundles(profile))
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
    if (installationOwned.has(packageName)) continue
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

/* v8 ignore start -- source subprocess tests exercise OS-level lock acquisition,
   stale-owner recovery, and cleanup; child coverage cannot be attributed here. */
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
  const profilesDir = prepareCuratedProfileLockRoot(home)
  const stagingRoot = join(home, '.curated-install-staging')
  mkdirSync(stagingRoot, { recursive: true, mode: 0o700 })
  assertRegularDirectory(stagingRoot, 'curated install staging root')
  const canonicalHome = realpathSync.native(home)
  const fromHome = relative(canonicalHome, realpathSync.native(stagingRoot))
  if (isAbsolute(fromHome) || fromHome === '..' || fromHome.startsWith(`..${sep}`)) {
    throw new Error(`${NAME}: curated install root resolves outside the DSH home`)
  }
  return { profilesDir, stagingRoot }
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

function recoverCuratedInstallState(profile: CuratedProfileName, profilesDir: string, stagingRoot: string): void {
  const liveDir = join(profilesDir, profile)
  const previousDir = join(profilesDir, `.${profile}.install-previous`)
  if (existsSync(previousDir)) {
    const previousIdentity = assertRegularDirectory(previousDir, 'previous curated profile')
    if (existsSync(liveDir)) {
      assertRegularDirectory(liveDir, 'curated profile')
      const validation = validateStagedCuratedProfile(profile, dirname(profilesDir), liveDir)
      try {
        validation.files.assertCurrent()
        for (const file of validation.activationFiles) file.assertCurrent()
        for (const tree of validation.candidateTrees) tree.assertCurrent()
        for (const stagedLock of validation.locks) stagedLock.assertCurrent()
        removeOwnedPath(previousDir, profilesDir, previousIdentity)
      } finally {
        validation.files.close()
        for (const file of validation.activationFiles) file.close()
        for (const stagedLock of validation.locks) stagedLock.close()
      }
    } else {
      renameSync(previousDir, liveDir)
      const recoveredIdentity = assertRegularDirectory(liveDir, 'recovered curated profile')
      if (!sameIdentity(previousIdentity, recoveredIdentity)) {
        throw new Error(`${NAME}: previous curated profile changed during recovery`)
      }
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
/* v8 ignore stop */

interface BoundRegularFile {
  readonly bytes: Buffer
  readonly assertCurrent: () => void
  readonly assertMoved: (root: string) => void
  readonly close: () => void
}

/* jscpd:ignore-start -- CLI transaction reads retain path identity across pnpm;
   artifact validation owns different diagnostics and package dependencies. */
function openBoundedRegularFile(root: string, relativePath: string): BoundRegularFile {
  const canonicalRoot = realpathSync.native(root)
  const rootIdentity = assertRegularDirectory(canonicalRoot, 'curated profile root')
  const path = join(canonicalRoot, relativePath)
  const fromRoot = relative(canonicalRoot, path)
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
    /* v8 ignore next 3 -- requires replacing a validated file between adjacent lstat/open/fstat calls. */
    if (!opened.isFile() || !sameIdentity(initial, opened)) {
      throw new Error(`${NAME}: curated install file changed while opening: ${relativePath}`)
    }
    if (opened.size > BigInt(CURATED_INSTALL_FILE_LIMIT)) {
      throw new Error(`${NAME}: curated install file exceeds ${String(CURATED_INSTALL_FILE_LIMIT)} bytes: ${relativePath}`)
    }
    const bytes = Buffer.alloc(Number(opened.size))
    let offset = 0
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null)
      /* v8 ignore next -- a stable regular descriptor cannot return early EOF. */
      if (count === 0) break
      offset += count
    }
    const assertCurrent = (): void => {
      const currentRoot = lstatSync(canonicalRoot, { bigint: true })
      const current = lstatSync(path, { bigint: true })
      const held = fstatSync(descriptor, { bigint: true })
      /* v8 ignore next 15 -- each failure requires same-process mutation between the read and immediate identity check. */
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
    /* v8 ignore next -- a stable regular descriptor cannot reach EOF before its captured size. */
    if (offset !== bytes.byteLength) {
      throw new Error(`${NAME}: curated install file changed while reading: ${relativePath}`)
    }
    assertCurrent()
    return {
      bytes,
      assertCurrent: () => {
        assertCurrent()
      },
      assertMoved: (movedRoot) => {
        const canonicalMovedRoot = realpathSync.native(movedRoot)
        const movedRootIdentity = lstatSync(movedRoot, { bigint: true })
        const movedPath = join(canonicalMovedRoot, relativePath)
        const current = lstatSync(movedPath, { bigint: true })
        const held = fstatSync(descriptor, { bigint: true })
        const currentBytes = Buffer.alloc(bytes.byteLength)
        let offset = 0
        while (offset < currentBytes.byteLength) {
          const count = readSync(
            descriptor,
            currentBytes,
            offset,
            currentBytes.byteLength - offset,
            offset,
          )
          if (count === 0) break
          offset += count
        }
        if (
          canonicalMovedRoot !== join(realpathSync.native(dirname(movedRoot)), basename(movedRoot))
          || movedRootIdentity.isSymbolicLink()
          || !movedRootIdentity.isDirectory()
          || !sameIdentity(rootIdentity, movedRootIdentity)
          || current.isSymbolicLink()
          || !current.isFile()
          || realpathSync.native(movedPath) !== movedPath
          || !sameIdentity(opened, current)
          || !sameIdentity(opened, held)
          || opened.size !== held.size
          || opened.mtimeNs !== held.mtimeNs
          || offset !== currentBytes.byteLength
          || !currentBytes.equals(bytes)
        ) {
          throw new Error(`${NAME}: curated install file changed: ${relativePath}`)
        }
      },
      close: () => { closeSync(descriptor) },
    }
  /* v8 ignore start -- only an injected descriptor failure after a successful open reaches this cleanup. */
  } catch (error) {
    closeSync(descriptor)
    throw error
  }
  /* v8 ignore stop */
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

interface BoundCandidateTree {
  readonly assertCurrent: () => void
  readonly assertMoved: (root: string) => void
}

interface InstalledCandidateTreeIdentity {
  readonly candidateId: string
  readonly packageName: string
  readonly treeSha256: string
}

interface CandidateTreeEntry {
  readonly identity: BigIntStats
  readonly name: string
  readonly typeKey: string
}

interface CandidateTreeDirectory {
  readonly identity: BigIntStats
  readonly entries: readonly string[]
  readonly relativeDirectory: string
}

interface CandidateTreeRoot {
  readonly canonicalPackageRoot: string
  readonly entryIdentity: BigIntStats
  readonly linkTarget: string | undefined
  readonly targetIdentity: BigIntStats
}

function readCandidateTreeEntries(directory: string): CandidateTreeEntry[] {
  return readdirSync(directory, { withFileTypes: true }).map((entry) => {
    const identity = lstatSync(join(directory, entry.name), { bigint: true })
    return {
      identity,
      name: entry.name,
      typeKey: JSON.stringify([entry.name, String(identity.mode & BigInt(constants.S_IFMT))]),
    }
  })
}

function resolveCandidateTreeRoot(
  profileRoot: string,
  identity: InstalledCandidateTreeIdentity,
  expected?: CandidateTreeRoot,
): CandidateTreeRoot {
  const canonicalProfileRoot = realpathSync.native(profileRoot)
  const nodeModulesRoot = join(canonicalProfileRoot, 'node_modules')
  assertRegularDirectory(nodeModulesRoot, 'curated profile node_modules')
  const packageEntry = join(nodeModulesRoot, ...identity.packageName.split('/'))
  const entryIdentity = lstatSync(packageEntry, { bigint: true })
  const linkTarget = entryIdentity.isSymbolicLink() ? readlinkSync(packageEntry) : undefined
  if (linkTarget === undefined && !entryIdentity.isDirectory()) {
    throw new Error(`${NAME}: installed candidate ${identity.candidateId} must be a directory or pnpm link`)
  }
  const canonicalPackageRoot = realpathSync.native(packageEntry)
  const targetIdentity = assertRegularDirectory(
    canonicalPackageRoot,
    `installed candidate ${identity.candidateId} target`,
  )
  const fromNodeModules = relative(realpathSync.native(nodeModulesRoot), canonicalPackageRoot)
  if (
    isAbsolute(fromNodeModules)
    || fromNodeModules === '..'
    || fromNodeModules.startsWith(`..${sep}`)
  ) {
    throw new Error(
      `${NAME}: curated installed candidate resolves outside canonical node_modules: ${identity.candidateId}`,
    )
  }
  const root = { canonicalPackageRoot, entryIdentity, linkTarget, targetIdentity }
  if (
    expected !== undefined
    && (
      linkTarget !== expected.linkTarget
      || !sameIdentity(entryIdentity, expected.entryIdentity)
      || !sameIdentity(targetIdentity, expected.targetIdentity)
    )
  ) {
    throw new Error(`${NAME}: curated installed candidate tree changed: ${identity.candidateId}`)
  }
  return root
}

function installedCandidateTreeSha256(
  profileRoot: string,
  identity: InstalledCandidateTreeIdentity,
  expectedRoot?: CandidateTreeRoot,
): string {
  const root = resolveCandidateTreeRoot(profileRoot, identity, expectedRoot)
  const { canonicalPackageRoot, targetIdentity: packageRootIdentity } = root
  const files: Array<{ readonly identity: BigIntStats; readonly relativePath: string }> = []
  const directories: CandidateTreeDirectory[] = []
  const pending = [{
    directory: canonicalPackageRoot,
    identity: packageRootIdentity,
    relativeDirectory: '',
    depth: 0,
  }]
  let entryCount = 0
  while (pending.length > 0) {
    const current = pending.pop() as typeof pending[number]
    const entries = readCandidateTreeEntries(current.directory)
    directories.push({
      identity: current.identity,
      entries: entries.map(entry => entry.typeKey).sort(),
      relativeDirectory: current.relativeDirectory,
    })
    for (const entry of entries) {
      entryCount++
      if (entryCount > CURATED_INSTALL_ENTRY_LIMIT) {
        throw new Error(`${NAME}: curated installed candidate tree exceeds the entry limit: ${identity.candidateId}`)
      }
      const relativePath = current.relativeDirectory === ''
        ? entry.name
        : `${current.relativeDirectory}/${entry.name}`
      const path = join(current.directory, entry.name)
      const entryIdentity = entry.identity
      if (entryIdentity.isDirectory()) {
        const depth = current.depth + 1
        if (depth > CURATED_INSTALL_DEPTH_LIMIT) {
          throw new Error(`${NAME}: curated installed candidate tree exceeds the depth limit: ${identity.candidateId}`)
        }
        pending.push({ directory: path, identity: entryIdentity, relativeDirectory: relativePath, depth })
      } else if (entryIdentity.isFile() && !entryIdentity.isSymbolicLink()) {
        files.push({ identity: entryIdentity, relativePath })
      } else {
        throw new Error(`${NAME}: curated installed candidate tree contains a non-regular entry: ${identity.candidateId}`)
      }
    }
  }
  files.sort((left, right) =>
    Buffer.compare(Buffer.from(left.relativePath), Buffer.from(right.relativePath)))
  const digest = createHash('sha256')
  let totalBytes = 0
  for (const { relativePath } of files) {
    const file = openBoundedRegularFile(canonicalPackageRoot, relativePath)
    try {
      totalBytes += file.bytes.byteLength
      if (totalBytes > CURATED_INSTALL_TREE_LIMIT) {
        throw new Error(`${NAME}: curated installed candidate tree exceeds the byte limit: ${identity.candidateId}`)
      }
      const pathBytes = Buffer.from(relativePath)
      digest.update(`${String(pathBytes.byteLength)}:`)
      digest.update(pathBytes)
      digest.update(`${String(file.bytes.byteLength)}:`)
      digest.update(file.bytes)
      file.assertCurrent()
    } finally {
      file.close()
    }
  }
  for (const { identity: fileIdentity, relativePath } of files) {
    const path = join(canonicalPackageRoot, relativePath)
    const current = lstatSync(path, { bigint: true })
    if (
      current.isSymbolicLink()
      || !current.isFile()
      || !sameIdentity(fileIdentity, current)
      || fileIdentity.size !== current.size
      || fileIdentity.mtimeNs !== current.mtimeNs
      || fileIdentity.ctimeNs !== current.ctimeNs
      || realpathSync.native(path) !== path
    ) {
      throw new Error(`${NAME}: curated installed candidate tree changed: ${identity.candidateId}`)
    }
  }
  for (const directory of directories) {
    const path = join(canonicalPackageRoot, directory.relativeDirectory)
    const current = lstatSync(path, { bigint: true })
    /* v8 ignore next -- directory replacement requires same-permission mutation during this synchronous hash. */
    if (
      current.isSymbolicLink()
      || !current.isDirectory()
      || !sameIdentity(directory.identity, current)
      || realpathSync.native(path) !== path
    ) {
      throw new Error(`${NAME}: curated installed candidate tree changed: ${identity.candidateId}`)
    }
    const currentEntries = readCandidateTreeEntries(path).map(entry => entry.typeKey).sort()
    if (JSON.stringify(currentEntries) !== JSON.stringify(directory.entries)) {
      throw new Error(`${NAME}: curated installed candidate tree changed: ${identity.candidateId}`)
    }
  }
  return digest.digest('hex')
}

function bindInstalledCandidateTree(
  profileRoot: string,
  identity: InstalledCandidateTreeIdentity,
): BoundCandidateTree {
  const root = resolveCandidateTreeRoot(profileRoot, identity)
  const expected = installedCandidateTreeSha256(profileRoot, identity, root)
  if (expected !== identity.treeSha256) {
    throw new Error(`${NAME}: curated installed candidate tree differs from the catalog: ${identity.candidateId}`)
  }
  const assertAt = (candidateRoot: string): void => {
    if (installedCandidateTreeSha256(candidateRoot, identity, root) !== expected) {
      throw new Error(`${NAME}: curated installed candidate tree changed: ${identity.candidateId}`)
    }
  }
  return {
    assertCurrent: () => { assertAt(profileRoot) },
    assertMoved: assertAt,
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

function assertCurrentDirectory(path: string, label: string, expected: BigIntStats): void {
  const current = assertRegularDirectory(path, label)
  if (!sameIdentity(current, expected)) {
    throw new Error(`${NAME}: ${label} changed`)
  }
}

function ensureContainedDirectory(
  parent: string,
  parentIdentity: BigIntStats,
  name: string,
  label: string,
): BigIntStats {
  assertCurrentDirectory(parent, `${label} parent`, parentIdentity)
  const path = join(parent, name)
  let identity: BigIntStats
  try {
    identity = assertRegularDirectory(path, label)
  } catch (error) {
    if (!isNodeError(error) || error.code !== 'ENOENT') throw error
    mkdirSync(path, { mode: 0o700 })
    identity = assertRegularDirectory(path, label)
  }
  if (dirname(realpathSync.native(path)) !== realpathSync.native(parent)) {
    throw new Error(`${NAME}: ${label} resolves outside its parent`)
  }
  assertCurrentDirectory(parent, `${label} parent`, parentIdentity)
  return identity
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
    const stageIdentity = assertRegularDirectory(stageDir, 'curated installed lock profile')
    const nodeModules = join(stageDir, 'node_modules')
    const nodeModulesIdentity = ensureContainedDirectory(
      stageDir,
      stageIdentity,
      'node_modules',
      'curated installed lock node_modules',
    )
    const store = join(nodeModules, '.pnpm')
    const storeIdentity = ensureContainedDirectory(
      nodeModules,
      nodeModulesIdentity,
      '.pnpm',
      'curated installed lock store',
    )
    assertCurrentDirectory(stageDir, 'curated installed lock profile', stageIdentity)
    assertCurrentDirectory(nodeModules, 'curated installed lock node_modules', nodeModulesIdentity)
    assertCurrentDirectory(store, 'curated installed lock store', storeIdentity)
    rootLock.assertCurrent()
    writeFileSync(installedLockPath, rootLock.bytes, { flag: 'wx', mode: 0o600 })
    rootLock.assertCurrent()
    assertCurrentDirectory(stageDir, 'curated installed lock profile', stageIdentity)
    assertCurrentDirectory(nodeModules, 'curated installed lock node_modules', nodeModulesIdentity)
    assertCurrentDirectory(store, 'curated installed lock store', storeIdentity)
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
  readonly activationFiles: readonly BoundRegularFile[]
  readonly candidateTrees: readonly BoundCandidateTree[]
  readonly locks: readonly BoundRegularFile[]
} {
  const files = openExistingCuratedProfileFiles(profile, stageHome, stageDir)
  const activationFiles: BoundRegularFile[] = []
  const candidateTrees: BoundCandidateTree[] = []
  const locks: BoundRegularFile[] = []
  try {
    const rootLock = openBoundedRegularFile(stageDir, 'pnpm-lock.yaml')
    locks.push(rootLock)
    const installedLock = openBoundedRegularFile(stageDir, 'node_modules/.pnpm/lock.yaml')
    locks.push(installedLock)
    const installedCandidates = assertCuratedProfileLockAdmission(profile, {
      root: rootLock.bytes,
      installed: installedLock.bytes,
    })
    for (const identity of installedCandidates) {
      candidateTrees.push(bindInstalledCandidateTree(stageDir, identity))
    }
    const loaded = loadProfile(NAME, profile, INSTALL_ANCHOR, stageHome, {
      profileFileReader: files.readFile,
    })
    assertCuratedProfileAdmission(profile, stageHome, loaded, [], { profileFiles: files })
    files.assertCurrent()
    for (const file of Object.keys(generatedCuratedProfileFiles(profile))) {
      activationFiles.push(openBoundedRegularFile(stageDir, file))
    }
    for (const file of activationFiles) file.assertCurrent()
    for (const lock of locks) lock.assertCurrent()
    return { files, activationFiles, candidateTrees, locks }
  } catch (error) {
    files.close()
    /* v8 ignore next -- only an injected failure after retaining part of the fixed generated-file set reaches this cleanup. */
    for (const file of activationFiles) file.close()
    for (const lock of locks) lock.close()
    throw error
  }
}

function activateStagedCuratedProfile(
  profile: CuratedProfileName,
  profilesDir: string,
  stageDir: string,
  lock: CuratedProfileLock,
  validation: ReturnType<typeof validateStagedCuratedProfile>,
): void {
  const liveDir = join(profilesDir, profile)
  const previousDir = join(profilesDir, `.${profile}.install-previous`)
  lock.assertOwned()
  let previousIdentity: BigIntStats | undefined
  if (existsSync(liveDir)) {
    previousIdentity = assertRegularDirectory(liveDir, 'curated profile')
    if (existsSync(previousDir)) {
      throw new Error(`${NAME}: stale curated profile backup was not reclaimed`)
    }
    renameSync(liveDir, previousDir)
  }
  let movedStage = false
  let stagedIdentity: BigIntStats | undefined
  try {
    lock.assertOwned()
    validation.files.assertCurrent()
    for (const file of validation.activationFiles) file.assertCurrent()
    for (const tree of validation.candidateTrees) tree.assertCurrent()
    for (const stagedLock of validation.locks) stagedLock.assertCurrent()
    stagedIdentity = assertRegularDirectory(stageDir, 'staged curated profile')
    renameSync(stageDir, liveDir)
    movedStage = true
    for (const file of validation.activationFiles) file.assertMoved(liveDir)
    for (const tree of validation.candidateTrees) tree.assertMoved(liveDir)
    for (const stagedLock of validation.locks) stagedLock.assertMoved(liveDir)
  } catch (error) {
    const rollbackErrors: unknown[] = []
    /* v8 ignore else -- pre-rename failures are rejected before entering activation. */
    if (movedStage && existsSync(liveDir)) {
      try {
        const currentLive = assertRegularDirectory(liveDir, 'activated curated profile')
        if (stagedIdentity === undefined || !sameIdentity(stagedIdentity, currentLive)) {
          throw new Error(`${NAME}: activated curated profile changed before rollback`)
        }
        renameSync(liveDir, stageDir)
      /* v8 ignore next 3 -- requires an injected failure while restoring the staged directory. */
      } catch (rollbackError) {
        /* v8 ignore next -- the injected rollback-failure branch is outside normal filesystem semantics. */
        rollbackErrors.push(rollbackError)
      }
    }
    /* v8 ignore else -- the no-previous case has no rollback state to restore. */
    if (previousIdentity !== undefined && !existsSync(liveDir)) {
      try {
        const currentPrevious = assertRegularDirectory(previousDir, 'previous curated profile')
        if (!sameIdentity(previousIdentity, currentPrevious)) {
          throw new Error(`${NAME}: previous curated profile changed before rollback`)
        }
        renameSync(previousDir, liveDir)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `${NAME}: curated profile activation and rollback both failed`,
        { cause: error },
      )
    }
    throw error
  }
  if (previousIdentity !== undefined) {
    try {
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
      liveFiles?.close()
      liveFiles = undefined
      liveLock?.close()
      liveLock = undefined
      activateStagedCuratedProfile(profile, profilesDir, stageDir, lock, stagedValidation)
      return 0
    } finally {
      stagedValidation?.files.close()
      for (const file of stagedValidation?.activationFiles ?? []) file.close()
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
    initProfile(dir, ordinaryProfileBundles(profile))
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
    reconcilePlugins(profile, before, dir)
  }
  return exitCode
}

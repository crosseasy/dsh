/**
 * Curated profile templates and DSH home materialization helpers.
 * @module @deepseek-ai/dsh-curated-profiles
 */

import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  type BigIntStats,
} from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import {
  composeEntries,
  loadOverlayPatches,
  PROFILE_PATCH_FILENAME,
  resolveProfileDir,
  type Profile,
  type ProfileManifest,
  type TextFileReader,
} from '@deepseek-ai/dsh-app-boot'
import {
  assertCuratedInstalledLocks,
  formatYamlParseError,
  hasCompleteCurrentProfileActivationEvidence,
  loadCuratedCatalog,
  type CuratedInstalledCandidateIdentity,
} from '@deepseek-ai/dsh-curated-policy'
import { dump as dumpYaml, load as loadYaml } from 'js-yaml'

/** Profile names owned by the curated profile package. */
export type CuratedProfileName =
  | 'web-curated'
  | 'web-coding'
  | 'web-research'
  | 'web-enterprise'
  | 'web-personal'

/** One curated profile template. */
export interface CuratedProfileTemplate {
  /** Ordered bundle layers applied before the profile patch. */
  readonly bundles: readonly string[]
}

const BASE_BUNDLES = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-curated-base',
] as const
/** Runtime-admitted third-party bundles shared by curated web profiles except `web-personal`. */
export const CURATED_BASELINE_BUNDLES = [] as const
const CODING_SCENARIO_BUNDLES = [] as const

const WEB_CURATED_BUNDLES = [...BASE_BUNDLES, ...CURATED_BASELINE_BUNDLES] as const

/** Deterministic curated profile templates keyed by profile name. */
export const CURATED_PROFILE_TEMPLATES: Readonly<Record<CuratedProfileName, CuratedProfileTemplate>> = Object.freeze({
  'web-curated': Object.freeze({
    bundles: Object.freeze([...WEB_CURATED_BUNDLES]),
  }),
  'web-coding': Object.freeze({
    bundles: Object.freeze([
      ...WEB_CURATED_BUNDLES,
      ...CODING_SCENARIO_BUNDLES,
    ]),
  }),
  'web-research': Object.freeze({
    bundles: Object.freeze([...WEB_CURATED_BUNDLES]),
  }),
  'web-enterprise': Object.freeze({
    bundles: Object.freeze([
      ...BASE_BUNDLES,
      ...CURATED_BASELINE_BUNDLES,
    ]),
  }),
  'web-personal': Object.freeze({
    bundles: Object.freeze([...BASE_BUNDLES]),
  }),
})

const PROFILE_NPMRC = 'ignore-scripts=true\n'
const PROFILE_WORKSPACE = {
  packages: ['.'],
  nodeLinker: 'hoisted',
  autoInstallPeers: false,
} as const
const PROFILE_ROOT_FILENAME = 'cordis.yml'
const MANAGED_PROFILE_FILES = ['package.json', PROFILE_PATCH_FILENAME, 'pnpm-workspace.yaml', '.npmrc'] as const
type ManagedProfileFile = typeof MANAGED_PROFILE_FILES[number]
type ProfileFile = ManagedProfileFile | typeof PROFILE_ROOT_FILENAME

const INSTALLATION_OWNED_PROFILE_BUNDLES = new Set([
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-headless',
  '@deepseek-ai/dsh-curated-base',
])
const FULL_GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u
const INSTALL_LIFECYCLE_SCRIPT_PATTERN = /^(?:preinstall|install|postinstall|prepare|prepack)$/u
const moduleRequire = createRequire(import.meta.url)
type CuratedPatch = Profile['patches'][number]

/** Profile manifest persisted for a materialized curated profile. */
export interface CuratedProfileManifest extends ProfileManifest {
  /** Profile directories are local install roots and are never published. */
  readonly private?: boolean
}

/** Options controlling which existing profile files materialization validates. */
export interface CuratedProfileMaterializeOptions {
  /** `false` skips the user patch for bundles-only recovery diagnostics. */
  userLayer?: boolean
}

/** Generated managed-file content keyed by profile-relative filename. */
export type CuratedProfileGeneratedFiles = Readonly<Record<ManagedProfileFile, string>>

/** Descriptor-captured pnpm lock bytes for one installed curated profile. */
export interface CuratedProfileLockBytes {
  /** Root `pnpm-lock.yaml` bytes. */
  readonly root: Uint8Array
  /** Installed `node_modules/.pnpm/lock.yaml` bytes. */
  readonly installed: Uint8Array
}

/** Descriptor-bound decoded UTF-8 root text retained through initial Loader consumption. */
export interface CuratedProfileRootBinding {
  /** Exact decoded UTF-8 text captured from the published root file. */
  readonly content: string
  /** Reject when the retained profile or root file identity changed. */
  readonly assertCurrent: () => void
}

/**
 * Return the complete generated managed-file content for one curated profile.
 * @param profileName - Curated profile template to render.
 * @returns generated file content keyed by managed filename.
 */
export function generatedCuratedProfileFiles(profileName: CuratedProfileName): CuratedProfileGeneratedFiles {
  const template = CURATED_PROFILE_TEMPLATES[profileName]
  const manifest: CuratedProfileManifest = {
    name: `dsh-profile-${profileName}`,
    private: true,
    dependencies: curatedProfileDependenciesForBundles(template.bundles, profileName),
    dsh: { profile: { bundles: [...template.bundles] } },
  }
  return {
    'package.json': `${JSON.stringify(manifest, undefined, 2)}\n`,
    [PROFILE_PATCH_FILENAME]: profilePatchFor(profileName, template.bundles),
    'pnpm-workspace.yaml': profileWorkspaceFor(profileName, template.bundles),
    '.npmrc': PROFILE_NPMRC,
  }
}

/** Descriptor-bound managed profile bytes and retained path identities. */
export interface CuratedProfileFileSnapshot {
  /** Absolute profile directory whose identity is retained by this snapshot. */
  readonly dir: string
  /** Test whether the snapshot captured one managed profile file. */
  readonly has: (file: ManagedProfileFile) => boolean
  /** Read one managed profile file from captured bytes after checking its current path identity. */
  readonly readFile: TextFileReader
  /** Reject when the profile directory or any captured file no longer has its opened identity. */
  readonly assertCurrent: () => void
  /**
   * Replace `cordis.yml` by checked sibling-temporary rename and recheck this
   * snapshot after publication. A same-permission process can still move the
   * original directory and link the same inode back before the path-based rename.
   */
  readonly writeRootConfig: (content: string) => CuratedProfileRootBinding
  /** Close every retained file descriptor. */
  readonly close: () => void
}

/** Options for curated admission after a profile has been loaded. */
export interface CuratedProfileAdmissionOptions extends CuratedProfileMaterializeOptions {
  /** Descriptor-bound bytes also used by the profile loader. */
  profileFiles?: CuratedProfileFileSnapshot
}

/**
 * Create package dependency declarations for profile bundles not supplied by the dsh installation.
 * @param bundles - Profile bundle names in layer order.
 * @param profileName - Profile that every third-party catalog row must explicitly target.
 * @returns package.json dependencies keyed by bundle package name.
 */
export function curatedProfileDependenciesForBundles(
  bundles: readonly string[],
  profileName: CuratedProfileName,
): Record<string, string> {
  const allowlisted = loadAllowlistedThirdPartyBundleDependencies(profileName)
  const selected = new Set(bundles)
  const dependencies: Record<string, string> = {}
  for (const bundle of bundles) {
    if (INSTALLATION_OWNED_PROFILE_BUNDLES.has(bundle)) continue
    const dependency = allowlisted.get(bundle)
    if (dependency === undefined) {
      throw new Error(`curated profile bundle ${JSON.stringify(bundle)} has no checked-in dependency source`)
    }
    if (dependency.spec === undefined) {
      if (!dependency.sourceVerified) {
        throw new Error(`curated profile bundle ${JSON.stringify(bundle)} is not active and verified for profile ${profileName}`)
      }
      throw new Error(`curated profile bundle ${JSON.stringify(bundle)} is not active and accepted for profile ${profileName}`)
    }
    for (const requiredBundle of dependency.requiredRuntimeBundles) {
      const provider = allowlisted.get(requiredBundle)
      if (requiredBundle === bundle || !selected.has(requiredBundle) || provider?.spec === undefined) {
        throw new Error(
          `curated profile bundle ${JSON.stringify(bundle)} requires runtime bundle `
          + `${JSON.stringify(requiredBundle)} in profile ${profileName}`,
        )
      }
      if (!provider.activationEvidenceComplete) {
        throw new Error(
          `curated profile runtime bundle ${JSON.stringify(requiredBundle)} does not have complete `
          + `activation evidence for profile ${profileName}`,
        )
      }
    }
    if (!dependency.activationEvidenceComplete) {
      throw new Error(
        `curated profile bundle ${JSON.stringify(bundle)} does not have complete `
        + `activation evidence for profile ${profileName}`,
      )
    }
    dependencies[bundle] = dependency.spec
  }
  return dependencies
}

/**
 * Admit both installed lock snapshots against the checked-in catalog and generated profile dependencies.
 * @param profileName - Built-in curated profile whose installed locks are being admitted.
 * @param locks - Descriptor-captured root and installed lock bytes.
 * @returns frozen installed candidate identities in catalog order.
 * @throws when either lock differs from the profile's exact catalog pins.
 */
export function assertCuratedProfileLockAdmission(
  profileName: CuratedProfileName,
  locks: CuratedProfileLockBytes,
): readonly CuratedInstalledCandidateIdentity[] {
  const template = CURATED_PROFILE_TEMPLATES[profileName]
  return assertCuratedInstalledLocks({
    catalog: loadCuratedCatalog(resolveAllowlistPath()),
    profileId: profileName,
    manifestDependencies: curatedProfileDependenciesForBundles(template.bundles, profileName),
    rootLock: locks.root,
    installedLock: locks.installed,
  })
}

/**
 * Materialize one curated profile under a DSH home without overwriting existing files.
 * @param profileName - Curated profile template to write.
 * @param home - DSH home directory receiving `profiles/<profileName>`.
 * @param options - Existing user-layer validation options.
 * @returns the absolute profile directory.
 * @throws when composition requires a lifecycle build, existing files violate policy,
 * or the profile directory identity changes during materialization.
 */
export function materializeCuratedProfile(
  profileName: CuratedProfileName,
  home: string,
  options: CuratedProfileMaterializeOptions = {},
): string {
  const template = CURATED_PROFILE_TEMPLATES[profileName]
  const dir = resolveProfileDir(profileName, home)
  assertProfileDirectoryContained(profileName, home, dir)
  const generatedFiles = generatedCuratedProfileFiles(profileName)
  mkdirSync(dir, { recursive: true })
  const existingFiles = openManagedProfileFiles(profileName, home, dir)
  const createdFiles = new Map<ManagedProfileFile, BigIntStats>()
  try {
    validateExistingCuratedProfileFiles(profileName, dir, template, existingFiles, options)

    for (const file of MANAGED_PROFILE_FILES) {
      if (existingFiles.has(file)) continue
      const createdIdentity = writeManagedProfileFile(
        profileName,
        file,
        join(dir, file),
        generatedFiles[file],
        existingFiles,
      )
      if (createdIdentity !== undefined) createdFiles.set(file, createdIdentity)
    }
    existingFiles.assertCurrent()
    return dir
  } catch (error) {
    const rollbackErrors: unknown[] = []
    for (const [file, identity] of [...createdFiles].reverse()) {
      try {
        existingFiles.rollbackCreated(file, identity)
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError)
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        `${errorMessage(error)}; ${profileName} managed profile rollback failed`,
        { cause: error },
      )
    }
    throw error
  } finally {
    existingFiles.close()
  }
}

/**
 * Materialize a curated profile and retain descriptor-bound bytes for its immediate load.
 * @param profileName - Curated profile template to materialize.
 * @param home - DSH home containing the profile.
 * @param options - Existing user-layer validation options.
 * @returns a snapshot that the caller must close after loading and admission.
 */
export function materializeCuratedProfileForLoad(
  profileName: CuratedProfileName,
  home: string,
  options: CuratedProfileMaterializeOptions = {},
): CuratedProfileFileSnapshot {
  const dir = materializeCuratedProfile(profileName, home, options)
  return openManagedProfileFiles(profileName, home, dir)
}

/**
 * Validate and retain an existing curated profile without creating or changing files.
 * @param profileName - Curated profile template the directory must match.
 * @param home - DSH home that owns the profile directory.
 * @param dir - Existing profile directory; defaults to the live profile path.
 * @param options - Existing user-layer validation options.
 * @returns retained descriptor-bound profile files that the caller must close.
 */
export function openExistingCuratedProfileFiles(
  profileName: CuratedProfileName,
  home: string,
  dir: string = resolveProfileDir(profileName, home),
  options: CuratedProfileMaterializeOptions = {},
): CuratedProfileFileSnapshot {
  const template = CURATED_PROFILE_TEMPLATES[profileName]
  const existingFiles = openManagedProfileFiles(profileName, home, dir)
  try {
    for (const file of MANAGED_PROFILE_FILES) {
      if (!existingFiles.has(file)) {
        throw new Error(`${profileName} managed profile file ${file} is missing`)
      }
    }
    validateExistingCuratedProfileFiles(profileName, dir, template, existingFiles, options)
    return existingFiles
  } catch (error) {
    existingFiles.close()
    throw error
  }
}

function validateExistingCuratedProfileFiles(
  profileName: CuratedProfileName,
  dir: string,
  template: CuratedProfileTemplate,
  existingFiles: CuratedProfileFileSnapshot,
  options: CuratedProfileMaterializeOptions,
): void {
  validateExistingPackageManagerPolicy(profileName, dir, existingFiles)
  validateExistingCuratedManifest(profileName, dir, template, existingFiles)
  if (options.userLayer !== false) {
    if (profileName === 'web-enterprise') {
      validateExistingEnterprisePatch(dir, template, existingFiles)
    } else {
      validateExistingProfilePatch(profileName, dir, existingFiles)
    }
  }
  existingFiles.assertCurrent()
}

interface OpenManagedProfileFile {
  readonly descriptor: number
  readonly identity: BigIntStats
  readonly path: string
  readonly text: string
}

interface ManagedProfileFiles extends CuratedProfileFileSnapshot {
  /** Retain and verify a managed file that appeared after the initial snapshot. */
  readonly retain: (file: ProfileFile, expectedIdentity?: BigIntStats) => string
  /** Remove a file published by this materialization if its retained identity is unchanged. */
  readonly rollbackCreated: (file: ManagedProfileFile, expectedIdentity: BigIntStats) => void
}

interface ProfileDirectoryBinding {
  readonly canonicalDir: string
  readonly canonicalHome: string
  readonly canonicalProfilesDir: string
  readonly dir: string
  readonly directoryIdentity: BigIntStats
  readonly profilesDir: string
  readonly profilesDirectoryIdentity: BigIntStats
}

function openManagedProfileFiles(
  profileName: CuratedProfileName,
  home: string,
  dir: string,
): ManagedProfileFiles {
  const containment = assertProfileDirectoryContained(profileName, home, dir)
  const profilesDirectoryIdentity = lstatSync(containment.profilesDir, { bigint: true })
  const directoryIdentity = lstatSync(dir, { bigint: true })
  if (directoryIdentity.isSymbolicLink() || !directoryIdentity.isDirectory()) {
    throw new Error(`${profileName} profile root must be a regular directory inside the DSH home`)
  }
  const canonicalDir = realpathSync.native(dir)
  const directory = {
    ...containment,
    canonicalDir,
    dir,
    directoryIdentity,
    profilesDirectoryIdentity,
  }
  assertProfileDirectoryCurrent(profileName, directory)
  const opened = new Map<ProfileFile, OpenManagedProfileFile>()
  try {
    for (const file of MANAGED_PROFILE_FILES) {
      const path = join(dir, file)
      let initial: BigIntStats
      try {
        initial = lstatSync(path, { bigint: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
        throw error
      }
      if (initial.isSymbolicLink() || !initial.isFile()) {
        throw new Error(`${profileName} managed profile file ${file} must be a regular file`)
      }
      opened.set(file, openManagedProfileFile(
        profileName,
        file,
        path,
        initial,
        directory,
      ))
    }
  } catch (error) {
    for (const entry of opened.values()) closeSync(entry.descriptor)
    throw error
  }
  let closed = false
  const assertOpen = (): void => {
    if (closed) throw new Error(`${profileName} managed profile file snapshot is closed`)
  }
  const assertCurrent = (): void => {
    assertOpen()
    assertProfileDirectoryCurrent(profileName, directory)
    for (const [file, entry] of opened) {
      assertManagedProfileFileCurrent(
        profileName,
        file,
        entry,
        directory,
      )
    }
  }
  const snapshot: ManagedProfileFiles = {
    dir,
    has: file => opened.has(file),
    readFile: (path) => {
      const file = MANAGED_PROFILE_FILES.find(file => join(dir, file) === path)
      if (file === undefined) return undefined
      const entry = opened.get(file)
      /* v8 ignore next -- a matched name is inserted or omitted with the same fixed file list. */
      if (entry === undefined) return undefined
      assertManagedProfileFileCurrent(
        profileName,
        file,
        entry,
        directory,
      )
      return entry.text
    },
    assertCurrent,
    retain: (file, expectedIdentity) => {
      assertOpen()
      if (opened.has(file)) throw new Error(`${profileName} managed profile file ${file} is already retained`)
      const path = join(dir, file)
      let initial: BigIntStats
      try {
        initial = lstatSync(path, { bigint: true })
      } catch {
        throw managedProfileFileChanged(profileName, file)
      }
      if (initial.isSymbolicLink() || !initial.isFile()) {
        throw new Error(`${profileName} managed profile file ${file} must be a regular file`)
      }
      const entry = openManagedProfileFile(profileName, file, path, initial, directory)
      if (expectedIdentity !== undefined && !sameFileIdentity(expectedIdentity, entry.identity)) {
        closeSync(entry.descriptor)
        throw managedProfileFileChanged(profileName, file)
      }
      opened.set(file, entry)
      return entry.text
    },
    rollbackCreated: (file, expectedIdentity) => {
      assertOpen()
      const entry = opened.get(file)
      if (entry !== undefined) {
        if (!sameFileIdentity(expectedIdentity, entry.identity)) throw managedProfileFileChanged(profileName, file)
        assertManagedProfileFileCurrent(profileName, file, entry, directory)
        unlinkSync(entry.path)
        closeSync(entry.descriptor)
        opened.delete(file)
      } else {
        assertProfileDirectoryCurrent(profileName, directory)
        const current = lstatSync(join(dir, file), { bigint: true })
        if (current.isSymbolicLink() || !current.isFile() || !sameFileIdentity(expectedIdentity, current)) {
          throw managedProfileFileChanged(profileName, file)
        }
        unlinkSync(join(dir, file))
      }
      assertProfileDirectoryCurrent(profileName, directory)
    },
    writeRootConfig: (content) => {
      const identity = writeProfileFile(
        profileName,
        PROFILE_ROOT_FILENAME,
        join(dir, PROFILE_ROOT_FILENAME),
        content,
        snapshot,
        renameSync,
      )
      const retainedContent = snapshot.retain(PROFILE_ROOT_FILENAME, identity)
      if (retainedContent !== content) throw managedProfileFileChanged(profileName, PROFILE_ROOT_FILENAME)
      snapshot.assertCurrent()
      return { content: retainedContent, assertCurrent: snapshot.assertCurrent }
    },
    close: () => {
      if (closed) return
      closed = true
      for (const entry of opened.values()) closeSync(entry.descriptor)
    },
  }
  return snapshot
}

function openManagedProfileFile(
  profileName: CuratedProfileName,
  file: ProfileFile,
  path: string,
  initial: BigIntStats,
  directory: ProfileDirectoryBinding,
): OpenManagedProfileFile {
  let flags = constants.O_RDONLY | constants.O_NONBLOCK
  /* v8 ignore else -- Windows does not expose O_NOFOLLOW. */
  if (typeof constants.O_NOFOLLOW === 'number') flags |= constants.O_NOFOLLOW
  let descriptor: number
  try {
    descriptor = openSync(path, flags)
  } catch (error) {
    if (isNodeError(error) && ['ELOOP', 'ENOENT', 'ENOTDIR'].includes(error.code)) {
      throw managedProfileFileChanged(profileName, file)
    }
    throw error
  }
  try {
    const before = fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) {
      throw new Error(`${profileName} managed profile file ${file} must be a regular file`)
    }
    if (!sameFileIdentity(initial, before)) throw managedProfileFileChanged(profileName, file)
    const openedEntry = {
      descriptor,
      identity: before,
      path,
      text: '',
    }
    assertManagedProfileFileCurrent(
      profileName,
      file,
      openedEntry,
      directory,
    )
    const entry = {
      ...openedEntry,
      text: readManagedProfileFile(descriptor, before, profileName, file),
    }
    assertManagedProfileFileCurrent(
      profileName,
      file,
      entry,
      directory,
    )
    return entry
  } catch (error) {
    closeSync(descriptor)
    throw error
  }
}

function readManagedProfileFile(
  descriptor: number,
  before: BigIntStats,
  profileName: CuratedProfileName,
  file: ProfileFile,
): string {
  const content = Buffer.alloc(Number(before.size))
  let offset = 0
  while (offset < content.byteLength) {
    const bytesRead = readSync(descriptor, content, offset, content.byteLength - offset, null)
    /* v8 ignore next -- stable regular files do not return early EOF. */
    if (bytesRead === 0) break
    offset += bytesRead
  }
  const after = fstatSync(descriptor, { bigint: true })
  if (
    offset !== content.byteLength
    || !sameFileIdentity(before, after)
    || before.size !== after.size
    || before.mtimeNs !== after.mtimeNs
    || before.ctimeNs !== after.ctimeNs
  ) {
    throw managedProfileFileChanged(profileName, file)
  }
  return content.toString('utf8')
}

function assertManagedProfileFileCurrent(
  profileName: CuratedProfileName,
  file: ProfileFile,
  entry: OpenManagedProfileFile,
  directory: ProfileDirectoryBinding,
): void {
  try {
    assertProfileDirectoryCurrent(profileName, directory)
    const current = lstatSync(entry.path, { bigint: true })
    const descriptor = fstatSync(entry.descriptor, { bigint: true })
    if (
      current.isSymbolicLink()
      || !current.isFile()
      || realpathSync.native(entry.path) !== join(directory.canonicalDir, file)
      || !sameFileIdentity(entry.identity, descriptor)
      || !sameFileIdentity(current, descriptor)
      || entry.identity.size !== descriptor.size
      || entry.identity.mtimeNs !== descriptor.mtimeNs
      || entry.identity.ctimeNs !== descriptor.ctimeNs
    ) {
      throw managedProfileFileChanged(profileName, file)
    }
  } catch {
    throw managedProfileFileChanged(profileName, file)
  }
}

function sameFileIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.ino !== 0n && right.ino !== 0n && left.dev === right.dev && left.ino === right.ino
}

function managedProfileFileChanged(
  profileName: CuratedProfileName,
  file: ProfileFile,
): Error {
  return new Error(`${profileName} managed profile file ${file} changed while it was being read`)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException & { readonly code: string } {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function writeManagedProfileFile(
  profileName: CuratedProfileName,
  file: ManagedProfileFile,
  path: string,
  content: string,
  profileFiles: ManagedProfileFiles,
): BigIntStats | undefined {
  return writeProfileFile(profileName, file, path, content, profileFiles, linkSync)
}

function writeProfileFile(
  profileName: CuratedProfileName,
  file: typeof PROFILE_ROOT_FILENAME,
  path: string,
  content: string,
  profileFiles: ManagedProfileFiles,
  publish: typeof renameSync,
): BigIntStats
function writeProfileFile(
  profileName: CuratedProfileName,
  file: ManagedProfileFile,
  path: string,
  content: string,
  profileFiles: ManagedProfileFiles,
  publish: typeof linkSync,
): BigIntStats | undefined
function writeProfileFile(
  profileName: CuratedProfileName,
  file: ProfileFile,
  path: string,
  content: string,
  profileFiles: ManagedProfileFiles,
  publish: (temporaryPath: string, path: string) => void,
): BigIntStats | undefined {
  const temporaryPath = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`)
  let flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL
  /* v8 ignore else -- Windows does not expose O_NOFOLLOW. */
  if (typeof constants.O_NOFOLLOW === 'number') flags |= constants.O_NOFOLLOW
  profileFiles.assertCurrent()
  const descriptor = openSync(temporaryPath, flags, 0o666)
  let identity: BigIntStats | undefined
  let publishedIdentity: BigIntStats | undefined
  let temporaryRemoved = false
  try {
    try {
      identity = fstatSync(descriptor, { bigint: true })
      assertCreatedManagedProfileFileCurrent(profileName, file, temporaryPath, descriptor, identity, profileFiles)
      writeFileSync(descriptor, content, { encoding: 'utf8' })
      assertCreatedManagedProfileFileCurrent(profileName, file, temporaryPath, descriptor, identity, profileFiles)
    } finally {
      closeSync(descriptor)
    }
    profileFiles.assertCurrent()
    try {
      publish(temporaryPath, path)
    } catch (error) {
      if (file === PROFILE_ROOT_FILENAME || !isNodeError(error) || error.code !== 'EEXIST') throw error
      const concurrentContent = profileFiles.retain(file)
      if (concurrentContent !== content) {
        throw new Error(`${profileName} concurrently created managed profile file ${file} violates curated policy`)
      }
      profileFiles.assertCurrent()
      return undefined
    }
    publishedIdentity = identity
    profileFiles.assertCurrent()
    const published = lstatSync(path, { bigint: true })
    if (!sameFileIdentity(identity, published)) throw managedProfileFileChanged(profileName, file)
    if (file !== PROFILE_ROOT_FILENAME) {
      removeCreatedManagedProfileFile(temporaryPath, identity)
      temporaryRemoved = true
      const retainedContent = profileFiles.retain(file, identity)
      if (retainedContent !== content) throw managedProfileFileChanged(profileName, file)
      profileFiles.assertCurrent()
      return lstatSync(path, { bigint: true })
    }
    return published
  } catch (error) {
    if (file !== PROFILE_ROOT_FILENAME && publishedIdentity !== undefined) {
      try {
        profileFiles.rollbackCreated(file, publishedIdentity)
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          `${errorMessage(error)}; ${profileName} managed profile file ${file} rollback failed`,
          { cause: error },
        )
      }
    }
    throw error
  } finally {
    if (identity === undefined) {
      try {
        unlinkSync(temporaryPath)
      } catch {
        // Identity acquisition failed, so cleanup cannot verify or safely retry the temporary path.
      }
    } else if (!temporaryRemoved) {
      removeCreatedManagedProfileFile(temporaryPath, identity)
    }
  }
}

function assertCreatedManagedProfileFileCurrent(
  profileName: CuratedProfileName,
  file: ProfileFile,
  path: string,
  descriptor: number,
  identity: BigIntStats,
  profileFiles: ManagedProfileFiles,
): void {
  try {
    profileFiles.assertCurrent()
    const current = lstatSync(path, { bigint: true })
    const descriptorIdentity = fstatSync(descriptor, { bigint: true })
    if (
      current.isSymbolicLink()
      || !current.isFile()
      || !sameFileIdentity(identity, current)
      || !sameFileIdentity(identity, descriptorIdentity)
    ) {
      throw managedProfileFileChanged(profileName, file)
    }
  } catch {
    throw managedProfileFileChanged(profileName, file)
  }
}

function removeCreatedManagedProfileFile(path: string, identity: BigIntStats): void {
  try {
    const current = lstatSync(path, { bigint: true })
    if (!current.isSymbolicLink() && current.isFile() && sameFileIdentity(identity, current)) unlinkSync(path)
  } catch {
    // A replaced ancestor can make the descriptor-owned temporary file unreachable by path.
  }
}

function assertProfileDirectoryContained(
  profileName: CuratedProfileName,
  home: string,
  dir: string,
): Pick<ProfileDirectoryBinding, 'canonicalHome' | 'canonicalProfilesDir' | 'profilesDir'> {
  const profilesDir = join(home, 'profiles')
  const canonicalHome = existsSync(home) ? realpathSync.native(home) : home
  if (existsSync(profilesDir)) {
    const profilesEntry = lstatSync(profilesDir)
    if (profilesEntry.isSymbolicLink() || !profilesEntry.isDirectory()) {
      throw new Error(`${profileName} profile root resolves outside the DSH home`)
    }
  }
  const canonicalProfilesDir = existsSync(profilesDir)
    ? realpathSync.native(profilesDir)
    : join(canonicalHome, 'profiles')
  const fromHome = relative(canonicalHome, canonicalProfilesDir)
  if (fromHome === '..' || fromHome.startsWith(`..${sep}`) || isAbsolute(fromHome)) {
    throw new Error(`${profileName} profile root resolves outside the DSH home`)
  }
  const containment = { canonicalHome, canonicalProfilesDir, profilesDir }
  if (!existsSync(dir)) return containment
  const entry = lstatSync(dir)
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new Error(`${profileName} profile root must be a regular directory inside the DSH home`)
  }
  const canonicalDir = realpathSync.native(dir)
  const fromProfiles = relative(canonicalProfilesDir, canonicalDir)
  /* v8 ignore next 3 -- requires replacing an already checked directory ancestor during this synchronous check. */
  if (fromProfiles === '..' || fromProfiles.startsWith(`..${sep}`) || isAbsolute(fromProfiles)) {
    throw new Error(`${profileName} profile root resolves outside the DSH home`)
  }
  return containment
}

function assertProfileDirectoryCurrent(
  profileName: CuratedProfileName,
  directory: ProfileDirectoryBinding,
): void {
  const currentProfilesDirectory = lstatSync(directory.profilesDir, { bigint: true })
  const currentDirectory = lstatSync(directory.dir, { bigint: true })
  if (
    realpathSync.native(dirname(directory.profilesDir)) !== directory.canonicalHome
    || realpathSync.native(directory.profilesDir) !== directory.canonicalProfilesDir
    || !sameFileIdentity(directory.profilesDirectoryIdentity, currentProfilesDirectory)
    || currentDirectory.isSymbolicLink()
    || !currentDirectory.isDirectory()
    || realpathSync.native(directory.dir) !== directory.canonicalDir
    || !sameFileIdentity(directory.directoryIdentity, currentDirectory)
  ) {
    throw new Error(`${profileName} profile root changed while managed files were being read`)
  }
}

function activeAssignedCandidatePackage(
  candidate: {
    readonly active: boolean
    readonly expectedPackage: unknown
    readonly id: string
    readonly targetProfiles: readonly string[]
  },
  profileName: CuratedProfileName,
): string | undefined {
  if (!candidate.active || !candidate.targetProfiles.includes(profileName)) return undefined
  if (typeof candidate.expectedPackage !== 'string' || candidate.expectedPackage.length === 0) {
    throw new Error(
      `curated profile active candidate ${candidate.id} assigned to ${profileName} must declare expectedPackage`,
    )
  }
  return candidate.expectedPackage
}

/**
 * Admit a loaded curated profile before config dump or Loader activation.
 * This boot check covers deterministic composition and package-manager
 * policy; curated-scripts preflight separately verifies installed artifacts
 * and lockfiles.
 * @param profileName - Curated profile selected by the launcher.
 * @param home - DSH home containing the loaded profile.
 * @param profile - Profile loaded through the installation-first resolver.
 * @param additionalUserLayers - Home and command-line patch layers above the profile patch.
 * @param options - User-layer admission options and optional descriptor-bound profile bytes.
 * @throws when the profile no longer matches its template or user layers can execute code.
 */
export function assertCuratedProfileAdmission(
  profileName: CuratedProfileName,
  home: string,
  profile: Profile,
  additionalUserLayers: readonly (readonly CuratedPatch[])[] = [],
  options: CuratedProfileAdmissionOptions = {},
): void {
  const template = CURATED_PROFILE_TEMPLATES[profileName]
  const ownFiles = options.profileFiles === undefined
  const existingFiles = options.profileFiles ?? openManagedProfileFiles(profileName, home, profile.dir)
  try {
    validateExistingPackageManagerPolicy(profileName, profile.dir, existingFiles)
    validateExistingCuratedManifest(profileName, profile.dir, template, existingFiles)
    existingFiles.assertCurrent()
  } finally {
    if (ownFiles) existingFiles.close()
  }
  if (!sameOrderedStrings(profile.layers.map(layer => layer.packageName), template.bundles)) {
    throw new Error(`${profileName} resolved bundle list violates curated policy`)
  }
  const assignedPackages = loadCuratedCatalog(resolveAllowlistPath()).candidates.flatMap((candidate) => {
    const packageName = activeAssignedCandidatePackage(candidate, profileName)
    return packageName === undefined ? [] : [packageName]
  })
  const selectedPackages = template.bundles.filter(bundle =>
    !INSTALLATION_OWNED_PROFILE_BUNDLES.has(bundle))
  if (!sameOrderedStrings(selectedPackages, assignedPackages)) {
    throw new Error(`${profileName} catalog assignments violate curated policy`)
  }
  if (options.userLayer === false) return

  const userLayers = [profile.patches, ...additionalUserLayers]
  if (containsDynamicExpression(userLayers)) {
    throw new Error(`${profileName} user patches must not contain dynamic expressions`)
  }
  if (userLayers.some(userLayerInsertsExecutableOrGroup)) {
    throw new Error(`${profileName} user patches introduce an unapproved executable or group`)
  }
  const approvedEntries = composeEntries([
    profile.layers.flatMap(layer => layer.patches),
  ])
  const effectiveEntries = composeEntries([
    profile.layers.flatMap(layer => layer.patches),
    ...userLayers.map(layer => [...layer]),
  ])
  if (!isDeepStrictEqual(
    executableEntryTopology(effectiveEntries),
    executableEntryTopology(approvedEntries),
  )) {
    throw new Error(`${profileName} user patches introduce an unapproved executable or group`)
  }
  if (profileName === 'web-enterprise' && !isSafeEnterpriseComposition(effectiveEntries, template)) {
    throw new Error('web-enterprise effective composition violates curated policy')
  }
}

function profileWorkspaceFor(profileName: CuratedProfileName, bundles: readonly string[]): string {
  const selected = new Set(bundles)
  const gitBuildCandidate = loadCuratedCatalog(resolveAllowlistPath()).candidates
    .find(candidate =>
      candidate.active
      && candidate.targetProfiles.includes(profileName)
      && candidate.expectedPackage !== null
      && selected.has(candidate.expectedPackage)
      && candidate.npmVersion === undefined
      && Object.keys(candidate.installScripts).some(script => INSTALL_LIFECYCLE_SCRIPT_PATTERN.test(script)))
  if (gitBuildCandidate !== undefined) {
    throw new Error(`${profileName} cannot include active dependencies that require lifecycle builds`)
  }
  return dumpYaml(PROFILE_WORKSPACE, { lineWidth: -1, noRefs: true })
}

function validateExistingCuratedManifest(
  profileName: CuratedProfileName,
  dir: string,
  template: CuratedProfileTemplate,
  existingFiles: CuratedProfileFileSnapshot,
): void {
  const manifestPath = join(dir, 'package.json')
  if (existingFiles.has('package.json')) {
    const manifest = JSON.parse(existingFiles.readFile(manifestPath) as string) as unknown
    const bundles = isRecord(manifest)
      && isRecord(manifest.dsh)
      && isRecord(manifest.dsh.profile)
      ? manifest.dsh.profile.bundles
      : undefined
    const expectedDependencies = curatedProfileDependenciesForBundles(template.bundles, profileName)
    if (
      !isRecord(manifest)
      || manifest.private !== true
      || manifest.name !== `dsh-profile-${profileName}`
      || !Array.isArray(bundles)
      || bundles.some(bundle => typeof bundle !== 'string')
      || bundles.length !== template.bundles.length
      || bundles.some((bundle, index) => bundle !== template.bundles[index])
      || !matchesStringRecord(manifest.dependencies, expectedDependencies)
      || hasAdditionalInstallDependencies(manifest)
    ) {
      throw new Error(`${profileName} existing manifest violates curated policy`)
    }
  }
}

function validateExistingProfilePatch(
  profileName: CuratedProfileName,
  dir: string,
  existingFiles: CuratedProfileFileSnapshot,
): void {
  const patchPath = join(dir, PROFILE_PATCH_FILENAME)
  if (!existingFiles.has(PROFILE_PATCH_FILENAME)) return
  const patch = loadCuratedProfilePatch(profileName, patchPath, existingFiles)
  if (containsDynamicExpression(patch)) {
    throw new Error(`${profileName} existing patch must not contain dynamic expressions`)
  }
  if (patch.some(userLayerInsertsExecutableOrGroup)) {
    throw new Error(`${profileName} existing patch introduces an unapproved executable or group`)
  }
}

function validateExistingEnterprisePatch(
  dir: string,
  template: CuratedProfileTemplate,
  existingFiles: CuratedProfileFileSnapshot,
): void {
  const patchPath = join(dir, PROFILE_PATCH_FILENAME)
  if (!existingFiles.has(PROFILE_PATCH_FILENAME)) return
  const patch = loadCuratedProfilePatch('web-enterprise', patchPath, existingFiles)
  if (containsDynamicExpression(patch)) {
    throw new Error('web-enterprise existing patch must not contain dynamic expressions')
  }
  const prohibition = enterpriseProhibition(patch, enterpriseProhibitedPackages(template))
  if (prohibition !== undefined) {
    throw new Error(`web-enterprise existing patch violates curated policy: prohibited ${prohibition}`)
  }
  const governedPlugins = governedEnterprisePlugins(template)
  const entries = composeEntries([
    [{
      insert: governedPlugins.flatMap(plugin =>
        plugin.entryIds.map(id => ({ id, name: plugin.name, config: {} }))),
    }],
    patch,
  ])
  if (!isSafeEnterpriseComposition(entries, template)) {
    throw new Error('web-enterprise existing patch violates curated policy')
  }
}

function loadCuratedProfilePatch(
  profileName: CuratedProfileName,
  patchPath: string,
  existingFiles: CuratedProfileFileSnapshot,
): CuratedPatch[] {
  const source = existingFiles.readFile(patchPath)
  return loadOverlayPatches(profileName, patchPath, () => source)
}

function sameOrderedStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function containsDynamicExpression(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  if (Array.isArray(value)) return value.some(containsDynamicExpression)
  const record = value as Record<string, unknown>
  return typeof record.__jsExpr === 'string'
    || Object.values(record).some(containsDynamicExpression)
}

function userLayerInsertsExecutableOrGroup(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(userLayerInsertsExecutableOrGroup)
  if (!isRecord(value)) return false
  if (Array.isArray(value.insert) && value.insert.length > 0) return true
  return Array.isArray(value.config) && value.config.some(userLayerInsertsExecutableOrGroup)
}

type ExecutableEntryTopologyItem = readonly [
  parentGroupPath: readonly string[],
  siblingIndex: number,
  id: string,
  name: string,
  group: boolean,
]

function executableEntryTopology(
  entries: ReturnType<typeof composeEntries>,
): readonly ExecutableEntryTopologyItem[] {
  const topology: ExecutableEntryTopologyItem[] = []
  const visit = (
    siblings: ReturnType<typeof composeEntries>,
    parentGroupPath: readonly string[],
  ): void => {
    siblings.forEach((entry, siblingIndex) => {
      const group = Boolean(entry.group)
      topology.push([parentGroupPath, siblingIndex, entry.id, entry.name, group])
      if (group && Array.isArray(entry.config)) {
        visit(entry.config as ReturnType<typeof composeEntries>, [...parentGroupPath, entry.id])
      }
    })
  }
  visit(entries, [])
  return topology
}

function hasAdditionalInstallDependencies(manifest: Record<string, unknown>): boolean {
  return [
    manifest.optionalDependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.bundledDependencies,
    manifest.bundleDependencies,
  ].some(value =>
    value !== undefined
    && (
      Array.isArray(value)
        ? value.length > 0
        : !isRecord(value) || Object.keys(value).length > 0
    ))
}

function validateExistingPackageManagerPolicy(
  profileName: CuratedProfileName,
  dir: string,
  existingFiles: CuratedProfileFileSnapshot,
): void {
  const npmrcPath = join(dir, '.npmrc')
  if (existingFiles.has('.npmrc')) {
    const npmrc = existingFiles.readFile(npmrcPath)
    if (npmrc !== PROFILE_NPMRC) {
      throw new Error(`${profileName} existing package-manager state violates curated policy`)
    }
  }
  const workspacePath = join(dir, 'pnpm-workspace.yaml')
  if (existingFiles.has('pnpm-workspace.yaml')) {
    const source = existingFiles.readFile(workspacePath) as string
    let workspace: unknown
    try {
      workspace = loadYaml(source)
    } catch (error) {
      const diagnostic = formatYamlParseError(error, workspacePath, source)
      /* v8 ignore next -- js-yaml parse failures are YAMLException instances accepted by the formatter. */
      throw new Error(
        `${profileName}: failed to parse workspace ${workspacePath}: `
        + (diagnostic ?? 'invalid YAML'),
      )
    }
    if (!isDeepStrictEqual(workspace, PROFILE_WORKSPACE)) {
      throw new Error(`${profileName} existing package-manager state violates curated policy`)
    }
  }
  const manifestPath = join(dir, 'package.json')
  if (existingFiles.has('package.json')) {
    const manifest = JSON.parse(existingFiles.readFile(manifestPath) as string) as unknown
    if (isRecord(manifest) && Object.hasOwn(manifest, 'pnpm')) {
      throw new Error(`${profileName} existing package-manager state violates curated policy`)
    }
  }
  if (
    existsSync(join(dir, '.pnpmfile.cjs'))
    || existsSync(join(dir, '.pnpmfile.js'))
    || existsSync(join(dir, '.pnpmfile.mjs'))
  ) {
    throw new Error(`${profileName} existing package-manager state violates curated policy`)
  }
}

function enterpriseProhibitedPackages(template: CuratedProfileTemplate): ReadonlySet<string> {
  const selected = new Set(template.bundles)
  return new Set(loadCuratedCatalog(resolveAllowlistPath()).candidates.flatMap(candidate =>
    candidate.expectedPackage !== null && !selected.has(candidate.expectedPackage)
      ? [candidate.expectedPackage]
      : []))
}

function enterpriseProhibition(
  value: unknown,
  prohibitedPackages: ReadonlySet<string>,
): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const prohibition = enterpriseProhibition(item, prohibitedPackages)
      if (prohibition !== undefined) return prohibition
    }
    return undefined
  }
  if (!isRecord(value)) return undefined
  if (typeof value.id === 'string' && !isSafeEnterpriseConfig(value.id, value.config)) {
    return 'governed-plugin configuration; restore the curated-safe configuration'
  }
  for (const [key, item] of Object.entries(value)) {
    if ((key === 'externalBodyEgress' || key === 'bodyEgress' || key === 'egressBody') && item !== false) {
      return 'external-body-egress override; remove it or set the egress setting to false'
    }
    if (key === 'anonymousVisionFallback' && item !== false) {
      return 'anonymous-vision-fallback override; remove it or set anonymousVisionFallback to false'
    }
    if (key === 'browserDownload' && item !== false) {
      return 'browser-download override; remove it or set browserDownload to false'
    }
    if (key === 'captureBody' && item !== false) {
      return 'body-capture override; remove it or set captureBody to false'
    }
    if (key === 'importMode' && item !== 'dry-run') {
      return 'config-import override; remove it or set importMode to dry-run'
    }
    if ((key === 'sessionsWrite' || key === 'writeSessions') && item !== false) {
      return 'session-write override; remove it or set session writes to false'
    }
    if (
      key === 'name'
      && typeof item === 'string'
      && prohibitedPackages.has(item)
    ) {
      return 'package insertion; remove the prohibited package row'
    }
    const prohibition = enterpriseProhibition(item, prohibitedPackages)
    if (prohibition !== undefined) return prohibition
  }
  return undefined
}

interface EnterprisePlugin {
  readonly name: string
  readonly entryIds: readonly string[]
  readonly configEntryId?: string
}

function governedEnterprisePlugins(template: CuratedProfileTemplate): readonly EnterprisePlugin[] {
  const selected = new Set(template.bundles)
  return loadCuratedCatalog(resolveAllowlistPath()).candidates.flatMap((candidate) => {
    if (
      !candidate.active
      || !candidate.targetProfiles.includes('web-enterprise')
      || candidate.expectedPackage === null
      || !selected.has(candidate.expectedPackage)
    ) {
      return []
    }
    const entryIds = candidate.resources?.entryIds
      ?? (candidate.config === undefined ? [] : [candidate.config.entryId])
    return [{
      name: candidate.expectedPackage,
      entryIds,
      ...candidate.config === undefined ? {} : { configEntryId: candidate.config.entryId },
    }]
  })
}

interface EffectiveEnterpriseEntry {
  readonly id?: string
  readonly name?: string
  readonly group?: boolean | null
  readonly disabled?: unknown
  readonly config?: unknown
}

interface EffectiveEnterpriseEntryState {
  readonly entry: EffectiveEnterpriseEntry
  readonly enabled: boolean
}

function effectiveEnterpriseEntryStates(
  entries: readonly EffectiveEnterpriseEntry[],
  ancestorsEnabled = true,
): readonly EffectiveEnterpriseEntryState[] {
  return entries.flatMap((entry) => {
    const enabled = ancestorsEnabled && (entry.disabled === undefined || entry.disabled === false)
    return [
      { entry, enabled },
      ...entry.group && Array.isArray(entry.config)
        ? effectiveEnterpriseEntryStates(entry.config.filter(isRecord), enabled)
        : [],
    ]
  })
}

function isSafeEnterpriseComposition(
  entries: ReturnType<typeof composeEntries>,
  template: CuratedProfileTemplate,
): boolean {
  return enterpriseProhibition(entries, enterpriseProhibitedPackages(template)) === undefined
    && hasSafeEnterprisePlugins(entries, governedEnterprisePlugins(template))
}

function hasSafeEnterprisePlugins(
  effectiveEntries: ReturnType<typeof composeEntries>,
  governedPlugins: readonly EnterprisePlugin[],
): boolean {
  const entries = effectiveEnterpriseEntryStates(effectiveEntries)
  return governedPlugins.every((plugin) => {
    const pluginEntries = entries.filter(state => state.entry.name === plugin.name)
    if (
      pluginEntries.length !== plugin.entryIds.length
      || !plugin.entryIds.every(id => pluginEntries.filter(state => state.entry.id === id).length === 1)
    ) {
      return false
    }
    if (plugin.configEntryId === undefined) return true
    const configured = pluginEntries.find(state => state.entry.id === plugin.configEntryId)
    return configured !== undefined
      && (plugin.configEntryId !== 'permission-rules' || configured.enabled)
      && isSafeEnterpriseConfig(plugin.configEntryId, configured.entry.config)
  })
}

function isSafeEnterpriseConfig(entryId: string, value: unknown): boolean {
  const config = isRecord(value) ? value : undefined
  if (entryId === 'memento') {
    return config?.writePolicy === 'ask'
      && isRecord(config.writePolicies)
      && Object.keys(config.writePolicies).length === 0
      && isRecord(config.proposals)
      && config.proposals.enabled === false
  }
  if (entryId === 'permission-rules') {
    return config?.badFilePolicy === 'fail' && config.enforce === true
  }
  if (entryId === 'loongsuite-observability') {
    return config?.captureContent === false
  }
  return true
}

function matchesStringRecord(value: unknown, expected: Readonly<Record<string, string>>): boolean {
  return isDeepStrictEqual(value, expected)
}

function profilePatchFor(profileName: CuratedProfileName, bundles: readonly string[]): string {
  const selectedBundles = new Set(bundles)
  const entries = loadCuratedCatalog(resolveAllowlistPath()).candidates.flatMap((candidate) => {
    if (
      !candidate.active
      || !candidate.targetProfiles.includes(profileName)
      || candidate.expectedPackage === null
      || !selectedBundles.has(candidate.expectedPackage)
      || candidate.config === undefined
    ) {
      return []
    }
    return [{ id: candidate.config.entryId, config: candidate.config.values }]
  })
  return dumpYaml(entries, { lineWidth: -1, noRefs: true })
}

function loadAllowlistedThirdPartyBundleDependencies(
  profileName: CuratedProfileName,
): ReadonlyMap<string, {
  readonly activationEvidenceComplete: boolean
  readonly requiredRuntimeBundles: readonly string[]
  readonly sourceVerified: boolean
  readonly spec?: string
}> {
  const allowlistPath = resolveAllowlistPath()
  const source = readFileSync(allowlistPath, 'utf8')
  let parsed: unknown
  try {
    parsed = loadYaml(source)
  } catch (error) {
    const diagnostic = formatYamlParseError(error, allowlistPath, source)
    /* v8 ignore next -- js-yaml parse failures are YAMLException instances accepted by the formatter. */
    throw new Error(
      'curated profile dependency allowlist cannot be loaded: '
      + (diagnostic ?? 'invalid YAML'),
    )
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.candidates)) {
    throw new Error('curated profile dependency allowlist must contain a candidates array')
  }

  const dependencies = new Map<string, {
    readonly activationEvidenceComplete: boolean
    readonly requiredRuntimeBundles: readonly string[]
    readonly sourceVerified: boolean
    readonly spec?: string
  }>()
  parsed.candidates.forEach((candidate, index) => {
    if (!isRecord(candidate)) {
      throw new Error(`curated profile dependency allowlist candidates[${String(index)}] must be a mapping`)
    }
    const record = candidate
    const active = requiredBoolean(record.active, `candidates[${String(index)}].active`)
    const rejections = requiredArray(record.rejections, `candidates[${String(index)}].rejections`)
    const targetProfiles = requiredStringArray(record.targetProfiles, `candidates[${String(index)}].targetProfiles`)
    const id = typeof record.id === 'string' && record.id.length > 0
      ? record.id
      : requiredString(record.expectedPackage, `candidates[${String(index)}].expectedPackage`)
    activeAssignedCandidatePackage({
      active,
      expectedPackage: record.expectedPackage,
      id,
      targetProfiles,
    }, profileName)
    if (typeof record.expectedPackage !== 'string') return
    if (dependencies.has(record.expectedPackage)) {
      throw new Error(`curated profile dependency allowlist package ${record.expectedPackage} is duplicated`)
    }
    const sourceVerified = verifiedSource(record.sourceStatus, `candidates[${String(index)}].sourceStatus`)
    const requiredRuntimeBundles = record.requiredRuntimeBundles === undefined
      ? []
      : requiredStringArray(
        record.requiredRuntimeBundles,
        `candidates[${String(index)}].requiredRuntimeBundles`,
      )
    const activationEvidenceComplete = hasCompleteCurrentProfileActivationEvidence({
      requiredRuntimeBundles,
      runtimeActivationEvidence: record.runtimeActivationEvidence,
      targetProfiles,
    }, profileName)
    if (!active || rejections.length > 0 || !targetProfiles.includes(profileName) || !sourceVerified) {
      dependencies.set(record.expectedPackage, {
        activationEvidenceComplete,
        requiredRuntimeBundles,
        sourceVerified,
      })
      return
    }
    const repository = requiredString(record.repository, `candidates[${String(index)}].repository`)
    const commit = requiredString(record.commit, `candidates[${String(index)}].commit`)
    const repositoryPath = nullableString(record.repositoryPath, `candidates[${String(index)}].repositoryPath`)
    const npmVersion = record.npmVersion === undefined
      ? undefined
      : requiredString(record.npmVersion, `candidates[${String(index)}].npmVersion`)
    if (npmVersion !== undefined) {
      requiredString(record.npmIntegrity, `candidates[${String(index)}].npmIntegrity`)
    }
    if (!FULL_GIT_SHA_PATTERN.test(commit)) {
      throw new Error(`curated profile dependency allowlist ${record.expectedPackage} commit must be pinned`)
    }
    dependencies.set(record.expectedPackage, {
      activationEvidenceComplete,
      requiredRuntimeBundles,
      sourceVerified,
      spec: npmVersion ?? gitDependencySpec(repository, commit, repositoryPath),
    })
  })
  return dependencies
}

function resolveAllowlistPath(): string {
  try {
    return join(dirname(moduleRequire.resolve('@deepseek-ai/dsh-curated-policy/package.json')), 'policy/plugin-allowlist.yaml')
  } catch {
    // Local source tests can run before pnpm has linked this new package dependency.
    /* v8 ignore next */
    return fileURLToPath(new URL('../../curated-policy/policy/plugin-allowlist.yaml', import.meta.url))
  }
}

function gitDependencySpec(repository: string, commit: string, repositoryPath: string | null): string {
  const url = repository.endsWith('.git') ? repository : `${repository}.git`
  return `git+${url}#${commit}${repositoryPath === null ? '' : `&path:${repositoryPath}`}`
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`curated profile dependency allowlist ${label} must be a non-empty string`)
  }
  return value
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`curated profile dependency allowlist ${label} must be a boolean`)
  }
  return value
}

function verifiedSource(value: unknown, label: string): boolean {
  if (value === 'verified') return true
  if (value === 'unreachable') return false
  throw new Error(`curated profile dependency allowlist ${label} must be verified or unreachable`)
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`curated profile dependency allowlist ${label} must be a list`)
  }
  return value
}

function requiredStringArray(value: unknown, label: string): string[] {
  return requiredArray(value, label).map((item, index) =>
    requiredString(item, `${label}[${String(index)}]`))
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null
  if (typeof value === 'string' && value.length > 0) return value
  throw new Error(`curated profile dependency allowlist ${label} must be null or a non-empty string`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

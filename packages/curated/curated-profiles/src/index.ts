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
  hasCompleteCurrentProfileActivationEvidence,
  loadCuratedCatalog,
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
  readonly writeRootConfig: (content: string) => void
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
  readonly retain: (file: ManagedProfileFile, expectedIdentity?: BigIntStats) => string
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
  const opened = new Map<ManagedProfileFile, OpenManagedProfileFile>()
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
      writeProfileFile(
        profileName,
        PROFILE_ROOT_FILENAME,
        join(dir, PROFILE_ROOT_FILENAME),
        content,
        snapshot,
        renameSync,
      )
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
  file: ManagedProfileFile,
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
  file: ManagedProfileFile,
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
  file: ManagedProfileFile,
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
  const assignedPackages = loadCuratedCatalog(resolveAllowlistPath()).candidates.flatMap(candidate =>
    candidate.active
    && candidate.targetProfiles.includes(profileName)
    && candidate.expectedPackage !== null
      ? [candidate.expectedPackage]
      : [])
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
  const patch = loadOverlayPatches(profileName, patchPath, existingFiles.readFile)
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
  const patch = loadOverlayPatches('web-enterprise', patchPath, existingFiles.readFile)
  if (containsDynamicExpression(patch)) {
    throw new Error('web-enterprise existing patch must not contain dynamic expressions')
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
    const workspace = loadYaml(existingFiles.readFile(workspacePath) as string)
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

function containsEnterpriseProhibition(value: unknown, prohibitedPackages: ReadonlySet<string>): boolean {
  if (Array.isArray(value)) return value.some(item => containsEnterpriseProhibition(item, prohibitedPackages))
  if (!isRecord(value)) return false
  if (typeof value.id === 'string' && !isSafeEnterpriseConfig(value.id, value.config)) {
    return true
  }
  for (const [key, item] of Object.entries(value)) {
    if (
      (key === 'externalBodyEgress' || key === 'bodyEgress' || key === 'egressBody'
        || key === 'anonymousVisionFallback' || key === 'browserDownload' || key === 'captureBody')
      && item !== false
    ) {
      return true
    }
    if (key === 'importMode' && item !== 'dry-run') {
      return true
    }
    if ((key === 'sessionsWrite' || key === 'writeSessions') && item !== false) {
      return true
    }
    if (
      key === 'name'
      && typeof item === 'string'
      && prohibitedPackages.has(item)
    ) {
      return true
    }
    if (containsEnterpriseProhibition(item, prohibitedPackages)) return true
  }
  return false
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
  return !containsEnterpriseProhibition(entries, enterpriseProhibitedPackages(template))
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
  const parsed = loadYaml(readFileSync(resolveAllowlistPath(), 'utf8'))
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
    if (!isRecord(candidate) || typeof candidate.expectedPackage !== 'string') return
    if (dependencies.has(candidate.expectedPackage)) {
      throw new Error(`curated profile dependency allowlist package ${candidate.expectedPackage} is duplicated`)
    }
    const active = requiredBoolean(candidate.active, `candidates[${String(index)}].active`)
    const rejections = requiredArray(candidate.rejections, `candidates[${String(index)}].rejections`)
    const targetProfiles = requiredStringArray(candidate.targetProfiles, `candidates[${String(index)}].targetProfiles`)
    const sourceVerified = verifiedSource(candidate.sourceStatus, `candidates[${String(index)}].sourceStatus`)
    const requiredRuntimeBundles = candidate.requiredRuntimeBundles === undefined
      ? []
      : requiredStringArray(
        candidate.requiredRuntimeBundles,
        `candidates[${String(index)}].requiredRuntimeBundles`,
      )
    const activationEvidenceComplete = hasCompleteCurrentProfileActivationEvidence({
      requiredRuntimeBundles,
      runtimeActivationEvidence: candidate.runtimeActivationEvidence,
      targetProfiles,
    }, profileName)
    if (!active || rejections.length > 0 || !targetProfiles.includes(profileName) || !sourceVerified) {
      dependencies.set(candidate.expectedPackage, {
        activationEvidenceComplete,
        requiredRuntimeBundles,
        sourceVerified,
      })
      return
    }
    const repository = requiredString(candidate.repository, `candidates[${String(index)}].repository`)
    const commit = requiredString(candidate.commit, `candidates[${String(index)}].commit`)
    const repositoryPath = nullableString(candidate.repositoryPath, `candidates[${String(index)}].repositoryPath`)
    const npmVersion = candidate.npmVersion === undefined
      ? undefined
      : requiredString(candidate.npmVersion, `candidates[${String(index)}].npmVersion`)
    if (npmVersion !== undefined) {
      requiredString(candidate.npmIntegrity, `candidates[${String(index)}].npmIntegrity`)
    }
    if (!FULL_GIT_SHA_PATTERN.test(commit)) {
      throw new Error(`curated profile dependency allowlist ${candidate.expectedPackage} commit must be pinned`)
    }
    dependencies.set(candidate.expectedPackage, {
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

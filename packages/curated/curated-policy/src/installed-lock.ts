/**
 * Pure admission of installed pnpm lock bytes against curated catalog pins.
 * @module @deepseek-ai/dsh-curated-policy/installed-lock
 */

import { createHash } from 'node:crypto'
import { load as loadYaml } from 'js-yaml'
import type { CuratedCandidate, CuratedCatalog } from './index.ts'

/** Inputs needed to admit root and installed pnpm locks for one profile. */
export interface CuratedInstalledLocksInput {
  /** Catalog whose active profile candidates supply immutable source pins. */
  readonly catalog: CuratedCatalog
  /** Profile used to select active catalog candidates. */
  readonly profileId: string
  /** Exact package manifest dependency names and specifiers. */
  readonly manifestDependencies: Readonly<Record<string, string>>
  /** Root `pnpm-lock.yaml` bytes. */
  readonly rootLock: Uint8Array
  /** Installed `node_modules/.pnpm/lock.yaml` bytes. */
  readonly installedLock: Uint8Array
}

/** Inputs needed to admit one candidate from pnpm locks that may contain unrelated dependencies. */
export interface CuratedInstalledCandidateLocksInput {
  /** Candidate whose exact source and runtime closure must be admitted. */
  readonly candidate: CuratedCandidate & { readonly expectedPackage: string }
  /** Exact manifest specifier for the candidate package. */
  readonly manifestSpecifier: string
  /** Root `pnpm-lock.yaml` bytes. */
  readonly rootLock: Uint8Array
  /** Installed `node_modules/.pnpm/lock.yaml` bytes. */
  readonly installedLock: Uint8Array
}

/** Immutable install source proven by both pnpm locks. */
export type CuratedInstalledSourceIdentity =
  | {
    /** Registry package source. */
    readonly kind: 'npm'
    /** Exact registry package version. */
    readonly version: string
    /** Exact registry package integrity. */
    readonly integrity: string
  }
  | {
    /** Git package source. */
    readonly kind: 'git'
    /** Canonical HTTPS GitHub repository. */
    readonly repository: string
    /** Full lowercase Git commit. */
    readonly commit: string
    /** Repository package path, or null for the repository root. */
    readonly repositoryPath: string | null
  }

/** Immutable installed identity for one selected curated candidate. */
export interface CuratedInstalledCandidateIdentity {
  /** Stable catalog candidate id. */
  readonly candidateId: string
  /** Installed package name. */
  readonly packageName: string
  /** Exact package version recorded by pnpm. */
  readonly packageVersion: string
  /** Registry or Git source identity. */
  readonly source: CuratedInstalledSourceIdentity
  /** SHA-256 of the complete sorted runtime dependency lock identities. */
  readonly runtimeDependencyClosureSha256: string
  /** Catalog-owned SHA-256 of the complete installed candidate tree. */
  readonly treeSha256: string
}

interface ParsedLock {
  readonly label: 'root' | 'installed'
  readonly value: Record<string, unknown>
  readonly dependencies: Record<string, unknown>
}

interface DirectResolution {
  readonly packageKey: string
  readonly packageVersion: string
  readonly snapshotKey: string
  readonly source: CuratedInstalledSourceIdentity
}

interface ExactGitDependency {
  readonly repository: string
  readonly commit: string
  readonly repositoryPath: string | null
}

type PnpmGitDependency = ExactGitDependency & (
  | {
    readonly kind: 'direct'
    readonly packageVersion: string
  }
  | {
    readonly kind: 'github-codeload'
    readonly packageVersion: string
    readonly tarball: string
  }
)

const lockfileVersion = '9.0'
const fullShaPattern = /^[0-9a-f]{40}$/u
const sha256Pattern = /^[0-9a-f]{64}$/u
const sriPattern = /^(sha(?:256|384|512))-([A-Za-z0-9+/]+={0,2})$/u
const npmRegistryResolutionFields = new Set(['integrity', 'tarball'])
const githubOwnerPattern = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u
const githubRepositoryPattern = /^[A-Za-z0-9._-]{1,100}$/u
const pnpmAliasTargetPattern = /^((?:@[^@/]+\/)?[^@/]+)@(.+)$/u
const semverNumericIdentifier = String.raw`(?:0|[1-9]\d*)`
const semverPrereleaseIdentifier =
  String.raw`(?:${semverNumericIdentifier}|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)`
const exactNpmVersionPattern = new RegExp(
  String.raw`^${semverNumericIdentifier}\.${semverNumericIdentifier}\.${semverNumericIdentifier}`
  + String.raw`(?:-${semverPrereleaseIdentifier}(?:\.${semverPrereleaseIdentifier})*)?`
  + String.raw`(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$`,
  'u',
)

/**
 * Admit two pnpm lock snapshots against one profile's active catalog candidates.
 * @param input - Catalog, profile, exact manifest dependencies, and borrowed lock bytes.
 * @returns frozen candidate identities in catalog order.
 * @throws when either lock or any selected source and runtime closure differs from the catalog.
 */
export function assertCuratedInstalledLocks(
  input: CuratedInstalledLocksInput,
): readonly CuratedInstalledCandidateIdentity[] {
  const root = parseLock(input.rootLock, 'root', input.manifestDependencies)
  const installed = parseLock(input.installedLock, 'installed', input.manifestDependencies)
  const selected = input.catalog.candidates.filter(candidate =>
    candidate.active
    && candidate.targetProfiles.includes(input.profileId))
  const selectedPackages = selected.map((candidate) => {
    if (candidate.expectedPackage === null) {
      throw new Error(
        `${candidate.id} active candidate assigned to profile ${input.profileId} must declare expectedPackage`,
      )
    }
    return candidate.expectedPackage
  })
  if (!sameStringSets(selectedPackages, Object.keys(input.manifestDependencies))) {
    throw new Error('selected candidate dependencies must exactly match manifest dependencies')
  }

  const identities = selected.map(candidate =>
    admitCandidate(candidate, input.manifestDependencies, root, installed))
  return Object.freeze(identities)
}

/**
 * Admit one candidate from root and installed pnpm locks without requiring
 * unrelated manifest dependencies to be catalog candidates.
 * @param input - Candidate, exact manifest specifier, and borrowed lock bytes.
 * @returns the frozen installed candidate identity.
 * @throws when either lock or the candidate source and runtime closure differs from the catalog.
 */
export function assertCuratedInstalledCandidateLocks(
  input: CuratedInstalledCandidateLocksInput,
): CuratedInstalledCandidateIdentity {
  const packageName = input.candidate.expectedPackage
  const manifestDependencies = { [packageName]: input.manifestSpecifier }
  const root = parseLock(input.rootLock, 'root', manifestDependencies, false)
  const installed = parseLock(input.installedLock, 'installed', manifestDependencies, false)
  return admitCandidate(input.candidate, manifestDependencies, root, installed)
}

function parseLock(
  bytes: Uint8Array,
  label: ParsedLock['label'],
  manifestDependencies: Readonly<Record<string, string>>,
  requireExactDependencies = true,
): ParsedLock {
  let parsed: unknown
  try {
    parsed = loadYaml(Buffer.from(bytes).toString('utf8'))
  } catch {
    throw new Error(`${label} pnpm lockfile must be valid YAML`)
  }
  const value = requiredRecord(parsed, `${label} pnpm lockfile`)
  if (value.lockfileVersion !== lockfileVersion) {
    throw new Error(`${label} pnpm lockfile version must be ${lockfileVersion}`)
  }
  const transformation = pnpmLockTransformation(value)
  if (transformation !== undefined) throw new Error(`${label} ${transformation}`)
  const importers = requiredRecord(value.importers, `${label} pnpm lockfile importers`)
  const importer = requiredRecord(importers['.'], `${label} pnpm root importer`)
  const dependencies = importer.dependencies === undefined
    ? {}
    : requiredRecord(importer.dependencies, `${label} pnpm root dependencies`)
  if (
    requireExactDependencies
    && !sameStringSets(Object.keys(dependencies), Object.keys(manifestDependencies))
  ) {
    throw new Error(`${label} pnpm importer dependency names must exactly match manifest dependencies`)
  }
  for (const [packageName, manifestSpecifier] of Object.entries(manifestDependencies)) {
    const dependency = requiredRecord(
      dependencies[packageName],
      `${label} pnpm dependency ${packageName}`,
    )
    if (dependency.specifier !== manifestSpecifier) {
      throw new Error(`${label} pnpm dependency ${packageName} specifier differs from the profile manifest`)
    }
  }
  return { label, value, dependencies }
}

function admitCandidate(
  candidate: CuratedCandidate,
  manifestDependencies: Readonly<Record<string, string>>,
  root: ParsedLock,
  installed: ParsedLock,
): CuratedInstalledCandidateIdentity {
  const packageName = candidate.expectedPackage as string
  const manifestSpecifier = manifestDependencies[packageName] as string
  const expectedClosureSha = requiredCandidateClosureSha(candidate)
  const rootResolution = resolveCandidate(candidate, packageName, manifestSpecifier, root)
  const installedResolution = resolveCandidate(candidate, packageName, manifestSpecifier, installed)
  if (!sameDirectResolution(rootResolution, installedResolution)) {
    throw new Error(`${candidate.id} root and installed pnpm resolutions differ`)
  }
  const rootClosure = runtimeDependencyClosure(root, rootResolution, candidate.id)
  const installedClosure = runtimeDependencyClosure(installed, installedResolution, candidate.id)
  if (!sameOrderedStrings(rootClosure, installedClosure)) {
    throw new Error(`${candidate.id} root and installed pnpm runtime dependency closures differ`)
  }
  const rootClosureSha = runtimeDependencyClosureSha256(rootClosure)
  const installedClosureSha = runtimeDependencyClosureSha256(installedClosure)
  if (rootClosureSha !== expectedClosureSha || installedClosureSha !== expectedClosureSha) {
    throw new Error(`${candidate.id} runtime dependency closure SHA-256 differs from the catalog`)
  }
  const source = Object.freeze({ ...rootResolution.source })
  return Object.freeze({
    candidateId: candidate.id,
    packageName,
    packageVersion: rootResolution.packageVersion,
    source,
    runtimeDependencyClosureSha256: rootClosureSha,
    treeSha256: requiredCandidateTreeSha(candidate),
  })
}

function resolveCandidate(
  candidate: CuratedCandidate,
  packageName: string,
  manifestSpecifier: string,
  lock: ParsedLock,
): DirectResolution {
  const hasNpmVersion = candidate.npmVersion !== undefined
  const hasNpmIntegrity = candidate.npmIntegrity !== undefined
  if (hasNpmVersion !== hasNpmIntegrity) {
    throw new Error(`${candidate.id} catalog install source is incomplete`)
  }
  return hasNpmVersion
    ? resolveNpmCandidate(candidate, packageName, manifestSpecifier, lock)
    : resolveGitCandidate(candidate, packageName, manifestSpecifier, lock)
}

function resolveNpmCandidate(
  candidate: CuratedCandidate,
  packageName: string,
  manifestSpecifier: string,
  lock: ParsedLock,
): DirectResolution {
  const version = candidate.npmVersion as string
  const integrity = candidate.npmIntegrity as string
  if (!exactNpmVersionPattern.test(version) || !isExactSha512Integrity(integrity)) {
    throw new Error(`${candidate.id} catalog npm source must use an exact version and SHA-512 integrity`)
  }
  if (manifestSpecifier !== version) {
    throw new Error(`${candidate.id} profile dependency must use exact npm version ${version}`)
  }
  const dependency = requiredRecord(
    lock.dependencies[packageName],
    `${lock.label} pnpm dependency ${packageName}`,
  )
  const resolvedVersion = requiredString(
    dependency.version,
    `${lock.label} ${candidate.id} pnpm dependency version`,
  )
  const packageVersion = stripPnpmPeerSuffix(
    resolvedVersion,
  )
  if (packageVersion !== version) {
    throw new Error(`${lock.label} ${candidate.id} pnpm dependency version differs from the catalog`)
  }
  const packages = requiredRecord(lock.value.packages, `${lock.label} pnpm lockfile packages`)
  const packageKey = `${packageName}@${packageVersion}`
  const packageRecord = requiredRecord(
    packages[packageKey],
    `${lock.label} ${candidate.id} pnpm package resolution`,
  )
  const resolution = requiredRecord(
    packageRecord.resolution,
    `${lock.label} ${candidate.id} pnpm package resolution`,
  )
  assertPnpmRegistryResolution(
    resolution,
    `${lock.label} ${candidate.id} pnpm package resolution`,
  )
  if (resolution.integrity !== integrity) {
    throw new Error(`${lock.label} ${candidate.id} pnpm package integrity differs from the catalog`)
  }
  return {
    packageKey,
    packageVersion,
    snapshotKey: `${packageName}@${resolvedVersion}`,
    source: { kind: 'npm', version, integrity },
  }
}

function resolveGitCandidate(
  candidate: CuratedCandidate,
  packageName: string,
  manifestSpecifier: string,
  lock: ParsedLock,
): DirectResolution {
  const declared = parseExactGitDependency(
    manifestSpecifier,
    `${candidate.id} profile dependency`,
  )
  const catalogRepository = normalizeGitRepository(candidate.repository)
  if (
    !fullShaPattern.test(candidate.commit)
    || catalogRepository !== declared.repository
    || candidate.commit !== declared.commit
    || candidate.repositoryPath !== declared.repositoryPath
  ) {
    throw new Error(
      `${candidate.id} profile dependency differs from the catalog repository, commit, or package path`,
    )
  }
  const dependency = requiredRecord(
    lock.dependencies[packageName],
    `${lock.label} pnpm dependency ${packageName}`,
  )
  const version = requiredString(
    dependency.version,
    `${lock.label} ${candidate.id} pnpm dependency version`,
  )
  const importerResolution = parsePnpmGitDependency(
    version,
    `${lock.label} ${candidate.id} pnpm dependency version`,
  )
  if (!sameGitIdentity(importerResolution, declared)) {
    throw new Error(`${lock.label} ${candidate.id} pnpm dependency version differs from the profile manifest`)
  }
  const packages = requiredRecord(lock.value.packages, `${lock.label} pnpm lockfile packages`)
  const packageKey = `${packageName}@${importerResolution.packageVersion}`
  const packageRecord = requiredRecord(
    packages[packageKey],
    `${lock.label} ${candidate.id} pnpm package resolution`,
  )
  const resolution = requiredRecord(
    packageRecord.resolution,
    `${lock.label} ${candidate.id} pnpm package resolution`,
  )
  let repository: string
  let commit: string
  if (importerResolution.kind === 'direct') {
    if (resolution.type !== 'git') {
      throw new Error(`${lock.label} ${candidate.id} pnpm package resolution must be Git`)
    }
    repository = normalizeGitRepository(requiredString(
      resolution.repo,
      `${lock.label} ${candidate.id} pnpm repository`,
    ))
    commit = requiredString(
      resolution.commit,
      `${lock.label} ${candidate.id} pnpm commit`,
    )
  } else {
    if (resolution.gitHosted !== true || resolution.tarball !== importerResolution.tarball) {
      throw new Error(`${lock.label} ${candidate.id} pnpm package resolution must match the GitHub codeload URL`)
    }
    repository = importerResolution.repository
    commit = importerResolution.commit
  }
  const repositoryPath = resolution.path === undefined
    ? null
    : requiredString(resolution.path, `${lock.label} ${candidate.id} pnpm package resolution path`)
  if (
    repository !== declared.repository
    || commit !== declared.commit
    || repositoryPath !== declared.repositoryPath
  ) {
    throw new Error(
      `${lock.label} ${candidate.id} pnpm package resolution differs from its resolution repository, commit, or path`,
    )
  }
  const packageVersion = requiredString(
    packageRecord.version,
    `${lock.label} ${candidate.id} pnpm package version`,
  )
  return {
    packageKey,
    packageVersion,
    snapshotKey: `${packageName}@${version}`,
    source: {
      kind: 'git',
      repository,
      commit,
      repositoryPath,
    },
  }
}

function runtimeDependencyClosure(
  lock: ParsedLock,
  direct: DirectResolution,
  candidateId: string,
): string[] {
  const packages = requiredRecord(lock.value.packages, `${lock.label} pnpm lockfile packages`)
  const snapshots = optionalRecord(lock.value.snapshots) ?? {}
  const rootRecord = requiredRecord(
    packages[direct.packageKey],
    `${lock.label} ${candidateId} pnpm package resolution`,
  )
  const pending = runtimeDependencies(
    exactPeerSnapshotOrPackageRecord(
      snapshots,
      direct.snapshotKey,
      rootRecord,
      `${lock.label} ${candidateId}`,
    ),
    `${lock.label} ${candidateId} ${direct.snapshotKey}`,
  )
  const expandedSnapshots = new Set<string>()
  const identities = new Set<string>(
    direct.snapshotKey.includes('(') ? [`${direct.snapshotKey}\0direct`] : [],
  )
  while (pending.length > 0) {
    const dependency = pending.pop() as { readonly name: string; readonly locator: string }
    const target = runtimeDependencyTarget(dependency.name, dependency.locator)
    const keys = pnpmPackageKeys(target.name, target.locator)
    const packageKey = keys.find(key => Object.hasOwn(packages, key))
    if (packageKey === undefined) {
      const subject = target.alias
        ? `${dependency.name} alias target ${target.name}@${stripPnpmPeerSuffix(target.locator)}`
        : `${dependency.name}@${stripPnpmPeerSuffix(target.locator)}`
      throw new Error(`${lock.label} ${candidateId} ${subject} runtime dependency is unresolved`)
    }
    const snapshotKey = target.locator.includes('(')
      ? requiredPeerSnapshotKey(snapshots, keys[0] as string, `${lock.label} ${candidateId}`)
      : keys.find(key => Object.hasOwn(snapshots, key)) ?? packageKey
    const resolutionKey = keys[0] as string
    const packageRecord = requiredRecord(
      packages[packageKey],
      `${lock.label} ${candidateId} ${dependency.name} runtime dependency`,
    )
    const targetIdentity = runtimeDependencyIdentity(
      target.locator,
      resolutionKey,
      packageRecord,
      `${lock.label} ${candidateId} ${dependency.name}`,
    )
    identities.add(target.alias
      ? `${dependency.name}\0alias\0${targetIdentity}`
      : targetIdentity)
    if (expandedSnapshots.has(snapshotKey)) continue
    expandedSnapshots.add(snapshotKey)
    pending.push(...runtimeDependencies(
      exactPeerSnapshotOrPackageRecord(
        snapshots,
        snapshotKey,
        packageRecord,
        `${lock.label} ${candidateId}`,
      ),
      `${lock.label} ${candidateId} ${snapshotKey}`,
    ))
  }
  return [...identities].sort()
}

function requiredPeerSnapshotKey(
  snapshots: Record<string, unknown>,
  snapshotKey: string,
  label: string,
): string {
  if (!Object.hasOwn(snapshots, snapshotKey)) {
    throw new Error(`${label} ${snapshotKey} snapshot is missing`)
  }
  requiredRecord(snapshots[snapshotKey], `${label} ${snapshotKey} snapshot`)
  return snapshotKey
}

function exactPeerSnapshotOrPackageRecord(
  snapshots: Record<string, unknown>,
  snapshotKey: string,
  packageRecord: Record<string, unknown>,
  label: string,
): Record<string, unknown> {
  if (!snapshotKey.includes('(')) return optionalRecord(snapshots[snapshotKey]) ?? packageRecord
  if (!Object.hasOwn(snapshots, snapshotKey)) {
    throw new Error(`${label} ${snapshotKey} snapshot is missing`)
  }
  return requiredRecord(snapshots[snapshotKey], `${label} ${snapshotKey} snapshot`)
}

function runtimeDependencies(
  packageRecord: Record<string, unknown>,
  label: string,
): Array<{ readonly name: string; readonly locator: string }> {
  const dependencies: Array<{ readonly name: string; readonly locator: string }> = []
  for (const field of ['dependencies', 'optionalDependencies'] as const) {
    const values = optionalRecord(packageRecord[field])
    if (values === undefined) continue
    for (const [name, value] of Object.entries(values)) {
      dependencies.push({
        name,
        locator: requiredString(value, `${label} ${field}.${name}`),
      })
    }
  }
  return dependencies
}

function runtimeDependencyTarget(
  declarationName: string,
  locator: string,
): { readonly name: string; readonly locator: string; readonly alias: boolean } {
  const exactLocator = stripPnpmPeerSuffix(locator)
  const peerSuffix = locator.slice(exactLocator.length)
  const explicitAlias = exactLocator.startsWith('npm:')
  const targetLocator = explicitAlias ? exactLocator.slice('npm:'.length) : exactLocator
  const target = pnpmAliasTargetPattern.exec(targetLocator)
  if (target === null || (!explicitAlias && target[1] === declarationName)) {
    return { name: declarationName, locator, alias: false }
  }
  return {
    name: target[1] as string,
    locator: `${target[2] as string}${peerSuffix}`,
    alias: true,
  }
}

function pnpmPackageKeys(name: string, locator: string): string[] {
  const exact = `${name}@${locator}`
  const withoutPeers = `${name}@${stripPnpmPeerSuffix(locator)}`
  return exact === withoutPeers ? [exact] : [exact, withoutPeers]
}

function runtimeDependencyIdentity(
  locator: string,
  snapshotKey: string,
  packageRecord: Record<string, unknown>,
  label: string,
): string {
  const resolution = requiredRecord(packageRecord.resolution, `${label} runtime dependency resolution`)
  const exactLocator = stripPnpmPeerSuffix(locator)
  if (resolution.type === 'git') {
    if (!/^git\+.+#[0-9a-f]{40}(?:&path:[^&]+)?$/u.test(exactLocator)) {
      throw new Error(`${label} runtime Git dependency must use an immutable commit`)
    }
    const commit = requiredString(resolution.commit, `${label} runtime Git resolution commit`)
    if (!fullShaPattern.test(commit)) {
      throw new Error(`${label} runtime Git resolution must declare an immutable commit`)
    }
    const repository = normalizeGitRepository(
      requiredString(resolution.repo, `${label} runtime Git resolution repository`),
    )
    const declared = parseExactGitDependency(exactLocator, `${label} runtime Git dependency`)
    const repositoryPath = resolution.path === undefined
      ? null
      : requiredString(resolution.path, `${label} runtime Git resolution path`)
    if (
      declared.repository !== repository
      || declared.commit !== commit
      || declared.repositoryPath !== repositoryPath
    ) {
      throw new Error(`${label} runtime Git dependency differs from its resolution repository, commit, or path`)
    }
    return `${snapshotKey}\0git\0${repository}\0${commit}\0${repositoryPath ?? ''}`
  }
  if (resolution.gitHosted === true) {
    const tarball = requiredString(resolution.tarball, `${label} runtime Git tarball`)
    let declared: PnpmGitDependency
    try {
      declared = parsePnpmGitDependency(exactLocator, `${label} runtime Git dependency`)
    } catch {
      throw new Error(`${label} runtime Git tarball must declare an immutable commit identity`)
    }
    if (declared.kind !== 'github-codeload' || declared.tarball !== tarball) {
      throw new Error(`${label} runtime Git tarball must declare an immutable commit identity`)
    }
    const repositoryPath = resolution.path === undefined
      ? null
      : requiredString(resolution.path, `${label} runtime Git resolution path`)
    if (repositoryPath !== declared.repositoryPath) {
      throw new Error(`${label} runtime Git dependency differs from its resolution path`)
    }
    return `${snapshotKey}\0git-tarball\0${tarball}\0${repositoryPath ?? ''}`
  }
  if (!exactNpmVersionPattern.test(exactLocator)) {
    throw new Error(`${label} runtime dependency must use an exact registry version`)
  }
  assertPnpmRegistryResolution(resolution, `${label} runtime dependency resolution`)
  const integrity = resolution.integrity
  if (typeof integrity !== 'string' || !isExactIntegrity(integrity)) {
    throw new Error(`${label} runtime dependency registry resolution must declare exact integrity`)
  }
  return `${snapshotKey}\0registry\0${integrity}`
}

function parseExactGitDependency(value: string, label: string): ExactGitDependency {
  const match = /^git\+(.+)#([0-9a-f]{40})(?:&path:([^&]+))?$/u.exec(value)
  if (match === null) throw new Error(`${label} must use a full Git commit SHA`)
  return {
    repository: normalizeGitRepository(requiredString(match[1], `${label} repository`)),
    commit: requiredString(match[2], `${label} commit`),
    repositoryPath: match[3] ?? null,
  }
}

function parsePnpmGitDependency(value: string, label: string): PnpmGitDependency {
  const exactValue = stripPnpmPeerSuffix(value)
  const direct = /^git\+(.+)#([0-9a-f]{40})(?:&path:([^&]+))?$/u.exec(exactValue)
  if (direct !== null) {
    return {
      kind: 'direct',
      packageVersion: exactValue,
      repository: normalizeGitRepository(requiredString(direct[1], `${label} repository`)),
      commit: requiredString(direct[2], `${label} commit`),
      repositoryPath: direct[3] ?? null,
    }
  }
  const codeload =
    /^(https:\/\/codeload\.github\.com\/([^/]+)\/([^/]+)\/tar\.gz\/([0-9a-f]{40}))(?:#path:([^()]+))?(?:\(.*\))?$/u
      .exec(value)
  if (codeload === null) {
    throw new Error(`${label} must use direct Git or GitHub codeload with a full commit SHA`)
  }
  const tarball = requiredString(codeload[1], `${label} tarball`)
  const repositoryPath = codeload[5] ?? null
  return {
    kind: 'github-codeload',
    packageVersion: `${tarball}${repositoryPath === null ? '' : `#path:${repositoryPath}`}`,
    repository: normalizeGitRepository(
      `https://github.com/${requiredString(codeload[2], `${label} owner`)}/${requiredString(codeload[3], `${label} repository`)}`,
    ),
    commit: requiredString(codeload[4], `${label} commit`),
    repositoryPath,
    tarball,
  }
}

function normalizeGitRepository(value: string): string {
  const source = value.replace(/^git\+/u, '')
  let url: URL
  try {
    url = new URL(source)
  } catch {
    throw new Error('Git repository must be a canonical HTTPS GitHub URL')
  }
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'github.com'
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
    || url.pathname.includes('%')
    || url.pathname.endsWith('/')
  ) {
    throw new Error('Git repository must be a canonical HTTPS GitHub URL')
  }
  if (/\.git$/iu.test(url.pathname) && !url.pathname.endsWith('.git')) {
    throw new Error('Git repository must be a canonical HTTPS GitHub URL')
  }
  const canonicalInput = source.endsWith('.git') ? source.slice(0, -4) : source
  const segments = url.pathname.replace(/\.git$/u, '').split('/').slice(1)
  if (
    segments.length !== 2
    || !githubOwnerPattern.test(segments[0] as string)
    || !githubRepositoryPattern.test(segments[1] as string)
    || segments[1] === '.'
    || segments[1] === '..'
  ) {
    throw new Error('Git repository must be a canonical HTTPS GitHub URL')
  }
  const canonical = `https://github.com/${segments.join('/')}`
  if (canonicalInput !== canonical) {
    throw new Error('Git repository must be a canonical HTTPS GitHub URL')
  }
  return canonical
}

function stripPnpmPeerSuffix(value: string): string {
  const start = value.indexOf('(')
  return start === -1 ? value : value.slice(0, start)
}

/**
 * Require the pnpm fields that identify an npm registry artifact.
 * @param resolution - Parsed pnpm package resolution.
 * @param label - Diagnostic subject that owns the resolution.
 * @throws when the resolution carries local, Git, or non-registry provenance.
 */
export function assertPnpmRegistryResolution(
  resolution: Readonly<Record<string, unknown>>,
  label: string,
): void {
  const keys = Reflect.ownKeys(resolution)
  if (
    keys.some(key =>
      typeof key !== 'string'
      || !npmRegistryResolutionFields.has(key))
    || (
      Object.hasOwn(resolution, 'tarball')
      && !isNpmRegistryTarball(resolution.tarball)
    )
  ) {
    throw new Error(`${label} must be registry`)
  }
}

function isNpmRegistryTarball(value: unknown): boolean {
  if (typeof value !== 'string') return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  return url.protocol === 'https:'
    && url.hostname === 'registry.npmjs.org'
    && url.port === ''
    && url.username === ''
    && url.password === ''
    && url.search === ''
    && url.hash === ''
    && url.pathname.includes('/-/')
    && url.pathname.endsWith('.tgz')
}

/**
 * Return the first unsupported pnpm package transformation in a parsed lockfile.
 * @param value - Parsed pnpm lockfile mapping.
 * @returns a stable diagnostic, or `undefined` when no transformation is present.
 */
export function pnpmLockTransformation(value: Record<string, unknown>): string | undefined {
  if (Object.hasOwn(value, 'overrides')) return 'pnpm lockfile must not contain overrides'
  if (Object.hasOwn(value, 'patchedDependencies')) {
    return 'pnpm lockfile must not contain patchedDependencies'
  }
  if (Object.hasOwn(value, 'packageExtensions')) {
    return 'pnpm lockfile must not contain packageExtensions'
  }
  const settings = optionalRecord(value.settings)
  if (settings !== undefined && Object.hasOwn(settings, 'overrides')) {
    return 'pnpm lockfile must not contain overrides'
  }
  if (settings !== undefined && Object.hasOwn(settings, 'packageExtensionsChecksum')) {
    return 'pnpm lockfile must not contain packageExtensionsChecksum'
  }
  if (settings !== undefined && Object.hasOwn(settings, 'pnpmfileChecksum')) {
    return 'pnpm lockfile must not contain pnpmfileChecksum'
  }
  if (containsPnpmPatchHash(value)) {
    return 'pnpm lockfile must not contain patched dependency locators'
  }
  return undefined
}

function containsPnpmPatchHash(value: unknown, seen = new WeakSet<object>()): boolean {
  if (typeof value === 'string') return value.includes('(patch_hash=')
  if (typeof value !== 'object' || value === null) return false
  if (seen.has(value)) return false
  seen.add(value)
  if (Array.isArray(value)) return value.some(item => containsPnpmPatchHash(item, seen))
  return Object.entries(value as Record<string, unknown>).some(([key, item]) =>
    key.includes('(patch_hash=') || containsPnpmPatchHash(item, seen))
}

function requiredCandidateClosureSha(candidate: CuratedCandidate): string {
  const value = candidate.runtimeDependencyClosureSha256
  if (
    value === undefined
    || !sha256Pattern.test(value)
    || /^(.)\1+$/u.test(value)
    || /^([0-9a-f]{2})\1+$/u.test(value)
  ) {
    throw new Error(`${candidate.id} catalog runtime dependency closure SHA-256 must be pinned`)
  }
  return value
}

function requiredCandidateTreeSha(candidate: CuratedCandidate): string {
  const value = candidate.treeSha256
  if (
    value === undefined
    || !sha256Pattern.test(value)
    || /^(.)\1+$/u.test(value)
    || /^([0-9a-f]{2})\1+$/u.test(value)
  ) {
    throw new Error(`${candidate.id} catalog installed tree SHA-256 must be pinned`)
  }
  return value
}

function runtimeDependencyClosureSha256(identities: readonly string[]): string {
  const digest = createHash('sha256')
  for (const identity of [...identities].sort()) {
    const bytes = Buffer.from(identity)
    digest.update(`${String(bytes.byteLength)}:`)
    digest.update(bytes)
  }
  return digest.digest('hex')
}

function sameDirectResolution(left: DirectResolution, right: DirectResolution): boolean {
  return left.packageKey === right.packageKey
    && left.packageVersion === right.packageVersion
    && left.snapshotKey === right.snapshotKey
    && JSON.stringify(left.source) === JSON.stringify(right.source)
}

function sameGitIdentity(left: ExactGitDependency, right: ExactGitDependency): boolean {
  return left.repository === right.repository
    && left.commit === right.commit
    && left.repositoryPath === right.repositoryPath
}

function sameStringSets(left: readonly string[], right: readonly string[]): boolean {
  return sameOrderedStrings([...left].sort(), [...right].sort())
}

function sameOrderedStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`)
  return value
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isExactSha512Integrity(value: string): boolean {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/u.exec(value)
  if (match === null) return false
  const encoded = match[1] as string
  const digest = Buffer.from(encoded, 'base64')
  return digest.byteLength === 64
    && digest.toString('base64') === encoded
    && !digest.every(byte => byte === digest[0])
}

function isExactIntegrity(value: string): boolean {
  const match = sriPattern.exec(value)
  if (match === null) return false
  const algorithm = match[1] as 'sha256' | 'sha384' | 'sha512'
  const encoded = match[2] as string
  const digest = Buffer.from(encoded, 'base64')
  const expectedBytes = { sha256: 32, sha384: 48, sha512: 64 }[algorithm]
  return digest.byteLength === expectedBytes
    && digest.toString('base64') === encoded
    && !digest.every(byte => byte === digest[0])
}

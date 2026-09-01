/** Canonical JSON serialization and safe reads for curated benchmark snapshots. @module @deepseek-ai/dsh-curated-bench/snapshot */

import { createHash } from 'node:crypto'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  realpathSync,
  type BigIntStats,
} from 'node:fs'
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path'
import { isExactNpmIntegrity, isExactNpmVersion } from '@deepseek-ai/dsh-curated-policy'

const MAX_BENCHMARK_SNAPSHOT_BYTES = 1024 * 1024
const WINDOWS_ABSOLUTE_PATH = /^(?:[A-Za-z]:|\\\\)/u
const SHA256_PATTERN = /^[0-9a-f]{64}$/u
const FULL_GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u
const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/u
const CANDIDATE_FIELDS = [
  'bundlePatch',
  'expectedPackage',
  'id',
  'installSource',
  'runtimeDependencyClosureSha256',
  'sourceContentSha256',
  'treeSha256',
] as const
const NPM_SOURCE_FIELDS = ['kind', 'npmVersion', 'npmIntegrity'] as const
const GIT_SOURCE_FIELDS = ['kind', 'repository', 'commit', 'repositoryPath', 'installScripts'] as const

/**
 * Serialize a plain JSON value with object keys sorted recursively.
 * @param value - JSON-compatible value to serialize.
 * @returns deterministic JSON text used for curated rollback snapshot hashes.
 * @throws when the value contains a non-finite number, non-plain object,
 * symbol, non-enumerable or accessor property, sparse or subclassed array,
 * extra array property, or unsupported value.
 */
export function canonicalBenchmarkJson(value: unknown): string {
  return JSON.stringify(normalizedBenchmarkJson(value))
}

/**
 * Require the current rollback snapshot schema.
 * @param snapshot - Parsed lock or profile snapshot.
 * @param label - Snapshot label used in diagnostics.
 */
export function assertBenchmarkSnapshotSchemaVersion(
  snapshot: Readonly<Record<string, unknown>>,
  label: string,
): void {
  if (snapshot.schemaVersion !== 2) throw new Error(`${label}.schemaVersion must be 2`)
}

/**
 * Validate every candidate in a self-contained rollback lock snapshot.
 * @param snapshot - Parsed lock snapshot containing a `candidates` array.
 * @param label - Snapshot label used in diagnostics.
 */
export function assertBenchmarkLockSnapshotCandidates(
  snapshot: Readonly<Record<string, unknown>>,
  label: string,
): void {
  if (!Array.isArray(snapshot.candidates)) throw new Error(`${label}.candidates must be an array`)
  snapshot.candidates.forEach((candidate, index) => {
    assertBenchmarkRollbackCandidate(candidate, `${label}.candidates[${String(index)}]`)
  })
}

/**
 * Validate the ordered bundles needed to restore a profile snapshot.
 * @param snapshot - Parsed profile snapshot containing a `bundles` array.
 * @param label - Snapshot label used in diagnostics.
 * @returns the validated ordered bundle names.
 */
export function assertBenchmarkProfileSnapshotBundles(
  snapshot: Readonly<Record<string, unknown>>,
  label: string,
): readonly string[] {
  const bundles = snapshot.bundles
  if (!Array.isArray(bundles)) throw new Error(`${label}.bundles must be an array`)
  if (bundles.length === 0) throw new Error(`${label}.bundles must contain at least one bundle`)
  bundles.forEach((bundle, index) => {
    if (typeof bundle !== 'string' || bundle.length === 0) {
      throw new Error(`${label}.bundles[${String(index)}] must be a non-empty string`)
    }
  })
  return bundles as string[]
}

/**
 * Validate one exactly reconstructable rollback candidate.
 * @param value - Parsed candidate value.
 * @param label - Candidate label used in diagnostics.
 */
export function assertBenchmarkRollbackCandidate(value: unknown, label: string): void {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object`)
  requiredString(value.id, `${label}.id`)
  requiredString(value.expectedPackage, `${label}.expectedPackage`)
  const bundlePatch = requiredString(value.bundlePatch, `${label}.bundlePatch`)
  if (!bundlePatch.startsWith('./') || !isSafeRepositoryPath(bundlePatch.slice(2))) {
    throw new Error(`${label}.bundlePatch must be a safe package-relative POSIX path starting with ./`)
  }
  for (const field of ['sourceContentSha256', 'treeSha256', 'runtimeDependencyClosureSha256'] as const) {
    const digest = requiredString(value[field], `${label}.${field}`)
    if (!SHA256_PATTERN.test(digest) || isPlaceholderDigest(digest)) {
      throw new Error(`${label}.${field} must be a non-placeholder lowercase SHA-256 digest`)
    }
  }
  if (!isRecord(value.installSource)) throw new Error(`${label}.installSource must be an object`)
  const source = value.installSource
  if (source.kind === 'npm') {
    assertExactFields(source, NPM_SOURCE_FIELDS, `${label}.installSource`)
    const npmVersion = requiredString(source.npmVersion, `${label}.installSource.npmVersion`)
    if (!isExactNpmVersion(npmVersion)) {
      throw new Error(`${label}.installSource.npmVersion must be an exact npm version`)
    }
    const npmIntegrity = requiredString(source.npmIntegrity, `${label}.installSource.npmIntegrity`)
    if (!isExactNpmIntegrity(npmIntegrity)) {
      throw new Error(`${label}.installSource.npmIntegrity must be a non-placeholder SHA-512 SRI`)
    }
  } else if (source.kind === 'git') {
    assertExactFields(source, GIT_SOURCE_FIELDS, `${label}.installSource`)
    const repository = requiredString(source.repository, `${label}.installSource.repository`)
    if (!isCanonicalGitHubRepository(repository)) {
      throw new Error(`${label}.installSource.repository must be a canonical HTTPS GitHub repository URL`)
    }
    const commit = requiredString(source.commit, `${label}.installSource.commit`)
    if (!FULL_GIT_SHA_PATTERN.test(commit) || isPlaceholderDigest(commit)) {
      throw new Error(`${label}.installSource.commit must be a full non-placeholder lowercase Git SHA`)
    }
    if (!isSafeRepositoryPath(source.repositoryPath)) {
      throw new Error(`${label}.installSource.repositoryPath must be null or a safe relative POSIX path`)
    }
    if (!isRecord(source.installScripts) || Object.keys(source.installScripts).length !== 0) {
      throw new Error(`${label}.installSource.installScripts must record no lifecycle scripts`)
    }
  } else {
    throw new Error(`${label}.installSource.kind must be npm or git`)
  }
  assertExactFields(value, CANDIDATE_FIELDS, label)
}

/** Content-addressed reference to one benchmark lock or profile snapshot. */
export interface BenchmarkSnapshotReference {
  /** Safe relative POSIX path resolved from the benchmark fixture directory. */
  readonly path: string
  /** SHA-256 of the referenced snapshot's canonical JSON. */
  readonly sha256: string
}

/** One parsed benchmark snapshot and the SHA-256 of its canonical JSON. */
export interface BenchmarkSnapshotReferenceRead {
  /** Canonical SHA-256 calculated from the descriptor-bound parsed snapshot. */
  readonly sha256: string
  /** Parsed plain JSON object read from the contained regular file. */
  readonly snapshot: Readonly<Record<string, unknown>>
}

/** One validated content-addressed reference and its parsed snapshot. */
export interface BoundBenchmarkSnapshotReferenceRead extends BenchmarkSnapshotReferenceRead {
  /** Validated immutable reference retained by benchmark output. */
  readonly reference: BenchmarkSnapshotReference
}

/**
 * Read one JSON file through a stable regular-file descriptor below a canonical root.
 * @param rootPath - Directory that must contain the unresolved and canonical file.
 * @param reference - Safe relative POSIX JSON path below `rootPath`.
 * @param label - Field label used in diagnostics.
 * @param containerLabel - Root description used in containment diagnostics.
 * @returns the parsed JSON value.
 * @throws when the path is unsafe, the target is not a contained stable regular
 * file, the read exceeds its limit, or the content is malformed JSON.
 */
export function readContainedBenchmarkJson(
  rootPath: string,
  reference: string,
  label: string,
  containerLabel = 'benchmark fixture directory',
): unknown {
  assertSafeBenchmarkReference(reference, label)
  const root = realpathSync.native(rootPath)
  const unresolved = resolve(root, ...reference.split('/'))
  const initial = lstatSync(unresolved, { bigint: true })
  if (initial.isSymbolicLink() || !initial.isFile()) {
    throw new Error(`${label} must reference a regular file`)
  }
  const canonical = realpathSync.native(unresolved)
  const fromRoot = relative(root, canonical)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new Error(`${label} must stay inside the ${containerLabel}`)
  }
  const canonicalEntry = lstatSync(canonical, { bigint: true })
  if (!canonicalEntry.isFile() || canonicalEntry.isSymbolicLink()) {
    throw new Error(`${label} must reference a regular file`)
  }
  if (!sameFileIdentity(initial, canonicalEntry)) {
    throw new Error(`${label} changed while it was being read`)
  }
  const bytes = readBoundedRegularFile(canonical, initial, label)
  try {
    const source = new TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
    return JSON.parse(source) as unknown
  } catch (error) {
    throw new Error(`${label} must contain valid JSON`, { cause: error })
  }
}

/**
 * Read and verify one content-addressed benchmark snapshot reference.
 * @param fixturePath - Benchmark fixture whose directory owns the reference.
 * @param value - Reference object containing exactly `path` and `sha256`.
 * @param label - Field label used in diagnostics.
 * @returns validated reference, parsed snapshot, and calculated canonical digest.
 * @throws when the reference fields, contained file, JSON value, or digest is invalid.
 */
export function readBoundBenchmarkSnapshotReference(
  fixturePath: string,
  value: unknown,
  label: string,
): BoundBenchmarkSnapshotReferenceRead {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object`)
  assertExactFields(value, ['path', 'sha256'], label)
  const path = requiredString(value.path, `${label}.path`)
  const sha256 = requiredString(value.sha256, `${label}.sha256`)
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error(`${label}.sha256 must be a lowercase SHA-256 digest`)
  }
  const read = readBenchmarkSnapshotReferenceWithDigest(fixturePath, path, `${label}.path`)
  if (read.sha256 !== sha256) {
    throw new Error(`${label}.sha256 does not match the referenced snapshot`)
  }
  return {
    ...read,
    reference: { path, sha256 },
  }
}

/**
 * Read one bounded regular JSON snapshot and calculate its canonical digest from the same bytes.
 * @param fixturePath - Benchmark fixture whose directory owns the reference.
 * @param reference - Relative POSIX JSON path recorded in the fixture.
 * @param label - Field label used in diagnostics.
 * @returns parsed snapshot and canonical SHA-256 from one descriptor-safe read.
 * @throws when the path, contained file, JSON object, or canonical value is invalid.
 */
export function readBenchmarkSnapshotReferenceWithDigest(
  fixturePath: string,
  reference: string,
  label: string,
): BenchmarkSnapshotReferenceRead {
  const parsed = readContainedBenchmarkJson(dirname(fixturePath), reference, label)
  if (!isRecord(parsed)) throw new Error(`${label} must reference a JSON object`)
  const canonicalJson = canonicalBenchmarkJson(parsed)
  return {
    sha256: createHash('sha256').update(canonicalJson).digest('hex'),
    snapshot: parsed,
  }
}

function assertSafeBenchmarkReference(reference: string, label: string): void {
  if (
    reference.length === 0
    || isAbsolute(reference)
    || WINDOWS_ABSOLUTE_PATH.test(reference)
    || reference.includes('\\')
    || reference.includes('\0')
    || !reference.endsWith('.json')
    || posix.normalize(reference) !== reference
    || reference.startsWith('../')
  ) {
    throw new Error(`${label} must be a safe relative JSON path`)
  }
}

/**
 * Read one bounded regular JSON snapshot relative to its benchmark fixture.
 * @param fixturePath - Benchmark fixture whose directory owns the reference.
 * @param reference - Relative POSIX JSON path recorded in the fixture.
 * @param label - Field label used in diagnostics.
 * @returns parsed plain JSON object at the contained canonical path.
 */
export function readBenchmarkSnapshotReference(
  fixturePath: string,
  reference: string,
  label: string,
): Readonly<Record<string, unknown>> {
  return readBenchmarkSnapshotReferenceWithDigest(fixturePath, reference, label).snapshot
}

/* jscpd:ignore-start -- Package-local snapshot errors cannot share the other readers' contracts. */
function readBoundedRegularFile(path: string, expected: BigIntStats, label: string): Buffer {
  let flags = constants.O_RDONLY | constants.O_NONBLOCK
  /* v8 ignore else -- Windows does not expose O_NOFOLLOW. */
  if (typeof constants.O_NOFOLLOW === 'number') flags |= constants.O_NOFOLLOW
  let descriptor: number
  try {
    descriptor = openSync(path, flags)
  } catch (error) {
    if (isNodeError(error) && ['ELOOP', 'ENOENT', 'ENOTDIR'].includes(error.code)) {
      throw new Error(`${label} changed while it was being read`)
    }
    throw error
  }
  try {
    const before = fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) throw new Error(`${label} must reference a regular file`)
    assertStableSnapshotIdentity(path, expected, before, label)
    if (before.size > BigInt(MAX_BENCHMARK_SNAPSHOT_BYTES)) {
      throw new Error(`${label} exceeds ${String(MAX_BENCHMARK_SNAPSHOT_BYTES)} bytes`)
    }
    const content = Buffer.alloc(Number(before.size))
    let offset = 0
    while (offset < content.byteLength) {
      const bytesRead = readSync(descriptor, content, offset, content.byteLength - offset, null)
      /* v8 ignore next -- a regular file with a stable fstat size does not return early EOF synchronously. */
      if (bytesRead === 0) break
      offset += bytesRead
    }
    const after = fstatSync(descriptor, { bigint: true })
    /* v8 ignore next 9 -- requires replacing or mutating an open local file during one synchronous bounded read. */
    if (
      offset !== content.byteLength
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
    ) {
      throw new Error(`${label} changed while it was being read`)
    }
    assertStableSnapshotIdentity(path, expected, after, label)
    return content
  } finally {
    closeSync(descriptor)
  }
}

function assertStableSnapshotIdentity(
  path: string,
  expected: BigIntStats,
  descriptor: BigIntStats,
  label: string,
): void {
  let current: BigIntStats
  let canonical: string
  try {
    canonical = realpathSync.native(path)
    current = lstatSync(path, { bigint: true })
  } catch {
    throw new Error(`${label} changed while it was being read`)
  }
  if (
    canonical !== path
    || current.isSymbolicLink()
    || !current.isFile()
    || !sameFileIdentity(expected, descriptor)
    || !sameFileIdentity(current, descriptor)
  ) {
    throw new Error(`${label} changed while it was being read`)
  }
}

function sameFileIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.ino !== 0n && right.ino !== 0n && left.dev === right.dev && left.ino === right.ino
}

/* jscpd:ignore-end */

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`)
  return value
}

/* jscpd:ignore-start -- Snapshot validation owns these rules instead of importing policy-private validators across package roles. */
function assertExactFields(
  value: Readonly<Record<string, unknown>>,
  fields: readonly string[],
  label: string,
): void {
  if (canonicalBenchmarkJson(Object.keys(value).sort()) !== canonicalBenchmarkJson([...fields].sort())) {
    throw new Error(`${label} must contain exactly ${fields.join(', ').replace(/, ([^,]+)$/u, ', and $1')}`)
  }
}

function isCanonicalGitHubRepository(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
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
  ) {
    return false
  }
  const segments = url.pathname.split('/').slice(1)
  return segments.length === 2
    && GITHUB_OWNER_PATTERN.test(segments[0] as string)
    && GITHUB_REPOSITORY_PATTERN.test(segments[1] as string)
    && segments[1] !== '.'
    && segments[1] !== '..'
    && !/\.git$/iu.test(segments[1] as string)
    && value === `https://github.com/${segments.join('/')}`
}

/* jscpd:ignore-end */

function isSafeRepositoryPath(value: unknown): boolean {
  if (value === null) return true
  return typeof value === 'string'
    && value.length > 0
    && !isAbsolute(value)
    && !WINDOWS_ABSOLUTE_PATH.test(value)
    && !value.includes('\\')
    && !value.includes('\0')
    && posix.normalize(value) === value
    && value !== '.'
    && value !== '..'
    && !value.startsWith('../')
}

function isPlaceholderDigest(value: string): boolean {
  return /^(.)\1+$/u.test(value) || /^([0-9a-f]{2})\1+$/u.test(value)
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException & { readonly code: string } {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

function normalizedBenchmarkJson(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('benchmark snapshots must contain finite numbers')
    return value
  }
  if (Array.isArray(value)) {
    const descriptors = Object.getOwnPropertyDescriptors(value)
    if (
      Object.getPrototypeOf(value) !== Array.prototype
      || Reflect.ownKeys(value).length !== value.length + 1
    ) {
      throw new Error('benchmark snapshots must contain plain JSON arrays')
    }
    for (let index = 0; index < value.length; index++) {
      const descriptor = descriptors[String(index)]
      if (
        descriptor?.enumerable !== true
        || !Object.hasOwn(descriptor, 'value')
      ) {
        throw new Error('benchmark snapshots must contain plain JSON arrays')
      }
    }
    return Array.from(
      { length: value.length },
      (_, index) => normalizedBenchmarkJson(descriptors[String(index)]?.value),
    )
  }
  if (isRecord(value)) {
    const prototype: unknown = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('benchmark snapshots must contain plain JSON values')
    }
    const keys = Object.keys(value)
    if (Reflect.ownKeys(value).length !== keys.length) {
      throw new Error('benchmark snapshots must contain plain JSON values')
    }
    const descriptors = Object.getOwnPropertyDescriptors(value)
    if (keys.some((key) => {
      const descriptor = descriptors[key] as PropertyDescriptor
      return descriptor.enumerable !== true || !Object.hasOwn(descriptor, 'value')
    })) {
      throw new Error('benchmark snapshots must contain plain JSON values')
    }
    return Object.fromEntries(keys
      .sort()
      .map(key => [key, normalizedBenchmarkJson(descriptors[key]?.value)]))
  }
  throw new Error('benchmark snapshots must contain plain JSON values')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

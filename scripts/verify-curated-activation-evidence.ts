/** Verify checked-in records and artifacts that authorize curated runtime activation. */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readSync,
  realpathSync,
  rmSync,
  type BigIntStats,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSON_SCHEMA, load as loadYaml } from 'js-yaml'
import {
  loadCuratedCatalog,
  redactSecretLikeValues,
  validateCandidateLock,
  type CuratedCandidate,
  type CuratedCatalog,
  type CuratedRuntimeActivationEvidenceSet,
  type CuratedRuntimeEvidenceFile,
} from '@deepseek-ai/dsh-curated-policy'
import { CURATED_PROFILE_TEMPLATES } from '@deepseek-ai/dsh-curated-profiles'
import { runOwnedProcess } from './run-owned-process.ts'

const root = resolve(import.meta.dirname, '..')
const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024
const EVIDENCE_DIRECTORY = 'packages/curated/curated-bench/evidence/'
const SNAPSHOT_CONFIG = 'vitest.snapshot.config.ts'
const ACTIVATION_SNAPSHOT_TIMEOUT_MS = 50_000
const ACTIVATION_SNAPSHOT_MAX_OUTPUT_BYTES = 1024 * 1024
const ACTIVATION_REPLAY_ENV_NAMES = new Set([
  'COMSPEC',
  'LANG',
  'LANGUAGE',
  'LC_ALL',
  'LC_CTYPE',
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'TMPDIR',
  'TZ',
  'WINDIR',
])
const EVIDENCE_DOCUMENT_KEYS = [
  'schemaVersion',
  'kind',
  'evidenceKind',
  'operation',
  'candidateId',
  'profile',
  'repository',
  'commit',
  'expectedPackage',
  'sourceContentSha256',
  'treeSha256',
  'runtimeDependencyClosureSha256',
  'profileSha256',
  'requiredRuntimeBundles',
  'command',
  'exitCode',
  'success',
  'artifact',
] as const
const ASSEMBLED_EVIDENCE_DOCUMENT_KEYS = [
  ...EVIDENCE_DOCUMENT_KEYS,
  'runtimeObservations',
] as const
const RUNTIME_OBSERVATION_KEYS = [
  'waterfallDelegationVerified',
  'duplicateTokenInjectionCount',
  'duplicateExternalRequestCount',
] as const
const ACTIVATION_ARTIFACT_KEYS = [
  'operation',
  'candidateId',
  'profile',
  'repository',
  'commit',
  'expectedPackage',
  'sourceContentSha256',
  'treeSha256',
  'runtimeDependencyClosureSha256',
  'profileSha256',
  'requiredRuntimeBundles',
  'observed',
  'command',
] as const
const ASSEMBLED_ACTIVATION_ARTIFACT_KEYS = [
  ...ACTIVATION_ARTIFACT_KEYS,
  'waterfallDelegationVerified',
  'duplicateTokenInjectionCount',
  'duplicateExternalRequestCount',
] as const
const EVIDENCE_ARTIFACT_KEYS = ['path', 'sha256'] as const
const evidenceFields = [
  'keylessAssembledSnapshot',
  'install',
  'enable',
  'restart',
  'disableOrUninstall',
] as const
const operations = {
  keylessAssembledSnapshot: 'keyless-assembled-snapshot',
  install: 'install',
  enable: 'enable',
  restart: 'restart',
  disableOrUninstall: 'disable-or-uninstall',
} as const satisfies Record<typeof evidenceFields[number], string>
const secretCommandKeyPattern =
  /(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|secret|token|(?:^|[-_])auth(?:$|[-_])|(?:^|[-_])key(?:$|[-_]))/iu
const secretCommandHeaderKeyPattern =
  /^(?:api[-_]?key|authorization|cookie|credential|password|private[-_]?key|secret|token|auth|key)$/iu
const safeActivationJsonKeys = new Set([
  'duplicateTokenInjectionCount',
])
const secretCommandValuePattern = new RegExp([
  String.raw`(?:\bbearer\s+\S+|`,
  String.raw`(?:^|[^\p{L}\p{N}])(?:sk-[\w-]+|gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+))`,
].join(''), 'iu')
const schemeUrlPattern = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//u
const schemelessUrlUserinfoPattern =
  /^[^@\s/:]+:[^@\s/]+@(?:\[[^\]\s]+\]|[^:\s/]+):\d+(?:[/?#]|$)/u

/** Parsed activation-evidence record checked against one catalog candidate. */
interface ActivationEvidenceDocument {
  readonly schemaVersion: 1
  readonly kind: 'curated-runtime-activation-evidence'
  readonly evidenceKind: 'observed'
  readonly operation: typeof operations[typeof evidenceFields[number]]
  readonly candidateId: string
  readonly profile: string
  readonly repository: string
  readonly commit: string
  readonly expectedPackage: string
  readonly sourceContentSha256: string
  readonly treeSha256: string
  readonly runtimeDependencyClosureSha256: string
  readonly profileSha256: string
  readonly requiredRuntimeBundles: readonly string[]
  readonly command: readonly string[]
  readonly exitCode: 0
  readonly success: true
  readonly artifact: CuratedRuntimeEvidenceFile
  readonly runtimeObservations?: {
    readonly waterfallDelegationVerified: true
    readonly duplicateTokenInjectionCount: 0
    readonly duplicateExternalRequestCount: 0
  }
}

/** Machine-verifiable result emitted by one activation operation. */
interface ActivationArtifactDocument {
  readonly operation: typeof operations[typeof evidenceFields[number]]
  readonly candidateId: string
  readonly profile: string
  readonly repository: string
  readonly commit: string
  readonly expectedPackage: string
  readonly sourceContentSha256: string
  readonly treeSha256: string
  readonly runtimeDependencyClosureSha256: string
  readonly profileSha256: string
  readonly requiredRuntimeBundles: readonly string[]
  readonly observed: true
  readonly command: {
    readonly argv: readonly string[]
    readonly status: 0
  }
  readonly waterfallDelegationVerified?: true
  readonly duplicateTokenInjectionCount?: 0
  readonly duplicateExternalRequestCount?: 0
}

/**
 * Verify every active candidate's evidence records and referenced artifacts.
 * @param repositoryRoot - Repository root containing all evidence paths.
 * @param catalog - Parsed curated candidate catalog.
 * @param isTrackedRegularBlob - Read-only predicate for repository-relative tracked regular files.
 * @param readEvidence - Bounded stable evidence reader.
 * @returns stable diagnostics, empty when every active evidence record is bound to its candidate and artifact.
 */
export function validateCuratedActivationEvidence(
  repositoryRoot: string,
  catalog: CuratedCatalog,
  isTrackedRegularBlob: (path: string) => boolean,
  readEvidence: typeof readVerifiedFile = readVerifiedFile,
): readonly string[] {
  const messages: string[] = []
  const canonicalRoot = realpathSync.native(repositoryRoot)
  const artifactOwners = new Map<string, string>()
  for (const candidate of catalog.candidates) {
    if (!candidate.active) continue
    const evidence = candidate.runtimeActivationEvidence
    if (evidence === undefined) {
      messages.push(`candidate ${candidate.id} has no runtimeActivationEvidence`)
      continue
    }
    if (!sameStrings(
      Object.keys(evidence).sort(),
      [...candidate.targetProfiles].sort(),
    )) {
      messages.push(
        `candidate ${candidate.id} runtimeActivationEvidence profile keys must exactly match targetProfiles`,
      )
    }
    for (const [profile, evidenceSet] of Object.entries(evidence)) {
      if (!Object.hasOwn(CURATED_PROFILE_TEMPLATES, profile)) {
        messages.push(`candidate ${candidate.id} activation evidence names unknown curated profile ${profile}`)
      }
      for (const field of evidenceFields) {
        messages.push(...validateEvidenceRecord(
          canonicalRoot,
          catalog,
          candidate,
          profile,
          field,
          evidenceSet,
          artifactOwners,
          isTrackedRegularBlob,
          readEvidence,
        ))
      }
    }
  }
  return redactDiagnostics(messages)
}

function validateEvidenceRecord(
  repositoryRoot: string,
  catalog: CuratedCatalog,
  candidate: CuratedCandidate,
  profile: string,
  field: typeof evidenceFields[number],
  evidence: CuratedRuntimeActivationEvidenceSet,
  artifactOwners: Map<string, string>,
  isTrackedRegularBlob: (path: string) => boolean,
  readEvidence: typeof readVerifiedFile,
): string[] {
  const reference = evidence[field]
  const label = `candidate ${candidate.id} runtimeActivationEvidence.${field}`
  const loaded = readEvidence(repositoryRoot, reference, label, isTrackedRegularBlob)
  if (typeof loaded === 'string') return [loaded]
  const parsed = parseActivationJson(loaded, label, reference.path)
  if (typeof parsed === 'string') return [parsed]
  const document = readEvidenceDocument(parsed, field, label)
  if (typeof document === 'string') return [document]
  const messages = validateEvidenceDocument(candidate, profile, field, document, label)
  const expectedCommand = curatedActivationEvidenceCommand(candidate.id, profile, field)
  if (!sameStrings(document.command, expectedCommand)) {
    messages.push(`${label}.command must invoke the repository-owned activation snapshot`)
  } else if (!isTrackedRegularBlob(expectedCommand[7] as string)) {
    messages.push(`${label}.command snapshot must be a Git-tracked regular blob`)
  }
  const expectedProfileSha256 = curatedProfileCompositionSha256(catalog, profile)
  if (document.profileSha256 !== expectedProfileSha256) {
    messages.push(`${label}.profileSha256 does not match the current curated profile composition`)
  }
  if (document.artifact.path === reference.path) {
    messages.push(`${label} artifact must be separate from its evidence record`)
    return messages
  }
  const artifact = readEvidence(
    repositoryRoot,
    document.artifact,
    `${label} artifact`,
    isTrackedRegularBlob,
  )
  if (typeof artifact === 'string') {
    messages.push(artifact)
    return messages
  }
  const priorOwner = artifactOwners.get(document.artifact.path)
  if (priorOwner !== undefined) {
    messages.push(`${label} artifact reuses ${document.artifact.path}`)
  } else {
    artifactOwners.set(document.artifact.path, label)
  }
  const parsedArtifact = parseActivationJson(artifact, `${label} artifact`)
  if (typeof parsedArtifact === 'string') {
    messages.push(parsedArtifact)
    return messages
  }
  const artifactDocument = readActivationArtifact(parsedArtifact, field, `${label} artifact`)
  if (typeof artifactDocument === 'string') {
    messages.push(artifactDocument)
    return messages
  }
  messages.push(...validateActivationArtifact(
    artifactDocument,
    document,
    `${label} artifact`,
  ))
  return messages
}

function parseActivationJson(
  content: Buffer,
  label: string,
  path?: string,
): unknown {
  const text = content.toString('utf8')
  if (rawActivationJsonContainsSecret(text)) {
    return `${label} must not contain secret material${path === undefined ? '' : `: ${path}`}`
  }
  try {
    loadYaml(text, { json: false, schema: JSON_SCHEMA })
    return JSON.parse(text) as unknown
  } catch {
    return `${label} must contain a JSON object${path === undefined ? '' : `: ${path}`}`
  }
}

function rawActivationJsonContainsSecret(text: string): boolean {
  const stringPattern = /"(?:\\.|[^"\\])*"/gu
  for (const match of text.matchAll(stringPattern)) {
    let value: string
    try {
      value = JSON.parse(match[0]) as string
    } catch {
      continue
    }
    const after = text.slice(match.index + match[0].length)
    const separator = /^\s*:\s*/u.exec(after)
    if (separator === null) continue
    if (!safeActivationJsonKeys.has(value) && secretCommandKeyPattern.test(value)) {
      const encodedValue = after.slice(separator[0].length)
      if (!encodedValue.startsWith('null') && !encodedValue.startsWith('""')) return true
    }
  }
  return false
}

function readEvidenceDocument(
  value: unknown,
  field: typeof evidenceFields[number],
  label: string,
): ActivationEvidenceDocument | string {
  if (!isRecord(value)) return `${label} must contain a JSON object`
  const expectedKeys = field === 'keylessAssembledSnapshot'
    ? ASSEMBLED_EVIDENCE_DOCUMENT_KEYS
    : EVIDENCE_DOCUMENT_KEYS
  if (!sameStrings(Object.keys(value).sort(), [...expectedKeys].sort())) {
    return `${label} must contain exactly the activation evidence fields`
  }
  if (!isRecord(value.artifact)) return `${label}.artifact must be a JSON object`
  if (!sameStrings(Object.keys(value.artifact).sort(), [...EVIDENCE_ARTIFACT_KEYS].sort())) {
    return `${label}.artifact must contain exactly path and sha256`
  }
  const requiredStrings = [
    'kind',
    'evidenceKind',
    'operation',
    'candidateId',
    'profile',
    'repository',
    'commit',
    'expectedPackage',
    'sourceContentSha256',
    'treeSha256',
    'runtimeDependencyClosureSha256',
    'profileSha256',
  ] as const
  if (requiredStrings.some(field => typeof value[field] !== 'string' || value[field].length === 0)) {
    return `${label} identity fields must be non-empty strings`
  }
  if (!isStringArray(value.requiredRuntimeBundles)) {
    return `${label}.requiredRuntimeBundles must be a string array`
  }
  if (!isStringArray(value.command) || value.command.length === 0) {
    return `${label}.command must be a non-empty string array`
  }
  if (commandContainsSecret(value.command)) {
    return `${label}.command must not contain secret material`
  }
  if (typeof value.artifact.path !== 'string' || typeof value.artifact.sha256 !== 'string') {
    return `${label}.artifact path and sha256 must be strings`
  }
  if (field === 'keylessAssembledSnapshot') {
    if (!isRecord(value.runtimeObservations)) {
      return `${label}.runtimeObservations must be a JSON object`
    }
    if (!sameStrings(
      Object.keys(value.runtimeObservations).sort(),
      [...RUNTIME_OBSERVATION_KEYS].sort(),
    )) {
      return `${label}.runtimeObservations must contain exactly the runtime observation fields`
    }
    const observations = value.runtimeObservations
    if (
      observations.waterfallDelegationVerified !== true
      || observations.duplicateTokenInjectionCount !== 0
      || observations.duplicateExternalRequestCount !== 0
    ) {
      return `${label}.runtimeObservations must prove waterfall delegation and zero duplicate token or external requests`
    }
  }
  return value as unknown as ActivationEvidenceDocument
}

function validateEvidenceDocument(
  candidate: CuratedCandidate,
  profile: string,
  field: typeof evidenceFields[number],
  document: ActivationEvidenceDocument,
  label: string,
): string[] {
  const messages: string[] = []
  const expected = {
    schemaVersion: 1,
    kind: 'curated-runtime-activation-evidence',
    evidenceKind: 'observed',
    operation: operations[field],
    candidateId: candidate.id,
    repository: candidate.repository,
    commit: candidate.commit,
    expectedPackage: candidate.expectedPackage,
    sourceContentSha256: candidate.sourceContentSha256,
    treeSha256: candidate.treeSha256,
    runtimeDependencyClosureSha256: candidate.runtimeDependencyClosureSha256,
    profileSha256: document.profileSha256,
    exitCode: 0,
    success: true,
  } as const
  for (const [key, value] of Object.entries(expected)) {
    if (document[key as keyof ActivationEvidenceDocument] !== value) {
      messages.push(`${label}.${key} does not match the active candidate`)
    }
  }
  if (document.profile !== profile) {
    messages.push(`${label}.profile must match its profile key`)
  }
  const requiredBundles = [...(candidate.requiredRuntimeBundles ?? [])].sort()
  if (!sameStrings([...document.requiredRuntimeBundles].sort(), requiredBundles)) {
    messages.push(`${label}.requiredRuntimeBundles does not match the active candidate`)
  }
  if (!isSafeRepositoryPath(document.artifact.path)) {
    messages.push(`${label}.artifact.path must be a safe repository-relative POSIX path`)
  }
  if (!/^[0-9a-f]{64}$/u.test(document.artifact.sha256)) {
    messages.push(`${label}.artifact.sha256 must be a lowercase SHA-256 digest`)
  }
  return messages
}

function readActivationArtifact(
  value: unknown,
  field: typeof evidenceFields[number],
  label: string,
): ActivationArtifactDocument | string {
  if (!isRecord(value)) return `${label} must contain a JSON object`
  const expectedKeys = field === 'keylessAssembledSnapshot'
    ? ASSEMBLED_ACTIVATION_ARTIFACT_KEYS
    : ACTIVATION_ARTIFACT_KEYS
  if (!sameStrings(Object.keys(value).sort(), [...expectedKeys].sort())) {
    return `${label} must contain exactly the activation artifact fields`
  }
  const requiredStrings = [
    'operation',
    'candidateId',
    'profile',
    'repository',
    'commit',
    'expectedPackage',
    'sourceContentSha256',
    'treeSha256',
    'runtimeDependencyClosureSha256',
    'profileSha256',
  ] as const
  if (requiredStrings.some(key => typeof value[key] !== 'string' || value[key].length === 0)) {
    return `${label} identity fields must be non-empty strings`
  }
  if (!isStringArray(value.requiredRuntimeBundles)) {
    return `${label}.requiredRuntimeBundles must be a string array`
  }
  if (
    !isRecord(value.command)
    || !sameStrings(Object.keys(value.command).sort(), ['argv', 'status'])
  ) {
    return `${label}.command must contain exactly argv and status`
  }
  if (!isStringArray(value.command.argv) || value.command.argv.length === 0) {
    return `${label}.command.argv must be a non-empty string array`
  }
  if (commandContainsSecret(value.command.argv)) {
    return `${label}.command.argv must not contain secret material`
  }
  if (value.command.status !== 0) {
    return `${label}.command.status must be 0`
  }
  if (field === 'keylessAssembledSnapshot') {
    if (
      value.waterfallDelegationVerified !== true
      || value.duplicateTokenInjectionCount !== 0
      || value.duplicateExternalRequestCount !== 0
    ) {
      return `${label} must prove waterfall delegation and zero duplicate token or external requests`
    }
  }
  return value as unknown as ActivationArtifactDocument
}

function validateActivationArtifact(
  artifact: ActivationArtifactDocument,
  evidence: ActivationEvidenceDocument,
  label: string,
): string[] {
  const messages: string[] = []
  const expected = {
    operation: evidence.operation,
    candidateId: evidence.candidateId,
    profile: evidence.profile,
    repository: evidence.repository,
    commit: evidence.commit,
    expectedPackage: evidence.expectedPackage,
    sourceContentSha256: evidence.sourceContentSha256,
    treeSha256: evidence.treeSha256,
    runtimeDependencyClosureSha256: evidence.runtimeDependencyClosureSha256,
    profileSha256: evidence.profileSha256,
    observed: true,
  } as const
  for (const [key, value] of Object.entries(expected)) {
    if (artifact[key as keyof ActivationArtifactDocument] !== value) {
      messages.push(`${label}.${key} does not match the activation evidence record`)
    }
  }
  if (!sameStrings(artifact.requiredRuntimeBundles, evidence.requiredRuntimeBundles)) {
    messages.push(`${label}.requiredRuntimeBundles does not match the activation evidence record`)
  }
  if (!sameStrings(artifact.command.argv, evidence.command)) {
    messages.push(`${label}.command.argv does not match the activation evidence record`)
  }
  return messages
}

function readVerifiedFile(
  repositoryRoot: string,
  reference: CuratedRuntimeEvidenceFile,
  label: string,
  isTrackedRegularBlob: (path: string) => boolean,
): Buffer | string {
  if (!isSafeRepositoryPath(reference.path)) {
    return `${label} path must be a safe repository-relative POSIX path: ${reference.path}`
  }
  if (!reference.path.startsWith(EVIDENCE_DIRECTORY)) {
    return `${label} path must be under ${EVIDENCE_DIRECTORY}`
  }
  if (!isTrackedRegularBlob(reference.path)) {
    return `${label} path must be a Git-tracked regular blob: ${reference.path}`
  }
  const content = readStableRepositoryFile(repositoryRoot, reference.path, label)
  if (typeof content === 'string') return content
  const actual = createHash('sha256').update(content).digest('hex')
  return actual === reference.sha256
    ? content
    : `${label} digest does not match ${reference.path}`
}

function readStableRepositoryFile(
  repositoryRoot: string,
  path: string,
  label: string,
): Buffer | string {
  const unresolved = resolve(repositoryRoot, ...path.split('/'))
  let canonical: string
  let initial: BigIntStats
  try {
    const ancestorIssue = repositoryAncestorIssue(repositoryRoot, unresolved)
    if (ancestorIssue !== undefined) return `${label} ${ancestorIssue}: ${path}`
    initial = lstatSync(unresolved, { bigint: true })
    if (initial.isSymbolicLink() || !initial.isFile()) {
      return `${label} path must be a regular file: ${path}`
    }
    if (initial.size > BigInt(MAX_EVIDENCE_BYTES)) {
      return `${label} exceeds ${String(MAX_EVIDENCE_BYTES)} bytes: ${path}`
    }
    canonical = realpathSync.native(unresolved)
  } catch {
    return `${label} path does not exist: ${path}`
  }
  const canonicalFromRoot = relative(repositoryRoot, canonical)
  if (
    canonicalFromRoot === '..'
    || canonicalFromRoot.startsWith(`..${sep}`)
    || isAbsolute(canonicalFromRoot)
  ) {
    return `${label} path must stay inside the repository: ${path}`
  }
  return readBoundedStableFile(repositoryRoot, canonical, unresolved, initial, label)
}

function repositoryAncestorIssue(repositoryRoot: string, file: string): string | undefined {
  const relativePath = relative(repositoryRoot, file)
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    return 'path must stay inside the repository'
  }
  let current = repositoryRoot
  for (const segment of relativePath.split(sep).slice(0, -1)) {
    current = join(current, segment)
    const entry = lstatSync(current)
    if (entry.isSymbolicLink() || !entry.isDirectory()) {
      return 'path ancestors must be regular directories inside the repository'
    }
  }
  return undefined
}

function readBoundedStableFile(
  repositoryRoot: string,
  canonical: string,
  unresolved: string,
  expected: BigIntStats,
  label: string,
): Buffer | string {
  let flags = constants.O_RDONLY | constants.O_NONBLOCK
  /* v8 ignore else -- Windows does not expose O_NOFOLLOW. */
  if (typeof constants.O_NOFOLLOW === 'number') flags |= constants.O_NOFOLLOW
  let descriptor: number
  try {
    descriptor = openSync(canonical, flags)
  } catch {
    return `${label} changed while it was being read`
  }
  try {
    const before = fstatSync(descriptor, { bigint: true })
    if (!before.isFile() || !sameFileIdentity(expected, before)) {
      return `${label} changed while it was being read`
    }
    if (before.size > BigInt(MAX_EVIDENCE_BYTES)) {
      return `${label} exceeds ${String(MAX_EVIDENCE_BYTES)} bytes`
    }
    if (repositoryAncestorIssue(repositoryRoot, unresolved) !== undefined) {
      return `${label} changed while it was being read`
    }
    /* jscpd:ignore-start -- Evidence uses string diagnostics and ancestor rechecks unlike the throwing profile reader. */
    const content = Buffer.alloc(Number(before.size))
    let offset = 0
    while (offset < content.byteLength) {
      const bytesRead = readSync(descriptor, content, offset, content.byteLength - offset, null)
      /* v8 ignore next -- stable regular files do not return an early synchronous EOF. */
      if (bytesRead === 0) break
      offset += bytesRead
    }
    const after = fstatSync(descriptor, { bigint: true })
    /* v8 ignore next 9 -- requires replacing or mutating a tracked file during one synchronous read. */
    if (
      offset !== content.byteLength
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
    ) {
      return `${label} changed while it was being read`
    }
    /* jscpd:ignore-end */
    if (repositoryAncestorIssue(repositoryRoot, unresolved) !== undefined) {
      return `${label} changed while it was being read`
    }
    const current = lstatSync(unresolved, { bigint: true })
    if (
      current.isSymbolicLink()
      || !current.isFile()
      || realpathSync.native(unresolved) !== canonical
      || !sameFileIdentity(expected, current)
      || !sameFileIdentity(after, current)
    ) {
      return `${label} changed while it was being read`
    }
    return content
  } catch {
    return `${label} changed while it was being read`
  } finally {
    closeSync(descriptor)
  }
}

function sameFileIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.ino !== 0n && right.ino !== 0n && left.dev === right.dev && left.ino === right.ino
}

function isSafeRepositoryPath(value: string): boolean {
  return value.length > 0
    && !isAbsolute(value)
    && !/^(?:[A-Za-z]:|\\\\)/u.test(value)
    && !value.includes('\\')
    && !value.includes('\0')
    && posix.normalize(value) === value
    && value !== '.'
    && value !== '..'
    && !value.startsWith('../')
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0)
}

/**
 * Build the only command accepted as replayable activation evidence.
 * @param candidateId - Curated candidate id.
 * @param profile - Target curated profile.
 * @param field - Lifecycle evidence operation.
 * @returns argv for the repository-owned keyless snapshot test.
 */
export function curatedActivationEvidenceCommand(
  candidateId: string,
  profile: string,
  field: typeof evidenceFields[number],
): string[] {
  return [
    'pnpm',
    '--config.verify-deps-before-run=false',
    'exec',
    'vitest',
    'run',
    '--config',
    SNAPSHOT_CONFIG,
    `${EVIDENCE_DIRECTORY}${candidateId}/${profile}.snapshot.ts`,
    '--reporter=json',
    '-t',
    `${candidateId}:${profile}:${operations[field]}`,
  ]
}

function commandContainsSecret(argv: readonly string[]): boolean {
  return argv.some((argument, index) => {
    if (secretCommandValuePattern.test(argument) || containsUrlSecret(argument)) return true
    const assignment = /^(?:-{1,2})?(?<key>[^=:]+)(?<separator>[=:])(?<value>.*)$/u.exec(argument)
    if (
      assignment?.groups?.key !== undefined
      && assignment.groups.value !== ''
      && secretCommandKeyPattern.test(assignment.groups.key)
      && (
        assignment.groups.separator === '='
        || secretCommandHeaderKeyPattern.test(assignment.groups.key)
      )
    ) {
      return true
    }
    const optionKey = /^-{1,2}(?<key>[^=:]+)$/u.exec(argument)?.groups?.key
    return optionKey !== undefined
      && secretCommandKeyPattern.test(optionKey)
      && (argv[index + 1]?.length ?? 0) > 0
  })
}

function containsUrlSecret(argument: string): boolean {
  const assignment = argument.indexOf('=')
  const candidates = assignment < 0 ? [argument] : [argument, argument.slice(assignment + 1)]
  return candidates.some((candidate) => {
    if (schemelessUrlUserinfoPattern.test(candidate)) return true
    if (!schemeUrlPattern.test(candidate)) return false
    try {
      const url = new URL(candidate)
      if (url.username.length > 0 || url.password.length > 0) return true
      for (const [key, value] of url.searchParams) {
        if (value.length > 0 && secretCommandKeyPattern.test(key)) return true
        if (secretCommandValuePattern.test(value)) return true
      }
      return false
    } catch {
      return false
    }
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * Hash the complete current composition inputs for one curated profile.
 * @param catalog - Candidate catalog whose active rows contribute to the profile.
 * @param profile - Curated profile name.
 * @returns SHA-256 of canonical composition JSON.
 */
export function curatedProfileCompositionSha256(catalog: CuratedCatalog, profile: string): string {
  const template = Reflect.get(CURATED_PROFILE_TEMPLATES, profile) as { bundles: readonly string[] } | undefined
  const candidates = catalog.candidates
    .filter(candidate => candidate.active && candidate.targetProfiles.includes(profile))
    .map(candidate => ({
      id: candidate.id,
      expectedPackage: candidate.expectedPackage,
      sourceContentSha256: candidate.sourceContentSha256,
      treeSha256: candidate.treeSha256,
      runtimeDependencyClosureSha256: candidate.runtimeDependencyClosureSha256,
      requiredRuntimeBundles: candidate.requiredRuntimeBundles ?? [],
      installSource: candidate.npmVersion === undefined
        ? {
          kind: 'git',
          repository: candidate.repository,
          commit: candidate.commit,
          repositoryPath: candidate.repositoryPath,
        }
        : {
          kind: 'npm',
          npmVersion: candidate.npmVersion,
          npmIntegrity: candidate.npmIntegrity,
        },
      config: candidate.config ?? null,
    }))
  return createHash('sha256').update(canonicalJson({
    schemaVersion: 1,
    profile,
    bundles: template?.bundles ?? null,
    candidates,
  })).digest('hex')
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeJson(value))
}

function normalizeJson(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }
  if (Array.isArray(value)) return value.map(item => normalizeJson(item))
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalizeJson(value[key])]))
  }
  throw new Error('curated profile composition must contain JSON values')
}

/**
 * Check whether one repository-relative path is a tracked stage-zero regular blob.
 * @param repositoryRoot - Git worktree root.
 * @param path - Repository-relative path passed literally after `--`.
 * @returns whether stage zero records a regular blob whose bytes equal a stable worktree read.
 */
export function isGitTrackedRegularBlob(repositoryRoot: string, path: string): boolean {
  try {
    const output = execFileSync(
      'git',
      ['-C', repositoryRoot, 'ls-files', '--error-unmatch', '--stage', '-z', '--', path],
      { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 },
    )
    const separator = output.indexOf(0x09)
    const terminator = output.indexOf(0)
    const header = output.subarray(0, separator).toString('utf8')
    const match = /^(?:100644|100755) (?<objectId>[0-9a-f]+) 0$/u.exec(header)
    if (
      separator < 0
      || terminator !== output.byteLength - 1
      || output.subarray(separator + 1, terminator).toString('utf8') !== path
      || match?.groups?.objectId === undefined
    ) {
      return false
    }
    const staged = execFileSync(
      'git',
      ['-C', repositoryRoot, 'cat-file', 'blob', match.groups.objectId],
      { encoding: 'buffer', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10_000 },
    )
    const canonicalRoot = realpathSync.native(repositoryRoot)
    const worktree = readStableRepositoryFile(canonicalRoot, path, 'tracked path')
    return Buffer.isBuffer(worktree) && staged.equals(worktree)
  } catch {
    return false
  }
}

type ActivationSnapshotExecutor = (
  command: string,
  args: readonly string[],
) => unknown

/**
 * Replay every operation snapshot required by active candidates.
 * The default executor removes its private credential-free home after each process tree exits.
 * @param catalog - Catalog whose active candidates own replay commands.
 * @param execute - Command executor used by tests and the repository gate.
 * @param isTrackedRegularBlob - Predicate rechecking snapshot bytes immediately before execution.
 * @returns stable replay diagnostics, empty when every snapshot passes.
 */
export async function replayCuratedActivationSnapshots(
  catalog: CuratedCatalog,
  execute: ActivationSnapshotExecutor = async (command, args) => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-activation-replay-'))
    const config = join(home, '.config')
    const dshHome = join(home, '.dsh')
    try {
      mkdirSync(config, { mode: 0o700 })
      mkdirSync(dshHome, { mode: 0o700 })
      const result = await runOwnedProcess(command, args, {
        cwd: root,
        deadline: Date.now() + ACTIVATION_SNAPSHOT_TIMEOUT_MS,
        env: activationReplayEnvironment(home, config, dshHome),
        maxOutputBytes: ACTIVATION_SNAPSHOT_MAX_OUTPUT_BYTES,
      })
      if (result.timedOut || result.exitCode !== 0) throw new Error('activation snapshot replay failed')
      return result.stdout
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  },
  isTrackedRegularBlob: (path: string) => boolean = isGitTrackedRegularBlob.bind(undefined, root),
): Promise<string[]> {
  const messages: string[] = []
  for (const candidate of catalog.candidates) {
    if (!candidate.active) continue
    for (const profile of candidate.targetProfiles) {
      for (const field of evidenceFields) {
        const argv = curatedActivationEvidenceCommand(candidate.id, profile, field)
        const [command, ...args] = argv
        if (!isTrackedRegularBlob(argv[7] as string)) {
          messages.push(
            `candidate ${candidate.id} activation snapshot changed before replay for ${profile}:${operations[field]}`,
          )
          continue
        }
        try {
          if (!isSuccessfulVitestReplay(await execute(command as string, args))) {
            messages.push(`candidate ${candidate.id} activation snapshot failed for ${profile}:${operations[field]}`)
          }
        } catch {
          messages.push(`candidate ${candidate.id} activation snapshot failed for ${profile}:${operations[field]}`)
        }
      }
    }
  }
  return redactDiagnostics(messages)
}

function activationReplayEnvironment(
  home: string,
  config: string,
  dshHome: string,
): NodeJS.ProcessEnv {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([name, value]) =>
    value !== undefined
    && ACTIVATION_REPLAY_ENV_NAMES.has(name.toUpperCase()),
  ))
  return {
    ...environment,
    APPDATA: config,
    CI: 'true',
    DSH_HOME: dshHome,
    HOME: home,
    LOCALAPPDATA: config,
    NPM_CONFIG_USERCONFIG: join(config, 'npmrc'),
    USERPROFILE: home,
    XDG_CONFIG_HOME: config,
  }
}

function isSuccessfulVitestReplay(output: unknown): boolean {
  const text = Buffer.isBuffer(output) ? output.toString('utf8') : output
  if (typeof text !== 'string') return false
  try {
    const report = JSON.parse(text) as unknown
    return isRecord(report)
      && report.success === true
      && report.numPassedTests === 1
      && report.numFailedTests === 0
  } catch {
    return false
  }
}

/**
 * Validate and replay all checked-in activation evidence.
 * @param catalog - Catalog to verify; defaults to the checked-in catalog.
 * @param options - Evidence accessors used by the repository gate or focused tests.
 * @returns stable diagnostics, empty when policy, evidence, and replay all pass.
 */
export async function curatedActivationEvidenceIssues(
  catalog: CuratedCatalog = loadCuratedCatalog(),
  options: {
    readonly repositoryRoot?: string
    readonly isTrackedRegularBlob?: (path: string) => boolean
    readonly readEvidenceFile?: typeof readVerifiedFile
  } = {},
): Promise<string[]> {
  const policyIssues = validateCandidateLock(catalog)
  const policyDiagnostics = policyIssues.map(issue => `${issue.code}: ${issue.message}`)
  if (policyDiagnostics.length > 0) return redactDiagnostics(policyDiagnostics)
  const repositoryRoot = options.repositoryRoot ?? root
  const evidenceIssues = validateCuratedActivationEvidence(
    repositoryRoot,
    catalog,
    options.isTrackedRegularBlob ?? isGitTrackedRegularBlob.bind(undefined, repositoryRoot),
    options.readEvidenceFile,
  )
  return redactDiagnostics([
    ...evidenceIssues,
    ...evidenceIssues.length === 0
      ? await replayCuratedActivationSnapshots(
        catalog,
        undefined,
        options.isTrackedRegularBlob ?? isGitTrackedRegularBlob.bind(undefined, repositoryRoot),
      )
      : [],
  ])
}

function redactDiagnostics(messages: readonly string[]): string[] {
  return messages.map(message => redactSecretLikeValues(message) as string)
}

/**
 * Run the curated activation evidence verifier.
 * @param catalog - Catalog to verify; defaults to the checked-in catalog.
 */
export async function runCuratedActivationEvidenceVerifier(
  catalog: CuratedCatalog = loadCuratedCatalog(),
): Promise<void> {
  const messages = await curatedActivationEvidenceIssues(catalog)
  if (messages.length > 0) {
    console.error(`verify-curated-activation-evidence failed:\n${messages.map(message => `- ${message}`).join('\n')}`)
    process.exitCode = 1
    return
  }
  console.log('verify-curated-activation-evidence: all active candidate evidence records and artifacts match.')
}

if (
  process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void runCuratedActivationEvidenceVerifier().catch(() => {
    console.error('verify-curated-activation-evidence failed')
    process.exitCode = 1
  })
}

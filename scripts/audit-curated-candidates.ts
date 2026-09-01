/**
 * Reproduce curated candidate source-content digests from Git objects without
 * creating a checkout or extracting an archive.
 */

import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCuratedCatalog } from '@deepseek-ai/dsh-curated-policy'
import { runOwnedProcess } from './run-owned-process.ts'

const DEFAULT_TIMEOUT_MS = 50_000
const MAX_TIMEOUT_MS = 50_000
const MAX_GIT_OUTPUT_BYTES = 320 * 1024 * 1024
const MAX_BLOB_BYTES = 128 * 1024 * 1024
const MAX_TOTAL_BLOB_BYTES = 256 * 1024 * 1024
const DIGEST_DOMAIN = Buffer.from('dsh-source-content-v1\0')
const SHA1_PATTERN = /^[0-9a-f]{40}$/u
const CREDENTIAL_ENV_PATTERN = /KEY|PASSWORD|SECRET|TOKEN|AUTH|CREDENTIAL|COOKIE/iu
const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/u
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/u
const GIT_LAUNCH_ENV_NAMES = new Set([
  'ALL_PROXY',
  'COMSPEC',
  'CURL_CA_BUNDLE',
  'HOME',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'LANG',
  'LANGUAGE',
  'NO_PROXY',
  'PATH',
  'PATHEXT',
  'SSL_CERT_DIR',
  'SSL_CERT_FILE',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'TMPDIR',
  'TZ',
  'USERPROFILE',
])
const SUPPORTED_MODES = new Set(['100644', '100755', '120000'])
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

interface GitEntry {
  readonly mode: string
  readonly objectId: string
  readonly path: Buffer
  readonly size: number
  readonly type: string
}

interface GitRunOptions {
  readonly deadline: number
  readonly gitExecutable: string
  readonly input?: Buffer
}

/** Result of one pinned-commit source audit. */
export interface SourceContentAudit {
  /** Number of blob entries included in the digest. */
  readonly entryCount: number
  /** SHA-256 over the canonical entry sequence. */
  readonly sourceContentSha256: string
}

/** Inputs for fetching and auditing one remote repository commit. */
export interface RepositorySourceAuditOptions {
  /** Full source commit SHA. */
  readonly commit: string
  /** Git executable override used by tests. */
  readonly gitExecutable?: string
  /** Canonical HTTPS GitHub repository URL. */
  readonly repository: string
  /** Total wall-clock budget; values above 50 seconds reject. */
  readonly timeoutMs?: number
}

/**
 * Audit a commit already present in a Git object database.
 * @param gitDirectory - Bare repository or ordinary repository root.
 * @param commit - Full SHA-1 commit id.
 * @param timeoutMs - Total wall-clock budget.
 * @returns the source-content digest and included entry count.
 */
export function auditGitCommit(
  gitDirectory: string,
  commit: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SourceContentAudit> {
  return auditGitCommitBefore(
    gitDirectory,
    commit,
    deadlineFromTimeout(timeoutMs),
    'git',
  )
}

/**
 * Fetch and audit one pinned GitHub commit in a temporary bare repository.
 * @param options - Repository, commit, executable, and total timeout.
 * @returns the source-content digest and included entry count.
 */
export async function auditRepositorySource(
  options: RepositorySourceAuditOptions,
): Promise<SourceContentAudit> {
  const repository = normalizeGitHubRepository(options.repository)
  assertCommit(options.commit)
  const deadline = deadlineFromTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const gitExecutable = options.gitExecutable ?? 'git'
  const gitDirectory = mkdtempSync(resolve(tmpdir(), 'dsh-curated-source-audit-'))
  try {
    await runGit(['init', '--bare', '--quiet', gitDirectory], { deadline, gitExecutable })
    await runGit([
      '-c',
      'protocol.allow=never',
      '-c',
      'protocol.https.allow=always',
      '-c',
      'http.followRedirects=initial',
      '-c',
      'http.lowSpeedLimit=1',
      '-c',
      'http.lowSpeedTime=45',
      '-C',
      gitDirectory,
      'fetch',
      '--depth=1',
      '--no-tags',
      repository,
      `${options.commit}:refs/dsh/source-audit`,
    ], { deadline, gitExecutable })
    const fetched = (await runGit(
      ['-C', gitDirectory, 'rev-parse', 'refs/dsh/source-audit^{commit}'],
      { deadline, gitExecutable },
    )).toString('utf8').trim()
    if (fetched !== options.commit) throw new Error('fetched commit does not match the requested commit')
    return await auditGitCommitBefore(gitDirectory, fetched, deadline, gitExecutable)
  } finally {
    rmSync(gitDirectory, { recursive: true, force: true })
  }
}

function normalizeGitHubRepository(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('repository must be a canonical HTTPS GitHub URL')
  }
  if (
    url.protocol !== 'https:'
    || url.hostname !== 'github.com'
    || url.port !== ''
    || url.username !== ''
    || url.password !== ''
    || url.search !== ''
    || url.hash !== ''
  ) {
    throw new Error('repository must be a canonical HTTPS GitHub URL')
  }
  const segments = url.pathname.split('/').slice(1)
  if (
    segments.length !== 2
    || /\.git$/iu.test(segments[1] as string)
    || !GITHUB_OWNER_PATTERN.test(segments[0] as string)
    || !GITHUB_REPOSITORY_PATTERN.test(segments[1] as string)
    || segments[1] === '.'
    || segments[1] === '..'
    || segments.some((segment) => {
      if (segment.includes('%')) return true
      let decoded: string
      try {
        decoded = decodeURIComponent(segment)
      } catch {
        return true
      }
      return decoded.length === 0
        || decoded === '.'
        || decoded === '..'
        || decoded.includes('/')
        || decoded.includes('\\')
        || /[\u0000-\u001f\u007f]/u.test(decoded)
    })
  ) {
    throw new Error('repository must be a canonical HTTPS GitHub URL')
  }
  const canonical = `https://github.com/${segments.join('/')}`
  if (value !== canonical) throw new Error('repository must be a canonical HTTPS GitHub URL')
  return canonical
}

async function auditGitCommitBefore(
  gitDirectory: string,
  commit: string,
  deadline: number,
  gitExecutable: string,
): Promise<SourceContentAudit> {
  assertCommit(commit)
  const type = (await runGit(
    ['-C', gitDirectory, 'cat-file', '-t', commit],
    { deadline, gitExecutable },
  )).toString('utf8').trim()
  if (type !== 'commit') throw new Error(`${commit} must identify a commit, found ${type}`)

  const entries = parseTree(await runGit([
    '-C',
    gitDirectory,
    'ls-tree',
    '-r',
    '-z',
    '-l',
    '--full-tree',
    commit,
  ], { deadline, gitExecutable }))
  entries.sort((left, right) => Buffer.compare(left.path, right.path))

  const input = Buffer.from(`${entries.map(entry => entry.objectId).join('\n')}\n`)
  const blobs = entries.length === 0
    ? []
    : parseBatch(
      await runGit(['-C', gitDirectory, 'cat-file', '--batch'], {
        deadline,
        gitExecutable,
        input,
      }),
      entries,
    )
  const hash = createHash('sha256')
  hash.update(DIGEST_DOMAIN)
  for (const [index, entry] of entries.entries()) {
    const blob = blobs[index]
    if (blob === undefined) throw new Error('Git returned fewer blobs than requested')
    updateComponent(hash, Buffer.from(entry.mode))
    updateComponent(hash, Buffer.from(entry.type))
    updateComponent(hash, entry.path)
    updateComponent(hash, blob)
  }
  return {
    entryCount: entries.length,
    sourceContentSha256: hash.digest('hex'),
  }
}

function parseTree(output: Buffer): GitEntry[] {
  const entries: GitEntry[] = []
  let totalBytes = 0
  for (const record of splitBuffer(output, 0)) {
    if (record.length === 0) continue
    const tab = record.indexOf(0x09)
    if (tab < 0) throw new Error('malformed git ls-tree record')
    const header = /^(\d{6}) (blob|commit|tree) ([0-9a-f]+)\s+(\d+|-)$/u.exec(
      record.subarray(0, tab).toString('ascii'),
    )
    if (header === null) throw new Error('malformed git ls-tree header')
    const [, mode, type, objectId, sizeText] = header
    if (
      mode === undefined
      || type === undefined
      || objectId === undefined
      || sizeText === undefined
    ) {
      throw new Error('malformed git ls-tree header')
    }
    if (!SUPPORTED_MODES.has(mode) || type !== 'blob') {
      throw new Error(`unsupported Git entry ${mode} ${type}`)
    }
    const path = record.subarray(tab + 1)
    assertPortablePath(path)
    const size = Number(sizeText)
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('Git blob size is invalid')
    if (size > MAX_BLOB_BYTES) throw new Error('Git blob exceeds the source audit size limit')
    totalBytes += size
    if (totalBytes > MAX_TOTAL_BLOB_BYTES) {
      throw new Error('Git tree exceeds the source audit size limit')
    }
    entries.push({ mode, objectId, path, size, type })
  }
  return entries
}

function parseBatch(output: Buffer, entries: readonly GitEntry[]): Buffer[] {
  const blobs: Buffer[] = []
  let offset = 0
  for (const entry of entries) {
    const newline = output.indexOf(0x0a, offset)
    if (newline < 0) throw new Error('malformed git cat-file response')
    const header = output.subarray(offset, newline).toString('ascii').split(' ')
    const [objectId, type, sizeText] = header
    if (header.length !== 3 || objectId !== entry.objectId || type !== 'blob') {
      throw new Error('git cat-file returned an unexpected object')
    }
    const size = Number(sizeText)
    if (size !== entry.size) throw new Error('git cat-file blob size differs from ls-tree')
    const start = newline + 1
    const end = start + size
    if (end >= output.length || output[end] !== 0x0a) {
      throw new Error('git cat-file returned a truncated blob')
    }
    blobs.push(output.subarray(start, end))
    offset = end + 1
  }
  if (offset !== output.length) throw new Error('git cat-file returned trailing data')
  return blobs
}

function assertPortablePath(path: Buffer): void {
  let decoded: string
  try {
    decoded = utf8Decoder.decode(path)
  } catch {
    throw new Error('non-portable Git path is not valid UTF-8')
  }
  const segments = decoded.split('/')
  if (
    decoded.length === 0
    || decoded.startsWith('/')
    || decoded.includes('\\')
    || /[\u0000-\u001f\u007f]/u.test(decoded)
    || segments.some(segment => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`non-portable Git path ${JSON.stringify(decoded)}`)
  }
}

function splitBuffer(value: Buffer, delimiter: number): Buffer[] {
  const output: Buffer[] = []
  let offset = 0
  for (;;) {
    const next = value.indexOf(delimiter, offset)
    if (next < 0) {
      output.push(value.subarray(offset))
      return output
    }
    output.push(value.subarray(offset, next))
    offset = next + 1
  }
}

function updateComponent(hash: ReturnType<typeof createHash>, value: Buffer): void {
  const length = Buffer.allocUnsafe(8)
  length.writeBigUInt64BE(BigInt(value.length))
  hash.update(length)
  hash.update(value)
}

function deadlineFromTimeout(timeoutMs: number): number {
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`timeoutMs must be an integer between 1 and ${String(MAX_TIMEOUT_MS)}`)
  }
  return Date.now() + timeoutMs
}

function assertCommit(commit: string): void {
  if (!SHA1_PATTERN.test(commit)) throw new Error('commit must be a full lowercase SHA-1')
}

async function runGit(args: readonly string[], options: GitRunOptions): Promise<Buffer> {
  if (options.deadline <= Date.now()) throw new Error('Git source audit timed out')
  let result
  try {
    result = await runOwnedProcess(options.gitExecutable, args, {
      cwd: process.cwd(),
      deadline: options.deadline,
      env: gitAuditEnvironment(),
      maxOutputBytes: MAX_GIT_OUTPUT_BYTES,
      ...options.input === undefined ? {} : { input: options.input },
    })
  } catch {
    throw new Error('Git source audit failed')
  }
  if (result.timedOut) throw new Error('Git source audit timed out')
  if (result.exitCode !== 0) throw new Error('Git source audit failed')
  return result.stdout
}

function gitAuditEnvironment(): NodeJS.ProcessEnv {
  const env = Object.fromEntries(Object.entries(process.env).filter(([name, value]) =>
    value !== undefined
    && !name.toUpperCase().startsWith('GIT_')
    && !CREDENTIAL_ENV_PATTERN.test(name)
    && (GIT_LAUNCH_ENV_NAMES.has(name.toUpperCase()) || /^LC_[A-Z0-9_]+$/iu.test(name)),
  ))
  return {
    ...env,
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_TERMINAL_PROMPT: '0',
  }
}

interface AuditRequest {
  readonly candidateId?: string
  readonly catalogPath?: string
  readonly commit?: string
  readonly repository?: string
  readonly timeoutMs: number
}

/**
 * Parse the repository command arguments.
 * @param rawArgs - CLI arguments, optionally beginning with pnpm's `--` separator.
 * @returns one validated candidate or explicit repository audit request.
 */
export function parseAuditArgs(rawArgs: readonly string[]): AuditRequest {
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs
  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if (key === undefined || value === undefined || !key.startsWith('--')) {
      throw new Error('arguments must be --name value pairs')
    }
    if (values.has(key)) throw new Error(`duplicate argument ${key}`)
    values.set(key, value)
  }
  const known = new Set(['--candidate', '--catalog', '--commit', '--repository', '--timeout-ms'])
  for (const key of values.keys()) {
    if (!known.has(key)) throw new Error(`unknown argument ${key}`)
  }
  const timeoutValue = values.get('--timeout-ms')
  const timeoutMs = timeoutValue === undefined ? DEFAULT_TIMEOUT_MS : Number(timeoutValue)
  deadlineFromTimeout(timeoutMs)
  const candidateId = values.get('--candidate')
  const catalogPath = values.get('--catalog')
  const repositoryValue = values.get('--repository')
  const repository = repositoryValue === undefined
    ? undefined
    : normalizeGitHubRepository(repositoryValue)
  const commit = values.get('--commit')
  if (
    (candidateId === undefined && (repository === undefined || commit === undefined))
    || (candidateId !== undefined && (repository !== undefined || commit !== undefined))
  ) {
    throw new Error('use either --candidate ID or --repository URL --commit SHA')
  }
  return {
    ...(candidateId === undefined ? {} : { candidateId }),
    ...(catalogPath === undefined ? {} : { catalogPath }),
    ...(commit === undefined ? {} : { commit }),
    ...(repository === undefined ? {} : { repository }),
    timeoutMs,
  }
}

async function main(): Promise<void> {
  const request = parseAuditArgs(process.argv.slice(2))
  let candidateId: string | undefined
  let expected: string | undefined
  let repository = request.repository
  let commit = request.commit
  if (request.candidateId !== undefined) {
    const catalog = loadCuratedCatalog(request.catalogPath)
    const candidate = catalog.candidates.find(candidate => candidate.id === request.candidateId)
    if (candidate === undefined) throw new Error(`unknown curated candidate ${request.candidateId}`)
    if (candidate.sourceStatus !== 'verified' || candidate.sourceContentSha256 === undefined) {
      throw new Error(`curated candidate ${candidate.id} has no verified source digest`)
    }
    candidateId = candidate.id
    expected = candidate.sourceContentSha256
    repository = normalizeGitHubRepository(candidate.repository)
    commit = candidate.commit
  }
  if (repository === undefined || commit === undefined) throw new Error('audit source is incomplete')
  const result = await auditRepositorySource({
    commit,
    repository,
    timeoutMs: request.timeoutMs,
  })
  const matchesCatalog = expected === undefined ? undefined : expected === result.sourceContentSha256
  console.log(JSON.stringify({
    ...(candidateId === undefined ? {} : { candidateId }),
    commit,
    entryCount: result.entryCount,
    ...(matchesCatalog === undefined ? {} : { matchesCatalog }),
    repository,
    sourceContentSha256: result.sourceContentSha256,
  }))
  if (matchesCatalog === false) process.exitCode = 1
}

if (
  process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main().catch((error: unknown) => {
    console.error(`audit-curated-candidates: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}

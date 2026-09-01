import { createHash } from 'node:crypto'
import { load as loadYaml } from 'js-yaml'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  assertCuratedInstalledCandidateLocks,
  assertCuratedInstalledLocks,
  assertPnpmRegistryResolution,
  type CuratedCandidate,
  type CuratedCatalog,
} from '@deepseek-ai/dsh-curated-policy'

vi.mock('js-yaml', { spy: true })

const profileId = 'fixture-curated'
const commitA = '0123456789abcdef0123456789abcdef01234567'
const commitB = '89abcdef012345670123456789abcdef01234567'
const commitC = 'abcdef012345670123456789abcdef0123456789'
const npmIntegrity =
  'sha512-wmFfSlWDE3ujFuBSY1W8s2gERSotHD4ueelg5BJ5Hd2/ssB5x24xEaQdbMzNhoAaUjpXeIwfOUdn+nLqHjiYGQ=='
const registryIntegrity =
  'sha512-c+5BB/m0ivBv5rGOZ8BwrOM4G1GdWmfbETJ3yi1t0mtW8Ekztp+sw2oeR5FaUdRXHnMSrDP1ravS55VIziF6+w=='
const nestedIntegrity =
  'sha512-0P6ymzNH3V2O5GUV9qjshqj0NLxp842bUunB77jHzyZKRdA9u7eNSNvhFFePVK0w0zq+RWZh5FqGLI6fHVAsBw=='
const packageRecordIntegrity =
  'sha512-PcFJZUtg/h5yoH+/kkKZSH926HvmMNIlF1pM7vTRFg9TMrMui4HRPMSgdO4bT/4xp14mSEtJbZrK7Z6mLjI5Qg=='
const leafIntegrity =
  'sha512-7l4YxsJgDWOVNoJlPkbDTv4Y2p81Uq3obLYj4PgeA/QaxqJ2kjvNyVKRBsDruFsX6/tYWcFdPcrSGWqo11OrUw=='
const aliasIntegrity =
  'sha512-FV57CRDNcvEs2WubyvR820b6pbKG5T0vjmEoK9VDO8/JwdSeMSQG0vg0mRQLg3aGLMV8ez9GpTZX98fDuX4qxg=='
const scopedIntegrity =
  'sha512-RFd8Xwr7VWou8XIvKf5ax5oGjOnB4hBd/CuEnQA2NeBXvXDhTomt6tVAihd2a8FeFyzSuSB+Gk51ZOa7u7dW4w=='
const optionalIntegrity =
  'sha512-V4KNjkUTeOVk4+3c1QCz2hr8mmADxCdCmzCdpt8O9PD8HqRfmfWJ/k09u4IoXjMgp8giL3NjA+R3YCG7wWrAow=='
const mismatchedIntegrity =
  'sha512-We8KeiBr0LW4GKQRzqV1UNChUP8ihrh8ktn4MRJMsy8K/4E7GpQNadwzNOmDZuu52M7FLlCjE7zyF5sh6OknQw=='
const attackerIntegrity =
  'sha512-T/DnlFNOqnPK4DEDvgR9dtCHq7Y4Ta8AcybPz8jAZmRqS8evNjvqNFFwHMx2OqdhUv6QFWRQZpkkUkOPDqyFXw=='
const emptyClosureSha = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const fixtureClosureSha = '2e121ef7ad42d31ab8c2eb094495d4615f50014d44ef22623a085b9b9c09267c'
const fixtureTreeSha = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const nonRegistryResolutions = [
  ['directory type', { type: 'directory', directory: '../plugin-a' }],
  ['file type', { type: 'file', tarball: 'file:../plugin-a.tgz' }],
  ['non-registry tarball', { tarball: 'https://example.com/plugin-a.tgz' }],
  ['local directory field', { directory: '../plugin-a' }],
] as const

interface LockDependency {
  specifier: string
  version: string
}

interface LockPackageRecord {
  resolution: Record<string, unknown>
  version?: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

interface LockSnapshot extends Record<string, unknown> {
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

interface FixtureLock extends Record<string, unknown> {
  lockfileVersion: string
  importers: {
    '.': {
      dependencies: Record<string, LockDependency>
    }
  }
  packages: Record<string, LockPackageRecord>
  snapshots: Record<string, LockSnapshot>
  settings?: Record<string, unknown>
}

interface GitMismatchArrangement {
  readonly manifest?: { readonly 'plugin-git': string }
  readonly mutate?: (lock: FixtureLock) => void
}

function candidate(overrides: Partial<CuratedCandidate> = {}): CuratedCandidate {
  return {
    id: 'plugin-a',
    priority: 'P0',
    capability: 'fixture',
    repository: 'https://github.com/example/plugin-a',
    repositoryPath: null,
    commit: commitA,
    sourceStatus: 'verified',
    auditedAt: '2026-08-30',
    manifestPath: 'package.json',
    expectedPackage: 'plugin-a',
    nodeEngine: '>=24',
    nodeEngineEvidence: 'package.json#engines.node',
    requiresCorePatch: false,
    license: 'MIT',
    bundlePatch: './cordis.patch.yml',
    sourceContentSha256: '12'.repeat(32),
    treeSha256: fixtureTreeSha,
    runtimeDependencyClosureSha256: emptyClosureSha,
    npmVersion: '1.0.0',
    npmIntegrity,
    testFiles: 1,
    ciWorkflows: 1,
    installScripts: {},
    externalDependencies: [],
    requiredRuntimeBundles: [],
    networkAccess: [],
    credentials: [],
    targetProfiles: [profileId],
    active: true,
    auditWarnings: [],
    rejections: [],
    scoreDimensions: {
      nativeCompatibility: 20,
      functionalCompleteness: 15,
      testAndCi: 15,
      securityAndPrivacy: 15,
      maintenanceHealth: 10,
      performanceCost: 10,
      operability: 10,
      communitySignal: 5,
    },
    score: 100,
    ...overrides,
  }
}

function catalog(candidates: readonly CuratedCandidate[]): CuratedCatalog {
  return {
    schemaVersion: 2,
    source: {
      awesome: {
        repository: 'https://github.com/example/catalog',
        commit: commitA,
        file: 'README.md',
      },
      matrix: 'matrix.md',
    },
    candidates,
  }
}

function bytes(value: unknown): Uint8Array {
  return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
}

function npmLock(
  packageName = 'plugin-a',
  version = '1.0.0',
  integrity = npmIntegrity,
): FixtureLock {
  return {
    lockfileVersion: '9.0',
    importers: {
      '.': {
        dependencies: {
          [packageName]: {
            specifier: version,
            version,
          },
        },
      },
    },
    packages: {
      [`${packageName}@${version}`]: {
        resolution: { integrity },
      },
    },
    snapshots: {
      [`${packageName}@${version}`]: {},
    },
  }
}

function assertLocks(
  candidates: readonly CuratedCandidate[],
  manifestDependencies: Readonly<Record<string, string>>,
  rootLock: unknown,
  installedLock: unknown = rootLock,
) {
  return assertCuratedInstalledLocks({
    catalog: catalog(candidates),
    profileId,
    manifestDependencies,
    rootLock: bytes(rootLock),
    installedLock: bytes(installedLock),
  })
}

function gitCandidate(overrides: Partial<CuratedCandidate> = {}): CuratedCandidate {
  const {
    npmVersion: _npmVersion,
    npmIntegrity: _npmIntegrity,
    ...git
  } = candidate({
    id: 'plugin-git',
    expectedPackage: 'plugin-git',
    repository: 'https://github.com/example/plugin-git',
    repositoryPath: 'packages/plugin',
    commit: commitB,
    ...overrides,
  })
  return git
}

function directGitSpec(
  repository = 'https://github.com/example/plugin-git',
  commit = commitB,
  repositoryPath: string | null = 'packages/plugin',
): string {
  return `git+${repository}.git#${commit}${repositoryPath === null ? '' : `&path:${repositoryPath}`}`
}

function gitLock(options: {
  readonly importerVersion?: string
  readonly packageVersion?: string
  readonly resolution?: Readonly<Record<string, unknown>>
} = {}): FixtureLock {
  const specifier = directGitSpec()
  const importerVersion = options.importerVersion ?? specifier
  return {
    lockfileVersion: '9.0',
    importers: {
      '.': {
        dependencies: {
          'plugin-git': {
            specifier,
            version: importerVersion,
          },
        },
      },
    },
    packages: {
      [`plugin-git@${importerVersion}`]: {
        resolution: options.resolution ?? {
          type: 'git',
          repo: 'https://github.com/example/plugin-git.git',
          commit: commitB,
          path: 'packages/plugin',
        },
        version: options.packageVersion ?? '2.0.0',
      },
    },
    snapshots: {
      [`plugin-git@${importerVersion}`]: {},
    },
  }
}

function closureLock(): FixtureLock {
  const gitLocator = `git+https://github.com/example/git-dep.git#${commitC}`
  const gitTarball = `https://codeload.github.com/example/git-tar-dep/tar.gz/${commitB}`
  return {
    lockfileVersion: '9.0',
    importers: {
      '.': {
        dependencies: {
          'plugin-a': {
            specifier: '1.0.0',
            version: '1.0.0(peer-dep@1.0.0)',
          },
        },
      },
    },
    packages: {
      'plugin-a@1.0.0': {
        resolution: { integrity: npmIntegrity },
      },
      'registry-dep@2.0.0': {
        resolution: { integrity: registryIntegrity },
      },
      'nested-dep@3.0.0': {
        resolution: { integrity: nestedIntegrity },
      },
      'package-record-dep@4.0.0': {
        resolution: { integrity: packageRecordIntegrity },
        dependencies: {
          'leaf-dep': '5.0.0',
        },
      },
      'leaf-dep@5.0.0': {
        resolution: { integrity: leafIntegrity },
      },
      'js-yaml@4.1.0': {
        resolution: { integrity: aliasIntegrity },
      },
      '@scope/target@2.0.0': {
        resolution: { integrity: scopedIntegrity },
      },
      'optional-target@3.0.0': {
        resolution: { integrity: optionalIntegrity },
      },
      [`git-dep@${gitLocator}`]: {
        resolution: {
          type: 'git',
          repo: 'https://github.com/example/git-dep.git',
          commit: commitC,
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
      'plugin-a@1.0.0(peer-dep@1.0.0)': {
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
      'nested-dep@3.0.0': {
        dependencies: {
          'registry-dep': '2.0.0(peer-dep@1.0.0)',
        },
      },
      'leaf-dep@5.0.0': {},
      'js-yaml@4.1.0': {},
      '@scope/target@2.0.0(peer-dep@1.0.0)': {},
      'optional-target@3.0.0': {},
      [`git-dep@${gitLocator}`]: {},
      [`git-tar-dep@${gitTarball}`]: {},
    },
  }
}

function dependency(lock: FixtureLock, name: string): LockDependency {
  return lock.importers['.'].dependencies[name] as LockDependency
}

function packageRecord(lock: FixtureLock, key: string): LockPackageRecord {
  return lock.packages[key] as LockPackageRecord
}

function snapshot(lock: FixtureLock, key: string): LockSnapshot {
  return lock.snapshots[key] as LockSnapshot
}

beforeEach(() => {
  vi.mocked(loadYaml).mockClear()
})

describe('assertCuratedInstalledLocks', () => {
  test('accepts an empty profile from minimal locks and parses each lock once', () => {
    const lock = "lockfileVersion: '9.0'\nimporters:\n  '.': {}\ncycle: &cycle\n  self: *cycle\n"

    const identities = assertLocks([], {}, lock)

    expect(identities).toEqual([])
    expect(Object.isFrozen(identities)).toBe(true)
    expect(loadYaml).toHaveBeenCalledTimes(2)
  })

  test('rejects a present non-map dependency table for an empty profile', () => {
    const lock = {
      lockfileVersion: '9.0',
      importers: { '.': { dependencies: [] } },
    }

    expect(() => assertLocks([], {}, lock)).toThrow('dependencies must be an object')
  })

  test('returns frozen npm identities in catalog order and accepts a peer suffix', () => {
    const first = candidate({
      id: 'first',
      expectedPackage: 'first',
      npmVersion: '1.0.0',
    })
    const second = candidate({
      id: 'second',
      expectedPackage: 'second',
      npmVersion: '2.0.0',
      runtimeDependencyClosureSha256:
        '64b9e26c42482cb52aaf27befdc7bd506ec7ec57ea730da872f09cdda0a7196c',
    })
    const lock = {
      lockfileVersion: '9.0',
      importers: {
        '.': {
          dependencies: {
            second: { specifier: '2.0.0', version: '2.0.0(peer@1.0.0)' },
            first: { specifier: '1.0.0', version: '1.0.0' },
          },
        },
      },
      packages: {
        'first@1.0.0': { resolution: { integrity: npmIntegrity } },
        'second@2.0.0': { resolution: { integrity: npmIntegrity } },
      },
      snapshots: {
        'first@1.0.0': {},
        'second@2.0.0(peer@1.0.0)': {},
      },
    }

    const identities = assertLocks(
      [first, second],
      { second: '2.0.0', first: '1.0.0' },
      lock,
    )

    expect(identities).toEqual([
      {
        candidateId: 'first',
        packageName: 'first',
        packageVersion: '1.0.0',
        source: { kind: 'npm', version: '1.0.0', integrity: npmIntegrity },
        runtimeDependencyClosureSha256: emptyClosureSha,
        treeSha256: fixtureTreeSha,
      },
      {
        candidateId: 'second',
        packageName: 'second',
        packageVersion: '2.0.0',
        source: { kind: 'npm', version: '2.0.0', integrity: npmIntegrity },
        runtimeDependencyClosureSha256:
          '64b9e26c42482cb52aaf27befdc7bd506ec7ec57ea730da872f09cdda0a7196c',
        treeSha256: fixtureTreeSha,
      },
    ])
    expect(Object.isFrozen(identities)).toBe(true)
    expect(Object.isFrozen(identities[0])).toBe(true)
    expect(Object.isFrozen(identities[0]?.source)).toBe(true)
  })

  test('admits one candidate without inspecting unrelated importer dependencies', () => {
    const lock = npmLock()
    const selectedCandidate = { ...candidate(), expectedPackage: 'plugin-a' }
    lock.importers['.'].dependencies.unrelated = {
      specifier: '2.0.0',
      version: 'missing-package-record',
    }

    expect(assertCuratedInstalledCandidateLocks({
      candidate: selectedCandidate,
      manifestSpecifier: '1.0.0',
      rootLock: bytes(lock),
      installedLock: bytes(lock),
    })).toMatchObject({
      candidateId: 'plugin-a',
      packageName: 'plugin-a',
      packageVersion: '1.0.0',
    })
  })

  test('rejects different npm peer resolutions between root and installed locks', () => {
    const root = npmLock()
    dependency(root, 'plugin-a').version = '1.0.0(peer@1.0.0)'
    root.snapshots['plugin-a@1.0.0(peer@1.0.0)'] = {}
    delete root.snapshots['plugin-a@1.0.0']
    const installed = structuredClone(root)
    dependency(installed, 'plugin-a').version = '1.0.0(peer@2.0.0)'
    installed.snapshots['plugin-a@1.0.0(peer@2.0.0)'] = {}
    delete installed.snapshots['plugin-a@1.0.0(peer@1.0.0)']

    expect(() => assertLocks(
      [candidate()],
      { 'plugin-a': '1.0.0' },
      root,
      installed,
    )).toThrow('root and installed pnpm resolutions differ')
  })

  test('rejects an npm candidate when either lock record carries Git provenance', () => {
    const root = npmLock()
    const installed = structuredClone(root)
    Object.assign(packageRecord(installed, 'plugin-a@1.0.0').resolution, {
      type: 'git',
      repo: 'https://github.com/example/plugin-a.git',
      commit: commitA,
    })

    expect(() => assertLocks(
      [candidate()],
      { 'plugin-a': '1.0.0' },
      root,
      installed,
    )).toThrow('installed plugin-a pnpm package resolution must be registry')

    Object.assign(packageRecord(root, 'plugin-a@1.0.0').resolution, {
      gitHosted: true,
      tarball: `https://codeload.github.com/example/plugin-a/tar.gz/${commitA}`,
    })
    expect(() => assertLocks(
      [candidate()],
      { 'plugin-a': '1.0.0' },
      root,
    )).toThrow('root plugin-a pnpm package resolution must be registry')
  })

  test.each(nonRegistryResolutions)(
    'rejects direct npm resolution with %s provenance',
    (_name, provenance) => {
      const lock = npmLock()
      Object.assign(packageRecord(lock, 'plugin-a@1.0.0').resolution, provenance)

      expect(() => assertLocks(
        [candidate()],
        { 'plugin-a': '1.0.0' },
        lock,
      )).toThrow('root plugin-a pnpm package resolution must be registry')
    },
  )

  test.each(nonRegistryResolutions)(
    'rejects transitive npm resolution with %s provenance',
    (_name, provenance) => {
      const lock = closureLock()
      Object.assign(packageRecord(lock, 'registry-dep@2.0.0').resolution, provenance)

      expect(() => assertLocks(
        [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
        { 'plugin-a': '1.0.0' },
        lock,
      )).toThrow(
        'root plugin-a registry-dep runtime dependency resolution must be registry',
      )
    },
  )

  test.each([
    ['non-string', 1],
    ['malformed URL', 'not-a-url'],
    ['non-HTTPS URL', 'http://registry.npmjs.org/plugin-a/-/plugin-a-1.0.0.tgz'],
    ['non-registry host', 'https://example.com/plugin-a/-/plugin-a-1.0.0.tgz'],
    ['explicit port', 'https://registry.npmjs.org:444/plugin-a/-/plugin-a-1.0.0.tgz'],
    ['username', 'https://user@registry.npmjs.org/plugin-a/-/plugin-a-1.0.0.tgz'],
    ['password', 'https://user:pass@registry.npmjs.org/plugin-a/-/plugin-a-1.0.0.tgz'],
    ['query', 'https://registry.npmjs.org/plugin-a/-/plugin-a-1.0.0.tgz?download=1'],
    ['fragment', 'https://registry.npmjs.org/plugin-a/-/plugin-a-1.0.0.tgz#archive'],
    ['missing package marker', 'https://registry.npmjs.org/plugin-a/plugin-a-1.0.0.tgz'],
    ['non-tarball suffix', 'https://registry.npmjs.org/plugin-a/-/plugin-a-1.0.0.zip'],
  ])('rejects a registry resolution with a %s tarball', (_name, tarball) => {
    expect(() => {
      assertPnpmRegistryResolution(
        { integrity: npmIntegrity, tarball },
        'fixture resolution',
      )
    }).toThrow('fixture resolution must be registry')
  })

  test('accepts the canonical npm registry tarball form', () => {
    expect(() => {
      assertPnpmRegistryResolution({
        integrity: npmIntegrity,
        tarball: 'https://registry.npmjs.org/plugin-a/-/plugin-a-1.0.0.tgz',
      }, 'fixture resolution')
    }).not.toThrow()
  })

  test('requires the exact direct peer-suffixed snapshot', () => {
    const lock = npmLock()
    dependency(lock, 'plugin-a').version = '1.0.0(peer@2.0.0)'

    expect(() => assertLocks(
      [candidate()],
      { 'plugin-a': '1.0.0' },
      lock,
    )).toThrow('root plugin-a plugin-a@1.0.0(peer@2.0.0) snapshot is missing')
  })

  test('binds a matching direct peer resolution into the catalog closure digest', () => {
    const lock = npmLock()
    dependency(lock, 'plugin-a').version = '1.0.0(peer@2.0.0)'
    lock.snapshots['plugin-a@1.0.0(peer@2.0.0)'] = {}
    delete lock.snapshots['plugin-a@1.0.0']

    expect(() => assertLocks(
      [candidate()],
      { 'plugin-a': '1.0.0' },
      lock,
    )).toThrow('runtime dependency closure SHA-256 differs from the catalog')
  })

  test('requires selected candidates to exactly match manifest dependencies', () => {
    const lock = { lockfileVersion: '9.0', importers: { '.': {} } }
    expect(() => assertLocks([candidate()], {}, lock)).toThrow(
      'selected candidate dependencies must exactly match manifest dependencies',
    )
  })

  test('rejects an active profile candidate without a package identity', () => {
    const lock = { lockfileVersion: '9.0', importers: { '.': {} } }

    expect(() => assertLocks(
      [candidate({ expectedPackage: null })],
      {},
      lock,
    )).toThrow('plugin-a active candidate assigned to profile fixture-curated must declare expectedPackage')
  })

  test.each([
    ['root', true],
    ['installed', false],
  ] as const)('rejects invalid %s lock YAML', (label, rootInvalid) => {
    const lock = npmLock()
    expect(() => assertLocks(
      [candidate()],
      { 'plugin-a': '1.0.0' },
      rootInvalid ? '[' : lock,
      rootInvalid ? lock : '[',
    )).toThrow(`${label} pnpm lockfile must be valid YAML`)
  })

  test.each([
    ['version', 'npmVersion'],
    ['integrity', 'npmIntegrity'],
  ] as const)('rejects an npm source missing its %s', (_name, field) => {
    const incomplete = candidate()
    Reflect.deleteProperty(incomplete, field)
    expect(() => assertLocks(
      [incomplete],
      { 'plugin-a': '1.0.0' },
      npmLock(),
    )).toThrow('catalog install source is incomplete')
  })

  test.each([
    ['non-exact version', { npmVersion: 'latest' }],
    ['invalid integrity', { npmIntegrity: 'sha512-invalid' }],
    ['missing integrity prefix', { npmIntegrity: 'invalid' }],
  ] as const)('rejects a catalog npm source with %s', (_name, overrides) => {
    expect(() => assertLocks(
      [candidate(overrides)],
      { 'plugin-a': '1.0.0' },
      npmLock(),
    )).toThrow('catalog npm source must use an exact version and SHA-512 integrity')
  })

  test('requires the profile npm specifier to equal the catalog version', () => {
    expect(() => assertLocks(
      [candidate()],
      { 'plugin-a': '1.0.1' },
      npmLock('plugin-a', '1.0.1'),
    )).toThrow('profile dependency must use exact npm version 1.0.0')
  })

  test('accepts direct Git and commit-addressed codeload identities with repository paths', () => {
    const direct = gitCandidate()
    const codeloadCandidate = gitCandidate({
      id: 'plugin-codeload',
      expectedPackage: 'plugin-codeload',
      repository: 'https://github.com/example/plugin-codeload',
      repositoryPath: 'packages/codeload',
      commit: commitC,
    })
    const directSpec = directGitSpec()
    const codeloadSpec =
      `git+https://github.com/example/plugin-codeload.git#${commitC}&path:packages/codeload`
    const codeloadTarball =
      `https://codeload.github.com/example/plugin-codeload/tar.gz/${commitC}`
    const codeloadVersion = `${codeloadTarball}#path:packages/codeload`
    const lock = gitLock()
    lock.importers['.'].dependencies['plugin-codeload'] = {
      specifier: codeloadSpec,
      version: codeloadVersion,
    }
    lock.packages[`plugin-codeload@${codeloadVersion}`] = {
      resolution: {
        gitHosted: true,
        tarball: codeloadTarball,
        path: 'packages/codeload',
      },
      version: '3.0.0',
    }
    lock.snapshots[`plugin-codeload@${codeloadVersion}`] = {}

    expect(assertLocks(
      [direct, codeloadCandidate],
      { 'plugin-git': directSpec, 'plugin-codeload': codeloadSpec },
      lock,
    )).toEqual([
      {
        candidateId: 'plugin-git',
        packageName: 'plugin-git',
        packageVersion: '2.0.0',
        source: {
          kind: 'git',
          repository: 'https://github.com/example/plugin-git',
          commit: commitB,
          repositoryPath: 'packages/plugin',
        },
        runtimeDependencyClosureSha256: emptyClosureSha,
        treeSha256: fixtureTreeSha,
      },
      {
        candidateId: 'plugin-codeload',
        packageName: 'plugin-codeload',
        packageVersion: '3.0.0',
        source: {
          kind: 'git',
          repository: 'https://github.com/example/plugin-codeload',
          commit: commitC,
          repositoryPath: 'packages/codeload',
        },
        runtimeDependencyClosureSha256: emptyClosureSha,
        treeSha256: fixtureTreeSha,
      },
    ])
  })

  test('accepts a peer suffix on a direct Git locator while binding its snapshot', () => {
    const specifier = directGitSpec()
    const version = `${specifier}(peer-dep@1.0.0)`
    const lock = gitLock({ importerVersion: version })
    lock.packages[`plugin-git@${specifier}`] = lock.packages[`plugin-git@${version}`] as LockPackageRecord
    delete lock.packages[`plugin-git@${version}`]
    const digest = createHash('sha256')
    const identity = Buffer.from(`plugin-git@${version}\0direct`)
    digest.update(`${String(identity.byteLength)}:`)
    digest.update(identity)

    expect(assertLocks(
      [gitCandidate({ runtimeDependencyClosureSha256: digest.digest('hex') })],
      { 'plugin-git': specifier },
      lock,
    )[0]).toMatchObject({
      packageVersion: '2.0.0',
      source: {
        kind: 'git',
        repository: 'https://github.com/example/plugin-git',
        commit: commitB,
        repositoryPath: 'packages/plugin',
      },
    })
  })

  test('rejects direct and codeload Git resolution kind mismatches', () => {
    const direct = gitLock()
    packageRecord(direct, `plugin-git@${directGitSpec()}`).resolution.type = 'registry'
    expect(() => assertLocks(
      [gitCandidate()],
      { 'plugin-git': directGitSpec() },
      direct,
    )).toThrow('pnpm package resolution must be Git')

    const codeloadCandidate = gitCandidate({ repositoryPath: null })
    const codeloadTarball = `https://codeload.github.com/example/plugin-git/tar.gz/${commitB}`
    const codeloadSpec = `git+https://github.com/example/plugin-git.git#${commitB}`
    const codeloadVersion = codeloadTarball
    const codeload = gitLock()
    codeload.importers['.'].dependencies['plugin-git'] = {
      specifier: codeloadSpec,
      version: codeloadVersion,
    }
    delete codeload.packages[`plugin-git@${directGitSpec()}`]
    delete codeload.snapshots[`plugin-git@${directGitSpec()}`]
    codeload.packages[`plugin-git@${codeloadVersion}`] = {
      resolution: { gitHosted: false, tarball: codeloadTarball },
      version: '2.0.0',
    }
    codeload.snapshots[`plugin-git@${codeloadVersion}`] = {}
    expect(() => assertLocks(
      [codeloadCandidate],
      { 'plugin-git': codeloadSpec },
      codeload,
    )).toThrow('pnpm package resolution must match the GitHub codeload URL')
  })

  test.each([
    'not-a-url',
    'https://github.com/example/plugin-git?secret=value',
    'https://github.com/example/plugin-git.GIT',
    'https://github.com/example',
    'https://GITHUB.com/example/plugin-git',
  ])('rejects non-canonical catalog Git repository %s', (repository) => {
    expect(() => assertLocks(
      [gitCandidate({ repository })],
      { 'plugin-git': directGitSpec() },
      gitLock(),
    )).toThrow('Git repository must be a canonical HTTPS GitHub URL')
  })

  test('rejects malformed Git importer resolutions', () => {
    const mismatch = gitLock()
    dependency(mismatch, 'plugin-git').version = directGitSpec(undefined, commitC)
    expect(() => assertLocks(
      [gitCandidate()],
      { 'plugin-git': directGitSpec() },
      mismatch,
    )).toThrow('pnpm dependency version differs from the profile manifest')

    const malformed = gitLock()
    dependency(malformed, 'plugin-git').version = 'main'
    expect(() => assertLocks(
      [gitCandidate()],
      { 'plugin-git': directGitSpec() },
      malformed,
    )).toThrow('must use direct Git or GitHub codeload with a full commit SHA')
  })

  test('accepts a repository-root Git package and lockfiles without snapshot tables', () => {
    const specifier = directGitSpec(undefined, undefined, null)
    const lock = gitLock()
    const oldKey = `plugin-git@${directGitSpec()}`
    const record = packageRecord(lock, oldKey)
    delete record.resolution.path
    Reflect.deleteProperty(lock.packages, oldKey)
    Reflect.deleteProperty(lock.snapshots, oldKey)
    lock.importers['.'].dependencies['plugin-git'] = { specifier, version: specifier }
    lock.packages[`plugin-git@${specifier}`] = record
    delete (lock as { snapshots?: Record<string, LockSnapshot> }).snapshots

    expect(assertLocks(
      [gitCandidate({ repositoryPath: null })],
      { 'plugin-git': specifier },
      lock,
    )[0]).toMatchObject({
      source: { kind: 'git', repositoryPath: null },
    })
  })

  test('rejects malformed Git declarations and empty installed versions', () => {
    const malformedDeclaration = gitLock()
    dependency(malformedDeclaration, 'plugin-git').specifier = 'main'
    expect(() => assertLocks(
      [gitCandidate()],
      { 'plugin-git': 'main' },
      malformedDeclaration,
    )).toThrow('profile dependency must use a full Git commit SHA')

    const emptyVersion = gitLock()
    dependency(emptyVersion, 'plugin-git').version = ''
    expect(() => assertLocks(
      [gitCandidate()],
      { 'plugin-git': directGitSpec() },
      emptyVersion,
    )).toThrow('pnpm dependency version must be a non-empty string')
  })

  test.each([
    ['root lock version', (lock: FixtureLock) => { lock.lockfileVersion = '8.0' }, false, 'lockfile version'],
    ['installed lock version', (lock: FixtureLock) => { lock.lockfileVersion = '8.0' }, true, 'lockfile version'],
    ['importer dependency name', (lock: FixtureLock) => {
      lock.importers['.'].dependencies.other = dependency(lock, 'plugin-a')
      delete lock.importers['.'].dependencies['plugin-a']
    }, false, 'dependency names'],
    ['importer specifier', (lock: FixtureLock) => {
      dependency(lock, 'plugin-a').specifier = '1.0.1'
    }, true, 'specifier'],
    ['importer version', (lock: FixtureLock) => {
      dependency(lock, 'plugin-a').version = '1.0.1'
    }, true, 'dependency version'],
    ['npm package record', (lock: FixtureLock) => {
      delete lock.packages['plugin-a@1.0.0']
    }, false, 'package resolution'],
    ['npm SRI', (lock: FixtureLock) => {
      packageRecord(lock, 'plugin-a@1.0.0').resolution.integrity = 'sha512-bWlzbWF0Y2g='
    }, true, 'integrity'],
  ])('rejects %s mismatch', (_name, mutate, installedOnly, message) => {
    const root = npmLock()
    const installed = structuredClone(root)
    mutate(installedOnly ? installed : root)

    expect(() => assertLocks(
      [candidate()],
      { 'plugin-a': '1.0.0' },
      root,
      installed,
    )).toThrow(message)
  })

  test.each([
    ['manifest dependency name', { other: '1.0.0' }, 'dependency names'],
    ['manifest dependency specifier', { 'plugin-a': '1.0.1' }, 'specifier'],
    ['extra manifest dependency', { 'plugin-a': '1.0.0', extra: '2.0.0' }, 'dependency names'],
  ])('rejects %s mismatch', (_name, manifestDependencies, message) => {
    expect(() => assertLocks(
      [candidate()],
      manifestDependencies,
      npmLock(),
    )).toThrow(message)
  })

  test.each([
    ['overrides', (lock: FixtureLock) => { lock.overrides = {} }, 'overrides'],
    ['patchedDependencies', (lock: FixtureLock) => { lock.patchedDependencies = {} }, 'patchedDependencies'],
    ['packageExtensions', (lock: FixtureLock) => { lock.packageExtensions = {} }, 'packageExtensions'],
    ['settings overrides', (lock: FixtureLock) => { lock.settings = { overrides: {} } }, 'overrides'],
    ['package extensions checksum', (lock: FixtureLock) => {
      lock.settings = { packageExtensionsChecksum: 'fixture' }
    }, 'packageExtensionsChecksum'],
    ['pnpmfile checksum', (lock: FixtureLock) => {
      lock.settings = { pnpmfileChecksum: 'fixture' }
    }, 'pnpmfileChecksum'],
    ['patch hash key', (lock: FixtureLock) => {
      snapshot(lock, 'plugin-a@1.0.0')['plugin-a@1.0.0(patch_hash=fixture)'] = {}
    }, 'patched dependency locators'],
    ['patch hash value', (lock: FixtureLock) => {
      snapshot(lock, 'plugin-a@1.0.0').value = 'plugin-a@1.0.0(patch_hash=fixture)'
    }, 'patched dependency locators'],
    ['patch hash array value', (lock: FixtureLock) => {
      lock.patchList = ['plugin-a@1.0.0(patch_hash=fixture)']
    }, 'patched dependency locators'],
  ])('rejects %s in either lock', (_name, mutate, message) => {
    for (const installedOnly of [false, true]) {
      const root = npmLock()
      const installed = structuredClone(root)
      mutate(installedOnly ? installed : root)
      expect(() => assertLocks(
        [candidate()],
        { 'plugin-a': '1.0.0' },
        root,
        installed,
      )).toThrow(message)
    }
  })

  test.each([
    ['manifest repository', () => ({
      manifest: { 'plugin-git': directGitSpec('https://github.com/example/other') },
    }), 'catalog repository'],
    ['manifest commit', () => ({
      manifest: { 'plugin-git': directGitSpec(undefined, commitC) },
    }), 'catalog repository, commit, or package path'],
    ['manifest path', () => ({
      manifest: { 'plugin-git': directGitSpec(undefined, undefined, 'packages/other') },
    }), 'catalog repository, commit, or package path'],
    ['resolution repository', () => ({
      mutate: (lock: FixtureLock) => {
        packageRecord(lock, `plugin-git@${directGitSpec()}`).resolution.repo =
          'https://github.com/example/other.git'
      },
    }), 'resolution repository, commit, or path'],
    ['resolution commit', () => ({
      mutate: (lock: FixtureLock) => {
        packageRecord(lock, `plugin-git@${directGitSpec()}`).resolution.commit = commitC
      },
    }), 'resolution repository, commit, or path'],
    ['resolution path', () => ({
      mutate: (lock: FixtureLock) => {
        packageRecord(lock, `plugin-git@${directGitSpec()}`).resolution.path = 'packages/other'
      },
    }), 'resolution repository, commit, or path'],
    ['package version', () => ({
      mutate: (lock: FixtureLock) => {
        packageRecord(lock, `plugin-git@${directGitSpec()}`).version = '2.0.1'
      },
    }), 'root and installed pnpm resolutions differ'],
  ])('rejects Git %s mismatch', (_name, arrange, message) => {
    const root = gitLock()
    const installed = structuredClone(root)
    const configured = arrange() as GitMismatchArrangement
    if (configured.manifest !== undefined) {
      dependency(root, 'plugin-git').specifier = configured.manifest['plugin-git']
      dependency(installed, 'plugin-git').specifier = configured.manifest['plugin-git']
    }
    configured.mutate?.(installed)

    expect(() => assertLocks(
      [gitCandidate()],
      configured.manifest ?? { 'plugin-git': directGitSpec() },
      root,
      installed,
    )).toThrow(message)
  })

  test('traverses dependency fields, aliases, peer suffixes, Git nodes, and cycles', () => {
    const lock = closureLock()

    const identities = assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      lock,
    )

    expect(identities[0]?.runtimeDependencyClosureSha256).toBe(fixtureClosureSha)
  })

  test('rejects different transitive peer environments between root and installed locks', () => {
    const root = closureLock()
    const installed = structuredClone(root)
    const rootSnapshot = snapshot(installed, 'registry-dep@2.0.0(peer-dep@1.0.0)')
    const dependencies = snapshot(
      installed,
      'plugin-a@1.0.0(peer-dep@1.0.0)',
    ).dependencies as Record<string, string>
    dependencies['registry-dep'] = '2.0.0(peer-dep@2.0.0)'
    installed.snapshots['registry-dep@2.0.0(peer-dep@2.0.0)'] = rootSnapshot
    const nestedDependencies = snapshot(installed, 'nested-dep@3.0.0').dependencies as Record<string, string>
    nestedDependencies['registry-dep'] = '2.0.0(peer-dep@2.0.0)'
    delete installed.snapshots['registry-dep@2.0.0(peer-dep@1.0.0)']

    expect(() => assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      root,
      installed,
    )).toThrow('plugin-a root and installed pnpm runtime dependency closures differ')
  })

  test('requires the exact transitive peer-suffixed snapshot', () => {
    const lock = closureLock()
    lock.snapshots['registry-dep@2.0.0'] =
      lock.snapshots['registry-dep@2.0.0(peer-dep@1.0.0)'] as LockSnapshot
    delete lock.snapshots['registry-dep@2.0.0(peer-dep@1.0.0)']

    expect(() => assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      lock,
    )).toThrow(
      'root plugin-a registry-dep@2.0.0(peer-dep@1.0.0) snapshot is missing',
    )
  })

  test('rejects a transitive GitHub codeload resolution path that differs from its locator', () => {
    const lock = closureLock()
    const tarball = `https://codeload.github.com/example/git-tar-dep/tar.gz/${commitB}`
    const locator = `${tarball}#path:packages/expected`
    const dependencies = snapshot(
      lock,
      'plugin-a@1.0.0(peer-dep@1.0.0)',
    ).dependencies as Record<string, string>
    dependencies['git-tar-dep'] = locator
    const record = packageRecord(lock, `git-tar-dep@${tarball}`)
    record.resolution.path = 'packages/attacker'
    delete lock.packages[`git-tar-dep@${tarball}`]
    lock.packages[`git-tar-dep@${locator}`] = record
    delete lock.snapshots[`git-tar-dep@${tarball}`]
    lock.snapshots[`git-tar-dep@${locator}`] = {}

    expect(() => assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      lock,
    )).toThrow(
      'root plugin-a git-tar-dep runtime Git dependency differs from its resolution path',
    )
  })

  test('identifies the lock and candidate in transitive closure diagnostics', () => {
    const root = closureLock()
    const installed = structuredClone(root)
    delete installed.packages['nested-dep@3.0.0']

    expect(() => assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      root,
      installed,
    )).toThrow('installed plugin-a nested-dep@3.0.0 runtime dependency is unresolved')

    packageRecord(installed, 'registry-dep@2.0.0').resolution.integrity = undefined
    installed.packages['nested-dep@3.0.0'] = packageRecord(root, 'nested-dep@3.0.0')
    expect(() => assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      root,
      installed,
    )).toThrow(
      'installed plugin-a registry-dep runtime dependency registry resolution must declare exact integrity',
    )
  })

  test.each([
    ['unsupported algorithm', `sha1-${Buffer.alloc(20, 1).toString('base64')}`],
    ['wrong sha256 length', `sha256-${Buffer.alloc(31, 1).toString('base64')}`],
    ['wrong sha384 length', `sha384-${Buffer.alloc(47, 2).toString('base64')}`],
    ['wrong sha512 length', `sha512-${Buffer.alloc(63, 3).toString('base64')}`],
    ['non-canonical base64', `sha256-${Buffer.alloc(32, 4).toString('base64').replace(/=+$/u, '')}`],
    ['placeholder digest', `sha384-${Buffer.alloc(48, 5).toString('base64')}`],
  ])('rejects transitive registry SRI with %s', (_name, integrity) => {
    const lock = closureLock()
    packageRecord(lock, 'registry-dep@2.0.0').resolution.integrity = integrity

    expect(() => assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      lock,
    )).toThrow('runtime dependency registry resolution must declare exact integrity')
  })

  test.each([
    ['missing closure node', (lock: FixtureLock) => {
      delete lock.packages['nested-dep@3.0.0']
    }, 'runtime dependency is unresolved'],
    ['floating registry locator', (lock: FixtureLock) => {
      const dependencies = snapshot(lock, 'plugin-a@1.0.0(peer-dep@1.0.0)').dependencies as Record<string, string>
      dependencies['registry-dep'] = 'latest'
      lock.packages['registry-dep@latest'] = { resolution: { integrity: 'sha512-cmVnaXN0cnk=' } }
    }, 'exact registry version'],
    ['missing registry SRI', (lock: FixtureLock) => {
      delete packageRecord(lock, 'registry-dep@2.0.0').resolution.integrity
    }, 'exact integrity'],
    ['floating Git locator', (lock: FixtureLock) => {
      const dependencies = snapshot(lock, 'plugin-a@1.0.0(peer-dep@1.0.0)').dependencies as Record<string, string>
      dependencies['git-dep'] =
        'git+https://github.com/example/git-dep.git#main'
      lock.packages['git-dep@git+https://github.com/example/git-dep.git#main'] = {
        resolution: {
          type: 'git',
          repo: 'https://github.com/example/git-dep.git',
          commit: commitC,
        },
      }
    }, 'immutable commit'],
    ['floating Git tarball', (lock: FixtureLock) => {
      const key = Object.keys(lock.packages).find(item => item.startsWith('git-tar-dep@')) as string
      packageRecord(lock, key).resolution.tarball =
        'https://codeload.github.com/example/git-tar-dep/tar.gz/main'
    }, 'immutable commit identity'],
    ['floating Git tarball locator', (lock: FixtureLock) => {
      const oldLocator = `https://codeload.github.com/example/git-tar-dep/tar.gz/${commitB}`
      const newLocator = 'https://codeload.github.com/example/git-tar-dep/tar.gz/main'
      const dependencies = snapshot(
        lock,
        'plugin-a@1.0.0(peer-dep@1.0.0)',
      ).dependencies as Record<string, string>
      dependencies['git-tar-dep'] = newLocator
      const record = packageRecord(lock, `git-tar-dep@${oldLocator}`)
      record.resolution.tarball = newLocator
      delete lock.packages[`git-tar-dep@${oldLocator}`]
      lock.packages[`git-tar-dep@${newLocator}`] = record
    }, 'immutable commit identity'],
    ['floating Git resolution commit', (lock: FixtureLock) => {
      const key = Object.keys(lock.packages).find(item => item.startsWith('git-dep@')) as string
      packageRecord(lock, key).resolution.commit = 'main'
    }, 'runtime Git resolution must declare an immutable commit'],
    ['mismatched Git resolution repository', (lock: FixtureLock) => {
      const key = Object.keys(lock.packages).find(item => item.startsWith('git-dep@')) as string
      packageRecord(lock, key).resolution.repo = 'https://github.com/example/other.git'
    }, 'runtime Git dependency differs from its resolution repository, commit, or path'],
    ['mismatched aliased dependency target', (lock: FixtureLock) => {
      const dependencies = snapshot(lock, 'plugin-a@1.0.0(peer-dep@1.0.0)').dependencies as Record<string, string>
      dependencies['missing-alias'] = 'npm:missing-target@9.0.0'
    }, 'missing-alias alias target missing-target@9.0.0 runtime dependency is unresolved'],
    ['runtime Git package path', (lock: FixtureLock) => {
      const oldLocator = `git+https://github.com/example/git-dep.git#${commitC}`
      const newLocator = `${oldLocator}&path:packages/plugin`
      const dependencies = snapshot(lock, 'plugin-a@1.0.0(peer-dep@1.0.0)').dependencies as Record<string, string>
      dependencies['git-dep'] = newLocator
      const record = packageRecord(lock, `git-dep@${oldLocator}`)
      record.resolution.path = 'packages/plugin'
      delete lock.packages[`git-dep@${oldLocator}`]
      lock.packages[`git-dep@${newLocator}`] = record
      delete lock.snapshots[`git-dep@${oldLocator}`]
      lock.snapshots[`git-dep@${newLocator}`] = {}
    }, 'runtime dependency closure SHA-256 differs from the catalog'],
  ])('rejects %s', (_name, mutate, message) => {
    const lock = closureLock()
    mutate(lock)

    expect(() => assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      lock,
    )).toThrow(message)
  })

  test('rejects different root and installed closures', () => {
    const root = closureLock()
    const installed = structuredClone(root)
    packageRecord(installed, 'registry-dep@2.0.0').resolution.integrity = mismatchedIntegrity

    expect(() => assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      root,
      installed,
    )).toThrow('root and installed pnpm runtime dependency closures differ')
  })

  test('rejects matching transitive tampering in both locks against the catalog digest', () => {
    const lock = closureLock()
    packageRecord(lock, 'registry-dep@2.0.0').resolution.integrity = attackerIntegrity

    expect(() => assertLocks(
      [candidate({ runtimeDependencyClosureSha256: fixtureClosureSha })],
      { 'plugin-a': '1.0.0' },
      lock,
    )).toThrow('runtime dependency closure SHA-256 differs from the catalog')
  })

  test.each([
    ['closure digest', 'runtimeDependencyClosureSha256'],
    ['tree digest', 'treeSha256'],
  ] as const)('requires a non-placeholder catalog %s', (_name, field) => {
    const missing = candidate()
    Reflect.deleteProperty(missing, field)
    expect(() => assertLocks(
      [missing],
      { 'plugin-a': '1.0.0' },
      npmLock(),
    )).toThrow('must be pinned')
  })

  test('the retained closure fixture uses the documented byte-length-prefixed digest', () => {
    const identities = [
      'plugin-a@1.0.0(peer-dep@1.0.0)\u0000direct',
      `@alias/scoped\u0000alias\u0000@scope/target@2.0.0(peer-dep@1.0.0)\u0000registry\u0000${scopedIntegrity}`,
      `alias-js-yaml\u0000alias\u0000js-yaml@4.1.0\u0000registry\u0000${aliasIntegrity}`,
      `alias-optional\u0000alias\u0000optional-target@3.0.0\u0000registry\u0000${optionalIntegrity}`,
      `git-dep@git+https://github.com/example/git-dep.git#${commitC}\u0000git\u0000https://github.com/example/git-dep\u0000${commitC}\u0000`,
      `git-tar-dep@https://codeload.github.com/example/git-tar-dep/tar.gz/${commitB}\u0000git-tarball\u0000https://codeload.github.com/example/git-tar-dep/tar.gz/${commitB}\u0000`,
      `leaf-dep@5.0.0\u0000registry\u0000${leafIntegrity}`,
      `nested-dep@3.0.0\u0000registry\u0000${nestedIntegrity}`,
      `package-record-dep@4.0.0\u0000registry\u0000${packageRecordIntegrity}`,
      `registry-dep@2.0.0(peer-dep@1.0.0)\u0000registry\u0000${registryIntegrity}`,
    ].sort()
    const hash = createHash('sha256')
    for (const identity of identities) {
      const identityBytes = Buffer.from(identity)
      hash.update(`${String(identityBytes.byteLength)}:`)
      hash.update(identityBytes)
    }

    expect(hash.digest('hex')).toBe(fixtureClosureSha)
  })
})

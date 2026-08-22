/**
 * The verify-cordis-config metadata contract: `disabled` is the one entry
 * metadata field whose `!!js` expression the Loader interpolates; every other
 * metadata field must stay static, and a disabled expression must parse.
 */

import { describe, expect, it } from 'vitest'
import * as verifyCordisConfig from './verify-cordis-config.ts'

const { metadataExpressionErrors } = verifyCordisConfig

type Manifest = {
  name?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  dsh?: { bundle?: { profileDependencies?: unknown } }
}

type Reference = { file: string; name: string }

function bundleDependencyErrors(
  manifest: Manifest,
  references: readonly Reference[],
  manifestPath = 'packages/bundle/example/package.json',
): string[] {
  const helper = (
    verifyCordisConfig as typeof verifyCordisConfig & {
      bundleManifestDependencyErrors?: (
        manifest: Manifest,
        references: readonly Reference[],
        manifestPath: string,
      ) => string[]
    }
  ).bundleManifestDependencyErrors
  expect(helper).toBeTypeOf('function')
  return helper(manifest, references, manifestPath)
}

describe('verify-cordis-config metadata expressions', () => {
  it('accepts a disabled !!js expression', () => {
    const problems = metadataExpressionErrors(
      { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash', disabled: { __jsExpr: "process.platform === 'win32'" } },
      '[0]',
    )
    expect(problems).toEqual([])
  })

  it('rejects an expression in a static metadata field', () => {
    const problems = metadataExpressionErrors({ id: { __jsExpr: 'process.platform' }, name: 'pkg' }, '[0]')
    expect(problems).toContain('[0].id: !!js is not interpolated here')
  })

  it('rejects an expression nested below disabled (only the field itself interpolates)', () => {
    const problems = metadataExpressionErrors(
      { id: 'tool-bash', name: 'pkg', disabled: { when: { __jsExpr: 'process.platform' } } },
      '[0]',
    )
    expect(problems).toContain('[0].disabled.when: !!js is not interpolated here')
  })

  it('rejects a disabled expression that does not parse (the loader would fail the boot)', () => {
    const problems = metadataExpressionErrors(
      { id: 'tool-bash', name: 'pkg', disabled: { __jsExpr: 'process.platform ===' } },
      '[0]',
    )
    expect(problems.some(problem => problem.includes('[0].disabled: disabled expression does not parse'))).toBe(true)
  })
})

describe('verify-cordis-config bundle profile dependencies', () => {
  const file = 'packages/bundle/example/cordis.patch.yml'

  it('accepts dependencies or exact profile-owned mappings and normalizes subpaths to package roots', () => {
    const problems = bundleDependencyErrors(
      {
        name: '@deepseek-ai/dsh-example',
        dependencies: { '@scope/in-bundle': '1.0.0' },
        dsh: {
          bundle: {
            profileDependencies: {
              '@scope/profile-owned': '1.2.3',
              'plain-profile-owned': '2.0.0-rc.5+build.7',
            },
          },
        },
      },
      [
        { file, name: '@deepseek-ai/dsh-example' },
        { file, name: '@scope/in-bundle/client' },
        { file, name: '@scope/profile-owned/client' },
        { file, name: 'plain-profile-owned/runtime' },
        { file, name: './local.ts' },
        { file, name: 'node:fs' },
      ],
    )

    expect(problems).toEqual([])
  })

  it('rejects a profile-owned bare row missing from both legal declaration sources', () => {
    const problems = bundleDependencyErrors({}, [{ file, name: '@scope/missing/client' }])

    expect(problems).toContain(
      `${file}: @scope/missing must be declared in packages/bundle/example/package.json dependencies or dsh.bundle.profileDependencies`,
    )
  })

  it('rejects a profile dependency that no bare patch row uses', () => {
    const problems = bundleDependencyErrors(
      { dsh: { bundle: { profileDependencies: { '@scope/unused': '1.2.3' } } } },
      [],
    )

    expect(problems).toContain(
      'packages/bundle/example/package.json: dsh.bundle.profileDependencies declares @scope/unused, but the bundle patch has no profile-owned bare row for it',
    )
  })

  it.each([
    '^1.2.3',
    '~1.2.3',
    'latest',
    '1.2',
    '1.2.x',
    '*',
    'workspace:^',
    'file:../package',
    'git+https://example.test/package.git',
    'https://example.test/package.tgz',
  ])('rejects non-exact profile dependency version %s', (version) => {
    const problems = bundleDependencyErrors(
      { dsh: { bundle: { profileDependencies: { '@scope/profile-owned': version } } } },
      [{ file, name: '@scope/profile-owned' }],
    )

    expect(problems).toContain(
      `packages/bundle/example/package.json: dsh.bundle.profileDependencies["@scope/profile-owned"] must be an exact npm version, got ${JSON.stringify(version)}`,
    )
  })

  it.each(['1.2.3', '1.2.3-rc.5', '1.2.3+build.7', '1.2.3-rc.5+build.7'])(
    'accepts exact profile dependency version %s',
    (version) => {
      const problems = bundleDependencyErrors(
        { dsh: { bundle: { profileDependencies: { '@scope/profile-owned': version } } } },
        [{ file, name: '@scope/profile-owned' }],
      )

      expect(problems).toEqual([])
    },
  )

  it.each([null, [], 'not-an-object'])('rejects invalid profileDependencies value %j', (value) => {
    const problems = bundleDependencyErrors(
      { dsh: { bundle: { profileDependencies: value } } },
      [],
    )

    expect(problems).toContain(
      'packages/bundle/example/package.json: dsh.bundle.profileDependencies must be an object',
    )
  })

  it('rejects a non-string profile dependency version', () => {
    const problems = bundleDependencyErrors(
      { dsh: { bundle: { profileDependencies: { '@scope/profile-owned': 123 } } } },
      [{ file, name: '@scope/profile-owned' }],
    )

    expect(problems).toContain(
      'packages/bundle/example/package.json: dsh.bundle.profileDependencies["@scope/profile-owned"] must be an exact npm version, got 123',
    )
  })

  it.each([
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const)('rejects a profile dependency repeated in %s', (section) => {
    const problems = bundleDependencyErrors(
      {
        [section]: { '@scope/profile-owned': '1.2.3' },
        dsh: { bundle: { profileDependencies: { '@scope/profile-owned': '1.2.3' } } },
      },
      [{ file, name: '@scope/profile-owned' }],
    )

    expect(problems).toContain(
      `packages/bundle/example/package.json: @scope/profile-owned must not appear in ${section}; dsh.bundle.profileDependencies are installed by the profile`,
    )
  })
})

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { CuratedCandidate } from '@deepseek-ai/dsh-curated-policy'

/** Candidate used to assert one exact subdirectory dependency in the materialized profile. */
export const SUBDIRECTORY_FIXTURE_PACKAGE = 'dsh-web-search-pro'

/**
 * Write a local Git repository fixture with one package subdirectory per selected candidate.
 * @param root - Temporary repository root.
 * @param candidates - Catalog candidates represented by the fixture.
 */
export function writeLocalGitProfileFixture(root: string, candidates: readonly CuratedCandidate[]): void {
  for (const candidate of candidates) {
    if (candidate.expectedPackage === null) throw new Error(`${candidate.id} fixture package is missing`)
    const packageDir = join(root, fixtureRepositoryPath(candidate))
    mkdirSync(packageDir, { recursive: true })
    writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify({
      name: candidate.expectedPackage,
      version: '1.0.0',
      type: 'module',
      main: './index.js',
      engines: { node: '^22.19.0 || >=24.0.0' },
      license: 'MIT',
      scripts: {},
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    }, null, 2)}\n`)
    writeFileSync(join(packageDir, 'index.js'), 'export const name = "curated-local-git-fixture"\n')
    const entryIds = candidate.resources?.entryIds ?? []
    writeFileSync(join(packageDir, 'cordis.patch.yml'), entryIds.length === 0
      ? '[]\n'
      : `- insert:
${entryIds.map(id => `    - id: ${id}
      name: ${JSON.stringify(candidate.expectedPackage)}
${candidate.capability === 'permission-policy' && id === 'permission-rules'
  ? `      config:
        badFilePolicy: fail
        enforce: true
`
  : ''}`).join('')}`)
  }
}

/**
 * Return the repository path used for one local fixture package.
 * @param candidate - Candidate represented by the fixture.
 * @returns repository-relative package directory.
 */
export function fixtureRepositoryPath(candidate: CuratedCandidate): string {
  return `packages/${candidate.id}`
}

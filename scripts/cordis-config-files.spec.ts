import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cordisConfigFiles, isCordisConfigFile } from './cordis-config-files.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('cordisConfigFiles', () => {
  it('finds only Loader YAML without treating overlays or translation records as configs', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-cordis-config-files-'))
    roots.push(root)
    for (const directory of [
      '.claude',
      'apps/web/tests',
      'docs',
      'examples',
      'node_modules/pkg',
      'other',
      'vendor/pkg',
    ]) {
      mkdirSync(join(root, directory), { recursive: true })
    }
    for (const file of [
      '.claude/hidden.cordis.yml',
      'apps/web/tests/browser.overlay.yml',
      'docs/cordis-primer.i18n.yaml',
      'examples/agent.cordis.yaml',
      'examples/headless.cordis.yml',
      'node_modules/pkg/hidden.cordis.yml',
      'other/records.yml',
      'other/settings.yaml',
      'other/unregistered.overlay.yml',
      'vendor/pkg/hidden.cordis.yml',
    ]) {
      writeFileSync(join(root, file), '[]\n')
    }

    expect(cordisConfigFiles(root)).toEqual([
      join('examples', 'agent.cordis.yaml'),
      join('examples', 'headless.cordis.yml'),
    ])
  })

  it('keeps shared discovery compatible with the real verify-cordis-config entry path', () => {
    const root = resolve(import.meta.dirname, '..')
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx/esm', resolve(root, 'scripts/verify-cordis-config.ts')],
      { cwd: root, encoding: 'utf8' },
    )

    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      `verify-cordis-config: ${String(cordisConfigFiles(root).length)} config files passed.`,
    )
  })

  it.each([
    ['examples/cordis.yml', true],
    ['examples/agent.cordis.yaml', true],
    ['examples/agent.cordis.snapshot.yml', true],
    ['packages/bundle/base/cordis.patch.yml', true],
    ['apps/web/tests/default-model.overlay.yml', false],
    ['docs/cordis-primer.i18n.yaml', false],
    ['fixtures/records.yml', false],
    ['fixtures/settings.yaml', false],
    ['fixtures/default-model.overlay.yml', false],
  ])('classifies %s as Loader YAML: %s', (file, expected) => {
    expect(isCordisConfigFile(file)).toBe(expected)
  })
})

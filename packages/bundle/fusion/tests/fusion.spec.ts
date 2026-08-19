/**
 * The bundle's manifest must name a patch file that the Cordis entry-list
 * schema can parse.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const root = fileURLToPath(new URL('..', import.meta.url))

const expectedRows = [
  { id: 'modlens', name: '@liustack/modlens' },
  { id: 'better-sidebar', name: 'dsh-better-sidebar' },
  {
    id: 'ui-web-ui-settings',
    name: '@linxin666/dsh-client-ui-web-ui-settings',
  },
  { id: 'ui-task-board', name: '@linxin666/dsh-client-ui-task-board' },
  { id: 'ui-git-graph', name: '@linxin666/dsh-client-ui-git-graph' },
  { id: 'remote-web-ui', name: '@linxin666/dsh-remote-web-ui' },
  { id: 'ssh', name: '@linxin666/dsh-ssh' },
  { id: 'pet', name: '@linxin666/dsh-pet' },
  {
    id: 'ui-skin-center',
    name: '@linxin666/dsh-client-ui-skin-center',
  },
] as const

const expectedDependencies = {
  '@liustack/modlens': '3.21.1',
  'dsh-better-sidebar': '0.13.1',
  '@linxin666/dsh-client-ui-web-ui-settings': '0.2.2',
  '@linxin666/dsh-client-ui-task-board': '0.2.2',
  '@linxin666/dsh-client-ui-git-graph': '0.2.2',
  '@linxin666/dsh-remote-web-ui': '0.2.2',
  '@linxin666/dsh-ssh': '0.2.2',
  '@linxin666/dsh-pet': '0.2.2',
  '@linxin666/dsh-client-ui-skin-center': '0.2.2',
} as const

const bannedIds = [
  'web-ui-all',
  'tool-describe-image',
  'web-ui-describe-image',
  'aionui-panel',
  'web-ui-dsh-aionui-panel',
  'dsh-skins',
  'liangshen',
  'web-ui-liangshen',
] as const

const bannedNames = [
  '@linxin666/dsh-web-ui-all',
  '@linxin666/dsh-tool-describe-image',
  '@linxin666/dsh-client-ui-aionui-panel',
  '@linxin666/dsh-skins',
  '@linxin666/dsh-liangshen',
] as const

function expectNoBannedValues(
  actual: readonly string[],
  banned: readonly string[],
): void {
  for (const value of banned) {
    expect(actual).not.toContain(value)
  }
}

describe('dsh-fusion bundle', () => {
  it('declares its patch through the package manifest', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8'),
    ) as {
      name?: string
      dsh?: { bundle?: { patch?: string } }
    }

    expect(manifest.name).toBe('@deepseek-ai/dsh-fusion')
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
  })

  it('ships a patch list accepted by the Cordis entry-list schema', () => {
    const parsed = yaml.load(
      readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8'),
      { schema: entryListSchema },
    )

    expect(parsed).toEqual([{ insert: expectedRows }])
  })

  it('mounts only the nine curated rows', () => {
    const parsed = yaml.load(
      readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8'),
      { schema: entryListSchema },
    ) as Array<{ insert?: Array<{ id: string; name: string }> }>
    const rows = parsed.flatMap(entry => entry.insert ?? [])
    const ids = rows.map(row => row.id)
    const names = rows.map(row => row.name)

    expect(rows).toHaveLength(9)
    expect(rows).toEqual(expectedRows)
    expectNoBannedValues(ids, bannedIds)
    expectNoBannedValues(names, bannedNames)
    expect([...names].sort()).toEqual(Object.keys(expectedDependencies).sort())
  })

  it('rejects one banned row field independently', () => {
    expect(() => {
      expectNoBannedValues(['web-ui-all'], bannedIds)
    }).toThrow()
    expect(() => {
      expectNoBannedValues(['@linxin666/dsh-web-ui-all'], bannedNames)
    }).toThrow()
  })

  it('pins exactly the curated runtime dependencies', () => {
    const manifest = JSON.parse(
      readFileSync(resolve(root, 'package.json'), 'utf8'),
    ) as { dependencies?: Record<string, string> }

    expect(manifest.dependencies).toEqual(expectedDependencies)
    expect(Object.values(manifest.dependencies ?? {})).toEqual(
      expect.not.arrayContaining([
        expect.stringMatching(/^[~^]/),
        'latest',
      ]),
    )
  })
})

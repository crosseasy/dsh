import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import * as curatedBase from '@deepseek-ai/dsh-curated-base'
import * as curatedBench from '@deepseek-ai/dsh-curated-bench'
import * as curatedPolicy from '@deepseek-ai/dsh-curated-policy'
import * as curatedBaseInvariant from '../src/invariant.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

describe('dsh-curated-base bundle', () => {
  it('declares an existing patch file through the dsh.bundle.patch manifest field', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dsh?: { bundle?: { patch?: string } }
    }

    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    expect(existsSync(resolve(root, manifest.dsh!.bundle!.patch!))).toBe(true)
  })

  it('ships a patch list parseable by the Cordis include YAML schema', () => {
    const parsed = yaml.load(
      readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8'),
      { schema: entryListSchema },
    )

    expect(parsed).toEqual([
      {
        insert: [
          {
            id: 'curated-policy',
            name: '@deepseek-ai/dsh-curated-policy',
          },
          {
            id: 'curated-bench',
            name: '@deepseek-ai/dsh-curated-bench',
          },
        ],
      },
    ])
  })

  it('keeps curated packages free of default exports', () => {
    expect('default' in curatedBase).toBe(false)
    expect('default' in curatedBench).toBe(false)
    expect('default' in curatedPolicy).toBe(false)
  })

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

    await expect(curatedBaseInvariant.apply(ctx as Parameters<typeof curatedBaseInvariant.apply>[0]))
      .resolves.toBe(disposer)
    expect(curatedBaseInvariant.name).toBe('curated-base-bundle-invariant')
    expect(curatedBaseInvariant.inject).toEqual(['invariants'])
    expect(registered.packageName).toBe('@deepseek-ai/dsh-curated-base')

    const messages: string[] = []
    registered.install?.(ctx, message => messages.push(message))
    expect(messages).toEqual([])
  })
})

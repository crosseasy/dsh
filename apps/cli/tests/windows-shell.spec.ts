/**
 * The shipped shell composition: the base bundle gates both shell stacks by
 * platform on its own rows (`disabled: !!js process.platform`), so exactly
 * one shell stack mounts per host and no separate platform layer exists —
 * the launcher applies nothing beyond the bundle layers. The spec composes
 * the REAL shipped bundle layers (dsh-base + dsh-web-app resolved from the
 * app installation anchor) through the boot's patch algorithm and pins the
 * effective per-platform roster, the preset-level gates that keep tool-bash
 * out of win32 sessions and tool-pwsh out of POSIX sessions, and the
 * cold-start resolution closure for the pwsh rows' bare plugin names.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readdirSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { Context } from '@deepseek-ai/cordis'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'
import { evaluate } from '@deepseek-ai/cordis-plugin-loader'
import { SHIPPED_PRESET_ROOT } from '@deepseek-ai/dsh-agent-presets'
import { composeEntries, initProfile, loadProfile, PROFILES_DIR } from '@deepseek-ai/dsh-app-boot'
import { SandboxUnavailableError, SandboxProvider } from '@deepseek-ai/dsh-sandbox'
import type { ConfinedArgv, SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import SandboxPolicyService from '@deepseek-ai/dsh-sandbox-policy'
import { SandboxBashExecutor } from '@deepseek-ai/dsh-bash-sandbox'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import * as ToolBash from '@deepseek-ai/dsh-tool-bash'

/**
 * The effective disabled state of one row on one platform: a `!!js` expression
 * evaluates with a platform-scoped `process` so both outcomes pin on any host.
 */
function disabledOn(row: { disabled?: unknown }, platform: 'win32' | 'linux'): boolean {
  const value = row.disabled
  if (value !== null && typeof value === 'object' && '__jsExpr' in value) {
    return Boolean(evaluate({ process: { platform } }, (value as { __jsExpr: string }).__jsExpr))
  }
  return value === true
}

type CompositionRow = {
  id?: unknown
  name?: unknown
  config?: unknown
  disabled?: unknown
  isolate?: unknown
}

function isCompositionRow(entry: unknown): entry is CompositionRow {
  return typeof entry === 'object' && entry !== null
}

/** Flatten nested Cordis groups so tests inspect the executable preset rows. */
function flattenRows(entries: unknown[]): CompositionRow[] {
  const rows: CompositionRow[] = []
  for (const entry of entries) {
    if (!isCompositionRow(entry)) continue
    const row = entry
    rows.push(row)
    if (Array.isArray(row.config)) rows.push(...flattenRows(row.config))
  }
  return rows
}

describe('the shipped shell composition (real bundle layers)', () => {
  let home: string
  afterEach(() => { if (home !== undefined) rmSync(home, { recursive: true, force: true }) })
  // The app installation anchor, mirroring profile-boot.ts: the bundle layers
  // resolve from the REAL dsh-base/dsh-web-app packages through it, so this
  // suite composes the shipped patch files, not test fixtures.
  const anchor = fileURLToPath(new URL('../package.json', import.meta.url))

  it('composes the confined pwsh roster on win32 and the bash roster on POSIX from the same rows', () => {
    home = mkdtempSync(join(tmpdir(), 'dsh-windows-home-'))
    initProfile(join(home, PROFILES_DIR, 'web'), ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
    const profile = loadProfile('dsh', 'web', anchor, home)
    const warnings: string[] = []
    const rows = composeEntries(
      profile.layers.map(layer => layer.patches),
      message => warnings.push(message),
    )
    const byId = new Map(rows.map(row => [row.id, row]))
    // One shared patch set, two rosters: the shell stacks gate themselves.
    for (const id of ['bash-sandbox', 'pwsh-sandbox', 'tool-bash', 'tool-pwsh']) {
      expect(byId.has(id), `row ${id}`).toBe(true)
    }
    expect(disabledOn(byId.get('bash-sandbox')!, 'win32'), 'bash-sandbox on win32').toBe(true)
    expect(disabledOn(byId.get('bash-sandbox')!, 'linux'), 'bash-sandbox on linux').toBe(false)
    expect(disabledOn(byId.get('pwsh-sandbox')!, 'win32'), 'pwsh-sandbox on win32').toBe(false)
    expect(disabledOn(byId.get('pwsh-sandbox')!, 'linux'), 'pwsh-sandbox on linux').toBe(true)
    // Host shell-tool rows are disabled on every platform; sessions mount
    // their own rows instead.
    expect(byId.get('tool-bash')?.disabled).toBe(true)
    expect(byId.get('tool-pwsh')?.disabled).toBe(true)
    // The permission surface never moves: the sandbox/policy rows, the
    // permission switcher, fs-sandbox, and the approval service stay enabled
    // exactly as on POSIX — the confined pwsh executor is what changes.
    for (const id of ['permission', 'ui-permission', 'sandbox', 'sandbox-policy', 'fs-sandbox', 'approval']) {
      expect(byId.get(id)?.disabled, `row ${id}`).not.toBe(true)
    }
    // The launcher's cold-start module fallback BFS-links the apps/cli
    // dependency closure into the profile's node_modules, so every bare
    // plugin name in the base patch must resolve from there.
    const cliManifest = JSON.parse(readFileSync(anchor, 'utf8')) as { dependencies?: Record<string, string> }
    for (const name of ['@deepseek-ai/dsh-pwsh-sandbox', '@deepseek-ai/dsh-tool-pwsh']) {
      expect(cliManifest.dependencies?.[name], `cold-start closure must reach ${name}`).toBeDefined()
    }
    expect(warnings).toEqual([])
  })

  it('base-only profiles carry both stacks with the same platform gating', () => {
    home = mkdtempSync(join(tmpdir(), 'dsh-windows-home-'))
    initProfile(join(home, PROFILES_DIR, 'base-only'), ['@deepseek-ai/dsh-base'])
    const profile = loadProfile('dsh', 'base-only', anchor, home)
    const warnings: string[] = []
    const rows = composeEntries(
      profile.layers.map(layer => layer.patches),
      message => warnings.push(message),
    )
    const byId = new Map(rows.map(row => [row.id, row]))
    for (const id of ['bash-sandbox', 'tool-bash', 'pwsh-sandbox', 'tool-pwsh']) {
      expect(byId.has(id), `row ${id}`).toBe(true)
    }
    // No web overlay: the tool rows keep their own gating too.
    expect(disabledOn(byId.get('tool-bash')!, 'win32'), 'tool-bash on win32').toBe(true)
    expect(disabledOn(byId.get('tool-bash')!, 'linux'), 'tool-bash on linux').toBe(false)
    expect(disabledOn(byId.get('tool-pwsh')!, 'win32'), 'tool-pwsh on win32').toBe(false)
    expect(disabledOn(byId.get('tool-pwsh')!, 'linux'), 'tool-pwsh on linux').toBe(true)
    expect(warnings).toEqual([])
  })
})

describe('shipped agent presets gate both shell tools by platform', () => {
  const presetRoot = SHIPPED_PRESET_ROOT

  it.each(['standard', 'ptc', 'cordis'])('preset %s gates its shell tool rows by platform', (preset) => {
    const entries: unknown = yaml.load(
      readFileSync(join(presetRoot, preset, 'agent.cordis.yml'), 'utf8'),
      { schema: entryListSchema },
    )
    if (!Array.isArray(entries)) throw new TypeError(`preset ${preset} must parse to an entry array`)
    for (const [id, win32] of [['tool-bash', true], ['tool-pwsh', false]] as const) {
      const row = entries.find((entry): entry is Record<string, unknown> => (
        typeof entry === 'object' && entry !== null && (entry as Record<string, unknown>).id === id
      ))
      if (row === undefined) throw new TypeError(`preset ${preset} must mount ${id}`)
      expect(row.disabled).toMatchObject({ __jsExpr: expect.any(String) as string })
      // A platform-scoped context pins both outcomes on every host.
      const expression = (row.disabled as { __jsExpr: string }).__jsExpr
      expect(Boolean(evaluate({ process: { platform: 'win32' } }, expression)), `${id} on win32`).toBe(win32)
      expect(Boolean(evaluate({ process: { platform: 'linux' } }, expression)), `${id} on linux`).toBe(!win32)
    }
  })

  it('minimal mounts no shell tool row and gates its persistent shell stack by platform', () => {
    const entries: unknown = yaml.load(
      readFileSync(join(presetRoot, 'minimal', 'agent.cordis.yml'), 'utf8'),
      { schema: entryListSchema },
    )
    if (!Array.isArray(entries)) throw new TypeError('minimal preset must parse to an entry array')
    for (const id of ['tool-bash', 'tool-pwsh']) {
      expect(entries.some(entry => (
        typeof entry === 'object' && entry !== null && (entry as Record<string, unknown>).id === id
      )), `${id} must be absent from minimal`).toBe(false)
    }
    const group = entries.find((entry): entry is Record<string, unknown> => (
      typeof entry === 'object' && entry !== null && (entry as Record<string, unknown>).id === 'persistent-shell'
    ))
    if (group === undefined) throw new TypeError('minimal preset must mount persistent-shell')
    const rows = group.config as unknown[]
    if (!Array.isArray(rows)) throw new TypeError('persistent-shell must carry a row list')
    const byId = new Map(rows
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      .map(entry => [entry.id, entry]))
    // The bash stack (terminal-bash + persistent-bash) mounts on POSIX only; the
    // pwsh twin (terminal-bash with shellDialect pwsh + persistent-pwsh) mounts on
    // win32 only — exactly one persistent shell per host.
    for (const id of ['terminal-bash', 'persistent-bash']) {
      expect(disabledOn(byId.get(id)!, 'win32'), `${id} on win32`).toBe(true)
      expect(disabledOn(byId.get(id)!, 'linux'), `${id} on linux`).toBe(false)
    }
    for (const id of ['terminal-pwsh', 'persistent-pwsh']) {
      expect(disabledOn(byId.get(id)!, 'win32'), `${id} on win32`).toBe(false)
      expect(disabledOn(byId.get(id)!, 'linux'), `${id} on linux`).toBe(true)
    }
    expect(byId.get('terminal-pwsh')?.config).toMatchObject({ shellDialect: 'pwsh' })
  })

  it('liangshen selects one bash path per platform and ships only the sandboxed Windows chain', () => {
    const directory = join(presetRoot, 'liangshen')
    const compositionPath = join(presetRoot, 'liangshen', 'agent.cordis.yml')
    expect(existsSync(compositionPath), 'liangshen must ship agent.cordis.yml').toBe(true)
    if (!existsSync(compositionPath)) return
    const entries: unknown = yaml.load(
      readFileSync(compositionPath, 'utf8'),
      { schema: entryListSchema },
    )
    if (!Array.isArray(entries)) throw new TypeError('liangshen preset must parse to an entry array')
    const topLevelRows = entries.filter(isCompositionRow)
    const rows = flattenRows(entries)
    const byId = new Map(rows.map(row => [row.id, row]))
    const persistent = byId.get('persistent-shell')
    const windows = byId.get('windows-bash')
    const bootstrap = byId.get('tool-bootstrap')
    expect(persistent).toBeDefined()
    expect(windows).toBeDefined()
    expect(bootstrap?.config).toMatchObject({
      shellTools: ['bash'],
      commonTools: ['str_replace_editor'],
      messageSources: ['user', 'goal'],
    })

    for (const platform of ['linux', 'win32'] as const) {
      expect([persistent!, windows!].filter(row => !disabledOn(row, platform))).toHaveLength(1)
    }
    expect(disabledOn(persistent!, 'linux')).toBe(false)
    expect(disabledOn(persistent!, 'win32')).toBe(true)
    expect(disabledOn(windows!, 'linux')).toBe(true)
    expect(disabledOn(windows!, 'win32')).toBe(false)
    expect(windows?.isolate).toEqual({ shell: true, settings: true })
    const windowsRows = Array.isArray(windows?.config) ? windows.config.filter(isCompositionRow) : []
    expect(windowsRows.map(row => row.id)).toEqual([
      'windows-bash-sandbox',
      'windows-tool-bash',
    ])
    expect(byId.get('windows-bash-sandbox')?.name).toBe('@deepseek-ai/dsh-bash-sandbox')
    expect(byId.get('windows-tool-bash')).toMatchObject({
      name: '@deepseek-ai/dsh-tool-bash',
      config: { enableRunInBackground: false },
    })
    expect(rows.some(row => row.id === 'tool-pwsh' || row.name === '@deepseek-ai/dsh-tool-pwsh')).toBe(false)
    expect(rows.some(row => row.id === 'custom-bash' || row.name === './custom-bash.mjs')).toBe(false)
    expect(existsSync(join(directory, 'custom-bash.mjs'))).toBe(false)
    expect(readdirSync(directory).sort()).toEqual([
      'NOTICE',
      'agent.cordis.yml',
      'preset.yml',
      'tool-bootstrap.mjs',
    ])

    let definition: { name?: unknown } | undefined
    ToolBash.apply({
      shell: { sandboxMode: undefined },
      systemPrompt: { section: () => {} },
      tools: { register: (registered: { name?: unknown }) => { definition = registered } },
      get: () => undefined,
    } as never, { enableRunInBackground: false })
    expect(definition?.name).toBe('bash')
    expect(topLevelRows.filter(row => !disabledOn(row, 'win32') && row.id === 'windows-bash'))
      .toHaveLength(1)
  })

  it('keeps the official Windows bash chain fail closed before subprocess spawn', async () => {
    class UnavailableSandbox extends SandboxProvider {
      confine(_argv: readonly string[], policy: SandboxPolicy): ConfinedArgv {
        throw new SandboxUnavailableError(policy.mode)
      }
    }
    const ctx = new Context()
    await ctx.plugin(UnavailableSandbox)
    await ctx.plugin(SandboxPolicyService, { mode: 'read-only', workspaceRoot: process.cwd() })
    await ctx.plugin(LocalSubprocessRuntime)
    await ctx.plugin(SandboxBashExecutor, { timeoutMs: 100 })
    const spawn = vi.spyOn(ctx.subprocess, 'spawn')

    await expect(ctx.shell.run(ctx.shell.resolve({ command: 'printf blocked' })))
      .rejects.toBeInstanceOf(SandboxUnavailableError)
    expect(spawn).not.toHaveBeenCalled()
  })
})

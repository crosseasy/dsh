import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import {
  CuratedBench,
  curatedBenchBaselinesDir,
  curatedBenchManifestsDir,
  curatedBenchTasksDir,
} from '../src/index.ts'
import * as curatedBenchPlugin from '../src/index.ts'
import * as invariantPlugin from '../src/invariant.ts'
import { canonicalBenchmarkJson } from '../src/snapshot.ts'

const expectedDirectories = [curatedBenchManifestsDir, curatedBenchTasksDir, curatedBenchBaselinesDir]

type BenchmarkFixture = {
  evidenceKind: string
  baseline: { profile: string }
  candidate: { profile: string; runs: Array<{ taskId: string }> }
}

type AbComparisonsFixture = {
  comparisons: Array<{ id: string; scale: { queries?: number; webTasks?: number; repetitionsPerTask?: number } }>
}

type WebCdpRegressionFixture = {
  browser: { kind: string; cdpPort: number; ideEmbeddedBrowserAllowed: boolean }
  status: string
}

describe('curated benchmark assets', () => {
  it('exports directories containing JSON benchmark assets', () => {
    for (const dir of expectedDirectories) {
      expect(existsSync(join(dir, '.keep.json'))).toBe(true)
      expect(JSON.parse(readFileSync(join(dir, '.keep.json'), 'utf8'))).toHaveProperty('purpose')
    }
    expect(JSON.parse(readFileSync(join(curatedBenchManifestsDir, 'curated-candidates.json'), 'utf8')))
      .toMatchObject({ schemaVersion: 1, summary: { candidateCount: 37 } })
    expect(JSON.parse(readFileSync(join(curatedBenchTasksDir, 'curated-tasksets.json'), 'utf8')))
      .toMatchObject({ schemaVersion: 1 })
    expect(JSON.parse(readFileSync(join(curatedBenchTasksDir, 'p2-risk-gates.json'), 'utf8')))
      .toMatchObject({
        schemaVersion: 1,
        profiles: { 'web-coding': { budgets: { maxConcurrentAgents: 4 } } },
        canary: { minimumTasks: 100 },
      })
    const comparisons = JSON.parse(readFileSync(join(curatedBenchBaselinesDir, 'ab-comparisons.json'), 'utf8')) as AbComparisonsFixture
    expect(JSON.parse(readFileSync(join(curatedBenchTasksDir, 'p2-risk-gates.json'), 'utf8')))
      .toMatchObject({ evidenceKind: 'planned' })
    expect(comparisons).toMatchObject({ evidenceKind: 'planned' })
    expect(comparisons.comparisons.map(comparison => comparison.id)).toEqual([
      'web-search-pro-vs-free-web-search',
      'memento-vs-mneme',
      'computer-use-vs-tabbit',
      'mcp-panel-vs-mcp-manager',
      'cost-meter-vs-tokenledger',
    ])
    expect(comparisons.comparisons[0]?.scale.queries).toBe(100)
    expect(comparisons.comparisons[2]?.scale.webTasks).toBe(50)
    const cdp = JSON.parse(readFileSync(join(curatedBenchBaselinesDir, 'web-cdp-regression.json'), 'utf8')) as WebCdpRegressionFixture
    expect(cdp.browser).toEqual({ kind: 'Chrome', cdpPort: 9333, ideEmbeddedBrowserAllowed: false })
    expect(cdp.status).toBe('requires-browser-environment')
    const benchmark = JSON.parse(readFileSync(join(curatedBenchBaselinesDir, 'benchmark.json'), 'utf8')) as BenchmarkFixture
    expect(benchmark).toMatchObject({ baseline: { profile: 'web' }, candidate: { profile: 'web-curated' } })
    expect(benchmark).toMatchObject({ evidenceKind: 'planned' })
    expect(benchmark.candidate.runs).toEqual([])
    for (const snapshot of [
      'locks/2026-08-24.json',
      'profiles/web-curated-2026-08-24.json',
      'locks/web.json',
      'profiles/web.json',
      'locks/web-curated.json',
      'profiles/web-curated.json',
    ]) {
      expect(existsSync(join(curatedBenchBaselinesDir, snapshot))).toBe(true)
    }
  })

  it('exposes read-only benchmark assets through CuratedBench', () => {
    const service = new CuratedBench()

    expect(service.assetDirs()).toEqual({
      manifests: curatedBenchManifestsDir,
      tasks: curatedBenchTasksDir,
      baselines: curatedBenchBaselinesDir,
    })
    expect(service.listAssets('baselines')).toContain('benchmark.json')
    expect(service.listAssets('baselines')).toContain('locks/web-curated.json')
    const benchmark = service.readAsset('baselines', 'benchmark.json') as { candidate?: { profile?: string } }
    expect(benchmark.candidate?.profile).toBe('web-curated')
    expect(Object.isFrozen(benchmark)).toBe(true)
    expect(Object.isFrozen(benchmark.candidate)).toBe(true)
  })

  it('lists nested JSON benchmark assets without returning non-JSON files', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-list-'))
    const baselines = join(root, 'baselines')
    mkdirSync(join(baselines, 'nested'), { recursive: true })
    writeFileSync(join(baselines, 'root.json'), '{}\n')
    writeFileSync(join(baselines, 'notes.txt'), 'ignored\n')
    writeFileSync(join(baselines, 'nested', 'case.json'), '{}\n')
    try {
      const service = new CuratedBench({ baselines })

      expect(service.listAssets('baselines')).toEqual(['nested/case.json', 'root.json'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects unsafe benchmark service asset paths and non-plain JSON', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-service-'))
    const baselines = join(root, 'baselines')
    mkdirSync(baselines, { recursive: true })
    writeFileSync(join(baselines, 'undefined.json'), '{}\n')
    writeFileSync(join(baselines, 'date.json'), '{}\n')
    writeFileSync(join(baselines, 'null-prototype.json'), '{}\n')
    const service = new CuratedBench({ baselines })
    const nullPrototype = Object.create(null) as Record<string, unknown>
    nullPrototype.ok = true
    const parse = vi.spyOn(JSON, 'parse')
    try {
      expect(() => service.readAsset('baselines', '../benchmark.json')).toThrow('inside its asset directory')
      expect(() => service.readAsset('baselines', '/benchmark.json')).toThrow('relative POSIX JSON path')
      parse.mockReturnValueOnce(undefined)
      expect(() => service.readAsset('baselines', 'undefined.json')).toThrow('plain JSON')
      parse.mockReturnValueOnce(new Date(0))
      expect(() => service.readAsset('baselines', 'date.json')).toThrow('plain JSON')
      parse.mockReturnValueOnce(nullPrototype)
      expect(service.readAsset('baselines', 'null-prototype.json')).toBe(nullPrototype)
      expect(Object.isFrozen(nullPrototype)).toBe(true)
    } finally {
      parse.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reads null JSON assets and rejects unsupported snapshot values', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-json-'))
    const baselines = join(root, 'baselines')
    mkdirSync(baselines, { recursive: true })
    writeFileSync(join(baselines, 'null.json'), 'null\n')
    try {
      expect(new CuratedBench({ baselines }).readAsset('baselines', 'null.json')).toBeNull()
      expect(() => canonicalBenchmarkJson(undefined)).toThrow(
        'benchmark snapshots must contain plain JSON values',
      )
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('provides ctx.curatedBench for the plugin lifetime', async () => {
    const ctx = new Context()
    const fiber = await ctx.plugin(curatedBenchPlugin)

    expect(ctx.get('curatedBench')).toBeInstanceOf(CuratedBench)
    await fiber.dispose()
    expect(ctx.get('curatedBench')).toBeUndefined()
    await ctx.fiber.dispose()
  })

  it('rejects benchmark assets with missing rollback snapshot references', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-snapshots-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), JSON.stringify({
      evidenceKind: 'planned',
      canary: { durationDays: [3, 7], minimumTasks: 100, rolloutPercentages: [10, 30, 100] },
    }))
    writeFileSync(join(baselines, 'web-cdp-regression.json'), JSON.stringify({
      evidenceKind: 'planned',
      browser: { kind: 'Chrome', cdpPort: 9333, ideEmbeddedBrowserAllowed: false },
    }))
    writeFileSync(join(baselines, 'ab-comparisons.json'), JSON.stringify({
      evidenceKind: 'planned',
      comparisons: [
        { id: 'web-search-pro-vs-free-web-search' },
        { id: 'memento-vs-mneme' },
        { id: 'computer-use-vs-tabbit' },
        { id: 'mcp-panel-vs-mcp-manager' },
        { id: 'cost-meter-vs-tokenledger' },
      ],
    }))
    writeFileSync(join(baselines, 'benchmark.json'), JSON.stringify({
      evidenceKind: 'fixture',
      previousSnapshots: {
        lock: {
          sha256: '0'.repeat(64),
          snapshot: { kind: 'curated-lock-snapshot', profile: 'web-curated', candidates: [] },
        },
        profile: 'invalid',
      },
      baseline: { lockSnapshot: '', profileSnapshot: 'baselines/profiles/web.json' },
      candidate: { lockSnapshot: 'baselines/locks/web-curated.json', profileSnapshot: 'baselines/profiles/web-curated.json' },
    }))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'benchmark previous lock snapshot.sha256 does not match its embedded snapshot',
        'benchmark previous profile snapshot must be a JSON object',
        'benchmark baseline lock snapshot must be a non-empty string',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports missing benchmark object sections after related assets pass', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-sections-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), JSON.stringify({
      evidenceKind: 'planned',
      canary: { durationDays: [3, 7], minimumTasks: 100, rolloutPercentages: [10, 30, 100] },
    }))
    writeFileSync(join(baselines, 'web-cdp-regression.json'), JSON.stringify({
      evidenceKind: 'planned',
      browser: { kind: 'Chrome', cdpPort: 9333, ideEmbeddedBrowserAllowed: false },
    }))
    writeFileSync(join(baselines, 'ab-comparisons.json'), JSON.stringify({
      evidenceKind: 'planned',
      comparisons: [
        { id: 'web-search-pro-vs-free-web-search' },
        { id: 'memento-vs-mneme' },
        { id: 'computer-use-vs-tabbit' },
        { id: 'mcp-panel-vs-mcp-manager' },
        { id: 'cost-meter-vs-tokenledger' },
      ],
    }))
    writeFileSync(join(baselines, 'benchmark.json'), '{"evidenceKind":"fixture"}\n')
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'benchmark asset.previousSnapshots must be a JSON object',
        'benchmark asset.baseline must be a JSON object',
        'benchmark asset.candidate must be a JSON object',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects benchmark assets that break canary, CDP, or A/B invariants', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-invalid-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), JSON.stringify({
      evidenceKind: 'planned',
      canary: { durationDays: [1, 2], minimumTasks: 99, rolloutPercentages: [50, 100] },
    }))
    writeFileSync(join(baselines, 'web-cdp-regression.json'), JSON.stringify({
      evidenceKind: 'planned',
      browser: { kind: 'Safari', cdpPort: 9222, ideEmbeddedBrowserAllowed: true },
    }))
    writeFileSync(join(baselines, 'ab-comparisons.json'), JSON.stringify({ evidenceKind: 'planned', comparisons: [] }))
    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'p2 risk gate canary must record the 3-7 day duration window',
        'p2 risk gate canary must require at least 100 tasks',
        'p2 risk gate canary rollout must be 10%, 30%, then 100%',
        'web CDP regression must require Chrome',
        'web CDP regression must require CDP port 9333',
        'web CDP regression must reject IDE embedded browsers',
        'A/B comparison asset must include web-search-pro-vs-free-web-search',
        'A/B comparison asset must include memento-vs-mneme',
        'A/B comparison asset must include computer-use-vs-tabbit',
        'A/B comparison asset must include mcp-panel-vs-mcp-manager',
        'A/B comparison asset must include cost-meter-vs-tokenledger',
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports missing benchmark asset files after directory sentinels pass', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-missing-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        expect.stringContaining('p2 risk gate asset cannot be loaded:'),
        expect.stringContaining('web CDP regression asset cannot be loaded:'),
        expect.stringContaining('A/B comparison asset cannot be loaded:'),
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns only sentinel failures when benchmark asset directories are incomplete', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-sentinels-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    writeFileSync(join(manifests, '.keep.json'), '{"purpose":"test"}\n')

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'curated benchmark tasks directory is missing its sentinel',
        'curated benchmark baselines directory is missing its sentinel',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects malformed snapshot envelopes, profile references, and evidence kinds', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-envelope-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), JSON.stringify({
      evidenceKind: 'invalid',
      canary: { durationDays: [3, 7], minimumTasks: 100, rolloutPercentages: [10, 30, 100] },
    }))
    writeFileSync(join(baselines, 'web-cdp-regression.json'), JSON.stringify({
      evidenceKind: 'planned',
      browser: { kind: 'Chrome', cdpPort: 9333, ideEmbeddedBrowserAllowed: false },
    }))
    writeFileSync(join(baselines, 'ab-comparisons.json'), JSON.stringify({
      evidenceKind: 'planned',
      comparisons: [
        { id: 'web-search-pro-vs-free-web-search' },
        { id: 'memento-vs-mneme' },
        { id: 'computer-use-vs-tabbit' },
        { id: 'mcp-panel-vs-mcp-manager' },
        { id: 'cost-meter-vs-tokenledger' },
      ],
    }))
    writeFileSync(join(baselines, 'benchmark.json'), JSON.stringify({
      evidenceKind: 'invalid',
      previousSnapshots: {
        lock: {
          sha256: 'invalid',
          snapshot: { kind: 'wrong', catalogRef: 'mutable' },
        },
        profile: {
          sha256: 'invalid',
          snapshot: { kind: 'wrong' },
        },
      },
      baseline: { lockSnapshot: 'lock.json' },
      candidate: { lockSnapshot: 'lock.json', profileSnapshot: 'profile.json' },
    }))

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual(expect.arrayContaining([
        'p2 risk gate asset.evidenceKind must be planned',
        'benchmark asset.evidenceKind must be observed or fixture or planned',
        'benchmark previous lock snapshot.sha256 must be a lowercase SHA-256 digest',
        'benchmark previous lock snapshot.snapshot.kind must be curated-lock-snapshot',
        'benchmark previous lock snapshot.snapshot must not depend on a mutable catalogRef',
        'benchmark previous lock snapshot.snapshot.candidates must be a JSON array',
        'benchmark previous profile snapshot.sha256 must be a lowercase SHA-256 digest',
        'benchmark previous profile snapshot.snapshot.kind must be curated-profile-snapshot',
        'benchmark previous profile snapshot.snapshot.bundles must be a JSON array',
        'benchmark baseline profile snapshot must be a non-empty string',
      ]))

      writeFileSync(join(baselines, 'benchmark.json'), JSON.stringify({
        evidenceKind: 'fixture',
        previousSnapshots: {
          lock: { sha256: '0'.repeat(64), snapshot: 'invalid' },
          profile: { sha256: '0'.repeat(64), snapshot: 'invalid' },
        },
        baseline: { lockSnapshot: 'lock.json', profileSnapshot: 'profile.json' },
        candidate: { lockSnapshot: 'lock.json', profileSnapshot: 'profile.json' },
      }))
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual(expect.arrayContaining([
        'benchmark previous lock snapshot.snapshot must be a JSON object',
        'benchmark previous profile snapshot.snapshot must be a JSON object',
      ]))
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects benchmark asset files with invalid JSON object fields', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-fields-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), '{"evidenceKind":"planned","canary":"invalid"}\n')
    writeFileSync(join(baselines, 'web-cdp-regression.json'), '{"evidenceKind":"planned","browser":"invalid"}\n')
    writeFileSync(join(baselines, 'ab-comparisons.json'), '{"evidenceKind":"planned","comparisons":"invalid"}\n')

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'p2 risk gate asset.canary must be a JSON object',
        'web CDP regression asset.browser must be a JSON object',
        'A/B comparison asset.comparisons must be a JSON array',
        'A/B comparison asset must include web-search-pro-vs-free-web-search',
        'A/B comparison asset must include memento-vs-mneme',
        'A/B comparison asset must include computer-use-vs-tabbit',
        'A/B comparison asset must include mcp-panel-vs-mcp-manager',
        'A/B comparison asset must include cost-meter-vs-tokenledger',
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects benchmark asset files whose root JSON is not an object', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-root-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), '[]\n')
    writeFileSync(join(baselines, 'web-cdp-regression.json'), '[]\n')
    writeFileSync(join(baselines, 'ab-comparisons.json'), '[]\n')

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'p2 risk gate asset must be a JSON object',
        'web CDP regression asset must be a JSON object',
        'A/B comparison asset must be a JSON object',
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports non-Error JSON parser failures', () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-curated-bench-raw-parse-'))
    const manifests = join(root, 'manifests')
    const tasks = join(root, 'tasks')
    const baselines = join(root, 'baselines')
    mkdirSync(manifests)
    mkdirSync(tasks)
    mkdirSync(baselines)
    for (const dir of [manifests, tasks, baselines]) writeFileSync(join(dir, '.keep.json'), '{"purpose":"test"}\n')
    writeFileSync(join(tasks, 'p2-risk-gates.json'), '{}\n')
    writeFileSync(join(baselines, 'web-cdp-regression.json'), '{}\n')
    writeFileSync(join(baselines, 'ab-comparisons.json'), '{}\n')
    const parse = vi.spyOn(JSON, 'parse').mockImplementation(() => { throw 'raw parse failure' })

    try {
      expect(invariantPlugin.validateCuratedBenchAssets({ manifests, tasks, baselines })).toEqual([
        'p2 risk gate asset cannot be loaded: raw parse failure',
        'web CDP regression asset cannot be loaded: raw parse failure',
        'A/B comparison asset cannot be loaded: raw parse failure',
        expect.stringContaining('benchmark asset cannot be loaded:'),
      ])
    } finally {
      parse.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('registers an invariant for required asset directories', async () => {
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

    await expect(invariantPlugin.apply(ctx as never)).resolves.toBe(disposer)
    expect(registered.packageName).toBe('@deepseek-ai/dsh-curated-bench')
    const messages: string[] = []
    registered.install?.(ctx, message => messages.push(message))
    expect(messages).toEqual([])
  })
})

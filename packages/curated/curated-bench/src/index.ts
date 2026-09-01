/**
 * Curated benchmark asset locators and read-only runtime service.
 * @module @deepseek-ai/dsh-curated-bench
 */

import { opendirSync, type Dir } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { readContainedBenchmarkJson } from './snapshot.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'curated-bench'

/** No service dependency is required by the benchmark query service. */
export const inject: string[] = []

/** Directory containing audited candidate manifest summaries. */
export const curatedBenchManifestsDir = fileURLToPath(new URL('../manifests/', import.meta.url))

/** Directory containing benchmark task-set definitions. */
export const curatedBenchTasksDir = fileURLToPath(new URL('../tasks/', import.meta.url))

/** Directory containing official and curated profile benchmark baselines. */
export const curatedBenchBaselinesDir = fileURLToPath(new URL('../baselines/', import.meta.url))

/** Benchmark asset directories served by `ctx.curatedBench`. */
export interface CuratedBenchAssetDirs {
  /** Candidate manifest summaries directory. */
  readonly manifests: string
  /** Benchmark task-set definitions directory. */
  readonly tasks: string
  /** Baseline and comparison fixture directory. */
  readonly baselines: string
}

/** Asset directory class accepted by the curated benchmark service. */
export type CuratedBenchAssetKind = keyof CuratedBenchAssetDirs

/** Plain JSON value returned by curated benchmark asset reads. */
export type CuratedBenchJson = null | boolean | number | string | readonly CuratedBenchJson[] | { readonly [key: string]: CuratedBenchJson }

const DEFAULT_ASSET_DIRS: CuratedBenchAssetDirs = Object.freeze({
  manifests: curatedBenchManifestsDir,
  tasks: curatedBenchTasksDir,
  baselines: curatedBenchBaselinesDir,
})
const MAX_ASSET_DEPTH = 64
const MAX_ASSET_ENTRIES = 1024

/** Configuration accepted by the curated benchmark plugin. */
export interface Config {
  /** Optional asset directory overrides for tests or downstream bundle layouts. */
  readonly dirs?: Partial<CuratedBenchAssetDirs>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Read-only curated benchmark asset service. */
    curatedBench: CuratedBench
  }
}

/** Read-only curated benchmark asset service exposed as `ctx.curatedBench`. */
export class CuratedBench {
  private readonly dirs: CuratedBenchAssetDirs

  /**
   * Create a benchmark asset reader.
   * @param dirs - Asset directories to serve; omitted uses the package assets.
   */
  constructor(dirs: Partial<CuratedBenchAssetDirs> = {}) {
    this.dirs = Object.freeze({ ...DEFAULT_ASSET_DIRS, ...dirs })
  }

  /**
   * Return the asset directories used by this service.
   * @returns frozen directory paths keyed by asset class.
   */
  assetDirs(): CuratedBenchAssetDirs {
    return this.dirs
  }

  /**
   * List JSON asset paths for one asset class.
   * @param kind - Asset class to list.
   * @returns sorted POSIX-style relative JSON paths.
   * @throws when the asset tree exceeds 64 nested levels or 1,024 total entries.
   */
  listAssets(kind: CuratedBenchAssetKind): readonly string[] {
    return Object.freeze(listJsonFiles(this.dirs[kind]).sort((left, right) => left.localeCompare(right)))
  }

  /**
   * Read and freeze one JSON asset.
   * @param kind - Asset class containing the file.
   * @param path - Safe POSIX-style relative path ending in `.json`.
   * @returns the parsed plain JSON value.
   * @throws when the path is unsafe, the target is not a contained stable regular
   * file, the read exceeds its limit, the content is malformed JSON, or the
   * parsed value is not plain JSON.
   */
  readAsset(kind: CuratedBenchAssetKind, path: string): CuratedBenchJson {
    const parsed = readContainedBenchmarkJson(
      this.dirs[kind],
      safeAssetPath(path),
      'curated benchmark asset path',
      'configured asset directory',
    )
    if (!isPlainJson(parsed)) throw new Error('curated benchmark asset must contain plain JSON')
    return deepFreeze(parsed)
  }
}

/**
 * Register `ctx.curatedBench` for the lifetime of this plugin fiber.
 * @param ctx - plugin context that owns the effect.
 * @param config - optional asset directory overrides.
 */
export function apply(ctx: Context, config: Config = {}): void {
  const service = new CuratedBench(config.dirs)
  ctx.effect(() => ctx.provide('curatedBench', service), 'curatedBench.provide')
}

function listJsonFiles(root: string): string[] {
  const output: string[] = []
  const pending = [{ relative: '', depth: 0 }]
  let entryCount = 0
  while (pending.length > 0) {
    const { relative, depth } = pending.pop() as typeof pending[number]
    const directory = opendirSync(join(root, relative), { bufferSize: 1 })
    try {
      for (;;) {
        const entry = directory.readSync()
        if (entry === null) break
        entryCount += 1
        if (entryCount > MAX_ASSET_ENTRIES) {
          throw new Error(`curated benchmark asset tree must contain at most ${String(MAX_ASSET_ENTRIES)} entries`)
        }
        const child = relative === '' ? entry.name : `${relative}/${entry.name}`
        if (entry.isDirectory()) {
          if (depth >= MAX_ASSET_DEPTH) {
            throw new Error(
              `curated benchmark asset tree must contain at most ${String(MAX_ASSET_DEPTH)} nested directory levels`,
            )
          }
          pending.push({ relative: child, depth: depth + 1 })
        }
        else if (entry.isFile() && entry.name.endsWith('.json')) output.push(child)
      }
    } finally {
      closeAssetDirectory(directory)
    }
  }
  return output
}

function closeAssetDirectory(directory: Dir): void {
  try {
    directory.closeSync()
  } catch {
    // A close failure cannot replace the traversal result or diagnostic.
  }
}

function safeAssetPath(path: string): string {
  if (path.length === 0 || path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    throw new Error('curated benchmark asset path must be a relative POSIX JSON path')
  }
  const normalized = posix.normalize(path)
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..' || !normalized.endsWith('.json')) {
    throw new Error('curated benchmark asset path must stay inside its asset directory and end in .json')
  }
  return normalized
}

function isPlainJson(value: unknown): value is CuratedBenchJson {
  if (value === null) return true
  const valueType = typeof value
  if (valueType === 'string' || valueType === 'boolean') return true
  if (valueType === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(item => isPlainJson(item))
  if (typeof value !== 'object') return false
  const prototype: unknown = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  return Object.values(value as Record<string, unknown>).every(item => isPlainJson(item))
}

function deepFreeze<T extends CuratedBenchJson>(value: T): T {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const item of Array.isArray(value) ? value : Object.values(value)) deepFreeze(item)
  }
  return value
}

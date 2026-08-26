/** Canonical JSON serialization for curated benchmark snapshot digests. @module @deepseek-ai/dsh-curated-bench/snapshot */

/**
 * Serialize a plain JSON value with object keys sorted recursively.
 * @param value - JSON-compatible value to serialize.
 * @returns deterministic JSON text used for curated rollback snapshot hashes.
 */
export function canonicalBenchmarkJson(value: unknown): string {
  return JSON.stringify(normalizedBenchmarkJson(value))
}

function normalizedBenchmarkJson(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') return value
  if (Array.isArray(value)) return value.map(item => normalizedBenchmarkJson(item))
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value)
      .sort()
      .map(key => [key, normalizedBenchmarkJson(value[key])]))
  }
  throw new Error('benchmark snapshots must contain plain JSON values')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

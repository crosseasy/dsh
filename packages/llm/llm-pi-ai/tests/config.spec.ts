import { describe, expect, it } from 'vitest'
import { describeForWire } from '@deepseek-ai/dsh-settings'
import { assertServiceable, Config } from '../src/config.ts'

/** Validate one hand-declared route, with the caller's fields layered onto it. */
const routeWith = (profile: Record<string, unknown>): (() => unknown) =>
  () => Config({
    providers: {
      'acme-gateway': {
        api: 'openai-completions',
        baseURL: 'https://acme.test',
        models: [{ id: 'm' }],
        ...profile,
      },
    },
  })

/** Validate that route with the caller's fields on its single model entry. */
const configWith = (model: Record<string, unknown>): (() => unknown) =>
  routeWith({ models: [{ id: 'm', ...model }] })

describe('reasoning schema boundary', () => {
  it('rejects a level pi-ai does not know at the write that produced it', () => {
    expect(configWith({ reasoningEfforts: { ultra: 'x' } })).toThrow(/"off"/)
    expect(configWith({ reasoningEfforts: { high: 42 } })).toThrow()
  })

  it('keeps false distinguishable from an absent declaration', () => {
    type Materialized = { providers: Record<string, { models?: { reasoningEfforts?: unknown }[] }> }
    const withFalse = configWith({ reasoningEfforts: false })() as Materialized
    expect(withFalse.providers['acme-gateway']?.models?.[0]?.reasoningEfforts).toBe(false)
    const absent = configWith({})() as Materialized
    expect(absent.providers['acme-gateway']?.models?.[0]?.reasoningEfforts).toBeUndefined()
  })

  it('rejects a thinking format outside the offered set', () => {
    expect(configWith({ compat: { thinkingFormat: 'quantum' } })).toThrow(/expected/)
  })
})

describe('modality schema boundary', () => {
  it('rejects a modality pi-ai does not know, at either level', () => {
    expect(configWith({ input: ['audio'] })).toThrow(/expected/)
    expect(routeWith({ defaultInput: ['text', 'audio'] })).toThrow(/expected/)
  })

  it('refuses a route whose models could accept nothing', () => {
    // The pair the settings seam runs: the schema accepts the empty list as
    // well-typed, and the namespace validator is what refuses it. Asserting
    // only the schema would report this route as writable.
    expect(routeWith({ defaultInput: [] })).not.toThrow()
    expect(() => { assertServiceable(routeWith({ defaultInput: [] })() as Config) })
      .toThrow(/defaultInput must name at least one modality/)
  })

  type Materialized = {
    providers: Record<string, { defaultInput?: unknown; models?: { input?: unknown }[] }>
  }

  it('materializes an absent entry list as empty and an absent route list as text', () => {
    // The empty-list inheritance rule exists because of exactly this: an entry
    // that declares nothing reaches resolution as `[]`, not as `undefined`.
    const absent = configWith({})() as Materialized
    expect(absent.providers['acme-gateway']?.models?.[0]?.input).toEqual([])
    expect(absent.providers['acme-gateway']?.defaultInput).toEqual(['text'])
  })
})

describe('request image policy bounds', () => {
  it.each([
    ['requestImagePixelBudget', 0, /requestImagePixelBudget must be a positive safe integer/],
    ['requestImagePixelBudget', Number.MAX_SAFE_INTEGER + 1, /requestImagePixelBudget must be a positive safe integer/],
    ['requestImageMaxBytes', 0, /requestImageMaxBytes must be a positive safe integer/],
    ['requestImageMaxBytes', 1.5, /requestImageMaxBytes must be a positive safe integer/],
  ] as const)('rejects %s=%s at service resolution', (field, value, message) => {
    const programmatic = {
      providers: {
        'acme-gateway': {
          api: 'openai-completions',
          baseURL: 'https://acme.test',
          models: [{ id: 'm' }],
          [field]: value,
        },
      },
    } as unknown as Config
    expect(() => {
      assertServiceable(programmatic)
    }).toThrow(message)
  })
})

describe('provider header schema', () => {
  it('marks the complete header dictionary as secret-bearing', () => {
    const providers = Config.dict?.['providers']
    const headers = providers?.inner?.dict?.['headers']

    expect(headers?.type).toBe('dict')
    expect(headers?.meta.role).toBe('secret')
    expect(routeWith({
      headers: {
        Authorization: 'Bearer route-secret',
        'api-key': 'route-secret',
      },
    })).not.toThrow()
  })

  it.each([
    ['omitted', {}, false],
    ['empty', { headers: {} }, false],
    ['non-empty', { headers: { 'x-private-header': 'private-header-value' } }, true],
  ] as const)('reports %s headers without exposing their names or values', (_kind, profile, set) => {
    const value = routeWith(profile)()
    let wire: ReturnType<typeof describeForWire> | undefined
    let errorText = ''
    try {
      wire = describeForWire(Config as never, { value })
    } catch (error) {
      errorText = String(error)
    }

    const observable = JSON.stringify({ wire, errorText })
    expect(observable).not.toContain('x-private-header')
    expect(observable).not.toContain('private-header-value')
    expect(JSON.stringify(wire?.schema)).not.toContain('x-private-header')
    expect(JSON.stringify(wire?.schema)).not.toContain('private-header-value')
    expect(wire?.value).not.toHaveProperty('providers.acme-gateway.headers')
    expect(wire?.secrets).toContainEqual({
      path: ['providers', 'acme-gateway', 'headers'],
      set,
    })
  })
})

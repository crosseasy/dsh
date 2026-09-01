import { describe, expect, it } from 'vitest'
import { queryServiceApi } from '../src/api-catalog.ts'

describe('tool-cordis API catalog', () => {
  it('includes the standing preset lease type used by agent preset cold readers', () => {
    const result = queryServiceApi('agentPresets') as {
      readonly referencedTypes: readonly { readonly name: string; readonly declaration: string }[]
    }
    const lease = result.referencedTypes.find(type => type.name === 'StandingPresetLease')

    expect(lease).toBeDefined()
    expect(lease?.declaration).toContain('export interface StandingPresetLease')
    expect(lease?.declaration).toContain('readonly presetId: string;')
    expect(lease?.declaration).toContain('readonly key: ScopeKey;')
    expect(lease?.declaration).toContain('release(): Promise<void>;')
  })
})

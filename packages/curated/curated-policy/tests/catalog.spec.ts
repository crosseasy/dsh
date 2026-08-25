import { readFileSync } from 'node:fs'
import * as yaml from 'js-yaml'
import { describe, expect, test } from 'vitest'

interface Rejection {
  code: string
  evidence: string
}

interface Candidate {
  id: string
  priority: 'P0' | 'P1' | 'P2'
  capability: string
  repository: string
  repositoryPath: string | null
  commit: string
  auditedAt: string
  manifestPath: string | null
  expectedPackage: string | null
  nodeEngine: string | null
  license: string | null
  bundlePatch: string | null
  testFiles: number
  ciWorkflows: number
  installScripts: Record<string, string>
  externalDependencies: string[]
  networkAccess: string[]
  credentials: string[]
  targetProfiles: string[]
  active: boolean
  rejections: Rejection[]
}

interface Catalog {
  schemaVersion: number
  source: {
    awesome: {
      repository: string
      commit: string
      file: string
    }
    matrix: string
  }
  candidates: Candidate[]
}

const expectedCandidates = {
  P0: [
    'dsh-toolkit',
    'dsh-context',
    'dsh-web-search-pro',
    'dsh-memento',
    'dsh-mcp-panel',
    'dsh-checkpoint-rewind',
    'dsh-lsp-actions',
    'dsh-permission-rules',
    'loongsuite-dsh-plugin',
    'dsh-config-manager',
  ],
  P1: [
    'dsh-smooth-stream',
    'upstream-radar',
    'dsh-plugin-hub',
    'plugin-session-export',
    'dsh-better-sidebar',
  ],
  P2: [
    'dsh-agent-team-gui',
    'dsh-background-agents',
    'dsh-computer-use',
    'dsh-vision-router',
    'dsh-llm-fallbacks',
    'dsh-univer-office',
    'dsh-feishu',
  ],
} satisfies Record<Candidate['priority'], string[]>

const catalogPath = new URL('../policy/plugin-allowlist.yaml', import.meta.url)

describe('curated plugin catalog', () => {
  test('records the complete P0, P1, and P2 candidate set', () => {
    const catalog = yaml.load(readFileSync(catalogPath, 'utf8')) as Catalog

    expect(catalog.schemaVersion).toBe(1)
    expect(catalog.source.awesome.repository).toBe('https://github.com/0xsline/awesome-deepseek-harness')
    expect(catalog.source.awesome.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(catalog.source.awesome.file).toBe('README.zh-CN.md')
    expect(catalog.source.matrix).toBe('docs/plugin/superpowers/02-插件矩阵与择优.md')

    for (const [priority, ids] of Object.entries(expectedCandidates)) {
      expect(catalog.candidates.filter(candidate => candidate.priority === priority).map(candidate => candidate.id))
        .toEqual(ids)
    }
  })

  test('records machine-verifiable audit facts for every candidate', () => {
    const catalog = yaml.load(readFileSync(catalogPath, 'utf8')) as Catalog
    const ids = catalog.candidates.map(candidate => candidate.id)

    expect(new Set(ids).size).toBe(ids.length)
    for (const candidate of catalog.candidates) {
      expect(candidate.id).toMatch(/^[a-z0-9-]+$/)
      expect(candidate.capability).not.toBe('')
      expect(candidate.repository).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/)
      expect(candidate.repositoryPath === null || candidate.repositoryPath.length > 0).toBe(true)
      expect(candidate.commit).toMatch(/^[0-9a-f]{40}$/)
      expect(candidate.auditedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(candidate.manifestPath === null || candidate.manifestPath.endsWith('package.json')).toBe(true)
      expect(candidate.expectedPackage === null || candidate.expectedPackage.length > 0).toBe(true)
      expect(candidate.nodeEngine === null || candidate.nodeEngine.length > 0).toBe(true)
      expect(candidate.license === null || candidate.license.length > 0).toBe(true)
      expect(candidate.bundlePatch === null || candidate.bundlePatch.length > 0).toBe(true)
      expect(candidate.testFiles).toBeGreaterThanOrEqual(0)
      expect(candidate.ciWorkflows).toBeGreaterThanOrEqual(0)
      expect(candidate.installScripts).toBeTypeOf('object')
      expect(Array.isArray(candidate.externalDependencies)).toBe(true)
      expect(Array.isArray(candidate.networkAccess)).toBe(true)
      expect(Array.isArray(candidate.credentials)).toBe(true)
      expect(Array.isArray(candidate.targetProfiles)).toBe(true)
      expect(Array.isArray(candidate.rejections)).toBe(true)

      for (const rejection of candidate.rejections) {
        expect(rejection.code).toMatch(/^[a-z0-9-]+$/)
        expect(rejection.evidence).not.toBe('')
      }
      if (candidate.rejections.length > 0) expect(candidate.active).toBe(false)
    }
  })
})

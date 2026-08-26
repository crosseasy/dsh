/**
 * Curated profile templates and DSH home materialization helpers.
 * @module @deepseek-ai/dsh-curated-profiles
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PROFILE_PATCH_FILENAME,
  resolveProfileDir,
  writeProfileManifest,
  type ProfileManifest,
} from '@deepseek-ai/dsh-app-boot'
import { loadCuratedCatalog } from '@deepseek-ai/dsh-curated-policy'
import { dump as dumpYaml, load as loadYaml } from 'js-yaml'

/** Profile names owned by the curated profile package. */
export type CuratedProfileName =
  | 'web-curated'
  | 'web-coding'
  | 'web-research'
  | 'web-enterprise'
  | 'web-personal'

/** One curated profile template. */
export interface CuratedProfileTemplate {
  /** Ordered bundle layers applied before the profile patch. */
  readonly bundles: readonly string[]
}

const BASE_BUNDLES = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-curated-base',
] as const

/** Active default candidate bundles shared by curated web profiles except `web-personal`. */
export const CURATED_BASELINE_BUNDLES = [
  '@deepseek-ai/dsh-toolkit',
  'dsh-web-search-pro',
  'dsh-memento',
  'dsh-mcp-panel',
  'dsh-checkpoint-rewind',
  'dsh-lsp-actions',
  'dsh-permission-rules',
  'dsh-smooth-stream',
  'upstream-radar',
  '@loongsuite/dsh-plugin',
] as const
const CODING_SCENARIO_BUNDLES = [] as const
const RESEARCH_SCENARIO_BUNDLES = [
  '@dsh-suite/plugin-session-export',
] as const
const ENTERPRISE_SCENARIO_BUNDLES = [] as const

const WEB_CURATED_BUNDLES = [...BASE_BUNDLES, ...CURATED_BASELINE_BUNDLES] as const

/** Deterministic curated profile templates keyed by profile name. */
export const CURATED_PROFILE_TEMPLATES: Readonly<Record<CuratedProfileName, CuratedProfileTemplate>> = Object.freeze({
  'web-curated': Object.freeze({
    bundles: Object.freeze([...WEB_CURATED_BUNDLES]),
  }),
  'web-coding': Object.freeze({
    bundles: Object.freeze([
      ...WEB_CURATED_BUNDLES,
      ...CODING_SCENARIO_BUNDLES,
    ]),
  }),
  'web-research': Object.freeze({
    bundles: Object.freeze([
      ...WEB_CURATED_BUNDLES,
      ...RESEARCH_SCENARIO_BUNDLES,
    ]),
  }),
  'web-enterprise': Object.freeze({
    bundles: Object.freeze([
      ...WEB_CURATED_BUNDLES,
      ...ENTERPRISE_SCENARIO_BUNDLES,
    ]),
  }),
  'web-personal': Object.freeze({
    bundles: Object.freeze([...BASE_BUNDLES]),
  }),
})

const PROFILE_PNPM_WORKSPACE = `packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
`
const PROFILE_NPMRC = 'ignore-scripts=true\n'

const INSTALLATION_OWNED_PROFILE_BUNDLES = new Set([
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-headless',
  '@deepseek-ai/dsh-curated-base',
])
const FULL_GIT_SHA_PATTERN = /^[0-9a-f]{40}$/u
const moduleRequire = createRequire(import.meta.url)

/** Profile manifest persisted for a materialized curated profile. */
export interface CuratedProfileManifest extends ProfileManifest {
  /** Profile directories are local install roots and are never published. */
  readonly private?: boolean
}

/**
 * Create package dependency declarations for profile bundles not supplied by the dsh installation.
 * @param bundles - Profile bundle names in layer order.
 * @param profileName - Profile that every third-party catalog row must explicitly target.
 * @returns package.json dependencies keyed by bundle package name.
 */
export function curatedProfileDependenciesForBundles(
  bundles: readonly string[],
  profileName: CuratedProfileName,
): Record<string, string> {
  const allowlisted = loadAllowlistedThirdPartyBundleDependencies(profileName)
  const dependencies: Record<string, string> = {}
  for (const bundle of bundles) {
    if (INSTALLATION_OWNED_PROFILE_BUNDLES.has(bundle)) continue
    const dependency = allowlisted.get(bundle)
    if (dependency === undefined) {
      throw new Error(`curated profile bundle ${JSON.stringify(bundle)} has no checked-in dependency source`)
    }
    if (dependency.spec === undefined) {
      if (!dependency.sourceVerified) {
        throw new Error(`curated profile bundle ${JSON.stringify(bundle)} is not active and verified for profile ${profileName}`)
      }
      throw new Error(`curated profile bundle ${JSON.stringify(bundle)} is not active and accepted for profile ${profileName}`)
    }
    dependencies[bundle] = dependency.spec
  }
  return dependencies
}

/**
 * Materialize one curated profile under a DSH home without overwriting existing files.
 * @param profileName - Curated profile template to write.
 * @param home - DSH home directory receiving `profiles/<profileName>`.
 * @returns the absolute profile directory.
 * @throws when an existing enterprise `.npmrc` does not disable lifecycle scripts.
 */
export function materializeCuratedProfile(profileName: CuratedProfileName, home: string): string {
  const template = CURATED_PROFILE_TEMPLATES[profileName]
  const dir = resolveProfileDir(profileName, home)
  const npmrcPath = join(dir, '.npmrc')
  if (profileName === 'web-enterprise' && existsSync(npmrcPath) && !npmrcDisablesScripts(readFileSync(npmrcPath, 'utf8'))) {
    throw new Error('web-enterprise requires ignore-scripts=true in its existing .npmrc')
  }
  mkdirSync(dir, { recursive: true })

  const manifestPath = join(dir, 'package.json')
  if (!existsSync(manifestPath)) {
    const manifest: CuratedProfileManifest = {
      name: `dsh-profile-${profileName}`,
      private: true,
      dependencies: curatedProfileDependenciesForBundles(template.bundles, profileName),
      dsh: { profile: { bundles: [...template.bundles] } },
    }
    writeProfileManifest(dir, manifest)
  }

  const patchPath = join(dir, PROFILE_PATCH_FILENAME)
  if (!existsSync(patchPath)) writeFileSync(patchPath, profilePatchFor(profileName, template.bundles))
  const workspacePath = join(dir, 'pnpm-workspace.yaml')
  if (!existsSync(workspacePath)) writeFileSync(workspacePath, PROFILE_PNPM_WORKSPACE)
  if (!existsSync(npmrcPath)) writeFileSync(npmrcPath, PROFILE_NPMRC)
  return dir
}

function profilePatchFor(profileName: CuratedProfileName, bundles: readonly string[]): string {
  const selectedBundles = new Set(bundles)
  const entries = loadCuratedCatalog(resolveAllowlistPath()).candidates.flatMap((candidate) => {
    if (
      !candidate.active
      || !candidate.targetProfiles.includes(profileName)
      || candidate.expectedPackage === null
      || !selectedBundles.has(candidate.expectedPackage)
      || candidate.config === undefined
    ) {
      return []
    }
    return [{ id: candidate.config.entryId, config: candidate.config.values }]
  })
  return dumpYaml(entries, { lineWidth: -1, noRefs: true })
}

function npmrcDisablesScripts(content: string): boolean {
  let setting: string | undefined
  for (const line of content.split(/\r?\n/u)) {
    const match = /^\s*ignore-scripts\s*=\s*([^\s#;]+)\s*(?:[#;].*)?$/iu.exec(line)
    if (match !== null) setting = match[1]?.toLowerCase()
  }
  return setting === 'true'
}

function loadAllowlistedThirdPartyBundleDependencies(
  profileName: CuratedProfileName,
): ReadonlyMap<string, { readonly sourceVerified: boolean; readonly spec?: string }> {
  const parsed = loadYaml(readFileSync(resolveAllowlistPath(), 'utf8'))
  if (!isRecord(parsed) || !Array.isArray(parsed.candidates)) {
    throw new Error('curated profile dependency allowlist must contain a candidates array')
  }

  const dependencies = new Map<string, { readonly sourceVerified: boolean; readonly spec?: string }>()
  parsed.candidates.forEach((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.expectedPackage !== 'string') return
    if (dependencies.has(candidate.expectedPackage)) {
      throw new Error(`curated profile dependency allowlist package ${candidate.expectedPackage} is duplicated`)
    }
    const active = requiredBoolean(candidate.active, `candidates[${String(index)}].active`)
    const rejections = requiredArray(candidate.rejections, `candidates[${String(index)}].rejections`)
    const targetProfiles = requiredStringArray(candidate.targetProfiles, `candidates[${String(index)}].targetProfiles`)
    const sourceVerified = verifiedSource(candidate.sourceStatus, `candidates[${String(index)}].sourceStatus`)
    if (!active || rejections.length > 0 || !targetProfiles.includes(profileName) || !sourceVerified) {
      dependencies.set(candidate.expectedPackage, { sourceVerified })
      return
    }
    const repository = requiredString(candidate.repository, `candidates[${String(index)}].repository`)
    const commit = requiredString(candidate.commit, `candidates[${String(index)}].commit`)
    const repositoryPath = nullableString(candidate.repositoryPath, `candidates[${String(index)}].repositoryPath`)
    if (!FULL_GIT_SHA_PATTERN.test(commit)) {
      throw new Error(`curated profile dependency allowlist ${candidate.expectedPackage} commit must be pinned`)
    }
    dependencies.set(candidate.expectedPackage, {
      sourceVerified,
      spec: gitDependencySpec(repository, commit, repositoryPath),
    })
  })
  return dependencies
}

function resolveAllowlistPath(): string {
  try {
    return join(dirname(moduleRequire.resolve('@deepseek-ai/dsh-curated-policy/package.json')), 'policy/plugin-allowlist.yaml')
  } catch {
    // Local source tests can run before pnpm has linked this new package dependency.
    /* v8 ignore next */
    return fileURLToPath(new URL('../../curated-policy/policy/plugin-allowlist.yaml', import.meta.url))
  }
}

function gitDependencySpec(repository: string, commit: string, repositoryPath: string | null): string {
  const url = repository.endsWith('.git') ? repository : `${repository}.git`
  return `git+${url}#${commit}${repositoryPath === null ? '' : `&path:${repositoryPath}`}`
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`curated profile dependency allowlist ${label} must be a non-empty string`)
  }
  return value
}

function requiredBoolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`curated profile dependency allowlist ${label} must be a boolean`)
  }
  return value
}

function verifiedSource(value: unknown, label: string): boolean {
  if (value === 'verified') return true
  if (value === 'unreachable') return false
  throw new Error(`curated profile dependency allowlist ${label} must be verified or unreachable`)
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`curated profile dependency allowlist ${label} must be a list`)
  }
  return value
}

function requiredStringArray(value: unknown, label: string): string[] {
  return requiredArray(value, label).map((item, index) =>
    requiredString(item, `${label}[${String(index)}]`))
}

function nullableString(value: unknown, label: string): string | null {
  if (value === null) return null
  if (typeof value === 'string' && value.length > 0) return value
  throw new Error(`curated profile dependency allowlist ${label} must be null or a non-empty string`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

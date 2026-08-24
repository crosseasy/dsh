/**
 * Rescope the vendored Cordis packages into the `@deepseek-ai` scope, and undo
 * that rescope with `--reverse`. Every harness package declares `cordis` as a
 * peer dependency, so publication carries this framework layer too; publishing
 * it under the upstream names would squat them on the registry
 * ([rationale](../.agents/notes/implemented/process/2026-08-10-vendor-package-rescope.md),
 * [name mapping](../docs/rescope.md)).
 *
 * The generic pass rewrites complete package-name tokens only when syntax or
 * package metadata identifies a module reference, plus `name: old` scalars on
 * YAML Loader entries and patches. Runtime, locale, data, and ordinary prose
 * values remain unchanged.
 * Markdown fences use their declared language, and `docs/` prose recognizes
 * explicit module calls without treating quoted package-like text as a module
 * reference. The scoped names do not match their upstream token patterns, so
 * applying the rewrite again is a no-op.
 *
 * Sites the token rule cannot express (dot-notation access, unquoted object
 * keys, regex literals, the vendored-manifest table) are listed in
 * {@link EXACT_EDITS} with an exact hit count, so an upstream change to one of
 * them fails loudly instead of being silently skipped.
 *
 * Usage: `pnpm run rescope-vendor [--apply|--check] [--reverse]`. Without a
 * mode it reports what would change. `--check` asserts the post-state: no
 * residue, every exact edit landed, every postcondition holds, and a second
 * `--apply` would be a no-op.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type * as JsYaml from 'js-yaml'
import type * as TypeScript from 'typescript'
import type * as Yaml from 'yaml'
import { isCordisConfigFile } from './cordis-config-files.ts'

const root = resolve(import.meta.dirname, '..')

function loadTypeScript(): typeof TypeScript {
  try {
    return createRequire(import.meta.url)('typescript') as typeof TypeScript
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') throw error
    return createRequire(resolve(process.cwd(), 'package.json'))('typescript') as typeof TypeScript
  }
}

const ts = loadTypeScript()

function loadJsYaml(): typeof JsYaml {
  try {
    return createRequire(import.meta.url)('js-yaml') as typeof JsYaml
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') throw error
    return createRequire(resolve(process.cwd(), 'package.json'))('js-yaml') as typeof JsYaml
  }
}

const jsYaml = loadJsYaml()

function loadYaml(): typeof Yaml {
  try {
    return createRequire(import.meta.url)('yaml') as typeof Yaml
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'MODULE_NOT_FOUND') throw error
    return createRequire(resolve(process.cwd(), 'package.json'))('yaml') as typeof Yaml
  }
}

const {
  isAlias,
  isMap,
  isNode,
  isScalar,
  isSeq,
  parseDocument,
} = loadYaml()

type YamlNode = Yaml.Node

const YAML_JS_EXPRESSION_TAG = 'tag:yaml.org,2002:js'

const YAML_JS_EXPRESSION = new jsYaml.Type(YAML_JS_EXPRESSION_TAG, {
  kind: 'scalar',
  resolve: value => typeof value === 'string',
  construct: value => ({ __jsExpr: String(value) }),
})

const YAML_LOADER_SCHEMA = jsYaml.JSON_SCHEMA.extend(YAML_JS_EXPRESSION)

const YAML_CST_JS_EXPRESSION: Yaml.ScalarTag = {
  tag: YAML_JS_EXPRESSION_TAG,
  resolve: (value: string) => value,
}

/** One vendored package's directory, upstream npm name, and rescoped name. */
interface Rename {
  readonly directory: string
  readonly upstream: string
  readonly scoped: string
}

/** The mapping this codemod applies; `vendor/README.md` carries the same table. */
const RENAMES: readonly Rename[] = [
  { directory: 'cordis', upstream: 'cordis', scoped: '@deepseek-ai/cordis' },
  { directory: 'cosmokit', upstream: 'cosmokit', scoped: '@deepseek-ai/cosmokit' },
  { directory: 'schemastery', upstream: 'schemastery', scoped: '@deepseek-ai/schemastery' },
  { directory: 'loader', upstream: '@cordisjs/plugin-loader', scoped: '@deepseek-ai/cordis-plugin-loader' },
  { directory: 'include', upstream: '@cordisjs/plugin-include', scoped: '@deepseek-ai/cordis-plugin-include' },
  { directory: 'group', upstream: '@cordisjs/plugin-group', scoped: '@deepseek-ai/cordis-plugin-group' },
  { directory: 'timer', upstream: '@cordisjs/plugin-timer', scoped: '@deepseek-ai/cordis-plugin-timer' },
  { directory: 'hmr', upstream: '@cordisjs/plugin-hmr', scoped: '@deepseek-ai/cordis-plugin-hmr' },
  { directory: 'logger-console', upstream: '@cordisjs/plugin-logger-console', scoped: '@deepseek-ai/cordis-plugin-logger-console' },
]

const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.tpl', '.json', '.yml', '.yaml', '.md'] as const

/** An exact-string edit the token rule cannot express, with its required hit count. */
interface ExactEdit {
  readonly id: string
  readonly file: string
  readonly find: string
  readonly replace: string
  readonly expect: number
}

/**
 * A file where an upstream name also appears as a vendor DIRECTORY name or an
 * upstream runtime identifier: the generic pass is disabled for the listed
 * names and {@link EXACT_EDITS} renames the real package-name occurrences.
 */
interface GenericSkip {
  readonly file: string
  readonly upstream: readonly string[]
}

const GENERIC_SKIPS: readonly GenericSkip[] = [
  // `vendorPackages` lists vendor/ directory names, joined with 'vendor' below it.
  { file: 'packages/examples/acp-demo/tests/built-bin.e2e.ts', upstream: ['cordis', 'cosmokit', 'schemastery'] },
  // `Symbol.for('schemastery')` and the `vendor:` metadata field are upstream identifiers.
  { file: 'vendor/schemastery/src/index.ts', upstream: ['schemastery'] },
  // Asserts the vendored-manifest table, which gains an upstream-name column.
  { file: 'scripts/gen-third-party-notices.spec.ts', upstream: RENAMES.map(rename => rename.upstream) },
  // `cordis` is also an agent-preset id — the directory name under
  // apps/cli/config/agent-presets/ — so in these files the bare name is
  // product data, not a package reference. Renaming it changed which preset
  // the creator flow stages and which id the roster reports.
  { file: 'packages/client/ui-agent-preset/src/client/AgentPresetSection.tsx', upstream: ['cordis'] },
  { file: 'packages/client/ui-agent-preset/src/client/index.ts', upstream: ['cordis'] },
  { file: 'packages/client/ui-agent-preset/tests/apply.client.spec.ts', upstream: ['cordis'] },
  { file: 'packages/client/ui-agent-preset/tests/locales.client.spec.ts', upstream: ['cordis'] },
  { file: 'packages/client/ui-agent-preset/tests/section.client.spec.tsx', upstream: ['cordis'] },
  { file: 'apps/cli/tests/web-agent-presets.e2e.ts', upstream: ['cordis'] },
  { file: 'apps/web/tests/agent-preset-authoring.e2e.ts', upstream: ['cordis'] },
  { file: 'packages/preset/agent-presets/tests/session.spec.ts', upstream: ['cordis'] },
  // The preset's own composition: its header comment and its system prompt name
  // the preset a model mounts, so the scoped name would send the model after an
  // id no roster reports.
  { file: 'apps/cli/config/agent-presets/cordis/agent.cordis.yml', upstream: ['cordis'] },
  // The preset-roster loop names the `cordis` preset id, not a package.
  { file: 'apps/cli/tests/windows-shell.spec.ts', upstream: ['cordis'] },
  // Unit fixtures intentionally keep pre-rescope tokens as sample input.
  { file: 'scripts/rescope-vendor.spec.ts', upstream: ['cordis'] },
  // GROUP_ORDER holds `packages/<group>/` directory names, not package names.
  { file: 'scripts/gen-module-graph.ts', upstream: ['cordis'] },
  { file: 'scripts/gen-doc-graphs.ts', upstream: ['cordis'] },
  // `cordis/*` is the extensions event domain, not a package subpath. The
  // generated catalogs and every producer/consumer must preserve that wire id.
  { file: 'docs/event-producer-consumer.md', upstream: ['cordis'] },
  { file: 'docs/event-producer-consumer.zh.md', upstream: ['cordis'] },
  { file: 'docs/subsystems/extensions.md', upstream: ['cordis'] },
  { file: 'docs/subsystems/extensions.zh.md', upstream: ['cordis'] },
  { file: 'packages/api/remotes/src/remote-events.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-client-runner/src/client/index.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-client-runner/src/client/runtime.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-client-runner/tests/orchestrator.client.spec.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-client-runner/tests/plugin.client.spec.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-host-runner/src/index.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-host-runner/src/inspect-registry.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-host-runner/src/types.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-host-runner/tests/helpers.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-host-runner/tests/runner.spec.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/cordis-host-runner/tests/versioning.spec.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/tool-cordis/src/api-catalog.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/tool-cordis/src/providers.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/ui-cordis/src/client/index.ts', upstream: ['cordis'] },
  { file: 'packages/extensions/ui-cordis/src/client/inventory.ts', upstream: ['cordis'] },
  { file: 'scripts/gen-cordis-catalog.ts', upstream: ['cordis'] },
  // The UI locale namespace and input-trigger source id are product keys.
  { file: 'packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.tsx', upstream: ['cordis'] },
  { file: 'packages/extensions/ui-cordis/src/client/CordisActionRow.tsx', upstream: ['cordis'] },
  { file: 'packages/extensions/ui-cordis/src/client/CordisDefineRow.tsx', upstream: ['cordis'] },
  { file: 'packages/extensions/ui-cordis/src/client/CordisPanel.tsx', upstream: ['cordis'] },
  { file: 'packages/extensions/ui-cordis/src/client/CordisRunRow.tsx', upstream: ['cordis'] },
  { file: 'packages/extensions/ui-cordis/src/client/locales.ts', upstream: ['cordis'] },
]

/** A string that must appear exactly `count` times once the rescope has run. */
interface PostCondition {
  readonly file: string | null
  readonly text: string
  readonly count: number
}

const CORDIS_RUNTIME_EVENT_SUFFIXES = [
  'request-run',
  'request-run-resolved',
  'dynamic-package',
  'dynamic-retract',
  'inspect-query',
  'inspect-query-resolved',
] as const

const POSTCONDITIONS: readonly PostCondition[] = [
  { file: 'vendor/cordis/package.json', text: '"name": "@deepseek-ai/cordis"', count: 1 },
  { file: 'vendor/hmr/package.json', text: '"name": "@deepseek-ai/cordis-plugin-hmr"', count: 1 },
  { file: 'scripts/cordis-walk.ts', text: '@deepseek-ai\\/cordis', count: 1 },
  { file: 'scripts/cordis-walk.ts', text: '!== \'@deepseek-ai/cordis\'', count: 1 },
  { file: 'scripts/gen-scoped-events.ts', text: '=== \'@deepseek-ai/cordis\'', count: 1 },
  { file: 'packages/typert/generator/src/analyzer.ts', text: '!== \'@deepseek-ai/cordis\'', count: 2 },
  { file: 'scripts/check-workspace-constraints.ts', text: '?.[\'@deepseek-ai/cordis\']', count: 2 },
  { file: 'packages/boot/app-boot/tsdown.config.ts', text: '[\'@deepseek-ai/cordis-plugin-include\']', count: 1 },
  { file: 'tsconfig.base.json', text: '"@deepseek-ai/cordis-plugin-loader": ["./vendor/loader/src"]', count: 1 },
  // The vendored README owns this required entry; reject its deletion or duplication.
  { file: 'vendor/README.md', text: '17. **`@deepseek-ai` rescope**', count: 1 },
  { file: 'knip.json', text: '@cordisjs', count: 0 },
  { file: 'pnpm-workspace.yaml', text: 'cordis@4.0.0-rc.7', count: 0 },
  // The preset ids in this table are product data, not package names.
  { file: 'packages/client/ui-agent-preset/tests/locales.client.spec.ts', text: '[\'cordis\', \'presetCordisName\'', count: 1 },
  // The preset id the shipped composition documents to its own model.
  { file: 'apps/cli/config/agent-presets/cordis/agent.cordis.yml', text: 'The `cordis` agent preset', count: 1 },
  { file: 'apps/cli/config/agent-presets/cordis/agent.cordis.yml', text: 'corrupting the `cordis` preset', count: 1 },
  { file: 'packages/examples/acp-demo/tests/built-bin.e2e.ts', text: '\'cordis\', \'loader\', \'include\', \'timer\', \'hmr\', \'logger-console\',', count: 1 },
  { file: 'packages/extensions/ui-cordis/src/client/locales.ts', text: 'export const NS = \'cordis\'', count: 1 },
  { file: 'packages/extensions/ui-cordis/src/client/index.ts', text: 'name: \'cordis\',', count: 1 },
  { file: 'packages/extensions/ui-cordis/src/client/CordisActionRow.tsx', text: 'PropsLocale<\'cordis\'>', count: 1 },
  { file: 'packages/extensions/ui-cordis/src/client/CordisDefineRow.tsx', text: 'PropsLocale<\'cordis\'>', count: 1 },
  { file: 'packages/extensions/ui-cordis/src/client/CordisPanel.tsx', text: 'PropsLocale<\'cordis\'>', count: 1 },
  { file: 'packages/extensions/ui-cordis/src/client/CordisRunRow.tsx', text: 'PropsLocale<\'cordis\'>', count: 1 },
  {
    file: 'packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.tsx',
    text: 't(\'cordis\')',
    count: 1,
  },
  ...CORDIS_RUNTIME_EVENT_SUFFIXES.flatMap(suffix => [
    {
      file: 'packages/extensions/cordis-host-runner/src/types.ts',
      text: `'cordis/${suffix}'`,
      count: 1,
    },
    { file: null, text: `@deepseek-ai/cordis/${suffix}`, count: 0 },
  ]),
]

/**
 * Every exact edit, in application order. Each `find` is written against the
 * PRE-rename text because these run before the generic pass, so no `find` may
 * quote a neighbouring line the generic pass would rewrite.
 */
const EXACT_EDITS: readonly ExactEdit[] = [
  {
    id: 'cordis-walk-merge-head',
    file: 'scripts/cordis-walk.ts',
    find: 'const MERGE_HEAD = /declare module [\'"](?:cordis|\\.\\/context\\.ts)[\'"]/',
    replace: 'const MERGE_HEAD = /declare module [\'"](?:@deepseek-ai\\/cordis|\\.\\/context\\.ts)[\'"]/',
    expect: 1,
  },
  {
    id: 'constraints-manifest-lookup',
    file: 'scripts/check-workspace-constraints.ts',
    find: `    const peer = manifest.peerDependencies?.cordis
    const dev = manifest.devDependencies?.cordis

    if (!peer) errors.push(\`\${label}: cordis must be a peerDependency\`)
    if (!dev) errors.push(\`\${label}: cordis must also be a devDependency\`)
    if (peer && dev && peer !== dev) {
      errors.push(\`\${label}: cordis peer (\${peer}) and dev (\${dev}) ranges must match\`)`,
    replace: `    const peer = manifest.peerDependencies?.['@deepseek-ai/cordis']
    const dev = manifest.devDependencies?.['@deepseek-ai/cordis']

    if (!peer) errors.push(\`\${label}: @deepseek-ai/cordis must be a peerDependency\`)
    if (!dev) errors.push(\`\${label}: @deepseek-ai/cordis must also be a devDependency\`)
    if (peer && dev && peer !== dev) {
      errors.push(\`\${label}: @deepseek-ai/cordis peer (\${peer}) and dev (\${dev}) ranges must match\`)`,
    expect: 1,
  },
  {
    id: 'knip-bundle-base',
    file: 'knip.json',
    find: `    "packages/bundle/base": {
      "ignoreDependencies": [
        "@deepseek-ai/.+",
        "@cordisjs/.+"
      ]`,
    replace: `    "packages/bundle/base": {
      "ignoreDependencies": [
        "@deepseek-ai/.+"
      ]`,
    expect: 1,
  },
  {
    // Rescoped packages are never fetched from a registry, so the exclusion is dead config.
    id: 'pnpm-release-age',
    file: 'pnpm-workspace.yaml',
    find: `minimumReleaseAgeExclude:
  # Cordis release candidates are source-vendored and pinned in vendor/README.md
  # during the same-day sync that updates package manifests and the lockfile.
  - '@cordisjs/plugin-loader@1.0.0-rc.5'
  - cordis@4.0.0-rc.7
`,
    replace: 'minimumReleaseAgeExclude:\n',
    expect: 1,
  },
  {
    id: 'publication-set-scope-assertion',
    file: 'scripts/publish-npm-baseline.ts',
    find: '      if (!isVendored && !name.startsWith(\'@deepseek-ai/\')) {',
    replace: `      // Vendored packages are rescoped too (vendor/README.md), so publication
      // never carries an upstream name that would squat it on the registry.
      if (!name.startsWith('@deepseek-ai/')) {`,
    expect: 1,
  },
  {
    id: 'vendor-readme-preamble',
    file: 'vendor/README.md',
    find: 'All vendored packages keep their **original npm names** and are marked `private: true` — they are never published from this repo. `pnpm-workspace.yaml#linkWorkspacePackages` makes matching upstream semver ranges resolve these pinned workspaces, including imports from built `lib/`; disabling it substitutes npm copies behind the same names.',
    replace: 'All vendored packages are **renamed into the `@deepseek-ai` scope** (`cordis` → `@deepseek-ai/cordis`, `@cordisjs/plugin-<x>` → `@deepseek-ai/cordis-plugin-<x>`): every harness package declares `cordis` as a peer dependency, so publishing the harness publishes this framework layer too, and a publication under the upstream names would squat them on the registry. Directory names and upstream version numbers are deliberately unchanged, so the manifest below still reads as an upstream snapshot. `pnpm-workspace.yaml#linkWorkspacePackages` makes those preserved semver ranges resolve these pinned workspaces, including imports from built `lib/`.',
    expect: 1,
  },
  {
    id: 'vendor-readme-schemastery-note',
    file: 'vendor/README.md',
    find: 'whose lazy `require(\'cosmokit\')` can race',
    replace: 'whose lazy `require(\'@deepseek-ai/cosmokit\')` can race',
    expect: 1,
  },
  {
    id: 'vendor-readme-table-head',
    file: 'vendor/README.md',
    find: '| Directory | npm name | Version | Upstream repo | Commit |\n|---|---|---|---|---|',
    replace: '| Directory | npm name | Upstream name | Version | Upstream repo | Commit |\n|---|---|---|---|---|---|',
    expect: 1,
  },
  {
    // A plain fence listing the bundle's mounted tree: a bare token, no quotes.
    id: 'agent-spine-demo-mounted-tree',
    file: 'packages/examples/agent-spine-demo/README.md',
    find: '@cordisjs/plugin-timer            timer service',
    replace: '@deepseek-ai/cordis-plugin-timer  timer service',
    expect: 1,
  },
  {
    id: 'agent-spine-demo-mounted-tree-zh',
    file: 'packages/examples/agent-spine-demo/README.zh.md',
    find: '@cordisjs/plugin-timer            timer service',
    replace: '@deepseek-ai/cordis-plugin-timer  timer service',
    expect: 1,
  },
  {
    // The root contract claimed vendored packages keep their upstream names.
    id: 'root-agents-vendored-name-contract',
    file: 'AGENTS.md',
    find: 'vendored packages keep upstream names and are `private: true`. `cordis` is a peerDependency (+ dev) of every harness package.',
    replace: 'vendored packages are rescoped ([mapping](docs/rescope.md)) and `private: true`. `@deepseek-ai/cordis` is a peerDependency (+ dev) of every harness package.',
    expect: 1,
  },
  {
    // The client purity gate reads `@deepseek-ai/` as "another plugin package".
    // The rescope moves the vendored framework and its libraries into that
    // namespace, where the gate would reject the library imports client
    // bundles have always inlined, so it needs their names.
    id: 'client-purity-vendored-libraries',
    file: 'packages/client/tsdown.client.ts',
    find: '/** Generated descriptor/codec contribution with no shared runtime identity. */',
    replace: `/**
 * Vendored framework libraries: rescoped into @deepseek-ai, so the gate below
 * would read them as plugin packages. They carry no cross-plugin runtime
 * identity to share — the framework itself is a requested module-table row
 * (external), while these are ordinary libraries a browser bundle inlines.
 */
const VENDORED_LIBRARY = /^@deepseek-ai\\/(cosmokit|schemastery)(\\/|$)/

/** Generated descriptor/codec contribution with no shared runtime identity. */`,
    expect: 1,
  },
  {
    id: 'client-purity-vendored-libraries-predicate',
    file: 'packages/client/tsdown.client.ts',
    find: '        if (INLINE_SAFE.test(source) || GENERATED_REMOTE.test(source)) return null // wire contribution: inline is the point',
    replace: `        if (VENDORED_LIBRARY.test(source)) return null // vendored library: inline, no shared identity
        if (INLINE_SAFE.test(source) || GENERATED_REMOTE.test(source)) return null // wire contribution: inline is the point`,
    expect: 1,
  },
  {
    // The step-1 file tree told the reader to keep the upstream name, one
    // paragraph above the invariant that says to rescope it.
    id: 'vendoring-cookbook-tree-comment',
    file: 'docs/cookbook/adding-a-vendored-package.md',
    find: '  package.json     # from upstream; set "private": true, keep name/exports/type',
    replace: '  package.json     # from upstream; set "private": true, rescope the name, keep exports/type',
    expect: 1,
  },
  {
    id: 'vendoring-cookbook-tree-comment-zh',
    file: 'docs/cookbook/adding-a-vendored-package.zh.md',
    find: '  package.json     # from upstream; set "private": true, keep name/exports/type',
    replace: '  package.json     # from upstream; set "private": true, rescope the name, keep exports/type',
    expect: 1,
  },
  {
    // The checklist told the next vendoring to keep upstream's name.
    id: 'vendoring-cookbook-name-invariant',
    file: 'docs/cookbook/adding-a-vendored-package.md',
    find: "keep upstream's `name`/`version`/`exports`/`type`",
    replace: "rescope the `name` ([mapping](../rescope.md)) while keeping upstream's `version`/`exports`/`type`",
    expect: 1,
  },
  {
    id: 'vendoring-cookbook-name-invariant-zh',
    file: 'docs/cookbook/adding-a-vendored-package.zh.md',
    find: '保留上游的 `name`/`version`/`exports`/`type`',
    replace: '改写 `name` 的 scope（[映射](../rescope.zh.md)），保留上游的 `version`/`exports`/`type`',
    expect: 1,
  },
  {
    // The real package references in files whose other `cordis` strings are preset ids.
    id: 'agent-preset-spec-framework-import',
    file: 'packages/client/ui-agent-preset/tests/apply.client.spec.ts',
    find: "import { Context } from 'cordis'",
    replace: "import { Context } from '@deepseek-ai/cordis'",
    expect: 1,
  },
  {
    id: 'web-agent-presets-e2e-framework-import',
    file: 'apps/cli/tests/web-agent-presets.e2e.ts',
    find: "import { Context } from 'cordis'",
    replace: "import { Context } from '@deepseek-ai/cordis'",
    expect: 1,
  },
  {
    id: 'notices-vendored-row-type',
    file: 'scripts/gen-third-party-notices.ts',
    find: `export interface VendoredRow {
  npmName: string
  upstream: string
}`,
    replace: `export interface VendoredRow {
  npmName: string
  /** The name this package carries upstream; MIT attribution names the fork's origin, not our scope. */
  upstreamName: string
  upstream: string
}`,
    expect: 1,
  },
  {
    id: 'notices-vendored-row-parse',
    file: 'scripts/gen-third-party-notices.ts',
    find: `    const match = /^\\| \\x60\\S+\\/\\x60 \\| \\x60([^\\x60]+)\\x60 \\| \\S+ \\| (https:\\/\\/\\S+?)(?: \\([^)]*\\))? \\| \\x60[0-9a-f]+\\x60 \\|$/.exec(line)
    if (match === null) continue
    const [, npmName, upstream] = match
    if (npmName === undefined || upstream === undefined) continue
    rows.push({ npmName, upstream })`,
    replace: `    const match = new RegExp(String.raw\`^\\| \\x60\\S+\\/\\x60 \\| \\x60([^\\x60]+)\\x60 \\| \\x60([^\\x60]+)\\x60 \\| \\S+ \\| \`
      + String.raw\`(https:\\/\\/\\S+?)(?: \\([^)]*\\))? \\| \\x60[0-9a-f]+\\x60 \\|$\`).exec(line)
    if (match === null) continue
    const [, npmName, upstreamName, upstream] = match
    if (npmName === undefined || upstreamName === undefined || upstream === undefined) continue
    rows.push({ npmName, upstreamName, upstream })`,
    expect: 1,
  },
  {
    id: 'notices-vendored-section',
    file: 'scripts/gen-third-party-notices.ts',
    find: 'The Cordis framework and its foundation libraries are source-vendored into this repository rather than consumed from npm. All are MIT-licensed',
    replace: 'The Cordis framework and its foundation libraries are source-vendored into this repository rather than consumed from npm, and republished under the \\`@deepseek-ai\\` scope. All are MIT-licensed',
    expect: 1,
  },
  {
    id: 'notices-vendored-table',
    file: 'scripts/gen-third-party-notices.ts',
    find: `| Package | Upstream | License |
| --- | --- | --- |
\${vendored.map(row => \`| \\\`\${row.npmName}\\\` | [\${row.upstream.replace('https://', '')}](\${row.upstream}) | MIT |\`).join('\\n')}`,
    replace: `| Package | Upstream name | Upstream | License |
| --- | --- | --- | --- |
\${vendored.map(row => \`| \\\`\${row.npmName}\\\` | \\\`\${row.upstreamName}\\\` | [\${row.upstream.replace('https://', '')}](\${row.upstream}) | MIT |\`).join('\\n')}`,
    expect: 1,
  },
  {
    id: 'notices-spec-row-fixture',
    file: 'scripts/gen-third-party-notices.spec.ts',
    find: '    expect(rows).toContainEqual({ npmName: \'cordis\', upstream: \'https://github.com/cordiverse/cordis\' })',
    replace: `    expect(rows).toContainEqual({
      npmName: '@deepseek-ai/cordis',
      upstreamName: 'cordis',
      upstream: 'https://github.com/cordiverse/cordis',
    })`,
    expect: 1,
  },
  {
    id: 'notices-spec-shape-fixture',
    file: 'scripts/gen-third-party-notices.spec.ts',
    find: 'parseVendoredRows(\'| `cordis/` | cordis | 4.0.0 | https://example.com | `abc123` |\\n\')',
    replace: 'parseVendoredRows(\'| `cordis/` | `@deepseek-ai/cordis` | cordis | 4.0.0 | https://example.com | `abc123` |\\n\')',
    expect: 1,
  },
  {
    // The framework peer is no longer a registry name, so the rehearsal must install this
    // repository's vendored copies; cosmokit comes along as cordis's own dependency.
    id: 'packed-install-vendored-peer',
    file: 'packages/sandbox/sandbox-local/tests/packed-install.e2e.ts',
    find: `  'packages/runtime-diagnostics/invariants',
]`,
    replace: `  'packages/runtime-diagnostics/invariants',
  // The framework and the vendored packages the closure declares outright:
  // rescoped into @deepseek-ai, so the consumer installs this repository's
  // copies. Schemastery is a hard dependency of three members above, not a
  // peer, so npm resolves it while installing them.
  'vendor/cordis',
  'vendor/cosmokit',
  'vendor/schemastery',
]`,
    expect: 1,
  },
  {
    id: 'packed-install-registry-spec',
    file: 'packages/sandbox/sandbox-local/tests/packed-install.e2e.ts',
    find: `    // Peer ranges resolve to the tarballs; Cordis is pinned to their peer range. Do not omit optional
    // dependencies because the launcher selects its OS/CPU package through one.
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'dsh-packed-consumer', private: true, type: 'module' }))
    const install = spawnSync('npm', ['install', '--no-audit', '--no-fund', ...tarballs, 'cordis@4.0.0-rc.7'], {`,
    replace: `    // Peer ranges resolve to the tarballs, the framework peer included. Do not omit optional
    // dependencies because the launcher selects its OS/CPU package through one.
    writeFileSync(join(consumerDir, 'package.json'), JSON.stringify({ name: 'dsh-packed-consumer', private: true, type: 'module' }))
    const install = spawnSync('npm', ['install', '--no-audit', '--no-fund', ...tarballs], {`,
    expect: 1,
  },
  {
    id: 'packed-install-module-doc',
    file: 'packages/sandbox/sandbox-local/tests/packed-install.e2e.ts',
    find: ` * Keyless publish-path rehearsal. It packs the provider, its workspace peers, and the current
 * repository's Landlock entry/platform packages, then installs those exact tarballs in an external
 * plain-Node consumer. The host launcher comes from the exact local tarballs, so no registry copy,
 * tsx, path mapping, or workspace resolution can hide missing files, dependency errors, or lost
 * executable modes.`,
    replace: ` * Keyless publish-path rehearsal. It packs the provider, its workspace peers, the vendored framework
 * peer, and the current repository's Landlock entry/platform packages, then installs those exact
 * tarballs in an external plain-Node consumer. The host launcher comes from the exact local tarballs,
 * so no registry copy, tsx, path mapping, or workspace resolution can hide missing files, dependency
 * errors, or lost executable modes.`,
    expect: 1,
  },
  // The manifest table's name column plus the new upstream-name column, one edit per row.
  ...RENAMES.map(rename => ({
    id: `vendor-readme-row-${rename.directory}`,
    file: 'vendor/README.md',
    find: `| \`${rename.directory}/\` | \`${rename.upstream}\` | `,
    replace: `| \`${rename.directory}/\` | \`${rename.scoped}\` | \`${rename.upstream}\` | `,
    expect: 1,
  })),
]

/** Files the rescope must never rewrite. */
function excluded(file: string): boolean {
  if (file === 'scripts/rescope-vendor.ts') return true // the mapping itself
  if (file.startsWith('.agents/notes/')) return true // notes record what was true when written
  // Recorded model payloads quote documentation verbatim, so they must mirror the
  // sources on disk — including the notes this rescope leaves alone.
  if (file.startsWith('scripts/snapshots/')) return true
  // The mapping documents state both names on purpose.
  if (file === 'docs/rescope.md' || file === 'docs/rescope.zh.md') return true
  if (file.endsWith('.i18n.yaml')) return true // blob-hash records, re-recorded by the pairing gate
  if (file === 'pnpm-lock.yaml') return true // regenerated by pnpm install
  if (/^vendor\/[^/]+\/(README\.md|LICENSE)$/.test(file)) return true // upstream files kept verbatim
  return !EXTENSIONS.some(extension => file.endsWith(extension))
}

/**
 * Filter tracked paths to existing files eligible for the generic rescope pass.
 * @param trackedFiles - Repository-relative paths reported by `git ls-files`.
 * @param fileExists - Predicate run against each resolved path.
 * @param resolveFile - Converts a repository-relative path to a filesystem path.
 * @returns Existing tracked files that generic traversal may read and rewrite.
 */
export function trackedExistingEligibleFiles(
  trackedFiles: readonly string[],
  fileExists: (path: string) => boolean = existsSync,
  resolveFile: (file: string) => string = file => resolve(root, file),
): string[] {
  return trackedFiles.filter(file => file !== '' && !excluded(file) && fileExists(resolveFile(file)))
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** One name's rewrite, precompiled for both delimited forms. */
interface Pattern {
  readonly upstream: string
  readonly from: string
  readonly to: string
  readonly token: RegExp
}

function patterns(reverse: boolean): Pattern[] {
  return RENAMES
    .map(rename => ({
      upstream: rename.upstream,
      from: reverse ? rename.scoped : rename.upstream,
      to: reverse ? rename.upstream : rename.scoped,
    }))
    .sort((left, right) => {
      if (left.upstream === 'cordis') return -1
      if (right.upstream === 'cordis') return 1
      return right.from.length - left.from.length
    })
    .map(rename => ({
      ...rename,
      token: new RegExp(`(['"\`])${escapeRegExp(rename.from)}((?:/[^'"\`\\s]*)?)\\1`, 'g'),
    }))
}

function skipped(file: string, pattern: Pattern): boolean {
  return GENERIC_SKIPS.some(skip => skip.file === file && skip.upstream.includes(pattern.upstream))
}

interface SourceRegion {
  readonly kind: 'fence' | 'prose'
  readonly info?: string
  readonly start: number
  readonly text: string
}

function markdownRegions(text: string): readonly SourceRegion[] {
  const regions: SourceRegion[] = []
  let cursor = 0
  let regionStart = 0
  let fence: { marker: string; length: number; bodyStart: number; info?: string } | undefined
  while (cursor < text.length) {
    const newline = text.indexOf('\n', cursor)
    const next = newline < 0 ? text.length : newline + 1
    const line = text.slice(cursor, newline < 0 ? text.length : newline).replace(/\r$/, '')
    const marker = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(line)
    if (fence === undefined && marker?.[1] !== undefined) {
      if (regionStart < cursor) {
        regions.push({ kind: 'prose', start: regionStart, text: text.slice(regionStart, cursor) })
      }
      const info = marker[2]?.trim()
      fence = {
        marker: marker[1][0] ?? '',
        length: marker[1].length,
        bodyStart: next,
        ...(info === undefined || info === '' ? {} : { info }),
      }
    } else if (fence !== undefined
      && marker?.[1] !== undefined
      && marker[1][0] === fence.marker
      && marker[1].length >= fence.length
      && marker[2]?.trim() === '') {
      regions.push({
        kind: 'fence',
        ...(fence.info === undefined ? {} : { info: fence.info }),
        start: fence.bodyStart,
        text: text.slice(fence.bodyStart, cursor),
      })
      fence = undefined
      regionStart = next
    }
    cursor = next
  }
  if (fence !== undefined) {
    regions.push({
      kind: 'fence',
      ...(fence.info === undefined ? {} : { info: fence.info }),
      start: fence.bodyStart,
      text: text.slice(fence.bodyStart),
    })
  } else if (regionStart < text.length) {
    regions.push({ kind: 'prose', start: regionStart, text: text.slice(regionStart) })
  }
  return regions
}

function moduleCallToken(node: TypeScript.CallExpression): TypeScript.Node | undefined {
  if (node.questionDotToken !== undefined) return undefined
  const expression = node.expression
  if (expression.kind === ts.SyntaxKind.ImportKeyword) return expression
  if (ts.isIdentifier(expression)) return expression.text === 'require' ? expression : undefined
  if (!ts.isPropertyAccessExpression(expression)
    || expression.questionDotToken !== undefined) return undefined
  if (expression.name.text === 'require'
    && ts.isIdentifier(expression.expression)
    && expression.expression.text === 'module') {
    return expression.name
  }
  if (expression.name.text !== 'resolve') return undefined
  if (ts.isIdentifier(expression.expression)) {
    return expression.expression.text === 'require' ? expression.expression : undefined
  }
  if (ts.isMetaProperty(expression.expression)
    && expression.expression.keywordToken === ts.SyntaxKind.ImportKeyword
    && expression.expression.name.text === 'meta') {
    return expression.expression
  }
  return undefined
}

function sourceScriptKind(file: string, region: SourceRegion): TypeScript.ScriptKind {
  const language = region.info?.split(/\s+/, 1)[0]?.toLowerCase()
  if (language === 'tsx' || file.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (language === 'jsx' || file.endsWith('.jsx')) return ts.ScriptKind.JSX
  return ts.ScriptKind.TS
}

const PACKAGE_DEPENDENCY_FIELDS = new Set([
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
])

function collectJsonPackageReferences(
  offsets: Set<number>,
  region: SourceRegion,
  file: string,
): void {
  if (ts.parseConfigFileTextToJson('package-fence.json', region.text).error !== undefined) return
  const source = ts.parseJsonText('package-fence.json', region.text)
  const statement = source.statements[0]
  if (statement === undefined
    || !ts.isExpressionStatement(statement)
    || !ts.isObjectLiteralExpression(statement.expression)) return
  for (const owner of statement.expression.properties) {
    if (!ts.isPropertyAssignment(owner)
      || !ts.isStringLiteralLike(owner.name)) continue
    if (file.endsWith('package.json')
      && owner.name.text === 'name'
      && ts.isStringLiteralLike(owner.initializer)) {
      offsets.add(region.start + owner.initializer.getStart(source))
    }
    if (PACKAGE_DEPENDENCY_FIELDS.has(owner.name.text)
      && ts.isObjectLiteralExpression(owner.initializer)) {
      for (const dependency of owner.initializer.properties) {
        if (ts.isPropertyAssignment(dependency) && ts.isStringLiteralLike(dependency.name)) {
          offsets.add(region.start + dependency.name.getStart(source))
        }
      }
    }
    if (/^(?:.*\/)?tsconfig(?:\.[^/]*)?\.json$/.test(file)
      && owner.name.text === 'compilerOptions'
      && ts.isObjectLiteralExpression(owner.initializer)) {
      const paths = owner.initializer.properties.find(property =>
        ts.isPropertyAssignment(property)
        && ts.isStringLiteralLike(property.name)
        && property.name.text === 'paths',
      )
      if (paths !== undefined
        && ts.isPropertyAssignment(paths)
        && ts.isObjectLiteralExpression(paths.initializer)) {
        for (const path of paths.initializer.properties) {
          if (ts.isPropertyAssignment(path) && ts.isStringLiteralLike(path.name)) {
            offsets.add(region.start + path.name.getStart(source))
          }
        }
      }
    }
  }
}

interface TextEdit {
  readonly start: number
  readonly end: number
  readonly replacement: string
}

function validRuntimeYaml(text: string): boolean {
  try {
    return Array.isArray(jsYaml.load(text, { schema: YAML_LOADER_SCHEMA }))
  } catch (error) {
    if (error instanceof jsYaml.YAMLException) return false
    throw error
  }
}

function yamlMapValue(node: unknown, key: string): YamlNode | null | undefined {
  if (!isMap(node)) return undefined
  const map = node as Yaml.YAMLMap<unknown, YamlNode | null>
  for (const pair of map.items) {
    if (!isScalar(pair.key) || pair.key.value !== key) continue
    return pair.value === null || isNode(pair.value) ? pair.value : undefined
  }
  return undefined
}

function yamlString(node: YamlNode | null | undefined): string | undefined {
  return isScalar(node) && node.tag === undefined && typeof node.value === 'string'
    ? node.value
    : undefined
}

function yamlNameEdit(
  edits: TextEdit[],
  node: YamlNode | null | undefined,
  file: string,
  all: readonly Pattern[],
): void {
  const value = yamlString(node)
  if (value === undefined || !isScalar(node) || node.range === undefined || node.range === null) return
  for (const pattern of all) {
    if (skipped(file, pattern)) continue
    if (value !== pattern.from && !value.startsWith(`${pattern.from}/`)) continue
    const target = `${pattern.to}${value.slice(pattern.from.length)}`
    const replacement = node.type === 'QUOTE_SINGLE'
      ? `'${target}'`
      : node.type === 'QUOTE_DOUBLE' || target.startsWith('@')
        ? JSON.stringify(target)
        : target
    edits.push({ start: node.range[0], end: node.range[1], replacement })
    return
  }
}

const INCLUDE_PLUGIN_NAMES = new Set([
  'cordis:include',
  '@cordisjs/plugin-include',
  '@deepseek-ai/cordis-plugin-include',
])

const GROUP_PLUGIN_NAMES = new Set([
  'cordis:group',
  '@cordisjs/plugin-group',
  '@deepseek-ai/cordis-plugin-group',
])

function collectYamlEntryReferences(
  edits: TextEdit[],
  node: unknown,
  file: string,
  all: readonly Pattern[],
): void {
  if (!isMap(node)) return
  const id = yamlMapValue(node, 'id')
  const name = yamlMapValue(node, 'name')
  if (yamlString(id) !== undefined && yamlString(name) !== undefined) {
    yamlNameEdit(edits, name, file, all)
  }

  const group = yamlMapValue(node, 'group')
  const config = yamlMapValue(node, 'config')
  if (((isScalar(group) && group.value === true)
    || GROUP_PLUGIN_NAMES.has(yamlString(name) ?? ''))
    && isSeq(config)) {
    for (const entry of config.items) {
      collectYamlEntryReferences(edits, entry, file, all)
    }
  }

  const insert = yamlMapValue(node, 'insert')
  if (isSeq(insert)) {
    for (const entry of insert.items) {
      collectYamlEntryReferences(edits, entry, file, all)
    }
  }

  if (!INCLUDE_PLUGIN_NAMES.has(yamlString(name) ?? '') || !isMap(config)) return
  const patches = yamlMapValue(config, 'patches')
  if (!isSeq(patches)) return
  for (const patch of patches.items) {
    collectYamlEntryReferences(edits, patch, file, all)
  }
}

function unsupportedYamlNode(node: unknown): boolean {
  if (!isNode(node)) return false
  const yamlNode = node as YamlNode
  if (isAlias(yamlNode)
    || ('anchor' in yamlNode && typeof yamlNode.anchor === 'string')
    || (yamlNode.tag !== undefined && yamlNode.tag !== YAML_JS_EXPRESSION_TAG)) return true
  if (isMap(yamlNode)) {
    return yamlNode.items.some((pair: Yaml.Pair) =>
      unsupportedYamlNode(pair.key) || unsupportedYamlNode(pair.value),
    )
  }
  if (!isSeq(yamlNode)) return false
  return yamlNode.items.some(item => unsupportedYamlNode(item))
}

function rewriteYaml(text: string, file: string, all: readonly Pattern[]): { text: string; lines: number } {
  if (!validRuntimeYaml(text)) return { text, lines: 0 }
  const document = parseDocument(text, {
    customTags: [YAML_CST_JS_EXPRESSION],
    keepSourceTokens: true,
  })
  if (document.errors.length > 0 || !isSeq(document.contents)) return { text, lines: 0 }
  if (unsupportedYamlNode(document.contents)) return { text, lines: 0 }

  const edits: TextEdit[] = []
  for (const item of document.contents.items) {
    collectYamlEntryReferences(edits, item, file, all)
  }
  if (edits.length === 0) return { text, lines: 0 }

  const changedLines = new Set(edits.map(edit =>
    text.slice(0, edit.start).split('\n').length,
  ))
  const rewritten = edits
    .sort((left, right) => right.start - left.start)
    .reduce(
      (output, edit) =>
        `${output.slice(0, edit.start)}${edit.replacement}${output.slice(edit.end)}`,
      text,
    )
  return validRuntimeYaml(rewritten)
    ? { text: rewritten, lines: changedLines.size }
    : { text, lines: 0 }
}

function collectCordisPackageReference(
  offsets: Set<number>,
  node: TypeScript.Node,
  source: TypeScript.SourceFile,
  region: SourceRegion,
  file: string,
): void {
  if (file === 'packages/client/web/src/seed.ts'
    && ts.isPropertyAssignment(node)
    && ts.isStringLiteralLike(node.name)
    && ts.isIdentifier(node.initializer)
    && node.initializer.text === 'Cordis') {
    offsets.add(region.start + node.name.getStart(source))
    return
  }
  if (file !== 'scripts/verify-dsh-package-licenses.spec.ts'
    || !ts.isPropertyAssignment(node)
    || !ts.isIdentifier(node.name)
    || node.name.text !== 'name'
    || !ts.isStringLiteralLike(node.initializer)
    || !ts.isObjectLiteralExpression(node.parent)
    || !ts.isCallExpression(node.parent.parent)
    || node.parent.parent.arguments[2] !== node.parent
    || !ts.isIdentifier(node.parent.parent.expression)
    || node.parent.parent.expression.text !== 'writeManifest') return
  const manifestPath = node.parent.parent.arguments[1]
  if (manifestPath !== undefined
    && ts.isStringLiteralLike(manifestPath)
    && manifestPath.text === 'vendor/cordis/package.json') {
    offsets.add(region.start + node.initializer.getStart(source))
  }
}

function collectAstModuleSpecifiers(
  moduleSpecifierOffsets: Set<number>,
  packageReferenceOffsets: Set<number>,
  region: SourceRegion,
  file: string,
  markdownFence = false,
): void {
  const sourceText = markdownFence
    ? region.text.replace(
      /^[ \t]*(?:`{3,}|~{3,})[^\r\n]*(?=\r?$)/gm,
      marker => ' '.repeat(marker.length),
    )
    : region.text
  const source = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    sourceScriptKind(file, region),
  )
  const add = (node: TypeScript.Node | undefined): void => {
    if (node !== undefined && ts.isStringLiteralLike(node)) {
      moduleSpecifierOffsets.add(region.start + node.getStart(source))
    }
  }
  const visit = (node: TypeScript.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier)
    } else if (ts.isCallExpression(node) && moduleCallToken(node) !== undefined) {
      add(node.arguments[0])
    } else if (ts.isExternalModuleReference(node)) {
      add(node.expression)
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal)
    } else if (ts.isModuleDeclaration(node)
      && ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword) === true) {
      const newline = source.text.indexOf('\n', node.end)
      const lineEnd = newline < 0 ? source.text.length : newline
      if (node.body !== undefined
        || /^[ \t]*(?:(?:\/\/|\/\*).*)?$/.test(source.text.slice(node.end, lineEnd))) add(node.name)
    }
    collectCordisPackageReference(packageReferenceOffsets, node, source, region, file)
    ts.forEachChild(node, visit)
  }
  visit(source)
}

function docsProseModuleCallStart(node: TypeScript.CallExpression, source: TypeScript.SourceFile): number | undefined {
  return moduleCallToken(node)?.getStart(source)
}

function collectDocsProseModuleSpecifiers(offsets: Set<number>, region: SourceRegion): void {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, region.text)
  const candidates = new Set<number>()
  for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) {
    if (kind === ts.SyntaxKind.ImportKeyword || scanner.getTokenText() === 'require') {
      candidates.add(scanner.getTokenStart())
    }
  }
  const source = ts.createSourceFile('docs-prose.ts', region.text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const visit = (node: TypeScript.Node): void => {
    if (ts.isCallExpression(node)
      && candidates.has(docsProseModuleCallStart(node, source) ?? -1)) {
      const argument = node.arguments[0]
      if (argument !== undefined && ts.isStringLiteralLike(argument)) {
        offsets.add(region.start + argument.getStart(source))
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

function rewriteLine(
  line: string,
  file: string,
  all: readonly Pattern[],
  lineOffset: number,
  moduleSpecifierOffsets: ReadonlySet<number>,
  packageReferenceOffsets: ReadonlySet<number>,
  referencesOnly: boolean,
): string {
  const edits: { start: number; end: number; replacement: string }[] = []
  for (const pattern of all) {
    line.replace(pattern.token, (match, quote: string, subpath: string, offset: number) => {
      const absoluteOffset = lineOffset + offset
      const moduleSpecifier = moduleSpecifierOffsets.has(absoluteOffset)
      const packageReference = packageReferenceOffsets.has(absoluteOffset)
      if (referencesOnly
        && !moduleSpecifier
        && !packageReference) return match
      if (skipped(file, pattern) && !moduleSpecifier && !packageReference) return match
      edits.push({
        start: offset,
        end: offset + match.length,
        replacement: `${quote}${pattern.to}${subpath}${quote}`,
      })
      return match
    })
  }
  return edits
    .sort((left, right) => right.start - left.start)
    .reduce(
      (out, edit) => `${out.slice(0, edit.start)}${edit.replacement}${out.slice(edit.end)}`,
      line,
    )
}

/**
 * Rewrite a file's eligible lines.
 *
 * Markdown splits in two. Fences use their declared language to identify
 * package references. Prose under `docs/` recognizes explicit module calls;
 * quoted prose remains unchanged. Markdown prose elsewhere records upstream
 * names and is not eligible.
 */
function rewrite(text: string, file: string, all: readonly Pattern[]): { text: string; lines: number } {
  const markdown = file.endsWith('.md')
  const prose = markdown && file.startsWith('docs/')
  const sourceCode = /\.(?:ts|tsx|js|mjs|cjs|tpl)$/.test(file)
  const json = file.endsWith('.json')
  const yamlSource = /\.(?:yml|yaml)$/.test(file)
  if (yamlSource) {
    return isCordisConfigFile(file)
      ? rewriteYaml(text, file, all)
      : { text, lines: 0 }
  }
  const regions = markdown ? markdownRegions(text) : []
  const moduleSpecifierOffsets = new Set<number>()
  const packageReferenceOffsets = new Set<number>()
  if (sourceCode) {
    collectAstModuleSpecifiers(
      moduleSpecifierOffsets,
      packageReferenceOffsets,
      { kind: 'fence', start: 0, text },
      file,
    )
  } else if (json) {
    collectJsonPackageReferences(
      packageReferenceOffsets,
      { kind: 'fence', start: 0, text },
      file,
    )
  } else {
    for (const region of regions) {
      if (region.kind === 'fence') {
        const language = region.info?.split(/\s+/, 1)[0]?.toLowerCase()
        if (language === 'json' || language === 'jsonc') {
          collectJsonPackageReferences(packageReferenceOffsets, region, 'package-fence.json')
        } else if (language !== 'yaml' && language !== 'yml' && language !== undefined) {
          collectAstModuleSpecifiers(moduleSpecifierOffsets, packageReferenceOffsets, region, file, true)
        }
      }
      else if (prose) collectDocsProseModuleSpecifiers(moduleSpecifierOffsets, region)
    }
  }
  let regionIndex = 0
  let lines = 0
  let lineOffset = 0
  const out = text.split('\n').map((line) => {
    const currentOffset = lineOffset
    lineOffset += line.length + 1
    if (markdown) {
      let region = regions[regionIndex]
      while (region !== undefined && region.start + region.text.length <= currentOffset) {
        regionIndex += 1
        region = regions[regionIndex]
      }
      if (region === undefined
        || currentOffset < region.start
        || (region.kind === 'prose' && !prose)) return line
    }
    const next = rewriteLine(
      line,
      file,
      all,
      currentOffset,
      moduleSpecifierOffsets,
      packageReferenceOffsets,
      sourceCode || json || markdown,
    )
    if (next !== line) lines += 1
    return next
  })
  return { text: out.join('\n'), lines }
}

/**
 * Rewrite source text in the normal post-rescope direction.
 * @param text - Source text to rewrite.
 * @param file - Repository-relative path used to select file-specific rescope policy.
 * @param reverse - Whether to restore upstream package names instead.
 * @returns The rewritten text and the number of source lines changed by rescoping.
 */
export function rewriteSourceText(
  text: string,
  file: string,
  reverse = false,
): { text: string; lines: number } {
  return rewrite(text, file, patterns(reverse))
}

/**
 * Report repository-wide postconditions violated by eligible tracked text.
 * @param text - Eligible tracked file contents joined into one corpus.
 * @returns One diagnostic for each forbidden token present in the corpus.
 */
export function repositoryPostconditionFailures(text: string): string[] {
  const failures: string[] = []
  for (const check of POSTCONDITIONS) {
    if (check.file !== null) continue
    const hits = text.split(check.text).length - 1
    if (hits !== check.count) {
      failures.push(`postcondition: tracked eligible files have ${String(hits)} occurrence(s) of ${JSON.stringify(check.text)}, expected ${String(check.count)}`)
    }
  }
  return failures
}

function classify(file: string): string {
  if (/^vendor\/[^/]+\/package\.json$/.test(file)) return 'vendor manifest name'
  if (file.endsWith('package.json')) return 'package.json dependencies'
  if (/\.(ts|tsx|js|mjs|cjs|tpl)$/.test(file)) return 'code specifiers'
  if (/\.(yml|yaml)$/.test(file)) return 'YAML plugin names'
  if (file.endsWith('.json')) return 'JSON configuration'
  return 'Markdown fences and docs prose'
}

/**
 * One exact edit's state in the text it targets. `pending` means the source
 * form is present and the target form absent; `applied` means the reverse;
 * anything else — a partial application, a moved site, or a DUPLICATED
 * insertion — is `invalid`, so it fails the run instead of being applied again.
 */
export type ExactEditState = 'pending' | 'applied' | 'invalid'

/**
 * Classify one exact edit against its target text.
 *
 * An insertion keeps its anchor (`replace` contains `find`) and a deletion
 * keeps its remainder (`find` contains `replace`), so neither can be judged by
 * the source form alone: the surviving side counts the target form instead.
 * @param text - the complete current text of the edited file.
 * @param find - the source form, already oriented for the running direction.
 * @param replace - the target form, already oriented for the running direction.
 * @param expect - how many occurrences one complete application produces.
 * @returns Whether the edit is pending, already applied, or invalid.
 */
export function exactEditState(text: string, find: string, replace: string, expect: number): ExactEditState {
  const hits = text.split(find).length - 1
  const landed = text.split(replace).length - 1
  if (replace.includes(find)) {
    if (landed === expect) return 'applied'
    return landed === 0 && hits === expect ? 'pending' : 'invalid'
  }
  if (find.includes(replace)) {
    if (hits === 0) return landed === expect ? 'applied' : 'invalid'
    return hits === expect ? 'pending' : 'invalid'
  }
  if (hits === 0 && landed === expect) return 'applied'
  return hits === expect && landed === 0 ? 'pending' : 'invalid'
}

function main(): void {
  const args = process.argv.slice(2)
  const mode = args.includes('--apply') ? 'apply' : args.includes('--check') ? 'check' : 'dry'
  const reverse = args.includes('--reverse')
  const all = patterns(reverse)
  const files = trackedExistingEligibleFiles(
    execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0'),
  )

  const counts = new Map<string, { files: number; lines: number }>()
  const failures: string[] = []
  const outstanding: string[] = []
  const repositoryText: string[] = []

  // Classify every exact edit before writing anything: a single invalid site
  // means the mapping and the tree disagree, and a half-applied tree is worse
  // than an untouched one.
  const planned: { edit: ExactEdit; path: string; find: string; replace: string }[] = []
  for (const edit of EXACT_EDITS) {
    const path = resolve(root, edit.file)
    const before = readFileSync(path, 'utf8')
    const find = reverse ? edit.replace : edit.find
    const replace = reverse ? edit.find : edit.replace
    const state = exactEditState(before, find, replace, edit.expect)
    if (state === 'invalid') {
      failures.push(`exact edit ${edit.id}: ${edit.file} is neither pending nor cleanly applied (duplicated, partial, or moved)`)
      continue
    }
    if (mode === 'check') {
      if (state !== 'applied') failures.push(`exact edit ${edit.id} did not land in ${edit.file}`)
      continue
    }
    if (state === 'pending') planned.push({ edit, path, find, replace })
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`rescope-vendor: ${failure}`)
    console.error(`rescope-vendor: ${String(failures.length)} problem(s); nothing was written.`)
    process.exitCode = 1
    return
  }
  if (mode === 'apply') {
    // Re-read per edit: two edits can target one file, and a stale snapshot
    // would let the second write discard the first.
    for (const { path, find, replace } of planned) {
      writeFileSync(path, readFileSync(path, 'utf8').split(find).join(replace))
    }
  }

  for (const file of files) {
    const path = resolve(root, file)
    const before = readFileSync(path, 'utf8')
    const { text: after, lines } = rewrite(before, file, all)
    if (mode !== 'dry' && !reverse) repositoryText.push(after)
    if (after === before) continue
    outstanding.push(file)
    const kind = classify(file)
    const current = counts.get(kind) ?? { files: 0, lines: 0 }
    counts.set(kind, { files: current.files + 1, lines: current.lines + lines })
    if (mode === 'apply') writeFileSync(path, after)
  }

  console.log(`rescope-vendor: ${mode}${reverse ? ' --reverse' : ''} over ${String(files.length)} tracked files`)
  for (const kind of [...counts.keys()].sort()) {
    const { files: count, lines } = counts.get(kind) ?? { files: 0, lines: 0 }
    console.log(`  ${kind.padEnd(24)} ${String(count).padStart(4)} file(s), ${String(lines)} line(s)`)
  }

  if (mode !== 'dry') {
    if (!reverse) failures.push(...repositoryPostconditionFailures(repositoryText.join('\0')))
    for (const check of POSTCONDITIONS) {
      if (reverse) break
      if (check.file === null) continue
      const path = resolve(root, check.file)
      const hits = existsSync(path) ? readFileSync(path, 'utf8').split(check.text).length - 1 : -1
      if (hits !== check.count) {
        failures.push(`postcondition: ${check.file} has ${String(hits)} occurrence(s) of ${JSON.stringify(check.text)}, expected ${String(check.count)}`)
      }
    }
    // The generic pass above already told us which files would still change,
    // which in check mode is exactly the residue-and-idempotency signal.
    if (mode === 'check') {
      for (const file of outstanding) failures.push(`residue: ${file} still carries a pre-rescope name token`)
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`rescope-vendor: ${failure}`)
    console.error(`rescope-vendor: ${String(failures.length)} problem(s); the mapping or an upstream site moved.`)
    process.exitCode = 1
  } else if (mode === 'check') {
    console.log('rescope-vendor: post-state verified — no residue, every exact edit landed, idempotent.')
  } else if (mode === 'apply') {
    console.log('rescope-vendor: applied. Run `pnpm install`, `pnpm run gen-third-party-notices`, and re-record the touched bilingual pairs.')
  }
}

// Importing this module for its exported classifier must not run the codemod.
if (process.argv[1] !== undefined && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main()
}

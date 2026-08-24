/**
 * Acceptance-path coverage for the rescope codemod's exact-edit classifier: a
 * duplicated insertion — what a non-idempotent apply produces — must be
 * rejected rather than applied again.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import {
  exactEditState,
  repositoryPostconditionFailures,
  rewriteSourceText,
  trackedExistingEligibleFiles,
} from './rescope-vendor.ts'

const ANCHOR = '\n## Sync procedure'
const INSERTED = `\n15. **rescope**: one log entry.\n${ANCHOR}`

describe('exactEditState', () => {
  it('classifies an insertion by its target form, so a duplicate is invalid', () => {
    expect(exactEditState(`log\n${ANCHOR}\n`, ANCHOR, INSERTED, 1)).toBe('pending')
    expect(exactEditState(`log${INSERTED}\n`, ANCHOR, INSERTED, 1)).toBe('applied')
    // The anchor survives an insertion, so counting the source form would have
    // called this pending and inserted the entry a second time.
    expect(exactEditState(`log${INSERTED}${INSERTED}\n`, ANCHOR, INSERTED, 1)).toBe('invalid')
    expect(exactEditState('log\n', ANCHOR, INSERTED, 1)).toBe('invalid')
  })

  it('classifies a deletion by its source form, and requires its remainder to survive', () => {
    const remainder = 'exclude:\n'
    const withEntries = 'exclude:\n  - cordis@4\n'
    expect(exactEditState(withEntries, withEntries, remainder, 1)).toBe('pending')
    expect(exactEditState(remainder, withEntries, remainder, 1)).toBe('applied')
    // Upstream dropped the whole field: the source form is gone, but so is the
    // remainder, so this is a moved site rather than a completed deletion.
    expect(exactEditState('unrelated:\n', withEntries, remainder, 1)).toBe('invalid')
  })

  it('requires a replacement to leave no source form and the exact target count', () => {
    expect(exactEditState('a = 1\n', 'a = 1', 'b = 2', 1)).toBe('pending')
    expect(exactEditState('b = 2\n', 'a = 1', 'b = 2', 1)).toBe('applied')
    expect(exactEditState('b = 2\nb = 2\n', 'a = 1', 'b = 2', 1)).toBe('invalid')
    // A moved or partially applied site: neither state is complete.
    expect(exactEditState('a = 1\nb = 2\n', 'a = 1', 'b = 2', 1)).toBe('invalid')
    expect(exactEditState('x\n', 'a = 1', 'b = 2', 1)).toBe('invalid')
  })
})

describe('trackedExistingEligibleFiles', () => {
  it('skips deleted tracked files during generic traversal', () => {
    expect(trackedExistingEligibleFiles(
      [
        'packages/shell/bash-sandbox/src/helpers.ts',
        'packages/shell/shell/src/bash.ts',
        'scripts/rescope-vendor.ts',
        '',
      ],
      path => path !== '/repo/packages/shell/bash-sandbox/src/helpers.ts',
      file => `/repo/${file}`,
    )).toEqual(['packages/shell/shell/src/bash.ts'])
  })
})

describe('rewriteSourceText', () => {
  function expectRoundTrip(
    source: string,
    expected: string,
    file: string,
    lines: number,
  ): void {
    expect(rewriteSourceText(source, file)).toEqual({ text: expected, lines })
    expect(rewriteSourceText(expected, file)).toEqual({ text: expected, lines: 0 })
    expect(rewriteSourceText(expected, file, true)).toEqual({ text: source, lines })
    expect(rewriteSourceText(source, file, true)).toEqual({ text: source, lines: 0 })
  }

  function expectUnchangedInBothDirections(source: string): void {
    expect(rewriteSourceText(source, 'README.md')).toEqual({ text: source, lines: 0 })
    expect(rewriteSourceText(source, 'README.md', true)).toEqual({ text: source, lines: 0 })
  }

  function expectYamlSemanticRoundTrip(
    source: string,
    expected: string,
    file: string,
    lines: number,
  ): void {
    expect(rewriteSourceText(source, file)).toEqual({ text: expected, lines })
    expect(() => yaml.load(expected, { schema: yaml.JSON_SCHEMA })).not.toThrow()
    expect(rewriteSourceText(expected, file)).toEqual({ text: expected, lines: 0 })
    const reversed = rewriteSourceText(expected, file, true)
    expect(reversed.lines).toBe(lines)
    expect(yaml.load(reversed.text, { schema: yaml.JSON_SCHEMA }))
      .toEqual(yaml.load(source, { schema: yaml.JSON_SCHEMA }))
    expect(rewriteSourceText(reversed.text, file, true)).toEqual({
      text: reversed.text,
      lines: 0,
    })
  }

  it('rewrites module specifiers without changing runtime event or input-trigger source ids', () => {
    const source = [
      "import { Context } from 'cordis'",
      "import cordisPackage from 'cordis/package.json' with { type: 'json' }",
      "ctx.emit('cordis/future-event', payload)",
      "const localeId = 'cordis/future-locale'",
      "ctx.emit('cordis/request-run', request)",
      "ctx.emit('cordis/request-run-resolved', resolved)",
      "ctx.emit('cordis/dynamic-package', pkg)",
      "ctx.emit('cordis/dynamic-retract', retracted)",
      "ctx.emit('cordis/inspect-query', request)",
      "ctx.emit('cordis/inspect-query-resolved', resolved)",
      "const source = { name: 'cordis' }",
      '',
    ].join('\n')
    expect(rewriteSourceText(source, 'packages/extensions/ui-cordis/src/client/index.ts')).toEqual({
      text: [
        "import { Context } from '@deepseek-ai/cordis'",
        "import cordisPackage from '@deepseek-ai/cordis/package.json' with { type: 'json' }",
        "ctx.emit('cordis/future-event', payload)",
        "const localeId = 'cordis/future-locale'",
        "ctx.emit('cordis/request-run', request)",
        "ctx.emit('cordis/request-run-resolved', resolved)",
        "ctx.emit('cordis/dynamic-package', pkg)",
        "ctx.emit('cordis/dynamic-retract', retracted)",
        "ctx.emit('cordis/inspect-query', request)",
        "ctx.emit('cordis/inspect-query-resolved', resolved)",
        "const source = { name: 'cordis' }",
        '',
      ].join('\n'),
      lines: 2,
    })
  })

  it.each([
    [
      'require.resolve',
      "const packageJson = require.resolve('cordis/package.json')\n",
      "const packageJson = require.resolve('@deepseek-ai/cordis/package.json')\n",
    ],
    [
      'multiline dynamic import',
      "const packageJson = await import(\n  'cordis/package.json'\n)\n",
      "const packageJson = await import(\n  '@deepseek-ai/cordis/package.json'\n)\n",
    ],
    [
      'multiline require',
      "const packageJson = require(\n  'cordis/package.json'\n)\n",
      "const packageJson = require(\n  '@deepseek-ai/cordis/package.json'\n)\n",
    ],
  ])('rewrites %s module references', (_name, source, expected) => {
    expect(rewriteSourceText(source, 'packages/example.ts')).toEqual({
      text: expected,
      lines: 1,
    })
  })

  it('keeps package dependencies and Loader names on the root-name path', () => {
    expect(rewriteSourceText(
      '{ "dependencies": { "cordis": "workspace:^" } }\n',
      'packages/example/package.json',
    )).toEqual({
      text: '{ "dependencies": { "@deepseek-ai/cordis": "workspace:^" } }\n',
      lines: 1,
    })
    expectYamlSemanticRoundTrip(
      '- id: framework\n  name: cordis\n',
      '- id: framework\n  name: "@deepseek-ai/cordis"\n',
      'examples/example.cordis.yml',
      1,
    )
  })

  it('rewrites standalone JSON package references without changing locale or data values', () => {
    const manifest = [
      '{',
      '  "name": "cordis",',
      '  "dependencies": { "cordis": "workspace:^" },',
      '  "peerDependenciesMeta": { "cordis": { "optional": true } },',
      '  "locale": "cordis",',
      '  "data": { "name": "cordis" }',
      '}',
      '',
    ].join('\n')
    expectRoundTrip(
      manifest,
      manifest
        .replace('"name": "cordis"', '"name": "@deepseek-ai/cordis"')
        .replaceAll('"cordis":', '"@deepseek-ai/cordis":'),
      'packages/example/package.json',
      3,
    )

    const tsconfig = [
      '{',
      '  "compilerOptions": {',
      '    "paths": {',
      '      "cordis": ["./vendor/cordis/src"],',
      '      "cordis/*": ["./vendor/cordis/src/*"]',
      '    }',
      '  },',
      '  "locale": "cordis",',
      '  "data": "cordis"',
      '}',
      '',
    ].join('\n')
    expectRoundTrip(
      tsconfig,
      tsconfig
        .replace('"cordis": [', '"@deepseek-ai/cordis": [')
        .replace('"cordis/*": [', '"@deepseek-ai/cordis/*": ['),
      'tsconfig.example.json',
      2,
    )
  })

  it.each([
    [
      'TypeScript module specifiers',
      "import 'cordis'; import '@cordisjs/plugin-loader'\n",
      "import '@deepseek-ai/cordis'; import '@deepseek-ai/cordis-plugin-loader'\n",
      'packages/example.ts',
    ],
    [
      'minified package metadata',
      '{"dependencies":{"cordis":"x","@cordisjs/plugin-loader":"x"}}\n',
      '{"dependencies":{"@deepseek-ai/cordis":"x","@deepseek-ai/cordis-plugin-loader":"x"}}\n',
      'packages/example/package.json',
    ],
    [
      'compact tsconfig paths',
      '{"compilerOptions":{"paths":{"cordis":["./a"],"@cordisjs/plugin-loader":["./b"]}}}\n',
      '{"compilerOptions":{"paths":{"@deepseek-ai/cordis":["./a"],"@deepseek-ai/cordis-plugin-loader":["./b"]}}}\n',
      'tsconfig.example.json',
    ],
  ])('round-trips mixed names in same-line %s', (_name, source, expected, file) => {
    expectRoundTrip(source, expected, file, 1)
  })

  it('rewrites Loader entry and patch names without changing nested config data', () => {
    const entry = [
      '- id: framework',
      '  name: "cordis" # package metadata',
      '  config:',
      '    name: "cordis" # plugin data',
      '',
    ].join('\n')
    expectRoundTrip(
      entry,
      [
        '- id: framework',
        '  name: "@deepseek-ai/cordis" # package metadata',
        '  config:',
        '    name: "cordis" # plugin data',
        '',
      ].join('\n'),
      'examples/example.cordis.yml',
      1,
    )

    const patch = [
      '- id: loader',
      "  name: '@cordisjs/plugin-loader'",
      '  config:',
      "    name: '@cordisjs/plugin-loader'",
      '- insert:',
      '    - id: framework',
      '      name: "cordis"',
      '      config:',
      '        name: "cordis"',
      '',
    ].join('\n')
    expectRoundTrip(
      patch,
      [
        '- id: loader',
        "  name: '@deepseek-ai/cordis-plugin-loader'",
        '  config:',
        "    name: '@cordisjs/plugin-loader'",
        '- insert:',
        '    - id: framework',
        '      name: "@deepseek-ai/cordis"',
        '      config:',
        '        name: "cordis"',
        '',
      ].join('\n'),
      'packages/example/cordis.patch.yml',
      2,
    )
  })

  it('normalizes unquoted root, patch-guard, and group-child package names to valid YAML', () => {
    expectYamlSemanticRoundTrip(
      '- id: framework\n  name: cordis\n',
      '- id: framework\n  name: "@deepseek-ai/cordis"\n',
      'examples/root.cordis.yml',
      1,
    )
    expectYamlSemanticRoundTrip(
      '- id: framework\n  name: cordis\n  disabled: true\n',
      '- id: framework\n  name: "@deepseek-ai/cordis"\n  disabled: true\n',
      'packages/bundle/base/cordis.patch.yml',
      1,
    )
    expectYamlSemanticRoundTrip(
      [
        '- id: group',
        "  name: '@cordisjs/plugin-group'",
        '  config:',
        '    - id: framework',
        '      name: cordis',
        '',
      ].join('\n'),
      [
        '- id: group',
        "  name: '@deepseek-ai/cordis-plugin-group'",
        '  config:',
        '    - id: framework',
        '      name: "@deepseek-ai/cordis"',
        '',
      ].join('\n'),
      'examples/group.cordis.yml',
      2,
    )
  })

  it('preserves quote style and comments on Loader package names', () => {
    expectYamlSemanticRoundTrip(
      [
        '- id: plain',
        '  name: cordis # plain package',
        '- id: double',
        '  name: "cordis" # double package',
        '- id: single',
        "  name: '@cordisjs/plugin-loader' # single package",
        '',
      ].join('\n'),
      [
        '- id: plain',
        '  name: "@deepseek-ai/cordis" # plain package',
        '- id: double',
        '  name: "@deepseek-ai/cordis" # double package',
        '- id: single',
        "  name: '@deepseek-ai/cordis-plugin-loader' # single package",
        '',
      ].join('\n'),
      'examples/styles.cordis.yml',
      3,
    )
  })

  it('rewrites block and flow Loader entries, including two package names on one flow line', () => {
    expectYamlSemanticRoundTrip(
      [
        '- id: block',
        '  name: cordis',
        "- { id: flow-a, name: cordis, config: { name: 'cordis' } }",
        "- { id: flow-b, name: '@cordisjs/plugin-loader' }",
        '',
      ].join('\n'),
      [
        '- id: block',
        '  name: "@deepseek-ai/cordis"',
        "- { id: flow-a, name: \"@deepseek-ai/cordis\", config: { name: 'cordis' } }",
        "- { id: flow-b, name: '@deepseek-ai/cordis-plugin-loader' }",
        '',
      ].join('\n'),
      'examples/flow.cordis.yml',
      3,
    )
    expectYamlSemanticRoundTrip(
      "[{ id: framework, name: cordis }, { id: loader, name: '@cordisjs/plugin-loader' }]\n",
      "[{ id: framework, name: \"@deepseek-ai/cordis\" }, { id: loader, name: '@deepseek-ai/cordis-plugin-loader' }]\n",
      'examples/same-line.cordis.yml',
      1,
    )
  })

  it('rewrites block and flow patch inserts plus id-targeted name guards', () => {
    expectYamlSemanticRoundTrip(
      [
        '- id: framework',
        '  name: cordis',
        '- insert:',
        '    - id: loader',
        "      name: '@cordisjs/plugin-loader'",
        "- { insert: [{ id: include, name: '@cordisjs/plugin-include' }] }",
        '- name: cordis',
        '',
      ].join('\n'),
      [
        '- id: framework',
        '  name: "@deepseek-ai/cordis"',
        '- insert:',
        '    - id: loader',
        "      name: '@deepseek-ai/cordis-plugin-loader'",
        "- { insert: [{ id: include, name: '@deepseek-ai/cordis-plugin-include' }] }",
        '- name: cordis',
        '',
      ].join('\n'),
      'packages/bundle/base/cordis.patch.yml',
      3,
    )
  })

  it('rewrites Loader package references inside include config.patches only', () => {
    expectYamlSemanticRoundTrip(
      [
        '- id: include',
        "  name: '@cordisjs/plugin-include'",
        '  config:',
        '    path: ./child.cordis.yml',
        '    name: cordis',
        '    patches:',
        '      - id: framework',
        '        name: cordis',
        '      - insert:',
        '          - id: loader',
        "            name: '@cordisjs/plugin-loader'",
        '',
      ].join('\n'),
      [
        '- id: include',
        "  name: '@deepseek-ai/cordis-plugin-include'",
        '  config:',
        '    path: ./child.cordis.yml',
        '    name: cordis',
        '    patches:',
        '      - id: framework',
        '        name: "@deepseek-ai/cordis"',
        '      - insert:',
        '          - id: loader',
        "            name: '@deepseek-ai/cordis-plugin-loader'",
        '',
      ].join('\n'),
      'examples/include.cordis.yml',
      3,
    )
  })

  it('uses cordis:group as a traversal carrier without rewriting its name', () => {
    expectYamlSemanticRoundTrip(
      [
        '- id: group',
        '  name: cordis:group',
        '  config:',
        '    - id: framework',
        '      name: cordis',
        '',
      ].join('\n'),
      [
        '- id: group',
        '  name: cordis:group',
        '  config:',
        '    - id: framework',
        '      name: "@deepseek-ai/cordis"',
        '',
      ].join('\n'),
      'examples/builtin-group.cordis.yml',
      1,
    )
  })

  it('uses cordis:include as a traversal carrier for patch guards and inserts', () => {
    expectYamlSemanticRoundTrip(
      [
        '- id: include',
        '  name: cordis:include',
        '  config:',
        '    patches:',
        '      - id: framework',
        '        name: cordis',
        '      - insert:',
        '          - id: loader',
        "            name: '@cordisjs/plugin-loader'",
        '',
      ].join('\n'),
      [
        '- id: include',
        '  name: cordis:include',
        '  config:',
        '    patches:',
        '      - id: framework',
        '        name: "@deepseek-ai/cordis"',
        '      - insert:',
        '          - id: loader',
        "            name: '@deepseek-ai/cordis-plugin-loader'",
        '',
      ].join('\n'),
      'examples/builtin-include.cordis.yml',
      2,
    )
  })

  it.each([
    ['fixtures/records.yml'],
    ['fixtures/settings.yaml'],
    ['docs/rescope.i18n.yaml'],
    ['fixtures/unregistered.overlay.yml'],
  ])('keeps Loader-like records in unrecognized YAML path %s', (file) => {
    const source = '- id: locale-row\n  name: cordis\n  value: display-label\n'
    expectRoundTrip(source, source, file, 0)
  })

  it('keeps nested Loader config names plus locale, data, and event values', () => {
    const source = [
      '- id: framework',
      '  name: cordis',
      '  config:',
      '    name: cordis',
      '    locale: cordis',
      '    data: cordis',
      '    event: cordis/request-run',
      '',
    ].join('\n')
    expectYamlSemanticRoundTrip(
      source,
      source.replace('  name: cordis\n', '  name: "@deepseek-ai/cordis"\n'),
      'examples/data.cordis.yml',
      1,
    )
  })

  it.each([
    ['malformed YAML', '- id: framework\n  name: cordis\n  config: [unterminated\n'],
    ['aliases', '- &framework\n  id: framework\n  name: cordis\n- *framework\n'],
    ['unsupported tags', '- id: framework\n  name: !package cordis\n'],
  ])('keeps %s byte-identical in both directions', (_name, source) => {
    expectRoundTrip(source, source, 'examples/unsupported.cordis.yml', 0)
  })

  it.each([
    ['unlabelled', ''],
    ['yaml-labelled', 'yaml'],
    ['yml-labelled', 'yml'],
  ])('keeps ambiguous %s Markdown YAML fences byte-identical', (_name, info) => {
    const source = `\`\`\`${info}\n- id: framework\n  name: cordis\n\`\`\`\n`
    expectRoundTrip(source, source, 'docs/example.md', 0)
  })

  it('keeps a standalone unquoted name property in TypeScript source', () => {
    const source = [
      'const cordis = Symbol()',
      'const entry = {',
      '  name: cordis',
      '}',
      '',
    ].join('\n')
    expectRoundTrip(source, source, 'packages/example.ts', 0)
  })

  it('rewrites explicit docs module syntax without changing quoted prose', () => {
    const source = [
      "Load the module with import('cordis').",
      'The locale id is "cordis", the data id is \'cordis\', and the package-like label is `cordis`.',
      '',
    ].join('\n')
    expectRoundTrip(
      source,
      source.replace("import('cordis')", "import('@deepseek-ai/cordis')"),
      'docs/example.md',
      1,
    )
  })

  it('keeps ui-cordis locale ids', () => {
    const namespace = "export const NS = 'cordis'\n"
    expect(rewriteSourceText(namespace, 'packages/extensions/ui-cordis/src/client/locales.ts')).toEqual({
      text: namespace,
      lines: 0,
    })

    const props = "export type CordisActionRowProps = ToolCallViewProps & PropsLocale<'cordis'>\n"
    expect(rewriteSourceText(props, 'packages/extensions/ui-cordis/src/client/CordisActionRow.tsx')).toEqual({
      text: props,
      lines: 0,
    })
  })

  it('keeps the Settings locale id without hiding a package reference in the same file', () => {
    const source = [
      "import type { Context } from 'cordis'",
      "const label = t('cordis')",
      '',
    ].join('\n')
    expect(rewriteSourceText(
      source,
      'packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.tsx',
    )).toEqual({
      text: [
        "import type { Context } from '@deepseek-ai/cordis'",
        "const label = t('cordis')",
        '',
      ].join('\n'),
      lines: 1,
    })
  })

  it('keeps locale and data ids without hiding module references on the same line', () => {
    expectRoundTrip(
      "const label = t('cordis'); import type { Context } from 'cordis'\n",
      "const label = t('cordis'); import type { Context } from '@deepseek-ai/cordis'\n",
      'packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.tsx',
      1,
    )
    expectRoundTrip(
      "const source = { name: 'cordis' }; const packageJson = import('cordis/package.json')\n",
      "const source = { name: 'cordis' }; const packageJson = import('@deepseek-ai/cordis/package.json')\n",
      'packages/extensions/ui-cordis/src/client/index.ts',
      1,
    )
  })

  it('classifies bare Cordis tokens by semantic role instead of file path', () => {
    const data = [
      "const label = t('cordis')",
      "const source = { name: 'cordis' }",
      '',
    ].join('\n')
    expectRoundTrip(data, data, 'packages/arbitrary/src/example.ts', 0)
    expectRoundTrip(
      `${data}import type { Context } from 'cordis'\n`,
      `${data}import type { Context } from '@deepseek-ai/cordis'\n`,
      'packages/arbitrary/src/example.ts',
      1,
    )
    expectRoundTrip(
      "const modules = { 'cordis': Cordis }\n",
      "const modules = { '@deepseek-ai/cordis': Cordis }\n",
      'packages/client/web/src/seed.ts',
      1,
    )
    expectRoundTrip(
      "writeManifest(root, 'vendor/cordis/package.json', { name: 'cordis' })\n",
      "writeManifest(root, 'vendor/cordis/package.json', { name: '@deepseek-ai/cordis' })\n",
      'scripts/verify-dsh-package-licenses.spec.ts',
      1,
    )
    expectRoundTrip(
      'The `cordis` package is the framework runtime.\n',
      'The `cordis` package is the framework runtime.\n',
      'docs/example.md',
      0,
    )
  })

  it.each([
    [
      'the Web platform module key',
      "const modules = { 'cordis': Cordis }\n",
      "const modules = { '@deepseek-ai/cordis': Cordis }\n",
      'packages/client/web/src/seed.ts',
    ],
    [
      'package metadata in a TypeScript fixture',
      "writeManifest(root, 'vendor/cordis/package.json', { name: 'cordis' })\n",
      "writeManifest(root, 'vendor/cordis/package.json', { name: '@deepseek-ai/cordis' })\n",
      'scripts/verify-dsh-package-licenses.spec.ts',
    ],
  ])('round-trips %s', (_name, source, expected, file) => {
    expectRoundTrip(source, expected, file, 1)
  })

  it('rewrites multiline static references in Markdown fences', () => {
    const fence = '```'
    expectRoundTrip(
      `${fence}ts\nimport { Context } from\n  'cordis/context'\n${fence}\n`,
      `${fence}ts\nimport { Context } from\n  '@deepseek-ai/cordis/context'\n${fence}\n`,
      'README.md',
      1,
    )
  })

  it('rewrites package dependency keys in JSON fences without changing data values', () => {
    const source = [
      '```json',
      '{',
      '  "dependencies": { "cordis": "workspace:^" },',
      '  "peerDependenciesMeta": { "cordis": { "optional": true } },',
      '  "runtime": "cordis",',
      '  "locale": "cordis",',
      '  "data": { "value": "cordis" }',
      '}',
      '```',
      '',
    ].join('\n')
    expectRoundTrip(
      source,
      source.replaceAll('"cordis":', '"@deepseek-ai/cordis":'),
      'README.md',
      2,
    )
  })

  it('round-trips package dependency keys in commented JSONC fences with trailing commas', () => {
    const source = [
      '```jsonc',
      '{',
      '  // Package dependency keys are package references.',
      '  "dependencies": {',
      '    "cordis": "workspace:^",',
      '  },',
      '  "peerDependenciesMeta": {',
      '    "cordis": { "optional": true },',
      '  },',
      '  "runtime": "cordis",',
      '}',
      '```',
      '',
    ].join('\n')
    expectRoundTrip(
      source,
      source.replaceAll('"cordis":', '"@deepseek-ai/cordis":'),
      'README.md',
      2,
    )
  })

  it('keeps malformed JSON fences byte-identical in both directions', () => {
    const source = [
      '```json',
      '{',
      '  "dependencies": {',
      '    "cordis": "workspace:^",',
      '    "@deepseek-ai/cordis": "workspace:^"',
      '  }',
      '```',
      '',
    ].join('\n')
    expectUnchangedInBothDirections(source)
  })

  it('keeps malformed JSONC fences byte-identical in both directions', () => {
    const source = [
      '```jsonc',
      '{',
      '  // The missing dependency value makes this fence invalid.',
      '  "dependencies": {',
      '    "cordis":,',
      '  },',
      '  "peerDependenciesMeta": {',
      '    "@deepseek-ai/cordis": { "optional": true },',
      '  },',
      '}',
      '```',
      '',
    ].join('\n')
    expectUnchangedInBothDirections(source)
  })

  it('uses fence language for JSX while preserving TypeScript generic parsing', () => {
    for (const language of ['tsx', 'jsx']) {
      const source = [
        `\`\`\`${language}`,
        'const view = <Panel source="cordis" />',
        "const load = () => import('cordis/context')",
        '```',
        '',
      ].join('\n')
      expectRoundTrip(
        source,
        source.replace("'cordis/context'", "'@deepseek-ai/cordis/context'"),
        'README.md',
        1,
      )
    }

    const typescript = [
      '```ts',
      'const identity = <T>(value: T): T => value',
      "const load = () => import('cordis/context')",
      '```',
      '',
    ].join('\n')
    expectRoundTrip(
      typescript,
      typescript.replace("'cordis/context'", "'@deepseek-ai/cordis/context'"),
      'README.md',
      1,
    )
  })

  it('rewrites multiline imports and exports inside a matching tilde fence', () => {
    expectRoundTrip(
      [
        '~~~~ts',
        'import { Context } from',
        "  'cordis/context'",
        '~~~',
        'export { Context } from',
        "  'cordis/context'",
        '```',
        'import Cordis from',
        "  'cordis'",
        '~~~~',
        '',
      ].join('\n'),
      [
        '~~~~ts',
        'import { Context } from',
        "  '@deepseek-ai/cordis/context'",
        '~~~',
        'export { Context } from',
        "  '@deepseek-ai/cordis/context'",
        '```',
        'import Cordis from',
        "  '@deepseek-ai/cordis'",
        '~~~~',
        '',
      ].join('\n'),
      'README.md',
      3,
    )
  })

  it('rewrites multiline dynamic references in docs prose', () => {
    expectRoundTrip(
      "Call import(\n  'cordis/package.json'\n) to load the manifest.\n",
      "Call import(\n  '@deepseek-ai/cordis/package.json'\n) to load the manifest.\n",
      'docs/example.md',
      1,
    )
    expectRoundTrip(
      "Call module.require(\n  'cordis/context'\n) to load the module.\n",
      "Call module.require(\n  '@deepseek-ai/cordis/context'\n) to load the module.\n",
      'docs/example.md',
      1,
    )
    expectRoundTrip(
      "Call import.meta.resolve(\n  'cordis/context'\n) to resolve the module.\n",
      "Call import.meta.resolve(\n  '@deepseek-ai/cordis/context'\n) to resolve the module.\n",
      'docs/example.md',
      1,
    )
  })

  it('does not treat a property named import as a bare docs prose call', () => {
    const source = "Text. import(\n  'cordis/context'\n).\n"
    expectRoundTrip(
      source,
      source,
      'docs/example.md',
      0,
    )
  })

  it('does not read natural-language from as a static module statement', () => {
    const source = "The event comes from\n  'cordis/request-run'.\n"
    expectRoundTrip(source, source, 'docs/example.md', 0)
  })

  it.each([
    [
      'static-import-like prose',
      "import statements obtain their source from\n  'cordis/request-run'.\n",
    ],
    [
      'an inline import example',
      "Use import 'cordis/context' as an example.\n",
    ],
    [
      'an inline module declaration',
      "Describe declare module 'cordis/context' in prose.\n",
    ],
    [
      'a block comment',
      "/*\nimport { Context } from\n  'cordis/context'\n*/\n",
    ],
    [
      'quoted prose',
      "const quoted = \"call import('cordis/context')\"\n",
    ],
    [
      'template prose',
      "const templated = `call require('cordis/context')`\n",
    ],
  ])('does not rewrite module-like text inside %s', (_name, source) => {
    expectRoundTrip(source, source, 'docs/example.md', 0)
  })

  it.each([
    ['backtick', '````', '```', '~~~'],
    ['tilde', '~~~~', '~~~', '```'],
  ])('rewrites module references inside a CRLF %s fence', (_name, opening, shorter, other) => {
    const source = [
      `${opening}ts`,
      'import {',
      '  Context,',
      '} from',
      "  'cordis/context'",
      shorter,
      'export {',
      '  Context,',
      '} from',
      "  'cordis/context'",
      other,
      'const packageJson = import(',
      "  'cordis/package.json'",
      ')',
      opening,
      '',
    ].join('\r\n')
    const expected = source
      .replaceAll("'cordis/context'", "'@deepseek-ai/cordis/context'")
      .replace("'cordis/package.json'", "'@deepseek-ai/cordis/package.json'")
    expectRoundTrip(source, expected, 'README.md', 3)
  })

  it('rewrites multiline static and dynamic references in templates while keeping event ids', () => {
    expectRoundTrip(
      [
        'import { Context } from',
        "  'cordis/context'",
        'export { Context } from',
        "  'cordis/context'",
        'const packageJson = import(',
        "  'cordis/package.json'",
        ')',
        'const required = require(',
        "  'cordis/context'",
        ')',
        'const resolved = require.resolve(',
        "  'cordis/package.json'",
        ')',
        "declare module 'cordis/context'",
        "ctx.emit('cordis/request-run', request)",
        "const label = t('cordis')",
        '',
      ].join('\n'),
      [
        'import { Context } from',
        "  '@deepseek-ai/cordis/context'",
        'export { Context } from',
        "  '@deepseek-ai/cordis/context'",
        'const packageJson = import(',
        "  '@deepseek-ai/cordis/package.json'",
        ')',
        'const required = require(',
        "  '@deepseek-ai/cordis/context'",
        ')',
        'const resolved = require.resolve(',
        "  '@deepseek-ai/cordis/package.json'",
        ')',
        "declare module '@deepseek-ai/cordis/context'",
        "ctx.emit('cordis/request-run', request)",
        "const label = t('cordis')",
        '',
      ].join('\n'),
      'templates/example.tpl',
      6,
    )
  })

  it('rewrites backtick imports in templates and Markdown fences', () => {
    expectRoundTrip(
      'import(`cordis/context`)\n',
      'import(`@deepseek-ai/cordis/context`)\n',
      'templates/example.tpl',
      1,
    )
    expectRoundTrip(
      '```ts\nimport(`cordis/context`)\n```\n',
      '```ts\nimport(`@deepseek-ai/cordis/context`)\n```\n',
      'README.md',
      1,
    )
  })

  it('supports only the explicit Node module resolution receivers', () => {
    const accepted = [
      "const resolved = import.meta.resolve('cordis/context')",
      "const required = module.require('cordis/package.json')",
      '',
    ].join('\n')
    const rewritten = accepted.replaceAll("'cordis/", "'@deepseek-ai/cordis/")
    expectRoundTrip(accepted, rewritten, 'packages/arbitrary/src/example.ts', 2)
    expectRoundTrip(accepted, rewritten, 'templates/example.tpl', 2)
    expectRoundTrip(
      `\`\`\`ts\n${accepted}\`\`\`\n`,
      `\`\`\`ts\n${rewritten}\`\`\`\n`,
      'README.md',
      2,
    )

    const rejected = [
      "loader.require('cordis/context')",
      "loader.import('cordis/context')",
      "loader.resolve('cordis/context')",
      "new require('cordis/context')",
      "new module.require('cordis/context')",
      "module?.require('cordis/context')",
      "module.require?.('cordis/context')",
      "import.meta?.resolve('cordis/context')",
      '',
    ].join('\n')
    expectRoundTrip(rejected, rejected, 'packages/arbitrary/src/example.ts', 0)
    expectRoundTrip(rejected, rejected, 'templates/example.tpl', 0)
  })

  it('rejects qualified and constructed calls plus trailing declaration prose', () => {
    const source = [
      "loader.require('cordis/context')",
      "loader. require('cordis/context')",
      "loader.import('cordis/context')",
      "loader.require.resolve('cordis/context')",
      "loader?.require('cordis/context')",
      "loader?. require('cordis/context')",
      "module?. require('cordis/context')",
      "require?.('cordis/context')",
      "new require('cordis/context')",
      "require.call(null, 'cordis/context')",
      'require(`cordis/${name}`)',
      "declare module 'cordis/context' trailing prose",
      '',
    ].join('\n')
    expectRoundTrip(source, source, 'templates/example.tpl', 0)
    const docs = [
      "Use import('cordis/context') or require(\"cordis/context\").",
      'Resolve with require.resolve(`cordis/context`).',
      `Use ${source}`,
    ].join('\n')
    const expected = docs
      .replace("import('cordis/context')", "import('@deepseek-ai/cordis/context')")
      .replace('require("cordis/context")', 'require("@deepseek-ai/cordis/context")')
      .replace('require.resolve(`cordis/context`)', 'require.resolve(`@deepseek-ai/cordis/context`)')
    expectRoundTrip(docs, expected, 'docs/example.md', 2)
  })

  it('isolates scanner state and syntax fragments between Markdown fences', () => {
    const source = [
      '```ts',
      '/*',
      '```',
      '```ts',
      "import('cordis/context')",
      '```',
      '```ts',
      'const text = "',
      '```',
      '```ts',
      "require('cordis/context')",
      '```',
      '```ts',
      'import { Context } from',
      '```',
      '```ts',
      "'cordis/context'",
      '```',
      '',
    ].join('\n')
    const expected = source
      .replace("import('cordis/context')", "import('@deepseek-ai/cordis/context')")
      .replace("require('cordis/context')", "require('@deepseek-ai/cordis/context')")
    expectRoundTrip(source, expected, 'README.md', 2)
  })

  it('accepts typed module syntax after comments and semicolons', () => {
    const source = [
      "/* lead */ import type { Context } from 'cordis/context' with { type: 'json' }",
      "; import { Context } from 'cordis/context'",
      "export type { Context } from 'cordis/context' with { type: 'json' }",
      "type ContextType = import('cordis/context').Context",
      "import Cordis = require('cordis/context')",
      '',
    ].join('\n')
    expectRoundTrip(
      source,
      source.replaceAll("'cordis/context'", "'@deepseek-ai/cordis/context'"),
      'templates/example.tpl',
      5,
    )
  })

  it('keeps runtime event scope metadata and escaped catalog signatures', () => {
    const source = [
      "const EVENT_SCOPE_PAGE = { 'cordis': 'extensions.md' }",
      "const events = EVENT_API.filter(event => event.name.startsWith('cordis/'))",
      "const heading = '`cordis/*` events'",
      "const signature = '\\'cordis/request-run\\'(request: Request): void'",
      '',
    ].join('\n')
    expect(rewriteSourceText(source, 'scripts/gen-cordis-catalog.ts')).toEqual({
      text: source,
      lines: 0,
    })
  })
})

describe('repositoryPostconditionFailures', () => {
  it('rejects all six scoped runtime event ids without rejecting their canonical ids', () => {
    const suffixes = [
      'request-run',
      'request-run-resolved',
      'dynamic-package',
      'dynamic-retract',
      'inspect-query',
      'inspect-query-resolved',
    ]
    const scopedPrefix = ['@deepseek-ai', 'cordis'].join('/')
    const invalid = suffixes.map(suffix => `ctx.emit('${scopedPrefix}/${suffix}')`).join('\n')
    const canonical = suffixes.map(suffix => `ctx.emit('cordis/${suffix}')`).join('\n')

    const failures = repositoryPostconditionFailures(invalid)
    expect(failures).toHaveLength(6)
    for (const suffix of suffixes) {
      expect(failures.some(failure => failure.includes(`${scopedPrefix}/${suffix}`))).toBe(true)
    }
    expect(repositoryPostconditionFailures(canonical)).toEqual([])
  })

  it('makes --check reject a scoped runtime event injected into a temporary tracked copy', () => {
    const repositoryRoot = resolve(import.meta.dirname, '..')
    const copyRoot = mkdtempSync(join(tmpdir(), 'dsh-rescope-check-'))
    const invalidId = `${['@deepseek-ai', 'cordis'].join('/')}/request-run`
    try {
      execFileSync('git', ['checkout-index', '--all', `--prefix=${copyRoot}/`], { cwd: repositoryRoot })
      copyFileSync(
        join(repositoryRoot, 'scripts/rescope-vendor.ts'),
        join(copyRoot, 'scripts/rescope-vendor.ts'),
      )
      copyFileSync(
        join(repositoryRoot, 'scripts/cordis-config-files.ts'),
        join(copyRoot, 'scripts/cordis-config-files.ts'),
      )
      const readme = join(copyRoot, 'README.md')
      writeFileSync(readme, `${readFileSync(readme, 'utf8')}\n${invalidId}\n`)
      const result = spawnSync(
        process.execPath,
        ['--import', 'tsx/esm', join(copyRoot, 'scripts/rescope-vendor.ts'), '--check'],
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            GIT_DIR: execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
              cwd: repositoryRoot,
              encoding: 'utf8',
            }).trim(),
            GIT_WORK_TREE: copyRoot,
          },
        },
      )

      expect(result.status).toBe(1)
      expect(result.stderr).toContain(invalidId)
    } finally {
      rmSync(copyRoot, { force: true, recursive: true })
    }
  }, 20_000)
})

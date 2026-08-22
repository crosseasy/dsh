# Assemble the Fusion Web profile

English | [中文](fusion-profile.zh.md)

The Fusion Web profile preserves the external-integration release layer on top of the standard Web application. No external package currently satisfies every admission criterion, so the profile adds zero external rows while retaining three bundle layers: `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `@deepseek-ai/dsh-fusion`.

## Prerequisites

Use `@deepseek-ai/dsh@0.1.0-rc.5`, Node.js 22.19.0 or any release from 24.0.0 onward, and pnpm. The commands require a fresh `DSH_HOME` because they replace the new profile's pnpm workspace settings.

## Create the profile

Create a temporary Harness home and add the Fusion bundle at the same exact version as `dsh`:

```sh
export DSH_HOME="$(mktemp -d "${TMPDIR:-/tmp}/dsh-fusion.XXXXXX")"
export FUSION_PROFILE="$DSH_HOME/profiles/fusion"

dsh plugin --profile fusion add @deepseek-ai/dsh-fusion@0.1.0-rc.5

node --input-type=module - "$FUSION_PROFILE/package.json" <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs'

const path = process.argv[2]
const manifest = JSON.parse(readFileSync(path, 'utf8'))
manifest.dsh.profile.bundles = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-fusion',
]
writeFileSync(path, `${JSON.stringify(manifest, undefined, 2)}\n`)
NODE
```

The `base` and `web-app` bundles resolve from the installed `dsh`; the profile dependency supplies `fusion`. The normalization makes their order explicit and prevents any other installed bundle declaration from becoming a profile layer.

## Keep the profile external-free

The current Fusion profile needs no external dependency or build approval. Keep its pnpm workspace settings minimal:

```sh
cat > "$FUSION_PROFILE/pnpm-workspace.yaml" <<'YAML'
packages:
  - .
YAML
```

Do not add ModLens, SSH, Remote Web UI, their React peers, or their transitive build approvals to this profile or the repository root.

## Confirm zero external dependencies

The Fusion package's [`dsh.bundle.profileDependencies`](../../../packages/bundle/fusion/package.json) is `{}`, and its patch is empty. Do not install any external candidate until a published version passes the complete license, security, lifecycle, rc.5, and assembled-runtime criteria.

## Verify the profile manifest

Check the exact bundle list and confirm that no blocked package is declared in the profile's `dependencies` before boot:

```sh
node --input-type=module - "$FUSION_PROFILE/package.json" <<'NODE'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const expectedBundles = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-fusion',
]
const blockedPackages = [
  '@liustack/modlens',
  '@linxin666/dsh-ssh',
  '@linxin666/dsh-remote-web-ui',
  '@linxin666/dsh-web-ui-all',
  '@linxin666/dsh-client-ui-task-board',
  '@linxin666/dsh-pet',
  '@linxin666/dsh-client-ui-git-graph',
  '@linxin666/dsh-client-ui-skin-center',
  'dsh-better-sidebar',
]

if (JSON.stringify(manifest.dsh?.profile?.bundles) !== JSON.stringify(expectedBundles)) {
  throw new Error('fusion profile bundle order does not match the documented recipe')
}
for (const name of blockedPackages) {
  if (manifest.dependencies?.[name] !== undefined) throw new Error(`${name} is blocked`)
}
console.log('fusion profile manifest verified')
NODE
```

The command prints `fusion profile manifest verified`.

## Start the Web UI

Start the profile on an available port:

```sh
dsh --profile fusion --port 3080
```

Open the printed URL. The page remains the stock Web interface, including its left `ui-sidebar`, Settings, and New Session entry. Open the agent preset picker for a new session and select **梁神模式**. The preset roster returned by the Web API uses the id `liangshen`; the preset is repository-owned and is not a Fusion external row.

The checked-in browser acceptance boots this zero-row recipe through system Chrome CDP `9333`. It verifies that all eight blocked integrations have no Host row, browser entry, client resource, UI root, route, or tool, while the stock Web interface remains visible and diagnostics and cleanup are clean.

## Known limitations

- This profile has zero external rows, so image understanding, SSH, mobile remote UI, Task Board, Pet, Git Graph, Skin Center, and the right-side Files, editor, terminal, and Source Control workbench are unavailable. Do not install candidate packages or add profile rows to bypass admission. The owning [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) defines the zero-row decision, package-specific blockers, and revalidation requirements.

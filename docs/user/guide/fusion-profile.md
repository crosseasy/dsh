# Assemble the Fusion Web profile

English | [中文](fusion-profile.zh.md)

The Fusion Web profile preserves the external-integration release layer on top of the standard Web application. Pet `0.2.9` satisfies every admission criterion, so the profile adds that row while retaining three bundle layers: `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `@deepseek-ai/dsh-fusion`.

## Prerequisites

Use `@deepseek-ai/dsh@0.1.0-rc.5`, Node.js 22.19.0 or any release from 24.0.0 onward, and pnpm. The commands require a fresh `DSH_HOME` because they replace the new profile's pnpm workspace settings.

## Create the profile

Create a temporary Harness home and add the Fusion bundle at the same exact version as `dsh`:

```sh
export DSH_HOME="$(mktemp -d "${TMPDIR:-/tmp}/dsh-fusion.XXXXXX")"
export FUSION_PROFILE="$DSH_HOME/profiles/fusion"

dsh plugin --profile fusion add @deepseek-ai/dsh-fusion@0.1.0-rc.5
dsh plugin --profile fusion add \
  @linxin666/dsh-pet@0.2.9 \
  react@18.3.1 \
  react-dom@18.3.1

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

## Pin the profile dependencies

The accepted package and its React peers are profile-owned. They need no native build approval. Keep the fresh-release exception exact:

```sh
cat > "$FUSION_PROFILE/pnpm-workspace.yaml" <<'YAML'
packages:
  - .
nodeLinker: hoisted
autoInstallPeers: false
minimumReleaseAgeExclude:
  - '@linxin666/dsh-pet@0.2.9'
YAML
```

Do not add Git Graph, ModLens, SSH, Remote Web UI, or their transitive build approvals to this profile or the repository root.

## Confirm exact external dependencies

The Fusion package's [`dsh.bundle.profileDependencies`](../../../packages/bundle/fusion/package.json) contains exactly Pet `0.2.9`, and its patch inserts exactly `pet`. Do not install another external candidate until a published version passes the complete license, security, lifecycle, ownership, deduplication, rc.5, and assembled-runtime criteria.

## Verify the profile manifest

Check the exact bundle list and four-entry dependency map before boot:

```sh
node --input-type=module - "$FUSION_PROFILE/package.json" <<'NODE'
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const expectedBundles = [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  '@deepseek-ai/dsh-fusion',
]
const expectedDependencies = {
  '@deepseek-ai/dsh-fusion': '0.1.0-rc.5',
  '@linxin666/dsh-pet': '0.2.9',
  react: '18.3.1',
  'react-dom': '18.3.1',
}

if (JSON.stringify(manifest.dsh?.profile?.bundles) !== JSON.stringify(expectedBundles)) {
  throw new Error('fusion profile bundle order does not match the documented recipe')
}
if (Object.keys(manifest.dependencies ?? {}).length !== Object.keys(expectedDependencies).length) {
  throw new Error('fusion profile dependencies do not match the documented recipe')
}
for (const [name, version] of Object.entries(expectedDependencies)) {
  if (manifest.dependencies?.[name] !== version) throw new Error(`${name} must be ${version}`)
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

Open the printed URL. The page retains the stock Web interface, including its left `ui-sidebar`, Settings, and New Session entry. Pet is visible as one global dock. Open the agent preset picker for a new session and select **梁神模式**. The preset roster returned by the Web API uses the id `liangshen`; the preset is repository-owned and is not a Fusion external row.

Confirm that the page has this state and that the browser console reports no errors. Repository verification uses the [Fusion external-profile acceptance](../../testing.md#tiers); the owning [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) records its durable admission and verification requirements.

## Known limitations

- This profile has one external row. Git Graph `0.2.9` remains unavailable because an active JSON operation and its child process can outlive row-fiber disposal. Image understanding, SSH, mobile remote UI, Task Board, Skin Center, and the right-side Files, editor, terminal, and Source Control workbench are also unavailable. Do not install other candidate packages or add profile rows to bypass admission. The owning [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) defines the accepted set, package-specific blockers, and revalidation requirements.

# Assemble the Fusion Web profile

English | [中文](fusion-profile.zh.md)

The Fusion Web profile preserves the external-integration release layer on top of the standard Web application. Pet and Git Graph `0.2.9` satisfy every admission criterion, so the profile adds those two rows while retaining three bundle layers: `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `@deepseek-ai/dsh-fusion`.

## Prerequisites

Use `@deepseek-ai/dsh@0.1.0-rc.5`, Node.js 22.19.0 or any release from 24.0.0 onward, and pnpm. The commands require a fresh `DSH_HOME` because they replace the new profile's pnpm workspace settings.

## Create the profile

Create a temporary Harness home and add the Fusion bundle at the same exact version as `dsh`:

```sh
export DSH_HOME="$(mktemp -d "${TMPDIR:-/tmp}/dsh-fusion.XXXXXX")"
export FUSION_PROFILE="$DSH_HOME/profiles/fusion"

dsh plugin --profile fusion add @deepseek-ai/dsh-fusion@0.1.0-rc.5
dsh plugin --profile fusion add \
  @linxin666/dsh-client-ui-git-graph@0.2.9 \
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

The two accepted packages and their React peers are profile-owned. They need no native build approval. Keep the fresh-release exceptions exact:

```sh
cat > "$FUSION_PROFILE/pnpm-workspace.yaml" <<'YAML'
packages:
  - .
nodeLinker: hoisted
autoInstallPeers: false
minimumReleaseAgeExclude:
  - '@linxin666/dsh-client-ui-git-graph@0.2.9'
  - '@linxin666/dsh-pet@0.2.9'
YAML
```

Do not add ModLens, SSH, Remote Web UI, or their transitive build approvals to this profile or the repository root.

## Confirm exact external dependencies

The Fusion package's [`dsh.bundle.profileDependencies`](../../../packages/bundle/fusion/package.json) contains exactly Pet and Git Graph `0.2.9`, and its patch inserts exactly `pet` and `ui-git-graph`. Do not install another external candidate until a published version passes the complete license, security, lifecycle, ownership, deduplication, rc.5, and assembled-runtime criteria.

## Verify the profile manifest

Check the exact bundle list and five-entry dependency map before boot:

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
  '@linxin666/dsh-client-ui-git-graph': '0.2.9',
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

Open the printed URL. The page retains the stock Web interface, including its left `ui-sidebar`, Settings, and New Session entry. Pet is visible as one global dock, and Git Graph adds one branch chip for a session backed by a Git workspace. Open the agent preset picker for a new session and select **梁神模式**. The preset roster returned by the Web API uses the id `liangshen`; the preset is repository-owned and is not a Fusion external row.

The checked-in browser acceptance boots this two-row recipe through system Chrome CDP `9333`. It verifies exact package and row identity, one Pet root, one Git Graph chip, live data from the Pet-state and Git-branches probes, blocked-package absence, stock Web visibility, clean diagnostics, and cleanup.

## Known limitations

- This profile has two external rows. Image understanding, SSH, mobile remote UI, Task Board, Skin Center, and the right-side Files, editor, terminal, and Source Control workbench remain unavailable. Do not install other candidate packages or add profile rows to bypass admission. The owning [Agent Note](../../../.agents/notes/implemented/architecture/2026-08-19-fusion-profile-external-plugin-ownership.md) defines the accepted set, package-specific blockers, and revalidation requirements.

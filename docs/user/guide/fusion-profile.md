# Assemble the Fusion Web profile

English | [中文](fusion-profile.zh.md)

The Fusion Web profile adds the curated modlens and Web UI plugins to the standard Web application. This procedure creates an isolated profile with three bundle layers: `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `@deepseek-ai/dsh-fusion`.

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

## Allow required package builds

Write the build approvals to this profile, not to the repository or another profile:

```sh
cat > "$FUSION_PROFILE/pnpm-workspace.yaml" <<'YAML'
packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false

allowBuilds:
  cloudflared@0.7.3: true
  cpu-features@0.0.10: true
  ssh2@1.17.0: true
YAML
```

These are the complete build approvals for this profile. Do not add them to the repository root.

## Install the profile-owned packages

Install the six packages recorded by [`dsh.bundle.profileDependencies`](../../../packages/bundle/fusion/package.json) and their React peer providers directly through the profile's pnpm installation root:

```sh
pnpm --dir "$FUSION_PROFILE" add --save-exact \
  @liustack/modlens@3.22.0 \
  @linxin666/dsh-client-ui-task-board@0.2.4 \
  @linxin666/dsh-ssh@0.2.4 \
  @linxin666/dsh-remote-web-ui@0.2.4 \
  @linxin666/dsh-pet@0.2.4 \
  @linxin666/dsh-client-ui-skin-center@0.2.4 \
  react@18.3.1 \
  react-dom@18.3.1
```

Using profile-local pnpm keeps these packages in `profiles/fusion/node_modules` without appending their own bundle declarations to `dsh.profile.bundles`. Preserve `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml` together to reproduce the installation.

## Verify the profile manifest

Check the exact bundle list and profile-owned dependency versions before boot:

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
  '@liustack/modlens': '3.22.0',
  '@linxin666/dsh-client-ui-task-board': '0.2.4',
  '@linxin666/dsh-ssh': '0.2.4',
  '@linxin666/dsh-remote-web-ui': '0.2.4',
  '@linxin666/dsh-pet': '0.2.4',
  '@linxin666/dsh-client-ui-skin-center': '0.2.4',
  react: '18.3.1',
  'react-dom': '18.3.1',
}

if (JSON.stringify(manifest.dsh?.profile?.bundles) !== JSON.stringify(expectedBundles)) {
  throw new Error('fusion profile bundle order does not match the documented recipe')
}
for (const [name, version] of Object.entries(expectedDependencies)) {
  if (manifest.dependencies?.[name] !== version) {
    throw new Error(`${name} must resolve from the profile at ${version}`)
  }
}
console.log('fusion profile manifest verified')
NODE
```

The command prints `fusion profile manifest verified`. A missing external package otherwise fails during normal plugin resolution when the profile boots.

## Start the Web UI

Start the profile on an available port:

```sh
dsh --profile fusion --port 3080
```

Open the printed URL. The left session sidebar remains the standard `ui-sidebar`; the same page also exposes Task Board, Skin Center, the pet dock, mobile remote control, and the modlens image/settings entry. Open the agent preset picker for a new session and select **梁神模式**. The preset roster returned by the Web API uses the id `liangshen`.

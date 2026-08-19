# Fusion profile

English | [中文](fusion-profile.zh.md)

The `fusion` profile adds the curated external Web plugin set to the standard browser application. It requires dsh `0.1.0-rc.7` and pnpm.

## Create the profile

Install the Web application layer first:

```sh
dsh plugin --profile fusion add @deepseek-ai/dsh-web-app@0.1.0-rc.7
```

The command creates `$DSH_HOME/profiles/fusion/pnpm-workspace.yaml`. Before installing the Fusion layer, add only these required lifecycle-script approvals to that file:

```yaml
allowBuilds:
  node-pty@1.1.0: true
  cloudflared: true
  cpu-features: true
  ssh2: true
```

Install the Fusion layer and start the profile:

```sh
dsh plugin --profile fusion add @deepseek-ai/dsh-fusion@0.1.0-rc.7
dsh --profile fusion
```

## Verify the profile

`$DSH_HOME/profiles/fusion/package.json` must list the bundle layers in this order:

```json
[
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "@deepseek-ai/dsh-fusion"
]
```

Open the URL printed by `dsh` and verify:

- The standard session sidebar remains on the left.
- The right workbench provides Explorer, Editor, Terminal, and Git tabs.
- Task Board, Skin Center, Pet, ModLens, remote Web, SSH, and contributed Web UI settings are available.
- The agent-preset picker includes **梁神模式**; select it before starting the session that should use Liangshen.

The profile pins the nine Fusion runtime packages. Recreate and verify the profile when upgrading dsh or any Fusion package.

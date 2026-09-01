# Use a curated profile

English | [中文](curated-profiles.zh.md)

DeepSeek Harness ships five governed Web profile templates: `web-curated`, `web-coding`, `web-research`, `web-enterprise`, and `web-personal`. Each template fixes its bundle order, package-manager policy, and admitted dependency set. Use a curated profile when you want those checks to run before Loader activation instead of maintaining an unrestricted custom profile.

## Choose a profile

| Profile | Intended use |
|---|---|
| `web-curated` | General governed Web baseline |
| `web-coding` | Coding-oriented candidate track |
| `web-research` | Research-oriented candidate track |
| `web-enterprise` | Enterprise policy track |
| `web-personal` | Personal interface track |

All five templates currently contain only the installation-owned `dsh-base`, `dsh-web-app`, and `dsh-curated-base` bundles. No audited third-party candidate is runtime-active.

## Inspect the dependency set

List the fixed third-party dependency set without creating profile state or invoking pnpm:

```sh
dsh plugin --profile web-curated list
```

The current `web-curated` template reports:

```text
web-curated:
  (no third-party plugin dependencies)
```

Replace `web-curated` with another built-in curated profile name to inspect that template.

## Install the profile

Install the template's exact dependency set:

```sh
dsh plugin --profile web-curated install
```

Installation runs offline with dependency lifecycle scripts disabled. It validates the generated profile files, both pnpm lockfiles, bundle resolution, and curated admission before activating the staged directory. A missing local package fails without a network fetch. Failures before activation leave the previous live profile unchanged; after activation starts, rollback restores it only while the activated and previous directory identities still match. Curated profiles reject `add`, `remove`, package transformations, build grants, and extra `install` arguments.

## Verify and start

Inspect the admitted composition before starting the server:

```sh
dsh --profile web-curated --dump-config
```

Then start the Web UI without opening a browser automatically:

```sh
dsh --profile web-curated --no-open
```

An installed release includes the required Client bundles. A source checkout must complete `pnpm run build` before launch; otherwise startup reports the missing `lib/client.js` artifacts. The [Web UI guide](index.md) covers model and workspace setup after the server prints its URL.

## Limits

Curated profile names and dependency sets are fixed by the installed release. Current templates expose governance infrastructure but no third-party runtime behavior. The [curated subsystem reference](../../subsystems/curated.md) owns admission semantics and evidence requirements; the [CLI reference](../../../apps/cli/reference/README.md) owns command restrictions and recovery behavior.

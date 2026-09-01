# `@deepseek-ai/dsh`

English | [中文](README.zh.md)

The `dsh` command is the product launcher for profiles: ordered stacks of plugin-bundle patch layers under the user's own overrides. [`src/args.ts`](src/args.ts) owns the command grammar, and [`src/bin.ts`](src/bin.ts) loads only the selected runner. Invalid commands, options from another mode, configuration errors, and boot failures exit nonzero.

## Entry modes

| Command | Purpose |
|---|---|
| `dsh --profile <name>` | Boot the named profile under `$DSH_HOME/profiles/<name>`. |
| `dsh --profile headless "job"` | Run one fresh persisted session, print the final answer, and exit. |
| `dsh web` | Alias of `--profile web`. |
| `dsh plugin --profile <name> <pnpm args>` | Manage profile plugins through pnpm with dependency lifecycle scripts disabled. |

The invoking directory is the default workspace root. The `web` and `headless` profiles auto-initialize on first use from shipped templates. Built-in curated profiles (`web-curated`, `web-coding`, `web-research`, `web-enterprise`, and `web-personal`) materialize from `@deepseek-ai/dsh-curated-profiles` on first startup, config dump, or install without changing the shipped templates; curated plugin help and listing stay read-only even when the profile is absent. Any other profile must be created through `dsh plugin`.

Curated startup and config dump fail before Loader activation unless the manifest matches its template and catalog assignment, package-manager settings remain safe, and profile, home, and command-line patch layers contain neither dynamic expressions nor unapproved plugin/group insertions. Curated startup, config dump, and live recomposition acquire the same atomic per-profile lock as installation before materializing managed files and retain it through descriptor-bound use. If installation owns the profile, preparation fails without creating a live directory. A previous-only interrupted-install state also fails preparation and requires `dsh plugin --profile <curated-name> install` recovery. During initial preparation, one retained descriptor-bound snapshot checks the profile identities immediately before and after every shared `profiles/node_modules` fallback mutation, then writes the generated `cordis.yml` through a checked random sibling and atomically renames it into place before a final identity check. Replacing a profile ancestor with an unrelated symlink or junction target at these checked stages fails closed without sending root-config content to that target. This does not prevent a process with the same filesystem permissions from moving the already-open original directory outside the DSH home and linking that same inode back before a path-based mutation; callers must exclusively manage the DSH home during preparation. Every curated live recomposition reads the profile patch from a fresh descriptor-bound managed-file snapshot, rechecks its identity after admission, and closes it before returning; home patches remain path-read per generation and command-line overlays remain fixed for the run. Enterprise restrictions apply to the final static composition and every live user-patch reload. Curated bundle membership is fixed.

`dsh plugin --profile <curated-name> install` serializes writers across processes and against profile preparation, restores or removes interrupted-install state while holding the lock, installs exactly the template dependencies from the local pnpm store into a private staging home with lifecycle scripts disabled, retains an existing profile patch and lockfile, and validates the staged generated files, both pnpm lockfiles, bundle resolution, and admission before directory-rename activation. Lock ownership requires the recorded process incarnation, random owner token, and claimed lock-directory device/inode identity, so copied owner contents do not transfer ownership. When both a live profile and `.install-previous` exist, recovery validates the complete live profile before treating the backup as deferred successful-cleanup residue; failed validation preserves both directories and aborts the retry. Previous-only recovery also verifies that the directory moved to the live path retains the captured previous identity.

The installer opens both staged locks once, admits their captured bytes against exact catalog npm or Git identities and runtime closure digests, hashes every selected installed candidate tree before activation, and rechecks all managed, lock, and candidate-tree bytes after the rename. Candidate hashing retains each path's device/inode, size, modification time, and change time and rechecks all entries after the complete hash, without retaining one descriptor per file. It captures the staged directory identity before rename; a different directory at the live path remains untouched and makes rollback fail. Cleanup and rollback also require the retained previous-profile directory identity. pnpm failure or validation failure leaves the previous live profile unchanged; activation failure restores the previous directory only while the activated and previous directory identities still match, otherwise the replacement remains untouched and rollback fails.

The installer removes ambient npm/pnpm configuration, pins pnpm's user and global config to the staged `.npmrc`, uses `--frozen-lockfile` when a live lockfile exists, rejects package-manager root redirects, transformations, and build-grant environment overrides, and accepts no additional arguments. A missing local package fails instead of triggering a network fetch. Curated `--help` and `list` are generated from the checked-in template and do not create a profile or invoke pnpm; commands that change the dependency set reject before pnpm runs. Ordinary profiles retain general plugin management and user patch behavior; removing a redundant dependency never removes the same package's installation-owned template bundle.

## App arguments

The launcher parses only its own flags and hands everything after them to the booted profile, where any injected app plugin may parse the shared immutable snapshot ([`dsh-cmdline`](../../packages/boot/cmdline/README.md)). Launcher flags therefore come first, and the first token the launcher does not recognize starts the app's arguments:

```sh
dsh --profile web --port 8080       # --port belongs to the web app
dsh --profile tui --resume <id>     # example, assuming the tui profile is installed; --resume belongs to the terminal app
dsh --profile headless "run the tests"
dsh --profile web --help            # the web app's flags, not the launcher's
dsh --help                          # the launcher's own help
```

## Profiles

A profile directory holds a `package.json` (out-of-tree plugin dependencies plus the profile manifest `dsh.profile` with its ordered `bundles` list) and a `cordis.patch.yml` (the user's own patch layer).

The tree composes over an empty root:
- each bundle's patch in `dsh.profile.bundles` order
- then the profile's `cordis.patch.yml`, then the home-level `$DSH_HOME/cordis.patch.yml`
- then `--patch` overlays

Bundles named in `dsh.profile.bundles` resolve from the dsh installation first (`@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, `@deepseek-ai/dsh-headless`), then from the profile's own `node_modules`, where pnpm installs out-of-tree plugins.

Use `--dump-default-config` and `--dump-config` to inspect the composed tree without booting it.

The [CLI behavior reference](reference/README.md) owns exact layer precedence, flags, shutdown behavior, deployment defaults, and source execution.

## Development

Production runs require built package and frontend artifacts. From the repository root, run `pnpm run build` separately, then use `pnpm dsh <args...>` to run the TypeScript entry and forward every argument; the [source-execution reference](reference/README.md#source-execution) owns the module-resolution contract.

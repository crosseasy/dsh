# Curated Activation Evidence

English | [中文](README.zh.md)

This repository-owned directory is the only location from which `runtimeActivationEvidence` may reference activation records and result artifacts. The [`verify-curated-activation-evidence`](../../../../scripts/verify-curated-activation-evidence.ts) gate accepts only tracked stage-zero regular blobs here. Each active candidate supplies a map whose keys exactly equal `targetProfiles`; every profile value contains JSON records for `keyless-assembled-snapshot`, `install`, `enable`, `restart`, and `disable-or-uninstall`, and all five records name that map key, follow the operation schema, and bind separate result artifacts by SHA-256. Record `command` arrays and artifact `command.argv` arrays contain the exact executed argv without secret values; the gate rejects secret-bearing forms, including URL userinfo in scheme URLs, option-assigned URLs, and schemeless `user:pass@host:port` values, without including argument text in its diagnostics.

Package-authored evidence or sidecars, ignored or untracked files, symlinks, and files below `.git` or `node_modules` cannot authorize activation.

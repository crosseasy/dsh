# `@deepseek-ai/dsh-fusion`

English | [中文](README.zh.md)

The fusion bundle is a pure profile patch layer for curated external plugins over `dsh-web-app`. Its manifest exposes [`cordis.patch.yml`](cordis.patch.yml) through `dsh.bundle.patch`, and its root module has no runtime API.

The patch mounts `@liustack/modlens@3.21.1`, `dsh-better-sidebar@0.13.1`, and seven `0.2.2` Web UI packages: `@linxin666/dsh-client-ui-web-ui-settings`, `@linxin666/dsh-client-ui-task-board`, `@linxin666/dsh-client-ui-git-graph`, `@linxin666/dsh-remote-web-ui`, `@linxin666/dsh-ssh`, `@linxin666/dsh-pet`, and `@linxin666/dsh-client-ui-skin-center`. These runtime dependencies use exact versions.

The composition omits `@linxin666/dsh-web-ui-all`, `@linxin666/dsh-tool-describe-image`, `@linxin666/dsh-client-ui-aionui-panel`, `@linxin666/dsh-skins`, and the `@linxin666/dsh-liangshen` runtime row.

## Model Experience

Indirectly, through the mounted plugins, which own their model-visible behavior.

#### KV Cache effect

The patch adds no request content itself; each mounted plugin owns any prompt, tool-schema, or message contribution and its cache effect.

## Known Limitations and Deferred Work

- **Compatibility is pinned to dsh `0.1.0-rc.7`** — changing dsh or an external dependency requires repeating the installation, boot, and browser diagnostics.
- **The bundle requires the Web layers** — its browser plugins rely on the Host and client roster mounted by `dsh-web-app`.
- **Liangshen is outside this bundle** — the composition neither installs nor synchronizes a Liangshen preset.

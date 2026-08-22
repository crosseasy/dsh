# Desktop shell consumption contract

English | [中文](desktop-shell-contract.zh.md)

The Electron desktop shell consumes DeepSeek Harness as released npm packages. Its `dependencies` and lockfile pin `@deepseek-ai/dsh` and `@deepseek-ai/dsh-fusion` to the same exact version, such as `0.1.0-rc.5`. Version ranges, Git dependencies, workspace links, vendored copies, and Git submodules do not satisfy this contract.

## Profile and service

The shell owns an internal profile named `fusion`. Its ordered bundle list is `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and `@deepseek-ai/dsh-fusion`; the [Fusion Web profile guide](./fusion-profile.md) defines the current zero-row composition.

The shell starts the installed `dsh` executable with `--profile fusion`, waits for its HTTP endpoint, and loads that endpoint in the application window. The shell also owns service restart and shutdown around application lifecycle events.

## Capability ownership

Fusion does not provide mobile remote access while every external candidate remains blocked. The desktop shell may retain its own remote implementation and owns that implementation's lifecycle; consuming Fusion does not require the shell to disable or close it.

The desktop shell owns native windows, the system tray, automatic service startup, application updates, and the plugin marketplace. Those native responsibilities wrap the fusion service and do not duplicate its Web UI features.

## Upgrade verification

An upgrade changes both exact package versions together and preserves the empty Fusion external dependency set. Before distributing a desktop build with a new dsh version, run the compatibility matrix against the packaged application:

- installation from the desktop lockfile and resolution of both npm packages;
- fusion profile composition and service startup;
- application window connection, reload, restart, and shutdown;
- tray controls and automatic service startup;
- application update and plugin marketplace flows;
- any desktop-owned remote implementation across window reload, service restart, and application shutdown.

A desktop build is distributable only when every matrix row passes for that exact dsh and fusion version pair. This repository supplies the npm artifacts and profile contract; npm publication and changes to the external desktop repository are separate release operations.

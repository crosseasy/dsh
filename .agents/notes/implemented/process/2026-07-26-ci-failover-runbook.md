# Agent Note: CI failover runbook — hosted pools → in-house pool

Status: implemented

English | [中文](2026-07-26-ci-failover-runbook.zh.md)

## Problem

Required pull-request checks depend on hosted Linux and Windows runner pools. A pool outage can leave required jobs queued indefinitely, so merging a workflow fix is unavailable as the recovery path.

Failover must preserve job isolation and platform boundaries. In particular, Fusion acceptance owns system Google Chrome CDP port `9333` and must not share a self-hosted Linux runner with the ordinary worker jobs.

## Decision

Two independent repository variables control failover. `DSH_CI_FAILOVER_LINUX=selfhosted` retargets only the three required Linux workers `node-24`, `node-24-coverage`, and `node-24-consumers`, plus the `all-checks-passed` verdict, to the `vm-backup` pool. `DSH_CI_FAILOVER_WINDOWS=selfhosted` retargets only `windows-native` to the `dsh-win-ci` pool. An outage on one platform does not redirect the other.

The `all-checks-passed.needs` set is exactly `node-24`, `node-24-coverage`, `node-24-consumers`, `fusion-acceptance`, `node-compat`, `python-sdk`, `python-runtime`, and `windows`. `windows-native` and the standby lanes are deliberately outside that required aggregate. The verdict follows the Linux selector so a failed enterprise Linux pool cannot strand the bookkeeping job after its redirected workers finish.

`fusion-acceptance` always runs independently on standard `ubuntu-latest`; the Linux failover variable never redirects it. It installs and builds its isolated profile, owns system Chrome CDP `9333`, and preserves its own process-group and profile cleanup. A broader standard-hosted outage can therefore continue to block Fusion acceptance and the other standard-hosted dependencies rather than silently moving them onto the failover pool.

## Job isolation and budgets

- The hosted path remains primary. Self-hosted Linux and Windows lanes are standby paths selected only by their corresponding repository variable.
- Under Linux failover, coverage uses at most eight workers and snapshots use at most twelve concurrent operations per runner; hosted-path pnpm cache restoration is skipped because the persistent pool owns its package store.
- Fusion has a 15-minute GitHub job limit around a 10-minute Vitest acceptance. The operation deadline is 540 seconds, leaving setup and reporting reserve.
- One 30-second cleanup deadline covers pending acquisition settlement, reverse-order disposal, final cleanup, and operation settlement. Expiry starts every remaining acquired resource's disposer with the aborted signal, reports unfinished work, and returns failure without extending the deadline.
- The Fusion launcher rejects an occupied CDP port before startup and proceeds only while its Chrome process is alive and every port `9333` listener belongs to that process group.

## Activation contract

Failover may be activated only while the corresponding standby lane is green. `serial / linux (self-hosted standby)` validates the aggregate and Linux browser prerequisites on `vm-backup`; `serial / windows (self-hosted standby)` validates `check:ci:windows-complete` and the required Node, pnpm, Git Bash, PowerShell, and symlink support on `dsh-win-ci`.

Setting `DSH_CI_FAILOVER_LINUX=selfhosted` or `DSH_CI_FAILOVER_WINDOWS=selfhosted` affects only workflow runs created after the variable changes. Queued jobs retain their resolved runner labels, so activation requires a new workflow run.

Deleting the affected variable or assigning any value other than `selfhosted` switches subsequent workflow runs back to the hosted path. After the outage, start a new run and remove any temporary runner instances.

## Trust boundary

Both selectors exclude `dependabot[bot]`; dependency-supplied code remains queued for hosted capacity during failover. Repository variables are writer-manageable state, while pull-request events cannot set them. The self-hosted runner groups accept workflows from this private, fork-disabled repository so pull-request merge refs can execute; repository membership is therefore the trust boundary. Restricting a runner group to the default-branch workflow is incompatible with pull-request failover.

The master-push standby lanes exercise the in-house pools without becoming required verdict dependencies. Workflow-level concurrency does not cancel a running master-push drill when another push arrives, so the standby path can periodically produce a complete readiness result.

## Alternatives considered

**Merge a workflow change to switch pools.** Rejected because the unavailable required checks would block the merge. A repository variable changes routing without modifying the workflow.

**Keep self-hosted pools permanently in the required path.** Rejected because that replaces hosted-pool availability with in-house-pool availability instead of retaining an independently exercised fallback.

**Redirect Fusion acceptance with Linux failover.** Rejected because Fusion requires an isolated system Chrome and exclusive CDP `9333`; sharing the persistent Linux pool would couple browser state and cleanup to unrelated jobs.

## Consequences

A writer can recover one failed platform by changing one repository variable and re-running CI. Linux and Windows outages remain independent, and Fusion acceptance plus the portable required jobs remain on standard hosted runners.

The repository maintains a second runner topology for each platform, standby evidence on master pushes, Linux-specific concurrency and cache branches, and the repository-membership trust assumption for self-hosted pull-request execution.

/**
 * Sandbox-consuming bash executor. It wraps the exact local bash argv through
 * `ctx.sandbox`, inherits local process mechanics, and reports the selected
 * mode, enforcement, and denial facts. Positive runner-launch evidence means
 * the command never ran: foreground calls throw `SANDBOX_UNAVAILABLE`, while
 * background processes carry `runnerFailed`; other spawn rejections retain
 * local-executor semantics. The tool owns approval and passes a complete per-call policy.
 * @module @deepseek-ai/dsh-bash-sandbox
 */

import { Context } from '@deepseek-ai/cordis'
import type { ShellExecRequest, ShellExecSpec, ShellProcess, ShellRunResult } from '@deepseek-ai/dsh-shell'
import { SandboxUnavailableError } from '@deepseek-ai/dsh-sandbox'
import type {
  ConfinedArgv,
  SandboxExecutionPolicy,
  SandboxMode,
  SandboxPolicy,
} from '@deepseek-ai/dsh-sandbox'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import { LocalBashExecutor } from '@deepseek-ai/dsh-bash-local'
import type { Config as LocalConfig } from '@deepseek-ai/dsh-bash-local'
import { OneShotSandboxSettlement } from '@deepseek-ai/dsh-shell-runtime'

/**
 * Plugin config: the local executor's knobs, verbatim. The sandbox policy —
 * the default mode and fallback `workspace-write` root — is NOT here: it lives
 * on `ctx.sandboxPolicy` (`@deepseek-ai/dsh-sandbox-policy`), which resolves
 * each calling session's mode and cwd for every enforcing capability. The runner
 * choice is likewise the `ctx.sandbox` provider's config, not this executor's.
 */
export type Config = LocalConfig

/**
 * Registers as `ctx.shell` in place of the local executor and requires a
 * `ctx.sandbox` provider plus `ctx.sandboxPolicy`; the tool layer is
 * unchanged. Tool calls pass the calling session's resolved policy; direct
 * calls fall back to deployment policy. `result.sandbox` reports the mode and
 * enforcement actually used.
 */
export class SandboxBashExecutor extends LocalBashExecutor {
  static override inject = ['subprocess', 'sandbox', 'sandboxPolicy']

  // No own Config: the sandbox default (mode + workspaceRoot) is owned by
  // ctx.sandboxPolicy, so this executor inherits LocalBashExecutor's Config
  // verbatim (the config catalog walks the inherited static).

  private readonly mode: SandboxMode
  private readonly sandboxSettlement = new OneShotSandboxSettlement((mode, detail) =>
    new SandboxUnavailableError(mode, detail))

  constructor(ctx: Context, config: Config) {
    super(ctx, config)
    // The default mode is the capability fact used for schema advertisement;
    // actual tool executions carry their resolved per-call policy.
    this.mode = ctx.sandboxPolicy.defaultMode
  }

  /** The configured default mode — the capability fact the tool layer reads. */
  override get sandboxMode(): SandboxMode {
    return this.mode
  }

  /**
   * Stamp a complete per-call policy onto the spec. Tool calls supply the
   * calling session's resolved mode and root; lower-level callers fall back to
   * the deployment policy.
   */
  override resolve(request: ShellExecRequest): ShellExecSpec {
    return { ...super.resolve(request), sandboxPolicy: request.sandboxPolicy ?? this.ctx.sandboxPolicy.resolve() }
  }

  override async run(spec: ShellExecSpec): Promise<ShellRunResult> {
    const policy = spec.sandboxPolicy as SandboxExecutionPolicy
    return this.sandboxSettlement.run({
      spec,
      mode: policy.mode,
      confine: mode => this.confine(spec.command, { ...policy, mode }),
      runConfined: (current, argv) => this.runArgv(current, argv),
      runUnconfined: current => super.run(current),
    })
  }

  override start(spec: ShellExecSpec): ShellProcess {
    const policy = spec.sandboxPolicy as SandboxExecutionPolicy
    return this.sandboxSettlement.start({
      spec,
      mode: policy.mode,
      confine: mode => this.confine(spec.command, { ...policy, mode }),
      startConfined: (current, argv) => this.startArgv(current, argv),
      startUnconfined: current => super.start(current),
    })
  }

  /**
   * Stamp per-process sandbox facts before `done` settles. Full-access processes
   * have no facts; signal deaths are not denials.
   */
  protected override onProcessDone(proc: ShellProcess, stderr: string, spawnFailed: boolean, spawnError?: unknown): void {
    this.sandboxSettlement.settleProcess(proc, stderr, spawnFailed, spawnError)
    super.onProcessDone(proc, stderr, spawnFailed, spawnError)
  }

  /**
   * Wrap one shell command via the `ctx.sandbox` provider. Provider errors
   * propagate unchanged; the returned argv is handed directly to the local
   * executor's subprocess path.
   * @param command - shell source for the confined inner `bash -c`.
   * @param policy - resolved confined execution policy.
   * @returns the provider's exact argv and settlement-classification facts.
   */
  private confine(command: string, policy: SandboxPolicy): ConfinedArgv {
    return this.ctx.sandbox.confine(['bash', '-c', command], policy)
  }
}

export default SandboxBashExecutor

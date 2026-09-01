/**
 * Local `ctx.shell` provider that runs each command as `bash -c` through `ctx.subprocess`.
 * @module @deepseek-ai/dsh-bash-local
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SHELL_SETTINGS_NAMESPACE } from '@deepseek-ai/dsh-shell'
import type { ShellExecRequest, ShellExecSpec, ShellProcess, ShellRunResult } from '@deepseek-ai/dsh-shell'
import { assertServiceableOneShotShellConfig, OneShotShellExecutor, oneShotShellSettings as projectOneShotShellSettings, resolveOneShotShellRequest } from '@deepseek-ai/dsh-shell-runtime'
import type { OneShotShellSettings } from '@deepseek-ai/dsh-shell-runtime'
import { installSettingsSection } from '@deepseek-ai/dsh-settings'

/** Model-friendly Bash env defaults; explicit caller env still wins. */
export const ENV_OVERRIDES = {
  NO_COLOR: '1',
  TERM: 'dumb',
  PAGER: 'cat',
  GIT_PAGER: 'cat',
} as const

/** Default SIGTERM→SIGKILL grace period (the `graceMs` config; matches OpenCode's 3s). */
const DEFAULT_GRACE_MS = 3_000

/** Default per-stream spill cap (the `maxSpillBytes` config). */
const DEFAULT_MAX_SPILL_BYTES = 64 * 1024 * 1024

/** Plugin config (all optional — `static Config` supplies the defaults). */
export interface Config {
  /** Default working directory for commands (default: process.cwd()). */
  cwd?: string
  /** Default foreground timeout in milliseconds. */
  timeoutMs?: number
  /** Upper bound for per-call timeout overrides. */
  maxTimeoutMs?: number
  /** Per-stream in-memory output cap; overflow spills to a temp file. */
  maxOutputBytes?: number
  /** Per-stream spill-file cap; larger streams retain only their in-memory tail. */
  maxSpillBytes?: number
  /** Grace period for kill escalation and inherited pipes; at most `MAX_TIMER_DELAY_MS`. */
  graceMs?: number
}

/** The shape after schemastery applied the defaults (cwd has none). */
type ResolvedConfig = Required<Omit<Config, 'cwd'>> & Pick<Config, 'cwd'>

/**
 * Reject resolved settings values that cannot safely drive Node timers or byte caps.
 * @param config - Resolved plugin configuration from the Cordis config schema or settings layer.
 */
export function assertServiceableBashConfig(config: Config): void {
  assertServiceableOneShotShellConfig('bash-local', config as ResolvedConfig)
}

/** Local bash executor over `ctx.subprocess`; one-shot lifecycle lives in `dsh-shell-runtime`. */
export class LocalBashExecutor extends OneShotShellExecutor {
  static inject = ['subprocess']

  /* jscpd:ignore-start -- Adapter-owned public config surface mirrored intentionally. */
  static Config: z<Config> = z.object({
    cwd: z.string(),
    timeoutMs: z.number().default(120_000),
    maxTimeoutMs: z.number().default(600_000),
    maxOutputBytes: z.number().default(64_000),
    maxSpillBytes: z.number().default(DEFAULT_MAX_SPILL_BYTES),
    graceMs: z.number().default(DEFAULT_GRACE_MS),
  })
  /* jscpd:ignore-end */

  private source: () => ResolvedConfig

  /** Resolved plugin configuration currently used for new command requests. */
  get config(): ResolvedConfig {
    return this.source()
  }

  constructor(ctx: Context, config: Config) {
    super(ctx, {
      timeoutCode: 'BASH_TIMEOUT',
      droppedCollectMessage: 'bash-local: subprocess implementation dropped a requested collect stream',
    })
    const entry = config as ResolvedConfig
    assertServiceableBashConfig(entry)
    this.source = () => entry
    installSettingsSection(ctx, SHELL_SETTINGS_NAMESPACE, LocalBashExecutor.Config, entry, {
      validate: assertServiceableBashConfig,
      setSource: (current) => {
        this.source = current as () => ResolvedConfig
      },
      onChange: () => {},
    })
  }

  /** Resolve command defaults and caps before execution. */
  resolve(request: ShellExecRequest): ShellExecSpec {
    return resolveOneShotShellRequest('bash-local', this.config, request)
  }

  async run(spec: ShellExecSpec): Promise<ShellRunResult> {
    return this.runArgv(spec, ['bash', '-c', spec.command])
  }

  start(spec: ShellExecSpec): ShellProcess {
    return this.startArgv(spec, ['bash', '-c', spec.command])
  }

  protected oneShotShellSettings(spec: ShellExecSpec): OneShotShellSettings {
    return projectOneShotShellSettings(ENV_OVERRIDES, this.config, spec)
  }
}

export default LocalBashExecutor

/**
 * Local `ctx.shell` provider that runs each command as non-interactive PowerShell.
 * Commands are passed as one `-Command` argv element and parsed by PowerShell.
 * @module @deepseek-ai/dsh-pwsh-local
 */

import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { SHELL_SETTINGS_NAMESPACE } from '@deepseek-ai/dsh-shell'
import type { ShellExecRequest, ShellExecSpec, ShellProcess, ShellRunResult } from '@deepseek-ai/dsh-shell'
import {
  assertServiceableOneShotShellConfig,
  OneShotShellExecutor,
  oneShotShellSettings as projectOneShotShellSettings,
  resolveOneShotShellRequest,
} from '@deepseek-ai/dsh-shell-runtime'
import type { OneShotShellSettings } from '@deepseek-ai/dsh-shell-runtime'
import type {} from '@deepseek-ai/dsh-settings'
/* jscpd:ignore-end */
import { resolvePwshPath } from './resolve.ts'

/** Model-friendly PowerShell env defaults; `TERM=dumb` is deliberately absent. */
export const ENV_OVERRIDES = {
  NO_COLOR: '1',
  PAGER: 'cat',
  GIT_PAGER: 'cat',
} as const

/** UTF-8 output pinning prepended to every command before caller text. */
export const ENCODING_PREAMBLE =
  '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false); '

/** Default SIGTERM→SIGKILL grace period (the `graceMs` config). */
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
  /** Explicit pwsh executable; absent probes well-known Windows locations and PATH. */
  pwshPath?: string
}

/** The shape after schemastery applied the defaults (cwd/pwshPath have none). */
type ResolvedConfig = Required<Omit<Config, 'cwd' | 'pwshPath'>> & Pick<Config, 'cwd' | 'pwshPath'>

// Tests and coverage probes share this dependency-free resolver.
export { candidatePwshPaths, resolvePwshPath } from './resolve.ts'

/**
 * Reject resolved settings values that cannot safely drive Node timers or byte caps.
 * @param config - Resolved plugin configuration from the Cordis config schema or settings layer.
 */
export function assertServiceablePwshConfig(config: Config): void {
  assertServiceableOneShotShellConfig('pwsh-local', config as ResolvedConfig)
}

/** Local PowerShell executor over `ctx.subprocess`; one-shot lifecycle lives in `dsh-shell-runtime`. */
export class PwshLocalExecutor extends OneShotShellExecutor {
  static inject = ['subprocess']

  /* jscpd:ignore-start -- Adapter-owned public config surface mirrored intentionally. */
  static Config: z<Config> = z.object({
    cwd: z.string(),
    timeoutMs: z.number().default(120_000),
    maxTimeoutMs: z.number().default(600_000),
    maxOutputBytes: z.number().default(64_000),
    maxSpillBytes: z.number().default(DEFAULT_MAX_SPILL_BYTES),
    graceMs: z.number().default(DEFAULT_GRACE_MS),
    pwshPath: z.string(),
  })
  /* jscpd:ignore-end */

  private source: () => ResolvedConfig

  private declaredPwshPath: string | undefined

  private resolvedPwshPath: string

  /** Resolved plugin configuration currently used for new command requests. */
  get config(): ResolvedConfig {
    return this.source()
  }

  /** The pwsh executable every command runs through. */
  get pwshPath(): string {
    return this.resolvedPwshPath
  }

  constructor(ctx: Context, config: Config) {
    super(ctx, {
      // The shell executor seam keeps the backend timeout identity shared across dialects.
      timeoutCode: 'BASH_TIMEOUT',
      droppedCollectMessage: 'pwsh-local: subprocess implementation dropped a requested collect stream',
    })
    const entry = config as ResolvedConfig
    assertServiceablePwshConfig(entry)
    this.source = () => entry
    this.declaredPwshPath = entry.pwshPath
    this.resolvedPwshPath = resolvePwshPath(entry.pwshPath)
    ctx.inject(['settings'], (settingsCtx) => {
      settingsCtx.settings.installSection(ctx, SHELL_SETTINGS_NAMESPACE, PwshLocalExecutor.Config, entry, {
        validate: assertServiceablePwshConfig,
        setSource: (current) => {
          this.source = current as () => ResolvedConfig
        },
        // Probing the filesystem is the one fact derived from the source: every
        // other field is read through the getter at each command.
        onChange: () => {
          const declared = this.source().pwshPath
          if (declared === this.declaredPwshPath) return
          this.declaredPwshPath = declared
          this.resolvedPwshPath = resolvePwshPath(declared)
        },
      })
    })
  }

  /** Resolve command defaults and caps before execution. */
  resolve(request: ShellExecRequest): ShellExecSpec {
    return resolveOneShotShellRequest('pwsh-local', this.config, request)
  }

  /** Return the exact pwsh invocation argv; sandboxing subclasses may wrap it. */
  protected argv(spec: ShellExecSpec): string[] {
    return [this.pwshPath, '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `${ENCODING_PREAMBLE}${spec.command}`]
  }

  async run(spec: ShellExecSpec): Promise<ShellRunResult> {
    return this.runArgv(spec, this.argv(spec))
  }

  start(spec: ShellExecSpec): ShellProcess {
    return this.startArgv(spec, this.argv(spec))
  }

  protected oneShotShellSettings(spec: ShellExecSpec): OneShotShellSettings {
    return projectOneShotShellSettings(ENV_OVERRIDES, this.config, spec)
  }
}

export default PwshLocalExecutor

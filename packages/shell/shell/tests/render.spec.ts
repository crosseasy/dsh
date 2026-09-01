/**
 * Shared exit-status parse contract: the inverse of the `[exit code: N]` /
 * `[killed by signal: X]` markers `dsh-tool-bash` and `dsh-tool-pwsh` append.
 * Both tools' presenter suites round-trip their own renderers through this
 * parse; this spec pins the parse's own edges (marker-like output, body
 * slicing) once, at the seam that owns it.
 */

import { describe, expect, it } from 'vitest'
import {
  SHELL_BACKGROUND_OUTPUT_PROPERTIES,
  parseExitStatus,
  projectShellForegroundResult,
  renderShellProcessRead,
  renderShellResult,
  shellProcessOutcome,
} from '../src/index.ts'
import type { ShellProcess, ShellProcessRead, ShellRunResult } from '../src/index.ts'

describe('parseExitStatus', () => {
  it('recovers a clean exit 0 with the body verbatim when no marker is present', () => {
    expect(parseExitStatus('hi\n\n')).toEqual({ body: 'hi\n\n', exitCode: 0 })
    expect(parseExitStatus('')).toEqual({ body: '', exitCode: 0 })
  })

  it('recovers a non-zero exit and strips only its marker from the body', () => {
    expect(parseExitStatus('oops\n[exit code: 3]')).toEqual({ body: 'oops', exitCode: 3 })
    // The marker needs the leading newline and the end of the string, so a
    // clean result whose output merely ENDS in marker-like text is not read
    // as a failure and the text stays in the body.
    expect(parseExitStatus('[exit code: 5]')).toEqual({ body: '[exit code: 5]', exitCode: 0 })
  })

  it('recovers a signal kill ahead of any non-zero exit marker', () => {
    expect(parseExitStatus('gone\n[killed by signal: SIGKILL]')).toEqual({ body: 'gone', signal: 'SIGKILL' })
    // A fake signal marker with no leading newline is output, not a kill.
    expect(parseExitStatus('[killed by signal: SIGKILL]')).toEqual({ body: '[killed by signal: SIGKILL]', exitCode: 0 })
  })

  it('keeps markers no pill shows (timeout) in the body', () => {
    expect(parseExitStatus('slow\n[timed out after 100ms]\n[exit code: 143]'))
      .toEqual({ body: 'slow\n[timed out after 100ms]', exitCode: 143 })
  })
})

describe('projectShellForegroundResult', () => {
  it('projects completed shell runs into the shared foreground output value', () => {
    const result: ShellRunResult = {
      exitCode: 0,
      signal: null,
      timedOut: false,
      aborted: false,
      timeoutMs: 1000,
      stdout: { text: 'out', truncated: true, spillPath: '/tmp/stdout.log' },
      stderr: { text: '', truncated: false },
      sandbox: { mode: 'read-only', denied: false, enforcement: 'full', runnerFailed: false },
    }

    const projected = projectShellForegroundResult(result)

    expect(projected).toEqual({
      kind: 'foreground',
      exitCode: 0,
      signal: null,
      timedOut: false,
      aborted: false,
      timeoutMs: 1000,
      stdout: { text: 'out', truncated: true, spillPath: '/tmp/stdout.log' },
      stderr: { text: '', truncated: false },
      sandbox: { mode: 'read-only', denied: false, enforcement: 'full', runnerFailed: false },
    })
    expect(projected.stdout).not.toBe(result.stdout)
    expect(projected.stderr).not.toBe(result.stderr)
  })

  it('omits absent optional stream and sandbox properties from the output value', () => {
    const projected = projectShellForegroundResult({
      exitCode: null,
      signal: 'SIGTERM',
      timedOut: true,
      aborted: false,
      timeoutMs: 250,
      stdout: { text: '', truncated: false },
      stderr: { text: 'err', truncated: false },
      sandbox: { mode: 'workspace-write', denied: true },
    })

    expect(projected.stdout).not.toHaveProperty('spillPath')
    expect(projected.stderr).not.toHaveProperty('spillPath')
    expect(projected.sandbox).not.toHaveProperty('enforcement')
    expect(projected.sandbox).not.toHaveProperty('runnerFailed')
  })
})

describe('shared shell output schema properties', () => {
  it('defines the byte-stable background acknowledgement value', () => {
    expect(SHELL_BACKGROUND_OUTPUT_PROPERTIES).toEqual({
      kind: { type: 'string', required: true, const: 'background' },
      jobId: { type: 'string', required: true },
    })
  })
})

describe('renderShellResult', () => {
  const base: ShellRunResult = {
    exitCode: 0,
    signal: null,
    timedOut: false,
    aborted: false,
    timeoutMs: 1000,
    stdout: { text: '', truncated: false },
    stderr: { text: '', truncated: false },
  }

  it('renders stderr-only output without a stdout prefix', () => {
    expect(renderShellResult({ ...base, stderr: { text: 'err\n', truncated: false } }))
      .toBe('[stderr]\nerr\n')
  })

  it('separates stdout from stderr when stdout lacks a newline', () => {
    expect(renderShellResult({
      ...base,
      stdout: { text: 'out', truncated: false },
      stderr: { text: 'err', truncated: false },
    })).toBe('out\n[stderr]\nerr')
  })

  it('appends exit and signal markers after the body', () => {
    expect(renderShellResult({ ...base, exitCode: 7, stdout: { text: 'x', truncated: false } }))
      .toBe('x\n[exit code: 7]')
    expect(renderShellResult({ ...base, exitCode: null, signal: 'SIGKILL' }))
      .toBe('(no output)\n[killed by signal: SIGKILL]')
  })

  it('orders timeout before kill markers and keeps a trapped timeout as output-only status', () => {
    expect(renderShellResult({ ...base, exitCode: 0, signal: null, timedOut: true }))
      .toBe('(no output)\n[timed out after 1000ms]')
    expect(renderShellResult({ ...base, exitCode: null, signal: 'SIGTERM', timedOut: true }))
      .toBe('(no output)\n[timed out after 1000ms]\n[killed by signal: SIGTERM]')
  })

  it('reports truncation and sandbox denials with the existing marker strings', () => {
    expect(renderShellResult({ ...base, stdout: { text: 'tail', truncated: true } }))
      .toBe('tail\n[output truncated; full output: (unavailable)]')

    const denied = {
      ...base,
      exitCode: 1,
      stderr: { text: 'denied', truncated: false },
      sandbox: { mode: 'read-only', denied: true },
    } satisfies ShellRunResult

    expect(renderShellResult(denied)).toBe('[stderr]\ndenied\n[sandbox: file access denied under read-only mode]\n[exit code: 1]')
    expect(renderShellResult(denied, ['workspace-write'])).toBe(
      '[stderr]\ndenied\n[sandbox: file access denied under read-only mode]\n'
      + '[sandbox: escalation available — retry this exact command once with sandbox_permissions '
      + '(the narrowest wider mode that suffices) + justification; the approval prompt asks the user]\n'
      + '[exit code: 1]',
    )
  })
})

describe('renderShellProcessRead', () => {
  const base: ShellProcessRead = { delta: 'out\n', lossy: false }

  it('returns lossless deltas verbatim', () => {
    expect(renderShellProcessRead(base)).toBe('out\n')
    expect(renderShellProcessRead({ delta: '', lossy: false })).toBe('')
  })

  it('appends lossy-read notices with available spill paths', () => {
    expect(renderShellProcessRead({ ...base, lossy: true, stdoutSpillPath: '/spill/out.log' }))
      .toBe('out\n[some output was dropped from memory; full output: /spill/out.log]')
    expect(renderShellProcessRead({ ...base, lossy: true, stdoutSpillPath: '/spill/out.log', stderrSpillPath: '/spill/err.log' }))
      .toBe('out\n[some output was dropped from memory; full output: /spill/out.log, /spill/err.log]')
  })

  it('formats empty lossy reads as the notice alone', () => {
    expect(renderShellProcessRead({ delta: '', lossy: true, stderrSpillPath: '/spill/err.log' }))
      .toBe('[some output was dropped from memory; full output: /spill/err.log]')
  })

  it('renders sandbox runner failures ahead of denial markers', () => {
    expect(renderShellProcessRead(
      { delta: 'x', lossy: false },
      { mode: 'read-only', denied: true, runnerFailed: true },
    )).toBe('x\n[sandbox: the sandbox runner itself failed under read-only mode — the command did not run; this is a sandbox problem, not a command failure]')
  })

  it('renders sandbox denial hints only when escalation is advertised', () => {
    expect(renderShellProcessRead({ delta: 'tail', lossy: false }, { mode: 'read-only', denied: true }))
      .toBe('tail\n[sandbox: file access denied under read-only mode]')
    expect(renderShellProcessRead({ delta: 'tail\n', lossy: false }, { mode: 'read-only', denied: true }, ['workspace-write']))
      .toBe('tail\n[sandbox: file access denied under read-only mode]\n'
        + '[sandbox: escalation available — retry this exact command once with sandbox_permissions '
        + '(the narrowest wider mode that suffices) + justification; the approval prompt asks the user]')
  })
})

describe('shellProcessOutcome', () => {
  function settled(over: Partial<ShellProcess>): ShellProcess {
    return {
      status: 'completed',
      exitCode: 0,
      signal: null,
      done: Promise.resolve(),
      readOutput: () => ({ delta: '', lossy: false }),
      kill: () => false,
      ...over,
    }
  }

  it('maps killed processes to the generic job outcome vocabulary', () => {
    expect(shellProcessOutcome(settled({ status: 'killed', signal: 'SIGTERM' })))
      .toEqual({ status: 'killed', detail: 'signal: SIGTERM' })
    expect(shellProcessOutcome(settled({ status: 'killed', exitCode: null })))
      .toEqual({ status: 'killed', detail: 'killed before exit' })
  })

  it('maps completed processes to their exit code detail', () => {
    expect(shellProcessOutcome(settled({ exitCode: 3 })))
      .toEqual({ status: 'completed', detail: 'exit code: 3' })
    expect(shellProcessOutcome(settled({ exitCode: null })))
      .toEqual({ status: 'completed', detail: 'exit code: 0' })
  })
})

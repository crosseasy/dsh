import { afterAll, describe, expect, it } from 'vitest'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  classifySandboxDenial,
  classifySandboxRunnerFailure,
  isSandboxRunnerSpawnFailure,
  matchesSandboxSignature,
} from '@deepseek-ai/dsh-shell'
import type { CollectedOutput, ShellRunResult } from '@deepseek-ai/dsh-shell'
import type { RunnerFailureRule } from '@deepseek-ai/dsh-sandbox'

const workdir = mkdtempSync(join(tmpdir(), 'dsh-shell-sandbox-classification-'))

afterAll(() => {
  chmodSync(workdir, 0o755)
  rmSync(workdir, { recursive: true, force: true })
})

function output(text: string): CollectedOutput {
  return { text, truncated: false }
}

function runResult(exitCode: number | null, stderr: string): ShellRunResult {
  return { exitCode, signal: null, timedOut: false, aborted: false, timeoutMs: 1000, stdout: output(''), stderr: output(stderr) }
}

describe('sandbox result classification', () => {
  it('attributes only ENOENT/EACCES spawn failures that identify argv[0] from a usable workdir', () => {
    for (const runner of [process.execPath, 'node', './sandbox-runner']) {
      for (const code of ['ENOENT', 'EACCES']) {
        expect(isSandboxRunnerSpawnFailure({ code, syscall: 'spawn', path: runner }, runner, workdir)).toBe(true)
        expect(isSandboxRunnerSpawnFailure({ code, syscall: `spawn ${runner}`, path: runner }, runner, workdir)).toBe(true)
        expect(isSandboxRunnerSpawnFailure({ code, syscall: `spawn ${runner}` }, runner, workdir)).toBe(true)
      }
    }
  })

  it('rejects ambiguous spawn provenance and unusable workdirs', () => {
    const runner = 'node'
    const fileWorkdir = join(workdir, 'file')
    writeFileSync(fileWorkdir, '')

    expect(isSandboxRunnerSpawnFailure({ code: 'ENOEXEC', syscall: 'spawn', path: runner }, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 2, syscall: 'spawn', path: runner }, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', path: runner }, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 1, path: runner }, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 'spawn', path: 'other' }, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 'spawn other', path: runner }, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 'spawn', path: '' }, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 'spawn', path: 1 }, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 'spawn' }, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 'spawn' }, runner, join(workdir, 'missing'))).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 'spawn', path: runner }, runner, fileWorkdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure(undefined, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure(null, runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure('spawn failed', runner, workdir)).toBe(false)
    expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 'spawn', path: runner }, undefined, workdir)).toBe(false)
  })

  it.each(['ENOTDIR', 'EPERM', 'EMFILE', 'ENOMEM'])(
    'rejects non-executable spawn code %s on every platform',
    (code) => {
      const runner = 'node'
      expect(isSandboxRunnerSpawnFailure({ code, syscall: 'spawn', path: runner }, runner, workdir)).toBe(false)
    },
  )

  it.skipIf(process.platform === 'win32')('rejects a workdir without POSIX search permission', () => {
    const runner = 'node'
    const inaccessibleWorkdir = join(workdir, 'inaccessible')
    mkdirSync(inaccessibleWorkdir)
    chmodSync(inaccessibleWorkdir, 0o600)
    try {
      expect(isSandboxRunnerSpawnFailure({ code: 'ENOENT', syscall: 'spawn', path: runner }, runner, inaccessibleWorkdir)).toBe(false)
    } finally {
      chmodSync(inaccessibleWorkdir, 0o700)
    }
  })

  it('requires the exit-code gate and a fatal non-informational line', () => {
    const notice = 'landlock-run: partial enforcement (older Landlock ABI)'
    const fatal = 'landlock-run: exec failed: Permission denied'
    const rules: readonly RunnerFailureRule[] = [{
      allowedExitCodes: [125],
      fatalSignatures: ['', ' ', 'landlock-run: '],
      informationalLines: [notice],
    }]

    expect(classifySandboxRunnerFailure(0, fatal, rules)).toBeUndefined()
    expect(classifySandboxRunnerFailure(null, fatal, rules)).toBeUndefined()
    expect(classifySandboxRunnerFailure(1, fatal, rules)).toBeUndefined()
    expect(classifySandboxRunnerFailure(125, notice, rules)).toBeUndefined()
    expect(classifySandboxRunnerFailure(125, notice.toUpperCase(), rules)).toBeUndefined()
    expect(classifySandboxRunnerFailure(125, `${notice}: extra detail`, rules))
      .toEqual({ detail: `${notice}: extra detail` })
    expect(classifySandboxRunnerFailure(125, `${notice}\n${fatal}`, rules)).toEqual({ detail: fatal })
    expect(classifySandboxRunnerFailure(127, 'windows-acl-run: missing --workspace', [{
      allowedExitCodes: [127],
      fatalSignatures: ['windows-acl-run: '],
    }])).toEqual({ detail: 'windows-acl-run: missing --workspace' })
    expect(classifySandboxRunnerFailure(125, fatal, [{ fatalSignatures: [' '] }])).toBeUndefined()
  })

  it('matches denial signatures only for nonzero exits', () => {
    const signatures = ['access to the path', 'access is denied']
    expect(matchesSandboxSignature(1, 'Access to the path is denied.', signatures)).toBe(true)
    expect(matchesSandboxSignature(143, 'Access is denied.', signatures)).toBe(true)
    expect(matchesSandboxSignature(1, 'clean', signatures)).toBe(false)
    expect(matchesSandboxSignature(0, 'Access is denied.', signatures)).toBe(false)
    expect(matchesSandboxSignature(null, 'Access is denied.', signatures)).toBe(false)
    expect(classifySandboxDenial(runResult(1, 'ACCESS IS DENIED.'), signatures)).toBe(true)
    expect(classifySandboxDenial(runResult(0, 'ACCESS IS DENIED.'), signatures)).toBe(false)
  })

  it('ignores blank denial signatures without trimming nonblank signatures', () => {
    expect(matchesSandboxSignature(1, 'permission denied', [''])).toBe(false)
    expect(matchesSandboxSignature(1, 'permission denied', [' '])).toBe(false)
    expect(matchesSandboxSignature(1, 'permission\tdenied', ['\t'])).toBe(false)
    expect(matchesSandboxSignature(1, 'prefix PeRmIsSiOn DeNiEd suffix', [' Permission Denied '])).toBe(true)
    expect(matchesSandboxSignature(1, 'permission denied', [' Permission Denied '])).toBe(false)
  })

  it('matches only the active backend denial dialect', () => {
    expect(classifySandboxDenial(
      runResult(1, 'sh: /x: Permission denied'),
      ['read-only file system'],
    )).toBe(false)
    expect(classifySandboxDenial(
      runResult(1, 'bash: /etc/x: Operation not permitted'),
      ['read-only file system', 'permission denied'],
    )).toBe(false)
  })
})

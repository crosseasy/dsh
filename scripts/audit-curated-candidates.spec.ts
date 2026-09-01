import { execFileSync, spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import {
  auditGitCommit,
  auditRepositorySource,
  parseAuditArgs,
} from './audit-curated-candidates.ts'

const roots: string[] = []
const auditScript = fileURLToPath(new URL('./audit-curated-candidates.ts', import.meta.url))

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function git(root: string, ...args: string[]): string {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8',
    timeout: 5_000,
  }).trim()
}

function repository(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-source-audit-'))
  roots.push(root)
  git(root, 'init', '--quiet', '--initial-branch=main')
  git(root, 'config', 'user.email', 'audit@example.test')
  git(root, 'config', 'user.name', 'Source Audit')
  return root
}

function commit(root: string, message: string): string {
  git(root, 'add', '--all')
  git(root, 'commit', '--quiet', '--message', message)
  return git(root, 'rev-parse', 'HEAD')
}

async function killLeakedProcess(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGKILL')
  } catch {
    return
  }
  const deadline = Date.now() + 1_000
  while (Date.now() < deadline) {
    try {
      process.kill(pid, 0)
    } catch {
      return
    }
    await new Promise(resolve => setTimeout(resolve, 10))
  }
  throw new Error(`failed to clean leaked descendant ${String(pid)}`)
}

describe('curated candidate source audit', () => {
  it('has a repository-owned command entry', () => {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts?: Record<string, string>
    }

    expect(manifest.scripts?.['audit-curated-candidates'])
      .toBe('tsx scripts/audit-curated-candidates.ts')
  })

  it('accepts the pnpm argument separator before one candidate', () => {
    expect(parseAuditArgs(['--', '--candidate', 'plugin-a'])).toEqual({
      candidateId: 'plugin-a',
      timeoutMs: 50_000,
    })
    expect(parseAuditArgs([
      '--repository',
      'https://github.com/example/plugin',
      '--commit',
      '1'.repeat(40),
      '--timeout-ms',
      '100',
    ])).toEqual({
      commit: '1'.repeat(40),
      repository: 'https://github.com/example/plugin',
      timeoutMs: 100,
    })
  })

  it.each([
    'http://github.com/example/plugin',
    'https://user:password@github.com/example/plugin',
    'https://github.com/example/plugin?access_token=plain-query-secret',
    'https://github.com/example/plugin#plain-fragment-secret',
    'https://github.com/example/plugin%3Faccess_token%3DMulti%20Word%20Secret',
    'https://github.com/example/plugin%3faccess_token%3dLowercase%20Secret',
    'https://github.com/example/plugin%23Multi%20Word%20Token',
    'https://github.com/example/plugin%2Fnested',
    'https://github.com/example/plugin%2fnested',
    'https://github.com/example/plugin%5Cnested',
    'https://github.com/example/plugin%5cnested',
    'https://github.com/ex%61mple/plugin',
    'https://github.com/example',
    'https://github.com/example/plugin/extra',
    'https://github.com/example/plugin.git',
    'https://github.com/example/plugin.GIT',
    'https://github.com/example/plugin.Git',
    'https://github.com/example/plugin/',
    'https://GitHub.com/example/plugin',
    'https://github.com/-example/plugin',
    'https://github.com/example/plugin~name',
  ])('rejects a non-canonical repository without exposing it: %s', async (repositoryUrl) => {
    let message = ''
    try {
      await auditRepositorySource({
        commit: '1'.repeat(40),
        gitExecutable: '/path/that/must/not/run',
        repository: repositoryUrl,
        timeoutMs: 100,
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toBe('repository must be a canonical HTTPS GitHub URL')
    expect(message).not.toContain(repositoryUrl)
    expect(message).not.toContain('plain-query-secret')
    expect(message).not.toContain('plain-fragment-secret')
    expect(message).not.toContain('Multi Word Secret')
    expect(message).not.toContain('Lowercase Secret')
    expect(message).not.toContain('Multi Word Token')
  })

  it('does not echo an invalid repository secret from the command entry', () => {
    for (const [secret, repositoryUrl] of [
      [
        'plain-command-url-secret',
        'https://github.com/example/plugin?access_token=plain-command-url-secret',
      ],
      [
        'Encoded Multi Word Secret',
        'https://github.com/example/plugin%3Faccess_token%3DEncoded%20Multi%20Word%20Secret',
      ],
    ] as const) {
      const result = spawnSync(process.execPath, [
        '--import',
        'tsx/esm',
        auditScript,
        '--repository',
        repositoryUrl,
        '--commit',
        '1'.repeat(40),
        '--timeout-ms',
        '100',
      ], {
        encoding: 'utf8',
        timeout: 5_000,
      })

      expect(result.status).toBe(1)
      expect(result.stdout).not.toContain(secret)
      expect(result.stderr).toContain('repository must be a canonical HTTPS GitHub URL')
      expect(result.stderr).not.toContain(secret)
      expect(result.stderr).not.toContain(repositoryUrl)
    }
  })

  it('does not echo Git diagnostics that may contain secrets', async () => {
    const root = mkdtempSync(join(tmpdir(), 'dsh-source-audit-git-error-'))
    roots.push(root)
    const fakeGit = join(root, 'git')
    const realGit = execFileSync('/bin/sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim()
    const repositoryUrl = 'https://github.com/example/plugin'
    const secret = 'Git Multi Word Secret'
    writeFileSync(fakeGit, `#!/bin/sh
case " $* " in
  *" fetch "*)
    echo "fatal: unable to access '${repositoryUrl}': ${secret}" >&2
    exit 1
    ;;
esac
exec "${realGit}" "$@"
`)
    chmodSync(fakeGit, 0o755)

    let message = ''
    try {
      await auditRepositorySource({
        commit: '1'.repeat(40),
        gitExecutable: fakeGit,
        repository: repositoryUrl,
        timeoutMs: 5_000,
      })
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }

    expect(message).toBe('Git source audit failed')
    expect(message).not.toContain(repositoryUrl)
    expect(message).not.toContain(secret)
  })

  it('maps Git launch errors to a generic message', async () => {
    await expect(auditRepositorySource({
      commit: '1'.repeat(40),
      gitExecutable: '/path/that/must/not/run',
      repository: 'https://github.com/example/plugin',
      timeoutMs: 100,
    })).rejects.toThrow('Git source audit failed')
  })

  it.skipIf(process.platform === 'win32')(
    'is stable across worktree insertion order and reads only the Git object database',
    async () => {
      const left = repository()
      writeFileSync(join(left, 'z.txt'), 'last\n')
      writeFileSync(join(left, 'a.txt'), 'first\n')
      const leftCommit = commit(left, 'left')

      const right = repository()
      writeFileSync(join(right, 'a.txt'), 'first\n')
      writeFileSync(join(right, 'z.txt'), 'last\n')
      const rightCommit = commit(right, 'right')

      rmSync(join(left, 'a.txt'))
      rmSync(join(left, 'z.txt'))

      expect(await auditGitCommit(left, leftCommit)).toEqual({
        entryCount: 2,
        sourceContentSha256: (await auditGitCommit(right, rightCommit)).sourceContentSha256,
      })
    },
  )

  it.skipIf(process.platform === 'win32')(
    'binds blob content, executable mode, and symbolic-link mode',
    async () => {
      const root = repository()
      const path = join(root, 'entry')
      writeFileSync(path, 'target')
      const regular = (await auditGitCommit(root, commit(root, 'regular'))).sourceContentSha256

      writeFileSync(path, 'changed')
      const content = (await auditGitCommit(root, commit(root, 'content'))).sourceContentSha256

      writeFileSync(path, 'target')
      chmodSync(path, 0o755)
      const executable = (await auditGitCommit(root, commit(root, 'executable'))).sourceContentSha256

      rmSync(path)
      symlinkSync('target', path)
      const symlink = (await auditGitCommit(root, commit(root, 'symlink'))).sourceContentSha256

      expect(new Set([regular, content, executable, symlink])).toHaveLength(4)
    },
  )

  it.skipIf(process.platform === 'win32')(
    'does not inherit Git controls or credential-shaped variables',
    async () => {
      const root = repository()
      writeFileSync(join(root, 'tracked.txt'), 'tracked\n')
      const sourceCommit = commit(root, 'source')
      const decoy = repository()
      writeFileSync(join(decoy, 'decoy.txt'), 'decoy\n')
      commit(decoy, 'decoy')
      const probeRoot = mkdtempSync(join(tmpdir(), 'dsh-source-audit-env-'))
      roots.push(probeRoot)
      const fakeGit = join(probeRoot, 'git')
      const realGit = execFileSync('/bin/sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim()
      writeFileSync(fakeGit, `#!/bin/sh
if [ "\${GIT_DIR+x}" = x ] || [ "\${GIT_OBJECT_DIRECTORY+x}" = x ] || [ "\${DSH_AUDIT_TOKEN+x}" = x ]; then
  echo inherited unsafe environment >&2
  exit 97
fi
exec "${realGit}" "$@"
`)
      chmodSync(fakeGit, 0o755)
      const previous = {
        GIT_DIR: process.env.GIT_DIR,
        GIT_OBJECT_DIRECTORY: process.env.GIT_OBJECT_DIRECTORY,
        DSH_AUDIT_TOKEN: process.env.DSH_AUDIT_TOKEN,
        PATH: process.env.PATH,
      }
      process.env.GIT_DIR = join(decoy, '.git')
      process.env.GIT_OBJECT_DIRECTORY = join(decoy, '.git', 'objects')
      process.env.DSH_AUDIT_TOKEN = 'plain-audit-secret'
      process.env.PATH = `${probeRoot}:${process.env.PATH ?? ''}`
      try {
        const audit = await auditGitCommit(root, sourceCommit)
        expect(audit.entryCount).toBe(1)
        expect(audit.sourceContentSha256).toMatch(/^[0-9a-f]{64}$/u)
      } finally {
        for (const [name, value] of Object.entries(previous)) {
          if (value === undefined) Reflect.deleteProperty(process.env, name)
          else process.env[name] = value
        }
      }
    },
  )

  it.skipIf(process.platform === 'win32')(
    'rejects submodules, non-commit objects, and non-portable paths',
    async () => {
      const submoduleRoot = repository()
      writeFileSync(join(submoduleRoot, 'tracked.txt'), 'tracked\n')
      const targetCommit = commit(submoduleRoot, 'target')
      git(
        submoduleRoot,
        'update-index',
        '--add',
        '--cacheinfo',
        `160000,${targetCommit},nested/module`,
      )
      git(submoduleRoot, 'commit', '--quiet', '--message', 'submodule')
      const submoduleCommit = git(submoduleRoot, 'rev-parse', 'HEAD')
      await expect(auditGitCommit(submoduleRoot, submoduleCommit))
        .rejects.toThrow('unsupported Git entry')

      const tree = git(submoduleRoot, 'rev-parse', `${targetCommit}^{tree}`)
      await expect(auditGitCommit(submoduleRoot, tree))
        .rejects.toThrow('must identify a commit')

      const maliciousRoot = repository()
      writeFileSync(join(maliciousRoot, 'escape\\path'), 'content\n')
      const maliciousCommit = commit(maliciousRoot, 'non-portable path')
      await expect(auditGitCommit(maliciousRoot, maliciousCommit))
        .rejects.toThrow('non-portable Git path')
    },
  )

  it.skipIf(process.platform === 'win32')(
    'terminates a blocked fetch and its TERM-trapping descendant within the explicit total timeout',
    async () => {
      const root = mkdtempSync(join(tmpdir(), 'dsh-source-audit-git-'))
      roots.push(root)
      const fakeGit = join(root, 'git')
      const descendantPidFile = join(root, 'descendant.pid')
      const realGit = execFileSync('/bin/sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim()
      writeFileSync(fakeGit, `#!/bin/sh
case " $* " in
  *" fetch "*)
    /bin/sh -c 'trap "" TERM; echo $$ > ${descendantPidFile}; exec sleep 60' </dev/null >/dev/null 2>&1 &
    wait
    ;;
esac
exec "${realGit}" "$@"
`)
      chmodSync(fakeGit, 0o755)

      let descendantPid: number | undefined
      try {
        const startedAt = Date.now()
        await expect(auditRepositorySource({
          commit: '1'.repeat(40),
          gitExecutable: fakeGit,
          repository: 'https://github.com/example/plugin',
          timeoutMs: 2_000,
        })).rejects.toThrow('timed out')
        const observedPid = Number(readFileSync(descendantPidFile, 'utf8').trim())
        descendantPid = observedPid
        expect(Date.now() - startedAt).toBeLessThan(4_000)
        expect(() => { process.kill(observedPid, 0) }).toThrow()
      } finally {
        if (descendantPid !== undefined) await killLeakedProcess(descendantPid)
      }
    },
  )
})

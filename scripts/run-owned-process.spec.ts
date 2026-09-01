import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runOwnedProcess } from './run-owned-process.ts'

type SpawnSubprocess = typeof import('../packages/subprocess/subprocess-local/src/spawn.ts')['spawnSubprocess']

const spawnHarness = vi.hoisted(() => ({
  actual: undefined as SpawnSubprocess | undefined,
  implementation: undefined as SpawnSubprocess | undefined,
}))

vi.mock('../packages/subprocess/subprocess-local/src/spawn.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../packages/subprocess/subprocess-local/src/spawn.ts')>()
  spawnHarness.actual = actual.spawnSubprocess
  return {
    ...actual,
    spawnSubprocess: (...args: Parameters<SpawnSubprocess>) =>
      (spawnHarness.implementation ?? actual.spawnSubprocess)(...args),
  }
})

const roots: string[] = []

afterEach(() => {
  spawnHarness.implementation = undefined
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-owned-process-'))
  roots.push(root)
  return root
}

function descendantScripts(pidFile: string, output = false): { child: string; leader: string } {
  const child = `
    const { writeFileSync } = require('node:fs')
    writeFileSync(${JSON.stringify(pidFile)}, String(process.pid))
    process.on('SIGTERM', () => {})
    ${output ? 'setInterval(() => process.stdout.write(Buffer.alloc(1024, 0x78)), 1)' : 'setInterval(() => {}, 1000)'}
  `
  const leader = `
    const { spawn } = require('node:child_process')
    spawn(process.execPath, ['-e', ${JSON.stringify(child)}], {
      stdio: ['ignore', 'inherit', 'inherit'],
    })
    setInterval(() => {}, 1000)
  `
  return { child, leader }
}

function readPid(path: string): number {
  const pid = Number(readFileSync(path, 'utf8'))
  if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('invalid descendant pid')
  return pid
}

function expectProcessGone(pid: number): void {
  expect(() => { process.kill(pid, 0) }).toThrow()
}

describe('runOwnedProcess', () => {
  it.skipIf(process.platform === 'win32')(
    'preserves binary stdin and stdout bytes',
    async () => {
      const input = Buffer.from([0x00, 0xff, 0x80, 0x41, 0x0a])
      const result = await runOwnedProcess(process.execPath, [
        '-e',
        'const chunks=[]; process.stdin.on("data", chunk => chunks.push(chunk)); process.stdin.on("end", () => process.stdout.write(Buffer.concat(chunks)))',
      ], {
        cwd: process.cwd(),
        deadline: Date.now() + 5_000,
        env: {},
        input,
        maxOutputBytes: 1024,
      })

      expect(result).toMatchObject({
        exitCode: 0,
        signal: null,
        stderr: Buffer.alloc(0),
        timedOut: false,
      })
      expect(result.stdout).toEqual(input)
    },
  )

  it.skipIf(process.platform === 'win32')(
    'ignores stdin EPIPE when the child exits before a large write completes',
    async () => {
      const result = await runOwnedProcess(process.execPath, ['-e', 'process.exit(0)'], {
        cwd: process.cwd(),
        deadline: Date.now() + 5_000,
        env: {},
        input: Buffer.alloc(16 * 1024 * 1024),
        maxOutputBytes: 1024,
      })

      expect(result).toMatchObject({
        exitCode: 0,
        signal: null,
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
        timedOut: false,
      })
    },
  )

  it.skipIf(process.platform === 'win32')(
    'returns from timeout only after a TERM-trapping descendant exits',
    async () => {
      const pidFile = join(tempRoot(), 'timeout.pid')
      const { leader } = descendantScripts(pidFile)

      const result = await runOwnedProcess(process.execPath, ['-e', leader], {
        cwd: process.cwd(),
        deadline: Date.now() + 300,
        env: {},
        maxOutputBytes: 1024,
      })

      expect(result.timedOut).toBe(true)
      expectProcessGone(readPid(pidFile))
    },
  )

  it.skipIf(process.platform === 'win32')(
    'waits until the deadline and terminates descendants after the leader exits zero',
    async () => {
      const pidFile = join(tempRoot(), 'normal-exit.pid')
      const descendant = `
        const { writeFileSync } = require('node:fs')
        writeFileSync(${JSON.stringify(pidFile)}, String(process.pid))
        process.on('SIGTERM', () => {})
        setInterval(() => {}, 1000)
      `
      const leader = `
        const { existsSync } = require('node:fs')
        const { spawn } = require('node:child_process')
        spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], {
          stdio: 'ignore',
        })
        const ready = setInterval(() => {
          if (!existsSync(${JSON.stringify(pidFile)})) return
          clearInterval(ready)
          process.exit(0)
        }, 5)
      `
      const deadline = Date.now() + 300
      let descendantPid: number | undefined

      try {
        const result = await runOwnedProcess(process.execPath, ['-e', leader], {
          cwd: process.cwd(),
          deadline,
          env: {},
          maxOutputBytes: 1024,
        })
        descendantPid = readPid(pidFile)

        expect(Date.now()).toBeGreaterThanOrEqual(deadline)
        expect(result).toMatchObject({
          exitCode: 0,
          signal: null,
          timedOut: true,
        })
        expectProcessGone(descendantPid)
      } finally {
        if (descendantPid !== undefined) {
          try {
            process.kill(descendantPid, 'SIGKILL')
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
          }
        }
      }
    },
  )

  it.skipIf(process.platform === 'win32')(
    'rejects output overflow only after a TERM-trapping descendant exits',
    async () => {
      const pidFile = join(tempRoot(), 'overflow.pid')
      const { leader } = descendantScripts(pidFile, true)

      await expect(runOwnedProcess(process.execPath, ['-e', leader], {
        cwd: process.cwd(),
        deadline: Date.now() + 5_000,
        env: {},
        maxOutputBytes: 64,
      })).rejects.toThrow('owned process output exceeded 64 bytes')
      expectProcessGone(readPid(pidFile))
    },
  )

  it.skipIf(process.platform === 'win32')(
    'terminates a pipe-holding descendant when output overflows after the leader settles',
    async () => {
      const pidFile = join(tempRoot(), 'late-overflow.pid')
      const descendant = `
        const { writeFileSync } = require('node:fs')
        writeFileSync(${JSON.stringify(pidFile)}, String(process.pid))
        process.on('SIGTERM', () => {})
        setTimeout(() => {
          setInterval(() => process.stdout.write('xx'), 1)
        }, 750)
      `
      const leader = `
        const { existsSync } = require('node:fs')
        const { spawn } = require('node:child_process')
        spawn(process.execPath, ['-e', ${JSON.stringify(descendant)}], {
          stdio: ['ignore', 'inherit', 'inherit'],
        })
        const ready = setInterval(() => {
          if (!existsSync(${JSON.stringify(pidFile)})) return
          clearInterval(ready)
          process.exit(0)
        }, 5)
      `
      const started = Date.now()
      const deadline = started + 4_000
      let descendantPid: number | undefined

      try {
        await expect(runOwnedProcess(process.execPath, ['-e', leader], {
          cwd: process.cwd(),
          deadline,
          env: {},
          maxOutputBytes: 1,
        })).rejects.toThrow('owned process output exceeded 1 bytes')
        descendantPid = readPid(pidFile)

        expectProcessGone(descendantPid)
        expect(Date.now() - started).toBeLessThan(2_500)
      } finally {
        if (descendantPid !== undefined) {
          try {
            process.kill(descendantPid, 'SIGKILL')
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
          }
        }
      }
    },
  )

  it.skipIf(process.platform === 'win32')(
    'starts whole-tree exit observation before the direct child settles',
    async () => {
      const actualSpawn = spawnHarness.actual
      if (actualSpawn === undefined) throw new Error('spawn mock was not initialized')
      const calls: string[] = []
      spawnHarness.implementation = (spec, internals) => {
        const running = actualSpawn(spec, internals)
        void running.done.then(() => { calls.push('done') })
        return {
          ...running,
          waitForExit: (signal) => {
            calls.push('waitForExit')
            return running.waitForExit(signal)
          },
        }
      }

      await runOwnedProcess(process.execPath, ['-e', 'process.exit(0)'], {
        cwd: process.cwd(),
        deadline: Date.now() + 5_000,
        env: {},
        maxOutputBytes: 1024,
      })

      expect(calls).toEqual(['waitForExit', 'done'])
    },
  )

  it('rejects Windows before spawning', async () => {
    const platform = vi.spyOn(process, 'platform', 'get').mockReturnValue('win32')
    try {
      await expect(runOwnedProcess('/path/that/must/not/run', [], {
        cwd: process.cwd(),
        deadline: Date.now() + 5_000,
        env: {},
        maxOutputBytes: 1024,
      })).rejects.toThrow('owned process execution is unsupported on Windows')
    } finally {
      platform.mockRestore()
    }
  })
})

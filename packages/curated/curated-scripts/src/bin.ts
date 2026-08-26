#!/usr/bin/env node
/**
 * CLI entry for curated verification command wrappers.
 * @module @deepseek-ai/dsh-curated-scripts/bin
 */

import { basename } from 'node:path'
import {
  runCompareBenchmark,
  runPreflight,
  runSmokeProfile,
  runVerifyLock,
  type CommandResult,
} from './index.ts'

const COMMANDS = {
  'dsh-curated-verify-lock': runVerifyLock,
  'dsh-curated-preflight': runPreflight,
  'dsh-curated-smoke-profile': runSmokeProfile,
  'dsh-curated-compare-benchmark': runCompareBenchmark,
} as const

/* v8 ignore start -- thin process wrapper over unit-tested command functions. */
const invoked = basename(process.argv[1] ?? '')
const runner = COMMANDS[invoked as keyof typeof COMMANDS]

const result = await runSelectedCommand(runner, process.argv.slice(2))
process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
process.exitCode = result.status
/* v8 ignore stop */

function runSelectedCommand(
  runner: ((args: readonly string[]) => CommandResult | Promise<CommandResult>) | undefined,
  args: readonly string[],
): Promise<CommandResult> {
  if (runner !== undefined) return Promise.resolve(runner(args))
  return Promise.resolve({
    status: 1,
    stdout: '',
    stderr: 'usage: dsh-curated-{verify-lock|preflight|smoke-profile|compare-benchmark} [...args]\n',
  })
}

#!/usr/bin/env node
/**
 * CLI entry for curated verification command wrappers.
 * @module @deepseek-ai/dsh-curated-scripts/bin
 */

import {
  runCompareBenchmark,
  runPreflight,
  runSmokeProfile,
  runVerifyLock,
  type CommandResult,
} from './index.ts'

const COMMANDS = {
  'verify-lock': runVerifyLock,
  preflight: runPreflight,
  'smoke-profile': runSmokeProfile,
  'compare-benchmark': runCompareBenchmark,
} as const

/** Command selected by one explicit published executable entry. */
export type CuratedCommandName = keyof typeof COMMANDS

/**
 * Run one curated command through the current process streams.
 * @param command - Command fixed by the importing executable module.
 */
export async function runCuratedCommand(command: CuratedCommandName): Promise<void> {
  const result: CommandResult = await COMMANDS[command](process.argv.slice(2))
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  process.exitCode = result.status
}

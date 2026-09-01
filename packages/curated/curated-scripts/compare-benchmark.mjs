#!/usr/bin/env node

import { tsImport } from 'tsx/esm/api'

const { runCompareBenchmark } = await tsImport('./src/index.ts', import.meta.url)
const result = runCompareBenchmark(process.argv.slice(2))

process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
process.exitCode = result.status

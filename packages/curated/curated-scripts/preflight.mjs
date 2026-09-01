#!/usr/bin/env node

import { tsImport } from 'tsx/esm/api'

const { runPreflight } = await tsImport('./src/index.ts', import.meta.url)
const result = runPreflight(process.argv.slice(2))

process.stdout.write(result.stdout)
process.stderr.write(result.stderr)
process.exitCode = result.status

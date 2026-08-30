#!/usr/bin/env node
/* v8 ignore file -- exercised through the installed package-manager shim. */
/** Published smoke-profile executable. @module @deepseek-ai/dsh-curated-scripts/smoke-profile */

import { runCuratedCommand } from './bin.ts'

await runCuratedCommand('smoke-profile')

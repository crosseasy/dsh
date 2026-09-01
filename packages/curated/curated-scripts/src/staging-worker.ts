/**
 * Worker entry for cancellable smoke-profile artifact inspection.
 * @module @deepseek-ai/dsh-curated-scripts/staging-worker
 */

import { parentPort, workerData } from 'node:worker_threads'
import {
  inspectSmokeProfileStaging,
  type SmokeProfileStagingInput,
} from './index.ts'

if (parentPort === null) throw new Error('smoke-profile staging worker requires a parent port')
parentPort.postMessage(inspectSmokeProfileStaging(workerData as SmokeProfileStagingInput))

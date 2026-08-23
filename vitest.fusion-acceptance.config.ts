import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'
import {
  FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS,
  FUSION_ACCEPTANCE_TIMEOUT_MS,
} from './apps/web/tests/fusion-real-process.ts'
import { standardDecoratorPlugin, vitestExecArgv } from './vitest.shared.ts'

export {
  FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS,
  FUSION_ACCEPTANCE_TIMEOUT_MS,
}

export default defineConfig({
  plugins: [
    tsconfigPaths({ projects: ['./tsconfig.base.json'] }),
    standardDecoratorPlugin(),
  ],
  test: {
    execArgv: vitestExecArgv,
    include: ['apps/web/tests/**/*.acceptance.ts'],
    testTimeout: FUSION_ACCEPTANCE_TIMEOUT_MS,
    hookTimeout: FUSION_ACCEPTANCE_CLEANUP_TIMEOUT_MS,
    fileParallelism: false,
  },
})

import { defineConfig } from 'tsdown'

const shared = {
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  outputOptions: { codeSplitting: false },
  dts: false,
  clean: false,
} as const

export default defineConfig([
  { ...shared, entry: ['lib/types/index.js'] },
  { ...shared, entry: ['lib/types/invariant.js'] },
  { ...shared, entry: ['lib/types/bin.js'] },
  { ...shared, entry: ['lib/types/verify-lock.js'] },
  { ...shared, entry: ['lib/types/preflight.js'] },
  { ...shared, entry: ['lib/types/smoke-profile.js'] },
  { ...shared, entry: ['lib/types/compare-benchmark.js'] },
  { ...shared, entry: ['lib/types/staging-worker.js'] },
])

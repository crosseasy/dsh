/** Cordis Loader configuration file discovery. */

import { globSync } from 'node:fs'

const CORDIS_CONFIG = /(?:^|\/)[^/]*cordis[^/]*\.ya?ml$/

/**
 * Whether a repository-relative path is a recognized Cordis Loader or patch YAML file.
 * @param file Repository-relative path to classify.
 * @returns Whether the repository treats the path as Loader input.
 */
export function isCordisConfigFile(file: string): boolean {
  const normalized = file.replaceAll('\\', '/')
  if (normalized.startsWith('.claude/')
    || normalized.startsWith('node_modules/')
    || normalized.startsWith('vendor/')
    || normalized.endsWith('.i18n.yaml')) return false
  return CORDIS_CONFIG.test(normalized)
}

/**
 * Return repository-relative Cordis Loader YAML paths under `root`.
 *
 * Translation consistency records are YAML sidecars, never Loader inputs.
 *
 * @param root Repository root to scan.
 * @returns Sorted repository-relative Loader configuration paths.
 */
export function cordisConfigFiles(root: string): string[] {
  return globSync(['**/*cordis*.yml', '**/*cordis*.yaml'], {
    cwd: root,
    exclude: ['.claude/**', 'node_modules/**', 'vendor/**', '**/*.i18n.yaml'],
  }).filter(isCordisConfigFile).sort()
}

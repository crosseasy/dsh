/** Shared classification for generated residue left by removed workspace packages. */

const knownManifestlessPackageResidue = new Set(['node_modules', 'lib', '.typecheck'])

/**
 * Classify entries that may remain inside a deleted `packages/<group>/<pkg>` directory.
 * @param entries - immediate directory entries to classify.
 * @returns entry names that are not repository-owned generated residue.
 */
export function unknownManifestlessPackageEntries(entries: readonly string[]): string[] {
  return entries
    .filter(entry => !knownManifestlessPackageResidue.has(entry) && !entry.endsWith('.tsbuildinfo'))
    .sort()
}

/**
 * Whether one workspace directory name is local dependency state outside package discovery.
 * @param entryName - immediate child directory name under a workspace glob root.
 * @returns true when package discovery should skip the entry.
 */
export function isLocalWorkspaceArtifactDirectory(entryName: string): boolean {
  return entryName === 'node_modules'
}

/**
 * Cross-process ownership for curated profile preparation and installation.
 * @module @deepseek-ai/dsh/curated-profile-lock
 */

import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
  type BigIntStats,
} from 'node:fs'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import type { CuratedProfileName } from '@deepseek-ai/dsh-curated-profiles'

const NAME = 'dsh'
const CURATED_INSTALL_LOCK_WAIT_MS = 10 * 60 * 1_000
const CURATED_INSTALL_LOCK_RETRY_MS = 50

/** Exclusive ownership of one curated profile's mutable live path. */
export interface CuratedProfileLock {
  /** Reject when the lock is no longer owned by this operation. */
  readonly assertOwned: () => void
  /** Release the lock after checking its retained identity. */
  readonly release: () => void
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException & { readonly code: string } {
  return error instanceof Error && typeof (error as NodeJS.ErrnoException).code === 'string'
}

function sameIdentity(
  left: { readonly dev: bigint; readonly ino: bigint },
  right: { readonly dev: bigint; readonly ino: bigint },
): boolean {
  return left.ino !== 0n && right.ino !== 0n && left.dev === right.dev && left.ino === right.ino
}

/* v8 ignore start -- subprocess tests exercise OS-level lock acquisition,
   stale-owner recovery, and cleanup; child coverage cannot be attributed here. */
function assertRegularDirectory(path: string, label: string): BigIntStats {
  const identity = lstatSync(path, { bigint: true })
  if (identity.isSymbolicLink() || !identity.isDirectory()) {
    throw new Error(`${NAME}: ${label} must be a regular directory: ${path}`)
  }
  return identity
}

/**
 * Create and validate the directory that owns curated profile locks.
 * @param home - DSH home containing the profile tree.
 * @param profile - Curated profile used for startup containment diagnostics.
 * @returns the canonical contained profiles directory.
 */
export function prepareCuratedProfileLockRoot(
  home: string,
  profile?: CuratedProfileName,
): string {
  mkdirSync(home, { recursive: true, mode: 0o700 })
  assertRegularDirectory(home, 'DSH home')
  const profilesDir = join(home, 'profiles')
  mkdirSync(profilesDir, { recursive: true, mode: 0o700 })
  assertRegularDirectory(profilesDir, 'profiles root')
  const canonicalHome = realpathSync.native(home)
  const fromHome = relative(canonicalHome, realpathSync.native(profilesDir))
  if (isAbsolute(fromHome) || fromHome === '..' || fromHome.startsWith(`..${sep}`)) {
    if (profile !== undefined) {
      throw new Error(`${profile} profile root resolves outside the DSH home`)
    }
    throw new Error(`${NAME}: curated install root resolves outside the DSH home`)
  }
  return profilesDir
}

function processStarted(pid: number): string | undefined {
  try {
    if (process.platform === 'linux') {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
      const close = stat.lastIndexOf(')')
      const started = close >= 0 ? stat.slice(close + 2).trim().split(/\s+/)[19] : undefined
      return started === undefined ? undefined : `linux:${started}`
    }
    if (process.platform === 'darwin') {
      const started = execFileSync('/bin/ps', ['-o', 'lstart=', '-p', String(pid)], {
        encoding: 'utf8',
        env: { LANG: 'C', LC_ALL: 'C' },
      }).trim()
      return started === '' ? undefined : `darwin:${started}`
    }
    if (process.platform === 'win32') {
      const systemRoot = process.env.SystemRoot
      if (systemRoot === undefined || !isAbsolute(systemRoot)) return undefined
      const powershell = join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
      const started = execFileSync(powershell, [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `(Get-Process -Id ${String(pid)} -ErrorAction Stop).StartTime.ToUniversalTime().Ticks`,
      ], { encoding: 'utf8', windowsHide: true }).trim()
      return /^\d+$/.test(started) ? `win32:${started}` : undefined
    }
    return undefined
  } catch {
    return undefined
  }
}

function currentProcessStarted(): string {
  const started = processStarted(process.pid)
  if (started === undefined) {
    throw new Error(`${NAME}: cannot verify this process incarnation for curated profile locking`)
  }
  return started
}

interface CuratedProfileLockOwner {
  readonly pid: number
  readonly started: string
  readonly token: string
  readonly lockIdentity: BigIntStats
}

function readLockOwner(lockPath: string): CuratedProfileLockOwner | undefined {
  let descriptor: number | undefined
  try {
    const lockIdentity = lstatSync(lockPath, { bigint: true })
    if (lockIdentity.isSymbolicLink() || !lockIdentity.isDirectory()) return undefined
    const ownerPath = join(lockPath, 'owner.json')
    const ownerIdentity = lstatSync(ownerPath, { bigint: true })
    if (ownerIdentity.isSymbolicLink() || !ownerIdentity.isFile() || ownerIdentity.size > 4096n) return undefined
    let flags = constants.O_RDONLY | constants.O_NONBLOCK
    /* v8 ignore else -- Windows does not expose O_NOFOLLOW. */
    if (typeof constants.O_NOFOLLOW === 'number') flags |= constants.O_NOFOLLOW
    descriptor = openSync(ownerPath, flags)
    const opened = fstatSync(descriptor, { bigint: true })
    if (!opened.isFile() || !sameIdentity(ownerIdentity, opened) || opened.size > 4096n) return undefined
    const bytes = Buffer.alloc(Number(opened.size))
    let offset = 0
    while (offset < bytes.byteLength) {
      const count = readSync(descriptor, bytes, offset, bytes.byteLength - offset, null)
      if (count === 0) break
      offset += count
    }
    const currentOwner = lstatSync(ownerPath, { bigint: true })
    const currentLock = lstatSync(lockPath, { bigint: true })
    const held = fstatSync(descriptor, { bigint: true })
    if (
      offset !== bytes.byteLength
      || currentOwner.isSymbolicLink()
      || !currentOwner.isFile()
      || !sameIdentity(opened, currentOwner)
      || !sameIdentity(opened, held)
      || opened.size !== currentOwner.size
      || opened.size !== held.size
      || opened.mtimeNs !== currentOwner.mtimeNs
      || opened.mtimeNs !== held.mtimeNs
      || opened.ctimeNs !== currentOwner.ctimeNs
      || opened.ctimeNs !== held.ctimeNs
      || !sameIdentity(lockIdentity, currentLock)
    ) return undefined
    const parsed = JSON.parse(bytes.toString('utf8')) as unknown
    if (
      typeof parsed !== 'object'
      || parsed === null
      || Array.isArray(parsed)
      || typeof (parsed as { pid?: unknown }).pid !== 'number'
      || typeof (parsed as { started?: unknown }).started !== 'string'
      || typeof (parsed as { token?: unknown }).token !== 'string'
    ) return undefined
    const owner = parsed as { readonly pid: number; readonly started: string; readonly token: string }
    if (
      !Number.isSafeInteger(owner.pid)
      || owner.pid <= 0
      || owner.started.length === 0
      || owner.token.length === 0
    ) return undefined
    return { ...owner, lockIdentity }
  } catch (error) {
    // Unreadable, unstable, or malformed untrusted owner records mean the owner
    // is unknown. This cannot authorize reclamation: reclaimDeadLock requires
    // a parsed owner whose PID is confirmed dead.
    if (error instanceof SyntaxError || isNodeError(error)) return undefined
    throw error
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

function removeOwnedLockPath(path: string, parent: string, expectedIdentity: BigIntStats): void {
  let identity: BigIntStats
  try {
    identity = lstatSync(path, { bigint: true })
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return
    throw error
  }
  if (!sameIdentity(identity, expectedIdentity)) {
    throw new Error(`${NAME}: owned install path changed before cleanup: ${path}`)
  }
  if (identity.isSymbolicLink() || !identity.isDirectory()) {
    unlinkSync(path)
    return
  }
  const canonicalParent = realpathSync.native(parent)
  const canonicalPath = realpathSync.native(path)
  const fromParent = relative(canonicalParent, canonicalPath)
  if (isAbsolute(fromParent) || fromParent === '..' || fromParent.startsWith(`..${sep}`)) {
    throw new Error(`${NAME}: owned install path resolves outside its parent: ${path}`)
  }
  rmSync(path, { recursive: true })
}

function reclaimDeadLock(lockPath: string, profilesDir: string): boolean {
  const owner = readLockOwner(lockPath)
  if (owner === undefined) return false
  const ownerIsDead = (): boolean => {
    let pidIsAbsent = false
    try {
      process.kill(owner.pid, 0)
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ESRCH') return false
      pidIsAbsent = true
    }
    if (pidIsAbsent) return true
    const currentStarted = processStarted(owner.pid)
    return currentStarted !== undefined && currentStarted !== owner.started
  }
  if (!ownerIsDead()) return false
  const marker = join(lockPath, 'reclaim')
  try {
    mkdirSync(marker, { mode: 0o700 })
  } catch (error) {
    if (isNodeError(error) && ['EEXIST', 'ENOENT', 'ENOTDIR'].includes(error.code)) return false
    throw error
  }
  const markerIdentity = lstatSync(marker, { bigint: true })
  let renamed = false
  try {
    const currentOwner = readLockOwner(lockPath)
    const currentMarker = lstatSync(marker, { bigint: true })
    if (
      currentOwner?.pid !== owner.pid
      || currentOwner.started !== owner.started
      || currentOwner.token !== owner.token
      || !sameIdentity(currentOwner.lockIdentity, owner.lockIdentity)
      || currentMarker.isSymbolicLink()
      || !currentMarker.isDirectory()
      || !sameIdentity(currentMarker, markerIdentity)
      || !ownerIsDead()
    ) return false
    const reclaimed = join(
      profilesDir,
      `.${basename(lockPath)}.reclaimed-${randomBytes(16).toString('hex')}`,
    )
    try {
      renameSync(lockPath, reclaimed)
    } catch (error) {
      if (isNodeError(error) && ['ENOENT', 'EEXIST', 'ENOTEMPTY'].includes(error.code)) return false
      throw error
    }
    renamed = true
    removeOwnedLockPath(reclaimed, profilesDir, owner.lockIdentity)
    return true
  } finally {
    if (!renamed) {
      let currentLock: BigIntStats | undefined
      try {
        currentLock = lstatSync(lockPath, { bigint: true })
      } catch (error) {
        if (!isNodeError(error) || error.code !== 'ENOENT') throw error
      }
      if (currentLock !== undefined && sameIdentity(currentLock, owner.lockIdentity)) {
        removeOwnedLockPath(marker, lockPath, markerIdentity)
      }
    }
  }
}

function claimCuratedProfileLock(
  profile: CuratedProfileName,
  profilesDir: string,
  token: string,
  started: string,
): CuratedProfileLock | undefined {
  const lockPath = join(profilesDir, `.${profile}.install.lock`)
  try {
    mkdirSync(lockPath, { mode: 0o700 })
  } catch (error) {
    if (isNodeError(error) && ['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(error.code)) return undefined
    throw error
  }
  const lockIdentity = lstatSync(lockPath, { bigint: true })
  try {
    writeFileSync(
      join(lockPath, 'owner.json'),
      `${JSON.stringify({ pid: process.pid, started, token })}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 },
    )
    const owner = readLockOwner(lockPath)
    if (
      owner?.token !== token
      || owner.started !== started
      || !sameIdentity(lockIdentity, owner.lockIdentity)
    ) {
      throw new Error(`${NAME}: curated profile lock ownership changed`)
    }
  } catch (error) {
    removeOwnedLockPath(lockPath, profilesDir, lockIdentity)
    throw error
  }
  const assertOwned = (): void => {
    const owner = readLockOwner(lockPath)
    if (
      owner?.token !== token
      || owner.started !== started
      || !sameIdentity(lockIdentity, owner.lockIdentity)
    ) {
      throw new Error(`${NAME}: curated profile lock ownership changed`)
    }
  }
  return {
    assertOwned,
    release: () => {
      assertOwned()
      const released = join(profilesDir, `.${profile}.install-lock-release-${token}`)
      renameSync(lockPath, released)
      removeOwnedLockPath(released, profilesDir, lockIdentity)
    },
  }
}

function tryAcquireCuratedProfileLock(
  profile: CuratedProfileName,
  profilesDir: string,
  started: string,
): CuratedProfileLock | undefined {
  const lockPath = join(profilesDir, `.${profile}.install.lock`)
  const token = randomBytes(16).toString('hex')
  for (;;) {
    const lock = claimCuratedProfileLock(profile, profilesDir, token, started)
    if (lock !== undefined) return lock
    if (!reclaimDeadLock(lockPath, profilesDir)) return undefined
  }
}

/**
 * Acquire profile ownership for synchronous startup preparation.
 * @param profile - Curated profile whose live path will be read or materialized.
 * @param home - DSH home containing the profile tree.
 * @returns exclusive profile ownership.
 * @throws when the lock is held or its owner cannot be verified. Confirm no
 * process is using the profile before removing the lock directory manually.
 */
export function acquireCuratedProfilePreparationLock(
  profile: CuratedProfileName,
  home: string,
): CuratedProfileLock {
  const profilesDir = prepareCuratedProfileLockRoot(home, profile)
  const started = currentProcessStarted()
  const lock = tryAcquireCuratedProfileLock(profile, profilesDir, started)
  if (lock === undefined) {
    throw new Error(
      `${NAME}: curated profile lock is held or its owner cannot be verified: ${profile}; `
      + 'confirm no process is using the profile before removing the lock directory',
    )
  }
  const liveDir = join(profilesDir, profile)
  const previousDir = join(profilesDir, `.${profile}.install-previous`)
  if (!existsSync(liveDir) && existsSync(previousDir)) {
    lock.release()
    throw new Error(
      `${NAME}: curated profile installation requires recovery; `
      + `run dsh plugin --profile ${profile} install`,
    )
  }
  return lock
}

async function acquireCuratedInstallLock(
  profile: CuratedProfileName,
  profilesDir: string,
): Promise<CuratedProfileLock> {
  const started = currentProcessStarted()
  const deadline = Date.now() + CURATED_INSTALL_LOCK_WAIT_MS
  for (;;) {
    const lock = tryAcquireCuratedProfileLock(profile, profilesDir, started)
    if (lock !== undefined) return lock
    if (Date.now() >= deadline) {
      const lockPath = join(profilesDir, `.${profile}.install.lock`)
      throw new Error(`${NAME}: timed out waiting for the curated profile install lock at ${lockPath}`)
    }
    await new Promise(resolveDelay => setTimeout(resolveDelay, CURATED_INSTALL_LOCK_RETRY_MS))
  }
}

/**
 * Serialize one curated installation against startup and other installers.
 * @param profile - Curated profile whose live path the operation may replace.
 * @param profilesDir - Validated profile root below the DSH home.
 * @param operation - Work performed while ownership remains current.
 * @returns the operation result.
 * @throws when acquisition fails (including timeout), the operation throws or
 * rejects, or release fails. Combined operation and release failures reject
 * with an `AggregateError` containing both.
 */
export async function withCuratedInstallLock<T>(
  profile: CuratedProfileName,
  profilesDir: string,
  operation: (lock: CuratedProfileLock) => Promise<T> | T,
): Promise<T> {
  const lock = await acquireCuratedInstallLock(profile, profilesDir)
  let operationFailed = false
  let failure: unknown
  try {
    return await operation(lock)
  } catch (error) {
    operationFailed = true
    failure = error
    throw error
  } finally {
    try {
      lock.release()
    } catch (releaseError) {
      if (!operationFailed) throw releaseError
      throw new AggregateError(
        [failure, releaseError],
        `${NAME}: curated profile install failed and lock release also failed`,
        { cause: failure },
      )
    }
  }
}
/* v8 ignore stop */

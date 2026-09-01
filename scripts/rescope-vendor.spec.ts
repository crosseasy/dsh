/**
 * Acceptance-path coverage for the rescope codemod's exact-edit classifier: a
 * duplicated insertion — what a non-idempotent apply produces — must be
 * rejected rather than applied again.
 */

import { describe, expect, it } from 'vitest'
import { EXACT_EDITS, exactEditState, existingTrackedFiles } from './rescope-vendor.ts'

const ANCHOR = '\n## Sync procedure'
const INSERTED = `\n15. **rescope**: one log entry.\n${ANCHOR}`

describe('exactEditState', () => {
  it('classifies an insertion by its target form, so a duplicate is invalid', () => {
    expect(exactEditState(`log\n${ANCHOR}\n`, ANCHOR, INSERTED, 1)).toBe('pending')
    expect(exactEditState(`log${INSERTED}\n`, ANCHOR, INSERTED, 1)).toBe('applied')
    // The anchor survives an insertion, so counting the source form would have
    // called this pending and inserted the entry a second time.
    expect(exactEditState(`log${INSERTED}${INSERTED}\n`, ANCHOR, INSERTED, 1)).toBe('invalid')
    expect(exactEditState('log\n', ANCHOR, INSERTED, 1)).toBe('invalid')
  })

  it('classifies a deletion by its source form, and requires its remainder to survive', () => {
    const remainder = 'exclude:\n'
    const withEntries = 'exclude:\n  - cordis@4\n'
    expect(exactEditState(withEntries, withEntries, remainder, 1)).toBe('pending')
    expect(exactEditState(remainder, withEntries, remainder, 1)).toBe('applied')
    // Upstream dropped the whole field: the source form is gone, but so is the
    // remainder, so this is a moved site rather than a completed deletion.
    expect(exactEditState('unrelated:\n', withEntries, remainder, 1)).toBe('invalid')
  })

  it('requires a replacement to leave no source form and the exact target count', () => {
    expect(exactEditState('a = 1\n', 'a = 1', 'b = 2', 1)).toBe('pending')
    expect(exactEditState('b = 2\n', 'a = 1', 'b = 2', 1)).toBe('applied')
    expect(exactEditState('b = 2\nb = 2\n', 'a = 1', 'b = 2', 1)).toBe('invalid')
    // A moved or partially applied site: neither state is complete.
    expect(exactEditState('a = 1\nb = 2\n', 'a = 1', 'b = 2', 1)).toBe('invalid')
    expect(exactEditState('x\n', 'a = 1', 'b = 2', 1)).toBe('invalid')
  })

  it('migrates the upstream root package rule to the current publication rule idempotently', () => {
    const upstream = 'Every npm package is `@deepseek-ai/dsh-<name>`; vendored packages keep upstream names and are `private: true`. `cor'
      + 'dis` is a peerDependency (+ dev) of every harness package.'
    const current = 'Publishable dsh packages set `publishConfig.access: public`; experimental/private packages remain private. Vendored packages are rescoped ([mapping](docs/rescope.md)) and follow their publication policy. `@deepseek-ai/cordis` is a peerDependency (+ dev) of every harness package.'
    const edit = EXACT_EDITS.find(candidate => candidate.id === 'root-agents-vendored-name-contract')

    expect(edit).toEqual({
      id: 'root-agents-vendored-name-contract',
      file: 'AGENTS.md',
      find: upstream,
      replace: current,
      expect: 1,
    })
    expect(exactEditState(upstream, edit!.find, edit!.replace, edit!.expect)).toBe('pending')
    expect(exactEditState(current, edit!.find, edit!.replace, edit!.expect)).toBe('applied')
    expect(upstream.split(edit!.find).join(edit!.replace)).toBe(current)
    expect(current.split(edit!.find).join(edit!.replace)).toBe(current)
  })

  it('ignores tracked files that are absent from the working tree', () => {
    const present = new Set(['kept.ts', 'nested/also-kept.ts'])

    expect(existingTrackedFiles(['kept.ts', 'deleted.ts', 'nested/also-kept.ts'], file => present.has(file)))
      .toEqual(['kept.ts', 'nested/also-kept.ts'])
  })
})

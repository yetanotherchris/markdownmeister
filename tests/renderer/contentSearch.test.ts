import { describe, it, expect } from 'vitest'
import {
  ancestorDirectories,
  contentMatchSet,
  searchMatchWithContent,
  shouldShowNoMatchState
} from '../../src/renderer/explorer/contentSearch'
import type { TreeNode } from '../../src/renderer/state/workspace'

function node(name: string, children?: TreeNode[]): TreeNode {
  return {
    id: name,
    name,
    kind: children ? 'directory' : 'file',
    children: children ? children : null,
    loadState: 'loaded'
  }
}

describe('ancestorDirectories (spec 059, R3)', () => {
  it('returns no ancestors for a root-level path', () => {
    expect(ancestorDirectories('alpha.md')).toEqual([])
  })

  it('returns ancestors root-first for a nested path', () => {
    expect(ancestorDirectories('docs/file.md')).toEqual(['docs'])
    expect(ancestorDirectories('docs/sub/deep.md')).toEqual(['docs', 'docs/sub'])
  })
})

describe('contentMatchSet', () => {
  it('wraps the matched paths in a set', () => {
    expect(contentMatchSet(['a.md', 'b/c.md'])).toEqual(new Set(['a.md', 'b/c.md']))
    expect(contentMatchSet([])).toEqual(new Set())
  })
})

describe('searchMatchWithContent (FR-003/FR-005)', () => {
  it('the entry being edited always matches', () => {
    expect(
      searchMatchWithContent('new-file-1.md', 'new-file-1.md', 'alpha', 'new-file-1.md', new Set())
    ).toBe(true)
  })

  it('a content-matched id matches regardless of its name', () => {
    const ids = new Set(['docs/notes.md'])
    expect(searchMatchWithContent('docs/notes.md', 'notes.md', 'alpha', null, ids)).toBe(true)
  })

  it('a name match still matches, content match or not', () => {
    expect(searchMatchWithContent('alpha.md', 'alpha.md', 'alpha', null, new Set())).toBe(true)
  })

  it('no match at all is false', () => {
    expect(
      searchMatchWithContent('beta.md', 'beta.md', 'alpha', null, new Set(['docs/notes.md']))
    ).toBe(false)
  })
})

describe('shouldShowNoMatchState (FR-009, R5)', () => {
  const data = [node('alpha.md')]

  it('never shows when not filtering', () => {
    expect(shouldShowNoMatchState(false, data, '', new Set(), true, null)).toBe(false)
  })

  it('never shows while a placeholder edit is in flight', () => {
    expect(shouldShowNoMatchState(true, data, 'zzz', new Set(), true, 'new-file-1.md')).toBe(false)
  })

  it('never shows when a filename matches', () => {
    expect(shouldShowNoMatchState(true, data, 'alpha', new Set(), true, null)).toBe(false)
  })

  it('never shows when content matches exist', () => {
    expect(shouldShowNoMatchState(true, data, 'zzz', new Set(['docs/notes.md']), true, null)).toBe(
      false
    )
  })

  it('shows only once the content search has settled', () => {
    expect(shouldShowNoMatchState(true, data, 'zzz', new Set(), true, null)).toBe(true)
    expect(shouldShowNoMatchState(true, data, 'zzz', new Set(), false, null)).toBe(false)
  })
})
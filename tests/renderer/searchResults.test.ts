import { describe, it, expect } from 'vitest'
import {
  highlightSegments,
  mergeSearchSections,
  nameMatchSections,
  summarize,
  truncateSnippet
} from '../../src/renderer/explorer/searchResultModel'
import type { TreeNode } from '../../src/renderer/state/workspace'
import type { SearchContentResult } from '../../src/shared/ipc-contract'

function node(name: string, children?: TreeNode[]): TreeNode {
  return {
    id: name,
    name: name.split('/').pop() ?? name,
    kind: children ? 'directory' : 'file',
    children: children ? children : null,
    loadState: 'loaded'
  }
}

/** Build a tree node with a full workspace-relative path id and basename. */
function nodeAt(id: string, children?: TreeNode[]): TreeNode {
  return {
    id,
    name: id.split('/').pop() ?? id,
    kind: children ? 'directory' : 'file',
    children: children ? children : null,
    loadState: 'loaded'
  }
}

describe('truncateSnippet (spec 060 FR-006)', () => {
  it('returns short lines unchanged', () => {
    expect(truncateSnippet('a short line with walrus', 'walrus', 100)).toBe(
      'a short line with walrus'
    )
  })

  it('keeps the match visible and truncates with ellipses on both sides', () => {
    const long = `${'x'.repeat(200)} walrus ${'y'.repeat(200)}`
    const out = truncateSnippet(long, 'walrus', 140)
    expect(out).toContain('walrus')
    expect(out.startsWith('...')).toBe(true)
    expect(out.endsWith('...')).toBe(true)
    expect(out.length).toBeLessThanOrEqual(143)
  })

  it('truncates only the trailing side when the match is at the start', () => {
    const long = `walrus ${'y'.repeat(300)}`
    const out = truncateSnippet(long, 'walrus', 140)
    expect(out.startsWith('walrus')).toBe(true)
    expect(out.endsWith('...')).toBe(true)
    expect(out.startsWith('...')).toBe(false)
  })
})

describe('highlightSegments (spec 060 FR-007)', () => {
  it('wraps every case-insensitive occurrence as a match', () => {
    expect(highlightSegments('Walrus and WALRUS and wALRUS', 'walrus')).toEqual([
      { text: 'Walrus', match: true },
      { text: ' and ', match: false },
      { text: 'WALRUS', match: true },
      { text: ' and ', match: false },
      { text: 'wALRUS', match: true }
    ])
  })

  it('escapes regex metacharacters in the term', () => {
    expect(highlightSegments('a.b and aXb', 'a.b')).toEqual([
      { text: 'a.b', match: true },
      { text: ' and aXb', match: false }
    ])
  })

  it('returns a single non-match segment for an empty term', () => {
    expect(highlightSegments('plain', '')).toEqual([{ text: 'plain', match: false }])
  })
})

describe('nameMatchSections (spec 060 FR-008)', () => {
  const data = [
    node('alpha.md'),
    nodeAt('docs', [node('docs/notes.md'), nodeAt('docs/sub', [node('docs/sub/alpha-deep.md')])])
  ]

  it('finds loaded files whose name matches, with directory paths', () => {
    expect(nameMatchSections(data, 'alpha')).toEqual([
      { path: 'alpha.md', name: 'alpha.md', directory: '', count: 1, lines: [] },
      {
        path: 'docs/sub/alpha-deep.md',
        name: 'alpha-deep.md',
        directory: 'docs/sub',
        count: 1,
        lines: []
      }
    ])
  })

  it('a whitespace-only term matches nothing', () => {
    expect(nameMatchSections(data, '   ')).toEqual([])
  })
})

describe('mergeSearchSections (spec 060 FR-008)', () => {
  it('a path in both appears once with the content count', () => {
    const name = [{ path: 'a.md', name: 'a.md', directory: '', count: 1, lines: [] }]
    const content: SearchContentResult[] = [
      { path: 'a.md', count: 3, lines: ['x a y', 'a again'] },
      { path: 'b.md', count: 2, lines: ['b a b'] }
    ]
    const merged = mergeSearchSections(name, content)
    expect(merged.find((s) => s.path === 'a.md')).toEqual({
      path: 'a.md',
      name: 'a.md',
      directory: '',
      count: 3,
      lines: ['x a y', 'a again']
    })
    expect(merged.find((s) => s.path === 'b.md')).toEqual({
      path: 'b.md',
      name: 'b.md',
      directory: '',
      count: 2,
      lines: ['b a b']
    })
  })

  it('sorts sections by directory then name, root files first', () => {
    const content: SearchContentResult[] = [
      { path: 'z.md', count: 1, lines: ['z'] },
      { path: 'b/one.md', count: 1, lines: ['one'] },
      { path: 'a/two.md', count: 1, lines: ['two'] }
    ]
    const merged = mergeSearchSections([], content)
    // The root directory '' sorts before 'a' and 'b'.
    expect(merged.map((s) => s.path)).toEqual(['z.md', 'a/two.md', 'b/one.md'])
  })
})

describe('summarize (spec 060 FR-002)', () => {
  it('counts name matches as one and content matches as occurrences', () => {
    expect(
      summarize([
        { path: 'a.md', name: 'a.md', directory: '', count: 1, lines: [] },
        { path: 'b.md', name: 'b.md', directory: '', count: 4, lines: ['b', 'b b'] }
      ])
    ).toEqual({ matches: 5, files: 2 })
  })
})

import { describe, it, expect } from 'vitest'
import { nameSearchMatch, hasNameMatch } from '../../src/renderer/explorer/explorerSearch'
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

describe('nameSearchMatch', () => {
  it('matches a case-insensitive substring of the name (FR-003)', () => {
    expect(nameSearchMatch('Quarterly Report.md', 'report')).toBe(true)
    expect(nameSearchMatch('Quarterly Report.md', 'REPORT')).toBe(true)
    expect(nameSearchMatch('Quarterly Report.md', 'quArTeRlY')).toBe(true)
  })

  it('considers only the name field', () => {
    // The predicate takes the name only, so other fields (id, kind, children)
    // can never be matched (FR-003, FR-007).
    expect(nameSearchMatch('alpha.md', 'alpha')).toBe(true)
    expect(nameSearchMatch('alpha.md', 'md')).toBe(true)
  })

  it('treats folders and files identically (FR-006)', () => {
    expect(nameSearchMatch('reports', 'reports')).toBe(true)
    expect(nameSearchMatch('reports', 'report')).toBe(true)
  })

  it('treats punctuation and symbols as plain text', () => {
    expect(nameSearchMatch('notes-2026.md', '2026')).toBe(true)
    expect(nameSearchMatch('my@file[1].md', '@file[1]')).toBe(true)
  })

  it('treats an empty or whitespace-only term as no filter', () => {
    expect(nameSearchMatch('anything.md', '')).toBe(true)
    expect(nameSearchMatch('anything.md', '   ')).toBe(true)
  })

  it('does not match when the name lacks the term', () => {
    expect(nameSearchMatch('alpha.md', 'bravo')).toBe(false)
    expect(nameSearchMatch('alpha.md', 'al pha')).toBe(false)
  })
})

describe('hasNameMatch', () => {
  const tree: TreeNode[] = [
    node('alpha.md'),
    node('reports', [node('quarterly.md'), node('summary.md')]),
    node('docs', [node('meeting-notes.md', [node('todo.md')])])
  ]

  it('reports no match for empty and whitespace-only terms', () => {
    expect(hasNameMatch(tree, '')).toBe(false)
    expect(hasNameMatch(tree, '   ')).toBe(false)
  })

  it('finds a top-level file match', () => {
    expect(hasNameMatch(tree, 'alpha')).toBe(true)
  })

  it('finds a match inside a loaded folder', () => {
    expect(hasNameMatch(tree, 'quarterly')).toBe(true)
  })

  it('finds a match nested several folders deep', () => {
    expect(hasNameMatch(tree, 'todo')).toBe(true)
  })

  it('returns false when nothing matches', () => {
    expect(hasNameMatch(tree, 'nothing-here')).toBe(false)
  })

  it('a folder whose own name matches reports a match even if its children do not (FR-006)', () => {
    expect(hasNameMatch(tree, 'reports')).toBe(true)
  })
})

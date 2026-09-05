import type { TreeNode } from '../state/workspace'

/**
 * FR-003/FR-005/FR-006 match predicate: a case-insensitive substring test on
 * the entry name only. Folders and files are treated identically. An empty or
 * whitespace-only term matches everything, so it never filters anything out.
 */
export function nameSearchMatch(name: string, term: string): boolean {
  const trimmed = term.trim()
  if (trimmed === '') return true
  return name.toLowerCase().includes(trimmed.toLowerCase())
}

/**
 * Whether any loaded entry name contains the term (FR-009's empty state).
 * Whitespace-only terms report no match so the full tree shows instead of an
 * empty-state message. Only entries already loaded into the tree are
 * considered, matching what react-arborist itself can surface while filtered.
 */
export function hasNameMatch(nodes: TreeNode[], term: string): boolean {
  const trimmed = term.trim()
  if (trimmed === '') return false
  for (const entry of nodes) {
    if (nameSearchMatch(entry.name, trimmed)) return true
    if (entry.children && entry.children.length > 0 && hasNameMatch(entry.children, trimmed)) {
      return true
    }
  }
  return false
}

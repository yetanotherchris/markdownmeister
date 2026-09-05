import type { TreeNode } from '../state/workspace'
import { parentPathOf } from '../state/workspace'
import { hasNameMatch, nameSearchMatch } from './explorerSearch'

/** Ancestor directory ids of a workspace-relative path, root first. For
 *  'docs/sub/file.md' returns ['docs', 'docs/sub']. */
export function ancestorDirectories(relativePath: string): string[] {
  const dirs: string[] = []
  let current = parentPathOf(relativePath)
  while (current !== '') {
    dirs.unshift(current)
    current = parentPathOf(current)
  }
  return dirs
}

/** The set of node ids the tree should treat as matches from content search. */
export function contentMatchSet(paths: string[]): Set<string> {
  return new Set(paths)
}

/** FR-003/FR-005: a node is a match when it is the entry being edited, when
 *  content search flagged its id, or when its name matches the term. */
export function searchMatchWithContent(
  nodeId: string,
  name: string,
  term: string,
  editingId: string | null,
  contentMatchIds: Set<string>
): boolean {
  if (nodeId === editingId) return true
  if (contentMatchIds.has(nodeId)) return true
  return nameSearchMatch(name, term)
}

/** The empty state shows only once the content search for the current term has
 *  settled, so a term that will match content does not flash "No files match"
 *  while the scan is in flight (R5). */
export function shouldShowNoMatchState(
  filtering: boolean,
  data: TreeNode[],
  searchTerm: string,
  contentMatchIds: Set<string>,
  contentSearchIdle: boolean,
  editingId: string | null
): boolean {
  if (!filtering) return false
  if (editingId !== null) return false
  if (hasNameMatch(data, searchTerm)) return false
  if (contentMatchIds.size > 0) return false
  return contentSearchIdle
}
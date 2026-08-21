import type { TreeNode } from '../state/workspace'

/**
 * Pure file-open gesture decisions for the explorer tree (spec 029), extracted
 * from Tree.tsx / useWorkspaceTree.ts so they are unit-testable without React.
 *
 * 2026-08-21 amendment (clarification in the archived spec): the double-click
 * deferral window was removed. Every file open commits immediately; a
 * double-click's second request is an explicit new-tab open whose reducer-level
 * path dedupe lands on the tab the first click just presented, so both gestures
 * agree without delaying same-tab opens by the OS double-click time.
 */

/** The file-opening gesture a row click represents. */
export type FileOpenGesture = 'single-click' | 'double-click'

/** Whether a row click on this node should route through the file-open gesture
 *  path at all (spec 029: only file nodes open documents). */
export function isOpenableFile(node: Pick<TreeNode, 'kind'>): boolean {
  return node.kind === 'file'
}

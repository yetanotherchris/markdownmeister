import type { TreeNode } from '../state/workspace'

/**
 * Pure file-open gesture decisions for the explorer tree (spec 029), extracted
 * from Tree.tsx / useWorkspaceTree.ts so they are unit-testable without React.
 */

/** The double-click window in ms. Must be at least the OS double-click time so
 *  a recognised double-click's second click (`e.detail === 2`) always lands
 *  before the deferred single-click open commits (FR-003; spec Clarification
 *  2026-08-10: Windows OS double-click time is 500 ms). */
export const DOUBLE_CLICK_WINDOW_MS = 500

/** The file-opening gesture a row click represents. */
export type FileOpenGesture = 'single-click' | 'double-click'

/** Whether a row click on this node should route through the file-open gesture
 *  path at all (spec 029: only file nodes open documents). */
export function isOpenableFile(node: Pick<TreeNode, 'kind'>): boolean {
  return node.kind === 'file'
}

/** Whether a single-click in same-tab mode MUST be deferred by the double-click
 *  window. The deferral exists only to stop a single-click that would REPLACE a
 *  clean active tab from committing before a double-click on the same file can
 *  be recognised (FR-003). When there is no active tab, the active tab is dirty,
 *  the file is already open, or the new-tab preference is on, a double-click
 *  produces the same result as the single click, so the click opens immediately.
 *  `activeIsDirty` is `null` when there is no active tab. */
export function shouldDeferSingleClick(opts: {
  preferNewTab: boolean
  activeExists: boolean
  activeIsDirty: boolean | null
  alreadyOpen: boolean
}): boolean {
  if (opts.preferNewTab) return false
  if (opts.alreadyOpen) return false
  if (!opts.activeExists) return false
  return opts.activeIsDirty === false
}

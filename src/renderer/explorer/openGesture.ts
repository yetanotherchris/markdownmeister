import type { TreeNode } from '../state/workspace'



/** The file-opening gesture a row click represents. */
export type FileOpenGesture = 'single-click' | 'double-click'


export function isOpenableFile(node: Pick<TreeNode, 'kind'>): boolean {
  return node.kind === 'file'
}

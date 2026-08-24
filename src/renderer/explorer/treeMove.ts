import { moveTargetPath, wouldMoveIntoOwnDescendant } from './operations'


export function treeMoveTarget(id: string, targetParentId: string): string | null {
  const target = moveTargetPath(id, targetParentId)
  if (!target) return null
  if (treeWouldMoveIntoOwnDescendant(id, targetParentId)) return null
  return target
}

/** True when dropping `id` into `targetParentId` would move it into itself. */
export function treeWouldMoveIntoOwnDescendant(id: string, targetParentId: string): boolean {
  return wouldMoveIntoOwnDescendant(id, targetParentId)
}

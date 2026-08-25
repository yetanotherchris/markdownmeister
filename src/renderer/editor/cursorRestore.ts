import { TextSelection } from '@milkdown/kit/prose/state'
import type { Node } from '@milkdown/kit/prose/model'
import type { Selection } from '@milkdown/kit/prose/state'

export interface CursorRestorePlan {
  selection: Selection
  clamped: boolean
}

/** Resolve a stored absolute caret offset against a freshly parsed document.
 *  An offset past the document end, or one resolving into a position that
 *  cannot host a text selection (an atom node or the document root), moves to
 *  the nearest valid position; `clamped` reports that the document changed
 *  underneath the stored offset. */
export function planCursorRestore(doc: Node, cursorOffset: number): CursorRestorePlan | null {
  if (cursorOffset <= 0) return null
  const pos = Math.min(cursorOffset, doc.content.size)
  const $pos = doc.resolve(pos)
  if (!$pos.parent.inlineContent) {
    return { selection: TextSelection.near($pos), clamped: true }
  }
  return { selection: TextSelection.create(doc, pos), clamped: pos !== cursorOffset }
}

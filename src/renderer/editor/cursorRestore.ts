import { TextSelection } from '@milkdown/kit/prose/state'
import type { Node } from '@milkdown/kit/prose/model'
import type { Selection } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

export interface CursorRestorePlan {
  selection: Selection
  clamped: boolean
}

/** Resolve a mapped top-level block index to a caret selection in the visual
 *  document. The block's left boundary is the sum of the preceding child
 *  sizes; `near` walks forward into the block's text. The call is refused
 *  when the document's top-level child count does not match the correlated
 *  parse that produced the index, so a structurally drifted document falls
 *  back to the caller's stored-offset restore. */
export function planBlockRestore(
  doc: Node,
  blockIndex: number,
  blockCount: number
): Selection | null {
  if (blockIndex < 0 || blockCount <= 0) return null
  if (blockIndex >= blockCount || doc.childCount !== blockCount) return null
  let pos = 0
  for (let i = 0; i < blockIndex; i++) pos += doc.child(i).nodeSize
  return TextSelection.near(doc.resolve(Math.min(pos, doc.content.size)))
}

/** Resolve a stored absolute caret offset against a freshly parsed document.
 *  An offset past the document end, or one resolving into a position that
 *  cannot host a text selection (an atom node or the document root), moves to
 *  the nearest valid position; `clamped` reports that the stored offset did
 *  not apply cleanly. */
export function planCursorRestore(doc: Node, cursorOffset: number): CursorRestorePlan | null {
  if (cursorOffset <= 0) return null
  const pos = Math.min(cursorOffset, doc.content.size)
  const $pos = doc.resolve(pos)
  if (!$pos.parent.inlineContent) {
    return { selection: TextSelection.near($pos), clamped: true }
  }
  return { selection: TextSelection.create(doc, pos), clamped: pos !== cursorOffset }
}

export interface StoredCursor {
  cursorOffset: number
  scrollTop: number
}

/** Apply a stored caret offset and scroll position to a view whose document
 *  was just re-parsed. When the offset did not apply cleanly the caret is
 *  revealed with scrollIntoView instead of trusting the stale scroll value;
 *  otherwise the recorded scroll is reapplied as-is. */
export function applyCursorRestore(
  view: EditorView,
  restoreCursor: StoredCursor,
  scrollElement: HTMLElement | null
): void {
  const plan = planCursorRestore(view.state.doc, restoreCursor.cursorOffset)
  if (plan) {
    const tr = view.state.tr.setSelection(plan.selection)
    if (plan.clamped) {
      // The document changed underneath the stored offset; reveal the
      // restored caret instead of applying the stale scroll position.
      view.dispatch(tr.scrollIntoView())
      return
    }
    view.dispatch(tr)
  }
  if (restoreCursor.scrollTop > 0 && scrollElement) {
    scrollElement.scrollTop = restoreCursor.scrollTop
  }
}

import { TextSelection } from '@milkdown/kit/prose/state'
import type { EditorState, Transaction } from '@milkdown/kit/prose/state'


export function planTaskBackspace(state: EditorState): Transaction | null {
  const { selection } = state
  if (!(selection instanceof TextSelection) || !selection.empty) return null
  const { $from } = selection
  if ($from.parentOffset !== 0) return null

  const item = $from.node(-1)
  if (!item || item.type.name !== 'list_item') return null
  if (item.attrs.checked == null) return null
  if (item.textContent.length !== 0) return null

  const list = $from.node(-2)
  const tr = state.tr

  if (list && list.childCount === 1) {
    const listStart = $from.before(-2)
    const listEnd = $from.after(-2)
    const paragraph = state.schema.nodes.paragraph
    if (!paragraph) return null
    tr.replaceWith(listStart, listEnd, paragraph.create())
    const cursorPos = Math.max(listStart, Math.min(tr.doc.content.size, listStart + 1))
    tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)))
    return tr
  }

  const itemStart = $from.before(-1)
  const itemEnd = $from.after(-1)
  tr.delete(itemStart, itemEnd)
  const cursorPos = Math.max(0, Math.min(tr.doc.content.size, itemStart))
  tr.setSelection(TextSelection.near(tr.doc.resolve(cursorPos)))
  return tr
}

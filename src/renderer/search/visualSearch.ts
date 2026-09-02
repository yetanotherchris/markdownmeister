import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view'
import type { EditorView } from '@milkdown/kit/prose/view'
import type { Node as PMNode } from '@milkdown/kit/prose/model'
import { findMatches, type SearchBlock, type SearchMatch, type TextRun } from './findMatches'

export interface VisualSearchSnapshot {
  open: boolean
  /** Zero-based index of the current match; 0 when there are none. */
  current: number
  total: number
}

export interface VisualSearchHandle {
  /** Opens the box with an empty query. A no-op while it is already open. */
  open: () => void
  /** Closes the box, removes highlights, and returns focus to the document. */
  close: () => void
  setQuery: (query: string) => void
  next: () => void
  previous: () => void
}

interface VisualSearchState {
  open: boolean
  query: string
  matches: SearchMatch[]
  current: number
  decos: DecorationSet
}

type SearchEffect =
  | { type: 'open' }
  | { type: 'query'; query: string }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'close' }

const CLOSED: VisualSearchState = {
  open: false,
  query: '',
  matches: [],
  current: 0,
  decos: DecorationSet.empty
}

/** Block types whose content is rendered by node views rather than
 *  ProseMirror, so inline decorations cannot reach the text (R6). */
const NODE_VIEW_BLOCKS = new Set(['fence', 'code_block', 'math'])

export const visualSearchKey = new PluginKey<VisualSearchState>('mm-visual-search')

/** Concatenates each text block's inline text into runs of adjacent text.
 *  Non-text inline nodes (hard breaks, images) end the current run group, so
 *  a query can never match across them; runs inside one group are adjacent
 *  in the document and concatenate exactly. */
function collectBlocks(doc: PMNode): SearchBlock[] {
  const blocks: SearchBlock[] = []
  doc.descendants((node, pos) => {
    if (!node.isBlock || !node.inlineContent) return !node.isLeaf
    let runs: TextRun[] = []
    const flush = () => {
      if (runs.length) {
        blocks.push({ runs })
        runs = []
      }
    }
    node.forEach((child, offset) => {
      if (child.isText) {
        runs.push({ text: child.text ?? '', from: pos + 1 + offset })
      } else {
        flush()
      }
    })
    flush()
    return false
  })
  return blocks
}

function computeMatches(query: string, doc: PMNode): SearchMatch[] {
  if (query.trim() === '') return []
  return findMatches(query, collectBlocks(doc))
}

/** Builds the decoration set: inline highlights for ProseMirror-rendered
 *  text, and one node-level highlight per code block containing matches. */
function buildDecorations(doc: PMNode, matches: SearchMatch[], current: number): DecorationSet {
  const decos: Decoration[] = []
  const nodeHighlights = new Map<number, 'match' | 'current'>()
  matches.forEach((match, index) => {
    let inNodeView = false
    const $from = doc.resolve(match.from)
    for (let depth = $from.depth; depth > 0; depth--) {
      const ancestor = $from.node(depth)
      if (NODE_VIEW_BLOCKS.has(ancestor.type.name)) {
        const start = $from.before(depth)
        const seen = nodeHighlights.get(start)
        nodeHighlights.set(start, seen === 'current' || index === current ? 'current' : 'match')
        inNodeView = true
        break
      }
    }
    if (!inNodeView) {
      decos.push(
        Decoration.inline(match.from, match.to, {
          class: index === current ? 'mm-search-current' : 'mm-search-match'
        })
      )
    }
  })
  for (const [start, kind] of nodeHighlights) {
    const node = doc.nodeAt(start)
    if (!node) continue
    decos.push(
      Decoration.node(start, start + node.nodeSize, {
        class: kind === 'current' ? 'mm-search-current-node' : 'mm-search-match-node'
      })
    )
  }
  return DecorationSet.create(doc, decos)
}

function stateAfter(
  tr: { doc: PMNode; docChanged: boolean },
  value: VisualSearchState,
  effect: SearchEffect | undefined
): VisualSearchState {
  if (effect) {
    switch (effect.type) {
      case 'open': {
        // Re-opening while open keeps the query (a repeat Ctrl+F must not
        // wipe what the user typed); a fresh open starts empty.
        if (value.open) return value
        return { open: true, query: '', matches: [], current: 0, decos: DecorationSet.empty }
      }
      case 'close':
        return CLOSED
      case 'query': {
        if (!value.open) return value
        const matches = computeMatches(effect.query, tr.doc)
        return {
          open: true,
          query: effect.query,
          matches,
          current: 0,
          decos: buildDecorations(tr.doc, matches, 0)
        }
      }
      case 'next':
      case 'previous': {
        const total = value.matches.length
        if (!value.open || total === 0) return value
        const step = effect.type === 'next' ? 1 : total - 1
        const current = (value.current + step) % total
        return {
          ...value,
          current,
          decos: buildDecorations(tr.doc, value.matches, current)
        }
      }
    }
  }
  if (!value.open) return value
  if (!tr.docChanged) return value
  // Live refresh against the edited document; keep the current match's
  // position in the list, clamped to what still exists.
  const matches = computeMatches(value.query, tr.doc)
  const current = matches.length === 0 ? 0 : Math.min(value.current, matches.length - 1)
  return {
    open: true,
    query: value.query,
    matches,
    current,
    decos: buildDecorations(tr.doc, matches, current)
  }
}

/** Brings the match's rendered DOM into the scroll container's view. Uses the
 *  DOM point when ProseMirror renders the text, and the enclosing node view
 *  element otherwise (code blocks, R6). Best effort only: a race with DOM
 *  teardown must never break editing, so any failure just skips the scroll. */
function revealMatch(view: EditorView, match: SearchMatch): void {
  try {
    const host = view.dom.closest('.editor-host')
    if (!host) return
    const start = view.domAtPos(match.from)
    const end = view.domAtPos(match.to)
    const range = document.createRange()
    range.setStart(start.node, start.offset)
    range.setEnd(end.node, end.offset)
    let rect = range.getBoundingClientRect()
    if (rect.height === 0) {
      // Node-view content: both endpoints collapse onto the node view's own
      // element, so reveal that element instead.
      const element = start.node instanceof Element ? start.node : null
      if (!element) return
      rect = element.getBoundingClientRect()
      if (rect.height === 0) return
    }
    const hostRect = host.getBoundingClientRect()
    const margin = 8
    if (rect.top < hostRect.top) {
      host.scrollTop += rect.top - hostRect.top - margin
    } else if (rect.bottom > hostRect.bottom) {
      host.scrollTop += rect.bottom - hostRect.bottom + margin
    }
    if (rect.left < hostRect.left) {
      host.scrollLeft += rect.left - hostRect.left - margin
    } else if (rect.right > hostRect.right) {
      host.scrollLeft += rect.right - hostRect.right + margin
    }
  } catch {
    // Revealing is cosmetic; positions can race unmounting DOM.
  }
}

/**
 * Create the visual search plugin. `onStateChange` reports snapshots for the
 * panel; pass a stable wrapper reading the latest prop from a ref (as with
 * the spellcheck plugin's `onMenu`).
 */
export function visualSearchPlugin(
  onStateChange: (snapshot: VisualSearchSnapshot) => void
): Plugin<VisualSearchState> {
  const snapshotOf = (state: VisualSearchState): VisualSearchSnapshot => ({
    open: state.open,
    current: state.current,
    total: state.matches.length
  })

  return new Plugin<VisualSearchState>({
    key: visualSearchKey,

    state: {
      init() {
        return CLOSED
      },
      apply(tr, value) {
        const effect = tr.getMeta(visualSearchKey) as SearchEffect | undefined
        return stateAfter(tr, value, effect)
      }
    },

    props: {
      decorations(state) {
        return visualSearchKey.getState(state)?.decos ?? DecorationSet.empty
      }
    },

    view(view) {
      let last = snapshotOf(CLOSED)
      onStateChange(last)

      const maybeReveal = (state: VisualSearchState, previous: VisualSearchState) => {
        if (!state.open || state.matches.length === 0) return
        const began = !previous.open || state.query !== previous.query
        const moved = state.current !== previous.current
        if (!began && !moved) return
        const match = state.matches[state.current]
        if (match) revealMatch(view, match)
      }

      return {
        update(view, prevState) {
          const state = visualSearchKey.getState(view.state)
          if (!state) return
          const previous = visualSearchKey.getState(prevState) ?? CLOSED
          maybeReveal(state, previous)
          const snapshot = snapshotOf(state)
          if (
            snapshot.open !== last.open ||
            snapshot.current !== last.current ||
            snapshot.total !== last.total
          ) {
            last = snapshot
            onStateChange(snapshot)
          }
        },
        destroy() {
          onStateChange({ open: false, current: 0, total: 0 })
        }
      }
    }
  })
}

function dispatchEffect(view: EditorView, effect: SearchEffect): void {
  view.dispatch(view.state.tr.setMeta(visualSearchKey, effect))
}

/** Whether the search box is open for the view's current state. */
export function visualSearchIsOpen(view: EditorView): boolean {
  return visualSearchKey.getState(view.state)?.open ?? false
}

/** Opens the search box. A no-op while it is already open. */
export function openSearch(view: EditorView): void {
  dispatchEffect(view, { type: 'open' })
}

/** Closes the search box. Highlights are removed and the document, its dirty
 *  state, and its undo history are untouched; `refocus` additionally returns
 *  focus to the document after dismissal. */
export function closeSearch(view: EditorView, refocus = false): void {
  dispatchEffect(view, { type: 'close' })
  if (refocus) view.focus()
}

export function setSearchQuery(view: EditorView, query: string): void {
  dispatchEffect(view, { type: 'query', query })
}

export function findNextMatch(view: EditorView): void {
  dispatchEffect(view, { type: 'next' })
}

export function findPreviousMatch(view: EditorView): void {
  dispatchEffect(view, { type: 'previous' })
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Annotation, Compartment, EditorSelection, EditorState } from '@codemirror/state'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { yamlFrontmatter } from '@codemirror/lang-yaml'
import { EditorView } from '@codemirror/view'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import SearchPanel from '../search/SearchPanel'
import {
  closeSourceSearch,
  closeSourceSearchAndRefocus,
  findNextSourceMatch,
  findPreviousSourceMatch,
  openSourceSearch,
  setSourceSearchQuery,
  sourceSearchExtension,
  sourceSearchIsOpen,
  type SourceSearchSnapshot
} from '../search/sourceSearch'

interface SourceViewProps {
  value: string
  onChange: (value: string) => void
  onReturnToFormatted: () => void
  /** Focus the source surface only when this tab is actually visible. */
  isActive: boolean
  spellcheckEnabled: boolean
  wordWrap: boolean
  onWordWrapChange: (enabled: boolean) => void
  selectionAnchor: number
  selectionHead: number
  scrollTop: number
  /** Reveal the seeded caret on first activation instead of applying the
   *  stored scroll; set when the context was mapped from the visual caret. */
  reveal: boolean
  /** Increments to request opening search in this view; null does nothing. */
  findSignal: number | null
  onContextChange: (selectionAnchor: number, selectionHead: number, scrollTop: number) => void
}

const externalContentUpdate = Annotation.define<boolean>()

const wrapCompartment = new Compartment()

// The search box docks just below the source toolbar, with the same gap the
// visual view's panel keeps below the Milkdown top bar.
const SEARCH_PANEL_TOP_PX = 56

const CLOSED_SEARCH: SourceSearchSnapshot = { open: false, current: 0, total: 0 }

function sourceContext(view: EditorView): {
  selectionAnchor: number
  selectionHead: number
  scrollTop: number
} {
  return {
    selectionAnchor: view.state.selection.main.anchor,
    selectionHead: view.state.selection.main.head,
    scrollTop: view.scrollDOM.scrollTop
  }
}

export default function SourceView({
  value,
  onChange,
  onReturnToFormatted,
  isActive,
  spellcheckEnabled,
  wordWrap,
  onWordWrapChange,
  selectionAnchor,
  selectionHead,
  scrollTop,
  reveal,
  findSignal,
  onContextChange
}: SourceViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const frameRef = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  const onContextChangeRef = useRef(onContextChange)
  const wasActiveRef = useRef(isActive)
  const appliedWrapRef = useRef(wordWrap)
  // Consumed once: the reveal belongs to the switch that mapped the context,
  // not to later activations of the same surface.
  const pendingRevealRef = useRef(reveal)
  // Seeded with the mount-time signal: a find request dispatched before this
  // view existed already opened the search box it was meant for (the visual
  // view), and replaying it here would open the source box uninvited.
  const handledFindRef = useRef<number | null>(findSignal)
  const [searchUi, setSearchUi] = useState<SourceSearchSnapshot>(CLOSED_SEARCH)
  onChangeRef.current = onChange
  onContextChangeRef.current = onContextChange

  useEffect(() => {
    if (!hostRef.current) return
    // Re-arm from the mount-time prop: StrictMode's discarded first mount
    // consumes the reveal otherwise, losing it for the real surface in dev.
    pendingRevealRef.current = reveal

    const captureContext = (view: EditorView) => {
      // While the search box is open, every keystroke moves the selection and
      // scroll position; capturing then would re-render the whole app per
      // keystroke, and the explorer's row focus effect would steal the panel
      // input's focus. The context is captured once on close, deactivation,
      // or the next non-search event, so nothing is lost.
      if (sourceSearchIsOpen(view)) return
      const context = sourceContext(view)
      onContextChangeRef.current(context.selectionAnchor, context.selectionHead, context.scrollTop)
    }
    // Scroll events fire per frame while scrolling; each context capture
    // dispatches a store update that re-renders the whole app, so they are
    // coalesced to one capture per animation frame (last value wins).
    const scheduleContextCapture = (view: EditorView) => {
      if (frameRef.current !== null) return
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null
        captureContext(view)
      })
    }
    const state = EditorState.create({
      doc: value,
      selection: EditorSelection.single(selectionAnchor, selectionHead),
      extensions: [
        yamlFrontmatter({ content: markdown() }),
        syntaxHighlighting(defaultHighlightStyle),
        wrapCompartment.of(wordWrap ? EditorView.lineWrapping : []),
        EditorView.contentAttributes.of({
          'aria-label': 'Markdown source',
          class: 'source-textarea',
          'data-testid': 'source-textarea',
          spellcheck: String(spellcheckEnabled)
        }),
        sourceSearchExtension(setSearchUi),
        EditorView.updateListener.of((update) => {
          const isExternalUpdate = update.transactions.some((transaction) =>
            transaction.annotation(externalContentUpdate)
          )
          if (update.docChanged && !isExternalUpdate)
            onChangeRef.current(update.state.doc.toString())
          if (update.selectionSet) captureContext(update.view)
        })
      ]
    })
    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view
    if (!pendingRevealRef.current) view.scrollDOM.scrollTop = scrollTop
    view.scrollDOM.addEventListener('scroll', () => scheduleContextCapture(view), { passive: true })

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      captureContext(view)
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.contentDOM.spellcheck = spellcheckEnabled
  }, [spellcheckEnabled])

  useEffect(() => {
    const view = viewRef.current
    if (!view || appliedWrapRef.current === wordWrap) return
    appliedWrapRef.current = wordWrap
    view.dispatch({ effects: wrapCompartment.reconfigure(wordWrap ? EditorView.lineWrapping : []) })
  }, [wordWrap])

  useEffect(() => {
    const view = viewRef.current
    if (!view || view.state.doc.toString() === value) return
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
      annotations: externalContentUpdate.of(true)
    })
  }, [value])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (isActive) {
      const length = view.state.doc.length
      const anchor = Math.min(selectionAnchor, length)
      const head = Math.min(selectionHead, length)
      view.dispatch({ selection: EditorSelection.single(anchor, head) })
      if (pendingRevealRef.current) {
        pendingRevealRef.current = false
        view.dispatch({ scrollIntoView: true })
      } else {
        view.scrollDOM.scrollTop = scrollTop
      }
      view.focus()
    } else if (wasActiveRef.current) {
      // Search state never carries across tab switches (FR-014): the close
      // dispatches a state-only transaction and must not steal focus.
      if (sourceSearchIsOpen(view)) closeSourceSearch(view)
      const context = sourceContext(view)
      onContextChange(context.selectionAnchor, context.selectionHead, context.scrollTop)
    }
    wasActiveRef.current = isActive
  }, [isActive])

  useEffect(() => {
    if (findSignal == null || handledFindRef.current === findSignal) return
    // Consumed, not deferred: find is a no-op on a background tab.
    handledFindRef.current = findSignal
    const view = viewRef.current
    if (isActive && view) openSourceSearch(view)
  }, [findSignal, isActive])

  const handleOpenSearch = useCallback(() => {
    const view = viewRef.current
    if (view) openSourceSearch(view)
  }, [])
  const handleSearchQuery = useCallback((query: string) => {
    const view = viewRef.current
    if (view) setSourceSearchQuery(view, query)
  }, [])
  const handleSearchNext = useCallback(() => {
    const view = viewRef.current
    if (view) findNextSourceMatch(view)
  }, [])
  const handleSearchPrevious = useCallback(() => {
    const view = viewRef.current
    if (view) findPreviousSourceMatch(view)
  }, [])
  const handleSearchClose = useCallback(() => {
    const view = viewRef.current
    if (view) closeSourceSearchAndRefocus(view)
  }, [])

  return (
    <div
      className="source-view"
      data-testid="source-view"
      role="region"
      aria-label="Markdown source"
    >
      <div className="source-toolbar">
        <button
          type="button"
          className="source-return"
          title="Back to visual editing"
          aria-label="Back to visual editing"
          onClick={onReturnToFormatted}
        >
          ← Visual Editing
        </button>
        <button
          type="button"
          className="source-find"
          title="Find in source (Ctrl+F)"
          aria-label="Find in source"
          data-testid="source-find-button"
          onClick={handleOpenSearch}
        >
          <MagnifyingGlassIcon aria-hidden="true" />
        </button>
        <label className="source-word-wrap">
          <input
            type="checkbox"
            data-testid="source-word-wrap"
            checked={wordWrap}
            onChange={() => onWordWrapChange(!wordWrap)}
          />
          Word Wrap
        </label>
      </div>
      <div ref={hostRef} className="source-editor-host" />
      {searchUi.open && (
        <SearchPanel
          current={searchUi.current}
          total={searchUi.total}
          dockTop={SEARCH_PANEL_TOP_PX}
          onQueryChange={handleSearchQuery}
          onNext={handleSearchNext}
          onPrevious={handleSearchPrevious}
          onClose={handleSearchClose}
        />
      )}
    </div>
  )
}

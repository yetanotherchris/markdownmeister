import { useEffect, useRef } from 'react'
import { Annotation, Compartment, EditorSelection, EditorState } from '@codemirror/state'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { markdown } from '@codemirror/lang-markdown'
import { yamlFrontmatter } from '@codemirror/lang-yaml'
import { EditorView } from '@codemirror/view'

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
  onContextChange: (selectionAnchor: number, selectionHead: number, scrollTop: number) => void
}

const externalContentUpdate = Annotation.define<boolean>()

const wrapCompartment = new Compartment()

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
  onContextChange
}: SourceViewProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const frameRef = useRef<number | null>(null)
  const onChangeRef = useRef(onChange)
  const onContextChangeRef = useRef(onContextChange)
  const wasActiveRef = useRef(isActive)
  const appliedWrapRef = useRef(wordWrap)
  onChangeRef.current = onChange
  onContextChangeRef.current = onContextChange

  useEffect(() => {
    if (!hostRef.current) return

    const captureContext = (view: EditorView) => {
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
    view.scrollDOM.scrollTop = scrollTop
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
      view.scrollDOM.scrollTop = scrollTop
      view.focus()
    } else if (wasActiveRef.current) {
      const context = sourceContext(view)
      onContextChange(context.selectionAnchor, context.selectionHead, context.scrollTop)
    }
    wasActiveRef.current = isActive
  }, [isActive])

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
          className="source-word-wrap"
          data-testid="source-word-wrap"
          title="Word Wrap"
          aria-pressed={wordWrap}
          onClick={() => onWordWrapChange(!wordWrap)}
        >
          Word Wrap
        </button>
      </div>
      <div ref={hostRef} className="source-editor-host" />
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Crepe } from '@milkdown/crepe'
import type { DocumentState } from '../state/documents'
import { instancePool } from './instancePool'
import { joinFrontmatter } from '../domain/frontmatter'
import CrepeHost, { type CursorState } from './CrepeHost'
import type { SpellingMenuState } from './spellcheckPlugin'
import type { MarkdownSyntaxOptions } from './markdownSyntaxOptions'
import SearchPanel from '../search/SearchPanel'
import type { VisualSearchHandle, VisualSearchSnapshot } from '../search/visualSearch'
import SourceView from './SourceView'
import './editor.css'

/** Requests opening search in the document with `id`; `seq` increments so a
 *  repeated request is distinguishable from the previous one. */
export interface FindRequest {
  id: string
  seq: number
}

interface EditorPanelProps {
  document: DocumentState
  isActive: boolean
  markdownOptions: MarkdownSyntaxOptions
  spellcheckEnabled: boolean
  wordWrap: boolean
  onWordWrapChange: (enabled: boolean) => void
  onSpellingMenu: (menu: SpellingMenuState | null) => void
  onContentChange: (id: string, content: string) => void
  onBaselineCapture: (id: string, baseline: string) => void
  onStagedEditorReady: (id: string) => void
  onCursorState: (id: string, cursorOffset: number, scrollTop: number) => void
  onSourceContext: (
    id: string,
    selectionAnchor: number,
    selectionHead: number,
    scrollTop: number
  ) => void
  onCursorSyncApplied: (id: string) => void
  onRequestViewSource: (id: string) => void
  onReturnToFormatted: (id: string) => void
  findRequest: FindRequest | null
}

interface DocumentHostProps extends Omit<
  EditorPanelProps,
  'document' | 'isActive' | 'onStagedEditorReady'
> {
  document: DocumentState
  isActive: boolean
  staged?: boolean
  onStagedEditorReady?: (id: string) => void
}

function DocumentHost({
  document,
  isActive,
  staged = false,
  markdownOptions,
  spellcheckEnabled,
  wordWrap,
  onWordWrapChange,
  onSpellingMenu,
  onContentChange,
  onBaselineCapture,
  onStagedEditorReady,
  onCursorState,
  onSourceContext,
  onCursorSyncApplied,
  onRequestViewSource,
  onReturnToFormatted,
  findRequest
}: DocumentHostProps) {
  const inSource = !staged && document.view === 'source'
  const searchHandleRef = useRef<VisualSearchHandle | null>(null)
  const [searchUi, setSearchUi] = useState<VisualSearchSnapshot>({
    open: false,
    current: 0,
    total: 0
  })
  const handleSearchState = useCallback(
    (snapshot: VisualSearchSnapshot) => setSearchUi(snapshot),
    []
  )
  // Find requests target one document by id; only the matching host opens
  // its box. The signal value (not just identity) gates re-runs.
  const findSignal = findRequest && findRequest.id === document.id ? findRequest.seq : null
  useEffect(() => {
    if (findSignal == null) return
    searchHandleRef.current?.open()
  }, [findSignal])
  const handleMarkdownUpdated = useCallback(
    (markdown: string) => onContentChange(document.id, markdown),
    [document.id, onContentChange]
  )
  const handleBaselineCapture = useCallback(
    (baseline: string, docRef: unknown) => {
      instancePool.setBaselineDoc(document.id, docRef)
      onBaselineCapture(document.id, baseline)
    },
    [document.id, onBaselineCapture]
  )
  const handleCursorState = useCallback(
    (cursor: CursorState) => onCursorState(document.id, cursor.cursorOffset, cursor.scrollTop),
    [document.id, onCursorState]
  )
  const handleReady = useCallback(
    (crepe: Crepe) => {
      instancePool.register(document.id, crepe)
      if (staged) onStagedEditorReady?.(document.id)
    },
    [document.id, onStagedEditorReady, staged]
  )
  const handleSourceContext = useCallback(
    (selectionAnchor: number, selectionHead: number, scrollTop: number) => {
      onSourceContext(document.id, selectionAnchor, selectionHead, scrollTop)
    },
    [document.id, onSourceContext]
  )
  const handleCursorSyncApplied = useCallback(() => {
    onCursorSyncApplied(document.id)
  }, [document.id, onCursorSyncApplied])
  // The source overlay is anchored at this container's content origin, so a
  // scroll offset retained from the formatted view displaces it out of the
  // viewport and exposes the inert visual editor. Child effects run first, so
  // CrepeHost's leave-capture records the formatted scroll before this reset.
  const hostRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!inSource) return
    hostRef.current?.scrollTo(0, 0)
  }, [inSource])

  if (document.editorState === 'evicted') return <div className="editor-host evicted" />

  return (
    <>
      <div
        ref={hostRef}
        className={`editor-host${inSource ? ' has-source' : ''}${staged ? ' staged' : ''}`}
        style={{ visibility: isActive && !staged ? 'visible' : 'hidden' }}
        aria-hidden={staged || undefined}
      >
        <CrepeHost
          key={`${document.id}-v${document.contentVersion}`}
          defaultValue={document.content}
          active={isActive && !inSource && !staged}
          locked={inSource || staged}
          markdownOptions={markdownOptions}
          onSpellingMenu={onSpellingMenu}
          restoreCursor={{ cursorOffset: document.cursorOffset, scrollTop: document.scrollTop }}
          cursorSync={document.cursorSync}
          onCursorSyncApplied={handleCursorSyncApplied}
          onMarkdownUpdated={handleMarkdownUpdated}
          onReady={handleReady}
          onBaselineCapture={handleBaselineCapture}
          onCursorState={handleCursorState}
          onRequestViewSource={() => onRequestViewSource(document.id)}
          searchHandleRef={searchHandleRef}
          onSearchState={handleSearchState}
          findSignal={findSignal}
        />
        {inSource && (
          <SourceView
            value={joinFrontmatter(document.frontmatter, document.content)}
            onChange={(content) => onContentChange(document.id, content)}
            onReturnToFormatted={() => onReturnToFormatted(document.id)}
            isActive={isActive}
            spellcheckEnabled={spellcheckEnabled}
            wordWrap={wordWrap}
            onWordWrapChange={onWordWrapChange}
            selectionAnchor={document.sourceSelectionAnchor}
            selectionHead={document.sourceSelectionHead}
            scrollTop={document.sourceScrollTop}
            reveal={document.sourceSeed?.reveal ?? false}
            onContextChange={handleSourceContext}
          />
        )}
      </div>
      {isActive && !inSource && !staged && searchUi.open && (
        <SearchPanel
          current={searchUi.current}
          total={searchUi.total}
          onQueryChange={(query) => searchHandleRef.current?.setQuery(query)}
          onNext={() => searchHandleRef.current?.next()}
          onPrevious={() => searchHandleRef.current?.previous()}
          onClose={() => searchHandleRef.current?.close()}
        />
      )}
    </>
  )
}

export default function EditorPanel(props: EditorPanelProps) {
  const { document, onStagedEditorReady, ...hostProps } = props
  const staged = document.pendingReplacement
  return (
    <>
      <DocumentHost key={document.id} document={document} {...hostProps} />
      {staged && (
        <DocumentHost
          key={staged.id}
          document={staged}
          {...hostProps}
          isActive={false}
          staged
          onStagedEditorReady={onStagedEditorReady}
        />
      )}
    </>
  )
}

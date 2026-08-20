import { useCallback } from 'react'
import type { Crepe } from '@milkdown/crepe'
import type { DocumentState } from '../state/documents'
import { instancePool } from './instancePool'
import { joinFrontmatter } from '../domain/frontmatter'
import CrepeHost, { type CursorState } from './CrepeHost'
import type { SpellingMenuState } from './spellcheckPlugin'
import type { MarkdownSyntaxOptions } from './markdownSyntaxOptions'
import SourceView from './SourceView'
import './editor.css'

interface EditorPanelProps {
  document: DocumentState
  isActive: boolean
  markdownOptions: MarkdownSyntaxOptions
  spellcheckEnabled: boolean
  onSpellingMenu: (menu: SpellingMenuState | null) => void
  onContentChange: (id: string, content: string) => void
  onBaselineCapture: (id: string, baseline: string) => void
  onStagedEditorReady: (id: string) => void
  onCursorState: (id: string, cursorOffset: number, scrollTop: number) => void
  onSourceContext: (id: string, selectionAnchor: number, selectionHead: number, scrollTop: number) => void
  onRequestViewSource: (id: string) => void
  onReturnToFormatted: (id: string) => void
}

interface DocumentHostProps extends Omit<EditorPanelProps, 'document' | 'isActive' | 'onStagedEditorReady'> {
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
  onSpellingMenu,
  onContentChange,
  onBaselineCapture,
  onStagedEditorReady,
  onCursorState,
  onSourceContext,
  onRequestViewSource,
  onReturnToFormatted
}: DocumentHostProps) {
  const inSource = !staged && document.view === 'source'
  const handleMarkdownUpdated = useCallback(
    (markdown: string) => onContentChange(document.id, markdown),
    [document.id, onContentChange]
  )
  const handleBaselineCapture = useCallback(
    (baseline: string, docRef: unknown) => {
      // Spec 033 (contract C2): record the parsed document's identity so the
      // dirty fast path can prove "untouched since baseline" without
      // serializing. Cleared by the pool on removal and on save.
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

  if (document.editorState === 'evicted') return <div className="editor-host evicted" />

  return (
    <div
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
        onMarkdownUpdated={handleMarkdownUpdated}
        onReady={handleReady}
        onBaselineCapture={handleBaselineCapture}
        onCursorState={handleCursorState}
        onRequestViewSource={() => onRequestViewSource(document.id)}
      />
      {inSource && (
        <SourceView
          value={joinFrontmatter(document.frontmatter, document.content)}
          onChange={(content) => onContentChange(document.id, content)}
          onReturnToFormatted={() => onReturnToFormatted(document.id)}
          isActive={isActive}
          spellcheckEnabled={spellcheckEnabled}
          selectionAnchor={document.sourceSelectionAnchor}
          selectionHead={document.sourceSelectionHead}
          scrollTop={document.sourceScrollTop}
          onContextChange={handleSourceContext}
        />
      )}
    </div>
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

import { useCallback } from 'react'
import type { DocumentsAction, EditingSession } from '../state/documents'
import { editorMatchesContent } from '../state/documents'
import { joinFrontmatter } from '../domain/frontmatter'
import {
  planReturnRestore,
  planSourceSeed,
  type SourceSeed
} from '../domain/caretSync'
import { instancePool } from '../editor/instancePool'
import type { DocumentSessionApi } from './useDocumentSession'

export interface SourceViewToggleApi {
  handleShowSource: (id: string) => void
  handleReturnToFormatted: (id: string) => void
  openPathInSource: (path: string) => Promise<string | null>
  handleViewSource: (path: string) => void
  openPathInFormatted: (path: string) => Promise<void>
  handleOpen: (path: string) => void
}

export function useSourceViewToggle(opts: {
  dispatch: React.Dispatch<DocumentsAction>
  sessionRef: React.MutableRefObject<EditingSession>
  session: Pick<
    DocumentSessionApi,
    | 'flushLiveContent'
    | 'captureContentForSwitch'
    | 'getLiveContent'
    | 'isDirtyLive'
    | 'handleActivate'
    | 'handleNew'
    | 'openFileFromExplorer'
  >
  enforcePoolCap: (activeId: string | null) => void
}): SourceViewToggleApi {
  const { dispatch, sessionRef, session, enforcePoolCap } = opts
  const { flushLiveContent, captureContentForSwitch, getLiveContent, openFileFromExplorer } =
    session

  /** Records the context the source view is about to open with. When the
   *  live editor's caret resolves to a block of the displayed text (the
   *  counts must correlate), the seed is the mapped line start and the
   *  destination reveals it; otherwise the stored context is kept and the
   *  switch behaves exactly as before. */
  const seedSourceContext = useCallback(
    (id: string, displayedText: string | null): void => {
      const doc = sessionRef.current.documents.find((d) => d.id === id)
      if (!doc) return
      const effectiveText =
        displayedText ?? joinFrontmatter(doc.frontmatter, doc.content)
      const geometry = displayedText ? instancePool.getSelectionGeometry(id) : null
      const mapped =
        displayedText && geometry
          ? planSourceSeed({
              displayedText,
              childSizes: geometry.childSizes,
              caretOffset: geometry.caretOffset
            })
          : null
      const seed: SourceSeed = mapped ?? {
        anchor: doc.sourceSelectionAnchor,
        head: doc.sourceSelectionHead,
        reveal: false,
        textLength: effectiveText.length
      }
      dispatch({
        type: 'SEED_SOURCE_CONTEXT',
        payload: {
          id,
          selectionAnchor: mapped ? mapped.anchor : doc.sourceSelectionAnchor,
          selectionHead: mapped ? mapped.head : doc.sourceSelectionHead,
          scrollTop: doc.sourceScrollTop,
          seed
        }
      })
    },
    [dispatch, sessionRef]
  )

  const handleShowSource = useCallback(
    (id: string) => {
      flushLiveContent()
      // Capture synchronously before the lock: edits inside the listener
      // debounce window would otherwise be dropped, not deferred.
      const displayed = captureContentForSwitch(id)
      seedSourceContext(id, displayed)
      dispatch({ type: 'SET_VIEW', payload: { id, view: 'source' } })
    },
    [dispatch, flushLiveContent, captureContentForSwitch, seedSourceContext]
  )

  const handleReturnToFormatted = useCallback(
    (id: string) => {
      const doc = sessionRef.current.documents.find((d) => d.id === id)
      if (!doc) return
      let live: string | null
      try {
        live = getLiveContent(doc)
      } catch (error) {
        // Serialisation can throw on documents containing nodes the active
        // processor cannot express. Falling back to the stored bytes keeps the
        // return to formatted editing from stranding the tab in source view.
        console.error('Live content capture failed before returning to formatted editing', error)
        live = null
      }
      // editorMatchesContent (not markdownSame) decides the no-op round trip:
      // only the editor's single appended trailing newline is "unchanged", so a
      // blank line typed at EOF in source is not silently dropped, while a
      // pristine file that Crepe merely normalized still skips the remount.
      // The comparison is against the BODY (`content`), frontmatter changes
      // alone leave the body untouched, so they do not force a remount.
      const edited = live === null || !editorMatchesContent(live, doc.content)
      const displayed = joinFrontmatter(doc.frontmatter, doc.content)
      const seed = doc.sourceSeed ?? null
      // A source edit is a change to the text the session opened with. The
      // editor normalizing unchanged bytes also trips the refresh decision
      // above, but that is not an edit and must not map the caret.
      const sourceEdited = seed ? displayed.length !== seed.textLength : edited
      // A null plan covers both exact-restore cases: an untouched caret, and
      // a mapping that found nothing confident to map to. Positioning only;
      // content, dirty, and undo are untouched by the seed comparison.
      const plan = planReturnRestore({
        seed,
        finalAnchor: doc.sourceSelectionAnchor,
        finalHead: doc.sourceSelectionHead,
        edited: sourceEdited,
        displayedText: displayed
      })
      if (plan) {
        dispatch({
          type: 'PRIME_VISUAL_CARET',
          payload: { id, blockIndex: plan.blockIndex, blockCount: plan.blockCount }
        })
      }
      if (edited) {
        instancePool.clearBaselineDoc(id)
        dispatch({ type: 'REFRESH_FROM_SOURCE', payload: { id, content: displayed } })
      }
      dispatch({ type: 'SET_VIEW', payload: { id, view: 'formatted' } })
    },
    [dispatch, getLiveContent, sessionRef]
  )

  const openPathInSource = useCallback(
    async (path: string): Promise<string | null> => {
      const existing = sessionRef.current.documents.find(
        (d) => d.path === path && d.editorState !== 'evicted'
      )
      if (existing) {
        session.handleActivate(existing.id)
        if (existing.view !== 'source') {
          flushLiveContent()
          const displayed = captureContentForSwitch(existing.id)
          seedSourceContext(existing.id, displayed)
          dispatch({ type: 'SET_VIEW', payload: { id: existing.id, view: 'source' } })
        }
        enforcePoolCap(existing.id)
        return existing.id
      }
      const read = await window.api.readFile(path)
      if (!read.ok) return null
      dispatch({ type: 'OPEN_EXISTING', payload: { value: { ...read.value, view: 'source' } } })
      // The freshly opened tab's editor registers on mount, so it is the newest
      // LRU entry and cannot be evicted here. sessionRef.current.activeId is
      // still the pre-dispatch document, passing it only protects the tab that
      // is visible right now, which is the intent.
      enforcePoolCap(sessionRef.current.activeId)
      return read.value.path ?? read.value.name
    },
    [dispatch, enforcePoolCap, flushLiveContent, captureContentForSwitch, seedSourceContext, sessionRef, session]
  )

  const handleViewSource = useCallback(
    (path: string) => {
      void openPathInSource(path)
    },
    [openPathInSource]
  )

  const openPathInFormatted = useCallback(
    async (path: string): Promise<void> => {
      const existing = sessionRef.current.documents.find(
        (d) => d.path === path && d.editorState !== 'evicted'
      )
      if (existing) {
        session.handleActivate(existing.id)
        if (existing.view === 'source') {
          handleReturnToFormatted(existing.id)
        }
        enforcePoolCap(existing.id)
        return
      }
      const read = await window.api.readFile(path)
      if (!read.ok) return
      openFileFromExplorer({ ...read.value, view: 'formatted' })
    },
    [openFileFromExplorer, sessionRef, session]
  )

  const handleOpen = useCallback(
    (path: string) => {
      void openPathInFormatted(path)
    },
    [openPathInFormatted]
  )

  return {
    handleShowSource,
    handleReturnToFormatted,
    openPathInSource,
    handleViewSource,
    openPathInFormatted,
    handleOpen
  }
}

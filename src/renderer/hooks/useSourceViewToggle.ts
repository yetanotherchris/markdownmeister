import { useCallback } from 'react'
import type { DocumentsAction, EditingSession } from '../state/documents'
import { editorMatchesContent } from '../state/documents'
import { joinFrontmatter } from '../domain/frontmatter'
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
  session: Pick<DocumentSessionApi, 'flushLiveContent' | 'getLiveContent' | 'isDirtyLive' | 'handleActivate' | 'handleNew' | 'openFileFromExplorer'>
  enforcePoolCap: (activeId: string | null) => void
}): SourceViewToggleApi {
  const { dispatch, sessionRef, session, enforcePoolCap } = opts
  const { flushLiveContent, getLiveContent, openFileFromExplorer } = session

  const handleShowSource = useCallback(
    (id: string) => {
      flushLiveContent()
      dispatch({ type: 'SET_VIEW', payload: { id, view: 'source' } })
    },
    [dispatch, flushLiveContent]
  )

  const handleReturnToFormatted = useCallback(
    (id: string) => {
      const doc = sessionRef.current.documents.find(d => d.id === id)
      if (!doc) return
      const live = getLiveContent(doc)
      // editorMatchesContent (not markdownSame) decides the no-op round trip:
      // only the editor's single appended trailing newline is "unchanged", so a
      // blank line typed at EOF in source is not silently dropped, while a
      // pristine file that Crepe merely normalized still skips the remount.
      // The comparison is against the BODY (`content`), frontmatter changes
      // alone leave the body untouched, so they do not force a remount.
      if (live === null || !editorMatchesContent(live, doc.content)) {
        instancePool.clearBaselineDoc(id)
        dispatch({
          type: 'REFRESH_FROM_SOURCE',
          payload: { id, content: joinFrontmatter(doc.frontmatter, doc.content) }
        })
      }
      dispatch({ type: 'SET_VIEW', payload: { id, view: 'formatted' } })
    },
    [dispatch, getLiveContent, sessionRef]
  )

  const openPathInSource = useCallback(
    async (path: string): Promise<string | null> => {
      const existing = sessionRef.current.documents.find(
        d => d.path === path && d.editorState !== 'evicted'
      )
      if (existing) {
        session.handleActivate(existing.id)
        if (existing.view !== 'source') {
          flushLiveContent()
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
    [dispatch, enforcePoolCap, flushLiveContent, sessionRef, session]
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
        d => d.path === path && d.editorState !== 'evicted'
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

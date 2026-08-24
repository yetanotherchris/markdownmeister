import { useCallback } from 'react'
import type { DocumentsAction, EditingSession, DocumentState } from '../state/documents'
import { instancePool } from '../editor/instancePool'

export interface EditorPoolApi {
  enforcePoolCap: (activeId: string | null) => void
}


export function useEditorPool(opts: {
  dispatch: React.Dispatch<DocumentsAction>
  sessionRef: React.MutableRefObject<EditingSession>
  isDirtyLive: (doc: DocumentState) => boolean
}): EditorPoolApi {
  const { dispatch, sessionRef, isDirtyLive } = opts

  const enforcePoolCap = useCallback((activeId: string | null) => {
    if (instancePool.hasSpace()) return
    const current = sessionRef.current
    const evictId = instancePool.evictLRU(
      current.documents.filter(d => isDirtyLive(d)),
      activeId
    )
    if (evictId) {
      // evictLRU only returns clean documents, so the store already holds the
      // authoritative content, nothing to capture. Drop the entry and mark the
      // document evicted; the next activate remounts from the stored bytes.
      instancePool.remove(evictId)
      dispatch({ type: 'EVICT', payload: { id: evictId } })
    }
  }, [dispatch, sessionRef, isDirtyLive])

  return { enforcePoolCap }
}

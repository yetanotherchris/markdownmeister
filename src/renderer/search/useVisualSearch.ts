import { useCallback, useEffect, useRef, useState } from 'react'
import type { VisualSearchHandle, VisualSearchSnapshot } from './visualSearch'

/** Requests opening search in the document with `id`; `seq` increments so a
 *  repeated request is distinguishable from the previous one. */
export interface FindRequest {
  id: string
  seq: number
}

const CLOSED_SEARCH: VisualSearchSnapshot = { open: false, current: 0, total: 0 }

/** Per-document wiring between the React panel and the editor's search
 *  plugin: holds the imperative handle and the live snapshot, and opens the
 *  box when a find request targets this document. `searchable` is whether
 *  this host is the active visual editing surface; the panel renders only
 *  when the box is open and the host is searchable. */
export function useVisualSearch(
  documentId: string,
  findRequest: FindRequest | null,
  searchable: boolean
) {
  const searchHandleRef = useRef<VisualSearchHandle | null>(null)
  const [searchUi, setSearchUi] = useState<VisualSearchSnapshot>(CLOSED_SEARCH)
  const onSearchState = useCallback((snapshot: VisualSearchSnapshot) => setSearchUi(snapshot), [])
  // Find requests target one document by id; only the matching host opens
  // its box. The signal value (not just identity) gates re-runs.
  const findSignal = findRequest && findRequest.id === documentId ? findRequest.seq : null
  useEffect(() => {
    if (findSignal == null) return
    searchHandleRef.current?.open()
  }, [findSignal])

  return {
    searchHandleRef,
    onSearchState,
    findSignal,
    panel:
      searchable && searchUi.open ? { current: searchUi.current, total: searchUi.total } : null,
    setQuery: (query: string) => searchHandleRef.current?.setQuery(query),
    next: () => searchHandleRef.current?.next(),
    previous: () => searchHandleRef.current?.previous(),
    close: () => searchHandleRef.current?.close()
  }
}

import { useCallback, useRef, useState } from 'react'
import type { VisualSearchHandle, VisualSearchSnapshot } from './visualSearch'
import type { FindRequest, FindSignal } from './findRequest'

const CLOSED_SEARCH: VisualSearchSnapshot = {
  open: false,
  replaceOpen: false,
  current: 0,
  total: 0
}

/** Per-document wiring between the React panel and the editor's search
 *  plugin: holds the imperative handle and the live snapshot. Find requests
 *  are targeted per document via `findSignal` and dispatched by whichever
 *  editing surface owns that document's view: CrepeHost opens the visual
 *  box; SourceView consumes the same signal for its own search. */
export function useVisualSearch(
  documentId: string,
  findRequest: FindRequest | null,
  searchable: boolean
) {
  const searchHandleRef = useRef<VisualSearchHandle | null>(null)
  const [searchUi, setSearchUi] = useState<VisualSearchSnapshot>(CLOSED_SEARCH)
  const onSearchState = useCallback((snapshot: VisualSearchSnapshot) => setSearchUi(snapshot), [])
  const findSignal: FindSignal | null =
    findRequest && findRequest.id === documentId
      ? { seq: findRequest.seq, replace: findRequest.replace === true }
      : null

  return {
    searchHandleRef,
    onSearchState,
    findSignal,
    panel:
      searchable && searchUi.open
        ? {
            current: searchUi.current,
            total: searchUi.total,
            replaceOpen: searchUi.replaceOpen
          }
        : null,
    setQuery: (query: string) => searchHandleRef.current?.setQuery(query),
    next: () => searchHandleRef.current?.next(),
    previous: () => searchHandleRef.current?.previous(),
    close: () => searchHandleRef.current?.close(),
    setReplaceOpen: (open: boolean) => searchHandleRef.current?.setReplaceOpen(open),
    setReplacement: (text: string) => searchHandleRef.current?.setReplacement(text),
    replaceCurrent: () => searchHandleRef.current?.replaceCurrent(),
    replaceAll: () => searchHandleRef.current?.replaceAll()
  }
}

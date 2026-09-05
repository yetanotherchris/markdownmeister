import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SearchContentResult } from '../../shared/ipc-contract'
import type { TreeNode } from '../state/workspace'
import { mergeSearchSections, nameMatchSections } from '../explorer/searchResultModel'
import type { SearchSection } from '../explorer/searchResultModel'

const DEBOUNCE_MS = 250
/** Must match the main-process term length limit. */
const MAX_TERM_LENGTH = 200

export interface SearchResultsApi {
  /** The merged, sorted sections for the active term (empty when not
   *  filtering or before a scan settles). */
  sections: SearchSection[]
  /** True once the content scan for the current term has settled, so the
   *  empty state only shows after the results are known. */
  settled: boolean
}

/**
 * Debounced content search over the whole workspace (run in main), merged with
 * name matches from the loaded tree data into the results-view sections. The
 * search is read-only and the tree is never modified, so clearing the term
 * restores the tree exactly.
 */
export function useSearchResults(opts: {
  searchTerm: string
  workspaceRoot: string | null
  nodes: TreeNode[]
}): SearchResultsApi {
  const { searchTerm, workspaceRoot, nodes } = opts
  const [contentResults, setContentResults] = useState<SearchContentResult[]>([])
  const [settled, setSettled] = useState(true)
  const seqRef = useRef(0)

  useEffect(() => {
    seqRef.current += 1
    setContentResults([])
    setSettled(true)
  }, [workspaceRoot])

  useEffect(() => {
    const term = searchTerm.trim()
    const seq = ++seqRef.current
    // Matches from a previous term never linger while the new term's scan is
    // in flight; the settled flag keeps the empty state quiet until it lands.
    setContentResults([])
    if (term === '') {
      setSettled(true)
      return
    }
    setSettled(false)
    // A term longer than the main-process limit never reaches the scan; it
    // simply yields no content matches instead of surfacing an error.
    if (term.length > MAX_TERM_LENGTH) {
      setSettled(true)
      return
    }
    const timer = setTimeout(() => {
      window.api.searchContents(term).then(
        (res) => {
          // Drop stale responses: a newer keystroke owns the result.
          if (seq !== seqRef.current) return
          if (res.ok) setContentResults(res.value)
          setSettled(true)
        },
        () => {
          if (seq === seqRef.current) setSettled(true)
        }
      )
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchTerm, workspaceRoot])

  const nameSections = useCallback(() => nameMatchSections(nodes, searchTerm), [nodes, searchTerm])
  const allSections = useMemo(
    () => mergeSearchSections(nameSections(), contentResults),
    [nameSections, contentResults]
  )
  const filtering = searchTerm.trim() !== ''

  return { sections: filtering ? allSections : [], settled: !filtering || settled }
}

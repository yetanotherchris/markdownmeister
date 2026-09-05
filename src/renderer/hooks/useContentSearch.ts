import { useCallback, useEffect, useRef, useState } from 'react'
import type { WorkspaceAction, WorkspaceState } from '../state/workspace'
import { findNodeById } from '../state/workspace'
import { ancestorDirectories, contentMatchSet } from '../explorer/contentSearch'

const DEBOUNCE_MS = 250

export interface ContentSearchApi {
  /** Node ids whose contents matched the active term (FR-001). */
  contentMatchIds: Set<string>
  /** True once the content scan for the current term has settled (R5): the
   *  empty state must wait for it so a term that will match content does not
   *  flash "No files match" while the debounced scan is in flight. */
  contentSearchIdle: boolean
}

/**
 * Debounced content search over the whole workspace (run in main). The scan is
 * read-only; the only side effect is loading the ancestor folders of matched
 * files into the workspace tree so the matched nodes exist to be displayed
 * (R3), the same non-destructive expansion a user click performs.
 */
export function useContentSearch(opts: {
  searchTerm: string
  workspaceRoot: string | null
  dispatchWorkspace: React.Dispatch<WorkspaceAction>
  workspaceRef: React.MutableRefObject<WorkspaceState>
}): ContentSearchApi {
  const { searchTerm, workspaceRoot, dispatchWorkspace, workspaceRef } = opts
  const [contentMatchIds, setContentMatchIds] = useState<Set<string>>(new Set())
  const [contentSearchIdle, setContentSearchIdle] = useState(true)
  const seqRef = useRef(0)

  useEffect(() => {
    seqRef.current += 1
    setContentMatchIds(new Set())
    setContentSearchIdle(true)
  }, [workspaceRoot])

  const loadAncestors = useCallback(
    async (paths: string[]) => {
      for (const filePath of paths) {
        for (const dir of ancestorDirectories(filePath)) {
          const node = findNodeById(workspaceRef.current.nodes, dir)
          if (!node || node.kind !== 'directory') continue
          if (node.loadState === 'loaded' || node.loadState === 'loading') continue
          dispatchWorkspace({ type: 'EXPAND_START', payload: { id: dir } })
          const res = await window.api.readDir(dir)
          if (res.ok) {
            dispatchWorkspace({ type: 'EXPAND_SUCCESS', payload: { id: dir, entries: res.value } })
          } else {
            dispatchWorkspace({ type: 'EXPAND_ERROR', payload: { id: dir, error: res.message } })
          }
          // The next ancestor lookup reads the reducer state, which is only
          // reflected in the ref after a render (deep/nest/file.md needs each
          // level loaded before the next can be found). Bounded poll, same
          // pattern as the tree's inline-edit wait.
          for (let i = 0; i < 20; i++) {
            const fresh = findNodeById(workspaceRef.current.nodes, dir)
            if (fresh && (fresh.loadState === 'loaded' || fresh.loadState === 'error')) break
            await new Promise((resolve) => setTimeout(resolve, 25))
          }
        }
      }
    },
    [dispatchWorkspace, workspaceRef]
  )

  useEffect(() => {
    const term = searchTerm.trim()
    const seq = ++seqRef.current
    // Matches from a previous term never linger while the new term's scan is
    // in flight; the settled flag keeps the empty state quiet until it lands.
    setContentMatchIds(new Set())
    if (term === '') {
      setContentSearchIdle(true)
      return
    }
    setContentSearchIdle(false)
    const timer = setTimeout(() => {
      window.api.searchContents(term).then((res) => {
        // Drop stale responses: a newer keystroke owns the result.
        if (seq !== seqRef.current) return
        if (res.ok) {
          setContentMatchIds(contentMatchSet(res.value))
          void loadAncestors(res.value)
        }
        setContentSearchIdle(true)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchTerm, workspaceRoot, loadAncestors])

  return { contentMatchIds, contentSearchIdle }
}

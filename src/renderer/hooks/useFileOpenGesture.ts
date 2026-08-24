import { useCallback, useRef } from 'react'
import type { TreeNode } from '../state/workspace'
import type { FileOpenGesture } from '../explorer/openGesture'
import { beginOpen, discardOpen } from '../editor/openPerformance'
import type { DocumentSessionApi } from './useDocumentSession'

/** Spec 029 as amended 2026-08-21 (clarification in the archived spec): every
 *  file open commits immediately. The former 500 ms deferral existed only to
 *  let a double-click cancel a same-tab replacement; now the double-click's
 *  explicit-new request dedupes onto the tab the first click just presented
 *  (reducer path dedupe), so both gestures land on one tab and single-click
 *  opens carry no dead wait.
 *
 *  A double-click delivers BOTH gestures within milliseconds. The second open
 *  must be suppressed while the first is still in flight: until the staged
 *  replacement commits, the file is not yet in the session, so the reducer's
 *  path dedupe cannot see it and the second request would append a duplicate
 *  tab. Suppression is keyed by path and released as soon as the first open is
 *  dispatched, after that, the dedupe handles repeats. */
export function useFileOpenGesture(opts: {
  session: Pick<DocumentSessionApi, 'openFileFromExplorer'>
}): {
  handleFileOpen: (node: TreeNode, gesture: FileOpenGesture) => Promise<void>
} {
  const { openFileFromExplorer } = opts.session
  const inFlightRef = useRef(new Set<string>())

  const commitOpen = useCallback(
    async (node: TreeNode, explicitNew: boolean) => {
      // Spec 033 (contract C5): the timing window opens at the open-gesture
      // commit, readFile initiation.
      beginOpen()
      const result = await window.api.readFile(node.id)
      if (result.ok) openFileFromExplorer(result.value, explicitNew)
      else discardOpen()
    },
    [openFileFromExplorer]
  )

  const handleFileOpen = useCallback(
    async (node: TreeNode, gesture: FileOpenGesture) => {
      if (inFlightRef.current.has(node.id)) return
      inFlightRef.current.add(node.id)
      try {
        await commitOpen(node, gesture === 'double-click')
      } finally {
        inFlightRef.current.delete(node.id)
      }
    },
    [commitOpen]
  )

  return { handleFileOpen }
}

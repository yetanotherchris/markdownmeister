import { useCallback, useRef } from 'react'
import type { TreeNode } from '../state/workspace'
import type { FileOpenGesture } from '../explorer/openGesture'
import { beginOpen, discardOpen } from '../editor/openPerformance'
import type { DocumentSessionApi } from './useDocumentSession'


export function useFileOpenGesture(opts: {
  session: Pick<DocumentSessionApi, 'openFileFromExplorer'>
}): {
  handleFileOpen: (node: TreeNode, gesture: FileOpenGesture) => Promise<void>
} {
  const { openFileFromExplorer } = opts.session
  const inFlightRef = useRef(new Set<string>())

  const commitOpen = useCallback(
    async (node: TreeNode, explicitNew: boolean) => {
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

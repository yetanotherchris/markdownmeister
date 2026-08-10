import { useCallback, useEffect, useRef } from 'react'
import type { EditingSession } from '../state/documents'
import type { TreeNode } from '../state/workspace'
import { getSettings } from '../state/settings'
import { DOUBLE_CLICK_WINDOW_MS, shouldDeferSingleClick } from '../explorer/openGesture'
import type { FileOpenGesture } from '../explorer/openGesture'
import type { DocumentSessionApi } from './useDocumentSession'

/** Spec 029 (contracts/file-open-gesture.md): turn a resolved row gesture on a
 *  file into an open. Kept out of useWorkspaceTree so the orchestration module
 *  stays under the 300-line maintainability gate. */
export function useFileOpenGesture(opts: {
  sessionRef: React.MutableRefObject<EditingSession>
  session: Pick<DocumentSessionApi, 'isDirtyLive' | 'openFileFromExplorer'>
}): {
  handleFileOpen: (node: TreeNode, gesture: FileOpenGesture) => Promise<void>
} {
  const { sessionRef, session } = opts
  const { isDirtyLive, openFileFromExplorer } = session

  // A double-click opens explicitly NEW (FR-001/005). A single click follows the
  // preference: `new-tab` opens now (US2 needs no deferral); `same-tab` opens now
  // UNLESS it would replace a clean active tab, in which case it defers by the
  // double-click window so the click can still be recognised as the first half of
  // a double-click (FR-003 — replacement is exactly the harm the deferral exists
  // to prevent). A deferred commit never clobbers a tab the user opened or
  // switched to during the window: if the active tab changed, it opens a new tab
  // instead (spec Edge Cases). Pending opens are keyed by path so two deliberate
  // single-clicks on different files each commit independently.
  interface PendingOpen {
    timer: ReturnType<typeof setTimeout>
    activeId: string | null
  }
  const pendingOpensRef = useRef(new Map<string, PendingOpen>())

  useEffect(() => {
    return () => {
      for (const pending of pendingOpensRef.current.values()) clearTimeout(pending.timer)
      pendingOpensRef.current.clear()
    }
  }, [])

  const commitOpen = useCallback(async (node: TreeNode, explicitNew: boolean) => {
    const result = await window.api.readFile(node.id)
    if (result.ok) openFileFromExplorer(result.value, explicitNew)
  }, [openFileFromExplorer])

  const handleFileOpen = useCallback(async (node: TreeNode, gesture: FileOpenGesture) => {
    const pending = pendingOpensRef.current.get(node.id)
    if (pending !== undefined) {
      clearTimeout(pending.timer)
      pendingOpensRef.current.delete(node.id)
    }
    if (gesture === 'double-click') {
      await commitOpen(node, true)
      return
    }
    const current = sessionRef.current
    const active = current.documents.find((d) => d.id === current.activeId) ?? null
    const alreadyOpen = current.documents.some((d) => d.path === node.id)
    if (!shouldDeferSingleClick({
      preferNewTab: getSettings().fileOpenBehavior === 'new-tab',
      activeExists: active !== null,
      activeIsDirty: active ? isDirtyLive(active) : null,
      alreadyOpen
    })) {
      await commitOpen(node, false)
      return
    }
    const activeIdAtClick = active!.id
    const timer = setTimeout(() => {
      pendingOpensRef.current.delete(node.id)
      // If the user opened or activated another tab during the window, don't
      // clobber it: open in a new tab instead (spec Edge Cases).
      const activeNow = sessionRef.current.activeId
      void commitOpen(node, activeNow !== activeIdAtClick)
    }, DOUBLE_CLICK_WINDOW_MS)
    pendingOpensRef.current.set(node.id, { timer, activeId: activeIdAtClick })
  }, [commitOpen, isDirtyLive, sessionRef])

  return { handleFileOpen }
}

import { useCallback } from 'react'
import type { TreeNode, WorkspaceAction, WorkspaceState } from '../state/workspace'
import type { EditingSession } from '../state/documents'
import { deleteDescription, planDelete, type DeletePlan } from '../explorer/operations'
import type { DialogQueue } from './useDialogQueue'
import type { DocumentSessionApi } from './useDocumentSession'

/** Delete confirmation for the file tree. Kept out of useWorkspaceTree so that
 *  hook stays under the 300-line maintainability gate. */
export function useTreeDelete(opts: {
  dispatchWorkspace: React.Dispatch<WorkspaceAction>
  sessionRef: React.MutableRefObject<EditingSession>
  workspaceRef: React.MutableRefObject<WorkspaceState>
  dialog: DialogQueue
  session: Pick<DocumentSessionApi, 'doClose' | 'isDirtyLive'>
}): {
  cleanupAfterDelete: (node: TreeNode, plan: DeletePlan) => void
  runDeleteConfirmation: (node: TreeNode) => Promise<void>
} {
  const { dispatchWorkspace, sessionRef, workspaceRef, dialog } = opts
  const { dialogInFlightRef, releaseDialogSurface, showOperationError } = dialog
  const { doClose, isDirtyLive } = opts.session

  const cleanupAfterDelete = useCallback(
    (node: TreeNode, plan: DeletePlan) => {
      for (const doc of plan.cleanToClose) {
        const fresh = sessionRef.current.documents.find((d) => d.id === doc.id)
        if (fresh && isDirtyLive(fresh)) continue
        doClose(doc.id)
      }
      dispatchWorkspace({ type: 'REMOVE_ENTRY', payload: { id: node.id } })
      const selected = workspaceRef.current.selectedId
      // A descendant may have been selected (e.g. a file inside a deleted
      // folder); it is gone too, so clear the selection as well.
      if (selected === node.id || (selected !== null && selected.startsWith(node.id + '/'))) {
        dispatchWorkspace({ type: 'SELECT', payload: { id: null } })
      }
    },
    [dispatchWorkspace, doClose, isDirtyLive, sessionRef, workspaceRef]
  )

  const runDeleteConfirmation = useCallback(
    async (node: TreeNode) => {
      if (dialogInFlightRef.current) return
      dialogInFlightRef.current = true
      try {
        // ---- describe: gather the entry info for the confirmation ----
        const result = await window.api.describeEntry(node.id)
        if (!result.ok) {
          // The guard is held, so the error is queued and shown once released.
          void showOperationError(result.message)
          return
        }
        const info = result.value

        // ---- plan: which open documents the delete touches ----
        const plan = planDelete(sessionRef.current.documents, node.id, isDirtyLive)

        // ---- block-if-dirty: refuse while a blocker has unsaved changes ----
        if (plan.dirtyBlockers.length > 0) {
          const blocked = await window.api.showConfirmation({
            kind: 'delete-blocked',
            targetName: node.name,
            blockerTitles: plan.dirtyBlockers.map((d) => d.title)
          })
          if (!blocked.ok) void showOperationError(blocked.message)
          return
        }

        // ---- confirm-trash: the primary confirmation ----
        const deleteDecision = await window.api.showConfirmation({
          kind: 'delete-to-trash',
          targetName: node.name,
          detail: deleteDescription(info),
          cleanToCloseTitles: plan.cleanToClose.map((d) => d.title)
        })
        if (!deleteDecision.ok || deleteDecision.value !== 'delete') return

        // ---- trash, with the permanent-delete fallback ----
        const trashed = await window.api.trashEntry(node.id)
        if (trashed.ok) {
          cleanupAfterDelete(node, plan)
          return
        }
        if (trashed.code === 'TRASH_UNAVAILABLE') {
          const permanent = await window.api.showConfirmation({
            kind: 'permanent-delete',
            targetName: node.name,
            detail: deleteDescription(info),
            cleanToCloseTitles: plan.cleanToClose.map((d) => d.title)
          })
          if (!permanent.ok || permanent.value !== 'delete-permanent') return
          const deleted = await window.api.trashEntry(node.id, true)
          if (deleted.ok) {
            cleanupAfterDelete(node, plan)
            return
          }
          void showOperationError(deleted.message)
          return
        }
        void showOperationError(trashed.message)
      } finally {
        releaseDialogSurface()
      }
    },
    [
      cleanupAfterDelete,
      dialogInFlightRef,
      isDirtyLive,
      releaseDialogSurface,
      sessionRef,
      showOperationError
    ]
  )

  return { cleanupAfterDelete, runDeleteConfirmation }
}

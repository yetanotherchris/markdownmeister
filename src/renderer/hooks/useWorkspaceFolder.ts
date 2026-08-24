import { useCallback, useRef } from 'react'
import type { WorkspaceInfo } from '../../shared/ipc-contract'
import type { EditingSession, DocumentState } from '../state/documents'
import type { WorkspaceAction } from '../state/workspace'
import { isWorkspaceRelative } from '../explorer/operations'
import { updateSettings } from '../state/settings'
import { shouldRePromptForFailedSave } from '../domain/quit'
import type { DialogQueue } from './useDialogQueue'
import type { DocumentSessionApi } from './useDocumentSession'

export interface WorkspaceFolderApi {
  commitFolderOpen: () => Promise<void>
  runFolderOpenFlow: (requestPath?: string) => Promise<void>

  runPreparedFolderOpen: (prepared: WorkspaceInfo) => Promise<void>
  dirtyWorkspaceRelativeDocs: () => DocumentState[]
  revealExplorer: () => void
}


export function useWorkspaceFolder(opts: {
  dispatchWorkspace: React.Dispatch<WorkspaceAction>
  sessionRef: React.MutableRefObject<EditingSession>
  dialog: DialogQueue
  session: Pick<DocumentSessionApi, 'saveDocument' | 'doClose' | 'isDirtyLive'>
  sidebarPanelRef: { current: { isCollapsed(): boolean; expand(): void } | null }
}): WorkspaceFolderApi {
  const { dispatchWorkspace, sessionRef, dialog, session, sidebarPanelRef } = opts
  const { dialogInFlightRef, releaseDialogSurface, showOperationError } = dialog

  const pendingFolderOpenRef = useRef<WorkspaceInfo | null>(null)

  const dirtyWorkspaceRelativeDocs = useCallback(
    () => sessionRef.current.documents.filter(
      d => session.isDirtyLive(d) && !!d.path && isWorkspaceRelative(d.path)
    ),
    [session, sessionRef]
  )

  const revealExplorer = useCallback(() => {
    updateSettings({ explorerVisible: true })
    window.api.updateSettings({ explorerVisible: true }).catch(() => { /* ignore */ })
    const panel = sidebarPanelRef.current
    if (panel && panel.isCollapsed()) panel.expand()
  }, [sidebarPanelRef])

  const commitFolderOpen = useCallback(async () => {
    const result = await window.api.commitFolderOpen()
    if (!result.ok) {
      void showOperationError(result.message)
      return
    }
    dispatchWorkspace({
      type: 'REPLACE',
      payload: {
        name: result.value.name,
        root: result.value.path,
        entries: result.value.entries
      }
    })
    revealExplorer()
  }, [dispatchWorkspace, revealExplorer, showOperationError])

  const confirmAndCommitPrepared = useCallback(
    async (prepared: WorkspaceInfo) => {
      // ---- step 2: dirty-check (fast path commits when nothing is unsaved) ----
      if (dirtyWorkspaceRelativeDocs().length === 0) {
        await commitFolderOpen()
        return
      }
      if (dialogInFlightRef.current) {
        await window.api.cancelFolderOpen()
        return
      }

      // ---- step 3: confirm (holds the single-prompt guard) ----
      dialogInFlightRef.current = true
      pendingFolderOpenRef.current = prepared
      try {
        const confirm = async (error?: string) =>
          window.api.showConfirmation({
            kind: 'folder-open',
            documentTitles: dirtyWorkspaceRelativeDocs().map((d) => d.title),
            ...(error ? { error } : {})
          })
        // ---- step 4: save-or-discard, then commit; a failure re-prompts ----
        let error: string | undefined
        for (;;) {
          const result = await confirm(error)
          if (!result.ok) {
            await window.api.cancelFolderOpen()
            return
          }
          const decision = result.value
          if (decision === 'cancel') {
            await window.api.cancelFolderOpen()
            return
          }
          if (decision === 'discard-all') {
            for (const doc of dirtyWorkspaceRelativeDocs()) {
              session.doClose(doc.id)
            }
            await commitFolderOpen()
            return
          }
          // save-all
          let allSaved = true
          for (const doc of dirtyWorkspaceRelativeDocs()) {
            const saved = await session.saveDocument(doc)
            if (saved !== 'saved') {
              if (saved === 'failed') {
                error = `Could not save ${doc.title}.`
              }
              // A failed save re-prompts with the failure explained; a
              // cancelled Save-As re-prompts with the confirmation still open.
              allSaved = !shouldRePromptForFailedSave(saved)
              break
            }
          }
          if (allSaved) {
            await commitFolderOpen()
            return
          }
          // A save failed or was cancelled, keep the confirmation open (the
          // prepared folder was not committed) and re-prompt.
        }
      } finally {
        pendingFolderOpenRef.current = null
        releaseDialogSurface()
      }
    },
    [
      commitFolderOpen,
      dialogInFlightRef,
      dirtyWorkspaceRelativeDocs,
      releaseDialogSurface,
      session
    ]
  )

  const runFolderOpenFlow = useCallback(
    async (requestPath?: string) => {
      // ---- step 1: prepare ----
      if (pendingFolderOpenRef.current) return
      const prepared =
        requestPath === undefined
          ? await window.api.prepareFolderOpen()
          : await window.api.prepareFolderOpen(requestPath)
      if (!prepared.ok) {
        void showOperationError(prepared.message)
        return
      }
      if (!prepared.value) return // Dialog cancelled; nothing pending.
      await confirmAndCommitPrepared(prepared.value)
    },
    [confirmAndCommitPrepared, showOperationError]
  )

  const runPreparedFolderOpen = useCallback(
    async (prepared: WorkspaceInfo) => {
      if (pendingFolderOpenRef.current) {
        await window.api.cancelFolderOpen()
        return
      }
      await confirmAndCommitPrepared(prepared)
    },
    [confirmAndCommitPrepared]
  )

  return {
    commitFolderOpen,
    runFolderOpenFlow,
    runPreparedFolderOpen,
    dirtyWorkspaceRelativeDocs,
    revealExplorer
  }
}

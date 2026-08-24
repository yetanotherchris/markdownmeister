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
  /** Spec 006: an OS-initiated folder open whose prepare step main already ran
   *  (the shared `ctx.pendingFolderOpen` slot is filled); the renderer runs the
   *  same confirm→commit flow, so unsaved-work confirmation is preserved
   *  (FR-009). */
  runPreparedFolderOpen: (prepared: WorkspaceInfo) => Promise<void>
  dirtyWorkspaceRelativeDocs: () => DocumentState[]
  revealExplorer: () => void
}

/**
 * Workspace folder lifecycle (US1/FR-002): the two-phase folder open (spec 004
 * FR-009/FR-010, prepare → confirm → commit) and the reveal-on-open behaviour
 * (spec 010 clarification 2026-08-05). Owns the prepared-but-unconfirmed slot.
 */
export function useWorkspaceFolder(opts: {
  dispatchWorkspace: React.Dispatch<WorkspaceAction>
  sessionRef: React.MutableRefObject<EditingSession>
  dialog: DialogQueue
  session: Pick<DocumentSessionApi, 'saveDocument' | 'doClose' | 'isDirtyLive'>
  sidebarPanelRef: { current: { isCollapsed(): boolean; expand(): void } | null }
}): WorkspaceFolderApi {
  const { dispatchWorkspace, sessionRef, dialog, session, sidebarPanelRef } = opts
  const { dialogInFlightRef, releaseDialogSurface, showOperationError } = dialog

  // The prepared-but-unconfirmed folder open (spec 004 FR-009/FR-010); a ref so
  // overlapping open flows cannot clobber the pending slot.
  const pendingFolderOpenRef = useRef<WorkspaceInfo | null>(null)

  // Spec 004, FR-010: a folder switch rebinds the workspace-relative paths of
  // open documents to the new root. Before committing a folder open (which
  // swaps main's workspace), confirm when those documents have unsaved changes.
  const dirtyWorkspaceRelativeDocs = useCallback(
    () => sessionRef.current.documents.filter(
      d => session.isDirtyLive(d) && !!d.path && isWorkspaceRelative(d.path)
    ),
    [session, sessionRef]
  )

  // Spec 010 (clarification 2026-08-05): opening a folder reveals the explorer
  // even if it was previously hidden, an explicit open overrides the persisted
  // hidden choice so the newly opened workspace is always browsable. Runs on
  // every successful folder commit (both Open Folder and a recent-folder open
  // route through commitFolderOpen). The restore flag is deliberately NOT set
  // here (review 2026-08-06): the panel has not mounted yet, and arming it
  // would defeat the mount guard that suppresses the transient size-0 resize.
  // Persistence is explicit on this path, so nothing is lost.
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

  // The confirm→commit steps shared by every folder open (spec 004 FR-004:
  // dirty-check → confirm → save-or-discard → commit). `prepared` is main's
  // prepared folder (its `ctx.pendingFolderOpen` slot is filled); the ref
  // guards the renderer against overlapping confirmation flows.
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
            // FR-010: cancel keeps the session and the recent entry unchanged.
            await window.api.cancelFolderOpen()
            return
          }
          if (decision === 'discard-all') {
            // FR-010 "Discard": the user chose to throw the unsaved changes
            // away, so the dirty workspace-relative documents are CLOSED (their
            // edits dropped) before the workspace swap rebinds their paths.
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

  // Both entry points (File > Open Folder and a recent-folder open, FR-007)
  // route through the same prepare → (confirm) → commit flow. A second folder
  // open while the confirmation is up is ignored here (main also rejects new
  // prepares while one is pending) so the in-flight flow cannot be clobbered.
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
      if (!prepared.value) return // dialog cancelled — nothing pending
      await confirmAndCommitPrepared(prepared.value)
    },
    [confirmAndCommitPrepared, showOperationError]
  )

  // Spec 006: main already validated and prepared the folder (FR-006); the
  // renderer only confirms and commits, so the OS open never bypasses the
  // unsaved-work confirmation (FR-009, Principle III).
  const runPreparedFolderOpen = useCallback(
    async (prepared: WorkspaceInfo) => {
      if (pendingFolderOpenRef.current) {
        // A previous flow's commit/cancel may still be settling: main has
        // already cleared its slot for THIS prepared folder, so release it,
        // otherwise the slot stays filled with a folder nobody will commit and
        // the next Open Folder errors "already in progress" (review finding
        // 2026-08-09). Clearing an already-free slot is a no-op.
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

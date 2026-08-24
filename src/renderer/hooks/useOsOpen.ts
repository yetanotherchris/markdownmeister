import { useEffect, useRef } from 'react'
import type { OpenedFile, WorkspaceInfo } from '../../shared/ipc-contract'
import type { DocumentSessionApi } from './useDocumentSession'
import type { WorkspaceFolderApi } from './useWorkspaceFolder'

interface OsOpenDeps {
  session: Pick<DocumentSessionApi, 'openFileFromTree'>
  folder: Pick<WorkspaceFolderApi, 'runPreparedFolderOpen'>
  onOpenFailed: (message: string) => void
}

/**
 * Spec 006 OS-open routing (US1/US2, FR-005/006/008/009/011): main validates an
 * OS-initiated open and pushes the read-ready result; this hook routes it
 * through the existing flows:
 *
 * - file   → the generic single-file open (`openFileFromTree`, same as File →
 *   Open); existing-tab activation and detached-file dedupe happen in the
 *   reducer (FR-005/007).
 * - folder → `runPreparedFolderOpen`, the existing confirm→commit flow, main
 *   already prepared the slot, so the OS open never bypasses the unsaved-work
 *   confirmation (FR-006/009).
 * - failed → the quiet footer note owned by the composition root (constitution
 *   IV: errors are in-context, not modal, when no data loss is at stake). The
 *   session is unchanged (FR-011).
 *
 * `notifyOsReady` lets main drain any opens that arrived before this renderer
 * mounted (first-launch argv, pre-ready `open-file` events).
 *
 * The IPC listeners are registered ONCE (review finding 2026-08-09): the hook
 * deps are new object literals every render, so subscribing in the effect
 * would tear down and re-register the three listeners on every App render and
 * re-send `os:ready`; the ref holds the latest callbacks instead.
 */
export function useOsOpen(opts: OsOpenDeps): void {
  const depsRef = useRef<OsOpenDeps>(opts)
  depsRef.current = opts

  useEffect(() => {
    const unsubFile = window.api.onOsFileOpen((file: OpenedFile) => {
      depsRef.current.session.openFileFromTree(file)
    })
    const unsubFolder = window.api.onOsFolderOpen((info: WorkspaceInfo) => {
      void depsRef.current.folder.runPreparedFolderOpen(info)
    })
    const unsubFailed = window.api.onOsOpenFailed((message: string) => {
      depsRef.current.onOpenFailed(message)
    })
    // Signal main that the OS-open listeners are live so queued opens drain.
    window.api.notifyOsReady()
    return () => {
      unsubFile()
      unsubFolder()
      unsubFailed()
    }
  }, [])
}

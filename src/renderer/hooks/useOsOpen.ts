import { useEffect, useRef } from 'react'
import type { OpenedFile, WorkspaceInfo } from '../../shared/ipc-contract'
import type { DocumentSessionApi } from './useDocumentSession'
import type { WorkspaceFolderApi } from './useWorkspaceFolder'

interface OsOpenDeps {
  session: Pick<DocumentSessionApi, 'openFileFromTree'>
  folder: Pick<WorkspaceFolderApi, 'runPreparedFolderOpen'>
  onOpenFailed: (message: string) => void
}


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

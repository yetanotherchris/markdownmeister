import { useCallback } from 'react'
import type { EditingSession, DocumentState } from '../state/documents'
import type { DialogQueue } from './useDialogQueue'
import type { DocumentSessionApi } from './useDocumentSession'

export interface ExternalFileEventsApi {
  handleExternalChange: (doc: DocumentState, kind: 'changed' | 'removed') => boolean
  handleExternalPrompt: (prompt: { id: string; kind: 'changed' | 'removed' }) => Promise<void>
}


export function useExternalFileEvents(opts: {
  sessionRef: React.MutableRefObject<EditingSession>
  dialog: DialogQueue
  session: Pick<DocumentSessionApi, 'reloadDocument' | 'saveDocument' | 'flushLiveContent' | 'isDirtyLive'>
}): ExternalFileEventsApi {
  const { sessionRef, dialog, session } = opts
  const { dialogInFlightRef, releaseDialogSurface, handleExternalChangeRef } = dialog

  const handleExternalPrompt = useCallback(async (prompt: { id: string; kind: 'changed' | 'removed' }) => {
    const doc = sessionRef.current.documents.find(d => d.id === prompt.id)
    if (!doc) return
    if (dialogInFlightRef.current) return
    dialogInFlightRef.current = true
    try {
      if (prompt.kind === 'changed') {
        const result = await window.api.showConfirmation({
          kind: 'external-changed',
          documentTitle: doc.title
        })
        if (result.ok && result.value === 'reload') {
          await session.reloadDocument(doc, true)
        }
        return
      }
      let error: string | undefined
      for (;;) {
        const result = await window.api.showConfirmation({
          kind: 'external-removed',
          documentTitle: doc.title,
          ...(error ? { error } : {})
        })
        if (!result.ok) return
        if (result.value === 'ok') return
        const saved = await session.saveDocument(doc, true)
        if (saved === 'failed') {
          error = `Could not save ${doc.title}.`
          continue
        }
        return
      }
    } finally {
      releaseDialogSurface()
    }
  }, [dialogInFlightRef, releaseDialogSurface, sessionRef, session])

  // Route an external changed/removed event to its handling. Returns true when a
  // confirmation prompt is opened, used by releaseDialogSurface so a deferred
  // notice that instead resolves via auto-reload (a clean document) still lets a
  // queued operation error show.
  const handleExternalChange = useCallback((doc: DocumentState, kind: 'changed' | 'removed'): boolean => {
    if (kind === 'changed' && !doc.dirty && !session.isDirtyLive(doc)) {
      session.reloadDocument(doc)
      return false
    }
    session.flushLiveContent()
    void handleExternalPrompt({ id: doc.id, kind })
    return true
  }, [handleExternalPrompt, session])

  handleExternalChangeRef.current = handleExternalChange

  return { handleExternalChange, handleExternalPrompt }
}

import { useCallback, useRef } from 'react'
import type { EditingSession, DocumentState } from '../state/documents'

export interface ExternalChangeHandler {
  (doc: DocumentState, kind: 'changed' | 'removed'): boolean
}

export interface DialogQueue {
  dialogInFlightRef: React.MutableRefObject<boolean>
  pendingErrorRef: React.MutableRefObject<string | null>
  pendingExternalPromptRef: React.MutableRefObject<
    Array<{ path: string; kind: 'changed' | 'removed' }>
  >
  /** Registered by useExternalFileEvents so a deferred notice can be drained
   *  synchronously by releaseDialogSurface. */
  handleExternalChangeRef: React.MutableRefObject<ExternalChangeHandler | null>
  showOperationErrorRef: React.MutableRefObject<((message: string) => Promise<void>) | null>
  releaseDialogSurface: () => void
  showOperationError: (message: string) => Promise<void>
}


export function useDialogQueue(sessionRef: React.MutableRefObject<EditingSession>): DialogQueue {
  const dialogInFlightRef = useRef(false)
  // An operation-failed prompt queued while another prompt is up.
  const pendingErrorRef = useRef<string | null>(null)
  const pendingExternalPromptRef = useRef<Array<{ path: string; kind: 'changed' | 'removed' }>>([])
  const handleExternalChangeRef = useRef<ExternalChangeHandler | null>(null)
  const showOperationErrorRef = useRef<((message: string) => Promise<void>) | null>(null)

  const releaseDialogSurface = useCallback(() => {
    dialogInFlightRef.current = false
    const queuedPrompt = pendingExternalPromptRef.current.shift()
    const queuedError = pendingErrorRef.current
    if (queuedPrompt) {
      const doc = sessionRef.current.documents.find((d) => d.path === queuedPrompt.path)
      if (doc && handleExternalChangeRef.current?.(doc, queuedPrompt.kind)) {
        pendingErrorRef.current = queuedError
        return
      }
      if (pendingExternalPromptRef.current.length > 0) {
        pendingErrorRef.current = queuedError
        releaseDialogSurface()
        return
      }
    }
    pendingErrorRef.current = null
    if (queuedError) void showOperationErrorRef.current?.(queuedError)
  }, [sessionRef])

  const showOperationError = useCallback(
    async (message: string) => {
      if (dialogInFlightRef.current) {
        pendingErrorRef.current = message
        return
      }
      dialogInFlightRef.current = true
      try {
        await window.api.showConfirmation({ kind: 'operation-failed', message })
      } finally {
        releaseDialogSurface()
      }
    },
    [releaseDialogSurface]
  )

  showOperationErrorRef.current = showOperationError

  return {
    dialogInFlightRef,
    pendingErrorRef,
    pendingExternalPromptRef,
    handleExternalChangeRef,
    showOperationErrorRef,
    releaseDialogSurface,
    showOperationError
  }
}

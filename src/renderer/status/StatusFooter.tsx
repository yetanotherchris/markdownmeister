import { useCallback } from 'react'
import type { DocumentState } from '../state/documents'
import { useElementSize } from '../hooks/useElementSize'
import { shortenPath } from '../../shared/shortenPath'
import './status.css'

interface StatusFooterProps {
  activeDoc: DocumentState | null
  workspaceRoot: string | null
  /** Quiet, actionable notice for non-fatal problems (e.g. a persistence failure). */
  note?: string | null
}


const CHAR_WIDTH_PX = 8


export default function StatusFooter({ activeDoc, workspaceRoot, note }: StatusFooterProps) {
  const [regionRef, regionSize] = useElementSize<HTMLDivElement>()
  const hasWorkspace = workspaceRoot !== null

  const displayPath = useCallback(() => {
    if (!workspaceRoot) return 'No folder open'
    const maxChars = Math.max(
      // The minimal shortened form is '…' + separator + final folder, so the
      // floor is exactly final.length + 2 (shortenPath's own budget).
      (workspaceRoot.split(/[/\\]/).pop() ?? workspaceRoot).length + 2,
      Math.floor(regionSize.width / CHAR_WIDTH_PX)
    )
    return shortenPath(workspaceRoot, maxChars)
  }, [workspaceRoot, regionSize.width])

  return (
    <footer className="app-footer" data-testid="status-footer">
      <span className="document-title" data-testid="footer-document">
        {activeDoc
          ? <>
              {activeDoc.title}
              {activeDoc.dirty && (
                <span className="footer-dirty" aria-label="unsaved changes" title="Unsaved changes">
                  {' \u2022'}
                </span>
              )}
            </>
          : <span className="footer-placeholder">No document open</span>}
      </span>
      <div ref={regionRef} className="footer-workspace-region">
        <span
          className="footer-workspace"
          data-testid="footer-workspace"
          title={workspaceRoot ?? undefined}
        >
          {hasWorkspace ? displayPath() : <span className="footer-placeholder">No folder open</span>}
        </span>
      </div>
      {note && (
        <span className="footer-note" data-testid="footer-note" title={note}>
          {note}
        </span>
      )}
    </footer>
  )
}

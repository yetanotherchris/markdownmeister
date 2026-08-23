import type { ReactElement } from 'react'
import { useBuildInfo } from '../hooks/useBuildInfo'

/**
 * Spec 037 (FR-001..FR-007): the read-only About area. Three labelled rows —
 * version, repository URL (a button handing off to the system browser via the
 * named preload operation, never in-app navigation), and the full revision,
 * selectable and copyable with silent degradation when the clipboard denies
 * the write (spec edge case). A build without embedded revision metadata shows
 * the honest `development build` placeholder instead of a fabricated value.
 */
export default function AboutArea(): ReactElement | null {
  const buildInfo = useBuildInfo()
  if (!buildInfo) return null

  const handleCopyRevision = (): void => {
    if (buildInfo.revision === null) return
    navigator.clipboard.writeText(buildInfo.revision).catch(() => {
      // Spec edge case: clipboard denied/unavailable — selection remains
      // possible; the failure must not produce an error dialog.
    })
  }

  const handleOpenRepository = (): void => {
    window.api.openRepositoryUrl().catch(() => {})
  }

  return (
    <fieldset className="settings-fieldset">
      <legend className="settings-legend">About</legend>
      <div className="settings-about-row">
        <span className="settings-about-label">Version</span>
        <span className="settings-about-value" data-testid="settings-about-version">
          {buildInfo.version}
        </span>
      </div>
      <div className="settings-about-row">
        <span className="settings-about-label">Repository URL</span>
        <button
          type="button"
          className="settings-about-link"
          data-testid="settings-about-repository"
          onClick={handleOpenRepository}
        >
          {buildInfo.repositoryUrl}
        </button>
      </div>
      <div className="settings-about-row">
        <span className="settings-about-label">Revision</span>
        <span className="settings-about-value" data-testid="settings-about-revision">
          {buildInfo.revision ?? 'development build'}
        </span>
        {buildInfo.revision !== null && (
          <button
            type="button"
            className="settings-about-copy"
            data-testid="settings-about-copy"
            onClick={handleCopyRevision}
          >
            Copy
          </button>
        )}
      </div>
    </fieldset>
  )
}

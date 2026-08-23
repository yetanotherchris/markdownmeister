import type { ReactElement } from 'react'
// Electron-free policy module (research R3): the repository URL is a constant
// owned by main, so the renderer can display it without any fetched data.
import { REPOSITORY_URL } from '../../main/buildInfo'
import { useBuildInfo } from '../hooks/useBuildInfo'

/**
 * Spec 037 (FR-001..FR-007): the read-only About area. Three labelled rows —
 * version, repository URL (a button handing off to the system browser via the
 * named preload operation, never in-app navigation), and the full revision,
 * selectable and copyable with silent degradation when the clipboard denies
 * the write (spec edge case). A build without embedded revision metadata shows
 * the honest `development build` placeholder instead of a fabricated value.
 *
 * A failed or unauthorized `getBuildInfo` degrades only the version and
 * revision rows: the repository row renders regardless because its URL needs
 * no fetched data (correctness review 2026-08-23) — hiding it would leave no
 * way to reach the repository at all.
 */
export default function AboutArea(): ReactElement {
  const buildInfo = useBuildInfo()

  const handleCopyRevision = (): void => {
    if (!buildInfo || buildInfo.revision === null) return
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
      {buildInfo && (
        <div className="settings-about-row">
          <span className="settings-about-label">Version</span>
          <span className="settings-about-value" data-testid="settings-about-version">
            {buildInfo.version}
          </span>
        </div>
      )}
      <div className="settings-about-row">
        <span className="settings-about-label">Repository URL</span>
        <button
          type="button"
          className="settings-about-link"
          data-testid="settings-about-repository"
          onClick={handleOpenRepository}
        >
          {buildInfo?.repositoryUrl ?? REPOSITORY_URL}
        </button>
      </div>
      {buildInfo && (
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
      )}
    </fieldset>
  )
}

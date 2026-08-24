import type { ReactElement } from 'react'
import { REPOSITORY_URL } from '../../main/buildInfo'
import { useBuildInfo } from '../hooks/useBuildInfo'

export default function AboutArea(): ReactElement {
  const buildInfo = useBuildInfo()

  const handleCopyRevision = (): void => {
    if (!buildInfo || buildInfo.revision === null) return
    navigator.clipboard.writeText(buildInfo.revision).catch(() => {})
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

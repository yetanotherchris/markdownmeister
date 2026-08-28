import type { ReactElement } from 'react'
import { REPOSITORY_URL } from '../../main/buildInfo'
import { useBuildInfo } from '../hooks/useBuildInfo'

export default function AboutArea(): ReactElement {
  const buildInfo = useBuildInfo()

  const handleOpenRepository = (): void => {
    window.api.openRepositoryUrl().catch(() => {})
  }

  return (
    <fieldset className="settings-fieldset">
      <legend className="settings-legend">About</legend>
      {buildInfo && (
        <div className="settings-about-row">
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
    </fieldset>
  )
}

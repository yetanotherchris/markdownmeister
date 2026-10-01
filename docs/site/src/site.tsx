import { useEffect, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import {
  features,
  issuesUrl,
  navigation,
  privacyUrl,
  releasesUrl,
  repositoryUrl,
  settingsReference,
  shortcuts,
  storeSearchUrl
} from './content'

const RELEASE_API = `${repositoryUrl.replace('github.com', 'api.github.com/repos')}/releases/latest`

function readVersion(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('version' in data)) return null
  const value = (data as { version?: unknown }).version
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readTagName(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('tag_name' in data)) return null
  const value = (data as { tag_name?: unknown }).tag_name
  return typeof value === 'string' && value.length > 0 ? value.replace(/^v/, '') : null
}

/** Deploy-time version from version.json, refreshed from the releases API. */
function useReleaseVersion(): string {
  const [version, setVersion] = useState('development')
  useEffect(() => {
    let active = true
    fetch('./version.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        const next = readVersion(data)
        if (active && next !== null) setVersion(next)
      })
      .catch(() => {})
    fetch(RELEASE_API, { headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: unknown) => {
        const next = readTagName(data)
        if (active && next !== null) setVersion(next)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return version
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="doc-section">
      <p className="eyebrow">{id.replace('-', ' ')}</p>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

function Code({ children }: { children: string }) {
  return (
    <pre className="code">
      <code>{children}</code>
    </pre>
  )
}

export function DocumentationSite(): ReactElement {
  const version = useReleaseVersion()

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top">
          <img src="./assets/logo.png" alt="" width="28" height="28" />
          MarkdownMeister
        </a>
        <div className="header-actions">
          <a className="icon-link" href={repositoryUrl} aria-label="MarkdownMeister on GitHub">
            <svg viewBox="0 0 16 16" width="24" height="24" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
          </a>
        </div>
      </header>

      <div className="site-layout" id="top">
        <aside className="sidebar" aria-label="Site navigation">
          <p className="sidebar-title">Documentation</p>
          <nav>
            {navigation.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </nav>
          <p className="version-note">
            Version
            <br />
            <strong>{version}</strong>
          </p>
        </aside>

        <main className="content">
          <section className="hero">
            <img className="hero-logo" src="./assets/logo.png" alt="" width="88" height="88" />
            <p className="eyebrow">MarkdownMeister · v{version}</p>
            <h1>A free, open-source markdown editor</h1>
            <p className="lead">
              Write with a live preview or edit the raw source, browse a folder in the sidebar, and
              keep documents open in tabs. Your files stay plain markdown on disk.
            </p>
            <div className="hero-links">
              <a className="button" href="#install">
                Install using Scoop/Homebrew
              </a>
              <a className="button" href={storeSearchUrl}>
                Get it from the Microsoft Store
              </a>
              <a className="button" href={releasesUrl}>
                Download
              </a>
            </div>
            <figure className="hero-shot">
              <img
                src="./assets/screenshot-1.png"
                alt="The MarkdownMeister main window with the folder explorer on the left and the markdown editor on the right."
                width="1352"
                height="850"
              />
              <figcaption>
                The main window: folder explorer, tabbed documents, and the editor.
              </figcaption>
            </figure>
            <figure className="hero-shot">
              <img
                src="./assets/screenshot-2.png"
                alt="The MarkdownMeister File menu and the find and replace bar."
                width="1352"
                height="850"
              />
              <figcaption>The File menu and find and replace.</figcaption>
            </figure>
          </section>

          <Section id="features" title="Features">
            <ul className="feature-list">
              {features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </Section>

          <Section id="install" title="Install">
            <p>
              Install the latest release without building from source. On Windows the Microsoft
              Store carries Microsoft’s own signing, so there is no developer-certificate or
              SmartScreen warning.
            </p>
            <h3>Windows (Scoop)</h3>
            <Code>{`scoop bucket add markdownmeister ${repositoryUrl}\nscoop install markdownmeister`}</Code>
            <h3>macOS and Linux (Homebrew)</h3>
            <Code>{`brew tap markdownmeister ${repositoryUrl}\nbrew install markdownmeister`}</Code>
            <h3>Windows (Microsoft Store)</h3>
            <p>
              Search for <strong>MarkdownMeister</strong> in the Microsoft Store, or open the{' '}
              <a href={storeSearchUrl}>Store search page</a>.
            </p>
          </Section>

          <Section id="shortcuts" title="Keyboard shortcuts">
            <p>Common commands. On macOS use Cmd in place of Ctrl.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Keys</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {shortcuts.map((shortcut) => (
                    <tr key={shortcut.keys}>
                      <td>
                        <code>{shortcut.keys}</code>
                      </td>
                      <td>{shortcut.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="settings" title="Settings">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>What it does</th>
                    <th>Values</th>
                  </tr>
                </thead>
                <tbody>
                  {settingsReference.map(([name, description, values]) => (
                    <tr key={name}>
                      <td>
                        <code>{name}</code>
                      </td>
                      <td>{description}</td>
                      <td>{values}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="privacy" title="Privacy">
            <p>
              MarkdownMeister collects no personal data and sends nothing anywhere. It reads and
              writes only the folder you open. See the <a href={privacyUrl}>privacy policy</a>.
            </p>
          </Section>
        </main>
      </div>

      <footer className="site-footer">
        <span>
          MarkdownMeister is free and open source under the{' '}
          <a href={`${repositoryUrl}/blob/main/LICENSE`}>MIT licence</a>.
        </span>
        <span>
          <a href={repositoryUrl}>GitHub</a> · <a href={issuesUrl}>Issues</a> ·{' '}
          <a href={privacyUrl}>Privacy</a> · v{version}
        </span>
      </footer>
    </div>
  )
}

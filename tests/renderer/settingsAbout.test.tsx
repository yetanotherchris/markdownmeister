import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Shared constant from the electron-free policy module (research R3) instead
// of a suite-local redeclaration that could silently drift.
import { REPOSITORY_URL } from '../../src/main/buildInfo'
import SettingsDialog, { SETTINGS_AREAS } from '../../src/renderer/chrome/SettingsDialog'
import type { BuildInfo, MarkdownSyntaxOptions } from '../../src/shared/ipc-contract'

/**
 * Spec 037 (FR-001..FR-008): the About area joins the settings navigation LAST,
 * shows three read-only values, and contributes no staged state — visiting it
 * can neither stage anything nor disturb the editor-theme draft the dialog
 * already manages (statelessness both ways).
 */

let currentBuildInfo: BuildInfo

function stubApi(): void {
  window.api = {
    getBuildInfo: () => Promise.resolve({ ok: true, value: currentBuildInfo })
  } as unknown as typeof window.api
}

const writeText = vi.fn<(text: string) => Promise<void>>()

beforeEach(() => {
  currentBuildInfo = {
    version: '9.9.9',
    revision: 'abc123def4567890',
    repositoryUrl: REPOSITORY_URL
  }
  stubApi()
  writeText.mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true
  })
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ''
})

const DEFAULT_MARKDOWN_OPTIONS: MarkdownSyntaxOptions = {
  hardBreaks: false,
  strikethrough: true,
  tables: true,
  taskLists: true,
  math: true,
  autolink: true
}

function baseProps(): DialogProps {
  return {
    editorTheme: 'rustic',
    onEditorThemeSave: vi.fn(),
    theme: 'light',
    onThemeChange: vi.fn(),
    spellcheckEnabled: true,
    onSpellcheckChange: vi.fn(),
    spellcheckLanguage: null,
    onSpellcheckLanguageChange: vi.fn(),
    fileOpenBehavior: 'same-tab',
    onFileOpenBehaviorChange: vi.fn(),
    markdownOptions: DEFAULT_MARKDOWN_OPTIONS,
    onMarkdownOptionChange: vi.fn(),
    visualCodeHighlighting: true,
    onVisualCodeHighlightingChange: vi.fn(),
    onClose: vi.fn()
  }
}

type DialogProps = Parameters<typeof SettingsDialog>[0]

let root: Root | null = null
let container: HTMLElement

function renderDialog(overrides?: Partial<DialogProps>): void {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const props = { ...baseProps(), ...overrides }
  act(() => {
    root!.render(<SettingsDialog {...props} />)
  })
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'))
}

function buttonByLabel(label: string): HTMLButtonElement {
  const match = buttons().find((b) => b.textContent?.trim() === label)
  if (!match) throw new Error(`no button labelled ${label}`)
  return match
}

async function clickButton(label: string): Promise<void> {
  const button = buttonByLabel(label)
  await act(async () => {
    button.click()
  })
}

describe('SETTINGS_AREAS registration order (spec 008 FR-002, spec 037 Assumptions)', () => {
  it('lists About last, after Markdown', () => {
    expect(SETTINGS_AREAS.map((area) => area.label)).toEqual([
      'General',
      'Theme',
      'Markdown',
      'About'
    ])
    expect(SETTINGS_AREAS[SETTINGS_AREAS.length - 1].value).toBe('about')
  })

  it('renders an About navigation entry after the Markdown entry', () => {
    renderDialog()
    const entries = Array.from(container.querySelectorAll('.settings-nav-button')).map((b) =>
      b.textContent?.trim()
    )
    expect(entries).toEqual(['General', 'Theme', 'Markdown', 'About'])
  })
})

describe('the About area (spec 037 US1)', () => {
  it('shows the three read-only values and no adjustable controls', async () => {
    renderDialog()
    await clickButton('About')

    const values = Array.from(container.querySelectorAll('.settings-about-value')).map((el) =>
      el.textContent?.trim()
    )
    expect(values).toEqual(['9.9.9', 'abc123def4567890'])

    const link = container.querySelector<HTMLButtonElement>('.settings-about-link')
    expect(link?.textContent?.trim()).toBe(REPOSITORY_URL)

    // FR-001/FR-008: read-only information — no checkbox, select, or radio.
    expect(container.querySelectorAll('.settings-main input, .settings-main select')).toHaveLength(
      0
    )
  })

  it('renders the development-build placeholder when the revision is null (FR-007)', async () => {
    currentBuildInfo = { ...currentBuildInfo, revision: null }
    renderDialog()
    await clickButton('About')

    const values = Array.from(container.querySelectorAll('.settings-about-value')).map((el) =>
      el.textContent?.trim()
    )
    expect(values).toEqual(['9.9.9', 'development build'])
    expect(buttons().some((b) => b.textContent?.trim() === 'Copy')).toBe(false)
  })

  it('keeps the repository link usable when getBuildInfo resolves a failure (review 2026-08-23)', async () => {
    window.api = {
      getBuildInfo: () =>
        Promise.resolve({ ok: false, code: 'IO', message: 'Unauthorized renderer' })
    } as unknown as typeof window.api
    renderDialog()
    await clickButton('About')

    // The link is a constant needing no fetched data — it must stay usable;
    // only the version/revision rows degrade, showing no fabricated values.
    const link = container.querySelector<HTMLButtonElement>('.settings-about-link')
    expect(link?.textContent?.trim()).toBe(REPOSITORY_URL)
    expect(container.querySelectorAll('.settings-about-value')).toHaveLength(0)
  })

  it('keeps the repository link usable when getBuildInfo rejects outright (review 2026-08-23)', async () => {
    window.api = {
      getBuildInfo: () => Promise.reject(new Error('no handler registered'))
    } as unknown as typeof window.api
    renderDialog()
    await clickButton('About')

    const link = container.querySelector<HTMLButtonElement>('.settings-about-link')
    expect(link?.textContent?.trim()).toBe(REPOSITORY_URL)
    expect(container.querySelectorAll('.settings-about-value')).toHaveLength(0)
  })

  it('copies the full untruncated revision to the clipboard (US2/FR-006)', async () => {
    writeText.mockResolvedValue(undefined)
    renderDialog()
    await clickButton('About')
    await clickButton('Copy')

    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText).toHaveBeenCalledWith('abc123def4567890')
  })

  it('degrades silently when the clipboard write is denied (edge case)', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    renderDialog()
    await clickButton('About')

    const copy = buttonByLabel('Copy')
    await act(async () => {
      copy.click()
    })

    expect(writeText).toHaveBeenCalledTimes(1)
  })
})

describe('About holds no staged state (spec 037 FR-008)', () => {
  it('saving after visiting About commits nothing when nothing was staged', async () => {
    const props = baseProps()
    props.editorTheme = 'custom'
    renderDialog(props)
    await clickButton('About')
    await clickButton('Save')

    expect(props.onEditorThemeSave).not.toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('preserves a staged editor-theme draft across a visit to About', async () => {
    const props = baseProps()
    renderDialog(props)

    await clickButton('Theme')
    const scholarly = container.querySelector<HTMLInputElement>(
      'input[name="editor-theme"][value="scholarly"]'
    )
    if (!scholarly) throw new Error('scholarly radio missing')
    await act(async () => {
      scholarly.click()
    })

    await clickButton('About')
    await clickButton('Save')

    expect(props.onEditorThemeSave).toHaveBeenCalledTimes(1)
    expect(props.onEditorThemeSave).toHaveBeenCalledWith('scholarly')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

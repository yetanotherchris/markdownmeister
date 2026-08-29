import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// Shared constant instead
// of a suite-local redeclaration that could silently drift.
import { REPOSITORY_URL } from '../../src/main/buildInfo'
import SettingsDialog, { SETTINGS_AREAS } from '../../src/renderer/chrome/SettingsDialog'
import type { MarkdownSyntaxOptions } from '../../src/renderer/editor/markdownSyntaxOptions'
import type { BuildInfo, EditorColors, EditorThemeDefinition } from '../../src/shared/ipc-contract'

/**
 * Spec 037 (FR-001..FR-008): the About area joins the settings navigation LAST,
 * shows two read-only values after spec 050, and contributes no staged state;
 * visiting it can neither stage anything nor disturb the editor-theme draft
 * the dialog already manages (statelessness both ways).
 *
 * Spec 050 pares the panel down to the bare version value plus the repository
 * row, and moves the word wrap control out of the Markdown area entirely.
 *
 * Spec 054 prefixes the version with "v." and removes the "Repository URL"
 * label, keeping the clickable link with its constant fallback.
 */

let currentBuildInfo: BuildInfo

function stubApi(): void {
  window.api = {
    getBuildInfo: () => Promise.resolve({ ok: true, value: currentBuildInfo })
  } as unknown as typeof window.api
}

beforeEach(() => {
  currentBuildInfo = {
    version: '9.9.9',
    revision: 'abc123def4567890',
    repositoryUrl: REPOSITORY_URL
  }
  stubApi()
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

/** Spec 036 contract: the dialog consumes discovered theme files via props.
 *  The About tests only need stems that exist for the staged-draft scenarios;
 *  token values are inert here. */
function themeDefinition(name: string, typeface: string): EditorThemeDefinition {
  const colors: EditorColors = {
    background: '#fdf6e3',
    foreground: '#1f1b16',
    accent: '#805610',
    surface: '#fdf3d9',
    outline: '#817567',
    code: '#ba1a1a'
  }
  return { name, typeface, light: colors, dark: colors }
}

function baseProps(): DialogProps {
  return {
    editorThemes: [themeDefinition('rustic', 'sans-serif'), themeDefinition('scholarly', 'serif')],
    invalidThemeFileNames: [],
    editorTheme: 'rustic',
    onRefreshEditorThemes: vi.fn(async () => undefined),
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
    formattingBarVisible: true,
    onFormattingBarVisibleChange: vi.fn(),
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

describe('the About area (spec 037 US1, spec 050 US1, spec 054 US2)', () => {
  it('shows the version prefixed with v. and the repository row with no label', async () => {
    renderDialog()
    await clickButton('About')

    // FR-006: the version renders as "v." followed by the version number.
    const values = Array.from(container.querySelectorAll('.settings-about-value')).map((el) =>
      el.textContent?.trim()
    )
    expect(values).toEqual(['v.9.9.9'])
    expect(container.textContent).not.toContain('Version')

    // FR-007/FR-008: the repository label is gone, the link itself remains.
    const labels = Array.from(container.querySelectorAll('.settings-about-label')).map((el) =>
      el.textContent?.trim()
    )
    expect(labels).toEqual([])
    expect(container.textContent).not.toContain('Repository URL')
    const link = container.querySelector<HTMLButtonElement>('.settings-about-link')
    expect(link?.textContent?.trim()).toBe(REPOSITORY_URL)

    // FR-003: no revision identifier, label, or copy control anywhere.
    expect(container.querySelector('[data-testid="settings-about-revision"]')).toBeNull()
    expect(container.querySelector('[data-testid="settings-about-copy"]')).toBeNull()
    expect(container.textContent).not.toContain('Revision')
    expect(container.textContent).not.toContain('Copy')
    expect(container.textContent).not.toContain('development build')

    // FR-004: read-only information, no checkbox, select, or radio.
    expect(container.querySelectorAll('.settings-main input, .settings-main select')).toHaveLength(
      0
    )
  })

  it('shows no revision content even when the build carries revision metadata', async () => {
    renderDialog()
    await clickButton('About')
    expect(container.querySelector('[data-testid="settings-about-revision"]')).toBeNull()
    expect(buttons().some((b) => b.textContent?.trim() === 'Copy')).toBe(false)
    expect(container.textContent).not.toContain(currentBuildInfo.revision ?? '')
  })

  it('keeps the repository link usable when getBuildInfo resolves a failure (review 2026-08-23)', async () => {
    window.api = {
      getBuildInfo: () =>
        Promise.resolve({ ok: false, code: 'IO', message: 'Unauthorized renderer' })
    } as unknown as typeof window.api
    renderDialog()
    await clickButton('About')

    // The link is a constant needing no fetched data, it must stay usable;
    // only the version row degrades, showing no fabricated values.
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
})

describe('the Markdown area without word wrap (spec 050 FR-008)', () => {
  it('renders no word wrap control and keeps the remaining switches', async () => {
    renderDialog()
    await clickButton('Markdown')

    expect(container.querySelector('input[name="word-wrap"]')).toBeNull()
    expect(container.textContent).not.toContain('Wrap long lines')

    const switchTexts = Array.from(container.querySelectorAll('.settings-switch-text')).map((el) =>
      el.textContent?.trim()
    )
    expect(switchTexts).toEqual([
      'Syntax highlight code blocks',
      'Show the formatting bar',
      'Convert single line breaks to hard breaks',
      'Strikethrough formatting (~~text~~)',
      'Tables formatting (| column |)',
      'Task list checkboxes (- [ ] / - [x])',
      'Math and LaTeX expressions ($...$ and $$...$$)',
      'Automatic link detection for URLs and emails'
    ])
  })
})

describe('the editor theme dropdown without a visible label (spec 050 FR-006)', () => {
  it('keeps a programmatic name after the visible "Theme" label is removed', async () => {
    renderDialog()
    await clickButton('Theme')

    const select = container.querySelector<HTMLSelectElement>('select[data-testid="editor-theme"]')
    if (!select) throw new Error('editor-theme select missing')
    expect(select.getAttribute('aria-label')).toBe('Theme')
    // The section legend names the group; no stray visible "Theme" label remains.
    const fieldset = select.closest('fieldset')
    const legend = fieldset?.querySelector('.settings-legend')?.textContent
    expect(legend).toBe('Editor Theme')
    expect(fieldset?.querySelector('label')).toBeNull()
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
    const select = container.querySelector<HTMLSelectElement>('select[data-testid="editor-theme"]')
    if (!select) throw new Error('editor-theme select missing')
    await act(async () => {
      select.value = 'scholarly'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await clickButton('About')
    await clickButton('Save')

    expect(props.onEditorThemeSave).toHaveBeenCalledTimes(1)
    expect(props.onEditorThemeSave).toHaveBeenCalledWith('scholarly')
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

describe('Editor Theme dropdown placeholder (spec 047 FR-004)', () => {
  it('shows the disabled no-selection sentinel when the committed name matches no theme', async () => {
    const props = baseProps()
    props.editorTheme = 'vanished'
    renderDialog(props)

    await clickButton('Theme')
    const select = container.querySelector<HTMLSelectElement>('select[data-testid="editor-theme"]')
    if (!select) throw new Error('editor-theme select missing')
    expect(select.value).toBe('')
    const sentinel = select.querySelector<HTMLOptionElement>('option[value=""]')
    expect(sentinel?.textContent).toBe('No matching theme')
    expect(sentinel?.disabled).toBe(true)
    // Only the two discovered themes are offered besides the sentinel.
    expect(select.querySelectorAll('option')).toHaveLength(3)
  })

  it('saving without choosing a theme commits nothing while the placeholder is shown', async () => {
    const props = baseProps()
    props.editorTheme = 'vanished'
    renderDialog(props)

    await clickButton('Theme')
    await clickButton('Save')

    expect(props.onEditorThemeSave).not.toHaveBeenCalled()
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})

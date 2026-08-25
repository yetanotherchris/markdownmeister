import { useEffect, useRef, useState } from 'react'
import type {
  EditorThemeDefinition,
  SpellcheckLanguage,
  FileOpenBehavior
} from '../../shared/ipc-contract'
import type { ThemeChoice } from '../hooks/useEffectiveTheme'
import type { MarkdownSyntaxOptions } from '../editor/markdownSyntaxOptions'
import AboutArea from './AboutArea'
import './settings.css'

export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System default' }
]

export const SPELLCHECK_LANGUAGE_CHOICES: { value: SpellcheckLanguage; label: string }[] = [
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-US', label: 'English (United States)' }
]

export type SettingsArea = 'general' | 'theme' | 'markdown' | 'about'

export const SETTINGS_AREAS: { value: SettingsArea; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'theme', label: 'Theme' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'about', label: 'About' }
]

interface SettingsDialogProps {
  editorThemes: EditorThemeDefinition[]

  invalidThemeFileNames: string[]
  /** The committed selection (a theme-file stem) for seeding the draft. */
  editorTheme: string

  onRefreshEditorThemes: () => Promise<void>

  onEditorThemeSave: (theme: string) => void
  /** The currently selected app theme (from persisted settings). */
  theme: ThemeChoice

  onThemeChange: (theme: ThemeChoice) => void

  spellcheckEnabled: boolean
  onSpellcheckChange: (enabled: boolean) => void

  spellcheckLanguage: SpellcheckLanguage | null
  onSpellcheckLanguageChange: (language: SpellcheckLanguage | null) => void

  fileOpenBehavior: FileOpenBehavior
  onFileOpenBehaviorChange: (behavior: FileOpenBehavior) => void

  markdownOptions: MarkdownSyntaxOptions
  onMarkdownOptionChange: (patch: Partial<MarkdownSyntaxOptions>) => void
  visualCodeHighlighting: boolean
  onVisualCodeHighlightingChange: (enabled: boolean) => void
  formattingBarVisible: boolean
  onFormattingBarVisibleChange: (visible: boolean) => void
  onClose: () => void
}

export default function SettingsDialog({
  editorThemes,
  invalidThemeFileNames,
  editorTheme,
  onRefreshEditorThemes,
  onEditorThemeSave,
  theme,
  onThemeChange,
  spellcheckEnabled,
  onSpellcheckChange,
  spellcheckLanguage,
  onSpellcheckLanguageChange,
  fileOpenBehavior,
  onFileOpenBehaviorChange,
  markdownOptions,
  onMarkdownOptionChange,
  visualCodeHighlighting,
  onVisualCodeHighlightingChange,
  formattingBarVisible,
  onFormattingBarVisibleChange,
  onClose
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState<SettingsArea>('general')

  const stageableTheme = (themes: EditorThemeDefinition[]): string | null =>
    themes.some((entry) => entry.name === editorTheme) ? editorTheme : null
  const draftTouchedRef = useRef(false)
  const [draftEditorTheme, setDraftEditorTheme] = useState<string | null>(() =>
    stageableTheme(editorThemes)
  )
  const latestThemesRef = useRef(editorThemes)
  latestThemesRef.current = editorThemes
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const returnFocusRef = useRef<HTMLElement | null>(null)

  // Focus moves into the dialog on open (the active area's first navigation
  // button), remembering what to restore on close.
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>('.settings-nav-button')?.focus()
    return () => {
      returnFocusRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void onRefreshEditorThemes().then(() => {
      if (!cancelled && !draftTouchedRef.current) {
        setDraftEditorTheme(stageableTheme(latestThemesRef.current))
      }
    })
    return () => {
      cancelled = true
    }
  }, [onRefreshEditorThemes, editorTheme])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const root = dialogRef.current
      if (!root) return
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>('input, button, select')
      ).filter((el) => !el.hasAttribute('disabled'))
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault()
        last.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      className="settings-dialog-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        data-testid="settings-dialog"
      >
        <div className="settings-dialog-header">
          <h2 id="settings-dialog-title" className="settings-dialog-title">
            Settings
          </h2>
          <button
            type="button"
            className="settings-dialog-close"
            aria-label="Close settings"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <div className="settings-dialog-layout">
          <nav className="settings-sidebar" aria-label="Settings areas">
            {SETTINGS_AREAS.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className={
                  area === entry.value
                    ? 'settings-nav-button settings-nav-active'
                    : 'settings-nav-button'
                }
                aria-pressed={area === entry.value}
                onClick={() => setArea(entry.value)}
              >
                {entry.label}
              </button>
            ))}
          </nav>
          <div className="settings-main">
            {area === 'general' ? (
              <>
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Spellcheck</legend>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="spellcheck"
                      checked={spellcheckEnabled}
                      onChange={(e) => onSpellcheckChange(e.target.checked)}
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">Check spelling while typing</span>
                  </label>
                  <label className="settings-select-label" htmlFor="spellcheck-language">
                    <span>Language</span>
                    <select
                      id="spellcheck-language"
                      data-testid="spellcheck-language"
                      value={spellcheckLanguage ?? ''}
                      disabled={!spellcheckEnabled}
                      onChange={(e) =>
                        onSpellcheckLanguageChange(
                          e.target.value === '' ? null : (e.target.value as SpellcheckLanguage)
                        )
                      }
                    >
                      <option value="">System default</option>
                      {SPELLCHECK_LANGUAGE_CHOICES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Opening Files</legend>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="file-open-behavior"
                      checked={fileOpenBehavior === 'new-tab'}
                      onChange={(e) =>
                        onFileOpenBehaviorChange(e.target.checked ? 'new-tab' : 'same-tab')
                      }
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">Open files in a new tab</span>
                  </label>
                </fieldset>
              </>
            ) : area === 'markdown' ? (
              <>
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Markdown</legend>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="visual-code-highlighting"
                      checked={visualCodeHighlighting}
                      onChange={(e) => onVisualCodeHighlightingChange(e.target.checked)}
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">Syntax highlight code blocks</span>
                  </label>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="formatting-bar-visible"
                      checked={formattingBarVisible}
                      onChange={(e) => onFormattingBarVisibleChange(e.target.checked)}
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">Show the formatting bar</span>
                  </label>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="markdown-hard-breaks"
                      checked={markdownOptions.hardBreaks}
                      onChange={(e) => onMarkdownOptionChange({ hardBreaks: e.target.checked })}
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">
                      Convert single line breaks to hard breaks
                    </span>
                  </label>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="markdown-strikethrough"
                      checked={markdownOptions.strikethrough}
                      onChange={(e) => onMarkdownOptionChange({ strikethrough: e.target.checked })}
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">
                      Strikethrough formatting (~~text~~)
                    </span>
                  </label>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="markdown-tables"
                      checked={markdownOptions.tables}
                      onChange={(e) => onMarkdownOptionChange({ tables: e.target.checked })}
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">Tables formatting (| column |)</span>
                  </label>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="markdown-task-lists"
                      checked={markdownOptions.taskLists}
                      onChange={(e) => onMarkdownOptionChange({ taskLists: e.target.checked })}
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">
                      Task list checkboxes (- [ ] / - [x])
                    </span>
                  </label>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="markdown-math"
                      checked={markdownOptions.math}
                      onChange={(e) => onMarkdownOptionChange({ math: e.target.checked })}
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">
                      Math and LaTeX expressions ($...$ and $$...$$)
                    </span>
                  </label>
                  <label className="settings-switch">
                    <input
                      type="checkbox"
                      className="settings-switch-input"
                      name="markdown-autolink"
                      checked={markdownOptions.autolink}
                      onChange={(e) => onMarkdownOptionChange({ autolink: e.target.checked })}
                    />
                    <span className="settings-switch-track" aria-hidden="true" />
                    <span className="settings-switch-text">
                      Automatic link detection for URLs and emails
                    </span>
                  </label>
                </fieldset>
              </>
            ) : area === 'theme' ? (
              <>
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Theme</legend>
                  {THEME_CHOICES.map((option) => (
                    <label key={option.value} className="settings-radio">
                      <input
                        type="radio"
                        name="theme"
                        value={option.value}
                        checked={theme === option.value}
                        onChange={() => onThemeChange(option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </fieldset>
                <fieldset className="settings-fieldset">
                  <legend className="settings-legend">Editor Theme</legend>
                  {editorThemes.map((option) => (
                    <label key={option.name} className="settings-radio">
                      <input
                        type="radio"
                        name="editor-theme"
                        value={option.name}
                        checked={draftEditorTheme === option.name}
                        onChange={() => {
                          draftTouchedRef.current = true
                          setDraftEditorTheme(option.name)
                        }}
                      />
                      <span>{option.name}</span>
                    </label>
                  ))}
                  {invalidThemeFileNames.length > 0 && (
                    <p className="settings-theme-invalid-note">
                      Unreadable theme files ignored: {invalidThemeFileNames.join(', ')}
                    </p>
                  )}
                </fieldset>
              </>
            ) : (
              <AboutArea />
            )}
          </div>
        </div>
        <div className="settings-dialog-footer">
          <button type="button" className="settings-dialog-close-btn" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="settings-dialog-save"
            onClick={() => {
              if (draftEditorTheme !== null) onEditorThemeSave(draftEditorTheme)
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

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

/** Spec 013: the theme choices; `'system'` maps to the persisted override
 *  `null` (the setting's default and "follow the OS"). */
export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System default' }
]

/** Spec 020 (2026-08-07): the explicit spellchecker languages offered, with
 *  `''` mapping to the persisted `null` ("follow the system"). A closed list,
 *  more languages can be added here later. */
export const SPELLCHECK_LANGUAGE_CHOICES: { value: SpellcheckLanguage; label: string }[] = [
  { value: 'en-GB', label: 'English (United Kingdom)' },
  { value: 'en-US', label: 'English (United States)' }
]

/** Spec 008 FR-002: the settings areas shown in the sidebar navigation. Each
 *  mount starts with `general` selected (FR-005). Spec 030 FR-001 adds a
 *  `Markdown` area. Spec 037 adds a read-only `about` area, last per the
 *  spec's placement assumption. */
export type SettingsArea = 'general' | 'theme' | 'markdown' | 'about'

export const SETTINGS_AREAS: { value: SettingsArea; label: string }[] = [
  { value: 'general', label: 'General' },
  { value: 'theme', label: 'Theme' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'about', label: 'About' }
]

interface SettingsDialogProps {
  /** Spec 036 FR-005: the discovered editor theme files, refreshed every time
   *  the dialog opens; labels are the file stems verbatim. */
  editorThemes: EditorThemeDefinition[]
  /** Spec 036 FR-010: rejected theme file names, surfaced as a quiet
   *  (non-modal) note so their exclusion is indicated without blocking. */
  invalidThemeFileNames: string[]
  /** The committed selection (a theme-file stem) for seeding the draft. */
  editorTheme: string
  /** Spec 036 FR-012: called on every mount so file edits take effect at the
   *  next dialog open without a restart. */
  onRefreshEditorThemes: () => Promise<void>
  /** Spec 016, FR-003/US1 S4: called by the Save button with the staged
   *  theme name, then the dialog closes. Closing without Save leaves the
   *  canvas at the committed value. */
  onEditorThemeSave: (theme: string) => void
  /** The currently selected app theme (from persisted settings). */
  theme: ThemeChoice
  /** Spec 013: the apply-immediately model, a selection persists at once. */
  onThemeChange: (theme: ThemeChoice) => void
  /** Spec 020 FR-006/US4: whether native spellcheck is on. Applied immediately
   *  on change (S1: markers vanish the moment the box is unchecked). */
  spellcheckEnabled: boolean
  onSpellcheckChange: (enabled: boolean) => void
  /** Spec 020 (2026-08-07): the explicit spellchecker language, or `null` for
   *  the system default. Applied immediately. */
  spellcheckLanguage: SpellcheckLanguage | null
  onSpellcheckLanguageChange: (language: SpellcheckLanguage | null) => void
  /** Spec 008 FR-008: whether explorer-originated file opens should always
   *  create a new tab. Applied immediately. */
  fileOpenBehavior: FileOpenBehavior
  onFileOpenBehaviorChange: (behavior: FileOpenBehavior) => void
  /** Spec 030: the six markdown syntax options (FR-003..FR-008). */
  markdownOptions: MarkdownSyntaxOptions
  onMarkdownOptionChange: (patch: Partial<MarkdownSyntaxOptions>) => void
  visualCodeHighlighting: boolean
  onVisualCodeHighlightingChange: (enabled: boolean) => void
  onClose: () => void
}

/**
 * Spec 008/012/013/016 settings dialog (contracts/settings-ui.md). A
 * keyboard-accessible React modal: `role="dialog"` + `aria-modal="true"`, focus
 * trapped on open, closed by Escape, the Close button, or the backdrop with
 * focus returning to the hamburger trigger.
 *
 * Spec 008 (FR-001..008): a wider layout with a persistent sidebar navigating
 * between `General` (spellcheck, file-opening preference) and `Theme` (app
 * theme, immediate; editor theme, staged). Boolean controls are native
 * checkboxes styled as pill switches. Every enabled input, select, and
 * navigation/footer button is inside the focus trap.
 */
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
  onClose
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  // Spec 008 FR-005: each mount starts on General, regardless of the area a
  // prior instance closed on. Fresh state because the dialog unmounts on close.
  const [area, setArea] = useState<SettingsArea>('general')
  /** The committed name when it is present in `themes`, else null (nothing
   *  staged, spec 016: Save only commits a staged theme). */
  const stageableTheme = (themes: EditorThemeDefinition[]): string | null =>
    themes.some((entry) => entry.name === editorTheme) ? editorTheme : null
  // Spec 016: the staged editor-theme selection, seeded from the committed
  // name. Not applied on click, only the Save button commits it (US1 S4).
  // Spec 036: the draft is a theme-file stem; when the committed selection
  // matches no discovered theme the dialog starts with nothing staged.
  const draftTouchedRef = useRef(false)
  const [draftEditorTheme, setDraftEditorTheme] = useState<string | null>(() =>
    stageableTheme(editorThemes)
  )
  // The mount refresh (below) replaces the preloaded list; re-seed from it so
  // the dialog never shows nothing staged (and Save silently no-ops) just
  // because the initial cache predates discovery (review finding 2026-08-23).
  // An explicit user pick is never overwritten.
  const latestThemesRef = useRef(editorThemes)
  latestThemesRef.current = editorThemes
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  // The element that had focus when the dialog opened; focus returns to it on
  // close (review #27, the hamburger trigger, per the plan's FR-007 contract).
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

  // Spec 036 FR-012: every mount re-reads the themes folder, so a file added,
  // edited, or deleted since the last open is reflected without a restart.
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

  // Focus trap: Tab and Shift+Tab cycle within the dialog (FR-007). Spec 008:
  // the trap covers enabled buttons, checkbox/switch inputs, radio inputs, and
  // selects (contracts/settings-ui.md).
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
      // Tab wraps forward from the last element, and also pulls focus back in
      // when it has strayed outside the dialog (review #27, focus-trap gap).
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
        // Clicking the backdrop closes the dialog (outside-click), discarding
        // any staged editor-theme selection (US1 S4).
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
              // Spec 037 FR-008: purely read-only rows, no staged state here,
              // so the Save button's draftEditorTheme commit is untouched.
              // Terminal fallback so the branch chain mirrors SETTINGS_AREAS
              // nav order: General → Theme → Markdown → About (standards §4).
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
              // Spec 023: with a Custom theme no preset is staged, Save just
              // closes (the app-theme choices apply immediately). General-area
              // settings already applied immediately; Save only commits the
              // staged editor theme (spec 008 apply-model clarification).
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

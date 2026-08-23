import { useCallback, useState } from 'react'
import { updateSettings, getSettings } from '../state/settings'
import type { SpellcheckLanguage, FileOpenBehavior } from '../../shared/ipc-contract'
import {
  useEffectiveTheme,
  themeChoiceFromOverride,
  themeOverrideFromChoice
} from './useEffectiveTheme'
import type { ThemeChoice } from './useEffectiveTheme'
import { getEditorThemes, loadEditorThemesFromMain } from '../state/editorThemes'
import type { EditorThemeDefinition } from '../../shared/ipc-contract'
import { instancePool } from '../editor/instancePool'
import { reconfigureAll } from '../editor/markdownSyntaxRuntime'
import type { MarkdownSyntaxOptions } from '../editor/markdownSyntaxOptions'

/**
 * Spec 012/013/016/036: the settings-dialog state the composition root owns —
 * the open flag (single instance), the editor theme (a theme-file name since
 * spec 036), the app theme choice (spec 013), their apply-and-persist
 * handlers, the delivered theme definitions, and the effective `data-theme`
 * mode. Seeded from the caches main.tsx preloads before the first render; each
 * selection persists through the existing settings store + IPC.
 *
 * Spec 016 (FR-003/US1 S4): the editor theme is applied ONLY when the dialog's
 * Save button commits it (the dialog stages the selection locally); the app
 * theme keeps its apply-immediately behavior (spec 013).
 */
export function useSettingsState(): {
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  /** Spec 036: the stored theme name (a theme-file stem). */
  editorTheme: string
  handleEditorThemeChange: (theme: string) => void
  /** Spec 036: the discovered editor theme files, refreshed on demand. */
  editorThemes: EditorThemeDefinition[]
  refreshEditorThemes: () => Promise<void>
  spellcheckEnabled: boolean
  handleSpellcheckChange: (enabled: boolean) => void
  spellcheckLanguage: SpellcheckLanguage | null
  handleSpellcheckLanguageChange: (language: SpellcheckLanguage | null) => void
  fileOpenBehavior: FileOpenBehavior
  handleFileOpenBehaviorChange: (behavior: FileOpenBehavior) => void
  markdownOptions: MarkdownSyntaxOptions
  handleMarkdownOptionChange: (patch: Partial<MarkdownSyntaxOptions>) => void
  visualCodeHighlighting: boolean
  handleVisualCodeHighlightingChange: (enabled: boolean) => void
  themeChoice: ThemeChoice
  handleThemeChange: (choice: ThemeChoice) => void
  themeMode: 'light' | 'dark'
} {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editorTheme, setEditorTheme] = useState<string>(getSettings().editorTheme)
  // Spec 036: the delivered theme definitions (preloaded by main.tsx); the
  // settings dialog refreshes them on every open (FR-012).
  const [editorThemes, setEditorThemes] = useState<EditorThemeDefinition[]>(
    getEditorThemes().themes
  )
  const refreshEditorThemes = useCallback(async () => {
    await loadEditorThemesFromMain()
    setEditorThemes(getEditorThemes().themes)
  }, [])
  const [spellcheckEnabled, setSpellcheckEnabled] = useState<boolean>(
    getSettings().spellcheckEnabled
  )
  const [spellcheckLanguage, setSpellcheckLanguage] = useState<SpellcheckLanguage | null>(
    getSettings().spellcheckLanguage
  )
  const [fileOpenBehavior, setFileOpenBehavior] = useState<FileOpenBehavior>(
    getSettings().fileOpenBehavior
  )
  const [markdownOptions, setMarkdownOptions] = useState<MarkdownSyntaxOptions>(() => ({
    hardBreaks: getSettings().hardBreaks,
    strikethrough: getSettings().strikethrough,
    tables: getSettings().tables,
    taskLists: getSettings().taskLists,
    math: getSettings().math,
    autolink: getSettings().autolink
  }))
  const [visualCodeHighlighting, setVisualCodeHighlighting] = useState(
    getSettings().visualCodeHighlighting
  )
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(() =>
    themeChoiceFromOverride(getSettings().themeOverride)
  )
  const themeMode = useEffectiveTheme(themeChoice)

  // Spec 016/036, FR-003/FR-004: commit the editor theme (persist + apply).
  // Called by the dialog's Save button with a theme-file name; the visual
  // switch flows through `editorTheme` → resolveEditorAppearance → the inline
  // `--mm-theme-*` variables. The persisted value reaches main for validation
  // via updateSettings. Colours and typeface come from the theme FILE now —
  // nothing else is written (spec 036 FR-008).
  const handleEditorThemeChange = useCallback((theme: string) => {
    setEditorTheme(theme)
    updateSettings({ editorTheme: theme })
    window.api.updateSettings({ editorTheme: theme }).catch(() => {
      /* ignore */
    })
  }, [])

  // Spec 013: apply the theme immediately and persist (FR-006, FR-008). The
  // visual switch flows through `themeChoice` → `useEffectiveTheme` (the
  // `data-theme` attribute); the persisted override reaches main for the native
  // chrome (src/main/theme.ts). The local state keeps the dialog's radio in sync.
  const handleThemeChange = useCallback((choice: ThemeChoice) => {
    setThemeChoice(choice)
    const override = themeOverrideFromChoice(choice)
    updateSettings({ themeOverride: override })
    window.api.updateSettings({ themeOverride: override }).catch(() => {
      /* ignore */
    })
  }, [])

  // Spec 020 FR-006/US4: apply the spellcheck choice immediately and persist.
  // The session-side switch flows through the IPC (applied in main's
  // settings:update handler); the DOM attribute switch flows through
  // `spellcheckEnabled` → the editor components' spellcheck props.
  const handleSpellcheckChange = useCallback((enabled: boolean) => {
    setSpellcheckEnabled(enabled)
    updateSettings({ spellcheckEnabled: enabled })
    window.api.updateSettings({ spellcheckEnabled: enabled }).catch(() => {
      /* ignore */
    })
  }, [])

  // Spec 020 (2026-08-07): apply the chosen spellchecker language immediately
  // and persist it. `null` = the platform/system default (applied in main).
  const handleSpellcheckLanguageChange = useCallback((language: SpellcheckLanguage | null) => {
    setSpellcheckLanguage(language)
    updateSettings({ spellcheckLanguage: language })
    window.api.updateSettings({ spellcheckLanguage: language }).catch(() => {
      /* ignore */
    })
  }, [])

  // Spec 008 FR-008: apply the explorer file-opening preference immediately and
  // persist it. The explorer open decision reads the cached value at open time.
  const handleFileOpenBehaviorChange = useCallback((behavior: FileOpenBehavior) => {
    setFileOpenBehavior(behavior)
    updateSettings({ fileOpenBehavior: behavior })
    window.api.updateSettings({ fileOpenBehavior: behavior }).catch(() => {
      /* ignore */
    })
  }, [])

  // Spec 030 (FR-003..FR-012): apply a markdown syntax toggle immediately and
  // persist it. The settings cache is updated synchronously, then the merged
  // six-field snapshot is pushed into every live editor so all open tabs
  // re-parse (research R5/R6, FR-010/011). The re-parse never touches dirty
  // state, undo history, cursor, or scroll (suppressed in markdownSyntaxRuntime).
  const handleMarkdownOptionChange = useCallback(
    (patch: Partial<MarkdownSyntaxOptions>) => {
      const next = { ...markdownOptions, ...patch }
      setMarkdownOptions(next)
      updateSettings(next)
      window.api.updateSettings(next).catch(() => {
        /* ignore */
      })
      reconfigureAll(instancePool, next)
    },
    [markdownOptions]
  )

  const handleVisualCodeHighlightingChange = useCallback((enabled: boolean) => {
    setVisualCodeHighlighting(enabled)
    updateSettings({ visualCodeHighlighting: enabled })
    window.api.updateSettings({ visualCodeHighlighting: enabled }).catch(() => {
      /* ignore */
    })
  }, [])

  return {
    settingsOpen,
    setSettingsOpen,
    editorTheme,
    handleEditorThemeChange,
    editorThemes,
    refreshEditorThemes,
    spellcheckEnabled,
    handleSpellcheckChange,
    spellcheckLanguage,
    handleSpellcheckLanguageChange,
    fileOpenBehavior,
    handleFileOpenBehaviorChange,
    markdownOptions,
    handleMarkdownOptionChange,
    visualCodeHighlighting,
    handleVisualCodeHighlightingChange,
    themeChoice,
    handleThemeChange,
    themeMode
  }
}

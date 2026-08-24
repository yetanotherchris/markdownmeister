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

export function useSettingsState(): {
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void

  editorTheme: string
  handleEditorThemeChange: (theme: string) => void

  editorThemes: EditorThemeDefinition[]

  invalidThemeFileNames: string[]
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
  const [editorThemes, setEditorThemes] = useState<EditorThemeDefinition[]>(
    getEditorThemes().themes
  )
  const [invalidThemeFileNames, setInvalidThemeFileNames] = useState<string[]>(
    getEditorThemes().invalidNames
  )
  const refreshEditorThemes = useCallback(async () => {
    await loadEditorThemesFromMain()
    setEditorThemes(getEditorThemes().themes)
    setInvalidThemeFileNames(getEditorThemes().invalidNames)
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

  const handleEditorThemeChange = useCallback((theme: string) => {
    setEditorTheme(theme)
    updateSettings({ editorTheme: theme })
    window.api.updateSettings({ editorTheme: theme }).catch(() => {
      /* ignore */
    })
  }, [])

  const handleThemeChange = useCallback((choice: ThemeChoice) => {
    setThemeChoice(choice)
    const override = themeOverrideFromChoice(choice)
    updateSettings({ themeOverride: override })
    window.api.updateSettings({ themeOverride: override }).catch(() => {
      /* ignore */
    })
  }, [])

  const handleSpellcheckChange = useCallback((enabled: boolean) => {
    setSpellcheckEnabled(enabled)
    updateSettings({ spellcheckEnabled: enabled })
    window.api.updateSettings({ spellcheckEnabled: enabled }).catch(() => {
      /* ignore */
    })
  }, [])

  const handleSpellcheckLanguageChange = useCallback((language: SpellcheckLanguage | null) => {
    setSpellcheckLanguage(language)
    updateSettings({ spellcheckLanguage: language })
    window.api.updateSettings({ spellcheckLanguage: language }).catch(() => {
      /* ignore */
    })
  }, [])

  const handleFileOpenBehaviorChange = useCallback((behavior: FileOpenBehavior) => {
    setFileOpenBehavior(behavior)
    updateSettings({ fileOpenBehavior: behavior })
    window.api.updateSettings({ fileOpenBehavior: behavior }).catch(() => {
      /* ignore */
    })
  }, [])

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
    invalidThemeFileNames,
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

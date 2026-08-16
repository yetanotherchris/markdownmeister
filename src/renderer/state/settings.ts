import type { Settings } from '../../shared/ipc-contract'
import { RUSTIC_COLORS } from '../../shared/editorThemePresets'
import { MARKDOWN_SYNTAX_DEFAULTS } from '../../shared/markdownSyntaxDefaults'

// Spec 008 clarification 2026-08-09: presets are materialised in the config,
// not stored as null. The renderer's fallback mirrors main's DEFAULTS so a
// fresh config never flashes or persists null editorColors.
const defaults: Settings = {
  sidebarWidth: 30,
  themeOverride: null,
  explorerVisible: true,
  editorFont: 'sans-serif',
  editorTheme: 'rustic',
  editorColors: RUSTIC_COLORS,
  spellcheckEnabled: true,
  spellcheckLanguage: null,
  fileOpenBehavior: 'same-tab',
  // Spec 030 FR-013 (shared markdownSyntaxDefaults): hard breaks off, the five
  // syntax extensions on.
  ...MARKDOWN_SYNTAX_DEFAULTS,
  visualCodeHighlighting: true
}

let cached: Settings = { ...defaults }

export function getSettings(): Settings {
  return cached
}

export function updateSettings(patch: Partial<Settings>): void {
  cached = { ...cached, ...patch }
}

export async function loadSettingsFromMain(): Promise<void> {
  const result = await window.api.getSettings()
  if (result.ok) {
    cached = { ...defaults, ...result.value }
  }
}

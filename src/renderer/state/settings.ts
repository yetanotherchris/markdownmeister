import type { Settings } from '../../shared/ipc-contract'
import { MARKDOWN_SYNTAX_DEFAULTS } from '../../shared/markdownSyntaxDefaults'

// Spec 036: the editor theme is a theme FILE name; its colours and typeface
// come from <configDir>/themes/<name>.json, so no palette is cached here.
const defaults: Settings = {
  sidebarWidth: 30,
  themeOverride: null,
  explorerVisible: true,
  editorTheme: 'rustic',
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

import type {
  EditorColors,
  EditorThemeDefinition,
  EditorThemesList
} from '../../shared/ipc-contract'
import { EMERGENCY_EDITOR_THEME } from '../../shared/editorThemeTokens'

/**
 * Spec 036: the renderer's cache of the discovered editor theme files,
 * preloaded before the first render (main.tsx, mirroring the settings cache)
 * and refreshed every time the settings dialog opens (FR-012). Resolution is
 * pure and renderer-side: the appearance decides which of a theme's two
 * palettes applies (FR-004), and an unresolved selection renders the FR-001
 * emergency appearance while main repairs the stored name (contracts/preload.md).
 */

let cached: EditorThemeDefinition[] = []
let cachedInvalidNames: string[] = []

export function getEditorThemes(): EditorThemesList {
  return { themes: cached, invalidNames: cachedInvalidNames }
}

export function updateEditorThemes(list: EditorThemesList): void {
  cached = list.themes
  cachedInvalidNames = list.invalidNames
}

export async function loadEditorThemesFromMain(): Promise<void> {
  const result = await window.api.getEditorThemes()
  if (result.ok) updateEditorThemes(result.value)
}

/** Pure (FR-004): the palette matching the effective appearance. */
export function paletteForMode(
  theme: EditorThemeDefinition,
  mode: 'light' | 'dark'
): EditorColors {
  return mode === 'dark' ? theme.dark : theme.light
}

export interface ResolvedEditorAppearance {
  /** The resolved definition's name, or null when nothing matched. */
  definitionName: string | null
  palette: EditorColors
  typeface: string
}

/** Pure: resolve the stored selection against the delivered definitions.
 *  An unresolved name (deleted/invalid/not-yet-listed file) yields today's
 *  default appearance instead — never an error, never empty colours. */
export function resolveEditorAppearance(
  name: string,
  mode: 'light' | 'dark',
  themes: EditorThemeDefinition[]
): ResolvedEditorAppearance {
  const definition = themes.find((theme) => theme.name === name)
  if (!definition) {
    return {
      definitionName: null,
      palette: EMERGENCY_EDITOR_THEME.light,
      typeface: EMERGENCY_EDITOR_THEME.typeface
    }
  }
  return { definitionName: definition.name, palette: paletteForMode(definition, mode), typeface: definition.typeface }
}
